# P10 notes: near-term climate period (2026-11-09)

B6 operational update. `rotavise_dev` is a read-only source backup. Current
application and download commands use `rotavise`. Follow the database section
in `docs/operations/RUNBOOK.md` for the switch. The observations below retain
their original dates.

Branch `claude/p10-near-term`. Nothing here touched the running download, its
database (`rotavise_dev`) or any tile row: every test ran on disposable
PostgreSQL, and the only thing done against `rotavise_dev` was one read-only
`SELECT` to measure tile speed.

## What it does

The format 2 engine now reports a **near-term period** beside mid-century:
rotations that start 2026 to 2035 under SSP2-4.5 and SSP5-8.5, compared with each
model's own 1985-2004 baseline, the same method as mid-century. It is labelled
`notAForecast: true`.

- **Policy** (`packages/contracts/src/engine/rotation.contract.ts`): the future
  climate policy takes an optional `nearTerm: { windows, minimumCompleteAnalogs }`.
  A refinement keeps near-term windows SSP-only, from 2015 on, ending before the
  same scenario's mid-century anchors begin (so a unit is never in both), and
  with a minimum no larger than the number of anchors.
- **Live policy** (`planning-store.ts`): `currentFutureClimatePolicy` = the stored
  `futureClimatePolicy` (unchanged) + `nearTerm` (anchors 2026-2035, data to 2040,
  minimum 8 complete analogs). `rotationPlanningPolicy`, the worker and
  `climate:prepare` now use it. Tests and older pins keep `futureClimatePolicy`.
- **Units** (`scenario-store.ts`, `scenario.ts`): `tileUnits` appends the near-term
  windows after the older ones; `nearTermUnits` (domain) lists what one plan
  needs (SSP years to `min(2040, 2035 + rotation span)`). Unit identity does not
  depend on the policy, so an extended tile fetches only the new years.
- **Worlds** (`scenario.ts`): near-term series go into their own worlds
  (`model|experiment|near_term`), so the mid-century world's series are exactly
  what they were.
- **Engine** (`future.ts`, `assess.ts`): each model's baseline runs once and both
  periods compare with it. Near-term adds `futureClimate.nearTerm` (status, reason,
  windows, minimum, worlds, `topStableAcrossFutures`) and per candidate
  `future.nearTerm` (same shape as `future.scenarios`). Without `nearTerm` in the
  pinned policy no key is added.
- **Planning** (`planning-store.ts`): near-term units are pinned apart, only after
  the mid-century ones are there, into `planning_scenario_units`, so
  `futureClimate.unitIds` still equals the pinned ids (the status contract checks
  it on every read). A tile without them asks to be extended (new policy key, same
  daily limit and job queue as any new tile) and the plan completes.
- **Reasons**: `NEAR_TERM_TILE_NOT_PREPARED`, `NEAR_TERM_DATA_INCOMPLETE`,
  `NEAR_TERM_ANALOGS_INSUFFICIENT` (exported as `nearTermReasons`); when the whole
  future comparison is unavailable the near-term block repeats that reason.
  Glossary entries in en/fr/ar (machine-written, unreviewed like the rest) and
  `docs/api/openapi.json` regenerated.
- **No migration, no new engine or workflow version**: the pinned policy selects
  the behaviour, as the what-if does.

## Why SSP 2026-2040 only, not 2010-2040

The baseline is each model's own 1985-2004 and no anchor starts before 2026, so
historical 2010-2014 and SSP 2015-2025 are never read. Fetching them would add
about 76% instead of 40% to the download for nothing. Verified against NCCS
THREDDS on 2026-11-09 with the provider's own URL form: SSP2-4.5 2026 (GFDL-ESM4
`tasmin`) and SSP5-8.5 2040 (UKESM1-0-LL `tasmax`) return `application/x-netcdf`,
historical 2014 returns 200 and historical 2015 returns 404, so the CMIP6 split is
as assumed.

## Verified (2026-11-09, in the worktree, exit codes read)

