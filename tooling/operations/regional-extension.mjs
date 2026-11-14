import { readFile } from "node:fs/promises";
import { WaterStorageService } from "../../apps/server/dist/modules/earth-observations/application/water-storage.service.js";
import { CanopyBiomassService } from "../../apps/server/dist/modules/earth-observations/application/canopy-biomass.service.js";
export async function importRegionalExtension(pool, kind, file) {
  const data = JSON.parse(await readFile(file, "utf8"));
  const table =
    kind === "grace" ? "regional_water_storage" : "regional_gedi_biomass";
  const products = (
    await pool.query(
      `SELECT DISTINCT product FROM ${table} WHERE source_sha256=$1`,
      [data.sourceSha256],
    )
  ).rows;
  if (products.length > 1) throw Error("DUPLICATE_REGIONAL_PRODUCT_IDENTITY");
  // The old GRACE importer used the product label "grace". Same source bytes
  // must extend that product, not create a second copy under the file title.
  if (products[0]) data.product = products[0].product;
  return kind === "grace"
    ? new WaterStorageService(pool).import(data)
    : new CanopyBiomassService(pool).import(data);
}
