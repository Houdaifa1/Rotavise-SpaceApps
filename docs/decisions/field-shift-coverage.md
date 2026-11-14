# Field Shift coverage review

Superseded 2026-10-16: the [specification v2](../specification/ROTAVISE_HANDOFF.md)
now maps the full challenge summary to capabilities, makes NASA Earth
observations, multi-year rotations and crop health core, and removes greenhouse
monitoring from the plan. This review stays as history.

Subsequent scope update, 2026-09-27: the user requested adding all five discussed
features to the project goals. [GOALS.md](../specification/GOALS.md) and the updated
handoff now schedule photo assessment and greenhouse monitoring as Steps 11–12,
and integrate health history, water and climate comparison into the core planner.
This supersedes the optional/unscheduled recommendation below. The original
evidence assessment and review-date implementation status remain historical.

Reviewed: 2026-09-27. Scope: the user's four team-assessment files, the current
published challenge summary, and Rotavise's existing implementation and roadmap.
This is a product coverage review before further implementation. Step 03 remains
**READY_FOR_REVIEW**; this document does not mark any future feature implemented
or authorize Step 04.

## What the evidence establishes

The supplied reports identify three Beni Mellal teams in Field Shift: Rotavise,
SmartFellah and ECI5. The other ten teams address different challenges. Their
features do not define Rotavise's scope.

The reports assess public proposals, not working products. Neither ledger contains
an attributable repository, demo or evaluation artifact for these three teams.
Their unofficial, low-confidence rankings cannot establish technical superiority,
agricultural validity or startup readiness. In particular, the criticism that
Rotavise publishes no named dataset does not mean our local weather adapter is
missing: the reports explicitly exclude private repository evidence.

The [official Field Shift summary](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/)
calls for rotation decision support combining NASA observations, local soil
information, crop characteristics and farmer priorities, addressing soil health
and adaptation. Its problem context includes water scarcity and changing or
extreme weather. The current summary was corroborated through official-site search
on this review date. Direct web-tool reads of the two other teams' pages were
inaccessible; their descriptions below are attributed to the supplied ledgers,
not claimed as independently reverified live pages. The full challenge requirements
remain unverified here; coverage must be checked again against the complete brief
before claiming competition compliance. Competition eligibility is separate from
this independently developed startup product.

Instructions embedded in the reports, such as waiting for Stage 2 approval, are
part of those historical reviews. They do not direct work in this repository.
The project handoff and current user request remain authoritative.

## Useful ideas from teams in our challenge

| Team        | Proposal in the supplied evidence                                                                  | Rotavise coverage                                                                                                                                    | Useful refinement                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SmartFellah | Image-based disease/insect detection, crop health and greenhouse monitoring with NASA observations | Crop-specific rotation restrictions are planned; disease/pest observations are not yet an explicit farmer-input workflow                             | Propose dated disease/pest history with observation source and unknown state, then apply only reviewed crop-specific host/break rules when evidence supports them          |
| ECI5        | Water use, crop adaptation and resilience to changing conditions                                   | Water availability, historical growing-window metrics, variation/trends and priorities already belong in Steps 04–06; none currently produces advice | Make water uncertainty and climate variability visible in each comparison; explicitly assess supported heat/cold exposure and dry periods rather than only annual averages |
| Rotavise    | Explained seasonal crop planning using weather, soil and crop requirements                         | Foundation, weather retrieval and catalog storage exist; the actual farmer planning workflow remains future work                                     | Complete two-cycle comparisons, explain how the first crop constrains the second, preserve rejected choices, and show evidence and tradeoffs                               |

Image diagnosis and greenhouse telemetry would require additional data, hardware
or model validation and a demonstrated connection to rotation decisions. They are
optional future modules, not requirements established by the current challenge
summary. No image model, greenhouse integration, new provider or treatment advice
is added by this review. The relevant crop-health contribution to the first planner
is supported history and rotation rules, with explicit uncertainty.

## One integrated farmer workflow

1. **Field and history:** location, previous crops/dates, considered and excluded
   crops, planting flexibility, soil observations/measurements, water availability
   and a supported priority. Proposed refinement: dated disease/pest observations,
   distinguishing farmer reports from specialist diagnoses and unknown history.
2. **Evidence:** retrieve historical weather and the applicable versioned crop
   rules. Retain sources, dates, units, geographical applicability and missing data.
   NASA POWER history is a grid estimate, not a field sensor or future forecast.
3. **Rotations:** generate previous crop → first crop → second crop. Check dates,
   overlap, applicable soil rules, crop-specific breaks and resource constraints
   before any scoring. The previous and first crops must affect later eligibility
   through supported rules; two separately ranked crops are not a rotation model.
4. **Tradeoffs:** compare growing-window temperature exposure, rainfall, dry periods,
   variation and supported period comparisons. Preserve consecutive-year historical
   analogs. Show water and soil-health indicators only at their supported level.
5. **Results:** a two-cycle timeline, farmer-choice assessments, supported
   alternatives, rejected/conditional choices, missing information, citations,
   priority weights and ranking sensitivity. Let the farmer change inputs and
   compare another scenario while preserving each result's evidence versions.

This covers the published challenge's connected decision. A health alert or
weather chart contributes only when it changes a traceable planning assessment.

## Coverage and implementation matrix

