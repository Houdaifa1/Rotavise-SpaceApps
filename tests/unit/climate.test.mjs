import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  assessHistoricalSequences,
  measureHistoricalWindow,
  normalizedWeatherHash,
} from "../../packages/domain/dist/index.js";
import { assessHistoricalCore } from "../../packages/domain/dist/climate/assess.js";
import {
  indexWeather,
  measureWindow,
  AnalysisBudget,
  historicalLimits,
} from "../../packages/domain/dist/climate/weather.js";
import { sampleStatistics } from "../../packages/domain/dist/climate/statistics.js";
import {
  measureExposure,
  conservativeExposureLoss,
} from "../../packages/domain/dist/climate/temperature.js";
import {
  rankComparisons,
  sensitivityWeights,
  priorityWeights,
} from "../../packages/domain/dist/comparison/ranking.js";
import { shiftCalendarYears } from "../../packages/domain/dist/calendar/dates.js";
import {
  historicalAssessmentSchema,
  historicalPolicySchema,
  weatherWindowSchema,
  catalogRuleSchema,
} from "../../packages/contracts/dist/index.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { stableJson } from "../../apps/server/dist/common/serialization/stable-json.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  climateFixture,
  syntheticSnapshot,
  rehash,
  policy,
} from "../support/climate.mjs";

const run = (v = climateFixture()) =>
  assessHistoricalCore(v.input, v.catalog, v.context, v.weather, v.policy);
const index = (e) =>
  indexWeather(e, { latitude: 32.3, longitude: -6.3 }, "2029-01-01", true);
const candidate = (r) =>
  r.candidates.find(
    (c) =>
      c.pairId === "synthetic-alpha>synthetic-beta" && c.status !== "excluded",
  );
const codes = (c) => c.reasons.map((r) => r.code);
const temperature = (v, i = 0) =>
  v.catalog.profiles[i].knowledge.temperatureRequirements.rules[0];

