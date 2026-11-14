# Step 05 — deterministic calendars and constraints

Authorized by the user's explicit instruction to implement Step 05. The roadmap
and completed Step 04 establish this as the next component: a pure calculation
engine consumes the validated inputs and catalog before weather scoring and the
complete API workflow can be built.

## Scope

Build `packages/domain` with strict runtime inputs/output, Temporal calendar
arithmetic, complete two-cycle candidate enumeration and traceable constraints.
Keep every considered first crop, unsupported choices and rejected sequences.
Assess catalog alternatives under the same rules. Do not integrate planning into
the intake worker/API, rank candidates, fetch weather, create farmer screens or
implement Steps 06–12.

The real catalog has no reviewed local duration intervals or health-break rules.
Preserve its immutable release and return evidence gaps, never invented dates or
recommendations. Positive and negative algorithm cases use clearly synthetic
fixtures which the public production engine and catalog importer reject.

## Acceptance

| ID  | Required evidence                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E01 | Roadmap/source review, detailed scope before implementation, current official dependency references and actual stable installation/compilation.                                                                                                                                                                                |
| E02 | Pure package independent of Nest, HTTP, database, filesystem, UI, clock, randomness and ambient configuration; enforced import/ambient restrictions.                                                                                                                                                                           |
| E03 | Strict ISO calendar dates; inclusive recurring windows, year wrap, real leap days, conservative duration envelope and second sowing strictly after latest first harvest. Calendar-year return intervals document leap anniversaries.                                                                                           |
| E04 | Exhaustive deterministic enumeration within explicit work/output bounds; no silent sampling/truncation, no partial successful result on a limit. Include every considered crop and catalog alternative, exclusions and traceable empty-calendar outcomes.                                                                      |
| E05 | Reviewed applicable region/system/cultivar evidence required for dates; unresolved scope and research/approximate/illustrative evidence produce gaps. No coordinate-to-city guess or inference of system from available water.                                                                                                 |
| E06 | Hard constraints before any later scoring: farmer exclusions, calendar/horizon, known method-compatible soil pH, sourced prohibited family transitions and same-crop return intervals. Unknown history, unsupported predecessors and unknown/incompatible soil remain explicit. Preferences cannot fabricate soil improvement. |
| E07 | Typed reviewed crop-health host/break rules; exact supported observation matching, traceable anchor dates and independently verified observation context required for hard health effects. Unconfirmed, unmapped, unlinked and undated observations cannot become hard exclusions. Missing health knowledge remains visible.   |
| E08 | Structured reasons identify input paths, rule/source citations and actual facts. Candidate assessment separates failure, missing evidence, conditional inputs and deferred weather/water/ranking. Eligible means this component's assessed checks only; no irrigation sufficiency or recommendation claim.                     |
| E09 | Preserve existing catalog bytes/hashes and immutable SQL; backward compatible optional new rule group without adding fields to old parsed releases. New references/review/host constraints validated. Production rejects nested synthetic evidence.                                                                            |
| E10 | Independent small-calendar oracle, permutation/immutability, bounded-search, adverse history/health/soil and date tests; real catalog demo yields honest gaps. Existing real PostgreSQL/worker/browser gates remain intact.                                                                                                    |
| E11 | Full lint/format/type/build/test gate, frozen clean installation/build, peer/audit review and existing non-root production containers. No removed/weakened tests or suppressed failures.                                                                                                                                       |
| E12 | Report, decisions/progress, exact versions/commands/results, demo, limitations and acceptance matrix. READY_FOR_REVIEW if the component passes; unresolved local agronomic evidence explicitly recorded. Stop after Step 05.                                                                                                   |

## Planned files/checks

The user's later Step 05 revision request also authorizes current API/method
research and defects within this same component. It does not start Step 06 or
authorize provider integration. Additional acceptance evidence: the transitive
graph rejects Node builtins/Buffer; full results are independent of import-time
clock initialization and evaluation reads no clock; reference/soft durations,
tied historical harvests and search accounting have regression cases. Important
API/method decisions and actual probes are documented under this step.

- `packages/domain/src/{calendar,evidence,constraints,sequences}/`, manifest and TypeScript config.
- Shared engine contracts and compatible optional health/transition catalog rules.
- Synthetic engine fixtures/tests, local real-catalog gap demo, build/lint/verification wiring.
- Step report, decision record, progress, README and structure guide.
- Actual installation, engine tests, `pnpm verify`, `pnpm peers check`, runtime audit,
  catalog preservation, local links and Git whitespace checks.
