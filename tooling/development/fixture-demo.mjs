import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { runSchema } from "../../packages/contracts/dist/index.js";
import { setTimeout as delay } from "node:timers/promises";
const env = parseEnv(readFileSync(".env", "utf8"));
const origin = `http://127.0.0.1:${env.API_PORT ?? 3000}`;
const token = env.DEV_HARNESS_TOKEN;
if (!token) throw new Error("Set DEV_HARNESS_TOKEN in .env");
const response = await fetch(origin + "/api/v1/dev/test-jobs", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-dev-token": token,
    "idempotency-key": randomUUID(),
  },
  body: JSON.stringify({
    operation: "echo",
    message: "Rotavise infrastructure fixture",
  }),
});
if (response.status !== 202)
  throw new Error(`Submission rejected: ${response.status}`);
const { id } = await response.json();
console.log(`Accepted infrastructure fixture: ${id}`);
const deadline = Date.now() + 40000;
while (Date.now() < deadline) {
  const response = await fetch(`${origin}/api/v1/dev/test-jobs/${id}`, {
    headers: { "x-dev-token": token },
  });
  if (!response.ok) throw new Error(`Lookup unavailable: ${response.status}`);
  const run = runSchema.parse(await response.json());
  if (["completed", "failed"].includes(run.status)) {
    console.log(JSON.stringify(run, null, 2));
    if (run.status === "failed") process.exitCode = 1;
    break;
  }
  await delay(250);
}
if (Date.now() >= deadline)
  throw new Error("Worker did not complete within 40 seconds");
