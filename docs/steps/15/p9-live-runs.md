# P9: first runs against real NASA data (2026-11-09)

B6 operational update. `rotavise_live` and `rotavise_dev` now serve as
read-only source backups for the one-time consolidation into `rotavise`. The
process IDs and commands below describe the dated P9 run. Current operations
follow `docs/operations/RUNBOOK.md`.

Everything below was run on 2026-11-09 with the Earthdata account in `.env`
and `~/.netrc` (neither was read or printed; `~/.netrc` already existed when
this started and was not created by the agent). The app ran against a new
database `rotavise_live` in the local dev PostgreSQL container (API on port
3150, worker on 3101, `OBSERVATIONS_ENABLED=true` set on the command, `.env`
unchanged). Pilot field: the sample outline from `p4-notes.md`, a 0.4 ha
polygon in Tadla at 32.4 N, -6.55 E, created as a guest field.

## Results

| Provider            | Command / route                                                                    | Outcome                                                             |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| NASADEM (terrain)   | `POST /api/v1/fields/:id/extractions {"kind":"terrain"}`                           | completed in under 10 minutes; first try, no parser change needed   |
| ECOSTRESS LST + ESI | `POST .../extractions {"kind":"ecostress"}`                                        | completed in under 10 minutes; parsed, one filter added (see below) |
| GRACE/GRACE-FO      | `curl -n` of the PO.DAAC file, `grace-extract.py`, `pnpm grace:import`             | downloaded (46,150,171 bytes), 616 cells, imported                  |
| GEDI L4B            | `curl -n` of the ORNL bundle, `gedi-extract.py` (MU and SE rasters), `gedi:import` | downloaded (2,299,654,332 bytes), 1,008,541 cells, imported         |
| MODIS MOD13Q1.061   | `POST .../extractions {"kind":"modis"}`                                            | see "MODIS" below                                                   |

### Terrain (NASADEM, 30 m)

Real AppEEARS file `NASADEM-NC-001-results.csv` matched the recorded column
names (`NASADEM_NC_001_NASADEM_HGT`). Result from `GET .../extractions`:
elevation mean 430.2 m (min 430, max 431, relief 1 m), slope mean 1.85 %,
p90 3.76 %, below the DEM noise floor of 6.4 %, so the field is flat for this
resolution; LS factor 0.34; frost pocket "not indicated". All 41 requested
points returned a value.

### ECOSTRESS (70 m)

Real file names `ECO-L2T-LSTE-002-results.csv` and `ECO-L4T-ESI-002-results.csv`
matched the guessed ones, and the columns matched. Result: 63 usable
acquisitions between 2024-01-01 and 2026-11-09 over 30 months, 4 sample points.
ESI exists in only a few months (for example 0.258 in 2024-07, 0.279 in
2025-02): most ESI rows are cloudy.

Findings from the real LSTE file (684 rows, 252 clear with a value):

- The file carries QC columns the request does not list (AppEEARS adds them).
  `QC_Mandatory_QA_flags` is `0b00` for 228 clear pixels and `0b01` for 24.
  **Fix:** `normalizeEcostress` now keeps only `0b00` when the column exists
  (`providers/terrain/normalization.ts`). Before, a 43.9 C pixel at 18:23 UTC on
  2024-12-04 (flag `0b01`) entered the December mean.
- **Not fixed, open:** a pixel of 64.0 C at 06:37 UTC on 2024-09-04 has flag
  `0b00`, accuracy `0b01` and is cloud-free in the mask, yet a ground
  temperature of 64 C at dawn is physically unlikely. All four sample points
  agree on it, which points to a scene-wide artefact. No flag in the file
  catches it. The September 2024 mean (34.3 C) and max (63.95 C) are therefore
  suspect. A plausibility rule needs a source for its limit; none was invented.
- The first extraction in `rotavise_live` was made before the filter, so its
  stored result still contains the 0b01 pixels. A new request would not.

Follow-up on the same day's ECOSTRESS task: the 64 C row's LST accuracy class
is marginal, while mandatory QA `00` only indicates TES production. New
`ecostress-policy-2` requests select the documented good/excellent LST accuracy
classes; old requests/results keep policy 1. All three September 2024 LST
acquisitions are marginal, so the new policy leaves that month unavailable.
No sourced dawn-temperature ceiling was found. See the
[research, before/after and verification notes](codex-ecostress-limit-notes.md).

### GRACE

