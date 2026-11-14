import { createHash } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import { boundaryBox, cleanBoundary } from "./clean-boundary.js";

export const FTW_MOROCCO_URL =
  "https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=MA/Morocco.parquet";
export const boundaryImportManifestSchema = z.strictObject({
  format: z.literal("ftw-morocco-2025-1"),
  sourceUrl: z.literal(FTW_MOROCCO_URL),
  sourceEtag: z.string().min(1).max(200),
  license: z.literal("CC-BY-4.0"),
  attribution: z.literal(
    "Fields of The World (Robinson et al., 2026), CC BY 4.0",
  ),
  year: z.literal(2025),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  scope: z.enum(["morocco", "sample"]),
});
const featureSchema = z.strictObject({
  type: z.literal("Feature"),
  properties: z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/),
    year: z.literal(2025),
    confidence: z.number().finite().min(0).max(100).nullable(),
    areaSquareMetres: z.number().finite().positive(),
  }),
  geometry: z.unknown(),
});

// Import is an operator operation. Request handlers have no upstream network
// access and cannot import or change shared source data. A byte hash pins each
// export; a failed import rolls back the entire activation and all its rows.
export async function importBoundaries(
  pool: Pool,
  manifestRaw: unknown,
  lines: AsyncIterable<string>,
  { allowSample = false } = {},
) {
  const manifest = boundaryImportManifestSchema.parse(manifestRaw);
  if (manifest.scope === "sample" && !allowSample)
    throw new Error("SAMPLE_IMPORT_REQUIRES_EXPLICIT_FLAG");
  const client = await pool.connect();
  const hash = createHash("sha256");
  const report = {
    read: 0,
    retained: 0,
    dropped: 0,
    holesDropped: 0,
    simplified: 0,
    scope: manifest.scope,
    policy: "outer-ring-dp-5m-2pct-1",
  };
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1801026)");
    const existing = await client.query(
      "SELECT sha256 FROM boundary_datasets WHERE sha256=$1",
      [manifest.sha256],
    );
    if (existing.rowCount) throw new Error("DATASET_ALREADY_IMPORTED");
    await client.query(
      `INSERT INTO boundary_datasets(sha256,source_url,source_etag,license,attribution,year,report)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        manifest.sha256,
        manifest.sourceUrl,
        manifest.sourceEtag,
        manifest.license,
        manifest.attribution,
        manifest.year,
        report,
      ],
    );
    let batch: unknown[][] = [];
    const flush = async () => {
      if (!batch.length) return;
      const values: unknown[] = [];
      const tuples = batch.map((row) => {
        const offset = values.length;
        values.push(...row);
        return `(${row.map((_, i) => `$${offset + i + 1}${i === 3 ? "::box" : ""}`).join(",")})`;
      });
      await client.query(
        `INSERT INTO boundary_candidates(dataset_sha256,source_id,geometry,bounds,area_hectares,confidence,holes_dropped,area_change_percent) VALUES ${tuples.join(",")}`,
        values,
      );
      batch = [];
    };
    for await (const line of lines) {
      // Export format is UTF-8 NDJSON, LF terminated, no blank lines. Hash the
      // exact lines consumed, so an altered file cannot pass a prior hash pass.
      hash.update(line + "\n");
      if (Buffer.byteLength(line) > 2 * 1024 * 1024)
        throw new Error("IMPORT_LINE_TOO_LARGE");
      const feature = featureSchema.parse(JSON.parse(line));
      report.read++;
      const cleaned = cleanBoundary(feature.geometry);
      if (!cleaned) {
        report.dropped++;
        continue;
      }
      const [w, s, e, n] = boundaryBox(cleaned.geometry);
      // Broad source-partition envelope, not a claim about political borders.
      if (w < -17.1 || e > -0.9 || s < 20.7 || n > 36) {
        report.dropped++;
        continue;
      }
      report.retained++;
      report.holesDropped += cleaned.holesDropped;
      if (cleaned.areaChangePercent > 0.000001) report.simplified++;
      batch.push([
        manifest.sha256,
        feature.properties.id,
        cleaned.geometry,
        `(${w},${s}),(${e},${n})`,
        cleaned.areaHectares,
        feature.properties.confidence === null
          ? null
          : feature.properties.confidence / 100,
        cleaned.holesDropped,
        cleaned.areaChangePercent,
      ]);
      if (batch.length === 500) await flush();
    }
    await flush();
    if (hash.digest("hex") !== manifest.sha256)
      throw new Error("IMPORT_HASH_MISMATCH");
    if (report.retained === 0)
      throw new Error("IMPORT_HAS_NO_VALID_BOUNDARIES");
    await client.query(
      "UPDATE boundary_datasets SET active=false WHERE active",
    );
    await client.query(
      "UPDATE boundary_datasets SET active=true,report=$2 WHERE sha256=$1",
      [manifest.sha256, report],
    );
    await client.query("COMMIT");
    return report;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
