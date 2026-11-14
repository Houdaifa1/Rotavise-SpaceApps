# Step 03 review — crop catalog

Status: **READY_FOR_REVIEW**.

Subsequent product planning update, 2026-09-27: the user requested adding the five
features in [GOALS.md](../../specification/GOALS.md) to the future roadmap. This
does not change Step 03's implementation, acceptance results or readiness status.
No later milestone was implemented by that documentation update.

## In simple terms

Rotavise now has a structured place to store crop knowledge, where every fact
carries its source and limits. The initial research candidates are durum wheat,
faba bean for dry grain and sugar beet. The catalog knows which fields are still
unknown. It deliberately returns `insufficient_evidence` for every current crop.
It does not yet tell a farmer what to plant.

The project now has its infrastructure, historical-weather component and crop
catalog component. Farmer inputs, date/sequence calculations, weather evaluation,
constraints, ranking, explanations, planning API/UI and agricultural validation
remain future work. No trustworthy overall completion percentage can be inferred
from completing three milestones.

## What changed

- Fixed normal pnpm 12.6.0 installation and moved effective strict configuration
  into `pnpm-workspace.yaml`. Removed the obsolete `.npmrc`.
- Added strict catalog contracts under `packages/contracts/src/catalog/` and
  framework-independent validation, hashing and gap checks under `packages/catalog/`.
- Added real versioned data under `data/catalog/releases/0.1.0/`, with separate
  manifest, sources and crop-profile files. Eight primary-source identities carry
  provenance. Source documents are not bundled.
- Added bounded administrator file loading, immutable PostgreSQL snapshot import
  and a separate CLI under the server's catalog feature/entrypoints.
- Added reviewed Drizzle migration `0003_catalog_versions.sql`, database identity,
  size/synthetic checks and an UPDATE/DELETE rejection trigger.
- Added catalog unit/integration tests, explicit synthetic fixture rejection,
  production-container import/repeat checks and full verification wiring.
- Updated setup, CI, structure guide, decisions and this report. Existing source
  specifications, migrations, weather evidence and earlier implementation remain.

## Decisions and limitations

See [decisions](../../DECISIONS.md) and
[source review](../../evidence/catalog/2026-09-27/review.md) for primary links and
page references. INRA's wheat guide is dated 2023; other inspected ONCA covers do
not establish publication years. National wheat guidance and Rabat-Sale-Kenitra
faba guidance are not presented as validated Tadla rules. Sugar beet's approximate
calendar needs annual regional/campaign confirmation. Kew browser facts are hashed
as explicit extracts; failed HTTP 403 challenge bytes are never taxonomic evidence.

All cultivar choices, maturity intervals, comparable demand classes and local
specialist review remain unresolved. Crop-specific return intervals, soil pH
methods and temperature time/measurement bases also need evidence. A 250-day beet
irrigation example is not a cultivar maturity range. Annual water supply and
yield-conditioned water references do not establish irrigation sufficiency.
No measured soil improvement is claimed. The readiness check describes catalog
evidence completeness, not an agricultural recommendation or specialist credential
verification service.

Catalog ID/version and full content hash bind immutable snapshots. SQL owners can
disable controls, so this is not a tamper-proof production evidence registry.
No independent per-profile version registry, public ownership API, release
signatures, source redistribution license, production backup/retention or scale
claim is included. No external deployment or remote GitHub Actions run occurred.

## Versions

No third-party versions changed and no new external library was added. The only
lock changes are workspace links for `@rotavise/catalog` (`0.0.0`, private).

| Dependency/runtime                          | Exact version                       |
| ------------------------------------------- | ----------------------------------- |
| Node / pnpm                                 | 24.19.0 / 12.6.0                    |
| Nest common/core/platform-fastify / Fastify | 12.1.0 / 5.12.5                     |
| React / React DOM / Vite                    | 19.3.0 / 19.3.0 / 8.3.1             |
| Zod                                         | 4.6.5                               |
| PostgreSQL                                  | 18.4 (`postgres:18.4-bookworm`)     |
| Drizzle ORM / Kit / pg / pg-boss            | 0.45.3 / 0.31.11 / 8.23.0 / 12.35.0 |
| reflect-metadata / RxJS                     | 0.2.2 / 7.8.2                       |
| TypeScript / ESLint / typescript-eslint     | 6.0.3 / 10.11.0 / 8.70.1            |
| Prettier / Jest / Playwright                | 3.9.9 / 30.5.2 / 1.63.0             |
| Chromium                                    | Playwright build 1243               |
| @types/node / @types/pg                     | 24.19.0 / 8.23.1                    |
| @types/react / @types/react-dom             | 19.3.0 / 19.3.0                     |

