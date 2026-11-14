import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";
import { planCropIdSchema } from "./plan.contract.js";

// Request format 2 (Step 10): multi-year rotations. Format 1 stays accepted
// for the two-cycle interface until the Step 15 redesign.
const text = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const unknown = z.strictObject({ status: z.literal("unknown") });
const date = calendarDateSchema.refine(
  (v) => v >= "1900-01-01" && v <= "2100-12-31",
);
const measured = {
  measured_on: date.nullable(),
  source: z.enum(["farmer_observation", "laboratory_report"]),
};
const soilObservationV2 = z.discriminatedUnion("metric", [
  z.strictObject({
    metric: z.literal("ph"),
    value: z.number().finite().min(0).max(14),
    method: z.enum(["water", "cacl2", "unknown"]),
    ...measured,
  }),
  z.strictObject({
    metric: z.literal("salinity"),
    value_ds_per_m: z.number().finite().min(0).max(100),
    method: z.enum(["saturated_paste_ece", "unknown"]),
    ...measured,
  }),
  z.strictObject({
    metric: z.literal("organic_matter"),
    value_percent: z.number().finite().min(0).max(100),
    method: text,
    ...measured,
  }),
  z.strictObject({
    metric: z.literal("texture"),
    classification: text,
    classification_system: text,
    ...measured,
  }),
]);
// Each slider is 0–5; at least one must be above zero.
export const priorityWeightsSchema = z
  .strictObject({
    climate: z.number().int().min(0).max(5),
    water: z.number().int().min(0).max(5),
    soil_health: z.number().int().min(0).max(5),
    crop_health: z.number().int().min(0).max(5),
  })
  .refine(
    (w) => w.climate + w.water + w.soil_health + w.crop_health > 0,
    "At least one priority",
  );
export type PriorityWeights = z.infer<typeof priorityWeightsSchema>;
export const currentRotationSchema = z.strictObject({
  crop_ids: z.array(planCropIdSchema).min(1).max(6),
});
// A "what if" test: extra changes on top of the climate the assessment already
// uses (the historical record, and each model's future worlds when prepared).
// These are the farmer's own assumptions, not forecasts. Units are explicit
// in every key; 0 means no change for that part.
export const WHAT_IF_LIMITS = {
  rainfallChangePercent: { min: -50, max: 50 },
  temperatureChangeC: { min: -3, max: 6 },
  sowingShiftDays: { min: -45, max: 45 },
} as const;
export const whatIfSchema = z
  .strictObject({
    // Every daily rain amount is multiplied by 1 + this/100.
    rainfall_change_percent: z
      .number()
      .int()
      .min(WHAT_IF_LIMITS.rainfallChangePercent.min)
      .max(WHAT_IF_LIMITS.rainfallChangePercent.max)
      .default(0),
    // Added to every daily minimum, maximum and mean air temperature, in °C
    // (steps of 0.1).
    temperature_change_c: z
      .number()
      .finite()
      .min(WHAT_IF_LIMITS.temperatureChangeC.min)
      .max(WHAT_IF_LIMITS.temperatureChangeC.max)
      .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
        message: "Steps of 0.1 °C",
      })
      .default(0),
    // Moves the first-sowing range of the rotation by this many days
    // (negative is earlier).
    sowing_shift_days: z
      .number()
      .int()
      .min(WHAT_IF_LIMITS.sowingShiftDays.min)
      .max(WHAT_IF_LIMITS.sowingShiftDays.max)
      .default(0),
  })
  .refine(
    (v) =>
      v.rainfall_change_percent !== 0 ||
      v.temperature_change_c !== 0 ||
      v.sowing_shift_days !== 0,
    "A what-if needs at least one change",
  );
export type WhatIf = z.infer<typeof whatIfSchema>;
export const farmerContextSchema = z.strictObject({
  equipment: z.enum(["unknown", "limited", "standard"]),
  market_preference: z.enum([
    "unknown",
    "household_food",
    "cash_income",
    "livestock_feed",
  ]),
  forage_need: z.enum(["none", "some", "high"]),
  erosion_concern: z.enum(["unknown", "low", "moderate", "high"]),
});
export type FarmerContext = z.infer<typeof farmerContextSchema>;
// Capacity categories and bounds are request/product policy, not crop facts.
export const equipmentLimitsSchema = z
  .strictObject({
    mechanisation: z.enum(["none", "small", "medium", "large"]).optional(),
    unavailable_operations: z
      .array(planCropIdSchema)
      .min(1)
      .max(32)
      .refine((v) => new Set(v).size === v.length, "Duplicate operations")
      .optional(),
  })
  .refine(
    (v) =>
      v.mechanisation !== undefined || v.unavailable_operations !== undefined,
    "Empty equipment limits",
  );
