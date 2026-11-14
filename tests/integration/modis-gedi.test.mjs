import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { disposable } from "../support/index.mjs";
import { FieldStore } from "../../apps/server/dist/modules/fields/application/field-store.js";
import { ExtractionStore } from "../../apps/server/dist/modules/earth-observations/application/extraction-store.js";
import { CanopyBiomassService } from "../../apps/server/dist/modules/earth-observations/application/canopy-biomass.service.js";

// Every AppEEARS file and GEDI cell below is a synthetic test fixture shaped
// like the recorded HLS and SMAP files (2026-10-17); none is NASA data, and the
// MOD13Q1 file and column names are unproven until a first real run.
let db, fields;
const profile = {
  schema_version: "1",
  name: "Synthetic test field",
  location: { latitude: 32.4, longitude: -6.55 },
  soil: { status: "unknown" },
  water: { status: "unknown" },
  crop_health: { status: "unknown" },
};
const outline = {
  type: "Polygon",
  coordinates: [
    [
      [-6.5503, 32.3998],
      [-6.5496, 32.3998],
      [-6.5496, 32.4004],
      [-6.5503, 32.4004],
      [-6.5503, 32.3998],
    ],
  ],
};
const PREFIX = "MOD13Q1_061_";
const HEADER = [
  "Category",
  "ID",
  "Latitude",
  "Longitude",
  "Date",
  PREFIX + "_250m_16_days_NDVI",
  PREFIX + "_250m_16_days_pixel_reliability",
  PREFIX + "_250m_16_days_composite_day_of_the_year",
];
const csv = (header, rows) =>
  new TextEncoder().encode(
    [header.join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n",
  );
const day = (year, doy) =>
  new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);
const bump = (doy) => 0.12 + 0.58 * Math.exp(-(((doy - 90) / 60) ** 2));
// A winter-crop field: ten years of 23 composites for every sample point; the
// neighbours report a day later than the centre inside the same composite.
const modisFile = (task) => {
  const rows = [];
  for (let year = 2003; year <= 2012; year++)
    for (let k = 0; k < 23; k++) {
      const doy = 1 + 16 * k;
      for (const c of task.params.coordinates) {
        const neighbour = c.id !== "centre";
        const ndvi = (bump(doy) + (neighbour ? 0.01 : 0)).toFixed(4);
        rows.push([
          c.category,
          c.id,
          c.latitude,
          c.longitude,
          day(year, doy),
          ndvi,
          0,
          neighbour ? doy + 1 : doy,
        ]);
      }
    }
  return csv(HEADER, rows);
};
function appeears(files) {
  const log = { submitted: [], removed: [] };
  let task;
  return {
    log,
    async submit(t) {
      log.submitted.push(t);
      task = t;
      return "task-" + log.submitted.length;
    },
    async status() {
      return "done";
    },
    async bundle() {
      return Object.keys(files).map((name, i) => ({
        fileId: "f" + i,
        name: `rotavise-x-${name}`,
        size: 1,
        sha256: null,
      }));
    },
    async download(_t, file) {
      return files[file.name.replace("rotavise-x-", "")](task);
    },
    async remove(id) {
      log.removed.push(id);
    },
  };
}
const signal = () => new AbortController().signal;
async function user() {
  const id = randomUUID();
  await db.pool.query(
    "INSERT INTO auth_users(id,name,email,email_verified) VALUES($1,'Synthetic farmer',$2,true)",
    [id, `${id}@example.invalid`],
  );
  return id;
}
async function finish(store, id) {
  let next = await store.process(id, signal());
  while (next !== null) next = await store.process(id, signal());
}
beforeAll(async () => {
  db = await disposable();
  fields = new FieldStore(db.pool);
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query("TRUNCATE auth_users CASCADE");
  await db.pool.query("TRUNCATE regional_gedi_biomass");
});

