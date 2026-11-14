import { describe, expect, test } from "@jest/globals";
import {
  ECOSTRESS_POLICY,
  ECOSTRESS_POLICY_V1,
  TERRAIN_POLICY,
  TerrainInputError,
  WaterTrendError,
  faoSlopeClass,
  lsFactor,
  lsReferenceBand,
  rusleL,
  rusleS,
  summarizeEcostress,
  summarizeTerrain,
  waterStorageTrend,
} from "../../packages/domain/dist/index.js";
import { readFileSync } from "node:fs";
import {
  normalizeEcostress,
  normalizeNasadem,
} from "../../apps/server/dist/modules/earth-observations/providers/terrain/normalization.js";
import {
  ecostressResultSchema,
  terrainResultSchema,
  waterStorageResultSchema,
} from "../../packages/contracts/dist/index.js";

// A synthetic surface sampled on a 30 m grid; every value is invented.
const surface = (rows, cols, f, insideFn = () => true) => {
  const elevation = [];
  const inside = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      elevation.push(f(c * 30, -r * 30));
      inside.push(insideFn(r, c));
    }
  return { rows, cols, cellNorthM: 30, cellEastM: 30, elevation, inside };
};
const interior = (rows, cols) => (r, c) =>
  r >= 1 && c >= 1 && r < rows - 1 && c < cols - 1;

describe("RUSLE factors", () => {
  test("the unit plot (22.13 m at 9%) has LS of about 1", () => {
    expect(rusleL(9, 22.13)).toBeCloseTo(1, 6);
    expect(rusleS(9)).toBeCloseTo(1.006, 3);
    expect(lsFactor(9, 22.13)).toBeCloseTo(1.006, 3);
  });
  test("steeper and longer slopes raise LS monotonically", () => {
    expect(lsFactor(5, 100)).toBeLessThan(lsFactor(10, 100));
    expect(lsFactor(10, 50)).toBeLessThan(lsFactor(10, 200));
    expect(lsFactor(2, 22.13)).toBeLessThan(1);
  });
  test("reading bands and FAO classes follow their edges", () => {
    expect(lsReferenceBand(0.2)).toBe("below_unit_plot");
    expect(lsReferenceBand(1)).toBe("near_unit_plot");
    expect(lsReferenceBand(2)).toBe("above_unit_plot");
    expect(lsReferenceBand(9)).toBe("far_above_unit_plot");
    expect(faoSlopeClass(0)).toBe("flat");
    expect(faoSlopeClass(3)).toBe("gently_sloping");
    expect(faoSlopeClass(12)).toBe("strongly_sloping");
    expect(faoSlopeClass(80)).toBe("very_steep");
  });
});

