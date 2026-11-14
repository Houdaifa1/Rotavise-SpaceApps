import type { CatalogBundle } from "@rotavise/contracts";
import { validateProductionCatalog } from "../validation/validate-catalog.js";

export function catalogReadiness(
  catalog: CatalogBundle,
  cropId: string,
  regionId: string,
) {
  catalog = validateProductionCatalog(catalog);
  const profile = catalog.profiles.find((p) => p.id === cropId);
  const gaps: { code: string; field: string; ruleId?: string }[] = [];
  if (!profile)
    return {
      cropId,
      status: "insufficient_evidence" as const,
      gaps: [{ code: "CROP_NOT_IN_CATALOG", field: "identity" }],
    };
  const applicability = profile.applicability.find(
    (a) => a.regionId === regionId,
  );
  if (!applicability)
    gaps.push({ code: "NO_APPLICABLE_EVIDENCE", field: "applicability" });
  else if (applicability.status !== "reviewed")
    gaps.push({ code: "APPLICABILITY_REVIEW_PENDING", field: "applicability" });
  if (profile.review.status !== "reviewed")
    gaps.push({ code: "SPECIALIST_REVIEW_PENDING", field: "review" });
  else if (!profile.review.regionIds.includes(regionId))
    gaps.push({ code: "REVIEW_SCOPE_MISMATCH", field: "review" });
  if (profile.cultivar.status === "unknown")
    gaps.push({ code: "CULTIVAR_UNSPECIFIED", field: "cultivar" });
  if (profile.productionSystems.includes("unspecified"))
    gaps.push({
      code: "PRODUCTION_SYSTEM_UNSPECIFIED",
      field: "productionSystems",
    });
  if (
    profile.knowledge.rotationRestrictions.status === "sourced" &&
    !profile.knowledge.rotationRestrictions.rules.some(
      (rule) => rule.metric === "minimum_return_interval",
    )
  )
    gaps.push({
      code: "RETURN_INTERVAL_UNESTABLISHED",
      field: "rotationRestrictions",
    });
  if (!profile.knowledge.healthRestrictions)
    gaps.push({ code: "KNOWLEDGE_UNKNOWN", field: "healthRestrictions" });
  for (const [field, knowledge] of Object.entries(profile.knowledge)) {
    if (!knowledge || knowledge.status === "unknown") {
      gaps.push({ code: "KNOWLEDGE_UNKNOWN", field });
      continue;
    }
    for (const rule of knowledge.rules) {
      if (rule.severity === "reference")
        gaps.push({ code: "RULE_REFERENCE_ONLY", field, ruleId: rule.id });
      if (
        (rule.metric === "cycle_duration" ||
          rule.metric === "planting_window") &&
        rule.severity !== "hard"
      )
        gaps.push({
          code: "CALENDAR_RULE_NOT_EXECUTABLE",
          field,
          ruleId: rule.id,
        });
      if (rule.executionScope?.conditionsStatus !== "encoded_by_scope")
        gaps.push({
          code: "RULE_CONDITIONS_UNRESOLVED",
          field,
          ruleId: rule.id,
        });
      if (rule.reviewStatus !== "reviewed")
        gaps.push({ code: "RULE_REVIEW_PENDING", field, ruleId: rule.id });
      if (!rule.evidenceRegionIds.includes(regionId))
        gaps.push({ code: "RULE_SCOPE_NOT_LOCAL", field, ruleId: rule.id });
      if (
        rule.metric === "temperature" &&
        (rule.medium === "unspecified" ||
          ["stage_mean", "unspecified"].includes(rule.timeBasis))
      )
        gaps.push({
          code: "MEASUREMENT_BASIS_INCOMPLETE",
          field,
          ruleId: rule.id,
        });
      if (rule.metric === "soil_ph" && rule.method === "unspecified")
        gaps.push({ code: "SOIL_METHOD_UNSPECIFIED", field, ruleId: rule.id });
      if (
        rule.metric === "cycle_duration" &&
        rule.timeBasis === "illustrative_case"
      )
        gaps.push({ code: "DURATION_IS_EXAMPLE", field, ruleId: rule.id });
      if (rule.metric === "planting_window" && rule.precision === "approximate")
        gaps.push({
          code: "CALENDAR_CONFIRMATION_NEEDED",
          field,
          ruleId: rule.id,
        });
    }
  }
  return {
    cropId,
    status: gaps.length
      ? ("insufficient_evidence" as const)
      : ("ready_for_engine" as const),
    gaps,
  };
}
