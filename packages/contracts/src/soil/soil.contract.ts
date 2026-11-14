import { z } from "zod";

// Modelled soil properties at about 250 m from SoilGrids 2.0 (ISRIC, CC BY 4.0),
// averaged over 0–30 cm by layer thickness. An estimate, never a soil test.
export const SOIL_DATASET = "SoilGrids 2.0";
export const SOIL_ATTRIBUTION =
  "SoilGrids 2.0, ISRIC – World Soil Information, CC BY 4.0; Poggio et al. 2021, SOIL 7, 217–240; https://www.isric.org/explore/soilgrids";
export const soilProperties = [
  "phh2o",
  "clay",
  "sand",
  "silt",
  "soc",
  "bdod",
  "cec",
  "nitrogen",
] as const;
export type SoilProperty = (typeof soilProperties)[number];
export const soilDepths = ["0-5cm", "5-15cm", "15-30cm"] as const;
export type SoilDepth = (typeof soilDepths)[number];
// Stored integers divided by these give the stated units (ISRIC's table).
export const soilPropertyScale: Record<SoilProperty, number> = {
  phh2o: 10,
  clay: 10,
  sand: 10,
  silt: 10,
  soc: 10,
  bdod: 100,
  cec: 10,
  nitrogen: 100,
};
// Requests name a 0.01° cell (about 1 km), never the field's exact position.
export function soilCell(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new RangeError("SOIL_COORDINATE_INVALID");
  return {
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitude.toFixed(2)),
  };
}
const value = (max: number) => z.number().min(0).max(max).nullable();
export const soilEstimateSchema = z
  .strictObject({
    dataset: z.literal(SOIL_DATASET),
    attribution: z.literal(SOIL_ATTRIBUTION),
    adapterVersion: z.literal("1"),
    cell: z.strictObject({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    depth: z.literal("0-30cm"),
    retrievedAt: z.iso.datetime({ offset: false }),
    // The median over the cell's pixels, because the field's exact pixel is
    // not known to the provider; null where SoilGrids has no value.
    phWater: value(14),
    clayPercent: value(100),
    sandPercent: value(100),
    siltPercent: value(100),
    organicCarbonGPerKg: value(1000),
    bulkDensityGPerCm3: value(3),
    cationExchangeCmolPerKg: value(500),
    nitrogenGPerKg: value(100),
  })
  .superRefine((s, ctx) => {
    const parts = [s.clayPercent, s.sandPercent, s.siltPercent];
    if (parts.every((p) => p !== null)) {
      const sum = parts.reduce((a, b) => a! + b!, 0)!;
      if (sum < 90 || sum > 110)
        ctx.addIssue({
          code: "custom",
          message: "Texture does not sum to 100",
        });
    }
  });
export type SoilEstimate = z.infer<typeof soilEstimateSchema>;
