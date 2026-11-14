// Mechanical conversion of catalog release format 1 to format 2. It maps each
// field and adds no fact: missing knowledge becomes an explicit gap, and
// rights stay "unknown" because the 2026-09-27 review verified no reuse licence.
// Usage: node tooling/catalog/convert-release-v1.mjs <from-dir> <to-dir> <version>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";

const [from, to, version] = process.argv.slice(2);
if (!from || !to || !/^\d+\.\d+\.\d+$/.test(version ?? ""))
  throw new Error("USAGE: convert-release-v1.mjs <from> <to> <version>");
const read = (path) => JSON.parse(readFileSync(join(from, path), "utf8"));
const manifest = read("manifest.json");
if (manifest.schemaVersion !== "1") throw new Error("SOURCE_NOT_FORMAT_1");

const kinds = {
  "onca-cereals": "official_guide",
  "onca-sugar-beet": "official_guide",
  "onca-legumes": "official_guide",
  "inra-wheat": "official_guide",
  "inra-regional": "official_communication",
  "kew-durum": "taxonomy",
  "kew-faba": "taxonomy",
  "kew-beet": "taxonomy",
};
const sources = read(manifest.sourceFile).map((source) => {
  if (!kinds[source.id]) throw new Error("UNMAPPED_SOURCE " + source.id);
  return {
    ...source,
    kind: kinds[source.id],
    rights: {
      reuse: "unknown",
      licence: null,
      note: "No explicit reuse licence was verified in the 2026-09-27 review. Cite facts; do not redistribute the document.",
    },
  };
});
const topics = {
  plantingWindows: "planting_window",
  duration: "cycle_duration",
  soilRequirements: "soil",
  temperatureRequirements: "temperature",
  waterDemandClass: "water_demand",
  waterReference: "water_demand",
  rotationRestrictions: "rotation",
  healthRestrictions: "crop_health",
};
function scope(rule) {
  const systems = rule.productionSystems.includes("unspecified")
    ? "unspecified"
    : rule.productionSystems;
  return {
    regionIds: rule.evidenceRegionIds,
    farmingSystems: systems,
    cultivarIds: rule.executionScope
      ? [rule.executionScope.cultivarId]
      : "unspecified",
  };
}
function convertRule(rule) {
  if (rule.reviewStatus !== "research") throw new Error("UNEXPECTED_REVIEW");
  const common = {
    id: rule.id,
    citations: rule.citations,
    scope: scope(rule),
    severity: rule.severity,
    verification: { status: "extracted" },
    conditions: rule.conditions,
  };
  switch (rule.metric) {
    case "planting_window":
      return {
        ...common,
        metric: rule.metric,
        start: rule.start,
        end: rule.end,
        precision: rule.precision,
      };
    case "soil_ph":
      return {
        ...common,
        metric: rule.metric,
        method: rule.method,
        min: rule.min,
        max: rule.max,
      };
    case "soil_drainage":
      return { ...common, metric: rule.metric, value: rule.value };
    case "temperature":
      return {
        ...common,
        metric: rule.metric,
        basis:
          rule.timeBasis === "instantaneous" ? "unspecified" : rule.timeBasis,
        medium: rule.medium,
        stage: rule.stage,
        stageWindow: rule.stageWindow ?? null,
        lowerDegC: rule.min,
        upperDegC: rule.max,
      };
    case "seasonal_crop_water_reference":
      return {
        ...common,
        metric: "water_reference",
        basis: "seasonal_scenario",
        minMm: rule.min,
        minInclusive: true,
        maxMm: rule.max,
      };
    case "annual_water_reference":
      return {
        ...common,
        metric: "water_reference",
        basis: "annual_rainfall",
        minMm: rule.lowerBound,
        minInclusive: rule.inclusive,
        maxMm: null,
      };
    case "preferred_predecessor_family":
    case "prohibited_predecessor_family":
      return { ...common, metric: rule.metric, family: rule.family };
    case "minimum_return_interval":
      return { ...common, metric: rule.metric, years: rule.minimumYears };
    default:
      throw new Error("UNMAPPED_METRIC " + rule.metric);
  }
}
const profiles = manifest.profileFiles.map((file) => {
  const p = read(file);
  const rules = [],
    gaps = [];
  for (const [group, knowledge] of Object.entries(p.knowledge)) {
    if (knowledge.status === "sourced")
      rules.push(...knowledge.rules.map(convertRule));
    else gaps.push({ topic: topics[group], reason: knowledge.reason });
  }
  if (!p.knowledge.healthRestrictions)
    gaps.push({
      topic: "crop_health",
      reason: "No sourced crop-health break rule was extracted.",
    });
  if (p.cultivar.status === "unknown")
    gaps.push({ topic: "cultivar", reason: p.cultivar.reason });
  return {
    id: p.id,
    version,
    synthetic: p.synthetic,
    identity: { ...p.identity, localNames: [] },
    harvestProduct: p.harvestProduct,
    modelType: "annual",
    cultivars: [],
    applicability: p.applicability,
    rules,
    gaps,
    limitations: [...p.limitations, p.review.reason],
  };
});
const bundle = {
  schemaVersion: "2",
  id: manifest.id,
  version,
  synthetic: manifest.synthetic,
  regions: manifest.regions.map((r) => ({ ...r, boundary: null })),
  sources,
  issues: [],
  profiles,
  conflicts: [],
};
const prepared = prepareCatalogV2(bundle);
mkdirSync(join(to, "profiles"), { recursive: true });
const write = (path, value) =>
  writeFileSync(join(to, path), JSON.stringify(value, null, 2) + "\n");
const release = Object.fromEntries(
  Object.entries(bundle).filter(
    ([key]) => key !== "sources" && key !== "profiles",
  ),
);
write("manifest.json", {
  ...release,
  sourceFile: "sources.json",
  profileFiles: profiles.map((p) => `profiles/${p.id}.json`),
});
write("sources.json", sources);
for (const p of profiles) write(`profiles/${p.id}.json`, p);
console.log(
  JSON.stringify({
    version,
    sha256: prepared.sha256,
    profiles: profiles.length,
    rules: profiles.reduce((n, p) => n + p.rules.length, 0),
  }),
);
