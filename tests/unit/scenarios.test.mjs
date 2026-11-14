import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  calendarOrdinal,
  calendarYearLength,
  modelDayOrdinal,
  futureClimatePolicySchema,
  rotationAssessmentSchema,
  scenarioCell,
  scenarioUnitSchema,
} from "../../packages/contracts/dist/index.js";
import {
  readNetcdf,
  readNumbers,
} from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/netcdf3.js";
import { normalizeScenario } from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/normalization.js";
import { scenarioUrl } from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/nex-gddp.provider.js";
import {
  policyKey,
  tileUnits,
  unitKey,
} from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
import {
  currentFutureClimatePolicy,
  futureClimatePolicy,
} from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { climatePrepareFailureCode } from "../../apps/server/dist/modules/climate-scenarios/application/failure-code.js";
import {
  assessRotationsCore,
  rotationNearTermNeedsCore,
  rotationScenarioNeedsCore,
} from "../../packages/domain/dist/rotation/assess.js";
import { scenarioWorlds } from "../../packages/domain/dist/rotation/scenario.js";
import {
  rotationCatalog,
  rotationPolicy,
  rotationRequest,
  rotationWeather,
  syntheticScenarioSeries,
} from "../support/rotation.mjs";

const directory = "docs/evidence/climate-scenarios/2026-10-17/";
const manifest = JSON.parse(readFileSync(directory + "manifest.json", "utf8"));
const model = (id) => futureClimatePolicy.models.find((m) => m.id === id);
const tile = { latitude: 32, longitude: -7 };
const recorded = [
  ["MRI-ESM2-0", "historical", "tasmax", 1988, 366],
  ["IPSL-CM6A-LR", "ssp585", "tasmin", 2052, 366],
  ["GFDL-ESM4", "ssp245", "tas", 2052, 365],
  ["UKESM1-0-LL", "historical", "tasmax", 2000, 360],
  // Time units written "days since 1850-1-1 00:00:00".
  ["MPI-ESM1-2-HR", "historical", "tasmin", 1990, 365],
].map(([id, experiment, variable, year, days]) => {
  const identity = {
    dataset: "NEX-GDDP-CMIP6",
    datasetVersion: "2.0",
    model: model(id),
    experiment,
    variable,
    year,
    tile,
  };
  const entry = manifest.responses.find(
    (r) => r.name === `nex-${id}-${experiment}-${variable}-${year}`,
  );
  return {
    identity,
    days,
    entry,
    raw: new Uint8Array(readFileSync(directory + entry.file)),
  };
});

describe("recorded NEX-GDDP-CMIP6 v2.0 tiles", () => {
  test.each(recorded.map((r) => [r.identity.model.calendar, r]))(
    "a %s tile normalizes to 16 cells in °C on the model calendar",
    (_calendar, r) => {
      expect(scenarioUrl(r.identity).href).toBe(r.entry.url);
      const { unit, synthetic } = normalizeScenario(
        r.raw,
        r.identity,
        r.entry.retrievedAt,
      );
      expect(synthetic).toBe(false);
      expect(scenarioUnitSchema.safeParse(unit).success).toBe(true);
      expect(unit.cells).toHaveLength(16);
      expect(unit.cells[0]).toEqual({ latitude: 32.125, longitude: -6.875 });
      expect(unit.cells[15]).toEqual({ latitude: 32.875, longitude: -6.125 });
      expect(unit.values.every((v) => v.length === r.days)).toBe(true);
      const all = unit.values.flat();
      expect(all.every((v) => v !== null && v > -20 && v < 55)).toBe(true);
      // Cell (32.375, -6.375) is row 1, column 2 of the tile.
      const kelvin = readNumbers(readNetcdf(r.raw), r.identity.variable);
      expect(unit.values[6][10]).toBe(
        Number((kelvin[10 * 16 + 1 * 4 + 2] - 273.15).toFixed(3)),
      );
      expect(unit.provenance).toMatchObject({
        sourceUnit: "K",
        unit: "degC",
        sourceFile: r.entry.file,
      });
    },
  );
  test("any mismatch between the request and the file is invalid evidence", () => {
    const r = recorded[0];
    const at = r.entry.retrievedAt;
    for (const change of [
      { year: 1989 },
      { experiment: "ssp245" },
      { variable: "tasmin" },
      { tile: { latitude: 33, longitude: -7 } },
      { model: { ...r.identity.model, calendar: "365_day" } },
      { model: { ...r.identity.model, variant: "r2i1p1f1" } },
      { model: model("GFDL-ESM4") },
    ])
      expect(() =>
        normalizeScenario(r.raw, { ...r.identity, ...change }, at),
      ).toThrow("SCENARIO_UPSTREAM_INVALID");
    const corrupt = (mutate) => {
      const bytes = new Uint8Array(r.raw);
      mutate(bytes);
      return () => normalizeScenario(bytes, r.identity, at);
    };
    expect(corrupt((b) => (b[0] = 0x58))).toThrow("SCENARIO_UPSTREAM_INVALID");
    expect(() =>
      normalizeScenario(r.raw.subarray(0, 5000), r.identity, at),
    ).toThrow("SCENARIO_UPSTREAM_INVALID");
    const lat = readNetcdf(r.raw).variables.get("lat");
    expect(corrupt((b) => (b[lat.begin + 7] ^= 1))).toThrow(
      "SCENARIO_UPSTREAM_INVALID",
    );
  });
  test("a tile under the policy is 1,500 requests and keys are stable", () => {
    const units = tileUnits(futureClimatePolicy, tile);
    expect(units).toHaveLength(5 * (25 + 25 + 25) * 4);
    expect(new Set(units.map(unitKey)).size).toBe(units.length);
    expect(unitKey(recorded[0].identity)).toBe(
      unitKey(structuredClone(recorded[0].identity)),
    );
  });
});

