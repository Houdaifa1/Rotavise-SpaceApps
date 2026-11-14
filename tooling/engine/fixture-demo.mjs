import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateSequenceCore } from "../../packages/domain/dist/sequences/generate.js";

if (process.env.NODE_ENV === "production")
  throw new Error("SYNTHETIC_DEMO_DISABLED");
const fixture = JSON.parse(
  readFileSync("tests/support/fixtures/engine.synthetic.json", "utf8"),
);
assert.equal(fixture.synthetic, true);
const result = evaluateSequenceCore(
  fixture.input,
  fixture.catalog,
  fixture.context,
);
assert.equal(result.synthetic, true);
const sample = result.pairs.find(
  (p) =>
    p.firstCropId === "synthetic-alpha" && p.secondCropId === "synthetic-beta",
);
assert.equal(sample.schedules.length, 6);
console.log(
  JSON.stringify(
    {
      synthetic: true,
      purpose:
        "Invented test crops and rules: engine demonstration only, never farmer advice",
      counts: result.counts,
      example: sample.schedules[0],
      pairs: result.pairs.map((p) => ({
        id: p.id,
        status: p.status,
        schedules: p.schedules.length,
        calendarRejections: p.calendarRejections,
      })),
      recommendations: null,
    },
    null,
    2,
  ),
);
