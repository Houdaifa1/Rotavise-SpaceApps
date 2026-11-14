import type { PgBoss, WorkHandler } from "pg-boss";
import { z } from "zod";
import {
  scenarioTileSchema,
  type FutureClimatePolicy,
  type ScenarioTile,
} from "@rotavise/contracts";
import type { Config } from "../../../config/environment.js";
import { SCENARIO_QUEUE } from "../../../infrastructure/queue/pg-boss.js";
import {
  policyKey,
  type ScenarioStore,
} from "../application/scenario-store.js";

export async function enqueueTile(
  boss: PgBoss,
  tile: ScenarioTile,
  policy: FutureClimatePolicy,
  startAfterSeconds = 0,
) {
  const key = policyKey(policy);
  await boss.send(
    SCENARIO_QUEUE,
    { tile, policyKey: key },
    {
      singletonKey: `${tile.latitude},${tile.longitude},${key}`,
      startAfter: startAfterSeconds,
    },
  );
}
// Each job prepares one tile for up to ten minutes, then queues the next
// slice. Jobs for another policy are stale and skipped.
export function createScenarioHandler(
  store: ScenarioStore,
  boss: PgBoss,
  config: Config,
  policy: FutureClimatePolicy,
): WorkHandler<{ tile: ScenarioTile; policyKey: string }> {
  return async (jobs) => {
    for (const job of jobs) {
      const data = z
        .strictObject({
          tile: scenarioTileSchema,
          policyKey: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .parse(job.data);
      if (data.policyKey !== policyKey(policy)) continue;
      const result = await store.prepare(data.tile, policy, {
        concurrency: config.SCENARIO_FETCH_CONCURRENCY,
        deadlineMs: 600000,
        signal: job.signal,
      });
      console.log(
        JSON.stringify({
          event: "climate_scenario_slice",
          tile: data.tile,
          status: result.status,
          remaining: result.remaining,
        }),
      );
      if (result.status === "preparing")
        await enqueueTile(boss, data.tile, policy, 60);
    }
  };
}
