# P4 notes: terrain, water-storage trend and ECOSTRESS

Branch `claude/p4-elevation-water`, built on 2026-11-08. Nothing here called
NASA: every provider file in the tests is synthetic, and the first real run is
for the user to start.

## What was researched (service status read on 2026-11-08)

| Item                   | Finding                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AppEEARS product list  | `https://appeears.earthdatacloud.nasa.gov/api/product` (public, no login) listed 193 products and showed all of the following as available.                                                                                                                              |
| NASADEM                | `NASADEM_NC.001`, layer `NASADEM_HGT` (metres, int16, fill -32768), 30 m, static, extent 2000-02-11 to 2000-02-21, doi 10.5067/MEaSUREs/NASADEM/NASADEM_NC.001. SRTMGL1_NC.003 (30 m) and SRTMGL3_NC.003 (90 m) are also listed. The code uses NASADEM.                  |
| ECOSTRESS land surface | `ECO_L2T_LSTE.002` (70 m, 2018-07-09 to present): layers LST (Kelvin), LST_err, QC, cloud (1 = cloud, fill 255), water (1 = water), EmisWB, height.                                                                                                                      |
| ECOSTRESS stress       | `ECO_L4T_ESI.002` (PT-JPL evaporative stress index, 70 m): layers ESI (ratio 0 to 1), PET (W/m2), cloud, water. `ECO_L4T_ESI_ALEXI.002` (ESIdaily, mm/day) and `ECO_L3T_JET.002` (evapotranspiration) also exist; not used.                                              |
| GRACE / GRACE-FO       | PO.DAAC collection `C3195527175-POCLOUD`, "JPL GRACE and GRACE-FO Mascon Ocean, Ice, and Hydrology Equivalent Water Height CRI Filtered Release 06.3 Version 04". One global granule `GRCTellus.JPL.200204_202608.GLO.RL06.3M.MSCNv04CRI.nc`, 44 MB, 2002-04 to 2026-08. |
| GRACE access           | The file sits in a protected PO.DAAC archive and needs an Earthdata login. It is netCDF4; no OPeNDAP link is listed in the granule record. This is why the extraction is a separate step the user runs, not a server job.                                                |
| MODIS                  | Not added (its science collection ends in 2027; see DECISIONS "Field Shift re-baseline").                                                                                                                                                                                |
| Reuse terms for GRACE  | Not read in this task. PO.DAAC asks for citation (see `https://podaac.jpl.nasa.gov/CitingPODAAC`). Check before publishing.                                                                                                                                              |

## ECOSTRESS: feasible, and built

ECOSTRESS is available through the same no-cost AppEEARS route as HLS and SMAP,
so it needed no new access method. The summary gives per-month means of
cloud-free land surface temperature and the evaporative stress index. It is
context only: the ISS passes at changing times, so a month is a sample.

## What was built

- Pure calculations (`packages/domain/src/terrain/`): Horn 3x3 slope and aspect,
  RUSLE S and L factors, FAO-style slope classes, a relative erosion reading, a
  cold-air-pool hint (field below its surroundings on gentle ground), a
  GRACE trend with annual and semi-annual cycles and an autocorrelation-widened
  standard error, and the ECOSTRESS monthly summary.
- Strict contracts (`packages/contracts/src/observations/terrain-water.contract.ts`).
- AppEEARS request builder (`providers/terrain/terrain-request.ts`): a grid at
  NASADEM pixel spacing around the outline (at most 400 points; coarser stride
  for large fields) plus 16 ring points at 300 m and 600 m.
- CSV normalizers for NASADEM and ECOSTRESS, strict like the HLS and SMAP ones.
- `ExtractionStore`, its worker handler and queue `rotavise-extractions`;
  tables `field_extractions`, `field_extraction_files` (raw files, immutable)
  and `regional_water_storage` (migration `0021_p4_extractions.sql`, reviewed).
- `WaterStorageService` for the GRACE series.
- API (needs `OBSERVATIONS_ENABLED=true` for extractions):
  - `POST /api/v1/fields/:id/extractions` with `{"kind":"terrain"}` or
    `{"kind":"ecostress"}`; 202 with a status; one active request per field and kind.
  - `GET /api/v1/fields/:id/extractions` and `/extractions/:extractionId`.
  - `GET /api/v1/fields/:id/water-storage` returns `{available:true,result}` or
    `{available:false,reason}` with reason `WATER_STORAGE_NOT_IMPORTED`,
    `WATER_STORAGE_OUTSIDE_IMPORT` or `WATER_STORAGE_SERIES_TOO_SHORT`.
  - Each result carries the product, resolution, `provenance` (sourced,
    model_recall or engineering_judgment for every formula and threshold),
    `limitations` and `explanations` keys for the interface to turn into plain
    language.

## What the user runs (nothing below has been run against NASA)

1. Look at what would be sent (no network, no login):

   ```bash
   pnpm extractions:preview terrain path/to/outline.geojson
   pnpm extractions:preview ecostress path/to/outline.geojson
   ```

   The file holds one GeoJSON Polygon, for example
   `{"type":"Polygon","coordinates":[[[-6.5503,32.3998],[-6.5496,32.3998],[-6.5496,32.4004],[-6.5503,32.4004],[-6.5503,32.3998]]]}`.

