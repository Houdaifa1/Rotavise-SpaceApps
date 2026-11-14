import { test, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { disposable, docker, poll } from "../support/index.mjs";
import { migrateApplication } from "../../packages/database/dist/index.js";
import { catalogOptionsSchema } from "../../packages/contracts/dist/index.js";
import {
  prepareCatalog,
  catalogReadiness,
  prepareCatalogV2,
} from "../../packages/catalog/dist/index.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
let db, store;
beforeAll(async () => {
  db = await disposable();
  store = new CatalogStore(db.pool);
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query(
    "TRUNCATE catalog_versions, plan_requests, plan_intake_results CASCADE",
  );
});
// Disposable database only. TRUNCATE and controlled triggers are infrastructure
// test administration, never exposed through application configuration or HTTP.
test("real PostgreSQL 18 migration is repeatable and includes append-only trigger and identity constraints", async () => {
  await migrateApplication(db.pool);
  await migrateApplication(db.pool);
  expect(
    (await db.pool.query("SHOW server_version")).rows[0].server_version,
  ).toMatch(/^18\.4/);
  expect(
    (
      await db.pool.query(
        "SELECT tgname FROM pg_trigger WHERE tgrelid='catalog_versions'::regclass AND NOT tgisinternal",
      )
    ).rows.map((r) => r.tgname),
  ).toContain("catalog_version_immutable");
  expect((await store.import(catalog)).outcome).toBe("imported");
});
test("repeat imports and twelve concurrent importers persist one identical version", async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, () => new CatalogStore(db.pool).import(catalog)),
  );
  expect(results.filter((r) => r.outcome === "imported")).toHaveLength(1);
  expect(new Set(results.map((r) => r.id)).size).toBe(1);
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM catalog_versions"))
      .rows[0].n,
  ).toBe(1);
  expect(
    (
      await store.import({
        ...catalog,
        sources: [...catalog.sources].reverse(),
      })
    ).outcome,
  ).toBe("unchanged");
});
test("changed content cannot overwrite a release; incrementing version appends and preserves old evidence", async () => {
  const first = await store.import(catalog);
  const edited = structuredClone(catalog);
  edited.profiles[0].limitations.push("Controlled test metadata revision.");
  await expect(store.import(edited)).rejects.toThrow(
    "CATALOG_VERSION_CONFLICT",
  );
  edited.version = "0.1.1";
  edited.profiles[0].version = "0.1.1";
  const second = await store.import(edited);
  expect(second.id).not.toBe(first.id);
  expect((await store.get(catalog.id, "0.1.0")).sha256).toBe(first.sha256);
  expect((await store.get(catalog.id, "0.1.1")).sha256).not.toBe(first.sha256);
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM catalog_versions"))
      .rows[0].n,
  ).toBe(2);
});
test("restart retrieves validated JSONB evidence with all research gaps and no missing-record fabrication", async () => {
  const imported = await store.import(catalog);
  const read = await new CatalogStore(db.pool).get(catalog.id, catalog.version);
  expect(read.id).toBe(imported.id);
  expect(prepareCatalog(read.catalog).canonicalJson).toBe(
    prepareCatalog(catalog).canonicalJson,
  );
  expect(
    catalogReadiness(read.catalog, "faba-bean", "beni-mellal-tadla").status,
  ).toBe("insufficient_evidence");
  expect(await store.get("missing-catalog", "0.1.0")).toBeNull();
});
test("ordinary SQL UPDATE and DELETE reject immutable releases", async () => {
  const result = await store.import(catalog);
  await expect(
    db.pool.query("UPDATE catalog_versions SET content_sha256=$2 WHERE id=$1", [
      result.id,
      "0".repeat(64),
    ]),
  ).rejects.toThrow("CATALOG_VERSION_IMMUTABLE");
  await expect(
    db.pool.query("DELETE FROM catalog_versions WHERE id=$1", [result.id]),
  ).rejects.toThrow("CATALOG_VERSION_IMMUTABLE");
});
test.each(["bundle", "profile", "source"])(
  "production import and direct database insertion reject synthetic %s",
  async (level) => {
    const value = structuredClone(catalog);
    if (level === "bundle") value.synthetic = true;
    else if (level === "profile") value.profiles[0].synthetic = true;
    else value.sources[0].synthetic = true;
    await expect(store.import(value)).rejects.toThrow(
      "CATALOG_SYNTHETIC_REJECTED",
    );
    await expect(
      db.pool.query(
        "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES($1,$2,'1',$3,$4)",
        [value.id, value.version, "a".repeat(64), JSON.stringify(value)],
      ),
    ).rejects.toThrow("catalog_real_evidence");
    expect(
      (await db.pool.query("SELECT count(*)::int n FROM catalog_versions"))
        .rows[0].n,
    ).toBe(0);
  },
);
test("database rejects missing, null and string synthetic markers and mismatched body identity", async () => {
  for (const marker of [undefined, null, "false"]) {
    const value = structuredClone(catalog);
    if (marker === undefined) delete value.profiles[0].synthetic;
    else value.profiles[0].synthetic = marker;
    await expect(
      db.pool.query(
        "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES($1,$2,'1',$3,$4)",
        [value.id, value.version, "a".repeat(64), JSON.stringify(value)],
      ),
    ).rejects.toThrow("catalog_real_evidence");
  }
  await expect(
    db.pool.query(
      "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES('wrong-catalog','0.1.0','1',$1,$2)",
      ["a".repeat(64), JSON.stringify(catalog)],
    ),
  ).rejects.toThrow("catalog_body_identity");
});
test("controlled AFTER INSERT failure rolls back evidence and releases the connection for recovery", async () => {
  await db.pool.query(
    "CREATE FUNCTION synthetic_catalog_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_CATALOG_FAILURE'; END; $$",
  );
  await db.pool.query(
    "CREATE TRIGGER synthetic_catalog_failure AFTER INSERT ON catalog_versions FOR EACH ROW EXECUTE FUNCTION synthetic_catalog_insert_failure()",
  );
  try {
    await expect(store.import(catalog)).rejects.toThrow(
      "CATALOG_STORAGE_UNAVAILABLE",
    );
    expect(
      (await db.pool.query("SELECT count(*)::int n FROM catalog_versions"))
        .rows[0].n,
    ).toBe(0);
  } finally {
    await db.pool.query(
      "DROP TRIGGER synthetic_catalog_failure ON catalog_versions",
    );
    await db.pool.query("DROP FUNCTION synthetic_catalog_insert_failure()");
  }
  expect((await store.import(catalog)).outcome).toBe("imported");
  expect(
    (
      await db.pool.query(
        "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'",
      )
    ).rows[0].n,
  ).toBe(0);
});
test("real table lock times out before the client deadline, rolls back and permits recovery", async () => {
  const locker = await db.pool.connect();
  await locker.query("BEGIN");
  await locker.query("LOCK TABLE catalog_versions IN ACCESS EXCLUSIVE MODE");
  const started = Date.now();
  try {
    await expect(store.import(catalog)).rejects.toThrow(
      "CATALOG_STORAGE_UNAVAILABLE",
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(2800);
    expect(Date.now() - started).toBeLessThan(4500);
  } finally {
    await locker.query("ROLLBACK");
    locker.release();
  }
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM catalog_versions"))
      .rows[0].n,
  ).toBe(0);
  expect((await store.import(catalog)).outcome).toBe("imported");
  expect(
    (
      await db.pool.query(
        "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'",
      )
    ).rows[0].n,
  ).toBe(0);
});
test("stored hash corruption is detected on read and repeat import without disabling immutable triggers", async () => {
  const prepared = prepareCatalog(catalog);
  await db.pool.query(
    "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES($1,$2,'1',$3,$4)",
    [catalog.id, catalog.version, "0".repeat(64), prepared.canonicalJson],
  );
  await expect(store.get(catalog.id, catalog.version)).rejects.toThrow(
    "CATALOG_STORED_INVALID",
  );
  await expect(store.import(catalog)).rejects.toThrow(
    "CATALOG_VERSION_CONFLICT",
  );
});
test("database death during a locked import rejects safely without an unhandled checked-out client error", async () => {
  const locker = await db.pool.connect();
  const connectionErrors = [];
  const observe = (error) => connectionErrors.push(error);
  locker.on("error", observe);
  let pending;
  try {
    await locker.query("BEGIN");
    await locker.query("LOCK TABLE catalog_versions IN ACCESS EXCLUSIVE MODE");
    pending = expect(store.import(catalog)).rejects.toThrow(
      "CATALOG_STORAGE_UNAVAILABLE",
    );
    await poll(
      async () =>
        (
          await db.pool.query(
            "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'INSERT INTO catalog_versions%'",
          )
        ).rows[0].n === 1,
      { label: "actual blocked catalog insertion" },
    );
    docker("stop", "-t", "1", db.name);
    await pending;
    expect(connectionErrors.length).toBeGreaterThan(0);
  } finally {
    locker.removeListener("error", observe);
    locker.release(new Error("SYNTHETIC_DATABASE_OUTAGE"));
    docker("start", db.name);
    await poll(() => db.pool.query("SELECT 1"), {
      label: "in-flight catalog outage recovery",
    });
    if (pending) await pending;
  }
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM catalog_versions"))
      .rows[0].n,
  ).toBe(0);
  expect((await store.import(catalog)).outcome).toBe("imported");
});
test("real database outage returns a bounded safe error and recovers the persisted release", async () => {
  const result = await store.import(catalog);
  docker("stop", "-t", "1", db.name);
  try {
    await expect(store.get(catalog.id, catalog.version)).rejects.toThrow(
      "CATALOG_STORAGE_UNAVAILABLE",
    );
    await expect(store.import(catalog)).rejects.toThrow(
      "CATALOG_STORAGE_UNAVAILABLE",
    );
  } finally {
    docker("start", db.name);
    await poll(() => db.pool.query("SELECT 1"), {
      label: "catalog database restart",
    });
  }
  expect((await store.get(catalog.id, catalog.version)).id).toBe(result.id);
});
test("release 0.10.0 imports into PostgreSQL, round-trips with its hash and cannot be altered", async () => {
  await migrateApplication(db.pool);
  const wide = await loadCatalogRelease("data/catalog/releases/0.10.0");
  const first = await store.import(wide);
  expect(first.outcome).toBe("imported");
  const stored = await store.get(wide.id, wide.version);
  expect(stored.sha256).toBe(first.sha256);
  expect(stored.catalog.profiles).toHaveLength(wide.profiles.length);
  expect(
    stored.catalog.profiles.some((p) =>
      p.rules.some((r) => r.verification.status === "model_recall"),
    ),
  ).toBe(true);
  expect((await store.import(wide)).outcome).toBe("unchanged");
  await expect(
    db.pool.query("UPDATE catalog_versions SET body='{}'::jsonb"),
  ).rejects.toThrow();
});
test("release 0.11.0 imports into PostgreSQL, round-trips with its hash and cannot be altered", async () => {
  await migrateApplication(db.pool);
  const wider = await loadCatalogRelease("data/catalog/releases/0.11.0");
  const first = await store.import(wider);
  expect(first.outcome).toBe("imported");
  const stored = await store.get(wider.id, wider.version);
  expect(stored.sha256).toBe(first.sha256);
  expect(stored.catalog.profiles).toHaveLength(wider.profiles.length);
  expect(
    stored.catalog.profiles.some((p) =>
      (p.references ?? []).some((r) => r.topic === "nitrogen_fixation"),
    ),
  ).toBe(true);
  expect((await store.import(wider)).outcome).toBe("unchanged");
  await expect(
    db.pool.query("UPDATE catalog_versions SET body='{}'::jsonb"),
  ).rejects.toThrow();
});
test("release 0.12.0 imports into PostgreSQL with its names, round-trips with its hash and cannot be altered", async () => {
  await migrateApplication(db.pool);
  const named = await loadCatalogRelease("data/catalog/releases/0.12.0");
  const first = await store.import(named);
  expect(first.outcome).toBe("imported");
  const stored = await store.get(named.id, named.version);
  expect(stored.sha256).toBe(first.sha256);
  expect(stored.catalog.profiles).toHaveLength(named.profiles.length);
  const tomato = stored.catalog.profiles.find((p) => p.id === "tomato");
  expect(
    tomato.identity.localNames.map((n) => [n.language, n.recall?.confidence]),
  ).toEqual(expect.arrayContaining([["ary", "high"]]));
  expect(
    stored.catalog.profiles.some((p) =>
      p.cultivars.some((c) => c.localNames?.some((n) => n.language === "ar")),
    ),
  ).toBe(true);
  expect((await store.import(named)).outcome).toBe("unchanged");
  await expect(
    db.pool.query("UPDATE catalog_versions SET body='{}'::jsonb"),
  ).rejects.toThrow();
});
test("release 0.13.0 imports beside 0.12.0 with cited preferred names and immutable hashes", async () => {
  await migrateApplication(db.pool);
  const previous = await loadCatalogRelease("data/catalog/releases/0.12.0");
  const sourced = await loadCatalogRelease("data/catalog/releases/0.13.0");
  const previousImport = await store.import(previous);
  const first = await store.import(sourced);
  expect(first.outcome).toBe("imported");
  const stored = await store.get(sourced.id, sourced.version);
  expect(stored.sha256).toBe(first.sha256);
  // Storage sorts entity lists by ID before hashing; name/citation order stays
  // significant. Compare the complete canonical bodies, not source-file order.
  expect(prepareCatalogV2(stored.catalog).canonicalJson).toBe(
    prepareCatalogV2(sourced).canonicalJson,
  );
  expect((await store.get(previous.id, previous.version)).sha256).toBe(
    previousImport.sha256,
  );
  const carrot = stored.catalog.profiles.find((p) => p.id === "carrot");
  expect(carrot.identity.localNames).toContainEqual(
    expect.objectContaining({
      language: "ary",
      name: "الخيزو",
      recall: expect.any(Object),
    }),
  );
  expect(carrot.identity.localNames).toContainEqual(
    expect.objectContaining({
      language: "ary",
      name: "زرودية",
      preferred: true,
      confidence: "low",
      citations: expect.any(Array),
    }),
  );
  expect((await store.import(sourced)).outcome).toBe("unchanged");
  const changed = structuredClone(sourced);
  changed.profiles
    .find((p) => p.id === "carrot")
    .identity.localNames.find((n) => n.citations).confidence = "medium";
  await expect(store.import(changed)).rejects.toThrow(
    "CATALOG_VERSION_CONFLICT",
  );
  await expect(
    db.pool.query("UPDATE catalog_versions SET body='{}'::jsonb"),
  ).rejects.toThrow();
});
test("the catalog source-capacity migration retains the 600-source database bound", async () => {
  const sourced = await loadCatalogRelease("data/catalog/releases/0.13.0");
  const tooMany = structuredClone(sourced);
  // Deliberate invalid fixture: not a release or production evidence.
  tooMany.sources = Array.from({ length: 601 }, () => sourced.sources[0]);
  await expect(
    db.pool.query(
      "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES($1,$2,$3,$4,$5::jsonb)",
      [
        tooMany.id,
        tooMany.version,
        "2",
        "0".repeat(64),
        JSON.stringify(tooMany),
      ],
    ),
  ).rejects.toMatchObject({
    code: "23514",
    constraint: "catalog_real_evidence",
  });
});
test("a stored release is verified once, then served from memory", async () => {
  await migrateApplication(db.pool);
  const wider = await loadCatalogRelease("data/catalog/releases/0.11.0");
  await store.import(wider);
  const queries = [];
  const counting = new CatalogStore({
    query: (...args) => {
      queries.push(String(args[0]));
      return db.pool.query(...args);
    },
  });
  const first = await counting.get(wider.id, wider.version);
  const second = await counting.get(wider.id, wider.version);
  // The body is read and validated on first use only; later calls read the
  // small row and hand back the same frozen, verified catalog.
  expect(queries.filter((q) => q.includes("SELECT body"))).toHaveLength(1);
  expect(queries).toHaveLength(3);
  expect(second.catalog).toBe(first.catalog);
  expect(Object.isFrozen(first.catalog.profiles[0])).toBe(true);
  expect(second.sha256).toBe(first.sha256);
  // The options contract holds the whole wide release.
  const options = catalogOptionsSchema.parse({
    catalogId: first.catalog.id,
    catalogVersion: first.catalog.version,
    catalogSha256: first.sha256,
    crops: first.catalog.profiles.map((p) => ({
      id: p.id,
      name: p.identity.name,
      scientificName: p.identity.scientificName,
      family: p.identity.family,
      reviewStatus: "pending",
      localNames: p.identity.localNames.map(({ language, name }) => ({
        language,
        name,
      })),
      cultivars: p.cultivars.map((c) => ({
        id: c.id,
        name: c.name,
        localNames: (c.localNames ?? []).map(({ language, name }) => ({
          language,
          name,
        })),
      })),
    })),
    sources: first.catalog.sources.map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      url: s.url,
    })),
  });
  expect(options.crops.length).toBeGreaterThan(200);
});

test.each(["0.14.0", "0.15.0"])(
  "%s research survives immutable PostgreSQL import and hash-checked round trip beside 0.13.0",
  async (version) => {
    await migrateApplication(db.pool);
    const old = await loadCatalogRelease("data/catalog/releases/0.13.0");
    const research = await loadCatalogRelease(
      `data/catalog/releases/${version}`,
    );
    const previous = await store.import(old);
    const imported = await store.import(research);
    const stored = await store.get(research.id, research.version);
    expect(prepareCatalogV2(stored.catalog).canonicalJson).toBe(
      prepareCatalogV2(research).canonicalJson,
    );
    expect(stored.sha256).toBe(imported.sha256);
    expect((await store.import(research)).outcome).toBe("unchanged");
    expect((await store.get(old.id, old.version)).sha256).toBe(previous.sha256);
    expect(
      stored.catalog.profiles
        .find((p) => p.id === "barley")
        .research.income.facts.some(
          (f) =>
            f.kind === "margins" && f.definition.includes("variable costs"),
        ),
    ).toBe(true);
    await expect(
      db.pool.query(
        "UPDATE catalog_versions SET body='{}'::jsonb WHERE version=$1",
        [version],
      ),
    ).rejects.toThrow();
  },
);