describe("model calendars and cells", () => {
  test("ordinals match the time axes of the recorded files", () => {
    expect(calendarOrdinal("360_day", 2000, 1, 1)).toBe(54000);
    expect(calendarOrdinal("365_day", 2052, 1, 1)).toBe(73730);
    expect(calendarOrdinal("proleptic_gregorian", 2051, 1, 1)).toBe(73414);
    for (const r of recorded) {
      const time = readNumbers(readNetcdf(r.raw), "time");
      const { calendar } = r.identity.model;
      // IPSL counts from 2015-01-01; the others from 1850-01-01.
      const epoch =
        r.identity.model.id === "IPSL-CM6A-LR"
          ? calendarOrdinal(calendar, 2015, 1, 1)
          : 0;
      expect(time[0]).toBe(
        calendarOrdinal(calendar, r.identity.year, 1, 1) - epoch + 0.5,
      );
      expect(time.length).toBe(calendarYearLength(calendar, r.identity.year));
    }
  });
  test("dates that a calendar lacks are absent or mapped as documented", () => {
    expect(modelDayOrdinal("365_day", "2052-02-29")).toBeNull();
    expect(modelDayOrdinal("standard", "2052-02-29")).not.toBeNull();
    expect(modelDayOrdinal("proleptic_gregorian", "2051-02-29")).toBeNull();
    // A 360-day year has no 31st: the 31st maps to the 30th.
    expect(modelDayOrdinal("360_day", "2000-05-31")).toBe(
      modelDayOrdinal("360_day", "2000-05-30"),
    );
    expect(modelDayOrdinal("360_day", "2000-02-30")).toBe(
      calendarOrdinal("360_day", 2000, 2, 30),
    );
  });
  test("a field maps to its 0.25° cell and 1° tile", () => {
    expect(scenarioCell(32.33, -6.36)).toEqual({
      cell: { latitude: 32.375, longitude: -6.375 },
      tile: { latitude: 32, longitude: -7 },
    });
    expect(scenarioCell(-0.1, 0)).toEqual({
      cell: { latitude: -0.125, longitude: 0.125 },
      tile: { latitude: -1, longitude: 0 },
    });
    expect(scenarioCell(90, 180).tile).toEqual({
      latitude: 89,
      longitude: -180,
    });
    expect(() => scenarioCell(-61, 0)).toThrow("SCENARIO_COORDINATE_INVALID");
  });
});

