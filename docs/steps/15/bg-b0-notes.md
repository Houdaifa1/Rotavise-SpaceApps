# B0 backend gaps: BG-1, BG-2, BG-3, BG-10, BG-14

Completed for review on 2026-11-10, branch `codex/bg-b0`, using Node 24.19.0,
pnpm 12.6.0 and disposable PostgreSQL 18.4 containers. All work is uncommitted;
no push, merge or external deployment was performed. No milestone approval is
recorded here.

The pre-existing untracked `codex-bg-b0-prompt.md` is preserved. An external
edit to `FRONTEND_MASTER_PLAN.md` appeared during implementation and is preserved;
B0 did not make that edit. No other frontend-plan rows were implemented.

## Verified behavior

| Row   | Implementation and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BG-1  | Public `GET /api/v1/capabilities`, strict shared response schema, configuration switches and versions, `Cache-Control: no-store`. Integration tests cover each switch on/off, email/Google pairing, AI key/budget, catalog selection, glossary version and no secret disclosure. `FIELD_DETECTION_ENABLED` is validated and defaults to `false`.                                                                                                                            |
| BG-2  | A single owner-scoped SQL list query returns `fieldId`, `fieldName`, declared `cropIds`, `horizonYears`, completed `topStrategyCropIds`, `whatIf`, `parentPlanId` and `label`. No per-plan fetch. Guest/account privacy, pagination, missing legacy data, completed rank projection, deleted fields and foreign-field rejection are covered.                                                                                                                                |
| BG-3  | What-if acceptance persists the source UUID atomically with the plan and queue job. Status/list return it; legacy plans return null. Tests check guest/account ownership, source-sensitive idempotency, immutable parent provenance and a retained UUID after parent deletion.                                                                                                                                                                                              |
| BG-10 | Optional `label` on both POST plan formats and idempotent owner-only `PUT /api/v1/plans/{id}/label`; label returned in all three status formats and list items. Maximum 80 characters; Unicode control characters are rejected. Null clears a label; empty strings are allowed. Tests cover guest/account owners, foreign/missing authentication, account origins, invalid labels and retrying original acceptance after renaming.                                          |
| BG-14 | The existing flat field-create body and field-with-history envelope accept optional `fieldBoundarySchema` polygons. Point containment is enforced. Field, history and boundary share one transaction. Both owner types and both endpoints are tested for successful persistence, invalid polygons, outside points, null boundary rejection and rollback after an injected database failure on the boundary insert. Old bodies without boundaries still pass existing tests. |

Labels are submission metadata, outside `PlanRequest`/`PlanRequestV2` calculation
inputs. New `PlanCreateRequest` and `RotationPlanCreateRequest` transport schemas
extend those inputs; the route removes `label` before normalization/hashing.
`initial_label` is pinned separately so idempotency still checks the original
submission after a rename. Label updates leave processing timestamps unchanged.
Tests compare stored inputs, evidence, result bytes and hashes before/after
renaming and re-read the completed plans through existing integrity checks.

Migration `0025_great_mattie_franklin.sql` was generated with drizzle-kit and
reviewed. It adds three nullable columns, validation constraints, and an
additive trigger protecting `initial_label` and `parent_plan_id`. It rewrites
no historical input or result and needs no backfill. There is deliberately no
parent foreign key: parent deletion/expiry leaves the child's provenance UUID.
Application acceptance checks that the source is live and owned in the insert
transaction. Existing migrations 0000–0024, including the 0005 result/input
protections and 0023 raw-file trigger, were not edited. Terrain tests exercise
raw-file immutability and stored-result hash checks after the migration.

`packages/domain`, catalog release files and the dependency lock are unchanged.
OpenAPI was regenerated with document version `1.2.0`. No new API error codes
were introduced: `AI_NOT_CONFIGURED`, `INVALID_INPUT`, and the existing plan
errors already have en/fr/ar/ary glossary entries; glossary coverage passed.

## Commands and exit codes

Every command below ran on 2026-11-10 against this worktree. Outputs were read
directly; no check was piped into `tail`. Checks with a build were sequenced so
one build could not delete another test process's imported artifacts.

