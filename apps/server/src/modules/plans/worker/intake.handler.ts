import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { Job } from "pg-boss";
import type { Config } from "../../../config/environment.js";
import type { PlanStore } from "../application/plan-store.js";
export function createIntakeHandler(store: PlanStore, config: Config) {
  return async (jobs: Job[]) => {
    for (const job of jobs) {
      const { requestId } = z
        .strictObject({ requestId: z.uuid() })
        .parse(job.data);
      const row = await store.begin(requestId);
      if (!row) continue;
      console.log(
        JSON.stringify({
          event: "plan_intake_started",
          requestId,
          attempt: row.attempts,
        }),
      );
      if (config.TEST_PLAN_WORKER_FAULT === "pause")
        await delay(60000, undefined, { signal: job.signal });
      if (
        config.TEST_PLAN_WORKER_FAULT === "terminal" ||
        (config.TEST_PLAN_WORKER_FAULT === "transient" && row.attempts === 1)
      )
        throw new Error("CONTROLLED_INTAKE_FAILURE");
      job.signal.throwIfAborted();
      await store.verifyAndComplete(requestId);
      console.log(JSON.stringify({ event: "plan_intake_finished", requestId }));
    }
  };
}
