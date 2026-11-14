# Step 01 — reproducible foundation and durable local job

Status: **AUTHORIZED_FOR_IMPLEMENTATION** when the user starts the new task with `START_PROMPT.md`. No application code has been produced by this specification.

## Outcome

A fresh checkout can start PostgreSQL, apply migrations, run the API and worker separately, show genuine backend health in a minimal frontend, and execute a durable synthetic job. Real tests demonstrate atomic submission, idempotency, retry/recovery, failure reporting, and production-mode exclusion of the development harness.

Stop after reporting this step. Do not implement Step 02 or mark user approval yourself.

## Authorized implementation

### A. Workspace and tools

Create or adapt the selected project repository. Inspect existing files and Git state first; preserve unrelated work. Do not initialize a nested Git repository inside another repository. If the location is ambiguous, ask for the intended project directory before creating application files.

Create `apps/server`, `apps/web`, `packages/contracts`, and `packages/database`. Reserve the future domain package in the architecture documentation; do not create fake planner implementations, empty packages with meaningless success scripts, or a large set of speculative folders.

Pin Node 24's supported patch, pnpm's selected stable version, and installed dependencies. Record compatibility and versions in `docs/DECISIONS.md`. Build runtime packages to JavaScript with explicit exports so clean production execution does not depend on a development TypeScript loader. Resolve the chosen module format and test transformation deliberately.

Configure strict TypeScript, linting, formatting, build scripts, and root checks. Test runners must not succeed merely because no tests were found. Configuration must fail fast for missing or malformed required settings, without leaking secrets.

### B. Real PostgreSQL and migrations

Use PostgreSQL 18 in Docker Compose with a health check, isolated local credentials, and a persistent local volume. Verify the current image's volume paths rather than assuming older image defaults. Bind local database access to the development host appropriately; keep disposable tests in a separate database or Compose project.

Add committed Drizzle SQL migrations for a small infrastructure ledger:

- `job_runs`: ID, operation, validated synthetic input, normalized-input hash, idempotency key, operational status, timestamps, and safe error code/details.
- `job_run_results`: unique run ID, synthetic result, and completion timestamp.

The exact schema can be refined within this scope. Enforce uniqueness and referential integrity in PostgreSQL. Do not create speculative user, crop, billing, or full planning tables yet.

Configure pg-boss's own schema management explicitly. Drizzle manages application tables; pg-boss manages queue tables through its supported migration mechanism. Do not hand-edit queue internals. Record migration ordering and required roles. Application/request startup must not automatically mutate the production schema.

### C. API health and development harness

Implement:

```http
GET /api/v1/health/live
GET /api/v1/health/ready
POST /api/v1/dev/test-jobs
GET /api/v1/dev/test-jobs/:id
```

Health behavior:

- Liveness reports whether the API process can serve requests, without depending on an upstream weather service.
- Readiness is HTTP 200 only when required database/schema and queue initialization checks pass. Use bounded queries/timeouts. Return HTTP 503 for a dependency failure; do not expose credentials, SQL internals, or stack traces.
- Worker readiness/liveness must also be observable through a documented process/heartbeat mechanism. Do not claim the worker is healthy merely because the API is healthy.

Development harness behavior:

- Register the test-job routes only in explicit development/test mode with the harness enabled. They must be absent in production and return 404. Production configuration enabling the harness must fail startup.
- Protect harness routes with a development-only secret token, validate it server-side, and redact it from logs. Keep it out of frontend bundles. The frontend does not submit harness jobs.
- Use a documented finite Zod payload such as an `echo` operation with a bounded message. Use no real farmer information. Unknown operations and malformed/oversized inputs are rejected.
- A valid submission requires an idempotency key and returns HTTP 202 with a durable run ID. Repeating the same key and normalized input returns the same run. Reusing it with different input returns a clear conflict. Scope and document the key's uniqueness.
- Save the ledger row and enqueue the job in one transaction using pg-boss's supported transaction integration. If enqueueing fails, neither the job nor a misleading accepted row may remain.
- Lookup returns persisted `queued`, `running`, `completed`, or `failed` state, and synthetic output only when completed. Unknown IDs return 404. Error responses use safe structured codes.

These routes are an internal development/test harness, not temporary crop advice or fake `/plans` endpoints. The future real planning contract is not implemented in this step.

### D. Separate worker and durable processing

Use one server codebase with separate API and worker entry points. Run the worker as a distinct process. The API never executes queued jobs directly or creates an unawaited in-process task as a durability substitute.

Process the synthetic operation into a deterministic output marked as an infrastructure fixture. Use a unique result constraint and idempotent transaction for completion. Persist safe failure state correctly after exhausted retries; keep retryable failures distinct from terminal failures. Avoid contradictory permanently stuck application statuses when the queue retries or expires work. Use supported queue APIs and a documented lifecycle/reconciliation mechanism.

Implement bounded retries, appropriate job lease/expiration/recovery settings, and graceful shutdown. Verify the exact behavior of the pinned pg-boss release. Do not claim the system provides general exactly-once execution. Prove repeatable processing cannot duplicate the authoritative result.

Controlled transient failure, terminal failure, and crash scenarios belong in the test harness or test worker configuration, disabled in production. Observe actual processing milestones before injecting a crash; do not rely on arbitrary sleep timing to manufacture a passing recovery test.

