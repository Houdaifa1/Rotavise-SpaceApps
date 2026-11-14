import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createPool } from "@rotavise/database";
import { catalogReadiness, CatalogValidationError } from "@rotavise/catalog";
import { loadConfig } from "../config/environment.js";
import {
  CatalogStore,
  CatalogStorageError,
} from "../modules/catalog/application/catalog-store.js";
import {
  loadCatalogRelease,
  CatalogReleaseError,
} from "../modules/catalog/importing/load-release.js";

const RELEASES = resolve("data/catalog/releases");
const semver = (v: string) => v.split(".").map(Number);
async function releaseDirectories() {
  const entries = await readdir(RELEASES, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const [x, y] = [semver(a), semver(b)];
      return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!;
    })
    .map((name) => join(RELEASES, name));
}
async function importRelease(store: CatalogStore, directory: string) {
  const catalog = await loadCatalogRelease(directory);
  const result = await store.import(catalog);
  const persisted = await store.get(catalog.id, catalog.version);
  if (!persisted || persisted.id !== result.id)
    throw new CatalogStorageError("CATALOG_STORED_INVALID");
  const common = {
    outcome: result.outcome,
    snapshotId: result.id,
    catalogId: catalog.id,
    version: catalog.version,
    format: persisted.format,
    sha256: result.sha256,
    importedAt: result.importedAt,
  };
  if (persisted.format === "1")
    return {
      ...common,
      profiles: persisted.catalog.profiles.map((p) => ({
        id: p.id,
        name: p.identity.name,
        review: p.review.status,
        readiness: catalogReadiness(
          persisted.catalog,
          p.id,
          "beni-mellal-tadla",
        ),
      })),
    };
  return {
    ...common,
    profiles: persisted.catalog.profiles.map((p) => ({
      id: p.id,
      name: p.identity.name,
      rules: p.rules.length,
      bindingRules: p.rules.filter((r) => r.severity !== "reference").length,
      gaps: p.gaps.map((g) => g.topic),
    })),
  };
}
// One directory argument imports that release; none imports every release in
// data/catalog/releases in version order. Imports are idempotent and append-only.
async function main() {
  if (process.argv.length > 3) throw new Error("CATALOG_ARGUMENT_INVALID");
  const single = process.argv[2];
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  try {
    const store = new CatalogStore(pool);
    if (single) {
      console.log(JSON.stringify(await importRelease(store, single), null, 2));
      return;
    }
    const results = [];
    for (const directory of await releaseDirectories())
      results.push(await importRelease(store, directory));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      error instanceof CatalogValidationError
        ? { code: error.code, paths: error.paths }
        : error instanceof CatalogReleaseError
          ? { code: error.code, file: error.file }
          : error instanceof CatalogStorageError
            ? { code: error.code }
            : { code: "CATALOG_IMPORT_FAILED" },
    ),
  );
  process.exitCode = 1;
});
