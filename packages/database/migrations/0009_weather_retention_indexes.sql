CREATE INDEX "weather_cache_snapshot_idx" ON "weather_cache" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "weather_cache_expiry_idx" ON "weather_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "weather_snapshot_created_idx" ON "weather_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "planning_weather_snapshot_idx" ON "planning_weather" USING btree ("snapshot_id");