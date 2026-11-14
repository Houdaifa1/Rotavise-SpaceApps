import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";
import { planRequestSchema, planCropIdSchema } from "../plans/plan.contract.js";
export const fieldProfileSchema = z
  .strictObject({
    schema_version: z.literal("1"),
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((v) => !/[\u0000-\u001f\u007f]/.test(v)),
    location: planRequestSchema.shape.location,
    soil: planRequestSchema.shape.soil,
    water: planRequestSchema.shape.water,
    crop_health: planRequestSchema.shape.crop_health,
  })
  .superRefine((v, ctx) => {
    if (
      v.soil.status === "known" &&
      new Set(v.soil.observations.map((o) => o.metric)).size !==
        v.soil.observations.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["soil"],
        message: "Duplicate soil metric",
      });
    if (v.crop_health.status === "reported") {
      if (
        new Set(v.crop_health.observations.map((o) => JSON.stringify(o)))
          .size !== v.crop_health.observations.length
      )
        ctx.addIssue({
          code: "custom",
          path: ["crop_health"],
          message: "Duplicate observation",
        });
      if (
        v.crop_health.observations.some(
          (o) => o.source === "farmer_report" && o.confirmation === "confirmed",
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["crop_health"],
          message: "Farmer reports cannot verify diagnoses",
        });
    }
  });
export const cropHistoryEntrySchema = z
  .strictObject({
    schema_version: z.literal("1"),
    crop_id: planCropIdSchema,
    planted_on: calendarDateSchema,
    harvested_on: calendarDateSchema,
  })
  .refine(
    (v) =>
      v.planted_on <= v.harvested_on &&
      v.planted_on >= "1900-01-01" &&
      v.harvested_on <= "2100-12-31",
    "Invalid crop dates",
  );
// Opaque keyset position issued by the server; clients pass it back unchanged.
export const pageCursorSchema = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/);
export const pageQuerySchema = z.strictObject({
  cursor: pageCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FieldProfile = z.infer<typeof fieldProfileSchema>;
export type CropHistoryEntry = z.infer<typeof cropHistoryEntrySchema>;
