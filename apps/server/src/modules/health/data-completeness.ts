import type { Pool } from "pg";
import { dataExpectations as expected } from "./data-expectations.js";
import {
  verifiedCatalog,
  type CatalogHead,
} from "../catalog/application/catalog-store.js";
import type { DataCompleteness } from "@rotavise/contracts";

type Check = DataCompleteness["datasets"][number];
export class DataCompletenessService {
  private cached?: { until: number; result: DataCompleteness };
  private pending: Promise<DataCompleteness> | undefined;
  constructor(private readonly pool: Pool) {}
  async check(fresh = false): Promise<DataCompleteness> {
    if (!fresh && this.cached && this.cached.until > Date.now())
      return this.cached.result;
    if (this.pending) return this.pending;
    this.pending = this.inspect().catch(() => ({
      ok: false,
      checkedAt: new Date().toISOString(),
      incomplete: ["database"],
      datasets: [
        {
          dataset: "database",
          ok: false,
          detail: "Database completeness could not be verified",
        },
      ],
    }));
    try {
      const result = await this.pending;
      this.cached = { until: Date.now() + 60000, result };
      return result;
    } finally {
      this.pending = undefined;
    }
  }
  private async inspect(): Promise<DataCompleteness> {
    const client = await this.pool.connect();
    const checks: Check[] = [];
    const add = (dataset: string, gaps: string[], success: string) =>
      checks.push({
        dataset,
        ok: gaps.length === 0,
        detail: gaps.length
          ? `${gaps.length} gaps: ${gaps.slice(0, 8).join("; ")}`
          : success,
      });
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      // Large shared reference scans are bounded independently of API reads.
      await client.query("SET LOCAL statement_timeout='30s'");
      const migrations = (
        await client.query<{ hash: string; created_at: string }>(
          "SELECT hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at",
        )
      ).rows;
      add(
        "migrations",
        expected.migrations
          .filter(
            (m) =>
              !migrations.some(
                (r) => r.hash === m.sha256 && Number(r.created_at) === m.at,
              ),
          )
          .map((m) => String(m.at))
          .concat(
            migrations.length === expected.migrations.length
              ? []
              : ["migration count differs"],
          ),
        `${migrations.length} migration hashes match`,
      );
      const catalogs = (
        await client.query<CatalogHead & { crops: number }>(
          "SELECT id,catalog_key,version,schema_version,content_sha256,imported_at,xmin::text AS row_version,jsonb_array_length(body->'profiles') crops FROM catalog_versions",
        )
      ).rows;
      const invalidCatalogs: string[] = [];
      for (const row of catalogs) {
        try {
          await verifiedCatalog(client, row);
        } catch {
          invalidCatalogs.push(row.version);
        }
      }
      add(
        "catalogs",
        expected.catalogs
          .filter(
            (c) =>
              !catalogs.some(
                (r) =>
                  r.catalog_key === c.id &&
                  r.version === c.version &&
                  r.content_sha256 === c.sha256 &&
                  r.crops === c.crops,
              ),
          )
          .map<string>((c) => c.version)
          .concat(invalidCatalogs),
        `${expected.catalogs.length} releases, exact canonical checksums and crop counts`,
      );
      const triggers = (
        await client.query<{ name: string; table: string }>(
          "SELECT t.tgname name,c.relname AS table FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public'",
        )
      ).rows;
      add(
        "triggers",
        expected.triggers
          .filter(
            (t) =>
              !triggers.some((r) => r.name === t.name && r.table === t.table),
          )
          .map((t) => t.name),
        `${expected.triggers.length} enabled protection triggers`,
      );
      const indexes = (
        await client.query<{
          name: string;
          table: string;
          method: string;
          columns: string[];
        }>(
          "SELECT c.relname name,t.relname AS table,a.amname method, ARRAY(SELECT pg_get_indexdef(i.indexrelid,k,true) FROM generate_series(1,i.indnkeyatts) k ORDER BY k) columns FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid JOIN pg_am a ON a.oid=c.relam JOIN pg_namespace n ON n.oid=c.relnamespace WHERE i.indisvalid AND i.indisready AND n.nspname='public'",
        )
      ).rows;
      add(
        "indexes",
        expected.indexes
          .filter(
            (n) =>
              !indexes.some(
                (r) =>
                  r.name === n.name &&
                  r.table === n.table &&
                  r.method === n.method &&
                  JSON.stringify(r.columns) === JSON.stringify(n.columns),
              ),
          )
          .map((n) => n.name),
        `${expected.indexes.length} required indexes valid and ready`,
      );
      const constraints = (
        await client.query<{ name: string; table: string }>(
          "SELECT c.conname name,t.relname AS table FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.convalidated AND n.nspname='public'",
        )
      ).rows;
      add(
        "constraints",
        expected.constraints
          .filter(
            (c) =>
              !constraints.some(
                (r) => r.name === c.name && r.table === c.table,
              ),
          )
          .map((c) => c.name),
        `${expected.constraints.length} required constraints validated`,
      );
      const autovacuumEnabled = (
        await client.query<{ enabled: boolean }>(
          "SELECT current_setting('autovacuum')='on' enabled",
        )
      ).rows[0]!.enabled;
      const settings = (
        await client.query<{ name: string; options: string[] | null }>(
          "SELECT relname name,reloptions options FROM pg_class WHERE relname=ANY($1::text[])",
          [
            [
              "climate_scenario_units",
              "regional_water_storage",
              "regional_gedi_biomass",
              "plan_requests",
            ],
          ],
        )
      ).rows;
      add(
        "autovacuum",
        settings
          .filter(
            (s) =>
              !s.options?.includes("autovacuum_analyze_scale_factor=0.02") ||
              s.options.includes("autovacuum_enabled=false"),
          )
          .map((s) => s.name)
          .concat(settings.length === 4 ? [] : ["missing reference table"])
          .concat(
            autovacuumEnabled ? [] : ["PostgreSQL autovacuum is disabled"],
          ),
        "Reference/plan analyze scale 0.02; automatic vacuum enabled",
      );
      const states = (
        await client.query<{
          tile_latitude: number;
          tile_longitude: number;
          policy_key: string;
          status: string;
          units_total: number;
          units_ready: number;
        }>(
          "SELECT tile_latitude,tile_longitude,policy_key,status,units_total,units_ready FROM climate_scenario_tiles",
        )
      ).rows;
      for (const [i, policy] of expected.policies.entries())
        add(
          i === 0 ? "climateMidCentury" : "climateNearTerm",
          expected.tiles
            .filter(
              ([lat, lon]) =>
                !states.some(
                  (r) =>
                    r.tile_latitude === lat &&
                    r.tile_longitude === lon &&
                    r.policy_key === policy.key &&
                    r.status === "ready" &&
                    r.units_ready === policy.units &&
                    r.units_total === policy.units,
                ),
            )
            .map((t) => t.join(",")),
          `89/89 positions ready, ${policy.units} units per position`,
        );
      const units = (
        await client.query<{
          lat: number;
          lon: number;
          experiment: string;
          year: number;
          n: number;
          identities: number;
          valid: boolean;
        }>(
          `SELECT tile_latitude lat,tile_longitude lon,experiment,year,count(*)::int n,
        count(DISTINCT (model,variable))::int identities,
        bool_and(model=ANY($1::text[]) AND variable=ANY($2::text[])) valid
        FROM climate_scenario_units GROUP BY 1,2,3,4`,
          [[...expected.models], [...expected.variables]],
        )
      ).rows;
      const byUnit = new Map(
        units.map((r) => [`${r.lat},${r.lon},${r.experiment},${r.year}`, r]),
      );
      const gaps: string[] = [];
      for (const [lat, lon] of expected.tiles)
        for (const [experiment, first, last] of [
          ["historical", 1985, 2009],
          ["ssp245", 2026, 2065],
          ["ssp585", 2026, 2065],
        ] as const)
          for (let year = first; year <= last; year++) {
            const key = `${lat},${lon},${experiment},${year}`,
              row = byUnit.get(key);
            if (!row || row.n !== 20 || row.identities !== 20 || !row.valid)
              gaps.push(key);
          }
      add(
        "climateUnits",
        gaps,
        "186,900 units: 20 model/variable identities per experiment/year/position; near-term 600 per position",
      );
      for (const kind of ["grace", "gedi"] as const) {
        const grace = kind === "grace",
          scale = grace ? 100 : 1000,
          lat = grace ? "latitude_e2" : "latitude_e3",
          lon = grace ? "longitude_e2" : "longitude_e3",
          table = grace ? "regional_water_storage" : "regional_gedi_biomass";
        const expression = grace
          ? `${lat}::text||'|'||${lon}::text||'|'||month||'|'||lwe_cm::text||E'\\n'`
          : `${lat}::text||'|'||${lon}::text||'|'||agbd_mg_ha::text||'|'||coalesce(se_mg_ha::text,'null')||E'\\n'`;
        const referenceQuery = {
          text: `SELECT floor(${lat}::numeric/${scale})::int::text||','||floor(${lon}::numeric/${scale})::int::text tile,count(*)::int n,
          md5(string_agg(${expression},'' ORDER BY ${lat},${lon}${grace ? ",month" : ""})) md5
          FROM ${table} WHERE product=$1 AND source_sha256=$2 GROUP BY 1`,
          values: [expected[kind].product, expected[kind].sourceSha256],
          query_timeout: 35000,
        };
        const rows = (
          await client.query<{ tile: string; n: number; md5: string }>(
            referenceQuery,
          )
        ).rows;
        const byTile = new Map(rows.map((r) => [r.tile, r]));
        add(
          kind,
          expected[kind].groups
            .filter((g) => {
              const row = byTile.get(g.tile);
              return !row || row.n !== g.rows || row.md5 !== g.md5;
            })
            .map((g) => g.tile),
          `${rows.reduce((n, r) => n + r.n, 0)} raw-source-matched rows; complete valid-cell grid in 20–37 N, 18 W–0 E (source no-data remains unavailable)`,
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return {
      ok: checks.every((c) => c.ok),
      checkedAt: new Date().toISOString(),
      incomplete: checks.filter((c) => !c.ok).map((c) => c.dataset),
      datasets: checks,
    };
  }
}
