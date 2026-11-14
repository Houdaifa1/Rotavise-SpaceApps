// Terrain indicators from a gridded elevation model (NASADEM, 1 arc-second).
// Pure and deterministic: no clock, randomness or I/O. Every formula is cited
// or labelled in TERRAIN_PROVENANCE; none of the outputs is a soil-loss
// measurement or a frost forecast.
export const TERRAIN_POLICY = Object.freeze({
  version: "terrain-policy-1",
  // Vertical noise assumed for NASADEM when stating how small a slope can be
  // told apart from noise. Model recall, low confidence.
  verticalNoiseMeters: 3,
  // Longest slope length RUSLE is applied to; flow paths are not modelled.
  maxSlopeLengthM: 300,
  // Cold-air pooling hint: the field lies this far below its surroundings on
  // gentle ground. Engineering judgment, not a measured threshold.
  frostPocketDropM: 5,
  frostPocketMaxSlopePercent: 5,
  minimumSlopeCells: 4,
});
export type TerrainProvenance = {
  item: string;
  origin: "sourced" | "model_recall" | "engineering_judgment";
  reference: string;
};
export const TERRAIN_PROVENANCE: readonly TerrainProvenance[] = Object.freeze([
  {
    item: "Slope and aspect from a 3x3 window",
    origin: "model_recall",
    reference:
      "Horn, B.K.P. (1981) Hill shading and the reflectance map, Proc. IEEE 69(1):14-47; weights recalled, not re-read, and checked by tests on exact planes",
  },
  {
    item: "RUSLE slope steepness factor S and slope length factor L",
    origin: "model_recall",
    reference:
      "Renard et al. (1997) USDA Agriculture Handbook 703, after McCool et al. (1987, 1989); formulas recalled, not re-read, and checked against the unit plot (LS = 1 at 22.13 m and 9%)",
  },
  {
    item: "Slope classes",
    origin: "model_recall",
    reference:
      "FAO Guidelines for Soil Description (2006) slope classes, recalled; to be checked against the FAO text",
  },
  {
    item: "LS reference bands (relative to the standard RUSLE unit plot, LS = 1)",
    origin: "engineering_judgment",
    reference: "Rotavise reading aid; not a published erosion class",
  },
  {
    item: "Maximum slope length 300 m and vertical noise 3 m",
    origin: "model_recall",
    reference: "Recalled RUSLE practice and NASADEM accuracy; low confidence",
  },
  {
    item: "Cold-air pooling hint (5 m below surroundings, slope under 5%)",
    origin: "engineering_judgment",
    reference:
      "Topographic position index idea (Weiss 2001); thresholds are Rotavise heuristics",
  },
]);
export class TerrainInputError extends Error {
  constructor(readonly code: "INVALID_GRID" | "INVALID_RING") {
    super(code);
  }
}
// Row 0 is the northern row and column 0 the western column. `elevation` is in
// metres (null = no data); `inside` marks the cells that lie in the field.
export type ElevationGrid = {
  rows: number;
  cols: number;
  cellNorthM: number;
  cellEastM: number;
  elevation: (number | null)[];
  inside: boolean[];
};
export type RingPoint = { distanceM: number; elevation: number | null };
export const FAO_SLOPE_CLASSES = Object.freeze([
  { id: "flat", maxPercent: 0.2 },
  { id: "level", maxPercent: 0.5 },
  { id: "nearly_level", maxPercent: 1 },
  { id: "very_gently_sloping", maxPercent: 2 },
  { id: "gently_sloping", maxPercent: 5 },
  { id: "sloping", maxPercent: 10 },
  { id: "strongly_sloping", maxPercent: 15 },
  { id: "moderately_steep", maxPercent: 30 },
  { id: "steep", maxPercent: 60 },
  { id: "very_steep", maxPercent: Infinity },
] as const);
export function faoSlopeClass(percent: number) {
  return FAO_SLOPE_CLASSES.find((c) => percent <= c.maxPercent)!.id;
}
const rad = (d: number) => (d * Math.PI) / 180;
const round = (v: number, n: number) => Number(v.toFixed(n));
function checkGrid(grid: ElevationGrid) {
  const n = grid.rows * grid.cols;
  if (
    !Number.isInteger(grid.rows) ||
    !Number.isInteger(grid.cols) ||
    grid.rows < 3 ||
    grid.cols < 3 ||
    n > 10000 ||
    !(grid.cellNorthM > 1) ||
    !(grid.cellEastM > 1) ||
    grid.elevation.length !== n ||
    grid.inside.length !== n ||
    grid.elevation.some(
      (v) => v !== null && (!Number.isFinite(v) || v < -500 || v > 9000),
    )
  )
    throw new TerrainInputError("INVALID_GRID");
}
// Horn (1981): weights 1-2-1 on the three rows and columns around a cell.
// The gradient is metres of rise per metre of run, east and north positive.
export function gradientAt(grid: ElevationGrid, row: number, col: number) {
  const z = (r: number, c: number) => grid.elevation[r * grid.cols + c]!;
  const cells = [-1, 0, 1].flatMap((dr) =>
    [-1, 0, 1].map((dc) => grid.elevation[(row + dr) * grid.cols + col + dc]),
  );
  if (
    row < 1 ||
    col < 1 ||
    row >= grid.rows - 1 ||
    col >= grid.cols - 1 ||
    cells.some((v) => v === null)
  )
    return null;
  const east =
    (z(row - 1, col + 1) +
      2 * z(row, col + 1) +
      z(row + 1, col + 1) -
      (z(row - 1, col - 1) + 2 * z(row, col - 1) + z(row + 1, col - 1))) /
    (8 * grid.cellEastM);
  const north =
    (z(row - 1, col - 1) +
      2 * z(row - 1, col) +
      z(row - 1, col + 1) -
      (z(row + 1, col - 1) + 2 * z(row + 1, col) + z(row + 1, col + 1))) /
    (8 * grid.cellNorthM);
  return { east, north };
}
// RUSLE S factor (McCool et al. 1987): slope in percent.
export function rusleS(slopePercent: number) {
  const sin = Math.sin(Math.atan(slopePercent / 100));
  return slopePercent < 9 ? 10.8 * sin + 0.03 : 16.8 * sin - 0.5;
}
// RUSLE L factor (Renard et al. 1997): lambda in metres, unit plot 22.13 m.
export function rusleL(slopePercent: number, lambdaM: number) {
  const sin = Math.sin(Math.atan(slopePercent / 100));
  const beta = sin / 0.0896 / (3 * Math.pow(sin, 0.8) + 0.56);
  return Math.pow(lambdaM / 22.13, beta / (1 + beta));
}
export function lsFactor(slopePercent: number, lambdaM: number) {
  return rusleL(slopePercent, lambdaM) * rusleS(slopePercent);
}
// A reading aid only: LS compared with the standard RUSLE unit plot (22.13 m
// at 9% slope, LS = 1).
export function lsReferenceBand(ls: number) {
  if (ls < 0.5) return "below_unit_plot" as const;
  if (ls < 1.5) return "near_unit_plot" as const;
  if (ls < 4) return "above_unit_plot" as const;
  return "far_above_unit_plot" as const;
}
const quantile = (sorted: number[], q: number) =>
  sorted[
    Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1) + 0.5))
  ]!;
