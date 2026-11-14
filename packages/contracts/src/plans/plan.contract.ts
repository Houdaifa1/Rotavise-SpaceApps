import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";

export const planLabelSchema = z
  .string()
  .max(80)
  .regex(/^[^\p{Cc}]*$/u);
export const planCropIdSchema = z.string().regex(/^[a-z][a-z0-9-]{2,79}$/);
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
const cropEntry = z.strictObject({
  crop_id: planCropIdSchema,
  planted_on: date.nullable(),
  harvested_on: date.nullable(),
});
const observation = z.strictObject({
  crop_id: planCropIdSchema,
  kind: z.enum(["disease", "pest"]),
  name: text,
  observed_on: date,
  source: z.enum(["farmer_report", "specialist_report", "laboratory_report"]),
  confirmation: z.enum(["reported", "confirmed"]),
});
const measurementContext = {
  measured_on: date.nullable(),
  source: z.enum(["farmer_observation", "laboratory_report"]),
};
const soilObservation = z.discriminatedUnion("metric", [
  z.strictObject({
    metric: z.literal("ph"),
    value: z.number().finite().min(0).max(14),
    unit: z.literal("pH"),
    method: z.enum(["water", "cacl2", "unknown"]),
    ...measurementContext,
  }),
  z.strictObject({
    metric: z.literal("organic_matter"),
    value: z.number().finite().min(0).max(100),
    unit: z.literal("percent_mass"),
    method: text,
    ...measurementContext,
  }),
  z.strictObject({
    metric: z.literal("texture"),
    classification: text,
    classification_system: text,
    ...measurementContext,
  }),
]);

export const planRequestSchema = z
  .strictObject({
    schema_version: z.literal("1"),
    location: z.strictObject({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    }),
    history: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("known"),
        completeness: z.enum(["partial", "complete"]),
        entries: z.array(cropEntry).min(1).max(20),
      }),
    ]),
    crop_health: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("reported"),
        observations: z.array(observation).min(1).max(20),
      }),
    ]),
    soil: z.discriminatedUnion("status", [
      unknown,
      z.strictObject({
        status: z.literal("known"),
        observations: z.array(soilObservation).min(1).max(3),
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
      }),
    ]),
    planning: z.strictObject({
      cycles: z.literal(2),
      earliest_start_date: date,
      latest_start_date: date,
      search_end_date: date,
    }),
    preferences: z.strictObject({
      mode: z.enum(["consider", "suggest"]),
      considered_next_crop_ids: z.array(planCropIdSchema).max(10),
      excluded_crop_ids: z.array(planCropIdSchema).max(20),
      priority: z.enum(["lower_water_demand", "soil_health"]),
    }),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const p = v.preferences;
    for (const field of [
      "considered_next_crop_ids",
      "excluded_crop_ids",
    ] as const) {
      if (new Set(p[field]).size !== p[field].length)
        issue(["preferences", field], "Duplicate crop choices");
    }
    if ((p.mode === "consider") !== p.considered_next_crop_ids.length > 0)
      issue(["preferences", "mode"], "Inconsistent selection mode");
    if (
      p.considered_next_crop_ids.some((id) => p.excluded_crop_ids.includes(id))
    )
      issue(["preferences"], "Considered crop is excluded");
    const {
      earliest_start_date: first,
      latest_start_date: last,
      search_end_date: end,
    } = v.planning;
    const days = (a: string, b: string) =>
      (Date.parse(b) - Date.parse(a)) / 86400000;
    if (
      first > last ||
      last > end ||
      days(first, last) > 366 ||
      days(first, end) > 1096 ||
      days(first, end) < 1
    )
      issue(["planning"], "Invalid bounded planning range");
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
        if (entry.harvested_on && entry.harvested_on >= first)
          issue(["history", "entries", i], "History overlaps proposed start");
        if (entry.planted_on && entry.planted_on >= first)
          issue(
            ["history", "entries", i],
            "History starts after proposed start",
          );
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
export type PlanRequest = z.infer<typeof planRequestSchema>;
export const planTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const ownerSessionSchema = z.strictObject({
  accessToken: planTokenSchema,
  expiresAt: z.iso.datetime(),
});
export const planEvidenceSchema = z.strictObject({
  catalogSnapshotId: z.uuid(),
  catalogId: planCropIdSchema,
  catalogVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  catalogSha256: z.string().regex(/^[a-f0-9]{64}$/),
  intakeVersion: z.literal("1"),
  policyVersion: z.literal("intake-policy-1"),
  weatherSnapshotIds: z.array(z.uuid()).length(0),
  engineVersion: z.null(),
  rankingVersion: z.null(),
});
export const intakeResultSchema = z.strictObject({
  kind: z.literal("request_intake"),
  requestIntegrity: z.literal("verified"),
  catalogIntegrity: z.literal("verified"),
  planning: z.literal("not_implemented"),
  recommendations: z.null(),
  weather: z.literal("not_requested"),
});
export const planStatusSchema = z
  .strictObject({
    id: z.uuid(),
    label: planLabelSchema.nullable().default(null),
    parentPlanId: z.uuid().nullable().default(null),
    status: z.enum(["queued", "running", "completed", "failed"]),
    stage: z.enum([
      "awaiting_intake",
      "verifying_intake",
      "intake_complete",
      "intake_failed",
    ]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    attempts: z.number().int().nonnegative(),
    input: planRequestSchema,
    evidence: planEvidenceSchema,
    result: intakeResultSchema.nullable(),
    error: z
      .strictObject({
        code: z.enum([
          "RETRIES_EXHAUSTED",
          "QUEUE_TERMINAL_WITHOUT_RESULT",
          "STORED_REQUEST_INVALID",
          "CATALOG_EVIDENCE_INVALID",
        ]),
      })
      .nullable(),
  })
  .superRefine((v, ctx) => {
    const stages = {
      queued: "awaiting_intake",
      running: "verifying_intake",
      completed: "intake_complete",
      failed: "intake_failed",
    };
    if (
      v.stage !== stages[v.status] ||
      (v.status === "completed") !== (v.result !== null) ||
      (v.status === "failed") !== (v.error !== null)
    )
      ctx.addIssue({ code: "custom", message: "Inconsistent intake state" });
  });
export type PlanStatus = z.infer<typeof planStatusSchema>;