### E. Minimal frontend

Create a small React/Vite page that displays Rotavise's development environment and actual API availability. It must show loading, ready, unavailable, and stale/error behavior accurately. Use shared schemas to validate the health response. Configure the API origin/proxy without embedding server secrets.

Include a useful accessible label and retry action. Do not build the crop form, map, result timeline, marketing site, or pretend planning UI. Browser acceptance checks verify real health behavior, not a hard-coded green badge.

### F. CI, containers, and documentation

Add a production server container build with a non-root runtime, explicit API/worker start commands, and reproducible installs. Do not deploy it externally. Verify the compiled image can start in production mode against a migrated local disposable database. Test-job routes must not exist there.

GitHub Actions configuration runs the same required checks using real PostgreSQL. If CI cannot be dispatched because no remote repository is available, test equivalent commands locally and state **remote CI execution unverified**. Do not claim the workflow passed remotely.

Provide root scripts with these behaviors; implement them honestly:

```text
pnpm db:up               start local PostgreSQL
pnpm db:migrate          apply application and required queue migrations safely
pnpm dev                 run local API, worker, and frontend with documented setup
pnpm lint                lint maintained source
pnpm format:check        verify formatting
pnpm typecheck           check all current packages
pnpm test:unit           run meaningful unit tests
pnpm test:integration    run PostgreSQL/API/queue integration tests
pnpm test:recovery       run deterministic process-crash and retry tests
pnpm test:e2e            run real browser health acceptance tests
pnpm build               compile deployable artifacts
pnpm verify              run the required gate in a reproducible order
```

Document prerequisites, environment setup, ports, exact commands, migration workflow, container verification, and non-destructive shutdown. Development-data removal must be explicit; never reset unrelated databases or volumes. Test cleanup may destroy only the disposable resources created by that test run.

## Acceptance matrix

Record each item as PASS, FAIL, or BLOCKED with actual evidence in `docs/steps/01-report.md`.

| ID | Required behavior | Verification |
| --- | --- | --- |
| F01 | Clean reproducible installation | Frozen lockfile installation and build in a clean temporary checkout/copy without generated artifacts |
| F02 | Strict runtime configuration | Missing/malformed config tests fail safely; no secret values in error output |
| F03 | Real migrations | Apply to fresh PostgreSQL and rerun safely; application constraints exist |
| F04 | Genuine health checks | Real database failure changes readiness to 503 while liveness remains distinct |
| F05 | Validated protected harness | Malformed/oversized input and missing/incorrect token rejected |
| F06 | Atomic acceptance | Controlled enqueue failure rolls back acceptance and leaves no orphan ledger row |
| F07 | Idempotent submission | Sequential and simultaneous identical submissions resolve to one run; changed input conflicts |
| F08 | Durable result | Completed synthetic output remains after API restart |
| F09 | Transient recovery | A controlled transient error retries and completes without duplicate result |
| F10 | Terminal failure | Exhausted retries produce a stable failed state and safe error |
| F11 | Process-crash recovery | Kill the actual worker after processing begins, restart it, and observe one authoritative result within a bounded deadline |
| F12 | Duplicate completion safety | Repeated completion/processing cannot add a second result or corrupt terminal state |
| F13 | Observable worker and shutdown | Worker health/progress evidence, graceful shutdown, and queued work recovery verified |
| F14 | Frontend tells the truth | Playwright checks ready, unavailable, loading/retry behavior against the API |
| F15 | Production isolation | Compiled production container starts; test-job routes return 404; enabling harness in production fails configuration |
| F16 | Quality gate | Lint, formatting, typecheck, unit/integration/recovery/browser checks, and production build all actually run and pass |
| F17 | Dependency review | Record stable pinned versions, inspect runtime advisories, fix relevant high-severity issues or explain any unresolved blocker without suppressing it |
| F18 | Reviewable documentation | README, decisions, progress, demo commands, and acceptance report agree with actual implementation |

Tests use isolated real PostgreSQL. Mocking a controlled queue enqueue failure at an adapter boundary is allowed for fault injection, but transaction/recovery success must also be demonstrated with the real queue. Keep all failure injection explicitly test-only.

Recovery tests must use process control, observed state transitions, and bounded polling. They must not mock the crash, set “completed” directly, or replace pg-boss with an in-memory queue. Missing Docker or restricted network access is a reportable environment blocker, not a reason to substitute SQLite or fake results.

## Review report and stop condition

Deliver `docs/steps/01-report.md` containing:

1. What changed and why, including the deliberate use of an infrastructure harness instead of unfinished real planning endpoints.
2. Exact runtime, package, and database versions plus relevant official references.
3. The actual check commands, results, and concise evidence; distinguish local execution from unrun remote CI.
4. A PASS/FAIL/BLOCKED acceptance matrix.
5. Exact clean-run and demo commands for the user.
6. Failure/recovery observations and any operational limits.
7. Remaining work outside Step 01, including real input ownership, crop data, weather, full planning, deployment, and agricultural validity.
8. Status: `READY_FOR_REVIEW` only if required local acceptance checks pass; otherwise `BLOCKED` or `NEEDS_FIXES`.

`docs/PROGRESS.md` must state **Step 01: awaiting user review; Step 02: not authorized** when ready. Do not invent approval history or continue automatically. Correct requested defects within Step 01, then ask the user to review again.
