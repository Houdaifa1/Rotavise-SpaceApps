import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { planRequests } from "./plan.schema.js";
import { weatherSnapshots } from "./weather.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true });
export const planningRuns = pgTable(
  "planning_runs",
  {
    requestId: uuid("request_id")
      .primaryKey()
      .references(() => planRequests.id, { onDelete: "cascade" }),
    versions: jsonb().notNull(),
    versionsHash: text("versions_hash").notNull(),
    status: text().notNull().default("queued"),
    stage: text().notNull().default("awaiting_processing"),
    attempts: integer().notNull().default(0),
    leaseId: uuid("lease_id"),
    leaseUntil: instant("lease_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    completedAt: instant("completed_at"),
    result: jsonb(),
    strategySummary: jsonb("strategy_summary").generatedAlwaysAs(
      sql`result -> 'strategies'`,
    ),
    resultHash: text("result_hash"),
    errorCode: text("error_code"),
  },
  (t) => [
    check(
      "planning_versions",
      sql`coalesce(${t.versions}->>'workflowVersion' in ('planning-workflow-1','planning-workflow-2','planning-workflow-3','planning-workflow-4','planning-workflow-5','planning-workflow-6') AND octet_length(${t.versions}::text)<=2097152 AND ${t.versionsHash} ~ '^[a-f0-9]{64}$',false)`,
    ),
    check("planning_attempts", sql`${t.attempts} between 0 and 3`),
    check(
      "planning_states",
      sql`(${t.status}='queued' AND ${t.stage}='awaiting_processing') OR (${t.status}='running' AND ${t.stage} in ('verifying_evidence','generating_sequences','retrieving_weather','calculating')) OR (${t.status}='completed' AND ${t.stage}='complete') OR (${t.status}='failed' AND ${t.stage}='failed')`,
    ),
    check(
      "planning_lease",
      sql`(${t.status}='running') = (${t.leaseId} is not null AND ${t.leaseUntil} is not null)`,
    ),
    check(
      "planning_terminal",
      sql`(${t.status} in ('completed','failed')) = (${t.completedAt} is not null)`,
    ),
    check(
      "planning_result",
      sql`coalesce((${t.status}='completed' AND ${t.result} is not null AND ${t.resultHash} ~ '^[a-f0-9]{64}$' AND ${t.result}->>'kind'=(CASE ${t.versions}->>'workflowVersion' WHEN 'planning-workflow-1' THEN 'planning_assessment' ELSE 'rotation_assessment' END) AND octet_length(${t.result}::text)<=8388608) OR (${t.status}<>'completed' AND ${t.result} is null AND ${t.resultHash} is null),false)`,
    ),
    check(
      "planning_error",
      sql`coalesce((${t.status}='failed' AND ${t.errorCode} in ('STORED_REQUEST_INVALID','CATALOG_EVIDENCE_INVALID','WEATHER_UNAVAILABLE','PLANNING_LIMIT_EXCEEDED','RETRIES_EXHAUSTED','QUEUE_TERMINAL_WITHOUT_RESULT','WORKFLOW_VERSION_UNSUPPORTED','CALCULATION_FAILED')) OR (${t.status}<>'failed' AND ${t.errorCode} is null),false)`,
    ),
    index("planning_pending_idx").on(t.status, t.updatedAt),
  ],
);
export const planningWeather = pgTable(
  "planning_weather",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => planningRuns.requestId, { onDelete: "cascade" }),
    requestKey: text("request_key").notNull(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => weatherSnapshots.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.requestId, t.requestKey] }),
    // Weather retention checks whether any plan still pins a snapshot.
    index("planning_weather_snapshot_idx").on(t.snapshotId),
    check("planning_weather_key", sql`${t.requestKey} ~ '^[a-f0-9]{64}$'`),
  ],
);
