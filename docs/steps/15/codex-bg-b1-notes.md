# B1: BG-4 crop detail and BG-5 crop problems

Date: 2026-11-10. Branch: `codex/bg-b1`. Base:
`f47cfaa4304e3d6ca1bccad755b2d1b7b108801b`.
Scope: the user's explicitly authorized backend slice only. No frontend work,
commit, merge, push, deployment, external provider-data request or production-data change.
The supplied untracked `codex-bg-b1-prompt.md` is preserved.

## Implemented behavior

`GET /api/v1/catalog/crops/{catalogId}/{version}/{cropId}` is public when
`PLANS_ENABLED=true`, matching the existing catalog routes. BG-5 is included as
`issues[]`; there is no separate issues request. Each entry has `issue_id`,
kind, primary/scientific names, language-labelled `names`, recorded citations
and `sourced` or `model_recall` evidence. Host membership comes exclusively from
the catalog's `hostCropIds`. A returned ID is accepted by the existing plan
contract as `issue: {issue_id}`.

The response includes catalog/profile versions and the catalog SHA-256,
identity/family, model type, harvest product, calendar planting windows and
duration ranges, predecessor-family rules, return intervals, health-break
rules, cultivars, reference facts and benefit facts. Benefits are the existing
`nitrogen_fixation`, `rooting_depth`, `organic_matter_contribution`,
`erosion_protection` and `forage_value` reference topics; their original units,
ordinal classes and provenance remain intact. `facts` includes every profile
reference, including the benefit entries. `sources` resolves only citations
used in this response and retains each source's recorded limitations.

Rules are wrapped with evidence class, explicit unit and verification while
preserving the original `rule` object, including scope, conditions, severity,
original values and format-specific review metadata. They are not averaged or
promoted into recommendations. Reference facts and entities without a recorded
verification status return `verification: null` and a gap; citations alone do
not imply an independent check. Recalled records retain their complete model
provenance. Names retain citations (including short exact name quotes), recall,
confidence and preferred metadata. Missing confidence/preference is `null`.
The primary display name has no assumed language; no English, French, Arabic
or Darija translation is manufactured. Recorded homonyms and preferred names
are both retained.

Format 1 remains readable with null model type, absent multilingual names and
empty unsupported sections explained by gaps. Original catalog gaps/reasons
and limitations are retained. New gap codes are explained in all four glossary
languages; glossary version is `glossary-4`, with the existing machine-written,
unreviewed translation disclosure. The calculation engine stays pure; only
pure glossary data changes under `packages/domain`.

Invalid identifiers or any query parameters return 400. Unknown catalog/version
returns 404 `CATALOG_NOT_FOUND`; unknown crop returns 404 `NOT_FOUND`.
Corrupt/unverifiable catalog storage or a response beyond the byte limit returns
503 `CATALOG_UNAVAILABLE`. Errors use `Cache-Control: no-store`. Quota is 60
requests per IP per minute, including conditional requests; 429 includes
`Retry-After: 60`.

The serialized response is capped at 2 MiB, without silently truncating facts,
issues or citations. DTO arrays/text are bounded by Zod. Per-server serialized
cache capacity is 32 documents and 8 MiB, evicting the least recently used
entries. Keys combine the verified immutable release hash and crop ID. Every
request still reads and verifies the store head; an unavailable database or
invalid hash cannot become a cached 200/304. ETag hashes the exact response
bytes. `If-None-Match` supports exact/weak tags, lists and `*`; 304 is bodyless.
Successful responses use `public, max-age=3600, immutable`.

OpenAPI is generated from the new contracts, version `1.3.0`, including
conditional request/response headers, limits, errors and the embedded BG-5
issues. Shared rule components replace duplicate inline rule definitions;
existing rule contracts themselves are unchanged. The registry has an explicit
bounded TypeScript type to avoid the compiler's declaration serialization limit;
individual DTO contracts retain their inferred types.

## Contract conflicts and unverified work

- The current issue contract supports `disease`, `pest`, `parasitic_plant` and
  `weed`. It has no `deficiency` or `disorder` kinds. Those requested kinds are
  stopped for this slice rather than invented or mapped from weeds. Each
  response reports the classification gap at `issues.kinds`.
- `0.14.0` is absent from this checkout but present on the inspected local
  `field-shift` ref `c37819de47eb70ec8870a4a1303e25681a5cf66e`. Inspected faba-bean,
  durum-wheat, carrot and tomato profiles, plus its catalog contract diff.
  They add `research: income-benefits-1` and a separate research contract that
  this branch does not have. Faba bean has 15 income facts and 10 benefit
  findings there; they are separate from `profile.references`. Current strict
  contracts and the verified store cannot import that release. Exposing its
  new research is stopped pending integration of that contract/release work;
  no bytes, hashes, migrations or release defaults were changed here. An
  unimported 0.14.0 is an ordinary unknown-version 404. This slice serves all
  releases actually supported by this branch, through 0.13.0.
- No new agronomic research, translation confirmation, expert verification,
  crop thresholds or production reliability guarantee is claimed. Missing
  names are explicit gaps; glossary additions still need human review.
- No database migration was needed. Migrations 0005 and 0023, raw-file and
  result protections, stored results, release files and dependency locks are
  untouched. The migration-triggered terrain integration requirement does not
  apply. Frontend rendering/picking and browser e2e are outside this scope;
  BG-5 plan-contract acceptance is tested without creating a frontend builder.
- The oversized-response failure branch is bounded in code; the current real
  releases fit the bound. No invented oversized production catalog was added.

## Verification

