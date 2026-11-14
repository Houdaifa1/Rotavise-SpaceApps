# Production operations basics — review notes

Date: 2026-11-10. Branch: `codex/ops`. Scope: the explicit operations task in
[codex-ops-prompt.md](codex-ops-prompt.md), while Step 12 remains open.
No milestone approval is recorded. All work is uncommitted; nothing was pushed.

## Finished implementation

- Extended the existing nightly custom-format `pg_dump` workflow: serialized
  backups, SHA-256 sidecars, snapshot row-count manifests, positive retention
  validation, and preservation of the newest complete checksum-verified copy.
  Damaged/incomplete copies are retained for review. A live restore always
  takes a safety backup and protects its selected source against pruning.
- Extended the disposable PostgreSQL restore drill to recompute catalog content
  and identity, planning versions, plan inputs, and completed planning/observation/
  extraction result hashes. Tests contain nonempty completed planning results,
  altered live data after backup, and controlled checksum, manifest, catalog,
  input and result corruption. Original releases/results are not rewritten.
- Added JSON application error logging with UTC timestamps, allowlisted codes,
  server-generated HTTP request IDs, and no serialized exception/request/job
  payloads. HTTP error hooks cover native and Nest responses. Queue callbacks
  preserve retry semantics while logging thrown failures; maintenance also
  reports durable failures handled inside stores. Fatal API/worker entrypoint
  errors exit 1 after a safe JSON diagnostic.
- Added worker-loopback-only `GET /health/operations`: retained queue and
  application failures, waiting/active queue counts, last retained successful
  ingest by provider/data family, disk bytes, and aggregate tile preparation
  progress. `ops:status` prints these with the existing host checks and exits 1
  if any check fails. The public API does not expose this route.
- Extended `ops:monitor` with metric checks, explicit failure lines and exit
  status, optional owner-defined ingest/queue/tile limits, and opt-in mail using
  existing SMTP settings. Failed delivery is retried on the next run. Tests use
  an injected fake alert transport and never connect to SMTP for alert delivery.
- Added staging Compose override/env template, fresh secret generation, separate
  project/volume/networks/host data/state/port defaults, collision guards and
  separate scheduler labels. `.env.staging` is excluded from Git and Docker
  build context. Updated the [runbook](../../operations/RUNBOOK.md) with commands,
  monitoring policies and the restore drill.

No engine, catalog, climate-download, migration, result-serialization or public
contract implementation was changed. No API/domain reason code was added, so
all existing en/fr/ar/ary glossary entries remain unchanged. New CLI diagnostic
failures and monitor check names are operational diagnostics, not plan reasons.
OpenAPI is regenerated and checked separately below.

## Verification and commands

Verification ran on this Apple-silicon Mac with Node 24.19.0, pnpm 12.6.0 and
Docker. PostgreSQL integration/drill databases are disposable. The saved
[command evidence](../../evidence/operations/2026-11-10/checks.json) records raw
logs, SHA-256 values, exact output excerpts and exit codes.

| Command                                                                                                                                                                                                             | Recorded exit | Result                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `pnpm lint`                                                                                                                                                                                                         | 0             | Passed                                                                  |
| `pnpm typecheck`                                                                                                                                                                                                    | 0             | Passed                                                                  |
| `pnpm test:operations`                                                                                                                                                                                              | 0             | 24 tests passed; disposable PostgreSQL backup/restore                   |
| `pnpm test:backend`                                                                                                                                                                                                 | 0             | 73 tests passed across six suites                                       |
| `BUILDX_CONFIG=/tmp/rotavise-ops-buildx pnpm test:container`                                                                                                                                                        | 0             | Production build, lifecycle and loopback-only metrics assertions passed |
| `pnpm openapi:generate`                                                                                                                                                                                             | 0             | Regenerated; `docs/api/openapi.json` unchanged                          |
| `git diff --exit-code -- docs/api/openapi.json pnpm-lock.yaml packages/domain packages/catalog data/catalog apps/server/src/modules/catalog apps/server/src/modules/climate-scenarios packages/database/migrations` | 0             | Protected files unchanged                                               |

Final `pnpm format:check`: exit 0 (passed).

Earlier attempts and real failures:

- `pnpm install --frozen-lockfile`: exit 0; dependencies installed without
  changing the lock. Package downloads retried network failures.
- Initial `pnpm format:check`: exit 1, solely for the supplied untracked
  `docs/steps/15/codex-ops-prompt.md`. Applied formatting only to that prompt.
