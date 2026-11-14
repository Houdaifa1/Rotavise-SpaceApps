import type { RegionGeometry } from "@rotavise/contracts";

type Ring = [number, number][];
// Even-odd ray casting on [longitude, latitude] rings. A point inside a hole
// is outside the polygon. Boundary points follow the same deterministic rule.
function inRing(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!,
      [xj, yj] = ring[j]!;
    if (
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function containsPoint(
  geometry: RegionGeometry,
  longitude: number,
  latitude: number,
): boolean {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (polygon) =>
      inRing(longitude, latitude, polygon[0]!) &&
      !polygon.slice(1).some((hole) => inRing(longitude, latitude, hole)),
  );
}
