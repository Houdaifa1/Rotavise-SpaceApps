import { test, expect } from "@playwright/test";
import { checkScreen } from "../support/web-e2e.mjs";
import { mapRenderer } from "../support/map-browser.mjs";
import {
  browserPorts,
  disposable,
  poll,
  processEnv,
  processFor,
  stop,
} from "../support/index.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
const ports = browserPorts();
let db, api;
async function start() {
  api = processFor(
    "api",
    processEnv(db, {
      API_PORT: String(ports.api),
      PLANS_ENABLED: "true",
      PLANNING_ENABLED: "true",
    }),
  );
  await poll(
    async () => (await fetch(ports.apiOrigin + "/api/v1/health/live")).ok,
  );
}
test.beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  await start();
});
test.afterAll(async () => {
  if (api) await stop(api);
  if (db) await db.close();
});

for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  for (const dpr of [1, 2]) {
    test(`FM native raster, retina, wheel and keyboard ${width} DPR ${dpr}`, async ({
      browser,
      baseURL,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      try {
        const page = await context.newPage();
        const hosts = new Set(),
          missing = [],
          errors = [],
          uncaught = [],
          warnings = [];
        page.on("request", (r) => {
          if (r.url().startsWith("http")) hosts.add(new URL(r.url()).origin);
        });
        page.on("response", (r) => {
          if (r.status() === 404) missing.push(r.url());
        });
        page.on("pageerror", (e) => uncaught.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
          if (m.type() === "warning") warnings.push(m.text());
        });
        await page.addInitScript(() => {
          window.fmCommits = 0;
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
            supportsFiber: true,
            renderers: new Map(),
            inject() {
              return 1;
            },
            onCommitFiberRoot() {
              window.fmCommits++;
            },
            onCommitFiberUnmount() {},
          };
        });
        await page.goto(baseURL + "/map");
        await mapRenderer(page);
        const fieldPaint = await page.evaluate(async () => {
          const map = window.fmRenderer.nativeMap;
          const start = performance.now();
          map.jumpTo({ center: [-6.55, 32.4], zoom: 14 });
          await new Promise((resolve) => {
            if (map.loaded()) return resolve();
            map.once("idle", resolve);
          });
          return {
            navigationToFieldTilesMs: performance.now(),
            cameraToFieldTilesMs: performance.now() - start,
          };
        });
        const metrics = await page.evaluate(async (fieldPaint) => {
          const { nativeMap: map, canvas } = window.fmRenderer;
          const b = canvas.getBoundingClientRect();
          const gl = canvas.getContext("webgl2");
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          const commits = window.fmCommits;
          const samples = [];
          const start = performance.now(),
            zoom = map.getZoom();
          canvas.dispatchEvent(
            new WheelEvent("wheel", {
              bubbles: true,
              cancelable: true,
              deltaY: -120,
              clientX: b.x + b.width / 2,
              clientY: b.y + b.height / 2,
            }),
          );
          await new Promise((resolve) => {
            const frame = (t) => {
              samples.push({ time: t, zoom: map.getZoom() });
              if (t - start < 650) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
          return {
            ...fieldPaint,
            graphicsRenderer: debug
              ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
              : gl.getParameter(gl.RENDERER),
            maxzoom: map.getStyle().sources.satellite.maxzoom,
            tileSize: map.getStyle().sources.satellite.tileSize,
            canvas: [canvas.width, canvas.height],
            css: [b.width, b.height],
            dpr: devicePixelRatio,
            wheelDelta: map.getZoom() - zoom,
            fractional: new Set(
              samples
                .map((s) => s.zoom)
                .filter((z) => z > zoom && z < map.getZoom()),
            ).size,
            samples,
            commits: window.fmCommits - commits,
          };
        }, fieldPaint);
        await info.attach("metrics", {
          body: JSON.stringify(metrics, null, 2),
          contentType: "application/json",
        });
        expect(metrics.maxzoom).toBeGreaterThanOrEqual(15);
        expect(metrics.tileSize).toBe(256);
        expect(metrics.canvas).toEqual(
          metrics.css.map((x) => Math.floor(x * dpr)),
        );
        expect(metrics.wheelDelta).toBeGreaterThan(0.18);
        expect(metrics.wheelDelta).toBeLessThan(0.32);
        expect(metrics.fractional).toBeGreaterThan(1);
        expect(metrics.commits).toBeLessThan(8);
        const longitude = await page.evaluate(
          () => window.fmRenderer.camera().center[0],
        );
        await page.locator(".f2-map canvas").first().press("ArrowRight");
        await expect
          .poll(() => page.evaluate(() => window.fmRenderer.camera().center[0]))
          .not.toBe(longitude);
        for (const control of await page
          .locator(".f2-map-tools button")
          .all()) {
          const bounds = await control.boundingBox();
          expect(bounds.width).toBeGreaterThanOrEqual(40);
          expect(bounds.height).toBeGreaterThanOrEqual(40);
        }
        expect(missing).toEqual([]);
        expect(errors).toEqual([]);
        expect(uncaught).toEqual([]);
        expect(
          warnings.filter((message) => message.includes("Matched leaf route")),
        ).toEqual([]);
        expect([...hosts].sort()).toEqual(
          [
            new URL(baseURL).origin,
            "https://tiles.maps.eox.at",
            "https://tiles.openfreemap.org",
          ].sort(),
        );
        await expect(page.locator(".f2-map canvas")).toHaveCount(1);
        await checkScreen(page);
        await info.attach("driver-warnings", {
          body: JSON.stringify(warnings),
          contentType: "application/json",
        });
      } finally {
        await context.close();
      }
    });
  }

test("FM compact status keeps the map usable during an actual API outage at three widths", async ({
  page,
}) => {
  test.setTimeout(90000);
  await stop(api);
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/map");
      await expect(page.locator(".f2-map canvas")).toHaveCount(1);
      const chip = page.getByRole("button", {
        name: "Services limités",
        exact: true,
      });
      await expect(chip).toBeVisible();
      expect(
        (await page.locator(".fm-service-header").boundingBox()).height,
      ).toBeLessThanOrEqual(48);
      await chip.click();
      await expect(
        page.getByRole("dialog", { name: "État des services" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Masquer cet état" }).click();
      await expect(chip).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Zoom avant" }),
      ).toBeEnabled();
      await checkScreen(page);
    }
  } finally {
    await start();
  }
});

// Capture all console errors and missing resources on a real API map load.
test("FM clean map load has no console errors or missing resources", async ({
  page,
}) => {
  const errors = [],
    missing = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  await page.goto("/map");
  await mapRenderer(page);
  await page.waitForFunction(() => window.fmRenderer.nativeMap.loaded());
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test("FM WebGL fallback explains the issue and retries without blocking the shell", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    window.fmRestoreWebGL = () => {
      HTMLCanvasElement.prototype.getContext = original;
    };
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith("webgl")
        ? null
        : original.call(this, kind, ...args);
    };
  });
  await page.goto("/map");
  await expect(page.locator(".f2-map-feedback")).toContainText("WebGL");
  await expect(page.locator(".f2-map-skeleton")).toHaveCount(0);
  await expect(page.locator(".f2-map canvas")).toHaveCount(0);
  await page.evaluate(() => window.fmRestoreWebGL());
  await page
    .locator(".f2-map-feedback")
    .getByRole("button", { name: "Réessayer" })
    .click();
  await expect(page.locator(".f2-map canvas")).toHaveCount(1);
  await checkScreen(page);
});
