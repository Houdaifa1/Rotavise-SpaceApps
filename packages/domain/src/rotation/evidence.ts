import type {
  CatalogBundleV2,
  CatalogRuleV2,
  CropProfileV2,
  PlanRequestV2,
  RotationContext,
  RotationReason,
  SoilEstimate,
} from "@rotavise/contracts";
import { addYearsConstrained } from "../calendar/dates.js";
import { compare } from "../constraints/reasons.js";
import { containsPoint } from "./geometry.js";
import { rotationReason } from "./reasons.js";
import type { WindowRule } from "./calendar.js";

type Rule<M extends CatalogRuleV2["metric"]> = Extract<
  CatalogRuleV2,
  { metric: M }
>;
export type TemperatureRule = Rule<"temperature">;
export type CropSpec = {
  profile: CropProfileV2;
  windows: WindowRule[];
  duration: { min: number; max: number; rules: Rule<"cycle_duration">[] };
  preparationGapDays: number;
  preparationRules: Rule<"preparation_gap">[];
  temperature: TemperatureRule[];
  waterCurve: Rule<"crop_water_coefficient"> | null;
  aridRainfall: Rule<"water_reference">[];
  waterClass: {
    value: "low" | "moderate" | "high";
    method: string;
    rule: Rule<"water_demand_class">;
  } | null;
  preferences: Rule<"preferred_predecessor_family">[];
  prohibited: Rule<"prohibited_predecessor_family">[];
  returnInterval: Rule<"minimum_return_interval"> | null;
  healthBreaks: Rule<"crop_health_break">[];
  usedRules: CatalogRuleV2[];
  conditions: RotationReason[];
};
export type CropAssessment = {
  cropId: string;
  status:
    | "schedulable"
    | "not_in_catalog"
    | "excluded"
    | "unsupported_for_plan"
    | "insufficient_evidence"
    | "rejected";
  reasons: RotationReason[];
  spec: CropSpec | null;
};

