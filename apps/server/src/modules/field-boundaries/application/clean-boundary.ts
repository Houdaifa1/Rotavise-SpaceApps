import { z } from "zod";
import {
  boundaryHectares,
  fieldBoundarySchema,
  type FieldBoundary,
} from "@rotavise/contracts";

type Position = [number, number];
const inputSchema = z.strictObject({
  type: z.literal("Polygon"),
  coordinates: z
    .array(
      z
        .array(
          z.tuple([
            z.number().finite().min(-180).max(180),
            z.number().finite().min(-90).max(90),
          ]),
        )
        .min(4)
        .max(10000),
    )
    .min(1)
    .max(32),
});
const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
function ringArea(ring: Position[], latitude: number) {
  const k = (Math.PI / 180) * 6371008.8;
  const cos = Math.cos((latitude * Math.PI) / 180);
  const origin = ring[0]!;
  let sum = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i]!,
      b = ring[i + 1]!;
    sum +=
      ((a[0] - origin[0]) * (b[1] - origin[1]) -
        (b[0] - origin[0]) * (a[1] - origin[1])) *
      k *
      k *
      cos;
  }
  return Math.abs(sum) / 2;
}
function simplify(ring: Position[], tolerance: number, latitude: number) {
  const k = (Math.PI / 180) * 6371008.8;
  const cos = Math.cos((latitude * Math.PI) / 180);
  // Iterative Douglas-Peucker, including the closing position. Closed endpoints
  // initially have zero length; the most distant vertex divides that segment.
  const keep = new Set([0, ring.length - 1]);
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = ring[start]!,
      b = ring[end]!;
    const dx = (b[0] - a[0]) * k * cos,
      dy = (b[1] - a[1]) * k;
    let best = tolerance * tolerance,
      index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = ring[i]!;
      const px = (p[0] - a[0]) * k * cos,
        py = (p[1] - a[1]) * k;
      const t = Math.max(
        0,
        Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)),
      );
      const distance = (px - t * dx) ** 2 + (py - t * dy) ** 2;
      if (distance > best) {
        best = distance;
        index = i;
      }
    }
    if (index >= 0) {
      keep.add(index);
      stack.push([start, index], [index, end]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => ring[i]!);
}
export type CleanedBoundary = {
  geometry: FieldBoundary;
  areaHectares: number;
  holesDropped: number;
  areaChangePercent: number;
};
export function cleanBoundary(raw: unknown): CleanedBoundary | null {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const rings = parsed.data.coordinates.map((ring) =>
    ring.filter((p, i) => i === 0 || !same(p, ring[i - 1]!)),
  );
  if (rings.some((r) => r.length < 4 || !same(r[0]!, r.at(-1)!))) return null;
  const outer = rings[0]!;
  const latitude = outer.reduce((s, p) => s + p[1], 0) / outer.length;
  const originalArea =
    ringArea(outer, latitude) -
    rings.slice(1).reduce((s, r) => s + ringArea(r, latitude), 0);
  if (!(originalArea > 0)) return null;
  // Removing collinear points first is lossless. Never repair a crossing ring
  // into a different shape; the shared schema rejects it, or it is dropped.
  for (const tolerance of [0, 5, 2.5, 1.25, 0.625, 0.3125, 0.15625, 0.078125]) {
    const ring = simplify(outer, tolerance, latitude);
    const candidate = fieldBoundarySchema.safeParse({
      type: "Polygon",
      coordinates: [ring],
    });
    if (!candidate.success) continue;
    const change =
      (Math.abs(ringArea(ring, latitude) - originalArea) / originalArea) * 100;
    if (change > 2) continue;
    const hectares = boundaryHectares(candidate.data);
    // Rounding near a product bound must not violate the response contract.
    if (hectares < 0.1 || hectares > 1000) continue;
    return {
      geometry: candidate.data,
      areaHectares: hectares,
      holesDropped: rings.length - 1,
      areaChangePercent: change,
    };
  }
  return null;
}
export function boundaryBox(geometry: FieldBoundary) {
  const ring = geometry.coordinates[0];
  const xs = ring.map((p) => p[0]),
    ys = ring.map((p) => p[1]);
  return [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ] as const;
}
