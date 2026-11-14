# Step 02 review report

Status: **READY_FOR_REVIEW**. All ten acceptance items passed.

The original implementation evidence below predates the authorized structure
refactor. Current file paths, refactor regression results and run commands are
in the [structure review](structure-review.md), [structure guide](../../architecture/structure.md)
and [root README](../../../README.md). Historical executed commands are retained
as they were run.

Authorization: the user said “Okay, go ahead” after discussing the flexible
historical-weather backend. Only Step 02 is implemented. This is component
verification, not a claim that the complete startup product is launch-ready.

## In simple terms

- The backend can now ask for past weather at a location over a date range.
- The caller chooses minimum, maximum or mean temperature, precipitation, or any
  combination of those four supported variables. A capabilities route tells a
  later frontend what is supported and what the units and limits mean.
- NASA supplies real weather data. The backend checks it and saves its source,
  API version, access time, units, completeness and original response.
- Repeated identical requests reuse PostgreSQL data. Refresh creates a new
  snapshot; old evidence cannot be overwritten by application code.
- Missing weather stays missing. Supplier failures return errors. The backend
  never converts either into zero rainfall, crop suitability or advice.
- Weather routes are internal and protected. The frontend remains the real
  backend-health page. No crop planner or farmer account has been built.

Overall progress: the application foundation and historical-weather component
are built. Crop evidence/catalog, farmer request ownership, calculations,
ranking, planner UI, regional validation and deployment remain future work.
There is no meaningful percentage-complete estimate from these two milestones.

## Files and choices

| Area                                                                    | Files                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Milestone scope                                                         | docs/steps/02/STEP_02.md                                                                                                                                                      |
| Shared runtime weather contracts                                        | packages/contracts/src/weather/weather.contract.ts and index.ts                                                                                                               |
| Provider adapter, normalization, stable evidence hashing, cache service | apps/server/src/modules/weather/; common/serialization/stable-json.ts                                                                                                         |
| Internal HTTP routes and validated settings                             | apps/server/src/modules/weather/weather.controller.ts; config/environment.ts; .env.example                                                                                    |
| Real cache/snapshot tables and immutable trigger                        | packages/database/src/schema/weather.schema.ts; packages/database/migrations/0002_weather_snapshots.sql and metadata                                                          |
| Required checks                                                         | tests/unit/weather.test.mjs; tests/integration/weather.test.mjs; tests/support/fixtures/weather-owner.mjs; tooling/verification/; package.json; .github/workflows/verify.yaml |
| Live demo and repeatable evaluation                                     | tooling/weather/demo.mjs, evidence.mjs, compare.mjs                                                                                                                           |
| Provider decision and exact response evidence                           | docs/decisions/weather-provider.md; docs/evidence/weather/2026-09-26/                                                                                                         |
| Review and run instructions                                             | README.md, docs/DECISIONS.md, docs/PROGRESS.md, this report                                                                                                                   |

The approved architecture and exact lock remain unchanged. No new dependency
was introduced. Runtime versions: Node 24.19.0, pnpm 12.6.0, NestJS 12.1.0,
Fastify 5.12.5, Zod 4.6.5, PostgreSQL 18.4, Drizzle ORM 0.45.3 / Kit 0.31.11,
pg 8.23.0, pg-boss 12.35.0, React 19.3.0 / Vite 8.3.1, TypeScript 6.0.3.
The complete tooling/type-package pins are in DECISIONS.md and the lockfile.
Native Node fetch avoids adding an HTTP dependency. Actual build, frozen install,
runtime and database checks establish compatibility for this component.

NASA POWER daily point AG, explicit UTC, was selected after comparing fixed
Open-Meteo ERA5. NASA's required parameters and source metadata worked, and the
NASA-managed registry supports commercial reuse with attribution without a paid
hosted subscription. Open-Meteo's commercial historical hosted service requires
Professional or above. The [decision record](../../decisions/weather-provider.md)
links current primary sources and gives exact requests, sample differences and
scientific/service limitations. Neither provider is declared universally best.

## Implementation behavior

Request: numeric WGS84 latitude/longitude, real inclusive calendar start/end,
unique supported variable list, no unknown fields. Maximum 366 days; earliest
1981-01-01; latest allowed date is 120 UTC days before today. This lag is a
conservative application policy, not a supplier completeness guarantee. UTC
weather days are deliberately different from future local crop-cycle dates.

