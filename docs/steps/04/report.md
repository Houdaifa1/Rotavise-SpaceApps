# Step 04 review — private farmer request intake

Status: **READY_FOR_REVIEW** — P01–P12 passed. This is component readiness, not user approval or whole-product launch readiness.

## What was built

The backend accepts and privately stores farmer inputs, identifies their anonymous
owner, protects access, expires/deletes data and processes a durable intake job.
Inputs include crop/disease/pest history, soil, water, considered/excluded crops,
planting flexibility and priority. Unknowns and unsupported crop IDs remain visible.

The worker verifies the stored request and pinned real catalog. It does not
calculate rotations. Its result explicitly says `kind: request_intake`,
`planning: not_implemented`, `recommendations: null`, `weather: not_requested`.
`completed` means **intake completed**, not a completed agricultural plan.
The calculation engine starts in Step 05; complete planning API/UI follow later.

Implemented responsibilities:

- Shared strict Zod request/session/evidence/status contracts under `contracts/plans`.
- `plans` module with HTTP, ownership/storage/policy and intake worker; application
  code imports no Nest/Fastify. Existing composition shares one pool/queue.
- Reviewed Drizzle migration `0004_plan_intake.sql`: owners, requests, unique
  results and shared quotas. Custom triggers protect accepted content and terminal
  states; deferred triggers enforce committed state/result consistency.
- Atomic request/enqueue and result/completion transactions. Queue payload is only
  `{requestId}`. Input/catalog hashes are reverified before completion. Broken
  transaction connections are destroyed after failed rollback.
- Owned read/delete, session revocation, database-clock expiry and bounded worker
  cleanup/reconciliation. Enabled readiness checks the new tables and queue.
- 28 unit, 24 real PostgreSQL/HTTP integration and 5 process-recovery tests (57).
  `pnpm test:plans` and the full `pnpm verify` gate include them.
- Clearly synthetic local demo with private access checks and cleanup. Fixed the
  dev supervisor's environment precedence so explicit shell flags override `.env`
  defaults. Existing `.env` and secrets were preserved.
- Code review found that an older quota request could reset a newer window.
  Quota updates now keep the window monotonic; a controlled-order SQL test covers
  the race. The final complete verification gate passed after this concrete fix.

## API and decisions

| Endpoint                                | Behavior                                                      |
| --------------------------------------- | ------------------------------------------------------------- |
| `POST /api/v1/plan-sessions`, JSON `{}` | 201; new anonymous bearer credential and expiration           |
| `POST /api/v1/plans`                    | Bearer + Idempotency-Key; 202 with ID, expiry and Location    |
| `GET /api/v1/plans/:id`                 | Owned intake status, normalized input, pinned evidence/result |
| `DELETE /api/v1/plans/:id`              | Owned deletion; 204                                           |
| `DELETE /api/v1/plan-sessions/current`  | Revoke session and cascade private input/results; 204         |

Routes are omitted unless `PLANS_ENABLED=true`. There is no listing or token-in-URL
access; query parameters are rejected. Missing/invalid/expired credentials return
401; foreign/missing/expired request IDs share 404. Responses use no-store headers.

Credentials contain 32 random bytes encoded as 43 base64url characters. PostgreSQL
stores only a domain-separated SHA-256 hash. Credentials/field details are absent
from queue payloads and logs. Anonymous credentials expire after seven days;
requests after at most one day, capped by owner expiry. Lost credentials are not
recoverable. Browser handling belongs to the later UI.

Owner locks serialize acceptance against revocation/concurrent submissions.
Idempotency hashes normalized input using sorted object keys and unordered
selection/history/observation collections, with code-point ordering. It is scoped
to the owner and retained request lifetime. Deletion/cleanup removes the receipt;
reuse afterward may create a new request. Repeats retain the original catalog even
after configuration or imported releases change. Weather IDs are empty and
engine/ranking versions null, not invented.

Operational bounds, not crop suitability thresholds:

- Body 32 KiB; histories/health observations 20; soil metrics 3; considered crops
  10; exclusions 20. pH/organic-matter input bounds describe representation only.
