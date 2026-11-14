# Step 02 structure review

Date: 2026-09-26. Status: **READY_FOR_REVIEW**. All local acceptance checks passed.

## What changed

The user authorized reorganizing the implemented app, grouping related files
and removing genuinely unused files. This remains Step 02. No future milestone
or new product feature is included.

- Six main categories: `apps`, `packages`, `tests`, `tooling`, `infra`, `docs`.
- Backend: small executable entry points, explicit application composition,
  separate health/development-job/weather Nest modules, validated configuration
  and shared error/token utilities.
- Weather: request canonicalization, capabilities, NASA parameters, transport,
  normalization and PostgreSQL cache behavior each have a clear home.
- Worker: process lifecycle and development fixture execution are separate.
- Frontend: page composition, HTTP client, lifecycle hook and status component
  replace the single mixed application file.
- Contracts and database schema are grouped by health, job and weather concerns;
  connection and migration execution are distinct.
- Tests are grouped by unit, integration, recovery and browser verification.
  Shared support is grouped by containers, processes, HTTP, polling and fixtures.
- Local commands are grouped by development, verification and weather evaluation.
  Root pnpm command names remain stable.
- Specifications, milestone reports, provider evidence and historical documents
  have separate documentation folders. The original sources are retained.

See the [structure guide](../../architecture/structure.md) for the complete tree,
official references and dependency rules. It applies Nest's feature module and
provider guidance, React's component/hook guidance, and pnpm/Vite conventions.

## Cleanup and preservation

The old combined source files were replaced by the extracted implementations;
there are no duplicate compatibility wrappers. Vacated directories were removed.
Compiled builds now remove only their own generated `dist` before compiling,
so moved source cannot leave stale runnable entry points. Browser results now
live under ignored `.artifacts/playwright/`; the obsolete root
`test-results/.last-run.json` and its directory were removed.

Root tool configuration and package entry-point barrels are retained because
they have consumers. Original specifications, the superseded blueprint,
migration SQL/metadata and recorded upstream responses remain available.
Historical reports retain actual commands from their original runs and link to
the current layout. `.env`, development data and dependency lock are preserved.

## Decisions and versions

The selected stack remains unchanged. No dependency was added or upgraded and
the lockfile is unchanged. Exact installed versions are in
[DECISIONS.md](../../DECISIONS.md): Node 24.19.0, pnpm 12.6.0,
Nest 12.1.0/Fastify 5.12.5, React 19.3.0/Vite 8.3.1, Zod 4.6.5,
PostgreSQL 18.4, Drizzle ORM 0.45.3/Kit 0.31.11, pg 8.23.0,
pg-boss 12.35.0, TypeScript 6.0.3, ESLint 10.11.0/typescript-eslint 8.70.1,
Prettier 3.9.9, Jest 30.5.2 and Playwright 1.63.0.

Nest dependencies use explicit module imports and existing resource instances.
Final review removed an unused pool injection token; the composition root owns
the pool and passes it directly to the services that use it.
ESLint checks the contract, database, frontend and application boundaries.
The PostgreSQL cache consistency protocol stays together in its service rather
than being scattered into arbitrary small files. No empty future domains or
speculative abstractions were added.

## Actual commands and results

Commands use Node 24.19.0 and pinned pnpm 12.6.0. This host requires
`export PATH=/private/tmp/rotavise-pnpm/node_modules/.bin:$PATH` to select that
pnpm installation. The [README](../../../README.md) has portable setup commands.

