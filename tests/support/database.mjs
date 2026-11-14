import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createPool,
  migrateApplication,
} from "../../packages/database/dist/index.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import {
  migrateQueue,
  createBoss,
} from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { TOKEN } from "./token.mjs";
import { poll, freePort } from "./polling.mjs";
export const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export async function disposable() {
  // Outage tests stop and restart these databases, so they cannot use --rm.
  // Remove stopped ones from interrupted runs; the age filter leaves any
  // concurrent run's deliberately stopped database alone.
  docker(
    "container",
    "prune",
    "--force",
    "--filter",
    "label=rotavise.disposable=true",
    "--filter",
    "until=1h",
  );
  const name = `rotavise-test-${randomUUID()}`;
  const hostPort = await freePort();
  docker(
    "run",
    "-d",
    "--label",
    "rotavise.disposable=true",
    "--name",
    name,
    "-e",
    "POSTGRES_USER=rotavise",
    "-e",
    "POSTGRES_PASSWORD=disposable_only",
    "-e",
    "POSTGRES_DB=rotavise_test",
    "-p",
    `127.0.0.1:${hostPort}:5432`,
    "postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382",
  );
  const port = docker("port", name, "5432/tcp").split(":").at(-1);
  const url = `postgresql://rotavise:disposable_only@127.0.0.1:${port}/rotavise_test`;
  const pool = createPool(url);
  pool.on("error", () => console.error("TEST_DATABASE_DISCONNECTED"));
  try {
    await poll(() => pool.query("SELECT 1"), { label: "PostgreSQL 18" });
  } catch (error) {
    await pool.end();
    docker("rm", "-f", name);
    throw error;
  }
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: url,
    DEV_HARNESS_ENABLED: "true",
    DEV_HARNESS_TOKEN: TOKEN,
  });
  await migrateApplication(pool);
  await migrateQueue(config);
  const boss = createBoss(config);
  await boss.start();
  return {
    name,
    url,
    pool,
    config,
    boss,
    async close() {
      await boss.stop();
      await pool.end();
      docker("rm", "-f", name);
    },
  };
}
