#!/bin/sh
# Prepares every future-climate tile that touches Morocco, north first, inside
# its own container so rebuilding the project cannot disturb it. Finished tiles
# return at once and partial ones resume, so it is safe to stop and restart.
# Usage: docker compose -f infra/science/download.compose.yaml up -d --build
while :; do
  while read -r lat lon; do
    echo "$(date -u +%FT%TZ) tile $lat $lon"
    node dist/entrypoints/climate-prepare.main.js "$lat" "$lon" | tail -1
  done < /tiles.txt
  echo "$(date -u +%FT%TZ) pass finished"
  sleep 3600
done
