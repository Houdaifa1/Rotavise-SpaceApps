// Real PostgreSQL catalog/model evidence and live (or hash-verified saved) POWER.
// Illustrative farmer inputs, not measured farms or agronomic validation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { realDatabase } from "../verification/real-database.mjs";
import {
  assessRotationsCore,
  rotationWeatherNeedsCore,
  rotationScenarioNeedsCore,
  rotationNearTermNeedsCore,
} from "../../packages/domain/dist/rotation/assess.js";
import {
  rotationPlanningPolicy,
  regionalRotationPlanningPolicy,
} from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { ScenarioStore } from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
import { NasaPowerProvider } from "../../apps/server/dist/modules/weather/providers/nasa-power/nasa-power.provider.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { canonicalWeatherRequest } from "../../apps/server/dist/modules/weather/application/weather-request.js";
import { stableJson } from "../../apps/server/dist/common/serialization/stable-json.js";
import {
  catalogV2ContentHash,
  validateProductionCatalogV2,
} from "../../packages/catalog/dist/index.js";
const sha = (v) =>
  createHash("sha256")
    .update(typeof v === "string" ? v : stableJson(v))
    .digest("hex");
const out =
  process.env.REGIONAL_EVAL_OUTPUT ?? "docs/evidence/live/2026-11-12-b7";
