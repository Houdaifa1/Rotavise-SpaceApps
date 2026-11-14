CREATE TABLE "regional_gedi_biomass" (
	"product" text NOT NULL,
	"latitude_e3" integer NOT NULL,
	"longitude_e3" integer NOT NULL,
	"agbd_mg_ha" numeric(9, 3) NOT NULL,
	"se_mg_ha" numeric(9, 3),
	"source_sha256" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_gedi_biomass_product_latitude_e3_longitude_e3_pk" PRIMARY KEY("product","latitude_e3","longitude_e3"),
	CONSTRAINT "regional_gedi_biomass_value" CHECK ("regional_gedi_biomass"."agbd_mg_ha" between 0 and 5000 AND ("regional_gedi_biomass"."se_mg_ha" is null OR "regional_gedi_biomass"."se_mg_ha" between 0 and 5000) AND "regional_gedi_biomass"."source_sha256" ~ '^[a-f0-9]{64}$' AND "regional_gedi_biomass"."latitude_e3" between -90000 and 90000 AND "regional_gedi_biomass"."longitude_e3" between -180000 and 180000)
);
--> statement-breakpoint
ALTER TABLE "field_extractions" DROP CONSTRAINT "field_extraction_state";--> statement-breakpoint
ALTER TABLE "field_extractions" ADD CONSTRAINT "field_extraction_state" CHECK ("field_extractions"."kind" in ('terrain','ecostress','modis') AND "field_extractions"."status" in ('queued','submitted','completed','failed') AND "field_extractions"."attempts" between 0 and 10 AND octet_length("field_extractions"."request"::text)<=65536 AND ("field_extractions"."status" in ('completed','failed')) = ("field_extractions"."completed_at" is not null) AND ("field_extractions"."status"='failed') = ("field_extractions"."error_code" is not null) AND ("field_extractions"."status"='completed') = ("field_extractions"."result" is not null AND "field_extractions"."result_hash" ~ '^[a-f0-9]{64}$'));--> statement-breakpoint
-- Restores the protection that migration 0022 lost when its hand-written
-- trigger was replaced by a generated file: raw provider files are evidence,
-- written once and deleted only with their extraction (and so with the field).
CREATE OR REPLACE FUNCTION protect_field_extraction_files() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'FIELD_EXTRACTION_FILES_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER field_extraction_files_immutable BEFORE UPDATE ON "field_extraction_files" FOR EACH ROW EXECUTE FUNCTION protect_field_extraction_files();
