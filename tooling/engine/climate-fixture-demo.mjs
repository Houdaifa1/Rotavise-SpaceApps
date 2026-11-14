import assert from "node:assert/strict";
import { climateFixture } from "../../tests/support/climate.mjs";
import { assessHistoricalCore } from "../../packages/domain/dist/climate/assess.js";

if (process.env.NODE_ENV === "production")
  throw new Error("SYNTHETIC_DEMO_DISABLED");
const fixture = climateFixture();
const results = ["soil_health", "lower_water_demand"].map((priority) => {
  fixture.input.preferences.priority = priority;
  const r = assessHistoricalCore(
    fixture.input,
    fixture.catalog,
    fixture.context,
    fixture.weather,
    fixture.policy,
  );
  assert.equal(r.synthetic, true);
  assert.equal(r.outcome, "comparisons_available");
  const group = r.ranking.groups[0];
  return {
    priority,
    weights: r.ranking.weights,
    counts: r.sequence.counts,
    candidateAssessments: r.candidates.length,
    unranked: r.ranking.unranked.length,
    sharedAnchorYears: group.sharedAnchorYears,
    top: group.entries
      .filter((e) => e.rank === 1)
      .map((e) => ({
        scheduleId: e.scheduleId,
        weightedLoss: e.weightedLoss,
        components: e.components,
      })),
    sensitive: group.sensitive,
    samplePeriodDifference: r.candidates.find((c) => c.analogs.length)
      ?.periodComparison,
    recommendations: null,
  };
});
console.log(
  JSON.stringify(
    {
      synthetic: true,
      purpose: fixture.purpose,
      agricultureWarning:
        "No real crops, reviewed crop thresholds or historical observations; infrastructure demonstration only",
      results,
    },
    null,
    2,
  ),
);