Values: temperature degC; precipitation mm per UTC day, with original mm/day
recorded. NASA -999 and missing dates become null. Missing coverage is listed
per variable and `complete=false`. Unexpected dates, units, sources, coordinate
or range mismatches, malformed JSON, nonfinite values and inconsistent
temperatures are rejected. Structural changes fail explicitly. More variables
require verified registry definitions and tests, without a new request design.

HTTP: fixed HTTPS endpoint, no redirect following, 1 MiB response cap, 5-second
attempt timeout, 15-second supplier budget, at most three attempts for transient
network/timeouts/429/5xx. Permanent HTTP and invalid evidence do not retry.
Long Retry-After ends the query safely. Constructor test injection is absent
from runtime settings and routes.

PostgreSQL: exact canonical request keys, 30-day freshness, append-only source
and normalized snapshots, SHA-256 evidence hashes, composite foreign keys,
immutable UPDATE/DELETE trigger. Cache reads validate hashes and raw evidence.
Refresh failure preserves prior evidence but does not serve it as fresh.
Twenty-second PostgreSQL leases coordinate independent consumers. Short locked
publication checks ownership and expiry; obsolete owners cannot publish. No
transaction remains open across upstream HTTP. Process death recovers after
actual lease expiry. Sixteen consumers/two upstream calls per process and a
25-second signal budget bound work; in-flight DB queries/cleanup have separate
bounds, so this is not a strict end-to-end 25-second SLA.

API: `GET /api/v1/internal/weather/capabilities` and `POST
/api/v1/internal/weather/query`, header `x-weather-token`. Disabled by default;
enabling requires a server secret of at least 32 characters. Production supports
these protected internal routes and cannot enable the synthetic development
harness. Responses are no-store. Weather DB schema participates in readiness
when enabled; upstream connectivity is checked during queries, not every health
probe. Liveness remains available during database failure. Errors have safe
codes without SQL, credentials, raw provider payload or stack traces.

## Actual commands and observations

Commands used pinned pnpm by prepending
`/private/tmp/rotavise-pnpm/node_modules/.bin` to PATH. This machine's other pnpm
installation has a different version; engines reject it. Portable setup is in
README. Source control uses the bundled Git because macOS system Git is blocked
by its unaccepted Xcode license; no global identity or license was changed.

