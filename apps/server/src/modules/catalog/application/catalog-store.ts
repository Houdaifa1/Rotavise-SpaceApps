import type pg from "pg";
import { prepareCatalog, prepareCatalogV2 } from "@rotavise/catalog";

export class CatalogStorageError extends Error {
  constructor(
    public readonly code:
      | "CATALOG_STORAGE_UNAVAILABLE"
      | "CATALOG_VERSION_CONFLICT"
      | "CATALOG_STORED_INVALID",
  ) {
    super(code);
  }
}
type Row = {
  id: string;
  catalog_key: string;
  version: string;
  schema_version: string;
  content_sha256: string;
  body: unknown;
  imported_at: Date;
};
// Formats 1 and 2 are both immutable releases; format 1 stays readable for
// plans that pinned it.
export function prepareStoredCatalog(body: unknown) {
  const format2 =
    typeof body === "object" &&
    body !== null &&
    "schemaVersion" in body &&
    body.schemaVersion === "2";
  return format2
    ? { format: "2" as const, ...prepareCatalogV2(body) }
    : { format: "1" as const, ...prepareCatalog(body) };
}
type Prepared = ReturnType<typeof prepareStoredCatalog>;
// A stored release never changes, so its verified, prepared form is kept in
// memory under the row id, the hash stored with it and the row version (xmin,
// which every UPDATE of the row changes, including one that bypasses the
// immutability trigger). Only the first use reads, validates and hashes the
// multi-megabyte body; a row that was written again is read and verified again.
// The canonical JSON is dropped: nothing reads it after import.
export type VerifiedCatalog = Prepared extends infer P
  ? P extends { canonicalJson: string }
    ? Omit<P, "canonicalJson">
    : never
  : never;
function deepFreeze(value: unknown) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}
export type CatalogHead = Omit<Row, "body"> & {
  imported_at: Date;
  row_version: string;
};
const HEAD_COLUMNS =
  "id,catalog_key,version,schema_version,content_sha256,imported_at,xmin::text AS row_version";
