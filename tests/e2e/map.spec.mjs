import { readFileSync } from "node:fs";
import { test as performanceTest } from "@playwright/test";
import { test, expect, checkScreen } from "../support/web-e2e.mjs";
import {
  browserPorts,
  disposable,
  poll,
  processEnv,
  processFor,
  stop,
} from "../support/index.mjs";
import { mapRenderer } from "../support/map-browser.mjs";
import { mapField } from "../support/fixtures/map-fields.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

const ports = browserPorts();
const gibs = "https://gibs.earthdata.nasa.gov";
const fixture = (name) =>
  readFileSync(new URL(`../support/fixtures/gibs/${name}`, import.meta.url));
const modis = fixture("modis.jpeg");
const present = fixture("hls-present.png");
const empty = fixture("hls-empty.png");
const today = new Date().toISOString().slice(0, 10);
const dateBefore = (days) =>
  new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
let db, api;

test.beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
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
});
test.afterAll(async () => {
  if (api) await stop(api);
  if (db) await db.close();
});

async function recordedImagery(page) {
  await page.route(gibs + "/**", (route) => {
    const url = route.request().url();
    const hasHls = url.includes("/HLS_S30_");
    const hasImagery = [dateBefore(2), dateBefore(4)].some((date) =>
      url.includes(`/${date}/`),
    );
    return route.fulfill({
      contentType: hasHls ? "image/png" : "image/jpeg",
      headers: { "access-control-allow-origin": "*" },
      body: hasHls ? (hasImagery ? present : empty) : modis,
    });
  });
}

async function seedFields(page, count) {
  const created = await page.request.post("/api/v1/plan-sessions", {
    data: {},
  });
  expect(created.status()).toBe(201);
  const session = await created.json();
  const fields = [];
  for (let index = 0; index < count; index++) {
    const response = await page.request.post("/api/v1/fields", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: mapField(index),
    });
    expect(response.status()).toBe(201);
    fields.push(await response.json());
  }
  await page.addInitScript((session) => {
    sessionStorage.setItem("rotavise.guest.v1", JSON.stringify(session));
  }, session);
  return fields;
}

async function imageryColors(page) {
  const bounds = await page
    .locator(".f2-map > .f2-map-canvas")
    .first()
    .boundingBox();
  expect(bounds.width).toBeGreaterThan(200);
  expect(bounds.height).toBeGreaterThan(300);
  const buffer = await page.screenshot({
    clip: {
      x: Math.round(bounds.x + bounds.width * 0.4),
      y: Math.round(bounds.y + bounds.height * 0.25),
      width: 80,
      height: 60,
    },
  });
  return page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4)
        colors.add((pixels[i] << 16) + (pixels[i + 1] << 8) + pixels[i + 2]);
      return colors.size;
    },
    [...buffer],
  );
}

test("S03 uses the live cloudless basemap with only approved provider hosts", async ({
  page,
}) => {
  const origins = new Set();
  page
    .context()
    .on("request", (request) => origins.add(new URL(request.url()).origin));
  const tile = page.waitForResponse(
    (response) =>
      response.url().startsWith("https://tiles.maps.eox.at/") &&
      response.ok() &&
      response.headers()["content-type"]?.includes("image/"),
  );
  await page.goto("/map");
  await tile;
  await expect(
    page.getByRole("heading", { name: "Mes parcelles" }),
  ).toBeVisible();
  await expect(page.locator(".f2-map canvas")).toHaveCount(1);
  await expect
    .poll(() => imageryColors(page), { timeout: 10000 })
    .toBeGreaterThan(30);
  expect([...origins].sort()).toEqual(
    [
      "https://tiles.maps.eox.at",
      "https://tiles.openfreemap.org",
      new URL(page.url()).origin,
    ].sort(),
  );
});

test("S03 empty state and creation menu pass across four widths in both languages", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await recordedImagery(page);
  for (const language of ["fr", "en"]) {
    const en = language === "en";
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      if (language === "fr" && width === 390) await page.goto("/map");
      const lang = page.getByRole("button", {
        name: en ? /English/ : /Français/,
      });
      await lang.click();
      if (width === 390) {
        const half = page.getByRole("button", {
          name: en ? "Half height" : "Mi-hauteur",
          exact: true,
        });
        await half.click();
      }
      await expect(
        page.getByRole("heading", {
          name: en ? "Add your first field" : "Ajoutez votre première parcelle",
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: en ? "Add a field" : "Ajouter une parcelle",
          exact: true,
        })
        .click();
      const menu = page.getByRole("dialog", {
        name: en ? "Add a field" : "Ajouter une parcelle",
      });
      await expect(menu.getByRole("listitem")).toHaveCount(5);
      await expect(menu.locator(".f3-mode-button")).toHaveCount(4);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(
        page.locator(".f2-map-top").getByRole("button").first(),
      ).toBeInViewport();
      const screenshot = info.outputPath(`map-${language}-${width}.png`);
      await page.screenshot({ path: screenshot });
      await info.attach(`map-${language}-${width}`, {
        path: screenshot,
        contentType: "image/png",
      });
    }
  }
});

