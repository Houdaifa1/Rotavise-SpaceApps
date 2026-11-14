import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { disposable } from "../support/index.mjs";
import { syntheticKelvin, syntheticTile } from "../support/netcdf.mjs";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import {
  ScenarioStore,
  policyKey,
  tileUnits,
  unitKey,
} from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
import { normalizeScenario } from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/normalization.js";
import { ScenarioError } from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/normalization.js";
import { createScenarioHandler } from "../../apps/server/dist/modules/climate-scenarios/worker/scenario.handler.js";
import { SCENARIO_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { futureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";

let db;
const tile = { latitude: 32, longitude: -7 };
// A small policy keeps the synthetic tile to 12 units: one model, two
// baseline years and two future years, three variables each.
const policy = {
  ...futureClimatePolicy,
  models: [futureClimatePolicy.models.find((m) => m.id === "UKESM1-0-LL")],
  baseline: {
    experiment: "historical",
    firstAnchorYear: 2000,
    lastAnchorYear: 2001,
    lastDataYear: 2001,
  },
  futures: [
    {
      experiment: "ssp585",
      firstAnchorYear: 2050,
      lastAnchorYear: 2051,
      lastDataYear: 2051,
    },
  ],
  minimumCompleteAnalogs: 1,
};
// Serves synthetic tiles; `fail` decides per call whether to throw first.
function provider({ latency = 0, fail = () => null, bytes } = {}) {
  const calls = [];
  const completed = [];
  return {
    calls,
    completed,
    async fetch(identity, signal) {
      calls.push(unitKey(identity));
      await delay(latency, undefined, { signal });
      completed.push(unitKey(identity));
      const error = fail(identity, calls.length);
      if (error) throw new ScenarioError(error);
      return {
        raw: bytes
          ? bytes(identity)
          : syntheticTile(identity, syntheticKelvin(identity)),
        retrievedAt: new Date().toISOString(),
      };
    },
  };
}
const status = async () =>
  (
    await db.pool.query(
      "SELECT status,units_total,units_ready,failures,error_code FROM climate_scenario_tiles WHERE policy_key=$1",
      [policyKey(policy)],
    )
  ).rows[0];
const options = (deadlineMs = 60000) => ({
  concurrency: 2,
  deadlineMs,
  signal: new AbortController().signal,
});
beforeAll(async () => {
  db = await disposable();
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query(
    "TRUNCATE climate_scenario_tiles,climate_scenario_units,planning_scenario_units",
  );
});

test("a tile is prepared once, resumes after its deadline and never refetches stored units", async () => {
  const slow = provider({ latency: 150 });
  const store = new ScenarioStore(db.pool, slow, true);
  expect(await store.request(tile, policy, 4)).toBe("requested");
  expect(await store.request(tile, policy, 4)).toBe("existing");
  const first = await store.prepare(tile, policy, options(400));
  expect(first.status).toBe("preparing");
  expect(first.remaining).toBeGreaterThan(0);
  const second = await store.prepare(tile, policy, options());
  expect(second).toEqual({ remaining: 0, status: "ready" });
  expect(await status()).toMatchObject({
    status: "ready",
    units_total: 16,
    units_ready: 16,
  });
  // Only requests cancelled at the deadline are repeated.
  expect(new Set(slow.completed).size).toBe(slow.completed.length);
  expect(slow.completed).toHaveLength(16);
  expect(slow.calls.length).toBeLessThanOrEqual(16 + 2);
  expect((await store.prepare(tile, policy, options())).status).toBe("skipped");
});

test("stored units are re-verified and give the field cell's series", async () => {
  const store = new ScenarioStore(db.pool, provider(), true);
  await store.request(tile, policy, 4);
  await store.prepare(tile, policy, options());
  const units = tileUnits(policy, tile).filter((u) => u.variable === "tasmax");
  const cell = { latitude: 32.375, longitude: -6.375 };
  const series = await store.series({ cell, units });
  expect(series).toHaveLength(4);
  expect(series.every((s) => s.synthetic && s.values.length === 360)).toBe(
    true,
  );
  const kelvin = syntheticKelvin(units[0]);
  expect(series[0].values[10]).toBe(
    Number((kelvin(10, 1, 2) - 273.15).toFixed(3)),
  );
  // Production refuses synthetic tiles, even when they are stored.
  await expect(
    new ScenarioStore(db.pool).series({ cell, units }),
  ).rejects.toThrow("SCENARIO_STORAGE_UNAVAILABLE");
  // An incomplete set is not served.
  expect(
    await store.series({
      cell,
      units: [...units, { ...units[0], year: 1999 }],
    }),
  ).toBeNull();
  await expect(
    db.pool.query("UPDATE climate_scenario_units SET year=year"),
  ).rejects.toThrow(/CLIMATE_SCENARIO_IMMUTABLE/);
  await expect(
    db.pool.query("DELETE FROM climate_scenario_units"),
  ).rejects.toThrow(/CLIMATE_SCENARIO_IMMUTABLE/);
});

test("a real recorded tile is stored and served unchanged", async () => {
  const directory = "docs/evidence/climate-scenarios/2026-10-17/";
  const manifest = JSON.parse(
    readFileSync(directory + "manifest.json", "utf8"),
  );
  const entry = manifest.responses.find(
    (r) => r.name === "nex-UKESM1-0-LL-historical-tasmax-2000",
  );
  const raw = new Uint8Array(readFileSync(directory + entry.file));
  const identity = tileUnits(policy, tile).find(
    (u) =>
      u.experiment === "historical" &&
      u.variable === "tasmax" &&
      u.year === 2000,
  );
  const store = new ScenarioStore(db.pool, provider({ bytes: () => raw }));
  await store.fetchUnit(identity, new AbortController().signal);
  const cell = { latitude: 32.375, longitude: -6.375 };
  const [series] = await store.series({ cell, units: [identity] });
  const { unit } = normalizeScenario(raw, identity, entry.retrievedAt);
  expect(series.synthetic).toBe(false);
  expect(series.values).toEqual(unit.values[6]);
  const row = (
    await db.pool.query("SELECT raw,raw_sha256 FROM climate_scenario_units")
  ).rows[0];
  expect(row.raw_sha256).toBe(entry.sha256);
  expect(Buffer.compare(row.raw, Buffer.from(raw))).toBe(0);
});

test("invalid upstream data fails the tile; an administrator can retry it", async () => {
  const wrongYear = provider({
    bytes: (identity) =>
      syntheticTile(
        { ...identity, year: identity.year + 1 },
        syntheticKelvin(identity),
      ),
  });
  const store = new ScenarioStore(db.pool, wrongYear, true);
  await store.request(tile, policy, 4);
  // The provider validates responses; this fake does not, so storage does.
  const result = await store.prepare(tile, policy, options());
  expect(result.status).toBe("failed");
  expect(await status()).toMatchObject({
    status: "failed",
    error_code: "SCENARIO_UPSTREAM_INVALID",
  });
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM climate_scenario_units"))
      .rows[0].n,
  ).toBe(0);
  expect(await store.request(tile, policy, 4, true)).toBe("existing");
  expect((await status()).status).toBe("requested");
  const fixed = new ScenarioStore(db.pool, provider(), true);
  expect((await fixed.prepare(tile, policy, options())).status).toBe("ready");
});

test("transient failures are counted, a slice stops early and enough failures fail the tile", async () => {
  const flaky = provider({ fail: () => "SCENARIO_UPSTREAM_UNAVAILABLE" });
  const store = new ScenarioStore(db.pool, flaky, true);
  await store.request(tile, policy, 4);
  const slice = await store.prepare(tile, policy, options());
  expect(slice.status).toBe("preparing");
  expect(flaky.calls.length).toBeLessThanOrEqual(6);
  for (let i = 0; i < 8; i++) await store.prepare(tile, policy, options());
  expect(await status()).toMatchObject({
    status: "failed",
    error_code: "SCENARIO_UPSTREAM_UNAVAILABLE",
  });
});

test("plans may request only a few new tiles per day; administrators are not limited", async () => {
  const store = new ScenarioStore(db.pool, provider(), true);
  expect(await store.request({ latitude: 30, longitude: -8 }, policy, 2)).toBe(
    "requested",
  );
  expect(await store.request({ latitude: 31, longitude: -8 }, policy, 2)).toBe(
    "requested",
  );
  expect(await store.request({ latitude: 33, longitude: -8 }, policy, 2)).toBe(
    "limited",
  );
  expect(
    await store.request({ latitude: 33, longitude: -8 }, policy, 2, true),
  ).toBe("requested");
  expect(await store.request({ latitude: 34, longitude: -8 }, policy, 0)).toBe(
    "limited",
  );
});

test("the worker handler prepares a queued tile and queues the next slice until done", async () => {
  const store = new ScenarioStore(db.pool, provider({ latency: 120 }), true);
  await store.request(tile, policy, 4);
  const config = loadConfig({ ...db.config, SCENARIO_FETCH_CONCURRENCY: "1" });
  const handler = createScenarioHandler(store, db.boss, config, policy);
  const job = (signal) => [
    { data: { tile, policyKey: policyKey(policy) }, signal },
  ];
  // A stale job for another policy is skipped.
  await handler([
    {
      data: { tile, policyKey: policyKey(futureClimatePolicy) },
      signal: new AbortController().signal,
    },
  ]);
  expect((await status()).status).toBe("requested");
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 500);
  await handler(job(stop.signal));
  expect((await status()).status).toBe("preparing");
  const queued = await db.boss.findJobs(SCENARIO_QUEUE, {
    key: `${tile.latitude},${tile.longitude},${policyKey(policy)}`,
  });
  expect(queued.some((j) => j.state === "created")).toBe(true);
  await handler(job(new AbortController().signal));
  expect((await status()).status).toBe("ready");
});

