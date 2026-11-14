import { readFileSync } from "node:fs";
import { test, expect, checkScreen } from "../support/web-e2e.mjs";
import {
  browserPorts,
  disposable,
  poll,
  processEnv,
  processFor,
  stop,
} from "../support/index.mjs";
import { mapField } from "../support/fixtures/map-fields.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { ObservationStore } from "../../apps/server/dist/modules/earth-observations/application/observation-store.js";
import { ExtractionStore } from "../../apps/server/dist/modules/earth-observations/application/extraction-store.js";
import { ObservationError } from "../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";

const ports = browserPorts();
const tile = readFileSync(
  new URL("../support/fixtures/gibs/modis.jpeg", import.meta.url),
);
const empty = readFileSync(
  new URL("../support/fixtures/gibs/hls-empty.png", import.meta.url),
);
let db, api;
test.beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.15.0"),
  );
  api = processFor(
    "api",
    processEnv(db, {
      API_PORT: String(ports.api),
      PLANS_ENABLED: "true",
      PLANNING_ENABLED: "true",
      ROTATION_CATALOG_VERSION: "0.15.0",
      OBSERVATIONS_ENABLED: "true",
      EARTHDATA_USERNAME: "provider-test",
      EARTHDATA_PASSWORD: "provider-test",
    }),
  );
  await poll(async () => {
    if (api.exitCode !== null) throw new Error(api.output);
    // National data readiness is intentionally unavailable in this minimal
    // harness. Start on liveness; the cases verify each real feature response.
    return (await fetch(`${ports.apiOrigin}/api/v1/health/live`)).ok;
  });
});
test.beforeEach(async () => {
  await db.pool.query("TRUNCATE plan_quotas");
});
test.afterAll(async () => {
  if (api) await stop(api);
  if (db) await db.close();
});

async function seed(page, index = 1) {
  await page.route("https://gibs.earthdata.nasa.gov/**", (route) => {
    const hls = route.request().url().includes("HLS_S30");
    return route.fulfill({
      contentType: hls ? "image/png" : "image/jpeg",
      headers: { "access-control-allow-origin": "*" },
      body: hls ? empty : tile,
    });
  });
  const response = await page.request.post("/api/v1/plan-sessions", {
    data: {},
  });
  expect(response.status()).toBe(201);
  const session = await response.json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const field = await page.request.post("/api/v1/fields", {
    headers,
    data: mapField(index),
  });
  expect(field.status()).toBe(201);
  await page.addInitScript((session) => {
    sessionStorage.setItem("rotavise.guest.v1", JSON.stringify(session));
    localStorage.setItem("rv.lang", "en");
  }, session);
  return { headers, field: await field.json() };
}
function responseFor(page, path, method) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().method() === method,
  );
}
const dialog = (page) => page.getByRole("dialog").last();
const button = (container, name) =>
  container.getByRole("button", { name, exact: true });
async function pick(page, query) {
  const input = page.getByRole("combobox", { name: "Search crops" });
  await input.fill(query);
  await input.press("ArrowDown");
  await input.press("Enter");
}

test("S05 keeps the map and list beside the field at desktop widths and opens every tab at four widths in French and English", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const { field } = await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/map");
  const canvas = page.locator(".f2-map canvas");
  await expect(canvas).toBeVisible();
  const original = await canvas.elementHandle();
  await page.locator(".f2-field-row").click();
  const detail = page.getByRole("complementary", { name: field.profile.name });
  await expect(detail).toBeVisible();
  for (const [language, names] of [
    ["English", ["Overview", "History", "Inputs", "NASA", "Plans"]],
    ["Français", ["Aperçu", "Historique", "Données", "NASA", "Plans"]],
  ]) {
    await page
      .getByRole("button", { name: new RegExp(language) })
      .first()
      .click();
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      if (width >= 1024) {
        expect((await canvas.boundingBox()).width).toBeGreaterThan(280);
        await expect(page.locator(".f2-field-list")).toBeVisible();
      }
      for (const name of names) {
        const tab = detail.getByRole("tab", { name, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(canvas).toBeVisible();
      }
      await detail.getByRole("tab", { name: names[0], exact: true }).click();
      await page.screenshot({
        path: info.outputPath(`field-${language}-${width}.png`),
      });
    }
  }
  expect(
    await canvas.evaluate((node, before) => node === before, original),
  ).toBe(true);
});