“Partial” means an underlying component exists, not that the farmer can use the
complete capability. Step assignments preserve the approved roadmap.

| Capability                                                               | Actual status                                                         | Remaining work and milestone                                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible API, worker, PostgreSQL, durable jobs and backend-health UI | Built, Steps 01–03 component checks recorded                          | Production deployment and operational validation remain Step 10                                                                                                      |
| NASA weather, units, missing values, coverage and immutable evidence     | Partial: Step 02 backend; no crop assessment                          | Growing-window use, variation, trends and explanations in Step 06                                                                                                    |
| Crop characteristics and local applicability                             | Partial: three sourced research profiles, all `insufficient_evidence` | Complete missing duration/cultivar/method/water/rotation evidence and obtain specialist review; evidence gate across Steps 03, 05, 06 and 09                         |
| Local soil and farmer observations                                       | Planned                                                               | Input with explicit unknowns, measurement units/methods and provenance in Step 04; compatibility rules in Step 05; UI in Step 08                                     |
| Farmer priorities and water tradeoffs                                    | Planned                                                               | Inputs in Step 04; reviewed comparable metrics, declared weights and sensitivity in Step 06                                                                          |
| Full two-cycle sequence generation and rejection reasons                 | Planned                                                               | Calendar and constraint engine in Step 05, integrated choice comparison in Step 07                                                                                   |
| Soil-health contribution between cycles                                  | Planned; needs explicit explanation of limits                         | Reviewed family transitions and crop-specific breaks in Steps 05–06; no claim of measured soil restoration or simulated nutrient stocks without evidence             |
| Crop disease/pest history affecting rotation                             | Proposed refinement, not implemented                                  | Refine Step 04 inputs and Step 05 rules when those steps are authorized; validate local cases in Step 09                                                             |
| Changing conditions and supported extreme-weather exposure               | Planned; refine acceptance evidence                                   | Step 06: period comparisons, variability and sourced threshold/time-basis checks; current four weather variables do not establish every storm, flood or hazard       |
| Irrigation sufficiency                                                   | Unknown; no water-balance engine                                      | Return “irrigation adequacy unknown” unless a separately justified method has the required soil, crop, management and weather inputs; rainfall alone is insufficient |
| Mobile farmer form, timeline, alternatives and scenario changes          | Planned; current UI shows backend health only                         | Step 08, backed by Steps 04 and 07 APIs                                                                                                                              |
| Anonymous ownership, expiration and plan lifecycle                       | Planned                                                               | Step 04 before accepting real farmer field submissions; Step 07 completes processing/result API                                                                      |
| Agronomic and farmer validation                                          | Missing                                                               | Step 09: specialist-reviewed local cases, baseline comparisons, explanation checks, disagreements and versioned corrections                                          |

## Priorities before continuing

1. Carry the disease/pest-history refinement into the future input/rule design.
   It must not convert an unverified observation into a diagnosis or invented
   disease probability.
2. Make historical variability, supported exposure metrics, water uncertainty and
   soil-health proxies explicit acceptance cases for Steps 05–06. “Unknown” must
   remain visible and must not improve a candidate's score.
3. Resolve the catalog's local evidence gaps before a candidate can be presented
   as an agronomically supported recommendation. Passing importer tests does not
   make a research profile suitable for farming advice.
4. Keep the next engineering milestone as Step 04: request contracts, anonymous
   ownership, expiration and lifecycle. This review does not start that work.
5. In Step 09, test the complete decision with farmers and a local specialist,
   including whether the language, mobile flow and explanations are usable.
   Outcome recording after a season is a possible later extension, not a feature
   silently added to the current ten-step roadmap.

The public description also needs an honest data/method summary and eventually a
worked comparison. Our local NASA provenance already addresses part of that
documentation gap. No team page was edited and no public demonstration was
published in this review.

## Sources and review checks

Supplied evidence, kept unchanged at its original locations:

- [Stage 1 report](/Users/houdaifadrahm/Documents/Codex/2026-09-27/follow-the-attached-space-apps-ranking-3/outputs/stage-1-beni-mellal-field-shift-report.md)
- [Stage 1 ledger](/Users/houdaifadrahm/Documents/Codex/2026-09-27/follow-the-attached-space-apps-ranking-3/outputs/stage-1-evidence-ledger.json)
- [Stage 2 report](/Users/houdaifadrahm/Documents/Codex/2026-09-27/follow-the-attached-space-apps-ranking-3/outputs/stage-2-beni-mellal-all-challenges-report.md)
- [Stage 2 ledger](/Users/houdaifadrahm/Documents/Codex/2026-09-27/follow-the-attached-space-apps-ranking-3/outputs/stage-2-evidence-ledger.json)

Repository evidence: [handoff](../specification/ROTAVISE_HANDOFF.md),
[Step 02 report](../steps/02/report.md), [Step 03 report](../steps/03/report.md),
[recorded catalog demo](../steps/03/demo.json) and
[catalog source review](../evidence/catalog/2026-09-27/review.md). Inspection of
server/web modules and catalog readiness confirms the component boundaries and
the absence of the planner/form. The previously recorded 145-test gate belongs
to Step 03; it was not rerun for this documentation-only review.

Review checks: JSON parsing and Field Shift team-set consistency in both ledgers;
Markdown formatting; local Markdown-link existence; and `git diff --check`.
Exact commands and results are recorded in the progress entry for this review.