test("MODIS: asks AppEEARS for five points and three layers since 2000, keeps the raw file and builds the field's own history", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const fake = appeears({ "MOD13Q1-061-results.csv": modisFile });
  const store = new ExtractionStore(db.pool, db.boss, fake);
  // Nothing requested yet: the history says why there is none.
  expect(await store.vegetationHistory(owner, field.id, null)).toEqual({
    status: "unavailable",
    observation: "none",
    error: null,
  });
  const queued = await store.request(owner, field.id, "modis");
  expect(queued).toMatchObject({ kind: "modis", status: "queued" });
  expect((await store.request(owner, field.id, "modis")).id).toBe(queued.id);
  expect(await store.vegetationHistory(owner, field.id, null)).toMatchObject({
    status: "unavailable",
    observation: "queued",
  });
  await finish(store, queued.id);
  const task = fake.log.submitted[0];
  expect(task.params.layers).toEqual([
    { product: "MOD13Q1.061", layer: "_250m_16_days_NDVI" },
    { product: "MOD13Q1.061", layer: "_250m_16_days_pixel_reliability" },
    {
      product: "MOD13Q1.061",
      layer: "_250m_16_days_composite_day_of_the_year",
    },
  ]);
  expect(task.params.dates[0].startDate).toBe("02-18-2000");
  expect(task.params.dates[0].endDate).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  expect(task.params.coordinates.map((c) => c.id)).toEqual([
    "centre",
    "north",
    "east",
    "south",
    "west",
  ]);
  const done = await store.read(owner, field.id, queued.id);
  expect(done.status).toBe("completed");
  expect(done.result).toMatchObject({
    kind: "modis",
    resolutionMeters: 250,
    datesSeen: 230,
    datesUsable: 230,
  });
  expect(done.result.observations).toHaveLength(230);
  // The neighbours' own day (one later) is not used for the centre date, and
  // they are matched to the centre by composite.
  expect(done.result.observations[0]).toMatchObject({
    date: "2003-01-01",
    neighbours: 4,
  });
  expect(done.result.observations[0].neighbourMean).toBeCloseTo(
    done.result.observations[0].ndvi + 0.01,
    4,
  );
  const files = (
    await db.pool.query(
      "SELECT name,sha256 FROM field_extraction_files WHERE extraction_id=$1",
      [queued.id],
    )
  ).rows;
  expect(files).toHaveLength(1);
  expect(files[0].name).toBe("MOD13Q1-061-results.csv");
  expect(files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  const history = await store.vegetationHistory(owner, field.id, null);
  expect(history).toMatchObject({
    status: "ready",
    extractionId: queued.id,
    hlsCompared: false,
  });
  expect(history.history.years.used).toBe(10);
  expect(history.history.usuallyLow.status).toBe("available");
  expect(history.history.usuallyLow.windows.length).toBeGreaterThan(0);
  expect(history.history.heterogeneity.status).toBe("similar");
  expect(history.history.hlsAgreement).toBeNull();
});

test("MODIS: a file with the wrong columns fails the extraction and the history shows the failure", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const store = new ExtractionStore(
    db.pool,
    db.boss,
    appeears({
      "MOD13Q1-061-results.csv": () =>
        csv(["ID", "Date", "something_else"], [["centre", "2003-01-01", 1]]),
    }),
  );
  const queued = await store.request(owner, field.id, "modis");
  await finish(store, queued.id);
  const failed = await store.read(owner, field.id, queued.id);
  expect(failed.status).toBe("failed");
  expect(failed.error).toEqual({ code: "OBSERVATION_UPSTREAM_INVALID" });
  expect(await store.vegetationHistory(owner, field.id, null)).toEqual({
    status: "unavailable",
    observation: "failed",
    error: "OBSERVATION_UPSTREAM_INVALID",
  });
});

