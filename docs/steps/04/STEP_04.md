# Step 04 — private farmer request intake

Authorized by the user's “go ahead” after the Step 04 explanation. Deliver this
step only; the rotation engine, ranking and farmer UI remain Steps 05–08.

## Deliverable

Strict shared farmer-input contracts; anonymous owner sessions; owned request
creation/read/delete and session revocation; pinned catalog evidence; real
PostgreSQL migrations; transactional durable intake jobs; idempotent worker
completion/recovery; expiration enforcement and bounded cleanup; automated checks
and a reproducible demo. Routes are disabled by default until explicitly enabled.

The worker performs real request-integrity and catalog-integrity verification.
`completed` means **intake completed**, with `planning: not_implemented` and no
recommendations. Weather has not been requested at this stage. No fake rotation,
agricultural assessment, artificial weather or placeholder recommendation is returned.

## Files and boundaries

- `packages/contracts/src/plans/`: strict runtime request/session/status contracts.
- `packages/database/src/schema/` and committed Drizzle migrations: owner sessions,
  private requests, intake results and shared quota counters.
- `apps/server/src/modules/plans/`: HTTP, ownership/storage and intake worker.
- Existing API/worker/health/queue/config composition: feature registration,
  real queue installation, readiness and bounded housekeeping.
- `tests/unit/plans.test.mjs`, `tests/integration/plans.test.mjs`,
  `tests/recovery/plans.test.mjs`: contracts, real SQL/HTTP and process recovery.
- `tooling/plans/`: clearly labeled synthetic demo input and executable local demo.
- README, structure guide, decisions, progress and this step's report.

Use installed compatible Node 24, Nest/Fastify, Zod, Drizzle, PostgreSQL 18 and
pg-boss. No new external dependency is required for these operations. Verify
official APIs against installed declarations and actual build/runtime behavior.

## Acceptance matrix

| ID  | Requirement and required evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P01 | Strict bounded input: coordinates; dated crop history with completeness; dated disease/pest observations with source/confirmation/unknown; soil units/methods/unknown; water availability; bounded two-cycle start/search dates; considered/excluded crops and priority. Reject impossible dates, contradictory/duplicate choices, overlapping history, inconsistent confirmation, unexpected properties and oversize payloads. Unsupported crop IDs remain representable; no geographic marketing boundary. |
| P02 | Server-generated 256-bit anonymous bearer credentials; only hashes stored; expiry enforced using PostgreSQL time; no token in URLs, logs, queue data or persisted request/result. Missing/invalid/expired credentials are rejected.                                                                                                                                                                                                                                                                          |
| P03 | Cross-owner lookup/delete and nonexistent/expired IDs return the same 404. No public listing. No-store response headers; strict parameters/query handling; bounded shared PostgreSQL quotas.                                                                                                                                                                                                                                                                                                                 |
| P04 | Owner-scoped idempotency and normalized input identity. Identical repeat/concurrent POST retains one request/job/evidence reference; changed input conflicts. Real enqueue failure after insertion rolls back both request and queue row.                                                                                                                                                                                                                                                                    |
| P05 | Pin and verify an existing immutable catalog snapshot ID/version/hash at acceptance. Missing/corrupt catalog fails honestly; unsupported crops and unknown inputs are preserved. Worker verifies the pinned snapshot, not a newly imported replacement. Weather/engine evidence is explicitly absent at intake.                                                                                                                                                                                              |
| P06 | Real migrations and SQL consistency constraints; invalid states/terminal timestamps/results rejected; accepted input/evidence immutable. Read corruption is rejected with safe errors.                                                                                                                                                                                                                                                                                                                       |
| P07 | Queue payload contains only request ID. Worker validates stored input/hash and pinned catalog; durable intake completion stores one result. Duplicate deliveries, retry, exhausted failure and terminal queue anomalies produce tested explicit outcomes. Controlled faults are available only in the test harness and rejected in production.                                                                                                                                                               |
| P08 | SIGKILL after processing begins, restart, durable recovery and one result; queued expiry/deletion cannot recreate a request or private result.                                                                                                                                                                                                                                                                                                                                                               |
| P09 | Requests expire no later than the owner's session. Expired access fails before cleanup; bounded worker cleanup physically removes private rows/results and expired owners/quota rows. Owned deletion/session revocation removes private data and remains race-safe with worker completion.                                                                                                                                                                                                                   |
| P10 | Real SQL-lock timeout, database outage/recovery and API/worker readiness failure; safe HTTP errors without credentials, payloads, SQL or stack traces. Enabled feature checks its schema/queue, disabled routes return 404.                                                                                                                                                                                                                                                                                  |
| P11 | Full existing verification gate plus new checks, frozen clean installation/build and non-root production container coverage. No removed/weakened tests or suppressed errors.                                                                                                                                                                                                                                                                                                                                 |
| P12 | Exact versions, actual commands/results, demo, limitations, acceptance matrix and READY_FOR_REVIEW in report/decisions/progress. Stop after Step 04; no later implementation is authorized.                                                                                                                                                                                                                                                                                                                  |

Policy bounds are operational/product limits, not invented agronomic thresholds.
Document their values and limitations, including bearer-token loss, queue retention,
cleanup dependence on a running worker, and ingress/load review before public launch.
