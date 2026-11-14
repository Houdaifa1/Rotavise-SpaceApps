CREATE TABLE "boundary_candidates" (
	"dataset_sha256" text NOT NULL,
	"source_id" text NOT NULL,
	"geometry" jsonb NOT NULL,
	"bounds" "box" NOT NULL,
	"area_hectares" double precision NOT NULL,
	"confidence" double precision,
	"holes_dropped" integer NOT NULL,
	"area_change_percent" double precision NOT NULL,
	CONSTRAINT "boundary_candidates_dataset_sha256_source_id_pk" PRIMARY KEY("dataset_sha256","source_id"),
	CONSTRAINT "boundary_candidate_area" CHECK ("boundary_candidates"."area_hectares" BETWEEN 0.1 AND 1000),
	CONSTRAINT "boundary_candidate_confidence" CHECK ("boundary_candidates"."confidence" IS NULL OR "boundary_candidates"."confidence" BETWEEN 0 AND 1),
	CONSTRAINT "boundary_candidate_cleaning" CHECK ("boundary_candidates"."holes_dropped" BETWEEN 0 AND 31 AND "boundary_candidates"."area_change_percent" BETWEEN 0 AND 2),
	CONSTRAINT "boundary_candidate_geometry" CHECK (coalesce("boundary_candidates"."geometry"->>'type'='Polygon' AND octet_length("boundary_candidates"."geometry"::text)<=12288, false))
);
--> statement-breakpoint
CREATE TABLE "boundary_datasets" (
	"sha256" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"source_etag" text NOT NULL,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"year" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"report" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boundary_dataset_sha" CHECK ("boundary_datasets"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "boundary_dataset_license" CHECK ("boundary_datasets"."license" = 'CC-BY-4.0' AND "boundary_datasets"."year" = 2025)
);
--> statement-breakpoint
ALTER TABLE "boundary_candidates" ADD CONSTRAINT "boundary_candidates_dataset_sha256_boundary_datasets_sha256_fk" FOREIGN KEY ("dataset_sha256") REFERENCES "public"."boundary_datasets"("sha256") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boundary_candidates_bounds" ON "boundary_candidates" USING gist ("bounds");--> statement-breakpoint
CREATE UNIQUE INDEX "boundary_dataset_one_active" ON "boundary_datasets" USING btree ("active") WHERE "boundary_datasets"."active";