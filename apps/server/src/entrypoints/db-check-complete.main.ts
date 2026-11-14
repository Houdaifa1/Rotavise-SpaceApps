import { createPool } from "@rotavise/database";
import { loadConfig } from "../config/environment.js";
import { DataCompletenessService } from "../modules/health/data-completeness.js";

async function main() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  try {
    const result = await new DataCompletenessService(pool).check(true);
    console.table(result.datasets);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error("DATABASE_COMPLETENESS_CHECK_FAILED");
  process.exitCode = 1;
});
