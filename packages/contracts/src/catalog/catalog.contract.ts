import { z } from "zod";
import {
  catalogIdSchema,
  catalogShaSchema,
  catalogSourceSchema,
  catalogTextSchema,
  catalogVersionSchema,
  citationsSchema,
} from "./source.contract.js";
import { catalogRuleSchema, productionSystemSchema } from "./rule.contract.js";

const knowledgeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("sourced"),
    rules: z.array(catalogRuleSchema).min(1).max(32),
  }),
  z.strictObject({ status: z.literal("unknown"), reason: catalogTextSchema }),
]);
export const catalogReviewSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending"), reason: catalogTextSchema }),
  z.strictObject({
    status: z.literal("reviewed"),
    reviewer: catalogTextSchema,
    qualification: catalogTextSchema,
    reviewedAt: z.iso.datetime(),
    regionIds: z.array(catalogIdSchema).min(1).max(12),
    note: catalogTextSchema,
  }),
]);
export const cropProfileSchema = z.strictObject({
  id: catalogIdSchema,
  version: catalogVersionSchema,
  synthetic: z.boolean(),
  identity: z.strictObject({
    name: catalogTextSchema,
    scientificName: catalogTextSchema,
    family: z.string().regex(/^[A-Z][a-z]+aceae$/),
    citations: citationsSchema,
  }),
  harvestProduct: z.enum(["dry_grain", "sugar_root"]),
  cultivar: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("unknown"), reason: catalogTextSchema }),
    z.strictObject({
      status: z.literal("specified"),
      id: catalogIdSchema,
      name: catalogTextSchema,
      citations: citationsSchema,
    }),
  ]),
  productionSystems: z.array(productionSystemSchema).min(1).max(3),
  applicability: z
    .array(
      z.strictObject({
        regionId: catalogIdSchema,
        status: z.enum(["candidate", "reviewed"]),
        citations: citationsSchema,
        note: catalogTextSchema,
      }),
    )
    .min(1)
    .max(12),
  review: catalogReviewSchema,
  knowledge: z.strictObject({
    plantingWindows: knowledgeSchema,
    duration: knowledgeSchema,
    soilRequirements: knowledgeSchema,
    temperatureRequirements: knowledgeSchema,
    waterDemandClass: knowledgeSchema,
    waterReference: knowledgeSchema,
    rotationRestrictions: knowledgeSchema,
    // Optional without a default: existing immutable release/hash stays identical.
    healthRestrictions: knowledgeSchema.optional(),
  }),
  limitations: z.array(catalogTextSchema).min(1).max(20),
});
export const catalogBundleSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id: catalogIdSchema,
  version: catalogVersionSchema,
  synthetic: z.boolean(),
  regions: z
    .array(
      z.strictObject({
        id: catalogIdSchema,
        name: catalogTextSchema,
        countryCode: z.string().regex(/^[A-Z]{2}$/),
        scopeNote: catalogTextSchema,
        citations: citationsSchema,
      }),
    )
    .min(1)
    .max(1000),
  sources: z.array(catalogSourceSchema).min(1).max(100),
  profiles: z.array(cropProfileSchema).min(1).max(50),
});
export type CatalogBundle = z.infer<typeof catalogBundleSchema>;
export type CropProfile = z.infer<typeof cropProfileSchema>;
// Names the frontend shows by language. "confidence" is the recorded
// confidence of a name; it is absent for older names without a record.
export const catalogNameSchema = z.strictObject({
  language: z.enum(["fr", "ar", "ary", "zgh", "en"]),
  name: catalogTextSchema.max(120),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  preferred: z.boolean().optional(),
});
export const catalogOptionsSchema = z.strictObject({
  catalogId: catalogIdSchema,
  catalogVersion: catalogVersionSchema,
  catalogSha256: catalogShaSchema,
  crops: z
    .array(
      z.strictObject({
        id: catalogIdSchema,
        name: catalogTextSchema,
        scientificName: catalogTextSchema,
        family: z.string(),
        reviewStatus: z.enum(["pending", "reviewed"]),
        // Format 1 catalogs carry no names in other languages or varieties.
        localNames: z.array(catalogNameSchema).max(12),
        cultivars: z
          .array(
            z.strictObject({
              id: catalogIdSchema,
              name: catalogTextSchema.max(200),
              localNames: z.array(catalogNameSchema).max(12),
            }),
          )
          .max(50),
      }),
    )
    .max(1000),
  sources: z
    .array(
      z.strictObject({
        id: catalogIdSchema,
        title: catalogTextSchema,
        publisher: catalogTextSchema,
        url: z.url().startsWith("https://"),
      }),
    )
    .max(1000),
});
export type CatalogOptions = z.infer<typeof catalogOptionsSchema>;
