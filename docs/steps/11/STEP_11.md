# Step 11 — NASA data layer and location privacy

Authorized by the user's 2026-10-17 message "Start Step 11. I'll create the NASA
Earthdata Login account and tell you when it's ready." Bring NASA data beyond
POWER into the backend, and stop storing farmer coordinates with weather
evidence. No crop evidence (Step 12), science models (Step 13), crop-health work
(Step 14) or interface change (Step 15).

Services, products and terms were rechecked live on 2026-10-17; see the
[report](report.md). Part A needs no account. Part B needs the NASA Earthdata
Login account and stays blocked until it exists. OPERA DIST-ALERT moves to Step
14 (see [DECISIONS](../../DECISIONS.md)).

## Part A — no account

| ID  | Required behavior                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01 | Every POWER request (plans and the public explorer) is moved to the centre of the intersection of its MERRA-2 (0.5° × 0.625°) and CERES SYN1deg (1°) cells before cache keys, upstream calls and storage (adapter 3). Live evidence shows identical values inside a cell. New snapshots never contain farmer coordinates. |
| N02 | Engines accept snapped evidence; stored runs that used exact coordinates still verify. One assessment never mixes locations.                                                                                                                                                                                              |
| N03 | NEX-GDDP-CMIP6 v2.0 through NCCS THREDDS: one 1° × 1° tile per model, experiment, variable and year; a strict netCDF-3 reader; K converted to °C; cells and calendars verified; raw bytes, hashes and retrieval time stored immutably; a recorded real response; licence and citation recorded.                           |
| N04 | Ensemble policy: the five ISIMIP3b primary models with their own calendars; SSP2-4.5 and SSP5-8.5; baseline rotations starting 1985–2004 in each model's historical run; future rotations starting 2041–2060. The selection reason is cited.                                                                              |
| N05 | Tile preparation is durable, sliced and resumable, with global concurrency, a daily tile limit, bounded retries and progress. An administrator command prepares named tiles. A plan in an unprepared tile requests preparation within limits and completes without future climate, saying why.                            |
| N06 | Exposure is evaluated in each model's calendar (standard, proleptic Gregorian, 365-day, 360-day) with a documented sowing-date mapping. Missing values stay missing.                                                                                                                                                      |
| N07 | Future comparison: for each rotation, scenario and model, the baseline loss, future loss and change; ensemble mean and range of the change; the farmer-weighted rank in each future world; whether the top rotation stays first. POWER and model data are never mixed in one comparison.                                  |
| N08 | Planning workflow 3 pins engine 4, policy 2 and the scenario data it used; retries reuse pins; results are hash-checked. Earlier format 2 results stay readable; unfinished workflow 2 runs fail with `WORKFLOW_VERSION_UNSUPPORTED`. Format 1 is unchanged.                                                              |

## Part B — needs the Earthdata Login account

| ID  | Required behavior                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N09 | Earthdata credentials are server-only configuration, absent by default, never logged and never exposed to the browser. Features without credentials report "not configured".                                       |
| N10 | Saved fields may store a boundary polygon (vertex, area and validity limits; owner-scoped; deleted with the field). Sample points are derived inside it.                                                           |
| N11 | AppEEARS tasks are durable: submit, poll, download with checksum checks, normalize, store and delete the remote task; bounded retries and quotas. A recorded real response backs the tests.                        |
| N12 | HLS v2.0 (Landsat and Sentinel-2) vegetation history per field: NDVI from clear pixels by Fmask, the field median per date with coverage, and green seasons offered as history suggestions. It never names a crop. |
| N13 | SMAP L4 root-zone soil-moisture percentile for the field's 9 km cell, labelled as regional model-assimilated context.                                                                                              |
| N14 | GPM IMERG V07 Final daily rain for the field's 0.1° cell, compared with POWER by month, as context only.                                                                                                           |
| N15 | An owner-scoped observation API starts the extractions and returns status and results.                                                                                                                             |

## Both parts

| ID  | Required behavior                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N16 | Unit tests, real PostgreSQL integration tests using recorded real responses, opt-in live checks, full `pnpm verify`, and a report with commands, results and limits. |
