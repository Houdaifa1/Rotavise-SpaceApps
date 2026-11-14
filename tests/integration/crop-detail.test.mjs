import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { createHash } from "node:crypto";
import { disposable, docker, poll } from "../support/index.mjs";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import {
  cropDetailSchema,
  planRequestV2Schema,
} from "../../packages/contracts/dist/index.js";
import { rotationRequest } from "../support/rotation.mjs";

let db, api, store, release, imported;
const base = (version = "0.13.0", crop = "faba-bean") =>
  `/api/v1/catalog/crops/${release.id}/${version}/${crop}`;
const call = (url, headers = {}) =>
  api.app.inject({ method: "GET", url, headers });
beforeAll(async () => {
  db = await disposable();
  store = new CatalogStore(db.pool);
  release = await loadCatalogRelease("data/catalog/releases/0.13.0");
  imported = await store.import(release);
  for (const version of ["0.1.0", "0.12.0", "0.14.0", "0.15.0"])
    await store.import(
      await loadCatalogRelease(`data/catalog/releases/${version}`),
    );
  api = await createApi(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      PLANS_ENABLED: "true",
    }),
  );
  await api.app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await api?.close();
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query("TRUNCATE plan_quotas");
});

test("public detail is read from an immutable PostgreSQL release, with usable issue ids, citations and no hash changes", async () => {
  const response = await call(base());
  expect([response.statusCode, response.body.slice(0, 200)]).toEqual([
    200,
    expect.any(String),
  ]);
  const detail = cropDetailSchema.parse(response.json());
  expect(detail.catalogSha256).toBe(imported.sha256);
  expect(detail.identity.family).toBe("Fabaceae");
  expect(detail.modelType).toBe("annual");
  const original = release.profiles.find((p) => p.id === "faba-bean");
  expect(detail.calendar.plantingWindows.map((i) => i.rule)).toEqual(
    original.rules.filter((r) => r.metric === "planting_window"),
  );
  expect(detail.issues.map((i) => i.issue_id).sort()).toEqual(
    release.issues
      .filter((i) => i.hostCropIds.includes("faba-bean"))
      .map((i) => i.id)
      .sort(),
  );
  const issue = detail.issues[0];
  const request = rotationRequest({
    crop_health: {
      status: "reported",
      observations: [
        {
          crop_id: detail.cropId,
          issue: { issue_id: issue.issue_id },
          observed_on: "2026-10-01",
          source: "farmer_report",
          confirmation: "reported",
        },
      ],
    },
  });
  expect(planRequestV2Schema.safeParse(request).success).toBe(true);
  expect(
    (await new CatalogStore(db.pool).get(release.id, release.version)).sha256,
  ).toBe(imported.sha256);
  await expect(
    db.pool.query("UPDATE catalog_versions SET body='{}'::jsonb WHERE id=$1", [
      imported.id,
    ]),
  ).rejects.toThrow("CATALOG_VERSION_IMMUTABLE");
  expect(Buffer.byteLength(response.body)).toBeLessThanOrEqual(2 * 1024 * 1024);
});

test("ETag hashes exact bytes, supports lists and weak tags, and returns a bodyless 304 with identical cache metadata", async () => {
  const response = await call(base());
  expect(response.statusCode).toBe(200);
  const etag = `"${createHash("sha256").update(response.body).digest("base64url")}"`;
  expect(response.headers.etag).toBe(etag);
  expect(response.headers["cache-control"]).toBe(
    "public, max-age=3600, immutable",
  );
  for (const tag of [etag, `W/${etag}`, `"different", W/${etag}`, "*"]) {
    const cached = await call(base(), { "if-none-match": tag });
    expect(cached.statusCode).toBe(304);
    expect(cached.body).toBe("");
    expect(cached.headers.etag).toBe(etag);
    expect(cached.headers["cache-control"]).toBe(
      response.headers["cache-control"],
    );
  }
  const miss = await call(base(), { "if-none-match": '"different"' });
  expect(miss.statusCode).toBe(200);
  expect(miss.body).toBe(response.body);
});

test("cache identity includes catalog version and crop; legacy catalogs report explicit missing fields", async () => {
  const current = await call(base());
  const older = await call(base("0.12.0"), {
    "if-none-match": current.headers.etag,
  });
  expect(older.statusCode).toBe(200);
  expect(older.headers.etag).not.toBe(current.headers.etag);
  expect(older.json().catalogVersion).toBe("0.12.0");
  const different = await call(base("0.13.0", "carrot"), {
    "if-none-match": current.headers.etag,
  });
  expect(different.statusCode).toBe(200);
  expect(different.json().cropId).toBe("carrot");
  const legacy = await call(base("0.1.0"));
  expect(legacy.statusCode).toBe(200);
  const detail = cropDetailSchema.parse(legacy.json());
  expect(detail.modelType).toBeNull();
  expect(detail.issues).toEqual([]);
  expect(detail.gaps).toContainEqual(
    expect.objectContaining({ code: "CROP_DETAIL_MISSING", path: "modelType" }),
  );
});

