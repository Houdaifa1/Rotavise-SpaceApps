CREATE TABLE "field_observation_files" (
	"observation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"raw" "bytea" NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_observation_files_observation_id_name_pk" PRIMARY KEY("observation_id","name"),
	CONSTRAINT "field_observation_file" CHECK ("field_observation_files"."sha256" ~ '^[a-f0-9]{64}$' AND octet_length("field_observation_files"."raw") between 1 and 20971520 AND "field_observation_files"."name" ~ '^[A-Za-z0-9._-]{1,200}$')
);
--> statement-breakpoint
CREATE TABLE "field_observations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"field_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"request" jsonb NOT NULL,
	"remote_task_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"result_hash" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "field_observation_state" CHECK ("field_observations"."kind" in ('hls','smap','gpm') AND "field_observations"."status" in ('queued','submitted','completed','failed') AND "field_observations"."attempts" between 0 and 10 AND octet_length("field_observations"."request"::text)<=16384 AND ("field_observations"."status" in ('completed','failed')) = ("field_observations"."completed_at" is not null) AND ("field_observations"."status"='failed') = ("field_observations"."error_code" is not null) AND ("field_observations"."status"='completed') = ("field_observations"."result" is not null AND "field_observations"."result_hash" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "field_observation_result_limit" CHECK ("field_observations"."result" is null OR octet_length("field_observations"."result"::text)<=2097152)
);
--> statement-breakpoint
ALTER TABLE "field_observation_files" ADD CONSTRAINT "field_observation_files_observation_id_field_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."field_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_observations" ADD CONSTRAINT "field_observations_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_observation_field_idx" ON "field_observations" USING btree ("field_id","created_at");--> statement-breakpoint
CREATE INDEX "field_observation_pending_idx" ON "field_observations" USING btree ("status","updated_at");--> statement-breakpoint
-- Raw provider files are evidence: written once, deleted only with their
-- observation (and so with the field).
CREATE OR REPLACE FUNCTION protect_field_observation_files() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'FIELD_OBSERVATION_FILES_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER field_observation_files_immutable BEFORE UPDATE ON "field_observation_files" FOR EACH ROW EXECUTE FUNCTION protect_field_observation_files();
