import type {
  CatalogBundleV2,
  PlanRequestV2,
  RotationAssessmentV6,
  RotationCandidate,
  RotationReason,
  RotationStrategies,
  RotationStrategy,
  StrategyNote,
} from "@rotavise/contracts";
import { daysBetween as elapsedDays } from "./days.js";

// Engine 7: the farmer's current rotation beside at least two alternatives,
// each explained with keyed notes. Everything here is derived from the ranked
// candidates; it never changes a score or a rank.
type Dimension = "climate" | "water" | "soil_health" | "crop_health";
const dimensions: Dimension[] = [
  "climate",
  "water",
  "soil_health",
  "crop_health",
];
const dimensionLabel: Record<Dimension, string> = {
  climate: "climate",
  water: "water",
  soil_health: "soil health",
  crop_health: "crop health",
};
type Facts = StrategyNote["facts"];
export type RuleCounts = {
  extracted: number;
  double_checked: number;
  expert_reviewed: number;
  model_recall: number;
};
export type StrategyBaseline = RotationStrategies["baseline"] & {
  candidateId: string | null;
};
export type StrategyInputs = {
  input: PlanRequestV2;
  catalog: CatalogBundleV2;
  // Candidates with their future-climate block; must include the baseline and
  // the chosen alternatives.
  candidates: RotationCandidate[];
  baseline: StrategyBaseline;
  alternativeIds: string[];
  applied: RotationAssessmentV6["ranking"]["weights"];
  dimensions: RotationAssessmentV6["dimensions"];
  rulesByCrop: Map<string, RuleCounts>;
  reasons: RotationReason[];
  rainSource: RotationAssessmentV6["rain"]["source"];
  weatherSnapshots: number;
  futureStatus: RotationAssessmentV6["futureClimate"]["status"];
  horizonEnd: string;
  comparedCount: number;
};

const note = (
  kind: StrategyNote["kind"],
  code: string,
  text: string,
  facts: Facts = {},
): StrategyNote => ({ kind, code, text, facts });
const cropsOf = (c: Pick<RotationCandidate, "slots">) =>
  c.slots.map((s) => s.cropId);
export const sequenceKey = (c: Pick<RotationCandidate, "slots">) =>
  cropsOf(c).join(">");
const fixed = (v: number) => Number(v.toFixed(3));
const list = (ids: string[]) => ids.join(", ");

// The best-ranked rotations whose crop order differs from the baseline and
// from each other; the same crops on other dates are not a new strategy.
export function pickAlternativeIds(
  ranked: Pick<RotationCandidate, "id" | "slots">[],
  baselineId: string | null,
  max = 3,
): string[] {
  const baseline = ranked.find((c) => c.id === baselineId);
  const seen = new Set(baseline ? [sequenceKey(baseline)] : []);
  const ids: string[] = [];
  for (const c of ranked) {
    if (c.id === baselineId || seen.has(sequenceKey(c))) continue;
    seen.add(sequenceKey(c));
    ids.push(c.id);
    if (ids.length === max) break;
  }
  return ids;
}