describe("future climate in the rotation engine", () => {
  const assessedOn = "2026-10-15";
  const weather = rotationWeather();
  const request = rotationRequest();
  const catalog = rotationCatalog();
  const needs = rotationScenarioNeedsCore(
    request,
    catalog,
    rotationPolicy,
    assessedOn,
  );
  const run = (scenarios, policy = rotationPolicy, input = request) =>
    assessRotationsCore(
      input,
      catalog,
      weather,
      policy,
      assessedOn,
      true,
      scenarios,
    );
  test("needs name the field cell and every model, window, year and variable", () => {
    expect(needs.cell).toEqual({ latitude: 32.375, longitude: -6.375 });
    expect(new Set(needs.units.map((u) => u.model.id)).size).toBe(5);
    const years = (e) => [
      ...new Set(
        needs.units.filter((u) => u.experiment === e).map((u) => u.year),
      ),
    ];
    // A 3-year horizon: anchors plus three years.
    expect(Math.min(...years("historical"))).toBe(1985);
    expect(Math.max(...years("historical"))).toBe(2007);
    expect(Math.max(...years("ssp585"))).toBe(2063);
  });
  test("identical model worlds give zero change and every world keeps the top", () => {
    const result = run(
      syntheticScenarioSeries(needs, {
        warming: { historical: 0, ssp245: 0, ssp585: 0 },
      }),
    );
    expect(result.engineVersion).toBe("rotation-engine-6");
    expect(result.futureClimate.status).toBe("compared");
    expect(result.futureClimate.worlds).toHaveLength(10);
    expect(
      result.futureClimate.worlds.every((w) => w.status === "compared"),
    ).toBe(true);
    for (const c of result.candidates)
      for (const s of c.future.scenarios) {
        expect(s.models).toHaveLength(5);
        expect(s.meanChange).toBe(0);
      }
  });
  test("warmer worlds change losses; changes and ranks are reproducible from the parts", () => {
    const result = run(syntheticScenarioSeries(needs));
    const block = result.futureClimate;
    expect(block.status).toBe("compared");
    expect(block.unitIds).toHaveLength(needs.units.length);
    expect(
      result.candidates.some((c) =>
        c.future.scenarios.some((s) => s.meanChange !== 0),
      ),
    ).toBe(true);
    for (const c of result.candidates)
      for (const s of c.future.scenarios) {
        for (const m of s.models)
          expect(m.change).toBeCloseTo(
            m.futureMeanLoss - m.baselineMeanLoss,
            10,
          );
        const mean =
          s.models.reduce((a, m) => a + m.change, 0) / s.models.length;
        expect(s.meanChange).toBeCloseTo(mean, 10);
        expect(s.minChange).toBe(Math.min(...s.models.map((m) => m.change)));
      }
    // Rank 1 in each world belongs to that world's top candidates.
    for (const world of block.worlds) {
      const ranked = result.candidates.filter((c) =>
        c.future.scenarios
          .find((s) => s.experiment === world.experiment)
          .models.some((m) => m.model === world.model && m.weightedRank === 1),
      );
      for (const c of ranked) expect(world.topCandidateIds).toContain(c.id);
    }
    const base = JSON.stringify(result.ranking.sensitivity[0].topCandidateIds);
    expect(block.topStableAcrossFutures).toBe(
      block.worlds.every((w) => JSON.stringify(w.topCandidateIds) === base),
    );
    expect(run(syntheticScenarioSeries(needs))).toEqual(result);
  });
  test("an unprepared tile or a missing unit leaves future climate unavailable, with the reason", () => {
    const missing = run(null);
    expect(missing.futureClimate).toMatchObject({
      status: "unavailable",
      reason: "SCENARIO_TILE_NOT_PREPARED",
      cell: { latitude: 32.375, longitude: -6.375 },
    });
    expect(missing.candidates.every((c) => c.future === null)).toBe(true);
    expect(
      missing.reasons.some((r) => r.code === "FUTURE_CLIMATE_UNAVAILABLE"),
    ).toBe(true);
    const partial = run(syntheticScenarioSeries(needs, { skip: 1 }));
    expect(partial.futureClimate.reason).toBe("SCENARIO_DATA_INCOMPLETE");
    // Historical results do not depend on future data.
    expect(partial.candidates.map((c) => [c.id, c.rank])).toEqual(
      missing.candidates.map((c) => [c.id, c.rank]),
    );
  });
  test("missing model values leave that world uncompared, never filled", () => {
    const series = syntheticScenarioSeries(needs);
    for (const s of series)
      if (s.model.id === "UKESM1-0-LL" && s.experiment === "ssp585")
        s.values[100] = null;
    const result = run(series);
    const ukesm = result.futureClimate.worlds.find(
      (w) => w.model === "UKESM1-0-LL" && w.experiment === "ssp585",
    );
    expect(ukesm.status).toBe("not_compared");
    const ssp585 = result.candidates[0].future.scenarios.find(
      (s) => s.experiment === "ssp585",
    );
    expect(ssp585.models.map((m) => m.model)).not.toContain("UKESM1-0-LL");
  });
  test("invalid scenario evidence is refused", () => {
    const bad = (mutate) => {
      const series = syntheticScenarioSeries(needs);
      mutate(series);
      return () => run(series);
    };
    expect(
      bad((s) => (s[0].cell = { latitude: 32.125, longitude: -6.375 })),
    ).toThrow();
    expect(bad((s) => s.push({ ...s[0] }))).toThrow();
    expect(bad((s) => s[0].values.pop())).toThrow();
    expect(
      bad((s) => (s[0].model = { ...s[0].model, calendar: "360_day" })),
    ).toThrow();
    expect(() =>
      scenarioWorlds(
        syntheticScenarioSeries(needs),
        futureClimatePolicy,
        needs.cell,
        false,
      ),
    ).toThrow("SCENARIO_SYNTHETIC_REJECTED");
    const { futureClimate, ...v1 } = {
      ...rotationPolicy,
      version: "rotation-policy-1",
    };
    expect(futureClimate).toBeDefined();
    expect(() => run(null, v1)).toThrow("ROTATION_POLICY_INVALID");
  });
  test("benchmark: 12 crops over 5 years with 30 analogs and 15 model worlds", () => {
    const input = rotationRequest({
      planning: {
        horizon_years: 5,
        earliest_start_date: "2026-10-20",
        latest_start_date: "2027-03-31",
      },
    });
    const wanted = rotationScenarioNeedsCore(
      input,
      catalog,
      rotationPolicy,
      assessedOn,
    );
    const series = syntheticScenarioSeries(wanted);
    const started = performance.now();
    const result = run(series, rotationPolicy, input);
    const seconds = (performance.now() - started) / 1000;
    const bytes = Buffer.byteLength(JSON.stringify(result));
    console.log(
      JSON.stringify({
        benchmark: "rotation-5y-12-crops-futures",
        seconds: Number(seconds.toFixed(2)),
        bytes,
        compared: result.accounting.compared,
        units: wanted.units.length,
      }),
    );
    expect(result.futureClimate.status).toBe("compared");
    expect(bytes).toBeLessThan(2097152);
    expect(seconds).toBeLessThan(60);
  });
});