All checks below ran on 2026-11-10. All required gates passed. Actual process
exit codes were read; no check was piped through `tail`. Detailed local logs
are `/tmp/rotavise-b1-final-*.log`, `/tmp/rotavise-b1-test-backend.log` and
`/tmp/rotavise-b1-test-container-3.log`; the sequential gate exit records are
`/tmp/rotavise-b1-final-checks.json`.

| Command                                                     | Exit code | Result                                                                                                                                        |
| ----------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm openapi:generate`                                     | 0         | Final document regenerated                                                                                                                    |
| `pnpm lint`                                                 | 0         | Passed                                                                                                                                        |
| `pnpm format:check`                                         | 0         | Passed; rerun after the final notes update                                                                                                    |
| `pnpm typecheck`                                            | 0         | All workspace packages passed                                                                                                                 |
| `pnpm test:backend`                                         | 0         | 78 tests, six suites                                                                                                                          |
| `pnpm test:plans`                                           | 0         | 62 tests, three suites                                                                                                                        |
| `pnpm test:catalog`                                         | 0         | 99 tests, four suites, including the new unit/PostgreSQL tests                                                                                |
| `pnpm test:api-docs`                                        | 0         | 27 tests, three suites; glossary, live routes and current generated document                                                                  |
| `pnpm test:unit`                                            | 0         | 30 tests                                                                                                                                      |
| `pnpm test:container`                                       | 1         | Initial attempt: Buildx state write outside sandbox denied                                                                                    |
| `BUILDX_CONFIG=/tmp/rotavise-b1-buildx pnpm test:container` | 0         | Passed after moving Buildx state into writable `/tmp`; rerun after final implementation edits also passed, with ten printed production checks |
| `git diff --check`                                          | 0         | No whitespace errors                                                                                                                          |

These Jest commands passed 296 tests in total. The projection test covers 1,063
profiles across all 13 committed releases. A final response-size probe measured
the largest response at 151,252 bytes (`bread-wheat`, 0.13.0), below 2 MiB.
Release 0.13.0 still has 246 profiles and 586 issues; its canonical hash remains
`52e191350dba6f02aadcc1fee57d97b4071a950882ce2c9df7b0ae136141cc63`.
Scope inspection found no changes under `apps/web`, `data/catalog/releases` or
`packages/database`; HEAD remains the base hash above. Everything is left
uncommitted for review.

New unit coverage projects every profile of every committed release, recursively
checks numeric provenance and citation resolution, verifies no canonical/hash
mutation, preserves original rules and name metadata, rejects invalid DTOs and
oversized issue arrays, checks unknown crops and bounded parameters, and checks
all new gap codes in every glossary language. All real-release responses are
asserted to fit 2 MiB. New real-PostgreSQL HTTP coverage checks exact source/rule
projection, issue ID use in the plan contract, immutable releases, cache
version/crop isolation, ETags and 304, cache eviction, validation and 404,
rate limiting, controlled corrupt hashes without disabling triggers, real
database shutdown and recovery.

Initial build exits were 1 while developing: nullable name evidence needed
explicit narrowing, the OpenAPI registry exceeded the declaration serializer's
size limit, and legacy optional knowledge needed optional narrowing. Each cause
was fixed; the subsequent build exited 0. An auxiliary response-size probe
initially exited 1 because it overlapped a build removing `dist`; rerunning after
build completion exited 0. No test failure was suppressed.

## Demo commands

Use a disposable/local test database with the desired immutable releases already
imported and the API running with `PLANS_ENABLED=true`. No credentials or external
account are required for this endpoint. Do not use the known stale development
catalog as evidence for this demo.

```sh
curl -i http://127.0.0.1:3000/api/v1/catalog/crops/rotavise-pilot/0.13.0/faba-bean
curl -i -H 'If-None-Match: <ETag from the first response>' \
  http://127.0.0.1:3000/api/v1/catalog/crops/rotavise-pilot/0.13.0/faba-bean
curl -i http://127.0.0.1:3000/api/v1/catalog/crops/rotavise-pilot/0.13.0/missing-crop
pnpm test:catalog
```

The first response includes `issues[]`, `calendar`, `rotationRules`, `facts`,
`benefits`, `sources`, `gaps` and `limitations`. The matching conditional request
returns 304; the last request returns 404. The automated PostgreSQL tests create,
migrate and remove their own disposable databases.

## Proposed DECISIONS text (not applied)

> **Scoped Step 15 B1 crop detail (2026-11-10).** Serve crop detail and BG-5
> issue IDs together at an immutable catalog-version URL. Preserve original
> calendar/rotation rules with units, scope, conditions and verification. Keep
> cited, model-recalled and absent metadata distinguishable, with nullable
> verification/confidence/preference and explicit translated gap codes. Resolve
> only cited sources. Bound each serialized document to 2 MiB and the runtime
> cache to 32 documents/8 MiB, with content ETags and store verification on every
> request. Retain actual catalog issue kinds; deficiency/disorder and 0.14.0's
> separate research schema need their source-contract work before exposure.

## Proposed PROGRESS text (not applied)

> User-authorized backend-only B1 follow-up implements BG-4 crop detail with
> embedded BG-5 issue IDs, contract-generated OpenAPI, translated gap codes,
> immutable-version caching and unit/real-PostgreSQL coverage. No frontend,
> release approval or milestone closure is implied. The current branch's
> supported releases through 0.13.0 remain unchanged. 0.14.0 research exposure
> awaits its separate contract/release integration. Required gates passed:
> 296 Jest tests and ten production container checks, plus lint, format, types
> and generated OpenAPI. See the dated B1 notes for commands, limits and the
> sandbox Buildx-state workaround. Work is uncommitted for review and not pushed.
