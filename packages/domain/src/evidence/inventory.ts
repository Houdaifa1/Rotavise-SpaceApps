import type {
  CropProfile,
  PlanRequest,
  SequenceContext,
  ConstraintReason,
} from "@rotavise/contracts";
import { ruleGaps } from "./profile.js";
import { reason } from "../constraints/reasons.js";
import { soilConstraints } from "../constraints/soil.js";

export function staticConstraints(
  profile: CropProfile,
  input: PlanRequest,
  context: SequenceContext,
  cycle: 1 | 2,
): ConstraintReason[] {
  const output = soilConstraints(profile, input, context, cycle);
  if (input.history.status === "unknown")
    output.push(
      reason("HISTORY_UNKNOWN", "condition", profile.id, cycle, [
        "input.history",
      ]),
    );
  else if (input.history.completeness !== "complete")
    output.push(
      reason("HISTORY_PARTIAL", "condition", profile.id, cycle, [
        "input.history.completeness",
      ]),
    );
  const rotation = profile.knowledge.rotationRestrictions;
  if (rotation.status === "unknown")
    output.push(
      reason("ROTATION_KNOWLEDGE_UNAVAILABLE", "gap", profile.id, cycle),
    );
  else {
    if (!rotation.rules.some((r) => r.metric === "minimum_return_interval"))
      output.push(
        reason("RETURN_INTERVAL_UNESTABLISHED", "gap", profile.id, cycle),
      );
    for (const rule of rotation.rules)
      output.push(...ruleGaps(rule, context, profile.id, cycle));
  }
  const health = profile.knowledge.healthRestrictions;
  if (!health || health.status === "unknown")
    output.push(
      reason("HEALTH_KNOWLEDGE_UNAVAILABLE", "gap", profile.id, cycle),
    );
  else
    for (const rule of health.rules)
      output.push(...ruleGaps(rule, context, profile.id, cycle));
  if (input.crop_health.status === "unknown")
    output.push(
      reason("HEALTH_HISTORY_UNKNOWN", "condition", profile.id, cycle, [
        "input.crop_health",
      ]),
    );
  else
    for (const [i, o] of input.crop_health.observations.entries()) {
      const matched =
        health?.status === "sourced"
          ? health.rules.filter(
              (r) =>
                r.metric === "crop_health_break" &&
                r.kind === o.kind &&
                r.matchingNames.includes(o.name) &&
                r.hostCropIds.includes(o.crop_id),
            )
          : [];
      if (!matched.length)
        output.push(
          reason(
            "HEALTH_OBSERVATION_UNSUPPORTED",
            "condition",
            profile.id,
            cycle,
            [`input.crop_health.observations.${i}`],
            [],
            { name: o.name, kind: o.kind, observationCropId: o.crop_id },
          ),
        );
    }
  return output;
}
