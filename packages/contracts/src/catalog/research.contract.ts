import { z } from "zod";
import { catalogIdSchema, catalogShaSchema } from "./source.contract.js";
import { modelRecallSchema } from "./recall.contract.js";

// One named recursive schema avoids anonymous shared definitions in OpenAPI.
export const researchJsonSchema = z.json();

// Optional evidence, never defaults: parsing an older release adds no keys.
export const researchCitationSchema = z.strictObject({
  sourceId: catalogIdSchema,
  quote: z.string().min(1).max(12000),
  locator: z.string().min(1).max(4000),
  sourceSha256: catalogShaSchema,
  quoteCheck: z.string().min(1).max(500),
});
export const researchRangeSchema = z
  .strictObject({ min: z.number().finite(), max: z.number().finite() })
  .refine((v) => v.min <= v.max, "Reversed research range");
export const incomeFactSchema = z.strictObject({
  id: z.string().min(1).max(160),
  kind: z.enum(["prices", "yields", "costs", "margins"]),
  value: z.union([z.number().finite(), researchRangeSchema]),
  unit: z.string().min(1).max(200),
  currency: z.literal("MAD").nullable(),
  year: z
    .union([z.number().int().min(1700).max(2100), z.string().max(40)])
    .nullable(),
  region: z.string().min(1).max(1000),
  commodity: z.string().max(300).nullable(),
  scenarioId: z.string().max(200).nullable(),
  definition: z.string().min(1).max(2000),
  citations: z.array(researchCitationSchema).min(1).max(40),
  // Saved research metadata, including exclusions, conflicting accounting and
  // eligibility flags. Typed values and quotations above are stored once; the
  // full original record (including translations) stays in docs/evidence.
  research: researchJsonSchema,
});
export const benefitCategories = [
  "biological_nitrogen_fixation",
  "residual_nitrogen_credit",
  "forage_residue_feed",
  "disease_break",
  "weed_break",
  "pest_break",
  "rooting_soil_structure_infiltration",
  "erosion_cover_residue",
  "bare_soil_period_shortening",
] as const;
export const benefitFindingSchema = z.strictObject({
  id: z.string().min(1).max(200),
  category: z.enum(benefitCategories),
  effect: z.string().min(1).max(2000),
  nonLocal: z.boolean(),
  region: z.string().min(1).max(1000),
  conditions: z.array(z.string().min(1).max(2000)).max(30),
  magnitude: researchJsonSchema,
  rotationContext: researchJsonSchema,
  citations: z.array(researchCitationSchema).min(1).max(40),
  research: researchJsonSchema,
});
// Additive extension: earlier findings and gaps remain exactly as recorded.
export const benefitEffectCategories = [
  ...benefitCategories,
  "organic_matter_soil_carbon",
  "drought_tolerance",
  "water_demand",
] as const;
const benefitRecordBase = {
  id: z.string().min(1).max(200),
  category: z.enum(benefitEffectCategories),
  effect: z.string().min(1).max(2000),
  nonLocal: z.boolean(),
  region: z.string().min(1).max(1000),
  conditions: z.array(z.string().min(1).max(2000)).min(1).max(30),
  magnitude: z.union([
    z
      .strictObject({
        status: z.enum(["sourced", "model_recall"]),
        min: z.number().finite(),
        max: z.number().finite(),
        unit: z.string().min(1).max(200),
      })
      .refine((v) => v.min <= v.max, "Reversed benefit range"),
    z.strictObject({
      status: z.enum(["sourced", "model_recall", "not_applicable"]),
      value: z.string().min(1).max(1000),
      unit: z.string().min(1).max(200),
    }),
  ]),
};
export const benefitRecordSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...benefitRecordBase,
    status: z.literal("sourced"),
    citations: z.array(researchCitationSchema).min(1).max(12),
  }),
  z.strictObject({
    ...benefitRecordBase,
    status: z.literal("model_recall"),
    recall: modelRecallSchema,
    citations: z.array(researchCitationSchema).length(0),
  }),
  z.strictObject({
    ...benefitRecordBase,
    status: z.literal("not_found"),
    applicability: z.literal("not_applicable"),
    reason: z.string().min(1).max(2000),
    recall: modelRecallSchema,
    citations: z.array(researchCitationSchema).length(0),
  }),
]);
export type BenefitRecord = z.infer<typeof benefitRecordSchema>;
export const cropResearchSchema = z.strictObject({
  version: z.literal("income-benefits-1"),
  income: z.strictObject({
    facts: z.array(incomeFactSchema).max(100),
    options: z
      .array(
        z.strictObject({
          research: researchJsonSchema,
          citations: z.array(researchCitationSchema).min(1).max(40),
        }),
      )
      .max(20),
    gaps: z.array(researchJsonSchema).max(20),
  }),
  benefits: z.strictObject({
    version: z.literal("benefits-2").optional(),
    records: z.array(benefitRecordSchema).min(12).max(60).optional(),
    findings: z.array(benefitFindingSchema).max(50),
    gaps: z
      .array(
        z.strictObject({
          category: z.enum(benefitCategories),
          reason: z.string().min(1).max(2000),
        }),
      )
      .max(9),
  }),
});
export type IncomeFact = z.infer<typeof incomeFactSchema>;
export type BenefitFinding = z.infer<typeof benefitFindingSchema>;

export const researchCFactorSchema = z.union([
  z
    .object({
      status: z.literal("sourced"),
      unit: z.literal("dimensionless RUSLE C"),
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    })
    .refine((v) => v.min <= v.max),
  z.object({
    status: z.literal("sourced"),
    unit: z.literal("dimensionless RUSLE C"),
    values: z.array(z.object({ value: z.number().nonnegative() })).min(1),
  }),
]);
