import { execFile } from "node:child_process";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { listBackups } from "./backup.mjs";
import { metricChecks, alertFromFile, parseMetrics } from "./alerts.mjs";
import {
  containerHealth,
  containerId,
  execInContainer,
  readState,
  readEnvFile,
  settings,
} from "./lib.mjs";

export const LIMITS = {
  queueAgeSeconds: 300,
  workerHeartbeatSeconds: 15,
  diskFreeBytes: 10 * 1024 ** 3,
  diskFreeFraction: 0.1,
  backupAgeHours: 26,
  repeatAlertHours: 6,
  statusLogBytes: 1024 * 1024,
};

const SERVICES = ["postgres", "science", "api", "worker", "proxy"];

async function httpCheck(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: response.status === 200, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, detail: String(error.cause?.code ?? error.message) };
  }
}

export async function collectChecks(config, state, now = new Date()) {
  const results = {};
  const base = `http://127.0.0.1:${config.proxyPort}`;
  results.api_live = await httpCheck(`${base}/api/v1/health/live`);
  results.api_ready = await httpCheck(`${base}/api/v1/health/ready`);
  const tag = state.current;
  const unhealthy = [];
  for (const service of SERVICES) {
    const id = tag ? containerId(config, tag, service) : null;
    const health = id ? containerHealth(id) : "not running";
    if (health !== "healthy") unhealthy.push(`${service}=${health}`);
  }
  results.containers = {
    ok: unhealthy.length === 0,
    detail: unhealthy.join(", ") || "all healthy",
  };

  const worker = tag ? containerId(config, tag, "worker") : null;
  if (!worker) {
    results.worker_heartbeat = {
      ok: false,
      detail: "worker container not running",
    };
  } else {
    const reply = await execInContainer(worker, [
      "node",
      "-e",
      "fetch('http://127.0.0.1:3001/health/ready').then(r=>r.text()).then(t=>console.log(t),()=>process.exit(1))",
    ]);
    try {
      const body = JSON.parse(reply.stdout);
      const age = body.checkedAt
        ? (now.getTime() - Date.parse(body.checkedAt)) / 1000
        : Infinity;
      results.worker_heartbeat = {
        ok: body.status === "ready" && age <= LIMITS.workerHeartbeatSeconds,
        detail: `status ${body.status}, last check ${Number.isFinite(age) ? Math.round(age) + " s ago" : "never"}`,
      };
    } catch {
      results.worker_heartbeat = { ok: false, detail: "worker did not answer" };
    }
  }

  if (!worker) {
    results.operations = { ok: false, detail: "worker metrics unavailable" };
  } else {
    const reply = await execInContainer(worker, [
      "node",
      "-e",
      "fetch('http://127.0.0.1:3001/health/operations',{signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())},()=>process.exit(1))",
    ]);
    try {
      if (reply.code !== 0) throw new Error("unavailable");
      const metrics = parseMetrics(JSON.parse(reply.stdout));
      const policy = await readEnvFile(config.envFile);
      Object.assign(results, metricChecks(metrics, policy, now));
      results.operations = { ok: true, detail: metrics };
    } catch {
      results.operations = {
        ok: false,
        detail: "metrics or alert policy unavailable/invalid",
      };
    }
  }

  const database = tag ? containerId(config, tag, "postgres") : null;
  if (!database) {
    results.queue_age = { ok: false, detail: "database container not running" };
  } else {
    const reply = await execInContainer(database, [
      "psql",
      "-U",
      "rotavise",
      "-d",
      "rotavise",
      "-At",
      "-c",
      "SELECT coalesce(extract(epoch from now() - min(created_on)), 0)::int FROM pgboss.job WHERE state IN ('created', 'retry') AND start_after <= now()",
    ]);
    const age = Number(reply.stdout.trim());
    results.queue_age =
      reply.code === 0 && Number.isFinite(age)
        ? {
            ok: age <= LIMITS.queueAgeSeconds,
            detail: `oldest waiting job ${age} s`,
          }
        : { ok: false, detail: "could not read the job queue" };
  }

  try {
    const disk = await statfs(config.dataDir);
    const free = disk.bavail * disk.bsize;
    const total = disk.blocks * disk.bsize;
    const gib = (free / 1024 ** 3).toFixed(1);
    results.disk_space = {
      ok:
        free >= LIMITS.diskFreeBytes && free / total >= LIMITS.diskFreeFraction,
      detail: `${gib} GiB free (${Math.round((free / total) * 100)}%)`,
    };
  } catch {
    results.disk_space = { ok: false, detail: "could not read disk space" };
  }

  const latest = (await listBackups(config.backupDir))[0];
  if (!latest) {
    results.backup_age = { ok: false, detail: "no backup exists" };
  } else {
    const hours = (now.getTime() - latest.at.getTime()) / 3600000;
    results.backup_age = {
      ok: hours <= LIMITS.backupAgeHours,
      detail: `latest backup ${hours.toFixed(1)} h old`,
    };
  }
  return results;
}