test("S05 renames on Enter, reapplies a real version conflict and confirms deletion", async ({
  page,
}) => {
  test.setTimeout(90000);
  const { field, headers } = await seed(page);
  const path = `/api/v1/fields/${field.id}`;
  await page.goto(`/fields/${field.id}`);
  await button(page, "Rename field").click();
  const name = page.getByRole("textbox", { name: "Field name" });
  await name.fill("My edited field");
  const other = await page.request.put(path, {
    headers,
    data: {
      expectedVersion: field.version,
      profile: {
        ...field.profile,
        name: "Changed elsewhere",
        water: { status: "reported", availability: "rainfed" },
      },
    },
  });
  expect(other.status()).toBe(200);
  const conflict = responseFor(page, path, "PUT");
  await name.press("Enter");
  expect((await conflict).status()).toBe(409);
  await expect(dialog(page)).toContainText("This was changed elsewhere");
  await button(dialog(page), "Reapply my edit").click();
  await expect(
    page.getByRole("heading", { name: "My edited field" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get(path, { headers })).json()).profile.water,
  ).toEqual({ status: "reported", availability: "rainfed" });
  await button(page, "Field actions").click();
  await button(page, "Delete field").click();
  await expect(dialog(page)).toContainText("Comparisons made from it stay");
  await button(dialog(page), "Cancel").click();
  expect((await page.request.get(path, { headers })).status()).toBe(200);
  await button(page, "Field actions").click();
  await button(page, "Delete field").click();
  const deleted = responseFor(page, path, "DELETE");
  await button(dialog(page), "Delete").click();
  expect((await deleted).status()).toBe(204);
  await expect(page).toHaveURL(/\/map$/);
});

test("S06 adds and edits with the crop strip, rejects overlap, reloads a concurrent history version, and deletes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { field, headers } = await seed(page);
  const path = `/api/v1/fields/${field.id}/history`;
  await page.goto(`/fields/${field.id}/history`);
  await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(button(page, "Add a season")).toBeEnabled({ timeout: 10000 });
  await button(page, "Add a season").click();
  await pick(page, "Hordeum vulgare");
  await page.getByLabel("Planting date", { exact: true }).fill("2024-11-01");
  await page.getByLabel("Harvest date", { exact: true }).fill("2025-04-01");
  const created = responseFor(page, path, "POST");
  await button(dialog(page), "Save").click();
  expect((await created).status()).toBe(201);
  const record = await (await created).json();
  expect((await created).request().postDataJSON()).toEqual({
    schema_version: "1",
    crop_id: "barley",
    planted_on: "2024-11-01",
    harvested_on: "2025-04-01",
  });
  const strip = page.getByRole("group", { name: "Crop timeline" });
  await expect(strip).toBeVisible();
  await expect(button(page, "Add a season")).toBeEnabled({ timeout: 10000 });
  await button(page, "Add a season").click();
  await pick(page, "Hordeum vulgare");
  await page.getByLabel("Planting date", { exact: true }).fill("2025-04-01");
  await page.getByLabel("Harvest date", { exact: true }).fill("2025-07-01");
  await button(dialog(page), "Save").click();
  await expect(dialog(page)).toContainText(
    "These dates overlap another season",
  );
  await page.keyboard.press("Escape");
  await strip.getByRole("button").click();
  await page.getByLabel("Harvest date", { exact: true }).fill("2025-04-03");
  const rowPath = `${path}/${record.id}`;
  const other = await page.request.put(rowPath, {
    headers,
    data: {
      expectedVersion: record.version,
      entry: { ...record.entry, harvested_on: "2025-04-02" },
    },
  });
  expect(other.status()).toBe(200);
  await button(dialog(page), "Save").click();
  await expect(dialog(page)).toContainText("This was changed elsewhere");
  await button(dialog(page), "Reapply my edit").click();
  await expect(strip.getByRole("button")).toHaveAttribute(
    "title",
    /3 April 2025/,
  );
  await strip.getByRole("button").click();
  await button(dialog(page), "Delete season").click();
  await button(dialog(page), "Delete").click();
  await expect(page.getByText(/Add the crops you grew here/)).toBeVisible();
});

