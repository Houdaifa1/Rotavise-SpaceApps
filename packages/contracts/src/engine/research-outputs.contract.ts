import { z } from "zod";
import {
  cropResearchSchema,
  researchRangeSchema,
  benefitEffectCategories,
} from "../catalog/research.contract.js";

export const benefitSelectionSchema = z.strictObject({
  category: z.enum(benefitEffectCategories),
  status: z.enum(["sourced", "model_recall", "not_applicable", "no_data"]),
  findingIds: z.array(z.string()).max(60),
  sourceIds: z.array(z.string()).max(40),
});

const observation = z.strictObject({
  kind: z.literal("derived"),
  year: z.number().int(),
  region: z.string(),
  currency: z.literal("MAD"),
  unit: z.literal("MAD/ha per rotation"),
  range: researchRangeSchema,
  formula: z.string(),
  inputs: z.array(z.string()).min(2).max(40),
});
export const rotationResourcesSchema = z.strictObject({
  income: z.strictObject({
    status: z.enum(["derived", "gap"]),
    code: z.enum(["HISTORICAL_GROSS_REVENUE", "NO_INCOME_DATA"]),
    reason: z.string().min(1),
    observations: z.array(observation).max(100),
    slots: z
      .array(
        z.strictObject({
          slot: z.number().int().positive(),
          cropId: z.string(),
          status: z.enum(["derived", "gap"]),
          reason: z.string(),
          factIds: z.array(z.string()).max(100),
          inputIds: z.array(z.string()).max(100),
        }),
      )
      .max(20),
    ranking: z.strictObject({
      applied: z.boolean(),
      year: z.number().int().nullable(),
      combinedLoss: z.number().min(0).max(1).nullable(),
      derivation: z
        .strictObject({
          kind: z.literal("derived"),
          formula: z.string(),
          inputs: z.record(z.string(), z.number().finite()),
        })
        .nullable(),
      reason: z.string().min(1),
    }),
  }),
  benefits: z
    .array(
      z.strictObject({
        slot: z.number().int().positive(),
        cropId: z.string(),
        followingCropId: z.string().nullable(),
        // Conditional evidence only: mixtures, location and management are not inferred.
        status: z.literal("conditional_context"),
        findingIds: z.array(z.string()).max(50),
        gapCategories: z.array(z.string()).max(12),
        effects: z.array(benefitSelectionSchema).length(12).optional(),
      }),
    )
    .max(20),
  erosion: z.strictObject({
    code: z.literal("EROSION_FACTORS_MISSING"),
    rankingApplied: z.literal(false),
    soilLossTPerHaPerYear: z.null(),
    missingFactors: z.array(z.string()).min(1),
    exposure: z
      .array(
        z.strictObject({
          kind: z.literal("derived"),
          slot: z.number().int().positive(),
          cropId: z.string(),
          range: researchRangeSchema,
          unit: z.literal("dimensionless LS*C"),
          formula: z.literal("LS * C; partial RUSLE exposure, not soil loss"),
          inputs: z.array(z.string()).min(2),
          nonLocal: z.boolean(),
          conditions: z.array(z.string()),
          rankingApplied: z.literal(false),
        }),
      )
      .max(40),
    reason: z.string(),
  }),
});
export const catalogResearchCoverageSchema = z.strictObject({
  version: z.literal("income-benefits-1"),
  benefitVersion: z.literal("benefits-2").optional(),
  // New comparison policy avoids copying the full immutable catalog research
  // into each plan. Resolve by the assessment catalog id/version/hash.
  evidenceLocation: z.literal("pinned_catalog").optional(),
  crops: z
    .array(
      z.strictObject({
        cropId: z.string(),
        evidence: cropResearchSchema.optional(),
      }),
    )
    .max(300),
  comparedCropIds: z.array(z.string()).max(300),
  comparedCrops: z.number().int().nonnegative(),
  incomeInputs: z.number().int().nonnegative(),
  incomeDerivable: z.number().int().nonnegative(),
  benefits: z.number().int().nonnegative(),
  erosionC: z.number().int().nonnegative(),
  erosionRankable: z.literal(0),
  ranking: z.strictObject({
    scope: z.enum(["all_compared", "shown_after_yields"]),
    requestedIncomeWeight: z.number().int(),
    appliedCandidates: z.number().int().nonnegative(),
    code: z.literal("INCOME_SUPPORTED_PEERS_ONLY"),
    treatment: z.string(),
  }),
});
export type RotationResources = z.infer<typeof rotationResourcesSchema>;