- Two cycles; at most 366-day planting flexibility and 1096-day search horizon.
  First starts are today or later, with latest start within 366 days of DB UTC today.
  Future observations are rejected. Unknown history dates remain null;
  completeness describes the reported crop-history coverage.
- Shared DB quotas: 120 HTTP calls/IP/minute, 20 sessions/IP/hour, 20 retained
  requests/owner. Existing idempotent repeats do not take another request slot.
  Retry-After is conservative for the limiting policy. IP-derived quota keys are
  hashed, not claimed anonymous/irreversible. No proxy headers are trusted;
  ingress peers therefore share a quota until trusted-proxy design is reviewed.
- Each worker cycle removes up to 100 expired requests, 100 owners (with bounded
  request cascades), 100 quota keys and reconciles up to 100 pending requests.
  Expired access is blocked independently of physical cleanup. Late completion
  cannot recreate deleted data; expiry during completion rolls back the result.
- Intake queue: two retries, one-second delay, ten-second active expiration,
  0.5-second polling, one-second supervision, 86400-second retention/deletion.
  Future long calculations need reviewed settings. One authoritative result is
  tested; general exactly-once delivery/external effects are not claimed.

Health observations are farmer-submitted provenance, including claimed specialist/
laboratory confirmation; this step does not independently certify diagnoses.

## Exact versions and compatibility

