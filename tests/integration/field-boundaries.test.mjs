import { beforeAll, afterAll, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { disposable } from "../support/database.mjs";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import {
  authInject,
  sessionCookie,
  TEST_PASSWORD,
} from "../support/accounts.mjs";
import { importBoundaries } from "../../apps/server/dist/modules/field-boundaries/application/import-boundaries.js";
import {
  fieldBoundaryTileResponseSchema,
  fieldBoundaryAtResponseSchema,
  fieldBoundarySchema,
  boundaryContains,
} from "../../packages/contracts/dist/index.js";
import { cleanBoundary } from "../../apps/server/dist/modules/field-boundaries/application/clean-boundary.js";

let db, api, token, token2, report;
const text = readFileSync(
  "tests/support/fixtures/field-boundaries/morocco-2025.ndjson",
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(
    "tests/support/fixtures/field-boundaries/morocco-2025.manifest.json",
    "utf8",
  ),
);
const points = JSON.parse(
  readFileSync(
    "tests/support/fixtures/field-boundaries/interior-points.json",
    "utf8",
  ),
);
const lines = () =>
  (async function* () {
    for (const line of text.trimEnd().split("\n")) yield line;
  })();
const features = text.trimEnd().split("\n").map(JSON.parse);
const sample = features.find(
  (f) => cleanBoundary(f.geometry) && f.geometry.coordinates[0][0][0] > -7,
);
const [longitude, latitude] = points[sample.properties.id];
const x = Math.floor(((longitude + 180) / 360) * 16384);
const y = Math.floor(
  ((1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2) *
    16384,
);
const tileUrl = `/api/v1/field-boundaries/tiles/14/${x}/${y}`;
beforeAll(async () => {
  db = await disposable();
  // Actual operator CLI, including lazy NDJSON streaming during DB setup.
  const imported = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "tooling/field-boundaries/import.mjs",
        "tests/support/fixtures/field-boundaries/morocco-2025.manifest.json",
        "tests/support/fixtures/field-boundaries/morocco-2025.ndjson",
        "--allow-sample",
      ],
      {
        env: { ...process.env, DATABASE_URL: db.url, NODE_ENV: "test" },
        encoding: "utf8",
        timeout: 30000,
      },
    ),
  );
  const { datasetSha256, ...counts } = imported;
  expect(datasetSha256).toBe(manifest.sha256);
  report = counts;
  api = await createApi(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      PLANS_ENABLED: "true",
      FIELD_BOUNDARIES_ENABLED: "true",
    }),
  );
  await api.app.getHttpAdapter().getInstance().ready();
  const session = async () =>
    (
      await api.app.inject({
        method: "POST",
        url: "/api/v1/plan-sessions",
        payload: {},
      })
    ).json().accessToken;
  token = await session();
  token2 = await session();
});
afterAll(async () => {
  await api?.close();
  await db?.close();
});
const call = (method, url, payload, accessToken = token) =>
  api.app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