describe("terrain from an elevation grid", () => {
  test("a plane rising to the east is a 10% slope facing west", () => {
    const grid = surface(9, 9, (x) => 200 + 0.1 * x, interior(9, 9));
    const t = summarizeTerrain(grid, []);
    expect(t.slope.meanPercent).toBeCloseTo(10, 1);
    expect(t.slope.maxPercent).toBeCloseTo(10, 1);
    expect(t.slope.dominantAspectDeg).toBe(270);
    expect(t.slope.aspectConsistency).toBeCloseTo(1, 2);
    expect(t.slope.classShares).toEqual({ sloping: 1 });
    expect(t.elevation.reliefM).toBeCloseTo(0.1 * 30 * 6, 0);
    expect(t.erosion.slopeLengthM).toBeLessThanOrEqual(300);
    expect(t.erosion.lsFactorMean).toBeGreaterThan(0.5);
  });
  test("a plane rising to the north faces south", () => {
    const grid = surface(9, 9, (_x, y) => 50 + 0.05 * y, interior(9, 9));
    const t = summarizeTerrain(grid, []);
    expect(t.slope.meanPercent).toBeCloseTo(5, 1);
    expect(t.slope.dominantAspectDeg).toBe(180);
  });
  test("flat ground has no dominant aspect and an honest noise floor", () => {
    const grid = surface(7, 7, () => 100, interior(7, 7));
    const t = summarizeTerrain(grid, []);
    expect(t.slope.meanPercent).toBe(0);
    expect(t.slope.dominantAspectDeg).toBeNull();
    // 0.612 * 3 m / 30 m = 6.1 %: gentler slopes are inside the noise.
    expect(t.slope.noiseFloorPercent).toBeCloseTo(6.1, 1);
    expect(t.slope.classShares).toEqual({ flat: 1 });
  });
  test("too few usable cells give no slope instead of a guess", () => {
    const grid = surface(
      5,
      5,
      (x) => 10 + x * 0.02,
      (r, c) => r === 2 && c < 2,
    );
    const t = summarizeTerrain(grid, []);
    expect(t.slope).toBeNull();
    expect(t.erosion).toBeNull();
    expect(t.elevation.cells).toBe(2);
  });
  test("missing elevation cells are skipped, never filled", () => {
    const grid = surface(9, 9, (x) => 200 + 0.1 * x, interior(9, 9));
    grid.elevation[4 * 9 + 4] = null;
    const t = summarizeTerrain(grid, []);
    // The centre cell and its eight neighbours have no complete 3x3 window.
    expect(t.slope.cells).toBe(49 - 9);
    expect(t.elevation.cells).toBe(48);
  });
  test("a field below its surroundings on gentle ground may hold cold air", () => {
    const grid = surface(7, 7, () => 100, interior(7, 7));
    const ring = (z) =>
      [300, 300, 600, 600].map((distanceM) => ({ distanceM, elevation: z }));
    expect(summarizeTerrain(grid, ring(108)).frostPocket).toEqual({
      status: "possible_cold_air_pool",
      belowSurroundingM: 8,
      ringPoints: 4,
    });
    expect(summarizeTerrain(grid, ring(102)).frostPocket.status).toBe(
      "not_indicated",
    );
    expect(summarizeTerrain(grid, []).frostPocket.status).toBe("unknown");
    expect(summarizeTerrain(grid, ring(null)).frostPocket.ringPoints).toBe(0);
  });
  test("steep ground is never called a cold-air pool", () => {
    const grid = surface(9, 9, (x) => 200 + 0.2 * x, interior(9, 9));
    const t = summarizeTerrain(grid, [{ distanceM: 300, elevation: 260 }]);
    expect(t.slope.meanPercent).toBeGreaterThan(
      TERRAIN_POLICY.frostPocketMaxSlopePercent,
    );
    expect(t.frostPocket.status).toBe("not_indicated");
  });
  test("invalid grids and rings are refused", () => {
    const grid = surface(5, 5, () => 10);
    expect(() => summarizeTerrain({ ...grid, rows: 2 }, [])).toThrow(
      TerrainInputError,
    );
    expect(() =>
      summarizeTerrain({ ...grid, elevation: grid.elevation.slice(1) }, []),
    ).toThrow(TerrainInputError);
    const bad = surface(5, 5, () => 10);
    bad.elevation[0] = 99999;
    expect(() => summarizeTerrain(bad, [])).toThrow(TerrainInputError);
    expect(() =>
      summarizeTerrain(grid, [{ distanceM: -1, elevation: 1 }]),
    ).toThrow(TerrainInputError);
  });
  test("the summary fits the strict result contract", () => {
    const grid = surface(9, 9, (x) => 200 + 0.1 * x, interior(9, 9));
    const t = summarizeTerrain(grid, [{ distanceM: 300, elevation: 210 }]);
    expect(() =>
      terrainResultSchema.parse({
        kind: "terrain",
        policyVersion: "terrain-policy-1",
        product: "NASADEM_NC.001 elevation (30 m) via AppEEARS",
        resolutionMeters: 30,
        grid: {
          rows: 9,
          cols: 9,
          cellNorthM: 30,
          cellEastM: 30,
          stride: 1,
          requestedPoints: 81,
          missingPoints: 0,
        },
        ...t,
        explanations: ["terrain.slope", "terrain.erosion"],
        provenance: [
          { item: "x", origin: "sourced", reference: "Horn (1981)" },
        ],
        limitations: ["Synthetic test surface."],
      }),
    ).not.toThrow();
  });
});

