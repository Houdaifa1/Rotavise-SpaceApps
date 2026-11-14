import { z } from "zod";
import {
  cropHistoryEntrySchema,
  fieldProfileSchema,
} from "./field.contract.js";
import { fieldBoundarySchema } from "./boundary.contract.js";
import { observationKindSchema } from "../observations/observation.contract.js";
import { extractionKindSchema } from "../observations/terrain-water.contract.js";

// Request bodies and path parameters of the field, history, observation and
// claim routes. The routes parse with these and the OpenAPI document is built
// from the same objects, so the two cannot drift.
export const fieldIdParamsSchema = z.strictObject({ id: z.uuid() });
export const fieldHistoryParamsSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
});
export const fieldObservationParamsSchema = z.strictObject({
  id: z.uuid(),
  observationId: z.uuid(),
});
export const fieldExtractionParamsSchema = z.strictObject({
  id: z.uuid(),
  extractionId: z.uuid(),
});
export const fieldCreateRequestSchema = fieldProfileSchema.safeExtend({
  boundary: fieldBoundarySchema.optional(),
});
export const fieldWithHistoryRequestSchema = z.strictObject({
  profile: fieldProfileSchema,
  history: z.array(cropHistoryEntrySchema).max(20),
  boundary: fieldBoundarySchema.optional(),
});
export const fieldUpdateRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  profile: fieldProfileSchema,
});
export const boundaryUpdateRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive().nullable(),
  boundary: fieldBoundarySchema,
});
export const historyUpdateRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  entry: cropHistoryEntrySchema,
});
export const observationRequestSchema = z.strictObject({
  kind: observationKindSchema,
});
export const extractionRequestSchema = z.strictObject({
  kind: extractionKindSchema,
});
export const planClaimRequestSchema = z.strictObject({
  confirm: z.literal(true),
});
export const planSessionRequestSchema = z.strictObject({});
