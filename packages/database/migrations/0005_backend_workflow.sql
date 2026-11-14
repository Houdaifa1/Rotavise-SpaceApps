CREATE TABLE "plan_claims" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"guest_owner_id" uuid NOT NULL,
	"original_key" text NOT NULL,
	"account_owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_guest_key" UNIQUE("guest_owner_id","original_key")
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_mail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ciphertext" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_id" uuid,
	"completed_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "auth_mail_kind" CHECK ("auth_mail"."kind" in ('verify','recover','delete')),
	CONSTRAINT "auth_mail_state" CHECK ("auth_mail"."status" in ('queued','running','sent','failed')),
	CONSTRAINT "auth_mail_attempts" CHECK ("auth_mail"."attempts" between 0 and 5),
	CONSTRAINT "auth_mail_size" CHECK ("auth_mail"."ciphertext" is null or octet_length("auth_mail"."ciphertext") <= 16384),
	CONSTRAINT "auth_mail_content" CHECK (("auth_mail"."status" in ('queued','running')) = ("auth_mail"."ciphertext" is not null)),
	CONSTRAINT "auth_mail_lease" CHECK (("auth_mail"."status"='running') = ("auth_mail"."lease_id" is not null and "auth_mail"."lease_until" is not null))
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_crop_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"entry" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_history_version" CHECK ("field_crop_history"."version">0),
	CONSTRAINT "field_history_entry" CHECK (coalesce("field_crop_history"."entry"->>'schema_version'='1' AND octet_length("field_crop_history"."entry"::text)<=2048,false))
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_version" CHECK ("fields"."version">0),
	CONSTRAINT "field_profile" CHECK (coalesce("fields"."profile"->>'schema_version'='1' AND octet_length("fields"."profile"::text)<=16384,false))
);
--> statement-breakpoint
CREATE TABLE "planning_runs" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"versions" jsonb NOT NULL,
	"versions_hash" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'awaiting_processing' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"result" jsonb,
	"result_hash" text,
	"error_code" text,
	CONSTRAINT "planning_versions" CHECK (coalesce("planning_runs"."versions"->>'workflowVersion'='planning-workflow-1' AND octet_length("planning_runs"."versions"::text)<=2097152 AND "planning_runs"."versions_hash" ~ '^[a-f0-9]{64}$',false)),
	CONSTRAINT "planning_attempts" CHECK ("planning_runs"."attempts" between 0 and 3),
	CONSTRAINT "planning_states" CHECK (("planning_runs"."status"='queued' AND "planning_runs"."stage"='awaiting_processing') OR ("planning_runs"."status"='running' AND "planning_runs"."stage" in ('verifying_evidence','generating_sequences','retrieving_weather','calculating')) OR ("planning_runs"."status"='completed' AND "planning_runs"."stage"='complete') OR ("planning_runs"."status"='failed' AND "planning_runs"."stage"='failed')),
	CONSTRAINT "planning_lease" CHECK (("planning_runs"."status"='running') = ("planning_runs"."lease_id" is not null AND "planning_runs"."lease_until" is not null)),
	CONSTRAINT "planning_terminal" CHECK (("planning_runs"."status" in ('completed','failed')) = ("planning_runs"."completed_at" is not null)),
	CONSTRAINT "planning_result" CHECK (coalesce(("planning_runs"."status"='completed' AND "planning_runs"."result" is not null AND "planning_runs"."result_hash" ~ '^[a-f0-9]{64}$' AND "planning_runs"."result"->>'kind'='planning_assessment' AND octet_length("planning_runs"."result"::text)<=8388608) OR ("planning_runs"."status"<>'completed' AND "planning_runs"."result" is null AND "planning_runs"."result_hash" is null),false)),
	CONSTRAINT "planning_error" CHECK (coalesce(("planning_runs"."status"='failed' AND "planning_runs"."error_code" in ('STORED_REQUEST_INVALID','CATALOG_EVIDENCE_INVALID','WEATHER_UNAVAILABLE','PLANNING_LIMIT_EXCEEDED','RETRIES_EXHAUSTED','QUEUE_TERMINAL_WITHOUT_RESULT','WORKFLOW_VERSION_UNSUPPORTED','CALCULATION_FAILED')) OR ("planning_runs"."status"<>'failed' AND "planning_runs"."error_code" is null),false))
);
--> statement-breakpoint
CREATE TABLE "planning_weather" (
	"request_id" uuid NOT NULL,
	"request_key" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_weather_request_id_request_key_pk" PRIMARY KEY("request_id","request_key"),
	CONSTRAINT "planning_weather_key" CHECK ("planning_weather"."request_key" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "plan_owners" DROP CONSTRAINT "plan_owner_hash";--> statement-breakpoint
ALTER TABLE "plan_owners" DROP CONSTRAINT "plan_owner_expiry";--> statement-breakpoint
ALTER TABLE "plan_requests" DROP CONSTRAINT "plan_expiry";--> statement-breakpoint
ALTER TABLE "plan_owners" ALTER COLUMN "token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_owners" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_owners" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD COLUMN "retention" text DEFAULT 'guest' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_claims" ADD CONSTRAINT "plan_claims_request_id_plan_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."plan_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_claims" ADD CONSTRAINT "plan_claims_account_owner_id_plan_owners_id_fk" FOREIGN KEY ("account_owner_id") REFERENCES "public"."plan_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mail" ADD CONSTRAINT "auth_mail_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_crop_history" ADD CONSTRAINT "field_crop_history_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_request_id_plan_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."plan_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_weather" ADD CONSTRAINT "planning_weather_request_id_planning_runs_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."planning_runs"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_weather" ADD CONSTRAINT "planning_weather_snapshot_id_weather_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."weather_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_mail_work_idx" ON "auth_mail" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "auth_mail_user_idx" ON "auth_mail" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "auth_verification_expiry_idx" ON "auth_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "field_history_idx" ON "field_crop_history" USING btree ("field_id","id");--> statement-breakpoint
CREATE INDEX "field_owner_idx" ON "fields" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "planning_pending_idx" ON "planning_runs" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "plan_owners" ADD CONSTRAINT "plan_owners_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_owners" ADD CONSTRAINT "plan_owners_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "plan_owners" ADD CONSTRAINT "plan_owner_hash" CHECK ("plan_owners"."token_hash" is null OR "plan_owners"."token_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "plan_owners" ADD CONSTRAINT "plan_owner_expiry" CHECK (("plan_owners"."user_id" IS NOT NULL AND "plan_owners"."token_hash" IS NULL AND "plan_owners"."expires_at" IS NULL) OR ("plan_owners"."user_id" IS NULL AND "plan_owners"."token_hash" IS NOT NULL AND "plan_owners"."expires_at" IS NOT NULL AND "plan_owners"."expires_at" > "plan_owners"."created_at" AND "plan_owners"."expires_at" <= "plan_owners"."created_at" + interval '7 days'));--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_expiry" CHECK ("plan_requests"."expires_at" > "plan_requests"."created_at" AND (("plan_requests"."retention"='guest' AND "plan_requests"."expires_at" <= "plan_requests"."created_at" + interval '1 day') OR ("plan_requests"."retention"='account' AND "plan_requests"."expires_at" <= "plan_requests"."created_at" + interval '365 days')));
--> statement-breakpoint
-- Only a recorded atomic guest claim may transfer ownership/retention. All
-- accepted input, evidence, queue identity and terminal state stay immutable.
CREATE OR REPLACE FUNCTION protect_plan_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.input,NEW.input_hash,NEW.evidence,NEW.catalog_snapshot_id,NEW.queue_job_id,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.input,OLD.input_hash,OLD.evidence,OLD.catalog_snapshot_id,OLD.queue_job_id,OLD.created_at) THEN
    RAISE EXCEPTION 'PLAN_ACCEPTED_CONTENT_IMMUTABLE';
  END IF;
  IF ROW(NEW.owner_id,NEW.idempotency_key,NEW.expires_at,NEW.retention)
    IS DISTINCT FROM ROW(OLD.owner_id,OLD.idempotency_key,OLD.expires_at,OLD.retention) AND NOT (
      OLD.retention='guest' AND NEW.retention='account' AND NEW.idempotency_key='claimed-'||OLD.id::text
      AND NEW.expires_at=OLD.created_at+interval '365 days'
      AND EXISTS(SELECT 1 FROM plan_claims c JOIN plan_owners o ON o.id=c.account_owner_id
        WHERE c.request_id=OLD.id AND c.guest_owner_id=OLD.owner_id AND c.original_key=OLD.idempotency_key
        AND c.account_owner_id=NEW.owner_id AND o.user_id IS NOT NULL)
    ) THEN RAISE EXCEPTION 'PLAN_ACCEPTED_CONTENT_IMMUTABLE'; END IF;
  IF NEW.attempts<OLD.attempts OR (OLD.status IN ('completed','failed') AND
    ROW(NEW.status,NEW.attempts,NEW.completed_at,NEW.error_code) IS DISTINCT FROM ROW(OLD.status,OLD.attempts,OLD.completed_at,OLD.error_code)) THEN
    RAISE EXCEPTION 'PLAN_TERMINAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION check_plan_retention_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM plan_owners o WHERE o.id=NEW.owner_id AND ((o.user_id IS NULL AND NEW.retention='guest') OR (o.user_id IS NOT NULL AND NEW.retention='account'))) THEN
    RAISE EXCEPTION 'PLAN_OWNER_RETENTION_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plan_retention_owner BEFORE INSERT OR UPDATE ON plan_requests FOR EACH ROW EXECUTE FUNCTION check_plan_retention_owner();
--> statement-breakpoint
CREATE FUNCTION protect_planning_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.request_id,NEW.versions,NEW.versions_hash,NEW.created_at) IS DISTINCT FROM ROW(OLD.request_id,OLD.versions,OLD.versions_hash,OLD.created_at) THEN
    RAISE EXCEPTION 'PLANNING_VERSIONS_IMMUTABLE';
  END IF;
  IF NEW.attempts<OLD.attempts OR (OLD.status IN ('completed','failed') AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'PLANNING_TERMINAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER planning_run_immutable BEFORE UPDATE ON planning_runs FOR EACH ROW EXECUTE FUNCTION protect_planning_run();
--> statement-breakpoint
CREATE FUNCTION protect_planning_weather() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PLANNING_WEATHER_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER planning_weather_immutable BEFORE UPDATE ON planning_weather FOR EACH ROW EXECUTE FUNCTION protect_planning_weather();
