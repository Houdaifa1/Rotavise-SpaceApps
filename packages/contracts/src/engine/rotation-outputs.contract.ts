import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";
import {
  modelRecallSchema,
  ruleVerificationSchema,
} from "../catalog/catalog-v2.contract.js";
import { citationSchema } from "../catalog/source.contract.js";
import {
  researchCitationSchema,
  researchRangeSchema,
} from "../catalog/research.contract.js";
import {
  terrainResultSchema,
  ecostressResultSchema,
  waterStorageResultSchema,
} from "../observations/terrain-water.contract.js";

const point = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const analysisGridSchema = z.strictObject({
  input: z.enum([
    "POWER",
    "GPM",
    "HLS",
    "SMAP",
    "NEX-GDDP",
    "NASADEM",
    "GRACE",
    "ECOSTRESS",
    "MODIS",
    "GEDI",
  ]),
  use: z.enum(["engine_input", "reported_context", "not_used"]),
  grid: z.string().min(1).max(200),
  resolution: z.strictObject({
    meters: z.number().positive().nullable(),
    latitudeDegrees: z.number().positive().nullable(),
    longitudeDegrees: z.number().positive().nullable(),
  }),
  cell: point.nullable(),
  row: z.number().int().nullable(),
  column: z.number().int().nullable(),
  tile: z.string().max(120).nullable(),
  selection: z.string().min(1).max(300),
  samplePoints: z.array(point).max(1000),
  evidenceIds: z.array(z.string().max(200)).max(4000),
  resampling: z.literal("none_added"),
  upstreamResampling: z.string().min(1).max(300),
});
export type AnalysisGrid = z.infer<typeof analysisGridSchema>;
const snapshot = <T extends z.ZodType>(result: T) =>
  z.strictObject({
    id: z.uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    result,
    samplePoints: z.array(point).max(1000),
  });
// Internal, runtime-validated evidence pinned in the hashed planning versions.
export const rotationAnalysisContextSchema = z.strictObject({
  fieldId: z.uuid().nullable(),
  terrain: snapshot(terrainResultSchema).nullable(),
  ecostress: snapshot(ecostressResultSchema).nullable(),
  waterStorage: z
    .strictObject({
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      result: waterStorageResultSchema,
    })
    .nullable(),
  observations: z.array(analysisGridSchema).max(5),
});
export type RotationAnalysisContext = z.infer<
  typeof rotationAnalysisContextSchema
>;
export const vulnerabilitySeasonSchema = z.strictObject({
  slot: z.number().int().min(1).max(20),
  cropId: z.string().max(80),
  notAForecast: z.literal(true),
  sowingDates: z.array(calendarDateSchema).min(1).max(367),
  periods: z
    .array(
      z.strictObject({
        code: z.enum([
          "EXPOSURE_HEAT",
          "EXPOSURE_COLD",
          "EXPOSURE_RAIN_DEFICIT",
          "EXPOSURE_UNAVAILABLE",
        ]),
        stage: z.string().min(1).max(80),
        start: calendarDateSchema.nullable(),
        end: calendarDateSchema.nullable(),
        ruleIds: z.array(z.string().max(80)).max(8),
        citations: z.array(citationSchema).max(64),
        verification: ruleVerificationSchema.nullable(),
        basis: z.string().min(1).max(200),
        numbers: z.record(z.string().max(60), z.number().finite().nullable()),
      }),
    )
    .max(132),
});
export type VulnerabilitySeason = z.infer<typeof vulnerabilitySeasonSchema>;
export const rotationOutputsSchema = z.strictObject({
  version: z.literal("rotation-outputs-1"),
  analysisContext: rotationAnalysisContextSchema,
  grids: z.array(analysisGridSchema).length(10),
  terrain: z.strictObject({
    rankingApplied: z.literal(false),
    slope: terrainResultSchema.shape.slope,
    erosion: z.strictObject({
      code: z.literal("EROSION_FACTORS_MISSING"),
      status: z.literal("unranked_incomplete_rusle"),
      ls: terrainResultSchema.shape.erosion,
      missingFactors: z
        .array(z.enum(["R", "K", "LS", "C", "P"]))
        .min(1)
        .max(5),
      soilLossTPerHaPerYear: z.null(),
      cropCover: z
        .array(
          z.strictObject({
            cropId: z.string().max(80),
            status: z.enum(["not_found", "sourced", "model_recall"]),
            factor: z.number().nonnegative().nullable(),
            referenceId: z.string().max(80).nullable(),
            citations: z.array(citationSchema).max(12),
            recall: modelRecallSchema.nullable(),
            catalogReferenceIds: z.array(z.string().max(80)).max(60),
            scenarios: z
              .array(
                z.strictObject({
                  findingId: z.string().min(1).max(200),
                  range: researchRangeSchema,
                  unit: z.literal("dimensionless RUSLE C"),
                  nonLocal: z.boolean(),
                  conditions: z.array(z.string()),
                  citations: z.array(researchCitationSchema).min(1).max(40),
                }),
              )
              .max(60)
              .optional(),
          }),
        )
        .max(450),
    }),
    infiltrationDrainage: z.strictObject({
      code: z.literal("INFILTRATION_DRAINAGE_UNKNOWN"),
      status: z.literal("not_found"),
      note: z.string().max(500),
    }),
  }),
  priorities: z
    .array(
      z.strictObject({
        id: z.enum(["equipment_limits", "market_access", "income_weight"]),
        status: z.literal("not_found"),
        rankingApplied: z.literal(false),
        code: z.enum([
          "EQUIPMENT_DATA_UNAVAILABLE",
          "MARKET_ACCESS_DATA_UNAVAILABLE",
          "INCOME_DATA_UNAVAILABLE",
        ]),
        cropIds: z.array(z.string().max(80)).max(450),
        note: z.string().max(500),
      }),
    )
    .max(3),
});
