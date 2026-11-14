import type {
  ConstraintReason,
  CropProfile,
  PlanRequest,
  SequenceContext,
} from "@rotavise/contracts";
import { ruleGaps } from "../evidence/profile.js";
import { reason } from "./reasons.js";

export function soilConstraints(
  profile: CropProfile,
  input: PlanRequest,
  context: SequenceContext,
  cycle: 1 | 2,
): ConstraintReason[] {
  const output: ConstraintReason[] = [];
  const knowledge = profile.knowledge.soilRequirements;
  if (knowledge.status === "unknown")
    output.push(
      reason("SOIL_KNOWLEDGE_UNAVAILABLE", "gap", profile.id, cycle, [], [], {
        detail: knowledge.reason,
      }),
    );
  if (input.soil.status === "unknown")
    output.push(
      reason("SOIL_UNKNOWN", "condition", profile.id, cycle, ["input.soil"]),
    );
  if (knowledge.status !== "sourced") return output;
  for (const rule of knowledge.rules) {
    const gaps = ruleGaps(rule, context, profile.id, cycle);
    output.push(...gaps);
    if (gaps.length) continue;
    if (rule.metric !== "soil_ph") {
      output.push(
        reason(
          "SOIL_CHECK_UNIMPLEMENTED",
          "condition",
          profile.id,
          cycle,
          ["input.soil"],
          [rule],
          { metric: rule.metric },
        ),
      );
      continue;
    }
    const measurement =
      input.soil.status === "known"
        ? input.soil.observations.find((o) => o.metric === "ph")
        : undefined;
    if (!measurement || measurement.metric !== "ph") {
      if (input.soil.status !== "unknown")
        output.push(
          reason(
            "SOIL_METRIC_UNAVAILABLE",
            "condition",
            profile.id,
            cycle,
            ["input.soil"],
            [rule],
            { metric: "ph" },
          ),
        );
      continue;
    }
    const method =
      measurement.method === "water"
        ? "water_extract"
        : measurement.method === "cacl2"
          ? "calcium_chloride_extract"
          : "unspecified";
    if (
      method === "unspecified" ||
      rule.method === "unspecified" ||
      method !== rule.method
    ) {
      output.push(
        reason(
          "SOIL_METHOD_MISMATCH",
          "condition",
          profile.id,
          cycle,
          ["input.soil.observations"],
          [rule],
          { inputMethod: method, ruleMethod: rule.method },
        ),
      );
      continue;
    }
    const outside =
      measurement.value < rule.min || measurement.value > rule.max;
    output.push(
      reason(
        outside ? "SOIL_PH_OUTSIDE_RANGE" : "SOIL_PH_WITHIN_RANGE",
        outside
          ? rule.severity === "hard" && measurement.measured_on !== null
            ? "failure"
            : "condition"
          : "pass",
        profile.id,
        cycle,
        ["input.soil.observations"],
        [rule],
        {
          value: measurement.value,
          min: rule.min,
          max: rule.max,
          unit: "pH",
          method,
          measuredOn: measurement.measured_on,
        },
      ),
    );
    if (measurement.measured_on === null)
      output.push(
        reason(
          "SOIL_METRIC_UNAVAILABLE",
          "condition",
          profile.id,
          cycle,
          ["input.soil.observations"],
          [rule],
          { detail: "Measurement date unknown; freshness unverified" },
        ),
      );
  }
  if (input.soil.status === "known")
    for (const observation of input.soil.observations)
      if (observation.metric !== "ph")
        output.push(
          reason(
            "SOIL_CHECK_UNIMPLEMENTED",
            "condition",
            profile.id,
            cycle,
            ["input.soil.observations"],
            [],
            { metric: observation.metric },
          ),
        );
  return output;
}
