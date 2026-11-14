// Loads the JSON written by grace-extract.py into regional_water_storage.
// Usage: pnpm grace:import .artifacts/grace-morocco.json
// Months already stored are left as they are, so running it twice is safe.
import { readFileSync } from "node:fs";
import { createPool } from "../../packages/database/dist/index.js";
import { WaterStorageService } from "../../apps/server/dist/modules/earth-observations/application/water-storage.service.js";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error("usage: pnpm grace:import <file.json>");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (the script reads .env for it)");
  process.exit(2);
}
const pool = createPool(process.env.DATABASE_URL);
try {
  const result = await new WaterStorageService(pool).import(
    JSON.parse(readFileSync(file, "utf8")),
  );
  console.log(
    `GRACE_IMPORTED cells=${result.cells} new_months=${result.inserted}`,
  );
} catch (error) {
  console.error("GRACE_IMPORT_FAILED", error?.issues ?? error?.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