export function summarizeTerrain(
  grid: ElevationGrid,
  ring: RingPoint[],
  policy = TERRAIN_POLICY,
) {
  checkGrid(grid);
  if (
    ring.length > 64 ||
    ring.some(
      (p) =>
        !Number.isFinite(p.distanceM) ||
        p.distanceM <= 0 ||
        (p.elevation !== null && !Number.isFinite(p.elevation)),
    )
  )
    throw new TerrainInputError("INVALID_RING");
  const inside: number[] = [];
  const elevations: number[] = [];
  const slopes: {
    percent: number;
    east: number;
    north: number;
    x: number;
    y: number;
  }[] = [];
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      const i = r * grid.cols + c;
      if (!grid.inside[i]) continue;
      inside.push(i);
      const z = grid.elevation[i];
      if (z !== null) elevations.push(z!);
      const g = gradientAt(grid, r, c);
      if (g)
        slopes.push({
          percent: 100 * Math.hypot(g.east, g.north),
          east: g.east,
          north: g.north,
          x: c * grid.cellEastM,
          y: -r * grid.cellNorthM,
        });
    }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const elevation = elevations.length
    ? {
        meanM: round(mean(elevations), 1),
        minM: round(Math.min(...elevations), 1),
        maxM: round(Math.max(...elevations), 1),
        reliefM: round(Math.max(...elevations) - Math.min(...elevations), 1),
        cells: elevations.length,
      }
    : null;
  const cellM = (grid.cellNorthM + grid.cellEastM) / 2;
  const noiseFloorPercent = round(
    (100 * 0.612 * policy.verticalNoiseMeters) / cellM,
    1,
  );
  let slope = null as null | {
    cells: number;
    meanPercent: number;
    p90Percent: number;
    maxPercent: number;
    noiseFloorPercent: number;
    dominantAspectDeg: number | null;
    aspectConsistency: number;
    classShares: Record<string, number>;
  };
  let erosion = null as null | {
    slopeLengthM: number;
    lsFactorMean: number;
    referenceBand: ReturnType<typeof lsReferenceBand>;
  };
  if (slopes.length >= policy.minimumSlopeCells) {
    const percents = slopes.map((s) => s.percent).sort((a, b) => a - b);
    // Downslope direction (compass, clockwise from north) as a weighted
    // circular mean; consistency 1 = all cells face the same way.
    let sx = 0,
      sy = 0,
      weight = 0;
    for (const s of slopes) {
      const w = s.percent;
      const az = Math.atan2(-s.east, -s.north);
      sx += w * Math.sin(az);
      sy += w * Math.cos(az);
      weight += w;
    }
    const consistency = weight > 0 ? Math.hypot(sx, sy) / weight : 0;
    const dominant =
      weight > 0 && consistency > 0.05
        ? round(((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360, 0)
        : null;
    const shares: Record<string, number> = {};
    for (const s of slopes) {
      const id = faoSlopeClass(s.percent);
      shares[id] = (shares[id] ?? 0) + 1;
    }
    for (const id of Object.keys(shares))
      shares[id] = round(shares[id]! / slopes.length, 3);
    slope = {
      cells: slopes.length,
      meanPercent: round(mean(percents), 2),
      p90Percent: round(quantile(percents, 0.9), 2),
      maxPercent: round(percents[percents.length - 1]!, 2),
      noiseFloorPercent,
      dominantAspectDeg: dominant,
      aspectConsistency: round(consistency, 2),
      classShares: shares,
    };
    // Slope length: the field's extent along the downslope direction (no flow
    // path analysis), capped at the RUSLE application limit.
    const dir =
      dominant === null
        ? null
        : { x: Math.sin(rad(dominant)), y: Math.cos(rad(dominant)) };
    const along = inside.map((i) => {
      const r = Math.floor(i / grid.cols),
        c = i % grid.cols;
      const x = c * grid.cellEastM,
        y = -r * grid.cellNorthM;
      return dir ? x * dir.x + y * dir.y : Math.max(x, -y);
    });
    const extent = dir
      ? Math.max(...along) - Math.min(...along) + cellM
      : Math.max(
          Math.max(...inside.map((i) => i % grid.cols)) -
            Math.min(...inside.map((i) => i % grid.cols)),
          Math.max(...inside.map((i) => Math.floor(i / grid.cols))) -
            Math.min(...inside.map((i) => Math.floor(i / grid.cols))),
        ) *
          cellM +
        cellM;
    const lambda = Math.min(policy.maxSlopeLengthM, Math.max(4, extent));
    const ls = mean(
      slopes.map((s) => lsFactor(Math.max(s.percent, 0.1), lambda)),
    );
    erosion = {
      slopeLengthM: round(lambda, 0),
      lsFactorMean: round(ls, 2),
      referenceBand: lsReferenceBand(ls),
    };
  }
  const known = ring.filter((p) => p.elevation !== null);
  const surrounding = known.length
    ? mean(known.map((p) => p.elevation!))
    : null;
  const drop =
    elevation && surrounding !== null
      ? round(surrounding - elevation.meanM, 1)
      : null;
  const frostPocket = {
    status:
      drop === null
        ? ("unknown" as const)
        : drop >= policy.frostPocketDropM &&
            (slope?.meanPercent ?? 0) < policy.frostPocketMaxSlopePercent
          ? ("possible_cold_air_pool" as const)
          : ("not_indicated" as const),
    belowSurroundingM: drop,
    ringPoints: known.length,
  };
  return { elevation, slope, erosion, frostPocket };
}
