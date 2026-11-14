// Real-data check of Step 12 Part B: catalog 0.9.0 and live NASA POWER weather
// for illustrative fields across Morocco, through the production planning
// workflow in a disposable database. Not real farms; not expert-reviewed advice.
// Usage: pnpm build:server && node --env-file=.env tooling/plans/morocco-demo.mjs
import { randomUUID } from "node:crypto";
import { disposable } from "../../tests/support/database.mjs";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { PlanningStore } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { createPlanningHandler } from "../../apps/server/dist/modules/plans/worker/planning.handler.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";

const FIELDS = [
  ["Beni Moussa (Tadla)", 32.42, -6.55],
  ["Meknès (Saïs)", 33.85, -5.6],
  ["Berrechid plain (Chaouia)", 33.2, -7.45],
  ["Sidi Slimane (Gharb)", 34.25, -5.95],
  ["Taza", 34.2, -4.05],
  ["Berkane (Moulouya)", 34.9, -2.35],
  ["Haouz plain", 31.45, -7.75],
  ["Taroudant (Souss)", 30.45, -8.9],
  ["Errachidia (Tafilalet)", 31.9, -4.4],
  ["Dakhla", 23.7, -15.935],
];
const day = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const db = await disposable();
const config = loadConfig({
  ...db.config,
  NODE_ENV: "development",
  PLANS_ENABLED: "true",
  PLANNING_ENABLED: "true",
  ...(process.env.SCIENCE_URL ? { SCIENCE_URL: process.env.SCIENCE_URL } : {}),
  // GPM rain correction; without an Earthdata account plans use POWER rain.
  ...(process.env.EARTHDATA_USERNAME
    ? {
        EARTHDATA_USERNAME: process.env.EARTHDATA_USERNAME,
        EARTHDATA_PASSWORD: process.env.EARTHDATA_PASSWORD,
      }
    : {}),
});
let workflow;
try {
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.9.0"),
  );
  workflow = new PlanningStore(
    db.pool,
    db.boss,
    config,
    new WeatherService(db.pool),
  );
  const store = new PlanStore(
    db.pool,
    db.boss,
    config.PLAN_CATALOG_ID,
    config.PLAN_CATALOG_VERSION,
    undefined,
    workflow,
  );
  const owner = await store.authenticate(
    (await store.createOwner("morocco-demo")).accessToken,
  );
  const handle = createPlanningHandler(store, config);
  const results = [];
  const only = process.env.DEMO_FIELDS?.split(",");
  for (const [name, latitude, longitude] of FIELDS.filter(
    ([n]) => !only || only.some((o) => n.includes(o)),
  )) {
    const accepted = await store.submit(owner, randomUUID(), {
      schema_version: "2",
      location: { latitude, longitude },
      history: {
        status: "known",
        completeness: "complete",
        entries: [
          {
            crop_id: process.env.DEMO_PAST ?? "durum-wheat",
            planted_on: "2025-11-20",
            harvested_on: "2026-06-05",
          },
        ],
      },
      crop_health: { status: "unknown" },
      soil: { status: "unknown" },
      water: {
        status: "reported",
        availability: process.env.DEMO_WATER ?? "rainfed",
        allocation: null,
      },
      planning: {
        horizon_years: 3,
        earliest_start_date: day(5),
        latest_start_date: `${Number(day(5).slice(0, 4)) + 1}-03-31`,
      },
      cultivars: [],
      preferences: {
        mode: "suggest",
        considered_crop_ids: [],
        excluded_crop_ids: [],
        priorities: { climate: 3, water: 1, soil_health: 2, crop_health: 1 },
      },
    });
    const started = performance.now();
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
    const top = r?.candidates[0];
    results.push({
      field: name,
      status: status.status,
      error: status.error?.code ?? null,
      seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
      outcome: r?.outcome,
      regions: r?.context.regionIds,
      schedulable: r?.crops
        .filter((c) => c.status === "schedulable")
        .map((c) => c.cropId),
      compared: r?.accounting.compared,
      top: top?.slots.map((s) => s.cropId),
      nextThree: r?.candidates
        .slice(1, 4)
        .map((c) => c.slots.map((s) => s.cropId).join(">")),
      climateMeanLoss: top?.scores.climate?.meanLoss ?? null,
      water: top?.waterBalance ?? null,
      rain: r?.rain ?? null,
      soilCarbon: r?.soilCarbon
        ? {
            start: r.soilCarbon.startTCPerHa,
            top: r.soilCarbon.candidates[0],
          }
        : null,
      yields: r?.yields
        ? {
            model: `${r.yields.model} ${r.yields.modelVersion}`,
            calibration: r.yields.calibration,
            soilClass: r.yields.soilClass,
            top: r.yields.candidates[0]?.slots,
          }
        : null,
      extremes: top?.extremes ?? null,
      soil: r?.soilEstimate
        ? {
            ph: r.soilEstimate.phWater,
            clay: r.soilEstimate.clayPercent,
            organicCarbon: r.soilEstimate.organicCarbonGPerKg,
          }
        : null,
      soilWarnings: r?.reasons
        ? [
            ...new Set(
              [...r.crops.flatMap((c) => c.reasons)]
                .filter((x) => x.code === "SOIL_ESTIMATE_OUTSIDE")
                .map((x) => x.cropId),
            ),
          ]
        : [],
      warnings: [
        ...new Set(
          r?.reasons
            .filter((x) => x.code === "RAINFED_ARID_RISK")
            .map((x) => x.cropId),
        ),
      ],
    });
  }
  console.log(
    JSON.stringify(
      {
        label:
          "Real catalog 0.9.0 + live NASA POWER; illustrative rainfed fields; not expert-reviewed",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await workflow?.weather.close();
  await db.close();
}
