import { setTimeout as delay } from "node:timers/promises";
import type { ScenarioUnitIdentity } from "@rotavise/contracts";
import {
  normalizeScenario,
  scenarioFileName,
  ScenarioError,
} from "./normalization.js";
export const NCSS_ENDPOINT =
  "https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6";
const MAX_BYTES = 262144;
export function scenarioUrl(identity: ScenarioUnitIdentity) {
  const { model, experiment, variable, tile } = identity;
  const url = new URL(
    `${NCSS_ENDPOINT}/${model.id}/${experiment}/${model.variant}/${variable}/${scenarioFileName(identity)}`,
  );
  // Bounds at the outer cell centres select exactly the tile's 4 × 4 cells.
  for (const [key, value] of Object.entries({
    var: variable,
    north: tile.latitude + 0.875,
    south: tile.latitude + 0.125,
    west: tile.longitude + 0.125,
    east: tile.longitude + 0.875,
    temporal: "all",
    accept: "netcdf3",
  }))
    url.searchParams.set(key, String(value));
  return url;
}
export interface ScenarioProvider {
  fetch(
    identity: ScenarioUnitIdentity,
    signal: AbortSignal,
  ): Promise<{ raw: Uint8Array; retrievedAt: string }>;
}
// One request reads a whole model year on the server (about 10 s observed on
// 2026-10-17), so attempts allow 90 s and retry twice with backoff.
export class NexGddpProvider implements ScenarioProvider {
  constructor(private readonly http: typeof fetch = fetch) {}
  async fetch(identity: ScenarioUnitIdentity, signal: AbortSignal) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const timeout = AbortSignal.timeout(90000);
      try {
        const response = await this.http(scenarioUrl(identity), {
          signal: AbortSignal.any([signal, timeout]),
          redirect: "manual",
          headers: { accept: "application/x-netcdf" },
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < 2
          ) {
            await delay(2000 * 2 ** attempt, undefined, { signal });
            continue;
          }
          throw new ScenarioError("SCENARIO_UPSTREAM_UNAVAILABLE");
        }
        if (
          response.headers.get("content-type")?.split(";")[0] !==
            "application/x-netcdf" ||
          Number(response.headers.get("content-length") ?? 0) > MAX_BYTES
        ) {
          await response.body?.cancel();
          throw new ScenarioError("SCENARIO_UPSTREAM_INVALID");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new ScenarioError("SCENARIO_UPSTREAM_INVALID");
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_BYTES)
              throw new ScenarioError("SCENARIO_UPSTREAM_INVALID");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const raw = new Uint8Array(Buffer.concat(chunks));
        const retrievedAt = new Date().toISOString();
        // Validated here so a bad response is not retried as a network fault.
        normalizeScenario(raw, identity, retrievedAt);
        return { raw, retrievedAt };
      } catch (error) {
        if (signal.aborted) throw new ScenarioError("SCENARIO_CANCELLED");
        if (error instanceof ScenarioError) throw error;
        const name =
          typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "";
        if (
          timeout.aborted ||
          ["TypeError", "TimeoutError", "AbortError"].includes(name)
        ) {
          if (attempt < 2) {
            await delay(2000 * 2 ** attempt, undefined, { signal }).catch(
              () => {
                throw new ScenarioError("SCENARIO_CANCELLED");
              },
            );
            continue;
          }
          throw new ScenarioError(
            timeout.aborted
              ? "SCENARIO_TIMEOUT"
              : "SCENARIO_UPSTREAM_UNAVAILABLE",
          );
        }
        throw new ScenarioError("SCENARIO_UPSTREAM_INVALID");
      }
    }
    throw new ScenarioError("SCENARIO_UPSTREAM_UNAVAILABLE");
  }
}
