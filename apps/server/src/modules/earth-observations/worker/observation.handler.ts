import type { WorkHandler } from "pg-boss";
import { z } from "zod";
import type { ObservationStore } from "../application/observation-store.js";

// Each job runs one step (submit, poll or download) and queues the next.
export function createObservationHandler(
  store: ObservationStore,
): WorkHandler<{ id: string }> {
  return async (jobs) => {
    for (const job of jobs) {
      const { id } = z.strictObject({ id: z.uuid() }).parse(job.data);
      const next = await store.process(id, job.signal);
      if (next !== null) await store.enqueue(id, next);
    }
  };
}
