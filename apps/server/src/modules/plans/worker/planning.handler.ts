import type { WorkHandler } from "pg-boss";
import { z } from "zod";
import { setTimeout as delay } from "node:timers/promises";
import type { PlanStore } from "../application/plan-store.js";
import type { Config } from "../../../config/environment.js";
export function createPlanningHandler(
  plans: PlanStore,
  config: Config,
): WorkHandler<{ requestId: string }> {
  return async (jobs) => {
    for (const job of jobs) {
      const { requestId } = z
        .strictObject({ requestId: z.uuid() })
        .parse(job.data);
      const workflow = plans.planning!;
      const begun = await workflow.begin(requestId);
      if (!begun) {
        const current = await workflow.load(requestId);
        if (current && ["queued", "running"].includes(current.status))
          throw new Error("PLANNING_LEASE_BUSY");
        continue;
      }
      const signal = AbortSignal.any([job.signal, AbortSignal.timeout(600000)]);
      console.log(
        JSON.stringify({
          event: "planning_job_started",
          requestId,
          attempt: begun.attempt,
        }),
      );
      if (config.TEST_PLAN_WORKER_FAULT === "pause")
        await delay(60000, undefined, { signal });
      if (
        config.TEST_PLAN_WORKER_FAULT === "transient" &&
        begun.attempt === 1
      ) {
        await workflow.retry(requestId, begun.lease);
        throw new Error("CONTROLLED_PLANNING_FAILURE");
      }
      if (config.TEST_PLAN_WORKER_FAULT === "terminal") {
        await workflow.fail(requestId, "CALCULATION_FAILED", begun.lease);
        continue;
      }
      await plans.begin(requestId);
      await plans.verifyAndComplete(requestId);
      await workflow.process(requestId, begun.lease, signal);
      console.log(
        JSON.stringify({
          event: "planning_job_finished",
          requestId,
          attempt: begun.attempt,
        }),
      );
    }
  };
}
