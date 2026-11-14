import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { Job } from "pg-boss";
import type { Config } from "../../../config/environment.js";
import type { Ledger } from "../application/job-ledger.js";
export function createEchoHandler(ledger: Ledger, config: Config) {
  return async (jobs: Job[]) => {
    for (const job of jobs) {
      const { runId } = z.strictObject({ runId: z.uuid() }).parse(job.data);
      const run = await ledger.begin(runId);
      if (!run) continue;
      console.log(
        JSON.stringify({
          event: "processing_started",
          runId,
          attempt: run.attempts,
        }),
      );
      if (config.TEST_WORKER_FAULT === "pause")
        await delay(60000, undefined, { signal: job.signal });
      if (
        config.TEST_WORKER_FAULT === "terminal" ||
        (config.TEST_WORKER_FAULT === "transient" && run.attempts === 1)
      )
        throw new Error("CONTROLLED_INFRASTRUCTURE_FAILURE");
      job.signal.throwIfAborted();
      await ledger.complete(runId, run.input);
      console.log(JSON.stringify({ event: "processing_completed", runId }));
    }
  };
}