describe("the near-term period", () => {
  const nearYears = { first: 2026, lastData: 2040 };
  test("the live policy extends the stored one: same units plus SSP 2026-2040, and its own key", () => {
    const old = tileUnits(futureClimatePolicy, tile);
    const live = tileUnits(currentFutureClimatePolicy, tile);
    // 5 models x 2 scenarios x 15 years x 4 variables.
    expect(live).toHaveLength(old.length + 5 * 2 * 15 * 4);
    expect(new Set(live.map(unitKey)).size).toBe(live.length);
    const oldKeys = new Set(old.map(unitKey));
    const liveKeys = new Set(live.map(unitKey));
    expect([...oldKeys].every((k) => liveKeys.has(k))).toBe(true);
    const added = live.filter((u) => !oldKeys.has(unitKey(u)));
    expect(added).toHaveLength(600);
    expect(
      added.every(
        (u) =>
          (u.experiment === "ssp245" || u.experiment === "ssp585") &&
          u.year >= nearYears.first &&
          u.year <= nearYears.lastData,
      ),
    ).toBe(true);
    // A new key means new tile rows; units themselves are shared by identity.
    expect(policyKey(currentFutureClimatePolicy)).not.toBe(
      policyKey(futureClimatePolicy),
    );
    expect(policyKey(futureClimatePolicy)).toBe(
      policyKey(structuredClone(futureClimatePolicy)),
    );
  });
  test("the policy schema accepts both policies and refuses a near-term window that overlaps mid-century", () => {
    const valid = (mutate) => {
      const p = structuredClone(currentFutureClimatePolicy);
      mutate(p);
      return futureClimatePolicySchema.safeParse(p).success;
    };
    expect(
      futureClimatePolicySchema.safeParse(currentFutureClimatePolicy).success,
    ).toBe(true);
    expect(
      futureClimatePolicySchema.safeParse(futureClimatePolicy).success,
    ).toBe(true);
    expect(valid(() => {})).toBe(true);
    expect(valid((p) => (p.nearTerm.windows[0].lastDataYear = 2041))).toBe(
      false,
    );
    expect(valid((p) => (p.nearTerm.windows[0].firstAnchorYear = 2014))).toBe(
      false,
    );
    expect(valid((p) => (p.nearTerm.minimumCompleteAnalogs = 11))).toBe(false);
    expect(valid((p) => (p.nearTerm.windows[1].experiment = "ssp245"))).toBe(
      false,
    );
    expect(valid((p) => (p.nearTerm.windows = [p.nearTerm.windows[0]]))).toBe(
      true,
    );
  });

  const assessedOn = "2026-10-15";
  const weather = rotationWeather();
  const request = rotationRequest();
  const catalog = rotationCatalog();
  const live = { ...rotationPolicy, futureClimate: currentFutureClimatePolicy };
  const midNeeds = rotationScenarioNeedsCore(
    request,
    catalog,
    live,
    assessedOn,
  );
  const nearNeeds = rotationNearTermNeedsCore(
    request,
    catalog,
    live,
    assessedOn,
  );
  const run = (scenarios, policy = live, input = request) =>
    assessRotationsCore(
      input,
      catalog,
      weather,
      policy,
      assessedOn,
      true,
      scenarios,
    );
  const mid = (opts) => syntheticScenarioSeries(midNeeds, opts);
  // Invented near-term series; ids kept apart from the mid-century ones.
  const near = (opts) =>
    syntheticScenarioSeries(nearNeeds, opts).map((s) => ({
      ...s,
      unitId: s.unitId.replace("-9000-", "-9100-"),
    }));
  test("needs: mid-century needs are exactly what the stored policy asks; near-term adds SSP years to 2038", () => {
    const stored = rotationScenarioNeedsCore(
      request,
      catalog,
      rotationPolicy,
      assessedOn,
    );
    expect(midNeeds).toEqual(stored);
    expect(
      rotationNearTermNeedsCore(request, catalog, rotationPolicy, assessedOn),
    ).toBeNull();
    const years = (e) => [
      ...new Set(
        nearNeeds.units.filter((u) => u.experiment === e).map((u) => u.year),
      ),
    ];
    // A 3-year horizon: anchors 2026-2035 plus three years.
    expect(nearNeeds.units.some((u) => u.experiment === "historical")).toBe(
      false,
    );
    expect(Math.min(...years("ssp245"))).toBe(2026);
    expect(Math.max(...years("ssp585"))).toBe(2038);
    const midKeys = new Set(midNeeds.units.map(unitKey));
    expect(nearNeeds.units.some((u) => midKeys.has(unitKey(u)))).toBe(false);
  });
  const strip = (r) => {
    const c = structuredClone(r);
    delete c.policy;
    delete c.futureClimate.nearTerm;
    return c;
  };
  test("results without near-term data keep every mid-century byte; with it only the new keys and unit ids are added", () => {
    const stored = run(mid(), rotationPolicy);
    expect("nearTerm" in stored.futureClimate).toBe(false);
    expect(
      stored.candidates.every((c) => !c.future || !("nearTerm" in c.future)),
    ).toBe(true);
    const without = run(mid());
    expect(without.futureClimate.nearTerm.status).toBe("unavailable");
    expect(strip(without)).toEqual(strip(stored));
    const withNear = run([...mid(), ...near()]);
    expect(withNear.futureClimate.nearTerm.status).toBe("compared");
    const noNear = (r) => {
      const c = strip(r);
      delete c.futureClimate.unitIds;
      for (const cand of c.candidates) delete cand.future?.nearTerm;
      return c;
    };
    expect(noNear(withNear)).toEqual(noNear(stored));
    expect(withNear.futureClimate.unitIds).toHaveLength(
      midNeeds.units.length + nearNeeds.units.length,
    );
    expect(JSON.stringify(withNear.futureClimate.worlds)).toBe(
      JSON.stringify(stored.futureClimate.worlds),
    );
  });
  test("near-term worlds compare with each model's own baseline and the result says it is not a forecast", () => {
    const result = run([
      ...mid(),
      ...near({ warming: { ssp245: 0.5, ssp585: 1 } }),
    ]);
    const block = result.futureClimate.nearTerm;
    expect(block).toMatchObject({
      status: "compared",
      reason: null,
      notAForecast: true,
      minimumCompleteAnalogs: 8,
    });
    expect(block.windows.map((w) => [w.experiment, w.firstAnchorYear])).toEqual(
      [
        ["ssp245", 2026],
        ["ssp585", 2026],
      ],
    );
    expect(block.worlds).toHaveLength(10);
    expect(block.worlds.every((w) => w.status === "compared")).toBe(true);
    expect(() => rotationAssessmentSchema.parse(result)).not.toThrow();
    let changed = false;
    for (const c of result.candidates) {
      expect(c.future.nearTerm.map((s) => s.experiment)).toEqual([
        "ssp245",
        "ssp585",
      ]);
      for (const s of c.future.nearTerm) {
        expect(s.models).toHaveLength(5);
        const midway = c.future.scenarios.find(
          (m) => m.experiment === s.experiment,
        );
        for (const m of s.models) {
          // Same baseline as mid-century; change is future minus baseline.
          expect(m.baselineMeanLoss).toBe(
            midway.models.find((x) => x.model === m.model).baselineMeanLoss,
          );
          expect(m.change).toBeCloseTo(
            m.futureMeanLoss - m.baselineMeanLoss,
            10,
          );
          changed ||= m.change !== 0;
        }
      }
    }
    expect(changed).toBe(true);
    expect(
      block.topStableAcrossFutures === true ||
        block.topStableAcrossFutures === false,
    ).toBe(true);
    // Identical worlds give almost no change. Not exactly zero: a decade holds
    // 2 leap years in 10 and the 20-year baseline 5 in 20, so a 366-day year
    // weighs a little differently.
    const flat = run([
      ...mid({ warming: { historical: 0, ssp245: 0, ssp585: 0 } }),
      ...near({ warming: { historical: 0, ssp245: 0, ssp585: 0 } }),
    ]);
    for (const c of flat.candidates)
      for (const s of c.future.nearTerm)
        expect(Math.abs(s.meanChange)).toBeLessThan(0.001);
    expect(run([...mid(), ...near()])).toEqual(run([...mid(), ...near()]));
  });
  test("a tile without near-term data degrades with its own reason while mid-century is compared", () => {
    const result = run(mid());
    expect(result.futureClimate.status).toBe("compared");
    expect(result.futureClimate.nearTerm).toMatchObject({
      status: "unavailable",
      reason: "NEAR_TERM_TILE_NOT_PREPARED",
      notAForecast: true,
      worlds: [],
    });
    expect(result.candidates.every((c) => !("nearTerm" in c.future))).toBe(
      true,
    );
    expect(() => rotationAssessmentSchema.parse(result)).not.toThrow();
    const partial = run([...mid(), ...near({ skip: 1 })]);
    expect(partial.futureClimate.status).toBe("compared");
    expect(partial.futureClimate.nearTerm.reason).toBe(
      "NEAR_TERM_DATA_INCOMPLETE",
    );
    // No mid-century either: the near-term block repeats that reason.
    const none = run(null);
    expect(none.futureClimate.nearTerm).toMatchObject({
      status: "unavailable",
      reason: "SCENARIO_TILE_NOT_PREPARED",
    });
    expect(none.candidates.every((c) => c.future === null)).toBe(true);
  });
  test("missing near-term values leave that world uncompared; none left means analogs insufficient", () => {
    const series = near();
    for (const s of series)
      if (s.model.id === "UKESM1-0-LL" && s.experiment === "ssp585")
        s.values[100] = null;
    const result = run([...mid(), ...series]);
    const block = result.futureClimate.nearTerm;
    expect(block.status).toBe("compared");
    expect(
      block.worlds.find(
        (w) => w.model === "UKESM1-0-LL" && w.experiment === "ssp585",
      ).status,
    ).toBe("not_compared");
    const all = near();
    for (const s of all) s.values[100] = null;
    const nothing = run([...mid(), ...all]);
    expect(nothing.futureClimate.status).toBe("compared");
    expect(nothing.futureClimate.nearTerm).toMatchObject({
      status: "unavailable",
      reason: "NEAR_TERM_ANALOGS_INSUFFICIENT",
    });
    expect(nothing.futureClimate.nearTerm.worlds).toHaveLength(10);
    expect(nothing.candidates.every((c) => !("nearTerm" in c.future))).toBe(
      true,
    );
  });
  test("a what-if changes the near-term worlds on top of the model's change, never the baseline", () => {
    const base = run([...mid(), ...near()]);
    const input = rotationRequest({ what_if: { temperature_change_c: 2 } });
    const hot = run([...mid(), ...near()], live, input);
    const pick = (r) => r.candidates[0].future.nearTerm[0].models[0];
    expect(pick(hot).baselineMeanLoss).toBe(pick(base).baselineMeanLoss);
    expect(pick(hot).futureMeanLoss).not.toBe(pick(base).futureMeanLoss);
  });
});

