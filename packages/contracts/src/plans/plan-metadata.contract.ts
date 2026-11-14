import { z } from "zod";
import { planRequestSchema, planLabelSchema } from "./plan.contract.js";
import { planRequestV2Schema } from "./plan-v2.contract.js";

// Submission metadata is deliberately outside the calculation input. Renaming
// a plan must never change an accepted input or a stored result's identity.
export const planCreateRequestSchema = planRequestSchema.safeExtend({
  label: planLabelSchema.optional(),
});
export const rotationPlanCreateRequestSchema = planRequestV2Schema.safeExtend({
  label: planLabelSchema.optional(),
});
export const planLabelRequestSchema = z.strictObject({
  label: planLabelSchema.nullable(),
});
export const planLabelResponseSchema = z.strictObject({
  id: z.uuid(),
  label: planLabelSchema.nullable(),
});
