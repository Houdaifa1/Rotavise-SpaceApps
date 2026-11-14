import { test, expect } from "@jest/globals";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  trustProxySetting,
} from "../../apps/server/dist/config/environment.js";
import { initEnvironment } from "../../tooling/operations/init.mjs";
import {
  parseEnvText,
  settings,
  sha256File,
  composeArgs,
} from "../../tooling/operations/lib.mjs";
import {
  backupStamp,
  parseBackupStamp,
  pruneBackups,
} from "../../tooling/operations/backup.mjs";
import {
  LIMITS,
  evaluate,
  monitorOnce,
  reportOutcome,
} from "../../tooling/operations/monitor.mjs";
import { metricChecks, sendAlert } from "../../tooling/operations/alerts.mjs";
import {
  jobs,
  plist,
  checkSchedulePrefix,
} from "../../tooling/operations/schedule.mjs";

const temp = () => mkdtemp(join(tmpdir(), "rotavise-ops-"));

test("ops:init writes a mode-600 file the server accepts, never overwrites, and uses fresh secrets each time", async () => {
  const dir = await temp();
  const first = join(dir, "a.env"),
    second = join(dir, "b.env");
  await initEnvironment({ file: first });
  await initEnvironment({ file: second });
  expect((await stat(first)).mode & 0o777).toBe(0o600);
  const text = await readFile(first, "utf8");
  const env = parseEnvText(text);
  expect(text).not.toMatch(/\{\{|@@/);
  const config = loadConfig(env);
  expect(config.NODE_ENV).toBe("production");
  expect(trustProxySetting(config)).toBe(1);
  expect(config.AUTH_ENABLED).toBe("false");
  expect(env.DATABASE_URL).toBe(
    `postgresql://rotavise:${env.POSTGRES_PASSWORD}@postgres:5432/rotavise`,
  );
  // The owner's lines stay off until filled in.
  for (const key of [
    "ANTHROPIC_API_KEY",
    "EARTHDATA_USERNAME",
    "SMTP_HOST",
    "GOOGLE_CLIENT_ID",
  ])
    expect(env[key]).toBeUndefined();
  expect(env.POSTGRES_PASSWORD).not.toBe(
    parseEnvText(await readFile(second, "utf8")).POSTGRES_PASSWORD,
  );
  expect(env.WEATHER_INTERNAL_TOKEN.length).toBeGreaterThanOrEqual(32);
  await expect(initEnvironment({ file: first })).rejects.toThrow(
    "ENV_FILE_EXISTS",
  );
  expect(await readFile(first, "utf8")).toBe(text);
});

test("the commented owner blocks in the template become valid settings when filled in", async () => {
  const dir = await temp();
  const file = join(dir, "c.env");
  await initEnvironment({ file });
  const filled = (await readFile(file, "utf8"))
    .replace("# ANTHROPIC_API_KEY=", "ANTHROPIC_API_KEY=sk-test-value")
    .replace("# AUTH_ENABLED=true", "AUTH_ENABLED=true")
    .replace(/# AUTH_SECRET=/, "AUTH_SECRET=")
    .replace(
      "# AUTH_BASE_URL=https://app.example.com",
      "AUTH_BASE_URL=https://app.example.com",
    )
    .replace(
      "# AUTH_TRUSTED_ORIGINS=https://app.example.com",
      "AUTH_TRUSTED_ORIGINS=https://app.example.com",
    )
    .replace("# GOOGLE_CLIENT_ID=", "GOOGLE_CLIENT_ID=google-client-id-value")
    .replace(
      "# GOOGLE_CLIENT_SECRET=",
      "GOOGLE_CLIENT_SECRET=google-secret-value",
    )
    .replace("# SMTP_HOST=", "SMTP_HOST=smtp.example.com")
    .replace("# SMTP_PORT=465", "SMTP_PORT=465")
    .replace("# SMTP_TLS=implicit", "SMTP_TLS=implicit")
    .replace("# SMTP_USER=", "SMTP_USER=resend")
    .replace("# SMTP_PASSWORD=", "SMTP_PASSWORD=re_test_value")
    .replace("# MAIL_FROM=", "MAIL_FROM=hello@example.com");
  const config = loadConfig(parseEnvText(filled));
  expect(config.AUTH_ENABLED).toBe("true");
  expect(config.GOOGLE_CLIENT_ID).toBe("google-client-id-value");
});

test("the compose file keeps its production promises", async () => {
  for (const file of [".gitignore", ".dockerignore"])
    expect((await readFile(file, "utf8")).split("\n")).toContain(
      ".env.staging",
    );
  const text = await readFile("infra/production/compose.yaml", "utf8");
  const ports = [...text.matchAll(/^\s+- "([^"]*:\d+)"$/gm)].map((m) => m[1]);
  expect(ports.length).toBe(1);
  expect(ports[0]).toMatch(/^127\.0\.0\.1:/);
  expect(text).not.toMatch(/:latest|0\.0\.0\.0/);
  for (const image of text.matchAll(/image: (postgres[^\n]*)/g))
    expect(image[1]).toContain("@sha256:");
  expect(text.match(/restart: unless-stopped/g).length).toBe(5);
  expect(text.match(/read_only: true/g).length).toBeGreaterThanOrEqual(4);
  expect(text).toMatch(/internal:\s*\n\s+internal: true/);
  expect(text).toContain("max-size");
  expect(text).toContain("mem_limit");
  for (const dockerfile of [
    "infra/production/web.Dockerfile",
    "infra/docker/server.Dockerfile",
    "infra/docker/science.Dockerfile",
  ])
    for (const from of (await readFile(dockerfile, "utf8")).matchAll(
      /^FROM (\S+)/gm,
    ))
      expect(from[1]).toMatch(/@sha256:[a-f0-9]{64}$/);
});

test("backup names round-trip and retention keeps 14 days plus the newest backup", async () => {
  const now = new Date("2026-11-07T00:00:00Z");
  expect(parseBackupStamp(`rotavise-${backupStamp(now)}.dump`)).toEqual(now);
  expect(parseBackupStamp("notes.txt")).toBeNull();
  expect(parseBackupStamp("rotavise-20260231T000000Z.dump")).toBeNull();
  expect(parseBackupStamp("rotavise-20261301T000000Z.dump")).toBeNull();
  const dir = await temp();
  const make = async (daysOld) => {
    const name = `rotavise-${backupStamp(new Date(now.getTime() - daysOld * 86400000))}.dump`;
    for (const suffix of ["", ".sha256", ".manifest.json"])
      await writeFile(
        join(dir, name + suffix),
        suffix === ".manifest.json" ? JSON.stringify({ tables: {} }) : "x",
      );
    await writeFile(
      join(dir, name + ".sha256"),
      await sha256File(join(dir, name)),
    );
    return name;
  };
  const kept = [await make(0), await make(1), await make(13), await make(14)];
  const dropped = [await make(15), await make(30), await make(90)];
  const removed = await pruneBackups(dir, { retentionDays: 14, now });
  expect(removed.sort()).toEqual(dropped.sort());
  const left = await readdir(dir);
  for (const name of kept) expect(left).toContain(name);
  for (const name of dropped) {
    expect(left).not.toContain(name);
    expect(left).not.toContain(name + ".sha256");
  }
  // Everything older than the window: the newest one is never deleted.
  const old = await temp();
  const stale = `rotavise-${backupStamp(new Date("2025-01-01T00:00:00Z"))}.dump`;
  await writeFile(join(old, stale), "x");
  expect(await pruneBackups(old, { retentionDays: 14, now })).toEqual([]);
});

test("monitor raises one alert when a check fails, repeats only every six hours, and says when it recovers", () => {
  const t = (h) => new Date(Date.UTC(2026, 10, 7, h));
  const ok = { ok: true, detail: "fine" };
  const bad = { ok: false, detail: "HTTP 503" };
  let state = {};
  let out = evaluate(state, { api_ready: ok }, t(0));
  expect(out.notifications).toEqual([]);
  state = out.state;
  out = evaluate(state, { api_ready: bad }, t(1));
  expect(out.notifications.map((n) => n.kind)).toEqual(["failing"]);
  state = out.state;
  expect(evaluate(state, { api_ready: bad }, t(2)).notifications).toEqual([]);
  expect(
    evaluate(state, { api_ready: bad }, t(1 + LIMITS.repeatAlertHours))
      .notifications.length,
  ).toBe(1);
  out = evaluate(state, { api_ready: ok }, t(3));
  expect(out.notifications.map((n) => n.kind)).toEqual(["recovered"]);
  // A brand-new check that is broken from the first run still alerts.
  expect(evaluate({}, { backup_age: bad }, t(0)).notifications.length).toBe(1);
});

test("monitorOnce keeps a status log, rotates it and notifies only on changes", async () => {
  const dir = await temp();
  const config = settings({ ROTAVISE_DATA_DIR: dir });
  const sent = [];
  const notify = async (message) => sent.push(message);
  const run = (api, at) =>
    monitorOnce(config, {
      notify,
      mail: async () => ({ sent: false }),
      now: new Date(Date.UTC(2026, 10, 7, 0, at)),
      collect: async () => ({
        api_ready: { ok: api, detail: api ? "HTTP 200" : "HTTP 503" },
        disk_space: { ok: true, detail: "80.0 GiB free" },
      }),
    });
  await run(true, 0);
  expect(sent).toEqual([]);
  await run(false, 1);
  await run(false, 2);
  expect(sent.length).toBe(1);
  expect(sent[0]).toContain("api_ready failing: HTTP 503");
  await run(true, 3);
  expect(sent.length).toBe(2);
  expect(sent[1]).toContain("api_ready recovered");
  const lines = (
    await readFile(join(config.monitorDir, "status.jsonl"), "utf8")
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(lines.map((line) => line.ok)).toEqual([true, false, false, true]);
  expect(lines[1].failing).toEqual(["api_ready"]);
  await writeFile(
    join(config.monitorDir, "status.jsonl"),
    "x".repeat(LIMITS.statusLogBytes + 10),
  );
  await run(true, 4);
  expect((await readdir(config.monitorDir)).sort()).toEqual([
    "state.json",
    "status.jsonl",
    "status.jsonl.1",
  ]);
});

test("the launchd jobs are valid property lists with the schedule and environment they need", async () => {
  const dir = await temp();
  const config = settings({ ROTAVISE_DATA_DIR: dir, ROTAVISE_PROJECT: "x" });
  const [backup, monitor] = jobs();
  const backupText = plist(backup, config, "/usr/local/bin/node");
  const monitorText = plist(monitor, config, "/usr/local/bin/node");
  expect(backupText).toContain("<key>StartCalendarInterval</key>");
  expect(backupText).toContain("<key>Hour</key><integer>2</integer>");
  expect(monitorText).toContain(
    "<key>StartInterval</key><integer>60</integer>",
  );
  expect(monitorText).toContain("tooling/operations/ops.mjs");
  expect(monitorText).toContain(dir);
  expect(monitorText).toContain(
    "/Applications/Docker.app/Contents/Resources/bin",
  );
  if (process.platform === "darwin") {
    await mkdir(dir, { recursive: true });
    for (const [name, text] of [
      ["backup.plist", backupText],
      ["monitor.plist", monitorText],
    ]) {
      await writeFile(join(dir, name), text);
      expect(
        execFileSync("plutil", ["-lint", join(dir, name)], {
          encoding: "utf8",
        }),
      ).toContain("OK");
    }
  }
});

test("staging settings cannot reuse production defaults and carry the override to compose", () => {
  const prod = settings({}),
    stage = settings({ ROTAVISE_ENVIRONMENT: "staging" });
  expect(() => checkSchedulePrefix("local.rotavise", stage)).toThrow(
    "STAGING_SCHEDULE_PREFIX_REQUIRED",
  );
  expect(() => jobs("../../escape")).toThrow("INVALID_SCHEDULE_PREFIX");
  expect(stage.project).toBe("rotavise-staging");
  expect(stage.dataDir).not.toBe(prod.dataDir);
  expect(stage.envFile).not.toBe(prod.envFile);
  expect(stage.proxyPort).not.toBe(prod.proxyPort);
  expect(composeArgs(stage, ["config"])).toContain(stage.composeOverride);
  for (const [key, value] of [
    ["ROTAVISE_PROJECT", prod.project],
    ["ROTAVISE_DATA_DIR", prod.dataDir],
    ["ROTAVISE_ENV_FILE", prod.envFile],
    ["PROXY_PORT", String(prod.proxyPort)],
  ])
    expect(() =>
      settings({ ROTAVISE_ENVIRONMENT: "staging", [key]: value }),
    ).toThrow("STAGING_PRODUCTION_COLLISION");
});

test("retention keeps a verified copy when a newer file is incomplete or damaged and honors restore pins", async () => {
  const dir = await temp(),
    now = new Date("2026-11-10T00:00:00Z");
  const names = [
    "20250101T000000Z",
    "20250102T000000Z",
    "20250103T000000Z",
  ].map((stamp) => `rotavise-${stamp}.dump`);
  for (const name of names) {
    await writeFile(join(dir, name), "synthetic-test-backup");
    await writeFile(
      join(dir, name + ".sha256"),
      await sha256File(join(dir, name)),
    );
    await writeFile(
      join(dir, name + ".manifest.json"),
      JSON.stringify({ tables: {} }),
    );
  }
  await writeFile(join(dir, names[2]), "damaged");
  expect(await pruneBackups(dir, { now, protectedNames: [names[0]] })).toEqual(
    [],
  );
  expect(await pruneBackups(dir, { now })).toEqual([names[0]]);
  expect(await readdir(dir)).toContain(names[1]);
  expect(await readdir(dir)).toContain(names[2]);
  await expect(pruneBackups(dir, { retentionDays: NaN })).rejects.toThrow(
    "INVALID_RETENTION",
  );
});

test("metric alert policies are explicit, validate provider IDs and fail for retained failures or failed tiles", () => {
  const metrics = {
    queue: { depth: 2, active: 1 },
    failedJobs: [],
    climateTiles: [],
    ingests: [
      { provider: "nasa-power", lastSuccessAt: "2026-11-09T00:00:00.000Z" },
    ],
  };
  expect(Object.values(metricChecks(metrics)).every((c) => c.ok)).toBe(true);
  const policy = {
    OPS_QUEUE_DEPTH_LIMIT: "1",
    OPS_INGEST_MAX_AGE_HOURS: '{"nasa-power":1,"gpm":1}',
  };
  const checks = metricChecks(
    metrics,
    policy,
    new Date("2026-11-10T00:00:00Z"),
  );
  expect(checks.queue_depth.ok).toBe(false);
  expect(checks["ingest_nasa-power"].ok).toBe(false);
  expect(checks.ingest_gpm.ok).toBe(false);
  expect(() =>
    metricChecks(metrics, { OPS_INGEST_MAX_AGE_HOURS: '{"unknown":1}' }),
  ).toThrow();
  expect(() =>
    metricChecks(metrics, { OPS_INGEST_MAX_AGE_HOURS: "bad-json" }),
  ).toThrow();
  expect(
    metricChecks({ ...metrics, failedJobs: [{ count: 1 }] }).failed_jobs.ok,
  ).toBe(false);
  expect(
    metricChecks({ ...metrics, climateTiles: [{ status: "failed", count: 1 }] })
      .climate_tiles.ok,
  ).toBe(false);
});

test("alert output returns real success/failure exit codes and SMTP stays off without explicit configuration", async () => {
  const lines = [];
  expect(
    reportOutcome(
      {
        failing: ["failed_jobs"],
        results: { failed_jobs: { ok: false, detail: "1 retained failure" } },
      },
      (line) => lines.push(line),
    ),
  ).toBe(1);
  expect(lines[0]).toBe("FAIL failed_jobs: 1 retained failure");
  expect(reportOutcome({ failing: [], results: {} }, () => {})).toBe(0);
  // This factory never connects to a server: tests must never send mail.
  let calls = 0,
    closed = 0;
  const factory = (options) => {
    expect(options.requireTLS).toBe(true);
    return {
      sendMail: async (message) => {
        calls += 1;
        expect(message.text).toBe("failed_jobs failing");
        return { accepted: ["synthetic"], rejected: [] };
      },
      close: () => {
        closed += 1;
      },
    };
  };
  expect(
    await sendAlert({}, ["failed_jobs failing"], () => {
      throw new Error("must stay off");
    }),
  ).toEqual({ sent: false });
  await expect(
    sendAlert({ OPS_ALERT_TO: "owner@example.test" }, ["fail"], factory),
  ).rejects.toThrow("ALERT_SMTP_CONFIG_INVALID");
  const env = {
    OPS_ALERT_TO: "owner@example.test",
    MAIL_FROM: "ops@example.test",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_TLS: "starttls",
  };
  expect(await sendAlert(env, ["failed_jobs failing"], factory)).toEqual({
    sent: true,
  });
  expect(calls).toBe(1);
  expect(closed).toBe(1);
  await expect(
    sendAlert(env, ["fail"], () => ({
      sendMail: async () => {
        throw new Error("private credential");
      },
      close: () => {},
    })),
  ).rejects.toThrow("ALERT_MAIL_DELIVERY_FAILED");
  const output = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import { installErrorLogging, loggedHandler } from './apps/server/dist/common/logging/operations-log.js';
    installErrorLogging();
    console.error(new Error('private@example.test 32.123456789'));
    console.error('DATABASE_UNAVAILABLE', {email:'private@example.test'});
    await loggedHandler(async()=>{throw new Error('private@example.test')})([]).catch(()=>{});
  `,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  expect(output.status).toBe(0);
  expect(output.stdout).toBe("");
  expect(output.stderr).not.toMatch(/private@example.test|32.123456789/);
  const logs = output.stderr
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(logs.map((row) => row.code)).toEqual([
    "INTERNAL_ERROR",
    "DATABASE_UNAVAILABLE",
    "CALCULATION_FAILED",
  ]);
  expect(logs[2].event).toBe("job_failure");
});

test("failed SMTP delivery is reported, logged and retried on the next monitor run", async () => {
  const config = settings({ ROTAVISE_DATA_DIR: await temp() });
  let attempts = 0;
  const run = () =>
    monitorOnce(config, {
      collect: async () => ({
        failed_jobs: { ok: false, detail: "1 retained failure" },
      }),
      notify: async () => {},
      mail: async () => {
        attempts += 1;
        throw new Error("synthetic SMTP failure");
      },
    });
  expect((await run()).failing).toEqual(["failed_jobs", "alert_mail"]);
  expect((await run()).failing).toEqual(["failed_jobs", "alert_mail"]);
  expect(attempts).toBe(2);
  const lines = (
    await readFile(join(config.monitorDir, "status.jsonl"), "utf8")
  )
    .trim()
    .split("\n")
    .map(JSON.parse);
  expect(lines.every((line) => line.failing.includes("alert_mail"))).toBe(true);
});

test("fatal errors emit only a safe JSON diagnostic and exit nonzero", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import { installFatalErrorLogging } from './apps/server/dist/common/logging/operations-log.js';
    installFatalErrorLogging();
    throw new Error('private-fatal@example.test latitude=32.123456789');
  `,
    ],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stderr.trim())).toMatchObject({
    level: "error",
    code: "INTERNAL_ERROR",
  });
  expect(result.stderr).not.toMatch(/private-fatal|32.123456789|Error:/);
});

test("the status command exits 1 with a clear failure for an undeployed disposable environment", async () => {
  const result = spawnSync(
    process.execPath,
    ["tooling/operations/ops.mjs", "status"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ROTAVISE_ENVIRONMENT: "staging",
        ROTAVISE_DATA_DIR: await temp(),
      },
    },
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("FAIL deployment: no deployed version");
});