| Check                                                                                  | Outcome                                                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck`                                     | all 0                                                                                                            |
| `pnpm test:engine` (267 tests, includes 30 scenario unit tests, 8 new)                 | 0                                                                                                                |
| `pnpm test:plans` (58), `pnpm test:catalog` (72)                                       | 0                                                                                                                |
| `pnpm test:backend` (71, includes the new plan test and tile-extension test)           | 0                                                                                                                |
| `pnpm test:api-docs` (23, glossary coverage of the new codes and the OpenAPI document) | 0                                                                                                                |
| `pnpm test:unit` (30), `pnpm test:integration` (10)                                    | 0                                                                                                                |
| `node tooling/performance/rotation-profile.mjs 0.11.0`                                 | the futures case hashes to `04a37222…`, the same golden hash as P8: the stored policy's output is byte-identical |
| same, with `--near` (live policy and near-term series)                                 | 4.02 s against 3.93 s, hash `476757ef…` (differs, as it must: new keys)                                          |

What the new tests prove:

- **Same bytes without near-term data:** results under the stored policy have no
  `nearTerm` key anywhere. Results under the live policy with no near-term series
  equal those, apart from the policy echo and the added `nearTerm` block. With
  near-term series, everything but the new keys and the extra unit ids is still
  identical, including `futureClimate.worlds`.
- **Method:** the near-term baseline equals the mid-century baseline per model;
  change is future minus baseline; a what-if moves the near-term worlds and not
  the baseline.
- **Degrading:** no near-term units, some missing, no mid-century at all, one
  world with missing values and all worlds with missing values each give the
  right reason and never a filled-in number.
- **Tile extension on real PostgreSQL:** a ready tile of 16 units is extended with
  a window of 12 units; only the 12 are fetched, the old row is unchanged, the new
  row reaches `ready` at 28 of 28, a repeat does nothing, and old and new series
  load together.
- **Plan flow on real PostgreSQL:** with near-term series a plan completes with
  `nearTerm.status = compared`, both unit sets pinned and listed in the result and
  the stored versions holding the near-term policy. With none, mid-century is
  compared, `nearTerm` says `NEAR_TERM_TILE_NOT_PREPARED`, and a tile row and one
  job appear under the live policy's key.

## Not verified

- **No real NASA near-term data has been run through the engine.** Only file
  existence was probed (five URLs, three answered 200 and one 404 as expected; one
  timed out once and answered 200 on retry). Series in tests are invented.
- The normalizer was not run on real 2026-2040 files. It checks year, calendar,
  variable and cell against the identity, and the files have the same layout as
  the 2041-2065 ones recorded on 2026-10-17, but this is unproven until the first
  tile is extended.
- **Download time** is an estimate: 600 units per tile at the measured pace of
  about 72 minutes per 1,500 units is about 29 minutes a tile, so about 44 hours
  for 91 tiles with the cap of 4 concurrent requests.
- `pnpm test:container`, `test:e2e`, `test:recovery`, `test:weather`,
  `test:operations`, `test:climate`, `test:clean`, the web build and GitHub's
  `pnpm verify` were not run.
- The engine is about 2% slower on the futures case (4.02 s against 3.93 s on
  synthetic weather, one run each, loaded Mac). A whole-catalog request's cost
  with near-term data was not measured separately.
- Glossary text is machine-written and unreviewed. `GLOSSARY_VERSION` stays
  `glossary-1` because only entries were added; bump it if any client caches by
  version.

## Things to know

- A plan pinned to the old policy that needs a tile prepared sends a job with the
  old policy key; the worker (now on the live policy) skips it as stale, so that
  plan finishes "not prepared" as before and the tile is asked for again by the
  next plan under the live policy. Only plans in flight at deployment are affected.
- Tile rows for the live key are new: after the extension each tile has two rows
  (old key `ready`, live key `ready`). Count by key, not by status alone.
- Interpretation for the interface: the near-term period is a model projection of
  the next 15 years under two emissions paths, with a ten-year window, so it is
  noisier than mid-century (the minimum of 8 analogs and the window are in the
  result). It is never a forecast of any season.

## Starting the extra download (after this branch is merged)

The running container uses the old image and policy and is not affected until it
is rebuilt. Rebuilding replaces that one container: the loop starts again, stored
units are skipped, and only the new years are fetched. Recommended: wait until the
current pass has every tile ready, so mid-century finishes first. Check:

```bash
docker exec rotavise-dev-postgres-1 psql -U rotavise -d rotavise -c "SELECT left(policy_key,8) AS policy, status, count(*) FROM climate_scenario_tiles GROUP BY 1,2 ORDER BY 1,2;"
```

When the old key shows no `preparing` or `requested` rows (all `ready`), from the
repository root after the merge:

```bash
docker compose -f infra/science/download.compose.yaml up -d --build
```

It then walks every tile, asks for the live policy's row and fetches only the 600
near-term units per tile. Run the same SELECT to follow it: a second `policy`
group fills up. To try one tile first (Tadla, about 30 minutes, writes to the `rotavise`
application database): `pnpm climate:prepare 32.5 -6.5`. Do not raise the fetch concurrency:
the code caps it at 4 on purpose.

## Proposed DECISIONS text

Already appended to `docs/DECISIONS.md` as "Near-term climate period beside
mid-century (2026-11-09)".

## Proposed PROGRESS text

Near-term climate period (P10, 2026-11-09): the format 2 engine reports SSP2-4.5
and SSP5-8.5 rotations starting 2026-2035 beside mid-century (`futureClimate.nearTerm`,
`future.nearTerm`), labelled not a forecast, with the same per-model baseline
method. The live policy adds SSP 2026-2040 (600 units per tile); finished tiles stay
valid and only those years are fetched. Results under the older policy are
byte-identical. Verified on synthetic series and disposable PostgreSQL; the extra
download and the engine on real near-term data have not run.
