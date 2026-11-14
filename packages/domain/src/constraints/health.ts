import type {
  ConstraintReason,
  CropProfile,
  PlanRequest,
  SequenceContext,
  CropCycle,
} from "@rotavise/contracts";
import { addDays } from "../calendar/dates.js";
import { ruleGaps } from "../evidence/profile.js";
import { reason } from "./reasons.js";

export function healthConstraints(
  profile: CropProfile,
  input: PlanRequest,
  context: SequenceContext,
  cycle: CropCycle,
  cycleNumber: 1 | 2,
  first?: CropCycle,
): ConstraintReason[] {
  const output: ConstraintReason[] = [];
  const knowledge = profile.knowledge.healthRestrictions;
  if (!knowledge || knowledge.status === "unknown")
    output.push(
      reason("HEALTH_KNOWLEDGE_UNAVAILABLE", "gap", profile.id, cycleNumber),
    );
  if (input.crop_health.status === "unknown")
    return [
      ...output,
      reason("HEALTH_HISTORY_UNKNOWN", "condition", profile.id, cycleNumber, [
        "input.crop_health",
      ]),
    ];
  const rules =
    knowledge?.status === "sourced"
      ? knowledge.rules.filter((r) => r.metric === "crop_health_break")
      : [];
  const entries = input.history.status === "known" ? input.history.entries : [];
  for (const [index, observation] of input.crop_health.observations.entries()) {
    const paths = [`input.crop_health.observations.${index}`];
    const matched = rules.filter(
      (r) =>
        r.kind === observation.kind &&
        r.matchingNames.includes(observation.name) &&
        r.hostCropIds.includes(observation.crop_id),
    );
    if (!matched.length) {
      output.push(
        reason(
          "HEALTH_OBSERVATION_UNSUPPORTED",
          "condition",
          profile.id,
          cycleNumber,
          paths,
          [],
          {
            name: observation.name,
            kind: observation.kind,
            observationCropId: observation.crop_id,
          },
        ),
      );
      continue;
    }
    const verified = context.verifiedHealthObservations.find(
      (v) =>
        v.cropId === observation.crop_id &&
        v.kind === observation.kind &&
        v.name === observation.name &&
        v.observedOn === observation.observed_on,
    );
    if (!verified || !matched.some((r) => r.issueId === verified.issueId))
      output.push(
        reason(
          "HEALTH_OBSERVATION_UNVERIFIED",
          "condition",
          profile.id,
          cycleNumber,
          paths,
          matched,
          {
            confirmation: observation.confirmation,
            source: observation.source,
          },
        ),
      );
    for (const rule of matched) {
      const verifiedIssue =
        verified?.issueId === rule.issueId ? verified : undefined;
      if (verified && !verifiedIssue)
        output.push(
          reason(
            "HEALTH_OBSERVATION_UNVERIFIED",
            "condition",
            profile.id,
            cycleNumber,
            paths,
            [rule],
            { verifiedIssueId: verified.issueId, ruleIssueId: rule.issueId },
          ),
        );
      const gaps = ruleGaps(rule, context, profile.id, cycleNumber);
      output.push(...gaps);
      if (gaps.length) continue;
      const linked = entries.some(
        (e) =>
          e.crop_id === observation.crop_id &&
          e.planted_on !== null &&
          e.harvested_on !== null &&
          e.planted_on <= observation.observed_on &&
          e.harvested_on >= observation.observed_on,
      );
      if (!linked) {
        output.push(
          reason(
            "HEALTH_HISTORY_UNLINKED",
            "condition",
            profile.id,
            cycleNumber,
            paths.concat("input.history"),
            [rule],
          ),
        );
        continue;
      }
      const hostEntries = entries.filter((e) =>
        rule.hostCropIds.includes(e.crop_id),
      );
      if (hostEntries.some((e) => e.harvested_on === null)) {
        output.push(
          reason(
            "HISTORY_DATES_UNKNOWN",
            "condition",
            profile.id,
            cycleNumber,
            ["input.history.entries"],
            [rule],
          ),
        );
        continue;
      }
      const harvests = hostEntries
        .map((e) => e.harvested_on!)
        .concat(
          first && rule.hostCropIds.includes(first.cropId)
            ? [first.harvestLatest]
            : [],
        )
        .sort();
      const lastHostHarvest = harvests.at(-1);
      if (!lastHostHarvest) throw new Error("ENGINE_HEALTH_ANCHOR_MISSING");
      const earliest = addDays(lastHostHarvest, rule.minimumBreakDays);
      const violated = cycle.sownOn < earliest;
      output.push(
        reason(
          violated ? "HEALTH_BREAK_VIOLATION" : "HEALTH_BREAK_SATISFIED",
          violated
            ? verifiedIssue && rule.severity === "hard"
              ? "failure"
              : "condition"
            : "pass",
          profile.id,
          cycleNumber,
          paths.concat(
            "input.history.entries",
            ...(first ? ["first.harvestLatest"] : []),
          ),
          [rule],
          {
            lastHostHarvest,
            earliestSowing: earliest,
            proposedSowing: cycle.sownOn,
            minimumBreakDays: rule.minimumBreakDays,
            unit: "calendar_day",
            verificationId: verifiedIssue?.verificationId ?? null,
            issueId: rule.issueId,
          },
        ),
      );
    }
  }
  return output;
}
