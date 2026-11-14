import { z } from "zod";
import {
  catalogIdSchema,
  catalogTextSchema,
  citationsSchema,
} from "./source.contract.js";

export const monthDaySchema = z
  .string()
  .regex(/^\d{2}-\d{2}$/)
  .refine((value) => {
    const [month, day] = value.split("-").map(Number);
    return (
      month !== undefined &&
      day !== undefined &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= new Date(Date.UTC(2000, month, 0)).getUTCDate()
    );
  });
export const productionSystemSchema = z.enum([
  "rainfed",
  "irrigated",
  "unspecified",
]);
const base = {
  id: catalogIdSchema,
  citations: citationsSchema,
  evidenceRegionIds: z.array(catalogIdSchema).min(1).max(12),
  productionSystems: z.array(productionSystemSchema).min(1).max(3),
  severity: z.enum(["reference", "soft", "hard"]),
  reviewStatus: z.enum(["research", "reviewed"]),
  conditions: catalogTextSchema,
  executionScope: z
    .strictObject({
      cultivarId: catalogIdSchema,
      conditionsStatus: z.enum(["encoded_by_scope", "unresolved"]),
    })
    .optional(),
};
const numberRange = { min: z.number().finite(), max: z.number().finite() };
export const catalogRuleSchema = z
  .discriminatedUnion("metric", [
    z.strictObject({
      ...base,
      metric: z.literal("planting_window"),
      unit: z.literal("month_day"),
      timeBasis: z.literal("recurring_calendar"),
      stage: z.literal("sowing"),
      start: monthDaySchema,
      end: monthDaySchema,
      precision: z.enum(["full_month", "approximate", "exact_day"]),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("cycle_duration"),
      unit: z.literal("calendar_day"),
      timeBasis: z.enum(["sowing_to_harvest", "illustrative_case"]),
      stage: z.literal("whole_cycle"),
      min: z.number().int().min(1).max(730),
      max: z.number().int().min(1).max(730),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("soil_ph"),
      unit: z.literal("pH"),
      timeBasis: z.literal("field_measurement"),
      stage: z.literal("whole_cycle"),
      method: z.enum([
        "water_extract",
        "calcium_chloride_extract",
        "unspecified",
      ]),
      min: z.number().min(0).max(14),
      max: z.number().min(0).max(14),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("soil_drainage"),
      unit: z.literal("category"),
      timeBasis: z.literal("field_condition"),
      stage: z.literal("whole_cycle"),
      value: z.enum(["well_drained", "avoid_waterlogging"]),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("temperature"),
      unit: z.literal("degC"),
      timeBasis: z.enum([
        "instantaneous",
        "daily_minimum",
        "daily_maximum",
        "daily_mean",
        "stage_mean",
        "unspecified",
      ]),
      stage: z.enum([
        "germination",
        "emergence",
        "vegetative_growth",
        "flowering",
        "pod_formation",
        "whole_cycle",
      ]),
      medium: z.enum(["air", "soil", "unspecified"]),
      // Reviewed stage boundaries; absent on existing immutable profiles.
      stageWindow: z
        .strictObject({
          basis: z.literal("elapsed_days_from_sowing"),
          startDay: z.number().int().min(0).max(730),
          endDay: z.number().int().min(0).max(730),
        })
        .optional(),
      ...numberRange,
    }),
    z.strictObject({
      ...base,
      metric: z.literal("water_demand_class"),
      unit: z.literal("relative_class"),
      timeBasis: z.literal("declared_comparison_method"),
      stage: z.literal("whole_cycle"),
      value: z.enum(["low", "moderate", "high"]),
      comparisonMethod: catalogTextSchema,
    }),
    z.strictObject({
      ...base,
      metric: z.literal("seasonal_crop_water_reference"),
      unit: z.literal("mm"),
      timeBasis: z.literal("source_scenario_whole_cycle"),
      stage: z.literal("whole_cycle"),
      min: z.number().nonnegative().max(10000),
      max: z.number().nonnegative().max(10000),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("annual_water_reference"),
      unit: z.literal("mm/year"),
      timeBasis: z.literal("calendar_year"),
      stage: z.literal("unspecified"),
      lowerBound: z.number().nonnegative().max(10000),
      inclusive: z.boolean(),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("preferred_predecessor_family"),
      unit: z.literal("family"),
      timeBasis: z.literal("previous_crop"),
      stage: z.literal("whole_cycle"),
      family: z.string().regex(/^[A-Z][a-z]+aceae$/),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("minimum_return_interval"),
      unit: z.literal("calendar_year"),
      timeBasis: z.literal("between_same_crop_sowings"),
      stage: z.literal("whole_cycle"),
      cropId: catalogIdSchema,
      minimumYears: z.number().int().min(1).max(20),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("prohibited_predecessor_family"),
      unit: z.literal("family"),
      timeBasis: z.literal("previous_crop"),
      stage: z.literal("whole_cycle"),
      family: z.string().regex(/^[A-Z][a-z]+aceae$/),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("crop_health_break"),
      unit: z.literal("calendar_day"),
      timeBasis: z.literal("after_last_host_harvest"),
      stage: z.literal("whole_cycle"),
      issueId: catalogIdSchema,
      kind: z.enum(["disease", "pest"]),
      matchingNames: z.array(catalogTextSchema.max(120)).min(1).max(12),
      hostCropIds: z.array(catalogIdSchema).min(1).max(50),
      minimumBreakDays: z.number().int().min(1).max(7300),
    }),
  ])
  .superRefine((rule, ctx) => {
    if (rule.metric === "planting_window" && rule.precision === "full_month") {
      const [month, day] = rule.end.split("-").map(Number);
      if (
        !rule.start.endsWith("-01") ||
        day !== new Date(Date.UTC(2000, month!, 0)).getUTCDate()
      )
        ctx.addIssue({
          code: "custom",
          message: "Full-month windows require whole calendar-month boundaries",
        });
    }
    if ("min" in rule && rule.min > rule.max)
      ctx.addIssue({ code: "custom", message: "Reversed range" });
    if (
      rule.metric === "temperature" &&
      rule.stageWindow &&
      (rule.stage === "whole_cycle" ||
        rule.stageWindow.startDay > rule.stageWindow.endDay)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid temperature stage window",
      });
    for (const key of ["evidenceRegionIds", "productionSystems"] as const)
      if (new Set(rule[key]).size !== rule[key].length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Duplicate values",
        });
    const underspecified =
      (rule.metric === "temperature" &&
        (rule.medium === "unspecified" ||
          ["unspecified", "stage_mean"].includes(rule.timeBasis))) ||
      (rule.metric === "soil_ph" && rule.method === "unspecified") ||
      (rule.metric === "cycle_duration" &&
        rule.timeBasis === "illustrative_case") ||
      (rule.metric === "planting_window" && rule.precision === "approximate");
    if (
      rule.severity === "hard" &&
      (rule.reviewStatus !== "reviewed" || underspecified)
    )
      ctx.addIssue({
        code: "custom",
        message: "Hard rules need reviewed, interpretable evidence",
      });
    if (
      rule.metric === "preferred_predecessor_family" &&
      rule.severity === "hard"
    )
      ctx.addIssue({
        code: "custom",
        message: "A preference is not a hard exclusion",
      });
    if (rule.metric === "crop_health_break") {
      for (const field of ["matchingNames", "hostCropIds"] as const)
        if (new Set(rule[field]).size !== rule[field].length)
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Duplicate health values",
          });
    }
    if (
      ["annual_water_reference", "seasonal_crop_water_reference"].includes(
        rule.metric,
      ) &&
      rule.severity !== "reference"
    )
      ctx.addIssue({
        code: "custom",
        message: "Water reference is not irrigation sufficiency",
      });
  });
export type CatalogRule = z.infer<typeof catalogRuleSchema>;
