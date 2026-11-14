// Real-data demonstration of Step 12: catalog 0.3.0, live NASA POWER weather
// for the field's cell and the real NEX-GDDP-CMIP6 Tadla tile, through the
// production planning workflow (no fixture). It runs in a disposable database;
// the prepared tile is copied read-only from DATABASE_URL (the dev database).
// The field and history are an illustrative guest submission, not a real farm.
// Not expert-reviewed advice.
// Usage: pnpm build:server && node --env-file=.env tooling/plans/tadla-demo.mjs
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { disposable } from "../../tests/support/database.mjs";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { PlanningStore } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { createPlanningHandler } from "../../apps/server/dist/modules/plans/worker/planning.handler.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL_REQUIRED");
const db = await disposable();
const { pool, boss } = db;
const config = loadConfig({
  ...db.config,
  NODE_ENV: "development",
  PLANS_ENABLED: "true",
  PLANNING_ENABLED: "true",
  CLIMATE_SCENARIOS_ENABLED: "true",
});
// Copy the prepared 32N 7W tile; the dev database is only read.
const dump = execFileSync(
  "pg_dump",
  [
    "--data-only",
    "--table=climate_scenario_tiles",
    "--table=climate_scenario_units",
    source,
  ],
  { maxBuffer: 512 * 1024 * 1024 },
);
execFileSync("psql", ["--quiet", "--set=ON_ERROR_STOP=1", db.url], {
  input: dump,
  stdio: ["pipe", "ignore", "inherit"],
});
const day = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const input = {
  schema_version: "2",
  // Irrigated plain near Fquih Ben Saleh, inside the stored 32N 7W tile.
  location: { latitude: 32.5, longitude: -6.69 },
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
  crop_health: { status: "unknown" },
  soil: { status: "unknown" },
  water: {
    status: "reported",
    availability: "irrigation_available",
    allocation: null,
  },
  planning: {
    horizon_years: 3,
    earliest_start_date: day(5),
    latest_start_date: "2027-03-31",
  },
  cultivars: [],
  preferences: {
    mode: "consider",
    considered_crop_ids: ["faba-bean", "sugar-beet"],
    excluded_crop_ids: [],
    priorities: { climate: 3, water: 1, soil_health: 2, crop_health: 1 },
  },
};
let workflow;
try {
  await new CatalogStore(pool).import(
    await loadCatalogRelease("data/catalog/releases/0.3.0"),
  );
  workflow = new PlanningStore(pool, boss, config, new WeatherService(pool));
  const store = new PlanStore(
    pool,
    boss,
    config.PLAN_CATALOG_ID,
    config.PLAN_CATALOG_VERSION,
    undefined,
    workflow,
  );
  const owner = await store.authenticate(
    (await store.createOwner("tadla-demo")).accessToken,
  );
  const accepted = await store.submit(owner, randomUUID(), input);
  const started = performance.now();
  const handle = createPlanningHandler(store, config);
  let status;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await handle([
        {
          data: { requestId: accepted.id },
          signal: new AbortController().signal,
        },
      ]);
    } catch (error) {
      if (attempt === 3) throw error;
      continue;
    }
    status = await store.read(owner, accepted.id);
    if (status.status === "completed" || status.status === "failed") break;
  }
  const r = status.result;
  const crops = Object.fromEntries(r.crops.map((c) => [c.cropId, c.status]));
  console.log(
    JSON.stringify(
      {
        label:
          "Real catalog 0.3.0 + live NASA POWER + stored NEX-GDDP-CMIP6 tile; illustrative field; not expert-reviewed",
        seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
        status: status.status,
        outcome: r.outcome,
        synthetic: r.synthetic,
        catalog: `${r.catalog.id} ${r.catalog.version}`,
        engine: r.engineVersion,
        regions: r.context.regionIds,
        weatherSnapshots: status.weatherSnapshotIds.length,
        scenarioUnits: status.scenarioUnitIds?.length ?? 0,
        crops,
        choices: r.choices.map((c) => ({
          cropId: c.cropId,
          role: c.role,
          outcome: c.outcome,
          bestRank: c.bestRank,
        })),
        accounting: r.accounting,
        futureClimate: {
          status: r.futureClimate.status,
          reason: r.futureClimate.reason ?? null,
          worldsCompared: r.futureClimate.worlds?.filter(
            (w) => w.status === "compared",
          ).length,
          topStableAcrossFutures: r.futureClimate.topStableAcrossFutures,
        },
        top: r.candidates.slice(0, 5).map((c) => ({
          rank: c.rank,
          rotation: c.slots.map(
            (s) => `${s.cropId} (sow ${s.sowEarliest}..${s.sowLatest})`,
          ),
          climateMeanLoss: c.scores.climate?.meanLoss ?? null,
          worstDecileLoss: c.scores.climate?.worstDecileLoss ?? null,
          analogYears: c.scores.climate?.completeAnalogs ?? null,
          soilHealth: c.scores.soil_health,
          futures: c.future?.scenarios.map((s) => ({
            experiment: s.experiment,
            meanChange: s.meanChange,
            range: [s.minChange, s.maxChange],
          })),
        })),
        bestPerConsideredCrop: r.choices
          .filter((c) => c.bestCandidateId)
          .map((c) => {
            const best = r.candidates.find((x) => x.id === c.bestCandidateId);
            return {
              cropId: c.cropId,
              rank: c.bestRank,
              rotation: best?.slots.map((s) => `${s.cropId} ${s.sowEarliest}`),
              climateMeanLoss: best?.scores.climate?.meanLoss ?? null,
            };
          }),
        reasons: r.reasons.map((x) => x.code),
      },
      null,
      2,
    ),
  );
} finally {
  await workflow?.weather.close();
  await db.close();
}
