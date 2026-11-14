CREATE TABLE "plan_intake_results" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_intake_only" CHECK (coalesce("plan_intake_results"."result" = '{"kind":"request_intake","requestIntegrity":"verified","catalogIntegrity":"verified","planning":"not_implemented","recommendations":null,"weather":"not_requested"}'::jsonb,false))
);
--> statement-breakpoint
CREATE TABLE "plan_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "plan_owners_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "plan_owner_hash" CHECK ("plan_owners"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "plan_owner_expiry" CHECK ("plan_owners"."expires_at" > "plan_owners"."created_at" AND "plan_owners"."expires_at" <= "plan_owners"."created_at" + interval '7 days')
);
--> statement-breakpoint
CREATE TABLE "plan_quotas" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "plan_quota_hash" CHECK ("plan_quotas"."key_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "plan_quota_count" CHECK ("plan_quotas"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"input" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"catalog_snapshot_id" uuid NOT NULL,
	"queue_job_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "plan_requests_queue_job_id_unique" UNIQUE("queue_job_id"),
	CONSTRAINT "plan_owner_idempotency" UNIQUE("owner_id","idempotency_key"),
	CONSTRAINT "plan_key" CHECK ("plan_requests"."idempotency_key" ~ '^[A-Za-z0-9_-]{8,80}$'),
	CONSTRAINT "plan_hash" CHECK ("plan_requests"."input_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "plan_status" CHECK ("plan_requests"."status" in ('queued','running','completed','failed')),
	CONSTRAINT "plan_attempts" CHECK ("plan_requests"."attempts" >= 0),
	CONSTRAINT "plan_expiry" CHECK ("plan_requests"."expires_at" > "plan_requests"."created_at" AND "plan_requests"."expires_at" <= "plan_requests"."created_at" + interval '1 day'),
	CONSTRAINT "plan_input" CHECK (coalesce(jsonb_typeof("plan_requests"."input")='object' AND "plan_requests"."input"->>'schema_version'='1' AND octet_length("plan_requests"."input"::text) between 1 and 65536,false)),
	CONSTRAINT "plan_evidence" CHECK (coalesce(jsonb_typeof("plan_requests"."evidence")='object' AND "plan_requests"."evidence"->>'catalogSnapshotId'="plan_requests"."catalog_snapshot_id"::text AND "plan_requests"."evidence"->>'catalogSha256' ~ '^[a-f0-9]{64}$' AND "plan_requests"."evidence"->>'intakeVersion'='1' AND "plan_requests"."evidence"->>'policyVersion'='intake-policy-1' AND "plan_requests"."evidence"->'weatherSnapshotIds'='[]'::jsonb AND "plan_requests"."evidence"->'engineVersion'='null'::jsonb AND "plan_requests"."evidence"->'rankingVersion'='null'::jsonb,false)),
	CONSTRAINT "plan_terminal" CHECK (("plan_requests"."status" in ('completed','failed')) = ("plan_requests"."completed_at" is not null)),
	CONSTRAINT "plan_error" CHECK (coalesce(("plan_requests"."status"='failed' AND "plan_requests"."error_code" in ('RETRIES_EXHAUSTED','QUEUE_TERMINAL_WITHOUT_RESULT','STORED_REQUEST_INVALID','CATALOG_EVIDENCE_INVALID')) OR ("plan_requests"."status"<>'failed' AND "plan_requests"."error_code" is null),false))
);
--> statement-breakpoint
ALTER TABLE "plan_intake_results" ADD CONSTRAINT "plan_intake_results_request_id_plan_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."plan_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_owner_id_plan_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."plan_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_catalog_snapshot_id_catalog_versions_id_fk" FOREIGN KEY ("catalog_snapshot_id") REFERENCES "public"."catalog_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_owner_expiry_idx" ON "plan_owners" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "plan_quota_expiry_idx" ON "plan_quotas" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "plan_pending_idx" ON "plan_requests" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "plan_expiry_idx" ON "plan_requests" USING btree ("expires_at");
--> statement-breakpoint
-- Accepted farmer input and evidence cannot be rewritten by application updates.
CREATE FUNCTION protect_plan_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.owner_id,NEW.idempotency_key,NEW.input,NEW.input_hash,NEW.evidence,NEW.catalog_snapshot_id,NEW.queue_job_id,NEW.created_at,NEW.expires_at)
     IS DISTINCT FROM ROW(OLD.id,OLD.owner_id,OLD.idempotency_key,OLD.input,OLD.input_hash,OLD.evidence,OLD.catalog_snapshot_id,OLD.queue_job_id,OLD.created_at,OLD.expires_at) THEN
    RAISE EXCEPTION 'PLAN_ACCEPTED_CONTENT_IMMUTABLE';
  END IF;
  IF NEW.attempts < OLD.attempts OR (OLD.status IN ('completed','failed') AND
     ROW(NEW.status,NEW.attempts,NEW.completed_at,NEW.error_code) IS DISTINCT FROM ROW(OLD.status,OLD.attempts,OLD.completed_at,OLD.error_code)) THEN
    RAISE EXCEPTION 'PLAN_TERMINAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plan_request_immutable BEFORE UPDATE ON plan_requests FOR EACH ROW EXECUTE FUNCTION protect_plan_request();
--> statement-breakpoint
CREATE FUNCTION protect_plan_intake_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PLAN_RESULT_IMMUTABLE';
END $$;
--> statement-breakpoint
CREATE TRIGGER plan_result_immutable BEFORE UPDATE ON plan_intake_results FOR EACH ROW EXECUTE FUNCTION protect_plan_intake_result();
--> statement-breakpoint
-- Deferred checks allow result insertion and terminal status change in one
-- transaction, but never a committed completed row without its unique result.
CREATE FUNCTION check_plan_result_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; current_status text; has_result boolean;
BEGIN
  IF TG_TABLE_NAME = 'plan_requests' THEN
    IF TG_OP = 'DELETE' THEN target_id := OLD.id; ELSE target_id := NEW.id; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN target_id := OLD.request_id; ELSE target_id := NEW.request_id; END IF;
  END IF;
  SELECT status INTO current_status FROM plan_requests WHERE id=target_id;
  IF current_status IS NULL THEN RETURN NULL; END IF;
  SELECT EXISTS(SELECT 1 FROM plan_intake_results WHERE request_id=target_id) INTO has_result;
  IF (current_status='completed') IS DISTINCT FROM has_result THEN
    RAISE EXCEPTION 'PLAN_RESULT_STATE_MISMATCH';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER plan_state_result_consistent AFTER INSERT OR UPDATE OR DELETE ON plan_requests
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_plan_result_consistency();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER plan_result_state_consistent AFTER INSERT OR UPDATE OR DELETE ON plan_intake_results
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_plan_result_consistency();