test("legacy and v2 four-variable snapshots measure identically; new display variables cannot enter ranking without methods", () => {
  const request = {
    latitude: 32.3373,
    longitude: -6.3498,
    startDate: "2024-02-27",
    endDate: "2024-03-02",
    variables: [
      "temperatureMin",
      "temperatureMax",
      "temperatureMean",
      "precipitation",
    ],
  };
  const snapshot = normalizeNasa(
    readFileSync(
      "docs/evidence/weather/2026-09-26/nasa-power-beni-mellal-leap.json",
      "utf8",
    ),
    request,
    "2026-09-26T00:00:00Z",
    // Recorded at the exact point before adapter 3.
    "2",
  );
  const legacy = structuredClone(snapshot);
  legacy.provenance.adapterVersion = "1";
  legacy.provenance.attribution =
    "NASA Langley Research Center POWER Project; MERRA-2; https://power.larc.nasa.gov/";
  const record = (s) => ({
    snapshotId: "00000000-0000-4000-8000-000000000001",
    synthetic: false,
    normalizedSha256: normalizedWeatherHash(s),
    snapshot: s,
  });
  const input = {
    location: { latitude: request.latitude, longitude: request.longitude },
    assessedOn: "2026-09-27",
    startDate: request.startDate,
    endDate: request.endDate,
  };
  expect(measureHistoricalWindow(input, [record(snapshot)])).toEqual(
    measureHistoricalWindow(input, [record(legacy)]),
  );
  const expanded = normalizeNasa(
    readFileSync(
      "docs/evidence/weather/2026-09-27/nasa-power-expanded.json",
      "utf8",
    ),
    {
      ...request,
      variables: [
        ...request.variables,
        "relativeHumidity",
        "windSpeed",
        "solarRadiation",
      ],
    },
    "2026-09-27T00:00:00Z",
    "2",
  );
  expect(() => measureHistoricalWindow(input, [record(expanded)])).toThrow(
    "CLIMATE_UNSUPPORTED_VARIABLE",
  );
});
function freeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test("synthetic fixtures stay explicit; full engine produces comparisons, preserves excluded schedules and selected choices", () => {
  const r = run();
  expect(r.synthetic).toBe(true);
  expect(r.outcome).toBe("comparisons_available");
  expect(r.recommendations).toBeNull();
  expect(r.candidates).toHaveLength(r.sequence.counts.schedules);
  expect(r.sequence.consideredChoices[0].cropId).toBe("synthetic-alpha");
  const excluded = r.candidates
    .filter((c) => c.status === "excluded")
    .map((c) => c.scheduleId);
  expect(excluded.length).toBeGreaterThan(0);
  expect(
    r.ranking.groups
      .flatMap((g) => g.entries)
      .some((e) => excluded.includes(e.scheduleId)),
  ).toBe(false);
  expect(
    r.ranking.unranked.filter((e) => excluded.includes(e.scheduleId)),
  ).toHaveLength(excluded.length);
});
test("public entry rejects synthetic catalog and nested flags", () => {
  const v = climateFixture();
  expect(() =>
    assessHistoricalSequences(
      v.input,
      v.catalog,
      v.context,
      v.weather,
      v.policy,
    ),
  ).toThrow("CATALOG_SYNTHETIC_REJECTED");
  v.catalog.synthetic = false;
  expect(() =>
    assessHistoricalSequences(
      v.input,
      v.catalog,
      v.context,
      v.weather,
      v.policy,
    ),
  ).toThrow("CATALOG_SYNTHETIC_REJECTED");
});
test("public weather measurement and default weather index reject labeled synthetic snapshots", () => {
  const v = climateFixture();
  expect(() =>
    indexWeather(v.weather, v.input.location, v.context.assessedOn),
  ).toThrow("CLIMATE_SYNTHETIC_REJECTED");
  expect(() =>
    measureHistoricalWindow(
      {
        location: v.input.location,
        assessedOn: "2029-01-01",
        startDate: "2010-12-30",
        endDate: "2010-12-31",
      },
      v.weather,
    ),
  ).toThrow("CLIMATE_SYNTHETIC_REJECTED");
});
test("normalized content identity agrees independently with persisted server SHA-256 and ignores object-key order", () => {
  const e = climateFixture().weather[0];
  expect(e.normalizedSha256).toBe(
    createHash("sha256").update(stableJson(e.snapshot)).digest("hex"),
  );
  const reversed = Object.fromEntries(Object.entries(e.snapshot).reverse());
  expect(normalizedWeatherHash(reversed)).toBe(e.normalizedSha256);
});
test.each([
  [
    "hash",
    (e) => (e.snapshot.days[0].values.precipitation = 3),
    "CLIMATE_HASH_MISMATCH",
    false,
  ],
  [
    "location",
    (e) => (e.snapshot.request.latitude = 32.4),
    "CLIMATE_LOCATION_MISMATCH",
    true,
  ],
  [
    "response location",
    (e) => (e.snapshot.provenance.responseCoordinates[0] = 0),
    "CLIMATE_PROVENANCE_MISMATCH",
    true,
  ],
  [
    "parameter",
    (e) => (e.snapshot.provenance.variables[0].parameter = "UNRELATED"),
    "CLIMATE_EVIDENCE_INVALID",
    true,
  ],
  [
    "source unit",
    (e) => (e.snapshot.provenance.variables[0].sourceUnit = "F"),
    "CLIMATE_EVIDENCE_INVALID",
    true,
  ],
  [
    "negative rain",
    (e) => (e.snapshot.days[0].values.precipitation = -1),
    "CLIMATE_EVIDENCE_INVALID",
    true,
  ],
  [
    "temperature order",
    (e) => (e.snapshot.days[0].values.temperatureMin = 30),
    "CLIMATE_PHYSICAL_VALUE_INVALID",
    true,
  ],
  [
    "temperature mean",
    (e) => (e.snapshot.days[0].values.temperatureMean = 30),
    "CLIMATE_PHYSICAL_VALUE_INVALID",
    true,
  ],
  [
    "unreviewed source",
    (e) => (e.snapshot.provenance.sources = ["GEOS"]),
    "CLIMATE_EVIDENCE_INVALID",
    true,
  ],
  [
    "future retrieval",
    (e) => (e.snapshot.provenance.retrievedAt = "2030-01-01T00:00:00Z"),
    "CLIMATE_RETRIEVAL_DATE_INVALID",
    true,
  ],
])("rejects %s evidence", (_, mutate, code, refresh) => {
  const evidence = [climateFixture().weather[0]];
  mutate(evidence[0]);
  if (refresh) rehash(evidence);
  expect(() => index(evidence)).toThrow(code);
});
test("temperature mean rounding tolerance matches existing adapter without accepting larger violations", () => {
  const e = syntheticSnapshot("2010-01-01", "2010-01-01", 1, () => ({
    temperatureMin: 5,
    temperatureMax: 22,
    temperatureMean: 22.005,
    precipitation: 0,
  }));
  expect(() => index([e])).not.toThrow();
});
test.each(["apiVersion", "responseCoordinates", "variables"])(
  "rejects incompatible %s across snapshots",
  (field) => {
    const v = climateFixture();
    if (field === "apiVersion")
      v.weather[1].snapshot.provenance.apiVersion = "changed";
    if (field === "responseCoordinates")
      v.weather[1].snapshot.provenance.responseCoordinates[2] = 600;
    if (field === "variables")
      v.weather[1].snapshot.provenance.variables[0].definition =
        "Changed measurement basis";
    rehash(v.weather);
    expect(() => index(v.weather)).toThrow(
      field === "variables"
        ? "CLIMATE_EVIDENCE_INVALID"
        : "CLIMATE_PROVENANCE_MISMATCH",
    );
  },
);
test("duplicate snapshot identity and conflicting overlaps are rejected", () => {
  const a = syntheticSnapshot("2010-01-01", "2010-01-03", 1);
  expect(() => index([a, structuredClone(a)])).toThrow(
    "CLIMATE_DUPLICATE_SNAPSHOT",
  );
  const b = syntheticSnapshot("2010-01-03", "2010-01-05", 2, () => ({
    temperatureMin: 5,
    temperatureMax: 22,
    temperatureMean: 12,
    precipitation: 1,
  }));
  expect(() => index([a, b])).toThrow("CLIMATE_OVERLAP_CONFLICT");
});
test("equal overlapping observations count once and retain both identities", () => {
  const a = syntheticSnapshot("2010-01-01", "2010-01-03", 1);
  const b = syntheticSnapshot("2010-01-03", "2010-01-05", 2);
  const w = measureWindow(index([b, a]), "2010-01-01", "2010-01-05");
  expect(w.expectedDays).toBe(5);
  expect(
    w.coverage.every((c) => c.observedDays === 5 && c.snapshotIds.length === 2),
  ).toBe(true);
});
test("a partial null cannot be silently replaced by an overlapping non-null observation", () => {
  const a = syntheticSnapshot("2010-01-01", "2010-01-01", 1, () => ({
    temperatureMin: 5,
    temperatureMax: 22,
    temperatureMean: 12,
    precipitation: null,
  }));
  const b = syntheticSnapshot("2010-01-01", "2010-01-01", 2);
  expect(() => index([a, b])).toThrow("CLIMATE_OVERLAP_CONFLICT");
});
test("per-variable shards merge only with compatible provenance and all variables remain separately covered", () => {
  const a = syntheticSnapshot("2010-01-01", "2010-01-03", 1, undefined, [
    "precipitation",
  ]);
  const b = syntheticSnapshot("2010-01-01", "2010-01-03", 2, undefined, [
    "temperatureMin",
    "temperatureMax",
    "temperatureMean",
  ]);
  const w = measureWindow(index([a, b]), "2010-01-01", "2010-01-03");
  expect(
    w.coverage.every((c) => c.observedDays === 3 && c.snapshotIds.length === 1),
  ).toBe(true);
  expect(w.metrics.precipitation.totalMm).toBe(0);
});
test("rain arithmetic and 1 mm boundary match independent hand-calculated totals/runs", () => {
  const rain = [0, 0.99, 1, 0, 0, 2, 0];
  const e = syntheticSnapshot("2010-01-01", "2010-01-07", 1, (_, i) => ({
    temperatureMin: 5 + i,
    temperatureMax: 22 + i,
    temperatureMean: 12 + i,
    precipitation: rain[i],
  }));
  const w = measureWindow(index([e]), "2010-01-01", "2010-01-07");
  expect(w.metrics.precipitation).toEqual({
    totalMm: 3.99,
    meanMmPerDay: 3.99 / 7,
    dryDays: 5,
    longestDrySpellDays: 2,
  });
  expect(w.metrics.temperatureMean).toEqual({
    min: 12,
    max: 18,
    mean: 15,
    unit: "degC",
  });
});
test("a dry spell is clipped to the assessed window and not joined across field gaps", () => {
  const e = syntheticSnapshot("2010-01-01", "2010-01-10");
  expect(
    measureWindow(index([e]), "2010-01-04", "2010-01-06").metrics.precipitation
      .longestDrySpellDays,
  ).toBe(3);
});
test("missing rain invalidates rain totals/runs while complete temperature remains available", () => {
  const e = syntheticSnapshot("2010-01-01", "2010-01-03", 1, (_, i) => ({
    temperatureMin: 5,
    temperatureMax: 22,
    temperatureMean: 12,
    precipitation: i === 1 ? null : 0,
  }));
  const w = measureWindow(index([e]), "2010-01-01", "2010-01-03");
  expect(w.metrics.precipitation).toBeNull();
  expect(w.metrics.temperatureMean.mean).toBe(12);
  expect(
    w.coverage.find((c) => c.variable === "precipitation").missingDates,
  ).toEqual(["2010-01-02"]);
});
test("wholly absent weather/variables remain null with exact missing dates", () => {
  const w = measureWindow(index([]), "2012-02-28", "2012-03-01");
  expect(w.expectedDays).toBe(3);
  expect(
    w.coverage.every(
      (c) => c.observedDays === 0 && c.missingDates.includes("2012-02-29"),
    ),
  ).toBe(true);
  expect(Object.values(w.metrics).every((v) => v === null)).toBe(true);
});
test("runtime coverage validation rejects a fabricated total or coverage count", () => {
  const w = measureWindow(index([]), "2012-02-28", "2012-03-01");
  w.metrics.precipitation = {
    totalMm: 0,
    meanMmPerDay: 0,
    dryDays: 0,
    longestDrySpellDays: 0,
  };
  expect(weatherWindowSchema.safeParse(w).success).toBe(false);
  w.metrics.precipitation = null;
  w.coverage[0].observedDays = 1;
  expect(weatherWindowSchema.safeParse(w).success).toBe(false);
});
test.each([
  { firstAnchorYear: 2015, lastAnchorYear: 2010 },
  { splitAfterYear: 2015 },
  { minimumPeriodAnalogs: 4 },
  { minimumCompleteAnalogs: 7 },
  { firstAnchorYear: 1980 },
  { lastAnchorYear: 2060 },
  { extra: true },
])("baseline policy rejects %j", (patch) =>
  expect(
    historicalPolicySchema.safeParse({ ...policy, ...patch }).success,
  ).toBe(false),
);
test("complete cross-year analogs retain consecutive years, both harvest endpoints and explicit variation", () => {
  const c = candidate(run());
  expect(c.completeAnchorYears).toEqual([2010, 2011, 2012, 2013, 2014, 2015]);
  expect(c.analogs[0].cycles[0].earliest.startDate).toBe("2010-12-30");
  expect(c.analogs[0].cycles[1].latest.startDate).toBe("2011-01-04");
  expect(c.analogs[0].cycles[1].latest.endDate).toBe("2011-01-06");
  expect(c.periodComparison.laterMinusEarlier[0].temperatureMeanDegC).toBe(3);
  expect(
    c.variability[0].temperatureMeanDegC.populationStandardDeviation,
  ).toBeCloseTo(Math.sqrt(35 / 12), 12);
});
test("exact leap shift rejects Feb 29 instead of clamping and preserves other boundaries", () => {
  expect(() => shiftCalendarYears("2028-02-29", -1)).toThrow();
  expect(shiftCalendarYears("2028-03-01", -1)).toBe("2027-03-01");
});
test("full engine excludes non-leap analogs without changing Feb 29 sowing or pairing unrelated years", () => {
  const v = climateFixture();
  v.catalog.profiles = v.catalog.profiles.slice(0, 2);
  v.context.cultivars = v.context.cultivars.slice(0, 2);
  v.context.assessedOn = "2028-01-01";
  v.input.soil.observations[0].measured_on = "2027-01-01";
  v.input.planning = {
    cycles: 2,
    earliest_start_date: "2028-02-29",
    latest_start_date: "2028-02-29",
    search_end_date: "2028-03-10",
  };
  for (const [i, p] of v.catalog.profiles.entries()) {
    const window = p.knowledge.plantingWindows.rules[0];
    window.start = i === 0 ? "02-29" : "03-04";
    window.end = i === 0 ? "02-29" : "03-05";
    p.knowledge.plantingWindows.rules = [window];
  }
  v.weather = [syntheticSnapshot("2012-02-27", "2012-03-10")];
  const c = candidate(run(v));
  expect(
    c.analogs
      .filter((a) => a.status === "leap_boundary_unavailable")
      .map((a) => a.anchorYear),
  ).toEqual([2010, 2011, 2013, 2014, 2015]);
  expect(c.completeAnchorYears).toEqual([2012]);
  expect(
    c.analogs.find((a) => a.anchorYear === 2012).cycles[0].earliest.startDate,
  ).toBe("2012-02-29");
  expect(codes(c)).toContain("LEAP_BOUNDARY_UNAVAILABLE");
});
test("a missing year is omitted as a whole analog with explicit counts; it is never filled by another year", () => {
  const v = climateFixture();
  v.weather.splice(1, 1);
  const c = candidate(run(v));
  expect(c.completeAnchorYears).toEqual([2010, 2012, 2013, 2014, 2015]);
  expect(c.analogs.find((a) => a.anchorYear === 2011).status).toBe(
    "incomplete",
  );
  expect(c.periodComparison.earlierAnchorYears).toEqual([2010, 2012]);
});
test("missing complete or period evidence returns null statistics/differences and no invented rank", () => {
  const v = climateFixture();
  v.weather = v.weather.slice(0, 2);
  const r = run(v),
    c = candidate(r);
  expect(c.variability[0].rainfallMm).toBeNull();
  expect(
    c.periodComparison.laterMinusEarlier[0].temperatureMeanDegC,
  ).toBeNull();
  expect(codes(c)).toContain("INSUFFICIENT_COMPLETE_ANALOGS");
  expect(r.ranking.groups).toHaveLength(0);
});
test("whole-cycle temperature counts strict boundary violations using the correct daily variable", () => {
  const v = climateFixture(),
    rule = temperature(v);
  rule.min = 10;
  rule.max = 20;
  const e = syntheticSnapshot("2010-01-01", "2010-01-04", 1, (_, i) => ({
    temperatureMin: 0,
    temperatureMax: [10, 20, 21, 9][i],
    temperatureMean: 1,
    precipitation: 0,
  }));
  const m = measureExposure(
    index([e]),
    rule,
    "2010-01-01",
    "2010-01-04",
    "latest",
  );
  expect(m.belowDays).toBe(1);
  expect(m.aboveDays).toBe(1);
  expect(m.outsideFraction).toBe(0.5);
});
test("missing exposure is null instead of zero; conservative duration loss uses the worse endpoint", () => {
  const v = climateFixture(),
    rule = temperature(v);
  rule.max = 20;
  const e = syntheticSnapshot("2010-01-01", "2010-01-04", 1, (_, i) => ({
    temperatureMin: 5,
    temperatureMax: i === 3 ? null : i === 0 ? 30 : 15,
    temperatureMean: 12,
    precipitation: 0,
  }));
  const a = measureExposure(
    index([e]),
    rule,
    "2010-01-01",
    "2010-01-02",
    "earliest",
  );
  const b = measureExposure(
    index([e]),
    rule,
    "2010-01-01",
    "2010-01-03",
    "latest",
  );
  expect(conservativeExposureLoss([a, b])).toBe(0.5);
  expect(
    measureExposure(index([e]), rule, "2010-01-01", "2010-01-04", "latest")
      .outsideFraction,
  ).toBeNull();
});
test.each([
  { medium: "soil" },
  { timeBasis: "instantaneous" },
  { timeBasis: "stage_mean" },
  { stage: "flowering" },
  { severity: "reference" },
  { reviewStatus: "research" },
  {
    executionScope: {
      cultivarId: "synthetic-alpha-cultivar",
      conditionsStatus: "unresolved",
    },
  },
])(
  "unsupported/unreviewed temperature %j cannot influence a score",
  (patch) => {
    const v = climateFixture();
    Object.assign(temperature(v), patch);
    const r = run(v),
      c = candidate(r);
    expect(
      codes(c).some(
        (c) =>
          c === "TEMPERATURE_RULE_UNSUPPORTED" ||
          c === "TEMPERATURE_RULE_UNREVIEWED",
      ),
    ).toBe(true);
    expect(
      r.ranking.groups
        .flatMap((g) => g.entries)
        .some((e) => e.scheduleId === c.scheduleId),
    ).toBe(false);
  },
);
test("reviewed stage offsets measure exactly their window and remain traceable", () => {
  const v = climateFixture();
  Object.assign(temperature(v), {
    stage: "flowering",
    stageWindow: { basis: "elapsed_days_from_sowing", startDay: 0, endDay: 1 },
  });
  const c = candidate(run(v)),
    e = c.analogs[0].cycles[0].exposures[0];
  expect(e.horizon).toBe("stage");
  expect(e.startDate).toBe("2010-12-30");
  expect(e.endDate).toBe("2010-12-31");
  expect(e.citations[0].sourceId).toBe("synthetic-source");
});
test("stages extending beyond the earliest harvest are unsupported and malformed stage bounds fail validation", () => {
  const v = climateFixture();
  Object.assign(temperature(v), {
    stage: "flowering",
    stageWindow: { basis: "elapsed_days_from_sowing", startDay: 0, endDay: 2 },
  });
  expect(codes(candidate(run(v)))).toContain("TEMPERATURE_RULE_UNSUPPORTED");
  temperature(v).stageWindow = {
    basis: "elapsed_days_from_sowing",
    startDay: 2,
    endDay: 1,
  };
  expect(catalogRuleSchema.safeParse(temperature(v)).success).toBe(false);
});
test("ambiguous duplicate temperature windows cannot be cherry-picked or averaged into a score", () => {
  const v = climateFixture(),
    r = structuredClone(temperature(v));
  r.id = "synthetic-conflicting-temperature";
  r.max = 30;
  v.catalog.profiles[0].knowledge.temperatureRequirements.rules.push(r);
  expect(codes(candidate(run(v)))).toContain("TEMPERATURE_RULE_AMBIGUOUS");
});
test("water stays an ordinal sourced comparison and irrigation adequacy remains unknown for every availability", () => {
  const v = climateFixture(),
    r = run(v),
    c = candidate(r);
  expect(c.water.classes).toEqual(["low", "high"]);
  expect(c.water.ordinalLoss).toBe(0.5);
  expect(c.water.irrigationAdequacy).toBe("unknown");
  expect(c.water.reportedAvailability).toBe("rainfed");
  expect(c.rotation.preferredTransitions).toBe(2);
  expect(c.rotation.claim).toBe("sourced_family_transition_proxy_only");
});
test.each(["unknown", "reference", "research", "different_method"])(
  "water %s blocks affected rankings",
  (kind) => {
    const v = climateFixture(),
      p = v.catalog.profiles[0];
    if (kind === "unknown")
      p.knowledge.waterDemandClass = {
        status: "unknown",
        reason: "Synthetic missing evidence",
      };
    else if (kind === "reference")
      p.knowledge.waterDemandClass.rules[0].severity = "reference";
    else if (kind === "research")
      p.knowledge.waterDemandClass.rules[0].reviewStatus = "research";
    else
      p.knowledge.waterDemandClass.rules[0].comparisonMethod =
        "Another incomparable synthetic method";
    const r = run(v),
      c = candidate(r);
    expect(c.water.ordinalLoss).toBeNull();
    expect(
      r.ranking.groups
        .flatMap((g) => g.entries)
        .some((e) => e.scheduleId === c.scheduleId),
    ).toBe(false);
  },
);
test("unknown history cannot earn a favorable soil-health proxy", () => {
  const v = climateFixture();
  v.input.history = { status: "unknown" };
  v.context.historyCoverageStart = null;
  const c = candidate(run(v));
  expect(c.rotation.ordinalLoss).toBeNull();
  expect(codes(c)).toContain("ROTATION_PROXY_UNAVAILABLE");
});
test("farmer priorities actually change documented weights and preferred crop pairs", () => {
  const v = climateFixture(),
    soil = run(v);
  v.input.preferences.priority = "lower_water_demand";
  const water = run(v);
  const soilBest = soil.ranking.groups[0].entries
    .filter((e) => e.rank === 1)
    .map((e) => e.scheduleId.split("@")[0]);
  const waterBest = water.ranking.groups[0].entries
    .filter((e) => e.rank === 1)
    .map((e) => e.scheduleId.split("@")[0]);
  expect(new Set(soilBest)).toEqual(
    new Set(["synthetic-alpha>synthetic-beta"]),
  );
  expect(waterBest).toContain("synthetic-alpha>synthetic-gamma");
  expect(waterBest).not.toContain("synthetic-alpha>synthetic-beta");
  expect(soil.ranking.weights).toEqual(priorityWeights.soil_health);
  expect(water.ranking.weights).toEqual(priorityWeights.lower_water_demand);
});
test("ties share competition rank and every equal option is reported", () => {
  const g = run().ranking.groups[0],
    best = g.entries.filter((e) => e.rank === 1);
  expect(best.length).toBeGreaterThan(1);
  expect(best.every((e) => e.tiedWith.length === best.length - 1)).toBe(true);
  expect(g.sensitivity).toHaveLength(7);
});
test("ranking sensitivity checks weight transfers and exposes a winner change", () => {
  const r = run(),
    base = structuredClone(candidate(r));
  const members = [
    {
      candidate: {
        ...base,
        scheduleId: "synthetic-a",
        water: { ...base.water, ordinalLoss: 0 },
        rotation: { ...base.rotation, ordinalLoss: 1 },
      },
      signature: "same-basis",
    },
    {
      candidate: {
        ...base,
        scheduleId: "synthetic-b",
        water: { ...base.water, ordinalLoss: 0.4 },
        rotation: { ...base.rotation, ordinalLoss: 0 },
      },
      signature: "same-basis",
    },
  ];
  const ranked = rankComparisons(
    members,
    "lower_water_demand",
    policy,
    new AnalysisBudget(),
  );
  expect(ranked.groups[0].sensitive).toBe(true);
  expect(sensitivityWeights(priorityWeights.lower_water_demand)).toHaveLength(
    7,
  );
});
test("lower-ranked tie changes count as sensitivity even with an unchanged winner", () => {
  const base = structuredClone(candidate(run()));
  const members = [
    {
      candidate: {
        ...base,
        scheduleId: "synthetic-best",
        water: { ...base.water, ordinalLoss: 0 },
        rotation: { ...base.rotation, ordinalLoss: 0 },
      },
      signature: "same",
    },
    {
      candidate: {
        ...base,
        scheduleId: "synthetic-next-a",
        water: { ...base.water, ordinalLoss: 0.1 },
        rotation: { ...base.rotation, ordinalLoss: 1 },
      },
      signature: "same",
    },
    {
      candidate: {
        ...base,
        scheduleId: "synthetic-next-b",
        water: { ...base.water, ordinalLoss: 0.4 },
        rotation: { ...base.rotation, ordinalLoss: 0 },
      },
      signature: "same",
    },
  ];
  const group = rankComparisons(
    members,
    "lower_water_demand",
    policy,
    new AnalysisBudget(),
  ).groups[0];
  expect(group.sensitive).toBe(true);
  expect(group.topSensitive).toBe(false);
});
test("common complete years are intersected before scores; inadequate shared evidence prevents comparison", () => {
  const base = structuredClone(candidate(run()));
  const a = { ...structuredClone(base), scheduleId: "synthetic-a" };
  const b = { ...structuredClone(base), scheduleId: "synthetic-b" };
  a.analogs.find((y) => y.anchorYear === 2010).status = "incomplete";
  b.analogs.find((y) => y.anchorYear === 2011).status = "incomplete";
  const ranking = rankComparisons(
    [
      { candidate: a, signature: "same" },
      { candidate: b, signature: "same" },
    ],
    "soil_health",
    policy,
    new AnalysisBudget(),
  );
  expect(ranking.groups).toHaveLength(0);
  expect(
    ranking.unranked.every((e) =>
      e.reasonCodes.includes("INSUFFICIENT_SHARED_ANALOGS"),
    ),
  ).toBe(true);
});
test("different measurement signatures form separate groups without a global winner", () => {
  const base = candidate(run());
  const ranking = rankComparisons(
    [
      { candidate: { ...base, scheduleId: "a" }, signature: "daily_minimum" },
      { candidate: { ...base, scheduleId: "b" }, signature: "daily_maximum" },
    ],
    "soil_health",
    policy,
    new AnalysisBudget(),
  );
  expect(ranking.groups).toHaveLength(2);
  expect(ranking.groups.every((g) => g.entries.length === 1)).toBe(true);
});
test("independent population arithmetic: [1,2,3,4] mean 2.5 and deviation sqrt(1.25)", () => {
  expect(sampleStatistics([1, 2, 3, 4])).toEqual({
    count: 4,
    min: 1,
    max: 4,
    mean: 2.5,
    populationStandardDeviation: Math.sqrt(1.25),
  });
  expect(sampleStatistics([])).toBeNull();
});
test("input/evidence order permutations are deterministic and frozen inputs are not mutated", () => {
  const v = climateFixture(),
    first = run(freeze(structuredClone(v)));
  const before = JSON.stringify(v);
  expect(JSON.stringify(run(v))).toBe(JSON.stringify(first));
  expect(JSON.stringify(v)).toBe(before);
  v.weather.reverse();
  v.catalog.profiles.reverse();
  v.context.cultivars.reverse();
  expect(JSON.stringify(run(v))).toBe(JSON.stringify(first));
});
test("explanations refer to actual rules, source identities, input paths and weather snapshot evidence", () => {
  const r = run(),
    c = candidate(r),
    reason = c.reasons.find((r) => r.code === "TEMPERATURE_EXPOSURE");
  expect(reason.ruleIds).toContain("synthetic-alpha-temperature");
  expect(reason.citations[0].sourceId).toBe("synthetic-source");
  expect(
    reason.snapshotIds.every((id) =>
      r.evidence.some((e) => e.snapshotId === id),
    ),
  ).toBe(true);
  expect(
    c.reasons.find((r) => r.code === "WATER_CLASS_COMPARISON").inputPaths,
  ).toContain("input.preferences.priority");
});
test("bounds fail explicitly instead of returning partial results", () => {
  const budget = new AnalysisBudget();
  expect(() => budget.visit(historicalLimits.variableDayVisits + 1)).toThrow(
    "CLIMATE_WORK_LIMIT",
  );
  expect(() =>
    new AnalysisBudget().consume("x".repeat(historicalLimits.outputBytes)),
  ).toThrow("CLIMATE_OUTPUT_LIMIT");
  const e = syntheticSnapshot("2010-01-01", "2010-12-31");
  const many = Array.from({ length: 55 }, (_, i) => ({
    ...structuredClone(e),
    snapshotId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  }));
  expect(() => index(many)).toThrow("CLIMATE_SNAPSHOT_DAY_LIMIT");
});
test("real recorded NASA body is hashed/normalized and measured without synthetic weather", () => {
  const metadata = JSON.parse(
    readFileSync("docs/evidence/weather/2026-09-26/manifest.json", "utf8"),
  ).find(
    (m) => m.provider === "nasa-power" && m.sample.name === "beni-mellal-leap",
  );
  const raw = readFileSync(
    `docs/evidence/weather/2026-09-26/${metadata.file}`,
    "utf8",
  );
  expect(createHash("sha256").update(raw).digest("hex")).toBe(metadata.sha256);
  const request = {
    latitude: metadata.sample.latitude,
    longitude: metadata.sample.longitude,
    startDate: metadata.sample.start,
    endDate: metadata.sample.end,
    variables: [
      "temperatureMin",
      "temperatureMax",
      "temperatureMean",
      "precipitation",
    ],
  };
  // Recorded at the exact point before adapter 3.
  const snapshot = normalizeNasa(raw, request, metadata.retrievedAt, "2");
  const evidence = [
    {
      snapshotId: "00000000-0000-4000-8000-000000000001",
      normalizedSha256: normalizedWeatherHash(snapshot),
      synthetic: false,
      snapshot,
    },
  ];
  const result = measureHistoricalWindow(
    {
      location: { latitude: request.latitude, longitude: request.longitude },
      assessedOn: "2026-09-27",
      startDate: request.startDate,
      endDate: request.endDate,
    },
    evidence,
  );
  expect(result.expectedDays).toBe(5);
  expect(result.metrics.precipitation).not.toBeNull();
});
test("real catalog returns explicit evidence gaps and no fabricated comparison", async () => {
  const v = climateFixture(),
    catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  v.input.preferences.considered_next_crop_ids = [
    "durum-wheat",
    "unsupported-crop",
  ];
  v.context.region = { status: "unresolved" };
  v.context.productionSystem = null;
  v.context.cultivars = [];
  const r = assessHistoricalSequences(
    v.input,
    catalog,
    v.context,
    [],
    v.policy,
  );
  expect(r.synthetic).toBe(false);
  expect(r.candidates).toHaveLength(0);
  expect(r.outcome).toBe("insufficient_evidence");
  expect(r.sequence.catalog.sha256).toBe(
    "d951b9c07b03739a77d43d0518c68ebc13b80d805fa58dcd076ef9cd82ed3a55",
  );
});
test("strict output contract accepts full generated result", () =>
  expect(historicalAssessmentSchema.safeParse(run()).success).toBe(true));