test("S07 saves exact soil, water, and health bodies on the real field API", async ({
  page,
}) => {
  test.setTimeout(100000);
  const { field } = await seed(page);
  const path = `/api/v1/fields/${field.id}`;
  await page.goto(`/fields/${field.id}?tab=inputs`);
  await button(page, "Add measurement").click();
  await page.getByRole("spinbutton", { name: "Soil pH" }).fill("7.2");
  await page.getByLabel("Method", { exact: true }).selectOption("water");
  await page
    .getByLabel("Source", { exact: true })
    .selectOption("laboratory_report");
  const soilPut = responseFor(page, path, "PUT");
  await button(dialog(page), "Save").click();
  const soil = {
    status: "known",
    observations: [
      {
        metric: "ph",
        value: 7.2,
        unit: "pH",
        method: "water",
        measured_on: null,
        source: "laboratory_report",
      },
    ],
  };
  expect((await soilPut).request().postDataJSON()).toEqual({
    expectedVersion: field.version,
    profile: { ...field.profile, soil },
  });
  await expect(dialog(page)).toHaveCount(0);
  await button(page, "Edit water availability").click();
  await page.getByRole("radio", { name: "Limited irrigation" }).check();
  const waterPut = responseFor(page, path, "PUT");
  await button(dialog(page), "Save").click();
  const water = { status: "reported", availability: "irrigation_limited" };
  expect((await waterPut).request().postDataJSON()).toEqual({
    expectedVersion: field.version + 1,
    profile: { ...field.profile, soil, water },
  });
  await expect(dialog(page)).toHaveCount(0);
  await button(page, "Add a problem").click();
  await pick(page, "Hordeum vulgare");
  await expect(
    page.getByRole("checkbox", { name: "Confirmed" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "What you saw" })
    .fill("Observed leaf marks");
  await page.getByLabel("Observed on", { exact: true }).fill("2025-03-18");
  const healthPut = responseFor(page, path, "PUT");
  await button(dialog(page), "Save").click();
  const crop_health = {
    status: "reported",
    observations: [
      {
        crop_id: "barley",
        kind: "disease",
        name: "Observed leaf marks",
        observed_on: "2025-03-18",
        source: "farmer_report",
        confirmation: "reported",
      },
    ],
  };
  expect((await healthPut).request().postDataJSON()).toEqual({
    expectedVersion: field.version + 2,
    profile: { ...field.profile, soil, water, crop_health },
  });
  await expect(
    page.getByText("Observed leaf marks", { exact: false }),
  ).toBeVisible();
});

test("S15 searches the real release in four languages, filters and virtualizes, persists name mode and renders all twelve returned effects", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await seed(page);
  const options = await (
    await page.request.get("/api/v1/catalog/options")
  ).json();
  const crop = options.crops.find((entry) =>
    ["fr", "ar", "ary"].every((lang) =>
      entry.localNames.some(({ language }) => language === lang),
    ),
  );
  expect(crop).toBeTruthy();
  await page.goto("/crops");
  const search = page.getByRole("combobox", { name: "Search crops" });
  const list = page.getByRole("listbox", { name: "Search crops" });
  await expect(list.getByRole("option").first()).toHaveAttribute(
    "aria-setsize",
    String(options.crops.length),
  );
  expect(await list.getByRole("option").count()).toBeLessThanOrEqual(5);
  const expected = (name) =>
    list.getByRole("option").filter({ hasText: name }).first();
  for (const value of [
    crop.name,
    ...["fr", "ar", "ary"].map(
      (lang) => crop.localNames.find(({ language }) => language === lang).name,
    ),
  ]) {
    await search.fill(value);
    await expect(list.getByRole("option").first()).toBeVisible();
  }
  await search.fill(crop.scientificName);
  await page.getByLabel("Family", { exact: true }).selectOption(crop.family);
  await page.getByLabel("Crop names", { exact: true }).selectOption("ary");
  await expect(
    list
      .getByRole("option")
      .first()
      .locator('bdi[dir="auto"][lang="ar"]')
      .first(),
  ).toBeVisible();
  const detail = responseFor(
    page,
    `/api/v1/catalog/crops/${options.catalogId}/${options.catalogVersion}/${crop.id}`,
    "GET",
  );
  await expected(crop.scientificName).click();
  const payload = await (await detail).json();
  expect(payload.research.benefitEffects).toHaveLength(12);
  const effects = page
    .locator(".f4-catalog-detail details")
    .filter({
      has: page.getByText("Potential benefits and gaps", { exact: true }),
    })
    .first();
  await expect(effects.locator(":scope > ul > li")).toHaveCount(7);
  await button(effects, "Next").click();
  await expect(effects.locator(":scope > ul > li")).toHaveCount(5);
  await page
    .getByText("How crops can help a rotation", { exact: true })
    .click();
  const roles = payload.research.roleExplanations.find(
    ({ language }) => language === "en",
  );
  await expect(
    page.getByText(roles.entries[0].meaning, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Crop names", { exact: true })).toHaveValue(
    "ary",
  );
  for (const [language, heading] of [
    ["English", "Crops"],
    ["Français", "Cultures"],
  ]) {
    await page
      .getByRole("button", { name: new RegExp(language) })
      .first()
      .click();
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await checkScreen(page);
      await page.screenshot({
        path: info.outputPath(`crop-${language}-${width}.png`),
      });
    }
  }
});