// Pure decision step: compares this run with the last one and says which
// notifications to raise. A check that stays broken reminds every six hours.
export function evaluate(previous, results, now) {
  const next = {};
  const notifications = [];
  for (const [name, result] of Object.entries(results)) {
    const before = previous[name];
    if (result.ok) {
      next[name] = {
        ok: true,
        since: before?.ok ? before.since : now.toISOString(),
      };
      if (before && !before.ok)
        notifications.push({
          name,
          kind: "recovered",
          message: `${name} recovered`,
        });
    } else {
      const lastAlert =
        before && !before.ok ? Date.parse(before.alertedAt ?? before.since) : 0;
      const alert =
        !before ||
        before.ok ||
        now.getTime() - lastAlert >= LIMITS.repeatAlertHours * 3600000;
      next[name] = {
        ok: false,
        since: before && !before.ok ? before.since : now.toISOString(),
        alertedAt: alert ? now.toISOString() : before.alertedAt,
        detail: result.detail,
      };
      if (alert)
        notifications.push({
          name,
          kind: "failing",
          message: `${name} failing: ${result.detail}`,
        });
    }
  }
  return { state: next, notifications };
}

export function macNotify(message) {
  return new Promise((done) =>
    execFile(
      "osascript",
      [
        "-e",
        `display notification ${JSON.stringify(message)} with title "Rotavise"`,
      ],
      () => done(),
    ),
  );
}

async function appendStatus(dir, line) {
  const file = join(dir, "status.jsonl");
  try {
    if ((await stat(file)).size > LIMITS.statusLogBytes) {
      await rm(`${file}.2`, { force: true });
      await rename(`${file}.1`, `${file}.2`).catch(() => {});
      await rename(file, `${file}.1`);
    }
  } catch {
    // no log yet
  }
  await appendFile(file, JSON.stringify(line) + "\n");
}

export async function monitorOnce(
  config,
  {
    collect = collectChecks,
    notify = macNotify,
    mail = alertFromFile,
    now = new Date(),
  } = {},
) {
  await mkdir(config.monitorDir, { recursive: true, mode: 0o700 });
  const state = await readState(config);
  const results = await collect(config, state, now);
  let previous = {};
  try {
    previous = JSON.parse(
      await readFile(join(config.monitorDir, "state.json"), "utf8"),
    );
  } catch {
    // first run
  }
  const { state: next, notifications } = evaluate(previous, results, now);
  const failing = Object.entries(results)
    .filter(([, r]) => !r.ok)
    .map(([name]) => name);
  for (const item of notifications)
    await notify(`${item.message}. See docs/operations/RUNBOOK.md`);
  // SMTP is an explicit owner choice. File absence in an unconfigured stack
  // does not prevent local failure reporting; configured SMTP errors fail closed.
  if (notifications.length) {
    try {
      await mail(
        config,
        notifications.map((item) => item.message),
      );
    } catch {
      results.alert_mail = {
        ok: false,
        detail: "alert settings or SMTP unavailable",
      };
      failing.push("alert_mail");
      // Retry notifications on the next run instead of acknowledging delivery.
      for (const item of notifications) delete next[item.name];
    }
  }
  const partial = join(config.monitorDir, "state.json.partial");
  await writeFile(partial, JSON.stringify(next, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(partial, join(config.monitorDir, "state.json"));
  await appendStatus(config.monitorDir, {
    at: now.toISOString(),
    ok: failing.length === 0,
    failing,
    checks: Object.fromEntries(
      Object.entries(results).map(([name, r]) => [name, r.detail]),
    ),
  });
  return { results, notifications, failing };
}

export function reportOutcome(outcome, output = console.log) {
  for (const name of outcome.failing)
    output(
      `FAIL ${name}: ${typeof outcome.results[name].detail === "string" ? outcome.results[name].detail : "unavailable"}`,
    );
  output(
    JSON.stringify({
      ok: outcome.failing.length === 0,
      failing: outcome.failing,
    }),
  );
  return outcome.failing.length ? 1 : 0;
}

export async function main() {
  const outcome = await monitorOnce(settings());
  process.exitCode = reportOutcome(outcome);
}