describe("field outlines", () => {
  const square = (lon, lat, d) => ({
    type: "Polygon",
    coordinates: [
      [
        [lon, lat],
        [lon + d, lat],
        [lon + d, lat + d],
        [lon, lat + d],
        [lon, lat],
      ],
    ],
  });
  test("valid outlines give area, containment and sample points inside the outline", async () => {
    const c = await import("../../packages/contracts/dist/index.js");
    const b = square(-6.36, 32.33, 0.003);
    expect(c.fieldBoundarySchema.safeParse(b).success).toBe(true);
    // 0.003° is about 282 m east-west and 334 m north-south here.
    expect(c.boundaryHectares(b)).toBeCloseTo(9.4, 1);
    const points = c.boundarySamplePoints(b);
    expect(points.length).toBeGreaterThan(50);
    expect(points.length).toBeLessThanOrEqual(100);
    expect(
      points.every((p) => c.boundaryContains(b, p.latitude, p.longitude)),
    ).toBe(true);
    expect(c.boundarySamplePoints(b)).toEqual(points);
    // Large fields keep at most 100 points.
    expect(
      c.boundarySamplePoints(square(-6.36, 32.33, 0.04)).length,
    ).toBeLessThanOrEqual(100);
  });
  test("open, repeated, self-crossing, tiny, huge or narrow outlines are refused or unsampled", async () => {
    const c = await import("../../packages/contracts/dist/index.js");
    const ok = square(-6.36, 32.33, 0.003);
    const ring = ok.coordinates[0];
    const bad = [
      { ...ok, coordinates: [ring.slice(0, -1)] },
      {
        ...ok,
        coordinates: [[ring[0], ring[1], ring[1], ring[2], ring[3], ring[0]]],
      },
      { ...ok, coordinates: [[ring[0], ring[2], ring[1], ring[3], ring[0]]] },
      square(-6.36, 32.33, 0.0002),
      square(-6.36, 32.33, 0.2),
      { ...ok, coordinates: [[[200, 0], ...ring.slice(1, -1), [200, 0]]] },
    ];
    for (const b of bad)
      expect(c.fieldBoundarySchema.safeParse(b).success).toBe(false);
    const narrow = {
      type: "Polygon",
      coordinates: [
        [
          [-6.36, 32.33],
          [-6.35, 32.33],
          [-6.35, 32.3302],
          [-6.36, 32.3302],
          [-6.36, 32.33],
        ],
      ],
    };
    expect(c.fieldBoundarySchema.safeParse(narrow).success).toBe(true);
    expect(c.boundarySamplePoints(narrow)).toEqual([]);
  });
});

