# Sourced income and benefits wiring — 2026-11-10

Branch `codex/wire-income-benefits`, from the existing HEAD. The user explicitly
authorized this scoped code task. Work remains **uncommitted and unpushed**;
no milestone approval, UI work, deployment, production-data change or external
message is implied. The pre-existing untracked task prompt is retained and
formatted for the repository gate.

## Implemented

- Offline builder `tooling/catalog/build-release-0.14.0.mjs`, based on immutable
  0.13.0. All earlier profiles, names, rules, references, sources, regions,
  issues and conflicts remain intact. Only the version and optional research
  fields are added. The default `ROTATION_CATALOG_VERSION` remains **0.13.0**.
- Runtime-validated evidence contracts and source/hash cross-reference checks.
  Complete original research records remain in `docs/evidence`; typed fields,
  quotes and metadata in the release preserve original units, years, regions,
  definitions, exclusions, conflicts and eligibility flags. Translations remain
  in the saved research; no independent review is claimed.
- Every new citation has a quote-check identifier, exact quote, locator and
  original source hash. The builder reopens original snapshots in both research
  worktrees, verifies source/derivative hashes and native archive rows, and
  checks text or the research's explicitly identified visual transcriptions.
  CI checks committed extracts, input-record hashes and citation bindings.
- Optional pinned `policy.research = income-benefits-1`, selected at acceptance
  only for research-bearing catalogs and stored in the existing versions hash.
  Earlier pins and catalogs without this evidence add no research output.
- Per-candidate and per-strategy `resources`: historical gross revenue scenarios
  from compatible same-crop/product/scenario/year/region observations; each
  derived range lists its formula and inputs. The exact kg/tonne mass identity
  is explicit. No inflation, currency, quintal or feed-unit conversion, modelled
  yield substitution, cost subtraction or computed profit is introduced.
  Published costs and margins retain definitions and source conflicts.
- Missing price/yield pairs, dates, compatible units, common rotation years or
  peer cohorts produce explicit gaps. Unsupported crops never receive zero
  revenue. Income reorders only fully supported peer rotations inside their
  existing positions, under the requested weight and a shared latest historical
  year/region. Base `weightedLoss`, four-dimension sensitivity and Pareto flags
  retain their original meaning; the additional combined loss includes a
  labelled derivation. The beam search remains unchanged. Crop-model yield
  reranking reapplies this comparison and reports its displayed-candidate scope.
- Conditional benefits reference shared per-crop evidence and show the following
  crop, named pest/disease/partner relationships, regions, conditions and
  non-local flags. Fixation is not a following-crop N credit; missing magnitudes
  and conflicting feed figures remain unresolved.
- Partial, derived `LS*C` exposure scenarios require explicit RUSLE C evidence
  and pinned terrain LS. **Erosion stays unranked**: R/K/P are absent, slope
  length is assumed, and the two C-bearing crops have non-local management
  restrictions. No generic USLE crop-group row, ordinal protection class,
  rotation-average C or absolute soil loss is invented. See `docs/DECISIONS.md`.
- `catalogResearch` reports compared-crop coverage and shares evidence once for
  references from candidates/strategies. It distinguishes all compared crops
  from the displayed subset and distinguishes post-yield ranking scope.
- English/French/Arabic/Darija glossary entries (`glossary-4`), regenerated
  `docs/api/openapi.json`, catalog/rotation test lists and container release
  checks. The formatted format 2 release read budget is 12 MiB; canonical
  catalog/result ceilings remain 8 MiB. No migration or dependency-lock change.

## Coverage

| Measure                                                     | Count |
| ----------------------------------------------------------- | ----: |
| Catalog crops with explicit research/gaps                   |   246 |
| Crops with some income input or option                      |    67 |
| Crops without income inputs/options in this pass            |   179 |
| Numeric price/yield/cost/margin records                     |   654 |
| Income/feed options                                         |     6 |
| Crops with compatible dated historical revenue pairs        |    40 |
| Compatible price/yield pairs                                |   172 |
| Crops with sourced benefits                                 |    45 |
| Sourced benefit records                                     |   102 |
| Crops with no sourced benefit in this pass                  |   201 |
| Crops with sourced C evidence (grapevine, olive; non-local) |     2 |
| Crops with rankable erosion                                 |     0 |
| Added source records                                        |    39 |
| New quote occurrences checked                               | 1,108 |

