import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type pg from "pg";
import {
  weatherResponseSchema,
  weatherSnapshotSchema,
  type WeatherResponse,
} from "@rotavise/contracts";
import {
  canonicalWeatherRequest,
  weatherRequestKey,
} from "./weather-request.js";
import { normalizeNasa } from "../providers/nasa-power/normalization.js";
import { NasaPowerProvider } from "../providers/nasa-power/nasa-power.provider.js";
import {
  WeatherError,
  type WeatherProvider,
} from "../providers/weather-provider.js";
import { stableJson } from "../../../common/serialization/stable-json.js";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class WeatherService {
  private active = 0;
  private upstream = 0;
  private readonly shutdown = new AbortController();
  private readonly pending = new Set<Promise<WeatherResponse>>();
  constructor(
    private readonly pool: pg.Pool,
    private readonly provider: WeatherProvider = new NasaPowerProvider(),
  ) {}
  async ready() {
    await this.pool.query(
      "SELECT c.request_key,c.snapshot_id,c.expires_at,c.lease_owner,c.lease_until,s.raw,s.raw_sha256,s.normalized_sha256,s.snapshot FROM weather_cache c LEFT JOIN weather_snapshots s ON s.id=c.snapshot_id LIMIT 0",
    );
  }
  async evidence(snapshotId: string, synthetic = false) {
    const q = await this.pool.query(
      "SELECT raw,raw_sha256,normalized_sha256,snapshot FROM weather_snapshots WHERE id=$1",
      [snapshotId],
    );
    const row = q.rows[0];
    if (!row) throw new WeatherError("WEATHER_STORAGE_UNAVAILABLE");
    try {
      const snapshot = weatherSnapshotSchema.parse(row.snapshot);
      const version = snapshot.provenance.adapterVersion;
      if (version === "1") throw new Error("LEGACY_EVIDENCE");
      const normalized = normalizeNasa(
        row.raw,
        snapshot.request,
        snapshot.provenance.retrievedAt,
        version,
      );
      if (
        sha256(row.raw) !== row.raw_sha256 ||
        sha256(stableJson(snapshot)) !== row.normalized_sha256 ||
        stableJson(normalized) !== stableJson(snapshot) ||
        (!synthetic && /synthetic/i.test(snapshot.provenance.apiVersion))
      )
        throw new Error("INVALID_EVIDENCE");
      return {
        snapshotId,
        normalizedSha256: row.normalized_sha256 as string,
        synthetic,
        snapshot,
      };
    } catch {
      throw new WeatherError("WEATHER_STORAGE_UNAVAILABLE");
    }
  }
  async close() {
    this.shutdown.abort();
    await Promise.allSettled([...this.pending]);
  }
  async query(input: unknown, signal?: AbortSignal): Promise<WeatherResponse> {
    // Bound both waiting database consumers and expensive upstream work.
    if (this.active >= 16 || this.shutdown.signal.aborted)
      return Promise.reject(new WeatherError("WEATHER_BUSY"));
    const request = canonicalWeatherRequest(input);
    this.active++;
    const operation = this.execute(
      request,
      AbortSignal.any([
        this.shutdown.signal,
        AbortSignal.timeout(25000),
        ...(signal ? [signal] : []),
      ]),
    ).finally(() => {
      this.active--;
      this.pending.delete(operation);
    });
    this.pending.add(operation);
    return operation;
  }
  private async execute(
    request: ReturnType<typeof canonicalWeatherRequest>,
    signal: AbortSignal,
  ): Promise<WeatherResponse> {
    const key = weatherRequestKey(request);
    const owner = randomUUID();
    try {
      while (!signal.aborted) {
        const cached = await this.pool.query(
          "SELECT c.snapshot_id,c.expires_at,s.snapshot,s.raw,s.raw_sha256,s.normalized_sha256 FROM weather_cache c JOIN weather_snapshots s ON s.id=c.snapshot_id AND s.request_key=c.request_key WHERE c.request_key=$1 AND c.expires_at>clock_timestamp()",
          [key],
        );
        if (cached.rows[0]) {
          const row = cached.rows[0];
          const snapshot = weatherSnapshotSchema.parse(row.snapshot);
          // Detect storage corruption; revalidate raw evidence, not merely the shape.
          let normalized;
          try {
            normalized = normalizeNasa(
              row.raw,
              request,
              snapshot.provenance.retrievedAt,
            );
          } catch {
            throw new WeatherError("WEATHER_STORAGE_UNAVAILABLE");
          }
          if (
            sha256(row.raw) !== row.raw_sha256 ||
            sha256(stableJson(snapshot)) !== row.normalized_sha256 ||
            stableJson(normalized) !== stableJson(snapshot)
          )
            throw new WeatherError("WEATHER_STORAGE_UNAVAILABLE");
          return weatherResponseSchema.parse({
            snapshotId: row.snapshot_id,
            cache: "hit",
            expiresAt: row.expires_at.toISOString(),
            snapshot,
          });
        }
        const claimed = await this.pool.query(
          `INSERT INTO weather_cache(request_key,lease_owner,lease_until) VALUES($1,$2,clock_timestamp()+interval '20 seconds') ON CONFLICT(request_key) DO UPDATE SET lease_owner=$2,lease_until=clock_timestamp()+interval '20 seconds' WHERE (weather_cache.lease_until IS NULL OR weather_cache.lease_until<=clock_timestamp()) AND (weather_cache.expires_at IS NULL OR weather_cache.expires_at<=clock_timestamp()) RETURNING request_key`,
          [key, owner],
        );
        if (!claimed.rowCount) {
          await delay(100, undefined, { signal });
          continue;
        }
        if (this.upstream >= 2) throw new WeatherError("WEATHER_BUSY");
        this.upstream++;
        try {
          const fetched = await this.provider
            .fetch(request, signal)
            .catch((error: unknown) => {
              if (error instanceof WeatherError) throw error;
              if (signal.aborted) throw new WeatherError("WEATHER_CANCELLED");
              console.error("WEATHER_UPSTREAM_FAILURE");
              throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
            });
          if (signal.aborted) throw new WeatherError("WEATHER_CANCELLED");
          // Normalize again at the persistence boundary to forbid mismatched injected output.
          const snapshot = normalizeNasa(
            fetched.raw,
            request,
            fetched.snapshot.provenance.retrievedAt,
          );
          const normalizedHash = sha256(stableJson(snapshot));
          const id = randomUUID();
          const client = await this.pool.connect();
          try {
            await client.query("BEGIN");
            const ownership = await client.query(
              "SELECT request_key FROM weather_cache WHERE request_key=$1 AND lease_owner=$2 AND lease_until>clock_timestamp() FOR UPDATE",
              [key, owner],
            );
            if (!ownership.rowCount) throw new WeatherError("WEATHER_BUSY");
            await client.query(
              "INSERT INTO weather_snapshots(id,request_key,raw,raw_sha256,normalized_sha256,snapshot) VALUES($1,$2,$3,$4,$5,$6)",
              [
                id,
                key,
                fetched.raw,
                snapshot.provenance.rawSha256,
                normalizedHash,
                snapshot,
              ],
            );
            const published = await client.query(
              "UPDATE weather_cache SET snapshot_id=$3,expires_at=clock_timestamp()+interval '30 days',lease_owner=NULL,lease_until=NULL WHERE request_key=$1 AND lease_owner=$2 RETURNING expires_at",
              [key, owner, id],
            );
            await client.query("COMMIT");
            return weatherResponseSchema.parse({
              snapshotId: id,
              cache: "miss",
              expiresAt: published.rows[0].expires_at.toISOString(),
              snapshot,
            });
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
          }
        } finally {
          this.upstream--;
        }
      }
      throw new WeatherError("WEATHER_CANCELLED");
    } catch (error) {
      // A failure never replaces a prior snapshot or extends its freshness.
      await this.pool
        .query(
          "UPDATE weather_cache SET lease_owner=NULL,lease_until=NULL WHERE request_key=$1 AND lease_owner=$2",
          [key, owner],
        )
        .catch(() => {
          console.error("WEATHER_LEASE_RELEASE_UNAVAILABLE");
        });
      if (error instanceof WeatherError) throw error;
      if (signal.aborted) throw new WeatherError("WEATHER_CANCELLED");
      throw new WeatherError("WEATHER_STORAGE_UNAVAILABLE");
    }
  }
}
