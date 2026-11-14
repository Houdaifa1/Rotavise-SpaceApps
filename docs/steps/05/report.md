# Step 05 review — calendars, sequences and constraints

Status: **READY_FOR_REVIEW** — E01–E12 passed. This is component readiness, not user approval or whole-product launch readiness. Agricultural evidence gates A01/A02 remain blocked.

## Revision requested after implementation

The user requested a fresh Step 05 review and API/method research before moving
on. Revision verification **PASSED**: final `pnpm verify` exit 0, **290 tests**,
including **88 engine** cases; lint/format/types/builds, real PostgreSQL/recovery,
Chromium, non-root API/worker/packaged engine and frozen clean-copy build passed.
Log: `.artifacts/step-05-revision-verify.log`. Remote CI was not run.
Current research/decisions are in
[API and method review](api-and-methods.md) and [live observations](api-checks.json).

Three defects had reproducible failing regression cases: transitive Node-only
catalog hashing; reference/soft durations being executable; tied historical
harvests selecting an arbitrary predecessor. Fixes replace hashing with pure
SHA-256 (`@noble/hashes` 2.4.0), require hard reviewed duration rules and keep an
ambiguous predecessor unresolved. Readiness now exposes nonexecutable calendars;
output validation also reconciles examined combinations with schedules/rejections.
Corrected engine/policy identities are version 2. Real release hash is unchanged.

Before fixes: new regressions produced **5 failures /80 passes**, exit 1. The
broader runtime probe also identified Temporal's unused `Now` initialization at
module load. The final probe checks full result equality across two initial clocks
and forbids clock reads during calculations; it does not claim clock-free module
initialization. After the first fixes/readiness checks, **87 engine tests passed**;
one search-accounting regression was then added. The full gate then passed 88
engine cases and all 202 earlier tests. No existing test was removed or weakened.

Affected catalog checks: **54 passed**, exit 0; lint passed. Frozen installation
and peer checks exited 0; runtime audit found zero known advisories across
**126 dependencies**. This is a dated observation, not a reliability guarantee.
All previous stack pins remain unchanged; only Noble 2.4.0 is newly installed in
this revision (no transitive dependencies). No migrations or runtime API were added.

Nine recorded small GET observations all returned HTTP200: four actual weather
samples, four metadata probes, and SoilGrids with null pH values. The seven-probe
command exited 1 when null soil values were classified `no_data`; the two additional
NASA probes exited 0. The current four-variable NASA v2.10.0 sample passed the
existing strict normalizer with five complete days per variable. No ground-truth,
authenticated Earthdata/EPPO/CDS extraction or new-provider accuracy claim exists.

Both recorded demos were regenerated with engine version 2: real catalog 12 pairs,
zero schedules; synthetic alpha/beta 6 schedules. Production fixture CLI rejection
was retested successfully. Fifty tracked data/evidence/migration/intake/weather/
frontend files remain byte-identical to original Step 05 commit `a5b52cb`.
The sole added runtime package is Noble 2.4.0; Temporal 0.5.1 / JSBI 4.3.2 and all prior
pins remain. Current acceptance matrix below incorporates the revision.

Final revision documentation checks passed: formatting and Git whitespace;
**61** local Markdown links resolve, E01–E12 are PASSED and A01/A02 BLOCKED,
and all **five** retained weather/soil raw bodies match their recorded SHA-256.
These checks ran after the final report/demo updates. No application code changed
after the complete 290-test gate.

## Original implementation record

The following implementation/installation chronology records the earlier Step 05
run (281 tests and 125 runtime dependencies), before this revision's fixes/addition.

## Delivered

Step 05 is the correct next roadmap component and was explicitly authorized.
The new pure `packages/domain` engine evaluates complete two-cycle crop pairs,
enumerates dates and retains hard rejections, uncertain inputs and evidence gaps.
It preserves every considered crop and catalog alternatives. Output includes
catalog content hash/version, engine/policy version, normalized input/context,
source/rule/input references, conservative harvest intervals and rejected-start
counts. It never returns recommendations or irrigation adequacy.

Calendars cover year wrap and real leap days. Second sowing is strictly after the
latest first harvest. Constraints include farmer exclusions, method-compatible
dated pH, reviewed family prohibitions, sowing return intervals and supported
verified health-break rules. Missing applicability, cultivar, dates, history,
soil method, health verification or executable rule conditions stays explicit.
Search limits fail clearly with no sampled/partial successful output.

The three real profiles still lack reviewed local durations/health-break evidence.
The real-catalog demo therefore returns zero schedules and insufficient evidence.
Positive/negative algorithm tests use explicitly synthetic crops/rules/reviews,
which the public production engine and importer reject. No fake rules were added
to the real release. API/worker still run intake only; no Step 06–12 work started.

[Acceptance](STEP_05.md), [research/material decisions](../../decisions/sequence-engine.md)
and [structure](../../architecture/structure.md) contain the detailed boundaries.

## Files and material choices

