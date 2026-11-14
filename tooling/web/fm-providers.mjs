import { mkdir, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { format } from "prettier";
import { freePort, poll } from "../../tests/support/polling.mjs";
import { stop } from "../../tests/support/processes.mjs";
const folder = "docs/evidence/live/2026-11-12-fm/providers";
await mkdir(folder, { recursive: true });
const port = await freePort();
const web = spawn(
  process.execPath,
  [
    "apps/web/node_modules/vite/bin/vite.js",
    "preview",
    "apps/web",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
web.output = "";
web.exited = new Promise((resolve) => web.once("exit", resolve));
web.stdout.on("data", (x) => (web.output += x));
web.stderr.on("data", (x) => (web.output += x));
let browser;
try {
  await poll(async () => (await fetch(`http://127.0.0.1:${port}`)).ok);
  browser = process.env.ROTAVISE_BROWSER_WS
    ? await chromium.connect(process.env.ROTAVISE_BROWSER_WS, {
        exposeNetwork: "<loopback>",
      })
    : await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const assets = await readdir("apps/web/dist/assets");
  const styles = assets.filter((name) =>
    /^(index|mapRenderer)-.*\.css$/.test(name),
  );
  if (!styles.some((name) => name.startsWith("index-")))
    throw new Error("Built application tokens are required for the renderer");
  // An isolated comparison page owns exactly the two side-by-side renderers.
  // It does not start an unrelated app/third map or make absent API requests.
  const harness = `http://127.0.0.1:${port}/fm-provider-comparison`;
  await page.route(harness, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Live imagery comparison</title>${styles.map((name) => `<link rel="stylesheet" href="/assets/${name}">`).join("")}</head><body><main aria-label="Live imagery comparison"></main></body></html>`,
    }),
  );
  await page.goto(harness);
  const file = assets.find((x) => /^mapRenderer-.*\.js$/.test(x));
  const records = [];
  for (const [place, center] of [
    ["tadla", [-6.55, 32.4]],
    ["beni-mellal", [-6.34, 32.37]],
  ]) {
    const record = await page.evaluate(
      async ({ file, place, center }) => {
        const n = 2 ** 12,
          x = Math.floor(((center[0] + 180) / 360) * n),
          y = Math.floor(
            ((1 - Math.asinh(Math.tan((center[1] * Math.PI) / 180)) / Math.PI) /
              2) *
              n,
          );
        const probes = [];
        let date;
        // Evaluate actual centre-tile alpha. No claim of cloud-free daily imagery.
        for (let offset = 0; offset < 56 && !date; offset += 7) {
          const batch = await Promise.all(
            Array.from({ length: 7 }, async (_, i) => {
              const day = new Date(
                Date.UTC(2026, 10, 12) - 86400000 * (offset + i),
              )
                .toISOString()
                .slice(0, 10);
              try {
                const r = await fetch(
                  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/${day}/GoogleMapsCompatible_Level12/12/${y}/${x}.png`,
                  { signal: AbortSignal.timeout(8000) },
                );
                if (!r.ok) return { date: day, status: r.status };
                const b = await createImageBitmap(await r.blob()),
                  c = document.createElement("canvas");
                c.width = b.width;
                c.height = b.height;
                const ctx = c.getContext("2d");
                ctx.drawImage(b, 0, 0);
                b.close();
                const d = ctx.getImageData(0, 0, c.width, c.height).data;
                let count = 0;
                for (let j = 3; j < d.length; j += 4) if (d[j]) count++;
                return {
                  date: day,
                  alphaFraction: count / (c.width * c.height),
                };
              } catch (e) {
                return { date: day, error: String(e) };
              }
            }),
          );
          probes.push(...batch);
          date = batch.find((p) => p.alphaFraction > 0)?.date;
        }
        const root = document.createElement("div");
        root.id = "fm-provider-comparison";
        root.style.cssText =
          "position:fixed;inset:0;z-index:999;background:white;display:grid;grid-template-columns:1fr 1fr;gap:2px;";
        for (const [id, text] of [
          ["eox", `EOX 2025 · 10 m · ${place}`],
          [
            "nasa",
            `NASA HLS · 30 m · ${date ?? "no non-empty date found in 56 days"}`,
          ],
        ]) {
          const panel = document.createElement("section");
          panel.style.cssText = "position:relative;min-width:0;";
          panel.innerHTML = `<div id="fm-${id}" style="position:absolute;inset:38px 0 60px"></div><div style="position:absolute;top:0;padding:10px">${text}</div><div style="position:absolute;bottom:0;padding:8px;font-size:12px">${id === "eox" ? "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)" : "NASA GIBS · HLS Sentinel-2"}<br>OpenFreeMap © OpenMapTiles · © OpenStreetMap contributors</div>`;
          root.append(panel);
        }
        document.body.append(root);
        const { createRenderer } = await import("/assets/" + file);
        window.fmProviders = [
          createRenderer(document.querySelector("#fm-eox"), {
            dates: { modis: "default", base: "satellite" },
            interactive: false,
            camera: { center, zoom: 14 },
          }),
          createRenderer(document.querySelector("#fm-nasa"), {
            dates: { modis: "default", hls: date, base: "nasa" },
            interactive: false,
            camera: { center, zoom: 14 },
          }),
        ];
        return { place, center, date, probes };
      },
      { file, place, center },
    );
    const tiles = [];
    for (const zoom of [14, 15, 16]) {
      const loaded = await page.evaluate(async (zoom) => {
        await Promise.all(
          window.fmProviders.map(
            (r) =>
              new Promise((resolve) => {
                r.nativeMap.jumpTo({ zoom });
                const timer = setTimeout(done, 10000);
                function done() {
                  clearTimeout(timer);
                  r.nativeMap.off("idle", done);
                  resolve();
                }
                r.nativeMap.once("idle", done);
              }),
          ),
        );
        return window.fmProviders.map(
          (r) => r.nativeMap.loaded() && r.nativeMap.areTilesLoaded(),
        );
      }, zoom);
      if (!loaded.every(Boolean))
        throw new Error(`Incomplete provider tiles: ${place} z${zoom}`);
      tiles.push({ zoom, loaded });
      await page.screenshot({
        path: `${folder}/${place}-z${zoom}-eox-hls.png`,
      });
    }
    await page.evaluate(() => {
      window.fmProviders.forEach((r) => r.destroy());
      document.querySelector("#fm-provider-comparison").remove();
    });
    records.push({ ...record, tiles });
    await writeFile(
      `${folder}/probes.json`,
      await format(JSON.stringify(records), { parser: "json" }),
    );
    console.log(place, record.date, record.probes.length);
  }
} finally {
  await browser?.close();
  await stop(web);
}
