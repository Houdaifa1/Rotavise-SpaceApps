import type { FieldBoundary } from "@rotavise/contracts";

// AppEEARS point samples for MODIS: the centre of the field's bounding box and
// four neighbouring pixels one MODIS pixel (250 m) north, east, south and
// west. The neighbours only show whether the centre pixel mixes land cover.
const METRES_PER_DEGREE = (Math.PI / 180) * 6371008.8;
export const MODIS_PIXEL_METRES = 250;
// First date of the MOD13Q1.061 record, as listed by AppEEARS on 2026-11-08.
export const MODIS_FIRST_DATE = "2000-02-18";
export const MODIS_PRODUCT = "MOD13Q1.061";
export const MODIS_LAYERS = [
  "_250m_16_days_NDVI",
  "_250m_16_days_pixel_reliability",
  "_250m_16_days_composite_day_of_the_year",
] as const;
export type ModisPoint = { id: string; latitude: number; longitude: number };
const six = (v: number) => Number(v.toFixed(6));
export function modisPoints(boundary: FieldBoundary): ModisPoint[] {
  const ring = boundary.coordinates[0] as [number, number][];
  const lons = ring.map((p) => p[0]),
    lats = ring.map((p) => p[1]);
  const latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
  const longitude = (Math.min(...lons) + Math.max(...lons)) / 2;
  const dLat = MODIS_PIXEL_METRES / METRES_PER_DEGREE;
  const dLon =
    MODIS_PIXEL_METRES /
    (METRES_PER_DEGREE * Math.cos((latitude * Math.PI) / 180));
  return [
    { id: "centre", latitude: six(latitude), longitude: six(longitude) },
    { id: "north", latitude: six(latitude + dLat), longitude: six(longitude) },
    { id: "east", latitude: six(latitude), longitude: six(longitude + dLon) },
    { id: "south", latitude: six(latitude - dLat), longitude: six(longitude) },
    { id: "west", latitude: six(latitude), longitude: six(longitude - dLon) },
  ];
}
