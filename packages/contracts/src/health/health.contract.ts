import { z } from "zod";
export const dataCompletenessSchema = z.strictObject({
  ok: z.boolean(),
  checkedAt: z.iso.datetime(),
  incomplete: z.array(z.string()),
  datasets: z.array(
    z.strictObject({
      dataset: z.string(),
      ok: z.boolean(),
      detail: z.string(),
    }),
  ),
});
export type DataCompleteness = z.infer<typeof dataCompletenessSchema>;
export const healthSchema = z.strictObject({
  service: z.literal("rotavise-api"),
  status: z.enum(["ready", "unavailable"]),
  checkedAt: z.iso.datetime(),
  dependenciesReady: z.boolean(),
  dataCompleteness: dataCompletenessSchema,
});
