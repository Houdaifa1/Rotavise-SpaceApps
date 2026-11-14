# P5 notes: MODIS vegetation history and GEDI canopy biomass

Branch `claude/p5-modis-gedi`, built on 2026-11-08 on top of `field-shift` with
P2, P3, P4 and catalog 0.11.0 merged. Nothing here called NASA: every provider
file in the tests is synthetic, and the first real run is for the user to start.

## What was researched (service status read on 2026-11-08)

| Item                    | Finding                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AppEEARS product list   | `https://appeears.earthdatacloud.nasa.gov/api/product` (public, no login) listed 193 products.                                                                                                                                                                                                                                             |
| MODIS product           | `MOD13Q1.061`, Terra, 250 m, 16 day, 2000-02-18 to present, doi 10.5067/MODIS/MOD13Q1.061. Layers used: `_250m_16_days_NDVI` (scale 0.0001, valid -0.2 to 1, fill -3000), `_250m_16_days_pixel_reliability` (0 to 3), `_250m_16_days_composite_day_of_the_year` (1 to 366). Aqua `MYD13Q1.061` (from 2002-07-04) is also listed; not used. |
| MODIS end of collection | NASA Earthdata data alert "Transition from MODIS to VIIRS", issued 2 May 2025: in late 2026 or early 2027 the Terra and Aqua platforms begin shutting down, MODIS data will no longer be collected, final reprocessing takes place, and both platforms are drifting out of their designed orbits. NASA points users to VIIRS.              |
| GEDI in AppEEARS        | Not available: none of the 193 products is a GEDI product.                                                                                                                                                                                                                                                                                 |
| GEDI route used         | NASA CMR lists GEDI L4B Gridded Aboveground Biomass Density V2.1 (ORNL DAAC, `C2792577683-ORNL_CLOUD`, doi 10.3334/ORNLDAAC/2299): 1 km mean AGBD with a standard error, mission weeks 19 to 223 (2019-04-18 to 2023-03-16), 52 N to 52 S.                                                                                                 |
| GEDI download           | One protected bundle, `GEDI_L4B_Gridded_Biomass_V2_1_2299.zip`, 2,299,654,332 bytes (read from the response headers). It needs an Earthdata login.                                                                                                                                                                                         |
| Other GEDI products     | L4A footprint AGBD, L2A and L2B height and cover, L3 gridded land-surface metrics (1 km): all exist in CMR. Footprint products need spatial subsetting; not built.                                                                                                                                                                         |

## What was built

- **MODIS extraction** (`kind: "modis"` on the existing extraction queue):
  five AppEEARS points (the field-box centre and one 250 m pixel north, east,
  south and west), three layers, 2000-02-18 to today. Pixels count only when the
  reliability layer is 0; the date is the composite year plus the day of year the
  layer reports, which must lie inside the 16-day composite. Neighbours are
  matched to the centre by composite, not by their own day.
- **History analysis** (pure, `packages/domain/src/observations/vegetation-history.ts`):
  16-day bins by day of the year, years kept only with 16 of 23 bins and a yearly
  range of at least 0.15, "low" and "green" as fractions (0.25 and 0.5) of that
  year's own range, a window "usual" when 60% of at least 5 years agree. It also
  gives yearly peaks with a Theil-Sen trend (at least 8 years), a neighbour
  comparison, and an agreement check with the HLS timeline (correlation per
  year-bin, and how much of the low-greenness windows overlap). Every number is
  declared in `vegetationHistoryPolicy` and labelled an engineering heuristic. No
  absolute NDVI threshold and no crop threshold is used.
- **API**:
  - `POST /api/v1/fields/:id/extractions` accepts `{"kind":"modis"}` (needs
    `OBSERVATIONS_ENABLED=true` and an outline).
  - `GET /api/v1/fields/:id/analysis/vegetation-history` returns the history, or
    `{status:"unavailable", observation: none|queued|submitted|failed}`; when an
    HLS result exists it is compared automatically.
  - `GET /api/v1/fields/:id/canopy-biomass` returns `{available:true,result}` or
    `{available:false,reason}` with reason `CANOPY_BIOMASS_NOT_IMPORTED`,
    `CANOPY_BIOMASS_OUTSIDE_IMPORT` or `CANOPY_BIOMASS_NO_ESTIMATE_NEARBY`.
- **GEDI** is a once-only regional import like GRACE: `gedi-extract.py` cuts the
  Morocco box out of the two 1 km rasters, `pnpm gedi:import` loads them into
  `regional_gedi_biomass` (migration `0023`), and the field's own request reads
  the cell holding it (centre within 0.75 km) and the cells within 3 km: mean,
  range and a standard error of the mean that assumes independent cells.
- Every result carries provenance (sourced, model_recall or
  engineering_judgment), limitations and explanation keys for the interface.

## What the user runs (nothing below has been run against NASA)

1. MODIS for a pilot field. Look at the request first (no network, no login):

   ```bash
   pnpm extractions:preview modis path/to/outline.geojson
   ```

   Then start the app with `OBSERVATIONS_ENABLED=true` and the Earthdata settings
   in `.env`, save the field's outline, `POST /api/v1/fields/<id>/extractions`
   with `{"kind":"modis"}`, and poll `GET /api/v1/fields/<id>/extractions` until it
   is completed, then read `.../analysis/vegetation-history`. A 26-year point
   request is small, but the task time is unknown (HLS took about 7.5 hours on
   2026-10-17). The MOD13Q1 file name (`MOD13Q1-061-results.csv`) and column
   names (`MOD13Q1_061__250m_16_days_NDVI` and so on) follow the HLS and SMAP
   pattern and are unproven until the first run.

