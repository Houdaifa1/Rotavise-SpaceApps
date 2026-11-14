import { afterEach, expect, jest, test } from "@jest/globals";
import { z } from "zod";
import { Owner, guestKey } from "../../apps/web/src/features/session/owner.js";
import { ApiClient } from "../../apps/web/src/api/client.js";
import {
  api,
  ApiFailure,
  clearHttpCache,
  observeNetwork,
  retryAfter,
} from "../../apps/web/src/app/http.js";
import { listFields, getField } from "../../apps/web/src/api/fields.js";
import { claimPlan } from "../../apps/web/src/api/plans.js";
import { getGlossary } from "../../apps/web/src/api/glossary.js";
import {
  guest,
  renewedGuest,
  account,
  response,
} from "../support/fixtures/f1.js";
import {
  preloadBootReads,
  takeBootRead,
  releaseBootRead,
} from "../../apps/web/src/app/boot-transport.js";
import { glossaryFor } from "../../packages/domain/dist/index.js";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  sessionStorage.clear();
  clearHttpCache();
});
const transport = () => {
  const mock = jest.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
};
function client() {
  const owner = new Owner(sessionStorage);
  owner.setAccount(null);
  return new ApiClient(owner);
}
test("boot reads overlap module loading and are consumed once through schema validation", async () => {
  const fetch = transport();
  fetch.mockImplementation(async (path) =>
    response(
      path === "/api/v1/health/live"
        ? { service: "rotavise-api", status: "live" }
        : { code: "NOT_FOUND" },
      path === "/api/v1/health/live" ? 200 : 404,
    ),
  );
  localStorage.setItem("rv.lang", "en");
  preloadBootReads();
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(
    await api(
      "/api/v1/health/live",
      z.strictObject({
        service: z.literal("rotavise-api"),
        status: z.literal("live"),
      }),
      { credentials: "omit" },
    ),
  ).toEqual({ service: "rotavise-api", status: "live" });
  expect(fetch).toHaveBeenCalledTimes(4);
  for (const path of [
    "/api/v1/capabilities",
    "/api/v1/catalog/options",
    "/api/v1/glossary?lang=en",
  ]) {
    const read = await takeBootRead(path);
    if (read) releaseBootRead(read);
  }
  expect(takeBootRead("/api/v1/health/live")).toBeUndefined();
  expect(fetch.mock.calls.some(([path]) => path === "/api/v1/account")).toBe(
    false,
  );
  localStorage.clear();
});
test("guest creation is lazy, concurrent calls share one token and omit cookies", async () => {
  const fetch = transport();
  const api = client();
  expect(fetch).not.toHaveBeenCalled();
  fetch
    .mockResolvedValueOnce(response(guest, 201))
    .mockResolvedValue(response({ items: [], nextCursor: null }));
  await Promise.all([listFields(api), listFields(api)]);
  expect(
    fetch.mock.calls.filter(([path]) => path === "/api/v1/plan-sessions"),
  ).toHaveLength(1);
  for (const [, init] of fetch.mock.calls)
    expect(init?.credentials).toBe("omit");
  expect(fetch.mock.calls[1]![1]?.headers).toMatchObject({
    Authorization: `Bearer ${guest.accessToken}`,
  });
  expect(JSON.parse(sessionStorage.getItem(guestKey)!)).toEqual(guest);
});
test("cookie mode sends no bearer; claim is the sole dual-credential call", async () => {
  const fetch = transport();
  const api = client();
  api.owner.saveGuest(guest);
  api.owner.setAccount(account);
  fetch.mockResolvedValueOnce(response({ items: [], nextCursor: null }));
  await listFields(api);
  expect(fetch.mock.calls[0]![1]?.credentials).toBe("same-origin");
  expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty("Authorization");
  fetch.mockResolvedValueOnce(response({ id: account.id, claimed: true }));
  await claimPlan(api, { params: { id: account.id }, body: { confirm: true } });
  expect(fetch.mock.calls[1]![1]).toMatchObject({
    credentials: "same-origin",
    headers: { Authorization: `Bearer ${guest.accessToken}` },
  });
});
test("an expired cookie session requests sign-in without creating a guest", async () => {
  const fetch = transport();
  const api = client();
  api.owner.setAccount(account);
  fetch.mockResolvedValue(response({ code: "UNAUTHORIZED" }, 401));
  await expect(listFields(api)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(api.owner.snapshot()).toMatchObject({
    account: undefined,
    signInRequired: true,
    guest: null,
  });
});
test("unauthorized guest retries once, announces lost old data, then requires sign-in", async () => {
  const fetch = transport();
  const api = client();
  api.owner.saveGuest(guest);
  fetch
    .mockResolvedValueOnce(response({ code: "UNAUTHORIZED" }, 401))
    .mockResolvedValueOnce(response(renewedGuest, 201))
    .mockResolvedValueOnce(response({ code: "UNAUTHORIZED" }, 401));
  await expect(listFields(api)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(api.owner.snapshot()).toMatchObject({
    recovered: true,
    signInRequired: true,
    guest: renewedGuest,
  });
});
test("concurrent rejected requests refresh once and successful retry uses the new bearer", async () => {
  const fetch = transport();
  const api = client();
  api.owner.saveGuest(guest);
  fetch.mockImplementation(async (path, init) =>
    path === "/api/v1/plan-sessions"
      ? response(renewedGuest, 201)
      : (init?.headers as Record<string, string>).Authorization ===
          `Bearer ${guest.accessToken}`
        ? response({ code: "UNAUTHORIZED" }, 401)
        : response({ items: [], nextCursor: null }),
  );
  await Promise.all([listFields(api), listFields(api)]);
  expect(
    fetch.mock.calls.filter(([path]) => path === "/api/v1/plan-sessions"),
  ).toHaveLength(1);
});
test("blocked storage remains functional in memory; invalid or expired tokens are rejected", async () => {
  const owner = new Owner({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  });
  owner.saveGuest(guest);
  expect(owner.snapshot().guest).toEqual(guest);
  owner.saveGuest(null);
  expect(owner.snapshot().guest).toBeNull();
  sessionStorage.setItem(
    guestKey,
    JSON.stringify({ ...guest, expiresAt: "2000-01-01T00:00:00.000Z" }),
  );
  expect(new Owner(sessionStorage).snapshot().guest).toBeNull();
});
test("invalid UUID is rejected before any private request or session creation", async () => {
  const fetch = transport();
  expect(() => getField(client(), { params: { id: "invalid" } })).toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
test("conditional glossary reuses only schema-validated bytes on 304, isolated per language", async () => {
  const fetch = transport();
  const api = client();
  fetch
    .mockResolvedValueOnce(
      response(glossaryFor("fr"), 200, { ETag: '"fr-version"' }),
    )
    .mockResolvedValueOnce(response(null, 304))
    .mockResolvedValueOnce(
      response(glossaryFor("en"), 200, { ETag: '"en-version"' }),
    );
  const first = await getGlossary(api, { query: { lang: "fr" } });
  expect(await getGlossary(api, { query: { lang: "fr" } })).toEqual(first);
  await getGlossary(api, { query: { lang: "en" } });
  expect(fetch.mock.calls[1]![1]?.headers).toMatchObject({
    "If-None-Match": '"fr-version"',
  });
  expect(fetch.mock.calls[2]![1]?.headers).not.toHaveProperty("If-None-Match");
});
test("malformed success and orphan 304 fail closed; retry-after accepts seconds and dates", async () => {
  const fetch = transport();
  fetch
    .mockResolvedValueOnce(response({ wrong: true }))
    .mockResolvedValueOnce(response(null, 304));
  await expect(
    api("/api/v1/health/ready", z.strictObject({ ok: z.boolean() })),
  ).rejects.toMatchObject({ code: "INVALID_SERVER_RESPONSE" });
  await expect(
    api("/api/v1/health/ready", z.strictObject({ ok: z.boolean() }), {
      conditional: true,
    }),
  ).rejects.toBeInstanceOf(ApiFailure);
  expect(retryAfter("12", 0)).toBe(12);
  expect(retryAfter("Thu, 01 Jan 1970 00:00:15 GMT", 0)).toBe(15);
  expect(retryAfter("bad", 0)).toBeUndefined();
});
test("network failures are observable, cancellation is not an offline failure", async () => {
  const fetch = transport();
  const states: boolean[] = [];
  const unsubscribe = observeNetwork((state) => states.push(state));
  fetch.mockRejectedValue(new Error("network"));
  await expect(api("/api/v1/health/ready", z.string())).rejects.toMatchObject({
    code: "NETWORK_UNAVAILABLE",
  });
  const controller = new AbortController();
  controller.abort();
  await expect(
    api("/api/v1/health/ready", z.string(), { signal: controller.signal }),
  ).rejects.toThrow();
  expect(states).toEqual([false]);
  unsubscribe();
});