- `packages/domain/src/calendar/`: Temporal boundary and validated recurring-window search.
- `evidence/`: applicable calendar preparation and rule/knowledge gaps.
- `constraints/`: reasons, soil, rotation and health assessment.
- `sequences/`: strict input/context normalization, work bounds and exhaustive generation.
- `packages/contracts/src/engine/`: strict input context and cross-checked result contracts.
- Optional catalog health/transition/execution scope fields, strict reference/review validation;
  existing catalog JSON and migration history preserved.
- Synthetic engine fixture, 79 focused tests, real-catalog demo and production-container probe.
- Manifest/lock/build/ESLint/Jest wiring, README/structure and milestone records.

See the decision record for date units, window union, conservative duration envelope,
leap anniversaries, declared coverage/verification context, unknown handling and
250000-combination / 5000-record / 2 MiB output bounds. There is no independent
diagnosis/geographic verifier in this component; later server integration must
obtain trusted context rather than accepting verification flags from a farmer.

## Dependency versions

Only new runtime package: `@js-temporal/polyfill` **0.5.1**, stable `latest` at
selection; actual install resolved **jsbi 4.3.2**. Node 24.19.0 reports no native
Temporal. Official maintainer API guidance, installed declarations, actual strict
build and runtime tests verify this selection. Lockfile changed only for the new
workspace/dependency relationships and these two packages. Other pins are retained:

| Component                                   | Exact version                       |
| ------------------------------------------- | ----------------------------------- |
| Node / pnpm                                 | 24.19.0 / 12.6.0                    |
| Nest common/core/platform-fastify / Fastify | 12.1.0 / 5.12.5                     |
| React / React DOM / Vite                    | 19.3.0 / 19.3.0 / 8.3.1             |
| Zod                                         | 4.6.5                               |
| PostgreSQL                                  | 18.4, `postgres:18.4-bookworm`      |
| Drizzle ORM / Kit / pg / pg-boss            | 0.45.3 / 0.31.11 / 8.23.0 / 12.35.0 |
| reflect-metadata / RxJS                     | 0.2.2 / 7.8.2                       |
| TypeScript / ESLint / typescript-eslint     | 6.0.3 / 10.11.0 / 8.70.1            |
| Prettier / Jest / Playwright                | 3.9.9 / 30.5.2 / 1.63.0             |
| @types/node / @types/pg                     | 24.19.0 / 8.23.1                    |
| @types/react / @types/react-dom             | 19.3.0 / 19.3.0                     |

## Actual commands/results

