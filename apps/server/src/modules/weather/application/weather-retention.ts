import type { Pool } from "pg";
import { withTransaction } from "../../../infrastructure/database/transaction.js";
// Snapshots contain the requested coordinates. Expired cache rows and
// snapshots that no plan references are deleted in small batches. Margins
// protect anything a running job could still pin: cache rows survive one day
// past expiry, and an unreferenced snapshot must be at least one day old.
export async function pruneWeatherEvidence(pool: Pool) {
  return withTransaction(pool, async (client) => {
    await client.query("SET LOCAL rotavise.weather_retention = 'on'");
    const cache = await client.query(
      `DELETE FROM weather_cache WHERE request_key IN (
        SELECT request_key FROM weather_cache
        WHERE (lease_until IS NULL OR lease_until<=clock_timestamp())
        AND (expires_at IS NULL OR expires_at<=clock_timestamp()-interval '1 day')
        ORDER BY expires_at NULLS FIRST LIMIT 100 FOR UPDATE SKIP LOCKED)`,
    );
    const snapshots = await client.query(
      `DELETE FROM weather_snapshots WHERE id IN (
        SELECT s.id FROM weather_snapshots s
        WHERE s.created_at<=clock_timestamp()-interval '1 day'
        AND NOT EXISTS(SELECT 1 FROM weather_cache c WHERE c.snapshot_id=s.id)
        AND NOT EXISTS(SELECT 1 FROM planning_weather p WHERE p.snapshot_id=s.id)
        ORDER BY s.created_at LIMIT 100 FOR UPDATE OF s SKIP LOCKED)`,
    );
    return { cache: cache.rowCount ?? 0, snapshots: snapshots.rowCount ?? 0 };
  });
}