function replayHls() {
  const names = ["HLSS30-020-results.csv", "HLSL30-020-results.csv"];
  let ids;
  return {
    async submit(task) {
      ids = task.params.coordinates.map(({ id }) => id);
      return "f4-test-task";
    },
    async status() {
      return "done";
    },
    async bundle() {
      return names.map((name) => ({ name: `replay-${name}` }));
    },
    async download(_task, file) {
      let recorded = readFileSync(
        `docs/evidence/earth-observations/2026-10-17/appeears-rotavise-step11-evidence-${file.name.replace("replay-", "")}`,
        "utf8",
      );
      recorded = recorded.replace(
        /,p([1-4]),/g,
        (_, index) => `,${ids[(Number(index) - 1) % ids.length]},`,
      );
      return Buffer.from(recorded);
    },
    async remove() {},
  };
}

test("S05 starts all six NASA requests, checks persisted states, and shows completed HLS evidence", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { field } = await seed(page);
  const path = `/api/v1/fields/${field.id}`;
  await page.goto(`/fields/${field.id}`);
  const grace = responseFor(page, `${path}/water-storage`, "GET");
  const gedi = responseFor(page, `${path}/canopy-biomass`, "GET");
  await page.getByText("Regional context", { exact: true }).click();
  expect(await (await grace).json()).toMatchObject({ available: false });
  expect(await (await gedi).json()).toMatchObject({ available: false });
  await expect(
    page.getByText("Regional water storage (GRACE)", { exact: true }),
  ).toBeVisible();
  const jobs = [];
  for (const [kind, family] of [
    ["hls", "observations"],
    ["modis", "extractions"],
    ["gpm", "observations"],
    ["smap", "observations"],
    ["terrain", "extractions"],
    ["ecostress", "extractions"],
  ]) {
    const row = page.locator(".f4-nasa-row").nth(jobs.length);
    const posted = responseFor(page, `${path}/${family}`, "POST");
    await row.getByRole("button", { name: /^Ask NASA/ }).click();
    expect((await posted).status()).toBe(202);
    expect((await posted).request().postDataJSON()).toEqual({ kind });
    jobs.push({ row, kind, family, id: (await (await posted).json()).id });
  }
  const provider = {
    async submit() {
      return "f4-failure-task";
    },
    async status() {
      return "error";
    },
    async remove() {},
  };
  const obs = new ObservationStore(
    db.pool,
    db.boss,
    provider,
    {
      async daily() {
        throw new ObservationError("OBSERVATION_AUTH_FAILED");
      },
    },
    {},
  );
  const ext = new ExtractionStore(db.pool, db.boss, provider);
  const hls = new ObservationStore(db.pool, db.boss, replayHls(), {}, {});
  for (const job of jobs) {
    const store =
      job.kind === "hls" ? hls : job.family === "extractions" ? ext : obs;
    const signal = new AbortController().signal;
    if ((await store.process(job.id, signal)) !== null)
      await store.process(job.id, signal);
    const checked = responseFor(page, `${path}/${job.family}/${job.id}`, "GET");
    await job.row.getByRole("button", { name: /^Check again/ }).click();
    expect((await (await checked).json()).status).toBe(
      job.kind === "hls" ? "completed" : "failed",
    );
  }
  await page.getByRole("tab", { name: "NASA", exact: true }).click();
  await jobs[0].row.getByText("View the data", { exact: true }).click();
  await expect(
    jobs[0].row.getByLabel("Observation year", { exact: true }),
  ).toBeVisible();
  await expect(
    jobs[0].row.getByText(/Low greenness can mean bare soil/),
  ).toBeVisible();
  const retry = responseFor(page, `${path}/extractions`, "POST");
  await jobs[1].row.getByRole("button", { name: /Try again/ }).click();
  expect((await retry).status()).toBe(202);
  await checkScreen(page);
});

test("S05 edits the saved outline with the keyboard and keeps the field and map visible offline", async ({
  page,
}) => {
  test.setTimeout(60000);
  const { field, headers } = await seed(page);
  const path = `/api/v1/fields/${field.id}/boundary`;
  const before = (await (await page.request.get(path, { headers })).json())
    .boundary;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/fields/${field.id}`);
  await button(page, "Field actions").click();
  await button(page, "Edit outline").click();
  const point = page.locator(".f3-vertex:not(.f3-midpoint)").first();
  await expect(point).toBeVisible();
  await point.press("ArrowLeft");
  const saved = responseFor(page, path, "PUT");
  await button(page.locator(".f4-detail"), "Save").click();
  expect((await saved).status()).toBe(200);
  expect((await saved).request().postDataJSON().expectedVersion).toBe(
    before.version,
  );
  const after = await (await saved).json();
  expect(after.boundary.coordinates[0][0]).not.toEqual(
    before.boundary.coordinates[0][0],
  );
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.context().setOffline(true);
  try {
    await expect(button(page, "Rename field")).toBeDisabled();
    await expect(page.locator(".f2-map canvas")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: field.profile.name }),
    ).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});
