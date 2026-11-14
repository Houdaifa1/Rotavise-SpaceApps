import { z } from "zod";

// A saved field's outline: one GeoJSON polygon ring (WGS84 longitude,
// latitude), closed, simple, within limits that keep a flat local projection
// accurate (a few kilometres). Product limits, not agronomic values.
export const BOUNDARY_LIMITS = Object.freeze({
  minPositions: 4,
  maxPositions: 201,
  minHectares: 0.1,
  maxHectares: 1000,
  maxSpanDegrees: 0.1,
});
const EARTH_RADIUS_M = 6371008.8;
const position = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
type Ring = [number, number][];
// Metres east and north of the ring's mean point.
function project(ring: Ring) {
  const lat0 = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const lon0 = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const k = (Math.PI / 180) * EARTH_RADIUS_M;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  return {
    points: ring.map(([lon, lat]) => [
      (lon - lon0) * k * cos,
      (lat - lat0) * k,
    ]),
    back: (x: number, y: number): [number, number] => [
      lon0 + x / (k * cos),
      lat0 + y / k,
    ],
  };
}
function area(points: number[][]) {
  let sum = 0;
  for (let i = 0; i + 1 < points.length; i++)
    sum +=
      points[i]![0]! * points[i + 1]![1]! - points[i + 1]![0]! * points[i]![1]!;
  return Math.abs(sum) / 2;
}
const cross = (a: number[], b: number[], c: number[]) =>
  (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
function intersects(a: number[], b: number[], c: number[], d: number[]) {
  const d1 = cross(c, d, a),
    d2 = cross(c, d, b),
    d3 = cross(a, b, c),
    d4 = cross(a, b, d);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
    return true;
  const on = (p: number[], q: number[], r: number[]) =>
    Math.min(p[0]!, q[0]!) <= r[0]! &&
    r[0]! <= Math.max(p[0]!, q[0]!) &&
    Math.min(p[1]!, q[1]!) <= r[1]! &&
    r[1]! <= Math.max(p[1]!, q[1]!);
  return (
    (d1 === 0 && on(c, d, a)) ||
    (d2 === 0 && on(c, d, b)) ||
    (d3 === 0 && on(a, b, c)) ||
    (d4 === 0 && on(a, b, d))
  );
}
function simple(points: number[][]) {
  const n = points.length - 1;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (intersects(points[i]!, points[i + 1]!, points[j]!, points[j + 1]!))
        return false;
    }
  return true;
}
function inside(points: number[][], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = points.length - 2; i < points.length - 1; j = i++) {
    const [xi, yi] = points[i]!,
      [xj, yj] = points[j]!;
    if (
      yi! > y !== yj! > y &&
      x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!
    )
      hit = !hit;
  }
  return hit;
}
function edgeDistance(points: number[][], x: number, y: number) {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i]!,
      [bx, by] = points[i + 1]!;
    const dx = bx! - ax!,
      dy = by! - ay!;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax!) * dx + (y - ay!) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(x - (ax! + t * dx), y - (ay! + t * dy)));
  }
  return best;
}
export const fieldBoundarySchema = z
  .strictObject({
    type: z.literal("Polygon"),
    coordinates: z.tuple([
      z
        .array(position)
        .min(BOUNDARY_LIMITS.minPositions)
        .max(BOUNDARY_LIMITS.maxPositions),
    ]),
  })
  .superRefine((polygon, ctx) => {
    const ring = polygon.coordinates[0] as Ring;
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const first = ring[0]!,
      last = ring.at(-1)!;
    if (first[0] !== last[0] || first[1] !== last[1]) return fail("Open ring");
    const lons = ring.map((p) => p[0]),
      lats = ring.map((p) => p[1]);
    if (
      Math.max(...lons) - Math.min(...lons) > BOUNDARY_LIMITS.maxSpanDegrees ||
      Math.max(...lats) - Math.min(...lats) > BOUNDARY_LIMITS.maxSpanDegrees
    )
      return fail("Too large");
    if (
      ring.some(
        (p, i) => i > 0 && p[0] === ring[i - 1]![0] && p[1] === ring[i - 1]![1],
      ) ||
      new Set(ring.slice(0, -1).map((p) => p.join(","))).size !==
        ring.length - 1
    )
      return fail("Repeated vertex");
    const { points } = project(ring);
    const hectares = area(points) / 10000;
    if (
      hectares < BOUNDARY_LIMITS.minHectares ||
      hectares > BOUNDARY_LIMITS.maxHectares
    )
      return fail("Area outside limits");
    if (!simple(points)) fail("Self-intersecting ring");
  });
export type FieldBoundary = z.infer<typeof fieldBoundarySchema>;
export function boundaryHectares(boundary: FieldBoundary) {
  return Number(
    (area(project(boundary.coordinates[0] as Ring).points) / 10000).toFixed(4),
  );
}
export function boundaryContains(
  boundary: FieldBoundary,
  latitude: number,
  longitude: number,
) {
  const ring = boundary.coordinates[0] as Ring;
  const { points } = project([...ring, [longitude, latitude]]);
  const target = points.pop()!;
  return inside(points, target[0]!, target[1]!);
}
// Points for 30 m satellite pixels: a grid at least `spacing` metres apart,
// each at least half a pixel inside the outline, at most `max` points. An
// outline too narrow for any clean pixel gives no points.
export function boundarySamplePoints(
  boundary: FieldBoundary,
  { spacing = 30, inset = 15, max = 100 } = {},
): { latitude: number; longitude: number }[] {
  const { points, back } = project(boundary.coordinates[0] as Ring);
  const xs = points.map((p) => p[0]!),
    ys = points.map((p) => p[1]!);
  for (let step = spacing; ; step *= 1.25) {
    const out: { latitude: number; longitude: number }[] = [];
    for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step)
      for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step)
        if (inside(points, x, y) && edgeDistance(points, x, y) >= inset) {
          const [lon, lat] = back(x, y);
          out.push({
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lon.toFixed(6)),
          });
        }
    if (out.length <= max) return out;
  }
}
