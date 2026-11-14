CREATE INDEX "plan_owner_list_idx" ON "plan_requests" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "field_owner_list_idx" ON "fields" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "field_guest_list_idx" ON "fields" USING btree ("guest_owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "climate_scenario_tile_year_idx" ON "climate_scenario_units" USING btree ("tile_latitude","tile_longitude","experiment","year","model","variable");--> statement-breakpoint
CREATE INDEX "regional_gedi_latest_idx" ON "regional_gedi_biomass" USING btree ("imported_at");