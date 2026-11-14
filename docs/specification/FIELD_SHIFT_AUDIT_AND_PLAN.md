# Field Shift audit and finishing plan

Audit date: **2026-11-08** (6 days before the hackathon, 14–15 Nov 2026).
Read on that date from spaceappschallenge.org: the challenge page (Details tab),
the Resources tab, the Participant FAQ (dated 2026-11-05) and the Participant
Terms and Conditions (updated 2026-08-07). Nothing here is a launch claim and
nothing was changed in code. Status words: **MET**, **PARTIAL**, **MISSING**,
**UNVERIFIED**. Evidence is a file path or command that was run.

## 0. What the sources say (facts, not interpretation)

- **Challenge page.** "Field Shift: Adapting Farms with NASA Data", difficulty
  Advanced/Intermediate, subjects Arts & Multimedia, Earth Science, Software.
  Asks for a decision-support tool (app, model, interactive map or other) that
  uses NASA Earth observations with local soil information, crop
  characteristics and farmer priorities so farmers can explore rotation
  strategies that strengthen soil health and adapt to changing conditions.
  The tool should support, not replace, farmer judgment and local expertise.
- **Resources tab.** Says "Resources will be available on Friday, November 13."
  No dataset list is published yet. The page has no embedded challenge video;
  its only video link is the NASA Space Apps YouTube channel. No video could
  be watched for this audit; ask the user for the exact video URL.
- **FAQ, rules that bind us.**
  - Dates: event 14–15 Nov 2026; Resources, Project Submission and Judging
    guides appear 13 Nov. Registration stays open until 15 Nov.
  - "Teams are not allowed to begin working on the challenges prior to the
    hackathon." (FAQ, "What are the challenges?")
  - Teams: 1–6 members, one team, one challenge; Universal Event teams need at
    least two people to be globally judged.
  - Submission is through the team project page on spaceappschallenge.org.
  - SI (AI) tools may be used; the submission must describe how they were used.
- **Terms.** Original content must be freely available or OSI open source
  (Apache 2.0 is applied if none is named). Non-NASA materials (data or code)
  must be freely and publicly available or open source, with licences named in
  the submission documentation, and every source cited even if open. NASA may
  remove nominations, awards or winner status for missing citations. Solutions
  may not include material promoting commercial services or products,
  proprietary or business-sensitive information, work whose rights the team
  does not hold, personal data, or recognisable images or voices of people
  under 18. NASA may remove a participant or solution for any rules violation
  at any time. Participants affiliated with China or Chinese-owned entities,
  and US civil servants, cannot take part.

## 1. Challenge requirements against the project

