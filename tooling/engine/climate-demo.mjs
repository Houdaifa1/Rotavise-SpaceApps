import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  measureHistoricalWindow,
  normalizedWeatherHash,
  assessHistoricalSequences,
} from "../../packages/domain/dist/index.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

const captures = JSON.parse(
  readFileSync("docs/evidence/weather/2026-09-26/manifest.json", "utf8"),
).filter((m) => m.provider === "nasa-power");
const measurements = captures.map((m, i) => {
  const raw = readFileSync(
    `docs/evidence/weather/2026-09-26/${m.file}`,
    "utf8",
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), m.sha256);
  const request = {
    latitude: m.sample.latitude,
    longitude: m.sample.longitude,
    startDate: m.sample.start,
    endDate: m.sample.end,
    variables: [
      "temperatureMin",
      "temperatureMax",
      "temperatureMean",
      "precipitation",
    ],
  };
  const snapshot = normalizeNasa(raw, request, m.retrievedAt);
  const evidence = [
    {
      snapshotId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
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
  assert(result.coverage.every((c) => c.missingDates.length === 0));
  return {
    sample: m.sample.name,
    file: m.file,
    rawSha256: m.sha256,
    normalizedSha256: evidence[0].normalizedSha256,
    request,
    expectedDays: result.expectedDays,
    metrics: result.metrics,
  };
});
const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
const location = { latitude: 32.3373, longitude: -6.3498 };
const input = {
  schema_version: "1",
  location,
  history: { status: "unknown" },
  crop_health: { status: "unknown" },
  soil: { status: "unknown" },
  water: { status: "unknown" },
  planning: {
    cycles: 2,
    earliest_start_date: "2026-10-01",
    latest_start_date: "2026-10-02",
    search_end_date: "2028-10-01",
  },
  preferences: {
    mode: "consider",
    considered_next_crop_ids: ["durum-wheat", "faba-bean", "sugar-beet"],
    excluded_crop_ids: [],
    priority: "lower_water_demand",
  },
};
const context = {
  assessedOn: "2026-09-27",
  location,
  region: { status: "unresolved" },
  productionSystem: null,
  historyCoverageStart: null,
  cultivars: [],
  verifiedHealthObservations: [],
};
const policy = {
  version: "historical-policy-1",
  firstAnchorYear: 1991,
  lastAnchorYear: 2020,
  splitAfterYear: 2005,
  minimumCompleteAnalogs: 10,
  minimumPeriodAnalogs: 5,
};
const gap = assessHistoricalSequences(input, catalog, context, [], policy);
assert.equal(gap.outcome, "insufficient_evidence");
assert.equal(gap.candidates.length, 0);
assert.equal(gap.ranking.groups.length, 0);
assert.equal(gap.recommendations, null);
console.log(
  JSON.stringify(
    {
      purpose:
        "Real recorded NASA weather arithmetic plus real-catalog evidence gaps; no farmer recommendation",
      weatherSynthetic: false,
      captureIdentity:
        "Demo identifiers label committed files; not PostgreSQL snapshot IDs",
      measurements,
      catalogGap: {
        inputSynthetic: true,
        inputPurpose:
          "Illustrative unknown farmer inputs, not a real field submission",
        catalog: gap.sequence.catalog,
        outcome: gap.outcome,
        counts: gap.sequence.counts,
        consideredChoices: gap.sequence.consideredChoices,
        candidates: gap.candidates.length,
        comparisonGroups: gap.ranking.groups.length,
        weatherEvidenceForPlanning: 0,
        recommendations: null,
      },
    },
    null,
    2,
  ),
);
