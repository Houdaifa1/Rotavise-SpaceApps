import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { disposable } from "../support/index.mjs";
import { FieldStore } from "../../apps/server/dist/modules/fields/application/field-store.js";
import { ExtractionStore } from "../../apps/server/dist/modules/earth-observations/application/extraction-store.js";
import { WaterStorageService } from "../../apps/server/dist/modules/earth-observations/application/water-storage.service.js";
import { terrainRequest } from "../../apps/server/dist/modules/earth-observations/providers/terrain/terrain-request.js";
import { ObservationError } from "../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import { EXTRACTION_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";

// Every AppEEARS file below is a synthetic test fixture shaped like the
// recorded HLS and SMAP files (2026-10-17); none is NASA data, and the
// NASADEM and ECOSTRESS file names are unproven until a first real run.
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
const K = (Math.PI / 180) * 6371008.8;
// Metres east and north of the field's centre.
const offset = (lat, lon) => ({
  east: (lon - -6.5499) * K * Math.cos((32.4001 * Math.PI) / 180),
  north: (lat - 32.4001) * K,
});
function csv(header, rows) {
  return new TextEncoder().encode(
    [header.join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n",
  );
}
function appeears(files, { statuses = [] } = {}) {
  const log = { submitted: [], removed: [], polls: 0 };
  let task;
  return {
    log,
    async submit(t) {
      log.submitted.push(t);
      task = t;
      return "task-" + log.submitted.length;
    },
    async status() {
      const state = statuses[log.polls++] ?? "done";
      if (state === "blip")
        throw new ObservationError("OBSERVATION_UNAVAILABLE");
      return state;
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
const nasadem = (elevation) => (task) =>
  csv(
    [
      "Category",
      "ID",
      "Latitude",
      "Longitude",
      "Date",
      "NASADEM_NC_001_NASADEM_HGT",
    ],
    task.params.coordinates.map((c) => {
      const { east, north } = offset(c.latitude, c.longitude);
      const z = elevation(east, north);
      return [c.category, c.id, c.latitude, c.longitude, "2000-02-11", z];
    }),
  );
const signal = () => new AbortController().signal;
async function user() {
  const id = randomUUID();
  await db.pool.query(
    "INSERT INTO auth_users(id,name,email,email_verified) VALUES($1,'Synthetic farmer',$2,true)",
    [id, `${id}@example.invalid`],
  );
  return id;
}
async function run(store, owner, kind) {
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const queued = await store.request(owner, field.id, kind);
  let next = await store.process(queued.id, signal());
  while (next !== null) next = await store.process(queued.id, signal());
  return { field, queued };
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
  await db.pool.query("TRUNCATE regional_water_storage");
});

test("the terrain grid steps by whole NASADEM pixels around the outline", () => {
  const t = terrainRequest(outline);
  expect(t.stride).toBe(1);
  expect(t.rows * t.cols).toBe(t.grid.length);
  expect(t.grid.some((g) => g.inside)).toBe(true);
  expect(t.grid.some((g) => !g.inside)).toBe(true);
  // One arc-second is about 30.9 m north-south.
  expect(t.cellNorthM).toBeCloseTo(30.887, 2);
  expect(t.cellEastM).toBeLessThan(t.cellNorthM);
  expect(t.ring.length).toBe(16);
  expect(new Set([...t.grid, ...t.ring].map((p) => p.id)).size).toBe(
    t.grid.length + t.ring.length,
  );
});

test("terrain: needs an outline, queues once, reads a synthetic slope and keeps the raw file", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  const fake = appeears(
    {
      "NASADEM-NC-001-results.csv": nasadem(
        (east) => Math.round((300 + 0.2 * east) * 1), // a 20 % slope rising to the east
      ),
    },
    { statuses: ["processing"] },
  );
  const store = new ExtractionStore(db.pool, db.boss, fake);
  await expect(store.request(owner, field.id, "terrain")).rejects.toMatchObject(
    { code: "INVALID_INPUT" },
  );
  await fields.saveBoundary(owner, field.id, outline, null);
  const queued = await store.request(owner, field.id, "terrain");
  expect(queued.status).toBe("queued");
  expect((await store.request(owner, field.id, "terrain")).id).toBe(queued.id);
  expect(await store.fresh()).toEqual([queued.id]);
  await store.enqueue(queued.id);
  await store.enqueue(queued.id);
  expect(
    await db.boss.findJobs(EXTRACTION_QUEUE, { key: queued.id }),
  ).toHaveLength(1);
  expect(await store.process(queued.id, signal())).toBe(600);
  const task = fake.log.submitted[0];
  expect(task.params.layers).toEqual([
    { product: "NASADEM_NC.001", layer: "NASADEM_HGT" },
  ]);
  expect(task.params.dates).toEqual([
    { startDate: "02-11-2000", endDate: "02-21-2000" },
  ]);
  expect(task.params.coordinates.length).toBe(25 + 16);
  expect(await store.process(queued.id, signal())).toBe(600);
  expect(await store.process(queued.id, signal())).toBeNull();
  const done = await store.read(owner, field.id, queued.id);
  expect(done.status).toBe("completed");
  const r = done.result;
  expect(r.kind).toBe("terrain");
  // Heights are whole metres, so a 20 % slope reads close to, not exactly, 20.
  expect(r.slope.meanPercent).toBeGreaterThan(17);
  expect(r.slope.meanPercent).toBeLessThan(23);
  expect(r.slope.dominantAspectDeg).toBeGreaterThan(250);
  expect(r.slope.dominantAspectDeg).toBeLessThan(290);
  expect(r.erosion.lsFactorMean).toBeGreaterThan(1);
  expect(r.frostPocket.status).toBe("not_indicated");
  expect(r.provenance.map((p) => p.origin)).toContain("sourced");
  expect(r.explanations).toContain("terrain.erosion_ls");
  expect(fake.log.removed).toEqual(["task-1"]);
  const files = (
    await db.pool.query("SELECT name,sha256 FROM field_extraction_files")
  ).rows;
  expect(files.map((f) => f.name)).toEqual(["NASADEM-NC-001-results.csv"]);
  expect(files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  // Raw provider files are evidence and cannot be changed.
  await expect(
    db.pool.query("UPDATE field_extraction_files SET sha256=repeat('0',64)"),
  ).rejects.toThrow(/FIELD_EXTRACTION_FILES_IMMUTABLE/);
  // A changed stored result no longer matches its hash.
  await db.pool.query(
    "UPDATE field_extractions SET result=jsonb_set(result,'{resolutionMeters}','31') WHERE id=$1",
    [queued.id],
  );
  await expect(store.read(owner, field.id, queued.id)).rejects.toMatchObject({
    code: "STORED_REQUEST_INVALID",
  });
});

test("terrain: a bowl below its surroundings on gentle ground flags a possible cold-air pool", async () => {
  const owner = await user();
  const fake = appeears({
    "NASADEM-NC-001-results.csv": nasadem(
      (east, north) =>
        Math.round((300 + 0.00006 * (east * east + north * north)) * 10) / 10,
    ),
  });
  const store = new ExtractionStore(db.pool, db.boss, fake);
  const { field, queued } = await run(store, owner, "terrain");
  const done = await store.read(owner, field.id, queued.id);
  expect(done.status).toBe("completed");
  expect(done.result.slope.meanPercent).toBeLessThan(5);
  expect(done.result.frostPocket.status).toBe("possible_cold_air_pool");
  expect(done.result.frostPocket.belowSurroundingM).toBeGreaterThan(5);
});

test("terrain: fill values stay missing and a file with an unknown point fails without a guess", async () => {
  const owner = await user();
  const gappy = appeears({
    "NASADEM-NC-001-results.csv": (task) => {
      const text = new TextDecoder().decode(nasadem(() => 400)(task));
      // The centre of the 5 x 5 grid has no data.
      return new TextEncoder().encode(
        text.replace(/^(.*g2-2,.*?,2000-02-11,)400$/m, "$1-32768"),
      );
    },
  });
  let store = new ExtractionStore(db.pool, db.boss, gappy);
  let r = await run(store, owner, "terrain");
  let done = await store.read(owner, r.field.id, r.queued.id);
  expect(done.result.grid.missingPoints).toBe(1);
  // A field this small has too few complete 3 x 3 windows left, so there is
  // no slope or erosion reading rather than a guessed one.
  expect(done.result.slope).toBeNull();
  expect(done.result.erosion).toBeNull();
  expect(done.result.elevation.cells).toBeGreaterThan(0);
  const wrong = appeears({
    "NASADEM-NC-001-results.csv": () =>
      csv(["ID", "NASADEM_NC_001_NASADEM_HGT"], [["not-a-point", 10]]),
  });
  store = new ExtractionStore(db.pool, db.boss, wrong);
  r = await run(store, owner, "terrain");
  done = await store.read(owner, r.field.id, r.queued.id);
  expect(done.status).toBe("failed");
  expect(done.error).toEqual({ code: "OBSERVATION_UPSTREAM_INVALID" });
});

test("ECOSTRESS: reads synthetic cloud-free land temperature and stress index into monthly means", async () => {
  const owner = await user();
  const lste = (task) =>
    csv(
      [
        "Category",
        "ID",
        "Latitude",
        "Longitude",
        "Date",
        "ECO_L2T_LSTE_002_LST",
        "ECO_L2T_LSTE_002_cloud",
        "ECO_L2T_LSTE_002_water",
        "ECO_L2T_LSTE_002_QC",
      ],
      task.params.coordinates.flatMap((c) => [
        [
          c.category,
          c.id,
          c.latitude,
          c.longitude,
          "2025-06-01",
          313.15,
          0,
          0,
          32768,
        ],
        [
          c.category,
          c.id,
          c.latitude,
          c.longitude,
          "2025-06-05",
          320.15,
          1,
          0,
          32768,
        ],
        [
          c.category,
          c.id,
          c.latitude,
          c.longitude,
          "2025-07-03",
          "NaN",
          0,
          0,
          32768,
        ],
      ]),
    );
  const esi = (task) =>
    csv(
      [
        "Category",
        "ID",
        "Latitude",
        "Longitude",
        "Date",
        "ECO_L4T_ESI_002_ESI",
        "ECO_L4T_ESI_002_cloud",
        "ECO_L4T_ESI_002_water",
      ],
      task.params.coordinates.map((c) => [
        c.category,
        c.id,
        c.latitude,
        c.longitude,
        "2025-06-01 11:30:00",
        0.4,
        0,
        0,
      ]),
    );
  const fake = appeears({
    "ECO-L2T-LSTE-002-results.csv": lste,
    "ECO-L4T-ESI-002-results.csv": esi,
  });
  const store = new ExtractionStore(db.pool, db.boss, fake);
  const { field, queued } = await run(store, owner, "ecostress");
  const task = fake.log.submitted[0];
  expect(task.params.layers.map((l) => `${l.product}/${l.layer}`)).toEqual([
    "ECO_L2T_LSTE.002/LST",
    "ECO_L2T_LSTE.002/cloud",
    "ECO_L2T_LSTE.002/water",
    "ECO_L4T_ESI.002/ESI",
    "ECO_L4T_ESI.002/cloud",
    "ECO_L4T_ESI.002/water",
  ]);
  const done = await store.read(owner, field.id, queued.id);
  expect(done.status).toBe("completed");
  expect(done.result.products).toHaveLength(2);
  expect(done.result.policyVersion).toBe("ecostress-policy-2");
  // The cloudy 5 June scene and the NaN July value are dropped, not filled.
  expect(done.result.months).toEqual([
    {
      month: "2025-06",
      acquisitions: 2,
      lstMeanC: 40,
      lstMaxC: 40,
      esiMean: 0.4,
      esiMin: 0.4,
    },
  ]);
  expect(done.result.acquisitions).toBe(2);
});

test.each([undefined, "ecostress-policy-1", "ecostress-policy-2"])(
  "ECOSTRESS: saved request policy %s survives processing, persistence and reread",
  async (policyVersion) => {
    const owner = await user();
    const field = await fields.create(owner, profile);
    await fields.saveBoundary(owner, field.id, outline, null);
    const fake = appeears({
      "ECO-L2T-LSTE-002-results.csv": () =>
        new Uint8Array(
          readFileSync(
            "docs/evidence/live/2026-11-09/ECO-L2T-LSTE-002-results.sample.csv",
          ),
        ),
    });
    const store = new ExtractionStore(db.pool, db.boss, fake);
    const queued = await store.request(owner, field.id, "ecostress");
    const saved = await db.pool.query(
      "SELECT request FROM field_extractions WHERE id=$1",
      [queued.id],
    );
    expect(saved.rows[0].request.ecostressPolicyVersion).toBe(
      "ecostress-policy-2",
    );
    // Simulate a request queued by the pre-filter build, or an explicitly
    // pinned request. Only this disposable database is modified.
    const request = { ...saved.rows[0].request };
    if (policyVersion === undefined) delete request.ecostressPolicyVersion;
    else request.ecostressPolicyVersion = policyVersion;
    await db.pool.query("UPDATE field_extractions SET request=$2 WHERE id=$1", [
      queued.id,
      request,
    ]);
    let next = await store.process(queued.id, signal());
    while (next !== null) next = await store.process(queued.id, signal());
    const done = await store.read(owner, field.id, queued.id);
    expect(done.status).toBe("completed");
    expect(done.result.policyVersion).toBe(
      policyVersion ?? "ecostress-policy-1",
    );
    const september = done.result.months.find((m) => m.month === "2024-09");
    if (policyVersion === "ecostress-policy-2") {
      expect(september).toBeUndefined();
      expect(done.result.acquisitions).toBe(0);
    } else {
      expect(september).toMatchObject({ lstMeanC: 63.95, lstMaxC: 63.95 });
      expect(done.result.acquisitions).toBe(2);
    }
    const before = await db.pool.query(
      "SELECT result_hash FROM field_extractions WHERE id=$1",
      [queued.id],
    );
    await store.process(queued.id, signal());
    const reread = await store.read(owner, field.id, queued.id);
    expect(reread).toEqual(done);
    const after = await db.pool.query(
      "SELECT result_hash FROM field_extractions WHERE id=$1",
      [queued.id],
    );
    expect(after.rows[0].result_hash).toBe(before.rows[0].result_hash);
  },
);

test("another user can neither start nor read a field's extractions", async () => {
  const owner = await user();
  const other = await user();
  const fake = appeears({
    "NASADEM-NC-001-results.csv": nasadem(() => 400),
  });
  const store = new ExtractionStore(db.pool, db.boss, fake);
  const { field, queued } = await run(store, owner, "terrain");
  await expect(store.request(other, field.id, "terrain")).rejects.toMatchObject(
    {
      code: "NOT_FOUND",
    },
  );
  await expect(store.read(other, field.id, queued.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(store.list(other, field.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect((await store.list(owner, field.id)).map((e) => e.kind)).toEqual([
    "terrain",
  ]);
});

// A synthetic mascon file: 16 years of monthly values falling 1.5 cm a year.
function graceFile(cells) {
  const months = [];
  for (let i = 0; i < 16 * 12; i++) {
    const idx = 2005 * 12 + i;
    months.push([
      `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`,
      Number(
        (-1.5 * (i / 12) + 3 * Math.sin((2 * Math.PI * (i % 12)) / 12)).toFixed(
          3,
        ),
      ),
    ]);
  }
  return {
    product: "SYNTHETIC-GRACE-TEST",
    sourceSha256: "a".repeat(64),
    cells: cells.map(([latitude, longitude]) => ({
      latitude,
      longitude,
      months,
    })),
  };
}
test("GRACE: nothing imported, then the nearest synthetic cell gives a regional trend", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  const water = new WaterStorageService(db.pool);
  expect(await water.forField(owner, field.id)).toEqual({
    available: false,
    reason: "WATER_STORAGE_NOT_IMPORTED",
  });
  const first = await water.import(
    graceFile([
      [32.25, -6.75],
      [40.25, 10.25],
    ]),
  );
  expect(first.inserted).toBe(2 * 16 * 12);
  // Importing the same file again changes nothing.
  expect((await water.import(graceFile([[32.25, -6.75]]))).inserted).toBe(0);
  const out = await water.forField(owner, field.id);
  expect(out.available).toBe(true);
  expect(out.result.cell).toMatchObject({ latitude: 32.25, longitude: -6.75 });
  expect(out.result.cell.distanceKm).toBeLessThan(50);
  expect(out.result.trend.direction).toBe("declining");
  expect(out.result.trend.trendCmPerYear).toBeGreaterThan(-1.7);
  expect(out.result.trend.trendCmPerYear).toBeLessThan(-1.3);
  expect(out.result.recentMonths).toHaveLength(36);
  expect(out.result.resolutionNote).toMatch(/hundreds of kilometres/);
  await expect(water.forField(await user(), field.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
test("GRACE: the extractor's own output (synthetic netCDF, masked cell dropped, 11-month gap) imports and gives the known trend", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  const water = new WaterStorageService(db.pool);
  const file = JSON.parse(
    readFileSync("tests/support/fixtures/grace-synthetic-extract.json", "utf8"),
  );
  // Three cells: the masked (32.25, -6.75) cell has no months and is absent.
  expect(file.cells.map((c) => [c.latitude, c.longitude])).toEqual([
    [32.25, -6.25],
    [32.75, -6.75],
    [32.75, -6.25],
  ]);
  const imported = await water.import(file);
  expect(imported.cells).toBe(3);
  const out = await water.forField(owner, field.id);
  expect(out.available).toBe(true);
  expect(out.result.cell).toMatchObject({ latitude: 32.25, longitude: -6.25 });
  // Invented series: a fall of 2 cm a year under a 5 cm seasonal cycle.
  expect(out.result.trend.trendCmPerYear).toBeGreaterThan(-2.05);
  expect(out.result.trend.trendCmPerYear).toBeLessThan(-1.95);
  expect(out.result.trend.months).toBe(229);
  expect(out.result.trend.missingMonths).toBe(11);
  expect(out.result.trend.direction).toBe("declining");
});
test("GRACE: a field far from every imported cell is not given a distant region's trend", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  const water = new WaterStorageService(db.pool);
  await water.import(graceFile([[10.25, 10.25]]));
  expect(await water.forField(owner, field.id)).toEqual({
    available: false,
    reason: "WATER_STORAGE_OUTSIDE_IMPORT",
  });
  await expect(
    water.import({ product: "x", sourceSha256: "bad", cells: [] }),
  ).rejects.toThrow();
});

test("one NASA error after a long wait does not fail an extraction that was polling normally", async () => {
  const owner = await user();
  const fake = appeears(
    { "NASADEM-NC-001-results.csv": nasadem(() => 430) },
    {
      statuses: [
        "pending",
        "pending",
        "pending",
        "pending",
        "pending",
        "pending",
        "blip",
      ],
    },
  );
  const store = new ExtractionStore(db.pool, db.boss, fake);
  const { field, queued } = await run(store, owner, "terrain");
  const done = await store.read(owner, field.id, queued.id);
  expect(done.status).toBe("completed");
  expect(fake.log.polls).toBe(8);
});