2. GEDI, once for all fields, with your own Earthdata login:

   ```bash
   # one 2.3 GB bundle; needs your Earthdata login in ~/.netrc for urs.earthdata.nasa.gov
   curl -L -n -c ~/.urs_cookies -b ~/.urs_cookies -O \
     https://data.ornldaac.earthdata.nasa.gov/protected/bundle/GEDI_L4B_Gridded_Biomass_V2_1_2299.zip
   unzip GEDI_L4B_Gridded_Biomass_V2_1_2299.zip -d gedi-l4b
   python3 -m venv .artifacts/gedi-venv
   .artifacts/gedi-venv/bin/pip install rasterio==1.4.3 pyproj==3.6.1 numpy
   .artifacts/gedi-venv/bin/python tooling/earth-observations/gedi-extract.py \
     --agbd gedi-l4b/<mean biomass raster>.tif --se gedi-l4b/<standard error raster>.tif \
     --output .artifacts/gedi-morocco.json
   pnpm gedi:import .artifacts/gedi-morocco.json
   ```

   The bundle's inner file names and formats were not verified (ORNL's file guide
   could not be read); the extractor takes the two paths you give it and refuses
   a file that is not a projected 1 km grid, has values outside 0 to 5000 or no
   declared no-data value.

## Verified (2026-11-08, in the worktree)

| Check                                                                                                                                | Result                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (exit codes read)                                                                 | all 0                                                     |
| `jest --selectProjects modis-gedi` (14 tests: points, normalizer, history, HLS agreement, GEDI, contracts)                           | 14 passed                                                 |
| `jest --selectProjects modis-gedi-integration` (real PostgreSQL, synthetic AppEEARS and GEDI)                                        | 6 passed                                                  |
| `jest --selectProjects modis-gedi modis-gedi-integration terrain terrain-integration observations observations-integration accounts` | 102 passed                                                |
| `pnpm test:backend`                                                                                                                  | 67 passed                                                 |
| `gedi-extract.py` on a synthetic 1 km EASE-Grid 2.0 style GeoTIFF pair with 30% no-data cells                                        | 14,444 cells, every sampled value matches its raster cell |
| `gedi-extract.py` on a 30 m grid, on values up to 90,000 and on a geographic grid                                                    | each refused with a clear message                         |
| `pnpm extractions:preview modis <outline>`                                                                                           | printed 5 points and 3 layers from 02-18-2000             |

The full `pnpm verify` (browser tests, container checks, clean install) and the
engine suite were not run on this branch.

## Not proven

- No real AppEEARS MODIS job has run: the file and column names are recalled
  from the HLS pattern, and AppEEARS may name the composite-day layer or date
  column differently. The normalizer refuses a file with other columns, so a
  mismatch fails loudly (`OBSERVATION_UPSTREAM_INVALID`).
- No real GEDI file has been opened: the bundle's contents and grid are
  unverified; the EASE-Grid 2.0 projection and 1 km cell are recalled, and the
  extractor checks them rather than assuming them.
- The heuristics (16 of 23 bins, 0.15 range, 0.25 and 0.5 fractions, 60% share,
  5 years, trend consistency 0.7 and 0.02 per decade, neighbour grades 0.05 and
  0.10, HLS agreement grades 0.8 and 0.5) are engineering judgment; no agronomist
  has checked that the windows match what farmers see.
- A 250 m pixel can mix several fields; the neighbour comparison grades that but
  cannot fix it. The MODIS record will stop growing when Terra shuts down.
- GEDI over annual cropland is small and uncertain by construction; it is
  context for trees and shrubs nearby, never crop biomass.

## For the parent to merge

- **A defect found in the earlier P4 merge:** P4's hand-written trigger that
  makes raw provider files immutable (`field_extraction_files_immutable`) was
  lost when its migration was regenerated as `0022_gorgeous_warstar.sql`. The P4
  terrain integration test caught it (`jest --selectProjects terrain-integration`
  failed at "FIELD_EXTRACTION_FILES_IMMUTABLE"). It is restored at the end of
  migration `0023_goofy_falcon.sql` on this branch. `test:backend` and
  `test:engine` do not run that test, so the loss was not noticed earlier; run
  `terrain-integration` after any migration change.
- Migration `0023` follows `0022`; it widens the extraction `kind` check to add
  `modis`, creates `regional_gedi_biomass` and restores the trigger.
- Shared files touched with small additive edits: `package.json` (one script),
  `tooling/verification/jest.config.mjs` (two projects),
  `tooling/earth-observations/print-extraction-payload.mjs` (accepts `modis`),
  `create-api.ts`, `field.routes.ts` (one parameter and two routes),
  `extraction-store.ts` (the modis kind and `vegetationHistory`),
  `providers/terrain/normalization.ts` (four helpers exported),
  `packages/*/src/index.ts` exports and `tests/integration/accounts.test.mjs`.
- Proposed DECISIONS text: "P5 adds MODIS MOD13Q1.061 (via AppEEARS) as a long
  greenness history with day-of-year bins and field-relative thresholds, compared
  with HLS where they overlap, and GEDI L4B 1 km biomass as regional context
  imported once from a file downloaded with the user's own Earthdata login. NASA's
  data alert of 2 May 2025 says MODIS collection stops when Terra and Aqua shut
  down in late 2026 or early 2027, so the history will stop growing; VIIRS is the
  named successor and is not built."
- Proposed PROGRESS text: "MODIS history and GEDI canopy context are built and
  tested on synthetic files; no real NASA job has run."
