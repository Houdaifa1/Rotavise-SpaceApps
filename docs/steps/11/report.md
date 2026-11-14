# Step 11 report — NASA data layer and location privacy

Status: **READY_FOR_REVIEW**. Parts A and B are built and verified. Updated
2026-10-18.

## Services checked on 2026-10-17

| Service                              | Finding                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| NASA POWER daily point API           | Identical values for 5 recorded points in one source cell; different values across the 4 neighbouring cells.                    |
| NCCS THREDDS, NEX-GDDP-CMIP6 v2.0    | Open without an account. A 1° tile (16 cells) took 7–12 s per model-year, about the same as one point.                          |
| NEX-GDDP-CMIP6 licence               | File metadata: CC BY-SA 4.0. AWS registry: CC0 since September 2022. We follow CC BY-SA 4.0.                                    |
| AWS copy of NEX-GDDP-CMIP6           | About 245 MB per yearly file, chunked by whole days: unsuitable for one-cell reads.                                             |
| AppEEARS product list                | Offers HLSL30/HLSS30 v2.0, their vegetation-index products and SMAP (SPL3SMP_E.006, SPL4SMGP.008). No GPM IMERG, no OPERA DIST. |
| AppEEARS authentication              | Username and password (HTTP Basic) give a token valid about 48 hours.                                                           |
| GES DISC Hydrology Data Rods         | Discontinued; redirects to an alert.                                                                                            |
| Giovanni time series API (GPM IMERG) | Refuses requests without an Earthdata token.                                                                                    |

Recorded responses and hashes: `docs/evidence/climate-scenarios/2026-10-17/`
(`tooling/climate-scenarios/record-evidence.mjs`).

## Part A — what changed

- **Location privacy (N01–N02).** POWER adapter 3 sends the centre of the
  intersection of the MERRA-2 and CERES SYN1deg cells that contain the field.
  The weather cache key, the upstream URL and stored snapshots carry only that
  centre; plans in the same cell share weather. The engines accept adapter 3
  evidence at the cell centre and older adapter 2 evidence at the exact point,
  never both in one assessment.
- **Future-climate data (N03–N05).** A new `climate-scenarios` module reads
  NEX-GDDP-CMIP6 v2.0 tiles through NCCS THREDDS with a strict netCDF-3 reader
  and a normalizer that checks every attribute, grid cell, calendar and day
  stamp, then converts K to °C. Units are immutable, re-verified from raw bytes
  on every read and contain no farmer data. Tiles are prepared by a durable,
  sliced, resumable queue (two requests at a time, a failure budget, a daily
  limit for plan-triggered tiles) or by `pnpm climate:prepare`.
- **Ensemble (N04).** The five ISIMIP3b primary models, each in its own
  calendar, under SSP2-4.5 and SSP5-8.5. Rotations start 1985–2004 in each
  model's historical run and 2041–2060 in each scenario.
- **Engine 4 (N06–N07).** Exposure runs in standard, proleptic Gregorian,
  365-day and 360-day calendars. Each candidate gets, per scenario and model,
  its baseline loss, future loss, change, worst-decile future loss and its
  farmer-weighted rank in that future world, with the ensemble mean and range.
  The result says whether today's top rotation stays first in every future
  world. Missing data leave a world uncompared; an unprepared tile or a missing
  unit leaves future climate unavailable with the reason.
- **Workflow 3 (N08).** New format 2 plans pin engine 4 and policy 2, request an
  unprepared tile within limits, never wait for it, and pin the units they use.
  Migration 0012 adds the tables, immutability triggers and workflow 3.

## Measured behaviour

The Step 10 benchmark (12 synthetic crops, a 5-year horizon, 30 POWER analogs)
with synthetic data for all 15 model worlds (375 units) takes 0.56 s standalone
(0.36 s without futures) and produces 932 KB. A first version took 7.9 s; memoizing
each slot's exposure per analog offset removed the repeated work without
changing results. A real tile is 1,125 units.

## Verification

Run on 2026-10-17 while an unrelated `next-server` held port 3000.

- **`pnpm verify`, 12:22–12:28 UTC: passed.** Lint, Prettier, strict types,
  **507 Jest tests** (new: 17 scenario unit, 7 scenario integration on real
  PostgreSQL, 3 POWER cell tests, 2 workflow 3 tests), **5 Chromium tests**,
  build, 9 production-container checks (migration 0012 applied, weather
  adapter 3) and a clean frozen install/build. No test containers were left.
- **Live check** (`node tooling/climate-scenarios/live-check.mjs`): the first run
  rejected a real MPI-ESM1-2-HR file whose time units read `days since
1850-1-1 00:00:00`. Both forms are valid CF; the reader now accepts them, the
  file is recorded, and a unit test covers it. The rerun passed for all five
  models (7.0–7.7 s per request). Scenario and weather unit tests (92) passed
  after the fix; the full gate was not re-run for this one-line change.
- **Real tile, 12:31–13:43 UTC:** `pnpm climate:prepare 32.33 -6.36` stored
  all 1,125 real units of the Tadla / Béni Mellal tile (32°N, 7°W) in the
  development database: 0 failures, 32 MB of raw responses, about 16 units a
  minute at two requests at a time.
