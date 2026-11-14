import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  fieldBoundarySchema,
  boundaryHectares,
  fieldBoundaryPointSchema,
  fieldBoundaryTileSchema,
} from "../../packages/contracts/dist/index.js";
import { cleanBoundary } from "../../apps/server/dist/modules/field-boundaries/application/clean-boundary.js";

const fixtures = readFileSync(
  "tests/support/fixtures/field-boundaries/morocco-2025.ndjson",
  "utf8",
)
  .trim()
  .split("\n")
  .map(JSON.parse);
test("real Moroccan source geometries are admitted only within the shared contract and cleaning budget", () => {
  let kept = 0,
    dropped = 0;
  for (const feature of fixtures) {
    const result = cleanBoundary(feature.geometry);
    if (!result) {
      dropped++;
      continue;
    }
    kept++;
    expect(fieldBoundarySchema.safeParse(result.geometry).success).toBe(true);
    expect(result.geometry.coordinates[0].length).toBeLessThanOrEqual(201);
    expect(result.areaHectares).toBe(boundaryHectares(result.geometry));
    expect(result.areaChangePercent).toBeLessThanOrEqual(2);
    expect(result.geometry.coordinates).toHaveLength(1);
  }
  expect(kept).toBe(12);
  expect(dropped).toBeGreaterThan(0); // Actual oversized/tiny source fragments.
});
const square = {
  type: "Polygon",
  coordinates: [
    [
      [-6.55, 32.4],
      [-6.549, 32.4],
      [-6.549, 32.401],
      [-6.55, 32.401],
      [-6.55, 32.4],
    ],
  ],
};
test("holes are reported and excessive area change drops a suggestion", () => {
  const withHole = structuredClone(square);
  withHole.coordinates.push([
    [-6.5499, 32.4001],
    [-6.5498, 32.4001],
    [-6.5498, 32.4002],
    [-6.5499, 32.4002],
    [-6.5499, 32.4001],
  ]);
  const cleaned = cleanBoundary(withHole);
  expect(cleaned.holesDropped).toBe(1);
  expect(cleaned.areaChangePercent).toBeGreaterThan(1);
  expect(cleaned.areaChangePercent).toBeLessThan(2);
  withHole.coordinates[1] = [
    [-6.5499, 32.4001],
    [-6.5495, 32.4001],
    [-6.5495, 32.4005],
    [-6.5499, 32.4005],
    [-6.5499, 32.4001],
  ];
  expect(cleanBoundary(withHole)).toBeNull();
});
test("untrusted invalid, crossing, open, distant and degenerate shapes are dropped", () => {
  for (const input of [
    null,
    { type: "MultiPolygon", coordinates: [] },
    {
      type: "Polygon",
      coordinates: [
        [
          [-6.55, 32.4],
          [-6.549, 32.401],
          [-6.55, 32.401],
          [-6.549, 32.4],
          [-6.55, 32.4],
        ],
      ],
    },
    { ...square, coordinates: [square.coordinates[0].slice(0, 4)] },
    {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
    {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ],
    },
    {
      type: "Polygon",
      coordinates: [
        [
          [NaN, 0],
          [0, 0],
          [0, 0],
          [NaN, 0],
        ],
      ],
    },
  ])
    expect(cleanBoundary(input)).toBeNull();
});
test("a dense smooth ring is reduced while preserving its area", () => {
  const ring = Array.from({ length: 720 }, (_, i) => [
    -6.55 + 0.001 * Math.cos((i * Math.PI) / 360),
    32.4 + 0.001 * Math.sin((i * Math.PI) / 360),
  ]);
  ring.push(ring[0]);
  const cleaned = cleanBoundary({ type: "Polygon", coordinates: [ring] });
  expect(cleaned).not.toBeNull();
  expect(cleaned.geometry.coordinates[0].length).toBeLessThanOrEqual(201);
  expect(Math.abs(boundaryHectares(cleaned.geometry) - 3.28)).toBeLessThan(
    0.07,
  );
});
test("point and tile contracts reject coercion, surplus input and invalid Web Mercator addresses", () => {
  expect(
    fieldBoundaryPointSchema.safeParse({ latitude: 32.4, longitude: -6.55 })
      .success,
  ).toBe(true);
  for (const value of [
    { latitude: "32.4", longitude: -6.55 },
    { latitude: 91, longitude: 0 },
    { latitude: 32.4, longitude: 0, owner: "someone" },
  ])
    expect(fieldBoundaryPointSchema.safeParse(value).success).toBe(false);
  for (const value of [
    { z: "13", x: "1", y: "1" },
    { z: "14", x: "16384", y: "1" },
    { z: "14", x: "-1", y: "1" },
    { z: "14", x: "01", y: "1" },
  ])
    expect(fieldBoundaryTileSchema.safeParse(value).success).toBe(false);
});
