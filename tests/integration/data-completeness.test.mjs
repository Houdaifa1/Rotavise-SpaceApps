import { test, expect } from "@jest/globals";
import { disposable, processEnv, startApi, stop } from "../support/index.mjs";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { DataCompletenessService } from "../../apps/server/dist/modules/health/data-completeness.js";

test("real PostgreSQL partial database fails completeness and both readiness aliases; capabilities names the gaps", async () => {
  const db = await disposable();
  let api;
  try {
    const check = new DataCompletenessService(db.pool);
    const data = await check.check(true);
    expect(data.ok).toBe(false);
    expect(data.incomplete).toEqual(
      expect.arrayContaining([
        "catalogs",
        "climateMidCentury",
        "climateNearTerm",
        "climateUnits",
        "grace",
        "gedi",
      ]),
    );
    for (const dataset of [
      "migrations",
      "indexes",
      "constraints",
      "triggers",
      "autovacuum",
    ])
      expect(data.datasets.find((d) => d.dataset === dataset)).toMatchObject({
        ok: true,
      });
    api = await createApi(
      loadConfig(processEnv(db, { DATA_COMPLETENESS_REQUIRED: "true" })),
    );
    for (const path of ["/api/v1/health/ready", "/health/ready"]) {
      const r = await api.app.inject({ url: path });
      expect(r.statusCode).toBe(503);
      expect(r.json()).toMatchObject({
        dependenciesReady: true,
        dataCompleteness: {
          ok: false,
          incomplete: expect.arrayContaining(["grace", "gedi"]),
        },
      });
    }
    const caps = await api.app.inject({ url: "/api/v1/capabilities" });
    expect(caps.statusCode).toBe(200);
    expect(caps.json().dataCompleteness.ok).toBe(false);
    await db.pool.query(
      "ALTER TABLE climate_scenario_units DISABLE TRIGGER climate_scenario_units_immutable",
    );
    await db.pool.query("DROP INDEX plan_owner_list_idx");
    const broken = await check.check(true);
    expect(broken.incomplete).toEqual(
      expect.arrayContaining(["indexes", "triggers"]),
    );
  } finally {
    await api?.close();
    await db.close();
  }
});

test("production startup reports incomplete datasets and readiness stays unavailable", async () => {
  const db = await disposable();
  let api;
  try {
    api = await startApi(db, {
      NODE_ENV: "production",
      DEV_HARNESS_ENABLED: "false",
      TRUST_PROXY: "false",
    });
    expect(api.child.output).toContain('"code":"DATABASE_INCOMPLETE"');
    expect(api.child.output).toContain("climateNearTerm");
    const response = await fetch(api.origin + "/health/ready");
    expect(response.status).toBe(503);
    expect((await response.json()).dataCompleteness.incomplete).toEqual(
      expect.arrayContaining(["grace", "gedi"]),
    );
  } finally {
    if (api) await stop(api.child);
    await db.close();
  }
});
