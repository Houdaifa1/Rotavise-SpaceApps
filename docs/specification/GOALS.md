# Product goals

Version 2, 2026-10-16. One farmer app for the
[Field Shift challenge](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/)
and for real use in Morocco afterwards. [Specification](ROTAVISE_HANDOFF.md);
[current state](../PROGRESS.md). Earlier goals are in
[archive/goals-2026-09-30.md](../archive/goals-2026-09-30.md).

| Goal | Deliverable                                          | Steps  |
| ---- | ---------------------------------------------------- | ------ |
| G01  | Multi-year rotation explorer with one comparison     | 10, 15 |
| G02  | NASA Earth observations in every assessment          | 11     |
| G03  | Climate exposure, extremes and future adaptation     | 11, 13 |
| G04  | Water need against supply                            | 13     |
| G05  | Soil health trajectory                               | 12, 13 |
| G06  | Crop health: disease breaks, reports, photo triage   | 12, 14 |
| G07  | Sourced Moroccan crop knowledge base                 | 12     |
| G08  | Accounts, saved fields, field diary and plan history | 07, 15 |
| G09  | Farmer interface: Arabic and French, map, low data   | 15     |
| G10  | Production operations and public demo                | 16     |

## G01 — Rotation explorer

Compare 3–5 year rotations, generated or built by the farmer, in one
comparison: Pareto set, priority-weighted order, ties, weight sensitivity and
robustness across climate scenarios. Every crop the farmer named and every
candidate is accounted for. A committed benchmark meets the scale requirement
in the specification.

## G02 — NASA Earth observations

Use POWER, GPM IMERG, SMAP, HLS, OPERA DIST and NEX-GDDP-CMIP6 where each
changes a decision, with source identity, resolution, dates, coverage and
missing data shown. A grid value is never presented as a field measurement.

## G03 — Climate and adaptation

Stage-level temperature, rain and extreme-weather indicators over historical
analog years and future scenarios. Period changes and projections are
described as such, never as forecasts or guarantees.

## G04 — Water

FAO-56 crop water need and net irrigation need compared with the farmer's
reported supply, with shortage periods and uncertainty. POWER-based ET₀ is
checked against station data before results are shown.

## G05 — Soil health

Soil-carbon trajectory (RothC, FAO GSOCseq approach) plus legume share, family
diversity and residue, from cited inputs. Estimates are labelled as model
results with ranges; no measured improvement is claimed.

## G06 — Crop health

Sourced host and break rules, pick-list reports and photo triage that may
abstain. Unconfirmed reports warn; confirmed ones can bind rules. No diagnosis
claims, no treatment advice. Photo triage passes a labelled local evaluation
before release.

## G07 — Crop knowledge

Identity inventory of Moroccan crops and pilot profiles extracted from cited
sources, with page references, strength labels, conflicts and gaps. Results
say "not yet expert-reviewed" until a specialist review is recorded.

## G08 — Accounts and history

Keep the Step 07 guarantees: optional accounts, guest privacy, owner-scoped
data, explicit claim, deletion and retention. Add a field diary that feeds
history after the farmer confirms each entry.

## G09 — Farmer interface

Built only after the design is agreed with the user. Arabic (right to left)
and French, map with coordinate fallback, plain explanations, WCAG 2.2 AA and
usable on low-cost phones and weak connections.

## G10 — Production and demo

Meet the production gates in the specification and publish a public demo for
judges. External deployment, accounts and publication need the user's
explicit action.
