import { randomUUID } from "node:crypto";
import { TOKEN } from "./token.mjs";
export function request(
  api,
  path,
  { token = TOKEN, key, body, method = "GET" } = {},
) {
  return fetch(api.origin + path, {
    method,
    headers: {
      ...(token ? { "x-dev-token": token } : {}),
      ...(key ? { "idempotency-key": key } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
export async function submit(
  api,
  message = "synthetic fixture",
  key = randomUUID(),
) {
  const response = await request(api, "/api/v1/dev/test-jobs", {
    method: "POST",
    key,
    body: { operation: "echo", message },
  });
  if (response.status !== 202)
    throw new Error(
      `Submission failed ${response.status}: ${await response.text()}`,
    );
  return (await response.json()).id;
}