test("unknown catalog versions/crops return 404 even with wildcard validators; malformed parameters/query return 400", async () => {
  for (const url of [
    base("99.0.0"),
    base("0.13.0", "missing-crop"),
    base().replace(release.id, "missing-catalog"),
  ]) {
    const response = await call(url, { "if-none-match": "*" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.etag).toBeUndefined();
  }
  for (const url of [
    base("0.13"),
    base("0.13.0", "a".repeat(81)),
    base() + "?unknown=1",
    base().replace(release.id, "INVALID"),
  ]) {
    const response = await call(url);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "INVALID_INPUT" });
    expect(response.headers["cache-control"]).toBe("no-store");
  }
});

test("bounded cache eviction preserves bytes and ETags when an older document is rebuilt", async () => {
  const first = await call(base());
  for (const crop of release.profiles
    .filter((p) => p.id !== "faba-bean")
    .slice(0, 33))
    expect((await call(base("0.13.0", crop.id))).statusCode).toBe(200);
  const again = await call(base());
  expect(again.body).toBe(first.body);
  expect(again.headers.etag).toBe(first.headers.etag);
});

test("cached detail still obeys the PostgreSQL usage limit with Retry-After and no cache headers", async () => {
  const first = await call(base());
  await db.pool.query(
    "UPDATE plan_quotas SET count=60, window_start=to_timestamp(floor(extract(epoch from clock_timestamp())/60)*60), expires_at=clock_timestamp()+interval '60 seconds'",
  );
  const limited = await call(base(), { "if-none-match": first.headers.etag });
  expect(limited.statusCode).toBe(429);
  expect(limited.json()).toEqual({ code: "RATE_LIMITED" });
  expect(limited.headers["retry-after"]).toBe("60");
  expect(limited.headers["cache-control"]).toBe("no-store");
  expect(limited.headers.etag).toBeUndefined();
});

test("a controlled corrupt stored hash fails closed without disabling any immutable trigger", async () => {
  const corrupt = structuredClone(release);
  corrupt.version = "0.13.1";
  for (const p of corrupt.profiles) p.version = corrupt.version;
  const prepared = prepareCatalogV2(corrupt);
  await db.pool.query(
    "INSERT INTO catalog_versions(catalog_key,version,schema_version,content_sha256,body) VALUES($1,$2,'2',$3,$4::jsonb)",
    [corrupt.id, corrupt.version, "0".repeat(64), prepared.canonicalJson],
  );
  const response = await call(base(corrupt.version), { "if-none-match": "*" });
  expect(response.statusCode).toBe(503);
  expect(response.json()).toEqual({ code: "CATALOG_UNAVAILABLE" });
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers.etag).toBeUndefined();
});

test("real PostgreSQL outage never serves a warm cached success and recovery restores the identical ETag", async () => {
  const first = await call(base());
  docker("stop", "-t", "1", db.name);
  try {
    const response = await call(base(), {
      "if-none-match": first.headers.etag,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "CATALOG_UNAVAILABLE" });
    expect(response.headers.etag).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("no-store");
  } finally {
    docker("start", db.name);
    await poll(() => db.pool.query("SELECT 1"), {
      label: "crop detail database recovery",
    });
  }
  const recovered = await call(base());
  expect(recovered.statusCode).toBe(200);
  expect(recovered.headers.etag).toBe(first.headers.etag);
  expect(recovered.body).toBe(first.body);
});

test.each(["0.14.0", "0.15.0"])(
  "%s returns all research, general role explanations, honest coverage and version-isolated ETags",
  async (version) => {
    const original = await loadCatalogRelease(
      `data/catalog/releases/${version}`,
    );
    const response = await call(base(version));
    expect(response.statusCode).toBe(200);
    const detail = cropDetailSchema.parse(response.json());
    const research = original.profiles.find(
      (p) => p.id === "faba-bean",
    ).research;
    expect(detail.research.income).toEqual(research.income);
    expect(detail.research.benefits).toEqual(research.benefits);
    expect(detail.research.benefitEffects).toHaveLength(12);
    expect(detail.research.roleExplanations.map((r) => r.language)).toEqual([
      "en",
      "fr",
      "ar",
      "ary",
    ]);
    expect(
      (await call(base(version), { "if-none-match": response.headers.etag }))
        .statusCode,
    ).toBe(304);
    const old = await call(base(), { "if-none-match": response.headers.etag });
    expect(old.statusCode).toBe(200);
    expect(old.json().research).toBeUndefined();
    expect(Buffer.byteLength(response.body)).toBeLessThanOrEqual(
      2 * 1024 * 1024,
    );
  },
);