const VERIFIED_LIMIT = 4;
const verified = new Map<string, VerifiedCatalog>();
type Reader = {
  query: <T extends pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => Promise<pg.QueryResult<T>>;
};
// Fails when the stored body is invalid, or does not hash to the stored hash,
// or does not belong to the row it is stored under.
export async function verifiedCatalog(
  db: Reader,
  head: CatalogHead,
): Promise<VerifiedCatalog> {
  const key = `${head.id}|${head.content_sha256}|${head.row_version}`;
  const known = verified.get(key);
  if (known) return known;
  const stored = (
    await db
      .query<{ body: unknown }>(
        "SELECT body FROM catalog_versions WHERE id=$1",
        [head.id],
      )
      .catch(() => {
        throw new CatalogStorageError("CATALOG_STORAGE_UNAVAILABLE");
      })
  ).rows[0];
  if (!stored) throw new Error("MISSING");
  const { canonicalJson: _unused, ...prepared } = prepareStoredCatalog(
    stored.body,
  );
  void _unused;
  if (
    prepared.sha256 !== head.content_sha256 ||
    prepared.catalog.id !== head.catalog_key ||
    prepared.catalog.version !== head.version ||
    prepared.catalog.schemaVersion !== head.schema_version
  )
    throw new Error("MISMATCH");
  if (verified.size >= VERIFIED_LIMIT)
    verified.delete(verified.keys().next().value!);
  // Shared between requests, so it must never change: a write would throw.
  deepFreeze(prepared.catalog);
  verified.set(key, prepared as VerifiedCatalog);
  return prepared as VerifiedCatalog;
}
export async function catalogHeadById(db: Reader, id: string) {
  return (
    await db.query<CatalogHead>(
      `SELECT ${HEAD_COLUMNS} FROM catalog_versions WHERE id=$1`,
      [id],
    )
  ).rows[0];
}
export async function catalogHeadByVersion(
  db: Reader,
  catalogKey: string,
  version: string,
) {
  return (
    await db.query<CatalogHead>(
      `SELECT ${HEAD_COLUMNS} FROM catalog_versions WHERE catalog_key=$1 AND version=$2`,
      [catalogKey, version],
    )
  ).rows[0];
}
function snapshot(row: Row) {
  try {
    const prepared = prepareStoredCatalog(row.body);
    if (
      prepared.sha256 !== row.content_sha256 ||
      prepared.catalog.id !== row.catalog_key ||
      prepared.catalog.version !== row.version ||
      prepared.catalog.schemaVersion !== row.schema_version
    )
      throw new Error("MISMATCH");
    return {
      id: row.id,
      ...(prepared.format === "2"
        ? { format: "2" as const, catalog: prepared.catalog }
        : { format: "1" as const, catalog: prepared.catalog }),
      sha256: prepared.sha256,
      importedAt: row.imported_at.toISOString(),
    };
  } catch {
    throw new CatalogStorageError("CATALOG_STORED_INVALID");
  }
}
export class CatalogStore {
  constructor(private readonly pool: pg.Pool) {}
  async import(input: unknown) {
    const prepared = prepareStoredCatalog(input);
    const client = await this.pool.connect().catch(() => {
      throw new CatalogStorageError("CATALOG_STORAGE_UNAVAILABLE");
    });
    let releaseError: Error | undefined;
    // pg-pool handles idle-client errors; checked-out clients need their own
    // listener so a connection lost between awaited statements cannot crash Node.
    const onConnectionError = () => {
      releaseError = new Error("CATALOG_CONNECTION_FAILED");
    };
    client.on("error", onConnectionError);
    try {
      await client.query("BEGIN");
      // Server cancellation must precede the pool's 4-second client timeout.
      await client.query("SET LOCAL statement_timeout = '3s'");
      const inserted = await client.query<Row>(
        "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(catalog_key,version) DO NOTHING RETURNING *",
        [
          prepared.catalog.id,
          prepared.catalog.version,
          prepared.catalog.schemaVersion,
          prepared.sha256,
          prepared.canonicalJson,
        ],
      );
      const row =
        inserted.rows[0] ??
        (
          await client.query<Row>(
            "SELECT * FROM catalog_versions WHERE catalog_key=$1 AND version=$2",
            [prepared.catalog.id, prepared.catalog.version],
          )
        ).rows[0];
      if (!row || row.content_sha256 !== prepared.sha256)
        throw new CatalogStorageError("CATALOG_VERSION_CONFLICT");
      const persisted = snapshot(row);
      await client.query("COMMIT");
      return {
        ...persisted,
        outcome: inserted.rowCount
          ? ("imported" as const)
          : ("unchanged" as const),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {
        releaseError = new Error("CATALOG_ROLLBACK_FAILED");
      });
      if (error instanceof CatalogStorageError) throw error;
      throw new CatalogStorageError("CATALOG_STORAGE_UNAVAILABLE");
    } finally {
      client.removeListener("error", onConnectionError);
      client.release(releaseError);
    }
  }
  async get(catalogId: string, version: string) {
    const head = await catalogHeadByVersion(
      this.pool,
      catalogId,
      version,
    ).catch(() => {
      throw new CatalogStorageError("CATALOG_STORAGE_UNAVAILABLE");
    });
    if (!head) return null;
    try {
      const prepared = await verifiedCatalog(this.pool, head);
      return {
        id: head.id,
        ...(prepared.format === "2"
          ? { format: "2" as const, catalog: prepared.catalog }
          : { format: "1" as const, catalog: prepared.catalog }),
        sha256: prepared.sha256,
        importedAt: head.imported_at.toISOString(),
      };
    } catch (error) {
      if (error instanceof CatalogStorageError) throw error;
      throw new CatalogStorageError("CATALOG_STORED_INVALID");
    }
  }
}