// A deterministic noise generator so the test never depends on randomness.
const noise = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
};
const months = (from, count, f) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = from + i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push({ month: `${y}-${String(m).padStart(2, "0")}`, lweCm: f(i, m) });
  }
  return out;
};
describe("GRACE water storage trend", () => {
  test("recovers a declining trend under a seasonal cycle", () => {
    const n = noise(7);
    const series = months(
      2003 * 12,
      240,
      (i, m) =>
        -2 * (i / 12) + 6 * Math.sin((2 * Math.PI * (m - 1)) / 12) + 2 * n(),
    );
    const t = waterStorageTrend(series);
    expect(t.trendCmPerYear).toBeGreaterThan(-2.3);
    expect(t.trendCmPerYear).toBeLessThan(-1.7);
    expect(t.direction).toBe("declining");
    expect(t.interval95CmPerYear[0]).toBeLessThan(t.trendCmPerYear);
    expect(t.interval95CmPerYear[1]).toBeGreaterThan(t.trendCmPerYear);
    expect(t.months).toBe(240);
    expect(t.missingMonths).toBe(0);
    expect(t.period).toEqual({ start: "2003-01", end: "2022-12" });
  });
  test("a trendless noisy series says there is no clear trend", () => {
    const n = noise(11);
    const t = waterStorageTrend(months(2005 * 12, 200, () => 4 * n()));
    expect(t.direction).toBe("no_clear_trend");
  });
  test("gaps are counted and not filled", () => {
    const series = months(2003 * 12, 120, (i) => -i / 12).filter(
      (_, i) => i < 50 || i > 60,
    );
    const t = waterStorageTrend(series);
    expect(t.months).toBe(109);
    expect(t.missingMonths).toBe(11);
    expect(t.trendCmPerYear).toBeCloseTo(-1, 1);
  });
  test("a short, duplicated or invalid series is refused", () => {
    expect(() => waterStorageTrend(months(2003 * 12, 24, () => 0))).toThrow(
      WaterTrendError,
    );
    const ok = months(2003 * 12, 120, (i) => i % 5);
    expect(() => waterStorageTrend([...ok, ok[3]])).toThrow(WaterTrendError);
    expect(() =>
      waterStorageTrend([...ok.slice(1), { month: "2003-13", lweCm: 1 }]),
    ).toThrow(WaterTrendError);
    expect(() =>
      waterStorageTrend([...ok.slice(1), { month: "2013-01", lweCm: NaN }]),
    ).toThrow(WaterTrendError);
  });
  test("the summary fits the strict result contract", () => {
    const t = waterStorageTrend(months(2003 * 12, 240, (i) => -i / 12));
    expect(() =>
      waterStorageResultSchema.parse({
        kind: "grace",
        policyVersion: "water-trend-policy-1",
        product: "JPL GRACE and GRACE-FO Mascon RL06.3Mv04 CRI (synthetic)",
        cell: { latitude: 32.25, longitude: -6.25, distanceKm: 12 },
        resolutionNote: "Hundreds of kilometres; not field level.",
        trend: t,
        recentMonths: [{ month: "2022-12", anomalyCm: -19 }],
        explanations: ["grace.trend"],
        provenance: [
          { item: "x", origin: "sourced", reference: "JPL RL06.3Mv04" },
        ],
        limitations: ["Synthetic test series."],
      }),
    ).not.toThrow();
  });
});

