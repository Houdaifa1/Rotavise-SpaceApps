# Step 01 review report

Date: 2026-09-26. Status: **READY_FOR_REVIEW**.
Only Step 01 has been implemented; Step 02 remains unauthorized.

This paragraph records the milestone state when this report was written. See
[current progress](../../PROGRESS.md) for subsequent authorized work. Source files
were later reorganized; current paths and fresh checks are in the
[structure review](../02/structure-review.md), with runnable commands in the
[root README](../../../README.md).

## Delivery

Four real packages implement the approved foundation:

- `packages/contracts`: shared strict Zod infrastructure/health schemas.
- `packages/database`: Drizzle schema, two reviewed SQL migrations and real pg pools.
- `apps/server`: NestJS/Fastify API, explicit migration entry point, durable pg-boss
  worker entry point, safe configuration, atomic acceptance and idempotent results.
- `apps/web`: React/Vite health page with loading, real ready/unavailable, stale
  last-success state and accessible retry. It contains no harness token.

Infrastructure files add PostgreSQL 18 Compose, non-root production server image,
GitHub Actions, meaningful Jest and Playwright tests, clean-copy verification,
environment setup and a durable fixture demo. `packages/domain` remains a future
pure calculation boundary, not an empty or fake planner package.

The development harness is deliberately a finite `echo` fixture. It accepts no
crop data and makes no agricultural output. There are no `/plans` routes, accounts,
NASA/weather adapters, catalog, form, map, planner or external deployment.

Exact dependencies, official references, module choices, transaction design,
lease/reconciliation settings and limitations are in [DECISIONS.md](../../DECISIONS.md). README
contains the complete runnable setup, demo, migration and shutdown instructions.

## Executed evidence

- Official documentation and npm engine/peer metadata were reviewed. Stable
  versions were installed and locked. TypeScript 7 was incompatible with ESLint's
  supported compiler range; pinning 6.0.3 resolved it without a framework change.
- PostgreSQL image pulled and development Compose started healthy. Tests actually
  queried PostgreSQL **18.4**. Migration rerun and database constraints passed.
- `pnpm test:unit`: 16 tests passed after fixing URL validation to catch malformed
  URLs and expose only safe field names.
- `pnpm test:integration`: 8 tests passed in the final gate. Actual database shutdown made readiness
  503 while liveness remained 200; restart recovered. Twelve concurrent identical
  submissions produced one run. Changed input conflicted. A real transactional
  queue insert followed by controlled failure left zero ledger and queue rows.
  Completed data survived API restart and concurrent repeated completion.
- `pnpm test:recovery`: 5 tests passed. Transient error: 2 attempts, 1 result.
  Exhausted error: 3 attempts, RETRIES_EXHAUSTED and 0 results. Worker was killed
  with SIGKILL only after its processing log and running ledger state were
  observed. Restart recovered in **11850 ms in the final gate** (11910 ms in the earlier affected-check rerun), with 2 attempts and 1 result.
  Graceful shutdown and queued work restart passed; production fault injection
  failed startup.
- `pnpm test:e2e`: 2 real Chromium tests passed against the actual API and Vite
  proxy. Database table locking exposed loading; API shutdown exposed stale and
  first-load unavailable; real API restart and retry returned ready.
- `pnpm test:container`: API and worker production containers ran as non-root,
  became ready against migrated PostgreSQL, and exited gracefully with code 0.
  Both test-job methods returned 404; production harness enablement failed startup.
- `pnpm test:clean`: frozen install and complete build passed from a temporary
  copy without node_modules/dist/.env, using pinned pnpm **12.6.0**. Modern
  frozen production deployment was verified, replacing the initial legacy deploy.
- Lint and strict typecheck passed. Formatting was applied. Vite production build
  emitted deployable static assets and server packages emitted native ESM.
- `pnpm audit --prod --json`: zero info/low/moderate/high/critical advisories.
  `pnpm peers check`: no peer issues. Deprecation warnings are recorded in decisions.

Defects found and fixed during testing: unsafe URL refinement exception, queue
initialization before readiness, disposable PostgreSQL restart ports, SQL CHECK
NULL acceptance, test timeout configuration, supervisor default interval, and
host package-manager drift in the first clean-copy test, and browser teardown through the native pnpm process wrapper. Vite now runs directly under Node in process supervisors; the rerun exited normally. Tests were retained;
no fake database, passing-result assignment or agricultural fixture was used.
The extra SQL constraint/queue-readiness assertions passed in the final gate.
Expected outage logs remain visible. Jest's experimental VM-module notice is
limited to the test runner. No errors or advisories were suppressed.

## Final command results

All commands ran in this selected workspace with Node 24.19.0 and pnpm 12.6.0.

| Command                       | Result                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm verify                   | Exit 0; lint, formatting, strict types, 16 unit / 8 integration / 5 recovery / 2 browser tests, full build, production container and frozen clean-copy checks passed |
| pnpm db:up                    | Real development PostgreSQL healthy                                                                                                                                  |
| pnpm db:migrate               | MIGRATIONS_APPLIED                                                                                                                                                   |
| pnpm dev, then pnpm demo      | Persisted infrastructure-only result completed on attempt 1; demo run f320a587-717c-4521-8187-52a5a42f8a3f                                                           |
| Ctrl-C process-group shutdown | API_STOPPED and WORKER_STOPPED observed; supervisor exited                                                                                                           |
| pnpm audit --prod --json      | Exit 0, zero advisories in every severity category                                                                                                                   |
| pnpm peers check              | No peer dependency issues                                                                                                                                            |

