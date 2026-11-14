import { z } from "zod";
import { fieldBoundarySchema } from "./boundary.contract.js";

export const fieldBoundaryPointSchema = z.strictObject({
  latitude: z.number().finite().min(-85.05112878).max(85.05112878),
  longitude: z.number().finite().min(-180).max(180),
});
export const fieldBoundaryTileSchema = z.strictObject({
  z: z.literal("14"),
  x: z
    .string()
    .regex(/^(0|[1-9]\d{0,4})$/)
    .refine((v) => Number(v) < 16384),
  y: z
    .string()
    .regex(/^(0|[1-9]\d{0,4})$/)
    .refine((v) => Number(v) < 16384),
});
export const fieldSuggestionSchema = z.strictObject({
  type: z.literal("Feature"),
  geometry: fieldBoundarySchema,
  properties: z.strictObject({
    id: z.string().regex(/^ftw-2025:[a-f0-9]{64}:[A-Za-z0-9_.-]{1,128}$/),
    areaHectares: z.number().min(0.1).max(1000),
    source: z.literal("ftw-global-2025"),
    // Published, rescaled 500 m cell confidence; NOT polygon accuracy.
    confidence: z.number().finite().min(0).max(1).nullable(),
    datasetSha256: z.string().regex(/^[a-f0-9]{64}$/),
    holesDropped: z.number().int().min(0).max(31),
    areaChangePercent: z.number().finite().min(0).max(2),
  }),
});
export const FIELD_SUGGESTION_LIMITATIONS = [
  "SUGGESTED_OUTLINE_CHECK_IT",
  "FIELD_BOUNDARY_ACCURACY_UNMEASURED",
  "FIELD_BOUNDARY_NOT_LEGAL_PARCEL",
  "FIELD_BOUNDARY_MAY_MERGE_SPLIT_OR_MISS",
  "FIELD_BOUNDARY_CONFIDENCE_IS_REGIONAL",
] as const;
export const fieldBoundaryTileResponseSchema = z.strictObject({
  type: z.literal("FeatureCollection"),
  features: z.array(fieldSuggestionSchema).max(5000),
  coverage: z.enum(["suggestions", "no_fields_found"]),
  attribution: z.literal(
    "Fields of The World (Robinson et al., 2026), CC BY 4.0",
  ),
  licenseUrl: z.literal("https://creativecommons.org/licenses/by/4.0/"),
  sourceUrl: z.literal("https://source.coop/ftw/global-data"),
  limitations: z.array(z.enum(FIELD_SUGGESTION_LIMITATIONS)),
});
export const fieldBoundaryAtResponseSchema = fieldBoundaryTileResponseSchema
  .omit({ type: true, features: true, coverage: true })
  .extend({ field: fieldSuggestionSchema });
export type FieldSuggestion = z.infer<typeof fieldSuggestionSchema>;
