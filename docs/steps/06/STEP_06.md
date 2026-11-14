# Step 06 — historical metrics and evidence-based comparisons

Authorized by the user's “ok do next step” after the Step 06 explanation. Preserve
the optional-account goals already recorded; accounts/history remain a Step 07
gate. Step 05 provides pure schedules/constraints. Step 06 adds pure historical
analysis and bounded comparison, before full HTTP/worker orchestration in Step 07.

## Scope and method

Consume validated, immutable NASA POWER UTC snapshots with exact location,
snapshot identities and normalized content hashes. No provider change, new HTTP
route, account implementation, database migration or farmer screen is required.
Implement strict shared contracts, historical window metrics, complete consecutive
analog sequences, crop-specific temperature exposure, sourced ordinal water
comparisons, sourced predecessor-family proxies, comparable ranking and traceable
explanations. Require explicit baseline years and period split; do not silently
choose five years or impute missing days. Preserve real catalog bytes and gaps.

Map every sowing/harvest boundary by the same calendar-year offset. Reject analogs
with an unavailable February 29 boundary. Measure earliest and latest harvest
windows; use the larger exposure fraction for conservative duration uncertainty.
Support reviewed encoded stage offsets and daily air-temperature rules only;
instantaneous/soil/stage-mean or unresolved rules remain unevaluated. Historical
exposure is not a prediction, damage probability or future hard exclusion.

Use rainfall below 1 mm/day for a window-bounded dry spell, following Climdex's
threshold definition; do not call it a soil-drought diagnosis. Report rainfall,
variation and descriptive earlier/later differences, not statistical attribution.
Water-class arithmetic and ranking weights are explicit product heuristics.
Irrigation adequacy remains unknown without the inputs needed for a defensible
water balance. A family-transition proxy does not claim measured soil improvement.

## Acceptance

| ID  | Required evidence                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H01 | Current primary-source method/dependency review, compatibility, criteria before implementation; preserve approved stack and account goals.                                                                                                          |
| H02 | Pure library, strict inputs/outputs, deterministic ordering, immutable inputs, bounded snapshots/analogs/work/output; explicit limit failures, no partial success.                                                                                  |
| H03 | Exact requested location, UTC, compatible provider/API/adapter/source/parameter definitions, normalized hashes, physical checks; conflicting overlaps rejected and provenance retained.                                                             |
| H04 | Per-variable coverage and null incomplete metrics; rainfall totals/rates, temperature summaries, bounded dry spells; missing never means zero or complete.                                                                                          |
| H05 | Complete consecutive historical sequences, cross-year/leap behavior, earliest/latest windows and reviewed applicable stage offsets; no mixing unrelated years or optimistic duration selection.                                                     |
| H06 | Temperature exposure uses reviewed scoped rules and correct daily variable/medium/window; unsupported/reference rules remain explicit and cannot become scored evidence.                                                                            |
| H07 | Complete-analog variation and matched earlier/later period differences with counts/units and minimum evidence policy; no forecast, attribution or statistical-significance claims.                                                                  |
| H08 | Reviewed comparable water methods/classes and sourced family-transition proxies; missing evidence blocks affected comparison, irrigation adequacy always unknown, no soil improvement claim.                                                        |
| H09 | Hard exclusions outside scores; only comparable evidence groups with common complete anchor years; fixed documented weights vary by farmer priority, ties/sensitivity visible, no global winner across groups.                                      |
| H10 | Reasons trace actual inputs, catalog rules/citations, weather windows/snapshot IDs, metric values and missing checks; every considered choice retained.                                                                                             |
| H11 | Independent analytical/oracle tests, adversarial coverage/provenance/threshold/date/ranking cases, real NASA metric demo and labeled synthetic engine fixtures; public entry rejects synthetic evidence and production cannot run the fixture demo. |
| H12 | Full lint/format/types/build/tests, real PostgreSQL/recovery/browser/production-container/frozen-install gates, report/decisions/progress/commands and passed/failed/blocked matrix; READY_FOR_REVIEW then stop.                                    |
| A01 | Reviewed local cultivar calendars/durations/stage/temperature/water/rotation evidence and health rules required for real farmer comparisons; unresolved evidence remains BLOCKED.                                                                   |
| A02 | Regional agronomic validation and calibrated priorities required before farmer launch; no specialist review or empirical ranking validity invented.                                                                                                 |

## Files and checks

- `packages/contracts/src/engine/` for historical input/output contracts, plus
  optional catalog temperature stage offsets without defaults.
- `packages/domain/src/{climate,comparison,evidence}/` for pure measurements,
  analogs, crop metrics, ranking and explanations; public entry points.
- Labeled fixtures and `tests/unit/climate.test.mjs`, verification wiring and
  `tooling/engine/` demos. Source data/migrations remain unchanged.
- `docs/steps/06/`, decisions, progress, architecture and README.
- Actual dependency installation/frozen checks, affected suites, real/synthetic
  demos, full `pnpm verify`, peers/audit, data preservation and document checks.
