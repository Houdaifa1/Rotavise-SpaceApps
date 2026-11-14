# Progress

Status: **IN_PROGRESS — Step 12 Part B** (all of Morocco; Part A is ready for review).
Step 11 was closed by the user's 2026-10-18 messages "fix all the what's left,
of course, uh, as planned" and "So, go ahead, and start with the". Step
10 was closed by the user's 2026-10-17 message "Start Step 11. I'll create the
NASA Earthdata Login account and tell you when it's ready." Step 09 was closed by
the user's 2026-10-16 message "do the next step". Step 08 was closed
by the user's 2026-10-16 instruction to proceed; its interface will be redesigned
in Step 15. No full later milestone is authorized. This is not a launch claim.

Scoped FM map/usability follow-up (user-requested, 2026-11-12): EOX 2025
non-commercial prototype base, selectable NASA date imagery, bilingual
OpenFreeMap orientation, compact service status and responsive map controls.
The required checks passed (423 unit, 388 web, 9 FM and 83 full browser tests); 10 m source imagery remains
visibly softer than the supplied OneSoil field photos and is an explicit
acceptance gap. [FM notes](steps/15/fm-notes.md) preserve the real blocked-shell
baseline and provider comparison. Changes remain uncommitted and unpushed;
this is not milestone approval or a deployment claim.

Scoped income/benefits wiring follow-up (explicit user task, 2026-11-10):
additive opt-in catalog 0.14.0, pinned historical gross-revenue scenarios,
conditional benefits, partial unranked RUSLE exposure and per-result coverage.
The default catalog stays 0.13.0; earlier releases and policy output hashes are
preserved. Verification and remaining limits are recorded in
[wire notes](steps/15/codex-wire-notes.md). This is not milestone approval or UI
work. Changes remain uncommitted and unpushed pending review.

Glossary-only Step 15 follow-up (user-requested, 2026-11-10): reviewed all 332
French and Standard Arabic entries, corrected 59 French and 191 Arabic entries,
and added Darija (`ary`) for every code with RTL metadata. All translations
remain machine-written and unreviewed by a person. OpenAPI was regenerated;
lint, types, 30 unit tests, 26 glossary/API-doc tests and 72 backend tests passed.
The first format check identified only formatting in the supplied task prompt;
final formatting verification is recorded in the
[review notes](steps/15/codex-glossary-review-notes.md). Work remains uncommitted
at the user's instruction; native-speaker review is pending. This follow-up does
not authorize the full Step 15 frontend milestone or close Step 12.

Scoped ECOSTRESS follow-up explicitly requested on 2026-11-09:
`ecostress-policy-2` selects the documented good/excellent LST accuracy
classes, with request pinning and legacy replay. The suspect dawn row is
excluded by quality, and September 2024 has no admitted LST; no universal
temperature cutoff was sourced. This is not milestone approval. Sources,
limits and checks: [ECOSTRESS notes](steps/15/codex-ecostress-limit-notes.md).

The plan now follows the
[Field Shift challenge](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/):
multi-year rotations, NASA Earth observations, soil, water, climate and crop
health. See the [specification](specification/ROTAVISE_HANDOFF.md) and
[decisions](DECISIONS.md). The current interface is still the Step 08 one: accounts, private
plans, NASA POWER weather and a two-cycle engine whose catalog gives **no crop
recommendation**. The multi-year rotation engine (API only until Step 15) now
compares real Tadla rotations.

Step 11 stopped storing farm positions with weather (POWER cell centres), added
NASA NEX-GDDP-CMIP6 future climate in five models and two pathways (the Tadla
tile is prepared), and added field outlines with HLS greenness and green
seasons, SMAP soil moisture and GPM rain via the Earthdata account.
`pnpm verify` passed on 2026-10-18: **531 Jest** and **5 Chromium** tests,
build, production container checks and a clean frozen install/build.
[Step 11 report](steps/11/report.md).

