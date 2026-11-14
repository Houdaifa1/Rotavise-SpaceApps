import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { PlanError } from "../../modules/plans/application/plan-policy.js";
export async function quota(
  pool: Pool,
  subject: string,
  limit: number,
  seconds: number,
) {
  const key = createHash("sha256")
    .update("rotavise-quota-v1:" + subject)
    .digest("hex");
  const q = await pool.query(
    `INSERT INTO plan_quotas(key_hash,window_start,count,expires_at)
    VALUES($1,to_timestamp(floor(extract(epoch from clock_timestamp())/$3)*$3),1,clock_timestamp()+$3*interval '1 second')
    ON CONFLICT(key_hash) DO UPDATE SET
      count=CASE WHEN plan_quotas.window_start < excluded.window_start THEN 1 ELSE plan_quotas.count+1 END,
      window_start=greatest(plan_quotas.window_start,excluded.window_start),expires_at=greatest(plan_quotas.expires_at,excluded.expires_at)
    WHERE plan_quotas.window_start < excluded.window_start OR plan_quotas.count < $2 RETURNING count`,
    [key, limit, seconds],
  );
  if (!q.rowCount) throw new PlanError("RATE_LIMITED", seconds);
}
