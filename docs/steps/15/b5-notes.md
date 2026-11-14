# B5 — default catalog 0.15.0, complete backend test and speed

User-authorized backend/tooling/infra/docs/tests task, 2026-11-10. Work is
uncommitted and unpushed. No frontend work, merge, deployment, production-data
change or milestone approval. Existing release files, migrations, dependency
lock and `packages/domain` are unchanged. Proposed DECISIONS/PROGRESS text is
at the end for the reviewer; it has not been applied to those files.

## Implemented and verified behavior

Crop detail retains its existing `benefits` reference-fact array. Releases
0.14.0 and 0.15.0 additionally return `research`, containing the original
income facts/options/gaps and benefit findings/records/gaps without rewriting
their provenance. `benefitEffects` covers all 12 effects, selects sourced before
recall before not-applicable, and links the selected finding IDs. Status is
`sourced`, `model_recall`, `not_applicable` or `no_data`. Recorded recall
confidence is retained; sourced confidence is **null when unrecorded**, never
assumed high. Quotes, citations, source hashes, conditions and local/non-local
scope remain available in the original records. `incomeFields` explicitly says
`sourced` or `no_data` for prices, yields, costs and margins; it does not infer a
missing value from another kind. Historical research metadata IDs are preserved;
typed citations resolve through the catalog's source registry.

`research.roleExplanations` contains all four glossary roles in en/fr/ar/ary,
with the glossary version, translation-review disclosure and self-resolving
source URLs/quotes/hashes. These are general explanations, not an assertion
that this crop has all four roles. Roles are also available independently via
`GET /api/v1/glossary?lang=fr|en&group=role`. No new API codes or translations
were needed; all added selection statuses/effects already have four-language
glossary entries. The generated OpenAPI document is 1.5.0.

The crop-detail 2 MiB response bound and 32-document/8 MiB serialized cache
remain. Its ETag hashes exact bytes under the immutable catalog SHA/crop cache
identity, with store verification on every conditional request. Older-version
responses are byte-identical: aggregate golden hashes recorded from the
pre-B5 projection cover all 13 earlier releases through 0.13.0. Existing engine
hashes and the original 25 s CI speed bound are retained. Two additional full
0.15.0 result hashes are pinned in `tests/unit/rotation.test.mjs`.

`ROTATION_CATALOG_VERSION` now defaults to **0.15.0**, including the production
environment template. Earlier releases remain importable. Unversioned options
now selects the rotation catalog when full planning is enabled and the intake
catalog otherwise, matching capabilities. Versioned options remains unchanged.
Options serialization is verified once and cached by immutable SHA, bounded to
four documents/8 MiB serialized accounting and 2 MiB per response. Every read
still verifies the store head and obeys quotas; no response is truncated.

Completed rotation reads cache a fully validated, frozen status object, bounded
to eight entries and 32 MiB of serialized accounting. Every hit queries
PostgreSQL for owner access, expiry, **both request/run row revisions (`xmin`)**
and the separately stored weather/scenario links. Renaming, claiming, deletion,
changed rows/links or database failure cannot bypass that guard. Misses retain
the existing input/versions/result integrity checks. No result/input hash,
calculation, queue policy or immutable database trigger was changed.

## Repeatable whole-backend test

```sh
pnpm test:backend-e2e
pnpm test:backend-e2e --benchmark
node tooling/performance/backend-engine-benchmark.mjs
```

The first two commands build the server, start disposable PostgreSQL 18.4 and
Mailpit, listen on free API/worker ports, and clean up their own resources.
No `.env`, real account, secret or persistent database is used by the test.
The engine benchmark requires an existing server build. All illustrative
farmer history, soil, health, priorities and boundary inputs are explicitly
labelled in `tests/support/fixtures/backend-e2e.json`; they are not an observed
farm history or measured soil test. The point/outline matches the published
P9 Tadla pilot (32.40 N, 6.55 W, approximately 0.4 ha).

