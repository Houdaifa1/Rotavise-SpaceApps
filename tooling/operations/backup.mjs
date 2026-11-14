import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  containerId,
  execInContainer,
  readState,
  settings,
  sha256File,
} from "./lib.mjs";

const COUNTS_SQL = `SELECT 'COUNT|' || table_schema || '.' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;`;

// One psql session kept open, so the row counts and the dump read the very same
// database snapshot even while the app keeps writing.
function psqlSession(container, user, database) {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      user,
      "-d",
      database,
      "-At",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let buffer = "";
  let errors = "";
  let exited = null;
  const listeners = new Set();
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (const listener of listeners) listener();
  });
  child.stderr.on("data", (chunk) => (errors += chunk));
  child.stdin.on("error", () => {
    /* close/error below rejects pending commands. */
  });
  child.on("error", (error) => {
    errors = error.code ?? "PSQL_START_FAILED";
    exited = -1;
    for (const listener of listeners) listener();
  });
  child.on("close", (code) => {
    exited = code ?? -1;
    for (const listener of listeners) listener();
  });
  return {
    send(sql) {
      const marker = `END_${randomUUID()}`;
      child.stdin.write(`${sql}\nSELECT '${marker}';\n`);
      return new Promise((resolveSend, reject) => {
        const check = () => {
          const index = buffer.indexOf(marker);
          if (index >= 0) {
            listeners.delete(check);
            const output = buffer.slice(0, index);
            buffer = buffer.slice(index + marker.length);
            resolveSend(output);
          } else if (exited !== null) {
            listeners.delete(check);
            reject(
              new Error(`PSQL_SESSION_ENDED: ${errors.trim().slice(0, 300)}`),
            );
          }
        };
        listeners.add(check);
        check();
      });
    },
    async close() {
      child.stdin.end("COMMIT;\n\\q\n");
      await new Promise((done) =>
        exited !== null ? done() : child.on("close", done),
      );
    },
  };
}

export const backupStamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");

