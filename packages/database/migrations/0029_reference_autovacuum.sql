-- Shared reference stores are insert-heavy during preparation, then read-mostly.
-- Keep insert vacuum/freeze and planner statistics active well below the defaults.
ALTER TABLE climate_scenario_units SET (autovacuum_vacuum_insert_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02, autovacuum_analyze_threshold=1000);
--> statement-breakpoint
ALTER TABLE regional_water_storage SET (autovacuum_vacuum_insert_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02, autovacuum_analyze_threshold=1000);
--> statement-breakpoint
ALTER TABLE regional_gedi_biomass SET (autovacuum_vacuum_insert_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02, autovacuum_analyze_threshold=1000);
--> statement-breakpoint
ALTER TABLE plan_requests SET (autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02);
