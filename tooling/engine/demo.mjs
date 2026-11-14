import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateSequences } from "../../packages/domain/dist/index.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

const fixture = JSON.parse(
  readFileSync("tests/support/fixtures/engine.synthetic.json", "utf8"),
);
assert.equal(fixture.synthetic, true);
const input = structuredClone(fixture.input),
  context = structuredClone(fixture.context);
input.preferences.considered_next_crop_ids = [
  "durum-wheat",
  "faba-bean",
  "unsupported-demo-crop",
];
context.region = { status: "unresolved" };
context.productionSystem = null;
context.cultivars = [];
const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
const result = generateSequences(input, catalog, context);
assert.equal(result.outcome, "insufficient_evidence");
assert.equal(result.counts.schedules, 0);
assert.equal(result.recommendations, null);
console.log(
  JSON.stringify(
    {
      syntheticInput: true,
      purpose: "Local engine gap demonstration; not farmer advice",
      kind: result.kind,
      scope: result.scope,
      engineVersion: result.engineVersion,
      catalog: result.catalog,
      outcome: result.outcome,
      counts: result.counts,
      consideredChoices: result.consideredChoices,
      exampleGaps: [
        ...new Set(
          result.pairs.flatMap((p) =>
            p.reasons.filter((r) => r.effect === "gap").map((r) => r.code),
          ),
        ),
      ].sort(),
      recommendations: result.recommendations,
      deferredChecks: result.deferredChecks,
    },
    null,
    2,
  ),
);
