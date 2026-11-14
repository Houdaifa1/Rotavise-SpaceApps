import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  observationResultSchema,
  rainSeriesSchema,
  vegetationAnalysisSchema,
  vegetationResultSchema,
} from "../../packages/contracts/dist/index.js";
import {
  analyzeVegetation,
  clearPixel,
  hlsGranulesFromList,
  monthlyTotals,
  rainSeries,
  VEGETATION_LIMITATIONS,
  vegetationHistory,
} from "../../packages/domain/dist/index.js";
import {
  normalizeGiovanni,
  normalizeHls,
  normalizeSmap,
  parseCsv,
} from "../../apps/server/dist/modules/earth-observations/providers/normalization.js";
import { AppeearsClient } from "../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import { vegetationPolicy } from "../../apps/server/dist/modules/earth-observations/application/observation-store.js";

const dir = "docs/evidence/earth-observations/2026-10-17/";
const file = (name) => new Uint8Array(readFileSync(dir + name));
const prefix = "appeears-rotavise-step11-evidence-";
const ids = new Set(["p1", "p2", "p3", "p4"]);
const pixels = () => [
  ...normalizeHls(file(prefix + "HLSS30-020-results.csv"), "HLSS30.020", ids),
  ...normalizeHls(file(prefix + "HLSL30-020-results.csv"), "HLSL30.020", ids),
];