Official pnpm configuration/installation was rechecked and actual installation
verified. Existing dependency compatibility is exercised by frozen install, strict
peer checking, compilation, real PostgreSQL and production-image runs; the stack
selection was not reopened. The exact pins/lock remain the reproducible record.

## Checks executed and defects fixed

| Command or actual probe                                                                  | Observed result                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install --global pnpm@12.6.0`                                                       | Completed native macOS executable; shell and Node child process report 12.6.0                                                                                                                                             |
| `pnpm config get engineStrict`, `strictPeerDependencies`, `pmOnFail`, `saveExact`        | true, true, error, true                                                                                                                                                                                                   |
| Temporary incompatible Node manifest / mismatched packageManager pin                     | Exit 1: `ERR_PNPM_UNSUPPORTED_ENGINE` / `ERR_PNPM_BAD_PM_VERSION`                                                                                                                                                         |
| `pnpm install`, then `pnpm install --frozen-lockfile`                                    | Exit 0; no external resolution changes                                                                                                                                                                                    |
| `pnpm --filter @rotavise/database exec drizzle-kit generate --name=catalog_versions`     | Generated 0003, reviewed before use                                                                                                                                                                                       |
| `pnpm --filter @rotavise/database exec drizzle-kit generate --name=catalog_schema_check` | Exit 0, no schema changes                                                                                                                                                                                                 |
| `pnpm test:catalog` after fixes                                                          | Exit 0: 40 unit + 14 real PostgreSQL integration tests                                                                                                                                                                    |
| First complete `pnpm verify`                                                             | Exit 0: prior 91 tests + then-current 52 catalog tests, build/container/clean gates passed                                                                                                                                |
| Final complete `pnpm verify`                                                             | Exit 0: 145 tests (16 foundation unit, 8 foundation integration, 5 worker recovery, 60 weather, 40 catalog unit, 14 catalog integration, 2 Chromium), plus lint/format/types/builds/non-root containers/frozen clean-copy |
| `pnpm audit --prod`, `pnpm peers check`                                                  | Exit 0, no known runtime vulnerabilities / no peer issues                                                                                                                                                                 |
| `pnpm db:up`, `pnpm db:migrate`                                                          | Exit 0, real retained PostgreSQL migrated                                                                                                                                                                                 |
| `pnpm catalog:demo`, then compiled importer repeat                                       | Imported then unchanged; identical UUID/hash; all three insufficient evidence                                                                                                                                             |
| `pnpm db:down`                                                                           | Exit 0, stopped development database; volume retained                                                                                                                                                                     |

Initial failures were investigated and corrected:

1. Skipping pnpm installer scripts left a macOS `ENOEXEC` launcher. Normal
   installation now produces the native executable. `engines.pnpm` alone did not
   enforce version mismatch; `packageManager`/`pmOnFail` was actually tested.
2. SQL JSON null comparison admitted a null synthetic marker. Positive matching
   now requires literal false for every source/profile; missing/null/string/true
   rejection tests pass.
3. A test initially expected source-array file order to survive canonical storage.
   Identity is documented to sort entity IDs. The test now verifies the entire
   canonical content, not a weaker partial comparison.
4. A real locked import exposed an unhandled checked-out PostgreSQL connection
   error during subsequent database loss. Active-client handling and destroy-on-
   failed-rollback were fixed. Real mid-import database shutdown and the lock
   timeout/recovery tests pass; tests and outage injection were retained.
5. Two developer build commands were accidentally started concurrently and raced
   over generated output. The importer reported the missing compiled module;
   sequential rebuild and repeat succeeded. Run commands that clean shared `dist`
   sequentially. This was not hidden by changing the build cleanup or tests.

Jest's ESM flag is experimental; production uses ordinary compiled ESM. Expected
database-outage errors and browser startup connection refusals remain observable
in the regression log. Docker's system Git metadata capture warns because of the
host's Xcode-license issue; a working bundled Git is used for repository review.
Container functionality was tested, not signed source/image provenance.

## Real demo

Recorded in [demo.json](demo.json): catalog `rotavise-pilot`, version `0.1.0`.

- First outcome: `imported`; repeat: `unchanged`.
- Snapshot: `72a20078-c647-4338-9eff-d825f7fdfe64`.
- SHA-256: `d951b9c07b03739a77d43d0518c68ebc13b80d805fa58dcd076ef9cd82ed3a55`.
- All three crops remain pending review / insufficient evidence, with explicit gaps.

After the final gate, `pnpm db:up`, `pnpm db:migrate` and two sequential
`pnpm catalog:demo` runs all returned exit 0 and reused this retained snapshot.
The database was then stopped with `pnpm db:down`, retaining its volume.

The production-container check also imports the committed release twice in its
disposable database and checks matching identity. No synthetic fixture or failure
switch becomes a public production route. Tests create and remove their own real
PostgreSQL containers; source research uses real publisher requests and records
failures honestly. Fresh demo databases get their own operational UUID/timestamp.

## Acceptance matrix

| Criterion                                                | Status  | Evidence                                                                                   |
| -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| C01 manager/configuration/frozen install/version guard   | PASSED  | Actual executable/config/error probes and frozen install                                   |
| C02 current primary sources/provenance                   | PASSED  | Eight source identities, retrieval records, page locators, explicit date/hash limits       |
| C03 three research profiles and explicit fields/unknowns | PASSED  | Three separate crop files; no invented completion defaults                                 |
| C04 strict bounded contracts/references                  | PASSED  | Negative validation and bounded loader tests                                               |
| C05 metric/unit/stage/time/context preserved             | PASSED  | Typed discriminated rules; unsupported hard-rule and water-adequacy promotion rejected     |
| C06 local/review gaps and no city cutoff                 | PASSED  | All insufficient; outside-scope and unknown-crop tests                                     |
| C07 synthetic evidence excluded                          | PASSED  | Explicit fixture, nested marker tests and direct SQL rejection                             |
| C08 real immutable/idempotent/transactional persistence  | PASSED  | Concurrent imports, conflict, append, trigger, corruption, rollback, lock and outage tests |
| C09 bounded real import/read demo                        | PASSED  | Development and production-container imports                                               |
| C10 complete regression/clean/container gates            | PASSED  | Final complete verification exit 0, all 145 tests and build/container/clean gates          |
| C11 reports/decisions/progress/instructions              | PASSED  | Report, decisions, progress, source review, demo and exact commands                        |
| Agricultural recommendation readiness (future gate)      | BLOCKED | No specialist review; documented cultivar/duration/water/rotation/method gaps              |
| Failed Step 03 acceptance items at delivery              | NONE    | C01–C11 passed; future agricultural gate remains explicitly blocked                        |

The final verification also observed SIGKILL worker recovery in 11,896 ms with
two attempts and one result. Thirty-four original specification/migration/previous-
feature files were checked byte-for-byte against the prior commit and preserved.

The future agricultural gate is not silently counted as completed. Step 03 accepts
research profiles with visible gaps; it does not accept agricultural advice.

## Exact review commands

Run build-dependent commands sequentially from the repository root. Docker must
be running; stop `pnpm dev` before verification so ports 3000 and 5178 are free.

```sh
cd /Users/houdaifadrahm/projects/Rotavise
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm verify
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm catalog:demo
pnpm catalog:demo
pnpm db:down
```

Prerequisite manager setup if needed: `npm install -g pnpm@12.6.0` using Node
24.19.0. Linux browser setup may need
`pnpm exec playwright install --with-deps chromium`. Existing `.env` is preserved;
do not delete it or development volumes. For a targeted catalog check use
`pnpm test:catalog`. No API/worker process is needed for the import demo. To view
the existing backend-health frontend, run `pnpm db:up` then `pnpm dev`; it remains
a health page, not a farmer planner.

Stop after this review. Step 04 requires a new explicit user instruction; passing
tests or silence do not authorize advancement.
