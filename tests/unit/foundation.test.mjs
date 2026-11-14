import { describe, test, expect } from "@jest/globals";
import {
  loadConfig,
  trustProxySetting,
} from "../../apps/server/dist/config/environment.js";
import {
  syntheticInputSchema,
  healthSchema,
  idempotencyKeySchema,
} from "../../packages/contracts/dist/index.js";
const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:secret@localhost:5432/db",
};
describe("configuration and runtime contracts", () => {
  test.each([
    {},
    { ...base, DATABASE_URL: "not-a-url-private-password" },
    { ...base, API_PORT: "0" },
    {
      ...base,
      NODE_ENV: "production",
      DEV_HARNESS_ENABLED: "true",
      DEV_HARNESS_TOKEN: "x".repeat(32),
    },
    { ...base, DEV_HARNESS_ENABLED: "true" },
    { ...base, NODE_ENV: "production", TEST_WORKER_FAULT: "terminal" },
    { ...base, DEV_HARNESS_ENABLED: "yes" },
    { ...base, EARTHDATA_USERNAME: "rotavise-secret-user" },
    { ...base, EARTHDATA_PASSWORD: "secret-password-value" },
    { ...base, CLIMATE_SCENARIOS_ENABLED: "true" },
    { ...base, SCENARIO_FETCH_CONCURRENCY: "9" },
  ])("rejects invalid configuration without values (%#)", (env) => {
    expect(() => loadConfig(env)).toThrow(/CONFIG_INVALID/);
    try {
      loadConfig(env);
    } catch (error) {
      expect(error.message).not.toContain("secret");
      expect(error.message).not.toContain("password");
      expect(error.message).not.toContain("postgresql://");
    }
  });
  test("accepts paired Earthdata credentials and enabled future climate", () => {
    const config = loadConfig({
      ...base,
      EARTHDATA_USERNAME: "rotavise",
      EARTHDATA_PASSWORD: "x".repeat(12),
      PLANS_ENABLED: "true",
      PLANNING_ENABLED: "true",
      CLIMATE_SCENARIOS_ENABLED: "true",
    });
    expect(config.SCENARIO_FETCH_CONCURRENCY).toBe(2);
    expect(config.SCENARIO_TILES_PER_DAY).toBe(4);
  });
  test("accepts strict development and production settings", () => {
    expect(loadConfig(base).DEV_HARNESS_ENABLED).toBe("false");
    expect(
      loadConfig({ ...base, NODE_ENV: "production" }).TEST_WORKER_FAULT,
    ).toBe("none");
  });
  test.each([
    "true",
    "0",
    "10",
    "yes",
    "10.0.0.0/33",
    "::1/129",
    "10.0.0.1/8/1",
    "",
  ])("rejects unsafe trusted-proxy setting %p", (value) =>
    expect(() => loadConfig({ ...base, TRUST_PROXY: value })).toThrow(
      "CONFIG_INVALID: TRUST_PROXY",
    ),
  );
  test("resolves trusted-proxy settings and requires one in production", () => {
    expect(trustProxySetting(loadConfig(base))).toBe(false);
    expect(
      trustProxySetting(loadConfig({ ...base, TRUST_PROXY: "false" })),
    ).toBe(false);
    expect(trustProxySetting(loadConfig({ ...base, TRUST_PROXY: "2" }))).toBe(
      2,
    );
    expect(
      trustProxySetting(
        loadConfig({ ...base, TRUST_PROXY: "10.0.0.0/8, 192.0.2.1,::1/128" }),
      ),
    ).toBe("10.0.0.0/8,192.0.2.1,::1/128");
    expect(() =>
      trustProxySetting(loadConfig({ ...base, NODE_ENV: "production" })),
    ).toThrow("CONFIG_INVALID: TRUST_PROXY");
    expect(
      trustProxySetting(
        loadConfig({ ...base, NODE_ENV: "production", TRUST_PROXY: "1" }),
      ),
    ).toBe(1);
  });
  test("normalizes finite infrastructure payloads", () => {
    expect(
      syntheticInputSchema.parse({ operation: "echo", message: " hello " }),
    ).toEqual({ operation: "echo", message: "hello" });
  });
  test.each([
    { operation: "crop", message: "x" },
    { operation: "echo", message: " " },
    { operation: "echo", message: "x".repeat(257) },
    { operation: "echo", message: "x", fault: "terminal" },
    { operation: "echo", message: 1 },
  ])("rejects malformed synthetic payload (%#)", (input) =>
    expect(syntheticInputSchema.safeParse(input).success).toBe(false),
  );
  test("health rejects fake shape and invalid timestamps", () => {
    expect(healthSchema.safeParse({ status: "ready" }).success).toBe(false);
    expect(
      healthSchema.safeParse({
        service: "rotavise-api",
        status: "ready",
        checkedAt: "yesterday",
      }).success,
    ).toBe(false);
  });
  test("bounds idempotency keys", () => {
    expect(idempotencyKeySchema.safeParse("a".repeat(81)).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("key with spaces").success).toBe(
      false,
    );
  });
});
