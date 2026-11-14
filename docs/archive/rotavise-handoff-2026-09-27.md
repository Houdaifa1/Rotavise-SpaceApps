> **Archived 2026-10-16.** Superseded by the Field Shift re-baseline in
> [the current specification](../specification/ROTAVISE_HANDOFF.md). Kept as
> history; relative links below were written for `docs/specification/`.

# Rotavise — current product and engineering handoff

Specification date: 2026-09-26; product-goal update: 2026-09-27. Application status: not implemented or validated by this document.

## 1. What we are building

Rotavise is a responsive web application for comparing plans for two successive crop cycles on the same field. A farmer supplies their field information, the crops they are considering for the next cycle, planting flexibility, resources, and priorities. The engine assesses those choices and compares them with supported alternatives. It explains suitability, constraints, tradeoffs, and missing information.

The main output is a dated crop sequence with alternatives and traceable reasons. A job system, database, weather integration, and deterministic calculation engine support that workflow.

The [product goals](GOALS.md) include crop-health history, water/climate comparison,
optional accounts with saved history and selectable historical weather charts.
Photo assessment and greenhouse monitoring follow the core planner as Steps 11 and 12. Their inclusion is a future-scope
decision, not a claim that those features are implemented or permission to start
another milestone.

This is an independent product build. Any future competition submission has separate event rules; do not assume this code is eligible for submission without checking those rules. Competition deadlines do not govern this development plan.

## 2. Decisions already made by the user

- Marketing may target Morocco or a city. Do not hard-code that marketing geography into the engine or reject coordinates merely because they are outside Beni Mellal.
- The algorithm is reusable across locations. Applicable planting calendars, cultivars, rules, and data coverage can still vary by location; missing applicability must remain visible.
- Farmers enter one or several crops they are considering for the next cycle. Also support an explicit “I do not know; suggest options” choice.
- These preferences must not prevent the engine from evaluating better supported alternatives.
- Always assess the farmer's choices. Preserve rejected, unsupported, and conditional choices in the response rather than silently dropping them.
- Preferences concern the first proposed crop. The engine proposes the following crop and evaluates the complete two-cycle sequence.
- Use TypeScript throughout the initial product. The previous Python/FastAPI recommendation is superseded.
- Implement one milestone at a time. Complete its verification, show a detailed report, and wait for the user's explicit authorization before starting another milestone.
- Include the five features in `GOALS.md` as product deliverables. Preserve the core planner's order; validate photo assessment and greenhouse telemetry in their later dedicated milestones.
- Include optional farmer accounts and persistent saved fields, crop history and plan history as G06. Keep guest planning available; complete the account/history backend gate before the full Step 07 API and expose it in Step 08. Registration is optional for the farmer; implementing this capability is required before the first farmer release.

## 3. Client workflow

1. Open “Plan my field.”
2. Select location through a map pin or coordinate fallback.
3. Enter known crop history, disease/pest observations and their source/date, soil, water availability, earliest planting date, and allowed flexibility. Unknown is a valid explicit state; reported observations are not automatically confirmed diagnoses.
4. Select considered next crops, or choose “suggest options.” Optionally exclude crops the farmer will not grow.
5. Select a supported priority such as lower relative water demand.
6. Review inputs and submit.
7. The API validates and stores the request, enqueues processing, and returns HTTP 202 with a request ID.
8. The frontend retrieves job status and displays real stage progress.
9. The worker selects applicable profiles, generates candidate sequences and dates, retrieves historical weather, evaluates constraints and evidence, ranks comparable options, and stores the result.
10. Show the recommended or provisional sequence, timeline, assessments of the farmer's choices, suggested alternatives, crop-health constraints, water and climate comparisons, reasons, missing checks, and sources.
11. The farmer changes inputs and starts another comparison. Preserve each result's evidence snapshot.

Keep registration optional for temporary guest planning. Offer account creation/sign-in to save fields, crop history and plans, return later or use another device. Private guest requests retain ownership and expiration controls. Persistent saving requires an authenticated account with ownership checks. Claiming a live guest request requires explicit confirmation and proof of both sessions; do not recover expired/deleted requests or infer ownership from email/location. Separate account retention/deletion from temporary guest expiration. This supersedes deferring all accounts until after the first complete workflow; detailed requirements are in G06 of `GOALS.md`.

## 4. Request and result semantics for later implementation

The real planning endpoints will be `POST /api/v1/plans` and `GET /api/v1/plans/:id`. They are future interfaces, not fake planning routes to expose in Step 01.

The planning request includes:

| Group | Contents |
| --- | --- |
| Location | WGS84 latitude and longitude |
| History | Known crop entries and dates plus explicit completeness/status |
| Crop health | Dated disease/pest observations, observation source and confirmation/unknown state |
| Soil | Known measurements with units and methods where needed; unknown states |
| Water | Availability category; optional later measured budget and period |
| Planning | Earliest and latest first start date; two cycles; bounded search horizon |
| Preferences | `considered_next_crop_ids`, priority, and `excluded_crop_ids` |

