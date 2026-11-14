import { z } from "zod";
import { catalogTextSchema } from "./source.contract.js";

export const modelRecallSchema = z.strictObject({
  confidence: z.enum(["low", "medium", "high"]),
  basis: catalogTextSchema,
  valueKind: z.literal("model_recall_unverified"),
  recordedOn: z.iso.date(),
  researchItem: catalogTextSchema.max(160),
});
export type ModelRecall = z.infer<typeof modelRecallSchema>;
