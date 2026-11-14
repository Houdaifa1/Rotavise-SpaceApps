# Repository structure

The repository has seven main categories. Inside an application, group code by
feature, then by the responsibility it performs. Create a new category when
there is actual code to put in it.

```text
Rotavise/
├── apps/
│   ├── server/src/
│   │   ├── entrypoints/                 # API, worker, migration and catalog import
│   │   ├── app/                         # Composition and process lifecycle
│   │   ├── config/                      # Validated server environment
│   │   ├── common/                      # HTTP errors, security headers, page cursors, tokens, serialization
│   │   ├── infrastructure/              # Resource bindings, queue and SQL transactions
│   │   └── modules/
│   │       ├── health/                  # Nest module and readiness controller
│   │       ├── development-jobs/
│   │       │   ├── application/         # Durable ledger behavior
│   │       │   └── worker/              # Infrastructure fixture handler
│   │       ├── catalog/
│   │       │   ├── application/         # Immutable PostgreSQL version store
│   │       │   ├── http/                # Public catalog options and review status
│   │       │   └── importing/           # Bounded filesystem release loader
│   │       ├── plans/
│   │       │   ├── application/         # Ownership, intake and full workflow persistence
│   │       │   └── worker/              # Durable intake and full planning handlers
│   │       ├── auth/
│   │       │   ├── application/         # Native auth, password hashing, encrypted outbox
│   │       │   ├── http/                # Strict native-handler boundary and safe account view
│   │       │   └── worker/              # SMTP leases/retries and bounded maintenance
│   │       ├── fields/
│   │       │   ├── application/         # Owned fields and dated crop history
│   │       │   └── http/                # Validation, session/origin checks and status
│   │       ├── weather/
│   │       │   ├── application/         # Cell-centre requests, capabilities and cache service
│   │       │   ├── http/                # Public bounded browser queries
│   │       │   └── providers/
│   │       │       └── nasa-power/      # Parameters, transport and normalization
│   │       ├── climate-scenarios/
│   │       │   ├── application/         # Immutable tile units, preparation and cell series
│   │       │   ├── worker/              # Sliced tile preparation jobs
│   │       │   └── providers/
│   │       │       └── nex-gddp/        # NCCS subset transport, netCDF-3 reader, normalization
│   │       └── earth-observations/
│   │           ├── application/         # Field observation requests, steps and results
│   │           ├── worker/              # One step per job (submit, poll, download)
│   │           └── providers/           # AppEEARS and Giovanni clients, CSV normalization
│   └── web/src/
│       ├── main.tsx                     # Browser entry point
│       ├── app/                         # Page composition and global styles
│       └── features/
│           ├── backend-health/         # Health polling and status
│           ├── planner/                # Farmer form, request lifecycle and results
│           ├── weather/                # Selectable history, chart and table
│           └── account/                # Optional auth, fields and saved plans
├── packages/
│   ├── contracts/src/                   # Feature-grouped runtime schemas including catalog
│   ├── catalog/src/
│   │   ├── validation/                  # Catalog references and production evidence checks
│   │   ├── identity/                    # Deterministic canonical content/hash
│   │   └── readiness/                   # Explicit research and review gaps
│   ├── domain/src/                     # Pure calendars, constraints and historical comparisons
│   │   ├── calendar/                   # Temporal and recurring windows
│   │   ├── evidence/                   # Scope, executable rules and gaps
│   │   ├── constraints/                # Soil, rotation, crop health and reasons
│   │   ├── sequences/                  # Input/context and bounded enumeration
│   │   ├── climate/                    # Snapshot validation, windows, analogs and exposure/statistics
│   │   ├── comparison/                 # Sourced resource proxies and comparable ranking/sensitivity
│   │   ├── rotation/                   # Format 2: context, scheduling, search, climate, model futures, comparison
│   │   └── observations/               # HLS greenness, green seasons and monthly rain totals
│   └── database/
│       ├── src/client/                  # Pool construction
│       ├── src/schema/                  # Job/weather/catalog/plans/auth/fields/workflow/scenarios
│       ├── src/migrations/              # Migration runner
│       └── migrations/                  # Reviewed SQL and Drizzle history
├── data/catalog/releases/
│   ├── 0.1.0/                           # Format 1: manifest, sources and one research profile per crop
│   └── 0.2.0/                           # Format 2: the same facts converted by tooling/catalog
├── tests/
│   ├── unit/                            # Contracts and application/provider behavior
│   ├── integration/                     # Real PostgreSQL and API behavior
│   ├── recovery/                        # Actual worker failure and restart
│   ├── e2e/                             # Real Chromium UI behavior
│   └── support/                         # Containers, processes, polling and fixtures
├── tooling/
│   ├── development/                     # Environment setup, supervisor and fixture demo
│   ├── verification/                    # Build, Jest, Playwright, container and clean checks
│   ├── weather/                         # Live evaluation, comparison and demo
│   ├── engine/                         # Calendar/weather gap demos and labeled synthetic demonstrations
│   ├── catalog/                         # Mechanical catalog format conversion
│   ├── climate-scenarios/               # Evidence recording and opt-in live provider check
│   ├── earth-observations/              # AppEEARS/Giovanni evidence recording and live check
│   └── plans/                           # Intake and disposable full backend demos
├── infra/
│   ├── docker/                          # Production server image
│   ├── mail/                            # Loopback SMTP inbox Compose
│   └── postgres/                        # Local persistent PostgreSQL Compose
└── docs/
    ├── architecture/                    # This guide
    ├── specification/                   # Product handoff and initial API evidence
    ├── steps/01/                        # Foundation criteria and historical report
    ├── steps/02/                        # Weather criteria, report and structure review
    ├── steps/03/                        # Catalog criteria and review report
    ├── steps/04/                        # Private intake criteria, report and demo
    ├── steps/05/                        # Calendar/constraint criteria, report and demo
    ├── steps/06/                        # Historical-comparison criteria, methods, report and demos
    ├── steps/07/                        # Accounts/history/workflow criteria, methods and report
    ├── steps/08/                        # Farmer web workflow criteria and report
    ├── steps/09/                        # Field Shift re-baseline criteria and report
    ├── steps/10/                        # Rotation engine criteria and report
    ├── steps/11/                        # NASA data layer criteria and report
    ├── decisions/                       # Provider, engine and challenge-coverage decisions
    ├── evidence/weather/                # Exact recorded supplier responses
    ├── evidence/climate-scenarios/      # POWER cell and NEX-GDDP-CMIP6 tile responses
    ├── evidence/earth-observations/     # AppEEARS HLS/SMAP and Giovanni GPM responses
    ├── evidence/catalog/                # Retrieval metadata and factual extraction review
    └── archive/                         # Start prompt, blueprint and superseded specifications
```

