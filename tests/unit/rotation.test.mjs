import { rotationPlanningPolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { test, expect, describe } from "@jest/globals";
import { createHash } from "node:crypto";
import {
  assessRotationsCore,
  rotationWeatherNeedsCore,
  assessRotations,
  rotationScenarioNeedsCore,
  RotationInputError,
} from "../../packages/domain/dist/rotation/assess.js";
import { normalizedWeatherHash } from "../../packages/domain/dist/index.js";
import { soilLoss } from "../../packages/domain/dist/rotation/search.js";
import { containsPoint } from "../../packages/domain/dist/rotation/geometry.js";
import {
  cropCoefficient,
  extraterrestrialRadiationMm,
  referenceEvapotranspirationMm,
} from "../../packages/domain/dist/rotation/water.js";
import { occurrences } from "../../packages/domain/dist/rotation/calendar.js";
import { addDays } from "../../packages/domain/dist/calendar/dates.js";
import {
  normalizePlanRequestV2,
  planRequestV2Schema,
  rotationAssessmentSchema,
  whatIfSchema,
} from "../../packages/contracts/dist/index.js";
import { applyWhatIfToSource } from "../../packages/domain/dist/rotation/what-if.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  rotationCatalog,
  rotationWeather,
  rotationRequest,
  rotationPolicy,
  syntheticScenarioSeries,
} from "../support/rotation.mjs";

const assessedOn = "2026-10-15";
const weather = rotationWeather();
const run = (
  request = rotationRequest(),
  catalog = rotationCatalog(),
  w = weather,
  policy = rotationPolicy,
) => assessRotationsCore(request, catalog, w, policy, assessedOn, true);
const base = run();
const monthDay = (d) => d.slice(5);
const inWindow = (date, start, end) =>
  start <= end
    ? monthDay(date) >= start && monthDay(date) <= end
    : monthDay(date) >= start || monthDay(date) <= end;

describe("geometry and calendar", () => {
  const square = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  };
  test("points in the outer ring count, points in a hole do not", () => {
    expect(containsPoint(square, 2, 2)).toBe(true);
    expect(containsPoint(square, 5, 5)).toBe(false);
    expect(containsPoint(square, 11, 5)).toBe(false);
    expect(
      containsPoint(
        {
          type: "MultiPolygon",
          coordinates: [
            square.coordinates,
            [
              [
                [20, 20],
                [21, 20],
                [21, 21],
                [20, 20],
              ],
            ],
          ],
        },
        20.6,
        20.2,
      ),
    ).toBe(true);
  });
  test("year-crossing windows belong to their start year and Feb 29 never widens a window", () => {
    const rule = { id: "w-cross", start: "12-15", end: "01-15" };
    expect(occurrences([rule], "2026-01-01", "2026-12-31")).toEqual([
      { start: "2025-12-15", end: "2026-01-15", ruleIds: ["w-cross"] },
      { start: "2026-12-15", end: "2027-01-15", ruleIds: ["w-cross"] },
    ]);
    expect(
      occurrences(
        [{ id: "w-leap", start: "02-01", end: "02-29" }],
        "2027-01-01",
        "2027-12-31",
      )[0].end,
    ).toBe("2027-02-28");
  });
});

describe("context and evidence", () => {
  test("the result validates and resolves only regions whose sourced boundary contains the field", () => {
    expect(() => rotationAssessmentSchema.parse(base)).not.toThrow();
    expect(base.context.regionIds).toEqual(["synthetic-plain"]);
    expect(base.context.regionsWithoutBoundary).toEqual(["synthetic-unmapped"]);
    expect(base.context.farmingSystem).toBe("irrigated");
    expect(base.context.horizonEnd).toBe("2029-10-20");
  });
  test("a field outside every boundary gets no schedule and no weather request", () => {
    const outside = rotationRequest({
      location: { latitude: 40, longitude: 2 },
    });
    const result = run(outside, rotationCatalog(), []);
    expect(result.outcome).toBe("insufficient_evidence");
    expect(result.candidates).toEqual([]);
    expect(result.crops.every((c) => c.status !== "schedulable")).toBe(true);
    expect(
      result.crops
        .find((c) => c.cropId === "synthetic-crop-01")
        .reasons.map((r) => r.code),
    ).toContain("REGION_UNRESOLVED");
    expect(
      rotationWeatherNeedsCore(
        outside,
        rotationCatalog(),
        rotationPolicy,
        assessedOn,
      ),
    ).toEqual([]);
  });
  test("unverified or reference rules never schedule; orchards are unsupported for planning", () => {
    const byId = Object.fromEntries(base.crops.map((c) => [c.cropId, c]));
    expect(byId["synthetic-unverified"].status).toBe("insufficient_evidence");
    expect(byId["synthetic-unverified"].reasons.map((r) => r.code)).toEqual(
      expect.arrayContaining([
        "RULE_REFERENCE_ONLY",
        "CALENDAR_EVIDENCE_UNAVAILABLE",
        "DURATION_EVIDENCE_UNAVAILABLE",
      ]),
    );
    expect(byId["synthetic-orchard"].status).toBe("unsupported_for_plan");
    const used = new Set(
      base.candidates.flatMap((c) => c.slots.map((s) => s.cropId)),
    );
    expect(used.has("synthetic-unverified")).toBe(false);
    expect(used.has("synthetic-orchard")).toBe(false);
  });
  test("the real 0.2.0 catalog has no resolvable region, so it returns insufficient evidence without weather", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.2.0");
    const request = rotationRequest({
      location: { latitude: 32.3373, longitude: -6.3498 },
      history: { status: "unknown" },
      preferences: {
        mode: "consider",
        considered_crop_ids: ["durum-wheat"],
        excluded_crop_ids: [],
        priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
      },
    });
    expect(
      rotationWeatherNeedsCore(request, real, rotationPolicy, assessedOn),
    ).toEqual([]);
    const result = assessRotations(
      request,
      real,
      [],
      rotationPolicy,
      assessedOn,
    );
    expect(result.outcome).toBe("insufficient_evidence");
    expect(result.synthetic).toBe(false);
    expect(result.choices).toEqual([
      {
        cropId: "durum-wheat",
        role: "considered",
        outcome: "not_schedulable",
        bestCandidateId: null,
        bestRank: null,
      },
    ]);
  });
  test("production entry points refuse synthetic catalogs and invalid dates", () => {
    expect(() =>
      assessRotations(
        rotationRequest(),
        rotationCatalog(),
        weather,
        rotationPolicy,
        assessedOn,
      ),
    ).toThrow();
    const early = rotationRequest({
      planning: {
        horizon_years: 3,
        earliest_start_date: "2026-10-01",
        latest_start_date: "2027-01-01",
      },
    });
    expect(() => run(early)).toThrow(RotationInputError);
  });
});

describe("scheduling and hard constraints", () => {
  test("every slot fits its window, the first range, the horizon and never overlaps the previous crop", () => {
    expect(base.outcome).toBe("comparisons_available");
    expect(base.candidates.length).toBeGreaterThan(10);
    const catalog = rotationCatalog();
    for (const c of base.candidates) {
      const first = c.slots[0];
      expect(
        first.sowEarliest >= "2026-10-20" && first.sowLatest <= "2027-03-31",
      ).toBe(true);
      c.slots.forEach((s, i) => {
        const profile = catalog.profiles.find((p) => p.id === s.cropId);
        const window = profile.rules.find(
          (r) => r.metric === "planting_window",
        );
        expect(inWindow(s.sowEarliest, window.start, window.end)).toBe(true);
        expect(inWindow(s.sowLatest, window.start, window.end)).toBe(true);
        expect(s.sowLatest >= s.sowEarliest).toBe(true);
        expect(s.harvestLatest <= base.context.horizonEnd).toBe(true);
        const next = c.slots[i + 1];
        if (next) {
          expect(
            next.sowEarliest >= addDays(s.sowEarliest, s.durationDays.max),
          ).toBe(true);
          expect(
            next.sowLatest >= addDays(s.sowLatest, s.durationDays.max),
          ).toBe(true);
        }
      });
    }
  });
  test("return intervals hold against history and within rotations; excluded crops never appear", () => {
    const request = rotationRequest({
      preferences: {
        mode: "suggest",
        considered_crop_ids: [],
        excluded_crop_ids: ["synthetic-crop-03"],
        priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
      },
    });
    const result = run(request);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.slots.some((s) => s.cropId === "synthetic-crop-03")).toBe(false);
      // synthetic-crop-02 was sown on 2025-11-05 and needs two years.
      for (const s of c.slots.filter((s) => s.cropId === "synthetic-crop-02"))
        expect(s.sowEarliest >= "2027-11-05").toBe(true);
    }
    expect(result.choices.find((c) => c.role === "excluded")).toMatchObject({
      cropId: "synthetic-crop-03",
      outcome: "excluded_as_requested",
    });
    expect(
      result.accounting.rejections.find(
        (r) => r.code === "RETURN_INTERVAL_VIOLATION",
      ).count,
    ).toBeGreaterThan(0);
  });
  test("a confirmed issue makes a hard break binding; an unconfirmed report only warns", () => {
    const report = (source, confirmation) =>
      rotationRequest({
        crop_health: {
          status: "reported",
          observations: [
            {
              crop_id: "synthetic-crop-02",
              issue: { issue_id: "synthetic-blight" },
              observed_on: "2026-04-01",
              source,
              confirmation,
            },
          ],
        },
        preferences: {
          mode: "consider",
          considered_crop_ids: ["synthetic-crop-08"],
          excluded_crop_ids: [],
          priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
        },
      });
    const confirmed = run(report("laboratory_report", "confirmed"));
    for (const c of confirmed.candidates)
      for (const s of c.slots.filter((s) => s.cropId === "synthetic-crop-02"))
        expect(s.sowEarliest >= "2028-05-19").toBe(true);
    const warned = run(report("farmer_report", "reported"));
    expect(warned.reasons.map((r) => r.code)).toContain(
      "HEALTH_REPORT_UNCONFIRMED",
    );
    const early = warned.candidates.filter((c) =>
      c.slots.some(
        (s) => s.cropId === "synthetic-crop-02" && s.sowEarliest < "2028-05-19",
      ),
    );
    for (const c of early) {
      expect(c.reasons.map((r) => r.code)).toContain("HEALTH_BREAK_VIOLATION");
      expect(c.scores.crop_health).toBeGreaterThan(0);
    }
  });
});

