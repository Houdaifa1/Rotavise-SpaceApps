import { createReadStream, existsSync } from "node:fs";
import { basename } from "node:path";
import { backup, listBackups } from "./backup.mjs";
import { checksumMatches } from "./restore-drill.mjs";
import { collectChecks, reportOutcome } from "./monitor.mjs";
import {
  compose,
  composeInherit,
  containerHealth,
  containerId,
  docker,
  execInContainer,
  gitTag,
  imageExists,
  readState,
  settings,
  waitFor,
  writeState,
} from "./lib.mjs";

const SERVICES = ["postgres", "science", "api", "worker", "proxy"];
const IMAGES = ["rotavise-server", "rotavise-web", "rotavise-science"];

const say = (message) => console.log(message);
const origin = (config) => `http://127.0.0.1:${config.proxyPort}`;

export async function waitHealthy(
  config,
  tag,
  timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 240000),
) {
  await waitFor(
    () =>
      SERVICES.every((service) => {
        const id = containerId(config, tag, service);
        return id && containerHealth(id) === "healthy";
      }),
    { timeoutMs, everyMs: 3000, label: `all services healthy for ${tag}` },
  );
}

export async function smoke(config) {
  const failures = [];
  const home = await fetch(`${origin(config)}/`);
  if (home.status !== 200 || !(await home.text()).includes('id="root"'))
    failures.push("web app not served");
  for (const path of ["/api/v1/health/live", "/api/v1/health/ready"]) {
    const response = await fetch(origin(config) + path);
    if (response.status !== 200)
      failures.push(`${path} returned ${response.status}`);
  }
  if (failures.length) throw new Error(`SMOKE_FAILED: ${failures.join("; ")}`);
}

async function appliedMigrations(config, tag) {
  const id = containerId(config, tag, "postgres");
  if (!id) return null;
  const result = await execInContainer(id, [
    "psql",
    "-U",
    "rotavise",
    "-d",
    "rotavise",
    "-At",
    "-c",
    "SELECT count(*) FROM drizzle.__drizzle_migrations",
  ]);
  return result.code === 0 ? Number(result.stdout.trim()) : null;
}

export function imageMigrationCount(image) {
  return Number(
    docker(
      "run",
      "--rm",
      "--entrypoint",
      "node",
      image,
      "--input-type=module",
      "--eval",
      "import {readFileSync} from 'node:fs'; const u=new URL('../migrations/meta/_journal.json', import.meta.resolve('@rotavise/database')); console.log(JSON.parse(readFileSync(u,'utf8')).entries.length)",
    ),
  );
}

function requireEnvFile(config) {
  if (!existsSync(config.envFile))
    throw new Error(`ENV_MISSING: run pnpm ops:init (${config.envFile})`);
}

function pruneImages(keep) {
  const keepTags = new Set(keep.filter(Boolean));
  for (const image of docker(
    "images",
    "--format",
    "{{.Repository}}:{{.Tag}}",
  ).split("\n")) {
    const [repository, tag] = image.split(":");
    if (IMAGES.includes(repository) && !keepTags.has(tag)) {
      try {
        docker("rmi", image);
      } catch {
        // still in use or already removed
      }
    }
  }
}

export async function upgrade({
  allowDirty = false,
  tag: requested = null,
} = {}) {
  const config = settings();
  requireEnvFile(config);
  const state = await readState(config);
  const tag = requested ?? gitTag({ allowDirty });
  let backupName = null;
  if (state.current && containerId(config, state.current, "postgres")) {
    say(
      `Backing up the database before upgrading (${state.current} -> ${tag})...`,
    );
    const result = await backup({
      container: containerId(config, state.current, "postgres"),
      dir: config.backupDir,
      retentionDays: config.retentionDays,
      tag: state.current,
    });
    backupName = result.name;
    say(`Backup ${backupName} written and checked.`);
  } else {
    say(
      "No running database found: treating this as a first install, so no backup is taken.",
    );
  }
  say(`Building images tagged ${tag}...`);
  composeInherit(config, tag, ["build"]);
  const before = state.current
    ? await appliedMigrations(config, state.current)
    : 0;
  try {
    say(
      "Starting the new version (the migration and catalog import run first)...",
    );
    composeInherit(config, tag, ["up", "-d", "--remove-orphans"]);
    await waitHealthy(config, tag);
    await smoke(config);
  } catch (error) {
    say(`Upgrade failed: ${error.message}`);
    if (state.current) {
      const after = await appliedMigrations(config, tag);
      say(`Returning to ${state.current}...`);
      composeInherit(config, state.current, ["up", "-d", "--remove-orphans"]);
      pruneImages([
        state.current,
        state.previous,
        ...(state.history ?? []).slice(-3).map((entry) => entry.tag),
      ]);
      if (after !== null && before !== null && after > before)
        say(
          `WARNING: the failed upgrade applied ${after - before} database migration(s). ` +
            `The old version may need a restore: pnpm ops:rollback ${state.current} --restore=${backupName ?? "<backup file>"}`,
        );
    }
    throw error;
  }
  const history = [
    ...(state.history ?? []),
    { tag, at: new Date().toISOString(), backup: backupName },
  ].slice(-10);
  await writeState(config, {
    current: tag,
    previous: state.current ?? null,
    history,
  });
  pruneImages([
    tag,
    state.current,
    state.previous,
    ...history.slice(-3).map((entry) => entry.tag),
  ]);
  say(`Rotavise ${tag} is running at ${origin(config)}.`);
  return { tag, previous: state.current ?? null, backup: backupName };
}

