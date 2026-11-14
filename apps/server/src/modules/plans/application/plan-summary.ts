import { z } from "zod";
import { planRequestV2Schema, planCropIdSchema } from "@rotavise/contracts";

const strategiesSchema = z.object({
  strategies: z.object({
    items: z
      .array(
        z.object({
          rank: z.number().int().positive(),
          cropIds: z.array(planCropIdSchema).min(1).max(20),
        }),
      )
      .max(4),
  }),
});

// Read-only projection of immutable accepted evidence. No inferred crops,
// ranking calculation, or mutation of historical inputs/results.
export function planSummary(input: unknown, status: string, result: unknown) {
  const request = planRequestV2Schema.safeParse(input);
  const strategies =
    status === "completed" ? strategiesSchema.safeParse(result) : null;
  return {
    fieldId: request.success ? (request.data.field_id ?? null) : null,
    cropIds: request.success
      ? (request.data.current_rotation?.crop_ids ?? null)
      : null,
    horizonYears: request.success ? request.data.planning.horizon_years : null,
    topStrategyCropIds: strategies?.success
      ? (strategies.data.strategies.items.find((item) => item.rank === 1)
          ?.cropIds ?? null)
      : null,
    whatIf: request.success && request.data.what_if !== undefined,
  };
}