| Command/check                                                                   | Observed result                                                                                                                           |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm view @js-temporal/polyfill version engines dependencies dist-tags --json` | latest 0.5.1; engines >=12; JSBI ^4.3.0                                                                                                   |
| `pnpm --filter @rotavise/domain add --save-exact @js-temporal/polyfill@0.5.1`   | Exit 0; installed two packages                                                                                                            |
| `pnpm install` / `pnpm install --frozen-lockfile`                               | Exit 0; native pnpm 12.6.0                                                                                                                |
| `pnpm list --filter @rotavise/domain --depth 2 --json`                          | Actual polyfill 0.5.1 and JSBI 4.3.2                                                                                                      |
| `pnpm build:server`                                                             | Exit 0 after fixing optional knowledge handling                                                                                           |
| `pnpm test:engine`                                                              | Initial 60/61 passed; corrected invalid fixture. Expanded final 75/75 passed in 0.893 s; expanded final 79/79 passed in 0.919 s           |
| `pnpm lint`                                                                     | Exit 0                                                                                                                                    |
| `pnpm peers check`                                                              | Exit 0; no peer issues                                                                                                                    |
| `pnpm audit --prod --json`                                                      | Exit 0; zero known advisories across 125 runtime dependencies; dated observation                                                          |
| `pnpm engine:demo`                                                              | Exit 0; real catalog, 12 pairs, zero schedules, all three considered choices retained                                                     |
| `pnpm engine:fixture-demo`                                                      | Exit 0; six synthetic alpha/beta schedules, retained rejected calendar pairs                                                              |
| `pnpm verify`                                                                   | Final exit 0 on fixed code: 281 tests, non-root production API/worker/engine and frozen clean-copy install/build; earlier gate passed 277 |

The first compile exposed undefined optional knowledge in readiness; it now handles
the absent health group explicitly. Another compile caught an incomplete renamed
validation call; corrected before tests. The initial one-test failure was a
synthetic history dated after its assessment date. The fixture's assessment date
was corrected; future-history validation was retained. Code review also prevented
partial history from establishing an immediate predecessor, made rule qualifiers
explicit and moved output/count bounds before large allocations. These safeguards
have regression tests. Final review also required stable diagnosed issue IDs in
verified health context, exposed missing execution metadata in catalog readiness,
validated full-month boundaries and enforced the intake first-start horizon
relative to the supplied assessment date. These added four cases; the final full
gate passed on this fixed code. No test was removed/weakened or application error suppressed.

Read-only comparisons confirmed **50** prior catalog/evidence/migration/intake/
weather/frontend files byte-identical. All **56** local Markdown links across the
updated README/status/Step 05/goal/structure documents resolved. The synthetic CLI
demo was explicitly tested with `NODE_ENV=production` and rejected with
`SYNTHETIC_DEMO_DISABLED`. System Git requires an unaccepted Xcode license; Git
checks and local commit use the available bundled fallback binary.

The final complete gate ran 16 foundation unit, 8 foundation integration,
5 foundation recovery, 60 weather, 54 catalog, 57 intake, **79 engine** and
2 Chromium tests: **281 passed**, exit 0. Lint/format, strict types and complete
builds passed. Production containers verified packaged Temporal/ESM engine loading,
real catalog gaps/synthetic rejection, non-root API/worker, private intake,
readiness and graceful shutdown. Frozen clean-copy install/build passed without
generated artifacts. Full local log: `.artifacts/step-05-verify-final.log`.
Remote CI was not run.

Final documentation checks: `pnpm exec prettier --check README.md docs/steps/05 docs/decisions/sequence-engine.md docs/PROGRESS.md docs/DECISIONS.md docs/architecture/structure.md docs/specification/GOALS.md` returned exit 0. Inline
`node --input-type=module` assertions verified all 56 local links and E01–E12
PASSED plus A01/A02 BLOCKED entries. The bundled Git binary
`/Users/houdaifadrahm/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git diff --check`
returned exit 0. No application checks were rerun for these final documentation-only
status updates.

## Exact demo and verification

Use Node 24.19.0, pnpm 12.6.0 and running Docker:

```sh
cd /Users/houdaifadrahm/projects/Rotavise
pnpm install --frozen-lockfile
pnpm test:engine
pnpm engine:demo
pnpm engine:fixture-demo
pnpm verify
```

[Recorded demos](demo.json): the real-catalog example retains 12 pairs/three
considered choices, zero schedules and the unchanged catalog hash. The synthetic
example has six alpha/beta schedules; alpha sown 2029-12-30 has an estimated harvest
envelope 2029-12-31–2030-01-02, followed by beta sown 2030-01-04. These crops,
durations and rules are invented test cases, never agricultural guidance. The
fixture demo refuses production mode and is absent from the production image.

The engine demo is local, reads the committed real catalog and uses a labeled
synthetic request. It needs no database/server/network request, prints no bearer
token, and returns evidence gaps with zero recommendations. Existing intake API
demo instructions remain in [Step 04](../04/report.md).

## Acceptance matrix

| ID  | Status  | Evidence                                                                                                                                    |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | PASSED  | Roadmap reviewed; criteria before implementation; primary references and actual stable installation                                         |
| E02 | PASSED  | Transitive builtins/Buffer forbidden; clock-independent complete results and no clock/network during calculation                            |
| E03 | PASSED  | Cross-year/leap/anniversary/duration and strict overlap/date tests                                                                          |
| E04 | PASSED  | Exhaustive oracle, unsupported/excluded/alternative retention; all three explicit bounds                                                    |
| E05 | PASSED  | Region/system/cultivar/review/conditions gaps; no assumed location/system/calendar                                                          |
| E06 | PASSED  | Hard pH/family/return checks and adverse incomplete/unsupported history cases                                                               |
| E07 | PASSED  | Typed host/break validation; verified, unverified, unlinked, undated and unsupported synthetic cases                                        |
| E08 | PASSED  | Reason references/actual anchors; strict output consistency; explicit deferred checks/no advice                                             |
| E09 | PASSED  | Prior real catalog hash unchanged; optional fields have no defaults; nested synthetic rejection                                             |
| E10 | PASSED  | 88 engine tests; oracle, immutability, reference/soft duration, tied predecessor and search-accounting regressions                          |
| E11 | PASSED  | Final revision 290-test gate, packaged production engine/API/worker, frozen clean-copy build, zero known advisories across 126 dependencies |
| E12 | PASSED  | Both recorded demos, production fixture guard, READY_FOR_REVIEW status/docs/link/whitespace checks                                          |
| A01 | BLOCKED | Real local cultivar duration/calendar/conditions require specialist review; no invented values                                              |
| A02 | BLOCKED | No reviewed Beni Mellal health hosts/break rules or independently verified diagnoses exist                                                  |

A01/A02 are agricultural release gates, separate from algorithm verification.

## Limitations and stop boundary

This is the calendar/constraint component, not a working recommendation product.
No real farm plans, soil improvement, disease absence/probability, irrigation
sufficiency, weather effects, rankings or income guarantee are claimed. No agronomist
review, geospatial resolution, diagnosis verifier, public-load test, remote CI or
external deployment occurred. Management turnaround requirements remain unmodeled;
non-overlap alone does not establish that a farm can perform the transition.

The current three real crops still return insufficient evidence. Step 06 adds
historical metrics/water/ranking only when explicitly authorized. Complete planning
API, farmer UI, validation, staging, photo assessment and greenhouse monitoring
remain Steps 07–12. Stop after Step 05.