describe("recorded AppEEARS and Giovanni evidence", () => {
  test("files keep their recorded hashes and contain no account details", () => {
    const manifest = JSON.parse(readFileSync(dir + "manifest.json", "utf8"));
    for (const r of manifest.responses) {
      const bytes = readFileSync(dir + r.file);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(r.sha256);
      expect(bytes.toString("latin1")).not.toMatch(/gmail|user_id|Bearer /);
    }
  });
  test("Fmask bits match the AppEEARS decoder", () => {
    for (const value of [1, 2, 4, 8, 16, 32, 64, 128, 192]) {
      const decoded = JSON.parse(
        readFileSync(`${dir}fmask-decode-${value}.json`, "utf8"),
      );
      const flagged = [
        "Cloud",
        "Adjacent to cloud/shadow",
        "Cloud shadow",
        "Snow/ice",
        "Water",
      ].some((k) => decoded[k].bits === "0b1");
      const high = decoded["Aerosol level"].bits === "0b11";
      expect(clearPixel(value)).toBe(!flagged && !high);
    }
  });
  test("HLS rows become clear-pixel observations from both sensors", () => {
    const all = pixels();
    expect(all.length).toBe(1480);
    expect(new Set(all.map((p) => p.sensor))).toEqual(
      new Set(["landsat", "sentinel-2"]),
    );
    expect(all.filter((p) => clearPixel(p.fmask)).length).toBe(573 + 262);
  });
  test("the real Tadla record shows two winter green seasons", () => {
    const result = vegetationHistory(
      pixels(),
      4,
      { start: "2023-01-01", end: "2024-12-31" },
      vegetationPolicy,
    );
    expect(result.signal.distinct).toBe(true);
    expect(result.seasons.map((s) => [s.start, s.end, s.peakDate])).toEqual([
      ["2023-01-02", "2023-04-26", "2023-03-07"],
      ["2024-01-23", "2024-04-30", "2024-02-20"],
    ]);
    expect(result.seasons[0].peakNdvi).toBeGreaterThan(
      result.seasons[1].peakNdvi,
    );
    expect(result.seasons[0].openAtStart).toBe(true);
    expect(result.datesUsable).toBe(208);
    expect(
      observationResultSchema.safeParse({
        kind: "hls",
        policy: vegetationPolicy,
        product: "HLS v2.0 (HLSL30.020, HLSS30.020) via AppEEARS",
        ...result,
        limitations: ["test"],
      }).success,
    ).toBe(true);
  });
  test("a flat or sparse series has no distinct seasons", () => {
    const flat = Array.from({ length: 60 }, (_, i) => ({
      pointId: "p1",
      date: new Date(Date.UTC(2023, 0, 1 + i * 5)).toISOString().slice(0, 10),
      sensor: "landsat",
      red: 0.1,
      nir: 0.2 + (i % 2) * 0.001,
      fmask: 0,
    }));
    const period = { start: "2023-01-01", end: "2023-12-31" };
    expect(
      vegetationHistory(flat, 1, period, vegetationPolicy).seasons,
    ).toEqual([]);
    expect(
      vegetationHistory(flat.slice(0, 5), 1, period, vegetationPolicy).signal
        .distinct,
    ).toBe(false);
    const cloudy = flat.map((p) => ({ ...p, fmask: 2 }));
    expect(
      vegetationHistory(cloudy, 1, period, vegetationPolicy).observations,
    ).toEqual([]);
  });
  test("SMAP L4 becomes daily means for one 9 km cell, with undefined percentiles left empty", () => {
    const smap = normalizeSmap(file(prefix + "SPL4SMGP-008-results.csv"));
    expect(smap.cell).toEqual({ line: 376, sample: 1857 });
    expect(smap.days).toHaveLength(731);
    expect(smap.days.filter((d) => d.percentile !== null)).toHaveLength(263);
    expect(smap.days.every((d) => d.volumetric > 0 && d.volumetric < 0.9)).toBe(
      true,
    );
  });
  test("Giovanni GPM IMERG becomes daily mm for its 0.1° cell; months are complete or empty", () => {
    const g = normalizeGiovanni(file("giovanni-gpm-imerg-daily.csv"));
    expect(g.cell).toEqual({ latitude: 32.35, longitude: -6.55 });
    expect(g.days).toHaveLength(90);
    const months = monthlyTotals(g.days);
    expect(months.get("2023-02").days).toBe(28);
    expect(Number(months.get("2023-02").sum.toFixed(1))).toBe(41.3);
    const gap = monthlyTotals([
      { date: "2023-01-01", mm: null },
      { date: "2023-01-02", mm: 2 },
    ]);
    expect(gap.get("2023-01").missing).toBe(true);
  });
  test("malformed provider files are refused", () => {
    const text = readFileSync(dir + prefix + "HLSL30-020-results.csv", "utf8");
    const bad = (s) => new TextEncoder().encode(s);
    expect(() =>
      normalizeHls(bad(text.replace(",p1,", ",p9,")), "HLSL30.020", ids),
    ).toThrow("OBSERVATION_UPSTREAM_INVALID");
    expect(() =>
      normalizeHls(bad(text.replace("0.062,", "abc,")), "HLSL30.020", ids),
    ).toThrow("OBSERVATION_UPSTREAM_INVALID");
    expect(() => normalizeHls(bad(text), "HLSS30.020", ids)).toThrow(
      "OBSERVATION_UPSTREAM_INVALID",
    );
    const g = readFileSync(dir + "giovanni-gpm-imerg-daily.csv", "utf8");
    expect(() =>
      normalizeGiovanni(bad(g.replace("GPM_3IMERGDF.07", "OTHER"))),
    ).toThrow("OBSERVATION_UPSTREAM_INVALID");
    expect(() => parseCsv('a,"b')).toThrow("OBSERVATION_UPSTREAM_INVALID");
    expect(parseCsv('a,"b,""c"""\r\n1,2\n')).toEqual([
      ["a", 'b,"c"'],
      ["1", "2"],
    ]);
  });
});

