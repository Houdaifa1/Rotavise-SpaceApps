# Scoped engine outputs — review notes (2026-11-10)

Branch `codex/engine`, built on its existing HEAD. Work is uncommitted and has
not been pushed. The user authorized this scoped backend task; no milestone
approval or frontend work is implied. The pre-existing untracked task prompt
was retained and only formatted to satisfy the repository format check.

## Implemented

- Optional pinned `rotation-policy-2.outputs = rotation-outputs-1`; older pins
  add no reporting keys. Existing result/canonical-input golden hashes are
  checked rather than updated. No release data or migrations were edited.
- Candidate `vulnerabilitySeasons`: per-slot crop, representative sowings,
  named stage and calendar envelope, heat/cold bounds with exposed/checked
  historical day counts, FAO water-stage demand/rain/shortfall, missing counts,
  citations and exact original rule verification including model recall.
  Consecutive analog offsets match the rotation's first year. What-if weather
  feeds the same reporting path. This is not a forecast. A lower bound is
  labelled cold exposure, without inventing a universal frost threshold.
- Optional owned `field_id`: matching coordinates required. Completed terrain,
  ECOSTRESS and MODIS rows, HLS/SMAP grid metadata and regional water-storage
  context are selected at acceptance, existing result hashes checked, and
  copied into already hashed versions JSON. A retry uses the copy. Invalid
  ownership, mismatched coordinates and hash tampering are rejected.
- Shared per-field slope/LS and water summaries, referenced by every rotation.
  RUSLE soil loss remains null with missing factors. An explicit dimensionless
  scalar C reference can be echoed with source or exact recall provenance;
  ordinal protection references are not C factors. R/K/P and fully sourced LS
  are unavailable, so terrain cannot affect rank. Infiltration/drainage is
  `not_found`. New-policy strategies remove the stale blanket erosion note.
- Optional strict `preferences.equipment_limits` (capacity category and/or up
  to 32 unique operation IDs), `market_access`, `income_weight` (dimensionless
  integer 0–5). These bounds are product policy. Current catalogs have no
  structured machinery/operations, market-access requirements or comparable
  net-income data: each requested feature reports a gap and applies no filter
  or weight. Yield is not treated as money. New ranking semantics require
  sourced catalog support and another pinned policy.
- Ten structured grid records per new-policy result; unused inputs explicitly
  remain unused, unknown native pixel IDs and upstream resampling are
  `not_found`. No new resampling. See
  [common-grid.md](../../architecture/common-grid.md).
- Ten reason-code glossary entries in en/fr/ar/ary, with the existing
  machine-written/unreviewed provenance; glossary version 3. OpenAPI 1.1.0 regenerated.
- A required engine check exposed the existing large-upload regex stack
  overflow. The base64 alphabet/padding check now uses an equivalent linear
  scan, preserving the former accepted character language and size limits.

## Evidence and limits

Saved implementation quotes and SHA-256 values are in
[source-ledger.json](../../evidence/engine-outputs/2026-11-10/source-ledger.json).
They establish existing adapter metadata, not independent scientific validation.
No new provider integration or live NASA request was performed. No new crop
fact, price or agronomic threshold was added to any release. Synthetic numbers
in tests are labelled synthetic and cannot become production catalog evidence.

Unverified: field-scale plant stress, actual infiltration/drainage, full RUSLE
soil loss, equipment suitability, market suitability and income. Missing data
is reported, not replaced by recalled guesses. Exposure windows describe
historical analog stage envelopes, not individual future weather events;
existing future model scores remain separate. Existing terrain method provenance
includes model recall and engineering judgment and is preserved verbatim.
Saved extraction summaries can describe an earlier sampled outline; exact
sample points and extraction IDs are retained, and no boundary-age suitability
or agronomic validity is asserted. Native-speaker review is still pending.

## Verification

All integration checks below use disposable real PostgreSQL, never production
data. No migration was added; terrain integration was not rerun.

Final completed checks (2026-11-10; actual process exit codes retained):

