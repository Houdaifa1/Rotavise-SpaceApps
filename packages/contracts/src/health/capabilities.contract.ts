import { z } from "zod";
import { dataCompletenessSchema } from "./health.contract.js";
import { cropHealthStatusSchema } from "../plans/crop-health.contract.js";

export const capabilitiesSchema = z.strictObject({
  version: z.literal("1"),
  dataCompleteness: dataCompletenessSchema,
  plans: z.boolean(),
  auth: z.strictObject({ email: z.boolean(), google: z.boolean() }),
  observations: z.boolean(),
  weather: z.boolean(),
  cropHealth: cropHealthStatusSchema,
  climateScenarios: z.boolean(),
  fieldDetection: z.strictObject({ available: z.boolean() }),
  fieldBoundaries: z.strictObject({ available: z.boolean() }),
  glossaryVersion: z.string().min(1),
  catalog: z.strictObject({
    id: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
});
