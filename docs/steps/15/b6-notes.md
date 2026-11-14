# B6 — one application database and real-climate verification

User-authorized backend, tooling, infrastructure, tests and documentation task,
verified on 2026-11-12. All work remains **uncommitted and unpushed**. No files
under `apps/web`, calculation-domain code, existing catalog release files or
the dependency lock were changed. The user's `.env` was not inspected,
printed or edited. Database connections consume it through the existing config
loader; no database URL or bearer credential is recorded here.

The consolidated `rotavise` database and backend checks are verified below.
B6 does **not** establish unrestricted production readiness: nightly scheduling
could not be activated in this session, crop-name language gaps remain in the
immutable source catalog, and regional guidance limitations remain visible.
User review and milestone approval are outstanding.

## Prerequisite and protected sources

Before B6 implementation, `pnpm climate:status` exited 0 and reported
53,400/53,400 near-term units, 89 ready tile positions and download log
`2026-11-11T19:44:10Z pass finished`. A read-only grouped query confirmed
exactly 600 near-term units at every position. The final command also passed.
The resumed check on 2026-11-12 passed with the same counts and the later
download log `2026-11-12T04:49:33Z pass finished`.

`rotavise_dev` and `rotavise_live` remain named read-only source backups in
`rotavise-dev-postgres-1`. Source pools and dump/hash sessions use PostgreSQL
`default_transaction_read_only=on`; no source UPDATE, DELETE, TRUNCATE, DROP,
migration or import was issued. All executable defaults now select
`rotavise`; retained old names identify the copy sources or dated evidence.
Physical container/volume names remain unchanged to preserve the backup volume.
The existing external API/worker/download processes were not restarted.

## Consolidation and exact evidence

`pnpm db:consolidate` creates only the literal new `rotavise` target, checks
that the configured server is the selected container's PostgreSQL cluster,
runs the application and queue migrations, and imports every canonical release
through the project's CatalogStore. An existing target is refused with exit 1;
`--replace-new` is an explicit destructive opt-in limited to `rotavise`.
`--verify-only` uses read-only pools and prints counts and checksums, catalog
hashes, demo comparisons, real reads and protection-trigger status.
The initial consolidation shell was interrupted and its final exit status was
lost. The final read-only verification exited 0; the completed database was not
destructively rebuilt to recover that historical status.

Climate units and tile state rows use exact typed PostgreSQL COPY. GRACE comes
once from the development backup; the duplicate live-backup GRACE is omitted.
GEDI comes from the live backup. Each table import is transactional. Final
verification matched binary COPY SHA-256 and counts for every copied table;
[consolidation.json](../../evidence/live/2026-11-12-b6/consolidation.json)
contains the complete table, release and trigger ledger. A climate series was
read through ScenarioStore.series, which re-normalizes and re-hashes its raw
bytes; real GRACE and GEDI sample values are in that report.

Original northern imports covered 26–37 N, 14 W–0 E. Re-extraction from the
original NASA netCDF/TIFF files extends `rotavise` to 20–37 N, 18 W–0 E.
Original copied rows, IDs, hashes and import timestamps are retained. Additional
source rows give 313,344 GRACE month rows (1,224 cells × 256 months) and
2,072,354 GEDI cells. GEDI's window rounding was corrected to include the eastern
edge; two latitude bands respect its existing per-file limit. The source-file
hashes and independently generated per-degree content expectations are in
`data-expectations.ts`; the gate compares them with stored source-identified
rows. Provider no-data cells remain unavailable.

The demo copy uses a **fresh guest owner**, FieldStore-created field and the
project's ExtractionStore importer. No account ID, token hash or old credential
was copied. The field profile and boundary match; the original history has zero
entries and soil/water are unknown. Three original extraction IDs/results and
four original raw files match, including exact microsecond UTC timestamps.
Source times are passed as validated UTC strings to avoid JavaScript Date
rounding. The historical ECOSTRESS policy-1 result is preserved; today's QA
normalizer has a different replay hash, so it is not substituted for history.
Terrain and MODIS replay agree. The private seven-day guest credential is in
`.artifacts/b6/demo-session.json` (mode 600), excluded from evidence and git.
Normal expiry/retention applies; production correctness is independent of it.

