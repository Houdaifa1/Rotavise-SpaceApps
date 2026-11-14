import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { CatalogBundle } from "@rotavise/contracts";
import { validateProductionCatalog } from "../validation/validate-catalog.js";

// Key-sorted JSON; array order stays significant unless a caller sorts it.
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => compare(a, b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("CATALOG_INVALID");
  return serialized;
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function canonicalCatalogJson(catalog: CatalogBundle): string {
  return stable({
    ...catalog,
    sources: [...catalog.sources].sort((a, b) => compare(a.id, b.id)),
    regions: [...catalog.regions].sort((a, b) => compare(a.id, b.id)),
    profiles: [...catalog.profiles].sort((a, b) => compare(a.id, b.id)),
  });
}
export function prepareCatalog(input: unknown) {
  const catalog = validateProductionCatalog(input);
  const canonicalJson = canonicalCatalogJson(catalog);
  if (new TextEncoder().encode(canonicalJson).byteLength > 1048576)
    throw new Error("CATALOG_TOO_LARGE");
  return {
    catalog,
    canonicalJson,
    sha256: catalogContentHash(catalog),
  };
}
// Deterministic identity only; caller still selects structure/production validation.
export function catalogContentHash(catalog: CatalogBundle): string {
  return bytesToHex(
    sha256(new TextEncoder().encode(canonicalCatalogJson(catalog))),
  );
}
