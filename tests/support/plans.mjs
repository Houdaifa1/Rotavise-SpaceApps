import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/plans.synthetic.json", import.meta.url),
    "utf8",
  ),
);
export function syntheticPlanInput() {
  if (fixture.synthetic !== true) throw new Error("MISSING_SYNTHETIC_LABEL");
  const input = structuredClone(fixture.input),
    now = Date.now();
  const day = (n) => new Date(now + n * 86400000).toISOString().slice(0, 10);
  input.planning = {
    cycles: 2,
    earliest_start_date: day(7),
    latest_start_date: day(14),
    search_end_date: day(730),
  };
  return input;
}
export function planHttp(api, path, { token, key, body, method = "GET" } = {}) {
  return fetch(api.origin + path, {
    method,
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(key ? { "idempotency-key": key } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
export async function planSession(api) {
  const res = await planHttp(api, "/api/v1/plan-sessions", {
    method: "POST",
    body: {},
  });
  if (res.status !== 201)
    throw new Error(
      "SESSION_CREATION_FAILED " + res.status + ": " + (await res.text()),
    );
  return res.json();
}
export async function submitPlan(
  api,
  token,
  input = syntheticPlanInput(),
  key = randomUUID(),
) {
  const res = await planHttp(api, "/api/v1/plans", {
    method: "POST",
    token,
    key,
    body: input,
  });
  if (res.status !== 202)
    throw new Error(
      "PLAN_CREATION_FAILED " + res.status + ": " + (await res.text()),
    );
  return res.json();
}
