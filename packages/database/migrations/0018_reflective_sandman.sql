CREATE TABLE "rain_references" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cell_key" text NOT NULL,
	"raw" text NOT NULL,
	"normalized_sha256" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rain_references_cell_key_unique" UNIQUE("cell_key"),
	CONSTRAINT "rain_reference_hash" CHECK ("rain_references"."normalized_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TRIGGER rain_reference_immutable BEFORE UPDATE OR DELETE ON "rain_references" FOR EACH ROW EXECUTE FUNCTION reject_soil_estimate_mutation();