export function buildStrategies(i: StrategyInputs): RotationStrategies {
  const byId = new Map(i.candidates.map((c) => [c.id, c]));
  const profile = (id: string) => i.catalog.profiles.find((p) => p.id === id);
  const current = i.baseline.candidateId
    ? (byId.get(i.baseline.candidateId) ?? null)
    : null;
  const context = i.input.farmer_context ?? null;
  const horizonStart = i.input.planning.earliest_start_date;
  const horizonDays = Math.max(1, elapsedDays(horizonStart, i.horizonEnd));
  const compared = dimensions.filter(
    (d) => i.dimensions.find((x) => x.id === d)?.status === "compared",
  );
  const families = (c: RotationCandidate) =>
    cropsOf(c).map((id) => profile(id)?.identity.family ?? "unknown");
  const sameFamilyRuns = (c: RotationCandidate) => {
    const f = families(c);
    return f.filter((x, k) => k > 0 && x === f[k - 1]).length;
  };
  const meanFuture = (c: RotationCandidate) => {
    const values = (c.future?.scenarios ?? []).flatMap((s) =>
      s.meanChange === null ? [] : [s.meanChange],
    );
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  };
  const delta = (c: RotationCandidate, d: Dimension): number | null => {
    if (!current) return null;
    const a = d === "climate" ? c.scores.climate?.meanLoss : c.scores[d];
    const b =
      d === "climate" ? current.scores.climate?.meanLoss : current.scores[d];
    return a == null || b == null ? null : fixed(a - b);
  };
  const counts = (c: RotationCandidate): RuleCounts => {
    const total: RuleCounts = {
      extracted: 0,
      double_checked: 0,
      expert_reviewed: 0,
      model_recall: 0,
    };
    for (const id of new Set(cropsOf(c))) {
      const r = i.rulesByCrop.get(id);
      if (!r) continue;
      total.extracted += r.extracted;
      total.double_checked += r.double_checked;
      total.expert_reviewed += r.expert_reviewed;
      total.model_recall += r.model_recall;
    }
    return total;
  };
  const bareDays = (c: RotationCandidate) => {
    const growing = c.slots.reduce(
      (n, s) => n + (s.durationDays.min + s.durationDays.max) / 2,
      0,
    );
    return Math.max(0, Math.round(horizonDays - growing));
  };

  const describe = (
    c: RotationCandidate,
    id: RotationStrategy["id"],
    role: RotationStrategy["role"],
    source: RotationStrategy["source"],
  ): RotationStrategy => {
    const rules = counts(c);
    const sourced =
      rules.extracted + rules.double_checked + rules.expert_reviewed;
    const crops = [...new Set(cropsOf(c))];
    const notes: StrategyNote[] = [];
    const change = (d: Dimension) => (role === "current" ? null : delta(c, d));
    const loss = current ? fixed(c.weightedLoss - current.weightedLoss) : null;

    notes.push(
      note(
        "why",
        "WHY_RANKED_BY_PRIORITIES",
        `Ranked ${c.rank} of ${i.comparedCount} rotations compared on your priorities (weighted loss ${fixed(c.weightedLoss)}; lower is better).`,
        {
          rank: c.rank,
          compared: i.comparedCount,
          weightedLoss: fixed(c.weightedLoss),
        },
      ),
    );
    if (role === "alternative" && loss !== null)
      notes.push(
        loss < 0
          ? note(
              "why",
              "WHY_LOWER_LOSS_THAN_CURRENT",
              `Suggested because it has less weighted loss than your current rotation (${fixed(-loss)} lower).`,
              { weightedLossChange: loss },
            )
          : note(
              "why",
              "WHY_NOT_BETTER_THAN_CURRENT",
              "Shown as a different option, but it is not better than your current rotation on your priorities.",
              { weightedLossChange: loss },
            ),
      );
    for (const d of compared) {
      const own = d === "climate" ? c.scores.climate?.meanLoss : c.scores[d];
      if (own == null) continue;
      const others = i.candidates
        .filter((x) => i.alternativeIds.includes(x.id) || x === current)
        .filter((x) => x !== c)
        .map((x) =>
          d === "climate" ? x.scores.climate?.meanLoss : x.scores[d],
        )
        .filter((v): v is number => v != null);
      if (others.length && others.every((v) => own < v))
        notes.push(
          note(
            "why",
            "WHY_BEST_ON_DIMENSION",
            `Lowest ${dimensionLabel[d]} loss of the strategies shown.`,
            { dimension: d, loss: fixed(own) },
          ),
        );
    }

    notes.push(
      note(
        "evidence",
        "EVIDENCE_RULE_SOURCES",
        `Uses ${sourced + rules.model_recall} crop rules: ${sourced} from sources (${rules.double_checked} double-checked, ${rules.expert_reviewed} expert-reviewed, ${rules.extracted} extracted) and ${rules.model_recall} recalled by AI and not checked against a source.`,
        { ...rules, sourced, crops: list(crops) },
      ),
      note(
        "evidence",
        "EVIDENCE_WEATHER",
        i.rainSource === "power_corrected_to_gpm"
          ? `Weather: NASA POWER daily data from ${i.weatherSnapshots} snapshot(s), with rain corrected using NASA GPM IMERG.`
          : `Weather: NASA POWER daily data from ${i.weatherSnapshots} snapshot(s); rain not corrected with satellite rain data.`,
        { rainSource: i.rainSource, snapshots: i.weatherSnapshots },
      ),
    );
    const future = meanFuture(c);
    if (future !== null)
      notes.push(
        note(
          "evidence",
          "EVIDENCE_FUTURE_CLIMATE",
          `Future climate (NASA NEX-GDDP-CMIP6, five models): mean change in climate loss ${fixed(future)} (positive means worse).`,
          { meanChange: fixed(future) },
        ),
      );
    else if (i.futureStatus === "unavailable")
      notes.push(
        note(
          "gap",
          "GAP_FUTURE_CLIMATE_UNAVAILABLE",
          "Future climate was not compared for this field's area yet.",
        ),
      );
    const bare = bareDays(c);
    notes.push(
      note(
        "evidence",
        "EVIDENCE_BARE_FIELD_SHARE",
        `By the crop calendar the field has no crop for about ${bare} of ${horizonDays} days (${Math.round((bare / horizonDays) * 100)}%). This is from sowing and harvest windows, not from satellite images.`,
        {
          bareDays: bare,
          horizonDays,
          share: fixed(bare / horizonDays),
          basis: "crop_calendar",
        },
      ),
    );

    const fixers = crops.filter(
      (id) => profile(id)?.identity.family === "Fabaceae",
    );
    if (fixers.length)
      notes.push(
        note(
          "benefit",
          "BENEFIT_NITROGEN_FIXING_CROP",
          `Includes ${list(fixers)}, from the legume family (Fabaceae), which can fix nitrogen. The family is taken from the catalog; nitrogen amounts are not modelled.`,
          { crops: list(fixers), basis: "botanical_family" },
        ),
      );
    if (role === "alternative") {
      const own = new Set(families(c)).size;
      const base = current ? new Set(families(current)).size : null;
      if (base !== null && own > base)
        notes.push(
          note(
            "benefit",
            "BENEFIT_MORE_CROP_FAMILIES",
            `Uses ${own} crop families against ${base} in your current rotation, which spreads pest and disease pressure.`,
            { families: own, currentFamilies: base },
          ),
        );
      if (current && sameFamilyRuns(c) < sameFamilyRuns(current))
        notes.push(
          note(
            "benefit",
            "BENEFIT_FEWER_SAME_FAMILY_REPEATS",
            "Fewer back-to-back crops from the same family, which helps interrupt pest cycles.",
            {
              repeats: sameFamilyRuns(c),
              currentRepeats: sameFamilyRuns(current),
            },
          ),
        );
      for (const [d, code, text] of [
        [
          "water",
          "BENEFIT_LOWER_WATER_LOSS",
          "Lower water-stress loss than your current rotation.",
        ],
        [
          "climate",
          "BENEFIT_LOWER_CLIMATE_LOSS",
          "Less climate loss (heat and cold damage) than your current rotation.",
        ],
        [
          "soil_health",
          "BENEFIT_BETTER_PREDECESSOR_FIT",
          "Its crop changes follow the sourced preferred predecessors more often than your current rotation.",
        ],
        [
          "crop_health",
          "BENEFIT_FEWER_HEALTH_WARNINGS",
          "Fewer crop-health break warnings than your current rotation.",
        ],
      ] as const) {
        const change = delta(c, d);
        if (change !== null && change < 0)
          notes.push(
            note("benefit", code, `${text} (${fixed(-change)} lower).`, {
              change,
            }),
          );
      }
      if (future !== null && current) {
        const base = meanFuture(current);
        if (base !== null && future < base)
          notes.push(
            note(
              "benefit",
              "BENEFIT_BETTER_UNDER_FUTURE_CLIMATE",
              "Holds up better than your current rotation under the future climate scenarios.",
              { meanChange: fixed(future), currentMeanChange: fixed(base) },
            ),
          );
      }
    }
    const forage = crops.filter(
      (id) => profile(id)?.harvestProduct === "forage",
    );
    if (forage.length && (context === null || context.forage_need !== "none"))
      notes.push(
        note(
          "benefit",
          "BENEFIT_FORAGE_CROP",
          `Includes forage crop(s) ${list(forage)}, useful for feeding livestock.`,
          { crops: list(forage) },
        ),
      );

    for (const d of dimensions) {
      if (compared.includes(d)) continue;
      const reason = i.dimensions.find((x) => x.id === d)?.reason;
      notes.push(
        note(
          "gap",
          "GAP_DIMENSION_NOT_COMPARED",
          `${dimensionLabel[d][0]!.toUpperCase()}${dimensionLabel[d].slice(1)} was not compared: ${reason ?? "not enough evidence"}`,
          { dimension: d },
        ),
      );
    }
    notes.push(
      note(
        "gap",
        "GAP_NO_MARKET_DATA",
        context?.market_preference === "cash_income"
          ? "You want cash income, but the catalog has no prices or market data, so income is not compared. Check local prices before choosing."
          : "The catalog has no prices or market data, so income and market suitability are not compared.",
        { marketPreference: context?.market_preference ?? "unknown" },
      ),
      note(
        "gap",
        "GAP_EROSION_NOT_ASSESSED",
        context?.erosion_concern === "high"
          ? "You are concerned about erosion, but slope and terrain data are not used yet, so erosion and infiltration are not assessed. Ask a local adviser."
          : "Erosion and infiltration are not assessed: no slope or terrain data is used yet.",
        { erosionConcern: context?.erosion_concern ?? "unknown" },
      ),
    );
    if (context?.equipment && context.equipment !== "standard")
      notes.push(
        note(
          "gap",
          "GAP_NO_EQUIPMENT_DATA",
          "The catalog has no machinery requirements, so equipment limits are not checked for these crops.",
          { equipment: context.equipment },
        ),
      );
    if (rules.model_recall > 0)
      notes.push(
        note(
          "gap",
          "GAP_RECALLED_RULES",
          `${rules.model_recall} of the rules used were recalled by AI and not checked against a source.`,
          { modelRecall: rules.model_recall },
        ),
      );

    notes.push(
      note(
        "risk",
        "RISK_LOCAL_REVIEW",
        "Have a local agronomist review this strategy before you act on it.",
      ),
    );
    const conditions = c.reasons.filter(
      (r) => r.effect === "condition" || r.effect === "failure",
    );
    if (conditions.length) {
      const codes = [...new Set(conditions.map((r) => r.code))].slice(0, 4);
      notes.push(
        note(
          "risk",
          "RISK_RULE_CONDITIONS",
          `${conditions.length} rule condition(s) apply and need local checking: ${list(codes)}.`,
          { conditions: conditions.length, codes: list(codes) },
        ),
      );
    }
    const arid = i.reasons.filter(
      (r) =>
        r.code === "RAINFED_ARID_RISK" && r.cropId && crops.includes(r.cropId),
    );
    if (arid.length)
      notes.push(
        note(
          "risk",
          "RISK_RAINFED_ARID",
          `Rainfed ${list([...new Set(arid.map((r) => r.cropId!))])} is very uncertain at this field's rainfall.`,
          { crops: list([...new Set(arid.map((r) => r.cropId!))]) },
        ),
      );
    if (future !== null && future > 0)
      notes.push(
        note(
          "risk",
          "RISK_WORSE_UNDER_FUTURE_CLIMATE",
          "Climate loss is higher under the future climate scenarios than in the past.",
          { meanChange: fixed(future) },
        ),
      );

    return {
      id,
      role,
      source,
      candidateId: c.id,
      cropIds: cropsOf(c),
      rank: c.rank,
      weightedLoss: c.weightedLoss,
      scores: c.scores,
      versusCurrent:
        role === "alternative" && loss !== null
          ? {
              weightedLoss: loss,
              climate: change("climate"),
              water: change("water"),
              soil_health: change("soil_health"),
              crop_health: change("crop_health"),
            }
          : null,
      evidence: { crops: crops.length ? crops : cropsOf(c), ...rules },
      notes: notes.slice(0, 40),
    };
  };

  const items: RotationStrategy[] = [];
  if (current)
    items.push(
      describe(
        current,
        "current",
        "current",
        i.baseline.source === "inferred_from_history"
          ? "inferred_from_history"
          : "farmer_declared",
      ),
    );
  i.alternativeIds.forEach((id, k) => {
    const c = byId.get(id);
    if (c)
      items.push(
        describe(
          c,
          `alternative_${k + 1}` as RotationStrategy["id"],
          "alternative",
          "engine_ranked",
        ),
      );
  });
  const alternativesFound = items.filter(
    (s) => s.role === "alternative",
  ).length;
  const requested = i.input.preferences.priorities;
  const priorityNotes: StrategyNote[] = [
    note(
      "why",
      "PRIORITIES_SLIDERS_USED",
      "Rotations are ranked with your four sliders (climate, water, soil health, crop health). Dimensions without evidence are left out and the others share their weight.",
      { ...i.applied },
    ),
  ];
  if (context)
    priorityNotes.push(
      note(
        "why",
        "PRIORITIES_CONTEXT_NOT_RANKED",
        "Your answers about equipment, market, forage and erosion do not change the ranking. They decide which benefits and gaps are spelled out for each strategy.",
        { ...context },
      ),
    );
  const hasRecall = items.some((s) => s.evidence.model_recall > 0);
  const reminders = [
    {
      code: "REMINDER_SUPPORTS_NOT_REPLACES",
      text: "This tool supports your own judgement and local agricultural expertise; it does not replace them.",
    },
    {
      code: "REMINDER_LOCAL_REVIEW",
      text: "Before changing your rotation, check the options with a local agronomist or extension officer who knows your soil, water and market.",
    },
    {
      code: "REMINDER_RULES_NOT_EXPERT_REVIEWED",
      text: "The crop rules have not been reviewed by an agricultural expert, and satellite and model data are estimates for your area, not measurements on your field.",
    },
    ...(hasRecall
      ? [
          {
            code: "REMINDER_AI_RECALL",
            text: "Some crop rules were recalled by an AI model and have not been checked against a source.",
          },
        ]
      : []),
  ];
  return {
    status: !current
      ? "baseline_unavailable"
      : alternativesFound < 2
        ? "insufficient_alternatives"
        : "complete",
    requiredAlternatives: 2,
    alternativesFound,
    baseline: {
      status: i.baseline.status,
      source: i.baseline.source,
      cropIds: i.baseline.cropIds,
      notes: i.baseline.notes,
    },
    items,
    priorities: {
      requested,
      applied: i.applied,
      farmerContext: context,
      notes: priorityNotes,
    },
    reminders,
  };
}

// After modelled yields re-rank the top rotations, the strategies follow the
// final ranks so the same rotation never shows two different ranks.
export function syncStrategyRanks(
  strategies: RotationStrategies,
  candidates: Pick<RotationCandidate, "id" | "rank" | "weightedLoss">[],
): void {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const current = strategies.items.find((s) => s.role === "current");
  const currentLoss = current
    ? byId.get(current.candidateId)?.weightedLoss
    : null;
  for (const item of strategies.items) {
    const c = byId.get(item.candidateId);
    if (!c) continue;
    item.rank = c.rank;
    item.weightedLoss = c.weightedLoss;
    if (item.versusCurrent && currentLoss != null)
      item.versusCurrent.weightedLoss = fixed(c.weightedLoss - currentLoss);
    for (const n of item.notes)
      if (n.code === "WHY_RANKED_BY_PRIORITIES") {
        n.facts = {
          ...n.facts,
          rank: c.rank,
          weightedLoss: fixed(c.weightedLoss),
        };
        n.text = `Ranked ${c.rank} among the top rotations after adding modelled yields to your priorities (combined loss ${fixed(c.weightedLoss)}; lower is better).`;
      }
  }
}