export const planRequestV2Schema = z
  .strictObject({
    schema_version: z.literal("2"),
    // Optional owned field whose completed observations are pinned at acceptance.
    field_id: z.uuid().optional(),
    location: z.strictObject({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    }),
    history: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("known"),
        completeness: z.enum(["partial", "complete"]),
        entries: z
          .array(
            z.strictObject({
              crop_id: planCropIdSchema,
              planted_on: date.nullable(),
              harvested_on: date.nullable(),
            }),
          )
          .min(1)
          .max(40),
      }),
    ]),
    crop_health: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("reported"),
        observations: z
          .array(
            z.strictObject({
              crop_id: planCropIdSchema,
              // A catalog issue id, or a name the farmer used when it is not listed.
              issue: z.union([
                z.strictObject({ issue_id: planCropIdSchema }),
                z.strictObject({ other_name: text }),
              ]),
              observed_on: date,
              source: z.enum([
                "farmer_report",
                "specialist_report",
                "laboratory_report",
              ]),
              confirmation: z.enum(["reported", "confirmed"]),
            }),
          )
          .min(1)
          .max(20),
      }),
    ]),
    soil: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("known"),
        observations: z.array(soilObservationV2).min(1).max(6),
      }),
    ]),
    water: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("reported"),
        availability: z.enum([
          "rainfed",
          "irrigation_limited",
          "irrigation_available",
        ]),
        // Reported supply; the Step 13 water balance uses it.
        allocation: z
          .strictObject({
            amount_mm: z.number().finite().min(0).max(5000),
            period: z.enum(["season", "year"]),
          })
          .nullable(),
      }),
    ]),
    planning: z.strictObject({
      horizon_years: z.number().int().min(3).max(5),
      earliest_start_date: date,
      latest_start_date: date,
    }),
    cultivars: z
      .array(
        z.strictObject({
          crop_id: planCropIdSchema,
          cultivar_id: planCropIdSchema,
        }),
      )
      .max(50),
    preferences: z.strictObject({
      mode: z.enum(["consider", "suggest"]),
      considered_crop_ids: z.array(planCropIdSchema).max(20),
      excluded_crop_ids: z.array(planCropIdSchema).max(50),
      priorities: priorityWeightsSchema,
      equipment_limits: equipmentLimitsSchema.optional(),
      market_access: z.enum(["none", "local", "regional", "export"]).optional(),
      // Dimensionless priority, same 0–5 scale as the four existing priorities.
      income_weight: z.number().int().min(0).max(5).optional(),
    }),
    // Engine 7: the rotation the farmer would continue, as one cycle of crops
    // in order. It is scored on the same checks as every other rotation.
    current_rotation: currentRotationSchema.optional(),
    // Engine 7: what the farmer cares about beyond the four sliders. These do
    // not change the ranking; they choose which benefits, risks and gaps are
    // spelled out for each strategy.
    farmer_context: farmerContextSchema.optional(),
    // Engine 7: an optional what-if test (see whatIfSchema). Absent means the
    // request, its hash and its result are exactly what they were without it.
    what_if: whatIfSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const p = v.preferences;
    for (const field of ["considered_crop_ids", "excluded_crop_ids"] as const)
      if (new Set(p[field]).size !== p[field].length)
        issue(["preferences", field], "Duplicate crop choices");
    if ((p.mode === "consider") !== p.considered_crop_ids.length > 0)
      issue(["preferences", "mode"], "Inconsistent selection mode");
    if (p.considered_crop_ids.some((id) => p.excluded_crop_ids.includes(id)))
      issue(["preferences"], "Considered crop is excluded");
    if (new Set(v.cultivars.map((c) => c.crop_id)).size !== v.cultivars.length)
      issue(["cultivars"], "One cultivar per crop");
    const { earliest_start_date: first, latest_start_date: last } = v.planning;
    if (first > last || (Date.parse(last) - Date.parse(first)) / 86400000 > 366)
      issue(["planning"], "Invalid first-sowing range");
    if (v.history.status === "known") {
      const entries = v.history.entries;
      const seen = new Set<string>();
      entries.forEach((entry, i) => {
        const signature = JSON.stringify(entry);
        if (seen.has(signature))
          issue(["history", "entries", i], "Duplicate history entry");
        seen.add(signature);
        if (
          entry.planted_on &&
          entry.harvested_on &&
          entry.planted_on > entry.harvested_on
        )
          issue(["history", "entries", i], "Reversed crop dates");
        if (
          (entry.harvested_on && entry.harvested_on >= first) ||
          (entry.planted_on && entry.planted_on >= first)
        )
          issue(["history", "entries", i], "History overlaps proposed start");
        if (
          entry.planted_on &&
          entry.harvested_on &&
          entries
            .slice(0, i)
            .some(
              (other) =>
                other.planted_on &&
                other.harvested_on &&
                entry.planted_on! <= other.harvested_on &&
                entry.harvested_on! >= other.planted_on,
            )
        )
          issue(["history", "entries", i], "Overlapping crop history");
      });
    }
    if (v.crop_health.status === "reported") {
      const seen = new Set<string>();
      v.crop_health.observations.forEach((o, i) => {
        if (o.confirmation === "confirmed" && o.source === "farmer_report")
          issue(
            ["crop_health", "observations", i],
            "Farmer observation is not a confirmed diagnosis",
          );
        const signature = JSON.stringify(o);
        if (seen.has(signature))
          issue(
            ["crop_health", "observations", i],
            "Duplicate health observation",
          );
        seen.add(signature);
      });
    }
    if (
      v.soil.status === "known" &&
      new Set(v.soil.observations.map((o) => o.metric)).size !==
        v.soil.observations.length
    )
      issue(["soil"], "Duplicate soil metric");
  });
export type PlanRequestV2 = z.infer<typeof planRequestV2Schema>;
// Canonical order for every unordered list, shared by the server (identity
// hash) and the engine, so stored and assessed inputs are byte-identical.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const byCanonical = (a: unknown, b: unknown) => {
  const x = canonical(a),
    y = canonical(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
export function normalizePlanRequestV2(input: PlanRequestV2): PlanRequestV2 {
  const copy = planRequestV2Schema.parse(input);
  copy.preferences.considered_crop_ids.sort(byCanonical);
  copy.preferences.excluded_crop_ids.sort(byCanonical);
  copy.cultivars.sort(byCanonical);
  copy.preferences.equipment_limits?.unavailable_operations?.sort(byCanonical);
  if (copy.history.status === "known") copy.history.entries.sort(byCanonical);
  if (copy.crop_health.status === "reported")
    copy.crop_health.observations.sort(byCanonical);
  if (copy.soil.status === "known") copy.soil.observations.sort(byCanonical);
  return copy;
}
