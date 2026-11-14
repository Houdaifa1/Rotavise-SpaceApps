import { readFileSync } from "node:fs";
import { test, expect } from "../support/web-e2e.mjs";
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
import { importBoundaries } from "../../apps/server/dist/modules/field-boundaries/application/import-boundaries.js";
import {
  fieldBoundarySchema,
  boundaryContains,
} from "../../packages/contracts/dist/index.js";
import { outline } from "../support/fixtures/field-creation/geometry.mjs";
const ports = browserPorts();
let db, api;
const fixtures = new URL("../support/fixtures/", import.meta.url);
const raw = readFileSync(
  new URL("field-boundaries/morocco-2025.ndjson", fixtures),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(
    new URL("field-boundaries/morocco-2025.manifest.json", fixtures),
    "utf8",
  ),
);
test.beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  await importBoundaries(
    db.pool,
    manifest,
    (async function* () {
      for (const line of raw.trimEnd().split("\n")) yield line;
    })(),
    { allowSample: true },
  );
  api = processFor(
    "api",
    processEnv(db, {
      API_PORT: String(ports.api),
      PLANS_ENABLED: "true",
      PLANNING_ENABLED: "true",
      FIELD_BOUNDARIES_ENABLED: "true",
    }),
  );
  await poll(
    async () => (await fetch(ports.apiOrigin + "/api/v1/health/live")).ok,
  );
});
// Each case represents an independent farmer/session. Keep rate counters from
// another case out of its disposable fixture; limits still apply within a case.
test.beforeEach(async () => {
  await db.pool.query("DELETE FROM plan_quotas");
});
test.afterAll(async () => {
  if (api) await stop(api);
  if (db) await db.close();
});
async function recordedImagery(page) {
  await page.route("https://gibs.earthdata.nasa.gov/**", (route) =>
    route.fulfill({
      contentType: route.request().url().includes("/HLS_")
        ? "image/png"
        : "image/jpeg",
      headers: { "access-control-allow-origin": "*" },
      body: readFileSync(
        new URL(
          route.request().url().includes("/HLS_")
            ? "gibs/hls-present.png"
            : "gibs/modis.jpeg",
          fixtures,
        ),
      ),
    }),
  );
}
async function prepare(page, language, width) {
  await page.setViewportSize({ width, height: 900 });
  await recordedImagery(page);
  const r = await page.request.post("/api/v1/plan-sessions", { data: {} });
  expect(r.status()).toBe(201);
  const session = await r.json();
  const seed = await page.request.post("/api/v1/fields", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      schema_version: "1",
      name: "Geometry verification",
      location: { latitude: 32.401, longitude: -6.549 },
      soil: { status: "unknown" },
      water: { status: "unknown" },
      crop_health: { status: "unknown" },
      boundary: outline,
    },
  });
  expect(seed.status()).toBe(201);
  await page.addInitScript(
    ({ session, language }) => {
      sessionStorage.setItem("rotavise.guest.v1", JSON.stringify(session));
      localStorage.setItem("rv.lang", language);
    },
    { session, language },
  );
  await page.goto(`/fields/${(await seed.json()).id}`);
  await expect(page.locator(".f2-map canvas")).toHaveCount(1);
  await page.waitForTimeout(800);
  return session;
}
async function open(page, en, mode) {
  if (
    !(await page
      .getByRole("button", {
        name: en ? "Add a field" : "Ajouter une parcelle",
        exact: true,
      })
      .count())
  ) {
    await page
      .getByRole("link", { name: en ? "Fields" : "Parcelles", exact: true })
      .click();
  }
  if (await page.locator('.f1-sheet[data-detent="half"]').count())
    await page
      .getByRole("button", {
        name: en ? "Full height" : "Pleine hauteur",
        exact: true,
      })
      .click();
  const add = page.getByRole("button", {
    name: en ? "Add a field" : "Ajouter une parcelle",
    exact: true,
  });
  await add.click();
  await page
    .getByRole("dialog", { name: en ? "Add a field" : "Ajouter une parcelle" })
    .getByRole("button", { name: mode, exact: true })
    .click();
  await expect(
    page.getByRole("complementary", {
      name: en ? "Select fields" : "Sélectionner les parcelles",
    }),
  ).toBeVisible();
  await page.waitForTimeout(300);
}
const modeLabels = {
  en: {
    pin: "Drop a pin only",
    draw: "Draw outline",
    upload: "Upload an outline",
    paint: "Paint cells",
    tap: "Tap on the map",
  },
  fr: {
    pin: "Placer un repère",
    draw: "Tracer un contour",
    upload: "Importer un contour",
    paint: "Peindre des cases",
    tap: "Toucher la carte",
  },
};
async function canvasPoint(page, dx = 0, dy = 0) {
  const b = await page.locator(".f2-map canvas").boundingBox();
  return {
    x: b.x + b.width * 0.46 + dx,
    y: b.y + b.height * (b.width < 768 ? 0.2 : 0.35) + dy,
  };
}
async function clickMap(page, dx = 0, dy = 0) {
  const p = await canvasPoint(page, dx, dy);
  await page.mouse.click(p.x, p.y);
}
async function save(
  page,
  en,
  session,
  name,
  hasBoundary = true,
  history = false,
) {
  const panel = page.getByRole("complementary", {
    name: en ? "Select fields" : "Sélectionner les parcelles",
  });
  await panel
    .getByRole("textbox", {
      name: en ? "Field name" : "Nom de la parcelle",
      exact: true,
    })
    .last()
    .fill(name);
  await panel
    .getByLabel("Irrigation", { exact: true })
    .last()
    .selectOption("rainfed");
  const screenshot = test
    .info()
    .outputPath(`S04-${name.replace(/[^a-zA-Z0-9-]/g, "-")}.png`);
  await page.screenshot({ path: screenshot });
  await test
    .info()
    .attach(name, { path: screenshot, contentType: "image/png" });
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(history ? "/fields-with-history" : "/fields") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: en ? "Save" : "Enregistrer", exact: true })
    .click();
  const r = await response;
  expect(r.status()).toBe(201);
  const field = await r.json();
  await expect(page).toHaveURL(new RegExp(`/fields/${field.id}$`));
  expect(field.profile.name).toBe(name);
  expect(field.profile.water).toEqual({
    status: "reported",
    availability: "rainfed",
  });
  const b = await page.request.get(`/api/v1/fields/${field.id}/boundary`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(b.status()).toBe(200);
  const boundary = (await b.json()).boundary;
  if (hasBoundary) {
    expect(fieldBoundarySchema.safeParse(boundary.boundary).success).toBe(true);
    expect(
      boundaryContains(
        boundary.boundary,
        field.profile.location.latitude,
        field.profile.location.longitude,
      ),
    ).toBe(true);
  } else expect(boundary).toBeNull();
  return field;
}
for (const language of ["fr", "en"])
  for (const width of [390, 768, 1024, 1440])
    test(`S04 pin, draw, GeoJSON, KML, projected shapefile and paint save to real API ${language} ${width}`, async ({
      page,
    }, info) => {
      test.setTimeout(150000);
      const en = language === "en",
        labels = modeLabels[language],
        session = await prepare(page, language, width);
      await open(page, en, labels.pin);
      await clickMap(page);
      await save(page, en, session, `Pin ${width}`, false);
      await open(page, en, labels.draw);
      await clickMap(page, -42, -20);
      await clickMap(page, 42, -20);
      await clickMap(page, 42, 65);
      await clickMap(page, -42, 65);
      await page
        .getByRole("button", {
          name: en ? "Close outline" : "Fermer le contour",
          exact: true,
        })
        .click();
      await save(page, en, session, `Draw ${width}`);
      for (const extension of ["geojson", "kml", "zip"]) {
        await open(page, en, labels.upload);
        const file =
          extension === "zip"
            ? {
                name: "outline.zip",
                mimeType: "application/zip",
                buffer: readFileSync(
                  new URL("field-creation/utm29.zip", fixtures),
                ),
              }
            : extension === "geojson"
              ? {
                  name: "outline.geojson",
                  mimeType: "application/geo+json",
                  buffer: Buffer.from(JSON.stringify(outline)),
                }
              : {
                  name: "outline.kml",
                  mimeType: "application/vnd.google-earth.kml+xml",
                  buffer: Buffer.from(
                    `<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>${outline.coordinates[0].map((p) => p.join(",") + ",0").join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`,
                  ),
                };
        const chooser = page.waitForEvent("filechooser");
        await page
          .getByRole("button", {
            name: en ? "Choose a file" : "Choisir un fichier",
            exact: true,
          })
          .click();
        await (await chooser).setFiles(file);

        await expect(
          page.getByRole("textbox", {
            name: en ? "Field name" : "Nom de la parcelle",
            exact: true,
          }),
        ).toBeVisible();
        await save(page, en, session, `${extension} ${width}`);
      }
      await open(page, en, labels.paint);
      // The previous saved boundary has already fitted the map to field zoom.
      await page.waitForTimeout(500);
      const p = await canvasPoint(page);
      await page.mouse.move(p.x - 30, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 60, p.y, { steps: 3 });
      await page.mouse.move(p.x + 60, p.y + 45, { steps: 2 });
      await page.mouse.move(p.x - 30, p.y + 45, { steps: 3 });
      await page.mouse.up();
      await expect(
        page.getByRole("textbox", {
          name: en ? "Field name" : "Nom de la parcelle",
          exact: true,
        }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`creation-${language}-${width}.png`),
      });
      await save(page, en, session, `Paint ${width}`);
    });
