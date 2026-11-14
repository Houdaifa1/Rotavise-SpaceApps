import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import {
  rainCell,
  rotationAssessmentSchema,
  rotationSoilCarbonSchema,
  rotationYieldsSchema,
  soilCell,
  soilEstimateSchema,
} from "../../packages/contracts/dist/index.js";
import { normalizeRainReference } from "../../apps/server/dist/modules/weather/application/rain-reference-store.js";
import {
  attachYields,
  rankWithYields,
  textureClass,
  yieldSimulations,
} from "../../packages/domain/dist/index.js";
import {
  inertCarbon,
  rotationSchedule,
  soilCarbonFor,
  spinUp,
} from "../../packages/domain/dist/rotation/soil-carbon.js";
import { weatherSource } from "../../packages/domain/dist/rotation/climate.js";
import { indexWeather } from "../../packages/domain/dist/climate/weather.js";
import { rainCorrection } from "../../packages/domain/dist/rotation/climate.js";
import { normalizeSoil } from "../../apps/server/dist/modules/soil/application/soil-store.js";
import { readSoilTiff } from "../../apps/server/dist/modules/soil/providers/soilgrids/geotiff.js";
import { soilGridsUrl } from "../../apps/server/dist/modules/soil/providers/soilgrids/soilgrids.provider.js";
import { assessRotationsCore } from "../../packages/domain/dist/rotation/assess.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  rotationPolicy,
  rotationRequest,
  rotationWeather,
} from "../support/rotation.mjs";

const recorded = JSON.parse(
  readFileSync(
    "docs/evidence/soil/2026-11-01/soilgrids-meknes-33.85_-5.6.json",
    "utf8",
  ),
);
const cell = { latitude: 33.85, longitude: -5.6 };
const estimate = normalizeSoil(recorded, cell, "2026-11-01T02:20:00.000Z");
describe("recorded SoilGrids response near Meknès", () => {
  test("all 24 layers parse and the units are physically consistent", () => {
    expect(recorded).toHaveLength(24);
    expect(() => soilEstimateSchema.parse(estimate)).not.toThrow();
    // Sand, silt and clay must describe the whole soil.
    expect(
      estimate.clayPercent + estimate.sandPercent + estimate.siltPercent,
    ).toBeGreaterThan(98);
    expect(
      estimate.clayPercent + estimate.sandPercent + estimate.siltPercent,
    ).toBeLessThan(102);
    expect(estimate.phWater).toBeGreaterThan(5);
    expect(estimate.phWater).toBeLessThan(9.5);
    expect(estimate.bulkDensityGPerCm3).toBeGreaterThan(0.8);
    expect(estimate.bulkDensityGPerCm3).toBeLessThan(2);
  });
  test("normalizing the same bytes is reproducible", () => {
    expect(normalizeSoil(recorded, cell, estimate.retrievedAt)).toEqual(
      estimate,
    );
  });
});
describe("privacy and input checks", () => {
  test("requests name a 0.01° window, never the exact position", () => {
    const rounded = soilCell(33.84731, -5.60219);
    expect(rounded).toEqual({ latitude: 33.85, longitude: -5.6 });
    const url = soilGridsUrl({ ...rounded, property: "phh2o", depth: "0-5cm" });
    expect(url.toString()).not.toContain("33.84731");
    expect(url.toString()).not.toContain("5.60219");
  });
  test("a missing layer and an unsupported TIFF are rejected", () => {
    expect(() =>
      normalizeSoil(recorded.slice(1), cell, estimate.retrievedAt),
    ).toThrow("SOIL_LAYER_MISSING");
    expect(() => readSoilTiff(Buffer.from("not a tiff at all"))).toThrow();
    expect(() => readSoilTiff(deflateSync(Buffer.alloc(40)))).toThrow();
  });
  test("texture that does not sum to 100 is rejected", () => {
    expect(() =>
      soilEstimateSchema.parse({
        ...estimate,
        clayPercent: 80,
        sandPercent: 80,
      }),
    ).toThrow();
  });
});
describe("soil in rotation plans", () => {
  const request = (soil) =>
    rotationRequest({
      history: { status: "unknown" },
      soil,
      preferences: {
        mode: "consider",
        considered_crop_ids: ["faba-bean"],
        excluded_crop_ids: [],
        priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
      },
    });
  const run = async (soil, soilEstimate) =>
    assessRotationsCore(
      request(soil),
      await loadCatalogRelease("data/catalog/releases/0.6.0"),
      rotationWeather(),
      rotationPolicy,
      "2026-10-15",
      true,
      null,
      soilEstimate,
    );
  const faba = (r) => r.crops.find((c) => c.cropId === "faba-bean");
  test("a modelled pH outside the limit warns and never rejects", async () => {
    const r = await run({ status: "unknown" }, { ...estimate, phWater: 8.4 });
    expect(faba(r).status).toBe("schedulable");
    expect(faba(r).reasons.map((x) => x.code)).toContain(
      "SOIL_ESTIMATE_OUTSIDE",
    );
    expect(r.soilEstimate.phWater).toBe(8.4);
  });
  test("a pH inside the limit is noted without a warning", async () => {
    const r = await run({ status: "unknown" }, { ...estimate, phWater: 7 });
    expect(faba(r).reasons.map((x) => x.code)).toContain("SOIL_ESTIMATE_USED");
    expect(faba(r).reasons.map((x) => x.code)).not.toContain(
      "SOIL_ESTIMATE_OUTSIDE",
    );
  });
  test("no estimate says so", async () => {
    const r = await run({ status: "unknown" }, null);
    expect(r.reasons.map((x) => x.code)).toContain("SOIL_ESTIMATE_UNAVAILABLE");
  });
  test("a farmer's soil test takes precedence over the estimate", async () => {
    const r = await run(
      {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 6.8,
            method: "water",
            measured_on: "2025-09-01",
            source: "laboratory_report",
          },
        ],
      },
      { ...estimate, phWater: 8.4 },
    );
    expect(faba(r).reasons.map((x) => x.code)).not.toContain(
      "SOIL_ESTIMATE_OUTSIDE",
    );
  });
});

