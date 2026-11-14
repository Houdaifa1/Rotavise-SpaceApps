import { beforeAll, afterAll, test, expect } from "@jest/globals";
import {
  disposable,
  startApi,
  startWorker,
  stop,
  submit,
  poll,
  processFor,
  processEnv,
} from "../support/index.mjs";
import { Ledger } from "../../apps/server/dist/modules/development-jobs/application/job-ledger.js";
let db, api, worker, ledger;
beforeAll(async () => {
  db = await disposable();
  api = await startApi(db);
  ledger = new Ledger(db.pool, db.boss);
});
afterAll(async () => {
  if (worker) await stop(worker.child);
  if (api) await stop(api.child);
  if (db) await db.close();
});
async function resetWorker(fault) {
  if (worker) await stop(worker.child);
  worker = await startWorker(db, fault);
}
async function uniqueResult(id) {
  expect(
    (await db.pool.query("SELECT * FROM job_run_results WHERE run_id=$1", [id]))
      .rowCount,
  ).toBe(1);
}
test("transient failure retries and completes exactly one authoritative result", async () => {
  await resetWorker("transient");
  const id = await submit(api, "transient fixture");
  await poll(async () => (await ledger.read(id)).status === "completed", {
    label: "retry completion",
  });
  expect((await ledger.read(id)).attempts).toBe(2);
  await uniqueResult(id);
  console.log("OBSERVED transient: 2 attempts, 1 result");
});
test("exhausted retries reconcile into stable failed state without output", async () => {
  await resetWorker("terminal");
  const id = await submit(api, "terminal fixture");
  await poll(async () => (await ledger.read(id)).status === "failed", {
    label: "terminal failure",
  });
  const row = await ledger.read(id);
  expect(row.attempts).toBe(3);
  expect(row.error.code).toBe("RETRIES_EXHAUSTED");
  expect(row.result).toBeNull();
  await ledger.reconcile();
  await ledger.complete(id, { operation: "echo", message: "late duplicate" });
  expect((await ledger.read(id)).status).toBe("failed");
  expect(
    (await db.pool.query("SELECT * FROM job_run_results WHERE run_id=$1", [id]))
      .rowCount,
  ).toBe(0);
  console.log("OBSERVED terminal: 3 attempts, RETRIES_EXHAUSTED, 0 results");
});
test("actual SIGKILL after observed processing recovers via expiration within bounded deadline", async () => {
  await resetWorker("pause");
  const id = await submit(api, "crash fixture");
  await poll(() => worker.child.output.includes(`"runId":"${id}"`), {
    label: "processing milestone before kill",
  });
  expect((await ledger.read(id)).status).toBe("running");
  const began = Date.now();
  await stop(worker.child, "SIGKILL");
  expect(worker.child.signalCode).toBe("SIGKILL");
  worker = await startWorker(db);
  await poll(async () => (await ledger.read(id)).status === "completed", {
    timeout: 40000,
    label: "crash lease recovery",
  });
  expect((await ledger.read(id)).attempts).toBe(2);
  await uniqueResult(id);
  console.log(
    `OBSERVED SIGKILL recovery: ${Date.now() - began} ms, 2 attempts, 1 result`,
  );
});
test("worker health is independent; graceful shutdown leaves queued work for restart", async () => {
  expect(
    (await fetch(`http://127.0.0.1:${worker.port}/health/live`)).status,
  ).toBe(200);
  expect(
    (await fetch(`http://127.0.0.1:${worker.port}/health/ready`)).status,
  ).toBe(200);
  await stop(worker.child);
  expect(worker.child.output).toContain("WORKER_STOPPED");
  expect(worker.child.exitCode).toBe(0);
  const id = await submit(api, "shutdown fixture");
  expect((await ledger.read(id)).status).toBe("queued");
  worker = await startWorker(db);
  await poll(async () => (await ledger.read(id)).status === "completed");
  await uniqueResult(id);
});
test("production fault injection fails before worker startup", async () => {
  const child = processFor(
    "worker",
    processEnv(db, {
      NODE_ENV: "production",
      DEV_HARNESS_ENABLED: "false",
      TEST_WORKER_FAULT: "terminal",
    }),
  );
  await child.exited;
  expect(child.exitCode).toBe(1);
  expect(child.output).toContain("WORKER_START_FAILED");
  expect(child.output).not.toContain(db.url);
});
