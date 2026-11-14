import { installFatalErrorLogging } from "../common/logging/operations-log.js";
import { createPool, migrateApplication } from "@rotavise/database";
import { loadConfig } from "../config/environment.js";
import { migrateQueue } from "../infrastructure/queue/pg-boss.js";
installFatalErrorLogging();
async function main() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  try {
    await migrateApplication(pool);
    await migrateQueue(config);
    console.log(JSON.stringify({ event: "migrations_applied" }));
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error("MIGRATION_FAILED");
  process.exitCode = 1;
});