The real API, production worker, contracts, queues, catalog, calculation engine,
normalizers and persistence run together. The test-only worker replaces the
AppEEARS transport with original recorded CSV bytes and removes remote polling
delays; it still executes submit/poll/download jobs and stores/verifies raw and
result hashes. It refuses a different sample grid. Terrain, ECOSTRESS policy 2
and MODIS all complete. Terrain and MODIS reproduce the saved P9 results;
MODIS's requested end date follows the current request, while its actual
observations remain exactly the recorded ones. ECOSTRESS policy 1's historical
result is preserved as a comparison artifact and is never injected as policy 2.

A read-only export from the existing local P9 `rotavise_live` database recovered
the missing original MODIS CSV, its stored extraction references, the nearest
GRACE cell's original imported months and the GEDI cells in the pilot service
bounding box. Only public NASA evidence was exported, without owners, guest
tokens or credentials. The files and their SHA-256 ledger are under
`docs/evidence/live/2026-11-10-b5/`; terrain/ECOSTRESS original bytes remain in
their existing 2026-11-09 directory. The test checks the ledger before replay.
GRACE/GEDI go through their actual import services into the disposable database.

Verified sequence: capabilities; guest session; default options and versioned
crop detail/ETag; cited fr/en roles; atomic field+boundary creation; dated
history; saved v1 soil/water/health; all three extractions; GRACE/GEDI and
analysis reads; Part 4.3 request conversion including declared rotation,
priorities, farmer context, equipment limits, market access and income weight;
real plan completion; what-if; summary list; verified account through local
SMTP; claim; ownership checks; deletion. The completed real-data plan has
**current + three alternatives**, 152 double-checked and 2,092 recalled rules,
zero expert-reviewed rules, vulnerability seasons, ten grid rows and pinned
terrain outputs. Each strategy's scores match its candidate; notes resolve in
both fr and en. Erosion remains explicitly unranked with null soil loss.

What-if checks include the parent UUID, accepted assumptions, requested versus
effective sowing dates (+7 days), rainfall/temperature changes and the
not-a-forecast flag. Parent result hash stays unchanged. Claiming the first
plan also moves all guest fields atomically; account-only field/boundary access
and guest denial are asserted. Plans are deleted with the correct owner.

The replay helper also passed a no-file probe: absent raw/reference files select
the visible-skip path without failing worker startup.

**Visible gaps:** there is no stored real 2001–2020 pilot Giovanni daily baseline
or prepared NEX-GDDP tile in the repository. The test does not manufacture them:
Giovanni's missing-data path yields the asserted `power_only` rain fallback and
future climate is asserted unavailable. The optional science service is not started; its AquaCrop/RothC integration is
not validated by this harness. HLS/SMAP/GPM extraction success is not
claimed; vegetation and rain analyses return the actual unavailable states.
Field-boundary tiles are disabled by default and are visibly skipped, with no
national FTW dataset imported. A missing replay file visibly skips its extraction;
a changed available file fails its hash assertion. The saved pilot comparison
file is required when those replay steps run.

POWER uses its real public transport, without credentials; the test obtained
36 real historical snapshots. Therefore it is **not added to `pnpm verify`**:
the successful measured run takes 88.83 s (96.82 s including build), but an external service
is not a stable offline CI dependency. No account/credential setup is needed to
run this test. Live AppEEARS/Giovanni authentication or remote processing speed
is not verified by replay; using those services directly still requires the
user's Earthdata account. Available future-model data and country FTW coverage
remain operator/data prerequisites, not fabricated test fixtures.

## Performance (this machine, 2026-11-10 UTC)

Apple M5, macOS/darwin arm64, Node v24.19.0, PostgreSQL 18.4 in Docker.
The final read run started 18:50:40 UTC with load averages 2.59/1.98/2.01.
Command: `BACKEND_E2E_REPORT=/tmp/b5-e2e-post-review.json pnpm test:backend-e2e --benchmark`.
[Before](../../evidence/live/2026-11-10-b5/backend-before.json) and
[after](../../evidence/live/2026-11-10-b5/backend-after.json) retain exact numbers,
commands and exit codes. The before run reached the measurements but its final
field-deletion assertion failed because claim had correctly transferred the
field; this does not turn that incomplete run into a passed backend test.

Each endpoint has 40 sequential warm measurements through full body download
and JSON decoding; contract validation is outside timing. Quotas are reset only
in the disposable benchmark database, not changed in production. No compression
or result truncation is used. This differs from P8's header-only timing and its
small intake status read; P8 did not time a completed multi-megabyte result.
Cold reads still perform full verification and are not represented by these
warm percentiles.

