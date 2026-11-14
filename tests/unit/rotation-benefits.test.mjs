import { test, expect } from "@jest/globals";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  selectedBenefits,
  benefitSelections,
  benefitCoverScenarios,
  syncBenefitStrategies,
} from "../../packages/domain/dist/rotation/benefits.js";
import { rotationResources } from "../../packages/domain/dist/rotation/research.js";
import { assessRotationsCore } from "../../packages/domain/dist/rotation/assess.js";
import {
  rotationAssessmentSchema,
  rotationResourcesSchema,
} from "../../packages/contracts/dist/index.js";
import {
  rotationRequest,
  rotationPolicy,
  rotationWeather,
} from "../support/rotation.mjs";
const catalog = await loadCatalogRelease("data/catalog/releases/0.15.0");
const profiles = new Map(catalog.profiles.map((p) => [p.id, p]));
test("sourced evidence outranks retained recall, local evidence sorts first and carob is not a fixer", () => {
  const lentil = profiles.get("lentil");
  expect(
    lentil.research.benefits.records.some(
      (f) =>
        f.category === "biological_nitrogen_fixation" &&
        f.status === "model_recall",
    ),
  ).toBe(true);
  const selected = selectedBenefits(lentil, "biological_nitrogen_fixation");
  expect(
    selected.every((f) => !("status" in f) || f.status === "sourced"),
  ).toBe(true);
  expect(selected[0].nonLocal).toBe(false);
  expect(
    benefitSelections(profiles.get("carob")).find(
      (f) => f.category === "biological_nitrogen_fixation",
    ),
  ).toMatchObject({ status: "not_applicable", sourceIds: [] });
  expect(
    selectedBenefits(profiles.get("carob"), "biological_nitrogen_fixation")[0]
      .reason,
  ).toContain("non-nodulating");
  const missing = benefitSelections(undefined);
  expect(
    missing.every((e) => e.status === "no_data" && e.findingIds.length === 0),
  ).toBe(true);
});
test("new per-slot evidence distinguishes recalled knowledge, sources and not-applicable effects; earlier call shape stays unchanged", () => {
  const slots = [
    { cropId: "lentil" },
    { cropId: "barley" },
    { cropId: "desert-truffle" },
  ];
  const old = rotationResources(slots, profiles, null);
  expect(old.benefits.every((b) => b.effects === undefined)).toBe(true);
  const current = rotationResources(slots, profiles, null, true);
  expect(current.benefits.every((b) => b.effects.length === 12)).toBe(true);
  expect(current.benefits.every((b) => b.gapCategories.length === 0)).toBe(
    true,
  );
  expect(
    current.benefits[1].effects.find(
      (e) => e.category === "biological_nitrogen_fixation",
    ).status,
  ).toBe("not_applicable");
  expect(
    current.benefits[2].effects.find(
      (e) => e.category === "rooting_soil_structure_infiltration",
    ).status,
  ).toBe("not_applicable");
  expect(current.erosion.rankingApplied).toBe(false);
});
test("a crop without benefit data returns twelve valid no-data effects rather than a calculation failure", () => {
  const identityOnly = structuredClone(profiles.get("barley"));
  delete identityOnly.research;
  const resources = rotationResources(
    [{ cropId: "barley" }],
    new Map([["barley", identityOnly]]),
    null,
    true,
  );
  expect(resources.benefits[0].gapCategories).toHaveLength(12);
  expect(
    resources.benefits[0].effects.every((e) => e.status === "no_data"),
  ).toBe(true);
  expect(() => rotationResourcesSchema.parse(resources)).not.toThrow();
});
test("numeric sourced C observations are scenarios, recalled cover is never a C factor and incomplete RUSLE never ranks", () => {
  expect(benefitCoverScenarios(profiles.get("barley"))).toEqual([]);
  const olive = benefitCoverScenarios(profiles.get("olive"));
  expect(olive.length).toBeGreaterThan(0);
  expect(olive[0]).toMatchObject({
    range: { min: 0.38, max: 0.39 },
    unit: "dimensionless RUSLE C",
    nonLocal: true,
  });
  const r = rotationResources(
    [{ cropId: "olive" }],
    profiles,
    {
      terrain: {
        id: "synthetic-terrain",
        result: { erosion: { lsFactorMean: 2 } },
      },
    },
    true,
  );
  expect(r.erosion).toMatchObject({
    rankingApplied: false,
    soilLossTPerHaPerYear: null,
    missingFactors: expect.arrayContaining([
      "R",
      "K",
      "P",
      "verified_slope_length",
    ]),
  });
  expect(r.erosion.exposure[0].range).toEqual({ min: 0.76, max: 0.78 });
});
test("every strategy has crop benefit notes with explicit source/recall/gap references, including when no data exist", () => {
  const strategies = {
    items: [
      { cropIds: ["lentil", "barley"], notes: [] },
      { cropIds: ["unknown-crop"], notes: [] },
    ],
  };
  syncBenefitStrategies(strategies, profiles);
  expect(strategies.items[0].notes).toHaveLength(9);
  for (const n of strategies.items[0].notes) {
    expect(n.benefitEvidence.length).toBeGreaterThan(0);
    for (const e of n.benefitEvidence)
      expect(e.findingIds.length).toBeGreaterThan(0);
  }
  expect(
    strategies.items[1].notes.every(
      (n) =>
        n.text.includes("No data") &&
        n.benefitEvidence.every((e) => e.status === "no_data"),
    ),
  ).toBe(true);
});
test("format 2 benefits policy serves real evidence and C scenarios while the prior policy gets no new notes", () => {
  const input = rotationRequest({
    location: { latitude: 32.3, longitude: -6.3 },
    history: { status: "unknown" },
    preferences: {
      mode: "consider",
      considered_crop_ids: ["barley", "lentil"],
      excluded_crop_ids: [],
      priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
    },
  });
  const weather = rotationWeather();
  const run = (research) =>
    assessRotationsCore(
      input,
      catalog,
      weather,
      { ...rotationPolicy, outputs: "rotation-outputs-1", research },
      "2026-10-15",
      true,
      null,
      null,
      null,
      "rotation-engine-7",
    );
  const result = run("benefits-2");
  expect(() => rotationAssessmentSchema.parse(result)).not.toThrow();
  expect(result.catalogResearch.benefitVersion).toBe("benefits-2");
  expect(result.candidates.length).toBeGreaterThan(0);
  expect(
    result.strategies.items.every((s) =>
      s.notes.some(
        (n) => n.code === "BENEFIT_ORGANIC_MATTER" && n.benefitEvidence,
      ),
    ),
  ).toBe(true);
  expect(
    result.outputs.terrain.erosion.cropCover.find((c) => c.cropId === "olive"),
  ).toMatchObject({
    status: "sourced",
    factor: null,
    scenarios: expect.arrayContaining([
      expect.objectContaining({ range: { min: 0.38, max: 0.39 } }),
    ]),
  });
  const previous = run("income-benefits-1");
  expect(previous.catalogResearch.benefitVersion).toBeUndefined();
  expect(
    previous.strategies.items.every((s) =>
      s.notes.every((n) => n.benefitEvidence === undefined),
    ),
  ).toBe(true);
  expect(
    previous.candidates.map((c) => [c.id, c.rank, c.weightedLoss]),
  ).toEqual(result.candidates.map((c) => [c.id, c.rank, c.weightedLoss]));
});
