// Load generator. It runs inside a container on the load-test stack's private
// network (passed to `node --eval`), so it can reach the API directly and give
// each simulated farmer their own client address, as real visitors would have.
// Only synthetic plan input is used; nothing leaves the Mac.
const api = process.env.LOAD_API;
const proxy = process.env.LOAD_PROXY;
const users = Number(process.env.LOAD_USERS);
const seconds = Number(process.env.LOAD_SECONDS);
const thinkMs = Number(process.env.LOAD_THINK_MS ?? 1000);
const planInput = JSON.parse(process.env.LOAD_PLAN_INPUT);
const samples = [];
const stop = Date.now() + seconds * 1000;

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function timed(type, request) {
  const started = performance.now();
  let status = 0;
  let body = null;
  try {
    const response = await request();
    status = response.status;
    body = await response.json().catch(() => null);
  } catch {
    status = 0;
  }
  samples.push({ type, ms: performance.now() - started, status });
  return { status, body };
}

async function farmer(index) {
  const ip = `10.${(index >> 8) & 255}.${index & 255}.7`;
  const headers = { "x-forwarded-for": ip };
  const session = await timed("create session", () =>
    fetch(`${api}/api/v1/plan-sessions`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    }),
  );
  if (session.status !== 201) return;
  const auth = {
    ...headers,
    authorization: `Bearer ${session.body.accessToken}`,
  };
  let submitted = 0;
  while (Date.now() < stop && submitted < 15) {
    const accepted = await timed("submit plan", () =>
      fetch(`${api}/api/v1/plans`, {
        method: "POST",
        headers: {
          ...auth,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(planInput),
      }),
    );
    submitted += 1;
    if (accepted.status === 202) {
      await pause(thinkMs);
      await timed("read plan", () =>
        fetch(`${api}/api/v1/plans/${accepted.body.id}`, { headers: auth }),
      );
    }
    await pause(thinkMs);
    await timed("open web app", () => fetch(`${proxy}/`));
    await pause(thinkMs);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: users }, (_, i) => farmer(i + 1)));
const elapsed = (Date.now() - started) / 1000;
const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const summarize = (rows) => {
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const failures = rows.filter((r) => r.status === 0 || r.status >= 500).length;
  return {
    requests: rows.length,
    failures,
    rateLimited: rows.filter((r) => r.status === 429).length,
    byStatus,
    p50: Math.round(percentile(times, 50)),
    p95: Math.round(percentile(times, 95)),
    p99: Math.round(percentile(times, 99)),
    max: Math.round(times.at(-1) ?? 0),
  };
};
const types = [...new Set(samples.map((s) => s.type))];
console.log(
  JSON.stringify({
    users,
    seconds: Math.round(elapsed),
    requestsPerSecond: Number((samples.length / elapsed).toFixed(1)),
    overall: summarize(samples),
    byType: Object.fromEntries(
      types.map((t) => [t, summarize(samples.filter((s) => s.type === t))]),
    ),
  }),
);
