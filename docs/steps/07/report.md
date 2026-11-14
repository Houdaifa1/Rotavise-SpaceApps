# Step 07 — accounts, history and full backend

2026-09-28. **READY_FOR_REVIEW — Step 07 component acceptance passed.**
[Acceptance](STEP_07.md) · [Methods and primary sources](methods.md).
Step 08, external email sending and deployment were not started.
This status is for the Step 07 component; the product is not ready for public release.

## Built

- Optional verified email/password accounts: login/logout, recovery, password
  change, expiring/revocable sessions and verified account deletion. Native Better
  Auth/Fastify/Drizzle; Argon2id; HttpOnly cookies, strict origins/input and shared
  quotas. Account IDs never come from farmer-supplied ownership fields.
- Encrypted transactional mail outbox; separate worker sends SMTP with bounded
  retries/leases. Disposable Mailpit proves real SMTP delivery without contacting
  people. Enqueue failure rolls back signup and returns an error.
- Owned fields, dated crop history and plan history; pagination, bounded records,
  version-checked edits and cascading deletion. Guest access remains temporary.
  Explicit guest claims require both live proofs/recent login; repeat transfers
  preserve request/input/evidence/result identity.
- Complete API → queue → worker → calendar → required weather → pure calculation
  → immutable persisted result. Progress stages, operational failure codes, weather
  checkpoints, version pins, recovery/idempotency and late-worker fencing.
- Main/tied choices and up to two alternative crop pairs **per comparable group**;
  rejected/unranked choices and reasons remain visible. Many two-cycle sequences
  can be compared; there is no universal winner across incompatible evidence.

The real three-crop catalog still lacks reviewed calendars/durations/rules and
trusted regional/cultivar/health context. Real jobs complete with explained
`insufficient_evidence`, no schedules and no recommendations. Clearly labeled
synthetic fixtures exercise scheduling/weather/ranking privately; production
rejects them. Saving field history does not verify it or silently change a plan.

## Files and versions

Server features: `modules/auth`, `modules/fields`, `modules/plans`; composition,
configuration, health and queue wiring. Shared field/planning contracts; pure
comparison selection; database auth/field/planning schemas. Reviewed migrations
`0005_backend_workflow.sql` and `0006_bounded_auth_maintenance.sql`; migrations
0000–0004 remain unchanged. Tests/demos/SMTP Compose/CI and current docs updated.
No frontend behavior changed.