test("extending a ready tile with a near-term window fetches only the new years and leaves the finished row alone", async () => {
  const first = provider();
  const store = new ScenarioStore(db.pool, first, true);
  await store.request(tile, policy, 4);
  await store.prepare(tile, policy, options());
  expect(first.calls).toHaveLength(16);
  const row = async (p) =>
    (
      await db.pool.query(
        "SELECT status,units_total,units_ready,completed_at,updated_at FROM climate_scenario_tiles WHERE policy_key=$1",
        [policyKey(p)],
      )
    ).rows[0];
  const finished = await row(policy);
  expect(finished.status).toBe("ready");

  // One model, one scenario, three years, four variables: 12 new units.
  const extended = {
    ...policy,
    nearTerm: {
      windows: [
        {
          experiment: "ssp585",
          firstAnchorYear: 2026,
          lastAnchorYear: 2027,
          lastDataYear: 2028,
        },
      ],
      minimumCompleteAnalogs: 1,
    },
  };
  expect(policyKey(extended)).not.toBe(policyKey(policy));
  const second = provider();
  const extension = new ScenarioStore(db.pool, second, true);
  expect(await extension.request(tile, extended, 0, true)).toBe("requested");
  expect(await extension.prepare(tile, extended, options())).toEqual({
    remaining: 0,
    status: "ready",
  });
  // The stored 16 units are recognised by identity; only the new years go out.
  expect(second.calls).toHaveLength(12);
  expect(second.calls.some((key) => first.calls.includes(key))).toBe(false);
  expect(await row(extended)).toMatchObject({
    status: "ready",
    units_total: 28,
    units_ready: 28,
  });
  // The row finished before the extension is exactly as it was.
  expect(await row(policy)).toEqual(finished);
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM climate_scenario_units"))
      .rows[0].n,
  ).toBe(28);
  // Both the old and the new units are served together for a field.
  const cell = { latitude: 32.375, longitude: -6.375 };
  const units = tileUnits(extended, tile).filter((u) => u.variable === "tas");
  const series = await extension.series({ cell, units });
  expect(series.map((s) => [s.experiment, s.year])).toEqual([
    ["historical", 2000],
    ["historical", 2001],
    ["ssp585", 2050],
    ["ssp585", 2051],
    ["ssp585", 2026],
    ["ssp585", 2027],
    ["ssp585", 2028],
  ]);
  // A repeat finds nothing to fetch.
  expect((await extension.prepare(tile, extended, options())).status).toBe(
    "skipped",
  );
});

