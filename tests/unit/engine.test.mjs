import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";
import {
  generateSequences,
  sequenceLimits,
} from "../../packages/domain/dist/index.js";
import { evaluateSequenceCore } from "../../packages/domain/dist/sequences/generate.js";
import {
  addDays,
  calendarDays,
  elapsedDays,
  inRecurringWindow,
  conservativeAnniversary,
} from "../../packages/domain/dist/calendar/dates.js";
import {
  validateCatalogStructure,
  prepareCatalog,
  catalogReadiness,
  canonicalCatalogJson,
  catalogContentHash,
} from "../../packages/catalog/dist/index.js";
import { createHash } from "node:crypto";
import {
  sequenceResultSchema,
  catalogRuleSchema,
} from "../../packages/contracts/dist/index.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

const fixture = JSON.parse(
  readFileSync("tests/support/fixtures/engine.synthetic.json", "utf8"),
);
if (
  !fixture.synthetic ||
  !fixture.catalog.synthetic ||
  fixture.catalog.profiles.some((p) => !p.synthetic) ||
  fixture.catalog.sources.some((s) => !s.synthetic)
)
  throw new Error("SYNTHETIC_LABEL_REQUIRED");
const value = () => structuredClone(fixture);
const run = (v = value()) =>
  evaluateSequenceCore(v.input, v.catalog, v.context);
const pair = (r) =>
  r.pairs.find((p) => p.id === "synthetic-alpha>synthetic-beta");
const rules = (v, index, group) =>
  v.catalog.profiles[index].knowledge[group].rules;
const codes = (r) => r.reasons.map((x) => x.code);
const health = (
  v,
  {
    verified = true,
    name = "Synthetic issue",
    confirmation = "confirmed",
    source = "specialist_report",
  } = {},
) => {
  v.context.assessedOn = "2029-12-29";
  v.input.history.entries[0].harvested_on = "2029-12-29";
  v.input.crop_health = {
    status: "reported",
    observations: [
      {
        crop_id: "synthetic-beta",
        kind: "disease",
        name,
        observed_on: "2029-12-15",
        source,
        confirmation,
      },
    ],
  };
  if (verified)
    v.context.verifiedHealthObservations = [
      {
        cropId: "synthetic-beta",
        kind: "disease",
        name,
        observedOn: "2029-12-15",
        issueId: "synthetic-issue",
        verificationId: "synthetic-diagnostic-verification",
      },
    ];
};