New stable pins actually installed: Better Auth **1.7.6**, Drizzle adapter **1.7.6**,
native Argon2 **2.2.1**, Nodemailer **10.0.11**, mail types **8.0.2**. Scoped legacy
esbuild override **0.28.2** fixes the audit finding rather than excluding it.
Mailpit **1.31.3**, image digest
`sha256:ed9b00c609e77e99c79b93f1178255ebc271868920f2c69a8d166bd5634ed10d`.
Approved Node **24.19.0**, pnpm **12.6.0**, PostgreSQL **18.4** and existing stack
remain. [All exact direct versions](../../DECISIONS.md#exact-versions), manifests
and committed lockfile record reproduction; no alternative framework was needed.

## Verification

| Command                                                      | Actual final result                                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` (clean copy/container)      | Passed: exact locked dependencies installed                                                                                                                       |
| `pnpm --filter @rotavise/database exec drizzle-kit generate` | Passed after esbuild fix; no unexpected schema changes                                                                                                            |
| `pnpm verify`                                                | Reassessment passed, exit 0: **432 Jest + 2 Chromium = 434 tests**; lint/format/types, builds, production container and clean install/build                       |
| `pnpm test:backend`                                          | Reassessment gate passed 33/33 in 29.0 seconds                                                                                                                    |
| `pnpm test:container` (inside verify)                        | Passed: real catalog import, Linux native Argon2id, guest/full workflow, protected weather, non-root processes, graceful exit and production test-route rejection |
| `pnpm test:clean` (inside verify)                            | Passed: separate clean copy, frozen install and full server/web build                                                                                             |
| `pnpm peers check`                                           | Passed: no peer dependency issues                                                                                                                                 |
| `pnpm audit --prod`                                          | Passed: no known vulnerabilities                                                                                                                                  |
| `pnpm backend:demo`                                          | Reassessment passed: five real account/history/planning/claim/logout demonstrations                                                                               |

Tests use actual PostgreSQL, native auth HTTP/session behavior, disposable SMTP,
atomic rollback/concurrent claims/edits, account deletion, weather checkpoint
retries and separate worker processes including SIGKILL. Synthetic failures and
lease expiry are controlled in disposable databases: this does not measure an
uninterrupted fifteen-minute production lease expiry or intended public load.

An earlier backend run had 30/31 pass, one signup 503 and a 905-second elapsed
time. Account-only rerun passed in 7.6 seconds; combined rerun passed 31/31 in
25.8 seconds. The first run's exact infrastructure cause was not captured and
has not been established. Safe failure classification was added without logging
credentials, SQL or email. Final verification results are recorded separately;
the initial failure is not erased or claimed to have passed.

### 2026-09-28 signup reassessment

The old failure cannot be assigned a root cause from its logs: they recorded a
503 but no failing stage or database error code. The updated backend suite passed
33/33. Signup now logs a fixed endpoint, failure stage and safe category;
Better Auth's `FAILED_TO_CREATE_USER` response also emits a safe diagnostic.
These diagnostics omit email, password, token and SQL values.

Two controlled PostgreSQL failures exercise these paths without fake database
behavior. A locked target quota row causes a database statement timeout: that
signup returns 503 without an account, a different signup succeeds during the
lock, and retry succeeds when the lock is released. A temporary user-table check
constraint causes user creation to fail: the HTTP response is a generic 503,
with no user and no private database details in the captured log. The existing
outbox rollback test still checks failure after account insertion. These tests
prove bounded behavior for the injected cases. They do not prove the cause of
the old 905-second run or uptime under public load.

Regression fixes preserved assertions: update disposable cleanup for new foreign
keys; preserve the old 404 when account history is disabled; use valid expired
fixture timestamps without disabling constraints. Malformed redirects return 400;
valid trailing-slash auth URLs normalize to their origin. Those cases passed after
rebuilding. No test was removed or validation weakened.

Local logs: `.artifacts/step-07-backend.log` (initial regression),
`step-07-accounts-diagnosis.log`, `step-07-backend-validated.log`,
`step-07-verify-release.log`, `step-07-demo-final.log` and
`step-07-reassessment-verify.log` and `step-07-reassessment-demo.log`. These
generated logs are ignored; this report is the committed evidence.
Remote CI has not run.

## Demo and exact verification

```sh
cd /Users/houdaifadrahm/projects/Rotavise
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm verify
pnpm peers check
pnpm audit --prod
pnpm backend:demo
```

Docker must be running; Node/pnpm pins above must resolve. Stop `pnpm dev` first
for browser ports. Demo creates/removes its own databases/inbox and processes:
signup → SMTP verification → cookie login → save field/history → full real-catalog
assessment → temporary guest plan → atomic account claim/repeat → history → logout.
The honest demo outcome is insufficient agricultural evidence.

For persistent local use, follow [README](../../../README.md#run-locally).
No real SMTP credentials or secrets are required by the disposable demo.

## API review

| Interface                                                                                                      | Access/behavior                                                               |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST `/api/auth/sign-up/email`, `sign-in/email`, `sign-out`                                                    | Strict JSON; trusted Origin; verified contact before login                    |
| POST `/api/auth/request-password-reset`, `reset-password`, `change-password`, `revoke-sessions`, `delete-user` | Native recovery/revocation/deletion; token links expire                       |
| GET `/api/v1/account`                                                                                          | Verified cookie session; no bearer token in response                          |
| `/api/v1/fields`, `/:id`, `/:id/history`, `/:id/history/:entryId`                                              | Account-owned create/read/update/delete; expectedVersion on edits             |
| POST `/api/v1/plan-sessions`                                                                                   | Temporary guest bearer; revoke via DELETE `/current`                          |
| POST `/api/v1/plans`; GET/DELETE `/:id`                                                                        | Account cookie or guest bearer; idempotency-key on creation                   |
| GET `/api/v1/plans?limit=20&cursor=UUID`                                                                       | Private account history, maximum 50 per page                                  |
| POST `/api/v1/plans/:id/claim`                                                                                 | Cookie + guest bearer + trusted Origin + recent login + `{ "confirm": true }` |

Full status includes input, intake evidence, pinned versions, stage, snapshot IDs,
result or operational error. Full result's `processing` describes this workflow;
the nested component assessment retains older scope/deferred markers. Existing
intake-only records keep their original contract and remain readable.

## Acceptance and release limits

| Criteria                              | Status  | Evidence/limit                                                                                                                                          |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 dependencies/migrations           | PASSED  | Stable exact pins installed; peers/audit/build/Drizzle generation; real repeatable migrations                                                           |
| B02–B03 authentication/mail           | PASSED  | Native HTTP/session/recovery/origin/cookie checks; encrypted atomic outbox and real SMTP/retries                                                        |
| B04–B05 ownership/history/claims      | PASSED  | Owner isolation, concurrent edit/claim, fresh and expired proofs, retention/deletion                                                                    |
| B06–B08 complete workflow/comparisons | PASSED  | Full worker/evidence/pure engine/result path; private labeled fixtures exercise weather/ranking; real evidence gaps preserved                           |
| B09–B10 recovery/bounds/errors        | PASSED  | Actual worker crash/restart, checkpoint retries, stale leases/deletion fences; bounded work and separate operational failures                           |
| B11 real integration checks           | PASSED  | 33 backend tests plus retained earlier suites; PostgreSQL/SMTP/processes are real                                                                       |
| B12 complete verification/report      | PASSED  | 434 tests, Linux production container, clean frozen build and current demo; peers/audit passed before reassessment with unchanged dependencies          |
| A01 real agricultural recommendations | BLOCKED | Missing reviewed local rules and trusted geography/cultivar/health evidence                                                                             |
| A02 public production release         | BLOCKED | Farmer UI, real email domain/deliverability, agronomic/security/load review, role separation, backup/restore and production retention review unverified |

Policies: seven-day sessions; guest request one day; account plans 365 days;
30 fields/account, 500 history entries/field, 200 retained plans/account. No silent
history import into planner inputs. Irrigation adequacy stays unknown. Historical
differences are not forecasts; coverage policies/weights are uncalibrated.
SMTP can duplicate after acceptance followed by a crash; retries reuse Message-ID.
Pending outbox mail must drain before rotating its encryption secret. Account
deletion removes owned records; shared immutable catalog/weather evidence remains.
Its location retention requires production privacy review.

Stop at Step 07. Passing checks do not authorize Step 08 or deployment.
