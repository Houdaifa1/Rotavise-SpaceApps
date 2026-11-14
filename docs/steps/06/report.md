> Later authorized revision: [selectable weather expansion](weather-expansion.md).
> Results below describe the original Step 06 delivery.

# Step 06 review report

Status: **READY_FOR_REVIEW** — Step 06 software component passed. Agricultural
evidence/validation gates remain **BLOCKED**; farmer recommendations are not launch ready.

## What was built

A pure backend calculation component, extending Step 05 without changing its
calendar output or the existing intake API/worker:

- Validated immutable NASA UTC evidence, normalized SHA-256 agreement with the
  existing store, exact location and metadata checks, explicit conflicting-overlap
  errors and per-variable missing-day coverage.
- Real weather-window temperature/rainfall/dry-spell arithmetic. Missing rain
  never becomes zero; incomplete metrics remain null.
- Complete consecutive historical analogs for both crop cycles and earliest/latest
  harvest windows; exact leap boundaries and reviewed stage offsets.
- Reviewed daily-air temperature exposure, variability and descriptive later-minus-
  earlier period comparisons with actual sample counts.
- Sourced ordinal water and preferred-family transition comparisons; unknown
  irrigation adequacy and an explicitly limited soil-health proxy.
- Comparable evidence groups using the same complete years, priority weights,
  exclusions outside scores, complete ties, ordering/top sensitivity and traceable
  reasons. No global recommendation is returned.
- Strict result consistency checks, deterministic/frozen-input tests, production
  synthetic rejection, demos and full-gate wiring.

Public functions: `assessHistoricalSequences(request, catalog, context, weather,
policy)` and `measureHistoricalWindow(input, weather)`, exported by
`@rotavise/domain`. They perform no HTTP, database, filesystem, clock or random
operations. Temporal initializes unused clock internals on import as documented
in Step 05; calculation itself reads no current time.

Actual API behavior remains intake verification (`recommendations: null`,
`weather: not_requested`). Full planning orchestration, accounts/history and UI
are Steps 07–08. Optional-account goal changes from the preceding conversation
are preserved in goals/handoff; they are not implemented here.

## Why these decisions

The [criteria](STEP_06.md) were written before implementation. The component
follows the [handoff](../../specification/ROTAVISE_HANDOFF.md) and
[goals](../../specification/GOALS.md). Current official NASA, Climdex and FAO56
guidance plus actual dependency installation support the
[API/method decisions](api-and-methods.md). No provider is universally preferred;
no alternative provider, forecast, evapotranspiration or soil API was added.

Stage offsets are optional without parse defaults, preserving old catalog bytes
and identities. Historical exposure cannot prove a future hard failure. Ranking
weights, ordinal classes and family-transition utilities are documented product
heuristics; local agronomic evidence and calibration remain release gates.

## Dependency versions

No existing version was upgraded. Domain now declares already-used Noble 2.4.0
directly. Official registry GET returned HTTP 200, latest 2.4.0, MIT, Node

> =20.19.0, no dependencies. Actual local versions:

| Component                               | Exact version                      |
| --------------------------------------- | ---------------------------------- |
| Node / pnpm                             | 24.19.0 / 12.6.0                   |
| Nest common/core/platform-fastify       | 12.1.0 each                        |
| Fastify / pg-boss                       | 5.12.5 / 12.35.0                   |
| PostgreSQL / pg                         | 18.4 / 8.23.0                      |
| Drizzle ORM / kit                       | 0.45.3 / 0.31.11                   |
| Zod                                     | 4.6.5                              |
| Temporal polyfill / JSBI / Noble hashes | 0.5.1 / 4.3.2 / 2.4.0              |
| React / React DOM / Vite                | 19.3.0 / 19.3.0 / 8.3.1            |
| TypeScript / Jest / Playwright          | 6.0.3 / 30.5.2 / 1.63.0            |
| ESLint / typescript-eslint / Prettier   | 10.11.0 / 8.70.1 / 3.9.9           |
| reflect-metadata / RxJS                 | 0.2.2 / 7.8.2                      |
| @types/node / pg / react / react-dom    | 24.19.0 / 8.23.1 / 19.3.0 / 19.3.0 |

