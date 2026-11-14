import {
  rankingPriorityWeights,
  type HistoricalAssessment,
  type HistoricalCandidate,
  type HistoricalPolicy,
  type HistoricalReason,
  type ComparisonComponents,
} from "@rotavise/contracts";
import { compare } from "../constraints/reasons.js";
import { climateReason } from "../climate/reasons.js";
import type { AnalysisBudget } from "../climate/weather.js";

// Product heuristics, not calibrated agronomic utilities or probabilities.
export const priorityWeights = rankingPriorityWeights;
type Ranking = HistoricalAssessment["ranking"];
type PoolMember = { candidate: HistoricalCandidate; signature: string | null };
const keys = ["climate", "water", "rotation"] as const;
const quantize = (v: number) => Number(v.toFixed(12));
function weighted(
  components: ComparisonComponents,
  weights: ComparisonComponents,
) {
  return quantize(keys.reduce((n, k) => n + components[k] * weights[k], 0));
}
export function sensitivityWeights(
  base: ComparisonComponents,
): ComparisonComponents[] {
  const variants = [{ ...base }];
  for (const from of keys)
    for (const to of keys) {
      if (from === to || base[from] < 0.1 || base[to] > 0.9) continue;
      variants.push({
        ...base,
        [from]: quantize(base[from] - 0.1),
        [to]: quantize(base[to] + 0.1),
      });
    }
  return variants;
}
export function rankComparisons(
  members: PoolMember[],
  priority: Ranking["priority"],
  policy: HistoricalPolicy,
  budget: AnalysisBudget,
): Ranking {
  const weights = { ...priorityWeights[priority] };
  const groups: Ranking["groups"] = [],
    unranked: Ranking["unranked"] = [];
  const pools = new Map<string, PoolMember[]>();
  for (const member of members) {
    const { candidate: c, signature } = member;
    const blocking = c.reasons
      .filter((r) => r.effect === "gap")
      .map((r) => r.code);
    if (c.status === "excluded" || c.status === "insufficient_evidence")
      blocking.push("CONSTRAINTS_PREVENT_RANKING");
    if (
      !signature ||
      c.water.ordinalLoss === null ||
      c.rotation.ordinalLoss === null ||
      blocking.length
    ) {
      unranked.push({
        scheduleId: c.scheduleId,
        reasonCodes: [
          ...new Set(
            blocking.length
              ? blocking
              : ["INSUFFICIENT_COMPLETE_ANALOGS" as const],
          ),
        ].sort(compare),
      });
      continue;
    }
    const key = JSON.stringify([
      signature,
      c.water.comparisonMethod,
      c.water.sourceIds,
    ]);
    pools.set(key, [...(pools.get(key) ?? []), member]);
  }
  for (const [key, pool] of [...pools.entries()].sort(([a], [b]) =>
    compare(a, b),
  )) {
    const first = pool[0]!.candidate;
    const shared = first.analogs
      .filter((a) => a.status === "complete" && a.climateLoss !== null)
      .map((a) => a.anchorYear)
      .filter((year) =>
        pool.every((m) =>
          m.candidate.analogs.some(
            (a) =>
              a.anchorYear === year &&
              a.status === "complete" &&
              a.climateLoss !== null,
          ),
        ),
      );
    if (
      shared.length < policy.minimumCompleteAnalogs ||
      shared.filter((y) => y <= policy.splitAfterYear).length <
        policy.minimumPeriodAnalogs ||
      shared.filter((y) => y > policy.splitAfterYear).length <
        policy.minimumPeriodAnalogs
    ) {
      for (const m of pool)
        unranked.push({
          scheduleId: m.candidate.scheduleId,
          reasonCodes: ["INSUFFICIENT_SHARED_ANALOGS"],
        });
      continue;
    }
    const score = pool.map((m) => ({
      scheduleId: m.candidate.scheduleId,
      components: {
        climate:
          shared.reduce(
            (n, y) =>
              n +
              m.candidate.analogs.find((a) => a.anchorYear === y)!.climateLoss!,
            0,
          ) / shared.length,
        water: m.candidate.water.ordinalLoss!,
        rotation: m.candidate.rotation.ordinalLoss!,
      },
    }));
    const ordered = score
      .map((s) => ({ ...s, weightedLoss: weighted(s.components, weights) }))
      .sort(
        (a, b) =>
          a.weightedLoss - b.weightedLoss ||
          compare(a.scheduleId, b.scheduleId),
      );
    const ties = new Map<number, string[]>();
    for (const entry of ordered)
      ties.set(entry.weightedLoss, [
        ...(ties.get(entry.weightedLoss) ?? []),
        entry.scheduleId,
      ]);
    const entries: Ranking["groups"][number]["entries"] = [];
    for (const entry of ordered) {
      const record = {
        ...entry,
        rank:
          ordered.findIndex((e) => e.weightedLoss === entry.weightedLoss) + 1,
        contributions: {
          climate: entry.components.climate * weights.climate,
          water: entry.components.water * weights.water,
          rotation: entry.components.rotation * weights.rotation,
        },
        tiedWith: ties
          .get(entry.weightedLoss)!
          .filter((id) => id !== entry.scheduleId),
      };
      budget.consume(record);
      entries.push(record);
    }
    const sensitivity = sensitivityWeights(weights).map((w) => {
      const scores = score
        .map((s) => ({ ...s, loss: weighted(s.components, w) }))
        .sort((a, b) => a.loss - b.loss || compare(a.scheduleId, b.scheduleId));
      const best = Math.min(...scores.map((s) => s.loss));
      return {
        weights: w,
        topScheduleIds: scores
          .filter((s) => s.loss === best)
          .map((s) => s.scheduleId)
          .sort(compare),
        ranks: scores.map((s) => ({
          scheduleId: s.scheduleId,
          rank: scores.findIndex((e) => e.loss === s.loss) + 1,
        })),
      };
    });
    const sensitive = sensitivity.some(
      (s) => JSON.stringify(s.ranks) !== JSON.stringify(sensitivity[0]!.ranks),
    );
    const topSensitive = sensitivity.some(
      (s) =>
        JSON.stringify(s.topScheduleIds) !==
        JSON.stringify(sensitivity[0]!.topScheduleIds),
    );
    const reasons: HistoricalReason[] = [
      climateReason(
        "RANKED_WITH_HEURISTIC_WEIGHTS",
        "info",
        null,
        null,
        [],
        {
          priority,
          sharedAnalogCount: shared.length,
          climateWeight: weights.climate,
          waterWeight: weights.water,
          rotationWeight: weights.rotation,
        },
        ["input.preferences.priority"],
      ),
    ];
    if (sensitive)
      reasons.push(
        climateReason("RANKING_SENSITIVE", "condition", null, null, [], {
          weightTransfer: 0.1,
        }),
      );
    if (entries.length === 1)
      reasons.push(climateReason("SINGLE_COMPARABLE_OPTION", "condition"));
    const [signature, waterMethod, sourceIds] = JSON.parse(key) as [
      string,
      string,
      string[],
    ];
    groups.push({
      id: `comparison-${groups.length + 1}`,
      climateMethodSignature: signature,
      waterMethod,
      waterSourceIds: sourceIds,
      sharedAnchorYears: shared,
      entries,
      sensitive,
      topSensitive,
      sensitivity,
      reasons,
    });
  }
  return {
    priority,
    weights,
    groups,
    unranked: unranked.sort((a, b) => compare(a.scheduleId, b.scheduleId)),
  };
}
