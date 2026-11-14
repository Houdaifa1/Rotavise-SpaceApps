import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  scenarioVariables,
  type FutureClimatePolicy,
  type ScenarioSeries,
  type ScenarioTile,
  type ScenarioUnitIdentity,
} from "@rotavise/contracts";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { withTransaction } from "../../../infrastructure/database/transaction.js";
import {
  NexGddpProvider,
  type ScenarioProvider,
} from "../providers/nex-gddp/nex-gddp.provider.js";
import {
  normalizeScenario,
  SCENARIO_ADAPTER_VERSION,
  ScenarioError,
} from "../providers/nex-gddp/normalization.js";

const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const unitKey = (identity: ScenarioUnitIdentity) =>
  sha256(
    stableJson({
      provider: "nccs-thredds-ncss",
      adapterVersion: SCENARIO_ADAPTER_VERSION,
      identity,
    }),
  );
export const policyKey = (policy: FutureClimatePolicy) =>
  sha256(stableJson({ policy, variables: scenarioVariables }));
// Every unit a tile needs under a policy: all models, windows, data years and
// temperature variables, so any plan in the tile can be assessed.
export function tileUnits(policy: FutureClimatePolicy, tile: ScenarioTile) {
  const units: ScenarioUnitIdentity[] = [];
  for (const model of policy.models)
    for (const window of [
      policy.baseline,
      ...policy.futures,
      // After the older windows, so an extended tile only adds these years.
      ...(policy.nearTerm?.windows ?? []),
    ])
      for (
        let year = window.firstAnchorYear;
        year <= window.lastDataYear;
        year++
      )
        for (const variable of scenarioVariables)
          units.push({
            dataset: policy.dataset,
            datasetVersion: policy.datasetVersion,
            model,
            experiment: window.experiment,
            variable,
            year,
            tile,
          });
  return units;
}
type Row = {
  id: string;
  unit_key: string;
  raw: Buffer;
  raw_sha256: string;
  normalized_sha256: string;
  retrieved_at: Date;
};
// Hard upstream problems stop a tile; transient ones are retried by later
// slices until this many failures accumulate.
const FAILURE_LIMIT = 30;
export class ScenarioStore {
  constructor(
    private readonly pool: Pool,
    private readonly provider: ScenarioProvider = new NexGddpProvider(),
    private readonly allowSynthetic = false,
  ) {}
  private async presentKeys(keys: string[]) {
    const rows = await this.pool.query<{ unit_key: string }>(
      "SELECT unit_key FROM climate_scenario_units WHERE unit_key = ANY($1::text[])",
      [keys],
    );
    return new Set(rows.rows.map((r) => r.unit_key));
  }
  async tileStatus(tile: ScenarioTile, policy: FutureClimatePolicy) {
    const row = (
      await this.pool.query<{
        status: string;
        units_total: number;
        units_ready: number;
        error_code: string | null;
      }>(
        "SELECT status,units_total,units_ready,error_code FROM climate_scenario_tiles WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3",
        [tile.latitude, tile.longitude, policyKey(policy)],
      )
    ).rows[0];
    return row ?? null;
  }
  // Records a request for a tile. New tiles count against a rolling daily
  // limit so plans cannot turn into unbounded upstream work.
  async request(
    tile: ScenarioTile,
    policy: FutureClimatePolicy,
    perDay: number,
    administrator = false,
  ): Promise<"requested" | "existing" | "limited"> {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('climate_scenario_tiles'))",
      );
      const key = policyKey(policy);
      const existing = await client.query(
        "SELECT status FROM climate_scenario_tiles WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3",
        [tile.latitude, tile.longitude, key],
      );
      if (existing.rowCount) {
        if (administrator && existing.rows[0].status === "failed")
          await client.query(
            "UPDATE climate_scenario_tiles SET status='requested',failures=0,error_code=null,updated_at=clock_timestamp() WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3",
            [tile.latitude, tile.longitude, key],
          );
        return "existing";
      }
      if (!administrator) {
        const recent = await client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM climate_scenario_tiles WHERE requested_at>clock_timestamp()-interval '1 day'",
        );
        if (recent.rows[0]!.n >= perDay) return "limited";
      }
      await client.query(
        "INSERT INTO climate_scenario_tiles(tile_latitude,tile_longitude,policy_key,units_total) VALUES($1,$2,$3,$4)",
        [tile.latitude, tile.longitude, key, tileUnits(policy, tile).length],
      );
      return "requested";
    });
  }
  async stale(policy: FutureClimatePolicy) {
    const rows = await this.pool.query<{
      tile_latitude: number;
      tile_longitude: number;
    }>(
      "SELECT tile_latitude,tile_longitude FROM climate_scenario_tiles WHERE policy_key=$1 AND status IN ('requested','preparing') AND updated_at<clock_timestamp()-interval '15 minutes' ORDER BY updated_at LIMIT 20",
      [policyKey(policy)],
    );
    return rows.rows.map((r) => ({
      latitude: r.tile_latitude,
      longitude: r.tile_longitude,
    }));
  }
  // Fetches missing units until the deadline. Returns the units still missing.
  async prepare(
    tile: ScenarioTile,
    policy: FutureClimatePolicy,
    options: { concurrency: number; deadlineMs: number; signal: AbortSignal },
  ) {
    const key = policyKey(policy);
    const where = [tile.latitude, tile.longitude, key];
    const state = await this.pool.query<{ status: string }>(
      "UPDATE climate_scenario_tiles SET status='preparing',updated_at=clock_timestamp() WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3 AND status IN ('requested','preparing') RETURNING status",
      where,
    );
    if (!state.rowCount) return { remaining: 0, status: "skipped" as const };
    const units = tileUnits(policy, tile);
    const present = await this.presentKeys(units.map(unitKey));
    const queue = units.filter((u) => !present.has(unitKey(u)));
    const deadline = AbortSignal.any([
      options.signal,
      AbortSignal.timeout(options.deadlineMs),
    ]);
    let hard: ScenarioError | null = null;
    // A slice stops after a few failures; a later slice retries after a delay.
    let sliceFailures = 0;
    const work = async () => {
      while (queue.length && !deadline.aborted && !hard && sliceFailures < 5) {
        const identity = queue.shift()!;
        try {
          await this.fetchUnit(identity, deadline);
        } catch (error) {
          if (deadline.aborted) {
            queue.unshift(identity);
            return;
          }
          const failure =
            error instanceof ScenarioError
              ? error
              : new ScenarioError("SCENARIO_STORAGE_UNAVAILABLE");
          if (failure.code === "SCENARIO_UPSTREAM_INVALID") hard = failure;
          sliceFailures++;
          await this.pool.query(
            "UPDATE climate_scenario_tiles SET failures=failures+1,updated_at=clock_timestamp() WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3",
            where,
          );
          queue.push(identity);
        }
      }
    };
    await Promise.all(
      Array.from({ length: options.concurrency }, () => work()),
    );
    const ready = (await this.presentKeys(units.map(unitKey))).size;
    const failures = (
      await this.pool.query<{ failures: number }>(
        "SELECT failures FROM climate_scenario_tiles WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3",
        where,
      )
    ).rows[0]!.failures;
    const failed: ScenarioError | null =
      hard ??
      (failures >= FAILURE_LIMIT
        ? new ScenarioError("SCENARIO_UPSTREAM_UNAVAILABLE")
        : null);
    const status =
      ready === units.length ? "ready" : failed ? "failed" : "preparing";
    await this.pool.query(
      `UPDATE climate_scenario_tiles SET status=$4,units_ready=$5,error_code=$6,completed_at=CASE WHEN $4='ready' THEN clock_timestamp() ELSE NULL END,updated_at=clock_timestamp()
      WHERE tile_latitude=$1 AND tile_longitude=$2 AND policy_key=$3`,
      [...where, status, ready, status === "failed" ? failed!.code : null],
    );
    return { remaining: units.length - ready, status };
  }
  async fetchUnit(identity: ScenarioUnitIdentity, signal: AbortSignal) {
    const fetched = await this.provider.fetch(identity, signal);
    // Normalize again at the persistence boundary.
    const { unit } = normalizeScenario(
      fetched.raw,
      identity,
      fetched.retrievedAt,
      this.allowSynthetic,
    );
    await this.pool.query(
      `INSERT INTO climate_scenario_units(id,unit_key,model,experiment,variable,year,tile_latitude,tile_longitude,raw,raw_sha256,normalized_sha256,retrieved_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(unit_key) DO NOTHING`,
      [
        randomUUID(),
        unitKey(identity),
        identity.model.id,
        identity.experiment,
        identity.variable,
        identity.year,
        identity.tile.latitude,
        identity.tile.longitude,
        Buffer.from(fetched.raw),
        unit.provenance.rawSha256,
        sha256(stableJson(unit)),
        fetched.retrievedAt,
      ],
    );
  }
  // The field cell's series for every needed unit, re-verified from the raw
  // bytes, or null when any unit is not stored yet.
  async series(needs: {
    cell: { latitude: number; longitude: number };
    units: ScenarioUnitIdentity[];
  }): Promise<ScenarioSeries[] | null> {
    const keys = needs.units.map(unitKey);
    const rows = (
      await this.pool.query<Row>(
        "SELECT id,unit_key,raw,raw_sha256,normalized_sha256,retrieved_at FROM climate_scenario_units WHERE unit_key = ANY($1::text[])",
        [keys],
      )
    ).rows;
    if (rows.length !== new Set(keys).size) return null;
    const byKey = new Map(rows.map((r) => [r.unit_key, r]));
    return needs.units.map((identity) => {
      const row = byKey.get(unitKey(identity))!;
      let checked;
      try {
        checked = normalizeScenario(
          new Uint8Array(row.raw),
          identity,
          row.retrieved_at.toISOString(),
          this.allowSynthetic,
        );
      } catch {
        throw new ScenarioError("SCENARIO_STORAGE_UNAVAILABLE");
      }
      const { unit, synthetic } = checked;
      if (
        sha256(row.raw) !== row.raw_sha256 ||
        sha256(stableJson(unit)) !== row.normalized_sha256
      )
        throw new ScenarioError("SCENARIO_STORAGE_UNAVAILABLE");
      const at = unit.cells.findIndex(
        (c) =>
          c.latitude === needs.cell.latitude &&
          c.longitude === needs.cell.longitude,
      );
      if (at < 0) throw new ScenarioError("SCENARIO_STORAGE_UNAVAILABLE");
      return {
        unitId: row.id,
        normalizedSha256: row.normalized_sha256,
        synthetic,
        model: identity.model,
        experiment: identity.experiment,
        variable: identity.variable,
        year: identity.year,
        cell: needs.cell,
        values: unit.values[at]!,
      };
    });
  }
}
