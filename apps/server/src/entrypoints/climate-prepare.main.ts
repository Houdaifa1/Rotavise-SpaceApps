import { createPool } from "@rotavise/database";
import { scenarioCell } from "@rotavise/contracts";
import { loadConfig } from "../config/environment.js";
import { ScenarioStore } from "../modules/climate-scenarios/application/scenario-store.js";
import { climatePrepareFailureCode } from "../modules/climate-scenarios/application/failure-code.js";
import { currentFutureClimatePolicy as futureClimatePolicy } from "../modules/plans/application/planning-store.js";

// Prepares the NEX-GDDP-CMIP6 tile containing a point, in this process, until
// every unit is stored. Re-running resumes; a failed tile is retried. Usage:
//   pnpm climate:prepare <latitude> <longitude> [--status]
async function main() {
  const [lat, lon, flag] = process.argv.slice(2);
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    lat === undefined ||
    lon === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    (flag !== undefined && flag !== "--status")
  )
    throw new Error("CLIMATE_ARGUMENTS_INVALID");
  const { tile } = scenarioCell(latitude, longitude);
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const stop = new AbortController();
  process.once("SIGINT", () => stop.abort());
  try {
    const store = new ScenarioStore(pool);
    if (flag === "--status") {
      console.log(
        JSON.stringify({
          tile,
          ...(await store.tileStatus(tile, futureClimatePolicy)),
        }),
      );
      return;
    }
    await store.request(tile, futureClimatePolicy, 0, true);
    while (!stop.signal.aborted) {
      const result = await store.prepare(tile, futureClimatePolicy, {
        concurrency: config.SCENARIO_FETCH_CONCURRENCY,
        deadlineMs: 120000,
        signal: stop.signal,
      });
      console.log(JSON.stringify({ tile, ...result }));
      if (result.status !== "preparing") {
        if (result.status === "failed") process.exitCode = 1;
        return;
      }
    }
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      code: climatePrepareFailureCode(error),
    }),
  );
  process.exitCode = 1;
});