If a crop is both considered and excluded, return a clear validation error. Empty considered crops is permitted only with the explicit suggestion mode. Support an “other crop” intake path later: an unresolved crop is unsupported or incomplete evidence, never silently a fully assessed species.

Generate candidates once and label whether each starts with a farmer-selected crop. Assess supported alternatives under the same rules. Keep choice assessments distinct from the shortlist of alternatives.

Operational status: `queued`, `running`, `completed`, `failed`.

Scientific assessment: `eligible`, `conditional`, `excluded`, `insufficient_evidence` at candidate level. Overall outcome distinguishes supported options, provisional options, no viable supported plan, and insufficient data. An upstream API outage is an operational failure, not proof that no crops fit.

A successful result contains:

- Recommended/provisional plan and up to two distinct alternatives when available.
- Assessment of every considered next crop, including rejected or unsupported choices.
- Planting dates/windows and estimated completion dates with assumptions.
- Reasons, conditions, constraints, and calculated weather metrics.
- Crop-health rule effects, supported water-demand comparisons, irrigation-adequacy unknowns, and historical climate variability/period comparisons.
- Coverage and number of complete historical analog sequences.
- Missing inputs and unevaluated checks.
- Weather snapshot IDs, source IDs, catalog version, ranking configuration version, and engine version.

“Best” means highest ranked under the implemented rules and the user's priority, not universal agronomic superiority, future success probability, or profit guarantee. Ties and ranking sensitivity must be visible.

## 5. Selected stack

| Component | Decision |
| --- | --- |
| Language | TypeScript with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` |
| Runtime | Node.js 24 LTS; pin a supported patch and verify package requirements |
| Repository | pnpm workspaces, one lockfile, a pinned package-manager version |
| Backend | NestJS with Fastify adapter |
| Frontend | React + Vite |
| Runtime contracts | Zod, types inferred from schemas |
| Database | PostgreSQL 18, real locally and managed for deployment |
| SQL access | Drizzle with node-postgres and committed SQL migrations |
| Jobs | pg-boss, API and worker as separate processes from one codebase |
| Crop dates | Temporal `PlainDate` through the supported polyfill, wrapped in a small date utility boundary |
| Operational times | UTC instants and PostgreSQL `timestamptz` |
| Tests | Jest for server/domain; Playwright for browser acceptance |
| Development | Docker Compose for disposable local PostgreSQL |
| CI | GitHub Actions |
| Deployment target | Render static frontend, API service, worker, and managed PostgreSQL; configure at the deployment milestone |

Use current stable compatible dependency versions and lock them. Research the exact adapters, ESM/CommonJS boundaries, test transforms, database volume layout, and Temporal support before wiring them together. Do not copy release-candidate installation instructions into production automatically.

No Python service, Redis, Kubernetes, distributed microservices, or machine-learning optimizer is justified in the initial scope. Introduce another component only to solve a demonstrated requirement with an explicit decision record and user-approved scope change.

Official implementation references to verify at Step 01: [Node release support](https://nodejs.org/en/about/previous-releases), [Nest Fastify adapter](https://docs.nestjs.com/techniques/performance), [PostgreSQL support](https://www.postgresql.org/support/versioning/), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [Zod](https://zod.dev/), [pg-boss](https://github.com/timgit/pg-boss), and [Vite](https://vite.dev/guide/). Documentation may evolve; actual stable package compatibility and installation are part of the first acceptance check.

## 6. Architecture boundaries

Target structure; materialize only packages required by the authorized milestone:

```text
apps/
  web/
  server/
    src/
      api-main.ts
      worker-main.ts
      modules/{plans,weather,catalog,jobs,health}/
packages/
  contracts/
  domain/
  database/
data/
  crop-profiles/
  rotation-rules/
  sources/
infra/
docs/
  steps/