| Command                                                                                                                                | Exit | Verified                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm lint`                                                                                                                            | 0    | Includes domain purity rules.                                                                                                              |
| `pnpm typecheck`                                                                                                                       | 0    | Full workspace types; subsequent server builds also passed.                                                                                |
| `pnpm openapi:generate`                                                                                                                | 0    | OpenAPI 1.1.0 with final contracts.                                                                                                        |
| `pnpm test:engine`                                                                                                                     | 0    | 273 tests. All four pre-existing golden hashes unchanged; old-policy byte equivalence and new-policy whole-catalog 25-second bound passed. |
| `pnpm test:plans`                                                                                                                      | 0    | 58 tests, including PostgreSQL and recovery.                                                                                               |
| `pnpm test:backend`                                                                                                                    | 0    | 74 tests, including PostgreSQL context pinning, ownership, coordinate matching and hash rejection.                                         |
| `pnpm test:api-docs`                                                                                                                   | 0    | 26 tests, including complete en/fr/ar/ary reason coverage and generated document equality.                                                 |
| `pnpm test:unit`                                                                                                                       | 0    | 30 tests.                                                                                                                                  |
| `pnpm test:catalog`                                                                                                                    | 0    | 83 tests; existing release content hashes remain valid.                                                                                    |
| Saved-source ledger validation (inline Python)                                                                                         | 0    | All 12 exact quotes found in their saved files; SHA-256 values and recorded release manifests match.                                       |
| `git diff --exit-code -- data/catalog/releases docs/evidence/weather docs/evidence/earth-observations docs/evidence/climate-scenarios` | 0    | No modifications to existing release or provider evidence files.                                                                           |

`pnpm format:check` also exited 0 on 2026-11-10 after the final notes were written.

Logs for the completed runs: `/tmp/engine-final-lint.log`,
`/tmp/engine-final-typecheck.log`, `/tmp/engine-resume-*.log`; real exit records
are in `/tmp/engine-final-exits.txt` and `/tmp/engine-resume-exits.txt`.
`pnpm verify`, browser tests, live NASA/science-service checks, deployment and
external CI were not run or claimed.

Initial checks and corrections:

| Command                         | Exit | Finding                                                                                                                                                                                       |
| ------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                | 1    | New reporting code referenced `e.request` instead of `e.snapshot.request`, and an optional reference list needed a fallback. Fixed both.                                                      |
| `pnpm typecheck` (after fixes)  | 0    | Full workspace build and types passed.                                                                                                                                                        |
| `pnpm test:engine` (first run)  | 1    | New test used a release version instead of its directory; corrected. Existing maximum-upload test exposed regex stack overflow; replaced with linear validation. Legacy golden hashes passed. |
| `pnpm test:backend` (first run) | 0    | 74 tests, including real PostgreSQL context pinning, ownership and tamper rejection.                                                                                                          |
| `pnpm lint` (first run)         | 0    | Domain purity and lint passed.                                                                                                                                                                |

A subsequent engine run found one additional test-fixture error: the missing-
weather test mutated a series after the engine cached its counts. It now creates
a fresh series, matching the immutable source lifecycle. No production cache
invalidation was added for unsupported in-place source mutation.

## Demo commands

```sh
pnpm openapi:generate
pnpm test:engine
pnpm test:backend
```

Submit a format 2 plan through the existing plans API with optional fields:

```json
{
  "preferences": {
    "equipment_limits": {
      "mechanisation": "small",
      "unavailable_operations": ["harvest"]
    },
    "market_access": "local",
    "income_weight": 3
  }
}
```

This is a fragment to add to a valid request, not a complete plan. Add
`field_id` from the caller's saved field to pin its existing context. New plans
pin the live output policy automatically. Read `result.outputs` and each
candidate's `vulnerabilitySeasons` / `terrainContext`. Missing evidence remains
visible; no account or credential is needed for the deterministic tests. A new
live NASA extraction uses the existing Earthdata setup and is not run here.

## Proposed DECISIONS text

> Pin `rotation-outputs-1` for additive stage exposure and field-context
> reporting. Keep old policy output bytes unchanged. Copy owned-field context
> at acceptance into hashed versions JSON. Terrain stays unranked because R/K/P
> and fully sourced LS are absent; never convert ordinal protection into C.
> Farmer equipment/market/income priorities report `not_found` and apply no
> filtering or ranking until explicit sourced catalog semantics and a later
> pinned policy exist. Preserve native source grids, identities and source
> calendars; do not create a synthetic common raster.

The fuller scoped decision is appended in `docs/DECISIONS.md` for review.

## Proposed PROGRESS text

> Scoped engine-output backend follow-up: additive pinned stage exposure,
> immutable field-context snapshots, explicit missing RUSLE/economic/machinery
> evidence and ten NASA grid records. No frontend, deployment or milestone
> approval. Review the notes for current verification and limits. Uncommitted;
> not pushed.