describe("AppEEARS client", () => {
  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  test("logs in once, renews on 401, and never sends the token to the storage redirect", async () => {
    const calls = [];
    let logins = 0;
    const fake = async (url, init = {}) => {
      const href = String(url);
      calls.push({ href, authorization: init.headers?.authorization ?? null });
      if (href.endsWith("/login"))
        return json(200, { token: `token-${++logins}` });
      if (href.endsWith("/task") && init.method === "POST")
        return logins === 1 ? json(401, {}) : json(202, { task_id: "abc-123" });
      if (href.includes("/bundle/abc-123/file-1"))
        return new Response(null, {
          status: 302,
          headers: { location: "https://storage.example.invalid/signed" },
        });
      if (href.startsWith("https://storage.example.invalid"))
        return new Response("x,y\n1,2\n");
      throw new Error("unexpected " + href);
    };
    const client = new AppeearsClient("user", "pass", fake);
    const signal = new AbortController().signal;
    expect(
      await client.submit(
        {
          task_type: "point",
          task_name: "t",
          params: { dates: [], layers: [], coordinates: [] },
        },
        signal,
      ),
    ).toBe("abc-123");
    expect(logins).toBe(2);
    const sha = createHash("sha256").update("x,y\n1,2\n").digest("hex");
    const bytes = await client.download(
      "abc-123",
      { fileId: "file-1", name: "f.csv", size: 8, sha256: sha },
      signal,
    );
    expect(new TextDecoder().decode(bytes)).toBe("x,y\n1,2\n");
    expect(
      calls.find((c) => c.href.startsWith("https://storage")).authorization,
    ).toBeNull();
    expect(
      calls
        .filter((c) => c.href.endsWith("/login"))
        .every((c) => c.authorization.startsWith("Basic ")),
    ).toBe(true);
    await expect(
      client.download(
        "abc-123",
        { fileId: "file-1", name: "f.csv", size: 8, sha256: "0".repeat(64) },
        signal,
      ),
    ).rejects.toThrow("OBSERVATION_UPSTREAM_INVALID");
  });
  test("missing credentials are reported as not configured", async () => {
    await expect(
      new AppeearsClient(undefined, undefined).status(
        "abc",
        new AbortController().signal,
      ),
    ).rejects.toThrow("OBSERVATIONS_NOT_CONFIGURED");
  });
});

// Synthetic series, clearly artificial: a winter crop (green about December to
// May) and a bare summer, one reading every five days with cloud gaps.
const SYNTHETIC_POLICY = {
  version: "vegetation-policy-1",
  minimumClearShare: 0.5,
  smoothingObservations: 5,
  seasonLevelFraction: 0.5,
  seasonPeakFraction: 0.75,
  mergeGapDays: 30,
  minimumSeasonDays: 30,
  minimumSignalToNoise: 4,
};
const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const pixelFor = (date, ndvi, sensor = "sentinel-2") => {
  const red = 0.1;
  return {
    pointId: "p1",
    date,
    sensor,
    red,
    nir: (red * (1 + ndvi)) / (1 - ndvi),
    fmask: 0,
  };
};
const resultFrom = (pix, period) =>
  vegetationResultSchema.parse({
    kind: "hls",
    policy: SYNTHETIC_POLICY,
    product: "HLS v2.0 (HLSL30.020, HLSS30.020) via AppEEARS",
    ...vegetationHistory(pix, 1, period, SYNTHETIC_POLICY),
    limitations: VEGETATION_LIMITATIONS,
  });
function syntheticResult({ years, stressYear = null, cloudWinterYear = null }) {
  const first = years[0],
    last = years.at(-1);
  const pix = [];
  for (let y = first; y <= last; y++) {
    for (let day = 0; day < 365; day += 5) {
      const d = new Date(Date.UTC(y, 0, 1 + day));
      const m = d.getUTCMonth() + 1;
      // Green from December through May; low otherwise.
      let ndvi = m >= 12 || m <= 5 ? 0.7 : 0.2;
      if (m === 12 || m === 1 || m === 5) ndvi = 0.55;
      if (y === stressYear && m >= 2 && m <= 4) ndvi -= 0.3;
      if (y === cloudWinterYear && m >= 1 && m <= 3) continue;
      pix.push(pixelFor(isoDay(d), ndvi));
    }
  }
  return resultFrom(pix, { start: `${first}-01-01`, end: `${last}-12-31` });
}
const SIX_YEARS = [2018, 2019, 2020, 2021, 2022, 2023];

