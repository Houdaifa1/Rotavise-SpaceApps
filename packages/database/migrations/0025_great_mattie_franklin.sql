ALTER TABLE "plan_requests" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD COLUMN "initial_label" text;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD COLUMN "parent_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_label" CHECK ("plan_requests"."label" is null OR (char_length("plan_requests"."label") <= 80 AND "plan_requests"."label" !~ U&'[[:cntrl:]\0080-\009f]'));--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_initial_label" CHECK ("plan_requests"."initial_label" is null OR (char_length("plan_requests"."initial_label") <= 80 AND "plan_requests"."initial_label" !~ U&'[[:cntrl:]\0080-\009f]'));--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_parent" CHECK ("plan_requests"."parent_plan_id" is null OR ("plan_requests"."parent_plan_id" <> "plan_requests"."id" AND "plan_requests"."input"->>'schema_version'='2' AND "plan_requests"."input"->'what_if' is not null));
--> statement-breakpoint
-- Additive provenance protection. Existing accepted-input, terminal-result,
-- planning-weather and raw provider-file triggers remain untouched.
CREATE FUNCTION protect_plan_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.parent_plan_id,NEW.initial_label) IS DISTINCT FROM ROW(OLD.parent_plan_id,OLD.initial_label) THEN
    RAISE EXCEPTION 'PLAN_ACCEPTED_METADATA_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plan_metadata_immutable BEFORE UPDATE ON plan_requests
  FOR EACH ROW EXECUTE FUNCTION protect_plan_metadata();