Coverage is bounded research coverage, not absence of a crop's economic value
or agronomic benefit. No accepted numerical following-crop nitrogen-credit
range exists in these records. The 172 national pairs are historical annual
observations, not within-year ranges, joint farm distributions or forecasts.
The release canonical hash is
`8a59fc79f0320a3033278a308e26507b090a06fe370008be64f42045abb8a43a`
(6,839,292 canonical bytes).

## Verification

All requested commands have passing results; actual exit codes and earlier
failures are recorded below. All database tests use disposable PostgreSQL, never the development
or production database. Existing legacy output golden hashes and speed bounds
are retained without modification.

Initial implementation checks exposed and corrected: missing build artifacts
when the builder was invoked before the first dependency/build completion;
Python encoding spelling; a licence field exceeding the existing display
bound (full wording stays in the research); contract typing/import issues; the
formatted release disk budget; one unused import; test floating-point precision;
compared-versus-displayed coverage; using the format 1 catalog environment
setting in the opt-in integration test; an oversized full-catalog synthetic
versions fixture (replaced with a small, explicitly synthetic transport fixture);
and comparing original source order with canonical PostgreSQL order. None of
these failures was suppressed. Full results follow.

## Final command results (2026-11-10 UTC)

| Command               | Exit | Verification                                                                                  |
| --------------------- | ---: | --------------------------------------------------------------------------------------------- |
| `pnpm lint`           |    0 | Passed                                                                                        |
| `pnpm format:check`   |    0 | Passed                                                                                        |
| `pnpm typecheck`      |    0 | Passed                                                                                        |
| `pnpm test:catalog`   |    0 | 89 tests passed                                                                               |
| `pnpm test:plans`     |    0 | 58 tests passed                                                                               |
| `pnpm test:backend`   |    0 | 76 tests passed                                                                               |
| `pnpm test:engine`    |    0 | 279 tests passed                                                                              |
| `pnpm test:api-docs`  |    0 | 27 tests passed                                                                               |
| `pnpm test:unit`      |    0 | 30 tests passed                                                                               |
| `pnpm test:container` |    0 | Production image, all releases imported/idempotent, native dependencies, API/worker lifecycle |

The passing container invocation used
`BUILDX_CONFIG=/private/tmp/rotavise-wire-buildx pnpm test:container`.
This redirects only Docker client build metadata to an authorized writable
directory; the production Dockerfile, runtime user and test assertions were
unchanged. Full command logs and timestamped exit records are at
`/private/tmp/rotavise-wire-verification/` (`results.json`).

Additional checks: `pnpm openapi:generate` **0** after the final schema fix;
`git diff --check` **0**; immutable-release/default-config/lockfile
`git diff --exit-code -- data/catalog/releases/0.{1..13}.0 pnpm-lock.yaml apps/server/src/config/environment.ts` **0**. Two builder invocations reproduced **all
250 release files byte-for-byte**, with exit **0**. Unit quote checks bind all
1,108 new citation occurrences to their saved research and source hashes.

The full engine suite retained all four existing golden hashes, its unchanged
speed limits, and the new-policy 25-second bound. No golden value or timeout
was relaxed. The requested Jest projects reported **559 passing tests** in
total. PostgreSQL integration used real disposable PostgreSQL 18.4.

### Failures retained and resolved

