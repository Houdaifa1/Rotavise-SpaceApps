import proj4 from "proj4";
import polylabel from "polylabel";
import clipping from "polygon-clipping";
import {
  boundaryContains,
  boundaryHectares,
  boundarySamplePoints,
  fieldBoundarySchema,
  type FieldBoundary,
} from "@rotavise/contracts";

export type Point = [number, number];
export type Grid = { zone: number; south: boolean };
export type Cell = [number, number];
export type GeometryIssue =
  | "disconnected"
  | "hole"
  | "complex"
  | "invalid"
  | "large"
  | "area"
  | "crossing";
export class GeometryError extends Error {
  constructor(public issue: GeometryIssue) {
    super(issue);
  }
}
export const cellSize = 30;
// HLS S30 T29SQR real STAC transform: [30,0,699960,0,-30,3600000,0,0,1].
// Both offsets are multiples of 30. See tests/support/fixtures/hls/README.md.
export const latticeOrigin: Point = [0, 0];
export function gridFor([lon, lat]: Point): Grid {
  return {
    zone: Math.max(1, Math.min(60, Math.floor((lon + 180) / 6) + 1)),
    south: lat < 0,
  };
}
const projections = new Map<number, ReturnType<typeof createProjection>>();
function createProjection(zone: number) {
  // HLS uses signed northing, including south of the equator (no false northing).
  return proj4(
    "EPSG:4326",
    `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`,
  );
}
export function projection({ zone }: Grid) {
  let converter = projections.get(zone);
  if (!converter) {
    converter = createProjection(zone);
    projections.set(zone, converter);
  }
  return converter;
}
export const cellKey = ([x, y]: Cell) => `${x},${y}`;
export const parseCell = (key: string): Cell =>
  key.split(",").map(Number) as Cell;
export function cellAt(point: Point, grid: Grid): Cell {
  const [x, y] = projection(grid).forward(point);
  return [
    Math.floor((x! - latticeOrigin[0]) / cellSize),
    Math.floor((y! - latticeOrigin[1]) / cellSize),
  ];
}
export function cellPoint([x, y]: Cell, grid: Grid, centre = false): Point {
  return projection(grid).inverse([
    (x + (centre ? 0.5 : 0)) * cellSize + latticeOrigin[0],
    (y + (centre ? 0.5 : 0)) * cellSize + latticeOrigin[1],
  ]) as Point;
}
// Supercover traversal visits every cell crossed, including fast sparse pointer moves.
export function interpolate(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [a];
  let [x, y] = a;
  const dx = b[0] - x,
    dy = b[1] - y,
    nx = Math.abs(dx),
    ny = Math.abs(dy),
    sx = Math.sign(dx),
    sy = Math.sign(dy);
  let ix = 0,
    iy = 0;
  while (ix < nx || iy < ny) {
    const cross = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (cross === 0) {
      if (ix < nx) {
        x += sx;
        ix++;
        out.push([x, y]);
      }
      if (iy < ny) {
        y += sy;
        iy++;
        out.push([x, y]);
      }
    } else if (cross < 0) {
      x += sx;
      ix++;
      out.push([x, y]);
    } else {
      y += sy;
      iy++;
      out.push([x, y]);
    }
  }
  return out;
}
export function gridFeatures(
  bounds: [Point, Point],
  grid: Grid,
): {
  cells: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  lines: GeoJSON.MultiLineString;
} {
  const corners: Point[] = [
    bounds[0],
    bounds[1],
    [bounds[0][0], bounds[1][1]],
    [bounds[1][0], bounds[0][1]],
  ];
  const cells = corners.map((p) => cellAt(p, grid));
  const xs = cells.map((p) => p[0]),
    ys = cells.map((p) => p[1]);
  const minX = Math.min(...xs) - 1,
    maxX = Math.max(...xs) + 1,
    minY = Math.min(...ys) - 1,
    maxY = Math.max(...ys) + 1;
  if ((maxX - minX + 1) * (maxY - minY + 1) > 24000)
    throw new GeometryError("large");
  const transform = projection(grid);
  const point = (x: number, y: number) =>
    transform.inverse([x * cellSize, y * cellSize]) as Point;
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      features.push({
        type: "Feature",
        id: cellKey([x, y]),
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              point(x, y),
              point(x + 1, y),
              point(x + 1, y + 1),
              point(x, y + 1),
              point(x, y),
            ],
          ],
        },
      });
  const lines: Point[][] = [];
  for (let x = minX; x <= maxX + 1; x++)
    lines.push([point(x, minY), point(x, maxY + 1)]);
  for (let y = minY; y <= maxY + 1; y++)
    lines.push([point(minX, y), point(maxX + 1, y)]);
  return {
    cells: { type: "FeatureCollection", features },
    lines: { type: "MultiLineString", coordinates: lines },
  };
}
function metricArea(ring: Point[]) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++)
    a += ring[i]![0] * ring[i + 1]![1] - ring[i + 1]![0] * ring[i]![1];
  return Math.abs(a / 2);
}
function distance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  let far = 0,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distance(points[i]!, points[0]!, points.at(-1)!);
    if (d > far) {
      far = d;
      index = i;
    }
  }
  if (far <= tolerance) return [points[0]!, points.at(-1)!];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}
