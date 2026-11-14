import { test, expect } from "@jest/globals";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  cropIncome,
  rotationResources,
  rankResearchCandidates,
  researchCoverage,
} from "../../packages/domain/dist/rotation/research.js";
import { assessRotationsCore } from "../../packages/domain/dist/rotation/assess.js";
import { rotationAssessmentSchema } from "../../packages/contracts/dist/index.js";
import {
  rotationRequest,
  rotationPolicy,
  rotationWeather,
} from "../support/rotation.mjs";
const catalog = await loadCatalogRelease("data/catalog/releases/0.14.0");
const profiles = new Map(catalog.profiles.map((p) => [p.id, p]));
const request = rotationRequest({
  location: { latitude: 32.3, longitude: -6.3 },
  history: { status: "unknown" },
  preferences: {
    mode: "consider",
    considered_crop_ids: ["barley", "lentil", "spelt"],
    excluded_crop_ids: [],
    priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
    income_weight: 5,
  },
});
const policy = {
  ...rotationPolicy,
  outputs: "rotation-outputs-1",
  research: "income-benefits-1",
};
const slot = (cropId) => ({ cropId });
test("gross revenue derives only a dated compatible matched observation and lists untouched source inputs", () => {
  const barley = profiles.get("barley");
  const o = cropIncome(barley).find((o) => o.year === 2020);
  expect(o).toMatchObject({
    kind: "derived",
    currency: "MAD",
    year: 2020,
  });
  expect(o.range.min).toBeCloseTo((431.4 * 2350) / 1000, 8);
  expect(o.range.max).toBeCloseTo(o.range.min, 8);
  expect(o.inputs).toEqual([
    "barley-faostat-qcl-2020",
    "barley-faostat-pp-2020",
  ]);
  expect(
    barley.research.income.facts.find((f) => f.id === o.inputs[0]).unit,
  ).toBe("kg/ha");
  expect(
    barley.research.income.facts.find((f) => f.kind === "margins").definition,
  ).toContain("variable costs");
  expect(
    barley.research.income.facts.every(
      (f) => f.research.eligibleForCalculation === false,
    ),
  ).toBe(true);
  for (const mutate of [
    (f) => {
      f.year = null;
    },
    (f) => {
      f.unit = "UF/ha";
    },
    (f) => {
      f.commodity = "another product";
    },
    (f) => {
      f.region = "another region";
    },
    (f) => {
      f.scenarioId = null;
    },
  ]) {
    const p = structuredClone(barley);
    p.research.income.facts = p.research.income.facts.filter((f) =>
      o.inputs.includes(f.id),
    );
    mutate(p.research.income.facts.find((f) => f.kind === "yields"));
    expect(cropIncome(p)).toEqual([]);
  }
});
test("missing crops are gaps, never zero; a partial rotation has no total", () => {
  const resource = rotationResources(
    [slot("barley"), slot("spelt")],
    profiles,
    null,
  );
  expect(resource.income.status).toBe("gap");
  expect(resource.income.observations).toEqual([]);
  expect(resource.income.slots[1]).toMatchObject({
    status: "gap",
    reason: expect.stringContaining("No income data"),
  });
  expect(resource.erosion.rankingApplied).toBe(false);
});
test("income ranks only supported peers; unsupported positions and base scores stay unchanged; incompatible years cannot rank", () => {
  const rows = ["barley", "spelt", "tomato"].map((cropId, i) => ({
    id: cropId,
    rank: i + 1,
    weightedLoss: 0.5,
    tiedWith: [],
    slots: [slot(cropId)],
    resources: rotationResources([slot(cropId)], profiles, null),
  }));
  expect(
    rankResearchCandidates(rows, {
      ...request,
      preferences: { ...request.preferences, income_weight: 0 },
    }),
  ).toEqual(rows);
  const ranked = rankResearchCandidates(rows, request);
  expect(ranked.map((r) => r.id)).toEqual(["tomato", "spelt", "barley"]);
  expect(ranked[1]).toEqual(rows[1]);
  expect(ranked[0].weightedLoss).toBe(0.5);
  expect(ranked[0].resources.income.ranking).toMatchObject({
    applied: true,
    year: 2024,
  });
  expect(ranked[0].resources.income.ranking.reason).toContain("never zero");
  const noCommon = structuredClone(rows);
  noCommon[2].resources.income.observations.forEach((o) => {
    o.year = 1800;
  });
  expect(rankResearchCandidates(noCommon, request)).toEqual(noCommon);
});
test("benefits preserve following-crop context, conflicting numbers, non-local C restrictions and missing nitrogen credits", () => {
  const r = rotationResources(
    [slot("alfalfa"), slot("barley"), slot("olive")],
    profiles,
    null,
  );
  expect(r.benefits[0]).toMatchObject({
    followingCropId: "barley",
    status: "conditional_context",
  });
  const alfalfa = profiles
    .get("alfalfa")
    .research.benefits.findings.find(
      (f) => f.category === "residual_nitrogen_credit",
    );
  expect(alfalfa.magnitude.status).toBe("not_found");
  expect(alfalfa.conditions.join(" ")).toContain("lodging");
  expect(
    profiles
      .get("chickpea")
      .research.benefits.findings.some(
        (f) => f.magnitude.status === "conflicting",
      ),
  ).toBe(true);
  const olive = profiles
    .get("olive")
    .research.benefits.findings.find(
      (f) => f.category === "erosion_cover_residue",
    );
  expect(olive.nonLocal).toBe(true);
  expect(r.erosion.exposure).toEqual([]);
  // Explicitly controlled terrain summary, not real field evidence.
  const context = {
    terrain: {
      id: "synthetic-terrain",
      result: { erosion: { lsFactorMean: 2 } },
    },
  };
  const exposure = rotationResources(
    [slot("olive")],
    profiles,
    context,
  ).erosion;
  expect(exposure.exposure[0]).toMatchObject({
    kind: "derived",
    nonLocal: true,
    rankingApplied: false,
    range: { min: 2 * 0.38, max: 2 * 0.39 },
  });
  expect(exposure.missingFactors).toEqual(
    expect.arrayContaining(["R", "K", "P", "locally_applicable_management_C"]),
  );
  expect(exposure.soilLossTPerHaPerYear).toBeNull();
});
test("pinned engine exposes coverage and per-strategy references within the unchanged 25-second speed bound", () => {
  const started = performance.now();
  const result = assessRotationsCore(
    request,
    catalog,
    rotationWeather(),
    policy,
    "2026-10-15",
    true,
    null,
    null,
    null,
    "rotation-engine-7",
  );
  expect((performance.now() - started) / 1000).toBeLessThan(25);
  expect(() => rotationAssessmentSchema.parse(result)).not.toThrow();
  expect(result.catalogResearch.comparedCrops).toBeGreaterThan(0);
  const shown = researchCoverage(result.candidates, profiles, request);
  expect(
    shown.comparedCropIds.every((id) =>
      result.catalogResearch.comparedCropIds.includes(id),
    ),
  ).toBe(true);
  expect(result.catalogResearch.incomeDerivable).toBe(
    result.catalogResearch.comparedCropIds.filter(
      (id) => cropIncome(profiles.get(id)).length,
    ).length,
  );
  expect(result.catalogResearch.comparedCrops).toBe(
    result.catalogResearch.comparedCropIds.length,
  );
  expect(
    result.strategies.items.every(
      (s) => s.resources.income && s.resources.benefits,
    ),
  ).toBe(true);
  expect(result.outputs.priorities.some((p) => p.id === "income_weight")).toBe(
    false,
  );
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(8388608);
});
test("legacy policies add no research output, and catalogs without research keep identical result bytes", async () => {
  const oldCatalog = await loadCatalogRelease("data/catalog/releases/0.13.0");
  const oldPolicy = { ...policy };
  delete oldPolicy.research;
  const old = assessRotationsCore(
    request,
    oldCatalog,
    [],
    oldPolicy,
    "2026-10-15",
    true,
  );
  const pinned = assessRotationsCore(
    request,
    oldCatalog,
    [],
    policy,
    "2026-10-15",
    true,
  );
  delete pinned.policy.research;
  expect(JSON.stringify(pinned)).toBe(JSON.stringify(old));
  const legacy = assessRotationsCore(
    request,
    catalog,
    [],
    oldPolicy,
    "2026-10-15",
    true,
  );
  expect(legacy.catalogResearch).toBeUndefined();
  expect(legacy.candidates.every((c) => c.resources === undefined)).toBe(true);
});