| #    | Requirement (challenge text)                                                                                 | Status                | Evidence and gap                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1  | Decision-support tool combining NASA Earth observations, local soil, crop characteristics, farmer priorities | **PARTIAL**           | Backend does it: POWER weather, GPM-corrected rain, NEX-GDDP-CMIP6, SoilGrids, catalog 0.10.0 (207 crops), priority sliders (`packages/contracts/src/plans/plan-v2.contract.ts`). Not reachable by a user: the web app sends `schema_version: "1"` only (`apps/web/src/features/planner/components/PlanForm.tsx:108`), so format 2 results cannot be shown.                                                                                            |
| 1.2  | Compare at least three rotation strategies **including the existing rotation**                               | **PARTIAL / MISSING** | The engine searches and ranks many multi-year rotations (`packages/domain/src/rotation/search.ts`, `assess.ts`). The request has crop **history** and considered/excluded crops, but no field for "the rotation I run today" to be scored as the baseline strategy (`plan-v2.contract.ts` lines 60–160). The UI cannot show format 2. Needed: an explicit baseline rotation input and a result that always lists baseline + at least two alternatives. |
| 1.3  | Per strategy: why suggested                                                                                  | **MET (backend)**     | Reasons with codes, effects and citations (`packages/domain/src/rotation/reasons.ts`). Raw codes only; no plain-language text in the UI.                                                                                                                                                                                                                                                                                                               |
| 1.4  | Per strategy: supporting evidence                                                                            | **MET (backend)**     | Every rule carries a citation or `model_recall` provenance (catalog 0.10.0); results pin inputs by hash.                                                                                                                                                                                                                                                                                                                                               |
| 1.5  | Per strategy: benefits                                                                                       | **PARTIAL**           | Soil carbon (RothC), water use (FAO-56), climate exposure, yield attainment (AquaCrop, uncalibrated), crop-health breaks are scored. No income, forage value or nitrogen-fixation benefit is reported as such (grep: nitrogen only appears as a SoilGrids layer; `forage` only as a catalog harvest category).                                                                                                                                         |
| 1.6  | Per strategy: information gaps                                                                               | **MET (backend)**     | `gaps` and `limitations` per crop; "UNKNOWN" reason codes (history, irrigation, soil). Not shown in the UI.                                                                                                                                                                                                                                                                                                                                            |
| 1.7  | Per strategy: risks needing local review                                                                     | **PARTIAL**           | Results say rules are not expert-reviewed; no per-strategy "ask a local expert about X" list. About 80 % of catalog 0.10.0 rules are model recall and carry provenance only.                                                                                                                                                                                                                                                                           |
| 1.8  | Supports, not replaces, farmer judgment (reminders)                                                          | **PARTIAL**           | Not-expert-reviewed wording exists; photo check says "pas un diagnostic". No consistent on-screen reminder in the planner.                                                                                                                                                                                                                                                                                                                             |
| 1.9  | Highlight bare-field periods                                                                                 | **MISSING**           | `packages/domain/src/rotation/soil-carbon.ts` uses a covered/bare factor only inside RothC. HLS green seasons exist for a field (`packages/domain/src/observations/vegetation.ts`) but nothing reports bare periods per rotation. Engine states rotations are maximal and "explicit fallow seasons are not generated" (CLAUDE.md).                                                                                                                     |
| 1.10 | Highlight seasons when current crops are vulnerable                                                          | **PARTIAL**           | Stage-level heat/frost exposure exists in the engine; no "season of vulnerability" view.                                                                                                                                                                                                                                                                                                                                                               |
| 1.11 | Pest-cycle interruption                                                                                      | **PARTIAL**           | Predecessor/return-interval rules and 387 crop problems in catalog 0.10.0; photo triage built but never run with a real key.                                                                                                                                                                                                                                                                                                                           |
| 1.12 | Water demand                                                                                                 | **MET (backend)**     | FAO-56 ET0 and crop curves (`packages/domain/src/rotation/water.ts`), rain corrected to GPM (`assess.ts:866`), reported irrigation supply as input.                                                                                                                                                                                                                                                                                                    |
| 1.13 | Improve infiltration                                                                                         | **MISSING**           | No infiltration, slope, erosion or terrain code (grep for erosion, infiltration, SRTM, NASADEM: 0 files).                                                                                                                                                                                                                                                                                                                                              |
| 1.14 | Supplemental income                                                                                          | **MISSING**           | No prices, margins or market data anywhere.                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.15 | Farmer priorities as inputs                                                                                  | **PARTIAL**           | Four 0–5 sliders: climate, water, soil_health, crop_health, plus water availability and allocation (`plan-v2.contract.ts:48`). Missing from the challenge list: equipment limits, market preferences, forage value, nitrogen fixation, erosion reduction, organic-matter goal as separate priorities.                                                                                                                                                  |
| 1.16 | Explain evapotranspiration, soil-moisture anomalies, NDVI, frost risk, water balance                         | **MISSING**           | No glossary or explanation text in `apps/web`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.17 | Satellite vs ground measurements                                                                             | **PARTIAL**           | Documented in specification and POWER notes; not shown to users.                                                                                                                                                                                                                                                                                                                                                                                       |
| 1.18 | Model uncertainty and where local expertise is needed                                                        | **PARTIAL**           | Ensemble of 5 models, ranges and "does the top rotation stay first" are in results; calibration status is recorded; not visible in a UI.                                                                                                                                                                                                                                                                                                               |
| 1.19 | Harmonise datasets to a common grid                                                                          | **PARTIAL**           | Per-field processing: POWER cell centre, GPM correction, tile-based CMIP6, HLS sampled at 30 m inside the outline, SMAP at 9 km as context. No documented common analysis grid or resampling step.                                                                                                                                                                                                                                                     |
| 1.20 | Interactive map, overlays, timelines, scenario sliders (rain/temperature)                                    | **MISSING**           | No map library in `apps/web/package.json`; no overlays or sliders. Scenarios exist as data (SSP2-4.5/SSP5-8.5, 5 models) but not as an adjustable slider.                                                                                                                                                                                                                                                                                              |
| 1.21 | Farmer-friendly for low technical skill                                                                      | **MISSING**           | Current UI is English-only, free-text crop IDs and raw reason codes (CLAUDE.md "Known limits"). French and Arabic are planned only.                                                                                                                                                                                                                                                                                                                    |

