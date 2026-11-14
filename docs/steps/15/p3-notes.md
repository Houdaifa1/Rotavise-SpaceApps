# P3 notes: greenness timeline, low-greenness periods, rain series

Branch `claude/p3-vegetation-timeline`. These notes hold proposed text for
`docs/DECISIONS.md` and `docs/PROGRESS.md`; neither file was edited here.

## What was built

- **Endpoints (owner scoped, same rules as `/observations`):**
  - `GET /api/v1/fields/:id/analysis/vegetation`
  - `GET /api/v1/fields/:id/analysis/rain`

  Each returns `{status: "ready", ...}` from the newest completed extraction,
  or `{status: "unavailable", observation: "none" | "queued" | "submitted" |
"failed", error}` so the interface can say why there is nothing yet. A
  newer running request never hides an older completed one.

- **Vegetation analysis (`vegetation-analysis-1`):**
  - Per calendar year: status (complete, partial, no data), usable readings,
    largest gap, the timeline (date, NDVI, clear points, sensors, HLS granule
    ids) and the green and low-greenness periods clipped to that year.
  - Low-greenness periods are the stretches between detected green seasons.
    They are labelled "low greenness", not "bare": the satellite cannot tell
    bare soil from stubble or a dry crop, and the explanation key
    `bare_field_period` says so.
  - Usually-low windows (month-day ranges) come only from complete years, only
    from normal-confidence periods, and only with at least three complete
    years.
  - Anomalies compare each reading with the median of one value per other year
    inside plus or minus 15 days (robust z from median and MAD, floored by the
    series' own noise); flag below or above usual at 2 robust SDs; at least
    three other years are required. The latest reading carries its age and a
    stale flag (over 30 days at the request's date).
  - Uncertainty: dates seen and usable, usable share, largest gap, every gap of
    45 days or more, and whether granule ids exist.
  - Explanation keys with plain English text: `ndvi`, `green_season`,
    `bare_field_period`, `vegetation_stress`, `field_history_anomaly`,
    `cloud_gap`.
- **Granule ids:** the AppEEARS bundle already holds `...-granule-list.txt`.
  It is now downloaded, kept as evidence (`granule-list.txt` in
  `field_observation_files`) and the ids of the usable dates are stored in the
  result (`granules`, optional, so earlier results still validate). Ids are
  matched by acquisition day and sensor.
- **Rain series (`rain-series-1`):** the stored GPM result as a monthly table
  with IMERG, POWER, difference and ratio only where both months are complete
  (ratio only when POWER is at least 1 mm), plus totals over the compared
  months and the cell, products and a note on how plans use the correction.

## Thresholds and their basis (all declared in `vegetationAnalysisPolicy`)

| Setting                                   | Value         | Basis                                                                        |
| ----------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Green season                              | n/a           | Stored result's TIMESAT amplitude rule (Jönsson and Eklundh 2004), per field |
| Usually-low share, minimum complete years | 0.5, 3        | Declared product heuristics: a majority of at least three complete years     |
| Complete year                             | 12 readings   | Declared: about monthly coverage                                             |
| Long gap                                  | 45 days       | Declared: lowers confidence, excluded from usual windows                     |
| Anomaly window, reference years, robust z | 15 days, 3, 2 | Declared statistics relative to the field's own years                        |
| Stale reading                             | 30 days       | Declared                                                                     |

No absolute NDVI threshold or crop value is used anywhere. None of these
numbers is a crop source; the policy carries that statement in `provenance`.

## Verified (2026-11-08, worktree of this branch)

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: exit 0.
- `pnpm test:engine`: 236 passed (includes 21 observations unit tests: eight
  synthetic-series cases, granule parsing on the recorded list, the recorded
  Tadla field, and the rain series).
- `observations-integration` (real PostgreSQL): 6 passed, including the new
  analysis, granule evidence, failed-then-completed and ownership cases.
- `accounts` (HTTP through the real API): 26 passed, including both analysis
  routes (unavailable state, owner scope).
- `pnpm test:backend`: 66 passed.
- Real recorded data (AppEEARS task of 2026-10-17, Tadla plain, 2023–2024,
  4 sample points): 208 of 338 dates usable (0.615), two complete years, 228
  granule ids attached to every timeline reading, green seasons 2023-01-02 to
  2023-04-26 (peak NDVI 0.77) and 2024-01-23 to 2024-04-30 (peak 0.49), low
  greenness between them, no gap of 45 days, `typical` windows empty
  (two complete years only) and anomalies `insufficient_history`. The dev
  database holds no observations, so nothing else was run.

## Not verified

- No live AppEEARS call: the pipeline ran on the recorded files only. A real
  five-year request returns more years; the usually-low windows and anomalies
  only show up then.
- Granule ids are matched by day and sensor from the granule list; a day with
  two granules of one sensor would list both. The recorded list had one per
  day and sensor.
- No agronomic validation that the flags match what farmers see.

## Proposed DECISIONS text

**Field greenness analysis (2026-11-08).** The interface shows each field's own
greenness history from its HLS result: per-year timeline with granule ids,
green and low-greenness periods, usually-low windows and readings compared with
the field's other years. Low greenness is never called bare soil. Limits are
relative to the field's own series or declared heuristics with their basis
(`vegetation-analysis-1`); no absolute NDVI or crop threshold. Usually-low
windows need three complete years; comparisons need three other years;
periods with a gap of 45 days or more are low confidence and excluded from
usual windows.

## Proposed PROGRESS text

P3: `GET /fields/:id/analysis/vegetation` and `/analysis/rain` built and tested
(synthetic series, recorded Tadla data, real PostgreSQL, HTTP). Granule ids are
stored with HLS results. Not run against a live five-year AppEEARS task.