export function normalizePolygon(
  input: unknown,
  maxTolerance = 15,
): { boundary: FieldBoundary; filled: boolean; narrow: boolean } {
  // Validate structure before processing any untrusted coordinate arrays.
  if (
    !input ||
    typeof input !== "object" ||
    !("type" in input) ||
    input.type !== "Polygon" ||
    !("coordinates" in input) ||
    !Array.isArray(input.coordinates)
  )
    throw new GeometryError("invalid");
  const rings: Point[][] = [];
  let count = 0;
  for (const value of input.coordinates) {
    if (
      !Array.isArray(value) ||
      value.length < 4 ||
      (count += value.length) > 50000
    )
      throw new GeometryError("complex");
    const ring: Point[] = [];
    for (const p of value) {
      if (
        !Array.isArray(p) ||
        p.length < 2 ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        Math.abs(p[0] as number) > 180 ||
        Math.abs(p[1] as number) > 90
      )
        throw new GeometryError("invalid");
      ring.push([p[0] as number, p[1] as number]);
    }
    if (ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1])
      throw new GeometryError("invalid");
    rings.push(ring);
  }
  const outer = rings[0];
  if (!outer) throw new GeometryError("invalid");
  const xs = outer.map((p) => p[0]),
    ys = outer.map((p) => p[1]);
  if (
    Math.max(...xs) - Math.min(...xs) > 0.1 ||
    Math.max(...ys) - Math.min(...ys) > 0.1
  )
    throw new GeometryError("large");
  const transform = projection(gridFor(outer[0]!));
  const metric = outer.map((p) => transform.forward(p) as Point);
  const area = metricArea(metric);
  if (
    rings
      .slice(1)
      .some(
        (r) => metricArea(r.map((p) => transform.forward(p) as Point)) >= 10000,
      )
  )
    throw new GeometryError("hole");
  // Split at a distant vertex before Douglas–Peucker so closure isn't a zero-length baseline.
  let far = 1;
  for (let i = 2; i < metric.length - 1; i++)
    if (
      Math.hypot(metric[i]![0] - metric[0]![0], metric[i]![1] - metric[0]![1]) >
      Math.hypot(
        metric[far]![0] - metric[0]![0],
        metric[far]![1] - metric[0]![1],
      )
    )
      far = i;
  for (let tolerance = 0; tolerance <= maxTolerance; tolerance += 0.25) {
    const reduced =
      tolerance === 0
        ? metric
        : [
            ...simplify(metric.slice(0, far + 1), tolerance).slice(0, -1),
            ...simplify(metric.slice(far), tolerance),
          ];
    if (
      reduced.length > 201 ||
      Math.abs(metricArea(reduced) - area) / area > 0.02
    )
      continue;
    const coordinates =
      tolerance === 0
        ? outer
        : reduced.map((p) => transform.inverse(p) as Point);
    const result = fieldBoundarySchema.safeParse({
      type: "Polygon",
      coordinates: [coordinates],
    });
    if (
      result.success &&
      Math.abs(
        boundaryHectares(result.data) -
          boundaryHectares({ type: "Polygon", coordinates: [outer] }),
      ) /
        boundaryHectares({ type: "Polygon", coordinates: [outer] }) <=
        0.02
    )
      return {
        boundary: result.data,
        filled: rings.length > 1,
        narrow: boundarySamplePoints(result.data).length === 0,
      };
    if (!result.success && tolerance === 0 && reduced.length <= 201) {
      const issue = result.error.issues[0]?.message;
      if (issue === "Too large") throw new GeometryError("large");
      if (issue === "Area outside limits") throw new GeometryError("area");
      if (issue === "Self-intersecting ring" || issue === "Repeated vertex")
        throw new GeometryError("crossing");
    }
  }
  throw new GeometryError("complex");
}
export function paintBoundary(keys: string[], grid: Grid) {
  if (!keys.length) return undefined;
  if (keys.length > 12000) throw new GeometryError("large");
  const selected = new Set(keys),
    stack = [keys[0]!],
    visited = new Set(stack);
  while (stack.length) {
    const [x, y] = parseCell(stack.pop()!);
    for (const c of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as Cell[]) {
      const k = cellKey(c);
      if (selected.has(k) && !visited.has(k)) {
        visited.add(k);
        stack.push(k);
      }
    }
  }
  if (visited.size !== selected.size) throw new GeometryError("disconnected");
  const cells = keys.map(parseCell),
    xs = cells.map((p) => p[0]),
    ys = cells.map((p) => p[1]);
  const minX = Math.min(...xs) - 1,
    maxX = Math.max(...xs) + 1,
    minY = Math.min(...ys) - 1,
    maxY = Math.max(...ys) + 1;
  if ((maxX - minX) * (maxY - minY) > 100000) throw new GeometryError("large");
  const exterior = new Set<string>(),
    todo: Cell[] = [[minX, minY]];
  exterior.add(cellKey(todo[0]!));
  while (todo.length) {
    const [x, y] = todo.pop()!;
    for (const c of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as Cell[]) {
      const k = cellKey(c);
      if (
        c[0] >= minX &&
        c[0] <= maxX &&
        c[1] >= minY &&
        c[1] <= maxY &&
        !selected.has(k) &&
        !exterior.has(k)
      ) {
        exterior.add(k);
        todo.push(c);
      }
    }
  }
  let filled = false;
  for (let x = minX + 1; x < maxX; x++)
    for (let y = minY + 1; y < maxY; y++) {
      const k = cellKey([x, y]);
      if (selected.has(k) || exterior.has(k)) continue;
      const hole = [k],
        seen = new Set(hole);
      for (let i = 0; i < hole.length; i++) {
        const [hx, hy] = parseCell(hole[i]!);
        for (const c of [
          [hx + 1, hy],
          [hx - 1, hy],
          [hx, hy + 1],
          [hx, hy - 1],
        ] as Cell[]) {
          const n = cellKey(c);
          if (!selected.has(n) && !exterior.has(n) && !seen.has(n)) {
            seen.add(n);
            hole.push(n);
          }
        }
      }
      if (hole.length * 900 >= 10000) throw new GeometryError("hole");
      for (const h of hole) selected.add(h);
      filled = true;
    }
  const edges = new Map<string, Cell[]>();
  const edge = (a: Cell, b: Cell) => {
    const key = cellKey(a);
    edges.set(key, [...(edges.get(key) ?? []), b]);
  };
  for (const k of selected) {
    const [x, y] = parseCell(k);
    if (!selected.has(cellKey([x, y - 1]))) edge([x, y], [x + 1, y]);
    if (!selected.has(cellKey([x + 1, y]))) edge([x + 1, y], [x + 1, y + 1]);
    if (!selected.has(cellKey([x, y + 1]))) edge([x + 1, y + 1], [x, y + 1]);
    if (!selected.has(cellKey([x - 1, y]))) edge([x, y + 1], [x, y]);
  }
  const first = parseCell(edges.keys().next().value!),
    ring: Cell[] = [first];
  let next = first;
  do {
    const candidates = edges.get(cellKey(next));
    if (candidates?.length !== 1) throw new GeometryError("crossing");
    edges.delete(cellKey(next));
    next = candidates[0]!;
    ring.push(next);
  } while (cellKey(next) !== cellKey(first) && ring.length <= 50000);
  if (edges.size) throw new GeometryError("crossing");
  // Exact collinear collapse before any lossy simplification.
  const simple = ring.slice(0, -1).filter((p, i, a) => {
    const prev = a[(i + a.length - 1) % a.length]!,
      n = a[(i + 1) % a.length]!;
    return (
      (p[0] - prev[0]) * (n[1] - p[1]) !== (p[1] - prev[1]) * (n[0] - p[0])
    );
  });
  simple.push(simple[0]!);
  const transform = projection(grid);
  const result = normalizePolygon({
    type: "Polygon",
    coordinates: [simple.map(([x, y]) => transform.inverse([x * 30, y * 30]))],
  });
  return { ...result, filled, cells: [...selected] };
}
export function interiorPoint(boundary: FieldBoundary): Point {
  const transform = projection(gridFor(boundary.coordinates[0][0]!));
  const metric = boundary.coordinates[0].map(
    (p) => transform.forward(p) as Point,
  );
  const point = transform.inverse(polylabel([metric], 0.1)) as Point;
  if (!boundaryContains(boundary, point[1], point[0]))
    throw new GeometryError("invalid");
  return point;
}
export function mergeBoundaries(boundaries: FieldBoundary[]) {
  const union = clipping.union(
    boundaries[0]!.coordinates,
    ...boundaries.slice(1).map((b) => b.coordinates),
  );
  if (union.length !== 1) throw new GeometryError("disconnected");
  return normalizePolygon({ type: "Polygon", coordinates: union[0] });
}
export { boundaryHectares };