Nest modules/controllers live at each feature's root; native Fastify routes live
under that feature's `http/` boundary. Root `README.md`,
`AGENTS.md`, manifests, lockfile, workspace configuration, base TypeScript and
ESLint configuration remain discoverable. Each package keeps its own manifest
and TypeScript configuration. Vite's HTML entry remains in `apps/web/index.html`,
as described in its [official guide](https://vite.dev/guide/).

## Backend boundaries

Feature modules group related controllers and behavior, following
[Nest's module guidance](https://docs.nestjs.com/modules). Controllers handle HTTP
authentication, validation and response status. Application classes handle work;
provider implementations handle supplier requests and normalization.

The API composition root constructs the pool, queue, ledger and optional weather
service once. The runtime module publishes the configuration, queue and ledger
through value providers; the optional weather module publishes its service.
The pool stays owned by the composition root and is passed directly to services.
Feature imports receive the same configured module object;
dependencies are explicit, with no global feature module. Nest's
[provider documentation](https://docs.nestjs.com/providers) explains injection
tokens and the separation of controller and service responsibilities. Interfaces
that disappear at runtime use explicit tokens; class dependencies use their
runtime class identity.

The worker has its own entry point, composition and lifecycle. Its fixture
handler lives with the development-job feature. Migration execution has a
separate entry point. Disabled features are omitted from API module registration;
production still rejects development-harness enablement.

Weather request canonicalization, source capabilities, HTTP transport,
normalization and cache orchestration have separate files. The cache service
retains lease acquisition and fenced publication together: those operations form
one consistency protocol. Splitting them purely to shorten files would make its
transaction behavior harder to follow.

The optional `field-boundaries` backend feature keeps owner-authenticated HTTP
reads under `http/` and shared reference lookup, geometry cleaning and atomic
import behavior under `application/`. It serves precomputed FTW suggestions,
with no request-time provider transport or detector. Operator export/import and
research commands live in `tooling/field-boundaries/`; reference tables and
reviewed migration 0026 live in `packages/database`. Contracts stay in
`packages/contracts`; glossary text stays in the existing pure glossary module.
These shared public suggestions are separate from owned saved-field outlines.

## Frontend boundaries

`App.tsx` composes the page. Planner, weather, account and backend-health
features own their network calls and lifecycle state. A shared browser HTTP
boundary validates responses; feature clients validate their contracts. Global
page styles remain under `app`. This applies React's
[component hierarchy guidance](https://react.dev/learn/thinking-in-react) and
[custom hook guidance](https://react.dev/learn/reusing-logic-with-custom-hooks)
to the implemented page. No empty component libraries are introduced.

## Shared packages and verification

Contracts contain Zod schemas and types. Database code contains pool creation,
schemas and the migration runner. Public `index.ts` files export package APIs;
they are useful entry points, not duplicate implementations. The workspace
has six packages plus the workspace root, with explicit dependencies, as supported by
[pnpm workspaces](https://pnpm.io/workspaces).

ESLint prevents the frontend from importing server/database code, contracts from
depending on database/framework code, database code from depending on apps/UI,
and module application code from importing Nest/Fastify. TypeScript resolves
moved imports strictly. The compiled package build removes only its own `dist`
before compilation, preventing removed source paths from leaving runnable stale
executables. Tests import the current compiled paths; Docker and clean-copy
checks verify the layout outside the working checkout.

The Step 05 calculation package is implemented under `packages/domain`. It uses
Temporal PlainDate through a small calendar boundary, strict shared contracts and
catalog validation/deterministic hashing. No Nest, HTTP, storage, filesystem, UI,
clock reads, randomness or ambient environment configuration occur in calculation
code. ESLint and boundary probes enforce these restrictions. Its public entry
rejects synthetic evidence; tests alone import the labeled internal core. Step 06
adds pure historical weather/analog calculations and comparable ranking with
sourced resource proxies. Step 07 connects the full workflow in the plans module,
including weather checkpoints, immutable results and group selection. Auth owns
credentials/sessions/outbox; fields owns farmer-reported profiles/history. Neither
module puts storage or authentication inside the pure engine. Public entries reject
synthetic evidence; the private test dependency seam also refuses production use.

The catalog domain depends only on contracts and pure Noble SHA-256 hashing;
it has no filesystem, database, HTTP, Nest or React dependency. Release file access
and PostgreSQL persistence live in the server catalog module. The administrator
CLI composes these functions directly; no empty Nest module/controller is needed
without HTTP routes. Versioned real source/profile data lives under `data/`;
synthetic catalogs live only under `tests/support/fixtures/`. Database migrations
and tests enforce append-only release behavior. Hash identity sorts entity IDs
and object keys by code point; rule/citation array order remains significant.

## Navigation and retention

- Start in a feature folder to change that feature.
- Start in `tooling/` to change a root command's implementation; keep its public
  pnpm command stable.
- Start in `docs/steps/` to find milestone criteria and actual evidence.
- Keep migration history and recorded supplier response bytes intact.
- Archive superseded source guidance. Delete code after its responsibility is
  moved or proven unused, and verify its consumers.

The original handoff's sample tree is illustrative. This guide records the
current approved stack and implemented layout. Historical reports retain the
commands that were actually executed at the time; current commands are in the
[README](../../README.md).