| Read / workload                                           | p50 ms | p95 ms |
| --------------------------------------------------------- | -----: | -----: |
| Plans list with summaries                                 |   8.12 |   9.75 |
| Finished plan, 4,647,010 bytes                            |  29.19 |  32.72 |
| Crop detail, faba bean, 188,345 bytes                     |   3.32 |   4.49 |
| Catalog options, 246 crops, 261,158 bytes                 |   4.42 |   5.41 |
| French glossary                                           |   1.99 |   2.12 |
| Fields list                                               |   3.61 |   5.24 |
| Saved field boundary                                      |   4.05 |   4.93 |
| Fields list + their boundaries (two calls for this pilot) |   6.53 |   7.30 |
| MODIS vegetation history (populated)                      |   7.71 |  10.95 |
| Vegetation analysis (honest unavailable)                  |   2.97 |   3.47 |
| Rain analysis (honest unavailable)                        |   3.09 |   3.86 |
| GRACE regional read (populated)                           |   5.22 |   7.21 |
| GEDI regional read (populated)                            |   4.15 |   5.17 |

Large-result p95 fell **171.77 → 32.72 ms** with identical stored result hashes
on each repeated read. Options p95 fell **8.50 → 5.41 ms** after serialization
caching. All measured read budgets pass; `--benchmark` asserts <150 ms p95 for
the finished plan and <100 ms for the other endpoint reads. Intake: **45 plans
in 2.872 s, 15.67 plans/s**, compared with P8's 15.2 plans/s. This is the same
intake-only format 1 workload as P8, served by a separate API configuration and
the actual eight intake workers; it is not full-plan throughput. A full planning
queue measurement initially labelled intake was identified and corrected; the
queue concurrency itself did not change.

Engine benchmark: `node tooling/performance/backend-engine-benchmark.mjs`,
real 0.15.0 catalog and current engine 7 / benefits-2 policy, **synthetic weather
explicitly sourced from the existing test helper**, not presented as NASA data.
Final readings at 18:54:52 UTC: whole-catalog suggest **4.981 s**, declared rotation **4.746 s**,
168 schedulable crops ([exact engine record](../../evidence/live/2026-11-10-b5/engine.json)). Initial readings were 4.982 / 4.817 s. Both final cases are below 6 s; the standalone benchmark exits nonzero
above that bound. The P8 0.11.0 golden hashes are unchanged. The new full-result
0.15.0 hashes are:

- Suggest: `9bb8becab13d0a4a4b72859aa79a0b7091042fec37fafb47c7ced7d1ac13ce9e`
- Declared: `c1114a23a427f0a467a87f53d43173def5f71fa997c0ca90afbdf6d08db935b6`

The current release adds substantial research/output bytes, so its absolute
engine time is not the same workload as P8's 0.11.0 result. No engine scoring,
math, ordering or bound was changed to obtain these times. Results include
source identifiers and operational snapshot UUIDs; new disposable runs naturally
have different whole-plan hashes. Hash equivalence is asserted within each
accepted run, and fixed engine-input hashes are compared across code changes.

## Master-plan differences and exact corrections

Only the incorrect lines in `FRONTEND_MASTER_PLAN.md` are corrected; no frontend
scope or new milestone is authorized.

