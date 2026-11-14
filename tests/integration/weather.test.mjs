import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { disposable, poll, TOKEN, docker } from "../support/index.mjs";
import { migrateApplication } from "../../packages/database/dist/index.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";
import { weatherRequestKey } from "../../apps/server/dist/modules/weather/application/weather-request.js";
import {
  weatherVariables,
  weatherVariableAvailability,
} from "../../packages/contracts/dist/index.js";
import { WEATHER_REGISTRY } from "../../apps/server/dist/modules/weather/providers/nasa-power/parameters.js";
import { createHash } from "node:crypto";
import { stableJson } from "../../apps/server/dist/common/serialization/stable-json.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { weatherCapabilities } from "../../apps/server/dist/modules/weather/application/weather-capabilities.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { createApi } from "../../apps/server/dist/app/create-api.js";
const original = readFileSync(
  "docs/evidence/weather/2026-09-26/nasa-power-beni-mellal-leap.json",
  "utf8",
).trimEnd();
const request = {
  latitude: 32.3373,
  longitude: -6.3498,
  startDate: "2024-02-27",
  endDate: "2024-03-02",
  variables: [
    "temperatureMin",
    "temperatureMax",
    "temperatureMean",
    "precipitation",
  ],
};
let db;
let services = [];
beforeAll(async () => {
  db = await disposable();
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await Promise.all(services.map((service) => service.close()));
  services = [];
  // Disposable test DB only; immutable runtime rows are never truncated by application code.
  await db.pool.query("TRUNCATE weather_cache,weather_snapshots CASCADE");
});
function service(provider) {
  const instance = new WeatherService(db.pool, provider);
  services.push(instance);
  return instance;
}
function recordedProvider({ latency = 0, raw = original } = {}) {
  return {
    calls: 0,
    async fetch(input, signal) {
      this.calls++;
      await delay(latency, undefined, { signal });
      // Explicit historical recorded weather fixture, never fabricated agricultural output.
      const data = JSON.parse(raw);
      for (const [variable, spec] of Object.entries(WEATHER_REGISTRY))
        if (!input.variables.includes(variable)) {
          delete data.properties.parameter[spec.parameter];
          delete data.parameters[spec.parameter];
        }
      // Recorded at a point inside this POWER cell. POWER returns the same
      // values anywhere in a cell (docs/evidence/climate-scenarios/2026-10-17),
      // so the fixture is addressed to the cell centre that adapter 3 requests.
      data.geometry.coordinates = [
        input.longitude,
        input.latitude,
        data.geometry.coordinates[2],
      ];
      data.header.sources = data.header.sources.filter(
        (source) =>
          source === "POWER" ||
          input.variables.some(
            (v) => weatherVariableAvailability[v].source === source,
          ),
      );
      const response = JSON.stringify(data);
      return { raw: response, snapshot: normalizeNasa(response, input) };
    },
  };
}
test("real migration is repeatable and required schema checks pass", async () => {
  await migrateApplication(db.pool);
  await service(recordedProvider()).ready();
  const version = await db.pool.query("SHOW server_version");
  expect(version.rows[0].server_version).toMatch(/^18\.4/);
});
test("persists evidence, survives service restart and JSONB ordering, canonical subset keys differ", async () => {
  const provider = recordedProvider();
  const first = await service(provider).query(request);
  expect(first.cache).toBe("miss");
  const again = await service(provider).query({
    ...request,
    variables: [...request.variables].reverse(),
  });
  expect(again.cache).toBe("hit");
  expect(again.snapshotId).toBe(first.snapshotId);
  expect(again.snapshot).toEqual(first.snapshot);
  const subset = await service(provider).query({
    ...request,
    variables: ["precipitation"],
  });
  expect(subset.snapshotId).not.toBe(first.snapshotId);
  expect(subset.snapshot.days[0].values).toEqual({ precipitation: 1.77 });
  expect(provider.calls).toBe(2);
});
test("twelve concurrent consumers across separate services deduplicate with PostgreSQL", async () => {
  const provider = recordedProvider({ latency: 200 });
  const a = service(provider),
    b = service(provider);
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b).query(request)),
  );
  expect(new Set(results.map((r) => r.snapshotId)).size).toBe(1);
  expect(provider.calls).toBe(1);
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(1);
});
test("expiry creates a fresh immutable snapshot; database rejects edits/deletes and mismatched keys", async () => {
  const first = await service(recordedProvider()).query(request);
  await db.pool.query(
    "UPDATE weather_cache SET expires_at=clock_timestamp()-interval '1 second'",
  );
  const altered = JSON.parse(original);
  altered.properties.parameter.T2M["20240229"] += 0.1;
  const second = await service(
    recordedProvider({ raw: JSON.stringify(altered) }),
  ).query(request);
  expect(second.snapshotId).not.toBe(first.snapshotId);
  expect(second.snapshot.provenance.rawSha256).not.toBe(
    first.snapshot.provenance.rawSha256,
  );
  const previous = await db.pool.query(
    "SELECT raw FROM weather_snapshots WHERE id=$1",
    [first.snapshotId],
  );
  expect(
    JSON.parse(previous.rows[0].raw).properties.parameter.T2M["20240229"],
  ).toBe(9.77);
  await expect(
    db.pool.query("UPDATE weather_snapshots SET raw='{}' WHERE id=$1", [
      first.snapshotId,
    ]),
  ).rejects.toThrow("WEATHER_SNAPSHOT_IMMUTABLE");
  await expect(
    db.pool.query("DELETE FROM weather_snapshots WHERE id=$1", [
      first.snapshotId,
    ]),
  ).rejects.toThrow("WEATHER_SNAPSHOT_IMMUTABLE");
  await expect(
    db.pool.query(
      "INSERT INTO weather_cache(request_key,snapshot_id,expires_at) VALUES($1,$2,now())",
      ["0".repeat(64), first.snapshotId],
    ),
  ).rejects.toThrow();
});
test("controlled refresh failure preserves prior snapshot without returning it as fresh", async () => {
  const first = await service(recordedProvider()).query(request);
  await db.pool.query(
    "UPDATE weather_cache SET expires_at=clock_timestamp()-interval '1 second'",
  );
  const failing = service({
    async fetch() {
      throw new Error("synthetic upstream failure with private details");
    },
  });
  await expect(failing.query(request)).rejects.toThrow(
    "WEATHER_UPSTREAM_UNAVAILABLE",
  );
  const row = (
    await db.pool.query(
      "SELECT snapshot_id,expires_at<clock_timestamp() AS stale,lease_owner FROM weather_cache",
    )
  ).rows[0];
  expect(row).toMatchObject({
    snapshot_id: first.snapshotId,
    stale: true,
    lease_owner: null,
  });
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(1);
});
test("synthetic malformed evidence is never persisted", async () => {
  const bad = JSON.parse(original);
  bad.parameters.T2M.units = "F";
  await expect(
    service(recordedProvider({ raw: JSON.stringify(bad) })).query(request),
  ).rejects.toThrow("WEATHER_UPSTREAM_INVALID");
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(0);
  expect(
    (await db.pool.query("SELECT lease_owner FROM weather_cache")).rows[0]
      .lease_owner,
  ).toBeNull();
});
test("late owner cannot overwrite the successor after controlled lease expiry", async () => {
  let resume;
  let claimed = false;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const underlying = recordedProvider();
  const old = service({
    async fetch(input, signal) {
      claimed = true;
      await gate;
      return underlying.fetch(input, signal);
    },
  });
  const pending = old.query(request);
  const handled = expect(pending).rejects.toThrow("WEATHER_BUSY");
  await poll(() => claimed, { label: "controlled old owner" });
  await db.pool.query(
    "UPDATE weather_cache SET lease_until=clock_timestamp()-interval '1 second'",
  );
  const winner = await service(recordedProvider()).query(request);
  resume();
  await handled;
  const row = (await db.pool.query("SELECT snapshot_id FROM weather_cache"))
    .rows[0];
  expect(row.snapshot_id).toBe(winner.snapshotId);
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(1);
});
test("SIGKILL cache owner recovers after actual lease expiry without an open transaction", async () => {
  const child = spawn(
    process.execPath,
    ["tests/support/fixtures/weather-owner.mjs"],
    {
      env: { ...process.env, DATABASE_URL: db.url },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (value) => {
    output += value;
  });
  child.stderr.on("data", (value) => {
    output += value;
  });
  const exited = once(child, "exit");
  try {
    await poll(() => output.includes("synthetic_weather_owner_claimed"), {
      label: "weather lease owner",
    });
    const activeTransactions = await db.pool.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'",
    );
    expect(activeTransactions.rows[0].n).toBe(0);
    child.kill("SIGKILL");
    await exited;
    const started = Date.now();
    const recovered = await service(recordedProvider()).query(request);
    expect(recovered.cache).toBe("miss");
    expect(Date.now() - started).toBeGreaterThan(15000);
    expect(Date.now() - started).toBeLessThan(25000);
    expect(
      (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
        .rows[0].n,
    ).toBe(1);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }
});
test("cancelled wait clears only its lease and permits recovery", async () => {
  const instance = service(recordedProvider({ latency: 10000 }));
  const controller = new AbortController();
  const pending = instance.query(request, controller.signal);
  const handled = expect(pending).rejects.toThrow("WEATHER_CANCELLED");
  await poll(
    async () =>
      (await db.pool.query("SELECT lease_owner FROM weather_cache")).rowCount,
  );
  controller.abort();
  await handled;
  expect(
    (await db.pool.query("SELECT lease_owner FROM weather_cache")).rows[0]
      .lease_owner,
  ).toBeNull();
  expect((await service(recordedProvider()).query(request)).cache).toBe("miss");
});
test("bounded consumers fail visibly without unbounded pending work", async () => {
  let resume;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const underlying = recordedProvider();
  const instance = service({
    async fetch(input, signal) {
      await gate;
      return underlying.fetch(input, signal);
    },
  });
  const pending = Array.from({ length: 16 }, () => instance.query(request));
  await expect(instance.query(request)).rejects.toThrow("WEATHER_BUSY");
  resume();
  await Promise.all(pending);
});
test("production internal routes require a separate token, use persisted evidence and expose no harness", async () => {
  const first = await service(recordedProvider()).query(request);
  const config = loadConfig({
    NODE_ENV: "production",
    TRUST_PROXY: "false",
    DATABASE_URL: db.url,
    WEATHER_ENABLED: "true",
    WEATHER_INTERNAL_TOKEN: TOKEN,
  });
  const api = await createApi(config);
  const inject = (url, options = {}) => api.app.inject({ url, ...options });
  try {
    expect(
      (await inject("/api/v1/internal/weather/capabilities")).statusCode,
    ).toBe(401);
    expect(
      (
        await inject("/api/v1/internal/weather/capabilities", {
          headers: { "x-weather-token": "bad" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await inject("/api/v1/internal/weather/capabilities", {
          headers: { "x-weather-token": TOKEN },
        })
      ).json(),
    ).toEqual(weatherCapabilities());
    const response = await inject("/api/v1/internal/weather/query", {
      method: "POST",
      headers: { "x-weather-token": TOKEN },
      payload: request,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cache: "hit",
      snapshotId: first.snapshotId,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await inject("/api/v1/internal/weather/query", {
          method: "POST",
          payload: request,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await inject("/api/v1/internal/weather/query", {
          method: "POST",
          headers: { "x-weather-token": TOKEN },
          payload: { ...request, variables: ["unsupported"] },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await inject("/api/v1/dev/test-jobs/" + randomUUID())).statusCode,
    ).toBe(404);
    expect((await inject("/api/v1/health/ready")).json()).toMatchObject({
      dependenciesReady: true,
      dataCompleteness: { ok: false },
    });
    await db.pool.query(
      "UPDATE weather_cache SET request_key=request_key WHERE request_key=$1",
      [weatherRequestKey(request)],
    );
  } finally {
    await api.close();
  }
});
test("public weather boundary serves selected recorded evidence without exposing the internal token", async () => {
  const first = await service(recordedProvider()).query(request);
  const api = await createApi(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      WEATHER_ENABLED: "true",
      WEATHER_INTERNAL_TOKEN: TOKEN,
      AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3000",
    }),
  );
  const base = "/api/v1/weather";
  const headers = {
    origin: "http://127.0.0.1:3000",
    "content-type": "application/json",
  };
  try {
    const capabilities = await api.app.inject(base + "/capabilities");
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toMatchObject({
      provider: "nasa-power",
      maxDays: 366,
    });
    expect(capabilities.json().variables).toHaveLength(7);
    const response = await api.app.inject({
      method: "POST",
      url: base + "/query",
      headers,
      payload: request,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshotId: first.snapshotId,
      cache: "hit",
    });
    expect(JSON.stringify(response.json())).not.toContain(TOKEN);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await api.app.inject({
          method: "POST",
          url: base + "/query",
          payload: request,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await api.app.inject({
          method: "POST",
          url: base + "/query",
          headers: { ...headers, origin: "https://evil.invalid" },
          payload: request,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await api.app.inject({
          method: "POST",
          url: base + "/query",
          headers,
          payload: { ...request, variables: ["unsupported"] },
        })
      ).statusCode,
    ).toBe(400);
    for (let index = 0; index < 10; index++) {
      const cached = await api.app.inject({
        method: "POST",
        url: base + "/query",
        headers,
        payload: request,
      });
      expect(cached.statusCode).toBe(200);
    }
    const limited = await api.app.inject({
      method: "POST",
      url: base + "/query",
      headers,
      payload: request,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({ code: "RATE_LIMITED" });
    expect(limited.headers["retry-after"]).toBe("3600");
  } finally {
    await api.close();
  }
});
test("weather routes default disabled; missing configured secret is rejected", async () => {
  expect(() =>
    loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: db.url,
      WEATHER_ENABLED: "true",
    }),
  ).toThrow("CONFIG_INVALID: WEATHER_INTERNAL_TOKEN");
  const api = await createApi(
    loadConfig({
      NODE_ENV: "production",
      TRUST_PROXY: "false",
      DATABASE_URL: db.url,
    }),
  );
  try {
    expect(
      (await api.app.inject("/api/v1/internal/weather/capabilities"))
        .statusCode,
    ).toBe(404);
  } finally {
    await api.close();
  }
});
test("real database outage fails safely and recovers the persisted cache", async () => {
  const instance = service(recordedProvider());
  const first = await instance.query(request);
  const api = await createApi(
    loadConfig({
      NODE_ENV: "production",
      TRUST_PROXY: "false",
      DATABASE_URL: db.url,
      WEATHER_ENABLED: "true",
      WEATHER_INTERNAL_TOKEN: TOKEN,
    }),
  );
  try {
    docker("stop", "-t", "1", db.name);
    await expect(instance.query(request)).rejects.toThrow(
      "WEATHER_STORAGE_UNAVAILABLE",
    );
    expect((await api.app.inject("/api/v1/health/live")).statusCode).toBe(200);
    expect((await api.app.inject("/api/v1/health/ready")).statusCode).toBe(503);
    const response = await api.app.inject({
      url: "/api/v1/internal/weather/query",
      method: "POST",
      headers: { "x-weather-token": TOKEN },
      payload: request,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "WEATHER_STORAGE_UNAVAILABLE" });
    docker("start", db.name);
    await poll(() => db.pool.query("SELECT 1"), {
      label: "restarted weather database",
    });
    const recovered = await instance.query(request);
    expect(recovered.cache).toBe("hit");
    expect(recovered.snapshotId).toBe(first.snapshotId);
  } finally {
    docker("start", db.name);
    await api.close();
  }
});

const expandedRaw = readFileSync(
  "docs/evidence/weather/2026-09-27/nasa-power-expanded.json",
  "utf8",
);
const expandedRequest = { ...request, variables: [...weatherVariables] };
test("persists all seven real measurements and serves mixed/single selections from the PostgreSQL cache", async () => {
  const provider = recordedProvider({ raw: expandedRaw });
  const first = await service(provider).query(expandedRequest);
  expect(first.cache).toBe("miss");
  expect(first.snapshot.coverage).toHaveLength(7);
  expect(first.snapshot.days[2].values.relativeHumidity).toBe(51.08);
  const repeat = await service(provider).query({
    ...expandedRequest,
    variables: [...expandedRequest.variables].reverse(),
  });
  expect(repeat.cache).toBe("hit");
  expect(repeat.snapshotId).toBe(first.snapshotId);
  expect(repeat.snapshot).toEqual(first.snapshot);
  for (const variable of ["relativeHumidity", "windSpeed", "solarRadiation"]) {
    const subset = await service(provider).query({
      ...request,
      variables: [variable],
    });
    expect(Object.keys(subset.snapshot.days[0].values)).toEqual([variable]);
    expect(
      (await service(provider).query({ ...request, variables: [variable] }))
        .snapshotId,
    ).toBe(subset.snapshotId);
  }
  expect(provider.calls).toBe(4);
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(4);
});
test("legacy cache evidence stays immutable and a v2 query appends a separate snapshot", async () => {
  const input = { ...request, variables: [...request.variables].sort() };
  const old = normalizeNasa(original, input, undefined, "2");
  old.provenance.adapterVersion = "1";
  old.provenance.attribution =
    "NASA Langley Research Center POWER Project; MERRA-2; https://power.larc.nasa.gov/";
  const hash = (v) => createHash("sha256").update(v).digest("hex");
  const oldKey = hash(
    JSON.stringify({
      provider: "nasa-power",
      adapterVersion: "1",
      timeStandard: "UTC",
      request: input,
    }),
  );
  const id = randomUUID();
  await db.pool.query(
    "INSERT INTO weather_snapshots(id,request_key,raw,raw_sha256,normalized_sha256,snapshot) VALUES($1,$2,$3,$4,$5,$6)",
    [id, oldKey, original, hash(original), hash(stableJson(old)), old],
  );
  await db.pool.query(
    "INSERT INTO weather_cache(request_key,snapshot_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '30 days')",
    [oldKey, id],
  );
  const provider = recordedProvider();
  const current = await service(provider).query(request);
  expect(current.cache).toBe("miss");
  expect(current.snapshotId).not.toBe(id);
  expect(current.snapshot.provenance.adapterVersion).toBe("3");
  expect(
    (
      await db.pool.query(
        "SELECT snapshot FROM weather_snapshots WHERE id=$1",
        [id],
      )
    ).rows[0].snapshot,
  ).toEqual(old);
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(2);
});
test("production protected HTTP returns seven persisted measurements and rejects dates before selected-variable availability", async () => {
  const first = await service(recordedProvider({ raw: expandedRaw })).query(
    expandedRequest,
  );
  const api = await createApi(
    loadConfig({
      NODE_ENV: "production",
      TRUST_PROXY: "false",
      DATABASE_URL: db.url,
      WEATHER_ENABLED: "true",
      WEATHER_INTERNAL_TOKEN: TOKEN,
    }),
  );
  try {
    const response = await api.app.inject({
      url: "/api/v1/internal/weather/query",
      method: "POST",
      headers: { "x-weather-token": TOKEN },
      payload: expandedRequest,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshotId: first.snapshotId,
      cache: "hit",
      snapshot: { complete: true },
    });
    expect(response.json().snapshot.coverage).toHaveLength(7);
    expect(
      (
        await api.app.inject({
          url: "/api/v1/internal/weather/query",
          method: "POST",
          headers: { "x-weather-token": TOKEN },
          payload: {
            ...expandedRequest,
            startDate: "2000-12-31",
            endDate: "2001-01-01",
          },
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await api.close();
  }
});
test("controlled missing new variables remain null after persistence and invalid solar source is never stored", async () => {
  const missing = JSON.parse(expandedRaw);
  missing.properties.parameter.RH2M["20240229"] = -999;
  delete missing.properties.parameter.WS2M["20240228"];
  const saved = await service(
    recordedProvider({ raw: JSON.stringify(missing) }),
  ).query(expandedRequest);
  const cached = await service(recordedProvider()).query(expandedRequest);
  expect(cached.snapshotId).toBe(saved.snapshotId);
  expect(cached.snapshot.complete).toBe(false);
  expect(cached.snapshot.days[2].values.relativeHumidity).toBeNull();
  expect(cached.snapshot.days[1].values.windSpeed).toBeNull();
  const invalid = JSON.parse(expandedRaw);
  invalid.header.sources = ["MERRA2", "POWER"];
  await expect(
    service(recordedProvider({ raw: JSON.stringify(invalid) })).query({
      ...request,
      variables: ["solarRadiation"],
    }),
  ).rejects.toThrow("WEATHER_UPSTREAM_INVALID");
  expect(
    (await db.pool.query("SELECT count(*)::int AS n FROM weather_snapshots"))
      .rows[0].n,
  ).toBe(1);
});