## Completeness and database operation

`pnpm db:check-complete`, local/production `pnpm ops:status`, capabilities
and readiness share DataCompletenessService. Both `/health/ready` and
`/api/v1/health/ready` return 503 for missing data or failed dependencies.
Production startup logs structured `DATABASE_INCOMPLETE` with dataset names.
The at-most-60-second cache deduplicates concurrent checks; on failure the gate
returns an incomplete database result. The verified read path still checks raw
climate bytes. Real PostgreSQL tests prove incomplete readiness/capabilities,
production startup logging, and detection of missing indexes/disabled triggers.
The real-data harness verifies both successful readiness aliases as well.

Final gate: **31 migration hashes, 15 canonical catalog hashes, 17 enabled
protection triggers, 38 valid required indexes, 153 validated constraints**,
autovacuum enabled, 89/89 positions for both policies (1,500 and 2,100 units per
position), every experiment/year with its 20 distinct model/variable identities,
and full valid-cell GRACE/GEDI source grids. Total climate units: historical
44,500 (1985–2009), SSP2-4.5 71,200 and SSP5-8.5 71,200 (2026–2065). Near-term
2026–2040 contributes 600 per position. All 180 old tile rows survive; 178 are
the required policy/position pairs and two are preserved legacy states.

Migration 0028 adds plan/field owner list indexes, tile/year reads and latest GEDI
lookup. Existing catalog, extraction, observation and boundary indexes remain
required. Migration 0029 configures earlier reference analyze/insert-vacuum and
plan vacuum thresholds. Migration 0030 adds a stored generated strategy
projection for plan lists. Completed-result HTTP responses reuse verified frozen
serialized bytes after owner, expiry, both row-revision and evidence-link guards.
No engine calculation or original result/input hash was changed. GRACE queries
use the nearby-cell index before exact distance calculations; imports batch rows.