## 2. NASA datasets named by the challenge

The challenge text lists SMAP, ECOSTRESS, GPM, Landsat, MODIS, NASA POWER,
GRACE and GRACE-FO, SRTM or other NASA elevation products, and GEDI biomass
(and vegetation indices such as NDVI) as examples. None is mandatory ("you may").

| Dataset                                          | In code today?                                                                                                          | Status                                                                              | What is missing                                                                                              | Recommendation (6-day horizon)                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| NASA POWER                                       | Yes, `apps/server/src/modules/weather` (adapter 3, cell-centre privacy)                                                 | Built, tested, run against real data                                                | Not shown in a UI map/timeline                                                                               | Keep. Show history charts.                                                                                                                |
| GPM IMERG                                        | Yes, Giovanni client (`modules/earth-observations/providers/giovanni`); used to correct POWER rain in the water balance | Built; real run Feb 2023 (Step 11 report)                                           | Only monthly beside POWER on the observation endpoint; correction coverage by region                         | Keep; show POWER-vs-GPM rain chart (effort 0.5 day).                                                                                      |
| SMAP                                             | Yes, AppEEARS client (SPL3SMP_E, SPL4SMGP); observation endpoint                                                        | Built; real run (731 days, 468 with undefined percentile)                           | Not used in ranking; only a context record                                                                   | Keep as "soil-moisture context"; add anomaly/percentile chart (0.5 day). Do not claim it ranks rotations.                                 |
| Landsat (via HLS v2.0, Landsat 8/9 + Sentinel-2) | Yes, HLS NDVI and green seasons                                                                                         | Built; real Tadla run (208 of 338 usable dates)                                     | Not used in ranking; no bare-period output; needs field outline and Earthdata tasks that take hours          | Keep; derive bare/green periods for the field (1 day).                                                                                    |
| NDVI / vegetation indices                        | Yes, HLS NDVI                                                                                                           | Built                                                                               | No explanation or chart in UI                                                                                | Add NDVI timeline and glossary entry.                                                                                                     |
| NEX-GDDP-CMIP6                                   | Yes, `modules/climate-scenarios`                                                                                        | Built; real Tadla tile; download now about 44 of 89 tiles, southern Morocco missing | Scenario years 1985–2009 baseline and 2041–2065 future only (database query 2026-11-07); no near-term window | Keep. Show "mid-century stress test" honestly.                                                                                            |
| OPERA DIST                                       | Mentioned in specification only                                                                                         | Planned (Step 14), not coded                                                        | Whole module                                                                                                 | Skip for the demo; mention as future.                                                                                                     |
| ECOSTRESS                                        | No code (0 files)                                                                                                       | Planned (Step 13 in handoff)                                                        | Everything; 70 m ET/stress via AppEEARS, revisit and clouds limited                                          | **Optional**: only if AppEEARS covers the pilot field; 1.5 days; high wow value for "evaporation/vegetation stress". Do after the map UI. |
| NASADEM / SRTM elevation                         | No code                                                                                                                 | Planned                                                                             | Slope, drainage, erosion risk                                                                                | **Add**: AppEEARS NASADEM at the field (1 day); unlocks erosion/infiltration items 1.13 and frost-pocket hint.                            |
| GRACE / GRACE-FO                                 | Only in the handoff text                                                                                                | Not coded                                                                           | Regional groundwater/water storage                                                                           | **Mention only**: about 300 km resolution, not field level; one slide plus a regional context note if time allows.                        |
| MODIS                                            | Deliberately avoided (collection ends 2027; HLS and VIIRS used instead)                                                 | Decision recorded                                                                   | —                                                                                                            | **Mention only** with the reason.                                                                                                         |
| GEDI biomass                                     | No code                                                                                                                 | Not planned                                                                         | Forest/woody biomass, little value for cropland rotations                                                    | **Skip**; mention as not relevant to annual fields.                                                                                       |
| SoilGrids (ISRIC, not NASA)                      | Yes, `modules/soil`                                                                                                     | Built                                                                               | Estimates, labelled                                                                                          | Keep, cite CC BY 4.0.                                                                                                                     |
| FAO-56, AquaCrop, RothC (methods)                | Yes (`water.ts`, `soil-carbon.ts`, `apps/science/service.py`)                                                           | Built, uncalibrated                                                                 | Calibration against Moroccan data                                                                            | Keep; state calibration status on screen.                                                                                                 |