test("partial reads verify and return only stored units; legacy reads still require all units", async () => {
  const store = new ScenarioStore(db.pool, provider(), true);
  const units = tileUnits(policy, tile);
  await store.fetchUnit(units[0], new AbortController().signal);
  const needs = { cell: { latitude: 32.125, longitude: -6.875 }, units };
  expect(await store.series(needs)).toBeNull();
  const partial = await store.series(needs, true);
  expect(partial).toHaveLength(1);
  expect(partial[0]).toMatchObject({
    model: units[0].model,
    year: units[0].year,
    variable: units[0].variable,
    synthetic: true,
  });
  expect(await store.series({ ...needs, units: units.slice(1) }, true)).toEqual(
    [],
  );
  // Corrupt raw bytes under controlled test conditions; partial does not mean unverified.
  await db.pool.query(
    `INSERT INTO climate_scenario_units(id,unit_key,model,experiment,variable,year,tile_latitude,tile_longitude,raw,raw_sha256,normalized_sha256,retrieved_at)
    VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,32,-7,$6,$7,$7,now())`,
    [
      unitKey(units[1]),
      units[1].model.id,
      units[1].experiment,
      units[1].variable,
      units[1].year,
      Buffer.from("corrupt fixture"),
      "0".repeat(64),
    ],
  );
  await expect(store.series(needs, true)).rejects.toMatchObject({
    code: "SCENARIO_STORAGE_UNAVAILABLE",
  });
});
