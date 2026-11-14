CREATE TABLE "soil_estimates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cell_key" text NOT NULL,
	"layers" jsonb NOT NULL,
	"normalized_sha256" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "soil_estimates_cell_key_unique" UNIQUE("cell_key"),
	CONSTRAINT "soil_estimate_hash" CHECK ("soil_estimates"."normalized_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
-- Stored soil evidence is written once and never changed.
CREATE OR REPLACE FUNCTION reject_soil_estimate_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SOIL_ESTIMATE_IMMUTABLE';
END;
$$;--> statement-breakpoint
CREATE TRIGGER soil_estimate_immutable BEFORE UPDATE OR DELETE ON "soil_estimates" FOR EACH ROW EXECUTE FUNCTION reject_soil_estimate_mutation();
