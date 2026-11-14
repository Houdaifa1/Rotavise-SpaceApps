CREATE TABLE "field_extraction_files" (
	"extraction_id" uuid NOT NULL,
	"name" text NOT NULL,
	"raw" "bytea" NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_extraction_files_extraction_id_name_pk" PRIMARY KEY("extraction_id","name"),
	CONSTRAINT "field_extraction_file" CHECK ("field_extraction_files"."sha256" ~ '^[a-f0-9]{64}$' AND octet_length("field_extraction_files"."raw") between 1 and 20971520 AND "field_extraction_files"."name" ~ '^[A-Za-z0-9._-]{1,200}$')
);
--> statement-breakpoint
CREATE TABLE "field_extractions" (
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
	CONSTRAINT "field_extraction_state" CHECK ("field_extractions"."kind" in ('terrain','ecostress') AND "field_extractions"."status" in ('queued','submitted','completed','failed') AND "field_extractions"."attempts" between 0 and 10 AND octet_length("field_extractions"."request"::text)<=65536 AND ("field_extractions"."status" in ('completed','failed')) = ("field_extractions"."completed_at" is not null) AND ("field_extractions"."status"='failed') = ("field_extractions"."error_code" is not null) AND ("field_extractions"."status"='completed') = ("field_extractions"."result" is not null AND "field_extractions"."result_hash" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "field_extraction_result_limit" CHECK ("field_extractions"."result" is null OR octet_length("field_extractions"."result"::text)<=2097152)
);
--> statement-breakpoint
CREATE TABLE "regional_water_storage" (
	"product" text NOT NULL,
	"latitude_e2" integer NOT NULL,
	"longitude_e2" integer NOT NULL,
	"month" text NOT NULL,
	"lwe_cm" numeric(9, 3) NOT NULL,
	"source_sha256" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_water_storage_product_latitude_e2_longitude_e2_month_pk" PRIMARY KEY("product","latitude_e2","longitude_e2","month"),
	CONSTRAINT "regional_water_storage_value" CHECK ("regional_water_storage"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND "regional_water_storage"."lwe_cm" between -2000 and 2000 AND "regional_water_storage"."source_sha256" ~ '^[a-f0-9]{64}$' AND "regional_water_storage"."latitude_e2" between -9000 and 9000 AND "regional_water_storage"."longitude_e2" between -18000 and 18000)
);
--> statement-breakpoint
ALTER TABLE "field_extraction_files" ADD CONSTRAINT "field_extraction_files_extraction_id_field_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."field_extractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_extractions" ADD CONSTRAINT "field_extractions_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_extraction_field_idx" ON "field_extractions" USING btree ("field_id","created_at");--> statement-breakpoint
CREATE INDEX "field_extraction_pending_idx" ON "field_extractions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "regional_water_storage_cell_idx" ON "regional_water_storage" USING btree ("latitude_e2","longitude_e2");