describe("field greenness analysis (synthetic fixtures, never served)", () => {
  test("six years of a winter crop give a per-year timeline and green and low periods", () => {
    const result = syntheticResult({ years: SIX_YEARS });
    const a = vegetationAnalysisSchema.parse(
      analyzeVegetation(result, "2023-12-31"),
    );
    expect(a.periodsStatus).toBe("available");
    expect(a.years.map((y) => y.status)).toEqual(Array(6).fill("complete"));
    const year = a.years.find((y) => y.year === 2021);
    expect(year.timeline.length).toBeGreaterThan(50);
    expect(year.periods.some((p) => p.kind === "green")).toBe(true);
    expect(year.periods.some((p) => p.kind === "low_greenness")).toBe(true);
    for (const p of year.periods) expect(p.start <= p.end).toBe(true);
    expect(a.explanations.map((e) => e.key)).toEqual(
      expect.arrayContaining(["ndvi", "green_season", "bare_field_period"]),
    );
    expect(a.limitations.join(" ")).toMatch(/not proof of bare soil/);
  });
  test("the usually-low window is the dry summer, found from complete years only", () => {
    const a = analyzeVegetation(
      syntheticResult({ years: SIX_YEARS }),
      "2023-12-31",
    );
    expect(a.typicalLowGreenness.completeYears).toBe(6);
    const windows = a.typicalLowGreenness.windows;
    expect(windows.length).toBe(1);
    expect(windows[0].start >= "06-01" && windows[0].start <= "07-15").toBe(
      true,
    );
    // The window ends the day before the green season usually starts.
    expect(windows[0].end >= "11-15" && windows[0].end <= "12-10").toBe(true);
    expect(windows[0].yearsLowMin).toBeGreaterThanOrEqual(3);
  });
  test("fewer than three complete years claim no usual window", () => {
    const a = analyzeVegetation(
      syntheticResult({ years: [2022, 2023] }),
      "2023-12-31",
    );
    expect(a.typicalLowGreenness.completeYears).toBe(2);
    expect(a.typicalLowGreenness.windows).toEqual([]);
    expect(a.anomalies.status).toBe("insufficient_history");
  });
  test("a stressed spring is flagged below usual against the field's other years", () => {
    const result = syntheticResult({ years: SIX_YEARS, stressYear: 2023 });
    const a = vegetationAnalysisSchema.parse(
      analyzeVegetation(result, "2023-12-31"),
    );
    expect(a.anomalies.status).toBe("ok");
    expect(a.anomalies.referenceYears).toBe(5);
    const spring = a.anomalies.points.filter(
      (p) => p.date >= "2023-03-01" && p.date <= "2023-04-15",
    );
    expect(spring.length).toBeGreaterThan(5);
    expect(spring.every((p) => p.flag === "below_usual")).toBe(true);
    expect(spring.every((p) => p.anomaly < 0)).toBe(true);
    expect(a.anomalies.below).toBeGreaterThan(0);
    expect(a.explanations.map((e) => e.key)).toEqual(
      expect.arrayContaining(["vegetation_stress", "field_history_anomaly"]),
    );
  });
  test("an ordinary year raises no flag and the latest reading says how old it is", () => {
    const a = analyzeVegetation(
      syntheticResult({ years: SIX_YEARS }),
      "2024-03-01",
    );
    expect(a.anomalies.below).toBe(0);
    expect(a.anomalies.latest.daysOld).toBeGreaterThan(30);
    expect(a.anomalies.latest.stale).toBe(true);
  });
  test("a cloudy winter lowers confidence and is reported as a gap, never filled in", () => {
    const a = analyzeVegetation(
      syntheticResult({ years: SIX_YEARS, cloudWinterYear: 2021 }),
      "2023-12-31",
    );
    expect(a.uncertainty.gapsOverLimit.length).toBeGreaterThan(0);
    expect(a.uncertainty.largestGapDays).toBeGreaterThanOrEqual(45);
    expect(a.explanations.map((e) => e.key)).toContain("cloud_gap");
    const year = a.years.find((y) => y.year === 2021);
    expect(
      year.timeline.some(
        (t) => t.date >= "2021-01-10" && t.date <= "2021-02-20",
      ),
    ).toBe(false);
  });
  test("a flat series gives no periods instead of invented ones", () => {
    const pix = [];
    for (let i = 0; i < 60; i++)
      pix.push(pixelFor(isoDay(new Date(Date.UTC(2022, 0, 1 + i * 6))), 1 / 3));
    const a = vegetationAnalysisSchema.parse(
      analyzeVegetation(
        resultFrom(pix, { start: "2022-01-01", end: "2022-12-31" }),
        "2022-12-31",
      ),
    );
    expect(a.periodsStatus).toBe("undetermined");
    expect(a.undeterminedReason).toBe("no_distinct_seasonal_signal");
    expect(a.years[0].periods).toEqual([]);
    expect(a.typicalLowGreenness).toBeNull();
  });
  test("the analysis is deterministic", () => {
    const result = syntheticResult({ years: SIX_YEARS });
    expect(JSON.stringify(analyzeVegetation(result, "2023-12-31"))).toBe(
      JSON.stringify(analyzeVegetation(result, "2023-12-31")),
    );
  });
});

