import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";

// Terrain, plant-water stress and regional water-storage context for a saved
// field. Each result names its product, resolution, uncertainty and the origin
// of every formula, so a reader can tell sourced values from heuristics.
export const extractionKinds = ["terrain", "ecostress", "modis"] as const;
export const extractionKindSchema = z.enum(extractionKinds);
export type ExtractionKind = z.infer<typeof extractionKindSchema>;
const provenance = z
  .array(
    z.strictObject({
      item: z.string().min(1).max(200),
      origin: z.enum(["sourced", "model_recall", "engineering_judgment"]),
      reference: z.string().min(1).max(300),
    }),
  )
  .min(1)
  .max(20);
const limitations = z.array(z.string().min(1).max(400)).min(1).max(12);
// Plain-language text keys the interface turns into explanations.
const explanationKeys = z.array(z.string().regex(/^[a-z0-9_.]{1,80}$/)).max(12);
export const terrainResultSchema = z.strictObject({
  kind: z.literal("terrain"),
  policyVersion: z.literal("terrain-policy-1"),
  product: z.literal("NASADEM_NC.001 elevation (30 m) via AppEEARS"),
  resolutionMeters: z.number().positive().max(500),
  grid: z.strictObject({
    rows: z.number().int().min(3).max(100),
    cols: z.number().int().min(3).max(100),
    cellNorthM: z.number().positive().max(2000),
    cellEastM: z.number().positive().max(2000),
    stride: z.number().int().min(1).max(30),
    requestedPoints: z.number().int().min(9).max(1000),
    missingPoints: z.number().int().nonnegative(),
  }),
  elevation: z
    .strictObject({
      meanM: z.number(),
      minM: z.number(),
      maxM: z.number(),
      reliefM: z.number().nonnegative(),
      cells: z.number().int().positive(),
    })
    .nullable(),
  slope: z
    .strictObject({
      cells: z.number().int().positive(),
      meanPercent: z.number().nonnegative(),
      p90Percent: z.number().nonnegative(),
      maxPercent: z.number().nonnegative(),
      noiseFloorPercent: z.number().nonnegative(),
      dominantAspectDeg: z.number().min(0).max(360).nullable(),
      aspectConsistency: z.number().min(0).max(1),
      classShares: z.record(z.string().max(40), z.number().min(0).max(1)),
    })
    .nullable(),
  erosion: z
    .strictObject({
      slopeLengthM: z.number().positive().max(1000),
      lsFactorMean: z.number().nonnegative(),
      referenceBand: z.enum([
        "below_unit_plot",
        "near_unit_plot",
        "above_unit_plot",
        "far_above_unit_plot",
      ]),
    })
    .nullable(),
  frostPocket: z.strictObject({
    status: z.enum(["possible_cold_air_pool", "not_indicated", "unknown"]),
    belowSurroundingM: z.number().nullable(),
    ringPoints: z.number().int().nonnegative().max(64),
  }),
  explanations: explanationKeys,
  provenance,
  limitations,
});
export type TerrainResult = z.infer<typeof terrainResultSchema>;
export const ecostressResultSchema = z.strictObject({
  kind: z.literal("ecostress"),
  policyVersion: z.enum(["ecostress-policy-1", "ecostress-policy-2"]),
  products: z
    .array(
      z.enum([
        "ECO_L2T_LSTE.002 land surface temperature (70 m) via AppEEARS",
        "ECO_L4T_ESI.002 evaporative stress index PT-JPL (70 m) via AppEEARS",
      ]),
    )
    .min(1)
    .max(2),
  samplePoints: z.number().int().min(1).max(100),
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  acquisitions: z.number().int().nonnegative().max(4000),
  months: z
    .array(
      z.strictObject({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        acquisitions: z.number().int().positive(),
        lstMeanC: z.number().min(-60).max(90).nullable(),
        lstMaxC: z.number().min(-60).max(90).nullable(),
        esiMean: z.number().min(0).max(1).nullable(),
        esiMin: z.number().min(0).max(1).nullable(),
      }),
    )
    .max(120),
  explanations: explanationKeys,
  provenance,
  limitations,
});
export type EcostressResult = z.infer<typeof ecostressResultSchema>;
// MODIS Terra 16-day vegetation index at the field centre, with four
// neighbouring 250 m pixels to show whether the pixel mixes land cover.
export const modisResultSchema = z.strictObject({
  kind: z.literal("modis"),
  policyVersion: z.literal("modis-policy-1"),
  product: z.literal(
    "MOD13Q1.061 vegetation indices (250 m, 16 day) via AppEEARS",
  ),
  resolutionMeters: z.literal(250),
  period: z.strictObject({
    start: calendarDateSchema,
    end: calendarDateSchema,
  }),
  samplePoints: z.number().int().min(1).max(9),
  datesSeen: z.number().int().nonnegative().max(2000),
  datesUsable: z.number().int().nonnegative().max(2000),
  observations: z
    .array(
      z.strictObject({
        date: calendarDateSchema,
        ndvi: z.number().min(-0.2).max(1),
        neighbourMean: z.number().min(-0.2).max(1).nullable(),
        neighbours: z.number().int().min(0).max(8),
      }),
    )
    .max(1500),
  explanations: explanationKeys,
  provenance,
  limitations,
});
export type ModisResult = z.infer<typeof modisResultSchema>;
export const extractionResultSchema = z.discriminatedUnion("kind", [
  terrainResultSchema,
  ecostressResultSchema,
  modisResultSchema,
]);
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export const extractionStatusSchema = z.strictObject({
  id: z.uuid(),
  fieldId: z.uuid(),
  kind: extractionKindSchema,
  status: z.enum(["queued", "submitted", "completed", "failed"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  result: extractionResultSchema.nullable(),
  error: z.strictObject({ code: z.string().max(60) }).nullable(),
});
export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;
// GRACE / GRACE-FO mascon cell: regional context, never field level.
export const waterStorageResultSchema = z.strictObject({
  kind: z.literal("grace"),
  policyVersion: z.literal("water-trend-policy-1"),
  product: z.string().min(1).max(200),
  cell: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    distanceKm: z.number().nonnegative().max(500),
  }),
  resolutionNote: z.string().min(1).max(300),
  trend: z.strictObject({
    months: z.number().int().positive(),
    missingMonths: z.number().int().nonnegative(),
    period: z.strictObject({
      start: z.string().regex(/^\d{4}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}$/),
    }),
    trendCmPerYear: z.number(),
    standardErrorCmPerYear: z.number().nonnegative(),
    interval95CmPerYear: z.tuple([z.number(), z.number()]),
    residualStdCm: z.number().nonnegative(),
    autocorrelation: z.number().min(0).max(1),
    direction: z.enum(["declining", "rising", "no_clear_trend"]),
    latest: z.strictObject({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      anomalyCm: z.number(),
    }),
  }),
  recentMonths: z
    .array(
      z.strictObject({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        anomalyCm: z.number(),
      }),
    )
    .max(120),
  explanations: explanationKeys,
  provenance,
  limitations,
});
export type WaterStorageResult = z.infer<typeof waterStorageResultSchema>;
