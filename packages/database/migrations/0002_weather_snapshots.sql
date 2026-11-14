CREATE TABLE "weather_cache" (
	"request_key" text PRIMARY KEY NOT NULL,
	"snapshot_id" uuid,
	"expires_at" timestamp with time zone,
	"lease_owner" uuid,
	"lease_until" timestamp with time zone,
	CONSTRAINT "weather_cache_key" CHECK ("weather_cache"."request_key" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "weather_cache_snapshot_pair" CHECK (("weather_cache"."snapshot_id" is null) = ("weather_cache"."expires_at" is null)),
	CONSTRAINT "weather_cache_lease_pair" CHECK (("weather_cache"."lease_owner" is null) = ("weather_cache"."lease_until" is null))
);
--> statement-breakpoint
CREATE TABLE "weather_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_key" text NOT NULL,
	"raw" text NOT NULL,
	"raw_sha256" text NOT NULL,
	"normalized_sha256" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weather_snapshot_key_id" UNIQUE("request_key","id"),
	CONSTRAINT "weather_snapshot_hashes" CHECK ("weather_snapshots"."request_key" ~ '^[a-f0-9]{64}$' AND "weather_snapshots"."raw_sha256" ~ '^[a-f0-9]{64}$' AND "weather_snapshots"."normalized_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "weather_snapshot_raw_limit" CHECK (octet_length("weather_snapshots"."raw") between 1 and 1048576),
	CONSTRAINT "weather_snapshot_shape" CHECK (coalesce(jsonb_typeof("weather_snapshots"."snapshot") = 'object' AND "weather_snapshots"."snapshot"->>'schemaVersion' = '1' AND "weather_snapshots"."snapshot"->'provenance'->>'provider' = 'nasa-power' AND "weather_snapshots"."snapshot"->'provenance'->>'rawSha256' = "weather_snapshots"."raw_sha256", false))
);
--> statement-breakpoint
ALTER TABLE "weather_cache" ADD CONSTRAINT "weather_cache_snapshot_fk" FOREIGN KEY ("request_key","snapshot_id") REFERENCES "public"."weather_snapshots"("request_key","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Evidence is append-only. Retention/deletion requires a separately reviewed migration.
CREATE FUNCTION reject_weather_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'WEATHER_SNAPSHOT_IMMUTABLE';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER weather_snapshot_immutable BEFORE UPDATE OR DELETE ON weather_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_weather_snapshot_mutation();