export function resolveContext(
  input: PlanRequestV2,
  catalog: CatalogBundleV2,
  assessedOn: string,
): RotationContext {
  const { latitude, longitude } = input.location;
  return {
    assessedOn,
    location: { latitude, longitude },
    regionIds: catalog.regions
      .filter(
        (r) =>
          r.boundary && containsPoint(r.boundary.geometry, longitude, latitude),
      )
      .map((r) => r.id)
      .sort(compare),
    regionsWithoutBoundary: catalog.regions
      .filter((r) => !r.boundary)
      .map((r) => r.id)
      .sort(compare),
    farmingSystem:
      input.water.status === "unknown"
        ? null
        : input.water.availability === "rainfed"
          ? "rainfed"
          : "irrigated",
    cultivars: input.cultivars
      .map((c) => ({ cropId: c.crop_id, cultivarId: c.cultivar_id }))
      .sort((a, b) => compare(a.cropId, b.cropId)),
    horizonEnd: addYearsConstrained(
      input.planning.earliest_start_date,
      input.planning.horizon_years,
    ),
  };
}
// Whether a rule may bind for this field, and the visible reasons either way.
// `essential` rules block scheduling, so their problems are gaps; optional
// rules only reduce what can be compared, so their problems are information.
function usability(
  rule: CatalogRuleV2,
  context: RotationContext,
  profile: CropProfileV2,
  cultivarId: string | null,
  essential: boolean,
): { usable: boolean; reasons: RotationReason[] } {
  const effect = essential ? "gap" : "info";
  const blocked = (code: RotationReason["code"], facts = {}) => ({
    usable: false,
    reasons: [
      rotationReason(code, effect, {
        cropId: profile.id,
        rules: [rule],
        facts,
      }),
    ],
  });
  if (rule.severity === "reference") return blocked("RULE_REFERENCE_ONLY");
  if (rule.verification.status === "extracted")
    return blocked("RULE_NOT_VERIFIED");
  if (!rule.scope.regionIds.some((id) => context.regionIds.includes(id)))
    return blocked("RULE_OUT_OF_SCOPE", { scope: "region" });
  const reasons: RotationReason[] = [];
  const unspecified = (scope: string) =>
    reasons.push(
      rotationReason("RULE_SCOPE_UNSPECIFIED", "condition", {
        cropId: profile.id,
        rules: [rule],
        facts: { scope },
      }),
    );
  const systems = rule.scope.farmingSystems;
  if (systems === "unspecified") unspecified("farming_system");
  else if (systems !== "any") {
    if (context.farmingSystem === null)
      return blocked("FARMING_SYSTEM_UNRESOLVED");
    if (!systems.includes(context.farmingSystem))
      return blocked("RULE_OUT_OF_SCOPE", { scope: "farming_system" });
  }
  const cultivars = rule.scope.cultivarIds;
  if (cultivars === "unspecified") unspecified("cultivar");
  else if (
    cultivars !== "any" &&
    (!cultivarId || !cultivars.includes(cultivarId))
  )
    return blocked("RULE_OUT_OF_SCOPE", { scope: "cultivar" });
  return { usable: true, reasons };
}
function catalogGaps(profile: CropProfileV2): RotationReason[] {
  return profile.gaps.map((g) =>
    rotationReason("CATALOG_GAP", "info", {
      cropId: profile.id,
      facts: { catalogGap: g.topic, detail: g.reason.slice(0, 300) },
    }),
  );
}
const extractMethods = {
  water: "water_extract",
  cacl2: "calcium_chloride_extract",
  unknown: "unspecified",
} as const;
function soilChecks(
  profile: CropProfileV2,
  rules: (Rule<"soil_ph"> | Rule<"soil_salinity"> | Rule<"soil_drainage">)[],
  input: PlanRequestV2,
  estimate: SoilEstimate | null,
): RotationReason[] {
  const out: RotationReason[] = [];
  const cropId = profile.id;
  for (const rule of rules) {
    if (rule.metric === "soil_drainage") {
      out.push(
        rotationReason("SOIL_CHECK_UNIMPLEMENTED", "condition", {
          cropId,
          rules: [rule],
        }),
      );
      continue;
    }
    const metric = rule.metric === "soil_ph" ? "ph" : "salinity";
    const observation =
      input.soil.status === "known"
        ? input.soil.observations.find((o) => o.metric === metric)
        : undefined;
    if (
      !observation ||
      (observation.metric !== "ph" && observation.metric !== "salinity")
    ) {
      // A modelled pH only ever warns; it can never reject a crop.
      if (rule.metric === "soil_ph" && estimate?.phWater != null) {
        const outside =
          estimate.phWater < rule.min || estimate.phWater > rule.max;
        out.push(
          rotationReason(
            outside ? "SOIL_ESTIMATE_OUTSIDE" : "SOIL_ESTIMATE_USED",
            outside ? "condition" : "info",
            {
              cropId,
              rules: [rule],
              facts: {
                metric,
                value: estimate.phWater,
                min: rule.min,
                max: rule.max,
              },
            },
          ),
        );
        continue;
      }
      out.push(
        rotationReason("SOIL_UNKNOWN", "condition", {
          cropId,
          rules: [rule],
          facts: { metric },
        }),
      );
      continue;
    }
    const value =
      observation.metric === "ph"
        ? observation.value
        : observation.value_ds_per_m;
    const method =
      observation.metric === "ph"
        ? extractMethods[observation.method]
        : observation.method === "unknown"
          ? "unspecified"
          : observation.method;
    if (
      method === "unspecified" ||
      rule.method === "unspecified" ||
      method !== rule.method
    ) {
      out.push(
        rotationReason("SOIL_METHOD_MISMATCH", "condition", {
          cropId,
          rules: [rule],
          facts: { metric, inputMethod: method, ruleMethod: rule.method },
        }),
      );
      continue;
    }
    const outside =
      rule.metric === "soil_ph"
        ? value < rule.min || value > rule.max
        : value > rule.maxDsPerM;
    const dated = observation.measured_on !== null;
    if (!dated)
      out.push(
        rotationReason("SOIL_DATE_UNKNOWN", "condition", {
          cropId,
          rules: [rule],
          facts: { metric },
        }),
      );
    out.push(
      rotationReason(
        !outside
          ? "SOIL_LIMIT_PASSED"
          : rule.severity === "hard" && dated
            ? "SOIL_LIMIT_FAILED"
            : "SOIL_LIMIT_WARNING",
        !outside
          ? "pass"
          : rule.severity === "hard" && dated
            ? "failure"
            : "condition",
        { cropId, rules: [rule], facts: { metric, value } },
      ),
    );
  }
  return out;
}
const evaluableBases = ["daily_minimum", "daily_maximum", "daily_mean"];
export function assessCrop(
  cropId: string,
  catalog: CatalogBundleV2,
  input: PlanRequestV2,
  context: RotationContext,
  soilEstimate: SoilEstimate | null = null,
): CropAssessment {
  const profile = catalog.profiles.find((p) => p.id === cropId);
  const result = (
    status: CropAssessment["status"],
    reasons: RotationReason[],
    spec: CropSpec | null = null,
  ): CropAssessment => ({ cropId, status, reasons, spec });
  if (!profile)
    return result("not_in_catalog", [
      rotationReason("CROP_NOT_IN_CATALOG", "gap", { cropId }),
    ]);
  if (input.preferences.excluded_crop_ids.includes(cropId))
    return result("excluded", [
      rotationReason("CROP_EXCLUDED_BY_FARMER", "failure", { cropId }),
    ]);
  if (
    profile.modelType === "orchard" ||
    profile.modelType === "protected" ||
    profile.modelType === "wild_harvested"
  )
    return result("unsupported_for_plan", [
      rotationReason("MODEL_TYPE_UNSUPPORTED", "gap", {
        cropId,
        facts: { modelType: profile.modelType },
      }),
    ]);
  const reasons = catalogGaps(profile);
  if (!context.regionIds.length)
    return result("insufficient_evidence", [
      rotationReason("REGION_UNRESOLVED", "gap", {
        cropId,
        facts: {
          regionsWithoutBoundary: context.regionsWithoutBoundary.length,
        },
      }),
      ...reasons,
    ]);
  if (
    !profile.applicability.some((a) => context.regionIds.includes(a.regionId))
  )
    return result("insufficient_evidence", [
      rotationReason("CROP_NOT_APPLICABLE_IN_REGION", "gap", { cropId }),
      ...reasons,
    ]);
  let cultivarId =
    context.cultivars.find((c) => c.cropId === cropId)?.cultivarId ?? null;
  if (cultivarId && !profile.cultivars.some((c) => c.id === cultivarId)) {
    reasons.push(
      rotationReason("CULTIVAR_NOT_IN_CATALOG", "condition", {
        cropId,
        facts: { cultivarId },
      }),
    );
    cultivarId = null;
  }
  const essential = ["planting_window", "cycle_duration"];
  const usable: CatalogRuleV2[] = [];
  const blockedEssential: RotationReason[] = [];
  for (const rule of profile.rules) {
    const check = usability(
      rule,
      context,
      profile,
      cultivarId,
      essential.includes(rule.metric),
    );
    if (check.usable) {
      usable.push(rule);
      reasons.push(...check.reasons);
    } else if (essential.includes(rule.metric))
      blockedEssential.push(...check.reasons);
    else reasons.push(...check.reasons);
  }
  const pick = <M extends CatalogRuleV2["metric"]>(metric: M) =>
    usable.filter((r): r is Rule<M> => r.metric === metric);
  const windows = pick("planting_window");
  for (const w of windows.filter((w) => w.precision === "approximate"))
    reasons.push(
      rotationReason("RULE_SCOPE_UNSPECIFIED", "condition", {
        cropId,
        rules: [w],
        facts: { scope: "approximate_window" },
      }),
    );
  const basis =
    profile.modelType === "multi_year_stand"
      ? "stand_lifetime"
      : "sowing_to_harvest";
  const durations = pick("cycle_duration").filter((r) => r.basis === basis);
  if (!windows.length || !durations.length) {
    if (!windows.length)
      blockedEssential.push(
        rotationReason("CALENDAR_EVIDENCE_UNAVAILABLE", "gap", { cropId }),
      );
    if (!durations.length)
      blockedEssential.push(
        rotationReason("DURATION_EVIDENCE_UNAVAILABLE", "gap", { cropId }),
      );
    return result("insufficient_evidence", [...blockedEssential, ...reasons]);
  }
  const temperature: TemperatureRule[] = [];
  for (const rule of pick("temperature")) {
    if (rule.medium !== "air" || !evaluableBases.includes(rule.basis))
      reasons.push(
        rotationReason("RULE_MEASUREMENT_UNSUPPORTED", "info", {
          cropId,
          rules: [rule],
        }),
      );
    else if (rule.stage !== "whole_cycle" && rule.stageWindow === null)
      reasons.push(
        rotationReason("RULE_STAGE_TIMING_UNKNOWN", "info", {
          cropId,
          rules: [rule],
        }),
      );
    else temperature.push(rule);
  }
  if (!temperature.length)
    reasons.push(
      rotationReason("TEMPERATURE_EVIDENCE_UNAVAILABLE", "info", { cropId }),
    );
  const classes = pick("water_demand_class");
  const distinct = new Set(
    classes.map((r) => JSON.stringify([r.value, r.comparisonMethod])),
  );
  const waterClass =
    classes.length && distinct.size === 1
      ? {
          value: classes[0]!.value,
          method: classes[0]!.comparisonMethod,
          rule: classes[0]!,
        }
      : null;
  if (!waterClass)
    reasons.push(
      rotationReason("WATER_CLASS_UNAVAILABLE", "info", {
        cropId,
        rules: classes,
      }),
    );
  const curves = pick("crop_water_coefficient");
  const returns = pick("minimum_return_interval").sort(
    (a, b) => b.years - a.years || compare(a.id, b.id),
  );
  const soil = soilChecks(
    profile,
    [...pick("soil_ph"), ...pick("soil_salinity"), ...pick("soil_drainage")],
    input,
    soilEstimate,
  );
  reasons.push(...soil);
  const preparation = pick("preparation_gap");
  const spec: CropSpec = {
    profile,
    windows: windows.sort((a, b) => compare(a.id, b.id)),
    duration: {
      min: Math.min(...durations.map((r) => r.minDays)),
      max: Math.max(...durations.map((r) => r.maxDays)),
      rules: durations.sort((a, b) => compare(a.id, b.id)),
    },
    preparationGapDays: Math.max(0, ...preparation.map((r) => r.minimumDays)),
    preparationRules: preparation,
    temperature: temperature.sort((a, b) => compare(a.id, b.id)),
    waterClass,
    // Conflicting curves leave water use unknown rather than choosing one.
    waterCurve: curves.length === 1 ? curves[0]! : null,
    // A rainfall reference only ever warns, so it stays outside the binding rules.
    aridRainfall: profile.rules.filter(
      (r): r is Rule<"water_reference"> =>
        r.metric === "water_reference" &&
        r.basis === "annual_rainfall" &&
        r.verification.status !== "extracted" &&
        r.scope.regionIds.some((id) => context.regionIds.includes(id)),
    ),
    preferences: pick("preferred_predecessor_family"),
    prohibited: pick("prohibited_predecessor_family"),
    returnInterval: returns[0] ?? null,
    healthBreaks: pick("crop_health_break"),
    usedRules: usable,
    conditions: reasons.filter((r) => r.effect === "condition"),
  };
  if (soil.some((r) => r.effect === "failure"))
    return result("rejected", reasons, null);
  return result("schedulable", reasons, spec);
}