describe("thermal-time stage windows (AquaCrop method 3)", () => {
  const climateModule = () =>
    import("../../packages/domain/dist/rotation/climate.js");
  const source = (tmax, tmin, days = 400) => {
    const make = (v) => new Float64Array(days).fill(v);
    return {
      series: {
        temperatureMax: make(tmax),
        temperatureMin: make(tmin),
        temperatureMean: make((tmax + tmin) / 2),
      },
      position: () => 0,
      shift: (d) => d,
    };
  };
  const rule = {
    id: "synthetic-heat",
    basis: "daily_maximum",
    medium: "air",
    stage: "flowering",
    stageWindow: {
      basis: "growing_degree_days_from_sowing",
      method: "aquacrop_method_3",
      startGdd: 100,
      endGdd: 200,
      baseDegC: 0,
      upperDegC: 26,
    },
    lowerDegC: null,
    upperDegC: 25,
  };
  const spec = (r = rule) => ({
    profile: { id: "synthetic-crop" },
    temperature: [r],
    duration: { min: 30, max: 300 },
  });
  const settings = {
    firstAnchorYear: 2000,
    lastAnchorYear: 2000,
    minimumCompleteAnalogs: 1,
    representativeStepDays: 7,
    maxClimateDayVisits: 1e7,
  };
  test("the window is the days whose cumulative growing degrees lie inside it", async () => {
    const { ClimateModel } = await climateModule();
    // Tmax 20, Tmin 0: 10 GDD a day; days 9–19 have 100–200 GDD.
    const cool = new ClimateModel(source(20, 0), settings);
    expect(cool.exposure(spec(), "2000-01-01")).toBe(0);
    // Tmax 30 is clipped to 26: (26 + 10)/2 = 18 GDD a day, so the
    // window comes earlier, and every day in it is above 25 °C.
    const hot = new ClimateModel(source(30, 10), settings);
    expect(hot.exposure(spec(), "2000-01-01")).toBe(1);
    // A minimum below Tbase is not raised (method 3): (20 + -10)/2 = 5.
    const frost = new ClimateModel(source(20, -10), settings);
    const days = frost["stageDays"](rule, spec(), 0);
    expect(days).toEqual([19, 39]);
  });
  test("an unreached stage or a missing day leaves the exposure unknown", async () => {
    const { ClimateModel } = await climateModule();
    const cold = new ClimateModel(source(1, -5), settings);
    expect(cold.exposure(spec(), "2000-01-01")).toBeNull();
    const gap = source(20, 0);
    gap.series.temperatureMin[5] = Number.NaN;
    expect(
      new ClimateModel(gap, settings).exposure(spec(), "2000-01-01"),
    ).toBeNull();
  });
});

