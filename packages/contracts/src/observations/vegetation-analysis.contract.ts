import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";

// What the field's own greenness history says: a per-year timeline, green and
// low-greenness periods, the windows that are usually low, and how today's
// readings compare with the field's other years. Every limit is relative to
// the field's own series or declared here with its basis; none is a crop
// threshold, and none is a diagnosis.
export const vegetationAnalysisPolicySchema = z.strictObject({
  version: z.literal("vegetation-analysis-1"),
  // A calendar day counts as "usually low" when at least this share of the
  // complete years had it outside a green season.
  typicalShare: z.number().min(0.5).max(1),
  // "Usually low" is only claimed from at least this many complete years.
  minimumTypicalYears: z.number().int().min(3).max(20),
  // A calendar year counts as complete with at least this many usable dates.
  completeYearMinObservations: z.number().int().min(1).max(200),
  // A stretch of this many days or more between usable dates lowers the
  // confidence of any period that contains it.
  longGapDays: z.number().int().min(1).max(365),
  // A reported "usually low" window is at least this long.
  minimumWindowDays: z.number().int().min(1).max(120),
  // Other years are compared inside plus or minus this many days.
  anomalyWindowDays: z.number().int().min(1).max(60),
  minimumReferenceYears: z.number().int().min(3).max(20),
  // Robust z-score (median and MAD of the other years) that raises a flag.
  anomalyRobustZ: z.number().min(1).max(6),
  // Used when the series' own noise and the reference spread are both zero.
  noiseFloor: z.number().min(0.005).max(0.2),
  // The latest reading is stale when older than this many days at "as of".
  staleDays: z.number().int().min(1).max(365),
  // Anomaly points are listed for the last this many days of the series.
  recentDays: z.number().int().min(30).max(800),
  provenance: z.string().max(300),
});
export type VegetationAnalysisPolicy = z.infer<
  typeof vegetationAnalysisPolicySchema
>;
const ndvi = z.number().min(-1).max(1);
const monthDay = z.string().regex(/^\d{2}-\d{2}$/);
export const vegetationPeriodSchema = z.strictObject({
  // Low greenness often means bare soil or stubble, but the satellite cannot
  // tell: the farmer confirms what was on the field.
  kind: z.enum(["green", "low_greenness"]),
  start: calendarDateSchema,
  end: calendarDateSchema,
  source: z.enum(["detected_season", "between_seasons"]),
  peakDate: calendarDateSchema.nullable(),
  peakNdvi: ndvi.nullable(),
  // Starts or ends where the series itself starts or ends.
  openAtStart: z.boolean(),
  openAtEnd: z.boolean(),
  largestGapDays: z.number().int().nonnegative(),
  confidence: z.enum(["normal", "low"]),
});
export type VegetationPeriod = z.infer<typeof vegetationPeriodSchema>;
export const vegetationYearSchema = z.strictObject({
  year: z.number().int().min(1980).max(2100),
  status: z.enum(["complete", "partial", "no_data"]),
  usableObservations: z.number().int().nonnegative(),
  largestGapDays: z.number().int().nonnegative(),
  timeline: z
    .array(
      z.strictObject({
        date: calendarDateSchema,
        ndvi,
        clearPoints: z.number().int().min(1).max(100),
        sensors: z
          .array(z.enum(["landsat", "sentinel-2"]))
          .min(1)
          .max(2),
        granules: z.array(z.string().max(60)).max(4),
      }),
    )
    .max(400),
  periods: z.array(vegetationPeriodSchema).max(20),
});
export const vegetationAnomalyPointSchema = z.strictObject({
  date: calendarDateSchema,
  ndvi,
  referenceMedian: ndvi,
  referenceYears: z.number().int().positive(),
  spread: z.number().positive(),
  anomaly: z.number().min(-2).max(2),
  robustZ: z.number().min(-1000).max(1000),
  flag: z.enum(["below_usual", "above_usual", "usual"]),
});
export const vegetationAnalysisSchema = z.strictObject({
  version: z.literal("vegetation-analysis-1"),
  policy: vegetationAnalysisPolicySchema,
  asOf: calendarDateSchema,
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  samplePoints: z.number().int().min(1).max(100),
  periodsStatus: z.enum(["available", "undetermined"]),
  undeterminedReason: z
    .enum(["too_few_observations", "no_distinct_seasonal_signal"])
    .nullable(),
  years: z.array(vegetationYearSchema).max(40),
  typicalLowGreenness: z
    .strictObject({
      completeYears: z.number().int().nonnegative(),
      windows: z
        .array(
          z.strictObject({
            start: monthDay,
            end: monthDay,
            // The fewest complete years in which every day of the window was
            // low; never more than completeYears.
            yearsLowMin: z.number().int().positive(),
          }),
        )
        .max(12),
    })
    .nullable(),
  anomalies: z.strictObject({
    status: z.enum(["ok", "insufficient_history"]),
    referenceYears: z.number().int().nonnegative(),
    points: z.array(vegetationAnomalyPointSchema).max(400),
    below: z.number().int().nonnegative(),
    above: z.number().int().nonnegative(),
    latest: z
      .strictObject({
        date: calendarDateSchema,
        ndvi,
        daysOld: z.number().int().nonnegative(),
        stale: z.boolean(),
        flag: z.enum(["below_usual", "above_usual", "usual", "not_compared"]),
      })
      .nullable(),
  }),
  uncertainty: z.strictObject({
    datesSeen: z.number().int().nonnegative(),
    datesUsable: z.number().int().nonnegative(),
    usableShare: z.number().min(0).max(1),
    largestGapDays: z.number().int().nonnegative(),
    gapsOverLimit: z
      .array(
        z.strictObject({
          start: calendarDateSchema,
          end: calendarDateSchema,
          days: z.number().int().positive(),
        }),
      )
      .max(60),
    granulesAvailable: z.boolean(),
  }),
  explanations: z
    .array(
      z.strictObject({
        key: z.enum([
          "ndvi",
          "green_season",
          "bare_field_period",
          "vegetation_stress",
          "field_history_anomaly",
          "cloud_gap",
        ]),
        text: z.string().max(400),
      }),
    )
    .max(8),
  limitations: z.array(z.string().max(300)).min(1).max(12),
});
export type VegetationAnalysis = z.infer<typeof vegetationAnalysisSchema>;