test.each([
  [
    "weather completion",
    (r) => (candidate(r).analogs[0].status = "incomplete"),
  ],
  ["analog loss", (r) => (candidate(r).analogs[0].climateLoss = 1)],
  ["omitted analog", (r) => candidate(r).analogs.pop()],
  [
    "invented evidence",
    (r) =>
      (candidate(r).analogs[0].cycles[0].earliest.coverage[0].snapshotIds = [
        "00000000-0000-4000-8000-999999999999",
      ]),
  ],
  ["missing candidate", (r) => r.candidates.pop()],
  ["wrong rank", (r) => (r.ranking.groups[0].entries[0].rank = 99)],
  [
    "wrong sensitivity",
    (r) => (r.ranking.groups[0].sensitivity[0].topScheduleIds = []),
  ],
  ["synthetic laundering", (r) => (r.synthetic = false)],
  [
    "wrong exposure",
    (r) => (candidate(r).analogs[0].cycles[0].exposures[0].aboveDays = 99),
  ],
])("strict output rejects %s tampering", (_, mutate) => {
  const r = run();
  mutate(r);
  expect(historicalAssessmentSchema.safeParse(r).success).toBe(false);
});
test("complete assessment calculates without reading current time", () => {
  const v = climateFixture(),
    original = Date.now;
  try {
    Date.now = () => {
      throw new Error("CLOCK_READ");
    };
    expect(run(v).outcome).toBe("comparisons_available");
  } finally {
    Date.now = original;
  }
});
test("packaged public engine imports transitively without Node builtins and calculates without ambient clock", () => {
  const code = `import {registerHooks} from 'node:module';registerHooks({resolve(s,c,next){if(s.startsWith('node:'))throw Error('NODE_IMPORT');return next(s,c)}});const m=await import('./packages/domain/dist/index.js');Date.now=()=>{throw Error('CLOCK_READ')};const result=m.measureHistoricalWindow({location:{latitude:32.3,longitude:-6.3},assessedOn:'2029-01-01',startDate:'2010-01-01',endDate:'2010-01-02'},[]);if(result.expectedDays!==2)throw Error('BAD_RESULT');`;
  expect(() =>
    execFileSync(process.execPath, ["--input-type=module", "--eval", code], {
      stdio: "pipe",
    }),
  ).not.toThrow();
});
