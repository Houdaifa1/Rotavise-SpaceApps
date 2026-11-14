import type {
  CatalogRule,
  ConstraintReason,
  CandidateStatus,
} from "@rotavise/contracts";

export const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function reason(
  code: ConstraintReason["code"],
  effect: ConstraintReason["effect"],
  cropId: string | null = null,
  cycle: 1 | 2 | null = null,
  inputPaths: string[] = [],
  rules: CatalogRule[] = [],
  facts: ConstraintReason["facts"] = {},
): ConstraintReason {
  const citations = rules.flatMap((r) => r.citations);
  const distinct = new Map(
    citations.map((c) => [
      JSON.stringify([c.sourceId, c.locator, c.interpretation, c.note]),
      c,
    ]),
  );
  return {
    code,
    effect,
    cropId,
    cycle,
    inputPaths: [...new Set(inputPaths)].sort(compare),
    ruleIds: [...new Set(rules.map((r) => r.id))].sort(compare),
    citations: [...distinct.entries()]
      .sort(([a], [b]) => compare(a, b))
      .map(([, v]) => v),
    facts,
  };
}
export function orderReasons(reasons: ConstraintReason[]): ConstraintReason[] {
  const distinct = new Map(reasons.map((r) => [JSON.stringify(r), r]));
  return [...distinct.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, v]) => v);
}
export function statusOf(reasons: ConstraintReason[]): CandidateStatus {
  if (reasons.some((r) => r.effect === "failure")) return "excluded";
  if (reasons.some((r) => r.effect === "gap")) return "insufficient_evidence";
  if (reasons.some((r) => r.effect === "condition")) return "conditional";
  return "eligible";
}
export function bestStatus(statuses: CandidateStatus[]): CandidateStatus {
  for (const status of [
    "eligible",
    "conditional",
    "insufficient_evidence",
    "excluded",
  ] as const)
    if (statuses.includes(status)) return status;
  throw new Error("ENGINE_EMPTY_ASSESSMENT");
}
