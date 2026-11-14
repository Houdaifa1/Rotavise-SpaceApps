import type { HistoricalReason, CatalogRule } from "@rotavise/contracts";
import { compare } from "../constraints/reasons.js";

export function climateReason(
  code: HistoricalReason["code"],
  effect: HistoricalReason["effect"],
  cropId: string | null = null,
  cycle: 1 | 2 | null = null,
  rules: CatalogRule[] = [],
  facts: HistoricalReason["facts"] = {},
  inputPaths: string[] = [],
  snapshotIds: string[] = [],
): HistoricalReason {
  const citations = new Map(
    rules.flatMap((r) => r.citations).map((c) => [JSON.stringify(c), c]),
  );
  return {
    code,
    effect,
    cropId,
    cycle,
    facts,
    inputPaths: [...new Set(inputPaths)].sort(compare),
    ruleIds: [...new Set(rules.map((r) => r.id))].sort(compare),
    citations: [...citations.entries()]
      .sort(([a], [b]) => compare(a, b))
      .map(([, c]) => c),
    snapshotIds: [...new Set(snapshotIds)].sort(compare),
  };
}
export function orderedClimateReasons(reasons: HistoricalReason[]) {
  return [...new Map(reasons.map((r) => [JSON.stringify(r), r])).entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, r]) => r);
}
