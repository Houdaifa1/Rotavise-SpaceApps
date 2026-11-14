# B2r review notes — 10 November 2026

B2r is ready for review after the checks recorded below. It is a separately
user-authorized backend/research task; it does not approve or complete Step 12,
advance to the full Step 15 milestone, or start the frontend. Work is on
`codex/bg-b2r`, uncommitted and unpushed. No production data was modified.

## Decision and observed quality

Choose **precomputed FTW 2025 Morocco polygons**, CC BY 4.0, as optional
suggestions. Keep **manual outline/painting/upload** for missed or wrong
suggestions. Reject OSM as a fallback because the sampled landuse areas span
many individual fields. Do not add OneSoil without verified free redistribution
rights, and do not build a detector, SAM service or imagery pipeline.

The [research report](../../evidence/field-boundaries/2026-11-10/field-boundaries-report.md)
contains the comparison table, exact Morocco paths/sizes, source failures,
regional sample counts, licence distinctions, effort/risk and product questions.
The [evidence ledger](../../evidence/field-boundaries/2026-11-10/source-index.md)
hashes every saved source/sample/overlay; raw responses are preserved exactly.
See also the B2r entry in [DECISIONS](../../DECISIONS.md).

**The data looked useful but imperfect on Moroccan fields. Accuracy is
unmeasured.** In the Tadla and Beni Mellal windows, many strips/blocks follow
visible Sentinel-2 edges, while some merge neighbours or produce fragments.
Gharb/Saiss show similar useful divisions and failures. The Souss window is
mostly dry-looking ground in the selected scene and has poor suggestions;
it does not establish quality across the Souss region. Orchard correctness,
small-field recall, IoU, completeness and legal parcel accuracy were not
measured. A high FTW score is a 500 m regional confidence, not the chance that
a specific field outline is correct.

Raw 2025 counts were 243 Tadla, 167 Beni Mellal, 106 Gharb, 21 Souss and 220
Saiss. Applying the actual cleaner retained 171, 121, 78, 8 and 168 respectively.
These are format admission counts, not correct-field counts. The academic
Moroccan survey archive has 10,383 records (one null geometry), but only 13
intersect these five windows, all in Beni Mellal; it is a partial reference
source, not a national selector. Country PMTiles exist but stop at zoom 13;
our zoom-14 API uses the GeoParquet geometry stored locally.

## Implemented backend

- `GET /api/v1/field-boundaries/tiles/14/{x}/{y}` returns whole GeoJSON
  suggestions intersecting the tile bounding box, including ID, area in
  hectares, source, known regional confidence/null, attribution, licence link,
  cleaning metadata and limitations. Empty collections are honest gaps.
- `POST /api/v1/field-boundaries/at` validates numeric coordinates and returns
  the smallest containing suggestion, or **404 `NO_FIELD_FOUND`**. It does not
  compute a replacement outline. Shared strict-interior semantics apply at edges.
- Both require a guest/account owner; PostgreSQL rate limits are 60 tile reads
  per owner/minute and 20 taps per owner/hour, plus 120 requests/IP/minute.
  Cookie POSTs require trusted Origin. Mixed credentials fail. Taps are not
  stored or sent to providers. Reference polygons are shared public data and
  contain no owner's saved fields.
- `FIELD_BOUNDARIES_ENABLED` defaults **false**; staging and production templates
  also set false. `capabilities.fieldBoundaries.available` reports configuration
  with a usable owner mechanism, not data readiness/coverage. The legacy
  `FIELD_DETECTION_ENABLED` is separate; no detector was installed.
- The export/import tools under `tooling/field-boundaries/` accept only the
  selected FTW Morocco source/year/licence format, pin consumed NDJSON SHA-256
  and upstream ETag, store provenance and drop counts, and activate atomically.
  Bbox exports are samples, require an explicit sample import flag and replace
  the active dataset. Samples are refused by the production CLI.
- Geometry must pass `fieldBoundarySchema`: outer ring only, simple/closed,
  at most 200 vertices plus closure, 0.1–1000 ha, maximum span 0.1 degrees.
  Simplification tolerance is at most 5 m; net area change including dropped
  holes is at most 2%. Unusable polygons are dropped and counted. Invalid
  container/provenance/hash input aborts the import. Corrupt stored shapes
  fail closed on reads.
