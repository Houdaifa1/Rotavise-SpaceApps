import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { createPool } from "../../packages/database/dist/index.js";

export const container =
  process.env.ROTAVISE_DB_CONTAINER ?? "rotavise-dev-postgres-1";
export function databaseConfig(database = "rotavise", readOnly = false) {
  const config = loadConfig();
  const url = new URL(config.DATABASE_URL);
  url.pathname = `/${database}`;
  if (readOnly)
    url.searchParams.set("options", "-c default_transaction_read_only=on");
  return { ...config, DATABASE_URL: url.href };
}
export function databasePool(database = "rotavise", readOnly = false) {
  return createPool(databaseConfig(database, readOnly).DATABASE_URL);
}
export function child(args, input = false) {
  const p = spawn("docker", ["exec", ...(input ? ["-i"] : []), ...args], {
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
  });
  let stderr = "";
  p.stderr.on("data", (b) => {
    stderr += b;
  });
  p.done = new Promise((resolve, reject) => {
    p.on("error", () => reject(Error("DATABASE_TOOL_START_FAILED")));
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            Error(`DATABASE_TOOL_FAILED exit=${code}: ${stderr.slice(0, 400)}`),
          ),
    );
  });
  return p;
}
export async function copyTable(source, table) {
  // pg_dump and psql are both PostgreSQL 18 in the same container. All types,
  // bytea, timestamps and IDs survive COPY unchanged; each table is atomic.
  const dump = child([
    "-e",
    "PGOPTIONS=-c default_transaction_read_only=on",
    container,
    "pg_dump",
    "-U",
    "rotavise",
    "-d",
    source,
    "--data-only",
    "--no-owner",
    "--no-privileges",
    `--table=public.${table}`,
  ]);
  const restore = child(
    [
      container,
      "psql",
      "-X",
      "-q",
      "-U",
      "rotavise",
      "-d",
      "rotavise",
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    true,
  );
  restore.stdout.resume();
  await Promise.all([
    pipeline(dump.stdout, restore.stdin),
    dump.done,
    restore.done,
  ]);
}
export async function fingerprint(
  database,
  table,
  order,
  where = "true",
  columns = "*",
) {
  // Hash inside the PostgreSQL container so multi-gigabyte raw evidence does
  // not make a round trip through Docker's host transport. pipefail retains
  // either command's failure. SQL and database names are separate arguments.
  const p = child([
    "-e",
    "PGOPTIONS=-c default_transaction_read_only=on",
    container,
    "bash",
    "-o",
    "pipefail",
    "-c",
    'psql -X -q -U rotavise -d "$1" -v ON_ERROR_STOP=1 -c "$2" | sha256sum',
    "--",
    database,
    `COPY (SELECT ${columns} FROM public.${table} WHERE ${where} ORDER BY ${order}) TO STDOUT WITH (FORMAT binary)`,
  ]);
  let output = "";
  for await (const chunk of p.stdout) output += chunk;
  await p.done;
  const digest = /^([a-f0-9]{64})\s+-\s*$/.exec(output)?.[1];
  if (!digest) throw Error("DATABASE_FINGERPRINT_INVALID");
  const pool = databasePool(database, true);
  try {
    return {
      rows: Number(
        (await pool.query(`SELECT count(*) n FROM ${table} WHERE ${where}`))
          .rows[0].n,
      ),
      sha256: digest,
    };
  } finally {
    await pool.end();
  }
}
export async function assertContainer(pool) {
  const local = (
    await pool.query(
      "SELECT system_identifier::text id FROM pg_control_system()",
    )
  ).rows[0].id;
  const p = child([
    container,
    "psql",
    "-X",
    "-At",
    "-U",
    "rotavise",
    "-d",
    "postgres",
    "-c",
    "SELECT system_identifier FROM pg_control_system()",
  ]);
  let id = "";
  for await (const b of p.stdout) id += b;
  await p.done;
  if (local !== id.trim())
    throw Error("CONFIG_DATABASE_IS_NOT_SELECTED_CONTAINER");
}