The [runbook](../../operations/RUNBOOK.md#database-one-source-of-truth) contains
exact creation, national extraction, verification, switching, rollback,
backup/restore and scheduling commands, plus API/worker/queue connection-pool
budgets and timeouts. The API/worker pool is eight per process, with a separate
up-to-ten pg-boss pool. It documents the configured 100-connection server ceiling
and bounded completeness scans. The production template and local examples
select `rotavise`; downloader overrides are
`ROTAVISE_DOWNLOAD_DATABASE_URL` and `ROTAVISE_CLIMATE_DATABASE`.

## Backup, restore and scheduling

Final snapshot backup: `rotavise-20261112T004348Z.dump`, SHA-256
`c101d89f9649a9415485c286ca176624fe56d9ca1b3f87eaf317857d6d9e68c2`.
Existing backup tooling uses one exported PostgreSQL snapshot for counts and dump,
mode-600 output/manifest, checksum sidecar and 14-day retention. The local national
adapter selects supported PostgreSQL `zstd:3`; generic default `gzip:6` is
unchanged. This final backup includes the repaired microsecond metadata.

`pnpm ops:backup --local-database --restore-drill` exited 0. It restored into
a disposable PostgreSQL container, matched **47 tables / 2,572,842 rows**,
replayed all 31 migrations without a change, verified all 15 catalog hashes and
three extraction result hashes, checked protections and passed national
completeness. The disposable container was removed. The final post-test count is
one quota row lower after ordinary quota expiry; the snapshot manifest remains the exact
backup-time state. See
[restore-drill.json](../../evidence/live/2026-11-12-b6/restore-drill.json) and
[backup-manifest.json](../../evidence/live/2026-11-12-b6/backup-manifest.json).
The earlier November 11 backup remains a valid restored historical snapshot.

**Scheduling is not activated.** The 02:30 launchd plist passed `plutil -lint`
(exit 0), but `pnpm ops:schedule install` exited 1 because
`launchctl bootstrap gui/501` returned exit 5, `Input/output error`.
Attempts using /private/tmp and the user domain were also rejected. The generated
artifact is `.artifacts/b6/LaunchAgents/local.rotavise-database.backup.plist`.
The retry at 05:01 UTC returned the same launchd exit 5. Its plist again passed
`plutil -lint` with exit 0. The current launchd service lookup returned exit 113
because the job is absent. The final error is saved in `schedule.json`.
No scheduled-job claim or timed-run claim is made. The runbook gives installation
from an unrestricted Terminal in a long-lived checkout. This remaining platform
step prevents claiming the scheduled-backup requirement is finished.

## Real-climate whole-backend run

`pnpm test:backend-e2e-real-climate` uses `rotavise` through a temporary
non-superuser role. Database privileges prevent writes to shared catalog,
climate, GRACE and GEDI tables. It creates its own guest owners and a unique test
account, exercises the real API, worker, queues and engine, and removes its own
fields/plans/extractions/weather links/auth data/quotas/jobs and role in finally.
The final database has 0 remaining private B6 roles.
No shared reference table is truncated. NASA AppEEARS transport replays original
NASA CSV bytes; POWER calls are live. Remote multi-hour jobs and real Earthdata
credentials are not used. Soil, farmer priorities/history and planning dates are
explicit test fixtures, not measured farm inputs. Science-service integration
is outside this run.

Tadla without and with `what_if` both complete with futureClimate and nearTerm
**compared**, both period blocks and the exact ten model/experiment worlds
(five models × SSP2-4.5/SSP5-8.5), each world compared. The parent hash remains
unchanged. The run also verifies catalog detail, fields/boundary, original
extractions and analyses, guest ownership, account signup/verification, claiming,
listing, deletion and the intake workflow. Regional location-only plans require
correct IDs and ranked applicable crops:

| Point       | Resolved region IDs                    | Schedulable | Crops in ranked rotations                         | Crops using national-only planting/cycle guidance | Not applicable | Future / near-term        |
| ----------- | -------------------------------------- | ----------: | ------------------------------------------------- | ------------------------------------------------: | -------------: | ------------------------- |
| Souss-Massa | ma-souss-massa, morocco-general        |         165 | amaranth, berseem, arugula, chard, cowpea, endive |                                               165 |              5 | unavailable / unavailable |
| Gharb       | ma-rabat-sale-kenitra, morocco-general |         169 | amaranth, berseem, arugula, chard, cowpea, endive |                                               167 |              1 | unavailable / unavailable |
| Oriental    | ma-oriental, morocco-general           |         166 | amaranth, berseem, arugula, chard, cowpea, endive |                                               165 |              4 | unavailable / unavailable |

- Souss-Massa: mid-century `CLIMATE_NOT_COMPARED`; near-term `CLIMATE_NOT_COMPARED`; outcome `comparisons_available`.
- Gharb: mid-century `CLIMATE_NOT_COMPARED`; near-term `CLIMATE_NOT_COMPARED`; outcome `comparisons_available`.
- Oriental: mid-century `CLIMATE_NOT_COMPARED`; near-term `CLIMATE_NOT_COMPARED`; outcome `comparisons_available`.

Complete per-crop national-only metrics, not-applicable IDs, unsupported crops,
other evidence gaps, top rotations and future-world reasons are retained in
[backend-after.json](../../evidence/live/2026-11-12-b6/backend-after.json).
All three unrestricted regional runs returned the same six ranked crop IDs
(amaranth, berseem, arugula, chard, cowpea and endive). Each had 75 profiles
unsupported by the rotation planner. All three future/near-term blocks returned
`CLIMATE_NOT_COMPARED`, despite complete stored tiles: the engine could not form
a complete baseline climate comparison for every finalist. This is a poor
regional climate-comparison outcome, not proof that arbitrary regions are ready
for reliable recommendations. Many schedulable crops use national guidance
rather than region-specific agronomy. Region resolution and ranking do not
establish field validation or recommendation quality; the report preserves each
poor/unavailable outcome.

## Performance and B5 comparison

Forty warm reads per endpoint, measured through full body download with contract
validation outside timing; each finished result hash is checked. Before is the
initial B6 real-climate development run; after is the final real-climate run.
Both include all real scenario evidence; B5 had no future-climate store.

| Read              | Initial B6 p95 ms | Final B6 p95 ms |
| ----------------- | ----------------: | --------------: |
| plansList         |             48.28 |            5.39 |
| largePlan         |            106.97 |           32.98 |
| cropDetail        |             13.37 |            3.47 |
| catalogOptions    |             18.40 |            3.81 |
| glossary          |              3.07 |            1.87 |
| fieldList         |              5.68 |            3.22 |
| boundary          |              6.51 |            3.89 |
| vegetationHistory |             11.39 |            9.81 |
| vegetation        |              5.77 |            2.99 |
| rain              |              9.58 |            3.08 |
| grace             |             66.65 |            5.30 |
| gedi              |              7.08 |            3.86 |

Final result size: 4,933,109 bytes.
B5 finished-result p95 was 32.72 ms / 4,647,010 bytes; B6's larger real-climate
result is 32.98 ms. Plan list B5 p95 was 9.75 ms;
B6 is 5.39 ms. Intake uses the same 45 format-1
submissions across three guests: 2.98 s,
15.13 plans/s (B5: 2.872 s, 15.67/s;
initial B6: 3.080 s, 14.61/s). This is intake throughput, not full-engine throughput.
The measured endpoint budgets pass without suppressing failures.

Real engine timings, in run order (Tadla, what-if, Souss-Massa, Gharb, Oriental):
15.17, 16.44, 5.82, 6.67, 5.21 seconds.
The initial Tadla/what-if B6 timings were 30.46/33.93 seconds. Comparing these
with B5's synthetic no-futures 4.981/4.746 seconds would mix different workloads.
The identical-input B5 benchmark passed its unchanged 6-second bound at
05:01 UTC. Suggest took **5.949 s** and declared took **4.936 s**, with 168
schedulable crops and both fixed B5 result hashes matching. Earlier attempts
exited 1 at 8.58/6.51 s and 6.94/7.82 s. After the longer idle interval, load
averages fell from 4.59/6.66/8.13 to 3.40/3.92/3.66. This supports host load as
a contributor, though its precise effect has not been isolated. The suggest
case has little timing margin on this host.

The CPU profile shows search, climate calculation, catalog hashing and garbage
collection. Process inventory was denied by the sandbox with exit 127.
`pmset` recorded no thermal/performance warning and low-power mode was off.
Only CPU-time diagnostics were added to the benchmark. Domain logic, timing
bounds, inputs and golden assertions retain their original definitions. The
failed readings remain in `engine-before-recheck.json`,
`engine-second-failure.json` and `engine-profile.json`. The final passed reading
is in `engine.json`. Real-future performance and the identical-input B5
benchmark were both measured and recorded with their actual exit codes.

## Final database contents

[database.json](../../evidence/live/2026-11-12-b6/database.json) records final
counts after test cleanup, climate years, catalog hashes and completeness.
Application/reference table rows:

| Table                          |      Rows |
| ------------------------------ | --------: |
| drizzle.__drizzle_migrations   |        31 |
| pgboss.bam                     |         0 |
| pgboss.job                     |         0 |
| pgboss.job_common              |         0 |
| pgboss.job_dependency          |         0 |
| pgboss.queue                   |         6 |
| pgboss.queue_stats             |         0 |
| pgboss.queue_stats_20261111    |         0 |
| pgboss.queue_stats_20261112    |         0 |
| pgboss.schedule                |         0 |
| pgboss.subscription            |         0 |
| pgboss.version                 |         1 |
| pgboss.warning                 |         0 |
| public.auth_accounts           |         0 |
| public.auth_mail               |         0 |
| public.auth_rate_limits        |         0 |
| public.auth_sessions           |         0 |
| public.auth_users              |         0 |
| public.auth_verifications      |         0 |
| public.boundary_candidates     |         0 |
| public.boundary_datasets       |         0 |
| public.catalog_versions        |        15 |
| public.climate_scenario_tiles  |       180 |
| public.climate_scenario_units  |   186,900 |
| public.field_boundaries        |         1 |
| public.field_crop_history      |         0 |
| public.field_extraction_files  |         4 |
| public.field_extractions       |         3 |
| public.field_observation_files |         0 |
| public.field_observations      |         0 |
| public.fields                  |         1 |
| public.job_run_results         |         0 |
| public.job_runs                |         0 |
| public.plan_claims             |         0 |
| public.plan_intake_results     |         0 |
| public.plan_owners             |         1 |
| public.plan_quotas             |         0 |
| public.plan_requests           |         0 |
| public.planning_runs           |         0 |
| public.planning_scenario_units |         0 |
| public.planning_weather        |         0 |
| public.rain_references         |         0 |
| public.regional_gedi_biomass   | 2,072,354 |
| public.regional_water_storage  |   313,344 |
| public.soil_estimates          |         0 |
| public.weather_cache           |         0 |
| public.weather_snapshots       |         0 |

Every original release is present with its own rules, issues, benefits,
references and names. Historical releases retain their historical crop counts;
rewriting them to 246 would invalidate their content hashes. Releases 0.11.0
through 0.15.0 each contain all 246 profiles; latest/default is 0.15.0.

| Release | Profiles |
| ------- | -------: |
| 0.1.0   |        3 |
| 0.2.0   |        3 |
| 0.3.0   |       10 |
| 0.4.0   |       10 |
| 0.5.0   |       10 |
| 0.6.0   |       10 |
| 0.7.0   |       15 |
| 0.8.0   |       24 |
| 0.9.0   |       33 |
| 0.10.0  |      207 |
| 0.11.0  |      246 |
| 0.12.0  |      246 |
| 0.13.0  |      246 |
| 0.14.0  |      246 |
| 0.15.0  |      246 |

Nationwide reference data: immutable releases, prepared climate positions and
all valid GRACE/GEDI source cells in the stated Morocco box. Demo only: one
Tadla profile/boundary, three completed extractions and four raw files. User
fields, plans, observations, extractions and accounts are runtime data. HLS,
SMAP and GPM have no preloaded demo observation; FTW boundary suggestions have
no country import; Giovanni daily baseline is absent and POWER fallback stays
honest. No invented rows fill any gap.

**The four-language crop-name requirement is not fulfilled by the source
release.** There are 246 French, 246 Standard Arabic and
178 Darija-labelled local names, but 68 crops lack a Darija name;
0 local names are explicitly labelled English. All 246 primary display names
are retained with their original identity and recall metadata. The glossary has
all four languages, with its
existing unreviewed-translation disclosure. Translation/agronomic verification
requires a separately reviewed catalog release; existing hashes remain valid.
Completeness here means the declared immutable reference releases and data grid,
not proof that every crop has every desired fact or a provider value at every
possible point.

## Commands, exit codes and failures corrected

All commands below used real exit codes, with no check output piped into tail.
Commands needing existing local settings used
`ROTAVISE_CONFIG_ENV_FILE=/Users/houdaifadrahm/projects/rotavise_project/.env`.
The complete timestamped success/failure ledger is
[commands.json](../../evidence/live/2026-11-12-b6/commands.json).

| Final command                                                                                                                                     | Exit | Finished UTC             |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ------------------------ |
| `pnpm lint`                                                                                                                                       |    0 | 2026-11-12T01:07:07.389Z |
| `pnpm format:check`                                                                                                                               |    0 | 2026-11-12T05:03:30.622Z |
| `pnpm typecheck`                                                                                                                                  |    0 | 2026-11-12T01:07:48.295Z |
| `pnpm test:backend`                                                                                                                               |    0 | 2026-11-12T00:33:23.481Z |
| `pnpm test:plans`                                                                                                                                 |    0 | 2026-11-12T00:34:21.623Z |
| `pnpm test:catalog`                                                                                                                               |    0 | 2026-11-12T00:36:41.357Z |
| `pnpm test:engine`                                                                                                                                |    0 | 2026-11-12T00:42:30.698Z |
| `pnpm test:api-docs`                                                                                                                              |    0 | 2026-11-12T00:44:12.453Z |
| `pnpm test:unit`                                                                                                                                  |    0 | 2026-11-12T00:44:33.035Z |
| `pnpm test:container`                                                                                                                             |    0 | 2026-11-12T00:48:02.216Z |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain-integration` |    0 | 2026-11-12T00:44:39.212Z |
| `pnpm test:operations`                                                                                                                            |    0 | 2026-11-12T00:52:39.280Z |
| `pnpm db:consolidate --verify-only`                                                                                                               |    0 | 2026-11-12T00:55:54.601Z |
| `pnpm db:check-complete`                                                                                                                          |    0 | 2026-11-12T01:03:02.712Z |
| `pnpm ops:status --local-database`                                                                                                                |    0 | 2026-11-12T01:03:07.378Z |
| `pnpm climate:status`                                                                                                                             |    0 | 2026-11-12T00:50:31.238Z |
| `pnpm ops:backup --local-database --restore-drill`                                                                                                |    0 | 2026-11-12T00:51:13.804Z |
| `pnpm test:backend-e2e-real-climate`                                                                                                              |    0 | 2026-11-12T01:01:47.982Z |
| `node tooling/performance/backend-engine-benchmark.mjs`                                                                                           |    0 | 2026-11-12T05:01:19.275Z |
| `pnpm ops:schedule install`                                                                                                                       |    1 | 2026-11-12T05:01:16.393Z |

Required tests: backend 92/8 suites, plans 62/3, catalog 114/6, engine 287/8,
API docs 29/3, unit 35/2, terrain integration 13/1. Container verification passed.
Additional operations verification passed 24 tests/2 suites. Focused completeness
integration passed two tests. Engine standalone command and final whitespace/
protected-path checks are recorded alongside the final evidence.

Development failures were retained and their causes fixed: exact-optional types,
unused import, whole-box GEDI file limit (split bands), PostgreSQL 63-byte
constraint names, structured-log sanitization, root readiness OpenAPI aliases,
and extraction microseconds lost through Date. A backend run lost dist modules
when another build overlapped; serialized rerun passed. An operations test saw
the intentionally running national restore container and failed its global
cleanup assertion; rerun after the drill passed. The initial real-climate run
failed an overly strong Oriental future comparison assertion; regional runs
now report scientific unavailability, while Tadla still fails unless both
real periods and all ten worlds compare. No failed run is presented as passing.
The existing-target refusal remains an intentional nonzero safety check.

## Switching and review

The user must edit just `DATABASE_URL` in their editor, changing the final
name to `/rotavise` while preserving all credentials/host/query settings,
then restart their API and worker and verify readiness/capabilities. This was
not done in the sandbox. Use the exact runbook commands for downloader switch,
backup, recovery and schedule activation. The source backups remain read only.
Review the changes and the explicitly open scheduling/language/regional limits
before treating the backend as ready for production or approving a next step.

## Proposed DECISIONS text

> B6: use `rotavise` as the sole application database; retain the old named
> databases only as read-only copy backups. Import canonical immutable releases
> with original hashes and exact raw climate/reference evidence. Gate readiness
> and operations on migrations, releases, protection/schema objects, both climate
> policies and independently expected national GRACE/GEDI valid-cell coverage.
> Expose incomplete datasets and log incomplete production starts. Keep the demo
> optional and guest-owned. Preserve historical extraction policies and exact
> UTC metadata. Use reviewed indexes, bounded pools/timeouts and earlier vacuum/
> analyze settings; verify backups through disposable restores. A passed gate
> does not certify missing crop facts, name translations or field-level quality.

## Proposed PROGRESS text

> B6 backend consolidation and real-climate verification are implemented and
> locally verified, uncommitted/unpushed and pending review. `rotavise` holds
> all 15 canonical releases, all 186,900 climate units across 89 positions,
> national valid-cell GRACE/GEDI and an optional fresh guest Tadla demo. Required
> suites, real-climate Tadla/what-if/regional checks and final backup restore
> passed; detailed evidence is in b6-notes.md. Open: user database switch,
> OS-rejected scheduled-backup activation/timed run, incomplete source name
> translations and the recorded regional/scientific data limits. Do not claim
> unrestricted production readiness or record milestone approval.
