CREATE INDEX "auth_mail_expiry_idx" ON "auth_mail" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "auth_mail_completed_idx" ON "auth_mail" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "auth_rate_limit_expiry_idx" ON "auth_rate_limits" USING btree ("last_request");--> statement-breakpoint
CREATE INDEX "auth_user_unverified_idx" ON "auth_users" USING btree ("email_verified","created_at");--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_provider_account" UNIQUE("provider_id","account_id");