test("reviewed SQL migrates on PostgreSQL; pinned import stores provenance, counts real drops and activates atomically", async () => {
  expect(report.read).toBe(features.length);
  expect(report.retained).toBe(12);
  expect(report.dropped).toBeGreaterThan(0);
  const dataset = (await db.pool.query("SELECT * FROM boundary_datasets"))
    .rows[0];
  expect(dataset).toMatchObject({
    sha256: manifest.sha256,
    license: "CC-BY-4.0",
    active: true,
    year: 2025,
    source_url: manifest.sourceUrl,
  });
  expect(dataset.report).toEqual(report);
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM boundary_candidates"))
      .rows[0].n,
  ).toBe(report.retained);
  await expect(
    importBoundaries(db.pool, manifest, lines(), { allowSample: true }),
  ).rejects.toThrow("DATASET_ALREADY_IMPORTED");
  const bad = { ...manifest, sha256: "a".repeat(64) };
  await expect(
    importBoundaries(db.pool, bad, lines(), { allowSample: true }),
  ).rejects.toThrow("IMPORT_HASH_MISMATCH");
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM boundary_datasets"))
      .rows[0].n,
  ).toBe(1);
  await expect(importBoundaries(db.pool, manifest, lines())).rejects.toThrow(
    "SAMPLE_IMPORT_REQUIRES_EXPLICIT_FLAG",
  );
  await expect(
    importBoundaries(db.pool, { ...manifest, license: "invented" }, lines(), {
      allowSample: true,
    }),
  ).rejects.toThrow();
});
test("both endpoints require an owner; capability reflects the actual switch", async () => {
  expect((await call("GET", tileUrl, undefined, null)).statusCode).toBe(401);
  expect(
    (
      await call(
        "POST",
        "/api/v1/field-boundaries/at",
        { latitude, longitude },
        null,
      )
    ).statusCode,
  ).toBe(401);
  expect(
    (await call("GET", tileUrl, undefined, "x".repeat(43))).statusCode,
  ).toBe(401);
  expect(
    (await api.app.inject("/api/v1/capabilities")).json().fieldBoundaries
      .available,
  ).toBe(true);
  const disabled = await createApi(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      PLANS_ENABLED: "true",
    }),
  );
  try {
    await disabled.app.getHttpAdapter().getInstance().ready();
    expect((await disabled.app.inject(tileUrl)).statusCode).toBe(404);
    expect(
      (await disabled.app.inject("/api/v1/capabilities")).json().fieldBoundaries
        .available,
    ).toBe(false);
  } finally {
    await disabled.close();
  }
});
test("real geometries survive tile and strict containing-point reads with licence and honest confidence", async () => {
  const response = await call("GET", tileUrl);
  expect(response.statusCode).toBe(200);
  const collection = fieldBoundaryTileResponseSchema.parse(response.json());
  expect(collection.features.length).toBeGreaterThan(0);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(collection.licenseUrl).toBe(
    "https://creativecommons.org/licenses/by/4.0/",
  );
  expect(collection.limitations).toContain(
    "FIELD_BOUNDARY_ACCURACY_UNMEASURED",
  );
  for (const f of collection.features)
    expect(fieldBoundarySchema.safeParse(f.geometry).success).toBe(true);
  const pointResponse = await call("POST", "/api/v1/field-boundaries/at", {
    latitude,
    longitude,
  });
  expect(pointResponse.statusCode).toBe(200);
  const found = fieldBoundaryAtResponseSchema.parse(pointResponse.json()).field;
  expect(boundaryContains(found.geometry, latitude, longitude)).toBe(true);
  const raw = features.find((f) =>
    found.properties.id.endsWith(":" + f.properties.id),
  );
  expect(found.properties.confidence).toBe(raw.properties.confidence / 100);
  const secondOwner = await call("GET", tileUrl, undefined, token2);
  expect(secondOwner.json()).toEqual(collection); // Shared public reference data, no owner's fields.
  const missing = await call("POST", "/api/v1/field-boundaries/at", {
    latitude: 0,
    longitude: 0,
  });
  expect(missing.statusCode).toBe(404);
  expect(missing.json()).toEqual({ code: "NO_FIELD_FOUND" });
  expect(
    (await call("GET", "/api/v1/field-boundaries/tiles/14/0/0")).json()
      .features,
  ).toEqual([]);
});
test("queries, unknown body fields, zooms and out-of-range addresses fail runtime validation", async () => {
  for (const path of [
    tileUrl + "?owner=other",
    tileUrl.replace("/14/", "/13/"),
    "/api/v1/field-boundaries/tiles/14/16384/0",
  ])
    expect((await call("GET", path)).statusCode).toBe(400);
  for (const payload of [
    { latitude: "32.4", longitude },
    { latitude: 91, longitude },
    { latitude, longitude, owner: randomUUID() },
  ])
    expect(
      (await call("POST", "/api/v1/field-boundaries/at", payload)).statusCode,
    ).toBe(400);
});
test("verified account cookies work and point requests reject an untrusted origin or mixed credentials", async () => {
  const accountApi = await createApi(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      AUTH_ENABLED: "true",
      FIELD_BOUNDARIES_ENABLED: "true",
      AUTH_SECRET: "synthetic-account-secret-" + randomUUID(),
      AUTH_BASE_URL: "http://127.0.0.1:3000",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1025",
      SMTP_TLS: "local",
      MAIL_FROM: "rotavise@example.invalid",
    }),
  );
  try {
    await accountApi.app.getHttpAdapter().getInstance().ready();
    const email = `${randomUUID()}@example.invalid`;
    const signup = await authInject(accountApi.app, "sign-up/email", {
      name: "Synthetic account",
      email,
      password: TEST_PASSWORD,
    });
    expect(signup.statusCode).toBe(200);
    // A controlled DB fixture marks this test account verified; no message is
    // sent and no verification of a real user's identity is asserted.
    await db.pool.query(
      "UPDATE auth_users SET email_verified=true WHERE email=$1",
      [email],
    );
    const login = await authInject(accountApi.app, "sign-in/email", {
      email,
      password: TEST_PASSWORD,
    });
    expect(login.statusCode).toBe(200);
    const cookie = sessionCookie(login);
    expect(
      (await accountApi.app.inject({ url: tileUrl, headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    const point = (origin) =>
      accountApi.app.inject({
        method: "POST",
        url: "/api/v1/field-boundaries/at",
        headers: { cookie, origin },
        payload: { latitude, longitude },
      });
    expect((await point("https://untrusted.invalid")).statusCode).toBe(401);
    expect((await point("http://127.0.0.1:3000")).statusCode).toBe(200);
    expect(
      (
        await accountApi.app.inject({
          url: tileUrl,
          headers: { cookie, authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(401);
  } finally {
    await accountApi.close();
  }
});
test("PostgreSQL quotas are owner-scoped and enforced separately for tiles and taps", async () => {
  // Reset counters so the higher IP ceiling does not hide either owner limit.
  await db.pool.query("DELETE FROM plan_quotas");
  for (let i = 0; i < 20; i++)
    expect(
      (
        await call("POST", "/api/v1/field-boundaries/at", {
          latitude,
          longitude,
        })
      ).statusCode,
    ).toBe(200);
  const limited = await call("POST", "/api/v1/field-boundaries/at", {
    latitude,
    longitude,
  });
  expect(limited.statusCode).toBe(429);
  expect(limited.headers["retry-after"]).toBe("3600");
  expect(
    (
      await call(
        "POST",
        "/api/v1/field-boundaries/at",
        { latitude, longitude },
        token2,
      )
    ).statusCode,
  ).toBe(200);
  await db.pool.query("DELETE FROM plan_quotas");
  for (let i = 0; i < 60; i++)
    expect((await call("GET", tileUrl)).statusCode).toBe(200);
  expect((await call("GET", tileUrl)).statusCode).toBe(429);
  expect((await call("GET", tileUrl, undefined, token2)).statusCode).toBe(200);
});
test("a replacement import is atomic, unknown confidence remains null, expiry denies the guest, and corrupt stored shapes fail closed", async () => {
  await db.pool.query("DELETE FROM plan_quotas");
  const modified = features.map((f) => ({
    ...f,
    properties: { ...f.properties, confidence: null },
  }));
  const bytes = modified.map((f) => JSON.stringify(f) + "\n").join("");
  const replacement = {
    ...manifest,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  await importBoundaries(
    db.pool,
    replacement,
    (async function* () {
      for (const f of modified) yield JSON.stringify(f);
    })(),
    { allowSample: true },
  );
  const response = await call("POST", "/api/v1/field-boundaries/at", {
    latitude,
    longitude,
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().field.properties.confidence).toBeNull();
  expect(response.json().field.properties.datasetSha256).toBe(
    replacement.sha256,
  );
  expect(
    (
      await db.pool.query(
        "SELECT count(*)::int AS n FROM boundary_datasets WHERE active",
      )
    ).rows[0].n,
  ).toBe(1);
  await db.pool.query(
    "UPDATE boundary_candidates SET geometry=$1 WHERE dataset_sha256=$2",
    [{ type: "Polygon", coordinates: [] }, replacement.sha256],
  );
  expect((await call("GET", tileUrl)).statusCode).toBe(503);
  await db.pool.query(
    "UPDATE plan_owners SET created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 second' WHERE user_id IS NULL",
  );
  expect((await call("GET", tileUrl)).statusCode).toBe(401);
});
