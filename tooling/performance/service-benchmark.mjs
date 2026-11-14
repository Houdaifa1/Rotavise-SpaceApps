// Measures plan-intake throughput and read-endpoint latency against disposable
// PostgreSQL 18 (Docker), a real API process and a real worker process, with
// catalog 0.11.0 and 0.1.0 imported. Synthetic plan input; nothing leaves the
// machine. Usage: node tooling/performance/service-benchmark.mjs
// Run `pnpm build:server` first.
import { performance } from "node:perf_hooks";
import {
  disposable,
  startApi,
  stop,
  processFor,
  processEnv,
  poll,
} from "../../tests/support/index.mjs";
import { freePort } from "../../tests/support/polling.mjs";
import {
  planSession,
  planHttp,
  submitPlan,
} from "../../tests/support/plans.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};
const summary = (values) => ({
  n: values.length,
  p50Ms: Math.round(percentile(values, 0.5) * 10) / 10,
  p95Ms: Math.round(percentile(values, 0.95) * 10) / 10,
  maxMs: Math.round(Math.max(...values) * 10) / 10,
});
const timed = async (fn) => {
  const t = performance.now();
  const result = await fn();
  return [performance.now() - t, result];
};

const db = await disposable();
let api, worker;
try {
  const store = new CatalogStore(db.pool);
  const small = await loadCatalogRelease("data/catalog/releases/0.1.0");
  const wide = await loadCatalogRelease("data/catalog/releases/0.11.0");
  await store.import(small);
  await store.import(wide);
  api = await startApi(db, { PLANS_ENABLED: "true" });
  const workerPort = await freePort();
  worker = processFor(
    "worker",
    processEnv(db, { WORKER_PORT: String(workerPort), PLANS_ENABLED: "true" }),
  );
  await poll(() => worker.output.includes("worker_ready"), {
    label: "worker_ready",
  });
  const report = {
    date: new Date().toISOString().slice(0, 10),
    node: process.version,
  };

  // Catalog options for the 0.11.0 release (246 crops): the quota is 60 a
  // minute per address, so it is reset between batches of 50.
  const path = `/api/v1/catalog/options/${wide.id}/${wide.version}`;
  const catalogMs = [];
  for (let i = 0; i < 100; i++) {
    if (i % 50 === 0) await db.pool.query("TRUNCATE plan_quotas");
    const [ms, res] = await timed(() => planHttp(api, path));
    if (res.status !== 200)
      throw new Error(
        `catalog options ${res.status} ${await res.text()} ${api.child.output.slice(-600)}`,
      );
    await res.arrayBuffer();
    catalogMs.push(ms);
  }
  report.catalogOptions0_11_0 = summary(catalogMs);

  // Intake: 45 plans from three guest sessions (20 a session is the limit).
  const sessions = [];
  for (let i = 0; i < 3; i++) sessions.push(await planSession(api));
  const submitMs = [];
  const ids = [];
  const started = performance.now();
  for (const session of sessions)
    for (let batch = 0; batch < 3; batch++) {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          timed(() => submitPlan(api, session.accessToken)),
        ),
      );
      for (const [ms, accepted] of results) {
        submitMs.push(ms);
        ids.push({ id: accepted.id, token: session.accessToken });
      }
    }
  report.submit = summary(submitMs);
  await poll(
    async () =>
      Number(
        (
          await db.pool.query(
            "SELECT count(*) n FROM plan_requests WHERE status='completed'",
          )
        ).rows[0].n,
      ) === ids.length,
    { label: "intake complete", timeout: 120000 },
  );
  const seconds = (performance.now() - started) / 1000;
  report.intake = {
    plans: ids.length,
    seconds: Math.round(seconds * 100) / 100,
    plansPerSecond: Math.round((ids.length / seconds) * 100) / 100,
  };

  const readMs = [];
  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) await db.pool.query("TRUNCATE plan_quotas");
    const { id, token } = ids[i % ids.length];
    const [ms, res] = await timed(() =>
      planHttp(api, `/api/v1/plans/${id}`, { token }),
    );
    if (res.status !== 200) throw new Error(`plan read ${res.status}`);
    await res.arrayBuffer();
    readMs.push(ms);
  }
  report.planStatusRead = summary(readMs);
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (worker) await stop(worker);
  if (api) await stop(api.child);
  await db.close();
}