describe("one comparison", () => {
  test("weights follow priorities over compared dimensions; rank 1 has the lowest weighted loss", () => {
    expect(base.dimensions.every((d) => d.status === "compared")).toBe(true);
    expect(base.ranking.weights).toEqual({
      climate: 0.375,
      water: 0.25,
      soil_health: 0.25,
      crop_health: 0.125,
    });
    const min = Math.min(...base.candidates.map((c) => c.weightedLoss));
    expect(
      base.candidates
        .filter((c) => c.rank === 1)
        .every((c) => c.weightedLoss === min),
    ).toBe(true);
    for (const c of base.candidates) {
      const w = base.ranking.weights;
      const expected =
        w.climate * c.scores.climate.meanLoss +
        w.water * c.scores.water +
        w.soil_health * c.scores.soil_health +
        w.crop_health * c.scores.crop_health;
      expect(c.weightedLoss).toBeCloseTo(expected, 9);
      expect(c.scores.climate.completeAnalogs).toBeGreaterThanOrEqual(20);
      expect(c.scores.climate.worstDecileLoss).toBeGreaterThanOrEqual(
        c.scores.climate.meanLoss,
      );
    }
  });
  test("pareto members are not dominated and sensitivity views are reported", () => {
    const dims = (c) => [
      c.scores.climate.meanLoss,
      c.scores.water,
      c.scores.soil_health,
      c.scores.crop_health,
    ];
    for (const c of base.candidates.filter((c) => c.pareto))
      expect(
        base.candidates.some(
          (o) =>
            dims(o).every((x, i) => x <= dims(c)[i]) &&
            dims(o).some((x, i) => x < dims(c)[i]),
        ),
      ).toBe(false);
    const views = base.ranking.sensitivity.map((v) => v.view);
    expect(views).toEqual(
      expect.arrayContaining([
        "farmer_priorities",
        "only_climate",
        "only_water",
        "shift_climate_to_water",
      ]),
    );
    expect(typeof base.ranking.topStable).toBe("boolean");
  });
  test("a dimension missing for any candidate is disclosed and not scored", () => {
    const catalog = rotationCatalog();
    const crop = catalog.profiles.find((p) => p.id === "synthetic-crop-04");
    crop.rules = crop.rules.filter((r) => r.metric !== "water_demand_class");
    const result = run(rotationRequest(), catalog);
    const water = result.dimensions.find((d) => d.id === "water");
    if (
      result.candidates.some((c) =>
        c.slots.some((s) => s.cropId === "synthetic-crop-04"),
      )
    ) {
      expect(water).toMatchObject({ status: "not_compared", appliedWeight: 0 });
      expect(water.reason).toMatch(/water coefficient or demand class/);
      expect(
        Object.values(result.ranking.weights).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(1, 12);
    }
    const noWeather = run(rotationRequest(), rotationCatalog(), []);
    expect(noWeather.dimensions.find((d) => d.id === "climate").status).toBe(
      "not_compared",
    );
    expect(noWeather.reasons.map((r) => r.code)).toContain(
      "CLIMATE_ANALOGS_INSUFFICIENT",
    );
    expect(noWeather.candidates.every((c) => c.scores.climate === null)).toBe(
      true,
    );
  });
  test("every farmer-named crop is accounted for", () => {
    const request = rotationRequest({
      preferences: {
        mode: "consider",
        considered_crop_ids: [
          "synthetic-crop-01",
          "synthetic-orchard",
          "not-a-catalog-crop",
        ],
        excluded_crop_ids: ["synthetic-crop-05"],
        priorities: { climate: 1, water: 0, soil_health: 0, crop_health: 0 },
      },
    });
    const result = run(request);
    const outcome = Object.fromEntries(
      result.choices.map((c) => [`${c.role}:${c.cropId}`, c.outcome]),
    );
    expect(outcome).toEqual({
      "considered:not-a-catalog-crop": "not_in_catalog",
      "considered:synthetic-crop-01": "ranked",
      "considered:synthetic-orchard": "not_schedulable",
      "excluded:synthetic-crop-05": "excluded_as_requested",
      "history:synthetic-crop-02": "recorded",
    });
    const best = result.choices.find((c) => c.cropId === "synthetic-crop-01");
    expect(result.candidates.some((c) => c.id === best.bestCandidateId)).toBe(
      true,
    );
  });
});

describe("determinism, truncation and scale", () => {
  test("identical inputs in any order give identical results", () => {
    const request = rotationRequest({
      preferences: {
        mode: "consider",
        considered_crop_ids: ["synthetic-crop-07", "synthetic-crop-01"],
        excluded_crop_ids: [],
        priorities: { climate: 2, water: 1, soil_health: 1, crop_health: 1 },
      },
    });
    const shuffled = structuredClone(request);
    shuffled.preferences.considered_crop_ids.reverse();
    const a = run(request),
      b = run(shuffled);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  test("an exhausted search budget is reported, not a failed plan", () => {
    const result = run(rotationRequest(), rotationCatalog(), weather, {
      ...rotationPolicy,
      maxExpansions: 50,
    });
    expect(result.accounting.truncated).toBe(true);
    expect(result.reasons.map((r) => r.code)).toContain("SEARCH_TRUNCATED");
    expect(result.outcome).toBe("comparisons_available");
    const tiny = run(rotationRequest(), rotationCatalog(), weather, {
      ...rotationPolicy,
      maxClimateDayVisits: 1000,
    });
    expect(tiny.dimensions.find((d) => d.id === "climate").status).toBe(
      "not_compared",
    );
  });
  test("weather requests cover the analog period in chunks of at most 366 days", () => {
    const ranges = rotationWeatherNeedsCore(
      rotationRequest(),
      rotationCatalog(),
      rotationPolicy,
      assessedOn,
    );
    expect(ranges[0].start).toBe("1991-01-01");
    // Last anchor + horizon + one year + the longest crop, capped at the
    // newest allowed history (120 days before assessment).
    expect(ranges.at(-1).end).toBe("2025-08-18");
    const five = rotationWeatherNeedsCore(
      rotationRequest({
        planning: {
          horizon_years: 5,
          earliest_start_date: "2026-10-20",
          latest_start_date: "2027-03-31",
        },
      }),
      rotationCatalog(),
      rotationPolicy,
      assessedOn,
    );
    expect(five.at(-1).end).toBe(addDays(assessedOn, -120));
    for (const [i, r] of ranges.entries()) {
      expect(r.end >= r.start).toBe(true);
      expect(
        (Date.parse(r.end) - Date.parse(r.start)) / 86400000,
      ).toBeLessThanOrEqual(365);
      if (i) expect(r.start).toBe(addDays(ranges[i - 1].end, 1));
    }
  });
  test("benchmark: 12 crops, month-long windows, a 5-year horizon and 30 analog years", () => {
    const request = rotationRequest({
      planning: {
        horizon_years: 5,
        earliest_start_date: "2026-10-20",
        latest_start_date: "2027-03-31",
      },
    });
    const started = performance.now();
    const result = run(request);
    const seconds = (performance.now() - started) / 1000;
    const bytes = Buffer.byteLength(JSON.stringify(result));
    console.log(
      JSON.stringify({
        benchmark: "rotation-5y-12-crops",
        seconds: Number(seconds.toFixed(2)),
        bytes,
        compared: result.accounting.compared,
        pruned: result.accounting.pruned,
      }),
    );
    expect(result.outcome).toBe("comparisons_available");
    expect(result.accounting.schedulableCrops).toBe(12);
    expect(result.accounting.truncated).toBe(false);
    expect(result.accounting.compared).toBeGreaterThan(100);
    expect(
      result.candidates.every(
        (c) => c.scores.climate && c.scores.climate.completeAnalogs >= 20,
      ),
    ).toBe(true);
    expect(bytes).toBeLessThan(2097152);
    expect(seconds).toBeLessThan(60);
  });
});

describe("calendar helper, catalog format 2 and request format 2", () => {
  test("cached day arithmetic matches Temporal across leap and century years", async () => {
    const days = await import("../../packages/domain/dist/rotation/days.js");
    const temporal =
      await import("../../packages/domain/dist/calendar/dates.js");
    for (let n = 0; n < 2000; n++) {
      const date = temporal.addDays("1899-12-25", n * 37);
      expect(days.plusDays(date, 401)).toBe(temporal.addDays(date, 401));
      expect(days.daysBetween("1900-01-01", date)).toBe(
        temporal.elapsedDays("1900-01-01", date),
      );
      for (const years of [1, 3, -2]) {
        let expected;
        try {
          expected = temporal.shiftCalendarYears(date, years);
        } catch {
          expected = "RangeError";
        }
        let actual;
        try {
          actual = days.shiftYears(date, years);
        } catch {
          actual = "RangeError";
        }
        expect(actual).toBe(expected);
        expect(days.anniversary(date, Math.abs(years))).toBe(
          temporal.conservativeAnniversary(date, Math.abs(years)),
        );
      }
    }
  });
  test("release 0.2.0 holds exactly the facts of 0.1.0 in format 2", async () => {
    const v1 = await loadCatalogRelease("data/catalog/releases/0.1.0");
    const v2 = await loadCatalogRelease("data/catalog/releases/0.2.0");
    expect(v2.schemaVersion).toBe("2");
    expect(v2.profiles.map((p) => p.id)).toEqual(v1.profiles.map((p) => p.id));
    for (const source of v1.sources) {
      const converted = v2.sources.find((s) => s.id === source.id);
      const { kind, rights, ...rest } = converted;
      expect(rest).toEqual(source);
      expect(kind).toMatch(
        /^(official_guide|official_communication|taxonomy)$/,
      );
      expect(rights.reuse).toBe("unknown");
    }
    for (const p1 of v1.profiles) {
      const p2 = v2.profiles.find((p) => p.id === p1.id);
      expect(p2.identity.citations).toEqual(p1.identity.citations);
      expect(p2.applicability).toEqual(p1.applicability);
      const rules1 = Object.values(p1.knowledge).flatMap((k) =>
        k && k.status === "sourced" ? k.rules : [],
      );
      expect(p2.rules.map((r) => r.id).sort()).toEqual(
        rules1.map((r) => r.id).sort(),
      );
      for (const r1 of rules1) {
        const r2 = p2.rules.find((r) => r.id === r1.id);
        expect(r2.citations).toEqual(r1.citations);
        expect(r2.severity).toBe(r1.severity);
        expect(r2.verification).toEqual({ status: "extracted" });
        expect(r2.scope.regionIds).toEqual(r1.evidenceRegionIds);
        expect(r2.conditions).toBe(r1.conditions);
        const numbers = (r) =>
          JSON.stringify(
            Object.values(r)
              .filter((v) => typeof v === "number")
              .sort(),
          );
        expect(numbers(r2)).toBe(numbers(r1));
      }
      const unknown = Object.values(p1.knowledge)
        .filter((k) => k && k.status === "unknown")
        .map((k) => k.reason);
      for (const reason of unknown)
        expect(p2.gaps.map((g) => g.reason)).toContain(reason);
    }
  });
  test("format 2 rejects unverified binding rules, untimed hard stages, unknown scopes and open rings", async () => {
    const { validateCatalogV2Structure } =
      await import("../../packages/catalog/dist/index.js");
    const mutate = (change) => {
      const catalog = rotationCatalog();
      change(catalog);
      return () => validateCatalogV2Structure(catalog);
    };
    expect(mutate(() => {})).not.toThrow();
    expect(
      mutate(
        (c) => (c.profiles[0].rules[0].verification = { status: "extracted" }),
      ),
    ).toThrow();
    expect(
      mutate((c) =>
        Object.assign(c.profiles[0].rules[2], {
          severity: "hard",
          stage: "flowering",
          stageWindow: null,
        }),
      ),
    ).toThrow();
    expect(
      mutate(
        (c) =>
          (c.profiles[0].rules[0].scope.cultivarIds = ["missing-cultivar"]),
      ),
    ).toThrow();
    expect(
      mutate(
        (c) => (c.profiles[0].rules[0].scope.regionIds = ["missing-region"]),
      ),
    ).toThrow();
    expect(
      mutate((c) => c.regions[0].boundary.geometry.coordinates[0].pop()),
    ).toThrow();
    expect(
      mutate((c) => (c.profiles[1].rules[1].id = c.profiles[0].rules[1].id)),
    ).toThrow();
    expect(mutate((c) => (c.profiles[0].rules[3].severity = "hard"))).toThrow();
  });
  test("request format 2 enforces horizons, priorities, choices and honest health reports", async () => {
    const { planRequestV2Schema } =
      await import("../../packages/contracts/dist/index.js");
    const ok = (r) => planRequestV2Schema.safeParse(r).success;
    expect(ok(rotationRequest())).toBe(true);
    expect(
      ok(
        rotationRequest({
          planning: {
            horizon_years: 6,
            earliest_start_date: "2026-10-20",
            latest_start_date: "2027-01-01",
          },
        }),
      ),
    ).toBe(false);
    expect(
      ok(
        rotationRequest({
          planning: {
            horizon_years: 3,
            earliest_start_date: "2026-10-20",
            latest_start_date: "2028-01-01",
          },
        }),
      ),
    ).toBe(false);
    const prefs = rotationRequest().preferences;
    expect(
      ok(
        rotationRequest({
          preferences: {
            ...prefs,
            priorities: {
              climate: 0,
              water: 0,
              soil_health: 0,
              crop_health: 0,
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      ok(
        rotationRequest({
          preferences: { ...prefs, excluded_crop_ids: ["synthetic-crop-01"] },
        }),
      ),
    ).toBe(false);
    expect(
      ok(rotationRequest({ preferences: { ...prefs, mode: "suggest" } })),
    ).toBe(false);
    expect(
      ok(
        rotationRequest({
          crop_health: {
            status: "reported",
            observations: [
              {
                crop_id: "synthetic-crop-02",
                issue: { issue_id: "synthetic-blight" },
                observed_on: "2026-04-01",
                source: "farmer_report",
                confirmation: "confirmed",
              },
            ],
          },
        }),
      ),
    ).toBe(false);
    expect(
      ok(
        rotationRequest({
          cultivars: [
            { crop_id: "a-crop", cultivar_id: "x-one" },
            { crop_id: "a-crop", cultivar_id: "x-two" },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe("real catalog 0.3.0", () => {
  // Real sourced rules with invented weather (allowed only in tests): shows
  // the engine path the production workflow takes with recorded POWER data.
  test("a Tadla field gets compared rotations of the five plannable crops", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.3.0");
    const request = rotationRequest({
      history: {
        status: "known",
        completeness: "complete",
        entries: [
          {
            crop_id: "durum-wheat",
            planted_on: "2025-11-20",
            harvested_on: "2026-06-05",
          },
        ],
      },
      preferences: {
        mode: "consider",
        considered_crop_ids: ["faba-bean", "sugar-beet"],
        excluded_crop_ids: [],
        priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
      },
    });
    const result = run(request, real);
    expect(() => rotationAssessmentSchema.parse(result)).not.toThrow();
    expect(result.outcome).toBe("comparisons_available");
    expect(result.context.regionIds).toEqual([
      "beni-mellal-tadla",
      "morocco-general",
    ]);
    expect(result.accounting.schedulableCrops).toBe(5);
    const status = Object.fromEntries(
      result.crops.map((c) => [c.cropId, c.status]),
    );
    expect(status).toMatchObject({
      "durum-wheat": "schedulable",
      "bread-wheat": "schedulable",
      barley: "schedulable",
      "faba-bean": "schedulable",
      "sugar-beet": "schedulable",
      lentil: "insufficient_evidence",
      chickpea: "insufficient_evidence",
      maize: "insufficient_evidence",
    });
    // Every slot respects its sourced sowing window and duration.
    const windows = {
      "durum-wheat": ["11-01", "12-15"],
      "bread-wheat": ["11-01", "12-15"],
      barley: ["11-01", "12-15"],
      "faba-bean": ["10-15", "12-31"],
      "sugar-beet": ["09-01", "11-15"],
    };
    for (const c of result.candidates)
      for (const s of c.slots) {
        const [start, end] = windows[s.cropId];
        expect(
          monthDay(s.sowEarliest) >= start && monthDay(s.sowLatest) <= end,
        ).toBe(true);
      }
    // A legume follows the reported durum wheat in the best rotation, as the
    // cited guidance prefers, and the flowering rules enter the comparison.
    expect(result.candidates[0].slots[0].cropId).toBe("faba-bean");
    expect(JSON.stringify(result)).toContain("durum-flowering-heat");
  });
});

describe("real catalog 0.4.0", () => {
  test("a field outside Tadla gets national crops; sugar beet stays with its regional sheet", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.4.0");
    // The synthetic weather fixture sits at 32.3, -6.3, so the Tadla outline
    // is moved away from that point instead of moving the field.
    const noTadla = {
      ...real,
      regions: real.regions.map((r) =>
        r.id === "beni-mellal-tadla"
          ? {
              ...r,
              boundary: {
                ...r.boundary,
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [-7, 33],
                      [-6.9, 33],
                      [-6.9, 33.1],
                      [-7, 33],
                    ],
                  ],
                },
              },
            }
          : r,
      ),
    };
    const result = run(
      rotationRequest({
        history: { status: "unknown" },
        preferences: {
          mode: "consider",
          considered_crop_ids: ["faba-bean", "sugar-beet"],
          excluded_crop_ids: [],
          priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        },
      }),
      noTadla,
    );
    expect(result.outcome).toBe("comparisons_available");
    const status = Object.fromEntries(
      result.crops.map((c) => [c.cropId, c.status]),
    );
    expect(status).toMatchObject({
      "durum-wheat": "schedulable",
      "bread-wheat": "schedulable",
      barley: "schedulable",
      "faba-bean": "schedulable",
      "sugar-beet": "insufficient_evidence",
    });
  });
});

describe("FAO-56 water balance", () => {
  test("future worlds compare water on each model's own rain", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.5.0");
    const request = rotationRequest({
      history: { status: "unknown" },
      preferences: {
        mode: "consider",
        considered_crop_ids: ["faba-bean"],
        excluded_crop_ids: [],
        priorities: { climate: 1, water: 3, soil_health: 1, crop_health: 1 },
      },
    });
    const needs = rotationScenarioNeedsCore(
      request,
      real,
      rotationPolicy,
      assessedOn,
    );
    expect(new Set(needs.units.map((u) => u.variable)).has("pr")).toBe(true);
    const result = assessRotationsCore(
      request,
      real,
      weather,
      rotationPolicy,
      assessedOn,
      true,
      syntheticScenarioSeries(needs),
    );
    expect(() => rotationAssessmentSchema.parse(result)).not.toThrow();
    expect(result.futureClimate.status).toBe("compared");
    const scenario = result.candidates[0].future.scenarios.find(
      (x) => x.experiment === "ssp585",
    );
    const model = scenario.models[0];
    expect(model.futureRainMm).toBeLessThan(model.baselineRainMm);
    expect(model.waterChange).toBeGreaterThan(0);
    expect(scenario.meanWaterChange).toBeGreaterThan(0);
  });
  test("extraterrestrial radiation reproduces FAO-56 example 8", () => {
    // 20°S on 3 September (day 246): FAO gives 32.2 MJ/m²/day, 13.1 mm/day.
    expect(extraterrestrialRadiationMm(-20, 246)).toBeCloseTo(13.1, 1);
  });
  test("reference evapotranspiration follows Hargreaves and never goes negative", () => {
    const ra = extraterrestrialRadiationMm(32, 180);
    expect(referenceEvapotranspirationMm(35, 19, 32, 180)).toBeCloseTo(
      0.0023 * (27 + 17.8) * 4 * ra,
      6,
    );
    expect(referenceEvapotranspirationMm(5, 10, 32, 1)).toBe(0);
    expect(referenceEvapotranspirationMm(-30, -40, 32, 1)).toBe(0);
  });
  test("the crop curve follows FAO's four stages", () => {
    const curve = {
      kcIni: 0.5,
      kcMid: 1.15,
      kcEnd: 0.3,
      stageLengths: [25, 25, 25, 25],
    };
    expect(cropCoefficient(curve, 0.1)).toBe(0.5);
    expect(cropCoefficient(curve, 0.375)).toBeCloseTo(0.825, 6);
    expect(cropCoefficient(curve, 0.6)).toBe(1.15);
    expect(cropCoefficient(curve, 1)).toBeCloseTo(0.3, 6);
  });
  const dryRequest = rotationRequest({
    history: { status: "unknown" },
    water: { status: "reported", availability: "rainfed", allocation: null },
    preferences: {
      mode: "consider",
      considered_crop_ids: ["faba-bean"],
      excluded_crop_ids: [],
      priorities: { climate: 1, water: 3, soil_health: 1, crop_health: 1 },
    },
  });
  const withRain = (mm) =>
    rotationWeather().map((e) => {
      const snapshot = structuredClone(e.snapshot);
      for (const d of snapshot.days) d.values.precipitation = mm;
      return {
        ...e,
        snapshot,
        normalizedSha256: normalizedWeatherHash(snapshot),
      };
    });
  test("water is compared, responds to rain and warns rainfed arid cereals", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.5.0");
    const assess = (mm) =>
      assessRotationsCore(
        dryRequest,
        real,
        withRain(mm),
        rotationPolicy,
        assessedOn,
        true,
      );
    const dry = assess(0.1);
    const wet = assess(3);
    expect(() => rotationAssessmentSchema.parse(dry)).not.toThrow();
    expect(dry.dimensions.find((d) => d.id === "water").status).toBe(
      "compared",
    );
    expect(dry.candidates[0].waterBalance.meanAnnualRainMm).toBeCloseTo(
      36.5,
      0,
    );
    expect(dry.candidates[0].waterBalance.meanLoss).toBeGreaterThan(
      wet.candidates[0].waterBalance.meanLoss,
    );
    const arid = (r) =>
      r.reasons
        .filter((x) => x.code === "RAINFED_ARID_RISK")
        .map((x) => x.cropId);
    expect(arid(dry).sort()).toEqual(["barley", "bread-wheat", "durum-wheat"]);
    expect(arid(wet)).toEqual([]);
  });
});

describe("soil health score", () => {
  test("an uncheckable change is left out, neither helping nor harming", () => {
    expect(soilLoss({ matched: 2, neutral: 0, transitions: 2 })).toBe(0);
    expect(soilLoss({ matched: 0, neutral: 0, transitions: 2 })).toBe(1);
    expect(soilLoss({ matched: 1, neutral: 1, transitions: 2 })).toBe(0);
    expect(soilLoss({ matched: 0, neutral: 1, transitions: 2 })).toBe(1);
    expect(soilLoss({ matched: 0, neutral: 2, transitions: 2 })).toBe(null);
  });
});

describe("real catalog 0.8.0", () => {
  const assess = async (availability) =>
    run(
      rotationRequest({
        history: { status: "unknown" },
        water: { status: "reported", availability, allocation: null },
        preferences: {
          mode: "suggest",
          considered_crop_ids: [],
          excluded_crop_ids: [],
          priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
        },
      }),
      await loadCatalogRelease("data/catalog/releases/0.8.0"),
    );
  const used = (r) =>
    new Set(r.candidates.flatMap((c) => c.slots.map((s) => s.cropId)));
  test("rainfed fields are not offered irrigated vegetables", async () => {
    const r = await assess("rainfed");
    expect(() => rotationAssessmentSchema.parse(r)).not.toThrow();
    for (const crop of ["courgette", "tomato", "potato", "lettuce"])
      expect(used(r).has(crop)).toBe(false);
  });
  test("a crop with no temperature limit is plannable; climate is reported but not ranked", async () => {
    const r = await assess("irrigation_available");
    const climate = r.dimensions.find((d) => d.id === "climate");
    expect(climate.status).toBe("not_compared");
    expect(climate.appliedWeight).toBe(0);
    expect(r.candidates.every((c) => c.scores.climate !== null)).toBe(true);
    expect(r.reasons.map((x) => x.code)).toContain("CLIMATE_CHECKS_DIFFER");
    const lettuce = r.crops.find((c) => c.cropId === "lettuce");
    expect(lettuce.status).toBe("schedulable");
    expect(lettuce.reasons.map((x) => x.code)).toContain(
      "TEMPERATURE_EVIDENCE_UNAVAILABLE",
    );
  });
});

test("catalog 0.9.0 lists trees but never rotates them", async () => {
  const r = run(
    rotationRequest({
      history: { status: "unknown" },
      preferences: {
        mode: "suggest",
        considered_crop_ids: [],
        excluded_crop_ids: [],
        priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
      },
    }),
    await loadCatalogRelease("data/catalog/releases/0.9.0"),
  );
  expect(r.crops.find((c) => c.cropId === "olive").status).toBe(
    "unsupported_for_plan",
  );
  expect(
    r.candidates.flatMap((c) => c.slots).some((s) => s.cropId === "olive"),
  ).toBe(false);
  expect(r.crops.find((c) => c.cropId === "maize").status).toBe("schedulable");
});

describe("fair ranking (engine 6)", () => {
  const assess = async (kept) => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.9.0");
    return run(
      rotationRequest({
        history: {
          status: "known",
          completeness: "complete",
          entries: [
            {
              crop_id: "durum-wheat",
              planted_on: "2025-11-20",
              harvested_on: "2026-06-05",
            },
          ],
        },
        preferences: {
          mode: "suggest",
          considered_crop_ids: [],
          excluded_crop_ids: catalog.profiles
            .map((p) => p.id)
            .filter((id) => !kept.includes(id)),
          priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        },
      }),
      catalog,
    );
  };
  const dimension = (r, id) => r.dimensions.find((d) => d.id === id);
  const codes = (r) => r.reasons.map((x) => x.code);
  test("crops checked the same way are ranked on climate and soil", async () => {
    const r = await assess(["barley", "bread-wheat", "durum-wheat"]);
    expect(r.outcome).toBe("comparisons_available");
    expect(r.engineVersion).toBe("rotation-engine-6");
    expect(dimension(r, "climate").status).toBe("compared");
    expect(dimension(r, "soil_health").status).toBe("compared");
    expect(codes(r)).not.toContain("CLIMATE_CHECKS_DIFFER");
    expect(codes(r)).not.toContain("SOIL_PREFERENCES_UNEVEN");
  });
  test("a frost-only crop beside cereals is compared on cold checks only", async () => {
    const r = await assess(["barley", "bread-wheat", "faba-bean"]);
    expect(() => rotationAssessmentSchema.parse(r)).not.toThrow();
    // Cereals have heat and cold checks; faba bean only a cold one. Climate is
    // compared on the cold check all three share, and the heat checks are
    // left out and listed, so faba bean gains nothing from its missing one.
    expect(dimension(r, "climate").status).toBe("compared");
    const differ = r.reasons.find((x) => x.code === "CLIMATE_CHECKS_DIFFER");
    expect(differ.facts.comparedChecks).toBe("daily_minimum|air|lower|");
    expect(differ.facts.leftOutRules).toBe(
      "barley-flowering-heat,bread-flowering-heat",
    );
    expect(differ.facts.uncheckedCrops).toBe("");
    // Every crop here has a sourced preferred predecessor, so soil ranks.
    expect(dimension(r, "soil_health").status).toBe("compared");
  });
  test("a crop with no temperature check leaves climate reported but not ranked", async () => {
    const r = await assess(["barley", "faba-bean", "lentil"]);
    const climate = dimension(r, "climate");
    expect(climate.status).toBe("not_compared");
    expect(climate.appliedWeight).toBe(0);
    expect(r.ranking.weights.climate).toBe(0);
    expect(climate.reason).toMatch(/No kind of temperature check is shared/);
    expect(r.candidates.every((c) => c.scores.climate !== null)).toBe(true);
    expect(r.ranking.sensitivity.map((v) => v.view)).not.toContain(
      "only_climate",
    );
  });
  test("a change into a crop with no sourced predecessor is left out of soil", async () => {
    const r = await assess(["barley", "faba-bean", "lentil"]);
    expect(dimension(r, "soil_health").status).toBe("compared");
    // Faba bean and lentil both follow the reported durum wheat; the same
    // rotation with either legume first gets the same soil score, because
    // only faba bean's preference is sourced and lentil's change is left out.
    const soil = (first) =>
      r.candidates.find(
        (c) =>
          c.slots.map((s) => s.cropId).join(">") ===
          `${first}>barley>faba-bean`,
      )?.scores.soil_health;
    expect(soil("faba-bean")).toBeDefined();
    expect(soil("faba-bean")).toBe(soil("lentil"));
    // Barley straight after durum wheat breaks barley's sourced preference.
    expect(
      r.candidates.find(
        (c) =>
          c.slots.map((s) => s.cropId).join(">") === "barley>faba-bean>barley",
      )?.scores.soil_health,
    ).toBeGreaterThan(0);
    const uneven = r.reasons.find((x) => x.code === "SOIL_PREFERENCES_UNEVEN");
    expect(uneven.facts.cropsWithoutPreference).toBe("lentil");
    expect(
      r.reasons.find((x) => x.code === "CLIMATE_CHECKS_DIFFER").facts
        .uncheckedCrops,
    ).toBe("lentil");
    // Ranks follow the applied weights only.
    const losses = r.candidates.map((c) => c.weightedLoss);
    expect(losses).toEqual([...losses].sort((a, b) => a - b));
  });
});

describe("catalog 0.10.0 treats recalled rules like any other rule", () => {
  const assess = async (kept) => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.10.0");
    return run(
      rotationRequest({
        history: { status: "unknown" },
        preferences: {
          mode: kept ? "consider" : "suggest",
          considered_crop_ids: kept ?? [],
          excluded_crop_ids: [],
          priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        },
      }),
      catalog,
    );
  };
  test("crops known only from recall are scheduled, compared and counted", async () => {
    const r = await assess(["oat", "sesame", "strawberry", "durum-wheat"]);
    for (const id of ["oat", "sesame", "strawberry"])
      expect(r.crops.find((c) => c.cropId === id).status).toBe("schedulable");
    expect(r.evidence.rulesUsed.model_recall).toBeGreaterThan(0);
    expect(r.evidence.expertReviewed).toBe(false);
    expect(r.reasons.map((x) => x.code)).toContain("NOT_EXPERT_REVIEWED");
    // Heat and cold are checks every one of these crops has, so climate is compared.
    expect(r.reasons.map((x) => x.code)).not.toContain(
      "NO_SHARED_CLIMATE_CHECK",
    );
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(rotationAssessmentSchema.safeParse(r).success).toBe(true);
  });
  test("trees and wild plants stay out of every rotation", async () => {
    const r = await assess(["olive", "esparto", "oat", "faba-bean"]);
    expect(r.crops.find((c) => c.cropId === "olive").status).toBe(
      "unsupported_for_plan",
    );
    expect(r.crops.find((c) => c.cropId === "esparto").status).toBe(
      "unsupported_for_plan",
    );
    expect(
      r.candidates
        .flatMap((c) => c.slots)
        .some((s) => ["olive", "esparto"].includes(s.cropId)),
    ).toBe(false);
  });
  test("suggesting from the whole catalog stays within the search bounds", async () => {
    const started = Date.now();
    const r = await assess(null);
    console.log(
      JSON.stringify({
        wholeCatalogSuggest: true,
        seconds: (Date.now() - started) / 1000,
        schedulable: r.crops.filter((c) => c.status === "schedulable").length,
      }),
    );
    expect(
      r.crops.filter((c) => c.status === "schedulable").length,
    ).toBeGreaterThan(100);
    expect(r.candidates.length).toBeGreaterThan(0);
  });
  test("results for release 0.9.0 are unchanged: no recall count appears", async () => {
    const r = run(
      rotationRequest({ history: { status: "unknown" } }),
      await loadCatalogRelease("data/catalog/releases/0.9.0"),
    );
    expect("model_recall" in r.evidence.rulesUsed).toBe(false);
  });
});

describe("catalog 0.11.0 adds crops and classes without changing how rules are used", () => {
  const assess = async (kept) => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.11.0");
    return run(
      rotationRequest({
        history: { status: "unknown" },
        preferences: {
          mode: "consider",
          considered_crop_ids: kept,
          excluded_crop_ids: [],
          priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        },
      }),
      catalog,
    );
  };
  test("further crops are scheduled and compared like the others", async () => {
    const r = await assess(["spelt", "hairy-vetch", "sainfoin", "durum-wheat"]);
    for (const id of ["spelt", "hairy-vetch", "sainfoin"])
      expect(r.crops.find((c) => c.cropId === id).status).toBe("schedulable");
    expect(r.evidence.rulesUsed.model_recall).toBeGreaterThan(0);
    expect(r.reasons.map((x) => x.code)).not.toContain(
      "NO_SHARED_CLIMATE_CHECK",
    );
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(rotationAssessmentSchema.safeParse(r).success).toBe(true);
  });
  test("new trees and forest plants stay out of every rotation", async () => {
    const r = await assess(["cork-oak", "eucalyptus", "oat", "faba-bean"]);
    for (const id of ["cork-oak", "eucalyptus"])
      expect(r.crops.find((c) => c.cropId === id).status).toBe(
        "unsupported_for_plan",
      );
    expect(
      r.candidates
        .flatMap((c) => c.slots)
        .some((s) => ["cork-oak", "eucalyptus"].includes(s.cropId)),
    ).toBe(false);
  });
});

describe("catalog 0.11.0 speed: results are identical to the unoptimized engine", () => {
  // Hashes of the whole assessment, recorded from the engine before the climate
  // caches, the one-pass pruning and the memoized window lookups were added
  // (tooling/performance/rotation-profile.mjs, 2026-11-09). Any difference in
  // any result field changes them.
  const golden = {
    suggest: "0aaa1d5b5fbebb64ebe0dca82ed32e055b62f7295bd58cf1359960f75e955587",
    four: "1c9dea34e28409c8f478a3469d8a466ea0dea4362da4df3b5eb4720c05c86e3d",
    exhausted:
      "349892d74a01f7812c55155762d0327edd2385bcb795ef31ac96967763d3b346",
    futures: "04a37222fec191334f50b73d3b2ae30883444c94baf04eddef55b79821dd7780",
  };
  const priorities = { climate: 3, water: 2, soil_health: 2, crop_health: 1 };
  const requestFor = (prefs, extra = {}) =>
    rotationRequest({
      history: { status: "unknown" },
      preferences: { ...prefs, excluded_crop_ids: [], priorities },
      ...extra,
    });
  const four = ["spelt", "hairy-vetch", "sainfoin", "durum-wheat"];
  const hash = (v) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const assess = (catalog, request, policy = rotationPolicy, ...rest) =>
    assessRotationsCore(
      request,
      catalog,
      weather,
      policy,
      assessedOn,
      true,
      ...rest,
    );
  const deepFreeze = (value) => {
    if (typeof value !== "object" || value === null) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  };
  test("suggesting from all 246 crops matches the recorded result and stays fast", async () => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.11.0");
    const started = Date.now();
    const r = assess(
      catalog,
      requestFor({ mode: "suggest", considered_crop_ids: [] }),
    );
    const seconds = (Date.now() - started) / 1000;
    expect(hash(r)).toBe(golden.suggest);
    // The unoptimized engine took 16 to 39 s; the bound is generous for a
    // slow, loaded runner and catches a return to that cost.
    expect(seconds).toBeLessThan(25);
  });
  test("a frozen shared catalog gives the recorded result for named crops", async () => {
    const catalog = deepFreeze(
      structuredClone(await loadCatalogRelease("data/catalog/releases/0.11.0")),
    );
    const r = assess(
      catalog,
      requestFor({ mode: "consider", considered_crop_ids: four }),
    );
    expect(hash(r)).toBe(golden.four);
  });
  test("an exhausted climate budget still disables climate exactly as before", async () => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.11.0");
    const r = assess(
      catalog,
      requestFor({ mode: "consider", considered_crop_ids: four }),
      { ...rotationPolicy, maxClimateDayVisits: 300000 },
    );
    expect(hash(r)).toBe(golden.exhausted);
  });
  test("engine 7 with a declared rotation and future climate matches the recorded result", async () => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.11.0");
    const request = requestFor(
      {
        mode: "consider",
        considered_crop_ids: ["barley", "lentil", "durum-wheat", "faba-bean"],
      },
      { current_rotation: { crop_ids: ["durum-wheat", "faba-bean"] } },
    );
    const series = syntheticScenarioSeries(
      rotationScenarioNeedsCore(request, catalog, rotationPolicy, assessedOn),
    );
    const r = assess(
      catalog,
      request,
      rotationPolicy,
      series,
      null,
      null,
      "rotation-engine-7",
    );
    expect(hash(r)).toBe(golden.futures);
  });
});

describe("engine 7: current rotation, alternatives and strategies", () => {
  const run7 = (request, catalog = rotationCatalog()) =>
    assessRotationsCore(
      request,
      catalog,
      weather,
      rotationPolicy,
      assessedOn,
      true,
      null,
      null,
      null,
      "rotation-engine-7",
    );
  const declared = (cropIds, extra = {}) =>
    rotationRequest({ current_rotation: { crop_ids: cropIds }, ...extra });
  const items = (r) => r.strategies.items;

  test("engine 6 results are unchanged: no strategies, same version", () => {
    expect(base.engineVersion).toBe("rotation-engine-6");
    expect("strategies" in base).toBe(false);
  });

  test("a declared rotation is scored beside at least two alternatives and the result parses", () => {
    const r = run7(declared(["synthetic-crop-01", "synthetic-crop-04"]));
    expect(rotationAssessmentSchema.parse(r)).toEqual(r);
    expect(r.engineVersion).toBe("rotation-engine-7");
    const s = r.strategies;
    expect(s.status).toBe("complete");
    expect(s.baseline).toMatchObject({
      status: "scored",
      source: "farmer_declared",
      cropIds: ["synthetic-crop-01", "synthetic-crop-04"],
    });
    const [current, ...alternatives] = items(r);
    expect(current).toMatchObject({ id: "current", role: "current" });
    expect(current.versusCurrent).toBeNull();
    expect(alternatives.length).toBeGreaterThanOrEqual(2);
    expect(s.alternativesFound).toBe(alternatives.length);
    const keys = items(r).map((x) => x.cropIds.join(">"));
    expect(new Set(keys).size).toBe(keys.length);
    // Each strategy is a real candidate in the result, scored once.
    for (const item of items(r)) {
      const c = r.candidates.find((x) => x.id === item.candidateId);
      expect(c).toBeDefined();
      expect(item.rank).toBe(c.rank);
      expect(item.weightedLoss).toBe(c.weightedLoss);
      expect(item.scores).toEqual(c.scores);
    }
    for (const alt of alternatives)
      expect(alt.versusCurrent.weightedLoss).toBeCloseTo(
        alt.weightedLoss - current.weightedLoss,
        3,
      );
  });

  test("every strategy explains why, evidence, gaps and risks with keyed notes", () => {
    const r = run7(declared(["synthetic-crop-01", "synthetic-crop-04"]));
    for (const item of items(r)) {
      const kinds = new Set(item.notes.map((n) => n.kind));
      for (const kind of ["why", "evidence", "gap", "risk"])
        expect(kinds.has(kind)).toBe(true);
      for (const n of item.notes) {
        expect(n.code).toMatch(/^[A-Z][A-Z0-9_]+$/);
        expect(n.text.length).toBeGreaterThan(10);
      }
      const codes = item.notes.map((n) => n.code);
      expect(codes).toContain("EVIDENCE_RULE_SOURCES");
      expect(codes).toContain("GAP_NO_MARKET_DATA");
      expect(codes).toContain("GAP_EROSION_NOT_ASSESSED");
      expect(codes).toContain("RISK_LOCAL_REVIEW");
      expect(codes).toContain("EVIDENCE_BARE_FIELD_SHARE");
      const sources = item.notes.find(
        (n) => n.code === "EVIDENCE_RULE_SOURCES",
      );
      expect(sources.facts.sourced + sources.facts.model_recall).toBe(
        item.evidence.extracted +
          item.evidence.double_checked +
          item.evidence.expert_reviewed +
          item.evidence.model_recall,
      );
    }
    const alternatives = items(r).filter((x) => x.role === "alternative");
    for (const alt of alternatives)
      expect(
        alt.notes.some(
          (n) =>
            n.code === "WHY_LOWER_LOSS_THAN_CURRENT" ||
            n.code === "WHY_NOT_BETTER_THAN_CURRENT",
        ),
      ).toBe(true);
    expect(r.strategies.reminders.map((x) => x.code)).toEqual(
      expect.arrayContaining([
        "REMINDER_SUPPORTS_NOT_REPLACES",
        "REMINDER_LOCAL_REVIEW",
        "REMINDER_RULES_NOT_EXPERT_REVIEWED",
      ]),
    );
  });

  test("the current rotation gets exactly the score the same rotation gets in the search", () => {
    const top = base.candidates[0];
    const r = run7(declared(top.slots.map((s) => s.cropId)));
    const current = items(r).find((x) => x.role === "current");
    expect(current.candidateId).toBe(top.id);
    expect(current.scores).toEqual(top.scores);
    expect(current.weightedLoss).toBe(
      r.candidates.find((c) => c.id === top.id).weightedLoss,
    );
  });

  test("a crop the catalog cannot schedule leaves the baseline unavailable but keeps alternatives", () => {
    const r = run7(declared(["not-a-real-crop"]));
    expect(r.strategies.status).toBe("baseline_unavailable");
    expect(r.strategies.baseline).toMatchObject({
      status: "not_evaluable",
      source: "farmer_declared",
    });
    expect(r.strategies.baseline.notes.map((n) => n.code)).toContain(
      "BASELINE_CROP_NOT_SCHEDULABLE",
    );
    expect(items(r).some((x) => x.role === "current")).toBe(false);
    expect(r.strategies.alternativesFound).toBeGreaterThanOrEqual(2);
  });

  test("no declared rotation falls back to dated history, flagged as a guess, or to nothing", () => {
    const inferred = run7(
      rotationRequest({
        history: {
          status: "known",
          completeness: "complete",
          entries: [
            {
              crop_id: "synthetic-crop-01",
              planted_on: "2025-10-10",
              harvested_on: "2026-05-20",
            },
          ],
        },
      }),
    );
    expect(inferred.strategies.baseline).toMatchObject({
      source: "inferred_from_history",
      status: "scored",
      cropIds: ["synthetic-crop-01"],
    });
    expect(inferred.strategies.baseline.notes.map((n) => n.code)).toContain(
      "BASELINE_INFERRED_FROM_HISTORY",
    );
    expect(items(inferred)[0].source).toBe("inferred_from_history");
    const none = run7(rotationRequest({ history: { status: "unknown" } }));
    expect(none.strategies.baseline).toMatchObject({
      source: "none",
      status: "not_provided",
    });
    expect(none.strategies.status).toBe("baseline_unavailable");
    expect(none.strategies.baseline.notes.map((n) => n.code)).toContain(
      "BASELINE_NOT_PROVIDED",
    );
  });

  test("a declared rotation that breaks a hard rule is reported with the rule, not scored", () => {
    // crop-02 was sown on 2025-11-05 and may not return for two years.
    const r = run7(declared(["synthetic-crop-02"]));
    expect(r.strategies.status).toBe("baseline_unavailable");
    expect(r.strategies.baseline.status).toBe("not_evaluable");
    const codes = r.strategies.baseline.notes.map((n) => n.code);
    expect(codes).toContain("BASELINE_NO_FEASIBLE_SCHEDULE");
    expect(codes).toContain("BASELINE_STOPPED_BY_RULE");
    expect(
      r.strategies.baseline.notes.find(
        (n) => n.code === "BASELINE_STOPPED_BY_RULE",
      ).facts,
    ).toMatchObject({
      code: "RETURN_INTERVAL_VIOLATION",
      cropId: "synthetic-crop-02",
    });
    expect(r.strategies.alternativesFound).toBeGreaterThanOrEqual(2);
  });

  test("fewer than two alternatives is reported, never hidden", () => {
    const r = run7(
      declared(["synthetic-crop-01"], {
        history: { status: "unknown" },
        preferences: {
          mode: "suggest",
          considered_crop_ids: [],
          excluded_crop_ids: ["synthetic-crop-02"],
          priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        },
      }),
      rotationCatalog({ crops: 2 }),
    );
    expect(r.strategies.baseline.status).toBe("scored");
    expect(r.strategies.alternativesFound).toBeLessThan(2);
    expect(r.strategies.status).toBe("insufficient_alternatives");
  });

  test("farmer context changes the notes but never the ranking", () => {
    const plain = run7(declared(["synthetic-crop-01", "synthetic-crop-04"]));
    const context = {
      equipment: "limited",
      market_preference: "cash_income",
      forage_need: "high",
      erosion_concern: "high",
    };
    const withContext = run7(
      declared(["synthetic-crop-01", "synthetic-crop-04"], {
        farmer_context: context,
      }),
    );
    expect(withContext.candidates.map((c) => [c.id, c.rank])).toEqual(
      plain.candidates.map((c) => [c.id, c.rank]),
    );
    expect(withContext.strategies.priorities.farmerContext).toEqual(context);
    expect(plain.strategies.priorities.farmerContext).toBeNull();
    const codes = items(withContext)[0].notes.map((n) => n.code);
    expect(codes).toContain("GAP_NO_EQUIPMENT_DATA");
    expect(
      items(withContext)[0].notes.find((n) => n.code === "GAP_NO_MARKET_DATA")
        .text,
    ).toMatch(/cash income/);
    expect(
      withContext.strategies.priorities.notes.map((n) => n.code),
    ).toContain("PRIORITIES_CONTEXT_NOT_RANKED");
  });

  test("results are deterministic and the request still validates strictly", () => {
    const request = declared(["synthetic-crop-01", "synthetic-crop-04"]);
    expect(JSON.stringify(run7(request))).toBe(JSON.stringify(run7(request)));
    expect(() =>
      run7(
        rotationRequest({
          current_rotation: { crop_ids: [] },
        }),
      ),
    ).toThrow();
    expect(() =>
      run7(
        rotationRequest({
          farmer_context: { equipment: "plenty" },
        }),
      ),
    ).toThrow();
  });
});

describe("what-if tests (engine 7)", () => {
  const change = {
    rainfall_change_percent: -30,
    temperature_change_c: 4,
    sowing_shift_days: 10,
  };
  const withWhatIf = (what_if, extra = {}) =>
    rotationRequest({ what_if, ...extra });
  test("the contract bounds every change, names its units and needs at least one change", () => {
    expect(whatIfSchema.parse({ temperature_change_c: 1.5 })).toEqual({
      rainfall_change_percent: 0,
      temperature_change_c: 1.5,
      sowing_shift_days: 0,
    });
    for (const bad of [
      {},
      { rainfall_change_percent: 51 },
      { rainfall_change_percent: -51 },
      { rainfall_change_percent: 10.5 },
      { temperature_change_c: 6.1 },
      { temperature_change_c: -3.1 },
      { temperature_change_c: 1.25 },
      { sowing_shift_days: 46 },
      { sowing_shift_days: 3.5 },
      { temperature_change_c: 1, extra: true },
      { temperature_change_c: Number.NaN },
    ])
      expect(whatIfSchema.safeParse(bad).success).toBe(false);
    expect(
      planRequestV2Schema.safeParse(withWhatIf({ temperature_change_c: 2 }))
        .success,
    ).toBe(true);
  });
  test("a request without what_if keeps its identity and its result is untouched", () => {
    const canonical = JSON.stringify(normalizePlanRequestV2(rotationRequest()));
    expect(canonical).not.toContain("what_if");
    expect("whatIf" in base).toBe(false);
    expect(base.limitations.join(" ")).not.toContain("what-if");
  });
  test("the climate change is deterministic, never mutates its input and keeps missing days missing", () => {
    const series = {
      temperatureMin: new Float64Array([1, Number.NaN, 3]),
      temperatureMax: new Float64Array([11, 12, Number.NaN]),
      temperatureMean: new Float64Array([6, 7, 8]),
    };
    const rain = new Float64Array([0, 10, Number.NaN]);
    const source = {
      series,
      water: { latitude: 32, rain, dayOfYear: (n) => n + 1 },
      position: () => 0,
      shift: () => null,
    };
    const parsed = whatIfSchema.parse(change);
    const once = applyWhatIfToSource(source, parsed);
    const twice = applyWhatIfToSource(source, parsed);
    expect([...once.series.temperatureMax]).toEqual([15, 16, Number.NaN]);
    expect([...once.series.temperatureMin]).toEqual([5, Number.NaN, 7]);
    expect([...once.water.rain]).toEqual([0, 7, Number.NaN]);
    expect(once.series.temperatureMean).toEqual(twice.series.temperatureMean);
    // The original arrays are not touched.
    expect([...series.temperatureMax]).toEqual([11, 12, Number.NaN]);
    expect([...rain]).toEqual([0, 10, Number.NaN]);
  });
  test("a what-if result is labelled, parses, is repeatable and never claims to be a forecast", () => {
    const r = run(withWhatIf(change));
    expect(rotationAssessmentSchema.parse(r)).toEqual(r);
    expect(r.whatIf).toMatchObject({
      kind: "what_if",
      notAForecast: true,
      rainfallChangePercent: -30,
      temperatureChangeC: 4,
      sowingShiftDays: 10,
      appliedTo: { historicalWeather: true, futureModelWorlds: "not_prepared" },
    });
    expect(r.limitations.at(-1)).toContain("nothing here is a forecast");
    expect(JSON.stringify(run(withWhatIf(change)))).toBe(JSON.stringify(r));
    // The result keeps the request as it was submitted.
    expect(r.input.what_if).toEqual(change);
    expect(r.input.planning).toEqual(base.input.planning);
  });
  test("warmer and drier weather costs more on the same rotation", () => {
    const r = run(
      withWhatIf({ rainfall_change_percent: -30, temperature_change_c: 4 }),
    );
    expect(r.candidates[0].scores.climate.meanLoss).toBeGreaterThan(
      base.candidates[0].scores.climate.meanLoss,
    );
    expect(r.candidates[0].scores.water).toBeGreaterThan(
      base.candidates[0].scores.water,
    );
  });
  test("a sowing shift moves the first-sowing range and says so", () => {
    const r = run(withWhatIf({ sowing_shift_days: 10 }));
    expect(r.whatIf.planning).toEqual({
      requestedEarliestStartDate: "2026-10-20",
      requestedLatestStartDate: "2027-03-31",
      effectiveEarliestStartDate: "2026-10-30",
      effectiveLatestStartDate: "2027-04-10",
    });
    expect(r.candidates[0].slots[0].sowEarliest).toBe(
      addDays(base.candidates[0].slots[0].sowEarliest, 10),
    );
    // A shift that would put sowing before today is refused, not guessed.
    expect(() => run(withWhatIf({ sowing_shift_days: -45 }))).toThrow(
      RotationInputError,
    );
  });
  test("the changes also apply to each model's future world", async () => {
    const real = await loadCatalogRelease("data/catalog/releases/0.5.0");
    const request = (what_if) =>
      rotationRequest({
        history: { status: "unknown" },
        preferences: {
          mode: "consider",
          considered_crop_ids: ["faba-bean"],
          excluded_crop_ids: [],
          priorities: { climate: 1, water: 3, soil_health: 1, crop_health: 1 },
        },
        ...(what_if ? { what_if } : {}),
      });
    const needs = rotationScenarioNeedsCore(
      request(),
      real,
      rotationPolicy,
      assessedOn,
    );
    const series = syntheticScenarioSeries(needs);
    const assess = (what_if) =>
      assessRotationsCore(
        request(what_if),
        real,
        weather,
        rotationPolicy,
        assessedOn,
        true,
        series,
      );
    const plain = assess(null);
    const drier = assess({ rainfall_change_percent: -30 });
    expect(drier.whatIf.appliedTo.futureModelWorlds).toBe("applied");
    expect(() => rotationAssessmentSchema.parse(drier)).not.toThrow();
    const rain = (r) =>
      r.candidates[0].future.scenarios.find((x) => x.experiment === "ssp585")
        .models[0].futureRainMm;
    expect(rain(drier)).toBeLessThan(rain(plain));
    expect(rain(drier)).toBeCloseTo(rain(plain) * 0.7, 0);
  });
});

describe("pinned rotation outputs", () => {
  const policy = { ...rotationPolicy, outputs: "rotation-outputs-1" };
  test("the output policy adds reporting while old requests, scores and bytes stay unchanged", () => {
    const legacy = run();
    const reported = run(undefined, undefined, undefined, policy);
    expect(reported.outputs.version).toBe("rotation-outputs-1");
    const stripped = structuredClone(reported);
    delete stripped.outputs;
    delete stripped.policy.outputs;
    for (const c of stripped.candidates) {
      delete c.vulnerabilitySeasons;
      delete c.terrainContext;
    }
    expect(JSON.stringify(stripped)).toBe(JSON.stringify(legacy));
    expect(JSON.stringify(run())).toBe(JSON.stringify(legacy));
    expect(reported.outputs.grids.map((g) => g.input)).toEqual([
      "POWER",
      "GPM",
      "HLS",
      "SMAP",
      "NEX-GDDP",
      "NASADEM",
      "GRACE",
      "ECOSTRESS",
      "MODIS",
      "GEDI",
    ]);
    expect(
      reported.outputs.grids.every((g) => g.resampling === "none_added"),
    ).toBe(true);
    expect(
      reported.outputs.grids.find((g) => g.input === "POWER").cell,
    ).toEqual(rotationRequest().location);
    expect(reported.outputs.grids.find((g) => g.input === "HLS").use).toBe(
      "not_used",
    );
  });
  test("optional priorities are strict, bounded and canonical, with explicit data gaps", () => {
    const input = rotationRequest();
    input.preferences.equipment_limits = {
      mechanisation: "none",
      unavailable_operations: ["sowing", "harvest"],
    };
    input.preferences.market_access = "local";
    input.preferences.income_weight = 5;
    expect(
      normalizePlanRequestV2(input).preferences.equipment_limits
        .unavailable_operations,
    ).toEqual(["harvest", "sowing"]);
    for (const bad of [
      { income_weight: 6 },
      { income_weight: 1.1 },
      { market_access: "nearby" },
      { equipment_limits: {} },
      { equipment_limits: { unavailable_operations: ["x", "x"] } },
    ])
      expect(
        planRequestV2Schema.safeParse({
          ...input,
          preferences: { ...input.preferences, ...bad },
        }).success,
      ).toBe(false);
    expect(() => run(input)).toThrow("ROTATION_POLICY_INVALID");
    const r = run(input, undefined, undefined, policy);
    expect(r.outputs.priorities.map((p) => p.code)).toEqual([
      "EQUIPMENT_DATA_UNAVAILABLE",
      "MARKET_ACCESS_DATA_UNAVAILABLE",
      "INCOME_DATA_UNAVAILABLE",
    ]);
    expect(
      r.outputs.priorities.every(
        (p) => !p.rankingApplied && p.status === "not_found",
      ),
    ).toBe(true);
    expect(r.candidates.map((c) => [c.id, c.rank, c.weightedLoss])).toEqual(
      base.candidates.map((c) => [c.id, c.rank, c.weightedLoss]),
    );
  });
  test("periods carry sourced rule bounds, dates, analog counts and actual exposure", () => {
    const r = run(undefined, undefined, undefined, policy);
    for (const c of r.candidates)
      for (const [i, season] of c.vulnerabilitySeasons.entries()) {
        expect(season.slot).toBe(i + 1);
        expect(season.cropId).toBe(c.slots[i].cropId);
        expect(season.notAForecast).toBe(true);
        for (const p of season.periods)
          if (p.start !== null) {
            expect(p.start >= c.slots[i].sowEarliest).toBe(true);
            expect(p.end >= p.start).toBe(true);
            expect(p.numbers.completeSamples).toBeGreaterThan(0);
            expect(p.numbers.firstAnchorYear).toBe(policy.firstAnchorYear);
            if (p.numbers.limitDegC !== undefined) {
              expect(p.citations.length).toBeGreaterThan(0);
              expect(p.numbers.exposedDays).toBeLessThanOrEqual(
                p.numbers.checkedDays,
              );
            }
          }
      }
    const absent = run(undefined, undefined, [], policy);
    expect(
      absent.candidates[0].vulnerabilitySeasons[0].periods.every(
        (p) => p.code === "EXPOSURE_UNAVAILABLE",
      ),
    ).toBe(true);
    expect(r.outputs.terrain.erosion.missingFactors).toEqual([
      "R",
      "K",
      "LS",
      "C",
      "P",
    ]);
    expect(r.outputs.terrain.erosion.soilLossTPerHaPerYear).toBeNull();
  });
  test("real catalog references are never converted from ordinal protection to a RUSLE C factor", async () => {
    const release = await loadCatalogRelease("data/catalog/releases/0.11.0");
    const started = performance.now();
    const r = assessRotationsCore(
      rotationRequest({
        preferences: {
          mode: "suggest",
          considered_crop_ids: [],
          excluded_crop_ids: [],
          priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        },
      }),
      release,
      weather,
      policy,
      assessedOn,
      true,
    );
    expect((performance.now() - started) / 1000).toBeLessThan(25);
    expect(
      r.outputs.terrain.erosion.cropCover.every(
        (c) => c.status === "not_found",
      ),
    ).toBe(true);
    expect(
      r.outputs.terrain.erosion.cropCover.some(
        (c) => c.catalogReferenceIds.length,
      ),
    ).toBe(true);
  });
});

test("stage reporting reuses exact temperature bounds and FAO water arrays", async () => {
  const { ClimateModel, makeSeries } =
    await import("../../packages/domain/dist/rotation/climate.js");
  const series = makeSeries(366);
  series.temperatureMax.fill(30);
  series.temperatureMin.fill(10);
  series.temperatureMean.fill(20);
  const origin = "2000-01-01";
  const source = {
    series,
    position: (d) => (Date.parse(d) - Date.parse(origin)) / 86400000,
    shift: (d, years) => `${Number(d.slice(0, 4)) + years}${d.slice(4)}`,
    water: {
      latitude: 32.3,
      rain: new Float64Array(366),
      dayOfYear: (p) => p + 1,
    },
  };
  const spec = {
    profile: { id: "synthetic-exposure" },
    duration: { min: 8, max: 8 },
    temperature: [
      {
        id: "synthetic-heat",
        basis: "daily_maximum",
        stage: "flowering",
        stageWindow: {
          basis: "elapsed_days_from_sowing",
          startDay: 2,
          endDay: 4,
        },
        upperDegC: 25,
        lowerDegC: null,
        citations: [],
        verification: { status: "extracted" },
      },
    ],
    waterCurve: {
      id: "synthetic-water",
      kcIni: 1,
      kcMid: 1,
      kcEnd: 1,
      stageLengths: [2, 2, 2, 2],
      citations: [],
      verification: { status: "extracted" },
    },
  };
  const model = new ClimateModel(source, {
    ...rotationPolicy,
    firstAnchorYear: 2000,
    lastAnchorYear: 2000,
    minimumCompleteAnalogs: 1,
  });
  const slot = { spec, sowEarliest: "2026-01-01", sowLatest: "2026-01-01" };
  const detail = model.vulnerability(slot, 1);
  expect(detail.periods[0]).toMatchObject({
    code: "EXPOSURE_HEAT",
    stage: "flowering",
    start: "2026-01-03",
    end: "2026-01-05",
    numbers: {
      checkedDays: 3,
      exposedDays: 3,
      limitDegC: 25,
      exposedDayShare: 1,
    },
  });
  const stages = detail.periods.filter(
    (p) => p.code === "EXPOSURE_RAIN_DEFICIT",
  );
  expect(stages).toHaveLength(4);
  expect(
    stages.reduce((n, p) => n + p.numbers.meanCropWaterUseMm, 0),
  ).toBeCloseTo(model.rotationWater([slot]).meanCropWaterUseMm, 1);
  expect(
    stages.every(
      (p) =>
        p.numbers.meanRainMm === 0 &&
        p.numbers.meanShortfallMm === p.numbers.meanCropWaterUseMm,
    ),
  ).toBe(true);
  const missing = new ClimateModel(
    {
      ...source,
      series: {
        ...series,
        temperatureMax: series.temperatureMax.map((value, i) =>
          i === 3 ? Number.NaN : value,
        ),
      },
      water: { ...source.water },
    },
    rotationPolicy,
  ).vulnerability(slot, 1);
  expect(missing.periods[0].code).toBe("EXPOSURE_UNAVAILABLE");
  expect(missing.periods[0].start).toBeNull();
});

test("an explicit RUSLE C factor is reported with its catalog evidence; recalled factors retain their provenance", () => {
  const catalog = rotationCatalog();
  const profile = catalog.profiles[0];
  const reference = {
    id: "synthetic-rusle-c",
    topic: "rusle_cover_management_factor",
    summary: "Synthetic fixture C factor, never agronomic evidence.",
    value: { unit: "dimensionless", min: 0.2, max: 0.2 },
    citations: profile.rules[0].citations,
  };
  profile.references = [reference];
  const policy = { ...rotationPolicy, outputs: "rotation-outputs-1" };
  const sourced = run(undefined, catalog, undefined, policy).outputs.terrain
    .erosion.cropCover[0];
  expect(sourced).toMatchObject({
    status: "sourced",
    factor: 0.2,
    referenceId: reference.id,
    citations: reference.citations,
    recall: null,
  });
  const recall = {
    confidence: "low",
    basis: "Synthetic test of provenance, not a crop fact.",
    valueKind: "model_recall_unverified",
    recordedOn: "2026-11-10",
    researchItem: "synthetic-rusle-factor",
  };
  profile.references = [{ ...reference, citations: [], recall }];
  const recalled = run(undefined, catalog, undefined, policy).outputs.terrain
    .erosion.cropCover[0];
  expect(recalled).toMatchObject({
    status: "model_recall",
    factor: 0.2,
    recall,
  });
});

// Recorded on the current default before the B5 read-cache work. These keep
// the complete engine output and the existing generous CI speed ceiling pinned.
test.each([
  [
    "suggest",
    "9bb8becab13d0a4a4b72859aa79a0b7091042fec37fafb47c7ced7d1ac13ce9e",
  ],
  [
    "declared",
    "c1114a23a427f0a467a87f53d43173def5f71fa997c0ca90afbdf6d08db935b6",
  ],
])(
  "catalog 0.15.0 %s keeps the recorded result and speed bound",
  async (mode, hash) => {
    const catalog = await loadCatalogRelease("data/catalog/releases/0.15.0");
    const input = rotationRequest({
      history: { status: "unknown" },
      preferences: {
        mode: mode === "suggest" ? "suggest" : "consider",
        considered_crop_ids:
          mode === "suggest"
            ? []
            : ["barley", "lentil", "durum-wheat", "faba-bean"],
        excluded_crop_ids: [],
        priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
      },
      ...(mode === "declared"
        ? { current_rotation: { crop_ids: ["durum-wheat", "faba-bean"] } }
        : {}),
    });
    const started = performance.now();
    const result = assessRotationsCore(
      input,
      catalog,
      weather,
      { ...rotationPlanningPolicy, research: "benefits-2" },
      assessedOn,
      true,
      null,
      null,
      null,
      "rotation-engine-7",
    );
    expect((performance.now() - started) / 1000).toBeLessThan(25);
    expect(
      createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    ).toBe(hash);
  },
  90000,
);
