import { benefitSelections } from "./benefits.js";
import { researchCFactorSchema as cMagnitude } from "@rotavise/contracts";
import type {
  CropProfileV2,
  IncomeFact,
  PlanRequestV2,
  RotationCandidate,
  RotationResources,
  RotationAnalysisContext,
} from "@rotavise/contracts";

type Observation = RotationResources["income"]["observations"][number];
const range = (v: IncomeFact["value"]) =>
  typeof v === "number" ? { min: v, max: v } : v;
const GAP =
  "No income data: requires sourced price and yield for the same crop/product, scenario, region and stated observation year, with compatible mass/area units. Undated budgets, feed units and published margins are not substituted.";

// Exact dimensional identity, not inflation, an exchange rate, a yield model or
// a farm-income forecast. Original kg/ha and LCU/tonne stay in the input facts.
function massScale(price: string, yieldUnit: string): number | null {
  if (price === "LCU/tonne" && yieldUnit === "kg/ha") return 1 / 1000;
  if (price === "MAD/kg" && yieldUnit === "kg/ha") return 1;
  if (price === "MAD/tonne" && yieldUnit === "tonne/ha") return 1;
  return null;
}
export function cropIncome(profile: CropProfileV2): Observation[] {
  const facts = profile.research?.income.facts ?? [];
  const observations: Observation[] = [];
  for (const price of facts.filter((f) => f.kind === "prices")) {
    if (
      typeof price.year !== "number" ||
      price.currency !== "MAD" ||
      !price.commodity ||
      !price.scenarioId
    )
      continue;
    for (const yieldFact of facts.filter((f) => f.kind === "yields")) {
      if (
        yieldFact.year !== price.year ||
        yieldFact.region !== price.region ||
        yieldFact.commodity !== price.commodity ||
        yieldFact.scenarioId !== price.scenarioId
      )
        continue;
      const scale = massScale(price.unit, yieldFact.unit);
      const p = range(price.value),
        y = range(yieldFact.value);
      if (scale === null || Math.min(p.min, y.min) < 0) continue;
      const min = p.min * y.min * scale,
        max = p.max * y.max * scale;
      if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
      observations.push({
        kind: "derived",
        year: price.year,
        region: price.region,
        currency: "MAD",
        unit: "MAD/ha per rotation",
        range: { min, max },
        formula:
          scale === 1 / 1000
            ? "yield (kg/ha) * price (MAD/tonne) / 1000 (exact kg per tonne)"
            : "yield * price; matching mass units",
        inputs: [yieldFact.id, price.id],
      });
    }
  }
  return observations;
}
export function hasResearchC(p: CropProfileV2, benefitsV2 = false): boolean {
  return (
    [
      ...(p.research?.benefits.findings ?? []),
      ...(benefitsV2 ? (p.research?.benefits.records ?? []) : []),
    ].some(
      (f) =>
        f.category === "erosion_cover_residue" &&
        cMagnitude.safeParse(f.magnitude).success,
    ) ?? false
  );
}
export function rotationResources(
  slots: Pick<RotationCandidate, "slots">["slots"],
  profiles: Map<string, CropProfileV2>,
  context: RotationAnalysisContext | null,
  benefitsV2 = false,
): RotationResources {
  const income = slots.map((s) => cropIncome(profiles.get(s.cropId)!));
  // A rotation total requires ALL its slots, in one observation year/region.
  // Never fill a missing slot with zero or join unrelated years/regions.
  const keys = [
    ...new Set(income.flat().map((o) => JSON.stringify([o.year, o.region]))),
  ].sort();
  const observations: Observation[] = [];
  for (const key of keys) {
    const [year, region] = JSON.parse(key) as [number, string];
    const parts = income.map((values) =>
      values.filter((o) => o.year === year && o.region === region),
    );
    // Multiple incompatible budget scenarios are not arbitrarily selected.
    if (parts.some((v) => v.length !== 1)) continue;
    const rows = parts.map((v) => v[0]!);
    observations.push({
      kind: "derived",
      year,
      region,
      currency: "MAD",
      unit: "MAD/ha per rotation",
      range: {
        min: rows.reduce((n, r) => n + r.range.min, 0),
        max: rows.reduce((n, r) => n + r.range.max, 0),
      },
      formula:
        "sum of slot gross revenues using the same historical observation year/region; repeated crops repeat their inputs; no costs deducted",
      inputs: rows.flatMap((r) => r.inputs),
    });
  }
  const ls = context?.terrain?.result.erosion?.lsFactorMean;
  const exposure: RotationResources["erosion"]["exposure"] = [];
  slots.forEach((s, i) => {
    for (const f of [
      ...(profiles.get(s.cropId)!.research?.benefits.findings ?? []),
      ...(benefitsV2
        ? (profiles.get(s.cropId)!.research?.benefits.records ?? [])
        : []),
    ]) {
      if (f.category !== "erosion_cover_residue" || ls === undefined) continue;
      const parsed = cMagnitude.safeParse(f.magnitude);
      if (!parsed.success) continue;
      const c = parsed.data;
      const values =
        "values" in c ? c.values.map((v) => v.value) : [c.min, c.max];
      exposure.push({
        kind: "derived",
        slot: i + 1,
        cropId: s.cropId,
        range: { min: ls * Math.min(...values), max: ls * Math.max(...values) },
        unit: "dimensionless LS*C",
        formula: "LS * C; partial RUSLE exposure, not soil loss",
        inputs: [
          `terrain:${context!.terrain!.id}:lsFactorMean=${ls}`,
          f.id,
          ...f.citations.map((c) => c.quoteCheck),
        ],
        nonLocal: f.nonLocal,
        conditions: f.conditions,
        rankingApplied: false,
      });
    }
  });
  return {
    income: {
      status: observations.length ? "derived" : "gap",
      code: observations.length ? "HISTORICAL_GROSS_REVENUE" : "NO_INCOME_DATA",
      reason: observations.length
        ? "Historical gross revenue scenarios, not current income, net profit, a farm distribution or a forecast. Research eligibility flags remain unchanged; these derived scenarios do not make them production forecasts."
        : GAP,
      observations,
      slots: slots.map((s, i) => ({
        slot: i + 1,
        cropId: s.cropId,
        status: income[i]!.length ? "derived" : "gap",
        reason: income[i]!.length
          ? "Dated compatible source observations; original units retained in facts."
          : GAP,
        factIds:
          profiles.get(s.cropId)!.research?.income.facts.map((f) => f.id) ?? [],
        inputIds: income[i]!.flatMap((o) => o.inputs),
      })),
      ranking: {
        applied: false,
        year: null,
        combinedLoss: null,
        derivation: null,
        reason:
          "Income weight unapplied: no comparable supported peer cohort or weight is zero. Missing data is not zero revenue.",
      },
    },
    benefits: slots.map((s, i) => ({
      slot: i + 1,
      cropId: s.cropId,
      followingCropId: slots[i + 1]?.cropId ?? null,
      status: "conditional_context",
      findingIds: benefitsV2
        ? [
            ...(profiles.get(s.cropId)!.research?.benefits.findings ?? []),
            ...(profiles.get(s.cropId)!.research?.benefits.records ?? []),
          ].map((f) => f.id)
        : (profiles
            .get(s.cropId)!
            .research?.benefits.findings.map((f) => f.id) ?? []),
      ...(benefitsV2
        ? { effects: benefitSelections(profiles.get(s.cropId)) }
        : {}),
      gapCategories: benefitsV2
        ? benefitSelections(profiles.get(s.cropId))
            .filter((e) => e.status === "no_data")
            .map((e) => e.category)
        : (profiles
            .get(s.cropId)!
            .research?.benefits.gaps.map((g) => g.category) ?? ["all"]),
    })),
    erosion: {
      code: "EROSION_FACTORS_MISSING",
      rankingApplied: false,
      soilLossTPerHaPerYear: null,
      missingFactors: [
        "R",
        "K",
        "P",
        "locally_applicable_management_C",
        ...(ls === undefined ? ["LS"] : ["verified_slope_length"]),
      ],
      exposure,
      reason:
        "Unranked: LS*C is partial RUSLE exposure only. R, K and P are absent; terrain slope length is assumed. Non-local C scenarios retain conditions and never replace Moroccan evidence. No rotation-average C, soil loss or erosion rank is inferred.",
    },
  };
}
export const INCOME_TREATMENT =
  "Income reorders only fully supported candidates within their existing base-order positions, using the latest common historical year and identical region across that cohort. Unsupported candidates keep their positions and base loss; missing crops are never zero revenue. Income loss uses conservative gross-revenue bounds, not profit. Climate sensitivity and Pareto flags describe the original four dimensions; the beam search is unchanged.";
