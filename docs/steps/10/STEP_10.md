# Step 10 — rotation engine core

Authorized by the user's 2026-10-16 message "do the next step" after the Step 09
report proposed this step. Build the multi-year rotation engine, its catalog and
request contracts, and the backend workflow that runs it. No new crop evidence
(Step 12), new data providers (Step 11), science models (Step 13), crop-health
photo work (Step 14) or interface change (Step 15). The current interface keeps
using the two-cycle engine until Step 15.

## Acceptance

| ID  | Required behavior                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E01 | Catalog v2 contract: model types, harvest products, cultivars, rule scope (regions, farming systems, cultivars), verification status, source kind and rights, optional region geometry, conflict register.                                       |
| E02 | Real catalog release 0.2.0 in v2 format with exactly the facts of 0.1.0 and no new evidence; the importer handles both formats; releases stay append-only.                                                                                       |
| E03 | Plan request v2: 3–5 year horizon, first-sowing range, cultivar choices, crop-health issue ids, extended soil observations, farmer priority weights. v1 requests remain accepted for the current interface.                                      |
| E04 | The pure engine resolves context: every catalog region containing the point, farming system from water, farmer cultivars. Unresolved items are listed and limit the result.                                                                      |
| E05 | Rotation scheduling uses sowing intervals with earliest and latest dates per slot, duration envelopes, a declared preparation-gap policy and the horizon. Orchard and protected crops are unsupported.                                           |
| E06 | Hard constraints run before scoring: exclusions, return intervals, prohibited predecessors, confirmed health breaks, hard soil limits. Soft rules become warnings.                                                                               |
| E07 | Only double-checked or expert-reviewed hard or soft rules with interpretable bases schedule crops. Other rules are reported as gaps. Results state their evidence tiers and expert-review status.                                                |
| E08 | Climate exposure is precomputed per crop, sowing date and analog year, then combined into consecutive-year analog sequences per rotation. Missing data stays missing; a minimum complete-analog policy holds.                                    |
| E09 | Dimensions use absolute 0–1 losses: climate, water (comparable sourced classes), soil health (sourced preferred predecessors; unknown counts as unmet), crop health. A dimension missing for any rankable candidate is disclosed and not scored. |
| E10 | One comparison for all candidates: Pareto set, farmer-weighted order, deterministic ties, weight sensitivity (±0.1 transfers and single-priority views) and worst-decile climate robustness.                                                     |
| E11 | Full accounting: every farmer-named crop is assessed; every candidate is counted as ranked, rejected (reason codes), unrankable or pruned. Search truncation is reported instead of failing the plan.                                            |
| E12 | A committed benchmark with at least 12 synthetic crops, month-long windows, a 5-year horizon and 30 analog years completes within a recorded time and size budget.                                                                               |
| E13 | Workflow v2 pins catalog, versions and policy atomically, fetches only needed weather (none when nothing is schedulable), persists hash-checked results, and leaves v1 records and requests working.                                             |
| E14 | Pure unit tests, real PostgreSQL integration tests for workflow v2 and all existing suites pass; full `pnpm verify` passes; the report records commands, results and limits.                                                                     |