describe("ECOSTRESS summary", () => {
  const px = (pointId, date, time, lstK, esi) => ({
    pointId,
    date,
    time,
    lstK,
    esi,
  });
  test("averages clear points per acquisition and acquisitions per month", () => {
    const s = summarizeEcostress([
      px("p1", "2024-06-01", "12:00:00", 313.15, 0.5),
      px("p2", "2024-06-01", "12:00:00", 315.15, 0.7),
      px("p1", "2024-06-04", "14:30:00", 308.15, null),
      px("p1", "2024-07-02", null, null, 0.2),
    ]);
    expect(s.acquisitions).toHaveLength(3);
    expect(s.acquisitions[0]).toEqual({
      date: "2024-06-01",
      time: "12:00:00",
      clearPoints: 2,
      lstMeanC: 41,
      esiMean: 0.6,
    });
    expect(s.months).toEqual([
      {
        month: "2024-06",
        acquisitions: 2,
        lstMeanC: 38,
        lstMaxC: 41,
        esiMean: 0.6,
        esiMin: 0.6,
      },
      {
        month: "2024-07",
        acquisitions: 1,
        lstMeanC: null,
        lstMaxC: null,
        esiMean: 0.2,
        esiMin: 0.2,
      },
    ]);
  });
  test.each([ECOSTRESS_POLICY_V1.version, ECOSTRESS_POLICY.version])(
    "the summary fits the strict result contract for %s",
    (policyVersion) => {
      const s = summarizeEcostress([px("p1", "2024-06-01", null, 300, 0.4)]);
      expect(() =>
        ecostressResultSchema.parse({
          kind: "ecostress",
          policyVersion,
          products: [
            "ECO_L2T_LSTE.002 land surface temperature (70 m) via AppEEARS",
          ],
          samplePoints: 1,
          period: { start: "2024-01-01", end: "2024-12-31" },
          acquisitions: s.acquisitions.length,
          months: s.months,
          explanations: ["ecostress.esi"],
          provenance: [
            { item: "x", origin: "sourced", reference: "ECOSTRESS ESI" },
          ],
          limitations: ["Synthetic test values."],
        }),
      ).not.toThrow();
    },
  );
});