The file name in `p4-notes.md` exists and downloads
(`GRCTellus.JPL.200204_202608.GLO.RL06.3M.MSCNv04CRI.nc`). The extractor accepted
its variables and units, left out two months with two solutions (2012-01,
2015-04), and wrote 616 cells for months 2002-04 to 2026-08. For the pilot
field the nearest cell is 25.1 km away: trend -0.63 cm/year (95 % interval
-1.2 to -0.07, standard error 0.29, 256 months, 37 missing), "declining",
latest anomaly -6.63 cm (2026-08). The series is strongly autocorrelated
(0.95), which the endpoint reports. The anomaly rose from about -11.5 cm in
2025-12 to -6.5 cm in 2026-01 in the real series; this step change is data, not
checked here against any explanation.

The dev database `rotavise_dev` already held 157,696 GRACE rows from an import
at 02:18 UTC the same day that this task did not make.

### GEDI L4B

The bundle holds 10 cloud-optimized GeoTIFFs (`..._MU.tif` mean biomass,
`..._SE.tif` standard error, no-data -9999, Mg/ha) as the bundle's own PDF
guide says. `gedi-extract.py` accepted the two rasters. For the pilot field:
the cell holding it has 1.966 Mg/ha (standard error 0.529, 0.45 km away); the
28 cells within 3 km average 2.908 Mg/ha (min 1.58, max 7.322). The endpoint
labels this as woody vegetation nearby, not crop biomass.

### MODIS (250 m, 2000 to 2026)

Submitted 02:16 UTC, completed 03:36 UTC (1 h 20 min, far under the 7.5 h that
HLS took). The real file `MOD13Q1-061-results.csv` (1,056,598 bytes) matched
the guessed name and columns (`MOD13Q1_061__250m_16_days_NDVI`,
`..._composite_day_of_the_year`, `..._VI_Quality`, `..._pixel_reliability`; the
file also lists a MODLAND quality description per row). 5 sample points (centre
plus 4 neighbours), 614 dates seen from 2000-02-18, 589 usable (95.9 %).

`GET /api/v1/fields/:id/analysis/vegetation-history` on the real data (27 years
used, none excluded):

- usually low: 25 May to 16 Nov (176 days, in at least 17 years);
- usually green: 19 Dec to 22 Apr (125 days, in at least 15 years);
- yearly peak NDVI 0.668 (2000), 0.754 (2001), 0.718 (2002), 0.805 (2003) and so
  on; trend -0.021 per decade, direction "no clear trend" (consistency 0.58);
- neighbour comparison "similar" (median absolute difference 0.027);
- `hlsAgreement` is null because no HLS timeline exists for this pilot field.

That pattern (green in winter and spring, low in summer) fits rain-fed winter
cereals in Tadla; no crop record exists to check it against.

### Bug found while waiting (fixed)

`ExtractionStore.process` added 1 to `attempts` on every poll, and any
`ObservationError` with `attempts >= 5` failed the task. With 10-minute polls,
one transient NASA error after 50 minutes of waiting would have failed a task
that is allowed to run for 48 hours (the MODIS row reached `attempts` 8). Now a
good "not done yet" answer resets `attempts` to 0, so it counts consecutive
errors. Test: terrain integration "one NASA error after a long wait does not
fail an extraction that was polling normally" (6 pending polls, one error, then
done). I did not run that test against the old code. My own worker was
restarted on the fixed build mid-run; the queued poll job survived the restart.

## Code and evidence changed

- `providers/terrain/normalization.ts`: ECOSTRESS LST QA filter (above).
- `application/extraction-store.ts`: `attempts` reset on a good poll (above).
- `tests/unit/terrain.test.mjs`: new tests reading real rows and files saved in
  `docs/evidence/live/2026-11-09/` (a trimmed LSTE sample with one row of each
  kind, the whole real ESI file and the whole real NASADEM file).
- Real raw files stay in the `rotavise_live` database (`field_extraction_files`);
  the downloaded GRACE and GEDI files are in `.artifacts/live/` (not in git).

## Checks run (exit codes read)

`pnpm lint` 0, `pnpm format:check` 0, `pnpm typecheck` 0, jest projects
`terrain terrain-integration modis-gedi modis-gedi-integration observations
observations-integration`: 78 passed, exit 0 (after the `attempts` fix).

## Left running or not done

- The API, worker and watcher started for this run use database
  `rotavise_live` and ports 3150 and 3101. Their process IDs on 2026-11-09 were 90116 (API) and 796 (worker, restarted
  on the fixed build); other `api.main.js` and `worker.main.js`
  processes on the Mac are not part of this run.
- The pilot field's guest token and id are in `.artifacts/live/state.json` (mode
  600, not in git), so the endpoints above can be called again.
- GRACE and GEDI imports went into `rotavise_live`; the GRACE tools were also
  changed by commit ff26e4a after this run's first GRACE import.
- Nothing was pushed.