Counts of mentions in code (grep 2026-11-08): ECOSTRESS 0, SRTM 0, MODIS 0,
erosion 0, infiltration 0, GRACE 2 (documents only), GEDI 1 (documents only).

## 3. Rules compliance

### 3a. Prior work (highest risk, user decision)

The rule: "Teams are not allowed to begin working on the challenges prior to
the hackathon." Rotavise was built from 2026-09 onward for this challenge
(`docs/specification/ROTAVISE_HANDOFF.md` section 1: "First priority: win the
NASA Space Apps Challenge 2026 challenge Field Shift"). The repository has
72 commits (first on 2026-09-26) before 14 Nov.

What was decided before: `docs/DECISIONS.md` (2026-10-16) and the handoff say
the user will ask the organizers in writing whether the pre-existing project may
be submitted, with full disclosure, and that prior work is never disguised.
**Whether that message was sent, and any answer, is UNVERIFIED: nothing in the
repository records it.** The CLAUDE.md note says Step 17 waits for the answer.

Terms consequence: NASA may remove a participant or solution for a violation
"at any time", and may remove awards or nominations. Disqualification after
public submission is the downside risk.

Options (the user decides; none is chosen here):

| Option                                          | What it means                                                                                                                                                 | Consequence                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Ask first, in writing, now                   | Local Lead, Contact Us page or info@spaceappschallenge.org, full disclosure of the prior repository, commit history and what is new                           | Best protection. Risk: no answer by 14 Nov; an answer may be "no". Keep the date and the text of the message.                                                        |
| B. Compete on new work only                     | Start a new repository on 14 Nov containing only work done during the event; cite the older project, open data and open-source tools as third-party materials | Complies most clearly with the wording, but loses most of the built system and is hard to do in 2 days. The older code would still need to be open source and cited. |
| C. Do not enter                                 | Keep Rotavise as an independent product; skip submission                                                                                                      | No rules risk; no competition result. The product plan is unchanged.                                                                                                 |
| D. Enter with full disclosure without an answer | Submit the existing project and state the history plainly                                                                                                     | Fastest, but accepts removal risk. Never hide or understate the history.                                                                                             |

### 3b. Open-source licence of our own content

- `LICENSE`: **MISSING** (`git ls-files` has no LICENSE or NOTICE; README has no
  licence text). The Terms apply Apache 2.0 by default if none is named.
- Recommendation: add `LICENSE` (Apache-2.0) and say so in the README before any
  submission; confirm with the user that the product may be open source.
  Check that the `.claude` and `.research-sources` folders stay out of git
  (`.gitignore` covers `.research-sources/` and `.env`; `.claude/` is untracked
  and must be ignored or kept out).

### 3c. Third-party materials, licences and citations

Needed in the submission documentation: a table of every dataset, method and
code dependency with licence and citation. Known items:

| Material                                                                 | Licence / terms                                                         | Where it stands                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NASA POWER, GPM IMERG, SMAP, HLS, OPERA, NASADEM, ECOSTRESS              | NASA open data (Earthdata terms)                                        | Cite dataset DOIs and versions; not yet compiled.                                                                                                                                                                                                                                                                                                                                                                                            |
| NEX-GDDP-CMIP6 v2.0                                                      | CC BY-SA 4.0 per file metadata (AWS says CC0); project follows CC BY-SA | Documented in DECISIONS; attribution in results planned; any redistributed data stays CC BY-SA.                                                                                                                                                                                                                                                                                                                                              |
| SoilGrids 2.0 (ISRIC)                                                    | CC BY 4.0                                                               | Needs attribution on screen and in references.                                                                                                                                                                                                                                                                                                                                                                                               |
| FAO-56, AquaCrop, FAO Ecocrop                                            | FAO terms (FAO site content usually has its own reuse terms)            | **UNVERIFIED**: the exact Ecocrop/FAO reuse licence has not been checked; confirm before publishing derived values.                                                                                                                                                                                                                                                                                                                          |
| Moroccan official guides (ONCA, INRA, HCP, ORMVA, PNTTA), press articles | Copyright held by the publishers                                        | Catalog stores short machine-checked quotes with page locators (`data/catalog/releases/*/profiles/*.json`, `quote-check.json`). Full documents are **not** committed (`git ls-files` shows only CSV evidence under `docs/evidence`; `.research-sources/` is git-ignored: confirmed in `.gitignore`). Review the quotes and the press-source records in `docs/evidence/catalog/2026-11-03/research/` for length and rights before publishing. |
| npm and Python dependencies                                              | Mixed OSS licences                                                      | Generate a `THIRD_PARTY_NOTICES` file from the lockfiles (not done).                                                                                                                                                                                                                                                                                                                                                                         |
| Crop facts from model recall                                             | No source; marked `model_recall`                                        | Must be described as AI-generated knowledge in the SI description (3e).                                                                                                                                                                                                                                                                                                                                                                      |

### 3d. Prohibited content checks

- Promotes commercial services or products: **RISK**. README, pitch and
  submission text must describe an open decision-support tool, not a commercial
  startup. No pricing or sales language.
- Personal data: no field owner data is committed; check demo data and
  screenshots before publishing (no real names, emails, farm coordinates).
- Under-18 images/voices: none in the repository; keep out of the video.
- Proprietary or business-sensitive information: Earthdata credentials, the
  Google OAuth client and the Anthropic key live only in `.env`; confirm no
  secret is in git history (`git log -p` secret scan not run: UNVERIFIED).
- Rights to submitted content: catalog quotes and press-derived facts (see 3c).

### 3e. SI (AI) use description (draft for the submission form)

> Rotavise was built with SI tools. Anthropic's Claude (via Claude Code) and
> OpenAI's Codex wrote and reviewed most of the source code, tests,
> infrastructure scripts and documentation under the direction of the team.
> Part of the crop catalog was compiled with SI: sourced facts were found in
> official Moroccan and FAO documents and checked against saved copies; where no
> source was found, the catalog uses knowledge recalled by the SI model, which
> is labelled `model_recall` with a confidence level and has not been verified by
> an agronomist. At run time, an optional photo check sends a crop photo to
> Anthropic's Claude model, which may only name problems listed in the catalog
> and may answer "not sure"; it was tested with a simulated API only. The
> ranking of rotations itself is deterministic and does not use SI.

(Adjust once the team decides which statements are true on submission day. At
the time of this audit the photo check had never run against the real API.)

### 3f. Submission requirements and what to re-check on 13 Nov

Known: project page on spaceappschallenge.org, references list (every source
cited), licences for third-party materials, SI description, registration by a
team member, event selection (Local or Universal), no minors, at most six
members, one challenge. To read on 13 Nov: the Resources tab for the challenge
(datasets and links), the Project Submission Guide (fields, video length and
format, repository requirements, deadlines by local time zone), the Judging and
Awards Guide (criteria and weights), and any new rules about prior work.

## 4. Product state against the challenge

What a judge could see today:

- The web app (`apps/web`) has five features: account, backend health, planner
  (format 1, two-cycle), weather explorer, saved data. It is English-only, has no
  map and free-text crop and disease entry. It cannot display the multi-year
  results, NASA layers, scenarios or the 207-crop catalog.
- The 5 Chromium tests pass against that interface only.
- The backend can run a real multi-year Morocco demo (`tooling/plans/morocco-demo.mjs`)
  but only through scripts.

What the finished frontend must show (minimum to satisfy section 1):

1. Field setup: map pin and outline, soil inputs (or SoilGrids estimate labelled),
   water availability, the farmer's **current rotation** and recent crops, and
   priorities (climate, water, soil health, crop health, plus any new ones).
2. Results: the existing rotation and at least two alternatives side by side;
   for each: why, evidence (source or "AI-recalled, unverified"), benefits,
   information gaps, risks needing local review, in plain French/English
   (Arabic after).
3. NASA evidence panels: POWER vs GPM rain, NDVI/green-season timeline with bare
   periods, SMAP soil-moisture context, future climate bands and a scenario
   selector (SSP and model range; a rainfall/temperature adjustment slider only if
   the engine can re-run on it).
4. Explanations: glossary cards for evapotranspiration, soil-moisture anomaly,
   NDVI, frost risk, water balance; satellite vs ground note.
5. Uncertainty: ranges, calibration status, "where an expert must check".
6. A persistent reminder that the tool supports, not replaces, local expertise.

## 5. Finishing plan ("go by this")

Owners: C = Claude, X = Codex, U = user. Dates are 2026.

### Work packages in priority order

| #   | Package                                                                                                                                    | Owner                          | Effort   | Depends on                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------- | ----------------------------------------------------------------------- |
| P0  | Decide the prior-work question (3a), send the written message if option A                                                                  | U                              | 1 h      | none                                                                    |
| P1  | Agree the frontend design (screens, languages, map, tone)                                                                                  | U + C                          | 2 h      | none                                                                    |
| P2  | Add the farmer's current-rotation input and make results always show baseline + at least two alternatives; plain-language reason text keys | C                              | 1 day    | catalog 0.10.0 (done)                                                   |
| P3  | Field outline + HLS NDVI timeline and bare/green period output; POWER vs GPM series endpoint                                               | C                              | 1 day    | Earthdata account (user has it); AppEEARS tasks take hours: start early |
| P4  | NASADEM slope/elevation for the field (AppEEARS) feeding erosion/infiltration hints and a frost-pocket note                                | C                              | 1 day    | P3 pattern                                                              |
| P5  | Frontend build: setup, map, results, NASA panels, glossary, uncertainty, reminder                                                          | C (+ X for components if free) | 2.5 days | P1, P2                                                                  |
| P6  | Scenario selector and slider wired to existing futures (model range, SSP)                                                                  | C                              | 0.5 day  | P5                                                                      |
| P7  | French (and English) text; Arabic RTL only if time                                                                                         | C                              | 0.5 day  | P5                                                                      |
| P8  | LICENSE (Apache-2.0), THIRD_PARTY_NOTICES, references list, dataset DOIs, README rewritten as a non-commercial tool                        | C                              | 0.5 day  | P0                                                                      |
| P9  | ECOSTRESS for the pilot field (optional)                                                                                                   | C                              | 1.5 days | P3, only if time remains                                                |
| P10 | Anthropic key live self-check; run once; record result                                                                                     | U (key) + C                    | 30 min   | key                                                                     |
| P11 | Finish climate download (southern tiles)                                                                                                   | machine                        | ongoing  | Mac on, Docker up                                                       |
| P12 | Demo video (script below), project page text, submission                                                                                   | U + C                          | 1 day    | P5–P8                                                                   |
| P13 | Full `pnpm verify` on GitHub and a local run from a clean clone                                                                            | C                              | 0.5 day  | everything                                                              |

### Day by day

| Day       | Plan                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sun 8 Nov | This audit. U: decide 3a and, if A, send the message. U + C: design agreement (P1). C: start P2; request HLS/NASADEM tasks for the pilot field (P3/P4 clocks start). |
| Mon 9     | C: P2 finished; P3 data handling; push, CI green. U: create the Space Apps account, register, pick Local or Universal event.                                         |
| Tue 10    | C: P4, plain-language reasons, P8 licences and notices. U: confirm team members (at most 6; Universal needs 2).                                                      |
| Wed 11    | C: P5 map and setup screens.                                                                                                                                         |
| Thu 12    | C: P5 results and NASA panels; P6 scenario selector.                                                                                                                 |
| Fri 13    | Resources and guides appear: re-read them (section 3f) and adjust. C: P7 translation, glossary. P10 if key is ready. CI on everything.                               |
| Sat 14    | Event day 1. Fix issues found by a full walk-through; decide on P9; rehearse the demo; record the video (P12).                                                       |
| Sun 15    | Event day 2. Final verify, write the project page and references, submit before the event closes in the local time zone.                                             |

Realism check: 6 days is tight. P5 alone is large. If the schedule slips,
cut in this order: P9 (ECOSTRESS), Arabic, the rainfall/temperature slider,
NASADEM (but then say erosion/infiltration is not covered).

### Demo video script (about 3 minutes, adjust to the guide)

1. Problem (15 s): Moroccan farmer, water shortage, changing rain, tired soil.
2. Field setup on the map (30 s): pin, outline, current rotation, priorities.
3. Evidence from NASA (45 s): POWER and GPM rain, HLS NDVI with bare periods,
   SMAP context, NASADEM slope, future climate range.
4. The comparison (45 s): current rotation vs two alternatives; reasons,
   benefits, risks, gaps.
5. Uncertainty and expert review (20 s): ranges, AI-recalled facts labelled.
6. Scenarios (15 s): selector and ensemble range.
7. Close (10 s): supports farmers, does not replace them; open source.

### Project page text (outline)

Title, one-line summary, the problem, what the tool does, how NASA data are
used (table of datasets and exactly how each enters), how rotations are
compared, uncertainty and limits, SI use (3e), open-source licence, references,
team. No pricing or commercial language.

### Risk register

| Risk                                       | Likelihood | Impact    | Mitigation                                                                 |
| ------------------------------------------ | ---------- | --------- | -------------------------------------------------------------------------- |
| Prior-work rule leads to removal           | Medium     | Very high | Decide 3a first; full disclosure; keep the written trail                   |
| Frontend not ready                         | High       | Very high | Cut order above; build the vertical slice first                            |
| AppEEARS tasks too slow (about 5.5 h each) | Medium     | Medium    | Request on day 1 for the pilot field; keep cached evidence                 |
| Catalog is about 80 % model recall         | Certain    | Medium    | Label on screen; show sourced vs recalled count; expert review list        |
| Southern climate tiles missing             | Medium     | Low       | Demo in a downloaded tile (Tadla); state coverage                          |
| Photo check unproven live                  | Medium     | Low       | Run the self-check once the key is set; otherwise say "not yet tested"     |
| Licence or citation gaps                   | Medium     | High      | P8; compile the table in 3c; check FAO terms                               |
| Commercial wording                         | Low        | High      | Review README and page text                                                |
| Secrets in history                         | Low        | High      | Run a secret scan before publishing; rotate the exposed Earthdata password |
| Mac sleeps/Docker stops                    | Medium     | Medium    | Keep awake; production scripts exist (`pnpm ops:*`)                        |

### Actions only the user can take

Decide and send the prior-work message; create/log in to the Space Apps
account, register and choose an event; form or join a team; give the exact
challenge video link; the Anthropic key; confirm open-source release; approve
the design; submit on the project page; change the Earthdata password.

### What is strongest

The backend: sourced and recall-labelled catalog of 207 crops, deterministic
multi-year engine with explained, hashed results, real NASA data runs (POWER,
GPM, SMAP, HLS, NEX-GDDP-CMIP6), a production setup, and a passing CI run on
GitHub (2026-11-07).
