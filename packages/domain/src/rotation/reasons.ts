import type { CatalogRuleV2, RotationReason } from "@rotavise/contracts";
import { compare } from "../constraints/reasons.js";

export function rotationReason(
  code: RotationReason["code"],
  effect: RotationReason["effect"],
  options: {
    cropId?: string | null;
    slot?: number | null;
    rules?: CatalogRuleV2[];
    facts?: RotationReason["facts"];
  } = {},
): RotationReason {
  const rules = options.rules ?? [];
  const citations = new Map(
    rules
      .flatMap((r) => r.citations)
      .map((c) => [
        JSON.stringify([c.sourceId, c.locator, c.interpretation, c.note]),
        c,
      ]),
  );
  return {
    code,
    effect,
    cropId: options.cropId ?? null,
    slot: options.slot ?? null,
    ruleIds: [...new Set(rules.map((r) => r.id))].sort(compare),
    citations: [...citations.entries()]
      .sort(([a], [b]) => compare(a, b))
      .map(([, c]) => c),
    facts: options.facts ?? {},
  };
}
// Stable order and no duplicates, so identical inputs give identical output.
export function orderedReasons(reasons: RotationReason[]): RotationReason[] {
  const distinct = new Map(reasons.map((r) => [JSON.stringify(r), r]));
  return [...distinct.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, r]) => r);
}