test("a failed tile preparation names an unreachable database", () => {
  const refused = Object.assign(
    new Error("connect ECONNREFUSED 10.0.0.1:54329"),
    {
      code: "ECONNREFUSED",
    },
  );
  expect(climatePrepareFailureCode(refused)).toBe("DATABASE_UNAVAILABLE");
  expect(climatePrepareFailureCode(new Error("SCENARIO_SOURCE_FAILED"))).toBe(
    "SCENARIO_SOURCE_FAILED",
  );
  expect(climatePrepareFailureCode(new Error("unexpected detail"))).toBe(
    "CLIMATE_PREPARE_FAILED",
  );
});

describe("regional-comparison-1 candidate coverage", () => {
  const setup = async () => {
    const { assessFutures } =
      await import("../../packages/domain/dist/rotation/future.js");
    const { assessCrop, resolveContext } =
      await import("../../packages/domain/dist/rotation/evidence.js");
    const catalog = rotationCatalog({ crops: 2 });
    const request = rotationRequest({ history: { status: "unknown" } });
    const context = resolveContext(request, catalog, "2026-10-15");
    const spec = assessCrop(
      "synthetic-crop-01",
      catalog,
      request,
      context,
    ).spec;
    const policy = {
      ...currentFutureClimatePolicy,
      models: currentFutureClimatePolicy.models.slice(0, 2),
    };
    const p = { ...rotationPolicy, futureClimate: policy };
    const mid = rotationScenarioNeedsCore(request, catalog, p, "2026-10-15");
    const near = rotationNearTermNeedsCore(request, catalog, p, "2026-10-15");
    const raw = syntheticScenarioSeries({
      ...mid,
      units: [...mid.units, ...near.units],
    }).filter((s) => s.variable !== "tasmin");
    const worlds = scenarioWorlds(raw, policy, mid.cell, true).worlds;
    const timed = [
      { spec, sowEarliest: "2026-10-20", sowLatest: "2026-10-20" },
    ];
    const missing = {
      ...spec,
      temperature: [
        {
          ...spec.temperature[0],
          id: "synthetic-missing-minimum",
          basis: "daily_minimum",
        },
      ],
    };
    return {
      assessFutures,
      args: {
        candidates: [
          { id: "complete", timed, water: null, soil: null, health: 0 },
          {
            id: "missing-variable",
            timed: [{ ...timed[0], spec: missing }],
            water: null,
            soil: null,
            health: 0,
          },
          {
            id: "no-rules",
            timed: [{ ...timed[0], spec: { ...spec, temperature: [] } }],
            water: null,
            soil: null,
            health: 0,
          },
        ],
        weights: { climate: 1, water: 0, soil_health: 0, crop_health: 0 },
        baseTop: ["complete"],
        policy,
        settings: rotationPolicy,
        worlds,
        nearTerm: "available",
        unitIds: [],
        cell: mid.cell,
        climateCompared: false,
      },
    };
  };
  test("each rotation keeps its complete worlds even when other finalists or historical ranking are incomplete", async () => {
    const { assessFutures, args } = await setup();
    const result = assessFutures({ ...args, perRotation: true });
    expect(result.block.status).toBe("compared");
    expect(result.block.nearTerm.status).toBe("compared");
    expect(result.block.topStableAcrossFutures).toBeNull();
    expect(
      result.block.worlds.every(
        (w) =>
          w.comparedCandidateCount === 1 && w.notComparedCandidateCount === 2,
      ),
    ).toBe(true);
    expect(
      result.perCandidate
        .get("complete")
        .comparisons.every((c) => c.status === "compared" && c.reason === null),
    ).toBe(true);
    expect(
      result.perCandidate
        .get("missing-variable")
        .comparisons.filter((c) => c.period === "mid_century")
        .every((c) => c.reason === "FUTURE_ANALOGS_INSUFFICIENT"),
    ).toBe(true);
    expect(
      result.perCandidate
        .get("no-rules")
        .comparisons.every((c) => c.reason === "CLIMATE_NOT_COMPARED"),
    ).toBe(true);
    expect(
      result.perCandidate
        .get("no-rules")
        .scenarios.every((s) => s.models.length === 0),
    ).toBe(true);
    expect(assessFutures(args).block.reason).toBe("CLIMATE_NOT_COMPARED");
    expect(assessFutures(args).perCandidate.size).toBe(0);
  });
  test("a missing model world leaves other models and both periods usable", async () => {
    const { assessFutures, args } = await setup();
    args.worlds.delete(`${args.policy.models[0].id}|ssp245`);
    const result = assessFutures({ ...args, perRotation: true });
    const candidate = result.perCandidate.get("complete");
    expect(
      candidate.scenarios.find((s) => s.experiment === "ssp245").models,
    ).toHaveLength(1);
    expect(
      candidate.scenarios.find((s) => s.experiment === "ssp585").models,
    ).toHaveLength(2);
    expect(candidate.nearTerm.every((s) => s.models.length === 2)).toBe(true);
    expect(
      candidate.comparisons.find(
        (c) =>
          c.model === args.policy.models[0].id &&
          c.experiment === "ssp245" &&
          c.period === "mid_century",
      ).reason,
    ).toBe("SCENARIO_DATA_INCOMPLETE");
    expect(result.block.status).toBe("compared");
  });
  test("near-term comparisons survive when every mid-century world is missing", async () => {
    const { assessFutures, args } = await setup();
    for (const model of args.policy.models)
      for (const window of args.policy.futures)
        args.worlds.delete(`${model.id}|${window.experiment}`);
    const result = assessFutures({ ...args, perRotation: true });
    expect(result.block.status).toBe("unavailable");
    expect(result.block.nearTerm.status).toBe("compared");
    expect(
      result.perCandidate
        .get("complete")
        .nearTerm.every((s) => s.models.length === 2),
    ).toBe(true);
    expect(
      result.perCandidate
        .get("complete")
        .comparisons.filter((c) => c.period === "mid_century")
        .every((c) => c.reason === "SCENARIO_DATA_INCOMPLETE"),
    ).toBe(true);
  });
  test("no complete rotation never claims compared, and absent tiles have per-candidate reasons", async () => {
    const { assessFutures, args } = await setup();
    args.candidates = args.candidates.slice(1);
    const result = assessFutures({ ...args, perRotation: true });
    expect(result.block.status).toBe("unavailable");
    expect(result.block.nearTerm.status).toBe("unavailable");
    expect(result.perCandidate.size).toBe(2);
    const absent = assessFutures({
      ...args,
      perRotation: true,
      worlds: "not_prepared",
    });
    expect(
      absent.perCandidate
        .get("no-rules")
        .comparisons.every((c) => c.reason === "SCENARIO_TILE_NOT_PREPARED"),
    ).toBe(true);
  });
});

