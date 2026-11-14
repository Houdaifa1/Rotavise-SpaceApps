# P8 — performance of the engine, the worker and the catalog reads

Date: 2026-11-09. Machine: Apple M5 Mac, Node v24.19.0, PostgreSQL 18.4 in
Docker. Other agents were running on the same Mac during every measurement
(load average 3 to 5), so each number is a loaded-machine number; the
"before" and "after" runs were taken under comparable load, not on an idle
machine.

## What was slow, and why

Profiled with `node --cpu-prof` (`tooling/performance/summarize-profile.mjs`).

| Place                                          | Finding                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rotation engine, any request on catalog 0.11.0 | 16 to 18 s per assessment, even for four named crops. About half of it was the day-by-day crop-water loop recomputing the same reference evapotranspiration (trigonometry per day) for every crop, sowing date and analog year, and the day-by-day temperature-exposure loop re-scanning the same weather. The beam-search pruning then rebuilt a weight list per partial rotation and sorted objects. |
| Catalog reads                                  | Every plan submit, every intake verification, every planning job and every `GET /api/v1/catalog/options/...` read the whole catalog body from PostgreSQL (6.4 MB for 0.11.0), validated it, rebuilt its canonical JSON and hashed it again: about 170 ms per call.                                                                                                                                     |
| Worker intake                                  | pg-boss waits the polling interval (0.5 s) after every job, so one worker handles about two intakes a second whatever the load.                                                                                                                                                                                                                                                                        |

## What changed

Engine (`packages/domain`, still pure, no clock or randomness):

- `rotation/climate.ts`: per-series caches of reference evapotranspiration, of
  the crop coefficient curve, and of running counts of missing and out-of-bound
  days (a range's exposure share is two subtractions); memoised search
  estimates keyed by crop and month-day; memoised per-slot season water terms.
  Every cache holds exactly the values the old loops recomputed, and additions
  are made in the same order, so floating-point results are unchanged. Nothing
  is memoised once the climate day budget is exhausted, so that path behaves
  as before.
- `rotation/search.ts`: partial-rotation score components are computed once per
  partial and weighed per view (same terms, same order); selection sorts index
  arrays; the first window at or after a ready date is memoised.

Server:

- `catalog/application/catalog-store.ts`: `verifiedCatalog` keeps the four most
  recent verified, prepared, deep-frozen releases in memory under row id, stored
  hash and row version (`xmin`, which any UPDATE changes, including one that
  bypasses the immutability trigger). Plan submit, intake verification, both
  planning paths and the catalog routes read only the small row first.
  The existing test "controlled catalog corruption blocks acceptance and pinned
  intake verification" still passes, which is why `xmin` is in the key.
- `app/create-worker.ts`: plan intake runs with `localConcurrency: 8`.
- `packages/contracts/.../catalog.contract.ts`: `catalogOptionsSchema` allowed
  at most 50 crops and 100 sources, so `GET /api/v1/catalog/options/...` returned
  503 for every release from 0.9.0 on (found while measuring). Raised to 1000
  each. The response for 0.11.0 holds 246 crops and 142 sources.

## Measurements

Commands: `node tooling/performance/rotation-profile.mjs` (engine),
`node tooling/performance/service-benchmark.mjs` (disposable PostgreSQL, real API
and worker processes, synthetic plan input), `node tooling/performance/catalog-costs.mjs`.

Engine, catalog 0.11.0, synthetic weather, seconds of wall time:

| Case                                                   | Before       | After      |
| ------------------------------------------------------ | ------------ | ---------- |
| Suggest from the whole catalog (168 schedulable crops) | 16.1 to 17.8 | 3.6 to 3.9 |
| Consider four named crops                              | 15.3 to 16.8 | 3.6 to 3.8 |
| Climate budget exhausted                               | 14.2         | 7.8        |
| Engine 7, declared rotation, synthetic future climate  | 18.1         | 3.7        |

"Well under 5 s" is met only narrowly on this loaded machine: 3.6 to 3.9 s. It
was not measured on an idle machine and not on GitHub's runner. The exhausted
budget case is slower because nothing is cached once the budget is gone.

Service (45 plans from three guest sessions; 100 reads per endpoint):

| Measure                                                | Before       | After                                   |
| ------------------------------------------------------ | ------------ | --------------------------------------- |
| Plan intake throughput                                 | 2.02 plans/s | 15.2 plans/s                            |
| `GET /catalog/options/rotavise-pilot/0.11.0` p50 / p95 | 173 / 206 ms | 3.2 / 4.2 ms (first call 220 to 320 ms) |
| `GET /plans/:id` p50 / p95                             | 3.7 / 7.0 ms | 4.0 / 6.2 ms                            |
| `POST /plans` p50 / p95                                | 18 / 52 ms   | 14 / 49 ms                              |

The "before" catalog-options run used the same widened contract limits, because
the unchanged limits make the endpoint answer 503.

## Equivalence

`tests/unit/rotation.test.mjs`, describe "catalog 0.11.0 speed": hashes of the
whole assessment recorded from the old engine and checked against the new one
for four cases (whole-catalog suggest with a 25 s bound, four named crops on a
deep-frozen catalog, an exhausted climate budget, engine 7 with a declared
rotation and synthetic future climate). All four match. The 25 s bound is
deliberately generous; the old engine took 16 to 39 s.

`tests/integration/catalog.test.mjs`: a stored release is read once, then
served from memory as the same frozen object, and the options contract accepts
the whole 0.11.0 release.

## Verified on 2026-11-09 (exit codes, run from this worktree)

`pnpm lint` 0, `pnpm format:check` 0, `pnpm typecheck` 0, `pnpm test:engine` 0,
`pnpm test:plans` 0, `pnpm test:backend` 0, `pnpm test:catalog` 0. No migration
was added, so `terrain-integration` was not re-run. `pnpm test:e2e`,
`pnpm test:container`, `pnpm build` of the web app and GitHub's `pnpm verify`
were not run for this branch.

## Not verified, not done

- Engine time on an idle machine and on GitHub's runner; the bound in the test
  is generous because of that.
- Planning jobs (the full rotation workflow) still run one at a time with a
  0.5 s poll; only plan intake got more workers. The engine now takes about
  4 s, so one planning worker handles roughly 15 plans a minute. Raising its
  concurrency needs a look at event-loop blocking (the engine is synchronous)
  and the connection pool (8), so it was left alone.
- Field and analysis endpoints (vegetation, GRACE, MODIS, GEDI) need an account
  session and real extractions; they were not benchmarked.
- No database index was added: the measured reads were already 3 to 7 ms.
- The cache is per process. After a restart the first request pays the full
  read once.
- The shared catalog is frozen; any future code that mutates a catalog it was
  handed would throw. The domain validates a copy on every call today, so
  nothing does.

## Proposed DECISIONS text

Performance (2026-11-09). The engine's repeated climate work is cached per
weather series and per crop and month-day, with results hash-identical to the
unoptimised engine (recorded hashes in the test). Verified catalog releases are
kept in memory under row id, stored hash and row version and deep-frozen; the
row version means a rewritten row is verified again. Plan intake runs with 8
workers. The catalog options contract allows 1000 crops and 1000 sources.

## Proposed PROGRESS text

P8 performance: whole-catalog rotation assessment on 0.11.0 fell from about 16
to 18 s to about 3.6 to 3.9 s (loaded Mac), plan intake rose from 2 to 15 plans
a second, and catalog options for 0.11.0 answer in about 3 ms instead of 173 ms
(and no longer fail the contract). Idle-machine and CI timings not measured.
