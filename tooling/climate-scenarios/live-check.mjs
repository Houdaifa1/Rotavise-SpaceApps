// Opt-in live check of the NEX-GDDP-CMIP6 provider: fetches one real tile per
// model calendar through the production transport and normalizer, without a
// database. Usage: pnpm build:server && node tooling/climate-scenarios/live-check.mjs [lat lon]
import { scenarioCell } from "../../packages/contracts/dist/index.js";
import { NexGddpProvider } from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/nex-gddp.provider.js";
import { normalizeScenario } from "../../apps/server/dist/modules/climate-scenarios/providers/nex-gddp/normalization.js";
import { futureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";

const [lat = "32.33", lon = "-6.36"] = process.argv.slice(2);
const { cell, tile } = scenarioCell(Number(lat), Number(lon));
const provider = new NexGddpProvider();
// One unit per model, spread over experiments, variables and calendars.
const checks = [
  ["MPI-ESM1-2-HR", "historical", "tasmin", 1990],
  ["GFDL-ESM4", "ssp245", "tasmax", 2050],
  ["UKESM1-0-LL", "ssp585", "tas", 2060],
  ["IPSL-CM6A-LR", "historical", "tas", 2004],
  ["MRI-ESM2-0", "ssp585", "tasmin", 2065],
];
const out = [];
for (const [id, experiment, variable, year] of checks) {
  const identity = {
    dataset: futureClimatePolicy.dataset,
    datasetVersion: futureClimatePolicy.datasetVersion,
    model: futureClimatePolicy.models.find((m) => m.id === id),
    experiment,
    variable,
    year,
    tile,
  };
  const started = Date.now();
  const fetched = await provider.fetch(identity, AbortSignal.timeout(300000));
  const { unit } = normalizeScenario(
    fetched.raw,
    identity,
    fetched.retrievedAt,
  );
  const at = unit.cells.findIndex(
    (c) => c.latitude === cell.latitude && c.longitude === cell.longitude,
  );
  const values = unit.values[at].filter((v) => v !== null);
  out.push({
    model: id,
    experiment,
    variable,
    year,
    calendar: identity.model.calendar,
    days: unit.values[at].length,
    meanDegC: Number(
      (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    ),
    bytes: fetched.raw.byteLength,
    elapsedMs: Date.now() - started,
  });
}
console.log(JSON.stringify({ tile, cell, checks: out }, null, 2));