- An initial explicit Prettier write command included `.gitignore`: exit 2
  because Prettier cannot infer a parser for it. Removed that unsupported
  argument; subsequent formatting writes exited 0.
- Initial `pnpm test:container`: exit 1 before the build because the sandbox
  denied Buildx writing `~/.docker/buildx/activity`. Set only `BUILDX_CONFIG` to
  `/tmp/rotavise-ops-buildx`; the real Docker build and assertions then ran.
- Before the interruption, `pnpm test:operations` completed with exit 0 and
  24 passing tests, `pnpm test:backend` exited 0 with 73 passing tests, lint
  exited 0, and typecheck exited 0. A later operations/container run printed
  all passing assertions, but its PTY exit record was lost at the usage limit.
  The final runs below persist their process exit codes to files.

No check was piped into `tail`, skipped or weakened. Later checks were limited
to changes made after earlier passes and recovery of missing exit records.

## Evidence and preservation

[Source snapshots](../../evidence/operations/2026-11-10/sources.json) contain exact
quotes and SHA-256 values for the inherited retention/schedule/monitoring
policies, SMTP transport settings and stable result digest implementation.
These are local engineering policies, not provider service guarantees. No
agronomic value, provider product ID, scientific threshold or citation was added;
no model-recall factual assertion was needed.

[Preservation evidence](../../evidence/operations/2026-11-10/preservation.json)
compares 1,171 tracked domain/catalog/release/climate files byte for byte with
HEAD and records their SHA-256 values. Every comparison matched. No migration
or dependency lock was changed. Existing results use their existing schemas and
hash procedures; the new drill checks rather than changes them.

## Not performed / limits

- No production database was read or modified, no deployment was performed,
  and no existing service/container was stopped. Tests used their own resources.
- Launchd plist generation and `plutil` validation are tested; scheduler install,
  reboot/wake behavior and a real overnight backup are not exercised here.
- Staging configuration is resolved and isolation asserted by Docker Compose;
  a full staging stack is not started. No real SMTP delivery or macOS
  notification is triggered by the new tests. Enabling mail later needs the
  owner's configured SMTP service and credentials.
- Backups remain on the same Mac until copied elsewhere. No off-site durability,
  recovery-time guarantee, public availability or full launch-readiness claim.
- Ingest timestamps describe retained data. Missing entries are `null` and
  freshness alerts require owner-selected age policies. Counts are retained
  records, can overlap between queue/application tables, and are not lifetime
  failure counters. Failure logs can repeat after worker restart.
- The host disk check measures the backup/data directory filesystem; worker
  disk metrics measure its container filesystem, not free space inside the
  PostgreSQL volume. Application error JSON policy does not change PostgreSQL,
  nginx or science-service log formats.
- Full `pnpm verify`, remote CI, a complete staging upgrade/rollback and a live
  production restore were not run for this scoped change.

## Demo / owner review commands

With an installed stack: `pnpm ops:backup`, `pnpm ops:restore-drill`,
`pnpm ops:status`, `pnpm ops:monitor`. Status/monitor return 1 for failures.
For safe automated verification without production data: `pnpm test:operations`.
Staging configuration/start/drill commands are in runbook section 12; starting
or installing schedules is owner follow-up, not an action already performed.

## Proposed DECISIONS text (not applied)

Scoped production-operations follow-up: retain the existing one-Mac Compose and
launchd approach. Backups use custom-format pg_dump with same-snapshot counts,
SHA-256, conservative retention, and a disposable restore drill that verifies
catalog/input/version/result integrity. Application errors use an allowlisted
JSON sink; worker metrics are aggregate and loopback-only. The local monitor
returns failure exit codes and sends alerts through existing SMTP only when an
owner configures a recipient. Provider freshness and queue/tile limits are owner
policies. Staging uses independent secrets, Compose resources and host state.
No change to agronomic evidence, engine policy, or stored result hashes.

## Proposed PROGRESS text (not applied)

A user-requested operations follow-up adds verified backup/restore integrity,
JSON error logging, internal operational status, local alerts with optional SMTP,
and staging configuration. See `docs/steps/15/codex-ops-notes.md` for command
exit codes, saved evidence and limitations. Work remains uncommitted and ready
for Claude/user review; this does not close Step 12 or authorize a deployment,
public access, or a later milestone. Live scheduler, SMTP and staging rollout
checks remain owner follow-up.
