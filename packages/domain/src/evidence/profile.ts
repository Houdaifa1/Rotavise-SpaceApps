import type {
  CatalogBundle,
  CatalogRule,
  CropProfile,
  ConstraintReason,
  SequenceContext,
} from "@rotavise/contracts";
import { reason } from "../constraints/reasons.js";

export type WindowRule = Extract<CatalogRule, { metric: "planting_window" }>;
export type DurationRule = Extract<CatalogRule, { metric: "cycle_duration" }>;
export type CycleSpec = {
  profile: CropProfile;
  windows: WindowRule[];
  durations: DurationRule[];
  min: number;
  max: number;
};
export function ruleApplicable(
  rule: CatalogRule,
  context: SequenceContext,
): boolean {
  return (
    context.region.status === "resolved" &&
    rule.evidenceRegionIds.includes(context.region.regionId) &&
    context.productionSystem !== null &&
    rule.productionSystems.includes(context.productionSystem)
  );
}
export function ruleGaps(
  rule: CatalogRule,
  context: SequenceContext,
  cropId: string,
  cycle: 1 | 2,
): ConstraintReason[] {
  const gaps: ConstraintReason[] = [];
  if (!conditionsEncoded(rule, context, cropId))
    gaps.push(
      reason(
        "RULE_CONDITIONS_UNRESOLVED",
        "gap",
        cropId,
        cycle,
        ["context.cultivars"],
        [rule],
        { conditions: rule.conditions },
      ),
    );
  if (!ruleApplicable(rule, context))
    gaps.push(
      reason(
        "RULE_NOT_APPLICABLE",
        "gap",
        cropId,
        cycle,
        ["context.region", "context.productionSystem"],
        [rule],
      ),
    );
  if (rule.reviewStatus !== "reviewed")
    gaps.push(reason("RULE_NOT_REVIEWED", "gap", cropId, cycle, [], [rule]));
  if (rule.severity === "reference")
    gaps.push(reason("RULE_REFERENCE_ONLY", "gap", cropId, cycle, [], [rule]));
  return gaps;
}
export function profileCalendar(
  catalog: CatalogBundle,
  cropId: string,
  context: SequenceContext,
  cycle: 1 | 2,
) {
  const gaps: ConstraintReason[] = [];
  const add = (code: ConstraintReason["code"], paths: string[] = []) =>
    gaps.push(reason(code, "gap", cropId, cycle, paths));
  const profile = catalog.profiles.find((p) => p.id === cropId);
  if (!profile) {
    add("CROP_NOT_IN_CATALOG", ["input.preferences.considered_next_crop_ids"]);
    return { spec: null, gaps };
  }
  if (context.region.status === "unresolved")
    add("REGION_UNRESOLVED", ["input.location", "context.region"]);
  else {
    if (
      !catalog.regions.some(
        (r) =>
          r.id ===
          (context.region.status === "resolved" ? context.region.regionId : ""),
      )
    )
      add("REGION_NOT_IN_CATALOG", ["context.region"]);
    const applicability = profile.applicability.find(
      (a) =>
        context.region.status === "resolved" &&
        a.regionId === context.region.regionId,
    );
    if (!applicability || applicability.status !== "reviewed")
      add("NO_APPLICABLE_EVIDENCE", ["context.region"]);
    if (
      profile.review.status !== "reviewed" ||
      !profile.review.regionIds.includes(context.region.regionId)
    )
      add("PROFILE_REVIEW_PENDING");
  }
  if (
    profile.review.status !== "reviewed" &&
    !gaps.some((r) => r.code === "PROFILE_REVIEW_PENDING")
  )
    add("PROFILE_REVIEW_PENDING");
  if (context.productionSystem === null)
    add("PRODUCTION_SYSTEM_UNRESOLVED", ["context.productionSystem"]);
  else if (!profile.productionSystems.includes(context.productionSystem))
    add("SYSTEM_NOT_SUPPORTED", ["context.productionSystem"]);
  const selected = context.cultivars.find((c) => c.cropId === cropId);
  if (
    profile.cultivar.status !== "specified" ||
    !selected ||
    profile.cultivar.id !== selected.cultivarId
  )
    add("CULTIVAR_UNRESOLVED", ["context.cultivars"]);
  const windows: WindowRule[] = [];
  const durations: DurationRule[] = [];
  if (profile.knowledge.plantingWindows.status === "sourced")
    for (const r of profile.knowledge.plantingWindows.rules)
      if (
        r.metric === "planting_window" &&
        r.reviewStatus === "reviewed" &&
        r.severity === "hard" &&
        r.precision !== "approximate" &&
        conditionsEncoded(r, context, cropId) &&
        ruleApplicable(r, context)
      )
        windows.push(r);
  if (!windows.length) {
    add("CALENDAR_EVIDENCE_UNAVAILABLE");
    if (profile.knowledge.plantingWindows.status === "sourced")
      for (const r of profile.knowledge.plantingWindows.rules)
        gaps.push(...ruleGaps(r, context, cropId, cycle));
  }
  if (profile.knowledge.duration.status === "sourced")
    for (const r of profile.knowledge.duration.rules)
      if (
        r.metric === "cycle_duration" &&
        r.reviewStatus === "reviewed" &&
        r.severity === "hard" &&
        r.timeBasis === "sowing_to_harvest" &&
        conditionsEncoded(r, context, cropId) &&
        ruleApplicable(r, context)
      )
        durations.push(r);
  if (!durations.length) {
    add("DURATION_EVIDENCE_UNAVAILABLE");
    if (profile.knowledge.duration.status === "sourced")
      for (const r of profile.knowledge.duration.rules)
        gaps.push(...ruleGaps(r, context, cropId, cycle));
  }
  windows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  durations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const spec: CycleSpec | null = gaps.length
    ? null
    : {
        profile,
        windows,
        durations,
        min: Math.min(...durations.map((r) => r.min)),
        max: Math.max(...durations.map((r) => r.max)),
      };
  return { spec, gaps };
}
export function conditionsEncoded(
  rule: CatalogRule,
  context: SequenceContext,
  cropId: string,
): boolean {
  return (
    rule.executionScope?.conditionsStatus === "encoded_by_scope" &&
    context.cultivars.some(
      (c) =>
        c.cropId === cropId && c.cultivarId === rule.executionScope?.cultivarId,
    )
  );
}
