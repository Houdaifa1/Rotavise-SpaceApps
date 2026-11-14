// Operator-only import into the explicitly selected database; never auto-runs.
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createPool } from "../../packages/database/dist/index.js";
import { importBoundaries } from "../../apps/server/dist/modules/field-boundaries/application/import-boundaries.js";

const [manifestPath, ndjsonPath, sampleFlag, ...extra] = process.argv.slice(2);
if (
  !manifestPath ||
  !ndjsonPath ||
  extra.length ||
  (sampleFlag && sampleFlag !== "--allow-sample")
)
  throw new Error(
    "Usage: node --env-file=.env tooling/field-boundaries/import.mjs MANIFEST NDJSON [--allow-sample]",
  );
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
// A production DB should only receive the country export; the sample flag is
// intentionally unavailable in production. The CLI does not apply migrations.
if (sampleFlag && process.env.NODE_ENV === "production")
  throw new Error("SAMPLE_IMPORT_FORBIDDEN_IN_PRODUCTION");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
// Open the stream lazily after the importer has acquired its DB transaction.
// An eager readline interface can emit/discard lines during those awaits.
async function* lines() {
  const input = createReadStream(ndjsonPath, { encoding: "utf8" });
  const reader = createInterface({ input, crlfDelay: Infinity });
  try {
    yield* reader;
  } finally {
    reader.close();
    input.destroy();
  }
}
const pool = createPool(process.env.DATABASE_URL);
try {
  const report = await importBoundaries(pool, manifest, lines(), {
    allowSample: sampleFlag === "--allow-sample",
  });
  console.log(JSON.stringify({ datasetSha256: manifest.sha256, ...report }));
} finally {
  await pool.end();
}
