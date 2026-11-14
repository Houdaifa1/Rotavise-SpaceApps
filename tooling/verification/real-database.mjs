import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createPool } from "../../packages/database/dist/index.js";
import { databaseConfig } from "../operations/database-tools.mjs";
import { tokenHash } from "../../apps/server/dist/modules/plans/application/plan-policy.js";
import { DataCompletenessService } from "../../apps/server/dist/modules/health/data-completeness.js";

// A run-private role cannot mutate shared catalogs/climate/regional stores. It
// can exercise the actual application/queues and clean up only its own owners.
export async function realDatabase() {
  const config = databaseConfig();
  const admin = createPool(config.DATABASE_URL);
  const complete = await new DataCompletenessService(admin).check(true);
  if (!complete.ok) {
    await admin.end();
    throw Error(`DATABASE INCOMPLETE: ${JSON.stringify(complete)}`);
  }
  const role = `b6_${randomUUID().replaceAll("-", "")}`;
  const password = randomUUID();
  const owned = [];
  const createdPlans = [];
  const createdExtractions = [];
  const evidence = new Set();
  const capturedPlans = new Set();
  const ips = [];
  const emails = [];
  const quotaKey = (subject) =>
    createHash("sha256")
      .update("rotavise-quota-v1:" + subject)
      .digest("hex");
  const snapshots = new Set(
    (await admin.query("SELECT id FROM weather_snapshots")).rows.map(
      (r) => r.id,
    ),
  );
  // Identifiers/password are generated UUIDs, never external input.
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
  await admin.query(`GRANT CONNECT ON DATABASE rotavise TO ${role}`);
  for (const schema of ["public", "pgboss", "drizzle"]) {
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await admin.query(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`,
    );
    await admin.query(
      `GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`,
    );
  }
  await admin.query(
    `REVOKE INSERT,UPDATE,DELETE ON catalog_versions,climate_scenario_units,climate_scenario_tiles,regional_water_storage,regional_gedi_biomass FROM ${role}`,
  );
  const url = new URL(config.DATABASE_URL);
  url.username = role;
  url.password = password;
  const pool = createPool(url.href);
  return {
    url: url.href,
    pool,
    async trackSession(token) {
      const row = (
        await pool.query("SELECT id FROM plan_owners WHERE token_hash=$1", [
          tokenHash(token),
        ])
      ).rows[0];
      assert.ok(row);
      owned.push(row.id);
    },
    trackIp(ip) {
      ips.push(ip);
    },
    trackPlan(id) {
      createdPlans.push(id);
    },
    trackExtraction(id) {
      createdExtractions.push(id);
    },
    async captureEvidence(id) {
      if (capturedPlans.has(id)) return;
      for (const r of (
        await pool.query(
          "SELECT snapshot_id FROM planning_weather WHERE request_id=$1",
          [id],
        )
      ).rows)
        if (!snapshots.has(r.snapshot_id)) evidence.add(r.snapshot_id);
      capturedPlans.add(id);
    },
    registerAccount(email) {
      emails.push(email);
    },
    async trackAccount(email) {
      const rows = (
        await pool.query(
          "SELECT o.id FROM plan_owners o JOIN auth_users u ON u.id=o.user_id WHERE u.email=$1",
          [email],
        )
      ).rows;
      for (const r of rows) owned.push(r.id);
    },
    async clearQuotas() {
      // These addresses exist only on this test API's trusted local connection.
      await pool.query(
        "DELETE FROM plan_quotas WHERE key_hash=ANY($1::text[])",
        [
          ips.flatMap((ip) =>
            [
              "http:",
              "fields-http:",
              "catalog-detail:",
              "catalog-options:",
            ].map((prefix) =>
              createHash("sha256")
                .update("rotavise-quota-v1:" + prefix + ip)
                .digest("hex"),
            ),
          ),
        ],
      );
    },
    async close() {
      const client = await admin.connect();
      try {
        await client.query("BEGIN");
        const plans = [
          ...createdPlans,
          ...(
            await client.query(
              "SELECT id FROM plan_requests WHERE owner_id=ANY($1::uuid[])",
              [owned],
            )
          ).rows.map((r) => r.id),
        ];
        const candidate = [
          ...evidence,
          ...(
            await client.query(
              "SELECT DISTINCT snapshot_id FROM planning_weather WHERE request_id=ANY($1::uuid[])",
              [plans],
            )
          ).rows
            .map((r) => r.snapshot_id)
            .filter((id) => !snapshots.has(id)),
        ];
        await client.query(
          "DELETE FROM fields WHERE guest_owner_id=ANY($1::uuid[])",
          [owned],
        );
        // Claimed test accounts are identified through owners created by this run.
        const users = (
          await client.query(
            "SELECT user_id FROM plan_owners WHERE id=ANY($1::uuid[]) AND user_id IS NOT NULL UNION SELECT id AS user_id FROM auth_users WHERE email=ANY($2::text[])",
            [owned, emails],
          )
        ).rows.map((r) => r.user_id);
        await client.query(
          "DELETE FROM plan_requests WHERE owner_id=ANY($1::uuid[])",
          [owned],
        );
        await client.query("DELETE FROM auth_users WHERE id=ANY($1::uuid[])", [
          users,
        ]);
        await client.query("DELETE FROM plan_owners WHERE id=ANY($1::uuid[])", [
          owned,
        ]);
        await client.query(
          "DELETE FROM pgboss.job WHERE data->>'requestId'=ANY($1::text[]) OR data->>'id'=ANY($1::text[])",
          [[...plans, ...createdExtractions]],
        );
        await client.query(
          "SELECT set_config('rotavise.weather_retention','on',true)",
        );
        await client.query(
          "DELETE FROM weather_cache c WHERE snapshot_id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM planning_weather w WHERE w.snapshot_id=c.snapshot_id)",
          [candidate],
        );
        await client.query(
          "DELETE FROM weather_snapshots s WHERE id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM planning_weather w WHERE w.snapshot_id=s.id) AND NOT EXISTS(SELECT 1 FROM weather_cache c WHERE c.snapshot_id=s.id)",
          [candidate],
        );
        await client.query(
          "DELETE FROM plan_quotas WHERE key_hash=ANY($1::text[])",
          [
            ips.flatMap((ip) =>
              [
                "http:",
                "fields-http:",
                "catalog-detail:",
                "catalog-options:",
                "session:",
                "auth-http:",
                "account-http:",
              ].map((prefix) =>
                createHash("sha256")
                  .update("rotavise-quota-v1:" + prefix + ip)
                  .digest("hex"),
              ),
            ),
          ],
        );
        const emailQuotas = emails.flatMap((email) =>
          [
            "sign-up/email",
            "sign-in/email",
            "request-password-reset",
            "send-verification-email",
          ].flatMap((path) => [
            quotaKey(`auth-target:${path}:${email}`),
            ...ips.map((ip) => quotaKey(`auth-target:${path}:${email}:${ip}`)),
          ]),
        );
        await client.query(
          "DELETE FROM plan_quotas WHERE key_hash=ANY($1::text[])",
          [emailQuotas],
        );
        for (const ip of ips)
          await client.query(
            "DELETE FROM auth_rate_limits WHERE position($1 in key)>0",
            [ip],
          );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
        await pool.end();
        await admin.query(`DROP OWNED BY ${role}`);
        await admin.query(`DROP ROLE ${role}`);
        await admin.end();
      }
    },
  };
}