test("S03 searches and sorts real saved fields, loads the next cursor and keeps the selected map interactive offline", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await recordedImagery(page);
  const fields = await seedFields(page, 21);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pages = [];
  let active = 0;
  let maxActive = 0;
  await page.route("**/api/v1/fields/*/boundary", async (route) => {
    maxActive = Math.max(maxActive, ++active);
    try {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 60));
      await route.fulfill({ response });
    } finally {
      active--;
    }
  });
  page.on("response", async (response) => {
    if (
      new URL(response.url()).pathname === "/api/v1/fields" &&
      response.request().method() === "GET" &&
      response.ok()
    )
      pages.push(await response.json());
  });
  await page.goto("/map");
  await expect(page.locator(".f2-field-row")).toHaveCount(7);
  await page.getByRole("button", { name: "Trier", exact: true }).click();
  await page.getByRole("radio", { name: "Nom", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(page.locator(".f2-field-row").first()).toContainText(
    "Parcelle 02",
  );
  await page.getByRole("button", { name: "Page suivante" }).click();
  await page.getByRole("button", { name: "Page suivante" }).click();
  const nextPage = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/fields" && url.searchParams.has("cursor");
  });
  await page.getByRole("button", { name: "Charger plus de parcelles" }).click();
  expect(new URL((await nextPage).url()).searchParams.get("cursor")).toBe(
    pages[0].nextCursor,
  );
  const search = page.getByRole("searchbox", {
    name: "Rechercher une parcelle",
  });
  await search.fill("Parcelle 01");
  const pin = page.locator(".f2-field-row");
  await expect(pin).toHaveCount(1);
  await expect(pin).toContainText("Aucun contour enregistré");
  await search.fill("Parcelle 21");
  const canvas = page.getByLabel("Carte satellite interactive");
  const before = await canvas.elementHandle();
  await page.locator(".f2-field-row").click();
  await expect(page).toHaveURL(new RegExp(`/fields/${fields[20].id}$`));
  const detail = page.getByRole("complementary", { name: "Parcelle 21" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText(/Surface enregistrée.*ha/)).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Mes parcelles" }),
  ).toBeVisible();
  expect(await canvas.evaluate((node, before) => node === before, before)).toBe(
    true,
  );
  expect((await canvas.boundingBox()).width).toBeGreaterThan(500);
  await page.screenshot({ path: info.outputPath("selected-field-1440.png") });
  await page.getByRole("button", { name: "Fermer la parcelle" }).click();
  await expect(page.locator(".f2-field-row")).toBeFocused();
  const bounds = await canvas.boundingBox();
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await expect(detail).toBeVisible();
  await canvas.press("ArrowRight");
  await canvas.press("+");
  await expect(detail).toBeVisible();
  await checkScreen(page);
  await page.getByRole("button", { name: "Fermer la parcelle" }).click();
  await expect(canvas).toBeFocused();
  expect(maxActive).toBe(6);
  await page.context().setOffline(true);
  try {
    await expect(
      page.getByText("Parcelles déjà chargées, en lecture seule."),
    ).toBeVisible();
    await expect(page.locator(".f2-field-row")).toContainText("Parcelle 21");
    await expect(
      page.getByRole("button", { name: "Ajouter une parcelle" }),
    ).toHaveCount(0);
  } finally {
    await page.context().setOffline(false);
  }
});

