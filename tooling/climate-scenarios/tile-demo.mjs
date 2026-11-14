// Labelled synthetic demonstration: invented test crops and invented POWER-
// style weather, combined with REAL stored NEX-GDDP-CMIP6 units for the field
// cell, to show the future-climate path end to end. Not crop advice.
// Usage: pnpm build:server && node --env-file=.env tooling/climate-scenarios/tile-demo.mjs
import { createPool } from "../../packages/database/dist/index.js";
import { ScenarioStore } from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
import {
  assessRotationsCore,
  rotationScenarioNeedsCore,
} from "../../packages/domain/dist/rotation/assess.js";
import {
  rotationCatalog,
  rotationPolicy,
  rotationRequest,
  rotationWeather,
} from "../../tests/support/rotation.mjs";

const assessedOn = "2026-10-15";
const request = rotationRequest();
const catalog = rotationCatalog();
const needs = rotationScenarioNeedsCore(
  request,
  catalog,
  rotationPolicy,
  assessedOn,
);
const pool = createPool(process.env.DATABASE_URL);
try {
  const started = performance.now();
  const series = await new ScenarioStore(pool).series(needs);
  const read = (performance.now() - started) / 1000;
  if (!series) throw new Error("TILE_NOT_PREPARED");
  const t = performance.now();
  const result = assessRotationsCore(
    request,
    catalog,
    rotationWeather(),
    rotationPolicy,
    assessedOn,
    true,
    series,
  );
  const top = result.candidates[0];
  console.log(
    JSON.stringify(
      {
        label: "synthetic crops and weather + real NEX-GDDP-CMIP6 units",
        cell: result.futureClimate.cell,
        units: series.length,
        readSeconds: Number(read.toFixed(2)),
        assessSeconds: Number(((performance.now() - t) / 1000).toFixed(2)),
        status: result.futureClimate.status,
        worldsCompared: result.futureClimate.worlds.filter(
          (w) => w.status === "compared",
        ).length,
        topStableAcrossFutures: result.futureClimate.topStableAcrossFutures,
        topCandidate: top && {
          crops: top.slots.map((s) => s.cropId),
          historicalMeanLoss: top.scores.climate?.meanLoss,
          futures: top.future?.scenarios.map((s) => ({
            experiment: s.experiment,
            meanChange: s.meanChange,
            range: [s.minChange, s.maxChange],
            models: s.models.map((m) => [m.model, m.change, m.weightedRank]),
          })),
        },
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