- **Real data through the engine** (`tooling/climate-scenarios/tile-demo.mjs`,
  labelled synthetic crops and POWER-style weather with the real units): 345
  units read and re-verified in 0.55 s, assessment 0.54 s, all 10 future
  worlds compared. For the top synthetic rotation, the share of days outside
  its invented temperature bounds rose by 6.4 points under SSP2-4.5 (3.3–9.6
  across models) and 9.5 points under SSP5-8.5 (7.3–14.3); UKESM1-0-LL, the
  highest-sensitivity model, gave the largest rise and ranked that rotation
  third. These numbers describe invented crops, not real advice.

## Part B — built without the account

- **N09:** `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` are optional,
  paired, server-only settings; errors never show their values.
- **N10:** saved fields can store an outline (`GET`/`PUT`/`DELETE
/api/v1/fields/:id/boundary`; migration 0013): one closed, simple ring,
  4–201 positions, 0.1–1,000 ha, at most 0.1° across, containing the field
  point, owner-scoped, version-checked and deleted with the field. Sample
  points sit on a 30 m grid at least 15 m inside the outline (at most 100);
  an outline too narrow for clean pixels gives none and says so.

## Part B — with the Earthdata Login account

- **N11 AppEEARS tasks:** a production client (token login, one renewal on
  401/403, bounded retries, checksum-verified downloads that never forward the
  token to the signed storage link, remote deletion) and durable observation
  jobs. The real test task took 5.5 hours at AppEEARS, so jobs poll every 10
  minutes, survive restarts and fail after 48 hours.
- **N12 HLS:** real Landsat and Sentinel-2 values become a field greenness
  (NDVI) record and green-season suggestions. On the real Tadla record: 208
  usable dates of 338, and seasons January–April 2023 (peak 0.77) and
  January–April 2024 (peak 0.49).
- **N13 SMAP:** daily root-zone soil moisture for the 9 km cell; on 468 of 731
  days the product's percentile was undefined and stays empty.
- **N14 GPM:** IMERG Final daily rain by month beside POWER (February 2023 at
  the test cell: 41.3 mm IMERG).
- **N15 API:** `POST`/`GET /api/v1/fields/:id/observations` (kinds `hls`,
  `smap`, `gpm`) and `GET .../observations/:observationId`; owner-scoped, one
  active request per kind, ten new requests per account a day, migration 0014.
  `OBSERVATIONS_ENABLED=true` needs accounts and the Earthdata settings.

## Final verification (2026-10-18)

- **`pnpm verify`, 01:12–01:20 UTC: passed.** Lint, Prettier, strict types,
  **531 Jest tests** (new since Part A: 10 observation unit tests on the real
  AppEEARS and Giovanni files, 4 observation integration tests on real
  PostgreSQL, 1 observation and 1 outline HTTP test, 2 outline unit tests and
  configuration tests), **5 Chromium tests**, build, 9 production-container
  checks (migrations to 0014) and a clean frozen install/build. No test
  containers were left.
- **Live check of the production clients**
  (`node --env-file=.env tooling/earth-observations/live-check.mjs`): AppEEARS
  login, a one-week SMAP task done in 3 minutes, 5 bundle files with
  checksums, 7 days for cell 376/1857, remote task deleted; Giovanni returned
  31 days of GPM IMERG for cell 32.35, −6.55.
- Not run: a full HLS extraction through the worker end to end (the recorded
  real task covers the data path; one takes hours), `pnpm peers check` and
  `pnpm audit --prod` (no dependency changed).

## Acceptance

| ID  | Status | Evidence                                                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------- |
| N01 | Passed | Adapter 3 cell centres; recorded POWER cell evidence; stored snapshots checked in tests     |
| N02 | Passed | Engines accept adapter 3 and adapter 2 evidence, never mixed; format 1 and 2 suites         |
| N03 | Passed | Strict netCDF-3 reader and normalizer on 5 recorded real tiles; live check of all 5 models  |
| N04 | Passed | ISIMIP3b models, both pathways and windows in policy 2; selection recorded in DECISIONS     |
| N05 | Passed | Sliced resumable preparation, limits and failures tested; real Tadla tile 1,125/1,125 units |
| N06 | Passed | Calendar ordinals match recorded time axes for all four calendars                           |
| N07 | Passed | Per-model changes, ranks and stability tested; real-data demonstration                      |
| N08 | Passed | Workflow 3 pins and reads units; workflow 2 unsupported; migration 0012                     |
| N09 | Passed | Paired server-only Earthdata settings; values never in errors                               |
| N10 | Passed | Owner-scoped outlines with limits and sample points; migration 0013                         |
| N11 | Passed | AppEEARS client and durable steps; real recorded task; live check                           |
| N12 | Passed | Clear-pixel NDVI and green seasons on the real Tadla record                                 |
| N13 | Passed | Daily SMAP L4 for the 9 km cell with undefined percentiles kept empty                       |
| N14 | Passed | GPM IMERG monthly beside POWER, complete months only                                        |
| N15 | Passed | Observation API owner scoping, validation, one active request, quota                        |
| N16 | Passed | Full `pnpm verify` and live checks above                                                    |

## Limits

- AppEEARS can take hours; satellite history appears when it finishes. A task
  already sent stays at AppEEARS until it expires (30 days) if its field is
  deleted first.
- Green seasons are heuristics on greenness alone; HLS cannot name a crop.
- Future climate is real only once a tile is prepared; until then results say
  `SCENARIO_TILE_NOT_PREPARED`. The real catalog still has no verified
  temperature rules, so real plans need no tile yet (Step 12).
- Five models and two pathways are not every possible future. Results are
  scenarios, not forecasts.
- The 360-day mapping (31st → 30th) and the 365-day treatment of 29 February
  are documented conventions.
