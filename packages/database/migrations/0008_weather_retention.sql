-- Custom SQL migration file, put your code below! --
-- Snapshots still never change. They hold the requested coordinates, so the
-- bounded retention job may delete unreferenced rows, but only inside a
-- transaction that sets rotavise.weather_retention. Foreign keys from
-- planning_weather and weather_cache still protect evidence in use.
CREATE OR REPLACE FUNCTION reject_weather_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('rotavise.weather_retention', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'WEATHER_SNAPSHOT_IMMUTABLE';
END;
$$;
