CREATE TABLE "field_boundaries" (
	"field_id" uuid PRIMARY KEY NOT NULL,
	"boundary" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_boundary_version" CHECK ("field_boundaries"."version">0),
	CONSTRAINT "field_boundary_shape" CHECK (coalesce("field_boundaries"."boundary"->>'type'='Polygon' AND octet_length("field_boundaries"."boundary"::text)<=12288,false))
);
--> statement-breakpoint
ALTER TABLE "field_boundaries" ADD CONSTRAINT "field_boundaries_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;