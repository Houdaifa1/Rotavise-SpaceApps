import { statfs } from "node:fs/promises";
import type { Pool } from "pg";
import { errorLog } from "../../common/logging/operations-log.js";

// Only aggregate state crosses the status boundary. Internal failure sampling
// deduplicates identities without emitting them. No payloads or field data.
const FAILURES = `
  SELECT 'queue' AS source, 'CALCULATION_FAILED' AS code, id::text AS identity FROM pgboss.job WHERE state='failed'
  UNION ALL SELECT 'intake',error_code,id::text FROM plan_requests WHERE status='failed'
  UNION ALL SELECT 'planning',error_code,request_id::text FROM planning_runs WHERE status='failed'
  UNION ALL SELECT 'observations',error_code,id::text FROM field_observations WHERE status='failed'
  UNION ALL SELECT 'extractions',error_code,id::text FROM field_extractions WHERE status='failed'
  UNION ALL SELECT 'mail',error_code,id::text FROM auth_mail WHERE status='failed'
  UNION ALL SELECT 'tiles',error_code,md5(tile_latitude::text || ':' || tile_longitude::text || ':' || policy_key || ':' || updated_at::text) FROM climate_scenario_tiles WHERE status='failed'
  UNION ALL SELECT 'development',error_code,id::text FROM job_runs WHERE status='failed'`;

export async function operationsStatus(pool: Pool, diskPath = process.cwd()) {
  const queue = await pool.query(`SELECT
    count(*) FILTER (WHERE state IN ('created','retry'))::int AS depth,
    count(*) FILTER (WHERE state='active')::int AS active,
    count(*) FILTER (WHERE state='failed')::int AS failed,
    coalesce(extract(epoch FROM now()-min(created_on) FILTER
      (WHERE state IN ('created','retry') AND start_after<=now())),0)::float8 AS "oldestWaitingSeconds"
    FROM pgboss.job`);
  const failed = await pool.query(
    `SELECT source,count(*)::int AS count FROM (${FAILURES}) f GROUP BY source ORDER BY source`,
  );
  const ingests = await pool.query(`
    SELECT 'nasa-power' AS provider,max(created_at) AS "lastSuccessAt" FROM weather_snapshots
    UNION ALL SELECT 'nex-gddp-cmip6',max(created_at) FROM climate_scenario_units
    UNION ALL SELECT 'soilgrids',max(retrieved_at) FROM soil_estimates
    UNION ALL SELECT 'hls',max(completed_at) FROM field_observations WHERE kind='hls' AND status='completed'
    UNION ALL SELECT 'smap',max(completed_at) FROM field_observations WHERE kind='smap' AND status='completed'
    UNION ALL SELECT 'gpm',max(completed_at) FROM field_observations WHERE kind='gpm' AND status='completed'
    UNION ALL SELECT 'terrain',max(completed_at) FROM field_extractions WHERE kind='terrain' AND status='completed'
    UNION ALL SELECT 'ecostress',max(completed_at) FROM field_extractions WHERE kind='ecostress' AND status='completed'
    UNION ALL SELECT 'modis',max(completed_at) FROM field_extractions WHERE kind='modis' AND status='completed'
    UNION ALL SELECT 'grace',max(imported_at) FROM regional_water_storage
    UNION ALL SELECT 'gedi',max(imported_at) FROM regional_gedi_biomass`);
  const tiles = await pool.query(`SELECT status,count(*)::int AS count,
    sum(units_ready)::float8 AS "unitsReady",sum(units_total)::float8 AS "unitsTotal",
    min(updated_at) AS "oldestUpdateAt" FROM climate_scenario_tiles GROUP BY status ORDER BY status`);
  const disk = await statfs(diskPath);
  return {
    checkedAt: new Date().toISOString(),
    queue: queue.rows[0],
    failedJobs: failed.rows,
    ingests: ingests.rows,
    climateTiles: tiles.rows,
    disk: {
      freeBytes: disk.bavail * disk.bsize,
      totalBytes: disk.blocks * disk.bsize,
    },
  };
}

// Include failures caught within stores and terminal queue/reconciliation
// failures. Keep only identities still retained in the DB; never log them.
export function failureReporter(pool: Pool) {
  let seen = new Set<string>();
  return async () => {
    const rows = await pool.query(
      `SELECT source,code,identity FROM (${FAILURES}) f`,
    );
    const next = new Set<string>();
    const counts = new Map<string, number>();
    for (const row of rows.rows) {
      const key = `${row.source}:${row.identity}:${row.code}`;
      next.add(key);
      if (!seen.has(key)) counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
    }
    for (const [code, count] of counts)
      errorLog(code, { event: "job_failure", count });
    seen = next;
  };
}
