CREATE TABLE "climate_scenario_tiles" (
	"tile_latitude" integer NOT NULL,
	"tile_longitude" integer NOT NULL,
	"policy_key" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"units_total" integer NOT NULL,
	"units_ready" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "climate_scenario_tiles_tile_latitude_tile_longitude_policy_key_pk" PRIMARY KEY("tile_latitude","tile_longitude","policy_key"),
	CONSTRAINT "climate_scenario_tile_policy" CHECK ("climate_scenario_tiles"."policy_key" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "climate_scenario_tile_state" CHECK ("climate_scenario_tiles"."status" in ('requested','preparing','ready','failed') AND "climate_scenario_tiles"."units_ready" between 0 and "climate_scenario_tiles"."units_total" AND "climate_scenario_tiles"."units_total" between 1 and 20000 AND "climate_scenario_tiles"."failures" between 0 and 1000 AND ("climate_scenario_tiles"."status"='ready') = ("climate_scenario_tiles"."completed_at" is not null) AND ("climate_scenario_tiles"."status"='failed') = ("climate_scenario_tiles"."error_code" is not null))
);
--> statement-breakpoint
CREATE TABLE "climate_scenario_units" (
	"id" uuid PRIMARY KEY NOT NULL,
	"unit_key" text NOT NULL,
	"model" text NOT NULL,
	"experiment" text NOT NULL,
	"variable" text NOT NULL,
	"year" integer NOT NULL,
	"tile_latitude" integer NOT NULL,
	"tile_longitude" integer NOT NULL,
	"raw" "bytea" NOT NULL,
	"raw_sha256" text NOT NULL,
	"normalized_sha256" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "climate_scenario_units_unit_key_unique" UNIQUE("unit_key"),
	CONSTRAINT "climate_scenario_hashes" CHECK ("climate_scenario_units"."unit_key" ~ '^[a-f0-9]{64}$' AND "climate_scenario_units"."raw_sha256" ~ '^[a-f0-9]{64}$' AND "climate_scenario_units"."normalized_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "climate_scenario_identity" CHECK ("climate_scenario_units"."experiment" in ('historical','ssp245','ssp585') AND "climate_scenario_units"."variable" in ('tasmin','tasmax','tas') AND "climate_scenario_units"."year" between 1950 and 2100 AND "climate_scenario_units"."tile_latitude" between -60 and 89 AND "climate_scenario_units"."tile_longitude" between -180 and 179 AND "climate_scenario_units"."model" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
	CONSTRAINT "climate_scenario_raw_limit" CHECK (octet_length("climate_scenario_units"."raw") between 1 and 262144)
);
--> statement-breakpoint
CREATE TABLE "planning_scenario_units" (
	"request_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_scenario_units_request_id_unit_id_pk" PRIMARY KEY("request_id","unit_id")
);
--> statement-breakpoint
ALTER TABLE "planning_runs" DROP CONSTRAINT "planning_versions";--> statement-breakpoint
ALTER TABLE "planning_runs" DROP CONSTRAINT "planning_result";--> statement-breakpoint
ALTER TABLE "planning_scenario_units" ADD CONSTRAINT "planning_scenario_units_request_id_planning_runs_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."planning_runs"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_scenario_units" ADD CONSTRAINT "planning_scenario_units_unit_id_climate_scenario_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."climate_scenario_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "climate_scenario_tile_requested_idx" ON "climate_scenario_tiles" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "climate_scenario_tile_idx" ON "climate_scenario_units" USING btree ("tile_latitude","tile_longitude");--> statement-breakpoint
CREATE INDEX "planning_scenario_unit_idx" ON "planning_scenario_units" USING btree ("unit_id");--> statement-breakpoint
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_versions" CHECK (coalesce("planning_runs"."versions"->>'workflowVersion' in ('planning-workflow-1','planning-workflow-2','planning-workflow-3') AND octet_length("planning_runs"."versions"::text)<=2097152 AND "planning_runs"."versions_hash" ~ '^[a-f0-9]{64}$',false));--> statement-breakpoint
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_result" CHECK (coalesce(("planning_runs"."status"='completed' AND "planning_runs"."result" is not null AND "planning_runs"."result_hash" ~ '^[a-f0-9]{64}$' AND "planning_runs"."result"->>'kind'=(CASE "planning_runs"."versions"->>'workflowVersion' WHEN 'planning-workflow-1' THEN 'planning_assessment' ELSE 'rotation_assessment' END) AND octet_length("planning_runs"."result"::text)<=8388608) OR ("planning_runs"."status"<>'completed' AND "planning_runs"."result" is null AND "planning_runs"."result_hash" is null),false));--> statement-breakpoint
-- Scenario units are shared evidence for every plan in a tile; they are
-- written once and never changed or deleted.
CREATE OR REPLACE FUNCTION reject_climate_scenario_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CLIMATE_SCENARIO_IMMUTABLE';
END;
$$;--> statement-breakpoint
CREATE TRIGGER climate_scenario_units_immutable BEFORE UPDATE OR DELETE ON "climate_scenario_units" FOR EACH ROW EXECUTE FUNCTION reject_climate_scenario_mutation();--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_planning_scenario_units() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PLANNING_SCENARIO_UNITS_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER planning_scenario_units_immutable BEFORE UPDATE ON "planning_scenario_units" FOR EACH ROW EXECUTE FUNCTION protect_planning_scenario_units();