export function parseBackupStamp(name) {
  const match =
    /^rotavise-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.dump$/.exec(name);
  if (!match) return null;
  const at = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`,
  );
  return Number.isFinite(at.getTime()) &&
    `rotavise-${backupStamp(at)}.dump` === name
    ? at
    : null;
}

export async function listBackups(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  return names
    .map((name) => ({ name, at: parseBackupStamp(name) }))
    .filter((entry) => entry.at)
    .sort((a, b) => b.at - a.at);
}

// Removes backups older than the retention window but always keeps the newest.
export async function pruneBackups(
  dir,
  { retentionDays = 14, now = new Date(), protectedNames = [] } = {},
) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1)
    throw new Error("INVALID_RETENTION");
  const all = await listBackups(dir);
  const verified = [];
  for (const entry of all) {
    try {
      const file = join(dir, entry.name);
      const checksum = (await readFile(`${file}.sha256`, "utf8"))
        .trim()
        .split(/\s+/)[0];
      const manifest = JSON.parse(
        await readFile(`${file}.manifest.json`, "utf8"),
      );
      if (manifest.tables && checksum === (await sha256File(file)))
        verified.push(entry);
    } catch {
      /* Incomplete or damaged backups need manual review, never pruning. */
    }
  }
  const cutoff = now.getTime() - retentionDays * 86400000;
  const removed = [];
  for (const [index, entry] of verified.entries()) {
    if (
      index === 0 ||
      protectedNames.includes(entry.name) ||
      entry.at.getTime() >= cutoff
    )
      continue;
    for (const suffix of ["", ".sha256", ".manifest.json"])
      await rm(join(dir, entry.name + suffix), { force: true });
    removed.push(entry.name);
  }
  return removed;
}

export async function backup(options) {
  await mkdir(options.dir, { recursive: true, mode: 0o700 });
  const lock = join(options.dir, ".backup-lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("BACKUP_BUSY: another backup holds the lock");
    throw error;
  }
  try {
    return await createBackup(options);
  } finally {
    await rm(lock, { recursive: true });
  }
}

async function createBackup({
  container,
  user = "rotavise",
  database = "rotavise",
  dir,
  retentionDays = 14,
  now = new Date(),
  tag = null,
  protectedNames = [],
  compression = "gzip:6",
}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1)
    throw new Error("INVALID_RETENTION");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  if (!["gzip:6", "zstd:3"].includes(compression))
    throw new Error("INVALID_BACKUP_COMPRESSION");
  const name = `rotavise-${backupStamp(now)}.dump`;
  const target = join(dir, name);
  const partial = `${target}.partial`;
  if (
    await stat(target).then(
      () => true,
      () => false,
    )
  )
    throw new Error(`BACKUP_EXISTS: ${name} was not overwritten`);
  const session = psqlSession(container, user, database);
  let manifest;
  try {
    await session.send("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;");
    const snapshotOut = await session.send(
      "SELECT 'SNAP|' || pg_export_snapshot();",
    );
    const snapshot = /SNAP\|(\S+)/.exec(snapshotOut)?.[1];
    if (!snapshot) throw new Error("SNAPSHOT_UNAVAILABLE");
    const tables = {};
    for (const line of (await session.send(COUNTS_SQL)).split("\n")) {
      const [kind, table, count] = line.split("|");
      if (kind === "COUNT") tables[table] = Number(count);
    }
    const migrationOut = await session.send(
      "SELECT 'MIG|' || count(*) FROM drizzle.__drizzle_migrations;",
    );
    const versionOut = await session.send("SELECT 'VER|' || version();");
    manifest = {
      createdAt: now.toISOString(),
      tag,
      database,
      postgres: /VER\|(.+)/.exec(versionOut)?.[1] ?? null,
      migrations: Number(/MIG\|(\d+)/.exec(migrationOut)?.[1] ?? NaN),
      tables,
    };
    const out = createWriteStream(partial, { mode: 0o600 });
    const dump = await execInContainer(
      container,
      [
        "pg_dump",
        "-U",
        user,
        "-d",
        database,
        "-Fc",
        `--compress=${compression}`,
        `--snapshot=${snapshot}`,
      ],
      { stdout: out },
    );
    if (dump.code !== 0)
      throw new Error(`PG_DUMP_FAILED: ${dump.stderr.trim().slice(0, 300)}`);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  } finally {
    await session.close().catch(() => {});
  }
  if ((await stat(partial)).size < 1024) {
    await rm(partial, { force: true });
    throw new Error("BACKUP_TOO_SMALL");
  }
  const listing = await execInContainer(container, ["pg_restore", "--list"], {
    stdin: createReadStream(partial),
  });
  if (listing.code !== 0 || !listing.stdout.includes("TABLE DATA")) {
    await rm(partial, { force: true });
    throw new Error("BACKUP_UNREADABLE");
  }
  await rename(partial, target);
  const sha256 = await sha256File(target);
  await writeFile(`${target}.sha256`, `${sha256}  ${name}\n`, { mode: 0o600 });
  await writeFile(
    `${target}.manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
    {
      mode: 0o600,
    },
  );
  const removed = await pruneBackups(dir, {
    retentionDays,
    now,
    protectedNames,
  });
  return { file: target, name, sha256, manifest, removed };
}

export async function main() {
  const config = settings();
  const state = await readState(config);
  const tag = state.current;
  if (!tag) throw new Error("NOT_DEPLOYED: run pnpm ops:upgrade first");
  const container = containerId(config, tag, "postgres");
  if (!container) throw new Error("DATABASE_NOT_RUNNING: run pnpm ops:up");
  const result = await backup({
    container,
    dir: config.backupDir,
    retentionDays: config.retentionDays,
    tag,
  });
  console.log(
    JSON.stringify({
      event: "backup_done",
      file: result.file,
      sha256: result.sha256,
      tables: Object.keys(result.manifest.tables).length,
      removed: result.removed,
    }),
  );
}
