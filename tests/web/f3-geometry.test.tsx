/** @jest-environment ./tooling/web/geometry-test-environment.mjs */
import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  fieldBoundarySchema,
  boundaryContains,
  boundaryHectares,
} from "@rotavise/contracts";
import {
  cellAt,
  cellPoint,
  gridFor,
  projection,
  interpolate,
  paintBoundary,
  normalizePolygon,
  interiorPoint,
  mergeBoundaries,
} from "../../apps/web/src/features/fields/creation/geometry.js";
import {
  polygonsFromGeoJSON,
  inspectShapeZip,
  parseOutline,
} from "../../apps/web/src/features/fields/creation/importOutline.js";
// @ts-expect-error Fixtures are deliberately outside the production TS tree.
import {
  grid,
  rectangleCells,
  outline,
  concave,
  bowtie,
} from "../support/fixtures/field-creation/geometry.mjs";

for (const name of ["morocco-stac.json", "granule-stac.json"]) {
  test(`30 m lattice agrees with real HLS granule geotransform: ${name}`, () => {
    const record = JSON.parse(
      readFileSync(
        new URL(`../support/fixtures/hls/${name}`, import.meta.url),
        "utf8",
      ),
    );
    const transform = record.properties["proj:transform"] as number[];
    expect(transform.slice(0, 2)).toEqual([30, 0]);
    expect(transform.slice(3, 5)).toEqual([0, -30]);
    const x = transform[2]!,
      y = transform[5]!,
      zone = record.properties["proj:epsg"] - 32600;
    const g = { zone, south: false };
    const project = projection(g);
    for (const [column, row] of [
      [0, 0],
      [50, 70],
      [3000, 2000],
    ]) {
      const metre: [number, number] = [
        x + column! * 30 + 15,
        y - row! * 30 - 15,
      ];
      const point = project.inverse(metre) as [number, number];
      if (column! < 100) expect(gridFor(point)).toEqual(g);
      const cell = cellAt(point, g),
        centre = project.forward(cellPoint(cell, g, true));
      expect(centre[0]).toBeCloseTo(metre[0], 4);
      expect(centre[1]).toBeCloseTo(metre[1], 4);
      const corner = project.forward(cellPoint(cell, g));
      expect(corner[0]).toBeCloseTo(metre[0] - 15, 4);
      expect(corner[1]).toBeCloseTo(metre[1] - 15, 4);
    }
  });
}
test("fast diagonal strokes stay connected with no skipped cells, in either direction", () => {
  for (const end of [
    [19, 7],
    [-8, 23],
    [-15, -18],
    [0, 10],
  ] as [number, number][]) {
    const stroke = interpolate([0, 0], end);
    expect(stroke.at(-1)).toEqual(end);
    for (let i = 1; i < stroke.length; i++)
      expect(
        Math.abs(stroke[i]![0] - stroke[i - 1]![0]) +
          Math.abs(stroke[i]![1] - stroke[i - 1]![1]),
      ).toBe(1);
  }
});
test("2,000 painted cells produce one valid collinear-collapsed ring with a real interior location", () => {
  const result = paintBoundary(rectangleCells(50, 40), grid)!;
  expect(fieldBoundarySchema.safeParse(result.boundary).success).toBe(true);
  expect(result.boundary.coordinates[0]).toHaveLength(5);
  expect(boundaryHectares(result.boundary)).toBeCloseTo(180, 0);
  const p = interiorPoint(result.boundary);
  expect(boundaryContains(result.boundary, p[1], p[0])).toBe(true);
});
test("paint fills a small internal hole, rejects a large hole and a separate component", () => {
  const all = rectangleCells(12, 12) as string[];
  const small = paintBoundary(
    all.filter((k) => k !== all[40]),
    grid,
  )!;
  expect(small.filled).toBe(true);
  expect(small.cells).toHaveLength(144);
  const hole = new Set(rectangleCells(4, 4, 23338, 120004));
  expect(() =>
    paintBoundary(
      all.filter((k) => !hole.has(k)),
      grid,
    ),
  ).toThrow("hole");
  expect(() =>
    paintBoundary([...rectangleCells(2, 2), "24000,120000"], grid),
  ).toThrow("disconnected");
});
test("dense curved outlines simplify to 200 vertices with at most 2 percent area change", () => {
  const transform = projection(grid);
  const ring: [number, number][] = [];
  for (let i = 0; i < 1200; i++) {
    const a = (i / 1200) * 2 * Math.PI;
    ring.push(
      transform.inverse([
        700000 + 400 * Math.cos(a),
        3600000 + 200 * Math.sin(a),
      ]) as [number, number],
    );
  }
  ring.push(ring[0]!);
  const original = boundaryHectares({ type: "Polygon", coordinates: [ring] });
  const result = normalizePolygon({ type: "Polygon", coordinates: [ring] });
  expect(result.boundary.coordinates[0].length).toBeLessThanOrEqual(201);
  expect(
    Math.abs(boundaryHectares(result.boundary) - original) / original,
  ).toBeLessThanOrEqual(0.02);
});
test("concave pole is strictly inside and invalid or incompatible rings fail closed", () => {
  const b = fieldBoundarySchema.parse(concave);
  const p = interiorPoint(b);
  expect(boundaryContains(b, p[1], p[0])).toBe(true);
  expect(() => normalizePolygon(bowtie)).toThrow();
  expect(() =>
    normalizePolygon({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    }),
  ).toThrow("large");
  expect(() =>
    mergeBoundaries([
      fieldBoundarySchema.parse(outline),
      fieldBoundarySchema.parse(concave),
    ]),
  ).not.toThrow();
});
test("untrusted uploads return per-polygon errors and refuse unknown CRS, points and malformed archives", () => {
  const result = polygonsFromGeoJSON({
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: outline },
      { type: "Feature", geometry: bowtie },
      { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] } },
    ],
  });
  expect(result.filter((p) => p.boundary)).toHaveLength(1);
  expect(result.filter((p) => p.issue)).toHaveLength(2);
  expect(() =>
    polygonsFromGeoJSON({ ...outline, crs: { name: "unverified" } }),
  ).toThrow("invalid");
  expect(() => inspectShapeZip(new ArrayBuffer(22))).toThrow("invalid");
});
test("zipped projected shapefile is reprojected to WGS84 in browser parser", async () => {
  const data = readFileSync(
    new URL("../support/fixtures/field-creation/utm29.zip", import.meta.url),
  );
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  );
  const results = await parseOutline(buffer, "zip");
  expect(results).toHaveLength(1);
  const b = results[0]!.boundary!;
  expect(fieldBoundarySchema.safeParse(b).success).toBe(true);
  expect(b.coordinates[0][0]![0]).toBeGreaterThan(-7);
  expect(b.coordinates[0][0]![0]).toBeLessThan(-6);
});

test("legacy named GeoJSON UTM coordinates are explicitly reprojected", () => {
  const data = polygonsFromGeoJSON({
    type: "Polygon",
    crs: { type: "name", properties: { name: "EPSG:32629" } },
    coordinates: [
      [
        [700000, 3600000],
        [700200, 3600000],
        [700200, 3600200],
        [700000, 3600200],
        [700000, 3600000],
      ],
    ],
  });
  expect(data[0]!.boundary).toBeDefined();
  expect(fieldBoundarySchema.safeParse(data[0]!.boundary).success).toBe(true);
});

test("uploaded WGS84 geometry uses the shared contract latitude range", () => {
  const boundary = {
    type: "Polygon",
    coordinates: [
      [
        [12, 85.4],
        [12.002, 85.4],
        [12.002, 85.402],
        [12, 85.402],
        [12, 85.4],
      ],
    ],
  };
  expect(fieldBoundarySchema.safeParse(boundary).success).toBe(true);
  expect(normalizePolygon(boundary).boundary).toEqual(boundary);
});
