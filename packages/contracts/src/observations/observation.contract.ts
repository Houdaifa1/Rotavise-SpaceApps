import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";

// Satellite and model context for a saved field. Every value is regional or
// pixel-level evidence with its source; none is a diagnosis or a crop name.
export const observationKinds = ["hls", "smap", "gpm"] as const;
export const observationKindSchema = z.enum(observationKinds);
export type ObservationKind = z.infer<typeof observationKindSchema>;
// Declared product heuristics (not agronomic thresholds), versioned so a
// change recalculates rather than silently altering stored results.
export const vegetationPolicySchema = z.strictObject({
  version: z.literal("vegetation-policy-1"),
  // HLS v2.0 Fmask: bits 1–5 (cloud, adjacent, shadow, snow/ice, water) must
  // be clear and the aerosol level (bits 6–7) must not be "high".
  minimumClearShare: z.number().min(0.1).max(1),
  smoothingObservations: z
    .number()
    .int()
    .min(1)
    .max(15)
    .refine((n) => n % 2 === 1),
  // TIMESAT-style amplitude fraction (Jönsson & Eklundh 2004).
  seasonLevelFraction: z.number().min(0.1).max(0.9),
  seasonPeakFraction: z.number().min(0.1).max(1),
  mergeGapDays: z.number().int().min(0).max(90),
  minimumSeasonDays: z.number().int().min(1).max(200),
  // Amplitude must exceed this multiple of the series' own noise.
  minimumSignalToNoise: z.number().min(1).max(20),
});
export type VegetationPolicy = z.infer<typeof vegetationPolicySchema>;
const ndvi = z.number().min(-1).max(1);
export const vegetationResultSchema = z.strictObject({
  kind: z.literal("hls"),
  policy: vegetationPolicySchema,
  product: z.literal("HLS v2.0 (HLSL30.020, HLSS30.020) via AppEEARS"),
  samplePoints: z.number().int().min(1).max(100),
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  observations: z
    .array(
      z.strictObject({
        date: calendarDateSchema,
        ndvi,
        clearPoints: z.number().int().min(1).max(100),
        sensors: z
          .array(z.enum(["landsat", "sentinel-2"]))
          .min(1)
          .max(2),
      }),
    )
    .max(5000),
  datesSeen: z.number().int().nonnegative(),
  datesUsable: z.number().int().nonnegative(),
  seasons: z
    .array(
      z.strictObject({
        start: calendarDateSchema,
        end: calendarDateSchema,
        peakDate: calendarDateSchema,
        peakNdvi: ndvi,
        observations: z.number().int().positive(),
        largestGapDays: z.number().int().nonnegative(),
        openAtStart: z.boolean(),
        openAtEnd: z.boolean(),
      }),
    )
    .max(100),
  signal: z.strictObject({
    baseline: ndvi,
    peak: ndvi,
    noise: z.number().nonnegative(),
    distinct: z.boolean(),
  }),
  // HLS granule ids of the usable dates, read from the AppEEARS granule list
  // of the same task. Absent on results saved before this field existed.
  granules: z
    .array(
      z.strictObject({
        date: calendarDateSchema,
        sensor: z.enum(["landsat", "sentinel-2"]),
        granule: z
          .string()
          .regex(/^HLS\.[LS]30\.T[0-9A-Z]{5}\.\d{7}T\d{6}\.v2\.0$/),
      }),
    )
    .max(10000)
    .optional(),
  limitations: z.array(z.string().max(300)).min(1).max(10),
});
export type VegetationResult = z.infer<typeof vegetationResultSchema>;
export const soilMoistureResultSchema = z.strictObject({
  kind: z.literal("smap"),
  product: z.literal(
    "SMAP L4 SPL4SMGP.008 root-zone soil moisture via AppEEARS",
  ),
  // The 9 km EASE-Grid cell, named by AppEEARS row and column.
  cell: z.strictObject({ line: z.number().int(), sample: z.number().int() }),
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  days: z
    .array(
      z.strictObject({
        date: calendarDateSchema,
        // SPL4SMGP.008 leaves the percentile undefined on many days
        // (observed March–November at the Tadla test cell).
        percentile: z.number().min(0).max(100).nullable(),
        volumetric: z.number().min(0).max(0.9),
      }),
    )
    .max(4000),
  latest: z
    .strictObject({
      date: calendarDateSchema,
      percentile: z.number().min(0).max(100),
    })
    .nullable(),
  limitations: z.array(z.string().max(300)).min(1).max(10),
});
export type SoilMoistureResult = z.infer<typeof soilMoistureResultSchema>;
export const rainResultSchema = z.strictObject({
  kind: z.literal("gpm"),
  product: z.literal(
    "GPM IMERG Final daily V07 (GPM_3IMERGDF.07) via Giovanni",
  ),
  cell: z.strictObject({ latitude: z.number(), longitude: z.number() }),
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
        imergDays: z.number().int().nonnegative(),
      }),
    )
    .max(240),
  limitations: z.array(z.string().max(300)).min(1).max(10),
});
export type RainResult = z.infer<typeof rainResultSchema>;
export const observationResultSchema = z.discriminatedUnion("kind", [
  vegetationResultSchema,
  soilMoistureResultSchema,
  rainResultSchema,
]);
export type ObservationResult = z.infer<typeof observationResultSchema>;
export const observationStatusSchema = z.strictObject({
  id: z.uuid(),
  fieldId: z.uuid(),
  kind: observationKindSchema,
  status: z.enum(["queued", "submitted", "completed", "failed"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  result: observationResultSchema.nullable(),
  error: z.strictObject({ code: z.string().max(60) }).nullable(),
});
export type ObservationStatus = z.infer<typeof observationStatusSchema>;