The full local gate log is retained in ignored .artifacts/verify-final.log;
the earlier interrupted teardown run is retained separately as verify.log.
The runtime audit snapshot is in .artifacts/runtime-audit.json. Only the final
completed gate is claimed as passed. The current machine's Apple Git launcher
requires acceptance of an Xcode license; bundled Git was used for the local
repository, without changing that license. Docker's optional Git provenance
warning did not prevent the compiled image from building or passing its tests.

## Acceptance matrix

All 18 required local acceptance items passed.

| ID  | State | Actual evidence                                                                                                                      |
| --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| F01 | PASS  | Pinned pnpm frozen clean-copy install and full build                                                                                 |
| F02 | PASS  | 16 unit cases; safe missing/malformed config errors, production exclusions                                                           |
| F03 | PASS  | Fresh PostgreSQL 18.4 and rerun; real uniqueness/FK/CHECK constraints; missing/null/extra JSON fields rejected in final gate         |
| F04 | PASS  | Database shutdown readiness 503 vs liveness 200; restart 200; missing queue returns 503 and is not recreated by API startup          |
| F05 | PASS  | Token protection, finite strict input, oversized body, unknown/malformed lookup                                                      |
| F06 | PASS  | Real queue insert then injected failure rolls back both ledger and queue                                                             |
| F07 | PASS  | Twelve concurrent and repeated normalized submissions share one run; changed input 409                                               |
| F08 | PASS  | Persisted completed result fetched after API restart                                                                                 |
| F09 | PASS  | Transient failure completes on attempt 2 with one result                                                                             |
| F10 | PASS  | Three exhausted attempts, stable safe failed state, no result                                                                        |
| F11 | PASS  | Observed running worker SIGKILL, restart, 11850 ms final-gate recovery, one result                                                   |
| F12 | PASS  | Eight concurrent completion calls plus a real duplicate queue delivery; unique unchanged result; late failed-run completion rejected |
| F13 | PASS  | Separate worker health, graceful exit marker/code 0, queued work recovered after restart                                             |
| F14 | PASS  | Two real browser acceptance tests, including loading, stale, unavailable and retry                                                   |
| F15 | PASS  | Compiled API/worker non-root containers, readiness, 404 harness, unsafe config rejection                                             |
| F16 | PASS  | Full sequential pnpm verify exited 0: lint, format, types, all tests, builds, container and clean-copy checks                        |
| F17 | PASS  | Exact stable pins; actual installation; peer check clean; runtime audit zero                                                         |
| F18 | PASS  | README, decisions, progress, report and actual setup/dev/demo/shutdown agree                                                         |

Remote CI execution is **unverified**, not passed. There is no configured remote
repository. The workflow runs the same real local checks on a GitHub Linux runner;
local macOS arm64/Linux arm64 results do not assert an observed x64 CI run.

## Verify and demo

From this workspace, with Node 24.19.0 and Docker running:

```sh
npm install -g pnpm@12.6.0 --ignore-scripts
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm exec playwright install chromium
pnpm verify
pnpm dev
```

Stop other API/Vite development processes before the gate; the browser tests own
ports 3000 and 5178. Linux uses `playwright install --with-deps chromium`.
In another terminal:

```sh
curl --fail http://127.0.0.1:3000/api/v1/health/ready
curl --fail http://127.0.0.1:3001/health/ready
pnpm demo
```

Visit localhost:5173 for real backend availability. Ctrl-C shuts down development
processes. `pnpm db:down` preserves the development volume. See README for explicit
data deletion and individual checks. No data removal is necessary for normal use.

## Practical limits and remaining milestones

These tests establish the behavior of a small infrastructure fixture at measured
local conditions. There is no exactly-once execution claim, intended-load
benchmark, general uptime guarantee or whole-product production-readiness claim.
Worker supervision/reconciliation requires a running worker; outages can temporarily
leave the ledger at the last recorded state. Retention is one day for queue rows;
application ledger/results persist. Ten-second leases suit only the trivial fixture.
One local database role is used; deployment roles, secrets, backups, monitoring and
retention policy are later work. A future frontend deployment needs same-origin API
routing. Dependency/browser/image downloads require network access.

Real request ownership/expiration, farmer-choice semantics, applicable reviewed
crop knowledge, provider comparison, historical weather, calendar/engine/ranking,
full UI, scientific validation and external deployment remain future authorized
milestones. None have been started. User review does not authorize progression
unless the user explicitly approves the step and instructs the next one.

## Local repository and cleanup

The workspace initially had no Git repository and was not nested in one. A local
repository now contains the foundation, lockfile, SQL migrations and preserved
specifications (implementation commit `a0d1444`). Commits use the local agent
identity; no remote was created or contacted. The working tree is clean.

An ancillary Git whitespace check flagged existing two-space Markdown hard line
breaks in the historical blueprint. That original file was preserved; the Git
check for maintained implementation files passed. This does not change the
required formatting gate, which already excludes the original supplied documents.

`pnpm db:down` was run after the demo. It stopped the development database and
preserved its volume and the completed fixture. No test containers remain running.
Start the development database again with `pnpm db:up` before the demo.
