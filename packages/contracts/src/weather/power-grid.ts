// POWER returns the value of the source grid cell that contains a point, with
// no interpolation inside a cell (observed 2026-10-17; docs/evidence/
// climate-scenarios/2026-10-17). Requests therefore send the centre of the
// intersection of the MERRA-2 (0.5° × 0.625°) cell and the CERES SYN1deg (1°)
// cell that contain the point: the same values, without the farmer's position.
// All bounds are multiples of 1/32°, so the arithmetic below is exact.
export type PowerCell = {
  latitude: number;
  longitude: number;
  bounds: { south: number; north: number; west: number; east: number };
};
const zero = (v: number) => (Object.is(v, -0) ? 0 : v);
export function powerCell(latitude: number, longitude: number): PowerCell {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new RangeError("POWER_COORDINATE_INVALID");
  // The 180° meridian is the -180° meridian.
  const lon = longitude === 180 ? -180 : longitude;
  const merraLat = Math.round(latitude / 0.5) * 0.5;
  const merraLon = -180 + (Math.round((lon + 180) / 0.625) % 576) * 0.625;
  let merraWest = merraLon - 0.3125;
  // The -180° MERRA-2 cell straddles the antimeridian; keep the point's side.
  if (merraWest < -180 && lon > 0) merraWest += 360;
  const solarSouth = latitude === 90 ? 89 : Math.floor(latitude);
  const solarWest = Math.floor(lon);
  const south = Math.max(merraLat - 0.25, solarSouth, -90);
  const north = Math.min(merraLat + 0.25, solarSouth + 1, 90);
  const west = Math.max(merraWest, solarWest, -180);
  const east = Math.min(merraWest + 0.625, solarWest + 1, 180);
  if (!(south < north) || !(west < east))
    throw new RangeError("POWER_CELL_EMPTY");
  return {
    latitude: zero((south + north) / 2),
    longitude: zero((west + east) / 2),
    bounds: {
      south: zero(south),
      north: zero(north),
      west: zero(west),
      east: zero(east),
    },
  };
}
export function isPowerCellCentre(latitude: number, longitude: number) {
  try {
    const cell = powerCell(latitude, longitude);
    return cell.latitude === latitude && cell.longitude === longitude;
  } catch {
    return false;
  }
}