const cache = ".artifacts/b7/power";
mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });
const mainstream = [
  "durum-wheat",
  "bread-wheat",
  "barley",
  "lentil",
  "chickpea",
  "faba-bean",
  "maize",
  "sunflower",
  "potato",
  "tomato",
  "olive",
];
const regions = [
  ["Tadla", 32.4, -6.55],
  ["Souss-Massa", 30.4, -9.6],
  ["Gharb", 34.3, -6.3],
  ["Oriental", 34.7, -1.9],
  ["Saiss", 33.9, -5.3],
  ["Haouz", 31.6, -8],
];
const db = await realDatabase();
const report = {
  date: new Date().toISOString(),
  machine: {
    cpu: os.cpus()[0].model,
    node: process.version,
    load: os.loadavg(),
  },
  fixture:
    "Illustrative B6-like farmer inputs; no field measurements; all agronomy remains sourced or labelled model_recall in catalog 0.15.0",
  weatherIdentifiers:
    "Content-derived UUIDs for in-memory real POWER evidence; no persisted weather rows or production plans are claimed.",
  cases: [],
};
try {
  const row = (
    await db.pool.query(
      "SELECT body,content_sha256 FROM catalog_versions WHERE version='0.15.0' AND schema_version='2'",
    )
  ).rows[0];
  const catalog = validateProductionCatalogV2(row.body);
  assert.equal(catalogV2ContentHash(catalog), row.content_sha256);
  report.catalog = { version: catalog.version, sha256: row.content_sha256 };
  const scenarioStore = new ScenarioStore(db.pool);
  const provider = new NasaPowerProvider();
  for (const [name, latitude, longitude] of regions.filter(
    ([n]) =>
      !process.env.REGIONAL_EVAL_REGIONS ||
      process.env.REGIONAL_EVAL_REGIONS.split(",").includes(n),
  )) {
    const input = {
      schema_version: "2",
      location: { latitude, longitude },
      history: { status: "unknown" },
      crop_health: { status: "unknown" },
      soil: {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 7,
            method: "unknown",
            measured_on: "2026-06-01",
            source: "farmer_observation",
          },
        ],
      },
      water: {
        status: "reported",
        availability: "irrigation_available",
        allocation: null,
      },
      planning: {
        horizon_years: 3,
        earliest_start_date: "2026-11-17",
        latest_start_date: "2027-05-03",
      },
      cultivars: [],
      farmer_context: {
        equipment: "limited",
        market_preference: "household_food",
        forage_need: "some",
        erosion_concern: "moderate",
      },
      preferences: {
        mode: "suggest",
        considered_crop_ids: [],
        excluded_crop_ids: [],
        priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        equipment_limits: { mechanisation: "small" },
        market_access: "local",
        income_weight: 3,
      },
    };
    const oldPolicy = { ...rotationPlanningPolicy, research: "benefits-2" };
    const assessedOn = "2026-11-12";
    const weather = [];
    const weatherEvidence = [];
    for (const range of rotationWeatherNeedsCore(
      input,
      catalog,
      oldPolicy,
      assessedOn,
    )) {
      const request = canonicalWeatherRequest({
        latitude,
        longitude,
        startDate: range.start,
        endDate: range.end,
        variables: [
          "precipitation",
          "temperatureMax",
          "temperatureMean",
          "temperatureMin",
        ],
      });
      const path = `${cache}/${sha(request)}.json`;
      let raw, snapshot;
      if (existsSync(path) && !process.argv.includes("--refresh-power")) {
        const saved = JSON.parse(readFileSync(path));
        assert.equal(sha(saved.raw), saved.sha256);
        raw = saved.raw;
        snapshot = normalizeNasa(raw, request, saved.retrievedAt);
      } else {
        ({ raw, snapshot } = await provider.fetch(
          request,
          AbortSignal.timeout(25000),
        ));
        writeFileSync(
          path,
          JSON.stringify({
            raw,
            sha256: sha(raw),
            retrievedAt: snapshot.provenance.retrievedAt,
          }),
        );
      }
      const h = sha(raw);
      weather.push({
        snapshotId: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`,
        normalizedSha256: sha(snapshot),
        synthetic: false,
        snapshot,
      });
      weatherEvidence.push({
        request,
        rawSha256: h,
        normalizedSha256: sha(snapshot),
        retrievedAt: snapshot.provenance.retrievedAt,
      });
    }
    const mid = rotationScenarioNeedsCore(
      input,
      catalog,
      oldPolicy,
      assessedOn,
    );
    const near = rotationNearTermNeedsCore(
      input,
      catalog,
      oldPolicy,
      assessedOn,
    );
    const scenarios = await scenarioStore.series({
      cell: mid.cell,
      units: [...mid.units, ...near.units],
    });
    assert.ok(scenarios, "complete real tile required");
    for (const mode of ["suggest", "consider"]) {
      input.preferences.mode = mode;
      input.preferences.considered_crop_ids =
        mode === "consider" ? mainstream : [];
      for (const variant of process.argv.includes("--before-only")
        ? ["before"]
        : process.argv.includes("--after-only")
          ? ["after"]
          : ["before", "after"]) {
        const policy =
          variant === "before"
            ? oldPolicy
            : {
                ...regionalRotationPlanningPolicy,
                research: "benefits-2",
              };
        let specs, diagnostic, work, searchWork;
        const futureWork = [];
        const start = performance.now();
        const result = assessRotationsCore(
          input,
          catalog,
          weather,
          policy,
          assessedOn,
          false,
          scenarios,
          null,
          null,
          "rotation-engine-7",
          null,
          (stage, value) => {
            if (stage === "specs") specs = value;
            else if (stage === "ranking") diagnostic = value;
            else if (stage === "work") work = value;
            else if (stage === "searchWork") searchWork = value;
            else if (stage === "futureWork") futureWork.push(value);
          },
        );
        const seconds = (performance.now() - start) / 1000;
        const crops = mainstream.map((id) => {
          const crop = result.crops.find((c) => c.cropId === id);
          const spec = specs.find((s) => s.profile.id === id);
          const finals = diagnostic.ranked.filter(
            (c) => c.slots[0].cropId === id,
          );
          const best = finals[0];
          const shown = result.candidates.filter(
            (c) => c.slots[0].cropId === id,
          );
          return {
            id,
            firstPlacementCount:
              diagnostic.search.firstPlacements.get(id)?.count ?? 0,
            firstRejections: [
              ...(diagnostic.search.firstPlacements.get(id)?.rejections ?? []),
            ].map(([code, count]) => ({ code, count })),
            status: crop?.status,
            reasons: crop?.reasons.map((r) => r.code),
            family: spec?.profile.identity.family,
            duration: spec?.duration,
            windows: spec?.windows,
            temperature: spec?.temperature.map((r) => ({
              id: r.id,
              basis: r.basis,
              lower: r.lowerDegC,
              upper: r.upperDegC,
              verification: r.verification,
              stageWindow: r.stageWindow,
            })),
            waterClass: spec?.waterClass,
            waterCurve: spec?.waterCurve?.id,
            preferences: spec?.preferences.map((r) => r.id),
            finalists: finals.length,
            bestRank: best?.rank,
            bestLoss: best?.weightedLoss,
            bestScores: best?.scores,
            shown: shown.length,
            compared: shown.filter((c) =>
              c.future?.scenarios.some((s) => s.models.length),
            ).length,
          };
        });
        const entry = {
          name,
          mode,
          variant,
          seconds,
          resultSha256: sha(result),
          bytes: Buffer.byteLength(JSON.stringify(result)),
          sizes: Object.fromEntries(
            Object.entries(result).map(([k, v]) => [
              k,
              JSON.stringify(v).length,
            ]),
          ),
          candidateSizes:
            result.candidates[0] &&
            Object.fromEntries(
              Object.entries(result.candidates[0]).map(([k, v]) => [
                k,
                JSON.stringify(v).length,
              ]),
            ),
          input: result.input,
          policy,
          regionIds: result.context.regionIds,
          accounting: result.accounting,
          work,
          searchWork,
          futureWork,
          firstCropCoverage: [...diagnostic.search.firstPlacements].map(
            ([cropId, p]) => ({
              cropId,
              placements: p.count,
              finalists: diagnostic.ranked.filter(
                (c) => c.slots[0].cropId === cropId,
              ).length,
              shown: result.candidates.filter(
                (c) => c.slots[0].cropId === cropId,
              ).length,
            }),
          ),
          dimensions: {
            shared: diagnostic.shared,
            climateAvailable: diagnostic.climateAvailable,
            climateCompared: diagnostic.climateCompared,
            waterCompared: diagnostic.waterCompared,
            soilCompared: diagnostic.soilCompared,
            dayVisits: diagnostic.dayVisits,
          },
          rankedCrops: [
            ...new Set(
              result.candidates.flatMap((c) => c.slots.map((s) => s.cropId)),
            ),
          ],
          firstCrops: [
            ...new Set(result.candidates.map((c) => c.slots[0].cropId)),
          ],
          top: result.candidates.slice(0, 5).map((c) => ({
            rank: c.rank,
            crops: c.slots.map((s) => ({
              id: s.cropId,
              name: catalog.profiles.find((p) => p.id === s.cropId).identity
                .name,
            })),
            loss: c.weightedLoss,
          })),
          crops,
          representativeEvidence: [
            "amaranth",
            "berseem",
            "arugula",
            "chard",
            "cowpea",
            "endive",
            ...mainstream,
          ].map((id) => {
            const spec = specs.find((s) => s.profile.id === id);
            return {
              cropId: id,
              duration: spec?.duration,
              windows: spec?.windows,
              temperatureChecks: spec?.temperature.map((r) => ({
                id: r.id,
                basis: r.basis,
                lower: r.lowerDegC,
                upper: r.upperDegC,
                verification: r.verification,
              })),
              ruleTiers: spec?.usedRules.reduce(
                (counts, r) => ({
                  ...counts,
                  [r.verification.status]:
                    (counts[r.verification.status] ?? 0) + 1,
                }),
                {},
              ),
            };
          }),
          exposureCoverage: result.candidates.reduce((counts, c) => {
            for (const season of c.vulnerabilitySeasons ?? [])
              for (const period of season.periods)
                counts[period.code] = (counts[period.code] ?? 0) + 1;
            return counts;
          }, {}),
          futureClimate: result.futureClimate,
          candidates: result.candidates.map((c) => ({
            id: c.id,
            crops: c.slots.map((s) => s.cropId),
            future: c.future,
          })),
          weatherEvidence,
          scenarioEvidence: {
            cell: mid.cell,
            units: scenarios.length,
            sha256: sha(
              scenarios.map((s) => ({
                id: s.unitId,
                sha256: s.normalizedSha256,
              })),
            ),
          },
        };
        report.cases.push(entry);
        writeFileSync(
          `${out}/regional-eval.json`,
          JSON.stringify(report, null, 2) + "\n",
        );
        console.log(
          JSON.stringify({
            name,
            mode,
            variant,
            seconds,
            schedulable: result.accounting.schedulableCrops,
            completed: result.accounting.completed,
            firstCrops: entry.firstCrops,
            top: entry.top[0],
            future: result.futureClimate.status,
            near: result.futureClimate.nearTerm.status,
          }),
        );
        if (variant === "after") {
          const checks = [
            [entry.firstCrops.includes("barley"), "barley first-crop option"],
            [
              result.futureClimate.status === "compared",
              "mid-century comparison",
            ],
            [
              result.futureClimate.nearTerm.status === "compared",
              "near-term comparison",
            ],
            [entry.bytes < 8388608, "result fits production storage bound"],
            [
              work.dayVisits <= policy.maxClimateDayVisits,
              "historical day budget",
            ],
            [
              futureWork.every(
                (w) => w.dayVisits <= policy.maxClimateDayVisits,
              ),
              "model day budgets",
            ],
            [seconds < 6, `engine ${seconds}s exceeds 6s`],
            [
              crops.every((c) => !c.finalists || c.shown > 0),
              "mainstream finalists retained",
            ],
          ];
          entry.failures = checks
            .filter(([ok]) => !ok)
            .map(([, message]) => message);
          if (entry.failures.length) {
            process.exitCode = 1;
            console.error(
              JSON.stringify({ name, mode, failures: entry.failures }),
            );
          }
          writeFileSync(
            `${out}/regional-eval.json`,
            JSON.stringify(report, null, 2) + "\n",
          );
        }
      }
    }
  }
} finally {
  await db.close();
}