| Command                                                                                                                                           | Final exit code | Evidence                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @rotavise/database exec drizzle-kit generate`                                                                                      | 0               | Generated migration 0025 and its snapshot/journal entry; SQL then reviewed and metadata trigger appended.                       |
| `pnpm openapi:generate`                                                                                                                           | 0               | Ran twice; latest run includes document version 1.2.0.                                                                          |
| `pnpm lint`                                                                                                                                       | 0               | Final run completed 10:11:04 UTC.                                                                                               |
| `pnpm format:check`                                                                                                                               | 0               | Passed; repeated after final report editing.                                                                                    |
| `pnpm typecheck`                                                                                                                                  | 0               | All workspace packages passed, completed 10:11:23 UTC.                                                                          |
| `pnpm test:backend`                                                                                                                               | 0               | 6 suites, 78 tests; completed 10:12:55 UTC.                                                                                     |
| `pnpm test:plans`                                                                                                                                 | 0               | 3 suites, 62 tests; completed 10:13:38 UTC.                                                                                     |
| `pnpm test:catalog`                                                                                                                               | 0               | 2 suites, 83 tests; completed 10:14:11 UTC.                                                                                     |
| `pnpm test:api-docs`                                                                                                                              | 0               | 3 suites, 27 tests; real route coverage, generated-document equality and four-language glossary checks; completed 10:14:21 UTC. |
| `pnpm test:unit`                                                                                                                                  | 0               | 1 suite, 30 tests; completed 10:14:28 UTC. Additional B0 contract/summary unit coverage is in `test:plans`.                     |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain-integration` | 0               | 13 real-PostgreSQL tests passed after migration 0025.                                                                           |
| `env BUILDX_CONFIG=/private/tmp/rotavise-bg-b0-buildx pnpm test:container`                                                                        | 0               | Production image built; all 10 production-container checks passed.                                                              |
| `git diff --check`                                                                                                                                | 0               | No whitespace errors.                                                                                                           |

Earlier failures and resolutions:

- Initial `pnpm test:backend`: exit **1**, with 77 passed and one failure. The
  new field-linked summary test used an old synthetic policy without field
  context support. Its fixture now opts into `rotation-outputs-1`; the entire
  backend command then passed. Production engine policy was not changed.
- Initial plain `pnpm test:container`: exit **1** because the sandbox denied
  Docker Buildx activity writes under the user's Docker directory. Setting
  only `BUILDX_CONFIG` to a writable temporary directory resolved that cause;
  the same production-container checks then passed, with no checks skipped.

## Demo and reproduction

Against an already running local API, no owner is needed for discovery:

```sh
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/capabilities
```

The complete mutation demonstrations run on disposable databases, without
production data, external provider calls or real credentials:

```sh
pnpm test:plans
pnpm test:backend
pnpm test:api-docs
node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain-integration
BUILDX_CONFIG=/private/tmp/rotavise-bg-b0-buildx pnpm test:container
```

The container command uses the server build artifacts produced by the preceding
commands. Standard deployment migration tooling is unchanged; no migration was
applied to a persistent user or production database during B0.

## Limits and unverified work

- Capabilities describe configuration, not live provider readiness, coverage or
  credential validity. No live NASA, Google, email-provider or AI service was
  contacted to prove availability. Test SMTP delivery uses disposable Mailpit.
- `catalog` identifies `ROTATION_CATALOG_VERSION` when planning is enabled and
  `PLAN_CATALOG_VERSION` otherwise. Existing `/catalog/options` still selects
  the intake catalog; consumers can request the advertised version via the
  existing versioned catalog endpoint. Its selection behavior was not changed.
- Field detection itself remains B2 work. Keep `FIELD_DETECTION_ENABLED=false`
  until that service is installed; setting it true advertises that configured
  capability. B0 provides no detector or detection routes.
- List crops come only from `current_rotation.crop_ids`, preserving order and
  repeated crops. No history inference is added. Top crops come from an existing
  rank-1 strategy; older results without strategies return null. Missing old
  fields/metadata return null/false. Deleted or no-longer-owned field names are
  not available; accepted field IDs remain in stored input.
- No frontend, e2e/browser validation or external deployment was part of this
  backend-only slice. No requested B0 item remains blocked or incomplete.

## Proposed DECISIONS text (not merged)

For B0, keep mutable plan labels and accepted parent provenance outside engine
input and result identity. Pin the original label for request idempotency;
derive owner-scoped list summaries without rewriting accepted evidence. Keep
parent UUIDs after source deletion. Create a field's optional outline and
history in its creation transaction. Publish one public configuration-capabilities
contract; field detection defaults off until B2 is installed.

## Proposed PROGRESS text (not approval)

B0 implements BG-1, BG-2, BG-3, BG-10 and BG-14 for frontend integration:
capabilities, private plan summaries, what-if parent provenance, labels, and
atomic field/outline creation. Required lint, formatting, types, backend,
plans, catalog, API-docs, unit, terrain-integration and production-container
checks passed on 2026-11-10; initial failures and resolutions are documented
in `docs/steps/15/bg-b0-notes.md`. Work is uncommitted for review on
`codex/bg-b0`; nothing was pushed or deployed. This records no milestone,
release, deployment or frontend design approval.