| Command/check                                                                                                 | Earlier exit | Cause and resolution                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm build:server` (implementation iterations)                                                               |            1 | Optional-union typing and an undeclared direct Zod import in domain; moved runtime schema to contracts, corrected narrowing; subsequent builds/typecheck 0.                                                                                                                                            |
| `node tooling/catalog/build-release-0.14.0.mjs ../codex-income ../codex-benefits` (implementation iterations) |            1 | Invoked before initial build completed; Python encoding name; oversized display licence; built dependencies, corrected encoding and retained full licence in saved research while bounding display text; final builds 0.                                                                               |
| Targeted catalog/rotation Jest checks (implementation iterations)                                             |            1 | Formatted release budget and test precision/coverage assumptions; corrected budget and assertions; targeted checks and full suites passed.                                                                                                                                                             |
| Targeted PostgreSQL research Jest checks (implementation iterations)                                          |            1 | Wrong catalog environment setting in test, oversized synthetic versions fixture and canonical ordering assertion; corrected fixtures/configuration/assertion; full catalog/backend suites passed.                                                                                                      |
| `pnpm lint` (initial)                                                                                         |            1 | Unused type import removed; final 0.                                                                                                                                                                                                                                                                   |
| `pnpm test:api-docs`                                                                                          |            1 | Anonymous recursive `z.json()` definitions emitted invalid `__shared` references. One explicit `ResearchMetadata` schema now supplies valid component references; regenerated document and final 27 tests passed.                                                                                      |
| `pnpm test:catalog` (one rerun)                                                                               |            1 | Local slowdown accompanied PostgreSQL disconnects/queue errors and 90-second test timeouts, including 0.11.0. Root environmental cause was not established. Docker health was checked; unchanged command passed on a fresh disposable database (89 tests). No timeout increase or failure suppression. |
| `pnpm test:container` (first attempt)                                                                         |            1 | Buildx could not write its home-directory activity file in the sandbox. Temporary writable `BUILDX_CONFIG` resolved the setup failure; complete production container check 0.                                                                                                                          |

After naming the shared metadata schema, the new research engine/parser tests
were also rerun with exit **0** (6 tests):

```sh
node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects rotation --runInBand --testPathPatterns=rotation-research
```

Glossary coverage explicitly includes all three new result codes plus
`derived` and `conditional_context`, in en/fr/ar/ary. Recursive metadata
references are validated by the existing OpenAPI reference test.

## Reproduce and inspect

```sh
pnpm build:server
node tooling/catalog/build-release-0.14.0.mjs ../codex-income ../codex-benefits
pnpm test:catalog
pnpm test:engine
pnpm test:backend
pnpm openapi:generate
```

The builder's two arguments are worktree roots containing the hash-matching
`.research-sources/2026-11-10/` originals. They are local inputs, not committed
source documents. Override `ROTATION_CATALOG_VERSION=0.14.0` when intentionally
running a new plan with this evidence; importing it alone does not change the
default. The result fields to inspect are `catalogResearch`, candidate
`resources`, and strategy `resources`.

## Unverified and limitations

No new live-weather/NASA run, agronomist review, native-speaker review,
commercial reuse clearance or current local market validation was performed.
Some licences remain unknown/restricted. Prior visual research transcriptions
are machine-compared and identified; their original visual review was not
independently repeated. Research eligibility flags remain unchanged. Partial
RUSLE exposure is contextual and management-conditional; it does not satisfy
full soil-loss ranking. Benefits do not automatically assert that mixture,
predecessor, location or management conditions are met. Ranking does not search
for additional income-optimal rotations beyond the existing bounded beam.

## Proposed DECISIONS / PROGRESS text

DECISIONS proposal: “Catalog 0.14.0 adds sourced research under a new optional
pinned `income-benefits-1` policy. Historical gross revenue requires matching
crop/product, observation year, region and compatible units; costs and margins
remain published definitions. Unsupported rotations retain their base positions
while supported peers may be reordered using a common historical year/region.
Benefits retain conditions and non-local flags. Partial LS*C exposure remains
unranked because R/K/P and local management calibration are missing; no soil loss
or generic crop-group C is inferred. Earlier releases, default catalog and older
policy outputs remain unchanged.” The full technical decision is added as
“Sourced income and benefits, opt-in catalog 0.14.0 (2026-11-10)” in
`docs/DECISIONS.md`; it records no approval.

PROGRESS: “Scoped user-authorized income/benefits wiring: additive opt-in 0.14.0,
pinned historical gross-revenue scenarios and honest coverage, conditional
benefits and partial unranked LS*C exposure. Default 0.13.0 and older releases
remain unchanged. Verification and limitations: codex-wire-notes.md. Uncommitted,
unpushed, awaiting code/evidence review; no milestone approval.”
