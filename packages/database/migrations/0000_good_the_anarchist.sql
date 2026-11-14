CREATE TABLE "job_run_results" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_results_fixture" CHECK ("job_run_results"."result"->>'fixture' = 'infrastructure-only' AND "job_run_results"."result"->>'operation' = 'echo' AND jsonb_typeof("job_run_results"."result"->'message') = 'string')
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"input" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"queue_job_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_details" text,
	CONSTRAINT "job_runs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "job_runs_queue_job_id_unique" UNIQUE("queue_job_id"),
	CONSTRAINT "job_runs_status" CHECK ("job_runs"."status" in ('queued','running','completed','failed')),
	CONSTRAINT "job_runs_echo" CHECK ("job_runs"."operation" = 'echo'),
	CONSTRAINT "job_runs_hash" CHECK ("job_runs"."input_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "job_runs_key" CHECK ("job_runs"."idempotency_key" ~ '^[A-Za-z0-9_-]{8,80}$'),
	CONSTRAINT "job_runs_attempts" CHECK ("job_runs"."attempts" >= 0),
	CONSTRAINT "job_runs_input" CHECK (jsonb_typeof("job_runs"."input") = 'object' AND "job_runs"."input"->>'operation' = 'echo' AND jsonb_typeof("job_runs"."input"->'message') = 'string' AND length("job_runs"."input"->>'message') between 1 and 256),
	CONSTRAINT "job_runs_terminal" CHECK (("job_runs"."status" in ('completed','failed')) = ("job_runs"."completed_at" is not null)),
	CONSTRAINT "job_runs_error" CHECK (("job_runs"."status" = 'failed' AND "job_runs"."error_code" is not null AND "job_runs"."error_details" is not null) OR ("job_runs"."status" <> 'failed' AND "job_runs"."error_code" is null AND "job_runs"."error_details" is null))
);
--> statement-breakpoint
ALTER TABLE "job_run_results" ADD CONSTRAINT "job_run_results_run_id_job_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."job_runs"("id") ON DELETE no action ON UPDATE no action;