export async function up({ recreate = false } = {}) {
  const config = settings();
  requireEnvFile(config);
  const { current } = await readState(config);
  if (!current) throw new Error("NOT_DEPLOYED: run pnpm ops:upgrade first");
  composeInherit(config, current, [
    "up",
    "-d",
    ...(recreate ? ["--force-recreate"] : []),
  ]);
  await waitHealthy(config, current);
  await smoke(config);
  say(`Rotavise ${current} is running at ${origin(config)}.`);
}

export async function down() {
  const config = settings();
  const { current } = await readState(config);
  if (!current) throw new Error("NOT_DEPLOYED");
  composeInherit(config, current, ["down"]);
  say("Stopped. The database volume and backups are kept.");
}

// Safety net: backs up the live database, then replaces it with a dump.
export async function restoreLive({ file, tag }) {
  const config = settings();
  const sums = await checksumMatches(file);
  if (sums.recorded !== sums.actual)
    throw new Error("BACKUP_CHECKSUM_MISMATCH: refusing to restore");
  const id = containerId(config, tag, "postgres");
  if (!id) throw new Error("DATABASE_NOT_RUNNING");
  {
    const safety = await backup({
      container: id,
      dir: config.backupDir,
      retentionDays: config.retentionDays,
      tag,
      protectedNames: [basename(file)],
    });
    say(`Safety backup of the current data: ${safety.name}`);
  }
  compose(config, tag, ["stop", "api", "worker", "proxy"]);
  const sql = (statement) =>
    execInContainer(id, [
      "psql",
      "-U",
      "rotavise",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ]);
  for (const statement of [
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'rotavise' AND pid <> pg_backend_pid()",
    "DROP DATABASE rotavise",
    "CREATE DATABASE rotavise OWNER rotavise",
  ]) {
    const result = await sql(statement);
    if (result.code !== 0)
      throw new Error(
        `RESTORE_PREPARE_FAILED: ${result.stderr.trim().slice(0, 200)}`,
      );
  }
  const restore = await execInContainer(
    id,
    [
      "pg_restore",
      "-U",
      "rotavise",
      "-d",
      "rotavise",
      "--no-owner",
      "--exit-on-error",
    ],
    { stdin: createReadStream(file) },
  );
  if (restore.code !== 0)
    throw new Error(`RESTORE_FAILED: ${restore.stderr.trim().slice(0, 300)}`);
  composeInherit(config, tag, ["up", "-d"]);
  await waitHealthy(config, tag);
  await smoke(config);
  say("Database restored and the app is running.");
}

export async function rollback({ tag, restore = null }) {
  const config = settings();
  requireEnvFile(config);
  const state = await readState(config);
  if (!tag)
    throw new Error(
      "USAGE: pnpm ops:rollback <tag> [--restore=<backup file name>]",
    );
  for (const repository of IMAGES)
    if (!imageExists(`${repository}:${tag}`))
      throw new Error(
        `IMAGE_MISSING: ${repository}:${tag} is no longer on this Mac`,
      );
  const applied = state.current
    ? await appliedMigrations(config, state.current)
    : null;
  const known = imageMigrationCount(`rotavise-server:${tag}`);
  if (applied !== null && applied > known) {
    if (!restore)
      throw new Error(
        `SCHEMA_NEWER: the database has ${applied} migrations but ${tag} only knows ${known}. ` +
          `Roll back together with a restore: pnpm ops:rollback ${tag} --restore=<backup file name> ` +
          "(data written since that backup is lost; a safety backup of the current data is taken first).",
      );
    say(
      `Restoring ${restore} first because the newer version changed the database.`,
    );
    await restoreLive({
      file: `${config.backupDir}/${restore}`,
      tag: state.current,
    });
  }
  composeInherit(config, tag, ["up", "-d", "--remove-orphans"]);
  await waitHealthy(config, tag);
  await smoke(config);
  const history = [
    ...(state.history ?? []),
    { tag, at: new Date().toISOString(), rollback: true },
  ].slice(-10);
  await writeState(config, {
    current: tag,
    previous: state.current ?? null,
    history,
  });
  say(`Rolled back to ${tag}.`);
}

export async function status() {
  const config = settings();
  const state = await readState(config);
  say(
    `Running version: ${state.current ?? "none"} (previous: ${state.previous ?? "none"})`,
  );
  say(`Address: ${origin(config)}`);
  if (!state.current) {
    say("FAIL deployment: no deployed version");
    process.exitCode = 1;
    return;
  }
  for (const service of SERVICES) {
    const id = containerId(config, state.current, service);
    say(`${service.padEnd(9)} ${id ? containerHealth(id) : "not running"}`);
  }
  const latest = (await listBackups(config.backupDir))[0];
  say(
    `Latest backup: ${latest ? `${latest.name} (${latest.at.toISOString()})` : "none"}`,
  );
  const apiContainer = containerId(config, state.current, "api");
  if (apiContainer) {
    const gate = await execInContainer(apiContainer, [
      "node",
      "dist/entrypoints/db-check-complete.main.js",
    ]);
    say(gate.stdout);
    if (gate.code !== 0) {
      say("FAIL database completeness (db:check-complete)");
      process.exitCode = 1;
      return;
    }
  }
  const results = await collectChecks(config, state);
  say(JSON.stringify({ checks: results }, null, 2));
  process.exitCode = reportOutcome({
    results,
    failing: Object.keys(results).filter((key) => !results[key].ok),
  });
}

export async function logs(service) {
  const config = settings();
  const { current } = await readState(config);
  if (!current) throw new Error("NOT_DEPLOYED");
  composeInherit(config, current, [
    "logs",
    "--tail",
    "200",
    ...(service ? [service] : []),
  ]);
}
