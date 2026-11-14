import { healthSchema } from "@rotavise/contracts";
export async function fetchBackendHealth(signal: AbortSignal) {
  const response = await fetch("/api/v1/health/ready", {
    signal,
    cache: "no-store",
  });
  const health = healthSchema.parse(await response.json());
  if (
    !response.ok ||
    health.status !== "ready" ||
    Math.abs(Date.now() - Date.parse(health.checkedAt)) > 10000
  )
    throw new Error("Unavailable");
  return health;
}
