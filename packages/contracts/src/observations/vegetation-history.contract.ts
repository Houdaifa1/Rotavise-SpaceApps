import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";

// The field's greenness over about 25 years, from MODIS 16-day composites, set
// beside the finer HLS timeline. Every limit is relative to the field's own
// yearly range or declared in the policy with its basis; none is a crop
// threshold, and none is a diagnosis.
const monthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const share = z.number().min(0).max(1);
export const vegetationHistoryPolicySchema = z.strictObject({
  version: z.literal("vegetation-history-1"),
  binDays: z.number().int().positive().max(31),
  minimumBinsPerYear: z.number().int().positive(),
  minimumAmplitude: z.number().positive().max(1),
  lowFraction: z.number().positive().max(1),
  greenFraction: z.number().positive().max(1),
  usualShare: z.number().positive().max(1),
  minimumYears: z.number().int().positive(),
  minimumTrendYears: z.number().int().positive(),
  trendConsistency: z.number().positive().max(1),
  trendNoisePerDecade: z.number().positive().max(1),
  heterogeneityModerate: z.number().positive().max(1),
  heterogeneityHigh: z.number().positive().max(1),
  minimumAgreementBins: z.number().int().positive(),
  provenance: z.string().min(1).max(500),
});
export type VegetationHistoryPolicy = z.infer<
  typeof vegetationHistoryPolicySchema
>;
const window = z.strictObject({
  start: monthDay,
  end: monthDay,
  days: z.number().int().positive().max(365),
  yearsMin: z.number().int().nonnegative(),
});
const windowSet = z.strictObject({
  status: z.enum(["available", "insufficient_history"]),
  windows: z.array(window).max(12),
});
export const vegetationHistorySchema = z.strictObject({
  version: z.literal("vegetation-history-1"),
  policy: vegetationHistoryPolicySchema,
  asOf: calendarDateSchema,
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  source: z.strictObject({
    product: z.string().min(1).max(120),
    resolutionMeters: z.literal(250),
    pixelAreaHa: z.number().positive(),
    note: z.string().min(1).max(500),
  }),
  years: z.strictObject({
    used: z.number().int().nonnegative(),
    excluded: z
      .array(
        z.strictObject({
          year: z.number().int().min(1999).max(2100),
          reason: z.enum(["too_few_dates", "no_distinct_season", "no_data"]),
        }),
      )
      .max(60),
  }),
  bins: z
    .array(
      z.strictObject({
        start: monthDay,
        end: monthDay,
        yearsWithData: z.number().int().nonnegative(),
        lowShare: share.nullable(),
        greenShare: share.nullable(),
      }),
    )
    .max(40),
  usuallyLow: windowSet,
  usuallyGreen: windowSet,
  annualPeaks: z
    .array(
      z.strictObject({
        year: z.number().int().min(1999).max(2100),
        peakNdvi: z.number().min(-0.2).max(1),
      }),
    )
    .max(60),
  peakTrend: z.strictObject({
    status: z.enum(["ok", "insufficient_history"]),
    years: z.number().int().nonnegative(),
    slopePerDecade: z.number().nullable(),
    direction: z.enum(["rising", "falling", "no_clear_trend", "not_computed"]),
    consistency: share.nullable(),
  }),
  heterogeneity: z.strictObject({
    status: z.enum(["similar", "moderate", "differs", "not_measured"]),
    medianAbsDifference: z.number().nonnegative().nullable(),
    observations: z.number().int().nonnegative(),
  }),
  hlsAgreement: z
    .strictObject({
      status: z.enum(["close", "partial", "weak", "insufficient_overlap"]),
      overlapYearBins: z.number().int().nonnegative(),
      correlation: z.number().min(-1).max(1).nullable(),
      meanDifferenceHlsMinusModis: z.number().nullable(),
      hlsLowDaysAlsoLowInModis: share.nullable(),
      modisLowDaysAlsoLowInHls: share.nullable(),
    })
    .nullable(),
  uncertainty: z.strictObject({
    datesSeen: z.number().int().nonnegative(),
    datesUsable: z.number().int().nonnegative(),
    usableShare: share,
    yearsUsed: z.number().int().nonnegative(),
    yearsExcluded: z.number().int().nonnegative(),
  }),
  explanations: z
    .array(
      z.strictObject({
        key: z.string().regex(/^[a-z0-9_.]{1,80}$/),
        text: z.string().min(1).max(500),
      }),
    )
    .max(12),
  limitations: z.array(z.string().min(1).max(400)).min(1).max(12),
});
export type VegetationHistory = z.infer<typeof vegetationHistorySchema>;
const unavailable = z.strictObject({
  status: z.literal("unavailable"),
  // "none" means no MODIS extraction was ever requested for this field.
  observation: z.enum(["none", "queued", "submitted", "failed"]),
  error: z.string().max(60).nullable(),
});
export const vegetationHistoryResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    extractionId: z.uuid(),
    completedAt: z.iso.datetime(),
    hlsCompared: z.boolean(),
    history: vegetationHistorySchema,
  }),
  unavailable,
]);
export type VegetationHistoryResponse = z.infer<
  typeof vegetationHistoryResponseSchema
>;
