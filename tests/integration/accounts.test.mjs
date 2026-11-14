import {
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
  jest,
} from "@jest/globals";
import { randomUUID, createHash } from "node:crypto";
import { disposable } from "../support/database.mjs";
import {
  disposableMail,
  authInject,
  sessionCookie,
  TEST_PASSWORD,
} from "../support/accounts.mjs";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { MailWorker } from "../../apps/server/dist/modules/auth/worker/mail.worker.js";
import { decryptMail } from "../../apps/server/dist/modules/auth/application/auth.js";
import { migrateApplication } from "../../packages/database/dist/index.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { syntheticPlanInput } from "../support/plans.mjs";
import { quota } from "../../apps/server/dist/common/security/quota.js";
import { PlanningStore } from "../../apps/server/dist/modules/plans/application/planning-store.js";
let db, inbox, api, mail, config;
beforeAll(async () => {
  db = await disposable();
  inbox = await disposableMail();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.15.0"),
  );
  config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: db.url,
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    AUTH_ENABLED: "true",
    AUTH_SECRET: "synthetic-auth-secret-07-" + randomUUID(),
    AUTH_BASE_URL: "http://127.0.0.1:3000",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(inbox.smtpPort),
    SMTP_TLS: "local",
    MAIL_FROM: "rotavise@example.invalid",
    // Synthetic values: no worker runs here, so NASA is never contacted.
    OBSERVATIONS_ENABLED: "true",
    EARTHDATA_USERNAME: "synthetic-user",
    EARTHDATA_PASSWORD: "synthetic-password-not-real",
  });
  api = await createApi(config);
  await api.app.getHttpAdapter().getInstance().ready();
  mail = new MailWorker(db.pool, config);
});
afterAll(async () => {
  mail?.close();
  await api?.close();
  inbox?.close();
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query(
    "TRUNCATE auth_users,auth_rate_limits,plan_quotas CASCADE",
  );
});
test("catalog options and account capabilities expose reviewed state without requiring a session", async () => {
  const catalog = await api.app.inject("/api/v1/catalog/options");
  expect(catalog.statusCode).toBe(200);
  expect(catalog.json()).toMatchObject({ catalogVersion: "0.15.0" });
  expect(catalog.json().crops).toHaveLength(246);
  expect(
    catalog.json().crops.every((crop) => crop.reviewStatus === "pending"),
  ).toBe(true);
  expect(catalog.json().sources.length).toBeGreaterThan(0);
  const versioned = await api.app.inject(
    "/api/v1/catalog/options/rotavise-pilot/0.1.0",
  );
  expect(versioned.statusCode).toBe(200);
  expect(versioned.json().catalogSha256).not.toBe(catalog.json().catalogSha256);
  expect(versioned.json().crops).toHaveLength(3);
  expect(
    (await api.app.inject("/api/v1/catalog/options/rotavise-pilot/9.9.9"))
      .statusCode,
  ).toBe(404);
  expect(
    (await api.app.inject("/api/v1/catalog/options/rotavise-pilot/invalid"))
      .statusCode,
  ).toBe(400);
  expect(
    (await api.app.inject("/api/v1/catalog/options?extra=1")).statusCode,
  ).toBe(400);
  expect((await api.app.inject("/api/v1/auth/capabilities")).json()).toEqual({
    email: true,
    google: false,
  });
  expect(
    (await authInject(api.app, "sign-in/social", { provider: "google" }))
      .statusCode,
  ).toBe(404);
});
test("Google login is conditional and generates a first-party OAuth state when configured", async () => {
  expect(() =>
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      AUTH_ENABLED: "true",
      AUTH_SECRET: config.AUTH_SECRET,
      AUTH_BASE_URL: "http://127.0.0.1:3000",
      SMTP_HOST: "127.0.0.1",
      SMTP_TLS: "local",
      MAIL_FROM: "rotavise@example.invalid",
      GOOGLE_CLIENT_ID: "synthetic-google-client",
    }),
  ).toThrow("CONFIG_INVALID: GOOGLE_CLIENT_ID");
  const enabled = await createApi(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      AUTH_ENABLED: "true",
      AUTH_SECRET: config.AUTH_SECRET,
      AUTH_BASE_URL: "http://127.0.0.1:3000",
      SMTP_HOST: "127.0.0.1",
      SMTP_TLS: "local",
      MAIL_FROM: "rotavise@example.invalid",
      GOOGLE_CLIENT_ID: "synthetic-google-client",
      GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
    }),
  );
  try {
    expect(
      (await enabled.app.inject("/api/v1/auth/capabilities")).json(),
    ).toEqual({ email: true, google: true });
    const response = await authInject(enabled.app, "sign-in/social", {
      provider: "google",
      callbackURL: "http://127.0.0.1:3000/?auth=google",
    });
    expect(response.statusCode).toBe(200);
    const location = new URL(response.json().url);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe(
      "synthetic-google-client",
    );
    expect(location.searchParams.get("state")?.length).toBeGreaterThan(16);
    expect(
      (await authInject(enabled.app, "link-social", { provider: "google" }))
        .statusCode,
    ).toBe(401);
    const invalid = await enabled.app.inject(
      "/api/auth/callback/google?state=invalid&code=synthetic",
    );
    expect(invalid.statusCode).not.toBe(200);
    expect(
      (await db.pool.query("SELECT count(*)::int AS n FROM auth_users")).rows[0]
        .n,
    ).toBe(0);
  } finally {
    await enabled.close();
  }
});
async function signup(email = `${randomUUID()}@example.invalid`) {
  const res = await authInject(api.app, "sign-up/email", {
    name: "Synthetic test farmer",
    email,
    password: TEST_PASSWORD,
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "verification_required" });
  return email;
}
async function deliver(email) {
  await mail.tick();
  const message = await inbox.message(email);
  expect(message).not.toBeNull();
  return new URL(message.Text.match(/https?:\/\/[^\s]+/)[0]);
}
async function verified() {
  const email = await signup();
  const url = await deliver(email);
  const result = await api.app.inject({ url: url.pathname + url.search });
  expect([200, 302]).toContain(result.statusCode);
  const login = await authInject(api.app, "sign-in/email", {
    email,
    password: TEST_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  expect(login.json()).not.toHaveProperty("token");
  return { email, cookie: sessionCookie(login), login };
}
test("reviewed real migration repeats; signup and encrypted mail commit atomically; actual SMTP verification/login/logout", async () => {
  await migrateApplication(db.pool);
  const email = await signup();
  const {
    rows: [row],
  } = await db.pool.query("SELECT * FROM auth_mail");
  expect(row.status).toBe("queued");
  expect(row.ciphertext).not.toContain(email);
  expect(decryptMail(config.AUTH_SECRET, row.id, row.ciphertext).to).toBe(
    email,
  );
  expect(
    (
      await authInject(api.app, "sign-in/email", {
        email,
        password: TEST_PASSWORD,
      })
    ).statusCode,
  ).toBe(403);
  const link = await deliver(email);
  expect(
    (await db.pool.query("SELECT ciphertext,status FROM auth_mail")).rows[0],
  ).toEqual({ ciphertext: null, status: "sent" });
  const verify = await api.app.inject({ url: link.pathname + link.search });
  expect([200, 302]).toContain(verify.statusCode);
  const login = await authInject(api.app, "sign-in/email", {
    email,
    password: TEST_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  expect(String(login.headers["set-cookie"])).toContain("HttpOnly");
  expect(String(login.headers["set-cookie"])).toContain("SameSite=Lax");
  expect(login.json()).not.toHaveProperty("token");
  const cookie = sessionCookie(login);
  const me = await api.app.inject({
    url: "/api/v1/account",
    headers: { cookie },
  });
  expect(me.statusCode).toBe(200);
  expect(me.json().email).toBe(email);
  expect((await authInject(api.app, "sign-out", {}, cookie)).statusCode).toBe(
    200,
  );
  expect(
    (await api.app.inject({ url: "/api/v1/account", headers: { cookie } }))
      .statusCode,
  ).toBe(401);
});
test("rollback on outbox insertion failure never leaves an unverified credential account without mail", async () => {
  await db.pool.query(
    "ALTER TABLE auth_mail ADD CONSTRAINT injected_outbox_failure CHECK (kind <> 'verify')",
  );
  try {
    const res = await authInject(api.app, "sign-up/email", {
      name: "Synthetic rollback",
      email: "rollback@example.invalid",
      password: TEST_PASSWORD,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect((await db.pool.query("SELECT id FROM auth_users")).rowCount).toBe(0);
    expect((await db.pool.query("SELECT id FROM auth_accounts")).rowCount).toBe(
      0,
    );
  } finally {
    await db.pool.query(
      "ALTER TABLE auth_mail DROP CONSTRAINT injected_outbox_failure",
    );
  }
});
test("user creation failures produce a safe diagnostic without exposing database details", async () => {
  const email = "synthetic-user-creation-failure@example.invalid";
  await db.pool.query(
    "ALTER TABLE auth_users ADD CONSTRAINT injected_user_failure CHECK (email <> 'synthetic-user-creation-failure@example.invalid')",
  );
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await authInject(api.app, "sign-up/email", {
      name: "Synthetic database failure",
      email,
      password: TEST_PASSWORD,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "AUTH_UNAVAILABLE" });
    expect(logged).toHaveBeenCalledWith("AUTH_DEPENDENCY_UNAVAILABLE", {
      operation: "sign-up/email",
      stage: "auth_handler",
      category: "user_creation",
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(email);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(
      "injected_user_failure",
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain(TEST_PASSWORD);
    expect(
      (await db.pool.query("SELECT id FROM auth_users WHERE email=$1", [email]))
        .rowCount,
    ).toBe(0);
  } finally {
    logged.mockRestore();
    await db.pool.query(
      "ALTER TABLE auth_users DROP CONSTRAINT injected_user_failure",
    );
  }
});
test("signup reports a safe dependency stage and recovers after a controlled database timeout", async () => {
  const email = `${randomUUID()}@example.invalid`;
  const subject = `auth-target:sign-up/email:${email}`;
  await quota(db.pool, subject, 5, 3600);
  const key = createHash("sha256")
    .update("rotavise-quota-v1:" + subject)
    .digest("hex");
  const blocker = await db.pool.connect();
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT key_hash FROM plan_quotas WHERE key_hash=$1 FOR UPDATE",
      [key],
    );
    const blockedSignup = authInject(api.app, "sign-up/email", {
      name: "Synthetic timeout farmer",
      email,
      password: TEST_PASSWORD,
    });
    await signup();
    const response = await blockedSignup;
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "AUTH_UNAVAILABLE" });
    expect(logged).toHaveBeenCalledWith(
      "AUTH_DEPENDENCY_UNAVAILABLE",
      expect.objectContaining({
        operation: "sign-up/email",
        stage: "target_quota",
        category: "database_timeout",
      }),
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain(email);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(TEST_PASSWORD);
    expect(
      (await db.pool.query("SELECT id FROM auth_users WHERE email=$1", [email]))
        .rowCount,
    ).toBe(0);
    expect((await db.pool.query("SELECT id FROM auth_mail")).rowCount).toBe(1);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    logged.mockRestore();
  }
  await signup(email);
  expect((await db.pool.query("SELECT id FROM auth_mail")).rowCount).toBe(2);
});
test("strict input, origin, redirect and verification enforcement; generic duplicate signup", async () => {
  const body = {
    name: "Synthetic",
    email: "origin@example.invalid",
    password: TEST_PASSWORD,
  };
  expect(
    (
      await api.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: body,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await api.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        headers: { origin: "https://evil.invalid" },
        payload: body,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (await authInject(api.app, "sign-up/email", { ...body, admin: true }))
      .statusCode,
  ).toBe(400);
  expect(
    (await authInject(api.app, "sign-up/email", { ...body, password: "short" }))
      .statusCode,
  ).toBe(400);
  const email = await signup();
  const res = await authInject(api.app, "sign-up/email", {
    name: "Synthetic",
    email,
    password: TEST_PASSWORD,
  });
  expect(res.json()).toEqual({ status: "verification_required" });
  const invalidRedirect = await authInject(api.app, "request-password-reset", {
    email,
    redirectTo: "https://evil.invalid",
  });
  expect(invalidRedirect.statusCode).toBe(403);
  expect(
    (
      await authInject(api.app, "request-password-reset", {
        email,
        redirectTo: "http://[",
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await api.app.inject({ url: "/api/auth/get-session" })).statusCode,
  ).toBe(404);
});
test("recovery invalidates every old session; single-use reset; password change revokes other sessions", async () => {
  const { email, cookie } = await verified();
  expect(
    (await authInject(api.app, "request-password-reset", { email })).statusCode,
  ).toBe(200);
  const {
    rows: [row],
  } = await db.pool.query("SELECT * FROM auth_mail WHERE kind='recover'");
  const token = new URL(
    decryptMail(config.AUTH_SECRET, row.id, row.ciphertext).url,
  ).pathname
    .split("/")
    .at(-1);
  await mail.tick();
  const reset = { token, newPassword: TEST_PASSWORD + "new" };
  expect((await authInject(api.app, "reset-password", reset)).statusCode).toBe(
    200,
  );
  expect((await authInject(api.app, "reset-password", reset)).statusCode).toBe(
    400,
  );
  expect(
    (await api.app.inject({ url: "/api/v1/account", headers: { cookie } }))
      .statusCode,
  ).toBe(401);
  expect(
    (
      await authInject(api.app, "sign-in/email", {
        email,
        password: TEST_PASSWORD,
      })
    ).statusCode,
  ).toBe(401);
  const login1 = await authInject(api.app, "sign-in/email", {
    email,
    password: reset.newPassword,
  });
  const login2 = await authInject(api.app, "sign-in/email", {
    email,
    password: reset.newPassword,
  });
  expect(
    (
      await authInject(
        api.app,
        "change-password",
        {
          currentPassword: reset.newPassword,
          newPassword: TEST_PASSWORD,
          revokeOtherSessions: true,
        },
        sessionCookie(login1),
      )
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await api.app.inject({
        url: "/api/v1/account",
        headers: { cookie: sessionCookie(login2) },
      })
    ).statusCode,
  ).toBe(401);
});
test("expired DB sessions and revoked sessions are rejected immediately", async () => {
  const { cookie } = await verified();
  await db.pool.query(
    "UPDATE auth_sessions SET expires_at=clock_timestamp()-interval '1 second'",
  );
  expect(
    (await api.app.inject({ url: "/api/v1/account", headers: { cookie } }))
      .statusCode,
  ).toBe(401);
});
test("mail has finite retries, stale lease recovery, deletion and no resurrection", async () => {
  await signup();
  await db.pool.query(
    "UPDATE auth_mail SET status='running',attempts=1,lease_id=$1,lease_until=clock_timestamp()-interval '1 second'",
    [randomUUID()],
  );
  await mail.tick();
  expect(
    (await db.pool.query("SELECT status,attempts,ciphertext FROM auth_mail"))
      .rows[0],
  ).toMatchObject({ status: "sent", attempts: 2, ciphertext: null });
  await signup();
  const unavailable = new MailWorker(db.pool, { ...config, SMTP_PORT: 1 });
  await unavailable.tick();
  unavailable.close();
  expect(
    (
      await db.pool.query(
        "SELECT status,attempts,error_code FROM auth_mail WHERE status='queued'",
      )
    ).rows[0],
  ).toEqual({
    status: "queued",
    attempts: 1,
    error_code: "MAIL_DELIVERY_FAILED",
  });
  await db.pool.query("UPDATE auth_mail SET attempts=5 WHERE status='queued'");
  await mail.tick();
  expect(
    (
      await db.pool.query(
        "SELECT status,ciphertext FROM auth_mail WHERE status='failed'",
      )
    ).rows[0],
  ).toEqual({ status: "failed", ciphertext: null });
  await db.pool.query("DELETE FROM auth_users");
  await mail.tick();
  expect((await db.pool.query("SELECT id FROM auth_mail")).rowCount).toBe(0);
});
test("account delete requires verified confirmation and cascades credentials/sessions/outbox", async () => {
  const { cookie } = await verified();
  const res = await authInject(api.app, "delete-user", {}, cookie);
  expect(res.statusCode).toBe(200);
  const {
    rows: [row],
  } = await db.pool.query("SELECT * FROM auth_mail WHERE kind='delete'");
  const url = new URL(
    decryptMail(config.AUTH_SECRET, row.id, row.ciphertext).url,
  );
  const deleted = await api.app.inject({
    url: url.pathname + url.search,
    headers: { cookie },
  });
  expect([200, 302]).toContain(deleted.statusCode);
  expect((await db.pool.query("SELECT id FROM auth_users")).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM auth_mail")).rowCount).toBe(0);
});
const fieldProfile = () => ({
  schema_version: "1",
  name: "Synthetic test field",
  location: { latitude: 32.3, longitude: -6.3 },
  soil: { status: "unknown" },
  water: { status: "unknown" },
  crop_health: { status: "unknown" },
});
function owned(cookie, path, { method = "GET", body, headers = {} } = {}) {
  return api.app.inject({
    method,
    url: "/api/v1" + path,
    headers: {
      cookie,
      origin: config.AUTH_BASE_URL,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { payload: body } : {}),
  });
}
async function makeField(cookie) {
  const response = await owned(cookie, "/fields", {
    method: "POST",
    body: fieldProfile(),
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}
test("field CRUD is owner scoped, bounded and version checked; stale updates cannot overwrite edits", async () => {
  const a = await verified(),
    b = await verified(),
    field = await makeField(a.cookie);
  expect((await owned(b.cookie, "/fields/" + field.id)).statusCode).toBe(404);
  expect(
    (await owned(b.cookie, "/fields/" + field.id, { method: "DELETE" }))
      .statusCode,
  ).toBe(404);
  expect((await owned(b.cookie, "/fields")).json().items).toHaveLength(0);
  const update = {
    expectedVersion: 1,
    profile: { ...fieldProfile(), name: "Synthetic edited field" },
  };
  const changes = await Promise.all([
    owned(a.cookie, "/fields/" + field.id, { method: "PUT", body: update }),
    owned(a.cookie, "/fields/" + field.id, { method: "PUT", body: update }),
  ]);
  expect(changes.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect((await owned(a.cookie, "/fields/" + field.id)).json()).toMatchObject({
    version: 2,
    profile: { name: "Synthetic edited field" },
  });
  expect((await owned(a.cookie, "/fields?limit=51")).statusCode).toBe(400);
  expect((await owned(a.cookie, "/fields?owner=" + b.email)).statusCode).toBe(
    400,
  );
  expect(
    (await owned(a.cookie, "/fields/" + field.id, { method: "DELETE" }))
      .statusCode,
  ).toBe(204);
});
test("field outlines are owner scoped, version checked, must contain the field point and go with the field", async () => {
  const a = await verified(),
    b = await verified(),
    field = await makeField(a.cookie);
  const square = (lon, lat, d) => ({
    type: "Polygon",
    coordinates: [
      [
        [lon, lat],
        [lon + d, lat],
        [lon + d, lat + d],
        [lon, lat + d],
        [lon, lat],
      ],
    ],
  });
  const path = "/fields/" + field.id + "/boundary";
  const put = (cookie, body) => owned(cookie, path, { method: "PUT", body });
  expect((await owned(a.cookie, path)).json()).toEqual({ boundary: null });
  // The field point (32.3, -6.3) must be inside the outline.
  expect(
    (
      await put(a.cookie, {
        expectedVersion: null,
        boundary: square(-6.4, 32.4, 0.003),
      })
    ).statusCode,
  ).toBe(400);
  const outline = square(-6.3015, 32.2985, 0.003);
  expect(
    (await put(b.cookie, { expectedVersion: null, boundary: outline }))
      .statusCode,
  ).toBe(404);
  const saved = await put(a.cookie, {
    expectedVersion: null,
    boundary: outline,
  });
  expect(saved.statusCode).toBe(200);
  expect(saved.json()).toMatchObject({ version: 1 });
  expect(saved.json().samplePoints).toBeGreaterThan(50);
  expect(saved.json().hectares).toBeGreaterThan(9);
  expect(
    (await put(a.cookie, { expectedVersion: null, boundary: outline }))
      .statusCode,
  ).toBe(409);
  const moved = square(-6.302, 32.298, 0.004);
  const changes = await Promise.all([
    put(a.cookie, { expectedVersion: 1, boundary: moved }),
    put(a.cookie, { expectedVersion: 1, boundary: moved }),
  ]);
  expect(changes.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect((await owned(b.cookie, path)).statusCode).toBe(404);
  const bowtie = {
    type: "Polygon",
    coordinates: [
      [
        [-6.302, 32.298],
        [-6.298, 32.302],
        [-6.298, 32.298],
        [-6.302, 32.302],
        [-6.302, 32.298],
      ],
    ],
  };
  expect(
    (await put(a.cookie, { expectedVersion: 2, boundary: bowtie })).statusCode,
  ).toBe(400);
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM field_boundaries"))
      .rows[0].n,
  ).toBe(1);
  expect(
    (await owned(a.cookie, "/fields/" + field.id, { method: "DELETE" }))
      .statusCode,
  ).toBe(204);
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM field_boundaries"))
      .rows[0].n,
  ).toBe(0);
});
test("observation requests are owner scoped, validated and queued once", async () => {
  const a = await verified(),
    b = await verified(),
    field = await makeField(a.cookie);
  const path = "/fields/" + field.id + "/observations";
  const post = (cookie, body) => owned(cookie, path, { method: "POST", body });
  expect((await post(a.cookie, { kind: "ndvi" })).statusCode).toBe(400);
  // HLS needs a saved outline with at least one sample point.
  expect((await post(a.cookie, { kind: "hls" })).statusCode).toBe(400);
  expect((await post(b.cookie, { kind: "smap" })).statusCode).toBe(404);
  const first = await post(a.cookie, { kind: "smap" });
  expect(first.statusCode).toBe(202);
  expect(first.json()).toMatchObject({
    kind: "smap",
    status: "queued",
    result: null,
  });
  expect((await post(a.cookie, { kind: "smap" })).json().id).toBe(
    first.json().id,
  );
  const list = await owned(a.cookie, path);
  expect(list.json().items.map((o) => o.kind)).toEqual(["smap"]);
  expect((await owned(b.cookie, path)).statusCode).toBe(404);
  expect((await owned(a.cookie, path + "/" + first.json().id)).json().id).toBe(
    first.json().id,
  );
  expect((await owned(b.cookie, path + "/" + first.json().id)).statusCode).toBe(
    404,
  );
  // The analysis endpoints say why there is nothing yet and stay owner scoped.
  for (const kind of ["vegetation", "rain"]) {
    const analysis = "/fields/" + field.id + "/analysis/" + kind;
    const none = await owned(a.cookie, analysis);
    expect(none.statusCode).toBe(200);
    expect(none.json()).toEqual({
      status: "unavailable",
      observation: "none",
      error: null,
    });
    expect((await owned(b.cookie, analysis)).statusCode).toBe(404);
  }
  // The stored request rounds the field point to 0.01°.
  const stored = (
    await db.pool.query("SELECT request FROM field_observations WHERE id=$1", [
      first.json().id,
    ])
  ).rows[0].request;
  expect(stored.points).toEqual([
    { id: "f1", latitude: 32.3, longitude: -6.3 },
  ]);
});
test("terrain and ECOSTRESS extraction routes are owner scoped, need an outline and queue once; water storage says plainly when nothing is imported", async () => {
  const a = await verified(),
    b = await verified(),
    field = await makeField(a.cookie);
  const path = "/fields/" + field.id + "/extractions";
  const post = (cookie, body) => owned(cookie, path, { method: "POST", body });
  expect((await post(a.cookie, { kind: "hls" })).statusCode).toBe(400);
  // Both kinds need a saved outline.
  expect((await post(a.cookie, { kind: "terrain" })).statusCode).toBe(400);
  expect((await post(a.cookie, { kind: "ecostress" })).statusCode).toBe(400);
  expect((await post(b.cookie, { kind: "terrain" })).statusCode).toBe(404);
  const saved = await owned(a.cookie, "/fields/" + field.id + "/boundary", {
    method: "PUT",
    body: {
      expectedVersion: null,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [-6.3015, 32.2985],
            [-6.2985, 32.2985],
            [-6.2985, 32.3015],
            [-6.3015, 32.3015],
            [-6.3015, 32.2985],
          ],
        ],
      },
    },
  });
  expect(saved.statusCode).toBe(200);
  const first = await post(a.cookie, { kind: "terrain" });
  expect(first.statusCode).toBe(202);
  expect(first.json()).toMatchObject({
    kind: "terrain",
    status: "queued",
    result: null,
  });
  expect((await post(a.cookie, { kind: "terrain" })).json().id).toBe(
    first.json().id,
  );
  const other = await post(a.cookie, { kind: "ecostress" });
  expect(other.statusCode).toBe(202);
  expect(
    (await owned(a.cookie, path))
      .json()
      .items.map((e) => e.kind)
      .sort(),
  ).toEqual(["ecostress", "terrain"]);
  expect((await owned(b.cookie, path)).statusCode).toBe(404);
  expect((await owned(a.cookie, path + "/" + first.json().id)).json().id).toBe(
    first.json().id,
  );
  expect((await owned(b.cookie, path + "/" + first.json().id)).statusCode).toBe(
    404,
  );
  // Query strings and a request without a session are refused.
  expect((await owned(a.cookie, path + "?x=1")).statusCode).toBe(400);
  expect((await api.app.inject({ url: "/api/v1" + path })).statusCode).toBe(
    401,
  );
  const water = "/fields/" + field.id + "/water-storage";
  expect((await owned(a.cookie, water)).json()).toEqual({
    available: false,
    reason: "WATER_STORAGE_NOT_IMPORTED",
  });
  expect((await owned(b.cookie, water)).statusCode).toBe(404);
  // MODIS history and GEDI canopy biomass: owner scoped and honest when empty.
  const history = "/fields/" + field.id + "/analysis/vegetation-history";
  expect((await owned(a.cookie, history)).json()).toEqual({
    status: "unavailable",
    observation: "none",
    error: null,
  });
  expect((await post(a.cookie, { kind: "modis" })).statusCode).toBe(202);
  expect((await owned(a.cookie, history)).json()).toEqual({
    status: "unavailable",
    observation: "queued",
    error: null,
  });
  expect((await owned(b.cookie, history)).statusCode).toBe(404);
  const canopy = "/fields/" + field.id + "/canopy-biomass";
  expect((await owned(a.cookie, canopy)).json()).toEqual({
    available: false,
    reason: "CANOPY_BIOMASS_NOT_IMPORTED",
  });
  expect((await owned(b.cookie, canopy)).statusCode).toBe(404);
});
test("field and dated history save atomically; invalid batches leave no partial field", async () => {
  const owner = await verified();
  const first = {
    schema_version: "1",
    crop_id: "durum-wheat",
    planted_on: "2022-10-01",
    harvested_on: "2023-06-01",
  };
  const second = {
    schema_version: "1",
    crop_id: "faba-bean",
    planted_on: "2023-10-01",
    harvested_on: "2024-05-01",
  };
  const url = "/fields-with-history";
  const body = { profile: fieldProfile(), history: [first, second] };
  expect(
    (
      await api.app.inject({
        method: "POST",
        url: "/api/v1" + url,
        headers: {
          origin: config.AUTH_BASE_URL,
          "content-type": "application/json",
        },
        payload: body,
      })
    ).statusCode,
  ).toBe(401);
  const saved = await owned(owner.cookie, url, { method: "POST", body });
  expect(saved.statusCode).toBe(201);
  const history = await owned(
    owner.cookie,
    `/fields/${saved.json().id}/history`,
  );
  expect(
    history
      .json()
      .items.map((item) => item.entry.crop_id)
      .sort(),
  ).toEqual(["durum-wheat", "faba-bean"]);
  const count = (await db.pool.query("SELECT count(*)::int AS n FROM fields"))
    .rows[0].n;
  const overlapping = await owned(owner.cookie, url, {
    method: "POST",
    body: {
      ...body,
      history: [first, { ...second, planted_on: "2023-05-01" }],
    },
  });
  expect(overlapping.statusCode).toBe(400);
  const future = await owned(owner.cookie, url, {
    method: "POST",
    body: { ...body, history: [{ ...first, harvested_on: "2099-06-01" }] },
  });
  expect(future.statusCode).toBe(400);
  await db.pool.query(
    "ALTER TABLE field_crop_history ADD CONSTRAINT injected_batch_failure CHECK (entry->>'crop_id' <> 'synthetic-failure-crop')",
  );
  try {
    const failure = await owned(owner.cookie, url, {
      method: "POST",
      body: {
        ...body,
        history: [first, { ...second, crop_id: "synthetic-failure-crop" }],
      },
    });
    expect(failure.statusCode).toBe(503);
    expect(
      (await db.pool.query("SELECT count(*)::int AS n FROM field_crop_history"))
        .rows[0].n,
    ).toBe(2);
  } finally {
    await db.pool.query(
      "ALTER TABLE field_crop_history DROP CONSTRAINT injected_batch_failure",
    );
  }
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM fields")).rows[0].n,
  ).toBe(count);
});
test("history preserves explicit dates and unknown crops, rejects overlaps/future claims, and cascades with fields", async () => {
  const a = await verified(),
    b = await verified(),
    field = await makeField(a.cookie),
    base = "/fields/" + field.id + "/history";
  const entry = {
    schema_version: "1",
    crop_id: "unsupported-reported-crop",
    planted_on: "2023-10-01",
    harvested_on: "2024-06-01",
  };
  const saved = await owned(a.cookie, base, { method: "POST", body: entry });
  expect(saved.statusCode).toBe(201);
  const id = saved.json().id;
  expect((await owned(b.cookie, base)).statusCode).toBe(404);
  expect(
    (
      await owned(a.cookie, base, {
        method: "POST",
        body: {
          ...entry,
          planted_on: "2024-05-01",
          harvested_on: "2024-10-01",
        },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await owned(a.cookie, base, {
        method: "POST",
        body: {
          ...entry,
          planted_on: "2099-01-01",
          harvested_on: "2099-12-01",
        },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await owned(a.cookie, base + "/" + id, {
        method: "PUT",
        body: {
          expectedVersion: 1,
          entry: { ...entry, crop_id: "durum-wheat" },
        },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await owned(a.cookie, base + "/" + id, {
        method: "PUT",
        body: { expectedVersion: 1, entry },
      })
    ).statusCode,
  ).toBe(409);
  await owned(a.cookie, "/fields/" + field.id, { method: "DELETE" });
  expect(
    (await db.pool.query("SELECT id FROM field_crop_history")).rowCount,
  ).toBe(0);
});
test("saved profiles reject forged confirmations, duplicate soil metrics and future observations", async () => {
  const a = await verified();
  const profile = fieldProfile();
  profile.crop_health = {
    status: "reported",
    observations: [
      {
        crop_id: "durum-wheat",
        kind: "disease",
        name: "Synthetic reported issue",
        observed_on: "2024-01-01",
        source: "farmer_report",
        confirmation: "confirmed",
      },
    ],
  };
  expect(
    (await owned(a.cookie, "/fields", { method: "POST", body: profile }))
      .statusCode,
  ).toBe(400);
  profile.crop_health.observations[0].confirmation = "reported";
  profile.crop_health.observations[0].observed_on = "2099-01-01";
  expect(
    (await owned(a.cookie, "/fields", { method: "POST", body: profile }))
      .statusCode,
  ).toBe(400);
  const soil = {
    metric: "ph",
    value: 7,
    unit: "pH",
    method: "unknown",
    measured_on: null,
    source: "farmer_observation",
  };
  const duplicate = {
    ...fieldProfile(),
    soil: { status: "known", observations: [soil, soil] },
  };
  expect(
    (await owned(a.cookie, "/fields", { method: "POST", body: duplicate }))
      .statusCode,
  ).toBe(400);
});
test("account plan history is private, retains pinned input/versions and has 365-day retention", async () => {
  const a = await verified(),
    b = await verified(),
    input = syntheticPlanInput();
  const accepted = await owned(a.cookie, "/plans", {
    method: "POST",
    headers: { "idempotency-key": "account-history-07" },
    body: input,
  });
  expect(accepted.statusCode).toBe(202);
  const id = accepted.json().id;
  const repeated = await owned(a.cookie, "/plans", {
    method: "POST",
    headers: { "idempotency-key": "account-history-07" },
    body: input,
  });
  expect(repeated.json().id).toBe(id);
  const record = await owned(a.cookie, "/plans/" + id);
  expect(record.statusCode).toBe(200);
  expect(record.json().versions.workflowVersion).toBe("planning-workflow-1");
  expect(
    (Date.parse(record.json().expiresAt) -
      Date.parse(record.json().createdAt)) /
      86400000,
  ).toBeCloseTo(365, 5);
  expect((await owned(b.cookie, "/plans/" + id)).statusCode).toBe(404);
  expect((await owned(b.cookie, "/plans")).json().items).toHaveLength(0);
  expect(
    (await owned(a.cookie, "/plans")).json().items.map((p) => p.id),
  ).toEqual([id]);
  expect(
    (await owned(b.cookie, "/plans/" + id, { method: "DELETE" })).statusCode,
  ).toBe(404);
  expect(
    (await owned(a.cookie, "/plans/" + id, { method: "DELETE" })).statusCode,
  ).toBe(204);
});
test("guest claims require both live proofs, explicit confirmation and fresh login; atomic repeats preserve ID/evidence", async () => {
  const a = await verified(),
    b = await verified();
  const guest = await api.plans.createOwner("synthetic-claim-ip"),
    owner = await api.plans.authenticate(guest.accessToken),
    input = syntheticPlanInput();
  const plan = await api.plans.submit(owner, "synthetic-claim-key", input);
  const original = await api.plans.read(owner, plan.id);
  const path = "/plans/" + plan.id + "/claim",
    headers = { authorization: "Bearer " + guest.accessToken };
  expect(
    (
      await owned(a.cookie, path, {
        method: "POST",
        body: { confirm: false },
        headers,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await owned(a.cookie, path, { method: "POST", body: { confirm: true } }))
      .statusCode,
  ).toBe(401);
  // Controlled timestamps in the disposable DB exercise proof expiry, without
  // disabling the production freshness or guest-session checks.
  await db.pool.query(
    "UPDATE auth_sessions SET created_at=clock_timestamp()-interval '6 minutes' WHERE user_id=(SELECT id FROM auth_users WHERE email=$1)",
    [a.email],
  );
  expect(
    (
      await owned(a.cookie, path, {
        method: "POST",
        body: { confirm: true },
        headers,
      })
    ).statusCode,
  ).toBe(401);
  await db.pool.query(
    "UPDATE auth_sessions SET created_at=clock_timestamp() WHERE user_id=(SELECT id FROM auth_users WHERE email=$1)",
    [a.email],
  );
  const expiring = await api.plans.createOwner("synthetic-expired-claim-ip");
  const expiredOwner = await api.plans.authenticate(expiring.accessToken);
  await db.pool.query(
    "UPDATE plan_owners SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",
    [expiredOwner],
  );
  expect(
    (
      await owned(a.cookie, path, {
        method: "POST",
        body: { confirm: true },
        headers: { authorization: "Bearer " + expiring.accessToken },
      })
    ).statusCode,
  ).toBe(401);
  const claims = await Promise.all([
    owned(a.cookie, path, { method: "POST", body: { confirm: true }, headers }),
    owned(a.cookie, path, { method: "POST", body: { confirm: true }, headers }),
  ]);
  expect(claims.map((r) => r.statusCode)).toEqual([201, 201]);
  expect(
    (
      await owned(b.cookie, path, {
        method: "POST",
        body: { confirm: true },
        headers,
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (await api.app.inject({ url: "/api/v1/plans/" + plan.id, headers }))
      .statusCode,
  ).toBe(404);
  const transferred = (await owned(a.cookie, "/plans/" + plan.id)).json();
  expect(transferred.input).toEqual(original.input);
  expect(transferred.intakeEvidence).toEqual(original.intakeEvidence);
  expect(transferred.versions).toEqual(original.versions);
  const record = (
    await db.pool.query("SELECT * FROM plan_requests WHERE id=$1", [plan.id])
  ).rows[0];
  expect(record.retention).toBe("account");
  expect(record.idempotency_key).toBe("claimed-" + plan.id);
  expect(record.input_hash).toMatch(/^[a-f0-9]{64}$/);
  await expect(
    api.plans.submit(owner, "synthetic-claim-key", input),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await api.plans.revoke(owner);
  expect((await owned(a.cookie, "/plans/" + plan.id)).statusCode).toBe(200);
});
test("cross-origin account writes and ambiguous cookie/bearer access are rejected", async () => {
  const a = await verified(),
    guest = await api.plans.createOwner("synthetic-ambiguous-ip");
  expect(
    (
      await owned(a.cookie, "/fields", {
        method: "POST",
        body: fieldProfile(),
        headers: { origin: "https://evil.invalid" },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await owned(a.cookie, "/plans", {
        method: "POST",
        body: syntheticPlanInput(),
        headers: {
          "idempotency-key": "ambiguous-test-key",
          authorization: "Bearer " + guest.accessToken,
        },
      })
    ).statusCode,
  ).toBe(400);
});
test("shared quotas are atomic across parallel connections; forged forwarded IP cannot evade limits", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      quota(db.pool, "synthetic-concurrent-quota", 3, 60),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  expect(
    results
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason.code === "RATE_LIMITED"),
  ).toBe(true);
  for (let i = 0; i < 5; i++)
    await api.app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      headers: {
        origin: config.AUTH_BASE_URL,
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2." + i,
      },
      payload: { email: "unknown@example.invalid" },
    });
  const response = await api.app.inject({
    method: "POST",
    url: "/api/auth/request-password-reset",
    headers: {
      origin: config.AUTH_BASE_URL,
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.99",
    },
    payload: { email: "unknown@example.invalid" },
  });
  expect(response.statusCode).toBe(429);
});
test("account deletion removes saved fields/history/plans and late workers cannot resurrect them", async () => {
  const a = await verified(),
    field = await makeField(a.cookie);
  await owned(a.cookie, "/fields/" + field.id + "/history", {
    method: "POST",
    body: {
      schema_version: "1",
      crop_id: "durum-wheat",
      planted_on: "2023-01-01",
      harvested_on: "2023-06-01",
    },
  });
  const plan = (
    await owned(a.cookie, "/plans", {
      method: "POST",
      body: syntheticPlanInput(),
      headers: { "idempotency-key": "deleted-account-plan" },
    })
  ).json();
  await authInject(api.app, "delete-user", {}, a.cookie);
  const row = (
      await db.pool.query("SELECT * FROM auth_mail WHERE kind='delete'")
    ).rows[0],
    url = new URL(decryptMail(config.AUTH_SECRET, row.id, row.ciphertext).url);
  expect([200, 302]).toContain(
    (
      await api.app.inject({
        url: url.pathname + url.search,
        headers: { cookie: a.cookie },
      })
    ).statusCode,
  );
  for (const table of [
    "fields",
    "field_crop_history",
    "plan_owners",
    "plan_requests",
    "planning_runs",
    "planning_weather",
    "auth_sessions",
    "auth_accounts",
    "auth_mail",
  ])
    expect((await db.pool.query(`SELECT * FROM ${table}`)).rowCount).toBe(0);
  expect(await api.plans.begin(plan.id)).toBeNull();
  expect(await api.plans.planning.begin(plan.id)).toBeNull();
});
test("production rejects unsafe auth configuration/synthetic injection and sets secure cookie attributes", async () => {
  expect(() =>
    loadConfig({ ...config, NODE_ENV: "production", SMTP_TLS: "local" }),
  ).toThrow(/CONFIG_INVALID/);
  expect(
    () =>
      new PlanningStore(
        db.pool,
        db.boss,
        { ...config, NODE_ENV: "production" },
        undefined,
        { synthetic: true },
      ),
  ).toThrow("PLANNING_SYNTHETIC_REJECTED");
  const a = await verified();
  const production = await createApi(
    loadConfig({
      ...config,
      NODE_ENV: "production",
      TRUST_PROXY: "false",
      AUTH_BASE_URL: "https://rotavise.example.invalid/",
      SMTP_TLS: "starttls",
    }),
  );
  try {
    const login = await production.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: {
        origin: "https://rotavise.example.invalid",
        "content-type": "application/json",
      },
      payload: { email: a.email, password: TEST_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    expect(String(login.headers["set-cookie"])).toContain("Secure");
    expect(String(login.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(login.headers["set-cookie"])).toContain("__Secure-");
  } finally {
    await production.close();
  }
});
test("the database discards OAuth provider tokens on insert and update", async () => {
  const user = (
    await db.pool.query(
      "INSERT INTO auth_users(name,email,email_verified) VALUES('Synthetic token test',$1,true) RETURNING id",
      [`tokens-${randomUUID()}@example.invalid`],
    )
  ).rows[0].id;
  try {
    const tokenColumns =
      "access_token,refresh_token,id_token,access_token_expires_at,refresh_token_expires_at";
    const inserted = (
      await db.pool.query(
        `INSERT INTO auth_accounts(account_id,provider_id,user_id,${tokenColumns},scope)
        VALUES('synthetic-google-subject','google',$1,'synthetic-access','synthetic-refresh','synthetic-id',now(),now(),'openid email')
        RETURNING ${tokenColumns},scope`,
        [user],
      )
    ).rows[0];
    expect(inserted).toEqual({
      access_token: null,
      refresh_token: null,
      id_token: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      scope: "openid email",
    });
    const updated = (
      await db.pool.query(
        `UPDATE auth_accounts SET access_token='synthetic-again',id_token='synthetic-again' WHERE user_id=$1 RETURNING access_token,id_token`,
        [user],
      )
    ).rows[0];
    expect(updated).toEqual({ access_token: null, id_token: null });
    const credential = (
      await db.pool.query(
        "INSERT INTO auth_accounts(account_id,provider_id,user_id,password) VALUES($2,'credential',$1,'synthetic-hash') RETURNING password",
        [user, String(user)],
      )
    ).rows[0];
    expect(credential.password).toBe("synthetic-hash");
  } finally {
    await db.pool.query("DELETE FROM auth_users WHERE id=$1", [user]);
  }
});
test("saved plans, fields and history page newest first with opaque stable cursors", async () => {
  const a = await verified();
  const fieldIds = [];
  for (let i = 0; i < 3; i++) fieldIds.push((await makeField(a.cookie)).id);
  const fields1 = (await owned(a.cookie, "/fields?limit=2")).json();
  expect(fields1.items.map((f) => f.id)).toEqual([fieldIds[2], fieldIds[1]]);
  expect(fields1.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
  const fields2 = (
    await owned(a.cookie, "/fields?limit=2&cursor=" + fields1.nextCursor)
  ).json();
  expect(fields2.items.map((f) => f.id)).toEqual([fieldIds[0]]);
  expect(fields2.nextCursor).toBeNull();
  for (const forged of [
    "not-a-cursor",
    Buffer.from('["1","not-a-uuid"]').toString("base64url"),
    Buffer.from('["2024-01-01","' + randomUUID() + '"]').toString("base64url"),
  ])
    expect((await owned(a.cookie, "/fields?cursor=" + forged)).statusCode).toBe(
      400,
    );
  const entry = (crop_id, planted_on, harvested_on) => ({
    schema_version: "1",
    crop_id,
    planted_on,
    harvested_on,
  });
  const saved = await owned(a.cookie, "/fields-with-history", {
    method: "POST",
    body: {
      profile: fieldProfile(),
      history: [
        entry("durum-wheat", "2021-10-01", "2022-05-01"),
        entry("faba-bean", "2023-10-01", "2024-05-01"),
        entry("durum-wheat", "2022-10-01", "2023-05-01"),
      ],
    },
  });
  expect(saved.statusCode).toBe(201);
  const base = `/fields/${saved.json().id}/history?limit=2`;
  const history1 = (await owned(a.cookie, base)).json();
  expect(history1.items.map((h) => h.entry.planted_on)).toEqual([
    "2023-10-01",
    "2022-10-01",
  ]);
  const history2 = (
    await owned(a.cookie, base + "&cursor=" + history1.nextCursor)
  ).json();
  expect(history2.items.map((h) => h.entry.planted_on)).toEqual(["2021-10-01"]);
  expect(history2.nextCursor).toBeNull();
  const planIds = [];
  for (const key of ["page-plan-1", "page-plan-2", "page-plan-3"]) {
    const accepted = await owned(a.cookie, "/plans", {
      method: "POST",
      headers: { "idempotency-key": key },
      body: syntheticPlanInput(),
    });
    expect(accepted.statusCode).toBe(202);
    planIds.push(accepted.json().id);
  }
  const plans1 = (await owned(a.cookie, "/plans?limit=2")).json();
  expect(plans1.items.map((p) => p.id)).toEqual([planIds[2], planIds[1]]);
  const plans2 = (
    await owned(a.cookie, "/plans?limit=2&cursor=" + plans1.nextCursor)
  ).json();
  expect(plans2.items.map((p) => p.id)).toEqual([planIds[0]]);
  expect(plans2.nextCursor).toBeNull();
  expect((await owned(a.cookie, "/plans?cursor=not-a-cursor")).statusCode).toBe(
    400,
  );
});
test("failed sign-ins from one address cannot lock the farmer out from another", async () => {
  const a = await verified();
  const attempt = (remoteAddress, password) =>
    api.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      remoteAddress,
      headers: {
        origin: config.AUTH_BASE_URL,
        "content-type": "application/json",
      },
      payload: { email: a.email, password },
    });
  for (let i = 0; i < 10; i++) {
    // Clear the library's per-address minute limit to model spread attempts.
    await db.pool.query("TRUNCATE auth_rate_limits");
    const failed = await attempt("203.0.113.66", "Synthetic-wrong-password-09");
    expect([400, 401]).toContain(failed.statusCode);
  }
  await db.pool.query("TRUNCATE auth_rate_limits");
  const blocked = await attempt("203.0.113.66", TEST_PASSWORD);
  expect(blocked.statusCode).toBe(429);
  expect(blocked.json()).toEqual({ code: "RATE_LIMITED" });
  expect(blocked.headers["retry-after"]).toBe("600");
  expect((await attempt("198.51.100.66", TEST_PASSWORD)).statusCode).toBe(200);
});

test("atomic field/boundary creation supports guests and accounts, validates before writing and rolls back database failures", async () => {
  const { readFileSync } = await import("node:fs");
  const fixture = JSON.parse(
    readFileSync("tests/support/fixtures/bg-b0.synthetic.json", "utf8"),
  );
  expect(fixture.synthetic).toBe(true);
  const a = await verified(),
    b = await verified();
  const guest = (
    await api.app.inject({
      method: "POST",
      url: "/api/v1/plan-sessions",
      payload: {},
    })
  ).json();
  const guestOther = (
    await api.app.inject({
      method: "POST",
      url: "/api/v1/plan-sessions",
      payload: {},
    })
  ).json();
  const guestCall = (token, path, method = "GET", body) =>
    api.app.inject({
      method,
      url: "/api/v1" + path,
      headers: { authorization: "Bearer " + token },
      ...(body === undefined ? {} : { payload: body }),
    });
  const owners = [
    {
      send: (path, method, body) => owned(a.cookie, path, { method, body }),
      foreign: (path) => owned(b.cookie, path),
    },
    {
      send: (path, method, body) =>
        guestCall(guest.accessToken, path, method, body),
      foreign: (path) => guestCall(guestOther.accessToken, path),
    },
  ];
  const counts = async () =>
    (
      await db.pool.query(
        "SELECT (SELECT count(*)::int FROM fields) fields,(SELECT count(*)::int FROM field_boundaries) boundaries,(SELECT count(*)::int FROM field_crop_history) history",
      )
    ).rows[0];
  const bodies = (boundary) => [
    ["/fields", { ...fixture.profile, boundary }],
    [
      "/fields-with-history",
      { profile: fixture.profile, history: fixture.history, boundary },
    ],
  ];
  for (const owner of owners) {
    for (const [path, body] of bodies(fixture.boundary)) {
      const response = await owner.send(path, "POST", body);
      expect([response.statusCode, response.body]).toEqual([
        201,
        expect.any(String),
      ]);
      const created = response.json();
      expect(created.profile).not.toHaveProperty("boundary");
      const saved = await owner.send(`/fields/${created.id}/boundary`, "GET");
      expect(saved.json().boundary).toMatchObject({
        boundary: fixture.boundary,
        version: 1,
      });
      expect(
        (await owner.foreign(`/fields/${created.id}/boundary`)).statusCode,
      ).toBe(404);
      const history = (
        await owner.send(`/fields/${created.id}/history`, "GET")
      ).json().items;
      expect(history).toHaveLength(path === "/fields" ? 0 : 1);
    }
    const bad = structuredClone(fixture.boundary);
    bad.coordinates[0].pop();
    const outside = structuredClone(fixture.boundary);
    outside.coordinates[0] = outside.coordinates[0].map(([lon, lat]) => [
      lon + 1,
      lat,
    ]);
    for (const boundary of [bad, outside, null]) {
      for (const [path, body] of bodies(boundary)) {
        const before = await counts();
        expect((await owner.send(path, "POST", body)).statusCode).toBe(400);
        expect(await counts()).toEqual(before);
      }
    }
  }
  expect(
    (
      await api.app.inject({
        method: "POST",
        url: "/api/v1/fields",
        payload: bodies(fixture.boundary)[0][1],
      })
    ).statusCode,
  ).toBe(401);
  // Force an actual database error after the field/history inserts, proving
  // those inserts are in the boundary's transaction rather than committed first.
  await db.pool.query(
    "CREATE FUNCTION reject_b0_boundary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CONTROLLED_B0_BOUNDARY_FAILURE'; END $$; CREATE TRIGGER reject_b0_boundary BEFORE INSERT ON field_boundaries FOR EACH ROW EXECUTE FUNCTION reject_b0_boundary()",
  );
  try {
    for (const owner of owners)
      for (const [path, body] of bodies(fixture.boundary)) {
        const before = await counts();
        expect((await owner.send(path, "POST", body)).statusCode).toBe(503);
        expect(await counts()).toEqual(before);
      }
  } finally {
    await db.pool.query(
      "DROP TRIGGER reject_b0_boundary ON field_boundaries; DROP FUNCTION reject_b0_boundary()",
    );
  }
});

test("account plan labels are owner-only and origin-checked and appear in list/status", async () => {
  const a = await verified(),
    b = await verified();
  const accepted = await owned(a.cookie, "/plans", {
    method: "POST",
    headers: { "idempotency-key": randomUUID() },
    body: { ...syntheticPlanInput(), label: "Parcelle compte" },
  });
  expect(accepted.statusCode).toBe(202);
  const { id } = accepted.json(),
    path = `/plans/${id}/label`;
  expect(
    (await owned(b.cookie, path, { method: "PUT", body: { label: "Foreign" } }))
      .statusCode,
  ).toBe(404);
  expect(
    (
      await owned(a.cookie, path, {
        method: "PUT",
        body: { label: "Foreign" },
        headers: { origin: "https://outside.invalid" },
      })
    ).statusCode,
  ).toBe(401);
  for (let i = 0; i < 2; i++) {
    const response = await owned(a.cookie, path, {
      method: "PUT",
      body: { label: "Nouvelle parcelle" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id, label: "Nouvelle parcelle" });
  }
  expect((await owned(a.cookie, `/plans/${id}`)).json()).toMatchObject({
    label: "Nouvelle parcelle",
    parentPlanId: null,
  });
  expect((await owned(a.cookie, "/plans")).json().items).toEqual([
    expect.objectContaining({
      id,
      label: "Nouvelle parcelle",
      fieldId: null,
      cropIds: null,
      horizonYears: null,
      whatIf: false,
      parentPlanId: null,
    }),
  ]);
  expect((await owned(b.cookie, "/plans")).json().items).toEqual([]);
  expect(
    (await owned(a.cookie, path, { method: "PUT", body: { label: null } }))
      .statusCode,
  ).toBe(200);
});

test("account rotation lists include field summaries and what-if parent links", async () => {
  const a = await verified(),
    b = await verified();
  const field = await makeField(a.cookie);
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.2.0"),
  );
  const { rotationRequest } = await import("../support/rotation.mjs");
  const instance = await createApi({
    ...config,
    ROTATION_CATALOG_VERSION: "0.2.0",
  });
  try {
    await instance.app.getHttpAdapter().getInstance().ready();
    const send = (cookie, path, method = "GET", body, key) =>
      instance.app.inject({
        method,
        url: "/api/v1" + path,
        headers: {
          cookie,
          origin: config.AUTH_BASE_URL,
          ...(key ? { "idempotency-key": key } : {}),
        },
        ...(body === undefined ? {} : { payload: body }),
      });
    const next = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const input = rotationRequest({
      field_id: field.id,
      current_rotation: { crop_ids: ["durum-wheat", "faba-bean"] },
      planning: {
        horizon_years: 4,
        earliest_start_date: next,
        latest_start_date: next,
      },
    });
    const accepted = await send(
      a.cookie,
      "/plans",
      "POST",
      { ...input, label: "Account rotation" },
      randomUUID(),
    );
    expect(accepted.statusCode).toBe(202);
    const { id } = accepted.json();
    const child = await send(
      a.cookie,
      `/plans/${id}/what-if`,
      "POST",
      { what_if: { temperature_change_c: 1 } },
      randomUUID(),
    );
    expect(child.statusCode).toBe(202);
    const childId = child.json().id;
    expect((await send(a.cookie, `/plans/${childId}`)).json()).toMatchObject({
      parentPlanId: id,
      label: null,
    });
    expect((await send(a.cookie, "/plans")).json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id,
          fieldId: field.id,
          fieldName: field.profile.name,
          cropIds: input.current_rotation.crop_ids,
          horizonYears: 4,
          topStrategyCropIds: null,
          whatIf: false,
          parentPlanId: null,
          label: "Account rotation",
        }),
        expect.objectContaining({
          id: childId,
          fieldId: field.id,
          parentPlanId: id,
          whatIf: true,
        }),
      ]),
    );
    expect((await send(b.cookie, "/plans")).json().items).toEqual([]);
    expect(
      (
        await send(
          b.cookie,
          `/plans/${id}/what-if`,
          "POST",
          { what_if: { temperature_change_c: 1 } },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(404);
    expect((await send(a.cookie, `/plans/${id}`, "DELETE")).statusCode).toBe(
      204,
    );
    expect(
      (await send(a.cookie, `/plans/${childId}`)).json().parentPlanId,
    ).toBe(id);
  } finally {
    await instance.close();
  }
});
