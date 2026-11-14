import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { disposable } from "../support/index.mjs";
import { syntheticSnapshot } from "../support/climate.mjs";
import { FieldStore } from "../../apps/server/dist/modules/fields/application/field-store.js";
import { ObservationStore } from "../../apps/server/dist/modules/earth-observations/application/observation-store.js";
import { ObservationError } from "../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { OBSERVATION_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";

let db, fields, weather;
const dir = "docs/evidence/earth-observations/2026-10-17/";
const prefix = "appeears-rotavise-step11-evidence-";
// Replays the real recorded AppEEARS files with the point ids the request
// used, so the pipeline runs on real data without calling NASA.
function appeears({ status = () => "done" } = {}) {
  const log = { submitted: [], removed: [], polls: 0 };
  const real = {
    "HLSS30-020-results.csv": readFileSync(
      dir + prefix + "HLSS30-020-results.csv",
      "utf8",
    ),
    "HLSL30-020-results.csv": readFileSync(
      dir + prefix + "HLSL30-020-results.csv",
      "utf8",
    ),
    "SPL4SMGP-008-results.csv": readFileSync(
      dir + prefix + "SPL4SMGP-008-results.csv",
      "utf8",
    ),
  };
  let ids = [];
  return {
    log,
    async submit(task) {
      log.submitted.push(task);
      ids = task.params.coordinates.map((c) => c.id);
      return "task-" + log.submitted.length;
    },
    async status() {
      log.polls++;
      return status(log.polls);
    },
    async bundle() {
      return Object.keys(real).map((name, i) => ({
        fileId: "f" + i,
        name: `rotavise-x-${name}`,
        size: real[name].length,
        sha256: null,
      }));
    },
    async download(_task, file) {
      const name = file.name.replace("rotavise-x-", "");
      // Map recorded points p1–p4 onto the request's ids.
      let text = real[name];
      ["p1", "p2", "p3", "p4"].forEach((p, i) => {
        text = text.replaceAll(`,${p},`, `,${ids[i % ids.length]},`);
      });
      return new TextEncoder().encode(text);
    },
    async remove(task) {
      log.removed.push(task);
    },
  };
}
const rain = {
  async daily() {
    return new Uint8Array(readFileSync(dir + "giovanni-gpm-imerg-daily.csv"));
  },
};
// Synthetic POWER precipitation for the comparison (labelled; not NASA data).
const power = {
  async fetch(r) {
    const sample = syntheticSnapshot(
      r.startDate,
      r.endDate,
      1,
      () => ({ precipitation: 1 }),
      r.variables,
    );
    const parameter = {
      PRECTOTCORR: Object.fromEntries(
        sample.snapshot.days.map((d) => [d.date.replaceAll("-", ""), 1]),
      ),
    };
    const raw = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.longitude, r.latitude, 500] },
      properties: { parameter },
      header: {
        api: { name: "POWER Daily API", version: "synthetic-observations-11" },
        sources: ["MERRA2"],
        fill_value: -999,
        time_standard: "UTC",
        start: r.startDate.replaceAll("-", ""),
        end: r.endDate.replaceAll("-", ""),
      },
      parameters: {
        PRECTOTCORR: { units: "mm/day", longname: "Synthetic test fixture" },
      },
      messages: [],
    });
    return { raw, snapshot: normalizeNasa(raw, r) };
  },
};
async function user() {
  const id = randomUUID();
  await db.pool.query(
    "INSERT INTO auth_users(id,name,email,email_verified) VALUES($1,'Synthetic farmer',$2,true)",
    [id, `${id}@example.invalid`],
  );
  return id;
}
const profile = {
  schema_version: "1",
  name: "Synthetic test field",
  location: { latitude: 32.4, longitude: -6.55 },
  soil: { status: "unknown" },
  water: { status: "unknown" },
  crop_health: { status: "unknown" },
};
// About 70 m by 67 m: four 30 m sample points, like the recorded request.
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
const signal = () => new AbortController().signal;
beforeAll(async () => {
  db = await disposable();
  fields = new FieldStore(db.pool);
  weather = new WeatherService(db.pool, power);
});
afterAll(async () => {
  await weather?.close();
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query(
    "TRUNCATE auth_users,weather_cache,weather_snapshots CASCADE",
  );
});