Workspace links are `workspace:*`. The committed lock records exact resolution.
New engine/policy/ranking identities: `historical-engine-1`,
`historical-policy-1`, `ranking-heuristics-1`; existing sequence engine/policy stay
version 2. There is no SQL migration in this step.

## Actual commands/results

Commands run from `/Users/houdaifadrahm/projects/Rotavise`:

| Command/check                                                                    | Actual result                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile=false`                                           | Exit 0; direct Noble dependency resolved to already-installed 2.4.0.                                                                                                               |
| `pnpm build:server`                                                              | Exit 0 on initial component.                                                                                                                                                       |
| `pnpm test:climate` initial                                                      | Exit 1: 30 failed, 39 passed. Synthetic factory leaked duration-only fields; real sample test incorrectly passed extra location fields. Strict validation correctly rejected them. |
| `pnpm test:climate` second                                                       | Exit 1: 29 failed, 40 passed. Fixture rule IDs still contained underscores; corrected them to the existing ID contract.                                                            |
| `pnpm test:climate` third/expanded                                               | Exit 0, 69 tests each.                                                                                                                                                             |
| `pnpm test:climate` final affected suite                                         | Exit 0, 81 tests, after leap-engine, complete-clock, ordering-sensitivity and nine strict-output tamper regressions.                                                               |
| `pnpm lint` initial/fixed                                                        | Initial exit 1 for one unused test helper; removed that unused helper, final exit 0. No test/validation was removed or weakened.                                                   |
| `pnpm install --frozen-lockfile && pnpm peers check && pnpm audit --prod`        | Exit 0; frozen installation, no peer issues, no known advisories at this dated check.                                                                                              |
| `node tooling/engine/climate-demo.mjs > docs/steps/06/demo.json`                 | Exit 0; three real captured NASA samples hashed/normalized/measured; real catalog yielded zero schedules.                                                                          |
| `node tooling/engine/climate-fixture-demo.mjs > docs/steps/06/fixture-demo.json` | Exit 0; explicitly synthetic comparison changes with priority.                                                                                                                     |
| Controlled production fixture CLI check                                          | Parent exit 0; child expected exit 1 with `SYNTHETIC_DEMO_DISABLED`.                                                                                                               |
| Independent byte-preservation check against `5d6a0d5`                            | Exit 0: 50 tracked real data/evidence/migration/intake/weather/frontend files unchanged.                                                                                           |
| `pnpm verify > .artifacts/step-06-verify.log 2>&1`                               | Exit 0: 371 tests, strict checks/builds, real PostgreSQL/recovery, Chromium, non-root production API/worker/engine and clean frozen install/build.                                 |

Final targeted Prettier and fallback `git diff --check` passed. Node assertions
confirmed 76 local Markdown links, the twelve-step order/optional-account goal,
Step 06 status, all software/evidence matrix rows and the exact 371-test log count.

The 371 tests comprise 16 foundation unit, 8 integration, 5 recovery, 60 weather,
54 catalog, 57 intake, 88 sequence engine, 81 historical comparison and 2 Chromium
tests. No application code changed after this final gate. A separate read-only
probe of the verified image confirmed UID 1000 and absence of `/app/tests` and
the fixture CLI. Disposable gate resources were cleaned up by the harness.

Logs are ignored local artifacts under `.artifacts/step-06-*.log`. Failure-injection
queue/provider errors printed by integration tests are intentional observations;
test exit/status remains authoritative. Remote CI is unrun; no remote is configured.
Docker reported that system Git could not capture commit metadata (Xcode license
prompt); the available fallback Git is used for local status, preservation and
whitespace checks. This warning did not prevent the image or checks from passing.
Frontend source is unchanged; the build is 351.17 kB (106.34 kB gzip), with the
new shared schemas. No farmer UI capability is claimed by that build.

## Demo

With Node 24.19.0, pnpm 12.6.0 and Docker running for the full gate:

```sh
cd /Users/houdaifadrahm/projects/Rotavise
pnpm install --frozen-lockfile
pnpm climate:demo
pnpm climate:fixture-demo
pnpm test:climate
pnpm verify
```

The two demos and affected suite need no database/server. Full verification uses
real disposable PostgreSQL and containers. Normal development setup/intake commands
remain in [README](../../../README.md).

Real measurements in [demo.json](demo.json), with displayed rounding only here:

| Recorded NASA sample                       | Days | Rainfall mm | Dry days (<1 mm) | Longest dry spell |
| ------------------------------------------ | ---- | ----------- | ---------------- | ----------------- |
| Beni Mellal, 2024-02-27 through 2024-03-02 | 5    | 1.87        | 4                | 4 days            |
| Sydney, 2023-12-30 through 2024-01-03      | 5    | 12.25       | 1                | 1 day             |
| Beni Mellal, 2023-12-01 through 2024-03-31 | 122  | 182.22      | 101              | 29 days           |

These are actual recorded weather estimates, not crop recommendations. Demo UUIDs
label files rather than persisted database rows; farmer inputs in the gap demo are
explicitly illustrative. The real catalog yields 9 pairs, 0 schedules, 0 comparisons,
`insufficient_evidence` and null recommendations.

The [fixture demo](fixture-demo.json) invents three crops/reviews/weather for six
anchor years. It produces 54 schedule assessments, excludes 18 from ranking, and
shows alpha→beta preferred under the soil proxy versus alpha→gamma among the
lower-water top options. Multiple sowing dates tie. No fixture is agricultural
evidence, and the CLI refuses production.

## Limitations and acceptance

- No real local schedules exist yet: reviewed cultivar durations/calendars,
  stage/temperature thresholds, comparable water methods and crop-health/rotation
  rules remain missing. Specialist review was not invented or externally requested.
- Ranking heuristics and descriptive historical differences are not field-validated
  crop success probabilities, measured soil improvement or irrigation budgets.
- Bounds are explicit failures, not measured public concurrency/latency guarantees.
  Region/diagnosis context still requires a trusted future server implementation.
- No accounts, saved fields/history, full planning API, farmer UI, deployment or
  later milestone was implemented.

| ID  | Status  | Evidence                                                                                                                                         |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| H01 | PASSED  | Primary-source method review, actual pinned dependency installation, criteria before code.                                                       |
| H02 | PASSED  | Strict contracts, frozen/permutation/clock tests, work/snapshot/output failures; pure library.                                                   |
| H03 | PASSED  | Native/store hash agreement, location/provenance/parameter/order/overlap adversarial checks.                                                     |
| H04 | PASSED  | Hand-calculated rain/run/temperature cases, actual NASA measurements, null coverage cases.                                                       |
| H05 | PASSED  | Complete cross-year/leap-engine, earliest/latest, stage-window and conservative endpoint cases.                                                  |
| H06 | PASSED  | Correct daily variable, strict bounds, unsupported/unreviewed/ambiguous evidence rejection.                                                      |
| H07 | PASSED  | Independent variation arithmetic, period differences/counts and insufficient-sample outcomes.                                                    |
| H08 | PASSED  | Sourced classes/method and predecessor proxy, unknown adequacy/history; affected ranks blocked.                                                  |
| H09 | PASSED  | Excluded candidates unranked, common-year intersection, priority changes, ties and full-order/top sensitivity.                                   |
| H10 | PASSED  | Input/rule/citation/window/snapshot traces and strict output corruption checks; farmer choices preserved.                                        |
| H11 | PASSED  | 81 cases, real/synthetic demos, production CLI refusal, public synthetic rejection and fixture absence in the non-root image.                    |
| H12 | PASSED  | Full 371-test/strict/build/database/recovery/browser/container/frozen gate, version/commands/report/decisions/progress and documentation checks. |
| A01 | BLOCKED | Missing reviewed local agricultural rules/calendars/durations; real catalog has zero schedules.                                                  |
| A02 | BLOCKED | No regional agronomic validation or calibrated ranking utilities; required before farmer launch.                                                 |

Stop after Step 06. A passing local gate is not user approval or permission to
start Step 07.