| Location                  | Actual API / correction                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening inventory         | Generated OpenAPI has 39 paths / 82 components, not 34 / 64.                                                                                                                     |
| Part 1 C20                | Glossary is 382 entries in nine groups, including four roles and 38 satellite terms.                                                                                             |
| Part 4.2 options          | Unversioned selection now matches capabilities: rotation when planning enabled, intake otherwise. Versioned naming reads remain available.                                       |
| Part 4.2 what-if          | Request body is `{what_if:{...}}`; new status/list exposes `parentPlanId`. Compare the two result objects; there is no separate literal before/after envelope.                   |
| Part 4.3 water            | Broken Markdown split at `season                                                                                                                                                 | year` repaired; allocation is null for a saved v1 field unless entered separately at plan level. |
| Part 4.3 farmer context   | Broken pipe-separated row repaired; all four fields are required when the object is present.                                                                                     |
| Part 5 BG-1/2/3/10/14     | Already implemented by B0; missing-feature descriptions corrected, including the field-boundaries capability.                                                                    |
| Part 5 BG-4/5             | Crop detail is implemented; 0.14/0.15 research now exposed. Issues are embedded, host-scoped, and use disease/pest/parasitic_plant/weed, not invented deficiency/disorder kinds. |
| Part 5 BG-7               | First plan claim already moves every guest field. Independent field/bulk claim endpoint remains absent.                                                                          |
| Part 5 BG-9               | Historical sourced income/benefits are wired; current/local data gaps remain, with no invented income.                                                                           |
| Part 5 BG-13 / 5.1 update | B2r serves optional precomputed suggestions with 200/404, no detector, 202 work or automatic fallback. Older proposal text remains historical and is explicitly superseded.      |

Options has **no issues array**; use host-scoped crop detail. Language-labelled
crop-name coverage is en **0**, fr **246**, ar **246**, ary **178**. Primary names
have no recorded language and are not relabelled English. Darija is absent for
68 crops. This test verifies those honest gaps instead of inventing names;
identity/name gap fields remain available in detail. The glossary's fr/en roles
are complete but machine-written/translated and not human reviewed. Field lists
contain profiles; the map still retrieves each boundary separately, as the
master plan already specifies. No field-profile v2, detector, demo session,
export, operation vocabulary or frontend implementation was added.

## Commands and exit codes

All commands below ran on **2026-11-10 UTC**, using actual process exit codes.
Full temporary logs are named in the durable [check record](../../evidence/live/2026-11-10-b5/checks.json).
The post-review typecheck, backend, backend-e2e and production-container reruns
include the concurrent-publication correction. No check was piped into `tail`.