No third-party dependency/pin or lock changed. Official
[Node 24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html),
[Zod schemas](https://zod.dev/api), [Nest controllers](https://docs.nestjs.com/controllers)
and [pg-boss job APIs](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/jobs.md)
were checked against installed declarations and actual compilation/runtime tests.
Current reference documentation does not imply an untested dependency upgrade.

| Dependency/runtime                          | Exact version                       |
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

| Command/check                                                | Observed result                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @rotavise/database exec drizzle-kit generate` | Generated migration/metadata; later regeneration reported no schema changes                                                                 |
| `pnpm build:server`                                          | Exit 0                                                                                                                                      |
| `pnpm test:plans`                                            | First 52 passed; expanded run 56 passed in 30.657 seconds; final full gate passed all 57                                                    |
| `pnpm lint`                                                  | Exit 0                                                                                                                                      |
| `pnpm install --frozen-lockfile`                             | Exit 0, unchanged lock, pnpm 12.6.0                                                                                                         |
| `pnpm audit --prod --json`                                   | Exit 0, zero known advisories; dated registry observation                                                                                   |
| `pnpm db:up`, `pnpm db:migrate`                              | Healthy PostgreSQL; MIGRATIONS_APPLIED                                                                                                      |
| `pnpm catalog:demo`                                          | Real existing 0.1.0 snapshot unchanged, research gaps retained                                                                              |
| `PLANS_ENABLED=true pnpm dev`, `pnpm plans:demo`             | API/worker/Vite started; real private intake demo passed; both temporary sessions revoked                                                   |
| Ctrl-C, `pnpm db:down`                                       | API/worker graceful exit 0; development volume preserved                                                                                    |
| `pnpm verify`                                                | Exit 0 on final code: 202 tests, production containers and frozen clean-copy install/build; earlier gate passed 201 before quota regression |

The final gate ran 16 foundation unit, 8 foundation integration, 5 foundation
recovery, 60 weather, 54 catalog, 57 intake and 2 Chromium tests: **202 passed**.
Lint, formatting, strict types and complete builds passed. Non-root production
API/worker containers verified private intake, real durable completion, readiness,
graceful shutdown and rejection of unsafe test configuration. Frozen clean-copy
installation/build passed without generated artifacts. The final local log is
`.artifacts/step-04-verify-final.log`; remote CI was not run.

`pnpm peers check` returned exit 0 with no peer dependency issues. Read-only byte
comparisons confirmed all 44 selected prior source/catalog/evidence/migration/lock
files unchanged. Final documentation formatting, local link checks and
`git diff --check` passed. The earlier exploratory
`pnpm explain peer-requirements` command was unsupported; the supported peer check
above replaced it. System Git requires the unaccepted Xcode license; repository
checks and the local commit use the available bundled Git binary.

Tests include actual after-enqueue/result rollback, SQL-lock cancellation, database
outage/restart, shared quota concurrency, corruption and expiry injection, and
SIGKILL after observed processing. Recovery must finish within 40 seconds with two
attempts and one result. Controlled faults require test mode, enabled harness and
plans; production rejects them. Privileged trigger bypasses exist only in explicit
corruption/expiry tests against disposable databases. Catalog cleanup now truncates
the dependent request/result tables as required by real foreign keys; no assertion
or validation was removed/weakened. No application failure was suppressed.

Final documentation checks (all exit 0):

`pnpm exec prettier --check README.md docs/steps/04/STEP_04.md docs/steps/04/report.md docs/steps/04/demo.json docs/PROGRESS.md docs/DECISIONS.md docs/specification/GOALS.md docs/architecture/structure.md`.
Inline `node --input-type=module` assertions verified 38 local Markdown links,
P01–P12 PASSED entries and READY_FOR_REVIEW in all three status documents.
`/Users/houdaifadrahm/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git diff --check`
returned exit 0.

## Demo and exact verification

From `/Users/houdaifadrahm/projects/Rotavise`:

```sh
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm catalog:demo
PLANS_ENABLED=true pnpm dev
```

In another terminal in that directory:

```sh
pnpm plans:demo
```

Stop development with Ctrl-C, then:

```sh
pnpm db:down
pnpm test:plans
pnpm verify
```

[Recorded synthetic demo](demo.json): request `2040b1f3-9298-47c6-a218-9f3afae35805`,
one attempt; repeat retained its ID; other owner 404, anonymous 401, owned deletion
204, subsequent read 404. Catalog UUID/hash is the original real Step 03 snapshot.
Demo input/results/sessions were deleted. No NASA call or crop advice was produced.

## Acceptance matrix

Criteria: [STEP_04.md](STEP_04.md).

| ID  | Status | Evidence                                                                                      |
| --- | ------ | --------------------------------------------------------------------------------------------- |
| P01 | PASSED | 28 contract/policy tests plus invalid/oversize HTTP cases                                     |
| P02 | PASSED | Random credentials, hash-only SQL, invalid/expired ownership and logs                         |
| P03 | PASSED | Foreign read/delete equivalence, no listing/query access, shared quotas                       |
| P04 | PASSED | Twelve concurrent accepts, normalized repeat, conflicts, real enqueue rollback                |
| P05 | PASSED | Pinned real/new release isolation, absent/corrupt catalog and explicit missing engine/weather |
| P06 | PASSED | Repeat migrations, immutable data/terminal state, deferred result consistency                 |
| P07 | PASSED | ID-only payload, unique completion, retry/exhaustion/cancellation, production fault rejection |
| P08 | PASSED | SIGKILL/restart; deletion while processing does not resurrect data                            |
| P09 | PASSED | Expiry before cleanup, owner cap/cascade and completion expiry rollback                       |
| P10 | PASSED | SQL-lock timeout, DB outage/recovery, readiness/missing table, disabled routes                |
| P11 | PASSED | Full 202-test gate, non-root production API/worker, frozen clean-copy install/build passed    |
| P12 | PASSED | READY_FOR_REVIEW report, decisions, progress, exact commands/demo and limitations recorded    |

## Limitations

This is request intake, not a production-ready agricultural product. All three
crop profiles still return insufficient evidence. No rotation engine, ranking,
irrigation adequacy, diagnosis, greenhouse integration, farmer UI, accounts or
external deployment was implemented. Photo/greenhouse goals remain Steps 11–12.

Public launch still requires the engine/API/UI, agronomic review, HTTPS ingress,
trusted-proxy/abuse/load review, browser credential handling, restricted DB roles,
backup/restore and retention operations. Tokens are hashed; field data is not
independently encrypted beyond database/storage controls. Database owners can
bypass triggers. Worker outages postpone physical cleanup although expired access
is denied. Backup erasure/public capacity/remote CI were not verified.

Stop after Step 04. Step 05 requires an explicit user instruction.
