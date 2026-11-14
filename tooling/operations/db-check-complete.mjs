import { DataCompletenessService } from "../../apps/server/dist/modules/health/data-completeness.js";
import { databasePool } from "./database-tools.mjs";
const pool = databasePool("rotavise", true);
try {
  const result = await new DataCompletenessService(pool).check(true);
  console.table(result.datasets);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
} catch {
  console.error("DATABASE_COMPLETENESS_CHECK_FAILED");
  process.exitCode = 1;
} finally {
  await pool.end();
}
