import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { PgBoss, Db } from "pg-boss";
import {
  syntheticInputSchema,
  syntheticResultSchema,
  runSchema,
  type SyntheticInput,
} from "@rotavise/contracts";
import { QUEUE } from "../../../infrastructure/queue/pg-boss.js";

export class ConflictError extends Error {}
export function transactionAdapter(client: pg.PoolClient): Db {
  return { executeSql: (text, values) => client.query(text, values) };
}
export type Enqueue = (
  runId: string,
  queueJobId: string,
  db: Db,
) => Promise<string | null>;
export class Ledger {
  constructor(
    readonly pool: pg.Pool,
    readonly boss: PgBoss,
  ) {}
  async submit(key: string, raw: SyntheticInput, enqueue?: Enqueue) {
    const input = syntheticInputSchema.parse(raw);
    const hash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // ON CONFLICT waits for concurrent creators to commit, then reads their authoritative row.
      const id = randomUUID();
      const queueId = randomUUID();
      const inserted = await client.query(
        "INSERT INTO job_runs (id, operation, input, input_hash, idempotency_key, queue_job_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id",
        [id, input.operation, input, hash, key, queueId],
      );
      let runId: string = id;
      if (inserted.rowCount === 0) {
        const existing = await client.query<{ id: string; input_hash: string }>(
          "SELECT id,input_hash FROM job_runs WHERE idempotency_key=$1",
          [key],
        );
        const row = existing.rows[0];
        if (!row || row.input_hash !== hash)
          throw new ConflictError("IDEMPOTENCY_CONFLICT");
        runId = row.id;
      } else {
        const db = transactionAdapter(client);
        const jobId = await (enqueue
          ? enqueue(id, queueId, db)
          : this.boss.send(QUEUE, { runId: id }, { id: queueId, db }));
        if (jobId !== queueId) throw new Error("ENQUEUE_FAILED");
      }
      await client.query("COMMIT");
      return runId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async read(id: string) {
    const response = await this.pool.query(
      "SELECT r.*, s.result FROM job_runs r LEFT JOIN job_run_results s ON s.run_id=r.id WHERE r.id=$1",
      [id],
    );
    const r = response.rows[0];
    if (!r) return null;
    return runSchema.parse({
      id: r.id,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
      attempts: r.attempts,
      result: r.result ?? null,
      error: r.error_code
        ? { code: r.error_code, details: r.error_details }
        : null,
    });
  }
  async begin(id: string) {
    const result = await this.pool.query(
      "UPDATE job_runs SET status='running', attempts=attempts+1, started_at=coalesce(started_at,now()),updated_at=now() WHERE id=$1 AND status IN ('queued','running') RETURNING input,attempts",
      [id],
    );
    const row = result.rows[0];
    return row
      ? {
          input: syntheticInputSchema.parse(row.input),
          attempts: Number(row.attempts),
        }
      : null;
  }
  async complete(id: string, input: SyntheticInput) {
    const result = syntheticResultSchema.parse({
      fixture: "infrastructure-only",
      operation: "echo",
      message: input.message,
    });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{ status: string }>(
        "SELECT status FROM job_runs WHERE id=$1 FOR UPDATE",
        [id],
      );
      const status = locked.rows[0]?.status;
      if (status && status !== "completed" && status !== "failed") {
        await client.query(
          "INSERT INTO job_run_results (run_id,result) VALUES ($1,$2) ON CONFLICT (run_id) DO NOTHING",
          [id, result],
        );
        await client.query(
          "UPDATE job_runs SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1",
          [id],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async reconcile() {
    // Bounded batch. Oldest first so a sustained queue cannot starve recovery.
    const pending = await this.pool.query<{ id: string; queue_job_id: string }>(
      "SELECT id,queue_job_id FROM job_runs WHERE status IN ('queued','running') ORDER BY updated_at LIMIT 100",
    );
    for (const row of pending.rows) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM job_runs WHERE id=$1 FOR UPDATE", [
          row.id,
        ]);
        const [job] = await this.boss.findJobs(QUEUE, {
          id: row.queue_job_id,
          db: transactionAdapter(client),
        });
        if (!job || ["failed", "cancelled", "completed"].includes(job.state)) {
          await client.query(
            "UPDATE job_runs SET status='failed',error_code=$2,error_details='Infrastructure job did not complete successfully',completed_at=now(),updated_at=now() WHERE id=$1 AND status IN ('queued','running')",
            [
              row.id,
              job?.state === "failed"
                ? "RETRIES_EXHAUSTED"
                : "QUEUE_TERMINAL_WITHOUT_RESULT",
            ],
          );
        } else if (["created", "retry"].includes(job.state)) {
          await client.query(
            "UPDATE job_runs SET status='queued',updated_at=now() WHERE id=$1 AND status='running'",
            [row.id],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  }
  async ready() {
    await this.pool.query(
      "SELECT id, input_hash, queue_job_id, status FROM job_runs LIMIT 0",
    );
    await this.pool.query("SELECT run_id, result FROM job_run_results LIMIT 0");
    if (!(await this.boss.isInstalled()) || !(await this.boss.getQueue(QUEUE)))
      throw new Error("SCHEMA_UNAVAILABLE");
  }
}
