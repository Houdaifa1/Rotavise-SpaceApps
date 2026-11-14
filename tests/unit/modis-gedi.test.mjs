import { describe, expect, test } from "@jest/globals";
import {
  analyzeVegetationHistory,
  distanceKm,
  summarizeCanopyBiomass,
  vegetationHistoryPolicy,
} from "../../packages/domain/dist/index.js";
import {
  canopyBiomassResultSchema,
  extractionResultSchema,
  vegetationHistorySchema,
} from "../../packages/contracts/dist/index.js";
import { normalizeModis } from "../../apps/server/dist/modules/earth-observations/providers/modis/normalization.js";
import { modisPoints } from "../../apps/server/dist/modules/earth-observations/providers/modis/modis-request.js";

// Every series below is synthetic: invented NDVI shaped like a winter crop
// field, never NASA data. The real column names and file names are unproven
// until the first AppEEARS run.
const day = (year, doy) =>
  new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);
const COMPOSITE_DOYS = Array.from({ length: 23 }, (_, k) => 1 + 16 * k);
const bump = (doy, peak) =>
  0.12 + (peak - 0.12) * Math.exp(-(((doy - 90) / 60) ** 2));
function modisSeries(years, { peak = () => 0.7, drop = () => [], offset = 0 }) {
  const observations = [];
  for (const year of years)
    for (const doy of COMPOSITE_DOYS) {
      if (drop(year).includes(doy)) continue;
      const ndvi = Number(bump(doy, peak(year)).toFixed(4));
      observations.push({
        date: day(year, doy),
        ndvi,
        neighbourMean:
          offset === null ? null : Number((ndvi + offset).toFixed(4)),
        neighbours: offset === null ? 0 : 4,
      });
    }
  return {
    kind: "modis",
    policyVersion: "modis-policy-1",
    product: "MOD13Q1.061 vegetation indices (250 m, 16 day) via AppEEARS",
    resolutionMeters: 250,
    period: {
      start: `${years[0]}-01-01`,
      end: `${years.at(-1)}-12-31`,
    },
    samplePoints: 5,
    datesSeen: observations.length + 10,
    datesUsable: observations.length,
    observations,
    explanations: ["modis.ndvi_history"],
    provenance: [
      { item: "synthetic", origin: "engineering_judgment", reference: "test" },
    ],
    limitations: ["Synthetic test series."],
  };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const covers = (windows, md) =>
  windows.some((w) =>
    w.start <= w.end
      ? md >= w.start && md <= w.end
      : md >= w.start || md <= w.end,
  );
const ASOF = "2026-11-08";

describe("MODIS points", () => {
  test("five points: the centre and one pixel (250 m) north, east, south and west", () => {
    const points = modisPoints({
      type: "Polygon",
      coordinates: [
        [
          [-6.5503, 32.3998],
          [-6.5496, 32.3998],
          [-6.5496, 32.4004],
          [-6.5503, 32.4004],
          [-6.5503, 32.3998],
        ],
      ],
    });
    expect(points.map((p) => p.id)).toEqual([
      "centre",
      "north",
      "east",
      "south",
      "west",
    ]);
    for (const p of points.slice(1))
      expect(
        distanceKm(
          points[0].latitude,
          points[0].longitude,
          p.latitude,
          p.longitude,
        ) * 1000,
      ).toBeCloseTo(250, 0);
  });
});

describe("normalizeModis", () => {
  const PREFIX = "MOD13Q1_061_";
  const header = [
    "Category",
    "ID",
    "Latitude",
    "Longitude",
    "Date",
    PREFIX + "_250m_16_days_NDVI",
    PREFIX + "_250m_16_days_pixel_reliability",
    PREFIX + "_250m_16_days_composite_day_of_the_year",
  ];
  const csv = (rows, head = header) =>
    new TextEncoder().encode(
      [head.join(","), ...rows.map((r) => ["field", ...r].join(","))].join(
        "\n",
      ) + "\n",
    );
  const ids = new Set(["centre", "north", "east", "south", "west"]);
  test("keeps good pixels, dates them by the composite day and averages good neighbours", () => {
    const raw = csv([
      ["centre", 0, 0, "2010-01-01", 0.2, 0, 5],
      ["north", 0, 0, "2010-01-01", 0.3, 0, 6],
      ["east", 0, 0, "2010-01-01", 0.5, 0, 5],
      ["south", 0, 0, "2010-01-01", 0.9, 1, 5], // marginal: dropped
      ["centre", 0, 0, "2010-01-17", 0.4, 1, 20], // marginal centre: dropped
      ["centre", 0, 0, "2010-02-02", -0.3, 0, 40], // fill value: dropped
      ["centre", 0, 0, "2010-02-18", 0.5, 0, 200], // day outside the composite: dropped
      ["centre", 0, 0, "2010-03-06", 0.6, 0, 70],
    ]);
    const out = normalizeModis(raw, "centre", ids);
    expect(out.datesSeen).toBe(5);
    expect(out.readings).toEqual([
      { date: "2010-01-05", ndvi: 0.2, neighbourMean: 0.4, neighbours: 2 },
      { date: "2010-03-11", ndvi: 0.6, neighbourMean: null, neighbours: 0 },
    ]);
  });
  test("refuses an unknown point, a missing column and a garbled number", () => {
    expect(() =>
      normalizeModis(
        csv([["elsewhere", 0, 0, "2010-01-01", 0.2, 0, 5]]),
        "centre",
        ids,
      ),
    ).toThrow(
      expect.objectContaining({ code: "OBSERVATION_UPSTREAM_INVALID" }),
    );
    expect(() =>
      normalizeModis(csv([], header.slice(0, 6)), "centre", ids),
    ).toThrow(
      expect.objectContaining({ code: "OBSERVATION_UPSTREAM_INVALID" }),
    );
    expect(() =>
      normalizeModis(
        csv([["centre", 0, 0, "2010-01-01", "oops", 0, 5]]),
        "centre",
        ids,
      ),
    ).toThrow(
      expect.objectContaining({ code: "OBSERVATION_UPSTREAM_INVALID" }),
    );
  });
});

describe("analyzeVegetationHistory", () => {
  const years = range(2003, 2022);
  test("finds the usually-low and usually-green windows of a winter-crop field, across New Year", () => {
    const h = analyzeVegetationHistory(
      modisSeries(years, { offset: 0.01 }),
      null,
      ASOF,
    );
    vegetationHistorySchema.parse(h);
    expect(h.years.used).toBe(20);
    expect(h.usuallyLow.status).toBe("available");
    expect(covers(h.usuallyLow.windows, "07-15")).toBe(true);
    expect(covers(h.usuallyLow.windows, "12-31")).toBe(true);
    expect(covers(h.usuallyLow.windows, "03-31")).toBe(false);
    // The low window runs past 31 December, so its end is earlier than its start.
    expect(h.usuallyLow.windows.some((w) => w.start > w.end)).toBe(true);
    expect(covers(h.usuallyGreen.windows, "03-31")).toBe(true);
    expect(covers(h.usuallyGreen.windows, "08-15")).toBe(false);
    expect(h.bins).toHaveLength(23);
    expect(h.heterogeneity.status).toBe("similar");
    expect(h.hlsAgreement).toBeNull();
    expect(h.source.resolutionMeters).toBe(250);
    expect(h.explanations.map((e) => e.key)).toContain("modis.usually_low");
  });
  test("leaves out years with too few dates, no clear season or no data instead of filling them in", () => {
    const base = modisSeries(range(2003, 2014), {
      drop: (y) => (y === 2010 ? COMPOSITE_DOYS.slice(0, 13) : []),
      peak: (y) => (y === 2011 ? 0.2 : 0.7),
    });
    base.observations = base.observations.filter(
      (o) => !o.date.startsWith("2012"),
    );
    const h = analyzeVegetationHistory(base, null, ASOF);
    vegetationHistorySchema.parse(h);
    expect(h.years.excluded).toEqual([
      { year: 2010, reason: "too_few_dates" },
      { year: 2011, reason: "no_distinct_season" },
      { year: 2012, reason: "no_data" },
    ]);
    expect(h.years.used).toBe(9);
    expect(h.annualPeaks.map((p) => p.year)).not.toContain(2011);
  });
  test("with fewer than five usable years it makes no usually claim", () => {
    const h = analyzeVegetationHistory(
      modisSeries(range(2019, 2022), {}),
      null,
      ASOF,
    );
    vegetationHistorySchema.parse(h);
    expect(h.usuallyLow).toEqual({
      status: "insufficient_history",
      windows: [],
    });
    expect(h.usuallyGreen.status).toBe("insufficient_history");
    expect(h.bins.every((b) => b.lowShare === null)).toBe(true);
    expect(h.peakTrend.status).toBe("insufficient_history");
  });
  test("a steady rise in the yearly peak is reported as rising, a steady peak as no clear trend", () => {
    const rising = analyzeVegetationHistory(
      modisSeries(years, { peak: (y) => 0.5 + 0.01 * (y - 2003) }),
      null,
      ASOF,
    );
    expect(rising.peakTrend).toMatchObject({
      status: "ok",
      direction: "rising",
      consistency: 1,
    });
    // The 16-day dates miss the exact crest, which shrinks the slope slightly.
    expect(rising.peakTrend.slopePerDecade).toBeGreaterThan(0.09);
    expect(rising.peakTrend.slopePerDecade).toBeLessThan(0.1);
    const steady = analyzeVegetationHistory(modisSeries(years, {}), null, ASOF);
    expect(steady.peakTrend.direction).toBe("no_clear_trend");
    const falling = analyzeVegetationHistory(
      modisSeries(years, { peak: (y) => 0.85 - 0.01 * (y - 2003) }),
      null,
      ASOF,
    );
    expect(falling.peakTrend.direction).toBe("falling");
  });
  test("the neighbour comparison grades similar, moderate and differs, and says not measured without neighbours", () => {
    const status = (offset) =>
      analyzeVegetationHistory(modisSeries(years, { offset }), null, ASOF)
        .heterogeneity.status;
    expect(status(0.01)).toBe("similar");
    expect(status(0.07)).toBe("moderate");
    expect(status(0.2)).toBe("differs");
    expect(status(null)).toBe("not_measured");
  });
  const hlsLike = (transform, windows) => ({
    years: range(2018, 2022).map((year) => ({
      year,
      timeline: COMPOSITE_DOYS.map((doy) => ({
        date: day(year, doy),
        ndvi: transform(bump(doy, 0.7)),
      })),
    })),
    typicalLowGreenness: { windows },
  });
  test("compares with the finer HLS record: close, weak and too little overlap", () => {
    const modis = modisSeries(years, {});
    const own = analyzeVegetationHistory(modis, null, ASOF);
    const close = analyzeVegetationHistory(
      modis,
      hlsLike((v) => v + 0.05, own.usuallyLow.windows),
      ASOF,
    );
    vegetationHistorySchema.parse(close);
    expect(close.hlsAgreement).toMatchObject({
      status: "close",
      overlapYearBins: 115,
      hlsLowDaysAlsoLowInModis: 1,
      modisLowDaysAlsoLowInHls: 1,
    });
    expect(close.hlsAgreement.correlation).toBeCloseTo(1, 3);
    expect(close.hlsAgreement.meanDifferenceHlsMinusModis).toBeCloseTo(0.05, 3);
    const weak = analyzeVegetationHistory(
      modis,
      hlsLike((v) => 1 - v, []),
      ASOF,
    );
    expect(weak.hlsAgreement.status).toBe("weak");
    expect(weak.hlsAgreement.hlsLowDaysAlsoLowInModis).toBeNull();
    const few = analyzeVegetationHistory(
      modis,
      {
        years: [{ year: 2020, timeline: [{ date: "2020-03-01", ndvi: 0.5 }] }],
        typicalLowGreenness: null,
      },
      ASOF,
    );
    expect(few.hlsAgreement.status).toBe("insufficient_overlap");
    expect(few.hlsAgreement.correlation).toBeNull();
  });
  test("is deterministic and keeps its declared policy in the result", () => {
    const a = analyzeVegetationHistory(modisSeries(years, {}), null, ASOF);
    const b = analyzeVegetationHistory(modisSeries(years, {}), null, ASOF);
    expect(a).toEqual(b);
    expect(a.policy).toEqual(vegetationHistoryPolicy);
    expect(a.limitations.join(" ")).toMatch(/not proof of bare soil/);
  });
});

describe("GEDI canopy biomass summary", () => {
  const LAT = 32.4,
    LON = -6.55;
  const D_LAT = 1 / 111.195; // about 1 km
  const D_LON = D_LAT / Math.cos((LAT * Math.PI) / 180);
  const cells = [];
  for (let i = -4; i <= 4; i++)
    for (let j = -4; j <= 4; j++)
      cells.push({
        latitude: LAT + i * D_LAT,
        longitude: LON + j * D_LON,
        agbdMgHa: 10 + i + j,
        seMgHa: 2,
      });
  test("takes the cell holding the field and the mean of cells within 3 km", () => {
    const s = summarizeCanopyBiomass(cells, LAT, LON);
    expect(s.fieldCell).toEqual({ agbdMgHa: 10, seMgHa: 2, distanceKm: 0 });
    const within = cells.filter(
      (c) => distanceKm(LAT, LON, c.latitude, c.longitude) <= 3,
    );
    expect(s.surroundings.cellsInRadius).toBe(within.length);
    expect(within.length).toBeGreaterThan(20);
    expect(s.surroundings.meanAgbdMgHa).toBeCloseTo(10, 3);
    expect(s.surroundings.minAgbdMgHa).toBeLessThan(10);
    expect(s.surroundings.maxAgbdMgHa).toBeGreaterThan(10);
    expect(s.surroundings.standardErrorOfMeanMgHa).toBeCloseTo(
      Math.sqrt(within.length * 4) / within.length,
      3,
    );
  });
  test("has no field cell when the nearest estimate is too far, and says so with no cells at all", () => {
    const far = summarizeCanopyBiomass(
      [
        {
          latitude: LAT + 1.5 * D_LAT,
          longitude: LON,
          agbdMgHa: 3,
          seMgHa: null,
        },
      ],
      LAT,
      LON,
    );
    expect(far.fieldCell).toBeNull();
    expect(far.surroundings.cellsInRadius).toBe(1);
    expect(far.surroundings.standardErrorOfMeanMgHa).toBeNull();
    const none = summarizeCanopyBiomass([], LAT, LON);
    expect(none.surroundings).toMatchObject({
      cellsInRadius: 0,
      meanAgbdMgHa: null,
    });
  });
  test("the strict contract rejects an extra key and a negative biomass", () => {
    const s = summarizeCanopyBiomass(cells, LAT, LON);
    const result = {
      kind: "gedi",
      policyVersion: "gedi-policy-1",
      product: "synthetic test product",
      resolutionNote: "Synthetic.",
      observationPeriod: { start: "2019-04-18", end: "2023-03-16" },
      ...s,
      explanations: ["gedi.agbd"],
      provenance: [
        { item: "synthetic", origin: "engineering_judgment", reference: "t" },
      ],
      limitations: ["Synthetic test values."],
    };
    expect(canopyBiomassResultSchema.safeParse(result).success).toBe(true);
    expect(
      canopyBiomassResultSchema.safeParse({ ...result, extra: 1 }).success,
    ).toBe(false);
    expect(
      canopyBiomassResultSchema.safeParse({
        ...result,
        fieldCell: { ...s.fieldCell, agbdMgHa: -1 },
      }).success,
    ).toBe(false);
  });
});

test("a MODIS result is accepted by the extraction result union and a wrong product is not", () => {
  const modis = modisSeries(range(2020, 2021), {});
  expect(extractionResultSchema.safeParse(modis).success).toBe(true);
  expect(
    extractionResultSchema.safeParse({ ...modis, product: "MOD13Q1.006" })
      .success,
  ).toBe(false);
});
