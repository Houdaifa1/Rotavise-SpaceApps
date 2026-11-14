import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  check,
} from "drizzle-orm/pg-core";
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid().primaryKey(),
    operation: text().notNull(),
    input: jsonb().notNull(),
    inputHash: text("input_hash").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    queueJobId: uuid("queue_job_id").notNull().unique(),
    status: text().notNull().default("queued"),
    attempts: integer().notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorDetails: text("error_details"),
  },
  (t) => [
    check(
      "job_runs_status",
      sql`${t.status} in ('queued','running','completed','failed')`,
    ),
    check("job_runs_echo", sql`${t.operation} = 'echo'`),
    check("job_runs_hash", sql`${t.inputHash} ~ '^[a-f0-9]{64}$'`),
    check("job_runs_key", sql`${t.idempotencyKey} ~ '^[A-Za-z0-9_-]{8,80}$'`),
    check("job_runs_attempts", sql`${t.attempts} >= 0`),
    check(
      "job_runs_input",
      sql`coalesce(jsonb_typeof(${t.input}) = 'object' AND ${t.input}->>'operation' = 'echo' AND jsonb_typeof(${t.input}->'message') = 'string' AND length(${t.input}->>'message') between 1 and 256 AND ${t.input} - 'operation' - 'message' = '{}'::jsonb, false)`,
    ),
    check(
      "job_runs_terminal",
      sql`(${t.status} in ('completed','failed')) = (${t.completedAt} is not null)`,
    ),
    check(
      "job_runs_error",
      sql`(${t.status} = 'failed' AND ${t.errorCode} is not null AND ${t.errorDetails} is not null) OR (${t.status} <> 'failed' AND ${t.errorCode} is null AND ${t.errorDetails} is null)`,
    ),
  ],
);

export const jobRunResults = pgTable(
  "job_run_results",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => jobRuns.id),
    result: jsonb().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "job_results_fixture",
      sql`coalesce(${t.result}->>'fixture' = 'infrastructure-only' AND ${t.result}->>'operation' = 'echo' AND jsonb_typeof(${t.result}->'message') = 'string' AND length(${t.result}->>'message') between 1 and 256 AND ${t.result} - 'fixture' - 'operation' - 'message' = '{}'::jsonb, false)`,
    ),
  ],
);
