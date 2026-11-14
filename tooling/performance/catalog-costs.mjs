// Times the per-call catalog work the API and worker repeat for a stored release.
// Usage: node tooling/performance/catalog-costs.mjs [release]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  prepareCatalogV2,
  validateProductionCatalogV2,
  catalogV2ContentHash,
} from "../../packages/catalog/dist/index.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";

const release = process.argv[2] ?? "0.11.0";
const catalog = await loadCatalogRelease(`data/catalog/releases/${release}`);
const time = (label, fn, runs = 3) => {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    fn();
    out.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  console.log(
    JSON.stringify({
      step: label,
      release,
      ms: out.map((v) => Math.round(v)),
    }),
  );
};
const body = JSON.parse(JSON.stringify(catalog));
time("JSON.parse(body) as pg does for jsonb", () =>
  JSON.parse(JSON.stringify(body)),
);
time("prepareCatalogV2 (validate, canonical json, hash)", () =>
  prepareCatalogV2(body),
);
time("validateProductionCatalogV2", () => validateProductionCatalogV2(body));
time("catalogV2ContentHash", () => catalogV2ContentHash(body));
void createHash;
void readFileSync;