test("S03 checks real tile pixels, steps past transparent dates and compares with the keyboard", async ({
  page,
}) => {
  test.setTimeout(90000);
  await recordedImagery(page);
  await seedFields(page, 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/map");
  await page.locator(".f2-field-row").click();
  await page
    .getByRole("button", { name: "Couches de la carte", exact: true })
    .click();
  const layers = page.getByRole("dialog", { name: "Couches de la carte" });
  const formatted = (date) =>
    new Intl.DateTimeFormat("fr", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(date));
  const date = layers
    .getByRole("group", { name: "Dates des images disponibles" })
    .locator("output");
  await layers.getByRole("radio", { name: "Image NASA", exact: true }).check();
  await expect(date).toHaveText(formatted(dateBefore(2)), { timeout: 12000 });
  await layers
    .getByRole("button", { name: "Image précédente", exact: true })
    .click();
  await expect(date).toHaveText(formatted(dateBefore(4)));
  await layers.getByLabel("Vérifier une date").fill(dateBefore(3));
  await layers.getByRole("button", { name: "Vérifier", exact: true }).click();
  await expect(layers.getByText(/Aucune image le/)).toBeVisible();
  await expect(date).toHaveText(formatted(dateBefore(2)));
  await layers.getByRole("checkbox", { name: "Comparer deux dates" }).check();
  await page.keyboard.press("Escape");
  await expect(layers).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Parcelle 01" }),
  ).toBeVisible();
  const divider = page.getByRole("slider", {
    name: "Séparation des deux images",
  });
  await divider.press("ArrowRight");
  await expect(divider).toHaveValue("51");
  await expect(page.locator(".f2-map canvas")).toHaveCount(2);
  await expect(page.getByText(/Image à 30 m de résolution/)).toBeVisible();
  await expect(
    page.getByText(/Images NASA GIBS · Sentinel-2 HLS/),
  ).toBeVisible();
});

test("S03 locates only after an explicit request", async ({
  page,
  context,
}) => {
  await recordedImagery(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 32.3373, longitude: -6.3498 });
  await page.addInitScript(() => {
    window.locationReads = 0;
    const read = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    );
    navigator.geolocation.getCurrentPosition = (...args) => {
      window.locationReads++;
      return read(...args);
    };
  });
  await page.goto("/map");
  const locate = page.getByRole("button", { name: "Utiliser ma position" });
  await expect(locate).toBeEnabled();
  expect(await page.evaluate(() => window.locationReads)).toBe(0);
  await locate.click();
  expect(await page.evaluate(() => window.locationReads)).toBe(1);
  await expect(page.getByText("Mosaïque 2025 · détail de 10 m")).toBeVisible();
});

for (const language of ["fr", "en"])
  performanceTest(
    `S03 first paint and input on a throttled phone (${language})`,
    async ({ page, context }, info) => {
      performanceTest.setTimeout(90000);
      await recordedImagery(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((lang) => {
        localStorage.setItem("rv.lang", lang);
        window.mapTimings = { lcp: 0, inputs: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.mapTimings.lcp = entry.startTime;
            window.mapTimings.element = entry.element?.textContent?.slice(
              0,
              100,
            );
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.interactionId)
              window.mapTimings.inputs.push(entry.duration);
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      }, language);
      const session = await context.newCDPSession(page);
      try {
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await session.send("Network.enable");
        await session.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 150,
          downloadThroughput: 200000,
          uploadThroughput: 100000,
        });
        await page.goto("/map");
        await expect(page.locator(".f1-sheet[data-detent=peek]")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page
          .getByRole("button", {
            name: language === "en" ? "Half height" : "Mi-hauteur",
            exact: true,
          })
          .click();
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const metrics = await page.evaluate(() => window.mapTimings);
        console.log("F2_PHONE", language, JSON.stringify(metrics));
        await info.attach("timings", {
          body: JSON.stringify(metrics),
          contentType: "application/json",
        });
        expect(metrics.lcp).toBeGreaterThan(0);
        expect(metrics.lcp).toBeLessThan(2500);
        expect(Math.max(16, ...metrics.inputs)).toBeLessThan(200);
        await checkScreen(page);
      } finally {
        // CDP throttling can outlive a page in a reused remote browser.
        await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        await session.send("Network.disable");
        await session.detach();
      }
    },
  );

