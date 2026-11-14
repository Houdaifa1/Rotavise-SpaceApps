CREATE TABLE "catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_key" text NOT NULL,
	"version" text NOT NULL,
	"schema_version" text NOT NULL,
	"content_sha256" text NOT NULL,
	"body" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_release_identity" UNIQUE("catalog_key","version"),
	CONSTRAINT "catalog_identity" CHECK ("catalog_versions"."catalog_key" ~ '^[a-z][a-z0-9-]{2,79}$' AND "catalog_versions"."version" ~ '^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$' AND length("catalog_versions"."version") <= 40 AND "catalog_versions"."schema_version" = '1' AND "catalog_versions"."content_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "catalog_body_limit" CHECK (octet_length("catalog_versions"."body"::text) between 1 and 2097152),
	CONSTRAINT "catalog_body_identity" CHECK (coalesce(jsonb_typeof("catalog_versions"."body") = 'object' AND "catalog_versions"."body"->>'id' = "catalog_versions"."catalog_key" AND "catalog_versions"."body"->>'version' = "catalog_versions"."version" AND "catalog_versions"."body"->>'schemaVersion' = "catalog_versions"."schema_version",false)),
	CONSTRAINT "catalog_real_evidence" CHECK (coalesce("catalog_versions"."body"->'synthetic' = 'false'::jsonb AND jsonb_typeof("catalog_versions"."body"->'profiles') = 'array' AND jsonb_typeof("catalog_versions"."body"->'sources') = 'array' AND jsonb_array_length("catalog_versions"."body"->'profiles') between 1 and 50 AND jsonb_array_length("catalog_versions"."body"->'sources') between 1 and 100 AND jsonb_array_length(jsonb_path_query_array("catalog_versions"."body", '$.profiles[*] ? (@.synthetic == false)')) = jsonb_array_length("catalog_versions"."body"->'profiles') AND jsonb_array_length(jsonb_path_query_array("catalog_versions"."body", '$.sources[*] ? (@.synthetic == false)')) = jsonb_array_length("catalog_versions"."body"->'sources'),false))
);
--> statement-breakpoint
-- Imported evidence versions are append-only; no application update/delete path.
CREATE FUNCTION reject_catalog_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CATALOG_VERSION_IMMUTABLE';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER catalog_version_immutable BEFORE UPDATE OR DELETE ON catalog_versions
FOR EACH ROW EXECUTE FUNCTION reject_catalog_version_mutation();