// Rows copied from the real AppEEARS files of 2026-11-09 (docs/evidence/live):
// a cloudy pixel, a best-quality clear pixel, a clear pixel flagged 0b01, an
// implausible 64 C dawn pixel flagged 0b00, and a clear pixel without a value.
describe("ECOSTRESS and NASADEM files as NASA really returns them", () => {
  const dir = "docs/evidence/live/2026-11-09/";
  const read = (n) => new Uint8Array(readFileSync(dir + n));
  test("policy 1 replays the real sample including the 63.95 C dawn pixel", () => {
    const pixels = normalizeEcostress(
      read("ECO-L2T-LSTE-002-results.sample.csv"),
      "lst",
      new Set(["p1"]),
      ECOSTRESS_POLICY_V1.version,
    );
    // The cloudy, 0b01 and empty rows drop; policy 1 does not check the
    // LST accuracy class that policy 2 uses to exclude the dawn pixel.
    expect(pixels).toHaveLength(2);
    expect(pixels.every((p) => p.lstK !== null)).toBe(true);
    expect(pixels.find((p) => p.date === "2024-09-04")).toMatchObject({
      time: "06:37:33",
      lstK: 337.1000061,
    });
  });
  test("policy 2 drops both marginal-accuracy rows in the real sample", () => {
    expect(
      normalizeEcostress(
        read("ECO-L2T-LSTE-002-results.sample.csv"),
        "lst",
        new Set(["p1"]),
      ),
    ).toEqual([]);
  });
  test("policy 2 retains the real good/excellent rows; September has no admitted LST", () => {
    const raw = read("ECO-L2T-LSTE-002-results.csv");
    const ids = new Set(["p1", "p2", "p3", "p4"]);
    const before = normalizeEcostress(
      raw,
      "lst",
      ids,
      ECOSTRESS_POLICY_V1.version,
    );
    const after = normalizeEcostress(raw, "lst", ids);
    expect(before).toHaveLength(228);
    expect(after).toHaveLength(96);
    expect(summarizeEcostress(before).acquisitions).toHaveLength(57);
    expect(summarizeEcostress(after).acquisitions).toHaveLength(24);
    expect(
      summarizeEcostress(before).months.find((m) => m.month === "2024-09"),
    ).toMatchObject({ acquisitions: 3, lstMeanC: 34.32, lstMaxC: 63.95 });
    expect(
      summarizeEcostress(after).months.find((m) => m.month === "2024-09"),
    ).toBeUndefined();
    // ESI has independent masks/values and remains identical across policies.
    const esiRaw = read("ECO-L4T-ESI-002-results.csv");
    const esi = normalizeEcostress(esiRaw, "esi", ids);
    expect(esi).toEqual(
      normalizeEcostress(esiRaw, "esi", ids, ECOSTRESS_POLICY_V1.version),
    );
    const september = summarizeEcostress([...after, ...esi]).months.find(
      (m) => m.month === "2024-09",
    );
    expect(september?.lstMeanC ?? null).toBeNull();
    expect(september?.lstMaxC ?? null).toBeNull();
  });
  // These small rows are synthetic mutations: isolate raw QC decoding and
  // validation without presenting made-up quality values as NASA evidence.
  const qcCsv = (qc) =>
    new TextEncoder().encode(
      "ID,Date,ECO_L2T_LSTE_002_LST,ECO_L2T_LSTE_002_cloud,ECO_L2T_LSTE_002_water,ECO_L2T_LSTE_002_QC\n" +
        `p1,2024-09-04 06:37:33 UTC,337.1000061,0,0,${qc}\n`,
    );
  test.each([0, 1, 2, 3])(
    "raw QC LST accuracy class %i follows the sourced categories",
    (accuracy) => {
      expect(
        normalizeEcostress(qcCsv(accuracy << 14), "lst", new Set(["p1"])),
      ).toHaveLength(accuracy >= 2 ? 1 : 0);
    },
  );
  test.each([1, 2, 3])(
    "raw mandatory QA %i is excluded even without a decoded column",
    (mandatory) => {
      expect(
        normalizeEcostress(
          qcCsv((2 << 14) | mandatory),
          "lst",
          new Set(["p1"]),
        ),
      ).toEqual([]);
    },
  );
  test.each(["", "NaN"])("missing QC %s is excluded", (qc) => {
    expect(normalizeEcostress(qcCsv(qc), "lst", new Set(["p1"]))).toEqual([]);
  });
  test.each([-1, 65536, 32768.5, "1e999", "bad"])(
    "malformed QC %s fails without bitwise coercion",
    (qc) => {
      expect(() =>
        normalizeEcostress(qcCsv(qc), "lst", new Set(["p1"])),
      ).toThrow("OBSERVATION_UPSTREAM_INVALID");
    },
  );
  test("a file without raw QC is valid only for legacy replay", () => {
    const raw = new TextEncoder().encode(
      "ID,Date,ECO_L2T_LSTE_002_LST,ECO_L2T_LSTE_002_cloud,ECO_L2T_LSTE_002_water\np1,2024-09-04,337.1000061,0,0\n",
    );
    expect(() => normalizeEcostress(raw, "lst", new Set(["p1"]))).toThrow(
      "OBSERVATION_UPSTREAM_INVALID",
    );
    expect(
      normalizeEcostress(
        raw,
        "lst",
        new Set(["p1"]),
        ECOSTRESS_POLICY_V1.version,
      ),
    ).toHaveLength(1);
    expect(() =>
      normalizeEcostress(raw, "lst", new Set(["p1"]), "unknown-policy"),
    ).toThrow("OBSERVATION_UPSTREAM_INVALID");
  });
  test("the ESI and NASADEM files parse with their recorded column names", () => {
    const esi = normalizeEcostress(
      read("ECO-L4T-ESI-002-results.csv"),
      "esi",
      new Set(["p1", "p2", "p3", "p4"]),
    );
    expect(esi.length).toBeGreaterThan(0);
    const ids = new Set(
      readFileSync(dir + "NASADEM-NC-001-results.csv", "utf8")
        .split("\n")
        .slice(1)
        .filter(Boolean)
        .map((l) => l.split(",")[1]),
    );
    expect(normalizeNasadem(read("NASADEM-NC-001-results.csv"), ids).size).toBe(
      ids.size,
    );
  });
});
