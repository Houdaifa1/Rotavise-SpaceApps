import { z } from "zod";

// GPM IMERG Final daily V07 for the field's 0.1° cell, as a monthly climatology.
// It corrects POWER's coarse rain month by month; daily timing stays POWER's.
export const RAIN_REFERENCE_DATASET = "GPM IMERG Final Daily V07";
export const RAIN_REFERENCE_FIRST_YEAR = 2001;
export const RAIN_REFERENCE_LAST_YEAR = 2020;
export const rainReferenceSchema = z.strictObject({
  dataset: z.literal(RAIN_REFERENCE_DATASET),
  cell: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  firstYear: z.literal(RAIN_REFERENCE_FIRST_YEAR),
  lastYear: z.literal(RAIN_REFERENCE_LAST_YEAR),
  retrievedAt: z.iso.datetime({ offset: false }),
  // Mean total rain per calendar month, January first.
  monthlyMeanMm: z.array(z.number().min(0).max(5000)).length(12),
});
export type RainReference = z.infer<typeof rainReferenceSchema>;
export function rainCell(latitude: number, longitude: number) {
  const centre = (v: number) =>
    Number((Math.floor(v * 10) / 10 + 0.05).toFixed(2));
  return { latitude: centre(latitude), longitude: centre(longitude) };
}