2. Terrain and ECOSTRESS for a pilot field: start the app with
   `OBSERVATIONS_ENABLED=true` and the Earthdata settings in `.env`, save the
   field's outline, then `POST /api/v1/fields/<id>/extractions` for each kind
   and poll `GET .../extractions`. AppEEARS tasks took about 7.5 hours for HLS
   on 2026-10-17; terrain should be faster and ECOSTRESS is unknown.
   File names in the AppEEARS bundle (`NASADEM-NC-001-results.csv`,
   `ECO-L2T-LSTE-002-results.csv`, `ECO-L4T-ESI-002-results.csv`) follow the
   pattern recorded for HLS and SMAP and are unproven until the first run.

3. GRACE (once for all fields, with your own Earthdata login):

   ```bash
   # one global file, 44 MB; needs your Earthdata login in ~/.netrc for urs.earthdata.nasa.gov
   curl -L -n -c ~/.urs_cookies -b ~/.urs_cookies -O \
     https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-protected/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4/GRCTellus.JPL.200204_202608.GLO.RL06.3M.MSCNv04CRI.nc
   python3 -m venv .artifacts/grace-venv
   .artifacts/grace-venv/bin/pip install netCDF4==1.7.2
   .artifacts/grace-venv/bin/python tooling/earth-observations/grace-extract.py \
     --input GRCTellus.JPL.200204_202608.GLO.RL06.3M.MSCNv04CRI.nc \
     --output .artifacts/grace-morocco.json
   pnpm grace:import .artifacts/grace-morocco.json
   ```

   The extractor refuses a file whose variables, units (`cm`) or time units
   differ from what it expects, so a wrong file fails loudly.

## Verified (2026-11-08, in the worktree)

| Check                                                                                               | Result                                                                           |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (exit codes read)                                | all 0                                                                            |
| `jest --selectProjects terrain terrain-integration --runInBand` (real PostgreSQL, synthetic)        | 28 passed                                                                        |
| `jest --selectProjects accounts --runInBand` (adds the new extraction and water-storage route test) | 27 passed                                                                        |
| `python3 grace-extract.py` on a synthetic netCDF4 file written with netCDF4 1.7.2                   | worked; masked cell dropped; output imports and gives the known -2 cm/year trend |
| `pnpm extractions:preview terrain\|ecostress` on a sample outline                                   | printed 41 points / 1 layer and 4 points / 6 layers                              |

| `pnpm test:backend` (6 suites) | 65 passed |
| `jest --selectProjects observations observations-integration integration recovery plans-integration plans-recovery soil --runInBand` | 86 passed |

The full `pnpm verify` (browser tests, container checks, clean install) was not
run on this branch.

## Not proven

- No real AppEEARS job for NASADEM or ECOSTRESS has run: column names follow the
  recorded HLS pattern (`NASADEM_NC_001_NASADEM_HGT`, `ECO_L2T_LSTE_002_LST`),
  and whether ECOSTRESS dates carry a time is unknown (both forms are accepted).
- The real GRACE file was not opened: variable names (`lwe_thickness`, `lat`,
  `lon`, `time`), the `cm` unit and "days since 2002-01-01" are recalled from the
  JPL mascon format; the extractor checks them and stops if they differ.
  The baseline period (2004 to 2009) quoted in the limitations is recalled too.
- Horn, RUSLE S and L, the FAO slope classes, the 300 m slope-length cap and the
  3 m vertical noise are recalled (labelled `model_recall`); the reference bands
  and the cold-air thresholds are Rotavise heuristics (labelled
  `engineering_judgment`). None is checked against local field data.
- Terrain for fields so small that few 3x3 windows survive returns no slope on
  purpose. NASADEM's year-2000 surface can differ from the ground today.
- No erosion or frost claim has been validated on a real Moroccan field.

## For the parent to merge

- Migration `0021_p4_extractions.sql` and its snapshot/journal entry may collide
  with a migration from P2 or P3; renumber one and regenerate the snapshot.
- Shared files touched with small additive edits: `package.json` (two scripts),
  `tooling/verification/jest.config.mjs` (two projects), `pg-boss.ts` (one
  queue), `create-api.ts`, `create-worker.ts`, `field.routes.ts` (two optional
  parameters and routes), `packages/*/src/index.ts` exports,
  `tests/integration/accounts.test.mjs` (one test).
- Proposed DECISIONS text: "P4 adds terrain (NASADEM via AppEEARS), ECOSTRESS
  (LST and ESI via AppEEARS) and a GRACE regional water-storage trend. GRACE is
  imported once from a file downloaded with the user's own Earthdata login,
  because the archive is protected netCDF4 and the trend is regional. Formulas
  and thresholds carry a provenance label; recalled ones are marked."
- Proposed PROGRESS text: "Terrain, ECOSTRESS and GRACE context are built and
  tested on synthetic files; no real NASA job has run."
