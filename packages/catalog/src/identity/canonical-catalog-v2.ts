import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { CatalogBundleV2 } from "@rotavise/contracts";
import { validateProductionCatalogV2 } from "../validation/validate-catalog-v2.js";
import { stable } from "./canonical-catalog.js";

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byId = <T extends { id: string }>(items: T[]) =>
  [...items].sort((a, b) => compare(a.id, b.id));
// Entity lists are sorted by id; rule and citation order stays significant.
export function canonicalCatalogV2Json(catalog: CatalogBundleV2): string {
  return stable({
    ...catalog,
    regions: byId(catalog.regions),
    sources: byId(catalog.sources),
    issues: byId(catalog.issues),
    profiles: byId(catalog.profiles),
    conflicts: byId(catalog.conflicts),
  });
}
export function catalogV2ContentHash(catalog: CatalogBundleV2): string {
  return bytesToHex(
    sha256(new TextEncoder().encode(canonicalCatalogV2Json(catalog))),
  );
}
// Region boundaries make format 2 larger than format 1; keep a firm ceiling.
export function prepareCatalogV2(input: unknown) {
  const catalog = validateProductionCatalogV2(input);
  const canonicalJson = canonicalCatalogV2Json(catalog);
  if (new TextEncoder().encode(canonicalJson).byteLength > 16777216)
    throw new Error("CATALOG_TOO_LARGE");
  return { catalog, canonicalJson, sha256: catalogV2ContentHash(catalog) };
}
