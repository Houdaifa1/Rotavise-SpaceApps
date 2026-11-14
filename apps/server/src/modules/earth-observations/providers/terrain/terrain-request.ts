import { boundaryContains, type FieldBoundary } from "@rotavise/contracts";

// AppEEARS point samples that rebuild a small NASADEM elevation grid around a
// field, plus a ring of points 300 m and 600 m away for the cold-air check.
// NASADEM pixels are 1 arc-second in latitude and longitude, so the grid steps
// by whole pixels; a coarser stride is used only for large fields.
const ARC_SECOND = 1 / 3600;
const METRES_PER_DEGREE = (Math.PI / 180) * 6371008.8;
export const TERRAIN_GRID_LIMITS = Object.freeze({
  maxGridPoints: 400,
  ringDistancesM: [300, 600] as const,
  ringBearings: 8,
});
export type GridPoint = {
  id: string;
  latitude: number;
  longitude: number;
};
export type TerrainRequest = {
  rows: number;
  cols: number;
  stride: number;
  cellNorthM: number;
  cellEastM: number;
  grid: (GridPoint & { inside: boolean })[];
  ring: (GridPoint & { distanceM: number })[];
};
const six = (v: number) => Number(v.toFixed(6));
export function terrainRequest(boundary: FieldBoundary): TerrainRequest {
  const ring = boundary.coordinates[0] as [number, number][];
  const lons = ring.map((p) => p[0]),
    lats = ring.map((p) => p[1]);
  const minLon = Math.min(...lons),
    maxLon = Math.max(...lons),
    minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  let stride = 1;
  let rows = 0,
    cols = 0;
  for (; stride <= 30; stride++) {
    const dLat = stride * ARC_SECOND,
      dLon = stride * ARC_SECOND;
    rows = Math.floor((maxLat + dLat - (minLat - dLat)) / dLat) + 1;
    cols = Math.floor((maxLon + dLon - (minLon - dLon)) / dLon) + 1;
    if (rows * cols <= TERRAIN_GRID_LIMITS.maxGridPoints) break;
  }
  if (stride > 30) throw new RangeError("FIELD_TOO_LARGE_FOR_TERRAIN");
  const dLat = stride * ARC_SECOND,
    dLon = stride * ARC_SECOND;
  const top = maxLat + dLat,
    left = minLon - dLon;
  const grid: TerrainRequest["grid"] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const latitude = six(top - r * dLat),
        longitude = six(left + c * dLon);
      grid.push({
        id: `g${r}-${c}`,
        latitude,
        longitude,
        inside: boundaryContains(boundary, latitude, longitude),
      });
    }
  const ringPoints: TerrainRequest["ring"] = [];
  let k = 0;
  for (const distanceM of TERRAIN_GRID_LIMITS.ringDistancesM)
    for (let b = 0; b < TERRAIN_GRID_LIMITS.ringBearings; b++) {
      const bearing = (2 * Math.PI * b) / TERRAIN_GRID_LIMITS.ringBearings;
      const latitude = six(
        midLat + (distanceM * Math.cos(bearing)) / METRES_PER_DEGREE,
      );
      const longitude = six(
        midLon + (distanceM * Math.sin(bearing)) / (METRES_PER_DEGREE * cos),
      );
      // A ring point inside a very large outline says nothing about the
      // surroundings, so it is left out.
      if (!boundaryContains(boundary, latitude, longitude))
        ringPoints.push({ id: `n${k}`, latitude, longitude, distanceM });
      k++;
    }
  return {
    rows,
    cols,
    stride,
    cellNorthM: Number((stride * ARC_SECOND * METRES_PER_DEGREE).toFixed(3)),
    cellEastM: Number(
      (stride * ARC_SECOND * METRES_PER_DEGREE * cos).toFixed(3),
    ),
    grid,
    ring: ringPoints,
  };
}