test("MODIS: another person can neither read the extraction nor its history", async () => {
  const owner = await user();
  const other = await user();
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const store = new ExtractionStore(
    db.pool,
    db.boss,
    appeears({ "MOD13Q1-061-results.csv": modisFile }),
  );
  const queued = await store.request(owner, field.id, "modis");
  await finish(store, queued.id);
  await expect(store.read(other, field.id, queued.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    store.vegetationHistory(other, field.id, null),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(store.request(other, field.id, "modis")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

const KM = 1 / 111.195;
const cellsAround = (lat, lon, half) => {
  const cells = [];
  for (let i = -half; i <= half; i++)
    for (let j = -half; j <= half; j++)
      cells.push([
        Number((lat + i * KM).toFixed(4)),
        Number((lon + (j * KM) / Math.cos((lat * Math.PI) / 180)).toFixed(4)),
        10 + i + j + 5,
        2,
      ]);
  return cells;
};
const gediFile = (cells) => ({
  product: "Synthetic GEDI L4B test product (1 km)",
  sourceSha256: "a".repeat(64),
  cells,
});

test("GEDI: says plainly when nothing is imported, then reads the field's cell and its 3 km neighbourhood", async () => {
  const owner = await user();
  const other = await user();
  const field = await fields.create(owner, profile);
  const service = new CanopyBiomassService(db.pool);
  expect(await service.forField(owner, field.id)).toEqual({
    available: false,
    reason: "CANOPY_BIOMASS_NOT_IMPORTED",
  });
  const cells = cellsAround(32.4, -6.55, 4);
  const first = await service.import(gediFile(cells));
  expect(first).toEqual({ cells: cells.length, inserted: cells.length });
  // Importing the same file again changes nothing.
  expect(await service.import(gediFile(cells))).toEqual({
    cells: cells.length,
    inserted: 0,
  });
  const got = await service.forField(owner, field.id);
  expect(got.available).toBe(true);
  const r = got.result;
  expect(r.kind).toBe("gedi");
  expect(r.fieldCell.agbdMgHa).toBeCloseTo(15, 2);
  expect(r.fieldCell.seMgHa).toBe(2);
  expect(r.fieldCell.distanceKm).toBeLessThan(0.2);
  expect(r.surroundings.cellsInRadius).toBeGreaterThan(20);
  expect(r.surroundings.meanAgbdMgHa).toBeCloseTo(15, 0);
  expect(r.surroundings.standardErrorOfMeanMgHa).toBeGreaterThan(0);
  expect(r.limitations.join(" ")).toMatch(
    /never as crop yield or crop biomass/,
  );
  expect(r.provenance.map((p) => p.origin)).toEqual([
    "sourced",
    "engineering_judgment",
  ]);
  await expect(service.forField(other, field.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("GEDI: a field far from the import and one near it with no estimate get different reasons", async () => {
  const owner = await user();
  const service = new CanopyBiomassService(db.pool);
  await service.import(gediFile(cellsAround(32.4, -6.55, 4)));
  const tangier = await fields.create(owner, {
    ...profile,
    location: { latitude: 35.7, longitude: -5.9 },
  });
  expect(await service.forField(owner, tangier.id)).toEqual({
    available: false,
    reason: "CANOPY_BIOMASS_OUTSIDE_IMPORT",
  });
  // About 22 km from the imported cells: inside the wider box, outside 3 km.
  const near = await fields.create(owner, {
    ...profile,
    location: { latitude: 32.6, longitude: -6.55 },
  });
  expect(await service.forField(owner, near.id)).toEqual({
    available: false,
    reason: "CANOPY_BIOMASS_NO_ESTIMATE_NEARBY",
  });
});

test("GEDI: a payload with a negative biomass or an unknown key is refused and stores nothing", async () => {
  const service = new CanopyBiomassService(db.pool);
  await expect(
    service.import(gediFile([[32.4, -6.55, -1, 2]])),
  ).rejects.toThrow();
  await expect(
    service.import({ ...gediFile([[32.4, -6.55, 5, null]]), extra: true }),
  ).rejects.toThrow();
  await expect(
    service.import({
      ...gediFile([[32.4, -6.55, 5, null]]),
      sourceSha256: "x",
    }),
  ).rejects.toThrow();
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM regional_gedi_biomass"))
      .rows[0].n,
  ).toBe(0);
  // A cell without a standard error is allowed and read back as null.
  await service.import(gediFile([[32.4, -6.55, 5, null]]));
  const row = (
    await db.pool.query(
      "SELECT latitude_e3,longitude_e3,agbd_mg_ha::text a,se_mg_ha FROM regional_gedi_biomass",
    )
  ).rows[0];
  expect(row).toMatchObject({
    latitude_e3: 32400,
    longitude_e3: -6550,
    a: "5.000",
    se_mg_ha: null,
  });
});