// Monthly POWER and GPM IMERG rain for the field's cell, side by side.
export const rainSeriesSchema = z.strictObject({
  version: z.literal("rain-series-1"),
  unit: z.literal("mm per calendar month"),
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  months: z
    .array(
      z.strictObject({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        imergMm: z.number().nonnegative().nullable(),
        powerMm: z.number().nonnegative().nullable(),
        // Both complete; false when a day is missing in either source.
        bothComplete: z.boolean(),
        // IMERG minus POWER, only when both are complete.
        differenceMm: z.number().nullable(),
        // IMERG divided by POWER, only when both are complete and POWER is at
        // least one millimetre.
        ratio: z.number().nonnegative().nullable(),
      }),
    )
    .max(240),
  summary: z.strictObject({
    monthsCompared: z.number().int().nonnegative(),
    imergTotalMm: z.number().nonnegative(),
    powerTotalMm: z.number().nonnegative(),
    ratio: z.number().nonnegative().nullable(),
    // Share of compared months in which IMERG was the wetter source.
    imergWetterShare: z.number().min(0).max(1).nullable(),
  }),
  sources: z.strictObject({
    imerg: z.strictObject({
      product: z.string().max(120),
      cell: z.strictObject({ latitude: z.number(), longitude: z.number() }),
    }),
    power: z.string().max(200),
  }),
  planning: z.string().max(400),
  limitations: z.array(z.string().max(300)).min(1).max(10),
});
export type RainSeries = z.infer<typeof rainSeriesSchema>;

// What the analysis endpoints return: the analysis, or why there is none yet.
const unavailable = z.strictObject({
  status: z.literal("unavailable"),
  // "none" means no extraction was ever requested for this field.
  observation: z.enum(["none", "queued", "submitted", "failed"]),
  error: z.string().max(60).nullable(),
});
export const vegetationAnalysisResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    observationId: z.uuid(),
    completedAt: z.iso.datetime(),
    analysis: vegetationAnalysisSchema,
  }),
  unavailable,
]);
export type VegetationAnalysisResponse = z.infer<
  typeof vegetationAnalysisResponseSchema
>;
export const rainSeriesResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    observationId: z.uuid(),
    completedAt: z.iso.datetime(),
    series: rainSeriesSchema,
  }),
  unavailable,
]);
export type RainSeriesResponse = z.infer<typeof rainSeriesResponseSchema>;
