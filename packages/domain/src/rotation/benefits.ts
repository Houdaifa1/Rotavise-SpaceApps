import {
  benefitEffectCategories,
  researchCFactorSchema,
  type BenefitFinding,
  type BenefitRecord,
  type CropProfileV2,
  type RotationResources,
  type RotationStrategies,
  type StrategyNote,
} from "@rotavise/contracts";

type Evidence = BenefitFinding | BenefitRecord;
export function selectedBenefits(
  profile: CropProfileV2 | undefined,
  category: (typeof benefitEffectCategories)[number],
): Evidence[] {
  const all: Evidence[] = [
    ...(profile?.research?.benefits.findings ?? []),
    ...(profile?.research?.benefits.records ?? []),
  ].filter((f) => f.category === category);
  const sourced = all.filter((f) => !("status" in f) || f.status === "sourced");
  if (sourced.length)
    return [...sourced].sort((a, b) => Number(a.nonLocal) - Number(b.nonLocal));
  const recall = all.filter(
    (f) => "status" in f && f.status === "model_recall",
  );
  return recall.length ? recall : all;
}
export function benefitSelections(profile: CropProfileV2 | undefined) {
  return benefitEffectCategories.map((category) => {
    const records = selectedBenefits(profile, category);
    const first = records[0];
    return {
      category,
      status: !first
        ? ("no_data" as const)
        : !("status" in first) || first.status === "sourced"
          ? ("sourced" as const)
          : first.status === "model_recall"
            ? ("model_recall" as const)
            : ("not_applicable" as const),
      findingIds: records.map((f) => f.id),
      sourceIds: [
        ...new Set(records.flatMap((f) => f.citations.map((c) => c.sourceId))),
      ],
    };
  });
}
// Only explicit, sourced RUSLE C observations enter terrain scenarios. Recalled
// cover classes and historical USLE group values cannot become numeric C.
export function benefitCoverScenarios(profile: CropProfileV2) {
  return selectedBenefits(profile, "erosion_cover_residue").flatMap((f) => {
    if ("status" in f && f.status !== "sourced") return [];
    const parsed = researchCFactorSchema.safeParse(f.magnitude);
    if (!parsed.success) return [];
    const c = parsed.data;
    const values =
      "values" in c ? c.values.map((v) => v.value) : [c.min, c.max];
    return [
      {
        findingId: f.id,
        range: { min: Math.min(...values), max: Math.max(...values) },
        unit: "dimensionless RUSLE C" as const,
        nonLocal: f.nonLocal,
        conditions: f.conditions,
        citations: f.citations,
      },
    ];
  });
}
const noteGroups: {
  code: string;
  label: string;
  categories: (typeof benefitEffectCategories)[number][];
}[] = [
  {
    code: "BENEFIT_NITROGEN_FIXING_CROP",
    label: "Nitrogen fixation",
    categories: ["biological_nitrogen_fixation"],
  },
  {
    code: "BENEFIT_RESIDUAL_NITROGEN",
    label: "Nitrogen for the next crop",
    categories: ["residual_nitrogen_credit"],
  },
  {
    code: "BENEFIT_FORAGE_CROP",
    label: "Forage or straw",
    categories: ["forage_residue_feed"],
  },
  {
    code: "BENEFIT_EROSION_COVER",
    label: "Soil cover",
    categories: ["erosion_cover_residue", "bare_soil_period_shortening"],
  },
  {
    code: "BENEFIT_ORGANIC_MATTER",
    label: "Organic matter",
    categories: ["organic_matter_soil_carbon"],
  },
  {
    code: "BENEFIT_ROOTING_SOIL_STRUCTURE",
    label: "Rooting and soil structure",
    categories: ["rooting_soil_structure_infiltration"],
  },
  {
    code: "BENEFIT_DROUGHT_TOLERANCE",
    label: "Drought response",
    categories: ["drought_tolerance"],
  },
  {
    code: "BENEFIT_WATER_DEMAND",
    label: "Water demand",
    categories: ["water_demand"],
  },
  {
    code: "BENEFIT_PEST_CYCLE_BREAK",
    label: "Pest, disease and weed cycles",
    categories: ["disease_break", "pest_break", "weed_break"],
  },
];
export function syncBenefitStrategies(
  strategies: RotationStrategies,
  profiles: Map<string, CropProfileV2>,
): void {
  for (const strategy of strategies.items) {
    strategy.notes = strategy.notes.filter(
      (n) => !noteGroups.some((g) => g.code === n.code),
    );
    for (const group of noteGroups) {
      const crops = [...new Set(strategy.cropIds)];
      const evidence = crops.flatMap((cropId) =>
        benefitSelections(profiles.get(cropId))
          .filter((e) => group.categories.includes(e.category))
          .map((e) => ({ cropId, ...e })),
      );
      const first =
        evidence.find((e) => e.status === "sourced") ??
        evidence.find((e) => e.status === "model_recall");
      const record = first
        ? selectedBenefits(profiles.get(first.cropId), first.category)[0]
        : null;
      const status = evidence.some(
        (e) => e.status === "sourced" || e.status === "model_recall",
      );
      const detail = record
        ? `${first!.cropId}: ${record.effect}`
        : "No data supporting this benefit; consult each crop's not-applicable reason or evidence gap.";
      const provenance =
        first?.status === "sourced"
          ? "Sourced, conditional evidence"
          : first?.status === "model_recall"
            ? "Model recall, unverified"
            : "No data";
      const note: StrategyNote = {
        code: group.code,
        kind: status ? "benefit" : "gap",
        text: `${group.label}: ${detail.slice(0, 300)} ${provenance}. All crops, sources, other findings and conditions are linked below; no field response is guaranteed.`,
        facts: { basis: "crop_benefit_evidence", rankingApplied: false },
        benefitEvidence: evidence,
      };
      strategy.notes.push(note);
    }
  }
}
export type BenefitSelections = NonNullable<
  RotationResources["benefits"][number]["effects"]
>;
