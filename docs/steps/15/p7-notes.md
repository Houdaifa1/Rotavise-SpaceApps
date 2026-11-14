# P7: glossary service and OpenAPI document (branch `claude/p7-glossary-openapi`)

Follow-up (2026-11-10): [Codex glossary review notes](codex-glossary-review-notes.md)
record French/Arabic corrections, Darija addition and new checks against the
current 332-entry source. The original implementation report below is historical.

Two pieces the frontend needs before design starts: plain-language text for every
code the API returns, and a machine-readable description of the API.

## What was built

### Glossary: `GET /api/v1/glossary?lang=en|fr|ar[&group=...]`

- Pure data in `packages/domain/src/glossary/` (rows of code, term, meaning in
  three languages), shared Zod contract in `packages/contracts/src/glossary/`,
  endpoint in `apps/server/src/modules/glossary/http/glossary.routes.ts`. No
  database, no account, same for everyone, served with an ETag and
  `Cache-Control: public, max-age=3600`; unknown `lang`, `group`, repeated or
  extra query parameters give 400 `INVALID_INPUT`.
- 329 entries in 8 groups: `reason_code` (113), `strategy_note` (38), `effect`
  (6), `status` (61), `evidence` (10), `score` (9), `error` (54), `term` (38).
- Covers: all 103 distinct constraint, rotation and climate reason codes; the
  four future-climate reasons; every strategy and baseline note code in engine 7;
  effects, candidate, crop, plan, stage and request statuses; evidence classes
  (extracted, double-checked, expert-reviewed, `model_recall`, sourced,
  engineering judgment) and rule strengths; scores (weighted loss, rank, climate,
  water, soil health, crop health, versus current, priorities); API error codes
  and failed-plan codes; the explanation keys returned with NDVI, MODIS, terrain,
  ECOSTRESS, GRACE and GEDI results; one entry per NASA product and SoilGrids.
- English for the vegetation and MODIS terms is imported from the constants the
  analysis already returns (a test fails if the two drift).
- Every response says who wrote the text: `provenance.text` is
  `model_written_unreviewed` (en) or `model_translated_unreviewed` (fr, ar), with
  a note in the same language. Nothing is `human_reviewed`. Arabic is Modern
  Standard Arabic and `direction` is `rtl`.

### OpenAPI 3.1: `GET /api/v1/openapi.json`, `docs/api/openapi.json`, `pnpm openapi:generate`

- Built with Zod 4's own `z.toJSONSchema` (draft 2020-12, which OpenAPI 3.1
  adopts) from the contracts the routes parse with. No new dependency.
- `packages/contracts/src/openapi/operations.ts` lists 33 operations (method,
  path, auth, query/path/header parameters, request body, responses by status,
  the server settings that switch the route on as `x-requires`) and 50 named
  schemas; `document.ts` builds the document. Security schemes: the account
  session cookie and the guest bearer token.
- The routes' inline request shapes (field update, boundary, history entry,
  observation and extraction requests, claim, empty session body) moved into
  `packages/contracts/src/fields/field-requests.contract.ts` and the routes now
  parse with them, so request documentation and behaviour are one object.
- `docs/api/openapi.json` is committed (1.6 MB indented, 0.46 MB as served) and a
  unit test fails when it differs from what the contracts produce; excluded from
  Prettier for that reason.
- Left out on purpose: `/api/auth/*` (the account library's own routes),
  `/api/v1/internal/weather` and `/api/v1/dev/*`.
- `createApi` now also returns `routes` (collected with a Fastify `onRoute`
  hook) so a test can compare the registered routes with the document.

## Tests (all new; `pnpm test:api-docs`, added to `pnpm verify`)

- `tests/unit/glossary.test.mjs` (12): unique keys, three languages everywhere,
  Arabic is Arabic and French is not a copy of English, response contract; every
  constraint, rotation and climate code, future-climate reason, status, stage,
  evidence class, strategy/baseline note code found in `packages/domain/src/rotation`,
  every uppercase code literal anywhere in `packages/domain/src` (except a named
  list of input-check codes that are thrown, never returned), every API error
  code found in the route and service files and plan contracts, and every
  explanation key found in the observation services. A new code without an
  entry fails the test (checked once by running it before the entries existed).
- `tests/unit/openapi.test.mjs` (7): unique operation ids, every `$ref`
  resolves, path parameters match the template, security declared, committed
  file is current.
- `tests/integration/openapi.test.mjs` (4, real PostgreSQL, every feature
  switched on): registered routes equal documented operations in both
  directions (checked by renaming one path: the test failed); served document
  equals the built one, ETag and 304; glossary languages, narrowing, 304, 400s;
  real responses from 22 requests parsed with the schema the document names.

## Verified (this worktree, commands exit 0)

`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:api-docs` (23
tests), `pnpm test:backend` (67), `pnpm test:plans` (58), `pnpm test:unit` (30).
Not run: `pnpm verify` end to end, `test:e2e`, `test:container`, the other
Jest projects.

## Not verified, stated plainly

- The OpenAPI document was not run through an external validator or a client
  generator (none is installed and there was no network). Its own structure
  (refs, parameters, unique ids) is tested; nothing confirms that a third-party
  tool accepts all 50 schemas, in particular the 150 kB `CatalogBundle` schema
  that appears because a synthetic-fixture plan embeds a whole catalog.
- Response schemas were exercised on real responses for 22 requests, mostly with
  empty or "unavailable" data. Not exercised: weather query, photo check,
  explanation, plan claim, and finished-plan results (the plan schemas are the
  contracts the server already parses with, but no finished plan was read back
  here).
- The 329 texts are unreviewed. French and Arabic are machine translations of
  my English; no fluent reader has checked them, and several statements about
  data products (resolutions, what ECOSTRESS and GEDI measure) come from model
  knowledge, not from re-reading product documents. Moroccan Arabic (`ary`) is
  not covered by the glossary, although the photo-check request accepts it.
- `GAP_EROSION_NOT_ASSESSED` says the rotation engine does not use terrain data.
  That is true today; the text must change when terrain enters the ranking.
- The route comparison depends on every optional feature being on in the test;
  a route added behind a new setting needs that setting in the test's config.

## For the frontend

- Show `meaning`, never the raw code; fetch `/api/v1/glossary?lang=` once and
  cache by ETag. Look up with `group` + `code`: reason codes under
  `reason_code`, strategy note codes under `strategy_note`, plan and request
  states under `status`, API failures under `error`, explanation keys under `term`.
- The frontend can import the Zod schemas from `@rotavise/contracts` directly
  (`fieldRecordSchema`, `openApiOperations`, ...); the OpenAPI file is for tools
  outside TypeScript.

## Proposed text

DECISIONS: "Glossary and OpenAPI (2026-11-09). Codes are explained by a
versioned, three-language glossary kept as pure data in the domain package and
served at `/api/v1/glossary`; a test fails when the engine can emit a code with
no entry. The OpenAPI 3.1 document is generated from the Zod contracts with
`z.toJSONSchema` (no extra dependency), committed under `docs/api/`, served at
`/api/v1/openapi.json` and checked against the registered routes. Glossary
French and Arabic are machine translations marked `model_translated_unreviewed`
until a person reviews them."

PROGRESS: "Step 15 prep, P7: glossary (329 entries, en/fr/ar) and OpenAPI document
done and tested; texts unreviewed; document not validated by an external tool."