describe("granule ids and the recorded Tadla field", () => {
  const list = readFileSync(
    dir + "appeears-rotavise-step11-evidence-granule-list.txt",
    "utf8",
  );
  const realHistory = () =>
    vegetationHistory(
      pixels(),
      4,
      { start: "2023-01-01", end: "2024-12-31" },
      vegetationPolicy,
    );
  test("granule ids come from the real AppEEARS granule list, one per usable date and sensor", () => {
    const history = realHistory();
    const granules = hlsGranulesFromList(list, history.observations);
    expect(granules.length).toBeGreaterThan(200);
    expect(granules[0]).toEqual({
      date: "2023-01-02",
      sensor: "landsat",
      granule: "HLS.L30.T29SQR.2023002T105759.v2.0",
    });
    const dates = new Set(granules.map((g) => g.date));
    expect(history.observations.every((o) => dates.has(o.date))).toBe(true);
    expect(new Set(granules.map((g) => g.granule)).size).toBe(granules.length);
  });
  test("the recorded data give two complete years, real seasons and an honest 'not enough history'", () => {
    const history = realHistory();
    const result = vegetationResultSchema.parse({
      kind: "hls",
      policy: vegetationPolicy,
      product: "HLS v2.0 (HLSL30.020, HLSS30.020) via AppEEARS",
      ...history,
      granules: hlsGranulesFromList(list, history.observations),
      limitations: VEGETATION_LIMITATIONS,
    });
    const a = vegetationAnalysisSchema.parse(
      analyzeVegetation(result, "2024-12-31"),
    );
    expect(a.periodsStatus).toBe("available");
    expect(a.years.map((y) => [y.year, y.status])).toEqual([
      [2023, "complete"],
      [2024, "complete"],
    ]);
    expect(a.uncertainty.granulesAvailable).toBe(true);
    expect(
      a.years.every((y) => y.timeline.every((t) => t.granules.length >= 1)),
    ).toBe(true);
    expect(a.typicalLowGreenness.windows).toEqual([]);
    expect(a.anomalies.status).toBe("insufficient_history");
    expect(a.anomalies.latest.flag).toBe("not_compared");
  });
});

describe("POWER versus GPM IMERG rain series", () => {
  const result = {
    kind: "gpm",
    product: "GPM IMERG Final daily V07 (GPM_3IMERGDF.07) via Giovanni",
    cell: { latitude: 32.45, longitude: -6.55 },
    period: { start: "2023-01-01", end: "2023-04-30" },
    months: [
      { month: "2023-01", imergMm: 40, powerMm: 50, imergDays: 31 },
      { month: "2023-02", imergMm: 30, powerMm: 20, imergDays: 28 },
      { month: "2023-03", imergMm: null, powerMm: 60, imergDays: 20 },
      { month: "2023-04", imergMm: 0.4, powerMm: 0.5, imergDays: 30 },
    ],
    limitations: ["Satellite estimate, not a rain gauge."],
  };
  test("months are compared only when both sources are complete", () => {
    const s = rainSeriesSchema.parse(
      rainSeries(observationResultSchema.parse(result)),
    );
    expect(s.unit).toBe("mm per calendar month");
    expect(s.months.map((m) => m.bothComplete)).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect(s.months[0]).toMatchObject({ differenceMm: -10, ratio: 0.8 });
    expect(s.months[1]).toMatchObject({ differenceMm: 10, ratio: 1.5 });
    expect(s.months[2]).toMatchObject({ differenceMm: null, ratio: null });
    // POWER below one millimetre has no ratio.
    expect(s.months[3]).toMatchObject({ differenceMm: -0.1, ratio: null });
    expect(s.summary).toMatchObject({
      monthsCompared: 3,
      imergTotalMm: 70.4,
      powerTotalMm: 70.5,
      imergWetterShare: 0.333,
    });
    expect(s.sources.imerg.cell).toEqual({
      latitude: 32.45,
      longitude: -6.55,
    });
    expect(s.planning).toMatch(/2001–2020/);
  });
});