| Command                                                      | Observed result                                                                                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First `pnpm format`, `pnpm lint`, `pnpm build`               | Failed incomplete frontend JSX extraction; restored page markup and status labels                                                                                                              |
| `pnpm lint && pnpm build && pnpm test:unit` after correction | Exit 0; frontend/server builds and all 16 foundation unit tests passed                                                                                                                         |
| `pnpm --filter @rotavise/database exec drizzle-kit generate` | Four tables; no schema changes, nothing to migrate                                                                                                                                             |
| `pnpm test:integration`                                      | Exit 0; all 8 real PostgreSQL/API tests passed, including outage/recovery                                                                                                                      |
| Full `pnpm verify`                                           | Exit 0: 16 foundation unit, 8 integration, 5 recovery, 60 weather and 2 Chromium tests (91 total); lint/format/types, builds, production containers and frozen clean-copy install/build passed |
| Byte comparison against prior Git commit                     | All 22 original source documents, lock, migration SQL/metadata and evidence files byte-identical                                                                                               |
| Documentation link audit                                     | All 26 final local Markdown links resolved                                                                                                                                                     |
| Moved-test AST assertion comparison                          | All 169 identified `assert.*` / `expect(...)` expressions unchanged across six suites                                                                                                          |
| `pnpm env:setup`, `pnpm db:up`, `pnpm db:migrate`            | Existing environment preserved; retained PostgreSQL healthy; MIGRATIONS_APPLIED                                                                                                                |
| `pnpm weather:demo`                                          | Real retained snapshot hit twice, same ID, all five days complete                                                                                                                              |
| `pnpm dev`, readiness curl requests, `pnpm demo`             | API and worker ready, Vite page HTTP 200, durable fixture completed on attempt 1                                                                                                               |
| Ctrl-C, then `pnpm db:down`                                  | API_STOPPED and WORKER_STOPPED; supervisor exit 0; database stopped with volume preserved                                                                                                      |

Initial extraction defects were fixed; tests and validation were retained.
Expected controlled outage errors remain visible in logs. Local transcripts are
under ignored `.artifacts/restructure-*`; committed tests reproduce the checks.

Both complete regression gates returned exit 0. The final rerun followed removal
of the unused injection token. The actual worker SIGKILL test recovered in 11864 ms, with two attempts and one
authoritative result. Production API/worker containers ran non-root, were ready,
exited gracefully with code 0, required authentication for enabled weather routes
and returned 404 for development routes. Unsafe production harness configuration
failed startup as required.

Local fixture demo ID: `e8675992-267a-49d6-8aa8-daf0d8b298f4`, completed
2026-09-26T23:12:48.606Z. Weather demo reused the actual previously persisted
snapshot `d9797bb4-a4a3-4658-98c7-e36b6902d15e`; this refactor smoke made no new
supplier request. Supplier failure/normalization regression used retained real
responses, labeled synthetic cases and real loopback HTTP/PostgreSQL failures.

## Acceptance matrix

| Item                                                 | Status | Evidence                                                                                                       |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Clear feature/category structure                     | PASSED | Structure guide and implemented directories                                                                    |
| Imports, scripts and deployment paths                | PASSED | Complete gate exit 0; compiled and container entry points work                                                 |
| Migrations and original evidence preserved           | PASSED | No schema change; 22 retained files byte-identical                                                             |
| Real database, queue recovery and weather regression | PASSED | Eight integration, five recovery and 60 weather tests passed                                                   |
| Browser behavior and production guards               | PASSED | Two Chromium tests; non-root containers, authentication, development routes absent and unsafe startup rejected |
| Reproducible installation/build                      | PASSED | Frozen clean-copy install and all package builds passed                                                        |
| Run instructions and review boundary                 | PASSED | Documented local commands exercised; reports updated; no Step 03 work                                          |

## Verify and demo

```sh
cd /Users/houdaifadrahm/projects/Rotavise
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm verify
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm weather:demo
pnpm dev
```

Visit `http://127.0.0.1:5173`. In another terminal, run `pnpm demo` for the
clearly labeled infrastructure job. Stop development with Ctrl-C, then
`pnpm db:down` to stop PostgreSQL while retaining data. `pnpm verify` requires
Docker running and ports 3000/5178 free.

## Limitations and overall progress

The foundation and historical weather backend are implemented. This refactor
improves their structure; it adds no crop advice, catalogs, accounts, planner,
weather charts or deployment. Existing provider, capacity, operational and
agricultural-validation limitations remain documented in the
[Step 02 report](report.md). Remote CI has not been executed.

No universal “perfect structure” or whole-product launch readiness is claimed.
The evidence here concerns this implemented component and its local checks.
Step 03 remains unauthorized. Fixes stay in Step 02; advancement requires the
user's explicit approval and instruction.