test("HLS needs an outline; a request is queued once, submitted, polled, normalized from real files and cleaned up", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  const fake = appeears({ status: (n) => (n < 2 ? "processing" : "done") });
  const store = new ObservationStore(db.pool, db.boss, fake, rain, weather);
  await expect(store.request(owner, field.id, "hls")).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await fields.saveBoundary(owner, field.id, outline, null);
  const queued = await store.request(owner, field.id, "hls");
  expect(queued.status).toBe("queued");
  expect((await store.request(owner, field.id, "hls")).id).toBe(queued.id);
  // The worker picks the new request up and queues one job for it.
  expect(await store.fresh()).toEqual([queued.id]);
  await store.enqueue(queued.id);
  await store.enqueue(queued.id);
  const jobs = await db.boss.findJobs(OBSERVATION_QUEUE, { key: queued.id });
  expect(jobs).toHaveLength(1);
  expect(await store.process(queued.id, signal())).toBe(600);
  const task = fake.log.submitted[0];
  expect(task.params.dates[0].endDate).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  expect(task.params.coordinates).toHaveLength(4);
  expect(task.params.layers.map((l) => l.product)).toEqual([
    "HLSS30.020",
    "HLSS30.020",
    "HLSS30.020",
    "HLSL30.020",
    "HLSL30.020",
    "HLSL30.020",
  ]);
  expect(await store.process(queued.id, signal())).toBe(600);
  expect(await store.process(queued.id, signal())).toBeNull();
  const done = await store.read(owner, field.id, queued.id);
  expect(done.status).toBe("completed");
  expect(done.result.seasons.map((s) => s.start)).toEqual([
    "2023-01-02",
    "2024-01-23",
  ]);
  expect(fake.log.removed).toEqual(["task-1"]);
  const files = (
    await db.pool.query(
      "SELECT name,sha256 FROM field_observation_files ORDER BY name",
    )
  ).rows;
  expect(files.map((f) => f.name)).toEqual([
    "HLSL30-020-results.csv",
    "HLSS30-020-results.csv",
  ]);
  // Another farmer cannot see it; deleting the field removes everything.
  const other = await user();
  await expect(store.read(other, field.id, queued.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(store.list(other, field.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect((await store.list(owner, field.id)).map((o) => o.kind)).toEqual([
    "hls",
  ]);
  await fields.remove(owner, field.id);
  const left = await db.pool.query(
    "SELECT (SELECT count(*) FROM field_observations)::int o,(SELECT count(*) FROM field_observation_files)::int f",
  );
  expect(left.rows[0]).toEqual({ o: 0, f: 0 });
});

test("SMAP and GPM use the rounded field point; GPM sits beside POWER by month", async () => {
  const owner = await user();
  const field = await fields.create(owner, {
    ...profile,
    location: { latitude: 32.40123, longitude: -6.54987 },
  });
  const fake = appeears();
  const store = new ObservationStore(db.pool, db.boss, fake, rain, weather);
  const smap = await store.request(owner, field.id, "smap");
  await store.process(smap.id, signal());
  expect(fake.log.submitted[0].params.coordinates[0]).toMatchObject({
    latitude: 32.4,
    longitude: -6.55,
  });
  await store.process(smap.id, signal());
  const soil = (await store.read(owner, field.id, smap.id)).result;
  expect(soil.cell).toEqual({ line: 376, sample: 1857 });
  expect(soil.latest).toEqual({ date: "2024-12-31", percentile: 23.37 });
  const gpm = await store.request(owner, field.id, "gpm");
  expect(await store.process(gpm.id, signal())).toBeNull();
  const months = (await store.read(owner, field.id, gpm.id)).result.months;
  const feb = months.find((m) => m.month === "2023-02");
  expect(feb).toEqual({
    month: "2023-02",
    imergMm: 41.3,
    powerMm: 28,
    imergDays: 28,
  });
  // Stored weather for the comparison holds the POWER cell centre only.
  const sites = (
    await db.pool.query(
      "SELECT DISTINCT snapshot->'request'->>'latitude' lat FROM weather_snapshots",
    )
  ).rows;
  expect(sites).toEqual([{ lat: "32.5" }]);
});

test("upstream errors, invalid data and two-day waits end in failure, and the remote task is deleted", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const failing = appeears({ status: () => "error" });
  const store = new ObservationStore(db.pool, db.boss, failing, rain, weather);
  const a = await store.request(owner, field.id, "hls");
  await store.process(a.id, signal());
  expect(await store.process(a.id, signal())).toBeNull();
  expect((await store.read(owner, field.id, a.id)).error).toEqual({
    code: "OBSERVATION_UPSTREAM_FAILED",
  });
  expect(failing.log.removed).toEqual(["task-1"]);
  const slow = appeears({ status: () => "processing" });
  const waiting = new ObservationStore(db.pool, db.boss, slow, rain, weather);
  const b = await waiting.request(owner, field.id, "hls");
  await waiting.process(b.id, signal());
  await db.pool.query(
    "UPDATE field_observations SET created_at=clock_timestamp()-interval '49 hours' WHERE id=$1",
    [b.id],
  );
  expect(await waiting.process(b.id, signal())).toBeNull();
  expect((await waiting.read(owner, field.id, b.id)).error).toEqual({
    code: "OBSERVATION_TIMEOUT",
  });
  const broken = appeears();
  broken.submit = async () => {
    throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  };
  const c = await new ObservationStore(
    db.pool,
    db.boss,
    broken,
    rain,
    weather,
  ).request(owner, field.id, "smap");
  expect(
    await new ObservationStore(db.pool, db.boss, broken, rain, weather).process(
      c.id,
      signal(),
    ),
  ).toBeNull();
  expect(
    (
      await db.pool.query(
        "SELECT status,error_code FROM field_observations WHERE id=$1",
        [c.id],
      )
    ).rows[0],
  ).toEqual({ status: "failed", error_code: "OBSERVATION_UPSTREAM_INVALID" });
});

test("stored results are hash-checked, files are immutable and requests are rate limited", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  const store = new ObservationStore(
    db.pool,
    db.boss,
    appeears(),
    rain,
    weather,
  );
  const g = await store.request(owner, field.id, "gpm");
  await store.process(g.id, signal());
  await expect(
    db.pool.query("UPDATE field_observation_files SET sha256=$1", [
      "0".repeat(64),
    ]),
  ).rejects.toThrow(/FIELD_OBSERVATION_FILES_IMMUTABLE/);
  const raw = (
    await db.pool.query("SELECT raw,sha256 FROM field_observation_files")
  ).rows[0];
  expect(createHash("sha256").update(raw.raw).digest("hex")).toBe(raw.sha256);
  await db.pool.query(
    "UPDATE field_observations SET result=jsonb_set(result,'{cell,latitude}','0') WHERE id=$1",
    [g.id],
  );
  await expect(store.read(owner, field.id, g.id)).rejects.toMatchObject({
    code: "STORED_REQUEST_INVALID",
  });
  for (let i = 0; i < 9; i++) {
    await db.pool.query(
      "UPDATE field_observations SET status='failed',error_code='X',completed_at=now(),result=null,result_hash=null WHERE field_id=$1 AND status<>'failed'",
      [field.id],
    );
    await store.request(owner, field.id, "smap");
  }
  await db.pool.query(
    "UPDATE field_observations SET status='failed',error_code='X',completed_at=now(),result=null,result_hash=null WHERE field_id=$1 AND status<>'failed'",
    [field.id],
  );
  await expect(store.request(owner, field.id, "smap")).rejects.toMatchObject({
    code: "RATE_LIMITED",
  });
});

// The recorded task also returned its granule list; the fake bundle offers it.
function appeearsWithGranules(options) {
  const base = appeears(options);
  const list = readFileSync(dir + prefix + "granule-list.txt", "utf8");
  return {
    ...base,
    async bundle(...args) {
      return [
        ...(await base.bundle(...args)),
        {
          fileId: "granules",
          name: "rotavise-x-" + prefix.slice(0, -1) + "-granule-list.txt",
          size: list.length,
          sha256: null,
        },
      ];
    },
    async download(task, file, ...rest) {
      if (file.fileId === "granules") return new TextEncoder().encode(list);
      return base.download(task, file, ...rest);
    },
  };
}

test("analysis endpoints: greenness history with granule ids, POWER against IMERG rain, and why there is nothing yet", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const fake = appeearsWithGranules();
  const store = new ObservationStore(db.pool, db.boss, fake, rain, weather);
  const none = { status: "unavailable", observation: "none", error: null };
  expect(await store.vegetationAnalysis(owner, field.id)).toEqual(none);
  expect(await store.rainSeries(owner, field.id)).toEqual(none);
  const hls = await store.request(owner, field.id, "hls");
  expect(await store.vegetationAnalysis(owner, field.id)).toEqual({
    ...none,
    observation: "queued",
  });
  await store.process(hls.id, signal());
  expect(await store.vegetationAnalysis(owner, field.id)).toEqual({
    ...none,
    observation: "submitted",
  });
  await store.process(hls.id, signal());
  const ready = await store.vegetationAnalysis(owner, field.id);
  expect(ready.status).toBe("ready");
  expect(ready.observationId).toBe(hls.id);
  const a = ready.analysis;
  expect(a.periodsStatus).toBe("available");
  const complete = a.years.filter((y) => y.status === "complete");
  expect(complete.map((y) => y.year)).toEqual([2023, 2024]);
  expect(
    complete.every((y) =>
      y.timeline.every((t) =>
        t.granules.every((g) => /^HLS\.[LS]30\./.test(g)),
      ),
    ),
  ).toBe(true);
  expect(a.uncertainty.granulesAvailable).toBe(true);
  expect(a.anomalies.status).toBe("insufficient_history");
  // The granule list is kept as evidence beside the results files.
  const stored = (
    await db.pool.query(
      "SELECT name FROM field_observation_files WHERE observation_id=$1 ORDER BY name",
      [hls.id],
    )
  ).rows.map((r) => r.name);
  expect(stored).toEqual([
    "granule-list.txt",
    "HLSL30-020-results.csv",
    "HLSS30-020-results.csv",
  ]);
  const read = (await store.read(owner, field.id, hls.id)).result;
  expect(read.granules.length).toBeGreaterThan(200);
  // POWER beside IMERG for the field's cell.
  const gpm = await store.request(owner, field.id, "gpm");
  await store.process(gpm.id, signal());
  const series = await store.rainSeries(owner, field.id);
  expect(series.status).toBe("ready");
  const feb = series.series.months.find((m) => m.month === "2023-02");
  expect(feb).toMatchObject({
    imergMm: 41.3,
    powerMm: 28,
    bothComplete: true,
    differenceMm: 13.3,
    ratio: 1.475,
  });
  const compared = series.series.months.filter((m) => m.bothComplete);
  expect(compared.length).toBeGreaterThan(0);
  expect(series.series.summary.monthsCompared).toBe(compared.length);
  // Another farmer cannot read either analysis.
  const other = await user();
  await expect(store.vegetationAnalysis(other, field.id)).rejects.toMatchObject(
    { code: "NOT_FOUND" },
  );
  await expect(store.rainSeries(other, field.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("a failed extraction is reported as unavailable with its code, and an older completed one still answers", async () => {
  const owner = await user();
  const field = await fields.create(owner, profile);
  await fields.saveBoundary(owner, field.id, outline, null);
  const failing = new ObservationStore(
    db.pool,
    db.boss,
    appeears({ status: () => "error" }),
    rain,
    weather,
  );
  const hls = await failing.request(owner, field.id, "hls");
  await failing.process(hls.id, signal());
  await failing.process(hls.id, signal());
  expect(await failing.vegetationAnalysis(owner, field.id)).toEqual({
    status: "unavailable",
    observation: "failed",
    error: "OBSERVATION_UPSTREAM_FAILED",
  });
  const working = new ObservationStore(
    db.pool,
    db.boss,
    appeearsWithGranules(),
    rain,
    weather,
  );
  const again = await working.request(owner, field.id, "hls");
  await working.process(again.id, signal());
  await working.process(again.id, signal());
  expect((await working.vegetationAnalysis(owner, field.id)).status).toBe(
    "ready",
  );
  // A newer request that is still running does not hide the completed one.
  await working.request(owner, field.id, "hls");
  const still = await working.vegetationAnalysis(owner, field.id);
  expect(still.status).toBe("ready");
  expect(still.observationId).toBe(again.id);
});
