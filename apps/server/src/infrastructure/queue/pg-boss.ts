import { PgBoss } from "pg-boss";
import type { Config } from "../../config/environment.js";
export const QUEUE = "rotavise-infrastructure-echo";
export const PLAN_QUEUE = "rotavise-plan-intake";
export const PLANNING_QUEUE = "rotavise-planning";
export const SCENARIO_QUEUE = "rotavise-climate-scenarios";
export const OBSERVATION_QUEUE = "rotavise-observations";
export const EXTRACTION_QUEUE = "rotavise-extractions";
export function createBoss(config: Config, migrate = false, supervise = false) {
  const boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    schema: "pgboss",
    migrate,
    supervise,
    schedule: false,
    monitorIntervalSeconds: 1,
    superviseIntervalSeconds: 1,
    maintenanceIntervalSeconds: 1,
    connectionTimeoutMillis: 2000,
    application_name: "rotavise",
    options: migrate
      ? "-c statement_timeout=30000"
      : "-c statement_timeout=3000",
  });
  boss.on("error", () =>
    console.error(
      JSON.stringify({ event: "queue_error", code: "QUEUE_UNAVAILABLE" }),
    ),
  );
  return boss;
}
export async function migrateQueue(config: Config) {
  const boss = createBoss(config, true);
  try {
    await boss.start();
    await boss.createQueue(QUEUE, {
      retryLimit: 2,
      retryDelay: 1,
      expireInSeconds: 10,
      retentionSeconds: 86400,
      deleteAfterSeconds: 86400,
    });
    await boss.createQueue(PLAN_QUEUE, {
      retryLimit: 2,
      retryDelay: 1,
      expireInSeconds: 10,
      retentionSeconds: 86400,
      deleteAfterSeconds: 86400,
    });
    await boss.createQueue(PLANNING_QUEUE, {
      retryLimit: 2,
      retryDelay: 1,
      expireInSeconds: 900,
      retentionSeconds: 86400,
      deleteAfterSeconds: 86400,
    });
    // One queued and one active slice per tile (singletonKey); each slice
    // prepares for at most ten minutes, then queues the next one.
    // One queued and one active step per observation (singletonKey = id).
    await boss.createQueue(OBSERVATION_QUEUE, {
      policy: "stately",
      retryLimit: 3,
      retryDelay: 60,
      expireInSeconds: 900,
      retentionSeconds: 86400,
      deleteAfterSeconds: 86400,
    });
    await boss.createQueue(EXTRACTION_QUEUE, {
      policy: "stately",
      retryLimit: 3,
      retryDelay: 60,
      expireInSeconds: 900,
      retentionSeconds: 86400,
      deleteAfterSeconds: 86400,
    });
    await boss.createQueue(SCENARIO_QUEUE, {
      policy: "stately",
      retryLimit: 3,
      retryDelay: 60,
      expireInSeconds: 900,
      retentionSeconds: 86400,
      deleteAfterSeconds: 86400,
    });
  } finally {
    await boss.stop();
  }
}
