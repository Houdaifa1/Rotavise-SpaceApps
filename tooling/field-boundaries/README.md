# Optional precomputed Moroccan field suggestions

The selected data are **FTW 2025** suggestions under CC BY 4.0. Accuracy is
unmeasured. Read the [decision/report](../../docs/evidence/field-boundaries/2026-11-10/field-boundaries-report.md)
before enabling the switch. No detector, imagery processing service, OneSoil
API or OSM fallback runs in the backend. Existing manual saved-field boundaries
are not changed by an import.

## Import a reviewed export

Build with `pnpm build:server`. Apply reviewed migration 0026 through the
normal migration entry point **against the intended development database**.
The import command does not migrate or choose a database. For local inspection,
prefer the disposable demo below; it creates its own PostgreSQL and removes it.
Do not run these operator commands against production without authorization.

The research/export Python tools were exercised using Python 3.9 on this Mac.
They are separate from the stateless science service and are never loaded by
the API. The requirements file pins that research environment; platform wheel
availability elsewhere is not verified. Full-country export/import time,
Postgres size and performance have not been measured.

```sh
python3 -m venv /tmp/rotavise-boundaries-venv
/tmp/rotavise-boundaries-venv/bin/pip install -r tooling/field-boundaries/research-requirements.lock.txt
/tmp/rotavise-boundaries-venv/bin/python tooling/field-boundaries/export-ftw.py /tmp/morocco-2025.ndjson
# After migrations, and only against the DATABASE_URL you intend to modify:
node --env-file=.env tooling/field-boundaries/import.mjs /tmp/morocco-2025.manifest.json /tmp/morocco-2025.ndjson
```

For a small research export, append `--bbox -6.56 32.39 -6.54 32.41` and use a
new output filename. It is labelled `scope: sample`. Importing a sample needs
`--allow-sample`, refused by the CLI in `NODE_ENV=production`. The tiny committed
real fixture is a sample, not country coverage. A prepared bbox export **replaces
the active dataset**, so it must never be used as an incremental country import.
No production data or persistent development database was modified by B2r.

The export pins the upstream ETag before and after querying the country file.
The manifest pins the exact LF-terminated NDJSON SHA-256. Source URL, year,
licence and manifest structure are runtime validated; known confidence is
rescaled from 0–100 to 0–1 and null is retained. The importer streams records in
500-row batches within one transaction, counts geometry rejections, and
atomically activates the new dataset only after checking the consumed hash.
A failed/empty/duplicate/hash-mismatched import leaves the previous active
version in place. Historical imports are retained; no automatic pruning,
refresh or country-wide performance guarantee is included.

The two shared reference tables are separate from private `field_boundaries`.
`boundary_datasets` holds provenance/licence/report; `boundary_candidates`
holds validated geometry, cleaning details and a built-in PostgreSQL box GiST
index. No PostGIS dependency is introduced. Both new tables were reviewed in
[0026](../../packages/database/migrations/0026_wide_sasquatch.sql) and exercised
on disposable PostgreSQL 18. No existing tables or data are altered/dropped.
The schema snapshot and journal are included. No production migration ran.

## API and ownership

Set `FIELD_BOUNDARIES_ENABLED=true` only after a reviewed import, with
`PLANS_ENABLED=true` for guest owners and/or `AUTH_ENABLED=true` for account
owners. It defaults to false, including staging/production templates.
`GET /api/v1/capabilities` exposes `fieldBoundaries.available`; this is
configuration discovery, **not imported coverage/readiness**. The legacy
`fieldDetection` switch remains separate and no detector was installed.

- `GET /api/v1/field-boundaries/tiles/14/{x}/{y}` returns a GeoJSON
  FeatureCollection, whole polygons whose bounding boxes intersect the tile,
  stable dataset-qualified IDs, area, source, regional confidence (or null),
  attribution, licence link and limitations. Adjacent tiles may repeat a shape.
  Empty areas return `coverage: no_fields_found`. Other zooms are invalid.
- `POST /api/v1/field-boundaries/at` takes numeric `{latitude, longitude}` and
  returns `{field, attribution, licenseUrl, sourceUrl, limitations}` or
  `404 {code: NO_FIELD_FOUND}`. A point exactly on an edge has no guaranteed
  match; the shared strict-interior rule applies. Overlaps choose smallest
  area then source ID. No new geometry is inferred.

Both require an authenticated guest bearer token or verified account cookie.
Shared public reference data have no private owner records: ownership governs
access and quotas. Account POSTs require a trusted Origin; mixed cookie/bearer
credentials are rejected. Tile reads: 60/owner/minute; taps: 20/owner/hour;
additional abuse ceiling: 120/IP/minute. Limits use the existing PostgreSQL
quota store, so replicas share counters. `Retry-After` is conservative.
Responses use `no-store`. Taps are not persisted or sent upstream.
A dense result above 5,000 candidates or corrupted stored geometry fails
closed with `503 FIELD_BOUNDARIES_UNAVAILABLE`, without partial results.

Cleaning removes consecutive duplicate positions and collinear points, drops
holes, and tries Douglas-Peucker at up to 5 m, lowering tolerance when needed.
Only simple closed outer rings passing `fieldBoundarySchema` survive: at most
200 vertices plus closure, 0.1–1000 ha, maximum span 0.1 degrees, total net
area change at most 2% against original outer-minus-hole ring areas. Unsupported,
very complex or invalid geometries are dropped and counted. Confidence is not
used to certify geometry. The current implementation reports admission totals;
it does not classify every individual drop reason.

## Disposable demo and tests

```sh
pnpm build:server
node tooling/field-boundaries/demo.mjs
pnpm test:unit
pnpm test:backend
pnpm test:api-docs
node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain-integration --runInBand
```

The demo prints capability discovery, a real Tadla outline lookup and the
import/drop counts from the committed real fixture. It runs no provider calls,
uses a disposable PostgreSQL container and cleans up. The tests are included
in existing `unit` and `planning` projects, so `test:backend`/`verify` exercise
them without a new package script. Build/generation and tests must run
sequentially because the build replaces `dist` directories.

## Research reproduction

`record-evidence.py` takes a JSON array of `[relative filename, URL]` pairs,
saves exact bytes under the dated evidence directory and refuses overwrites.
It records status, response headers, UTC retrieval time, byte size and SHA-256;
network failures are recorded without pretending to have response bytes.
Files ending `.raw` preserve third-party bytes without formatting or linting.
The checked-in retrieval ledger supplies the exact URLs used in this task.
`sample-ftw.py`, `sample-osm.py`, `sample-academic.py`, `sample-pmtiles.py`,
`render-samples.py` and `render-comparisons.py` reproduce extraction/inspection.
OSM extraction expects `/tmp/b2r-morocco.osm.pbf` downloaded from the URL in
`osm-summary.json`; academic extraction expects the saved RAR extracted under
`/tmp/b2r-groundtruth`. Derived JSON/GeoJSON is formatted by Prettier; source
response bytes stay unchanged. `index-evidence.py` regenerates the final hash
ledger and checks original response hashes after formatting derived files.
