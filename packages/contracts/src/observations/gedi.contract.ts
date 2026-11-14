import { z } from "zod";

// GEDI L4B gridded aboveground biomass density around a field. A 1 km cell
// mixes everything inside it, and GEDI's laser shots are sparse, so this is
// context about trees and shrubs nearby, never the biomass of a crop.
const provenance = z
  .array(
    z.strictObject({
      item: z.string().min(1).max(200),
      origin: z.enum(["sourced", "model_recall", "engineering_judgment"]),
      reference: z.string().min(1).max(400),
    }),
  )
  .min(1)
  .max(12);
export const gediPolicyVersion = "gedi-policy-1" as const;
const mgHa = z.number().min(0).max(5000);
export const canopyBiomassResultSchema = z.strictObject({
  kind: z.literal("gedi"),
  policyVersion: z.literal(gediPolicyVersion),
  product: z.string().min(1).max(200),
  resolutionNote: z.string().min(1).max(300),
  observationPeriod: z.strictObject({
    start: z.literal("2019-04-18"),
    end: z.literal("2023-03-16"),
  }),
  fieldCell: z
    .strictObject({
      agbdMgHa: mgHa,
      seMgHa: mgHa.nullable(),
      distanceKm: z.number().nonnegative().max(2),
    })
    .nullable(),
  surroundings: z.strictObject({
    radiusKm: z.literal(3),
    cellsInRadius: z.number().int().nonnegative().max(60),
    meanAgbdMgHa: mgHa.nullable(),
    minAgbdMgHa: mgHa.nullable(),
    maxAgbdMgHa: mgHa.nullable(),
    standardErrorOfMeanMgHa: mgHa.nullable(),
  }),
  explanations: z.array(z.string().regex(/^[a-z0-9_.]{1,80}$/)).max(12),
  provenance,
  limitations: z.array(z.string().min(1).max(400)).min(1).max(12),
});
export type CanopyBiomassResult = z.infer<typeof canopyBiomassResultSchema>;
export const canopyBiomassResponseSchema = z.discriminatedUnion("available", [
  z.strictObject({
    available: z.literal(true),
    result: canopyBiomassResultSchema,
  }),
  z.strictObject({
    available: z.literal(false),
    reason: z.enum([
      "CANOPY_BIOMASS_NOT_IMPORTED",
      "CANOPY_BIOMASS_OUTSIDE_IMPORT",
      "CANOPY_BIOMASS_NO_ESTIMATE_NEARBY",
    ]),
  }),
]);
export type CanopyBiomassResponse = z.infer<typeof canopyBiomassResponseSchema>;