test("S03 real renderer pans and moves through fractional zooms", async ({
  page,
}, info) => {
  await recordedImagery(page);
  await page.goto("/map");
  await expect(page.locator(".f2-map canvas")).toHaveCount(1);
  await mapRenderer(page);
  const metrics = await page.evaluate(async () => {
    const renderer = window.fmRenderer;
    renderer.jump({ center: [-6.3498, 32.3373], zoom: 10 });
    await new Promise((resolve) => renderer.nativeMap.once("idle", resolve));
    const measure = (animate) => {
      const samples = [];
      return new Promise((resolve) => {
        const start = performance.now();
        animate();
        const frame = (time) => {
          samples.push({ time, ...renderer.camera() });
          if (time - start < 450) requestAnimationFrame(frame);
          else resolve(samples);
        };
        requestAnimationFrame(frame);
      });
    };
    const zoom = await measure(() => renderer.zoom(1));
    const pan = await measure(() =>
      renderer.canvas.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowRight",
          keyCode: 39,
        }),
      ),
    );
    const wheelStart = renderer.camera().zoom;
    const wheel = await measure(() =>
      renderer.canvas.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          clientX: 400,
          clientY: 320,
        }),
      ),
    );
    const framePace = (samples) => {
      const moving = samples.filter(
        ({ time }) => time <= samples[0].time + 280,
      );
      const gaps = moving
        .slice(1)
        .map(({ time }, index) => time - moving[index].time)
        .sort((a, b) => a - b);
      return {
        medianMs: gaps[Math.floor(gaps.length / 2)],
        worstMs: gaps.at(-1),
        frames: moving.length,
      };
    };
    return {
      start: zoom[0].zoom,
      end: zoom.at(-1).zoom,
      fractionalSteps: new Set(
        zoom.map(({ zoom }) => zoom).filter((zoom) => zoom > 10 && zoom < 11),
      ).size,
      panned: pan.at(-1).center[0] !== zoom.at(-1).center[0],
      wheelDelta: wheel.at(-1).zoom - wheelStart,
      zoomFrames: framePace(zoom),
      panFrames: framePace(pan),
    };
  });
  console.log("F2_FRAME_PACING", JSON.stringify(metrics));
  await info.attach("frame-pacing", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  expect(metrics.end).toBe(11);
  expect(metrics.fractionalSteps).toBeGreaterThan(1);
  expect(metrics.panned).toBe(true);
  expect(metrics.wheelDelta).toBeGreaterThan(0.18);
  expect(metrics.wheelDelta).toBeLessThan(0.32);
  expect(metrics.panFrames.medianMs).toBeLessThan(18);
  expect(metrics.zoomFrames.medianMs).toBeLessThan(18);
});

test("S03 reports a failed list request and retries the real endpoint", async ({
  page,
}) => {
  await recordedImagery(page);
  const path = "**/api/v1/fields?*";
  await page.route(path, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "FIELD_UNAVAILABLE" }),
    }),
  );
  await page.goto("/map");
  const list = page.getByRole("complementary", { name: "Mes parcelles" });
  const retry = list.getByRole("button", { name: "Réessayer" });
  await expect(retry).toBeVisible();
  await page.unroute(path);
  await retry.click();
  await expect(
    list.getByRole("heading", { name: "Ajoutez votre première parcelle" }),
  ).toBeVisible();
});

test("S03 selected field and imagery popover remain usable across four widths and both languages", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await recordedImagery(page);
  const fields = await seedFields(page, 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/fields/${fields[0].id}`);
  for (const language of ["fr", "en"]) {
    const en = language === "en";
    await page
      .getByRole("button", { name: en ? /English/ : /Français/ })
      .click();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const detail = page.getByRole("complementary", { name: "Parcelle 01" });
      await expect(detail).toBeVisible();
      const canvas = page.getByLabel(
        en ? "Interactive satellite map" : "Carte satellite interactive",
      );
      await expect(canvas).toBeVisible();
      expect((await canvas.boundingBox()).width).toBeGreaterThan(300);
      await page
        .getByRole("button", {
          name: en ? "Map layers" : "Couches de la carte",
          exact: true,
        })
        .click();
      const layers = page.getByRole("dialog", {
        name: en ? "Map layers" : "Couches de la carte",
      });
      await expect(layers).toBeInViewport();
      await layers
        .getByRole("radio", {
          name: en ? "NASA image" : "Image NASA",
          exact: true,
        })
        .check();
      await layers
        .getByRole("radio", {
          name: en
            ? "Overview image (Terra MODIS)"
            : "Vue d’ensemble (Terra MODIS)",
          exact: true,
        })
        .check();
      await layers
        .getByRole("radio", {
          name: en
            ? "Detailed image (Sentinel-2 HLS)"
            : "Image détaillée (Sentinel-2 HLS)",
          exact: true,
        })
        .check();
      const compare = layers.getByRole("checkbox", {
        name: en ? "Compare two dates" : "Comparer deux dates",
      });
      await expect(compare).toBeEnabled();
      await compare.check();
      const screenshot = info.outputPath(
        `selected-layers-${language}-${width}.png`,
      );
      await page.screenshot({ path: screenshot });
      await info.attach(`selected-layers-${language}-${width}`, {
        path: screenshot,
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await expect(detail).toBeVisible();
      const divider = page.getByRole("slider", {
        name: en ? "Imagery comparison divider" : "Séparation des deux images",
      });
      await expect(divider).toBeInViewport();
      await divider.press("ArrowRight");
    }
  }
});