describe("GPM rain correction", () => {
  const raw = readFileSync(
    "docs/evidence/rain/2026-11-01/gpm-imerg-errachidia-31.95_-4.35.csv",
  );
  const reference = normalizeRainReference(
    raw,
    { latitude: 31.95, longitude: -4.35 },
    "2026-11-01T03:00:00.000Z",
  );
  const annual = reference.monthlyMeanMm.reduce((a, b) => a + b, 0);
  test("the recorded response gives a dry-region monthly climatology", () => {
    expect(reference.monthlyMeanMm).toHaveLength(12);
    expect(annual).toBeGreaterThan(100);
    expect(annual).toBeLessThan(300);
  });
  test("cells are 0.1° centres", () => {
    expect(rainCell(31.9, -4.4)).toEqual({ latitude: 31.95, longitude: -4.35 });
  });
  const dayEntry = (value) => ({ precipitation: { value } });
  const indexWith = (mm, last = 2020) => {
    const days = new Map();
    for (let y = 2001; y <= last; y++)
      for (let m = 1; m <= 12; m++)
        for (let d = 1; d <= 28; d++)
          days.set(
            `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
            dayEntry(mm),
          );
    return { days };
  };
  test("factors bring POWER to the reference and are limited", () => {
    const flat = { ...reference, monthlyMeanMm: Array(12).fill(56) };
    const same = rainCorrection(indexWith(2), flat);
    expect(same.factors).toEqual(Array(12).fill(1));
    expect(rainCorrection(indexWith(1), flat).factors[0]).toBe(2);
    expect(rainCorrection(indexWith(0.1), flat).factors[0]).toBe(3);
    expect(rainCorrection(indexWith(50), flat).factors[0]).toBe(0.2);
  });
  test("incomplete POWER years give no correction", () => {
    expect(rainCorrection(indexWith(2, 2010), reference)).toBeNull();
    expect(rainCorrection(null, reference)).toBeNull();
  });
  test("a plan reports corrected rain and extremes", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.6.0");
    const req = rotationRequest({
      history: { status: "unknown" },
      preferences: {
        mode: "consider",
        considered_crop_ids: ["faba-bean"],
        excluded_crop_ids: [],
        priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
      },
    });
    const assess = (rain) =>
      assessRotationsCore(
        req,
        real,
        rotationWeather(),
        rotationPolicy,
        "2026-10-15",
        true,
        null,
        null,
        rain,
      );
    const without = assess(null);
    expect(without.rain.source).toBe("power_only");
    const doubled = without.candidates[0].waterBalance.meanAnnualRainMm * 2;
    const withRef = assess({
      ...reference,
      monthlyMeanMm: Array(12).fill(doubled / 12),
    });
    expect(() => rotationAssessmentSchema.parse(withRef)).not.toThrow();
    expect(withRef.rain.source).toBe("power_corrected_to_gpm");
    expect(withRef.candidates[0].waterBalance.meanAnnualRainMm).toBeGreaterThan(
      without.candidates[0].waterBalance.meanAnnualRainMm,
    );
    const x = withRef.candidates[0].extremes;
    expect(x.hottestDayC).toBeGreaterThanOrEqual(x.meanHottestDayC);
    expect(x.coldestNightC).toBeLessThanOrEqual(x.meanColdestNightC);
    expect(x.longestDrySpellDays).toBeGreaterThan(0);
    expect(x.droughtSeasonShare).toBeGreaterThanOrEqual(0);
  });
});

describe("crop model yields", () => {
  const slot = (cropId) => ({
    cropId,
    sowEarliest: "2027-11-01",
    sowLatest: "2027-11-29",
    harvestEarliest: "2028-05-01",
    harvestLatest: "2028-07-01",
    durationDays: { min: 165, max: 240 },
    windowRuleIds: [],
    durationRuleIds: [],
  });
  const candidate = {
    id: "a",
    slots: [slot("faba-bean"), slot("bread-wheat")],
  };
  const simulations = yieldSimulations([candidate], 1991, 2020, 7);
  test("only crops with a model are simulated, once per year", () => {
    expect(simulations).toHaveLength(30);
    expect(new Set(simulations.map((s) => s.crop))).toEqual(
      new Set(["WheatGDD"]),
    );
    expect(simulations[0].sown).toBe("1991-11-15");
  });
  const meta = {
    model: "AquaCrop-OSPy",
    modelVersion: "3.1.0",
    serviceVersion: "1",
    soilClass: "Loam",
    soilAssumed: false,
    irrigated: false,
  };
  test("faba bean says it has no model instead of showing a number", () => {
    const results = simulations.map((_, i) => ({
      yieldTPerHa: i / 10,
      potentialTPerHa: 5,
      irrigationMm: 0,
    }));
    const y = attachYields([candidate], simulations, results, 7, meta);
    expect(rotationYieldsSchema.parse(y).calibration).toBe(
      "uncalibrated_default_parameters",
    );
    const [faba, wheat] = y.candidates[0].slots;
    expect(faba.status).toBe("no_crop_model");
    expect(faba.meanYieldTPerHa).toBeNull();
    expect(wheat.status).toBe("estimated");
    expect(wheat.meanYieldTPerHa).toBeCloseTo(1.45, 2);
    expect(wheat.worstDecileYieldTPerHa).toBeCloseTo(0.3, 2);
  });
  test("too few finished seasons stay incomplete", () => {
    const y = attachYields(
      [candidate],
      simulations,
      simulations.map(() => null),
      7,
      meta,
    );
    expect(y.candidates[0].slots[1].status).toBe("incomplete");
  });
  test("texture classes follow the USDA triangle", () => {
    expect(textureClass(33, 27, 40)).toBe("ClayLoam");
    expect(textureClass(50, 20, 30)).toBe("Clay");
    expect(textureClass(5, 90, 5)).toBe("Sand");
    expect(textureClass(20, 40, 40)).toBe("Loam");
    expect(textureClass(10, 65, 25)).toBe("SandyLoam");
    expect(textureClass(10, 20, 70)).toBe("SiltLoam");
  });
});

describe("RothC soil carbon", () => {
  const climate = Array.from({ length: 12 }, (_, m) => ({
    temperature: 15 + 8 * Math.sin((m / 12) * 2 * Math.PI),
    rain: 40,
    et: 80,
  }));
  const pattern = (annual) => ({
    inputs: Array.from({ length: 12 }, () => annual / 12),
    covered: Array.from({ length: 12 }, (_, m) => m < 7),
  });
  test("inert carbon follows Falloon et al. 1998", () => {
    expect(inertCarbon(40)).toBeCloseTo(0.049 * 40 ** 1.139, 8);
  });
  test("spin-up reaches the mapped stock", () => {
    const s = spinUp(climate, 25, 40, pattern(1));
    const sum = s.pools.dpm + s.pools.rpm + s.pools.bio + s.pools.hum;
    expect(sum + s.inert).toBeCloseTo(40, 6);
    expect(s.background).toBeGreaterThan(0);
    expect(s.pools.hum).toBeGreaterThan(s.pools.dpm);
  });
  const candidate = {
    id: "r",
    slots: [
      {
        cropId: "faba-bean",
        sowEarliest: "2027-11-01",
        harvestLatest: "2028-07-01",
        durationDays: { min: 235, max: 235 },
      },
      {
        cropId: "barley",
        sowEarliest: "2028-11-01",
        harvestLatest: "2029-06-01",
        durationDays: { min: 165, max: 200 },
      },
    ],
  };
  test("keeping residues returns more carbon than grazing them", () => {
    const map = new Map([
      ["faba-bean", 0.76],
      ["barley", 1.5],
    ]);
    const grazed = rotationSchedule(candidate, map, 0);
    const kept = rotationSchedule(candidate, map, 0.3);
    const sum = (x) => x.inputs.reduce((a, b) => a + b, 0);
    expect(sum(kept)).toBeGreaterThan(sum(grazed));
    expect(grazed.inputs).toHaveLength(36);
    // Barley roots and residue use IPCC Table 11.1A.
    const barleyDry = 1.5 * 0.89;
    const fabaDry = 0.76 * 0.91;
    expect(sum(grazed)).toBeCloseTo(
      0.45 *
        ((barleyDry + barleyDry * 1.2) * 0.22 +
          (fabaDry + fabaDry * 2.1) * 0.19),
      6,
    );
  });
  test("a crop with no residue data is not guessed", () => {
    expect(rotationSchedule(candidate, new Map(), 0)).toBeNull();
  });
});

describe("RothC rotations", () => {
  test("the baseline rotation holds its stock and kept residues raise it", () => {
    const source = weatherSource(
      indexWeather(
        rotationWeather(),
        { latitude: 32.3, longitude: -6.3 },
        "2026-10-15",
        true,
      ),
      32.3,
    );
    const candidate = {
      id: "r",
      slots: [
        {
          cropId: "faba-bean",
          sowEarliest: "2027-11-01",
          harvestLatest: "2028-07-01",
          durationDays: { min: 235, max: 235 },
        },
        {
          cropId: "barley",
          sowEarliest: "2028-11-01",
          harvestLatest: "2029-06-01",
          durationDays: { min: 165, max: 200 },
        },
      ],
    };
    const r = soilCarbonFor(
      [candidate],
      [
        new Map([
          ["faba-bean", 0.76],
          ["barley", 1.5],
        ]),
      ],
      source,
      25,
      10,
      1.4,
    );
    expect(rotationSoilCarbonSchema.parse(r).startTCPerHa).toBeCloseTo(42, 6);
    const c = r.candidates[0];
    // Twenty years ends part-way through this three-year cycle.
    expect(Math.abs(c.after20YearsGrazedTCPerHa - 42)).toBeLessThan(1);
    // Kept residue adds a modest amount, not a doubling of the soil's inputs.
    expect(c.after20YearsKeptTCPerHa).toBeGreaterThan(
      c.after20YearsGrazedTCPerHa,
    );
    expect(c.after20YearsKeptTCPerHa).toBeLessThan(
      c.after20YearsGrazedTCPerHa + 5,
    );
  });
});

describe("ranking with yields", () => {
  const c = (id, weightedLoss) => ({ id, weightedLoss, rank: 1, tiedWith: [] });
  const slot = (cropId, attainment) => ({
    cropId,
    status: attainment === null ? "no_crop_model" : "estimated",
    seasons: 30,
    meanYieldTPerHa: null,
    worstDecileYieldTPerHa: null,
    meanIrrigationMm: null,
    attainment,
  });
  const yields = (rows) => ({
    candidates: rows.map(([id, s]) => ({ id, slots: s })),
  });
  test("better attainment can overturn a small comparison lead", () => {
    const r = rankWithYields(
      [c("a", 0.3), c("b", 0.35)],
      yields([
        ["a", [slot("barley", 0.2)]],
        ["b", [slot("potato", 0.9)]],
      ]),
    );
    expect(r.candidates.map((x) => x.id)).toEqual(["b", "a"]);
    expect(r.candidates[0].rank).toBe(1);
    expect(r.yields.rankingWeight).toBe(0.5);
  });
  test("a crop with no model takes the field's mean, so the gap gives no edge", () => {
    const r = rankWithYields(
      [c("gap", 0.3), c("known", 0.3)],
      yields([
        ["gap", [slot("faba-bean", null)]],
        ["known", [slot("barley", 0.5)]],
      ]),
    );
    expect(r.yields.candidates[0].attainment).toBe(0.5);
    expect(r.candidates[0].rank).toBe(1);
    expect(r.candidates[1].rank).toBe(1);
    expect(r.candidates[0].tiedWith).toEqual(["known"]);
  });
  test("no model at all leaves the order unchanged", () => {
    const list = [c("a", 0.3)];
    const r = rankWithYields(list, yields([["a", [slot("faba-bean", null)]]]));
    expect(r.candidates).toBe(list);
  });
});

test("an early-year crop skips the first year, whose run-up has no weather", () => {
  const sims = yieldSimulations(
    [
      {
        id: "a",
        slots: [
          {
            cropId: "potato",
            sowEarliest: "2027-01-01",
            sowLatest: "2027-01-29",
            durationDays: { min: 80, max: 150 },
          },
        ],
      },
    ],
    1991,
    2020,
    7,
  );
  expect(sims).toHaveLength(29);
  expect(sims[0].sown.startsWith("1992")).toBe(true);
});
