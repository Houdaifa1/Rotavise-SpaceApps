ALTER TABLE "fields" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN "guest_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_guest_owner_id_plan_owners_id_fk" FOREIGN KEY ("guest_owner_id") REFERENCES "public"."plan_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_guest_idx" ON "fields" USING btree ("guest_owner_id");--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "field_one_owner" CHECK (("fields"."user_id" IS NULL) <> ("fields"."guest_owner_id" IS NULL));