```

- `contracts`: runtime schemas and public transport types; safe for frontend import.
- `domain`: pure calculations. No framework decorators, network, database, UI, clock reads, random IDs, or ambient environment configuration.
- `database`: tables, migrations, persistence, constraints, and transaction support; server-only.
- `apps/server`: request lifecycle, validated configuration, provider adapters, job orchestration, logging, access controls, and dependency wiring.
- `apps/web`: input collection, real processing states, result presentation, and scenario changes. No independent agronomic scoring.

Use a durable transaction for request creation and job enqueueing. Treat job delivery/recovery as potentially repeatable: handlers must be idempotent regardless of queue delivery claims. Do not hold a database transaction open during a NASA request or long calculation.

## 7. Weather and crop knowledge

NASA POWER is selected for daily historical weather. The backend supports minimum/maximum/mean temperature, corrected rainfall, relative humidity, 2 m wind and solar energy. Farmers will select supported measurements and dates in Step 08 charts/tables with units, coverage and source identity. Meteorology starts in 1981; our CERES solar policy starts in 2001. Requests are bounded to 366 days and end at least 120 days ago. These are grid estimates, not field sensors or forecasts. See [weather revision](../steps/06/weather-expansion.md).

The crop engine still uses temperature and rainfall; new variables require supported methods before scoring. The historical baseline and buffer must cover complete sequences. Do not hard-code five years without checking complete windows.

Provider changes require compatible units, temporal aggregation, time standard, provenance, and a recalculated result. Do not splice providers silently to fill missing days or label replacement weather as NASA data.

Crop profiles contain species/family, cultivar/method, applicability, planting windows, duration ranges, stage-specific and time-specific requirements, water-demand information, rotation restrictions, sources, review status, and version.

Every rule must identify its metric, unit, stage/time basis, severity, applicability, and source. Annual rainfall preferences are not seasonal irrigation requirements. Daily air temperature and land-surface temperature are not interchangeable.

Crop-health history uses reviewed host/break rules and explicit observation
uncertainty. Water comparison must not claim irrigation sufficiency without a
defensible water balance and required inputs. Climate comparisons use matched
historical growing windows, coverage, variability and documented period comparisons.
Photo assessment and greenhouse readings have separate evidence and release gates
in `GOALS.md`; neither is silently treated as confirmed outdoor-field evidence.

Synthetic profiles are valid test fixtures. They are explicitly marked and rejected by the production catalog importer. A production workflow with insufficient reviewed profiles must return insufficient evidence; it must not pretend research gaps are solved.

## 8. Engine invariants

- Generate and evaluate complete sequences: previous history → first crop → second crop.
- Crop cycles cannot overlap; uncertain durations must not be silently optimistic.
- Hard violations are checked before ranking and cannot be averaged away.
- Missing weather stays missing, not zero. Coverage is computed within each relevant window and variable.
- Historical analog sequences preserve consecutive years and leap-date behavior.
- Unknown soil, water, and history never count as favorable evidence.
- Unsupported choices remain visible and are never called agronomically bad merely because the catalog lacks them.
- Compare candidates with compatible evidence. Missing components cannot create a score advantage.
- Explanations reference actual input, rules, or metrics; no invented savings, nitrogen gains, disease probabilities, or profit.
- Identical input and evidence versions produce the same assessment and order, including deterministic tie handling.
- Numerical weights are declared product heuristics until validated. Show interpretable tradeoffs and ranking sensitivity.

## 9. Future milestones — context only

| Step | Scope | Reviewable evidence |
| --- | --- | --- |
| 01 | Local foundation and durable synthetic job | Exact criteria in `STEP_01.md` |
| 02 | Provider comparison and historical-weather adapter | Decision record, documented sources, real small sample, validated fixtures, cache and failure tests |
| 03 | Versioned crop catalog and provenance | Import validation, applicable rules, explicit research gaps, synthetic/live separation |
| 04 | Real request contract, crop-health/soil/water inputs, anonymous ownership, and lifecycle | Input/observation-source/unknown/access/expiration tests and stored evidence references |
| 05 | Calendars, candidate sequences, and hard constraints, including reviewed crop-health rules | Deterministic cases, cross-year dates, no overlap, traceable rejection and unsupported health-history handling |
| 06 | Historical climate-risk metrics, water comparisons, comparable ranking, explanations | Coverage, complete analogs, period/variability/threshold checks, irrigation unknowns and evidence/tie/sensitivity checks |
| 07 | Optional-account/saved-field/history backend gate, then farmer-choice comparison and complete API workflow | Verified authentication/recovery/revocation, guest/account ownership and explicit claim, retention/deletion, versioned history; all selected choices assessed, alternatives and terminal result states |
| 08 | Farmer form, map, processing and results UI, including health/water/climate comparisons and optional sign-in/saved fields/history | Guest and account journeys, recovery, mobile and keyboard flows, unknown states, accessibility, API-backed browser tests |
| 09 | Core planner validation and security review | Reviewed agronomic/health/water/climate cases, account/guest authorization and recovery, resilience, intended-load tests, corrections |
| 10 | Staging, observability, backup/restore, deployment | Staging demo, recovery and rollback evidence; production action separately authorized |
| 11 | Photo-based disease/pest assessment with validated planning integration | Commercial data/model rights, representative field evaluation, abstention/error release criteria, owned media and versioned evidence; see `GOALS.md` |
| 12 | Greenhouse monitoring with validated observation integration | Real hardware/transport verification, units/freshness, access, reconnect/order/failure tests, reviewed alert rules and production-system applicability; see `GOALS.md` |

At each authorized step, refine only that step's detailed acceptance criteria before implementation. The user reviews the finished step and authorizes the next one. Do not silently reorder or combine steps into a full-product build.

## 10. Production readiness

Foundation readiness, application readiness, and agricultural recommendation validity are different claims. Step 01 can meet production engineering standards for its foundation while real planning, field-data security, external deployment, and scientific validation remain future work.

Before actual launch, require access controls, retention decisions, measured performance at intended concurrency, upstream failure handling, bounded queues/search, logging and alerts without sensitive payload leakage, reproducible migrations, backup restoration, dependency review, operational runbooks, and reviewed agricultural evidence.

The agent must not claim the whole product is production-ready simply because scaffolding compiles. Report the readiness of what was actually delivered.
