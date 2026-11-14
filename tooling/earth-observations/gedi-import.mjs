// Loads the JSON written by gedi-extract.py into regional_gedi_biomass.
// Usage: pnpm gedi:import .artifacts/gedi-morocco.json
// Cells already stored are left as they are, so running it twice is safe.
import { readFileSync } from "node:fs";
import { createPool } from "../../packages/database/dist/index.js";
import { CanopyBiomassService } from "../../apps/server/dist/modules/earth-observations/application/canopy-biomass.service.js";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error("usage: pnpm gedi:import <file.json>");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (the script reads .env for it)");
  process.exit(2);
}
const pool = createPool(process.env.DATABASE_URL);
try {
  const result = await new CanopyBiomassService(pool).import(
    JSON.parse(readFileSync(file, "utf8")),
  );
  console.log(
    `GEDI_IMPORTED cells=${result.cells} new_cells=${result.inserted}`,
  );
} catch (error) {
  console.error("GEDI_IMPORT_FAILED", error?.issues ?? error?.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