Step 12 added catalog release 0.3.0: rules from official Moroccan guides and
FAO methods, each with its page and exact words, and every quote (126) found
on its page by machine. Durum and bread wheat, barley, faba bean and sugar
beet can now be planned in the Tadla pilot. A real Tadla request with live
NASA POWER and the NEX-GDDP-CMIP6 tile returned compared rotations on
2026-10-18. The rules are **not yet expert-reviewed**, and results say so.
`pnpm verify` passed on 2026-10-18: **540 Jest** and **5 Chromium** tests,
build, production container checks and a clean frozen install/build.
Part B so far (2026-11-01): plans across Morocco (catalog 0.6.0) with a FAO-56
water balance on GPM-corrected rain, future rain, extremes, SoilGrids soil,
AquaCrop yields (uncalibrated), RothC soil carbon, Claude crop health (no key yet,
never run against the real API) and guest access. `pnpm verify` passed with 581
Jest and 5 Chromium tests. Catalog 0.9.0 (24 plannable crops, 6 trees as
orchards): `pnpm verify` on 2026-11-01 in a cloud container (Node 24.19.0)
passed lint, format, types, **591 Jest** and **5 Chromium** tests and the
build; `pnpm test:container` failed there only because the cloud proxy's
certificate is not trusted inside `docker build` (npm self-signed error), so
it was rerun on the user's Mac on 2026-11-02 and passed (all 9 container
checks); `pnpm test:clean` passed alone in the cloud.
On 2026-11-02 the ranking was made fair (rotation-engine-6,
planning-workflow-5, migration 0020; DECISIONS "Fair ranking"): faba bean no
longer wins on its frost-only check, and soil scores only checkable crop
changes. A slow loop in the engine was fixed with byte-identical results
(DECISIONS "Engine speed"). `pnpm verify` passed on GitHub Actions for commit
42d7024 on 2026-11-02: **594 Jest** and **5 Chromium** tests, build,
production container checks and the clean install, in 16 minutes.
On 2026-11-03 the photo check was hardened (DECISIONS "Photo check
hardening") and climate now compares crops on the checks they share.
`pnpm verify` passed on GitHub Actions for commit 3690bd9 on 2026-11-03:
**613 Jest** and **5 Chromium** tests, build, production container checks
and the clean install. No real Claude API call has been made yet.
Next, in the user's order: Codex crop-facts research, then local operations,
the AI key and live photo check, hosting on the Mac, Resend; the frontend
comes last. The
climate download is stopped at 4 of 89 tiles; restart it with
`docker compose -f infra/science/download.compose.yaml up -d`.
Catalog 0.10.0 (2026-11-07, not the deployment default; set
`PLAN_CATALOG_VERSION=0.10.0` to use it) holds 207 crops, 557 cultivars, 387
crop problems and 1,366 rules. Facts from the AI model's training are stored
as `model_recall` evidence (confidence and basis, no quote), and the engine
treats them like any other rule. They are unverified and nothing is
expert-reviewed. [Design](steps/12/catalog-0.10.0-design.md),
[merge log](evidence/catalog/2026-11-07/merge-log.json).
[Step 12 report](steps/12/report.md).

| Step | State                | Result or next gate                                                           |
| ---- | -------------------- | ----------------------------------------------------------------------------- |
| 01   | Built                | Workspace, health, migrations, durable jobs                                   |
| 02   | Built                | NASA POWER adapter, real evidence/cache, protected API                        |
| 03   | Built                | Immutable sourced three-crop research catalog; local review pending           |
| 04   | Built                | Validated input, private guest ownership, durable intake                      |
| 05   | Built                | Pure two-cycle sequence and constraint engine                                 |
| 06   | Built                | Historical exposure, comparison/ranking and explanations; honest gaps         |
| 07   | Built                | Optional email accounts, owned fields/history, full durable backend           |
| 08   | Closed               | Farmer form/results, weather explorer, saved-data UI, conditional Google      |
| 09   | Closed               | Re-baseline spec; correct Step 08 claims; foundation hardening                |
| 10   | Closed               | Engine core: context, multi-year rotations, scale, one comparison, catalog v2 |
| 11   | Closed               | NASA data layer, future climate and location privacy                          |
| 12   | **READY_FOR_REVIEW** | Crop knowledge pilot and disease tables                                       |
| 13   | Not started          | Science service: water, soil carbon, AquaCrop, extremes                       |
| 14   | Not started          | Crop health: rules, reports, photo triage, OPERA DIST alerts                  |
| 15   | Not started          | Frontend after design agreement                                               |
| 16   | Not started          | Production operations and public demo                                         |
| 17   | Not started          | Space Apps submission material, after the organizers answer                   |

Known blockers for real advice: no region/cultivar resolution in production,
engine limits at realistic sizes, no reviewed local crop rules. Release also
needs real Google and email delivery, security and load review, backups and
deployment. Earlier milestone evidence stays in `docs/steps/01`–`08`.

Scoped engine-output follow-up requested on 2026-11-10: implementation under
`rotation-outputs-1` adds candidate stage exposure reports, pinned owned-field
terrain/water context, explicit missing RUSLE factors, optional farmer limits
with unsupported-data gaps, and NASA grid provenance. No frontend milestone or
release approval is recorded. Current verification and limits are in
[engine-output notes](steps/15/codex-engine-outputs-notes.md); work is uncommitted
for review and has not been pushed.

Scoped B2r follow-up explicitly requested on 2026-11-10: researched free field
boundary sources for Morocco and selected existing FTW 2025 polygons as optional
suggestions, with manual outlining for gaps. Added a disabled-by-default backend
import/store/read integration, contracts/OpenAPI/glossary/attribution and real
PostgreSQL tests. No detector or frontend was built; Moroccan accuracy and
country-wide load/performance remain unmeasured. The source comparison, saved
response hashes and real overlays are in the
[research report](evidence/field-boundaries/2026-11-10/field-boundaries-report.md);
checks, demo and limitations are in [B2r notes](steps/15/b2r-notes.md).
This is separate task authorization, not milestone approval. Work remains
uncommitted and unpushed for review.

Scoped B4 benefits follow-up explicitly requested on 2026-11-10: all 246 crops
have records for 12 effects in opt-in release 0.15.0, with sourced/recall/not-
applicable provenance. Sourced crop coverage increases from 45 to 107. Four
multilingual role explanations and pinned per-strategy benefit selections are
served by the backend. Erosion remains unranked because complete sourced RUSLE
factors are absent. The default catalog and earlier release bytes are preserved;
B4 adds no income facts/calculations or frontend work. Current checks, migration
0027, limits and proposed review text are in [B4 notes](steps/15/b4-notes.md).
Work remains uncommitted and unpushed; this does not approve or advance a milestone.
