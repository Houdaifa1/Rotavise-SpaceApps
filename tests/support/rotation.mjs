// Invented crops, region, issue and weather for rotation-engine tests. Every
// entity is labelled synthetic; values exercise the engine and are never
// agronomic evidence.
import { createHash } from "node:crypto";
import { syntheticSnapshot } from "./climate.mjs";
import { calendarYearLength } from "../../packages/contracts/dist/index.js";
import { futureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";

const source = {
  id: "synthetic-source",
  title: "Synthetic rotation fixture",
  publisher: "Rotavise tests",
  url: "https://example.invalid/synthetic",
  publicationYear: null,
  accessedAt: "2026-10-01T00:00:00.000Z",
  evidence: {
    kind: "verified_extract",
    sha256: "0".repeat(64),
    bytes: 1,
    artifactPath: null,
    captureNote: "Synthetic test fixture; no real document.",
  },
  geographicScope: "Synthetic test region only",
  limitations: ["Invented values for engine tests only."],
  synthetic: true,
  kind: "other",
  rights: {
    reuse: "permitted",
    licence: "Synthetic test data",
    note: "Test only.",
  },
};
const cite = [
  {
    sourceId: "synthetic-source",
    locator: "Synthetic fixture",
    interpretation: "direct",
    note: "Invented test value.",
  },
];
const square = (lon1, lat1, lon2, lat2) => ({
  type: "Polygon",
  coordinates: [
    [
      [lon1, lat1],
      [lon2, lat1],
      [lon2, lat2],
      [lon1, lat2],
      [lon1, lat1],
    ],
  ],
});
const region = (id, geometry) => ({
  id,
  name: id,
  countryCode: "MA",
  scopeNote: "Synthetic test region.",
  citations: cite,
  boundary: geometry
    ? { sourceId: "synthetic-source", locator: "Synthetic polygon", geometry }
    : null,
});
const verified = { status: "double_checked", checkedOn: "2026-10-01" };
const scope = {
  regionIds: ["synthetic-plain"],
  farmingSystems: "any",
  cultivarIds: "any",
};
const rule = (id, metric, fields, extra = {}) => ({
  id,
  citations: cite,
  scope: { ...scope, ...(extra.scope ?? {}) },
  severity: extra.severity ?? "hard",
  verification: extra.verification ?? verified,
  conditions: "Synthetic rule.",
  metric,
  ...fields,
});
const families = [
  "Poaceae",
  "Fabaceae",
  "Brassicaceae",
  "Amaranthaceae",
  "Pedaliaceae",
  "Solanaceae",
];
// Winter crops sow in a whole month of autumn; summer crops in early summer.
const templates = [
  { start: "10-01", end: "10-31", min: 190, max: 230, upper: 34 },
  { start: "11-01", end: "11-30", min: 170, max: 210, upper: 33 },
  { start: "11-01", end: "11-30", min: 150, max: 190, upper: 32 },
  { start: "06-01", end: "06-30", min: 95, max: 125, upper: 40 },
  { start: "07-01", end: "07-31", min: 90, max: 115, upper: 41 },
  { start: "05-01", end: "05-31", min: 100, max: 130, upper: 39 },
];
export function rotationCatalog({ crops = 12 } = {}) {
  const profiles = [];
  for (let i = 0; i < crops; i++) {
    const id = `synthetic-crop-${String(i + 1).padStart(2, "0")}`;
    const t = templates[i % templates.length];
    const family = families[i % families.length];
    const rules = [
      rule(`${id}-window`, "planting_window", {
        start: t.start,
        end: t.end,
        precision: "full_month",
      }),
      rule(`${id}-duration`, "cycle_duration", {
        basis: "sowing_to_harvest",
        minDays: t.min,
        maxDays: t.max,
      }),
      rule(
        `${id}-heat`,
        "temperature",
        {
          basis: "daily_maximum",
          medium: "air",
          stage: "whole_cycle",
          stageWindow: null,
          lowerDegC: null,
          upperDegC: t.upper + (i % 3),
        },
        { severity: "soft" },
      ),
      rule(
        `${id}-water`,
        "water_demand_class",
        {
          value: ["low", "moderate", "high"][i % 3],
          comparisonMethod: "Synthetic ordinal classes",
        },
        { severity: "soft" },
      ),
      rule(`${id}-return`, "minimum_return_interval", { years: 1 + (i % 2) }),
    ];
    if (family === "Poaceae")
      rules.push(
        rule(
          `${id}-after-legume`,
          "preferred_predecessor_family",
          { family: "Fabaceae" },
          { severity: "soft" },
        ),
      );
    if (i === 1)
      rules.push(
        rule(`${id}-blight-break`, "crop_health_break", {
          issueId: "synthetic-blight",
          minimumBreakDays: 730,
        }),
      );
    profiles.push({
      id,
      version: "0.0.1",
      synthetic: true,
      identity: {
        name: `Synthetic crop ${i + 1}`,
        localNames: [],
        scientificName: `Inventum ${i + 1}`,
        family,
        citations: cite,
      },
      harvestProduct: "other",
      modelType: "annual",
      cultivars: [],
      applicability: [
        {
          regionId: "synthetic-plain",
          status: "candidate",
          citations: cite,
          note: "Synthetic.",
        },
      ],
      rules,
      gaps: [],
      limitations: ["Synthetic profile for engine tests only."],
    });
  }
  profiles.push({
    ...profiles[0],
    id: "synthetic-orchard",
    identity: { ...profiles[0].identity, name: "Synthetic orchard" },
    modelType: "orchard",
    rules: [],
  });
  profiles.push({
    ...profiles[0],
    id: "synthetic-unverified",
    identity: { ...profiles[0].identity, name: "Synthetic unverified crop" },
    rules: profiles[0].rules
      .filter((r) => ["planting_window", "cycle_duration"].includes(r.metric))
      .map((r) => ({
        ...r,
        id: r.id.replace(profiles[0].id, "synthetic-unverified"),
        severity: "reference",
        verification: { status: "extracted" },
      })),
  });
  return {
    schemaVersion: "2",
    id: "synthetic-rotation",
    version: "0.0.1",
    synthetic: true,
    regions: [
      region("synthetic-plain", square(-6.5, 32.1, -6.1, 32.5)),
      region("synthetic-elsewhere", square(10, 10, 11, 11)),
      region("synthetic-unmapped", null),
    ],
    sources: [source],
    issues: [
      {
        id: "synthetic-blight",
        kind: "disease",
        name: "Synthetic blight",
        scientificName: null,
        localNames: [],
        hostCropIds: ["synthetic-crop-02", "synthetic-crop-08"].filter((id) =>
          profiles.some((p) => p.id === id),
        ),
        citations: cite,
        synthetic: true,
      },
    ],
    profiles,
    conflicts: [],
  };
}
export const rotationPolicy = {
  version: "rotation-policy-2",
  firstAnchorYear: 1991,
  lastAnchorYear: 2020,
  minimumCompleteAnalogs: 20,
  preparationGapDays: 0,
  representativeStepDays: 7,
  beamWidth: 150,
  perFirstCropWidth: 25,
  maxExpansions: 2000000,
  maxSlots: 12,
  maxClimateDayVisits: 80000000,
  outputCandidates: 50,
  futureClimate: futureClimatePolicy,
};
// Invented model-world temperatures for the units a plan needs: the same
// seasonal shape in each model's own calendar, warmer under the scenarios.
// Labelled synthetic; never NASA data.
export function syntheticScenarioSeries(
  needs,
  { warming = { historical: 0, ssp245: 1.5, ssp585: 3 }, skip = 0 } = {},
) {
  return needs.units.slice(skip).map((unit, n) => {
    const length = calendarYearLength(unit.model.calendar, unit.year);
    const offset = futureClimatePolicy.models.findIndex(
      (m) => m.id === unit.model.id,
    );
    const values = Array.from({ length }, (_, i) => {
      const season = Math.sin((2 * Math.PI * ((i / length) * 365 - 110)) / 365);
      const max =
        24 + 13 * season + warming[unit.experiment] + 0.3 * offset - 0.6;
      // Invented rain: 3 mm on every fifth day, drier under the scenarios.
      if (unit.variable === "pr")
        return i % 5 === 0 ? 3 - warming[unit.experiment] * 0.3 : 0;
      const value =
        unit.variable === "tasmax"
          ? max
          : unit.variable === "tasmin"
            ? max - 12
            : max - 6;
      return Number(value.toFixed(3));
    });
    return {
      unitId: `00000000-0000-4000-9000-${String(n + 1 + skip).padStart(12, "0")}`,
      normalizedSha256: createHash("sha256")
        .update(JSON.stringify(values))
        .digest("hex"),
      synthetic: true,
      model: unit.model,
      experiment: unit.experiment,
      variable: unit.variable,
      year: unit.year,
      cell: needs.cell,
      values,
    };
  });
}
const plus = (d, n) =>
  new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
// Seasonal invented weather with a year-dependent shift, deterministic.
export function syntheticSeasonalWeather(date) {
  const doy =
    (Date.parse(date) - Date.parse(date.slice(0, 4) + "-01-01")) / 86400000;
  const year = Number(date.slice(0, 4));
  const season = Math.sin((2 * Math.PI * (doy - 110)) / 365);
  const shift = ((year * 7) % 5) - 2;
  const max = Number((24 + 13 * season + shift).toFixed(1));
  return {
    temperatureMax: max,
    temperatureMin: Number((max - 12).toFixed(1)),
    temperatureMean: Number((max - 6).toFixed(1)),
    precipitation: doy % 6 === 0 ? 4 : 0,
  };
}
export function rotationWeather(start = "1991-01-01", end = "2026-06-17") {
  const evidence = [];
  let from = start,
    n = 1;
  while (from <= end) {
    const to = plus(from, 365) < end ? plus(from, 365) : end;
    evidence.push(
      syntheticSnapshot(from, to, 1000 + n++, syntheticSeasonalWeather),
    );
    from = plus(to, 1);
  }
  return evidence;
}
export function rotationRequest(overrides = {}) {
  return {
    schema_version: "2",
    location: { latitude: 32.3, longitude: -6.3 },
    history: {
      status: "known",
      completeness: "complete",
      entries: [
        {
          crop_id: "synthetic-crop-02",
          planted_on: "2025-11-05",
          harvested_on: "2026-05-20",
        },
      ],
    },
    crop_health: { status: "unknown" },
    soil: { status: "unknown" },
    water: {
      status: "reported",
      availability: "irrigation_available",
      allocation: null,
    },
    planning: {
      horizon_years: 3,
      earliest_start_date: "2026-10-20",
      latest_start_date: "2027-03-31",
    },
    cultivars: [],
    preferences: {
      mode: "consider",
      considered_crop_ids: ["synthetic-crop-01"],
      excluded_crop_ids: [],
      priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
    },
    ...overrides,
  };
}