| Command                                                                               | Actual result                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/weather-evidence.mjs docs/evidence/weather/2026-09-26`                  | 6 real HTTP 200 responses; statuses, times, exact bytes/hashes and URLs retained                                                                  |
| `node scripts/weather-compare.mjs docs/evidence/weather/2026-09-26`                   | Reproduces 122-day inter-provider differences; no ground-truth accuracy claim                                                                     |
| `pnpm --filter @rotavise/database exec drizzle-kit generate --name weather_snapshots` | Generated migration and metadata; SQL reviewed and immutable trigger added                                                                        |
| Initial `pnpm build:server`                                                           | Failed literal-set typing; corrected to `Set<string>`, then compiled successfully                                                                 |
| Initial weather Jest run                                                              | 2 failed / 54 passed: redirect and timeout native errors misclassified across Jest realms                                                         |
| `pnpm test:weather` after fixes                                                       | 56 passed; subsequent strengthening/outage checks run: 59 passed                                                                                  |
| Final gate's `pnpm test:weather`                                                      | 60 passed: 47 contract/provider checks and 13 real PostgreSQL/API checks                                                                          |
| Initial `pnpm lint`                                                                   | One unused import failed; removed, lint passed                                                                                                    |
| `pnpm db:up`, `pnpm db:migrate`                                                       | Real development PostgreSQL healthy; migration applied successfully                                                                               |
| `pnpm weather:demo`                                                                   | Actual NASA miss, complete 5 days; repeat hit with same persisted ID                                                                              |
| `pnpm verify`                                                                         | Exit 0; final rerun after error-code correction also exit 0: 91 tests, lint/format/types, builds, non-root containers and frozen clean-copy build |
| `pnpm audit --prod --json`                                                            | 0 known runtime advisories at this date                                                                                                           |
| `pnpm peers check`                                                                    | No peer dependency issues                                                                                                                         |

Live demo snapshot: `d9797bb4-a4a3-4658-98c7-e36b6902d15e`, retrieved
2026-09-26T22:31:30.357Z, NASA API v2.10.0, sources MERRA2/POWER. Raw SHA-256
`703cf2e9b8f5a9e33d3f4ad44ad425d3cfa148080dbba090deee440f40e769a4`.
Subsequent runs can reuse the retained cache; fresh databases receive new IDs.

Real HTTP smoke through the compiled Nest/Fastify API on an ephemeral loopback
port also passed: readiness 200, protected capabilities 200, protected query 200,
five complete days, cache hit and the same persisted snapshot ID. It used a
temporary random server token; no secret or supplier fault was written into
the environment file or frontend. The final infrastructure-worker SIGKILL
regression recovered in 11849 ms, two attempts and one authoritative result.

The refresh-failure test retained its assertions while the implementation was
corrected to distinguish unexpected provider failure from database failure:
WEATHER_UPSTREAM_UNAVAILABLE versus WEATHER_STORAGE_UNAVAILABLE. Both complete
regression gates passed. No test was removed or softened.

Local transcripts: `.artifacts/weather-first.log`, weather-second.log,
weather-third.log, weather-demo.log, verify-step02.log, verify-step02-final.log and
runtime-audit-step02.json. They are ignored local evidence; committed response
fixtures and tests let reviewers reproduce behavior without those files.
Intentional database outages and browser API shutdowns log safe errors. These
are tested failures, not hidden or suppressed production errors.

## Acceptance matrix

| ID  | Status | Evidence                                                                                                                        |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| W01 | PASSED | Current primary references, two fixed dataset choices, terms, six real requests and decision                                    |
| W02 | PASSED | Contract tests for invalid dates/coords/ranges/variables and exact response consistency                                         |
| W03 | PASSED | Three real NASA fixtures; leap/year/122-day coverage; injected missingness yields nulls                                         |
| W04 | PASSED | Loopback 429/503/exhaustion/permanent/redirect/JSON/size/cancel/real timeout tests                                              |
| W05 | PASSED | Real repeated migration; persistent cache, JSONB hashes, immutable trigger/FK, refresh and failure                              |
| W06 | PASSED | 12 concurrent consumers/one snapshot; actual SIGKILL/expiry recovery; obsolete-owner rejection; no idle transaction             |
| W07 | PASSED | Production-mode auth/default-off/input/no-store tests; DB outage safe HTTP recovery; harness 404                                |
| W08 | PASSED | 16 foundation unit + 8 integration + 5 recovery + 60 weather + 2 browser tests; lint/types/build/container/clean install exit 0 |
| W09 | PASSED | Real persisted miss/hit demo; exact commands below and README                                                                   |
| W10 | PASSED | Report, decisions, provider evidence, progress and run instructions complete; READY_FOR_REVIEW                                  |

No required item is silently replaced with a fake or a weaker check. Remote CI
is unrun: no remote repository is configured. It is not a required local gate.

## Exact review commands

Prerequisites: Node 24.19.0, pnpm 12.6.0, running Docker, installed Chromium.

```sh
cd /Users/houdaifadrahm/projects/Rotavise
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm exec playwright install chromium
pnpm verify
pnpm weather:demo
pnpm db:down
```

Stop `pnpm dev` before `pnpm verify`: API port 3000 and browser port 5178 must
be free. `verify` creates and removes only its disposable databases/containers;
it does not reset the development database. `db:down` preserves the volume and
weather snapshots. `pnpm test:weather` is the focused rerun. Live supplier demo
is intentionally separate from deterministic CI. Full API/token/curl instructions
are in README. No secret belongs in the frontend.

## Remaining limitations and boundary

- These are grid reanalysis estimates. Local station validation, agronomic
  thresholds and confidence claims are absent. Historical data is not a forecast.
- Four variables are enabled. Other NASA parameters, recent data, hourly data,
  unrestricted archives and automatic provider fallback are not implemented.
- Exact-coordinate cache keys do not optimize multiple points sharing a grid
  cell. Per-process caps are not a global distributed supplier quota. Public
  scaling and provider commitments need later verified limits.
- Internal token protection does not replace public request ownership/accounts.
  No real farmer records should be exposed through these internal routes.
- Backup/restore, data retention cleanup, production role separation, TLS/reverse
  proxy, deployment, monitoring and public capacity testing are later operations.
  Database owners can bypass triggers; application UPDATE/DELETE is rejected.
- Local macOS arm64 and Linux arm64 containers are verified here. Remote Linux
  x64 CI remains unobserved. A dated clean audit is not a security guarantee.
- No full weather UI, crop catalog, planner, recommendations or external
  deployment exists. Step 03 has not started. Fix requests stay in Step 02;
  advancement requires explicit user approval and instruction.
