#!/bin/sh
# Shows how much future-climate data is stored. All of it lives in ONE table,
# climate_scenario_units (every model, scenario and year of every tile), so the
# engine reads one place; the tiles table only tracks download progress.
# Usage: pnpm climate:status
set -eu
# Override only for a documented read-only backup inspection before switching.
CLIMATE_DATABASE=${ROTAVISE_CLIMATE_DATABASE:-rotavise}
CLIMATE_CONTAINER=${ROTAVISE_DB_CONTAINER:-rotavise-dev-postgres-1}
DB="docker exec $CLIMATE_CONTAINER psql -X -v ON_ERROR_STOP=1 -U rotavise -d $CLIMATE_DATABASE -At -F |"
echo "== Stored data (one table: climate_scenario_units) =="
OUT=$($DB -c "SELECT experiment, min(year)||'-'||max(year), count(DISTINCT year)||' years', count(*)||' units' FROM climate_scenario_units GROUP BY 1 ORDER BY 1")
printf '%s\n' "$OUT" | awk -F'|' '{printf "  %-11s %-10s %-10s %s\n",$1,$2,$3,$4}'
echo "== Past and mid-century download (tile positions ready) =="
OUT=$($DB -c "SELECT count(*) FILTER (WHERE status='ready') || ' ready, ' || count(*) FILTER (WHERE status<>'ready') || ' not ready' FROM (SELECT DISTINCT ON (tile_latitude,tile_longitude) status FROM climate_scenario_tiles ORDER BY tile_latitude,tile_longitude, (status='ready') DESC) t")
printf '%s\n' "$OUT" | sed 's/^/  /'
echo "== Near-term years 2026-2040 (scenarios SSP2-4.5 and SSP5-8.5): 600 units per tile position =="
OUT=$($DB -c "WITH p AS (SELECT count(DISTINCT (tile_latitude,tile_longitude)) n FROM climate_scenario_tiles) SELECT count(*) || ' of ' || (SELECT n*600 FROM p) || ' units  (' || round(100.0*count(*)/(SELECT n*600 FROM p),1) || ' %)' FROM climate_scenario_units WHERE experiment IN ('ssp245','ssp585') AND year BETWEEN 2026 AND 2040")
printf '%s\n' "$OUT" | sed 's/^/  /'
echo "== Download container =="
docker ps --filter name=rotavise-download --format '  {{.Names}}: {{.Status}}'
docker logs --tail 1 rotavise-download-download-1 2>&1 | sed 's/^/  last: /' | cut -c1-110