test("regional future ranks never substitute POWER water for a missing model water balance", async () => {
  const { assessFutures } =
    await import("../../packages/domain/dist/rotation/future.js");
  const { assessCrop, resolveContext } =
    await import("../../packages/domain/dist/rotation/evidence.js");
  const catalog = rotationCatalog({ crops: 2 });
  const request = rotationRequest();
  const spec = assessCrop(
    "synthetic-crop-01",
    catalog,
    request,
    resolveContext(request, catalog, "2026-10-15"),
  ).spec;
  const needs = rotationScenarioNeedsCore(
    request,
    catalog,
    rotationPolicy,
    "2026-10-15",
  );
  const worlds = scenarioWorlds(
    syntheticScenarioSeries(needs),
    rotationPolicy.futureClimate,
    needs.cell,
    true,
  ).worlds;
  const timed = [{ spec, sowEarliest: "2026-10-20", sowLatest: "2026-10-20" }];
  const result = assessFutures({
    candidates: [
      { id: "a", timed, water: 0, soil: null, health: 0 },
      { id: "b", timed, water: 1, soil: null, health: 0 },
    ],
    weights: { water: 1, climate: 0, soil_health: 0, crop_health: 0 },
    baseTop: [],
    policy: rotationPolicy.futureClimate,
    settings: rotationPolicy,
    worlds,
    unitIds: [],
    cell: needs.cell,
    climateCompared: true,
    perRotation: true,
  });
  expect(result.block.status).toBe("compared");
  expect(result.block.worlds.every((w) => w.appliedWeights.water === 0)).toBe(
    true,
  );
  expect(
    result.perCandidate
      .get("a")
      .scenarios.every((s) =>
        s.models.every(
          (m) => m.weightedRank === 1 && m.futureWaterLoss === null,
        ),
      ),
  ).toBe(true);
  expect(
    result.perCandidate
      .get("b")
      .scenarios.every((s) => s.models.every((m) => m.weightedRank === 1)),
  ).toBe(true);
});
