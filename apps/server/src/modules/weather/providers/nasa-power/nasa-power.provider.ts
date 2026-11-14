import { setTimeout as delay } from "node:timers/promises";
import type { WeatherRequest } from "@rotavise/contracts";
import { WeatherError, type WeatherProvider } from "../weather-provider.js";
import { NASA_ENDPOINT, WEATHER_REGISTRY } from "./parameters.js";
import { normalizeNasa } from "./normalization.js";
export function nasaUrl(request: WeatherRequest) {
  const url = new URL(NASA_ENDPOINT);
  const params = {
    parameters: request.variables
      .map((v) => WEATHER_REGISTRY[v].parameter)
      .join(","),
    community: "AG",
    format: "JSON",
    "time-standard": "UTC",
    latitude: request.latitude,
    longitude: request.longitude,
    start: request.startDate.replaceAll("-", ""),
    end: request.endDate.replaceAll("-", ""),
  };
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  return url;
}
export class NasaPowerProvider implements WeatherProvider {
  // Constructor injection is for controlled tests; runtime configuration cannot change the endpoint.
  constructor(private readonly http: typeof fetch = fetch) {}
  async fetch(request: WeatherRequest, signal: AbortSignal) {
    const deadline = AbortSignal.timeout(15000);
    const overall = AbortSignal.any([signal, deadline]);
    for (let attempt = 0; attempt < 3; attempt++) {
      const attemptTimeout = AbortSignal.timeout(5000);
      try {
        const response = await this.http(nasaUrl(request), {
          signal: AbortSignal.any([overall, attemptTimeout]),
          redirect: "manual",
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < 2
          ) {
            const header = response.headers.get("retry-after");
            const retryMs =
              header === null
                ? 200 * 2 ** attempt
                : /^\d+$/.test(header)
                  ? Number(header) * 1000
                  : Date.parse(header) - Date.now();
            if (!Number.isFinite(retryMs) || retryMs > 2000)
              throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
            await delay(Math.max(0, retryMs), undefined, { signal: overall });
            continue;
          }
          throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
        }
        if (
          !response.headers
            .get("content-type")
            ?.toLowerCase()
            .includes("application/json") ||
          Number(response.headers.get("content-length") ?? 0) > 1_048_576
        ) {
          await response.body?.cancel();
          throw new WeatherError("WEATHER_UPSTREAM_INVALID");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new WeatherError("WEATHER_UPSTREAM_INVALID");
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 1_048_576)
              throw new WeatherError("WEATHER_UPSTREAM_INVALID");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        let raw: string;
        try {
          raw = new TextDecoder("utf-8", { fatal: true }).decode(
            Buffer.concat(chunks),
          );
        } catch {
          throw new WeatherError("WEATHER_UPSTREAM_INVALID");
        }
        return { raw, snapshot: normalizeNasa(raw, request) };
      } catch (error) {
        if (signal.aborted) throw new WeatherError("WEATHER_CANCELLED");
        if (deadline.aborted) throw new WeatherError("WEATHER_TIMEOUT");
        if (error instanceof WeatherError) throw error;
        // Native fetch errors may originate in another realm (notably Jest ESM).
        const name =
          typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "";
        if (
          attemptTimeout.aborted ||
          ["TypeError", "TimeoutError", "AbortError"].includes(name)
        ) {
          if (attempt < 2) {
            await delay(200 * 2 ** attempt, undefined, {
              signal: overall,
            }).catch(() => {
              throw new WeatherError(
                signal.aborted ? "WEATHER_CANCELLED" : "WEATHER_TIMEOUT",
              );
            });
            continue;
          }
          throw new WeatherError(
            attemptTimeout.aborted || name !== "TypeError"
              ? "WEATHER_TIMEOUT"
              : "WEATHER_UPSTREAM_UNAVAILABLE",
          );
        }
        throw new WeatherError("WEATHER_UPSTREAM_INVALID");
      }
    }
    throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
  }
}
