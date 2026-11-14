import { mkdir, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { format } from "prettier";
import { disposable } from "../../tests/support/database.mjs";
import { startApi, startWorker, stop } from "../../tests/support/processes.mjs";
import { freePort, poll } from "../../tests/support/polling.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

// Read-only live provider capture. No intercepted imagery or fabricated records.
const stage = process.argv[2] ?? "before";
if (!["before", "after"].includes(stage))
  throw new Error("Use before or after");
const folder = `docs/evidence/live/2026-11-12-fm/${stage}`;
await mkdir(folder, { recursive: true });
const db = await disposable();
let api, worker, web, browser;
const records = [];
const contexts = [];
async function writeJson(path, value) {
  await writeFile(
    path,
    await format(JSON.stringify(value), { parser: "json" }),
  );
}
try {
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    ROTATION_CATALOG_VERSION: "0.1.0",
  });
  worker = await startWorker(db);
  const port = await freePort();
  web = spawn(
    process.execPath,
    [
      "apps/web/node_modules/vite/bin/vite.js",
      "preview",
      "apps/web",
      ...(stage === "before" ? ["--outDir", "/tmp/fm-baseline-dist"] : []),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: { ...process.env, API_PROXY_TARGET: api.origin },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  web.output = "";
  web.exited = new Promise((resolve) => web.once("exit", resolve));
  web.stdout.on("data", (data) => (web.output += data));
  web.stderr.on("data", (data) => (web.output += data));
  await poll(async () => (await fetch(`http://127.0.0.1:${port}`)).ok);
  browser = process.env.ROTAVISE_BROWSER_WS
    ? await chromium.connect(process.env.ROTAVISE_BROWSER_WS, {
        exposeNetwork: "<loopback>",
      })
    : await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ])
    for (const dpr of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      const errors = [],
        responses = [],
        hosts = new Set();
      page.on("console", (m) => {
        if (["warning", "error"].includes(m.type()))
          errors.push(`${m.type()}: ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().startsWith("http")) hosts.add(new URL(r.url()).host);
      });
      page.on("response", (r) => {
        if (r.status() >= 400)
          responses.push({ url: r.url(), status: r.status() });
      });
      const navigationStart = Date.now();
      await page.goto(`http://127.0.0.1:${port}/map`);
      if (stage === "before") {
        await page.locator(".f1-app").waitFor();
        await page.screenshot({
          path: `${folder}/shell-blocked-${width}-dpr${dpr}.png`,
        });
        const state = {
          errors: [...errors],
          responses: [...responses],
          body: await page.locator("body").innerText(),
        };
        await writeJson(`${folder}/shell-${width}-dpr${dpr}.json`, state);
        const file = (await readdir("/tmp/fm-baseline-dist/assets")).find((f) =>
          /^mapRenderer-.*\.js$/.test(f),
        );
        await page.evaluate(async (file) => {
          const { createRenderer } = await import("/assets/" + file);
          const main = document.querySelector("main");
          main.innerHTML =
            '<section class="f2-map" style="height:100%;width:100%;position:relative"><div class="f2-map-canvas" style="position:absolute;inset:0"></div></section>';
          window.fmRenderer = createRenderer(
            main.querySelector(".f2-map-canvas"),
            { dates: { modis: "default" }, interactive: true },
          );
        }, file);
      } else {
        await page
          .locator(".f2-map canvas")
          .first()
          .waitFor({ timeout: 30000 });
        await page.evaluate(() => {
          const node = document.querySelector(".f2-map");
          let f =
            node[Object.keys(node).find((k) => k.startsWith("__reactFiber"))];
          while (f) {
            let h = f.memoizedState;
            while (h) {
              if (h.memoizedState?.nativeMap) {
                window.fmRenderer = h.memoizedState;
                return;
              }
              h = h.next;
            }
            f = f.return;
          }
          throw new Error("Renderer not found");
        });
      }
      const diagnostics = {
        width,
        height,
        dpr,
        navigationToCanvasMs: Date.now() - navigationStart,
        errors,
        responses,
        hosts: [],
      };
      contexts.push(diagnostics);
      for (const [place, center] of [
        ["tadla", [-6.55, 32.4]],
        ["beni-mellal", [-6.34, 32.37]],
        ["gharb", [-6.3, 34.3]],
      ])
        for (const zoom of [10, 12, 14, 15, 16]) {
          const result = await page.evaluate(
            async ({ center, zoom }) => {
              const r = window.fmRenderer,
                map = r.nativeMap;
              map.jumpTo({ center, zoom });
              const start = performance.now();
              await new Promise((resolve) => {
                const timer = setTimeout(done, 5000);
                function done() {
                  clearTimeout(timer);
                  map.off("idle", done);
                  resolve();
                }
                map.once("idle", done);
              });
              const c = r.canvas,
                b = c.getBoundingClientRect();
              return {
                elapsedMs: Math.round(performance.now() - start),
                camera: r.camera(),
                sources: map.getStyle().sources,
                layers: map
                  .getStyle()
                  .layers.filter((l) => l.type === "raster"),
                canvas: {
                  width: c.width,
                  height: c.height,
                  cssWidth: b.width,
                  cssHeight: b.height,
                  dpr: devicePixelRatio,
                },
                tilesLoaded: map.areTilesLoaded(),
                feedback:
                  document.querySelector(".f2-map-feedback")?.textContent,
              };
            },
            { center, zoom },
          );
          const file = `${place}-z${zoom}-${width}x${height}-dpr${dpr}.png`;
          await page.screenshot({ path: `${folder}/${file}` });
          records.push({ file, place, width, height, dpr, zoom, ...result });
          diagnostics.hosts = [...hosts];
          await writeJson(`${folder}/measurements.json`, {
            scope:
              stage === "before"
                ? "isolated original renderer; shell blocked by real readiness 503"
                : "full application",
            records,
            contexts,
            errors,
            responses,
            hosts: [...hosts],
          });
          console.log(stage, file, result.elapsedMs, result.feedback);
        }
      if (stage === "after") {
        await page
          .getByRole("button", { name: "Couches de la carte", exact: true })
          .last()
          .click();
        await page.screenshot({
          path: `${folder}/layers-${width}-dpr${dpr}.png`,
        });
      }
      await context.close();
    }
  await writeFile(`${folder}/server.log`, web.output);
} finally {
  await browser?.close();
  if (web) await stop(web);
  if (api) await stop(api.child);
  if (worker) await stop(worker.child);
  await db.close();
}