test("labeled synthetic engine fixture passes structure and is rejected by public production entry", () => {
  expect(validateCatalogStructure(fixture.catalog).synthetic).toBe(true);
  expect(() =>
    generateSequences(fixture.input, fixture.catalog, fixture.context),
  ).toThrow("CATALOG_SYNTHETIC_REJECTED");
  expect(run().synthetic).toBe(true);
});
test.each(["profile", "source"])(
  "nested synthetic %s is rejected even without a top-level flag",
  (level) => {
    const v = value();
    v.catalog.synthetic = false;
    v.catalog.profiles.forEach((p) => (p.synthetic = false));
    v.catalog.sources.forEach((s) => (s.synthetic = false));
    if (level === "profile") v.catalog.profiles[0].synthetic = true;
    else v.catalog.sources[0].synthetic = true;
    expect(() => generateSequences(v.input, v.catalog, v.context)).toThrow(
      "CATALOG_SYNTHETIC_REJECTED",
    );
  },
);
test.each([
  "2029-02-29",
  "2030-04-31",
  "2030-01-01T00:00:00Z",
  "20300101",
  "2030-01-01[u-ca=gregory]",
])("strict calendar rejects %s", (date) =>
  expect(() => addDays(date, 1)).toThrow(),
);
test("calendar arithmetic preserves cross-year, leap days and real elapsed days", () => {
  expect(addDays("2029-12-31", 1)).toBe("2030-01-01");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(elapsedDays("2028-02-28", "2028-03-01")).toBe(2);
  expect(calendarDays("2028-02-28", "2028-03-01")).toEqual([
    "2028-02-28",
    "2028-02-29",
    "2028-03-01",
  ]);
  expect(() => calendarDays("2028-01-01", "2032-01-01")).toThrow(
    "CALENDAR_RANGE_INVALID",
  );
});
test("inclusive recurring windows wrap years and keep February 29 only in leap years", () => {
  for (const d of ["2029-12-20", "2030-01-01", "2030-02-10"])
    expect(inRecurringWindow(d, "12-20", "02-10")).toBe(true);
  expect(inRecurringWindow("2030-02-11", "12-20", "02-10")).toBe(false);
  expect(inRecurringWindow("2028-02-29", "02-29", "02-29")).toBe(true);
  expect(
    calendarDays("2029-02-28", "2029-03-01").filter((d) =>
      inRecurringWindow(d, "02-29", "02-29"),
    ),
  ).toEqual([]);
});
test("calendar-year breaks use conservative leap anniversaries", () => {
  expect(conservativeAnniversary("2028-02-29", 1)).toBe("2029-03-01");
  expect(conservativeAnniversary("2028-02-29", 4)).toBe("2032-02-29");
  expect(conservativeAnniversary("2028-01-31", 1)).toBe("2029-01-31");
});
test("full-month precision cannot hide partial month boundaries and February includes its leap day", () => {
  const r = {
    ...rules(value(), 0, "plantingWindows")[0],
    precision: "full_month",
    start: "02-01",
    end: "02-29",
  };
  expect(catalogRuleSchema.safeParse(r).success).toBe(true);
  expect(catalogRuleSchema.safeParse({ ...r, start: "02-02" }).success).toBe(
    false,
  );
  expect(catalogRuleSchema.safeParse({ ...r, end: "02-28" }).success).toBe(
    false,
  );
});
test("the pure engine enforces the same first-start horizon relative to supplied assessment date", () => {
  const v = value();
  v.context.assessedOn = "2028-01-01";
  v.input.soil.observations[0].measured_on = "2028-01-01";
  expect(() => run(v)).toThrow("ENGINE_CONTEXT_INVALID");
});
test("complete two-cycle enumeration uses the maximum duration and distinct dates", () => {
  const r = run(),
    p = pair(r);
  expect(p.schedules).toHaveLength(6);
  expect(p.schedules[0].first.harvestEarliest).toBe("2029-12-31");
  expect(p.schedules[0].first.harvestLatest).toBe("2030-01-02");
  for (const s of p.schedules) {
    expect(s.second.sownOn > s.first.harvestLatest).toBe(true);
    expect(s.second.harvestLatest <= r.input.planning.search_end_date).toBe(
      true,
    );
    expect(s.status).toBe("conditional");
  }
  expect(new Set(p.schedules.map((s) => s.id)).size).toBe(6);
  expect(r.recommendations).toBeNull();
  expect(r.deferredChecks).toContain("weather");
});
test("independent brute-force oracle matches all calendar-feasible dates across many small windows", () => {
  // Independent UTC day stepping is safe for this test's fixed date-only oracle;
  // production calculations use Temporal and no ambient clock.
  const oracleAdd = (d, n) =>
    new Date(Date.parse(d + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  for (const maximum of [1, 2, 3, 4])
    for (const end of ["2030-01-05", "2030-01-07", "2030-01-10"]) {
      const v = value();
      rules(v, 0, "duration")[0].max = maximum;
      v.input.planning.search_end_date = end;
      const expected = [];
      for (const a of ["2029-12-30", "2029-12-31"])
        for (const b of ["2030-01-04", "2030-01-05", "2030-01-06"])
          if (b > oracleAdd(a, maximum) && oracleAdd(b, 2) <= end)
            expected.push(`${a}/${b}`);
      const actual = pair(run(v)).schedules.map(
        (s) => `${s.first.sownOn}/${s.second.sownOn}`,
      );
      expect(actual).toEqual(expected);
    }
});
test("multiple duration references produce the conservative envelope, not optimistic choice", () => {
  const v = value();
  rules(v, 0, "duration").push({
    ...rules(v, 0, "duration")[0],
    id: "synthetic-alpha-later-duration",
    min: 2,
    max: 5,
  });
  const p = pair(run(v));
  expect(p.schedules).toHaveLength(3);
  expect(p.schedules.every((s) => s.first.durationDays.max === 5)).toBe(true);
  expect(p.schedules.every((s) => s.first.durationRuleIds.length === 2)).toBe(
    true,
  );
});
test.each(["reference", "soft"])(
  "%s-only durations cannot become executable calendar bounds",
  (severity) => {
    const v = value();
    rules(v, 0, "duration")[0].severity = severity;
    const p = pair(run(v));
    expect(p.schedules).toEqual([]);
    expect(p.status).toBe("insufficient_evidence");
    expect(codes(p)).toContain("DURATION_EVIDENCE_UNAVAILABLE");
  },
);
test("a reference duration cannot change a reviewed hard duration envelope", () => {
  const v = value(),
    original = pair(run(v));
  rules(v, 0, "duration").push({
    ...rules(v, 0, "duration")[0],
    id: "synthetic-reference-duration",
    severity: "reference",
    max: 100,
  });
  expect(pair(run(v)).schedules).toEqual(original.schedules);
});
test("overlapping duplicate planting windows do not duplicate schedules", () => {
  const v = value();
  rules(v, 0, "plantingWindows").push({
    ...rules(v, 0, "plantingWindows")[0],
    id: "synthetic-alpha-overlap-window",
  });
  expect(pair(run(v)).schedules).toHaveLength(6);
});
test("calendar rejections are retained without returning overlapping cycles", () => {
  const p = run().pairs.find((p) => p.id === "synthetic-alpha>synthetic-alpha");
  expect(p.status).toBe("excluded");
  expect(p.schedules).toEqual([]);
  expect(p.calendarRejections.secondOverlap).toBeGreaterThan(0);
  expect(codes(p)).toContain("SECOND_CALENDAR_UNAVAILABLE");
});
test("completion on the horizon is allowed; completion beyond it is rejected", () => {
  const v = value();
  v.input.planning.search_end_date = "2030-01-06";
  const p = pair(run(v));
  expect(p.schedules).toHaveLength(2);
  expect(
    p.schedules.every((s) => s.second.harvestLatest === "2030-01-06"),
  ).toBe(true);
  expect(p.calendarRejections.secondBeyondHorizon).toBe(4);
});
test("every considered unsupported choice and catalog alternative remains visible", () => {
  const v = value();
  v.input.preferences.considered_next_crop_ids.push("unsupported-crop");
  const r = run(v);
  expect(r.consideredChoices.map((c) => c.cropId)).toEqual([
    "synthetic-alpha",
    "unsupported-crop",
  ]);
  expect(r.consideredChoices[1].status).toBe("insufficient_evidence");
  expect(
    r.pairs.some(
      (p) => p.firstCropId === "synthetic-beta" && !p.startsWithFarmerChoice,
    ),
  ).toBe(true);
  expect(
    r.pairs
      .filter((p) => p.firstCropId === "unsupported-crop")
      .every((p) => codes(p).includes("CROP_NOT_IN_CATALOG")),
  ).toBe(true);
});
test("suggestion mode generates catalog choices without pretending they were farmer selected", () => {
  const v = value();
  v.input.preferences = {
    ...v.input.preferences,
    mode: "suggest",
    considered_next_crop_ids: [],
  };
  const r = run(v);
  expect(r.consideredChoices).toEqual([]);
  expect(r.pairs.every((p) => !p.startsWithFarmerChoice)).toBe(true);
});
test("farmer exclusions apply to both positions and remain traceable", () => {
  const v = value();
  v.input.preferences.excluded_crop_ids = ["synthetic-beta"];
  const p = pair(run(v));
  expect(p.status).toBe("excluded");
  expect(p.schedules).toEqual([]);
  expect(
    p.reasons.find((r) => r.code === "FARMER_EXCLUDED").inputPaths,
  ).toEqual(["input.preferences.excluded_crop_ids"]);
});
test.each([
  [
    "unresolved region",
    (v) => {
      v.context.region = { status: "unresolved" };
    },
    "REGION_UNRESOLVED",
  ],
  [
    "unsupported region",
    (v) => {
      v.context.region.regionId = "unsupported-region";
    },
    "REGION_NOT_IN_CATALOG",
  ],
  [
    "unknown production system",
    (v) => {
      v.context.productionSystem = null;
    },
    "PRODUCTION_SYSTEM_UNRESOLVED",
  ],
  [
    "unsupported system",
    (v) => {
      v.context.productionSystem = "irrigated";
    },
    "SYSTEM_NOT_SUPPORTED",
  ],
  [
    "unknown cultivar",
    (v) => {
      v.context.cultivars = [];
    },
    "CULTIVAR_UNRESOLVED",
  ],
  [
    "wrong cultivar",
    (v) => {
      v.context.cultivars[0].cultivarId = "unsupported-cultivar";
    },
    "CULTIVAR_UNRESOLVED",
  ],
  [
    "research profile",
    (v) => {
      v.catalog.profiles[0].review = {
        status: "pending",
        reason: "Synthetic pending",
      };
      v.catalog.profiles[0].applicability[0].status = "candidate";
      Object.values(v.catalog.profiles[0].knowledge).forEach((k) =>
        k.rules?.forEach((r) => {
          r.reviewStatus = "research";
          r.severity = "reference";
        }),
      );
    },
    "PROFILE_REVIEW_PENDING",
  ],
  [
    "illustrative duration",
    (v) => {
      const r = rules(v, 0, "duration")[0];
      r.timeBasis = "illustrative_case";
      r.severity = "reference";
    },
    "DURATION_EVIDENCE_UNAVAILABLE",
  ],
  [
    "approximate window",
    (v) => {
      const r = rules(v, 0, "plantingWindows")[0];
      r.precision = "approximate";
      r.severity = "reference";
    },
    "CALENDAR_EVIDENCE_UNAVAILABLE",
  ],
])(
  "%s yields evidence gaps and no invented calendar",
  (_label, change, code) => {
    const v = value();
    change(v);
    const p = pair(run(v));
    expect(p.schedules).toEqual([]);
    expect(p.status).toBe("insufficient_evidence");
    expect(codes(p)).toContain(code);
  },
);
test("out-of-range method-compatible soil pH is a hard failure with rule/source/value references", () => {
  const v = value();
  v.input.soil.observations[0].value = 9;
  const p = pair(run(v));
  expect(p.status).toBe("excluded");
  const r = p.reasons.find((r) => r.code === "SOIL_PH_OUTSIDE_RANGE");
  expect(r.effect).toBe("failure");
  expect(r.facts.value).toBe(9);
  expect(r.ruleIds).toContain("synthetic-alpha-ph");
  expect(r.citations[0].sourceId).toBe("synthetic-source");
});
test.each(["unknown", "cacl2"])(
  "%s pH method cannot trigger a method-incompatible hard failure",
  (method) => {
    const v = value();
    v.input.soil.observations[0].value = 9;
    v.input.soil.observations[0].method = method;
    const p = pair(run(v));
    expect(p.status).toBe("conditional");
    expect(codes(p)).toContain("SOIL_METHOD_MISMATCH");
    expect(p.reasons.some((r) => r.effect === "failure")).toBe(false);
  },
);
test("unknown soil and unsupported organic/texture observations are not favorable evidence", () => {
  const v = value();
  v.input.soil = { status: "unknown" };
  expect(codes(pair(run(v)))).toContain("SOIL_UNKNOWN");
  v.input.soil = {
    status: "known",
    observations: [
      {
        metric: "organic_matter",
        value: 2,
        unit: "percent_mass",
        method: "Synthetic method",
        measured_on: null,
        source: "farmer_observation",
      },
    ],
  };
  expect(codes(pair(run(v)))).toContain("SOIL_CHECK_UNIMPLEMENTED");
  expect(codes(pair(run(v)))).toContain("SOIL_METRIC_UNAVAILABLE");
});
test("undated out-of-range pH is conditional rather than a definitive current-field exclusion", () => {
  const v = value();
  v.input.soil.observations[0].value = 9;
  v.input.soil.observations[0].measured_on = null;
  const p = pair(run(v));
  expect(p.status).toBe("conditional");
  expect(
    p.reasons
      .filter((r) => r.code === "SOIL_PH_OUTSIDE_RANGE")
      .every((r) => r.effect === "condition"),
  ).toBe(true);
});
test("unencoded rule conditions are visible and never applied as hard soil constraints", () => {
  const v = value();
  v.input.soil.observations[0].value = 9;
  delete rules(v, 0, "soilRequirements")[0].executionScope;
  delete rules(v, 1, "soilRequirements")[0].executionScope;
  const p = pair(run(v));
  expect(p.status).toBe("insufficient_evidence");
  expect(codes(p)).toContain("RULE_CONDITIONS_UNRESOLVED");
  expect(p.reasons.some((r) => r.effect === "failure")).toBe(false);
});
test("unencoded cultivar/calendar qualifiers prevent invented date generation", () => {
  const v = value();
  rules(v, 0, "plantingWindows")[0].executionScope.conditionsStatus =
    "unresolved";
  const p = pair(run(v));
  expect(p.schedules).toEqual([]);
  expect(codes(p)).toContain("RULE_CONDITIONS_UNRESOLVED");
});
test("sourced family prohibition applies to historical predecessor and first-to-second transition", () => {
  const v = value();
  const rule = {
    ...rules(v, 0, "rotationRestrictions")[0],
    id: "synthetic-alpha-family",
    metric: "prohibited_predecessor_family",
    unit: "family",
    timeBasis: "previous_crop",
    stage: "whole_cycle",
    family: "Fabaceae",
  };
  delete rule.cropId;
  delete rule.minimumYears;
  rules(v, 0, "rotationRestrictions").push(rule);
  const s = pair(run(v)).schedules[0];
  expect(s.status).toBe("excluded");
  expect(
    s.reasons.some(
      (r) =>
        r.code === "PREDECESSOR_FAMILY_PROHIBITED" &&
        r.facts.previousCropId === "synthetic-beta",
    ),
  ).toBe(true);
  v.catalog.profiles[0].knowledge.rotationRestrictions.rules.pop();
  rules(v, 1, "rotationRestrictions").push({
    ...rule,
    id: "synthetic-beta-family",
    family: "Poaceae",
    executionScope: {
      cultivarId: "synthetic-beta-cultivar",
      conditionsStatus: "encoded_by_scope",
    },
  });
  expect(
    pair(run(v)).schedules.every((s) =>
      s.reasons.some(
        (r) => r.code === "PREDECESSOR_FAMILY_PROHIBITED" && r.cycle === 2,
      ),
    ),
  ).toBe(true);
});
test("tied latest harvests with unknown sowing dates cannot select an arbitrary predecessor", () => {
  const v = value();
  v.input.history.entries.push({
    crop_id: "synthetic-alpha",
    planted_on: null,
    harvested_on: v.input.history.entries[0].harvested_on,
  });
  const rule = {
    ...rules(v, 0, "rotationRestrictions")[0],
    id: "synthetic-ambiguous-predecessor",
    metric: "prohibited_predecessor_family",
    unit: "family",
    timeBasis: "previous_crop",
    stage: "whole_cycle",
    family: "Poaceae",
  };
  delete rule.cropId;
  delete rule.minimumYears;
  rules(v, 0, "rotationRestrictions").push(rule);
  const result = run(v),
    p = pair(result);
  expect(p.schedules.length).toBeGreaterThan(0);
  expect(
    p.schedules.every((s) =>
      s.reasons.some(
        (r) => r.code === "PREVIOUS_CROP_UNRESOLVED" && r.cycle === 1,
      ),
    ),
  ).toBe(true);
  expect(
    p.schedules.some((s) =>
      s.reasons.some(
        (r) => r.code === "PREDECESSOR_FAMILY_PROHIBITED" && r.cycle === 1,
      ),
    ),
  ).toBe(false);
  v.input.history.entries.reverse();
  expect(run(v)).toEqual(result);
});
test("family preference is conditional and cannot masquerade as a hard prohibition", () => {
  const v = value();
  const r = {
    ...rules(v, 0, "rotationRestrictions")[0],
    id: "synthetic-preference",
    metric: "preferred_predecessor_family",
    unit: "family",
    timeBasis: "previous_crop",
    stage: "whole_cycle",
    family: "Poaceae",
    severity: "soft",
  };
  delete r.cropId;
  delete r.minimumYears;
  rules(v, 0, "rotationRestrictions").push(r);
  expect(
    pair(run(v)).schedules[0].reasons.some(
      (r) =>
        r.code === "PREDECESSOR_PREFERENCE_UNMET" && r.effect === "condition",
    ),
  ).toBe(true);
  expect(catalogRuleSchema.safeParse({ ...r, severity: "hard" }).success).toBe(
    false,
  );
});
test("minimum return intervals check all known same-crop sowings and retain violations", () => {
  const v = value();
  v.context.assessedOn = "2029-12-29";
  v.input.history.entries = [
    {
      crop_id: "synthetic-alpha",
      planted_on: "2029-03-01",
      harvested_on: "2029-06-01",
    },
  ];
  const s = pair(run(v)).schedules[0];
  expect(s.status).toBe("excluded");
  const r = s.reasons.find((r) => r.code === "RETURN_INTERVAL_VIOLATION");
  expect(r.facts.earliestReturn).toBe("2030-03-01");
  expect(r.facts.previousSowing).toBe("2029-03-01");
});
test("unknown/partial/undated history and unestablished lookback remain explicit", () => {
  const v = value();
  v.input.history = { status: "unknown" };
  v.context.historyCoverageStart = null;
  expect(codes(pair(run(v)))).toContain("HISTORY_UNKNOWN");
  v.input.history = {
    status: "known",
    completeness: "partial",
    entries: [
      { crop_id: "synthetic-alpha", planted_on: null, harvested_on: null },
    ],
  };
  const s = pair(run(v)).schedules[0];
  expect(s.status).toBe("conditional");
  expect(codes(s)).toContain("HISTORY_DATES_UNKNOWN");
  expect(codes(s)).toContain("HISTORY_COVERAGE_UNESTABLISHED");
});
test("unsupported previous crop is retained and cannot be assumed to have a safe family", () => {
  const v = value();
  v.input.history.entries[0].crop_id = "unsupported-history-crop";
  const r = {
    ...rules(v, 0, "rotationRestrictions")[0],
    id: "synthetic-family-check",
    metric: "prohibited_predecessor_family",
    unit: "family",
    timeBasis: "previous_crop",
    stage: "whole_cycle",
    family: "Fabaceae",
  };
  delete r.cropId;
  delete r.minimumYears;
  rules(v, 0, "rotationRestrictions").push(r);
  expect(codes(pair(run(v)).schedules[0])).toContain(
    "PREVIOUS_CROP_UNRESOLVED",
  );
});
test("partial history cannot establish the immediate predecessor for a hard family exclusion", () => {
  const v = value();
  v.input.history.completeness = "partial";
  v.context.historyCoverageStart = null;
  const r = {
    ...rules(v, 0, "rotationRestrictions")[0],
    id: "synthetic-partial-family",
    metric: "prohibited_predecessor_family",
    unit: "family",
    timeBasis: "previous_crop",
    stage: "whole_cycle",
    family: "Fabaceae",
  };
  delete r.cropId;
  delete r.minimumYears;
  rules(v, 0, "rotationRestrictions").push(r);
  const s = pair(run(v)).schedules[0];
  expect(codes(s)).toContain("PREVIOUS_CROP_UNRESOLVED");
  expect(
    s.reasons.some((r) => r.code === "PREDECESSOR_FAMILY_PROHIBITED"),
  ).toBe(false);
});
test("verified linked supported health break produces hard rejection with exact anchors", () => {
  const v = value();
  health(v);
  const s = pair(run(v)).schedules[0];
  const r = s.reasons.find(
    (r) => r.code === "HEALTH_BREAK_VIOLATION" && r.cycle === 2,
  );
  expect(r.effect).toBe("failure");
  expect(r.facts.lastHostHarvest).toBe("2029-12-29");
  expect(r.facts.earliestSowing).toBe("2030-01-08");
  expect(r.facts.verificationId).toBe("synthetic-diagnostic-verification");
  expect(s.status).toBe("excluded");
});
test.each(["reported", "claimed-confirmed"])(
  "%s observation cannot become a hard health exclusion",
  (label) => {
    const v = value();
    health(
      v,
      label === "reported"
        ? { verified: false, confirmation: "reported", source: "farmer_report" }
        : { verified: false },
    );
    const s = pair(run(v)).schedules[0];
    expect(s.status).toBe("conditional");
    expect(
      s.reasons.some(
        (r) => r.code === "HEALTH_BREAK_VIOLATION" && r.effect === "condition",
      ),
    ).toBe(true);
    expect(
      s.reasons.some(
        (r) => r.code === "HEALTH_BREAK_VIOLATION" && r.effect === "failure",
      ),
    ).toBe(false);
  },
);
test("unsupported names are not fuzzy-matched into diagnoses", () => {
  const v = value();
  health(v, { verified: false, name: "synthetic issue" });
  const s = pair(run(v)).schedules[0];
  expect(codes(s)).toContain("HEALTH_OBSERVATION_UNSUPPORTED");
  expect(codes(s)).not.toContain("HEALTH_BREAK_VIOLATION");
});
test("a verified display name with a different issue ID cannot trigger a hard disease restriction", () => {
  const v = value();
  health(v);
  v.context.verifiedHealthObservations[0].issueId = "synthetic-different-issue";
  const s = pair(run(v)).schedules[0];
  expect(s.status).toBe("conditional");
  expect(
    s.reasons.some(
      (r) => r.code === "HEALTH_BREAK_VIOLATION" && r.effect === "failure",
    ),
  ).toBe(false);
  expect(
    s.reasons.some((r) => r.code === "HEALTH_OBSERVATION_UNVERIFIED"),
  ).toBe(true);
});
test("unlinked observations do not invent harvest dates", () => {
  const v = value();
  health(v);
  v.input.history.entries[0].harvested_on = "2029-12-01";
  const s = pair(run(v)).schedules[0];
  expect(codes(s)).toContain("HEALTH_HISTORY_UNLINKED");
  expect(codes(s)).not.toContain("HEALTH_BREAK_VIOLATION");
});
test("undated host history cannot create a hard health break anchor", () => {
  const v = value();
  health(v);
  v.input.history.entries[0].harvested_on = null;
  const s = pair(run(v)).schedules[0];
  expect(codes(s)).toContain("HEALTH_HISTORY_UNLINKED");
  expect(s.reasons.some((r) => r.code === "HEALTH_BREAK_VIOLATION")).toBe(
    false,
  );
});
test("unreviewed soft health evidence remains a gap and cannot exclude a crop", () => {
  const v = value();
  health(v);
  const r = rules(v, 1, "healthRestrictions")[0];
  r.reviewStatus = "research";
  r.severity = "soft";
  const s = pair(run(v)).schedules[0];
  expect(s.status).toBe("insufficient_evidence");
  expect(codes(s)).toContain("RULE_NOT_REVIEWED");
  expect(codes(s)).not.toContain("HEALTH_BREAK_VIOLATION");
});
test("a satisfied verified health break remains traceable without a disease probability", () => {
  const v = value();
  health(v);
  v.input.history.entries[0].harvested_on = "2029-12-16";
  const s = pair(run(v)).schedules[0];
  const r = s.reasons.find(
    (r) => r.code === "HEALTH_BREAK_SATISFIED" && r.cycle === 2,
  );
  expect(r.effect).toBe("pass");
  expect(r.facts.earliestSowing).toBe("2029-12-26");
  expect(r.facts).not.toHaveProperty("probability");
});
test("a future first host extends the break anchor for the second crop only under the explicit host rule", () => {
  const v = value();
  health(v);
  v.input.history.entries[0].harvested_on = "2029-12-16";
  rules(v, 1, "healthRestrictions")[0].hostCropIds.push("synthetic-alpha");
  const s = pair(run(v)).schedules[0];
  const r = s.reasons.find(
    (r) => r.code === "HEALTH_BREAK_VIOLATION" && r.cycle === 2,
  );
  expect(r.facts.lastHostHarvest).toBe(s.first.harvestLatest);
  expect(r.facts.earliestSowing).toBe("2030-01-12");
});
test("unknown health rule group is an evidence gap, not a claim of health safety", () => {
  const v = value();
  delete v.catalog.profiles[0].knowledge.healthRestrictions;
  const p = pair(run(v));
  expect(p.status).toBe("insufficient_evidence");
  expect(codes(p)).toContain("HEALTH_KNOWLEDGE_UNAVAILABLE");
});
test.each([
  "dangling-host",
  "wrong-target",
  "duplicate-name",
  "unreviewed-hard",
])("rejects malformed %s health evidence", (mode) => {
  const v = value(),
    r = rules(v, 0, "healthRestrictions")[0];
  if (mode === "dangling-host") r.hostCropIds.push("unsupported-host");
  if (mode === "wrong-target") r.hostCropIds = ["synthetic-beta"];
  if (mode === "duplicate-name") r.matchingNames.push(r.matchingNames[0]);
  if (mode === "unreviewed-hard") r.reviewStatus = "research";
  expect(() => run(v)).toThrow("CATALOG_INVALID");
});
test.each([
  "location",
  "future-observation",
  "forged-verification",
  "coverage",
  "extra-property",
])("rejects inconsistent %s context", (mode) => {
  const v = value();
  if (mode === "location") v.context.location.latitude = 0;
  if (mode === "future-observation") {
    health(v);
    v.context.assessedOn = "2029-12-01";
  }
  if (mode === "forged-verification")
    v.context.verifiedHealthObservations = [
      {
        cropId: "synthetic-beta",
        kind: "disease",
        name: "Missing",
        observedOn: "2029-01-01",
        verificationId: "synthetic-invalid",
      },
    ];
  if (mode === "coverage") v.context.historyCoverageStart = "2028-01-01";
  if (mode === "extra-property") v.context.unchecked = true;
  expect(() => run(v)).toThrow();
});
test("identical evidence/input gives identical results and caller objects are not mutated", () => {
  const v = value(),
    before = JSON.stringify(v),
    r = run(v);
  expect(JSON.stringify(v)).toBe(before);
  expect(run(v)).toEqual(r);
  v.catalog.profiles.reverse();
  v.catalog.sources.reverse();
  v.context.cultivars.reverse();
  v.input.history.entries.reverse();
  expect(run(v)).toEqual(r);
});
test("unordered histories and observations produce the same assessment order", () => {
  const v = value();
  v.input.history.entries.push({
    crop_id: "synthetic-alpha",
    planted_on: "2025-01-01",
    harvested_on: "2025-01-05",
  });
  v.input.crop_health = {
    status: "reported",
    observations: [
      {
        crop_id: "synthetic-beta",
        kind: "pest",
        name: "Unsupported test pest",
        observed_on: "2027-01-04",
        source: "farmer_report",
        confirmation: "reported",
      },
      {
        crop_id: "synthetic-alpha",
        kind: "disease",
        name: "Unsupported test disease",
        observed_on: "2025-01-02",
        source: "farmer_report",
        confirmation: "reported",
      },
    ],
  };
  const a = run(v);
  v.input.history.entries.reverse();
  v.input.crop_health.observations.reverse();
  expect(run(v)).toEqual(a);
});
test("farmer priority is preserved without introducing scores or changing calendar feasibility", () => {
  const v = value(),
    a = run(v);
  v.input.preferences.priority = "lower_water_demand";
  const b = run(v);
  expect(b.pairs).toEqual(a.pairs);
  expect(b.input.preferences.priority).toBe("lower_water_demand");
  expect(codes(pair(b))).toContain("IRRIGATION_ADEQUACY_UNKNOWN");
});
test("work limit fails explicitly without returning a sampled successful result", () => {
  const v = value();
  v.input.planning = {
    cycles: 2,
    earliest_start_date: "2029-01-01",
    latest_start_date: "2029-12-31",
    search_end_date: "2031-12-31",
  };
  for (const p of v.catalog.profiles) {
    const r = p.knowledge.plantingWindows.rules[0];
    r.start = "01-01";
    r.end = "12-31";
  }
  expect(() => run(v)).toThrow("ENGINE_WORK_LIMIT");
  expect(sequenceLimits.combinations).toBe(250000);
});
test("schedule limit fails explicitly even for rejected schedule records", () => {
  const v = value();
  v.input.planning = {
    cycles: 2,
    earliest_start_date: "2029-01-01",
    latest_start_date: "2029-03-01",
    search_end_date: "2029-05-01",
  };
  for (const p of v.catalog.profiles) {
    const r = p.knowledge.plantingWindows.rules[0];
    r.start = "01-01";
    r.end = "12-31";
  }
  expect(() => run(v)).toThrow("ENGINE_SCHEDULE_LIMIT");
});
test("real immutable catalog retains its prior hash and yields honest unresolved evidence", async () => {
  const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  expect(prepareCatalog(catalog).sha256).toBe(
    "d951b9c07b03739a77d43d0518c68ebc13b80d805fa58dcd076ef9cd82ed3a55",
  );
  const v = value();
  v.input.preferences.considered_next_crop_ids = [
    "durum-wheat",
    "unsupported-crop",
  ];
  v.context.region = { status: "unresolved" };
  v.context.productionSystem = null;
  v.context.cultivars = [];
  const r = generateSequences(v.input, catalog, v.context);
  expect(r.synthetic).toBe(false);
  expect(r.outcome).toBe("insufficient_evidence");
  expect(r.counts.schedules).toBe(0);
  expect(r.consideredChoices).toHaveLength(2);
  expect(r.pairs.every((p) => p.status === "insufficient_evidence")).toBe(true);
});
test("catalog readiness exposes missing executable rule conditions consistently with the engine", async () => {
  const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  const readiness = catalogReadiness(
    catalog,
    "durum-wheat",
    "beni-mellal-tadla",
  );
  expect(readiness.status).toBe("insufficient_evidence");
  expect(
    readiness.gaps.some((g) => g.code === "RULE_CONDITIONS_UNRESOLVED"),
  ).toBe(true);
});
test("output byte cap fails early and does not return a partial plan", () => {
  const v = value();
  v.input.planning = {
    cycles: 2,
    earliest_start_date: "2029-01-01",
    latest_start_date: "2029-01-03",
    search_end_date: "2029-01-31",
  };
  for (const p of v.catalog.profiles) {
    const r = p.knowledge.plantingWindows.rules[0];
    r.start = "01-01";
    r.end = "12-31";
  }
  v.input.history.entries = Array.from({ length: 20 }, (_, i) => ({
    crop_id: i % 2 ? "synthetic-alpha" : "synthetic-beta",
    planted_on: `${2001 + i}-01-01`,
    harvested_on: `${2001 + i}-01-10`,
  }));
  v.context.historyCoverageStart = "2000-01-01";
  expect(() => run(v)).toThrow("ENGINE_OUTPUT_LIMIT");
});
test.each([
  "duration",
  "counts",
  "combinations",
  "status",
  "choice",
  "horizon",
])("strict output rejects inconsistent %s", (mode) => {
  const r = run(),
    s = pair(r).schedules[0];
  if (mode === "duration") s.first.durationDays.max = 4;
  if (mode === "combinations") r.counts.combinationsExamined = 0;
  if (mode === "counts") r.counts.schedules++;
  if (mode === "status") s.status = "eligible";
  if (mode === "choice") r.consideredChoices = [];
  if (mode === "horizon") r.input.planning.search_end_date = "2030-01-05";
  expect(sequenceResultSchema.safeParse(r).success).toBe(false);
});
test("output contract rejects overlapping crop cycles", () => {
  const r = run();
  pair(r).schedules[0].second.sownOn = pair(r).schedules[0].first.harvestLatest;
  expect(sequenceResultSchema.safeParse(r).success).toBe(false);
});
test("ESLint actively rejects infrastructure, clock, randomness and dynamic imports in the engine", async () => {
  const eslint = new ESLint();
  for (const source of [
    "import pg from 'pg'; void pg;",
    "import crypto from 'crypto'; void crypto;",
    "const x = Date.now(); void x;",
    "const x = Math.random(); void x;",
    "const x = globalThis.process; void x;",
    "const x = import('node:fs'); void x;",
  ]) {
    const [result] = await eslint.lintText(source, {
      filePath: "packages/domain/src/boundary-probe.ts",
    });
    expect(result.errorCount).toBeGreaterThan(0);
  }
  for (const filePath of [
    "packages/catalog/src/boundary-probe.ts",
    "packages/contracts/src/boundary-probe.ts",
  ]) {
    for (const source of [
      "import crypto from 'node:crypto'; void crypto;",
      "import fs from 'fs'; void fs;",
      "const x = Buffer.byteLength('test'); void x;",
    ]) {
      const [result] = await eslint.lintText(source, { filePath });
      expect(result.errorCount).toBeGreaterThan(0);
    }
  }
});
test("dependency graph needs no Node builtins/Buffer and calendar evaluation reads no clock", async () => {
  const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  const v = value();
  const results = [0, 2000000000000].map((initialClock) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
    import { registerHooks, isBuiltin } from "node:module";
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    const { fixture, catalog } = JSON.parse(text);
    Date.now = () => Number(process.argv[1]);
    registerHooks({ resolve(specifier, context, next) {
      if (isBuiltin(specifier)) throw new Error("NODE_BUILTIN_FORBIDDEN:" + specifier);
      return next(specifier, context);
    }});
    globalThis.Buffer = undefined;
        globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN"); };
        const { generateSequences } = await import("./packages/domain/dist/index.js");
        const { evaluateSequenceCore } = await import("./packages/domain/dist/sequences/generate.js");
        // Temporal initializes unused Now internals on import; calendar evaluation must never read them.
        Date.now = () => { throw new Error("CLOCK_READ_FORBIDDEN"); };
    const synthetic = evaluateSequenceCore(fixture.input, fixture.catalog, fixture.context);
    const real = generateSequences(fixture.input, catalog, fixture.context);
    console.log(JSON.stringify({ synthetic, real }));
  `,
          String(initialClock),
        ],
        {
          input: JSON.stringify({ fixture: v, catalog }),
          encoding: "utf8",
          timeout: 10000,
        },
      ),
    ),
  );
  expect(results[0]).toEqual(results[1]);
  const actual = results[0];
  expect(actual.synthetic).toEqual(run(v));
  expect(actual.real.counts.schedules).toBe(0);
  expect(actual.real.catalog.sha256).toBe(
    "d951b9c07b03739a77d43d0518c68ebc13b80d805fa58dcd076ef9cd82ed3a55",
  );
});
test.each(["reference", "soft"])(
  "readiness exposes %s-only calendar evidence",
  (severity) => {
    const v = value();
    v.catalog.synthetic = false;
    v.catalog.profiles.forEach((p) => (p.synthetic = false));
    v.catalog.sources.forEach((s) => (s.synthetic = false));
    const rule = rules(v, 0, "duration")[0];
    rule.severity = severity;
    const readiness = catalogReadiness(
      v.catalog,
      "synthetic-alpha",
      v.context.region.regionId,
    );
    expect(readiness.status).toBe("insufficient_evidence");
    expect(readiness.gaps).toContainEqual({
      code: "CALENDAR_RULE_NOT_EXECUTABLE",
      field: "duration",
      ruleId: rule.id,
    });
  },
);
test("catalog SHA-256 agrees with independent native hashing for Unicode evidence", () => {
  const v = value();
  v.catalog.sources[0].title = "Synthetic UTF-8 evidence: بني ملال / é / 🌱";
  const catalog = validateCatalogStructure(v.catalog);
  expect(catalogContentHash(catalog)).toBe(
    createHash("sha256")
      .update(canonicalCatalogJson(catalog), "utf8")
      .digest("hex"),
  );
});