for (const language of ["fr", "en"])
  for (const width of [390, 768, 1024, 1440])
    test(`S04 real FTW selection, missing suggestion and atomic history ${language} ${width}`, async ({
      page,
    }, info) => {
      test.setTimeout(90000);
      const en = language === "en",
        session = await prepare(page, language, width),
        labels = modeLabels[language];
      const headers = { Authorization: `Bearer ${session.accessToken}` };
      const points = JSON.parse(
        readFileSync(
          new URL("field-boundaries/interior-points.json", fixtures),
          "utf8",
        ),
      );
      const point = points["156319"];
      const location = { longitude: point[0], latitude: point[1] };
      const suggestion = await page.request.post(
        "/api/v1/field-boundaries/at",
        {
          headers,
          data: location,
        },
      );
      expect(suggestion.status()).toBe(200);
      const seed = await page.request.post("/api/v1/fields", {
        headers,
        data: {
          schema_version: "1",
          name: "Reference location",
          location,
          soil: { status: "unknown" },
          water: { status: "unknown" },
          crop_health: { status: "unknown" },
        },
      });
      expect(seed.status()).toBe(201);
      await page.goto(`/fields/${(await seed.json()).id}`);
      await page.waitForTimeout(700);
      await open(page, en, labels.tap);
      const canvas = page.locator(".f2-map canvas");
      await canvas.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByText(
          en
            ? "Suggested outline: check it."
            : "Contour suggéré : vérifiez-le.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.screenshot({ path: info.outputPath(`tap-${language}.png`) });

      await page
        .getByRole("button", {
          name: en ? "Edit outline" : "Ajuster le contour",
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel(
          en
            ? "Snap to suggested field edges"
            : "Accrocher aux contours suggérés",
        ),
      ).toBeChecked();
      const vertex = page.getByRole("button", {
        name: en ? "Outline vertex 1" : "Sommet 1 du contour",
        exact: true,
      });
      await vertex.focus();
      await page.keyboard.press("ArrowRight");
      await page
        .getByRole("button", {
          name: en ? "Undo last point" : "Annuler le dernier point",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: en ? "Redo point" : "Rétablir le point",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: en ? "Reset outline" : "Rétablir le contour",
          exact: true,
        })
        .click();
      const panel = page.getByRole("complementary", {
        name: en ? "Select fields" : "Sélectionner les parcelles",
      });
      await panel
        .getByLabel(
          en
            ? "Add the last crop (optional)"
            : "Ajouter la dernière culture (facultatif)",
        )
        .check();
      const crop = panel.getByRole("button", {
        name: en ? /Last crop/ : /Dernière culture/,
      });
      await crop.click();
      await page.keyboard.press("Escape");
      await expect(panel).toBeVisible();
      await crop.click();
      await page
        .getByRole("dialog", {
          name: en ? "Last crop" : "Dernière culture",
          exact: true,
        })
        .getByRole("option")
        .first()
        .click();
      await panel
        .getByLabel(en ? "Planting date" : "Date de semis", { exact: true })
        .fill("2025-09-01");
      await panel
        .getByLabel(en ? "Harvest date" : "Date de récolte", { exact: true })
        .fill("2026-06-01");
      const field = await save(
        page,
        en,
        session,
        "Suggested field with history",
        true,
        true,
      );
      const history = await page.request.get(
        `/api/v1/fields/${field.id}/history`,
        { headers },
      );
      expect(history.status()).toBe(200);
      expect((await history.json()).items).toHaveLength(1);
      const emptySeed = await page.request.post("/api/v1/fields", {
        headers,
        data: {
          schema_version: "1",
          name: "Outside sample coverage",
          location: { longitude: -4, latitude: 34 },
          soil: { status: "unknown" },
          water: { status: "unknown" },
          crop_health: { status: "unknown" },
        },
      });
      expect(emptySeed.status()).toBe(201);
      await page.goto(`/fields/${(await emptySeed.json()).id}`);
      await page.waitForTimeout(700);
      await open(page, en, labels.tap);
      await page.locator(".f2-map canvas").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("alert")).toContainText(
        en ? "No suggested outline here" : "Aucun contour suggéré ici",
      );
    });
for (const language of ["fr", "en"])
  test(`S04 retained selections on offline, conflict, service failure and partial save ${language}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = language === "en",
      session = await prepare(page, language, 1440);
    await open(page, en, modeLabels[language].pin);
    const canvas = await page.locator(".f2-map canvas").elementHandle();
    await clickMap(page, -20, 0);
    await clickMap(page, 20, 0);
    const panel = page.getByRole("complementary", {
      name: en ? "Select fields" : "Sélectionner les parcelles",
    });
    const saveButton = panel.getByRole("button", {
      name: en ? "Save" : "Enregistrer",
      exact: true,
    });
    await page.context().setOffline(true);
    await expect(saveButton).toBeDisabled();
    await page.context().setOffline(false);
    await expect(saveButton).toBeEnabled();
    const path = "**/api/v1/fields";
    await page.route(path, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ code: "IDEMPOTENCY_CONFLICT" }),
          })
        : route.continue(),
    );
    await saveButton.click();
    await expect(panel.getByRole("alert")).toContainText(
      en ? "changed elsewhere" : "changé ailleurs",
    );
    await page.unroute(path);
    await page.route(path, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 429,
            headers: { "Retry-After": "2" },
            json: { code: "RATE_LIMITED" },
          })
        : route.continue(),
    );
    await saveButton.click();
    await expect(saveButton).toBeDisabled();
    await page.unroute(path);
    await expect(saveButton).toBeEnabled();
    let posts = 0;
    await page.route(path, (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      return posts === 2
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ code: "FIELD_UNAVAILABLE" }),
          })
        : route.continue();
    });
    await saveButton.click();
    await expect(
      panel.getByText(
        en
          ? "Field saved. It will not be created again."
          : "Parcelle enregistrée. Elle ne sera pas créée à nouveau.",
      ),
    ).toBeVisible();
    await expect(panel.getByRole("alert")).toBeVisible();
    await page.unroute(path);
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/fields") && r.request().method() === "POST",
    );
    await saveButton.click();
    expect((await response).status()).toBe(201);
    await expect(page).not.toHaveURL(/\/fields\/new/);
    const list = await page.request.get("/api/v1/fields", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect((await list.json()).items).toHaveLength(3);
    expect(await canvas.evaluate((node) => node.isConnected)).toBe(true);
  });

test("S04 keyboard paint and per-polygon upload validation", async ({
  page,
}) => {
  test.setTimeout(60000);
  const session = await prepare(page, "en", 1440);
  await open(page, true, modeLabels.en.paint);
  const canvas = page.locator(".f2-map canvas");
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("textbox", { name: "Field name", exact: true }),
  ).toBeVisible();
  await save(page, true, session, "Keyboard painted field");
  await open(page, true, modeLabels.en.upload);
  const bad = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] } },
      { type: "Feature", geometry: outline },
    ],
  };
  await page.getByLabel("Choose a file").setInputFiles({
    name: "mixed.geojson",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.getByText("Polygons not imported: 1")).toBeVisible();
  await save(page, true, session, "Valid imported polygon");
});

test("S04 paint frame pacing with 2,000 selected HLS cells and the real worker", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordedImagery(page);
  const harness = process.env.ROTAVISE_E2E_DESIGN_ORIGIN + "/paint-benchmark";
  // Mount a single renderer. The app route would add a second WebGL map
  // that can contend for rendering time in software Chromium.
  await page.route(harness, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Paint benchmark</title><link rel="stylesheet" href="/src/design/tokens.css"><link rel="stylesheet" href="/src/features/fields/creation/creation.css"></head><body><main><h1>Paint benchmark</h1></main></body></html>',
    }),
  );
  await page.goto(harness);
  const metrics = await page.evaluate(async () => {
    const [
      { createRenderer },
      { attachEditor },
      { GeometryWorker },
      { cellAt, cellPoint, gridFor },
    ] = await Promise.all([
      import("/src/features/map/mapRenderer.ts"),
      import("/src/features/fields/creation/mapEditor.ts"),
      import("/src/features/fields/creation/workerClient.ts"),
      import("/src/features/fields/creation/geometry.ts"),
    ]);
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:0;width:1000px;height:800px;z-index:10";
    document.body.append(host);
    let renderer, editor;
    const worker = new GeometryWorker();
    let painted = 0,
      processing = [];
    try {
      let ready;
      const loaded = new Promise((r) => (ready = r));
      renderer = createRenderer(host, {
        camera: { center: [-6.55, 32.4], zoom: 15 },
        dates: { modis: "default" },
        interactive: true,
        onStatus: (s) => {
          if (s === "ready") ready();
        },
      });
      await loaded;
      const g = gridFor(renderer.camera().center),
        centre = cellAt(renderer.camera().center, g);
      editor = attachEditor(
        renderer,
        worker,
        {
          mode: "paint",
          boundaries: [],
          pins: [],
          vertices: [],
          closed: false,
          snap: false,
          suggestions: [],
          locked: false,
        },
        {
          onPoint() {},
          onDraw() {},
          onCells(cells, grid) {
            const start = performance.now();
            painted = cells.length;
            processing.push(
              worker
                .run({ kind: "paint", cells, grid })
                .then(() => performance.now() - start),
            );
          },
          onCount() {},
          onZoom() {},
          onError(e) {
            throw e;
          },
          vertexLabel: (n) => `Vertex ${n}`,
          midpointLabel: (n) => `Midpoint ${n}`,
        },
      );
      const waitUntil = async (predicate) => {
        const start = performance.now();
        while (!predicate()) {
          if (performance.now() - start > 10000)
            throw new Error("Grid did not become ready");
          await new Promise((r) => setTimeout(r, 20));
        }
      };
      await waitUntil(() => {
        const source = renderer.nativeMap.getSource("creation-grid");
        const data = source?.serialize().data;
        return (
          data &&
          typeof data === "object" &&
          data.features?.length > 2000 &&
          renderer.nativeMap.isSourceLoaded("creation-grid")
        );
      });
      const cells = [];
      for (let x = 0; x < 50; x++)
        for (let y = 0; y < 40; y++)
          cells.push(`${centre[0] - 25 + x},${centre[1] - 20 + y}`);
      editor.setCells(cells);
      await new Promise((resolve) => renderer.nativeMap.once("idle", resolve));
      const samples = [];
      const canvas = renderer.canvas;
      const dispatch = (type, cell) => {
        const p = renderer.nativeMap.project(cellPoint(cell, g, true));
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: p.x,
            clientY: p.y,
            pointerId: 1,
            pointerType: "mouse",
            buttons: type === "pointerup" ? 0 : 1,
            button: 0,
          }),
        );
      };
      // Erase and re-add a boundary strip while 2,000 cells remain rendered.
      const first = [centre[0] - 25, centre[1] - 20];
      canvas.setPointerCapture = () => {};
      canvas.hasPointerCapture = () => false;
      dispatch("pointerdown", first);
      await new Promise((resolve) => {
        let step = 0;
        const frame = (time) => {
          samples.push(time);
          dispatch("pointermove", [first[0] + step, first[1]]);
          if (++step < 50) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      dispatch("pointerup", [first[0] + 49, first[1]]);
      dispatch("pointerdown", first);
      dispatch("pointermove", [first[0] + 49, first[1]]);
      dispatch("pointerup", [first[0] + 49, first[1]]);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const workerTimes = await Promise.all(processing);
      const gaps = samples
        .slice(1)
        .map((t, i) => t - samples[i])
        .sort((a, b) => a - b);
      return {
        selectedCells: painted,
        medianFrameMs: gaps[Math.floor(gaps.length / 2)],
        worstFrameMs: gaps.at(-1),
        frames: samples.length,
        workerJobs: processing.length,
        maximumWorkerMs: Math.max(...workerTimes),
      };
    } finally {
      editor?.destroy();
      worker.destroy();
      renderer?.destroy();
      host.remove();
    }
  });
  console.log("F3_PAINT", JSON.stringify(metrics));
  await info.attach("paint-frame-pacing", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  expect(metrics.selectedCells).toBe(2000);
  expect(metrics.workerJobs).toBeGreaterThan(1);
  expect(metrics.medianFrameMs).toBeLessThan(18);
});

test("S04 keeps the draft across language and layout changes and cancels without a write", async ({
  page,
}) => {
  test.setTimeout(45000);
  await prepare(page, "en", 1440);
  await open(page, true, modeLabels.en.pin);
  await clickMap(page);
  const canvas = await page.locator(".f2-map canvas").elementHandle();
  await page
    .getByRole("textbox", { name: "Field name", exact: true })
    .fill("Retained draft");
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/fields(?:-with-history)?$/.test(r.url()))
      writes++;
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(
    page.getByRole("textbox", { name: "Field name", exact: true }),
  ).toHaveValue("Retained draft");
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Nom de la parcelle", exact: true }),
  ).toHaveValue("Retained draft");
  expect(await canvas.evaluate((node) => node.isConnected)).toBe(true);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  expect(writes).toBe(0);
});

for (const kind of ["invalid-response", "lost-response"])
  test(`S04 stops blind retries after a confirmed write with ${kind}`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    const session = await prepare(page, "en", 1440);
    await open(page, true, modeLabels.en.pin);
    await clickMap(page);
    const path = "**/api/v1/fields";
    let saved;
    await page.route(path, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      saved = await response.json();
      if (kind === "invalid-response")
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: "{}",
        });
      else await route.abort("connectionreset");
    });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/The response was interrupted/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toBeDisabled();
    await page.unroute(path);
    await page
      .getByRole("button", { name: "Check my fields", exact: true })
      .click();
    await expect(page).toHaveURL(/\/map\?panel=fields$/);
    await expect(
      page.getByRole("button", { name: new RegExp(saved.profile.name) }),
    ).toBeVisible();
    const fields = await page.request.get("/api/v1/fields", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect((await fields.json()).items).toHaveLength(2);
  });