| Command                                                                                                                                           | Final exit | Result                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------ |
| `pnpm openapi:generate`                                                                                                                           |          0 | OpenAPI 1.5.0, current document                                                                  |
| `pnpm lint`                                                                                                                                       |          0 | Passed after final cache/test edits                                                              |
| `pnpm format:check`                                                                                                                               |          0 | Passed with final report and evidence                                                            |
| `pnpm typecheck`                                                                                                                                  |          0 | All workspace packages, rerun after final cache fix                                              |
| `pnpm test:backend`                                                                                                                               |          0 | 90 tests / 7 suites, rerun after concurrency regression fix                                      |
| `pnpm test:plans`                                                                                                                                 |          0 | 62 tests / 3 suites                                                                              |
| `pnpm test:catalog`                                                                                                                               |          0 | 114 tests / 6 suites; all prior-response and research assertions                                 |
| `pnpm test:engine`                                                                                                                                |          0 | 287 tests / 8 suites; all old and new golden hashes and bounds                                   |
| `pnpm test:api-docs`                                                                                                                              |          0 | 29 tests / 3 suites; live routes, glossary and generated equality                                |
| `pnpm test:unit`                                                                                                                                  |          0 | 35 tests / 2 suites                                                                              |
| `BUILDX_CONFIG=/tmp/rotavise-b5-buildx pnpm test:container`                                                                                       |          0 | Final production image; all 15 release imports and idempotent replay, ten printed runtime checks |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain-integration` |          0 | 13 real-PostgreSQL tests                                                                         |
| `pnpm test:backend-e2e --benchmark`                                                                                                               |          0 | Final whole backend + measured budgets; 88.83 s excluding build                                  |
| `node tooling/performance/backend-engine-benchmark.mjs`                                                                                           |          0 | Both cases <6 s, fixed result hashes unchanged                                                   |
| Focused `rotation-integration` result/policy cases                                                                                                |          0 | Two cases, including the controlled eight-miss regression; subsequent full backend also passes   |
| No-file replay helper probe / `node --check tooling/verification/backend-e2e.mjs`                                                                 |          0 | Available files accepted; absent raw/reference files skip without worker failure; syntax valid   |
| `git diff --check` / protected-path baseline                                                                                                      |          0 | No whitespace errors; protected source/release paths unchanged                                   |

The required Jest commands total **617 passed tests**, plus **13 terrain tests**.
Focused retries are not counted again. There are no disabled tests. The test-name
filter used during race diagnosis skipped unrelated cases only in that focused
command; the final full backend suite ran all 90 tests. Final lint/format and
protected-path checks also passed; their exit codes are in the linked record.

## Failures inspected and corrected

- Initial catalog Jest command: exit 1, one source-resolution assertion. Nested
  original research metadata has external research IDs, distinct from the typed
  catalog citations. The assertion now checks typed citation discriminants (`interpretation` or `quoteCheck`) (standalone
  role citations resolve through their own URLs); no source fact was changed.
- Development backend-e2e runs: exits 1 for missing test-only observation
  credentials; comparing MODIS's newly requested end date to P9's old end date;
  deleting a field as a guest after claim transferred it; and expecting `POWER`
  instead of the contract's `power_only`. Each assumption/configuration was
  corrected, while real observations and production contracts were preserved.
- The existing poll helper swallowed assertion failures and retried at 100 ms,
  exhausting HTTP quotas. The new test uses its own one-second poll that fails
  immediately on invalid responses; its intake timer samples at 100 ms. No
  production limit was raised or bypassed in the functional flow.
- A subsequent catalog run exited 1 for a missing `readFileSync` import in the
  new golden-hash check; the import was added. A focused rerun then identified
  original supporting-quote metadata with locators in its own source namespace;
  typed citation discriminants now distinguish it precisely. Earlier hashes
  were not changed.
- Initial lint: exit 1 for unused destructured properties in conversion code;
  replaced with explicit conversion. Subsequent lint passed.
- Initial required `pnpm test:backend`: exit 1, two old-default assertions (an
  accounts setup imported only intake 0.1.0; a real-catalog test expected 0.13.0).
  They now import/assert the real 0.15.0 default and separately check old 0.1.0;
  no acceptance criterion or integrity check was weakened.
- An auxiliary live POWER probe requested solar radiation for 1991, outside the
  adapter's supported SYN1DEG period, and exited 1. That response was not used.
  The actual workflow's MERRA-2 precipitation/temperature requests succeeded.

Final concurrency review found a cache-accounting race: eight overlapping cold
reads of one 403,305-byte response charged **3,226,440 bytes**. A controlled
barrier around eight real PostgreSQL loads reproduced it (focused Jest exit 1).
Publication now releases any replaced entry's charge before accounting the new
one; it does not alter the payload, hashes or warm-read guard. The regression
asserts identical responses and exactly one document's accounted bytes. The
focused retry, full backend, live-data backend-e2e and production-container
checks all pass after this correction.

No SQL migration was introduced. Terrain integration is nevertheless included
in verification. Docker client metadata uses writable
`BUILDX_CONFIG=/tmp/rotavise-b5-buildx`, following the already documented sandbox
workaround; the production Dockerfile and container assertions are unchanged.

## Proposed DECISIONS text (not applied)

> B5 selects immutable catalog 0.15.0 for new format 2 plans and aligns current
> catalog options with capabilities. Extend crop detail additively with the
> original benefit/income research, explicit twelve-effect and income-field
> coverage, recorded nullable confidence and general cited role explanations.
> Preserve earlier response bytes and all release/result identities. Cache only
> fully verified immutable public serializations and completed rotation reads;
> check owner/expiry, row revisions and evidence links in PostgreSQL on every
> completed-read hit. Keep the real-data backend test separate from offline CI
> while POWER is live and required optional source files are not bundled.

## Proposed PROGRESS text (not approval)

> User-authorized B5 backend follow-up connects crop detail to 0.14/0.15 research,
> makes 0.15.0 the new format 2 default and provides a repeatable disposable
> API/worker/PostgreSQL backend test using original P9 extraction bytes and live
> POWER. The observed pilot returns current plus three alternatives, verified
> contracts/glossary links, ten grids, terrain context, what-if provenance,
> summaries, account claim and deletion. Missing Giovanni/model-tile/FTW data is
> explicit. Warm completed-result p95 falls from about 172 to 33 ms; current
> catalog engine timings are under 6 s. Required verification outcomes are in
> the dated B5 notes. No frontend, production modification or milestone approval
> is implied. Work remains uncommitted and unpushed for review.