export function rankResearchCandidates<
  C extends {
    id: string;
    rank: number;
    weightedLoss: number;
    tiedWith: string[];
    resources?: RotationResources | undefined;
  },
>(candidates: C[], input: PlanRequestV2): C[] {
  candidates = candidates.map((c) =>
    c.resources?.income.ranking.applied
      ? {
          ...c,
          resources: {
            ...c.resources,
            income: {
              ...c.resources.income,
              ranking: {
                applied: false,
                year: null,
                combinedLoss: null,
                derivation: null,
                reason:
                  "Income weight unapplied: no comparable supported peer cohort or weight is zero. Missing data is not zero revenue.",
              },
            },
          },
        }
      : c,
  );
  const weight = input.preferences.income_weight ?? 0;
  if (!weight) return candidates;
  const eligible = candidates.filter(
    (c) => c.resources?.income.observations.length,
  );
  if (eligible.length < 2) return candidates;
  const common = eligible[0]!
    .resources!.income.observations.filter((o) =>
      eligible.every((c) =>
        c.resources!.income.observations.some(
          (v) => v.year === o.year && v.region === o.region,
        ),
      ),
    )
    .sort(
      (a, b) =>
        b.year - a.year ||
        (a.region < b.region ? -1 : a.region > b.region ? 1 : 0),
    )[0];
  if (!common) return candidates;
  const rows = eligible.map((c) => ({
    c,
    revenue: c.resources!.income.observations.find(
      (o) => o.year === common.year && o.region === common.region,
    )!.range.min,
  }));
  const low = Math.min(...rows.map((r) => r.revenue)),
    high = Math.max(...rows.map((r) => r.revenue));
  if (low === high) return candidates;
  const priorities = input.preferences.priorities;
  const baseWeight = Object.values(priorities).reduce((a, b) => a + b, 0) || 1;
  const scored = rows
    .map(({ c, revenue }) => ({
      c,
      loss:
        (c.weightedLoss * baseWeight +
          ((high - revenue) / (high - low)) * weight) /
        (baseWeight + weight),
    }))
    .sort((a, b) => a.loss - b.loss || (a.c.id < b.c.id ? -1 : 1));
  const eligibleIds = new Set(eligible.map((c) => c.id));
  let pos = 0;
  return candidates.map((original, i) => {
    if (!eligibleIds.has(original.id)) return original;
    const { c, loss } = scored[pos++]!;
    return {
      ...c,
      rank: i + 1,
      tiedWith: [],
      resources: {
        ...c.resources!,
        income: {
          ...c.resources!.income,
          ranking: {
            applied: true,
            year: common.year,
            combinedLoss: loss,
            derivation: {
              kind: "derived",
              formula:
                "(baseLoss * baseWeight + (maximumCohortRevenue - grossRevenue) / (maximumCohortRevenue - minimumCohortRevenue) * incomeWeight) / (baseWeight + incomeWeight)",
              inputs: {
                baseLoss: c.weightedLoss,
                baseWeight,
                incomeWeight: weight,
                minimumCohortRevenue: low,
                maximumCohortRevenue: high,
                grossRevenue: rows.find((r) => r.c.id === c.id)!.revenue,
              },
            },
            reason: INCOME_TREATMENT,
          },
        },
      },
    };
  });
}
export function researchCoverage(
  candidates: RotationCandidate[],
  profiles: Map<string, CropProfileV2>,
  input: PlanRequestV2,
  benefitsV2 = false,
) {
  const ids = [
    ...new Set(candidates.flatMap((c) => c.slots.map((s) => s.cropId))),
  ].sort();
  return {
    version: "income-benefits-1" as const,
    ...(benefitsV2 ? { benefitVersion: "benefits-2" as const } : {}),
    crops: ids.map((id) => ({
      cropId: id,
      ...(profiles.get(id)!.research
        ? { evidence: profiles.get(id)!.research }
        : {}),
    })),
    comparedCropIds: ids,
    comparedCrops: ids.length,
    incomeInputs: ids.filter(
      (id) => profiles.get(id)?.research?.income.facts.length,
    ).length,
    incomeDerivable: ids.filter((id) => cropIncome(profiles.get(id)!).length)
      .length,
    benefits: ids.filter(
      (id) =>
        profiles.get(id)?.research?.benefits.findings.length ||
        (benefitsV2 && profiles.get(id)?.research?.benefits.records?.length),
    ).length,
    erosionC: ids.filter((id) => hasResearchC(profiles.get(id)!, benefitsV2))
      .length,
    erosionRankable: 0 as const,
    ranking: {
      scope: "all_compared" as const,
      requestedIncomeWeight: input.preferences.income_weight ?? 0,
      appliedCandidates: candidates.filter(
        (c) => c.resources?.income.ranking.applied,
      ).length,
      code: "INCOME_SUPPORTED_PEERS_ONLY" as const,
      treatment: INCOME_TREATMENT,
    },
  };
}

// Keep old strategy prose intact for older pins. New pins distinguish the base
// loss from historical-income ordering and current market-data gaps.
export function syncResearchStrategies(
  strategies: import("@rotavise/contracts").RotationStrategies,
  candidates: RotationCandidate[],
): void {
  for (const strategy of strategies.items) {
    const resources = candidates.find(
      (c) => c.id === strategy.candidateId,
    )?.resources;
    if (!resources) continue;
    strategy.resources = resources;
    for (const note of strategy.notes) {
      if (note.code === "GAP_NO_MARKET_DATA")
        note.text =
          "Current local market-access requirements and current prices remain unavailable. Historical gross revenue scenarios and published accounting definitions are listed in the sourced resources; they do not establish current profit.";
      if (note.code === "WHY_RANKED_BY_PRIORITIES")
        note.text = `Ranked ${strategy.rank}; base priority loss ${strategy.weightedLoss}. Historical income ${resources.income.ranking.applied ? "also reorders the supported peer cohort" : "does not change this rotation's position"}; see resources for the inputs and treatment of gaps.`;
    }
  }
}