- Reviewed migration **0026** adds only two reference tables, provenance/check
  constraints, a foreign key, GiST box index and one-active-dataset index.
  It changes no private field table. Its generated snapshot/journal are included;
  real PostgreSQL tests apply it and the terrain integration project passes.
- Shared contracts, OpenAPI 1.4.0, and seven new glossary codes in en/fr/ar/ary
  are included. Translations remain machine-written and unreviewed by a person.
  Attribution is in `THIRD_PARTY_NOTICES.md` and its generator.

## Verification

All commands below ran on **2026-11-10**, with actual process exit codes.
Full logs and the CLI demo output are saved in `b2r-verification.txt`.

| Command                                                 | Exit | Result                                                         |
| ------------------------------------------------------- | ---: | -------------------------------------------------------------- |
| `pnpm lint`                                             |    0 | Passed                                                         |
| `pnpm format:check`                                     |    0 | Passed; earlier derived GeoJSON and route formatting corrected |
| `pnpm typecheck`                                        |    0 | Passed across workspaces                                       |
| `pnpm openapi:generate`                                 |    0 | Generated document                                             |
| `pnpm test:backend`                                     |    0 | 85 tests / 7 suites, real PostgreSQL                           |
| `pnpm test:api-docs`                                    |    0 | 27 tests / 3 suites                                            |
| `pnpm test:unit`                                        |    0 | 35 tests / 2 suites                                            |
| Jest `terrain-integration`, with `planning` and `unit`  |    0 | 66 tests / 5 suites after migration                            |
| Jest `planning` after CLI stream regression fix         |    0 | 18 tests / 2 suites; actual CLI against real PostgreSQL        |
| `node tooling/field-boundaries/demo.mjs`                |    0 | Real 29-record fixture: 12 retained, 17 dropped; lookup 200    |
| Python `export-ftw.py … --bbox -6.56 32.39 -6.54 32.41` |    0 | Actual live export: 243 records, ETag stable before/after      |
| `python3 tooling/field-boundaries/index-evidence.py`    |    0 | Original response hashes verified; final ledger generated      |

During development, failures exposed a wrong glossary group name, an unverified
fixture admission-count assumption, an invalid expired-owner test setup, a
concurrent build/test race, and eager CLI readline consumption while waiting
for PostgreSQL. The causes were corrected. The CLI now opens the stream lazily;
the integration suite exercises the actual command with a timeout. The first
hanging demo was terminated by stopping only its own disposable database; its
corrected rerun completed successfully. Builds/generation and tests should run
sequentially because builds replace compiled directories. No failure was
suppressed or transformed into production evidence.

## Demo and operator commands

```sh
pnpm build:server
node tooling/field-boundaries/demo.mjs
```

This creates, migrates, imports into and removes a **disposable** PostgreSQL
container. It does not contact FTW/imagery providers or change the user's
persistent database. It prints the real source ID, area, regional confidence,
licence and limitations, without printing session credentials.

For country/sample export and operator import commands, see
[tooling instructions](../../../tooling/field-boundaries/README.md). Data access
needs **no account or API key**. Production migration/import or enabling a live
service remains a separately authorized operator action. No account was created
and no new service credential was requested.

## Remaining limitations and review

No country-wide Postgres load, storage footprint, import time or load test was
measured. No private/user database was seeded. The committed fixture is partial
coverage, not a country dataset; enabling the flag without an import yields
empty coverage. The upstream country GeoParquet file is about 1.8 GB across
both years, and hosting it consumes local resources even though data access is
free. No refresh schedule, SLA, inference fallback, or guarantee of accurate or
complete selection is included. Validating more Moroccan parcels and changing
confidence policy require further work. The original master plan's detector,
202 responses and automatic outline fallback do not describe this B2r API.

Please review the provider decision, saved overlays, backend changes and
limitations. Product choices remaining for the user are when to enable a demo,
what validation to require before wider use, and how to package the optional
country dataset for the competition. Source selection itself has been decided.
No milestone approval is recorded here.
