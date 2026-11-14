# Step 10 report — rotation engine core

Status: **READY_FOR_REVIEW**. Updated 2026-10-16. Engine, contracts and
backend workflow only; no new crop evidence, data provider, science model or
interface change.

## What changed

- **Catalog format 2** (`packages/contracts/src/catalog/catalog-v2.contract.ts`,
  `packages/catalog`): model types, harvest products, cultivars, rule scope by
  region, farming system and cultivar, verification status, source kind and
  rights, optional sourced region boundaries, crop issues and a conflict
  register. Cross-reference checks and deterministic hashing.
- **Release 0.2.0**: a reproducible mechanical conversion of 0.1.0 by
  `tooling/catalog/convert-release-v1.mjs`. The same 3 crops and 17 rules; rules
  stay `extracted`, rights `unknown`, regions without boundaries. Re-running
  the tool reproduces the committed files.
- **Request format 2**: 3–5 year horizon, first-sowing range, cultivar choices,
  crop-health issue ids or unlisted names, pH, salinity, organic matter and
  texture, reported water allocation, and 0–5 priority sliders. A shared
  normalizer keeps stored and assessed inputs byte-identical.
- **Rotation engine** (`packages/domain/src/rotation`): context resolution by
  sourced boundary, the evidence policy, interval scheduling with earliest and
  latest sowing dates, hard constraints (exclusions, return intervals,
  prohibited predecessors, confirmed health breaks, hard soil limits), a bounded
  beam search with five priority views and a per-first-crop quota, per-crop
  climate exposure combined into consecutive-year analogs, absolute 0–1 losses,
  the shared-dimension rule, Pareto set, ties, sensitivity views and full
  accounting of crops, choices, rejections and pruning.
- **Workflow 2**: format 2 requests need full planning, pin catalog 0.2.0,
  policy and acceptance date, fetch only the weather their analogs need (none
  when nothing is schedulable), checkpoint weather, and persist a hash-checked
  result. Migrations 0010–0011 allow format 2 catalogs, inputs and results.
  Format 1 requests and stored plans work as before.
- `pnpm catalog:import` now imports every release in version order;
  `ROTATION_CATALOG_VERSION` selects the format 2 catalog.

## Measured behavior

The benchmark uses 12 synthetic crops, month-long sowing windows, a 5-year
horizon and 30 analog years. It completes in **0.44 s** standalone and about
**1 s** inside Jest. The result is **664 KB**: 674 rotations completed and
compared, 16,909 partial rotations pruned, nothing truncated, every candidate
with 30 complete analogs. Peak memory for the whole benchmark process,
including synthetic weather generation, was 266 MB (`/usr/bin/time -l`).

Two optimizations made this possible:

- per-crop climate tables in day-number arrays;
- Temporal-backed cached day numbers.

The first version took 7.5 s, and 53 s under Jest. Output is identical before
and after.

## Verification

Run on 2026-10-16 while an unrelated `next-server` held port 3000.

- **Targeted runs: all passed.**
  - Rotation unit tests (22): geometry, windows, context, evidence policy, the
    real 0.2.0 catalog, scheduling invariants, return intervals, health breaks,
    weights, Pareto, the dimension rule, choices, determinism, truncation,
    weather ranges, the benchmark, day arithmetic against Temporal, 0.1.0 to
    0.2.0 fact equivalence, and catalog and request rejections.
  - Rotation integration (5) on real PostgreSQL: HTTP acceptance of both
    formats, the real catalog with no weather calls, the synthetic pipeline with
    pinned weather and hash-checked results, retry after a provider failure,
    and the database refusing a mismatched result.
  - Catalog unit and integration (76).
- **`pnpm verify`, 15:55–16:00 UTC: passed.** Lint with typed promise rules,
  Prettier, strict types, **479 Jest tests**, **5 Chromium tests**, build,
  **9 production-container checks** (both releases imported idempotently) and a
  clean frozen install/build. No test containers were left.

Not re-run: `pnpm peers check` and `pnpm audit --prod`, because no dependency
changed. The production-container check exercises the format 1 pipeline; the
format 2 pipeline is covered by integration tests on the compiled code, not
inside the container.

## Acceptance

| ID  | Status | Evidence                                                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------- |
| E01 | Passed | Catalog v2 contract and cross-reference validation; rejection tests                         |
| E02 | Passed | Release 0.2.0, fact-equivalence test, reproducible conversion, both formats imported        |
| E03 | Passed | Request v2 contract and rejection tests; format 1 still accepted over HTTP                  |
| E04 | Passed | Boundary resolution, farming system, cultivar handling; unresolved region tests             |
| E05 | Passed | Interval scheduling invariants; orchard unsupported                                         |
| E06 | Passed | Exclusion, return-interval and confirmed-break tests; soft rules warn                       |
| E07 | Passed | Unverified and reference rules never schedule; tiers and NOT_EXPERT_REVIEWED reported       |
| E08 | Passed | Per-crop exposure tables and consecutive-year analogs; missing weather disables climate     |
| E09 | Passed | Absolute losses and the shared-dimension rule with disclosed reasons                        |
| E10 | Passed | Weighted order, ties, Pareto check, single-dimension and ±0.1 views                         |
| E11 | Passed | Choices for every named crop; rejection, pruning and truncation counts                      |
| E12 | Passed | Benchmark: 12 crops, 5 years, 30 analogs, 0.44 s standalone, 664 KB                         |
| E13 | Passed | Workflow v2 pins and integration tests; no weather for unschedulable requests; v1 unchanged |
| E14 | Passed | Full `pnpm verify` passed; commands and results above                                       |

## Limits

- **No real advice yet.** Catalog 0.2.0 has no boundaries and no verified binding
  rule, so real requests return `insufficient_evidence` without weather. Step
  12 must add sourced boundaries and double-checked pilot rules.
- **The search is bounded.** It reports pruned counts and does not claim that
  every possible rotation was evaluated. Rotations are maximal; explicit fallow
  seasons and later window occurrences of the same crop are not generated.
- **Scores are proxies.** Water is still a relative demand class, and soil
  health counts sourced preferred predecessors. Steps 11 and 13 add NASA layers
  and the FAO-56, AquaCrop and RothC models.
- **The interface is unchanged.** It still uses format 1 and cannot show format
  2 results; that is Step 15.
