# Rotavise: master plan for the frontend and its backend connections

Written 2026-11-10 for Codex (or any AI engineer) to build from. Status:
**proposal, awaiting the user's explicit go-ahead before any frontend code is
written.** Nothing in this file authorises a deployment, a push, a purchase or
a message to anyone.

This plan is built from the repository as it is today (branch `field-shift`),
not from memory: the OpenAPI document `docs/api/openapi.json` (39 paths, 82
schemas), the Zod contracts in `packages/contracts/src`, the engine outputs, the
challenge text read on 2026-11-10, and the inspection of the OneSoil app
(`docs/steps/15/onesoil-inspection.md`). Where the backend lacks something the
frontend needs, it is listed in Part 5 as a numbered backend task (BG-n). Nothing
is assumed to exist that is not named here with its path.

---

## PART 0. RULES FOR THE IMPLEMENTER (read first, obey always)

### 0.1 Order of reading

1. This file, completely.
2. `AGENTS.md` and `CLAUDE.md` (binding repository rules).
3. `docs/steps/15/frontend-plan.md` (decisions on look and feel, sections 0b to
   0e) and `docs/steps/15/onesoil-inspection.md`.
4. `docs/api/openapi.json` and the contracts it is built from
   (`packages/contracts/src`). The contracts are the truth; if this file and a
   contract disagree, the contract wins and you record the difference in your
   notes file.

### 0.2 Hard rules

1. **No mockups, no placeholders, no fake data in the shipped app.** Every
   control on every screen is wired to the real backend (Part 4 names which
   endpoint). A control whose feature is not available shows an honest state
   (Part 6, "states"), never a dead button. Test fixtures live only under
   `tests/support/fixtures`. Production code never contains sample values.
2. **Never invent** agronomic values, prices, thresholds, names, citations, dates,
   NASA product ids, or test results. Everything the interface shows comes from
   an API response field named in this plan, or from the message files.
3. **Do not skip anything.** If a step cannot be finished, stop, fix the cause
   (or record a backend task in Part 5), and only then continue. Do not move on
   with a red check, a TODO, a disabled test or a hidden feature flag.
4. **The challenge requirements in Part 1 are acceptance criteria.** A slice is
   done only when its rows are demonstrably met by a test (Part 8).
5. **The interface languages are French and English only.** Crop and variety
   names show in English, French, Arabic (`ar`) and Darija (`ary`). Arabic-script
   names are rendered inline with `dir="auto"` and never change the page layout
   direction. The glossary endpoint is called with `lang=fr` or `lang=en` only.
6. **The backend is the only source of results.** The frontend never recomputes
   a score, a rank, a threshold or a trend. It formats and explains what it
   receives. The only calculations allowed in the browser are the geometry for
   field painting and display formatting.
7. **Honesty is a feature.** Every figure shows its unit and source; every
   projection says "scenario, not a forecast"; the reminder that the tool
   supports and does not replace farmer judgment is visible on every screen
   (Part 6, shell). Recalled knowledge is labelled as such.
8. **Do not stop processes you did not start. Do not touch `.env`. Never print or
   store credentials.** Account, Earthdata and API-key setup is the user's.
9. **Git:** you cannot commit in the Codex sandbox. Leave work uncommitted on your
   own branch `codex/<task>` and say so in your final message. Do not push. Do
   not merge. Claude reviews and merges.
10. **Keep the existing tests green** (`tests/e2e/*.spec.mjs` are updated when the
    UI they test is replaced, never deleted without equivalent coverage).

### 0.3 Commands (Node 24.19.0, pnpm 12.6.0, Docker running)

Fast gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.
Per area: `pnpm test:unit`, `pnpm test:backend`, `pnpm test:api-docs`,
`pnpm test:catalog`, `pnpm test:plans`, `pnpm test:engine`, `pnpm test:e2e`,
`pnpm build`, `pnpm test:container`. After any contract change run
`pnpm openapi:generate` and commit the regenerated `docs/api/openapi.json`
(a test fails if it is stale). Read real exit codes; never pipe a check into
`tail`. After any migration also run the `terrain-integration` Jest project:
`node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain-integration`.

### 0.4 Definition of done (every slice)

All of: the slice's screens exist and every control in Part 6 works against the
real API; every state in the state matrix is reachable and tested; fr and en
message files are complete (a test fails on a missing key); axe finds no
violations; the DOM scan finds no leaked placeholder or raw code; the layout
works at 390, 768, 1024 and 1440 px; the lint, format, typecheck, unit, e2e and
build gates exit 0; the notes file lists what is verified and what is not.

---

## PART 1. THE CHALLENGE, UNDERSTOOD, AND WHERE EACH REQUIREMENT LIVES

Source: "Field Shift: Adapting Farms with NASA Data", NASA Space Apps Challenge
2026, read at spaceappschallenge.org on 2026-11-10 (page text saved in the
session; re-read the Resources, Project Submission and Judging guides on
2026-11-13 and update this part if anything changes).

**The one thing that is required:** a decision-support tool that uses NASA Earth
observations together with local soil information, crop characteristics and
farmer priorities, so farmers can explore crop-rotation strategies that could
strengthen soil health and adapt farms to changing conditions. It supports, and
does not replace, farmer judgment and local expertise.

**Everything else in the challenge is optional ("you may", "consider").** The
project's decision is to do all of it, so each item is an acceptance row below.
IDs are used by tests (`test.describe("C12 ...")`) and by the notes file.

### 1.1 Objectives and the three-strategy comparison

| ID  | Challenge text (short)                                                                                                                                                      | Where it is met                                                                                                                                                   | Backend source                                                                                                                                        | Acceptance test                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| C01 | Decision-support tool combining NASA Earth observations, local soil information, crop characteristics, farmer priorities                                                    | The whole app. NASA evidence: S13. Local soil: S07 + `soilEstimate`. Crop characteristics: S15. Priorities: S08.                                                  | `POST /plans` (PlanRequestV2), results                                                                                                                | e2e "field to result" in fr and en                                                                              |
| C02 | App, model, interactive map or other tool                                                                                                                                   | A web app with an interactive map as the main surface (S04, S05, S11)                                                                                             | MapLibre + GIBS; API                                                                                                                                  | e2e map interaction                                                                                             |
| C03 | Explore rotation options that may improve soil health and resilience                                                                                                        | S11 compares rotations on four dimensions (climate, water, soil health, crop health)                                                                              | `result.strategies`, `result.candidates`                                                                                                              | unit: every dimension rendered                                                                                  |
| C04 | Analyse temperature, heat stress, rainfall, soil moisture, evaporation, frost risk, extreme precipitation, vegetation stress, long-term water trends                        | S13 tabs: Seasons (greenness), Water (rain, soil moisture, water balance, GRACE), Heat and frost (exposure, ECOSTRESS), Future                                    | analysis endpoints, `candidate.extremes`, `candidate.waterBalance`, `vulnerabilitySeasons`                                                            | e2e per tab                                                                                                     |
| C05 | Datasets: SMAP, ECOSTRESS, GPM, Landsat, MODIS, NASA POWER, GRACE and GRACE-FO, SRTM or other elevation (NASADEM), GEDI                                                     | S13 shows each, with product name, resolution, source and date                                                                                                    | observations (`hls`, `smap`, `gpm`), extractions (`terrain`, `ecostress`, `modis`), `water-storage` (GRACE), `canopy-biomass` (GEDI), `outputs.grids` | e2e: every product's panel renders with a source line                                                           |
| C06 | Local soil information, crop characteristics, farmer priorities (water use, forage value, nitrogen-fixing potential, erosion reduction, organic matter, market suitability) | Soil: S07 + `soilEstimate` (SoilGrids). Priorities: S08 (four sliders + context pickers). Per-strategy benefits: S12 notes `BENEFIT_*`                            | `preferences.priorities`, `farmer_context`, `strategy.notes`                                                                                          | unit + e2e                                                                                                      |
| C07 | Highlight times when fields are typically bare                                                                                                                              | S13 Seasons: bare/low-greenness bands and "usually low" windows                                                                                                   | `analysis/vegetation`, `analysis/vegetation-history`                                                                                                  | e2e: windows rendered, labelled "low greenness often means bare soil or stubble; confirm what was on the field" |
| C08 | Highlight seasons when current crops appear more vulnerable                                                                                                                 | S13 Heat and frost: per crop and stage periods                                                                                                                    | `candidate.vulnerabilitySeasons[].periods`                                                                                                            | e2e                                                                                                             |
| C09 | Rotations that could interrupt pest cycles                                                                                                                                  | S12 notes (`BENEFIT_FEWER_SAME_FAMILY_REPEATS`, `BENEFIT_FEWER_HEALTH_WARNINGS`) and reasons `HEALTH_BREAK_*`, `RETURN_INTERVAL_VIOLATION`                        | strategy notes, reasons                                                                                                                               | unit                                                                                                            |
| C10 | Reduce water demand                                                                                                                                                         | S11 water bar, S13 Water: crop water use vs rain                                                                                                                  | `candidate.waterBalance`                                                                                                                              | e2e                                                                                                             |
| C11 | Improve infiltration                                                                                                                                                        | S13 Land: slope, drainage note, erosion context; honest gap `INFILTRATION_DRAINAGE_UNKNOWN` until sourced                                                         | `outputs.terrain`                                                                                                                                     | e2e shows the gap text, not a number                                                                            |
| C12 | Add supplemental income                                                                                                                                                     | S11/S12: income and market priorities shown with honest gaps (`INCOME_DATA_UNAVAILABLE`, `MARKET_ACCESS_DATA_UNAVAILABLE`) until BG-9 lands, then sourced figures | `outputs.priorities`, BG-9                                                                                                                            | e2e                                                                                                             |
| C13 | Compare at least three rotation strategies, including the existing rotation                                                                                                 | S11: current + at least two alternatives (backend guarantees `requiredAlternatives: 2`; when fewer found the UI says why)                                         | `strategies.items`, `strategies.status`                                                                                                               | e2e both outcomes                                                                                               |
| C14 | For each strategy: why suggested                                                                                                                                            | S12 "Why" (`kind: why`)                                                                                                                                           | `strategy.notes`                                                                                                                                      | unit                                                                                                            |
| C15 | What evidence supports it                                                                                                                                                   | S12 "Evidence" + evidence chip (Part 7.4), source list                                                                                                            | `strategy.evidence`, `notes kind evidence`, `rules citations`                                                                                         | unit + e2e                                                                                                      |
| C16 | What benefits it may offer                                                                                                                                                  | S12 "Benefits"                                                                                                                                                    | `notes kind benefit`, `versusCurrent`, `soilCarbon`, `yields`                                                                                         | unit                                                                                                            |
| C17 | Where information gaps exist                                                                                                                                                | S12 "Gaps"                                                                                                                                                        | `notes kind gap`, `reasons effect gap`, `crops[].reasons`                                                                                             | unit                                                                                                            |
| C18 | Risks needing local review                                                                                                                                                  | S12 "Risks to check locally"                                                                                                                                      | `notes kind risk`, `strategies.reminders`                                                                                                             | unit                                                                                                            |
| C19 | A supportive tool, not a replacement for farmer judgment                                                                                                                    | Persistent footer line; reminder cards in results; first-run screen                                                                                               | `strategies.reminders` (3 to 8, keyed)                                                                                                                | e2e: present on every route                                                                                     |

### 1.2 "Potential considerations" (all implemented)

| ID  | Consideration                                                                                                               | Where                                                                                                                                    | Backend source                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C20 | Explain scientific terms: evapotranspiration, soil moisture anomalies, vegetation indices (NDVI), frost risk, water balance | Glossary cards (S16) and inline term links everywhere                                                                                    | `GET /glossary?lang=` (382 entries in 9 groups incl. 38 `term` and 4 `role`; counted 2026-11-10) |
| C21 | Satellite vs ground measurements                                                                                            | Panel "How to read satellite data" in S13 and the soil input help in S07 (what a lab test adds)                                          | glossary terms + `limitations` arrays                                                            |
| C22 | Compare different approaches to patterns in historical climate and soil                                                     | S13 Seasons shows two independent records (MODIS 2000 to now, HLS 30 m) with `hlsAgreement`; Future tab shows five models                | `vegetation-history.hlsAgreement`, `futureClimate.worlds`                                        |
| C23 | Highlight seasonal transitions, bare-field periods, increased stress                                                        | S13 Seasons (periods, anomalies `below_usual`)                                                                                           | `analysis/vegetation`                                                                            |
| C24 | Explain how the model interprets uncertainty and where local expertise is needed                                            | S12 and S13: ranges, `topStable`, `sensitivity`, analogs counts, `limitations`, "ask a local adviser" list built from risk and gap notes | `ranking.sensitivity`, `ranking.topStable`, `limitations`                                        |
| C25 | Harmonise datasets to a common grid                                                                                         | S13 "Data and grids" table, one row per input                                                                                            | `outputs.grids[]` (10 rows: input, use, grid, resolution, cell, selection, upstream resampling)  |
| C26 | Nutrient cycling, erosion risk, organic matter, pest disruption, water use, forage, market                                  | S12 benefits and S13 Land                                                                                                                | notes, `soilCarbon`, `outputs.terrain`                                                           |
| C27 | Map rotation ideas to farmer priorities (conserve water, income, soil structure)                                            | S08 sliders change ranking; S11 shows the weights applied                                                                                | `strategies.priorities.applied`                                                                  |
| C28 | Explain nitrogen-fixing, cover, deep-rooting, drought-tolerant crops                                                        | Crop detail (S15) and note `BENEFIT_NITROGEN_FIXING_CROP`; BG-4 supplies crop facts                                                      | notes, BG-4                                                                                      |
| C29 | Interactive maps to explore trends over time (soil moisture, heat waves, water storage declines)                            | S05/S11 map with date stepper over real NASA imagery; S13 time series                                                                    | GIBS + analysis endpoints                                                                        |
| C30 | Visualise field-level vulnerabilities (erosion zones, water-stress hotspots, frost-prone areas)                             | S13 Land: frost-pocket status, slope classes; map overlays from the field's own sample points                                            | `outputs.terrain`, `terrain.frostPocket`                                                         |
| C31 | Timelines, overlays comparing datasets, scenario sliders (rain and temperature)                                             | Date stepper; compare slider; What-if (S14) with rain, temperature, sowing shift                                                         | `POST /plans/{id}/what-if`                                                                       |
| C32 | Interpretable for farmers with limited technical or geospatial experience                                                   | Design rules (frontend-plan 0c, 0e), plain words, four icons max on map, glossary taps                                                   | n/a                                                                                              |
| C33 | Let farmers input their priorities or constraints (water availability, equipment limits, market preferences)                | S07 water; S08 equipment, market access, income weight                                                                                   | `water`, `preferences.equipment_limits`, `market_access`, `income_weight`                        |
| C34 | Reminders that the tool supports, not replaces, local expertise; highlight where human judgment matters                     | Footer line, reminder cards, "check locally" list, `NOT_EXPERT_REVIEWED` banner                                                          | `strategies.reminders`, reason `NOT_EXPERT_REVIEWED`                                             |

### 1.3 Rules and submission (outside the app, tracked here)

NASA Space Apps terms require: open-source licence for our own content, every
non-NASA source cited with its licence, a description of AI use, no personal
data and no images of minors in the submission. The app therefore includes
S20 (About, Sources and licences, AI disclosure) generated from
`THIRD_PARTY_NOTICES.md` and `docs/REFERENCES.md`. The FAQ forbids starting a
challenge before the hackathon on 14 and 15 November 2026: this is the user's
open question with the organisers and does not change this plan's content.

---

## PART 2. PRODUCT DEFINITION

### 2.1 Who uses it, and the one job

A Moroccan farmer or farm adviser, often on a phone with a weak connection,
decides what to grow on a field over the next 3 to 5 years. The tool answers:
"Is what I do now a good rotation? What are two or three better ones, why,
how sure are you, and what must I check locally?"

Secondary users: agricultural advisers (several fields), and judges (who need
the demo to work at once with real data).

### 2.2 Principles (binding)

1. One decision per screen; the map is the main surface.
2. Words first, numbers second, units always, sources always.
3. Scenario results are never forecasts; recalled knowledge is never hidden.
4. The browser never recomputes a result.
5. Everything works as a guest; an account only adds saving across devices.
6. Phone first; desktop is the three-panel OneSoil system.
7. No dark patterns, no tracking, no advertising, no third-party scripts, no
   analytics. Fonts, icons and tiles are self-hosted or from NASA GIBS.

### 2.3 Languages

Interface: **French (default) and English**. Crop and variety names: English,
French, Arabic, Darija from `catalog/options` `localNames`; display rule in
Part 7.2. Glossary: `lang=fr|en`. Photo-check notes: `language` is the
interface language (`fr` or `en`). The backend still accepts `ar` and `ary`;
the interface does not send them in this release.

### 2.4 Privacy and safety rules the UI must enforce

1. Location is requested only when the farmer taps "Use my location" and is
   stored only through the field APIs. Show the rule "the weather and climate
   services receive the centre of a grid cell, never the exact point"
   (adapters round to the cell; see `weather/power-grid.ts`, `soilCell`).
2. The photo check sends an image to an AI provider: show the consent text and
   require the checkbox (`consent: true` in the request). Show the server
   `notice` and, when `text_removed` is true, say so.
3. Delete controls for plans, fields, history entries and the account exist and
   confirm before acting (S19).
4. No secrets in the browser. The guest token lives in memory and
   `sessionStorage` only; an account session is an HTTP-only cookie.

---

## PART 3. TECHNICAL ARCHITECTURE

### 3.1 Stack (all open source; every addition goes in `THIRD_PARTY_NOTICES.md`)

Existing: Vite 8, React 19, TypeScript strict, Zod 4, `@rotavise/contracts`.
Add: `react-router` (routing), `@tanstack/react-query` (server state and
polling), `maplibre-gl` (map), `d3-scale` and `d3-shape` (chart geometry only),
`motion` (animation), `@radix-ui/react-*` (dialog, tabs, tooltip, slider,
popover, switch, toggle-group), `@formatjs/intl` or an equivalent ICU
implementation (message formatting), and `pmtiles` only when BG-12 lands. No
CSS framework, no component library with its own look, no chart library, no
analytics, no CDN scripts. Everything is bundled and served from our origin.

### 3.2 Repository layout (`apps/web/src`)

```
app/                      shell, router, providers, error boundary, theme
  routes.tsx              the route table of 3.4, lazy-loaded per screen
  providers/              QueryClient, I18n, Session (owner), Capabilities, Motion
design/                   tokens.css, fonts, icons/, motif/, primitives/
i18n/                     fr.json, en.json (ICU), messages.ts (typed keys), format.ts
api/                      client.ts (fetch wrapper), errors.ts, keys.ts (query keys),
                          one file per resource: fields.ts, history.ts, boundary.ts,
                          plans.ts, whatif.ts, observations.ts, extractions.ts,
                          analysis.ts, catalog.ts, glossary.ts, cropHealth.ts,
                          weather.ts, account.ts, capabilities.ts
features/
  session/                guest token + account session handling
  map/                    MapView, layers, GridPaint, OutlineEditor, DateStepper, CompareSlider
  fields/                 list, create, detail, history editor, inputs (soil, water, health)
  priorities/             sliders and context pickers
  plans/                  builder, progress, list, results, strategy, evidence, what-if
  evidence/               one folder per tab (seasons, water, heat-frost, land, future, sources, grids)
  crops/                  picker, crop detail
  glossary/               term cards, glossary page, TermLink
  photocheck/             photo check
  account/                sign in, sign up, verify, recover, settings
  about/                  sources, licences, AI disclosure
  demo/                   demo entry
shared/                   components used by two or more features (Part 6.1)
tests/                    unit tests next to code; e2e under /tests/e2e
```

Rules: a feature owns its network access, hooks and lifecycle; screens compose
features; no feature imports another feature's internals (use `shared/` or the
feature's `index.ts`). `packages/domain` is never imported by the web app
(add an ESLint restriction for it in F1; today only the database, queue and server paths are blocked); only `@rotavise/contracts` types and Zod schemas are shared.

### 3.3 Capability discovery (BG-1)

The server has feature switches (`PLANS_ENABLED`, `AUTH_ENABLED`,
`OBSERVATIONS_ENABLED`, `WEATHER_ENABLED`, photo check via `crop-health/status`).
Today a disabled route simply does not respond. BG-1 adds
`GET /api/v1/capabilities` returning the switches and versions. Until it lands
the boot screen (S00) probes `GET /health/ready`, `GET /auth/capabilities`,
`GET /crop-health/status`, `GET /weather/capabilities` and
`GET /catalog/options`, and treats 404 as "off". After BG-1 only the new
endpoint is used. The result drives which controls appear (Part 7.6).

### 3.4 Routes (React Router; every route deep-linkable; one origin)

| Route                                                                | Screen                                                 | Owner needed   | Notes                                                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                  | S01 Welcome / redirect to `/map` when a session exists | no             | language choice first run                                                                                                                      |
| `/map`                                                               | S03 Map home (fields on the map, list panel)           | yes (guest ok) | main shell                                                                                                                                     |
| `/fields/new`                                                        | S04 Add a field                                        | yes            | modes: grid, outline, pin                                                                                                                      |
| `/fields/:id`                                                        | S05 Field detail (status, history, inputs)             | yes            | tabs in the URL: `?tab=`                                                                                                                       |
| `/fields/:id/history`                                                | S06 Crop history editor                                | yes            |                                                                                                                                                |
| `/fields/:id/plan/new`                                               | S09 Plan builder (steps 1 to 5)                        | yes            |                                                                                                                                                |
| `/plans`                                                             | S18 Plans list                                         | yes            |                                                                                                                                                |
| `/plans/:id`                                                         | S10 progress or S11 results                            | yes            | polls until finished                                                                                                                           |
| `/plans/:id/strategy/:strategyId`                                    | S12 Strategy detail                                    | yes            |                                                                                                                                                |
| `/plans/:id/evidence/:tab`                                           | S13 Evidence                                           | yes            | tab: seasons, water, heat-frost, land, future, sources, grids                                                                                  |
| `/plans/:id/what-if`                                                 | S14 What-if                                            | yes            |                                                                                                                                                |
| `/crops` and `/crops/:id`                                            | S15 Crop picker page and crop detail                   | no             | catalog is public                                                                                                                              |
| `/glossary`                                                          | S16 Glossary                                           | no             |                                                                                                                                                |
| `/photo-check`                                                       | S17 Photo check                                        | yes            | needs `crop-health/status.available`                                                                                                           |
| `/account`                                                           | S19 Account and settings                               | no             | sign in, sign up, settings                                                                                                                     |
| `/?auth=verified`, `/?auth=reset`, `/?auth=deleted`, `/?auth=google` | S02 landing handlers on the home route                 | no             | these are the callback and redirect URLs already sent by `account-client.ts`; keep them so existing emails and the Google console keep working |
| `/about`                                                             | S20 About, sources, licences, AI                       | no             |                                                                                                                                                |
| `/demo`                                                              | S21 Demo                                               | no             | creates a guest session with the seeded demo (BG-6)                                                                                            |
| `*`                                                                  | 404                                                    | no             |                                                                                                                                                |

Route params that are UUIDs are validated with the contract schemas before any
request; an invalid id shows the 404 screen without a request.

### 3.5 Owner model (guest or account)

Backend facts (`plans.controller.ts`): a request is authenticated either by a
guest token (`Authorization: Bearer <43 chars>`, never together with a cookie:
sending both returns `INVALID_INPUT`) or by the account session cookie (Better
Auth). Mutating requests with a cookie must come from a trusted origin.

Frontend rules:

1. On first need the app calls `POST /plan-sessions` with `{}` and stores
   `{accessToken, expiresAt}` in memory and `sessionStorage`. Every API call
   from a guest sends the Bearer header and `credentials: "omit"`.
2. After sign-in (cookie) the app sends `credentials: "same-origin"` and no
   Authorization header. The two modes are never mixed in one request.
3. On `UNAUTHORIZED` from a guest call the token is discarded, a new session is
   created once, and the action is retried once; a second failure shows the
   sign-in prompt. Guest data of the old token is lost; say so plainly.
4. "Save to my account" calls `POST /plans/{id}/claim` with `{confirm: true}`
   using both the cookie and the guest token (the one case the server requires
   both: see `claimPlan`, access "both"). Fields are created under the account
   directly once signed in; guest fields do not migrate (there is no claim for
   fields; see BG-7).
5. Sign-in, sign-up, verification, recovery, sign-out and Google use the Better
   Auth routes under `/api/auth/*` exactly as `apps/web/src/features/account`
   does today: `POST /api/auth/sign-up/email`, `/sign-in/email`, `/sign-out`,
   `/request-password-reset`, `/reset-password`, `/send-verification-email`,
   and the social sign-in for Google. Password rules: 15 to 128 characters; email
   verification is required before sign-in; rate limits are 5 per hour on
   sign-up and recovery, 5 per minute on sign-in. The UI shows these limits as
   plain sentences and handles HTTP 429 with the `Retry-After` header.

### 3.6 Data layer rules

1. One `api()` function (existing `app/http.ts`) parses every response with the
   Zod schema from `@rotavise/contracts`; a failed parse is `INVALID_SERVER_RESPONSE`
   and the screen shows the error state, never partial data.
2. Query keys are centralised in `api/keys.ts`. Stale times: catalog 24 h
   (immutable by version), glossary 24 h, field and history 30 s, plan results
   immutable once `completed` (infinite), analysis responses 60 s, status calls
   per the polling table in 4.4.
3. Mutations send an `Idempotency-Key` where the contract requires one
   (`POST /plans`, `POST /plans/{id}/what-if`): a UUID generated when the form
   is first submitted and kept until the request succeeds or the form changes.
   The key regex is `^[A-Za-z0-9_-]{8,80}$`; a UUID without dashes qualifies.
4. Optimistic concurrency: field, boundary and history updates send
   `expectedVersion`; a `409` shows "This was changed elsewhere", reloads the
   record, and offers to reapply the farmer's edit.
5. Pagination: cursor lists (`/fields`, `/plans`, `/fields/{id}/history`) use
   `limit` (1 to 50, default 20) and `cursor` exactly as returned.
6. Errors: map `code` through the glossary `error` group (54 codes, fr and en)
   to a sentence; unknown codes show the generic sentence plus a "Try again".
   429 shows the wait from `Retry-After`. Never show a status number or a raw code.
7. Cancel in-flight requests when a screen unmounts (`AbortSignal`).
8. All dates are ISO. Show dates in the interface language (`Intl.DateTimeFormat`),
   times in the user's zone, plan and observation dates as calendar dates
   without zone conversion (they are calendar dates by contract).

### 3.7 Performance budgets (CI-enforced in slice F11)

First screen JS under 250 kB gzip; map and chart chunks lazy; LCP under 2.5 s
and INP under 200 ms on a throttled mid-range phone profile; the map holds 60
fps while painting 2,000 cells; no layout shift from late-loading fonts
(self-hosted, preloaded, `font-display: swap` with metric-matched fallbacks).

### 3.8 Offline and low connectivity

Service worker (Workbox-free, hand-written, small): caches the app shell, the
message files, the glossary, the catalog options of the version in use, and the
last opened plan and field responses (read-only). Writes while offline are
queued only for field edits and history edits (not for plan submission) and
replayed in order with `expectedVersion`; if a replay conflicts, show the
conflict dialog. The offline banner is a one-line bar, never a modal.

---

## PART 3b. DESIGN SYSTEM (what to build in slice F0; look decided in `frontend-plan.md` 0b to 0e)

A route `/design` (disabled in production builds) shows every token and every
component in every state in French and English. **The user approves the design
system on that page before slice F2 starts** (gate G1). Values below are the
starting hypotheses; the user's approval of `/design` is final.

### 3b.1 Tokens (`design/tokens.css`, CSS variables, semantic names only)

Components never use raw colours; they use the semantic tokens.

| Token                         | Value                 | Use                                       |
| ----------------------------- | --------------------- | ----------------------------------------- |
| `--surface`                   | `#FFFFFF`             | panels, sheets                            |
| `--app-bg`                    | `#F3F4F1`             | page behind panels                        |
| `--ink`                       | `#16231B`             | text, strong icons                        |
| `--ink-soft`                  | `#5E6A62`             | labels, secondary text                    |
| `--line`                      | `#E3E6E0`             | hairlines                                 |
| `--action` / `--action-hover` | `#1F7A55` / `#17614A` | the one filled button colour              |
| `--map-chrome`                | `rgba(20,26,22,.88)`  | dark chips and map buttons                |
| `--water`                     | `#2D5E8E`             | rain, soil moisture, water balance        |
| `--heat`                      | `#B4512D`             | heat exposure, high loss                  |
| `--vegetation`                | `#4C8A3B`             | green seasons                             |
| `--bare`                      | `#A5815D`             | bare or low-greenness periods             |
| `--caution`                   | `#C98A12`             | recalled evidence, gaps needing attention |
| `--focus`                     | `#1F5C9E`             | focus ring (3 px, offset 2 px)            |

Contrast: text on `--surface` at least 4.5:1, large text and icons at least
3:1; a script `tooling/design/contrast.mjs` (built in F0) checks every token
pair used and fails CI on a violation. Colour is never the only signal: every
status also has an icon and words.

Crop colour (`shared/cropColor.ts`): the botanical `family` from
`catalog/options` selects one of 16 colour-blind-safe hues (an Okabe-Ito based
qualitative set extended with tints); the crop id selects one of three
lightness steps within the family, so two crops of one family are related but
distinguishable. The mapping is deterministic and unit-tested for uniqueness
over all 246 crops of the current catalog (no two crops identical).

Typography: display `Fraunces` (bold, titles only), interface `IBM Plex Sans`
(400, 600), numbers `IBM Plex Mono` with tabular figures, Arabic script
`IBM Plex Sans Arabic`. Self-hosted WOFF2 subsets (Latin, Latin-ext, Arabic),
SIL OFL. Scale 13, 14, 16, 20, 28, 40; body 16 px minimum on phones; at most
three sizes plus the headline on one screen; two weights.

Spacing 4 px base: 4, 8, 12, 16, 24, 32, 48. Radius: 10 px inputs and cards,
16 px sheets and panels, 999 px pills and map buttons. Elevation: one shadow for
floating map chrome, one for sheets; panels use no shadow. Motion: durations
120, 220, 380 ms; easing `cubic-bezier(.2,1,.3,1)` for enter, `ease-in` for
exit; springs only for sheets; every animation checks `prefers-reduced-motion`.

### 3b.2 Icons and the logo mark

About 40 single-stroke line icons (24 px, 1.75 px stroke, round caps), drawn for
the project and kept as SVG components; every icon has an accessible name or is
`aria-hidden` beside a text label. The required set: map, fields, field-add,
crop, rotation, calendar, droplet (water), thermometer (heat), snowflake
(frost), leaf (vegetation), layers, ruler, locate, zoom-in, zoom-out, search,
filter, sort, chevron-down, chevron-left, chevron-right, close, check,
warning, info, help, language, user, sign-out, camera, upload, trash, edit,
save, undo, redo, play, pause, share, download, source (book), grid (cells),
sparkles is **not** used. The logo mark is the **crop strip**: four rounded
bars (wheat, lentil, fallow, faba colours) beside the word "Rotavise".

### 3b.3 Component catalogue (build each with every state and a unit test)

Each component lists its props and the states it must show. All are keyboard
operable, have visible focus, and respect RTL-safe inline text (`dir="auto"` for
crop names only).

| Component                                       | Props (essential)                                            | States                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `AppShell`                                      | children, nav items                                          | desktop three-panel, tablet two-panel, phone map + tab bar |
| `IconRail`                                      | items, active                                                | hover label, active, badge                                 |
| `TabBar` (phone)                                | five items                                                   | active, badge                                              |
| `Panel`, `DetailPanel`                          | title, subtitle, onClose                                     | open, closing, loading skeleton                            |
| `BottomSheet`                                   | detents (peek, half, full), onDetent                         | dragging, snapped, reduced motion                          |
| `FloatingChip`                                  | label, value, onPress                                        | default, open, disabled                                    |
| `MapTools`                                      | max four buttons                                             | pressed, disabled                                          |
| `LegendCard`                                    | title, items                                                 | collapsed, open                                            |
| `DateStepper`                                   | dates[], value, onChange                                     | no image on this date, cloudy, loading tile                |
| `CompareSlider`                                 | left, right                                                  | dragging, keyboard (arrows)                                |
| `Button`                                        | variant primary, secondary, ghost, danger; size              | default, hover, pressed, loading, disabled                 |
| `IconButton`                                    | icon, label                                                  | same                                                       |
| `TextField`, `NumberField`, `DateField`         | label, unit, hint, error                                     | focus, error, disabled, readonly                           |
| `Select`, `SearchSelect`                        | options, search                                              | closed, open, empty search                                 |
| `Switch`, `Slider`, `SegmentedControl`, `Tabs`  |                                                              |                                                            |
| `Chip` (`SourceChip`, `StatusChip`, `TermChip`) | kind, text                                                   |                                                            |
| `Toast`                                         | message, action                                              | only after a user action                                   |
| `Dialog`, `ConfirmDialog`                       | title, body, actions                                         |                                                            |
| `Tooltip`                                       | content                                                      |                                                            |
| `Skeleton`                                      | shape                                                        | sized to the real content (no layout shift)                |
| `EmptyState`, `ErrorState`, `PartialState`      | title, text, one action                                      |                                                            |
| `ProgressBar`, `StepProgress`                   | value                                                        | indeterminate                                              |
| `CropStrip`                                     | slots[], size, interactive                                   | selected slot, empty slot, unknown crop                    |
| `CropName`                                      | cropId, nameMode                                             | shows primary name + inline Arabic/Darija per 7.2          |
| `CropSwatch`                                    | cropId                                                       |                                                            |
| `RangeBar`                                      | min, max, domain, unit, label                                | no data (hatched), single value                            |
| `ScoreBar`                                      | loss 0..1, label                                             | not compared                                               |
| `StatCard` (dark)                               | value, label, caption                                        |                                                            |
| `DataTable`                                     | columns, rows                                                | sortable, empty                                            |
| `SeriesChart`                                   | type line, area, band, bars, timeline; series[]; source line | hover cursor with dark tooltip, no data, partial data      |
| `GlossaryTerm`                                  | code, group                                                  | opens a `Popover` card                                     |
| `ReminderBar`                                   | text                                                         | always visible in the shell                                |
| `OfflineBar`                                    |                                                              |                                                            |
| `LanguageSwitch`                                | fr, en                                                       |                                                            |
| `PhotoPicker`                                   | accept, maxBytes                                             | dragging, invalid, too large, ready                        |
| `StepWizard`                                    | steps, current                                               |                                                            |

`SeriesChart` rules: SVG only, hand-written with `d3-scale` and `d3-shape`;
always a visible source line under the chart; a text alternative (a `<table>`
visually hidden, or an `aria-label` summary) listing min, max, latest and trend;
axis labels never overlap (a unit test measures label boxes); the tooltip is a
solid dark rounded card with the value, unit and date.

### 3b.4 Map specification (`features/map`)

Library MapLibre GL JS. Two base layers, both from NASA GIBS WMTS (no key): the
global MODIS Terra true colour (`MODIS_Terra_CorrectedReflectance_TrueColor`,
tile matrix `GoogleMapsCompatible_Level9`, max zoom 9) and, above it from zoom 9,
HLS Sentinel-2 reflectance
(`HLS_S30_Nadir_BRDF_Adjusted_Reflectance`, `GoogleMapsCompatible_Level12`, max
zoom 12, PNG, with a `{Time}` date). Tile URL templates:
`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<date>/<matrixset>/{z}/{y}/{x}.png|jpg`.
A test on 2026-11-10 found 127 daily HLS dates with real imagery over the Tadla
pilot field between September 2025 and June 2026; many days have no image for a
tile (the PNG is about 1 kB and transparent) and some images are cloudy. The
`DateStepper` therefore lists only dates for which the tile at the map centre is
non-empty (probe by fetching the centre tile for each candidate date, in
parallel with a cap of 8 and a session cache) and says "no image on this date"
when a user-typed date has none. The map overzooms beyond 12 and says so
("imagery is 30 m; zoomed in beyond its detail").
Vector context (roads, places, labels) comes from the self-hosted PMTiles
basemap of BG-12; until it lands the map shows imagery only, and labels are
omitted rather than fetched from a third party. Attribution (NASA GIBS, HLS;
OpenStreetMap contributors for BG-12 tiles) is always visible.

Layers the app adds: the field outline (white 5 px under ink 2 px), field fill
(translucent), sample points (small dots, from `outputs.grids[].samplePoints`),
the painting grid (Part 6, S04), the NASA cell footprints (a dashed rectangle
per product cell from `outputs.grids[].cell` and `resolution`, shown on demand).

Controls (at most four round dark buttons at the right edge): zoom in, zoom out,
locate, tilt is **not** offered (no 3D); the fourth is "layers" which opens the
layer popover (imagery date, compare, NASA cell footprints, sample points). The
layer chip at the top left says what the colour shows (for example "Satellite
image, 2 April 2026") and opens the same popover.

Performance: the painting grid is one GeoJSON source updated through a web
worker, drawn as a fill layer with feature-state, 60 fps for 2,000 cells.

---

## PART 4. HOW THE FRONTEND USES THE BACKEND

### 4.1 Transport

Base path `/api/v1` (same origin; in development the Vite server proxies
`/api` to the API on `127.0.0.1`; in production nginx does, `infra/production`).
JSON bodies only (`Content-Type: application/json`) on POST and PUT; a body
over the limit or another content type returns `INVALID_INPUT`.
Auth: guest `Authorization: Bearer <43 chars>` or account cookie (3.5).
Mutating cookie requests need a trusted `Origin`; the app always runs on the
configured origin. Rate limits seen in the code: fields routes 120 per minute
per IP; extraction and observation requests at most 10 new ones per owner per
day (`RATE_LIMITED`, `Retry-After: 86400`); plan intake has its own limits (429
with `Retry-After`); the photo check has a daily AI limit (`AI_DAILY_LIMIT`).

### 4.2 Endpoint to screen map (generated list: Appendix F)

| Endpoint                                                                | Used by                         | Notes                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /health/ready`                                                     | S00                             | 503 body is still a valid `Health` (status `unavailable`)                                     |
| `GET /auth/capabilities`                                                | S00, S02                        | `{email, google}`                                                                             |
| `GET /account`                                                          | S00, S19                        | 401 means signed out                                                                          |
| `POST /plan-sessions`, `DELETE /plan-sessions/current`                  | owner model                     |                                                                                               |
| `GET /catalog/options` (current), `GET /catalog/options/{id}/{version}` | S04 to S15                      | `result.catalog` pins a release; current uses rotation if planning enabled, intake otherwise. |
| `GET /glossary?lang&group`                                              | everywhere                      | ETag; send `If-None-Match`; 304 is a hit                                                      |
| `POST/GET/PUT/DELETE /fields...`                                        | S03 to S07                      | `FieldProfile` v1                                                                             |
| `PUT/GET/DELETE /fields/{id}/boundary`                                  | S04, S05                        | `expectedVersion` null for the first save                                                     |
| `GET/POST/PUT/DELETE /fields/{id}/history...`                           | S06                             |                                                                                               |
| `POST /fields-with-history`                                             | S04                             | creates a field and its history in one transaction                                            |
| `POST/GET /fields/{id}/observations`, `GET .../{observationId}`         | S13                             | kinds `hls`, `smap`, `gpm`                                                                    |
| `POST/GET /fields/{id}/extractions`, `GET .../{extractionId}`           | S13                             | kinds `terrain`, `ecostress`, `modis`                                                         |
| `GET /fields/{id}/analysis/vegetation`                                  | S13 Seasons                     | `ready` or `unavailable`                                                                      |
| `GET /fields/{id}/analysis/vegetation-history`                          | S13 Seasons                     | MODIS 2000 to now                                                                             |
| `GET /fields/{id}/analysis/rain`                                        | S13 Water                       | IMERG vs POWER monthly                                                                        |
| `GET /fields/{id}/water-storage`                                        | S13 Water                       | GRACE regional                                                                                |
| `GET /fields/{id}/canopy-biomass`                                       | S13 Land                        | GEDI context                                                                                  |
| `POST /plans`, `GET /plans`, `GET/DELETE /plans/{id}`                   | S09, S10, S11, S18              |                                                                                               |
| `POST /plans/{id}/what-if`                                              | S14                             | `{what_if:{...}}`; child `parentPlanId` links unchanged parent; read both plans               |
| `POST /plans/{id}/claim`                                                | S19                             | guest to account                                                                              |
| `POST /plans/{id}/explanation`                                          | S12                             | AI text; 503 when no key                                                                      |
| `GET /crop-health/status`, `POST /crop-health/photo`                    | S17                             |                                                                                               |
| `GET /weather/capabilities`, `POST /weather/query`                      | S13 Water (temperature history) | see 4.6                                                                                       |

### 4.3 Building `PlanRequestV2` from the UI (single function `buildPlanRequest`)

The function takes the plan-builder state and returns the exact JSON the
contract requires, then validates it with `planRequestV2Schema.safeParse`
before sending. Issue paths from the schema are mapped back to the control that
caused them (table 4.3.2). The field-level data comes from the saved field.

| JSON path                                              | Source in the UI         | Rule                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version`                                       | constant                 | `"2"`                                                                                                                                                                                                                                                                             |
| `field_id`                                             | the field being planned  | optional; set so the backend pins the field's completed observations at acceptance                                                                                                                                                                                                |
| `location`                                             | `field.profile.location` | latitude and longitude as saved                                                                                                                                                                                                                                                   |
| `history`                                              | S06 entries              | `{status:"unknown"}` when none; else `{status:"known", completeness, entries}`; `completeness` is the farmer's answer to "Is this all of the last N years?" (`complete` or `partial`); entries map `crop_id`, `planted_on`, `harvested_on` (field entries always have both dates) |
| `crop_health`                                          | S07 health list          | `{status:"unknown"}` when none; field-stored observations (v1: `kind` and `name`) convert to `{crop_id, issue:{other_name:name}, observed_on, source, confirmation}`; BG-5 adds `issue_id` picking                                                                                |
| `soil`                                                 | S07 soil inputs          | `{status:"unknown"}` when none; v1 `organic_matter` `{value, unit}` converts to `{value_percent}`; `ph` drops `unit`; texture as is; **salinity** (`value_ds_per_m`, method) is plan-level only                                                                                   |
| `water`                                                | S07 water                | `{status:"unknown"}` or `{status:"reported", availability, allocation}`; `allocation` is `{amount_mm: 0..5000, period: "season" or "year"}` or `null`; v1 saved water has no allocation, so use `null` unless supplied at plan level                                              |
| `planning.horizon_years`                               | S09 step 1               | integer 3 to 5                                                                                                                                                                                                                                                                    |
| `planning.earliest_start_date`, `latest_start_date`    | S09 step 1               | calendar dates 1900-01-01 to 2100-12-31, at most 366 days apart, both after every history date                                                                                                                                                                                    |
| `cultivars`                                            | S09 step 2               | at most one per crop, at most 50                                                                                                                                                                                                                                                  |
| `preferences.mode`                                     | S09 step 2               | `consider` iff at least one crop is picked as considered, else `suggest`                                                                                                                                                                                                          |
| `preferences.considered_crop_ids`, `excluded_crop_ids` | S09 step 2               | at most 20 and 50, no overlap, no duplicates                                                                                                                                                                                                                                      |
| `preferences.priorities`                               | S08                      | four integers 0 to 5, sum above 0                                                                                                                                                                                                                                                 |
| `preferences.equipment_limits`                         | S08                      | `mechanisation` none, small, medium, large and/or `unavailable_operations` (catalog ids, max 32); omit when empty                                                                                                                                                                 |
| `preferences.market_access`                            | S08                      | none, local, regional, export; omit when "not sure"                                                                                                                                                                                                                               |
| `preferences.income_weight`                            | S08                      | integer 0 to 5; omit when the income slider is untouched                                                                                                                                                                                                                          |
| `current_rotation`                                     | S09 step 3               | `{crop_ids}` one cycle in order, 1 to 6 crops; omit to let the backend infer it from history                                                                                                                                                                                      |
| `farmer_context`                                       | S08                      | `{equipment: unknown / limited / standard, market_preference: unknown / household_food / cash_income / livestock_feed, forage_need: none / some / high, erosion_concern: unknown / low / moderate / high}` (all four required when present)                                       |

4.3.2 Schema message to control: "At least one priority" to the sliders;
"Inconsistent selection mode", "Considered crop is excluded", "Duplicate crop
choices" to the crop pickers; "Invalid first-sowing range" to the date range;
"History overlaps proposed start", "Reversed crop dates", "Overlapping crop
history", "Duplicate history entry" to the history editor row; "Farmer
observation is not a confirmed diagnosis" to the health row; "Duplicate soil
metric" to the soil section; "One cultivar per crop" to the cultivar rows.
Every message is shown in the interface language through message files keyed by
the schema message (a unit test lists every `message` string in
`plan-v2.contract.ts` and fails when one lacks a translation).

### 4.4 Polling and long jobs

| Resource                                     | Start                            | Poll                                                                                                                        | Stop                         | UI                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan                                         | `POST /plans` (202)              | `GET /plans/{id}` every 2 s for 30 s, then every 5 s                                                                        | `status` completed or failed | S10 shows `stage` (awaiting_processing, verifying_evidence, generating_sequences, retrieving_weather, calculating) as steps; if the tab is hidden, pause and resume on focus |
| What-if                                      | `POST /plans/{id}/what-if` (202) | as a plan                                                                                                                   | as a plan                    | opens the new plan                                                                                                                                                           |
| Observation (`hls`, `smap`, `gpm`)           | `POST /fields/{id}/observations` | `GET .../observations/{id}` every 30 s for 10 min, then every 2 min while the evidence tab is open; always refetch on focus | completed or failed          | "Requested from NASA, usually takes hours; you can leave this page" with a stored timestamp (`createdAt`)                                                                    |
| Extraction (`terrain`, `ecostress`, `modis`) | `POST /fields/{id}/extractions`  | same                                                                                                                        | same                         | same                                                                                                                                                                         |
| Analysis                                     | `GET` once per mount             | refetch when its observation completes                                                                                      |                              | `unavailable` shows the reason from `observation`: `none` (offer "Ask NASA for this data"), `queued` or `submitted` (waiting), `failed` (error + "Try again")                |

Requests are idempotent: posting an extraction while one is queued or submitted
returns that one (no duplicate task). The 10-per-day limit is shown before the
farmer taps ("You can request up to 10 NASA datasets a day").

### 4.5 Error mapping (every row has a message in fr and en and a test)

| HTTP          | `code`                                                                                                                                                                                                                        | UI behaviour                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400           | `INVALID_INPUT`                                                                                                                                                                                                               | inline field errors when the request was built from the form (should not happen after client validation: log to console in development, show "Something in the form is not accepted")            |
| 401           | `UNAUTHORIZED`                                                                                                                                                                                                                | owner refresh once (3.5.3), then the sign-in prompt                                                                                                                                              |
| 404           | `NOT_FOUND`                                                                                                                                                                                                                   | the 404 screen for routes; a "not found or not yours" message for in-page resources                                                                                                              |
| 409           | `IDEMPOTENCY_CONFLICT`                                                                                                                                                                                                        | on `POST /plans` or what-if: "This request was already sent with different details; start a new one"; on field, boundary or history updates it means a version conflict: conflict dialog (3.6.4) |
| 429           | `RATE_LIMITED`                                                                                                                                                                                                                | wait message from `Retry-After`, the action disabled until then                                                                                                                                  |
| 502, 503, 504 | `CATALOG_UNAVAILABLE`, `QUEUE_UNAVAILABLE`, `AUTH_UNAVAILABLE`, `FIELD_UNAVAILABLE`, `CROP_HEALTH_UNAVAILABLE`, `WEATHER_*`, `OBSERVATION_*`, `SCENARIO_*`                                                                    | `ErrorState` with "Try again" and a note that the service may be busy; never a retry loop faster than 5 s                                                                                        |
| 503 on plan   | `result.error.code` in `{STORED_REQUEST_INVALID, CATALOG_EVIDENCE_INVALID, WEATHER_UNAVAILABLE, PLANNING_LIMIT_EXCEEDED, RETRIES_EXHAUSTED, QUEUE_TERMINAL_WITHOUT_RESULT, WORKFLOW_VERSION_UNSUPPORTED, CALCULATION_FAILED}` | the failed-plan screen (S10) with the glossary sentence for that code, and "Edit and send again" (opens the builder pre-filled from `plan.input`)                                                |
| Photo         | `PHOTO_INVALID`, `PHOTO_TOO_LARGE`, `PHOTO_TOO_SMALL`, `PHOTO_UNREADABLE`, `CROP_NOT_COVERED`, `AI_*`                                                                                                                         | the photo screen states per code (S17)                                                                                                                                                           |

### 4.6 Weather query (optional evidence, used on S13 Water)

`POST /weather/query` accepts `latitude`, `longitude` (only POWER cell centres
are accepted; use the field's cell from `outputs.grids` row `POWER`),
`startDate`, `endDate` (at most 366 days, not later than 120 days before today,
not earlier than 1981-01-01) and `variables` from `temperatureMin`,
`temperatureMax`, `temperatureMean`, `precipitation`, `relativeHumidity`,
`windSpeed`, `solarRadiation`. The Water tab requests the last 366 allowed days
of `precipitation`, `temperatureMax` and `temperatureMin` once, caches by cell
and range for 24 h, and charts them. It does not request more than one query per
view. It is hidden when `weather/capabilities` is unavailable.

### 4.7 The result object: the only things the UI reads from a finished plan

A finished plan is `RotationPlanningStatus` with `status: "completed"` and
`result` of the newest engine (`rotation-engine-7`, the "V6" assessment schema).
Older results (engines 3 to 6) stay readable: the UI renders the sections they
have (candidates, scores, futureClimate where present) and shows "This plan was
made with an earlier version of the engine: current rotation comparison is not
available" when `strategies` is absent. Fields read:

`result.outcome` (`comparisons_available`, `no_feasible_rotation`,
`insufficient_evidence`), `result.synthetic` (must be false in production; if
true the UI shows a red banner "test data" and the answer is not shown as advice),
`result.catalog` (id, version, sha256: used to fetch crop names and shown in
Sources), `result.context` (assessment date, location, `regionIds`, `farmingSystem`,
`horizonEnd`), `result.input` (echo of the request), `result.evidence`
(`rulesUsed.double_checked`, `expert_reviewed`, `model_recall`, `expertReviewed`),
`result.crops[]` (per considered crop: `status`, `reasons`), `result.choices[]`,
`result.dimensions[]` (four: `status`, `requestedWeight`, `appliedWeight`,
`reason`), `result.ranking` (`weights`, `sensitivity[]`, `topStable`),
`result.accounting` (`schedulableCrops`, `expansions`, `completed`, `compared`,
`shown`, `pruned`, `truncated`, `rejections[]`), `result.reasons`,
`result.limitations`, `result.candidates[]` (Part 6, S11 and S12),
`result.soilEstimate` (SoilGrids), `result.yields` (AquaCrop, `calibration:
uncalibrated_default_parameters`), `result.soilCarbon` (RothC, `calibration:
uncalibrated`), `result.rain` (`source`, `reference`, `monthlyFactors`),
`result.futureClimate` (`status`, `reason`, `cell`, `worlds`,
`topStableAcrossFutures`, `nearTerm`), `result.strategies` (`status`,
`alternativesFound`, `baseline`, `items`, `priorities`, `reminders`),
`result.whatIf`, `result.outputs` (`grids`, `terrain`, `priorities`).
Anything else in the JSON is ignored.

---

## PART 5. BACKEND TASKS THE FRONTEND NEEDS (BG-n)

These are the places where the frontend cannot be fully connected today. Each
is a backend task for Codex with its own branch `codex/bg-n-<name>`, its own
tests, and the same rules as Part 0. **Slice order in Part 9 says which must be
merged before which screen is built.** No screen may fake a missing endpoint.

| ID    | What is missing                                                                                                                                                           | Add                                                                                                                                                                                                                                                                                                                                                                                   | Acceptance                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BG-1  | Implemented by B0: capabilities describe configuration, not provider readiness                                                                                            | `GET /api/v1/capabilities` returning `{version, plans, auth{email,google}, observations, weather, cropHealth{available,reason}, climateScenarios, fieldDetection{available}, fieldBoundaries{available}, glossaryVersion, catalog{id,version}}`                                                                                                                                       | schema in contracts, OpenAPI, glossary entry for new codes, integration test with each switch on and off                                                                    |
| BG-2  | Implemented by B0: owner-scoped plan summaries                                                                                                                            | extend `PlanList` items with `fieldId`, `fieldName`, `cropIds` (current rotation), `horizonYears`, `topStrategyCropIds` when completed, `whatIf` flag, `parentPlanId`                                                                                                                                                                                                                 | existing list tests updated; list needs no per-plan fetch                                                                                                                   |
| BG-3  | Implemented by B0: persisted what-if parent provenance                                                                                                                    | store `parentPlanId` on what-if plans and return it in the plan status and list (this also serves BG-2)                                                                                                                                                                                                                                                                               | what-if test asserts the link; old plans return `null`                                                                                                                      |
| BG-4  | Implemented by B1/B5: versioned detail, including 0.14/0.15 research                                                                                                      | `GET /api/v1/catalog/crops/{catalogId}/{version}/{cropId}`: identity, calendar/rules, issues, legacy facts and gaps; 0.14/0.15 add `research.benefitEffects` (12 selections, evidence class, nullable confidence), original benefit/income evidence with citations/quotes, `incomeFields` coverage and general four-language `roleExplanations`; 2 MiB limit; immutable version ETags | contract + OpenAPI; test that every number carries a citation or `model_recall`; unknown crop 404                                                                           |
| BG-5  | Implemented by B1: host-scoped `issues[]` embedded in BG-4                                                                                                                | `GET /api/v1/catalog/crops/.../{cropId}/issues` (or include in BG-4) with `issue_id`, names by language, kind (`disease`, `pest`, `parasitic_plant`, `weed`; deficiency/disorder are unrecorded)                                                                                                                                                                                      | the plan builder can send `issue: {issue_id}`                                                                                                                               |
| BG-6  | The demo cannot be opened without a pre-run backend state                                                                                                                 | `POST /api/v1/demo/session` (guest) that clones a seeded, real-data demo (the Tadla pilot field, its boundary, completed extractions, HLS history, GRACE and GEDI context, and a completed plan) into a fresh guest owner; a command `pnpm demo:seed` builds the seed from real stored data (never fixtures)                                                                          | clean database test; the demo opens with every tab populated; read-only banner not needed because it is a normal guest copy                                                 |
| BG-7  | First plan claim already moves all guest fields atomically; independent field/bulk claim has no endpoint                                                                  | `POST /api/v1/fields/{id}/claim` like plans (both credentials, `{confirm:true}`) and a bulk "claim everything"                                                                                                                                                                                                                                                                        | cookie plus bearer test; ownership and quota checks                                                                                                                         |
| BG-8  | The field profile uses the older v1 shapes (soil with three metrics, no salinity; water without allocation; health with free-text names) so the plan builder must convert | field profile `schema_version: "2"` accepted alongside 1 (additive): v2 soil metrics (ph, salinity, organic_matter, texture), water with allocation, health with `issue_id` or `other_name`; reading a v1 field still works                                                                                                                                                           | migration only if needed; old fields unchanged; contract tests                                                                                                              |
| BG-9  | Implemented by income wiring/B4/B5: default 0.15.0 preserves sourced historical income; current/local gaps remain explicit                                                | catalog release with sourced prices, yields, costs, margins and benefits, and the engine outputs for them; the frontend binds to `outputs.priorities` and strategy notes generically, so no frontend change is needed beyond rendering new fields                                                                                                                                     | per that job's notes                                                                                                                                                        |
| BG-10 | Implemented by B0: mutable labels outside result identity                                                                                                                 | optional `label` (max 80) on `POST /plans` and `PUT /plans/{id}/label`                                                                                                                                                                                                                                                                                                                | contract and tests                                                                                                                                                          |
| BG-11 | No way to export or share a result                                                                                                                                        | `GET /plans/{id}/export?format=pdf                                                                                                                                                                                                                                                                                                                                                    | json` that returns the result with its sources as a print-ready HTML document (the browser prints it to PDF) or JSON, in fr or en (server-rendered, no third-party service) | print test; the document carries the reminder, limitations and citations |
| BG-12 | No self-hosted vector basemap for Morocco                                                                                                                                 | a PMTiles file of Morocco from OpenStreetMap (ODbL), served as static range requests at `/tiles/morocco.pmtiles`, built by `tooling/maps/build-basemap.sh` with attribution in `THIRD_PARTY_NOTICES.md`                                                                                                                                                                               | file size under 1.5 GB for roads, places, water and admin labels in fr and ar names; the map style references it                                                            |
| BG-13 | B2r serves optional precomputed FTW suggestions; detection and automatic fallback are unimplemented                                                                       | see 5.1                                                                                                                                                                                                                                                                                                                                                                               | see 5.1                                                                                                                                                                     |
| BG-14 | Implemented by B0: optional boundary saved atomically on field creation                                                                                                   | `POST /api/v1/fields` and `/fields-with-history` accept an optional `boundary`; the field and boundary are written in one transaction                                                                                                                                                                                                                                                 | integration test that a bad boundary creates nothing                                                                                                                        |
| BG-15 | The equipment priority cannot name specific operations (`equipment_limits.unavailable_operations` takes catalog-style ids but no vocabulary exists)                       | a sourced vocabulary of farm operations (sowing, harvest of each crop class, tillage, spraying) as catalog ids with names in en, fr, ar, ary, exposed through BG-4's catalog endpoints and used by the engine when ranking                                                                                                                                                            | contract + tests; S08 then offers the picker                                                                                                                                |

### 5.1 BG-13: automatic field detection (the feature that makes field selection easy)

**Goal, from the user's words:** the farmer zooms smoothly, every field on the
map is already outlined, tapping a field selects it and "squares" it exactly;
where a field was not detected, one tap makes the app outline it automatically;
the farmer never has to draw by hand.

**Evidence from OneSoil (observed 2026-11-10 at Beni Mellal):** a vector layer
of field outlines is shown from about zoom 12 to 15; tapping inside one selects
it (yellow outline), the side panel lists the field with a thumbnail, name,
area, crop, variety and irrigation, and Cancel and Save are fixed at the
bottom. Their zoom moves in whole steps and at higher zoom the imagery blurs
and a banner says "Zoom in to select fields". We copy the interaction and
improve the zoom (continuous), the fallback (automatic outline on tap) and the
honesty (a confidence and a "check this outline" label). Their boundary data is
theirs and is not used.

**Imagery for detection.** NASA HLS is 30 m, too coarse for fields of 0.5 to 2
hectares (a 1 ha field is about 11 pixels). Detection therefore uses
**Sentinel-2 L2A at 10 m** (free and open, Copernicus; attribution "Contains
modified Copernicus Sentinel data"), read as Cloud Optimized GeoTIFFs from the
open Earth Search STAC catalogue on AWS (no key). It is non-NASA open data and is
credited as such in S20 and `THIRD_PARTY_NOTICES.md`, as the challenge terms
allow. NASA HLS stays the imagery shown and analysed in the app.

**Model.** The Fields of The World (FTW) baselines: a pretrained Sentinel-2
field-boundary segmentation model (three classes: background, field interior,
field boundary) used on two dates (start and end of a growing season). Before
use the implementer verifies on the repository and model card (a) the code and
checkpoint licences (the listings read MIT for code and CC-BY 4.0 for the
checkpoint; this is third-party information and must be confirmed against the
source), (b) which countries the training set covers (Morocco was not confirmed
in a first search), and records both in `docs/DECISIONS.md`. If the licence or
fitness is not acceptable, the fallback is a classical pipeline (edge-preserving
smoothing, watershed on NDVI and gradient at 10 m, polygonisation) behind the
same API. The choice is recorded either way, with measured accuracy.

**Service.** In the stateless Python science service (`apps/science`) a new
endpoint `POST /v1/fields/detect` takes a bounding box (at most about 4 km
square), two date windows, and returns polygons (GeoJSON, WGS84) with
`areaHectares`, `confidence` (0 to 1: mean interior probability minus boundary
leakage), `method` (`ftw-model-1` or `classical-1`), and the Sentinel-2 scene
ids and dates used. Deterministic given the scene ids; no randomness.

**API (NestJS).**

1. `GET /api/v1/field-detection/tiles/{z}/{x}/{y}` for tiles at zoom 14: returns
   a GeoJSON FeatureCollection of detected fields in that tile
   (`properties: {id, areaHectares, confidence, method, scenes}`), or
   `202 {status:"computing", retryAfterSeconds}` while the tile is being
   detected, or `200` with an empty collection plus
   `coverage:"no_fields_found"`. Results are stored in Postgres
   (`field_detection_tiles(z,x,y,model_version,scenes_sha256,geojson,created_at)`,
   immutable per model version and scene set) and shared by all users. A worker
   (pg-boss) computes missing tiles; the API never calls the science service in a
   request path longer than 5 s.
2. `POST /api/v1/field-detection/outline` with `{latitude, longitude}`: the
   "outline it for me" call. Looks up the stored polygon containing the point;
   if the tile is missing it computes that tile with priority; if still no
   polygon contains the point it runs a point-seeded fallback (region growing
   from the tapped pixel on NDVI similarity and edge strength at 10 m, bounded to
   10 hectares unless the polygon is clearly larger) and returns
   `{polygon, areaHectares, confidence, method, scenes}` or
   `422 {code:"NO_FIELD_FOUND"}`. Response time target: under 3 s for stored
   tiles, under 30 s for a new tile, with the 202 pattern for slower ones.
3. Both require an owner (guest or account), are rate limited
   (60 tile reads per minute, 20 outline calls per hour), and never receive the
   farmer's identity.
4. Polygon cleaning on the server so the result always passes
   `fieldBoundarySchema`: outer ring only (holes dropped and reported), snapped
   to a simple valid ring, at most 200 vertices (Douglas-Peucker, tolerance at
   most 5 m, area change at most 2 percent, else the tolerance is lowered), area
   0.1 to 1000 ha, span at most 0.1 degrees. A cleaned polygon that cannot meet
   the limits is dropped and counted.
5. Fully covered by tests: a golden scene set committed as fixtures (real
   Sentinel-2 chips of Tadla and Beni Mellal saved under
   `tests/support/fixtures/detection/`, with their scene ids), unit tests for the
   cleaning, integration tests for the 202/200 flow and for ownership, and an
   **accuracy report** (`docs/steps/15/field-detection-accuracy.md`): intersection
   over union of detected polygons against at least 30 parcels hand-drawn by the
   team in Tadla, Beni Mellal and the Gharb, with the median, the 10th percentile
   and the share of fields found. The interface shows "suggested outline, check
   it" whatever the score; if the median IoU is below 0.7 the feature is labelled
   "beta" and the grid-paint and manual outline stay prominent.
6. Honest limits written in the response `limitations`: it detects crop fields
   from images, not legal parcels; boundaries can merge neighbours or split a
   field; small or irrigated-terraced plots are harder; clouds reduce quality.

**Update 2026-11-10 (B2r; supersedes the proposed detector, fallback, API and accuracy requirements above).** The implemented optional service reads precomputed FTW 2025 Morocco polygons (CC BY 4.0). With `FIELD_BOUNDARIES_ENABLED=true`, owner-authenticated `GET /api/v1/field-boundaries/tiles/14/{x}/{y}` returns 200 GeoJSON, and `POST /api/v1/field-boundaries/at` with `{latitude,longitude}` returns the smallest containing suggestion or 404 `NO_FIELD_FOUND`. There is no 202 detector, science-service call or automatic fallback. Manual outline/painting/upload remains required for missed or wrong suggestions. Accuracy is unmeasured; the default is disabled and no national dataset is bundled. See `b2r-notes.md` for measured sample admission and limits.

Frontend dependency: S04 (Part 6) uses the two B2r endpoints above when enabled. Otherwise,
S04 offers only grid painting and manual outline, and says "automatic
detection is not available yet" (not hidden).

---

## PART 6. SCREENS: EVERY CONTROL, EVERY BINDING, EVERY STATE

Template for each screen: **Purpose; Route; Layout; Controls (every button,
field and label, with what it does and the API call it makes); Data; Validation;
States; Acceptance tests.** Labels are message keys (`screen.control`), written
here in English for reading; the fr and en files are produced in slice F2 and
completed per slice. A control that cannot work (feature off, no permission,
no data) is shown disabled with the reason beside it, never hidden, except
controls for features that the capabilities say do not exist at all (then the
whole section shows one honest note).

### 6.0 The shell (present on every route)

**Layout.** At 1024 px and wider: icon rail (far left, 56 px), contextual list
panel (about 300 px), detail panel (about 420 px, opens and closes), map (rest).
768 to 1023 px: a top bar replaces the rail; panels open over the map as a
single sheet at a time. Below 768 px: the map fills the screen, a five-item tab
bar sits at the bottom, panels become bottom sheets with three detents (peek 120
px, half, full).

**Rail and tab bar items** (icons with labels shown always on phones, on hover
and as `aria-label` on desktop): Map (`/map`), Fields (`/map` with the list
open), Plans (`/plans`), Crops (`/crops`), Account (`/account`). The rail also
holds, at the bottom: Glossary (`/glossary`), Photo check (`/photo-check`, hidden
when the capability says unavailable, shown disabled with a reason if the key is
missing), About (`/about`), language toggle (FR | EN, `aria-pressed`).

**Always visible:** the reminder line "A guide, not a replacement for your own
judgement or your local advisers" (`shell.reminder`) at the bottom of the list
panel and detail panel on desktop, and at the bottom of every open bottom sheet
on phones; on screens with no panel open (the bare map) it is in the layer
chip's popover and in the first-run overlay; a test asserts that on every route
at every width the reminder is present in the DOM and visible once a panel or
sheet is open.
**Offline bar** (one line at the top) when `navigator.onLine` is false or two
consecutive requests fail with `NETWORK_UNAVAILABLE`.
**Toast region** (bottom, above the tab bar): toasts only follow an action the
user just took and disappear after 6 s; never on load.
**Error boundary** around each route: shows `ErrorState` with "Reload this
screen" and does not blank the shell.
**Focus and keyboard:** skip link to the main content; Escape closes the top
sheet, dialog or popover; map keyboard controls (arrows pan, plus and minus
zoom) work when the map has focus.

### S00. Boot

Purpose: decide what the app can do before showing anything.
Sequence on load (in parallel, 4 s timeout each, shown as a skeleton of the
shell, never a spinner on a blank page): read language and first-run flags from
`localStorage` (try/catch: if it throws, continue with defaults), load message
files, `GET /health/ready`, `GET /auth/capabilities` (or BG-1
`/capabilities`), `GET /account` (401 is normal), the guest token from
`sessionStorage`, `GET /catalog/options` (current), `GET /glossary?lang=`.
States: **ready** (continue); **API unreachable** (`NETWORK_UNAVAILABLE` or
`/health/ready` 503): full-screen `ErrorState` "Rotavise cannot reach its server
right now" with "Try again" (retry every 10 s with a visible countdown) and the
text "Your saved work is safe on the server"; **catalog unavailable**: the map
and fields work, plan building is disabled with the reason; **query string**
handlers: `?auth=verified|reset|deleted|google` (S02).
Tests: boot with every endpoint failing in turn; no uncaught error; the correct
degraded states.

### S01. Welcome (first run only; reachable again from About)

Controls: two large buttons **Français** and **English** (sets `rv.lang`, flips
the whole interface immediately without reload); headline (what Rotavise does,
one sentence); three short lines (it reads NASA satellite data for your field;
it compares your rotation with two or more others; it tells you how sure it is
and what to check locally); the reminder; buttons **Start** (go to `/map`),
**Try the demo** (S21, only if BG-6 is on), **Sign in** (S02).
No account is required to start; the guest session is created at the first
action that needs an owner (first field save, plan, photo check).
Tests: first run shows it; the second run does not; language persists.

### S02. Sign in, sign up, verify, recover, Google (route `/account`, and the `?auth=` landings)

Purpose: optional account for saving across devices.
Controls and calls (all through `/api/auth/*` as `account-client.ts` does today):

1. Tabs **Sign in** and **Create account**.
2. Create account: **Name** (text, 1 to 120), **Email** (valid email), **Password**
   (15 to 128 characters; live helper "at least 15 characters, longer is better";
   no composition rules), **Create account** button: `POST /api/auth/sign-up/email`
   with `callbackURL = origin + "/?auth=verified"`. On success show "Check your
   email to confirm. The link is valid for 1 hour." and a **Send the email again**
   button (`POST /api/auth/send-verification-email`; limit 5 per hour; show the
   wait on 429). No auto sign-in (the server does not).
3. Sign in: **Email**, **Password**, **Sign in** (`POST /api/auth/sign-in/email`);
   wrong credentials and "email not verified" show different sentences; a link
   **Forgot your password?**; limit 5 per minute handled with the wait text.
4. **Continue with Google** (shown only when `authCapabilities.google`): `POST
/api/auth/sign-in/social` with provider `google` and `callbackURL =
origin + "/?auth=google"`; the response `{url, redirect}` is followed with
   `window.location.assign(url)`.
5. Forgot password: **Email** and **Send reset link** (`POST
/api/auth/request-password-reset`, `redirectTo = origin + "/?auth=reset"`);
   the same confirmation text whether or not the email exists.
6. Landing `?auth=reset&token=...`: **New password** (15 to 128) and **Save new
   password** (`POST /api/auth/reset-password` `{token, newPassword}`), then
   "Password changed, sign in again" (all sessions are revoked by the server).
7. Landing `?auth=verified`: toast "Email confirmed. You can sign in." and the
   Sign in tab opens. `?auth=deleted`: "Your account was deleted." `?auth=google`:
   call `GET /account`; on 200 go to `/map`, on 401 show "Sign-in did not
   complete, try again".
8. Signed in: show name, email, **Sign out** (`POST /api/auth/sign-out`).
   States: loading, field errors inline, server unavailable (`AUTH_UNAVAILABLE`),
   capabilities off (the account section says accounts are not available here and
   the app keeps working as a guest).
   Tests: every control against the real server in e2e with the Mailpit test
   mailbox (existing harness `tests/support/accounts.mjs`): sign up, verify from
   the email link, sign in, reset, sign out.

### S03. Map home (route `/map`)

Purpose: see all the farmer's fields on the real map and open one.
Layout: contextual list panel (desktop) or bottom sheet at the peek detent
(phone) holding **My fields**.
Controls:

1. **Search fields** (client-side filter on name) and **Sort** (name, area,
   recently changed). Sorting is client-side over loaded pages; "Load more" calls
   the next cursor page.
2. Field rows (thumbnail of the outline drawn as a white line on a dark tile,
   name, area in hectares from the boundary record, a chip with the status of the
   latest plan if any, a chevron): tap focuses the map on the field and opens S05.
3. **Add field** (green pill) opens a menu: **Tap on the map** (S04 detection),
   **Paint cells** (S04 grid), **Draw outline** (S04 manual), **Upload an outline**
   (S04 file), **Drop a pin only** (S04 pin). "Tap on the map" shows a "beta" chip
   or is disabled with "Not available yet" per capability `fieldDetection`.
4. Empty state (no fields): grey card with icon, "Add your first field", two
   lines "Tap it on the map, paint it, or draw it", and one green pill. A second
   outlined card "Try the demo" if BG-6 is on.
5. Map: all field outlines (white line, translucent fill, the name as a label at
   zoom 13 and above), the selected field with a yellow outline; layer chip at top
   left; search pill at top right (fields only); map buttons (zoom in, zoom out,
   locate, layers popover); date stepper and compare slider inside the layers
   popover; legend link bottom left.
   Data: `GET /fields` (pages of 20, then more), `GET /fields/{id}/boundary` per
   field (batched with a limit of 6 in flight; cached), plan status chips from BG-2.
   States: skeleton rows sized like rows; error with retry; offline shows cached
   list read-only.
   Tests: list, search, sort, load more, open a field, empty state, offline cache.

### S04. Add a field (route `/fields/new`, also opened as an overlay from S03)

Purpose: get a valid outline and a name with the least effort. **Five ways,
ordered by ease. The first is the default and the reason this screen exists.**

**Common layout.** The panel collapses to a narrow "Select field" panel like
OneSoil's: title, the list of selected fields (each: outline thumbnail, name
input prefilled "Field N", area, irrigation select, a remove (trash) button),
and **Cancel** (grey) and **Save** (green, disabled until at least one valid
selection) pinned at the bottom. Above the list a one-line instruction that
changes with the mode. The map keeps all its controls.

**Mode 1: Tap on the map (automatic detection, BG-13).**

1. The map opens at the farmer's last view, or at the last field, or (first run,
   no position) at the centre of Morocco at zoom 6 with the instruction "Zoom in
   to your area". The locate button asks for the browser position only when
   tapped.
2. **Zoom is continuous and smooth.** Wheel, trackpad pinch and touch pinch zoom
   with easing (MapLibre `scrollZoom` rate tuned so one wheel notch is about a
   quarter zoom level, damped; double-tap and double-click zoom by one level
   animated over 300 ms; the plus and minus buttons animate 300 ms). There are
   no fixed zoom steps and no blur banner: imagery above its native detail is
   overzoomed smoothly and a quiet note says "imagery is 30 m here".
3. From zoom 12 the detected field outlines of the visible area are drawn as thin
   white lines (2 px at 12 to 14, 3 px above) from
   `GET /field-detection/tiles/{z}/{x}/{y}` (zoom 14 tiles, requested for the
   visible tiles plus a one-tile margin, at most 6 in flight, cached for the
   session). While a tile answers `202 computing` the tile area shows a subtle
   shimmer and the panel line "Finding fields in this area" with a progress count
   of tiles done; the retry follows `retryAfterSeconds`. A tile with
   `coverage: no_fields_found` shows nothing and no error.
4. Hovering (desktop) a polygon highlights it (translucent white); tapping inside
   a polygon selects it: yellow 3 px outline, soft yellow fill, the panel adds a
   row with the outline thumbnail, the auto name, `areaHectares`, and a chip
   "Suggested outline: check it" with the confidence as a plain word (high,
   medium, low) from `confidence` (at least 0.8, 0.6, below). The map eases to fit
   the polygon (400 ms) only if it is outside the viewport. Tapping a selected
   polygon again deselects it. Several fields can be selected; each becomes a
   separate field on Save.
5. **The fallback: "Outline it for me."** If the tap lands where no outline
   exists, a small bubble appears at the point with the button **Outline this
   field** (and Cancel). It calls `POST /field-detection/outline`. While waiting
   (up to 30 s) the bubble shows a progress line and a pulsing dot at the point;
   the map stays interactive. On success the polygon appears selected as in step
   4 with the chip "Outlined automatically: check it". On `NO_FIELD_FOUND` the
   bubble says "We could not find a field edge here" and offers **Paint cells**
   and **Draw outline** at that location.
6. **Fix it quickly.** A selected polygon can be adjusted: **Edit outline** turns
   on vertex handles (24 px) that can be dragged, midpoints that add a vertex, and
   a long-press or the delete key that removes one; **Merge** (select two adjacent
   polygons in the panel, then Merge, computed in the browser with a simple union
   and re-validated); **Reset** restores the detected polygon. Every edit
   re-validates with the shared `fieldBoundarySchema` and boundary helpers
   (`boundaryHectares`).
7. If a tap lands on a polygon larger than 1000 ha or smaller than 0.1 ha the
   chip says why it cannot be used ("too large to analyse: draw the part you
   want" or "too small: at least 0.1 ha") and Save stays disabled for it.

**Mode 2: Paint cells.** For fields detection missed. The map shows a 30 m grid
aligned to the NASA HLS pixels (UTM lattice anchored at multiples of 30 m;
verify against a real HLS granule geotransform in this slice's test and anchor
to it if different), visible from zoom 15, as faint lines that brighten near the
pointer. Pointer down on an empty cell starts adding; on a painted cell starts
removing (direction fixed by the first cell, as in the existing prototype);
interpolation between pointer positions leaves no gaps; painted cells scale and
fade in over 280 ms; a live readout shows hectares and the number of NASA cells.
The outline is the union boundary: the single connected region (a second
component or a hole shows an inline fix hint and is auto-filled if the hole is
smaller than 1 ha); vertices are merged when collinear and simplified to at most
200 positions with a tolerance of at most half a cell, area change at most 2 %;
validation errors map from the schema: "Too large", "Area outside limits",
"Self-intersecting ring". A region with no NASA pixel at least 15 m from its
edge says "this area is narrower than a NASA pixel" (the observation sampler
would return no point).

**Mode 3: Draw outline.** Click or tap to add vertices, tap the first vertex or
double-click to close, drag vertices to adjust, Backspace removes the last, a
"Snap to field edges" toggle (on by default when detection data is present)
snaps new vertices to nearby detected edges within 12 px. Undo and redo buttons.

**Mode 4: Upload an outline.** Accepts GeoJSON, KML, or a zipped shapefile
(`.zip`), parsed in the browser (open-source parsers listed in the notices),
reprojected to WGS84, polygons only; multiple polygons become multiple selected
fields; each validated; errors per polygon in plain words.

**Mode 5: Drop a pin only.** Tap a point to create a field without an outline
(area unknown). NASA analysis that needs an outline is disabled for this field
with "Add an outline to ask NASA for this field's data", and plans still work
(location only).

**Per selected field (all modes):** name input (1 to 80 characters, control
characters rejected); irrigation select (Not set, Rainfed, Sometimes irrigated,
Irrigated) which maps to `water` (`unknown` or `{status:"reported",
availability: rainfed | irrigation_limited | irrigation_available}`); last crop
optional (opens S06 history quickly: one crop picker and two dates).

**Save.** For each selected field: `POST /fields` (or `/fields-with-history` when
history was entered) with `schema_version:"1"`, `name`, `location` = a point
inside the polygon (the polygon's pole of inaccessibility, computed client-side
with a small open-source routine; never a vertex), `soil: {status:"unknown"}`,
`water` from the irrigation select, `crop_health: {status:"unknown"}`; with BG-14
the boundary goes in the same request; before BG-14, `PUT /fields/{id}/boundary`
with `expectedVersion: null` follows, and if it fails the field is shown with an
"Outline not saved, retry" state and the Retry button repeats only the boundary
call. After Save: toast "Field saved", the map flies to the field, S05 opens.
States: detection off (modes 2 to 5 only, with the sentence), detection tile
computing, no network (Save disabled, offline note), 429 (wait text), 409.
Tests: each mode end to end against the real API; smooth zoom (a unit test
asserts no discrete-zoom handler and that `zoom` changes continuously under
simulated wheel events); automatic detection with the golden fixtures; the
fallback outline; merge; validation messages; save failure between field and
boundary (before BG-14).

### S05. Field detail (route `/fields/:id`)

Purpose: one field's profile, history, NASA status and plans.
Layout: detail panel with header and five text tabs, URL `?tab=status|history|inputs|nasa|plans`.
Header: name (inline edit: pencil, save on Enter or blur: `PUT /fields/{id}`
with `expectedVersion`), "X.X ha, 32.40° N 6.55° W" (hectares from the boundary
record; coordinates rounded to 2 decimals for display only), a **more** menu
(Rename, Edit outline (opens S04 edit), Delete field (confirm: "This deletes the
field, its history and NASA data requests. Plans made from it stay."), Close).
**Status tab.** Cards: (1) "Compare rotations" primary button (to S09) with the
sentence of what is missing for a better answer (no history, no soil data, no
outline) as a short checklist with links; (2) NASA data status: six rows
(Greenness 30 m, Greenness since 2000, Rain, Soil moisture, Terrain, Plant
temperature) each with a state (not asked, waiting since date, ready on date,
failed) and a button **Ask NASA** (calls the matching POST) or **Check again**;
(3) Regional context rows (Water storage GRACE: ready or "not imported";
Trees and hedges nearby GEDI: ready or the reason text); (4) latest plan chip.
**History tab.** S06 embedded.
**Inputs tab.** S07 embedded.
**NASA tab.** The same panels as S13 but for the field alone (no plan needed):
Seasons and Water and Land (terrain, ECOSTRESS) and the two regional rows, each
with its source line. This is where the field-level analysis lives; S13 reuses
the same components inside a plan.
**Plans tab.** Plans made from this field (BG-2 `fieldId` filter), newest first,
status chips, open, **New comparison** button.
Data: `GET /fields/{id}`, `/boundary`, `/history`, observations and extractions
lists, analysis endpoints, plans list.
States: loading skeletons, 404 (not found or not yours), 409 on edit, offline
read-only.
Tests: rename, version conflict dialog, delete confirm, every NASA row's POST
and poll against the real server with the fake-provider test harness already in
the integration tests.

### S06. Crop history (inside S05; route `/fields/:id/history` focuses it)

Purpose: the farmer's past crops, the base of the "existing rotation".
Layout: a horizontal **crop strip** of seasons (newest right) above a list.
Controls: **Add a season** (opens a dialog); each strip block and list row opens
the same dialog to edit; **Delete** (confirm).
Dialog fields: **Crop** (SearchSelect from the catalog: names in the display
language with the other names beside, family chip, colour swatch; recently used
first; search matches any of the four languages and the scientific name),
**Variety** (optional, from the crop's `cultivars` in the catalog; stored only in
the plan builder, not in the field history: label says so), **Planted on**
(DateField), **Harvested on** (DateField). Both dates are required by the field
history contract. Validation (shared `cropHistoryEntrySchema`): crop id valid,
1900-01-01 to 2100-12-31, planted on or before harvested on; plus a client check
for overlap with other entries (the plan contract rejects overlaps).
Calls: `POST /fields/{id}/history` (`schema_version "1"`, `crop_id`, `planted_on`,
`harvested_on`), `PUT .../{entryId}` with `{expectedVersion, entry}`,
`DELETE .../{entryId}`; `GET` with cursors.
Strip rendering: blocks proportional to duration, coloured by crop (3b.1), label
the crop name when it fits, gaps between entries drawn as hatched "nothing
recorded", tooltip with dates; keyboard focusable.
States: empty ("Add the crops you grew here, even from memory; dates can be
approximate"), loading, conflict (409) dialog, offline queue (3.8).
Tests: add, edit, overlap rejected, delete, conflict.

### S07. Inputs: soil, water, crop health (inside S05)

Purpose: local information that improves the answer.
**Soil.** A short explanation: "A laboratory test is best. Without one we use a
satellite-based estimate (SoilGrids, about 250 m) and label it as an estimate."
Controls: **pH** (number 0 to 14, 0.1 step, method select Water, CaCl2,
Unknown), **Organic matter** (percent 0 to 100, method text 1 to 120), **Soil
texture** (classification text and classification system text), **Measured on**
(date, optional), **Source** (Farmer observation or Laboratory report),
**Salinity** (dS/m 0 to 100, method Saturated paste EC or Unknown) only when
BG-8 is done (otherwise shown in the plan builder step 4, not here). Each metric
is added with **Add measurement**, at most one per metric (the contract rejects
duplicates). Saving calls `PUT /fields/{id}` with `expectedVersion` and the new
profile (soil `{status:"known", observations}` or `{status:"unknown"}`).
Estimate block: shown after a plan exists, reading `result.soilEstimate` (pH
water, clay, sand, silt percent, organic carbon g/kg, bulk density g/cm3, CEC,
nitrogen g/kg; each may be null: shown as "no value") with the SoilGrids
attribution text and "estimate, not a soil test". Before any plan it says
"Available after your first comparison".
**Water.** Radios: Not sure; Rainfed; Irrigation limited; Irrigation available;
when either irrigation option: **Water you can count on** (number mm, 0 to 5000)
and **per** (Season or Year), stored at plan level (and in the field profile once
BG-8 is done). `PUT /fields/{id}` for the availability.
**Crop health.** List of reported problems: **Add a problem**: Crop (picker),
**What you saw** (BG-5 picker of listed problems with an "Other" text), **Kind**
(Disease or Pest, v1), **When** (date), **Who reported it** (Farmer, Specialist,
Laboratory), **Confirmed** (a switch, disabled and explained when the reporter is
the farmer: "A farmer report cannot be a confirmed diagnosis"). At most 20,
duplicates rejected. Footnote: "This tool never diagnoses; for a photo check see
Photo check."
States and tests as S06; the soil, water and health forms assert the exact JSON
sent (golden tests).

### S08. Priorities (route: step 4 of S09, also editable from the plan's header)

Purpose: tell the engine what matters.
Controls: four sliders 0 to 5 with a word and a one-line meaning each (from
messages, with the glossary term linked): **Water** ("use less water"), **Soil
health** ("keep the soil alive"), **Climate risk** ("limit heat, frost and
drought damage"), **Crop health** ("break disease and pest cycles"). The sum
must be above zero (inline message when all are 0). Defaults: all 3.
Then **Income** slider 0 to 5 (optional: untouched means omitted), with the note
"Income data is limited: see the gaps in your results" until BG-9.
**Equipment**: select None, Small, Medium, Large (maps to
`equipment_limits.mechanisation`; "not sure" omits it); specific operations are
added when BG-15 defines the operation vocabulary (until then the control is
absent and the About page lists it as pending).
**Market access**: Not sure, None, Local, Regional, Export (omit when not sure).
**Farmer context** (four pickers that change which benefits, risks and gaps are
spelled out, not the ranking: the interface says so): Equipment (Unknown,
Limited, Standard), Market preference (Unknown, Household food, Cash income,
Livestock feed), Forage need (None, Some, High), Erosion concern (Unknown, Low,
Moderate, High).
A short live line under the sliders shows the applied weights as percentages
when a plan exists (`strategies.priorities.applied`).
Tests: the JSON for each combination; the sum-above-zero rule.

### S09. Plan builder (route `/fields/:id/plan/new`; five steps, back and forward, state kept in memory and `sessionStorage`)

**Step 1, When and how long.** **Planning horizon** (3, 4 or 5 years, segmented),
**Earliest first sowing** and **Latest first sowing** (dates; defaults: the next
1 September and 366 days or fewer later; the helper explains "the first crop of
the plan can start any day in this range"; validation: earliest at most latest,
range at most 366 days, after every history date).
**Step 2, Crops.** **Which crops do you want considered?** (multi-pick, up to 20;
empty means "suggest for me": mode `suggest`), **Crops to leave out** (up to 50),
no overlap; each picked crop with a **Variety** select when it has cultivars
(`cultivars[]`, one per crop). The picker is the shared crop picker (S15
component).
**Step 3, Your current rotation.** "Which crops do you grow in order?" a crop
strip editor for 1 to 6 crops (add, reorder by drag or move buttons, remove), or
the button **Use my history** (fills from the field history when 1 to 6 distinct
recent crops exist), or **I do not follow a set rotation** (omits
`current_rotation`; the backend then infers one from history and says so).
**Step 4, Check what we have.** A summary with edit links: history (plus the
question "Is this all the crops you grew in the last N years?" Yes (complete) or
No (partial), required when history exists), soil, water (and allocation), crop
health, priorities (S08 inline), salinity if applicable. Missing items are shown
as gaps with the effect "the answer will say this is unknown".
**Step 5, Review and send.** A plain-language sentence of the request ("We will
compare your current rotation with at least two others for 4 years from
1 Sept 2027 to 30 Nov 2027 starting dates, giving most weight to soil health"),
the live validation result from `planRequestV2Schema.safeParse`, and the primary
button **Compare rotations** (`POST /plans` with `Idempotency-Key`). The button is
disabled while validation fails, with the first problem named. After 202 go to
S10 with the `Location` plan id.
General: **Cancel** returns to the field; progress dots; each step validates
before Next; the draft persists across reloads for the same field.
States: 429 (wait), 409 (`IDEMPOTENCY_CONFLICT`: new key and explain), catalog
unavailable (disabled with reason), session expired (owner refresh).
Tests: every step's JSON; the golden request for a full example validates with
the contract; the rejected combinations show the mapped messages.

### S10. Plan progress and failure (route `/plans/:id` while not completed)

Controls and display: a stepper of the stages (waiting in the queue, checking
the evidence, building rotations, getting weather, calculating, done) lit from
`stage`; elapsed time; "You can leave this page. Your comparison is kept until {date}" (the date is `expiresAt`, never a number written in the interface); **Back to my field**; **Cancel and
delete** (`DELETE /plans/{id}` with confirm).
Failure (`status: failed`): the glossary sentence for `error.code`, what to do
(for `WEATHER_UNAVAILABLE`: "NASA's weather service did not answer; try again
later"; for `PLANNING_LIMIT_EXCEEDED`: "Too many crops or options; pick fewer"),
**Edit and send again** (opens S09 prefilled from `plan.input`) and **Delete**.
Completed: redirect to S11 (replace history entry).
Tests: each stage and each error code with the stored-plan test harness.

### S11. Results: the comparison (route `/plans/:id`, completed)

Purpose: the answer. The first screen after a plan finishes. Content order:

1. **Outcome banner** from `result.outcome`: `comparisons_available` (no banner),
   `no_feasible_rotation` ("With these dates and rules we could not build a
   rotation"), `insufficient_evidence` ("We do not have enough evidence for these
   crops here"), each with the next steps drawn from `result.crops[].reasons` and
   `result.reasons` (glossary text). If `result.synthetic` is true: a red
   "test data" banner and no recommendations. Always: banner for reason
   `NOT_EXPERT_REVIEWED` when present: "These rules have not been reviewed by an
   expert".
2. **The comparison cards.** For each `strategies.items[]` (current first, then
   alternatives by rank): crop strip from the matching candidate's `slots`
   (cropId, sowEarliest..sowLatest, harvestEarliest..harvestLatest; block width by
   duration; year ticks); title ("Your rotation", "Option A", "Option B", "Option
   C"; "recommended for your priorities" on the best weighted rank); the first
   `why` note (translated by `code` with `facts`); **loss bars** for the four
   dimensions (`scores`: `climate.meanLoss`, `water`, `soil_health`,
   `crop_health`; lower is better; `null` shows "not compared" with the reason from
   `dimensions[].reason`); **versus your rotation** deltas (`versusCurrent`; negative
   means less loss; shown as "8 points better"); evidence chip (7.4); button
   **See why and evidence** (S12). On phones the cards are a horizontal snap
   carousel with dots; on desktop a three-column grid.
3. **Status of the comparison** (`strategies.status`): `complete`; `baseline_
unavailable` (explain with `baseline.notes`: not provided, not schedulable, no
   feasible schedule, stopped by a rule); `insufficient_alternatives` (we found
   `alternativesFound` of 2 required; say what limited it from `accounting`).
4. **How sure we are** card: `ranking.topStable` ("the best option stays first
   when the weights change" or "the order depends on your priorities: see the
   views"), `ranking.sensitivity[]` as a small table of views (name, top
   candidates), analog counts per dimension (`scores.climate.completeAnalogs`),
   `futureClimate.status` and `topStableAcrossFutures`, and the list
   `result.limitations`.
5. **Your priorities as applied** (`strategies.priorities`: requested vs applied
   weights as bars, farmer context lines, notes) and the **dimensions** table
   (`dimensions[]`: id, compared or not, requested weight, applied weight,
   reason).
6. **All options** (collapsed): a table of `result.candidates` (rank, crop strip
   mini, status eligible or conditional, weighted loss, pareto flag, tied-with
   count), sortable, 25 per page, row opens S12 for that candidate. States the
   accounting honestly ("we looked at N rotations, compared M, pruned P"; if
   `truncated` say the search stopped early).
7. **Crops that could not be planned** (`result.crops` where status is not
   `schedulable`): crop name, status in words, reasons.
8. **Reminders** (`strategies.reminders`, 3 to 8 keyed texts) as a quiet card.
   Actions (header, all real): **See the evidence** (S13), **Try a what-if** (S14),
   **Explain in words** (S12 explanation), **Rename** (BG-10), **Export** (BG-11),
   **Delete** (confirm).
   States: engine older than 7 (no `strategies`: render candidates as a ranked list
   and say the earlier engine did not compare your current rotation), loading
   skeleton, partial.
   Tests: a completed plan fixture per outcome; strategy cards for current plus 1,
   2 and 3 alternatives; baseline unavailable cases; synthetic banner; every note
   code resolves through the glossary (the DOM scan fails on a raw code).

### S12. Strategy detail (route `/plans/:id/strategy/:strategyId`)

Purpose: why a rotation is suggested, on what evidence, with what benefits, gaps
and risks (challenge C14 to C18, C24, C26, C28).
Header: title, crop strip (large, with sowing and harvest windows on hover and
in a text list), rank, **back to the comparison**, previous and next strategy.
Sections (each is an anchor, in this order; a left list on desktop or a chip row
on phones jumps between them):

1. **Why this rotation** (`notes` with `kind: why`, translated by `code` and
   filled with `facts`: `WHY_RANKED_BY_PRIORITIES`, `WHY_LOWER_LOSS_THAN_CURRENT`,
   `WHY_NOT_BETTER_THAN_CURRENT`, `WHY_BEST_ON_DIMENSION`, `PRIORITIES_*`).
2. **Evidence** (`notes` kind evidence: `EVIDENCE_RULE_SOURCES`, `EVIDENCE_WEATHER`,
   `EVIDENCE_FUTURE_CLIMATE`, `EVIDENCE_BARE_FIELD_SHARE`): the evidence chip and
   the counts from `strategy.evidence` (`extracted`, `double_checked`,
   `expert_reviewed`, `model_recall`) in words ("12 rules with a checked source, 3
   recalled by an AI model, 0 expert reviewed"), then a **Sources** list: every
   citation from the candidate reasons (`reasons[].citations`: source title and
   publisher from `catalog/options.sources` by `sourceId`, `locator`, `page`,
   `interpretation`, and the exact `quote` when present, in a collapsible block)
   with an external link to the source URL (rel `noopener noreferrer`, opens a
   new tab).
3. **Benefits** (`notes` kind benefit: nitrogen fixing, more crop families, fewer
   repeats of one family, lower water loss, lower climate loss, better
   predecessor fit, fewer health warnings, better under future climate, forage)
   plus numbers: loss deltas (`versusCurrent`), soil carbon (`result.soilCarbon`
   for this candidate: start tC/ha, after 20 years kept vs grazed residue; label
   "uncalibrated model, compare options, do not read as a forecast"), yields
   (`result.yields` for this candidate: per crop mean and worst-decile t/ha,
   `attainment`, label "uncalibrated default parameters; compares crops and years,
   not farm yields"; `no_crop_model` shown as "no model for this crop").
4. **Gaps** (`notes` kind gap: dimension not compared, future climate unavailable,
   no market data, erosion not assessed, no equipment data, recalled rules) and
   `reasons` with `effect: gap`, each in plain words with the glossary term.
5. **Risks to check locally** (`notes` kind risk: local review, rule conditions,
   rainfed arid risk, worse under future climate) and reasons with `effect:
failure` or `condition`; below them the button **Make my checklist for an
   adviser**: a printable list (browser print stylesheet) of every risk and gap
   with the crop, the reason and what to ask; it is generated from data already
   on screen and contains the reminder.
6. **Scores and uncertainty**: for the four dimensions a `RangeBar` (mean loss
   and worst decile for climate; the other dimensions their single loss; `null`
   as not compared), `completeAnalogs` (how many past years were comparable),
   `waterBalance` (mean crop water use, mean rain, mean shortfall in mm, mean
   annual rain), `extremes` (hottest day, coldest night, longest dry spell, wettest
   day, drought-season share, each with units).
7. **Under future climate** (from `candidate.future`): a table by scenario (the
   two experiments) and model (up to five): baseline mean loss, future mean loss,
   change, weighted rank in that world; summary min, mean, max change; the
   near-term block when `future.nearTerm` exists, both titled "model projection,
   not a forecast"; if absent, the reason from `futureClimate.reason` or
   `futureClimate.nearTerm.reason` in words.
8. **When it is vulnerable** (`candidate.vulnerabilitySeasons`): per slot, a
   timeline with the stage periods coloured by code (`EXPOSURE_HEAT`,
   `EXPOSURE_COLD`, `EXPOSURE_RAIN_DEFICIT`; `EXPOSURE_UNAVAILABLE` as hatched),
   start and end dates, stage name, the numbers (`numbers` record with units
   named in the keys), and the rule's citation; "model estimate over the possible
   sowing dates, not a forecast".
9. **All reasons** (collapsed): every `candidate.reasons[]` item with effect icon
   (pass, condition, failure, gap, info), glossary text, crop and slot, facts
   table, citations.
   Controls: **Explain in words** (calls `POST /plans/{id}/explanation` with
   `{language: "fr"|"en"}`; shows the returned `text` with the line "Written by an AI
   model, not reviewed (model name)" and, because `reviewed` is always false, the
   reminder; errors per `AI_*` codes; disabled with the reason when capabilities say
   the AI key is not set); **Copy link**; **Print**.
   Tests: one fixture with every section populated; a fixture with each section's
   empty and null states (no future, no vulnerability, no yields).

### S13. Evidence (route `/plans/:id/evidence/:tab`; also the NASA tab of S05)

Purpose: show every NASA dataset used, how, with what uncertainty (C04, C05,
C07, C08, C10, C11, C20 to C25, C29 to C31).
Header: a source line "NASA data for this field" and a status strip (one chip per
dataset: ready, waiting, not asked, failed). Tabs (underline style):

**Tab Seasons ("Your field's greenness").**
Data: `GET /fields/{id}/analysis/vegetation` (HLS 30 m, from `result.input.field_id`
or the field of the plan) and `GET /fields/{id}/analysis/vegetation-history` (MODIS
since 2000).
Display: (a) **Season chart**: for the selected year a line of `timeline[].ndvi`
with the green and low-greenness periods as shaded bands (`years[].periods`,
`kind green` in `--vegetation`, `low_greenness` in `--bare`), peak marker
(`peakDate`, `peakNdvi`), a year stepper; (b) **Usually low windows**
(`typicalLowGreenness.windows`, month-day ranges, years counted): "Usually low
greenness from 25 May to 16 Nov (at least N years)"; with the sentence "Low
greenness often means bare soil or stubble, but satellites cannot tell: confirm
what was on your field"; (c) **This year compared with other years**
(`anomalies.points` flag `below_usual` or `above_usual`, `latest` with `stale`
and `daysOld`); (d) **Since 2000 (MODIS 250 m)**: a band chart of `bins`
(`lowShare`, `greenShare` per 16-day bin), `usuallyLow` and `usuallyGreen`
windows, `annualPeaks` with `peakTrend` (direction in words, `slopePerDecade`,
`consistency`), `heterogeneity` (does the 250 m pixel look like the field),
`hlsAgreement`; (e) **Quality**: `uncertainty` (dates seen, usable share, largest
gap, gaps over the limit listed), the cloud-gap explanation, and every
`explanations[]` text; (f) `limitations`.
Requests: if either response is `unavailable` with `observation: none`, a primary
button **Ask NASA for this field's greenness** (`POST /fields/{id}/observations`
kind `hls`; and `POST /fields/{id}/extractions` kind `modis`) with the sentence
"NASA usually answers in a few hours. You can leave; we keep the request." and
the daily-limit note. Waiting shows the stored created time and a **Check
again** button; failed shows the error code in words and **Try again**.

**Tab Water ("Rain, soil moisture and water").**
Data: `GET /fields/{id}/analysis/rain` (IMERG vs POWER), `observations` kind
`smap` result (soil moisture days) via the observation list/get,
`GET /fields/{id}/water-storage` (GRACE), `result.rain`, the candidates'
`waterBalance`, and the weather query of 4.6.
Display: (a) **Monthly rain: NASA satellite vs weather data** bars (`months[]`:
`imergMm`, `powerMm`, `bothComplete`, `ratio`) with `summary` (totals, ratio,
share of months IMERG wetter) and `planning` text; the correction note from
`result.rain.source` (`power_corrected_to_gpm` with `monthlyFactors` shown as 12
small values, or `power_only`); (b) **Soil moisture (SMAP, 9 km, regional)** line of
`days[].percentile` with gaps where it is null ("SMAP leaves the percentile
undefined on many days") and `volumetric` as a second series; (c) **Water stored in
the ground (GRACE, regional)**: `recentMonths[].anomalyCm`, `trend.direction`,
`trendCmPerYear` with `interval95CmPerYear`, `cell.distanceKm` and the sentence
"This is a regional measure, not your well"; if unavailable show the reason
(`WATER_STORAGE_NOT_IMPORTED`, `WATER_STORAGE_OUTSIDE_IMPORT`,
`WATER_STORAGE_SERIES_TOO_SHORT`) in words; (d) **Crop water use vs rain** for the
selected strategy (`waterBalance` numbers); (e) the last 366 allowed days of
rain and temperature from the weather query as a small chart.

**Tab Heat and frost.**
Data: `candidate.vulnerabilitySeasons` (selected strategy), `candidate.extremes`,
extraction kind `ecostress` result, `outputs.terrain.frostPocket` via the terrain
result.
Display: (a) the vulnerability timeline of S12 section 8, all slots; (b)
**Extremes** table; (c) **Plant temperature from space (ECOSTRESS, 70 m)**: months
with `lstMeanC`, `lstMaxC`, `esiMean`, `esiMin`, `acquisitions` count, and the
honest note about few clear scenes and quality filtering
(`policyVersion ecostress-policy-2`: only the best-quality pixels are kept); (d)
**Frost pockets** (`terrain.frostPocket.status`: possible cold-air pool, not
indicated, unknown; `belowSurroundingM`).

**Tab Land ("Ground, slope and water movement").**
Data: extraction kind `terrain` result, `result.outputs.terrain`,
`GET /fields/{id}/canopy-biomass`.
Display: elevation (mean, min, max, relief m), slope (mean %, 90th percentile,
dominant aspect in degrees and as a compass word, class shares), the DEM noise
note and `slope_below_noise` explanation (a slope below the data's noise floor
reads as flat), erosion exposure (`erosion.lsFactorMean`, `referenceBand` in
words, `slopeLengthM`) with the status `unranked_incomplete_rusle` explained
("a full erosion estimate needs rainfall energy, soil erodibility, crop cover and
practice factors; missing: R, K, C, P"), the **crop cover factors** table from
`outputs.terrain.erosion.cropCover` (`status` sourced, model_recall or not_found,
`factor`, citations), **infiltration and drainage**
(`INFILTRATION_DRAINAGE_UNKNOWN`: "we have no sourced method yet; here is what is
known about your slope"), and GEDI trees and hedges nearby (field cell Mg/ha with
standard error, the 3 km mean, min, max, `cellsInRadius`, observation period) with
the line "not crop biomass". A mini-map shows the outline, sample points and the
terrain sample grid.

**Tab Future (scenario, not a forecast).**
Data: `result.futureClimate`, `candidate.future` for each strategy.
Display: status and cell (the 0.25 degree source cell), a segmented control
**Near term** | **Mid-century** (near term only when `futureClimate.nearTerm`
exists), a table of worlds (model, experiment, compared or not, top candidate
ids), for the selected strategy the change by model as dots and the min, mean,
max band, `topStableAcrossFutures` in words, attribution
(`SCENARIO_ATTRIBUTION`), and a **What-if** button (S14). Explains "future
climate here means five NASA climate models under two emission scenarios; each
model is compared with its own past, so model errors cancel".

**Tab Sources.** Every dataset used with product name, provider, resolution,
how it entered (engine input, reported context, or not used: `outputs.grids[].use`)
and the citation/DOI list from the glossary `product.*` terms; the catalog
version and checksum (`result.catalog`); the rule sources list for the plan (all
citations of the chosen strategy deduplicated); the evidence counts; and the
licences (CC BY for SoilGrids, NEX-GDDP attribution, NASA data). Link to S20.

**Tab Grids ("Data and grids").** The table from `outputs.grids` (10 rows): input
(POWER, GPM, HLS, SMAP, NEX-GDDP, NASADEM, GRACE, ECOSTRESS, MODIS, GEDI), use,
grid name, resolution (meters or degrees), cell centre, row and column, tile,
selection description, number of sample points, upstream resampling text and the
fixed statement `resampling: none_added` in words ("we did not resample these
data; each keeps its own grid"). A **Show on map** switch draws each product's
cell footprint and sample points.
General for all tabs: every chart has a source line (product, resolution, date
range), a text alternative, a "How to read this" button opening the glossary card
for its main term (NDVI, ET, soil moisture anomaly, frost risk, water balance), and
the satellite-vs-ground note (C21): "Satellites see large areas often; ground
measurements are exact at one point. Together they are better: a soil test or a
rain gauge improves this".
Tests: each tab with data, with `unavailable` for each reason, with failed; the
polling of a request completing; a11y.

### S14. What-if (route `/plans/:id/what-if`)

Purpose: test your own assumptions (C31): "what if it rains 20 % less".
Controls: **Rain change** slider -50 to +50 % (integer, step 1), **Temperature
change** slider -3 to +6 degrees C (step 0.1), **Sowing date shift** slider -45 to
+45 days (integer); quick presets (Drier -20 % and +2 degrees C; Hotter +3
degrees C; Wetter +20 %; Earlier sowing -14 days; Later sowing +14 days); a live
sentence of the assumption; **Run this test** (disabled until at least one value
is not zero; `POST /plans/{id}/what-if` with `{what_if:{rainfall_change_percent,
temperature_change_c, sowing_shift_days}}` and an `Idempotency-Key`). The result
is a **new plan** (poll as S10), then the page shows **Before and after**: the
parent (from BG-3 `parentPlanId`, else the plan we came from) and the what-if plan
side by side: per strategy rank change, loss change per dimension, and the
`whatIf` block (label, `notAForecast`, applied values, requested vs effective
sowing range, `appliedTo.futureModelWorlds`: applied, not_prepared, incomplete,
not_needed, each explained). The banner "This is a what-if test, not a forecast"
is permanent on the page and on the resulting plan.
States: a plan whose first sowing date has passed cannot be re-run (the server
refuses): explain and offer "Start a new comparison from this field".
Tests: validation limits, 0.1 steps, the JSON sent, the comparison view.

### S15. Crops: picker and detail (routes `/crops`, `/crops/:id`; the picker is also a shared component)

**Picker (shared `CropPicker`).** A search field (matches `name`, every
`localNames[].name` in en, fr, ar, ary, `scientificName`, with Arabic-script
normalisation: strip diacritics and tatweel, unify alef forms), filters (family,
and model type from BG-4), a list of rows (colour swatch, primary name in the
display language, the other languages' names inline smaller, scientific name,
family chip, the count of varieties), recent crops first, keyboard navigation,
virtualised list (246 rows). Name display language setting (Crop names: English,
Français, العربية, Darija) in S19 and in a small control at the top of the
picker: the primary name uses the chosen language when present, falling back to
French then English; the other available names are shown beside it; names with
`confidence: low` show a small "unconfirmed name" mark with a tooltip; a name
`preferred: true` is shown before others of that language.
**Crop detail (BG-4).** Names in four languages (with unconfirmed marks), family,
scientific name, type, calendar and duration ranges with sources, listed problems
(BG-5) with names, rotation rules (predecessor families, return interval),
benefits (nitrogen fixing, forage, deep rooting, drought tolerance, soil effects)
with their evidence class and citations, varieties list, and the "Used in" count
of the user's fields' history. Everything is from the endpoint; a missing fact is
"no data" with the reason. The **explanations** of nitrogen-fixing, cover and
deep-rooting crops (C28) come from the glossary or the catalog `limitations`
text, not from the interface copy.
Tests: search in each language, Arabic normalisation, display fallbacks,
virtualisation, detail with and without data.

### S16. Glossary (route `/glossary`)

Controls: search box (term and meaning); group chips (Terms first, then the other
groups: reason codes, strategy notes, effects, statuses, evidence, scores,
errors); entries as cards (term, meaning, code in small mono text for advisers);
deep link `/glossary#code`; the provenance line from `provenance.text`
("Written by an AI model and not reviewed; tell us what is wrong" until
`human_reviewed`). Data: `GET /glossary?lang=fr|en` with ETag. Every
`GlossaryTerm` in the app opens the same card in a popover with a "See all"
link here. Tests: search, groups, ETag 304, language switch, deep links.

### S17. Photo check (route `/photo-check`; also a button in S05 History and S12)

Purpose: check a leaf or plant photo against the crop's listed problems; never a
diagnosis.
Availability: `GET /crop-health/status`: `available: false` with
`AI_NOT_CONFIGURED` shows the whole screen's explanation "The photo check is not
switched on yet" and nothing else is hidden.
Controls: **Crop** (CropPicker; must be a crop with listed problems: otherwise
`CROP_NOT_COVERED` is explained), **Photo** (PhotoPicker: take or choose; JPEG,
PNG or WebP; at most 5 MB shown; preview with remove; the browser reads it
client-side, rejects other types and over 7,000,000 base64 characters before
sending), **Consent** checkbox with the text "I agree to send this photo to an AI
provider to check it. GPS and device information are removed. I understand this is
a possibility check, not a diagnosis." (required: `consent: true`), **Check
photo** (`POST /crop-health/photo` `{crop_id, media_type, image_base64, consent:
true, language: "fr"|"en"}`).
Result display: `image_quality` (usable or poor: if poor, advice to retake in
daylight, close, in focus), `assessment` in words (no visible problem among the N
checked problems; possibly affected; not sure), up to 3 `candidates` (the issue
name from BG-5 using `issue_id`, and `what_is_visible`), `note`, the server
`notice` verbatim, the line when `text_removed` ("the server removed text that
looked like treatment advice"), `checked_issue_count` ("checked against N listed
problems"), and the fixed reminder "see a local specialist before acting". A
button **Add to my field's health notes** copies a candidate into S07 as a
farmer report (never confirmed).
Errors in words: `PHOTO_INVALID`, `PHOTO_TOO_LARGE`, `PHOTO_TOO_SMALL`,
`PHOTO_UNREADABLE`, `CROP_NOT_COVERED`, `AI_DAILY_LIMIT` (try tomorrow),
`AI_BUSY`, `AI_UNAVAILABLE`, `AI_DECLINED`, `AI_REQUEST_REJECTED`.
The photo is never stored by the browser (memory only) and is cleared after the
result.
Tests: with the fake provider used by backend tests, every outcome; consent
required; size and type rejection; no leakage of base64 into logs or URLs.

### S18. Plans (route `/plans`)

List (BG-2 summary): field name, status chip, current crops as a mini strip,
horizon, date, what-if flag with link to its parent, the top strategy's crops
when completed. Controls: filter (All, Done, In progress, Failed, What-if),
search by field name or label, sort (newest, oldest), open, **Delete** (confirm),
**Load more** (cursor). Empty state "No comparisons yet: pick a field and compare
rotations". Guest owners see a banner "Sign in to keep these on all your
devices" with the claim button per plan (S19). Expiry: show `expiresAt` as "kept
until" and warn within 7 days.

### S19. Account and settings (route `/account`)

Sections: **Profile** (name, email, verified, member since, session ends: from
`GET /account`); **Language** (Interface: Français / English; Crop names:
English / Français / العربية / Darija / "Show all", default Français and all);
**Units** (hectares and metres: fixed, shown for information); **Saved on this
device** (what is stored: language, first-run flag, guest token in this tab;
**Clear this device's data** button that signs out the guest, clears storage and
caches after confirm); **Your plans** (claim guest plans into the account: list
with checkboxes, **Move to my account** calls `POST /plans/{id}/claim` per plan;
for fields see BG-7); **Sign out**; **Delete my account** (confirm dialog that
explains the email confirmation; calls `POST /api/auth/delete-user` with
`callbackURL = origin + "/?auth=deleted"`); **Privacy** summary (what we send
where: the farmer's field to our server only; NASA, Copernicus and SoilGrids
receive coordinates rounded to their cell; photos to an AI provider only with
consent; no analytics; no advertising).
Tests: language persistence and live switch; claim (cookie plus bearer); delete
flow with the mail harness.

### S20. About, sources and licences (route `/about`)

Static content generated at build time from `THIRD_PARTY_NOTICES.md`,
`docs/REFERENCES.md`, `LICENSE`, `NOTICE` into `about.generated.json` by
`tooling/web/build-about.mjs` (a test fails if the generated file is stale):
**What this is** (the one-paragraph purpose and the reminder); **NASA data we use**
(a table: product, provider, resolution, how it is used, link to its DOI or
landing page, from `product.*` glossary and the references file); **Other open
data** (SoilGrids ISRIC CC BY 4.0, NEX-GDDP-CMIP6 attribution, OpenStreetMap ODbL
for the basemap, Copernicus Sentinel-2 for field detection, fonts and icons);
**How we use AI** (the disclosure text for NASA Space Apps: which parts of the
code, the research and the translations were written with AI tools; that crop
rules include knowledge recalled by an AI model and labelled as such; that the
photo check and the written explanation use an AI model and are not
diagnoses); **Open source** (our licence, repository link when public, third
party licences list); **Limits** (not expert reviewed; calibrations; regional
vs field data; Morocco catalog coverage with the catalog version and the counts
of crops with sourced vs recalled rules from the options endpoint); **Version**
(app build, API `capabilities.version`, glossary version, catalog id, version and
sha256).

### S21. Demo (route `/demo`)

Purpose: let a judge or a first-time visitor see the whole product working at once
on real data. `POST /api/v1/demo/session` (BG-6) returns a guest session whose
owner already has the Tadla pilot field with its outline, history, soil, the
completed NASA extractions and a completed plan; the app stores the token and
opens the field with a one-time coach mark strip (four short steps: your field,
the comparison, the evidence, a what-if) that can be dismissed and is never shown
again. The demo is a normal guest account: all controls work, nothing is
simulated, and creating new requests behaves as in production (including NASA
requests taking hours). A **Reset the demo** button in S19 deletes the guest data
and creates a fresh copy. Unavailable (and the button hidden) when BG-6 is not
deployed.
Tests: clean database, demo session, every S11 to S13 tab populated.

---

## PART 7. BEHAVIOURS THAT APPLY EVERYWHERE

### 7.1 Rendering any code from the backend

Every code shown to a person (reason code, strategy note code, status, stage,
effect, evidence class, error code, score name, term) is looked up in the
glossary by `group` and `code` and shown as `term` (short) or `meaning` (long).
If the glossary has no entry the interface shows the generic sentence "Details
are not available for this item" and in development builds throws a visible
warning; a test iterates every code in the contracts (`rotationReasonCodes`,
`futureClimateReasons`, `nearTermReasons`, `ConstraintReason.code`, strategy note
codes, error codes, statuses, stages) and fails when any lacks an entry in fr
and en. Notes with `facts` (for example `BENEFIT_NITROGEN_FIXING_CROP`) are
rendered by the message file with the facts as ICU arguments, falling back to the
note's English `text` only if no message exists (and then the test fails).
Crop ids inside facts and notes are replaced by crop names (7.2).

### 7.2 Crop names

Input: `catalog/options` `crops[].name` (English), `localNames[]` (language
`fr|ar|ary|zgh|en`, `name`, optional `confidence`, optional `preferred`),
`scientificName`, `cultivars[]` with their own `localNames`.
Display setting `cropNameMode`: `fr` (default), `en`, `ar`, `ary`, or `all`.
Rules: primary name = the preferred name of the chosen language, else the first
name of that language, else (for `ary`) the Arabic name marked "Arabic", else
French, else English. Secondary names = the other languages shown inline after a
thin separator in a smaller size, at most two at once on phones, all on desktop
detail. Arabic and Darija strings are wrapped in `<bdi dir="auto" lang="ar">`
with the Arabic font; never change the surrounding layout direction. `confidence:
low` shows a dotted underline and a tooltip "unconfirmed name". Unknown ids (a
crop not in this catalog version) show the id as plain text with a "not in the
catalog" tooltip and never crash the screen. The catalog version used to name
crops in a result is `result.catalog.version`, fetched via
`/catalog/options/{id}/{version}` and cached forever (immutable).

### 7.3 Numbers, units, dates

All numbers go through `format.ts` (`Intl.NumberFormat` for the interface
language; Western digits in both languages). Units are part of the message:
hectares `ha`, millimetres `mm`, degrees Celsius `°C`, percent `%`, tonnes per
hectare `t/ha`, megagrams per hectare `Mg/ha`, centimetres of water `cm`. Never a
bare number. Losses are 0 to 1 in the API; the interface shows them as "points"
(0 to 100: `Math.round(loss * 100)`) with the label "lower is better"; deltas as
"8 points better" or "5 points worse". Coordinates show two decimals in
displays and are never placed in URLs, logs or analytics. Dates: calendar dates
as "2 April 2026" / "2 avril 2026"; month-day windows as "25 May to 16 Nov";
timestamps as local date and time. The interface never converts a calendar date
through a time zone.

### 7.4 The evidence chip (one function, `evidenceKind(evidence)`)

Input `strategy.evidence` (`extracted`, `double_checked`, `expert_reviewed`,
`model_recall`) or `result.evidence.rulesUsed` (`double_checked`,
`expert_reviewed`, `model_recall`).
`sourced` = `double_checked + expert_reviewed`. Output:
`mixed` if `model_recall > 0` and `sourced > 0`; `recalled` if `model_recall > 0`
and `sourced = 0`; `sourced` if `sourced > 0` and `model_recall = 0`; `missing`
if all zero. `extracted` alone (a quote found, not yet double-checked) is
"quote found, not double-checked" and counts as sourced-but-unchecked: show it in
the counts line, not as `sourced`. An `expert_reviewed > 0` adds a badge "expert
reviewed". The chip text: "Sourced", "Mixed: sourced and AI-recalled",
"AI-recalled: check locally", "No evidence". Each chip opens the evidence section
of S12. Tests cover the truth table.

### 7.5 Uncertainty language

Never "will", "forecast" or "prediction" for a model result: use "model
projection" and "scenario". Every projection block carries `notAForecast` text
(fixed message). Ranges are shown as ranges. A figure computed with fewer than
the stated minimum analogs is marked "few comparable years". Calibration labels
for yields and soil carbon are always visible beside the figure.

### 7.6 Capability handling

The shell and every control read the capabilities object (3.3). Off features
render one honest sentence, not a missing screen: observations off: "NASA data
requests are not switched on in this installation"; auth off: accounts section
says so; weather off: the temperature chart is replaced by that sentence;
photo check off: S17 explains; detection off: S04 modes 2 to 5 only.

### 7.7 Accessibility (checked by tests, not by promise)

WCAG 2.2 AA: contrast per 3b.1; focus visible; all controls keyboard-operable
(map painting has a keyboard alternative: arrow keys move a cursor cell, Space
toggles it); targets at least 44 px on touch (48 px for primary actions); every
chart has a text alternative; no information by colour alone; reduced-motion
honoured; language attributes set (`lang` on the root, on every Arabic run);
form errors tied to inputs with `aria-describedby`; live regions announce
progress changes (plan stage, upload) politely; dialogs trap focus and restore
it; the bottom sheet is operable without dragging (buttons for detents).

### 7.8 Copy rules

Plain words first, term second ("Low greenness (NDVI)"). No jargon without a
glossary link. No exclamation marks. No emojis. No promises ("will increase your
income"). No treatment advice, doses or product names anywhere. Reminders are
fixed sentences from `strategies.reminders` and the shell message. French and
English are written by a person who reads both; until a native speaker has
reviewed them a build report lists unreviewed keys and the About page says so.

---

## PART 8. TESTING AND DEFINITION OF DONE

### 8.1 Test layers

1. **Unit (Jest, `pnpm test:unit`)** next to the code: formatters, `evidenceKind`,
   `cropColor` uniqueness, crop search and Arabic normalisation, `buildPlanRequest`
   golden JSON (a table of at least 12 builder states with exact expected JSON,
   each also parsed by `planRequestV2Schema`), every contract schema message has a
   translation, painting geometry (union, hole fill, simplification keeps area
   within 2 percent, vertices at most 200, validity per `fieldBoundarySchema`),
   `SeriesChart` axis non-overlap, polling state machines, owner switching.
2. **Component tests** for every component state in 3b.3 with the testing library
   and axe.
3. **Integration (real PostgreSQL via the existing disposable containers and the
   fake providers used by backend tests)**: the API layer against the real server
   for each endpoint family.
4. **End to end (Playwright, `pnpm test:e2e`) in fr and en at 390, 768, 1024 and
   1440 px**: the flows listed in 8.3, run against the real built server and web
   app with the test mailbox and the fake NASA providers.
5. **Visual regression** snapshots of the key screens (S03, S04 each mode, S05,
   S09 step 5, S11, S12, S13 each tab) per width, reviewed by hand when changed.
6. **Accessibility**: axe in every e2e step; a keyboard-only run of the core flow.
7. **Performance**: Lighthouse CI on S03, S11, S13 with the budgets of 3.7; the
   painting frame-time test (60 fps at 2,000 cells in a headless profile).
8. **Contract tests**: the generated client types match `docs/api/openapi.json`;
   every route in the OpenAPI document is used by at least one screen or listed
   in an explicit "not used by the web app" table with a reason.

### 8.2 The DOM scan (runs in every e2e step)

Fails the test when the visible text or any attribute contains: `yyyy`,
`undefined`, `NaN`, `null`, `[object`, `{{`, `}}`, an UPPER_SNAKE_CASE token of 6
or more characters that is not inside an element marked `data-code`, a message
key pattern (`screen.control`), a raw ISO timestamp, a UUID, "Lorem", "TODO",
"mock", or a currency symbol with a number (no prices are shown unless BG-9 is
live and then only through the income component).

### 8.3 The flows every release must pass (fr and en)

F-1 first run to first field by tapping a detected field; F-2 first field by
"Outline it for me"; F-3 paint cells; F-4 draw; F-5 upload; F-6 add history,
soil, water, health; F-7 build and send a plan; F-8 watch progress; F-9 read the
comparison and open each strategy; F-10 each evidence tab, asking NASA and
completing; F-11 what-if; F-12 crop picker in four languages; F-13 glossary and
inline terms; F-14 photo check; F-15 sign up, verify, sign in, claim, sign out;
F-16 delete a plan, a field, the account; F-17 offline read and queued edit;
F-18 the demo; F-19 every error state in 4.5; F-20 language switch mid-flow.

### 8.4 Definition of done per slice and per release

Per slice: Part 0.4 plus its rows in Part 1 demonstrably met, its flows green,
its notes file written. Per release (the submission build): all slices done;
`pnpm verify` green on GitHub; a clean clone builds and runs from the README; the
Part 1 matrix has a passing test for every ID; no open item in Part 5 that a
screen depends on; the About page generated and current; the challenge Resources
and judging guides re-read and this plan updated.

---

## PART 9. BUILD ORDER, GATES AND TASKS FOR CODEX

### 9.1 Gates (nothing proceeds past a gate without the named approval)

G1 the user approves the design system page (`/design`) and the S04, S11 and
S13 first renders in the browser; G2 the user approves the French and English
copy for the first-run, plan builder and results screens; G3 the user tests the
demo with real data on a phone; G4 the user's decision on the prior-work rule
with the organisers (outside the code); G5 re-read of the challenge guides on 13
November.

### 9.2 Slices (each is a Codex task with its own branch and notes file)

| Slice | Scope                                                                                                                                      | Needs first | Output                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------- |
| B0    | BG-1, BG-2, BG-3, BG-10, BG-14                                                                                                             | none        | endpoints, tests, regenerated OpenAPI                         |
| B1    | BG-4, BG-5                                                                                                                                 | none        | crop detail endpoints                                         |
| B2    | BG-13 (detection service, tiles, outline, accuracy report)                                                                                 | none        | the detector; **largest backend task, start first**           |
| B3    | BG-6, BG-7, BG-8, BG-11, BG-12, BG-15                                                                                                      | B0          | demo, claims, field v2, export, basemap, operation vocabulary |
| F0    | design system and `/design` page, tokens, fonts, icons, primitives, contrast script                                                        | none        | gate G1                                                       |
| F1    | app shell, router, providers, i18n skeleton, API client with generated types, owner/session, capabilities, boot, error states, offline bar | F0          | S00, S01, shell                                               |
| F2    | map component: MapLibre, GIBS layers, date stepper probing, compare slider, smooth zoom, layer popover, field outlines                     | F1          | map home S03                                                  |
| F3    | S04 modes 2 to 5 (paint, draw, upload, pin), geometry library, save flow                                                                   | F2          | fields can be created                                         |
| F4    | S04 mode 1 (detection UI)                                                                                                                  | F3, B2      | tap to select and outline                                     |
| F5    | S05 to S07 (field detail, history, inputs), crop picker component                                                                          | F3, B1      |                                                               |
| F6    | S08, S09, S10 (priorities, builder, progress) with `buildPlanRequest`                                                                      | F5          | plans can be sent                                             |
| F7    | S11, S12 (results, strategy detail), evidence chip, glossary rendering                                                                     | F6          |                                                               |
| F8    | S13 all tabs and charts, NASA requests and polling                                                                                         | F7          |                                                               |
| F9    | S14, S15, S16, S17                                                                                                                         | F7, B1      |                                                               |
| F10   | S02, S18, S19, S20, S21                                                                                                                    | F6, B3      |                                                               |
| F11   | offline, performance, accessibility, visual regression, translations report                                                                | F1 to F10   | gate G2, G3                                                   |
| F12   | hardening: DOM scan everywhere, the 20 flows, clean clone, docs                                                                            | all         | release                                                       |

Backend and frontend slices run in parallel where "Needs first" allows. Codex
runs at most two tasks at a time. Claude reviews each branch (diff, tests, CI,
the slice's Part 1 rows), runs the full local gates, and merges.

### 9.3 Prompt skeleton for every Codex task

"Branch `codex/<slice>` from `field-shift`. Read `docs/steps/15/FRONTEND_MASTER_
PLAN.md` fully, then `AGENTS.md`, `CLAUDE.md`, `frontend-plan.md`,
`onesoil-inspection.md`. Implement exactly slice `<id>` of Part 9.2 with the
screens and backend tasks it names, following Part 6 control by control. No
mocks or placeholders in production code; every control calls the real API per
Part 4. Add the tests of Part 8 for what you build. Run the gates in 0.3 with real
exit codes. You cannot commit: leave the work uncommitted, write
`docs/steps/15/<slice>-notes.md` (what is done per screen and per control,
what is not, commands and exit codes, deviations from the plan with the reason,
proposed DECISIONS and PROGRESS text). If something in the plan is impossible or
contradicts a contract, stop that item, record it, and continue with the rest."

### 9.4 Review checklist Claude applies to every slice

Every control in the slice's Part 6 section exists and is wired (grep for the
endpoint, run the e2e); every state exists; fr and en complete; axe clean; DOM
scan clean; four widths; budgets; no new dependency without a notices entry; no
hard-coded strings or colours; no `any`; no network call outside our origin and
NASA GIBS tiles (a test asserts the list of hosts requested); contract types
generated, not hand-written; notes file honest.

---

## PART 10. OPEN DECISIONS AND KNOWN RISKS

1. **Prior work (G4).** The FAQ forbids starting before 14 November 2026; the
   user must settle this with the organisers. If the answer is no, slices
   compress into the event weekend and the cut order is: B3 items except BG-6,
   F11 offline, F10 account screens beyond sign in, S15 detail, S17.
2. **Detection quality (BG-13).** Unknown until measured on Moroccan fields; the
   accuracy report decides whether the feature is shown as beta. Licence and
   coverage of the FTW model are to be verified from the source, not assumed.
3. **HLS imagery gaps.** Many days have no image for a tile and some are cloudy;
   the date stepper lists real dates only and the interface says so.
4. **Translations are machine-written until reviewed** (interface, glossary,
   crop names); the interface says so.
5. **Income and market data are sparse** until BG-9; the interface shows honest
   gaps.
6. **Performance of NASA requests**: AppEEARS tasks take hours; the demo uses
   stored real data.
7. **Cost of tiles and storage**: GIBS is free; BG-12 adds about 1.5 GB of static
   data; detection results are cached in Postgres.
8. **The OneSoil reference** is a pattern to match, not code or assets to copy.

---

## APPENDIX A. API REFERENCE (generated from `docs/api/openapi.json` on 2026-11-10; regenerate with the script in `tooling/web/`)

| Method and path                                        | Operation                | Needs                               | Parameters                               | Body                         | Success                                                          | Errors                                                                                                  |
| ------------------------------------------------------ | ------------------------ | ----------------------------------- | ---------------------------------------- | ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health/live`                              | getLive                  | -                                   | -                                        | -                            | 200 Live                                                         |                                                                                                         |
| `GET /api/v1/health/ready`                             | getReady                 | -                                   | -                                        | -                            | 200 Health                                                       | 503 Health                                                                                              |
| `GET /api/v1/glossary`                                 | getGlossary              | -                                   | lang (query), group (query)              | -                            | 200 GlossaryResponse, 304                                        | 400 ErrorBody                                                                                           |
| `GET /api/v1/openapi.json`                             | getOpenApi               | -                                   | -                                        | -                            | 200, 304                                                         |                                                                                                         |
| `GET /api/v1/auth/capabilities`                        | getAuthCapabilities      | AUTH_ENABLED                        | -                                        | -                            | 200 AuthCapabilities                                             |                                                                                                         |
| `GET /api/v1/account`                                  | getAccount               | AUTH_ENABLED                        | -                                        | -                            | 200 Account                                                      | 400 ErrorBody, 401 ErrorBody, 429 ErrorBody, 503 ErrorBody                                              |
| `GET /api/v1/catalog/options`                          | getCatalogOptions        | PLANS_ENABLED                       | -                                        | -                            | 200 CatalogOptions                                               | 400 ErrorBody, 429 ErrorBody, 503 ErrorBody                                                             |
| `GET /api/v1/catalog/options/{catalogId}/{version}`    | getCatalogOptionsVersion | PLANS_ENABLED                       | catalogId (path), version (path)         | -                            | 200 CatalogOptions                                               | 400 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                                              |
| `GET /api/v1/weather/capabilities`                     | getWeatherCapabilities   | WEATHER_ENABLED                     | -                                        | -                            | 200 WeatherCapabilities                                          | 400 ErrorBody                                                                                           |
| `POST /api/v1/weather/query`                           | queryWeather             | WEATHER_ENABLED                     | -                                        | WeatherRequest               | 200 WeatherResponse                                              | 400 ErrorBody, 403 ErrorBody, 429 ErrorBody, 502 ErrorBody, 503 ErrorBody, 504 ErrorBody                |
| `POST /api/v1/plan-sessions`                           | createPlanSession        | PLANS_ENABLED                       | -                                        | PlanSessionRequest           | 201 OwnerSession                                                 | 400 ErrorBody, 429 ErrorBody, 503 ErrorBody                                                             |
| `DELETE /api/v1/plan-sessions/current`                 | revokePlanSession        | PLANS_ENABLED                       | -                                        | -                            | 204                                                              | 401 ErrorBody, 429 ErrorBody, 503 ErrorBody                                                             |
| `POST /api/v1/plans`                                   | submitPlan               | PLANS_ENABLED                       | Idempotency-Key (header)                 | PlanRequestV2 or PlanRequest | 202 PlanSubmitted                                                | 400 ErrorBody, 401 ErrorBody, 409 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/plans`                                    | listPlans                | PLANS_ENABLED, AUTH_ENABLED         | cursor (query), limit (query)            | -                            | 200 PlanList                                                     | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/plans/{id}`                               | getPlan                  | PLANS_ENABLED                       | id (path)                                | -                            | 200 RotationPlanningStatus or PlanningStatus or PlanIntakeStatus | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `DELETE /api/v1/plans/{id}`                            | deletePlan               | PLANS_ENABLED                       | id (path)                                | -                            | 204                                                              | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `POST /api/v1/plans/{id}/what-if`                      | submitWhatIf             | PLANS_ENABLED                       | id (path), Idempotency-Key (header)      | PlanWhatIfRequest            | 202 PlanSubmitted                                                | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 409 ErrorBody, 429 ErrorBody, 503 ErrorBody                |
| `POST /api/v1/plans/{id}/claim`                        | claimPlan                | PLANS_ENABLED, AUTH_ENABLED         | id (path)                                | PlanClaimRequest             | 200 PlanClaimed                                                  | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 409 ErrorBody, 429 ErrorBody, 503 ErrorBody                |
| `POST /api/v1/plans/{id}/explanation`                  | explainPlan              | PLANS_ENABLED                       | id (path)                                | PlanExplanationRequest       | 200 PlanExplanation                                              | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 409 ErrorBody, 429 ErrorBody, 502 ErrorBody, 503 ErrorBody |
| `GET /api/v1/crop-health/status`                       | getCropHealthStatus      | PLANS_ENABLED                       | -                                        | -                            | 200 CropHealthStatus                                             |                                                                                                         |
| `POST /api/v1/crop-health/photo`                       | checkCropPhoto           | PLANS_ENABLED                       | -                                        | CropPhotoRequest             | 200 CropPhotoResult                                              | 400 ErrorBody, 401 ErrorBody, 422 ErrorBody, 429 ErrorBody, 502 ErrorBody, 503 ErrorBody                |
| `POST /api/v1/fields`                                  | createField              | PLANS_ENABLED                       | -                                        | FieldProfile                 | 201 FieldRecord                                                  | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields`                                   | listFields               | PLANS_ENABLED                       | cursor (query), limit (query)            | -                            | 200 FieldPage                                                    | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `POST /api/v1/fields-with-history`                     | createFieldWithHistory   | PLANS_ENABLED                       | -                                        | FieldWithHistoryRequest      | 201 FieldRecord                                                  | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}`                              | getField                 | PLANS_ENABLED                       | id (path)                                | -                            | 200 FieldRecord                                                  | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `PUT /api/v1/fields/{id}`                              | updateField              | PLANS_ENABLED                       | id (path)                                | FieldUpdateRequest           | 200 FieldRecord                                                  | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 409 ErrorBody, 429 ErrorBody, 503 ErrorBody                |
| `DELETE /api/v1/fields/{id}`                           | deleteField              | PLANS_ENABLED                       | id (path)                                | -                            | 204                                                              | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/boundary`                     | getFieldBoundary         | PLANS_ENABLED                       | id (path)                                | -                            | 200 BoundaryEnvelope                                             | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `PUT /api/v1/fields/{id}/boundary`                     | saveFieldBoundary        | PLANS_ENABLED                       | id (path)                                | BoundaryUpdateRequest        | 200 BoundaryRecord                                               | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 409 ErrorBody, 429 ErrorBody, 503 ErrorBody                |
| `DELETE /api/v1/fields/{id}/boundary`                  | deleteFieldBoundary      | PLANS_ENABLED                       | id (path)                                | -                            | 204                                                              | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/history`                      | listFieldHistory         | PLANS_ENABLED                       | id (path), cursor (query), limit (query) | -                            | 200 HistoryPage                                                  | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `POST /api/v1/fields/{id}/history`                     | createFieldHistoryEntry  | PLANS_ENABLED                       | id (path)                                | CropHistoryEntry             | 201 HistoryRecord                                                | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `PUT /api/v1/fields/{id}/history/{entryId}`            | updateFieldHistoryEntry  | PLANS_ENABLED                       | id (path), entryId (path)                | HistoryUpdateRequest         | 200 HistoryRecord                                                | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 409 ErrorBody, 429 ErrorBody, 503 ErrorBody                |
| `DELETE /api/v1/fields/{id}/history/{entryId}`         | deleteFieldHistoryEntry  | PLANS_ENABLED                       | id (path), entryId (path)                | -                            | 204                                                              | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `POST /api/v1/fields/{id}/observations`                | requestObservation       | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | ObservationRequest           | 202 ObservationStatus                                            | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/observations`                 | listObservations         | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | -                            | 200 ObservationList                                              | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/observations/{observationId}` | getObservation           | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path), observationId (path)          | -                            | 200 ObservationStatus                                            | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/analysis/vegetation`          | getVegetationAnalysis    | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | -                            | 200 VegetationAnalysisResponse                                   | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/analysis/rain`                | getRainAnalysis          | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | -                            | 200 RainSeriesResponse                                           | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `POST /api/v1/fields/{id}/extractions`                 | requestExtraction        | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | ExtractionRequest            | 202 ExtractionStatus                                             | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/extractions`                  | listExtractions          | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | -                            | 200 ExtractionList                                               | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/extractions/{extractionId}`   | getExtraction            | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path), extractionId (path)           | -                            | 200 ExtractionStatus                                             | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/analysis/vegetation-history`  | getVegetationHistory     | PLANS_ENABLED, OBSERVATIONS_ENABLED | id (path)                                | -                            | 200 VegetationHistoryResponse                                    | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/canopy-biomass`               | getCanopyBiomass         | PLANS_ENABLED                       | id (path)                                | -                            | 200 CanopyBiomassResponse                                        | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |
| `GET /api/v1/fields/{id}/water-storage`                | getWaterStorage          | PLANS_ENABLED                       | id (path)                                | -                            | 200 WaterStorageResponse                                         | 400 ErrorBody, 401 ErrorBody, 404 ErrorBody, 429 ErrorBody, 503 ErrorBody                               |

## APPENDIX B. ENUMERATIONS THE INTERFACE MUST HANDLE (from the contracts and the glossary, 2026-11-10)

### glossary group `reason_code` (126)

`CROP_NOT_IN_CATALOG`, `CATALOG_GAP`, `CROP_EXCLUDED_BY_FARMER`, `FARMER_EXCLUDED`, `MODEL_TYPE_UNSUPPORTED`, `REGION_UNRESOLVED`, `REGION_NOT_IN_CATALOG`, `REGION_BOUNDARY_UNAVAILABLE`, `CROP_NOT_APPLICABLE_IN_REGION`, `NO_APPLICABLE_EVIDENCE`, `PROFILE_REVIEW_PENDING`, `FARMING_SYSTEM_UNRESOLVED`, `PRODUCTION_SYSTEM_UNRESOLVED`, `SYSTEM_NOT_SUPPORTED`, `CULTIVAR_NOT_IN_CATALOG`, `CULTIVAR_UNRESOLVED`, `RULE_NOT_VERIFIED`, `RULE_NOT_REVIEWED`, `RULE_NOT_APPLICABLE`, `RULE_OUT_OF_SCOPE`, `RULE_SCOPE_UNSPECIFIED`, `RULE_CONDITIONS_UNRESOLVED`, `RULE_REFERENCE_ONLY`, `RULE_STAGE_TIMING_UNKNOWN`, `RULE_MEASUREMENT_UNSUPPORTED`, `CALENDAR_EVIDENCE_UNAVAILABLE`, `DURATION_EVIDENCE_UNAVAILABLE`, `DURATION_ENVELOPE`, `CALENDAR_OUTSIDE_FIRST_RANGE`, `FIRST_WINDOW_OUTSIDE_RANGE`, `NO_WINDOW_BEFORE_HORIZON`, `SECOND_CALENDAR_UNAVAILABLE`, `NON_OVERLAPPING_CYCLES`, `SEARCH_HORIZON_EXCEEDED`, `SEARCH_PRUNED`, `SEARCH_TRUNCATED`, `NOT_EXPERT_REVIEWED`, `EXPOSURE_HEAT`, `EXPOSURE_COLD`, `EXPOSURE_RAIN_DEFICIT`, `EXPOSURE_UNAVAILABLE`, `TERRAIN_CONTEXT_UNRANKED`, `EROSION_FACTORS_MISSING`, `INFILTRATION_DRAINAGE_UNKNOWN`, `EQUIPMENT_DATA_UNAVAILABLE`, `MARKET_ACCESS_DATA_UNAVAILABLE`, `INCOME_DATA_UNAVAILABLE`, `SOIL_UNKNOWN`, `SOIL_KNOWLEDGE_UNAVAILABLE`, `SOIL_METRIC_UNAVAILABLE`, `SOIL_DATE_UNKNOWN`, `SOIL_METHOD_MISMATCH`, `SOIL_PH_OUTSIDE_RANGE`, `SOIL_PH_WITHIN_RANGE`, `SOIL_LIMIT_FAILED`, `SOIL_LIMIT_WARNING`, `SOIL_LIMIT_PASSED`, `SOIL_CHECK_UNIMPLEMENTED`, `SOIL_ESTIMATE_USED`, `SOIL_ESTIMATE_OUTSIDE`, `SOIL_ESTIMATE_UNAVAILABLE`, `SOIL_PREFERENCES_UNEVEN`, `HISTORY_UNKNOWN`, `HISTORY_PARTIAL`, `HISTORY_DATES_UNKNOWN`, `HISTORY_COVERAGE_UNESTABLISHED`, `PREVIOUS_CROP_UNRESOLVED`, `ROTATION_KNOWLEDGE_UNAVAILABLE`, `RETURN_INTERVAL_UNESTABLISHED`, `RETURN_INTERVAL_VIOLATION`, `RETURN_INTERVAL_SATISFIED`, `PREDECESSOR_FAMILY_PROHIBITED`, `PREDECESSOR_FAMILY_ALLOWED`, `PREDECESSOR_PREFERENCE_UNMET`, `HEALTH_KNOWLEDGE_UNAVAILABLE`, `HEALTH_HISTORY_UNKNOWN`, `HEALTH_HISTORY_UNLINKED`, `HEALTH_OBSERVATION_UNSUPPORTED`, `HEALTH_OBSERVATION_UNVERIFIED`, `HEALTH_REPORT_UNCONFIRMED`, `HEALTH_ISSUE_NOT_IN_CATALOG`, `HEALTH_BREAK_VIOLATION`, `HEALTH_BREAK_SATISFIED`, `WATER_UNKNOWN`, `WATER_REPORTED_NOT_QUANTIFIED`, `IRRIGATION_ADEQUACY_UNKNOWN`, `RAINFED_ARID_RISK`, `WATER_CLASS_UNAVAILABLE`, `WATER_METHOD_INCOMPATIBLE`, `WATER_CLASS_COMPARISON`, `WEATHER_NOT_EVALUATED`, `WEATHER_COVERAGE_INCOMPLETE`, `LEAP_BOUNDARY_UNAVAILABLE`, `TEMPERATURE_EVIDENCE_UNAVAILABLE`, `TEMPERATURE_RULE_UNAVAILABLE`, `TEMPERATURE_RULE_UNSUPPORTED`, `TEMPERATURE_RULE_UNREVIEWED`, `TEMPERATURE_RULE_AMBIGUOUS`, `TEMPERATURE_EXPOSURE`, `CLIMATE_ANALOGS_INSUFFICIENT`, `INSUFFICIENT_COMPLETE_ANALOGS`, `INSUFFICIENT_PERIOD_ANALOGS`, `INSUFFICIENT_SHARED_ANALOGS`, `CLIMATE_CHECKS_DIFFER`, `FUTURE_CLIMATE_UNAVAILABLE`, `ROTATION_PROXY_UNAVAILABLE`, `ROTATION_PROXY_COMPARISON`, `CONSTRAINTS_PREVENT_RANKING`, `RANKING_NOT_IMPLEMENTED`, `RANKED_WITH_HEURISTIC_WEIGHTS`, `RANKING_SENSITIVE`, `SINGLE_COMPARABLE_OPTION`, `HISTORICAL_COMPARISON_ONLY`, `CANOPY_BIOMASS_NOT_IMPORTED`, `CANOPY_BIOMASS_OUTSIDE_IMPORT`, `CANOPY_BIOMASS_NO_ESTIMATE_NEARBY`, `CLIMATE_NOT_COMPARED`, `SCENARIO_TILE_NOT_PREPARED`, `SCENARIO_DATA_INCOMPLETE`, `FUTURE_ANALOGS_INSUFFICIENT`, `NEAR_TERM_TILE_NOT_PREPARED`, `NEAR_TERM_DATA_INCOMPLETE`, `NEAR_TERM_ANALOGS_INSUFFICIENT`, `WATER_STORAGE_NOT_IMPORTED`, `WATER_STORAGE_OUTSIDE_IMPORT`, `WATER_STORAGE_SERIES_TOO_SHORT`

### glossary group `strategy_note` (38)

`WHY_RANKED_BY_PRIORITIES`, `WHY_LOWER_LOSS_THAN_CURRENT`, `WHY_NOT_BETTER_THAN_CURRENT`, `WHY_BEST_ON_DIMENSION`, `PRIORITIES_SLIDERS_USED`, `PRIORITIES_CONTEXT_NOT_RANKED`, `EVIDENCE_RULE_SOURCES`, `EVIDENCE_WEATHER`, `EVIDENCE_FUTURE_CLIMATE`, `EVIDENCE_BARE_FIELD_SHARE`, `BENEFIT_NITROGEN_FIXING_CROP`, `BENEFIT_MORE_CROP_FAMILIES`, `BENEFIT_FEWER_SAME_FAMILY_REPEATS`, `BENEFIT_LOWER_WATER_LOSS`, `BENEFIT_LOWER_CLIMATE_LOSS`, `BENEFIT_BETTER_PREDECESSOR_FIT`, `BENEFIT_FEWER_HEALTH_WARNINGS`, `BENEFIT_BETTER_UNDER_FUTURE_CLIMATE`, `BENEFIT_FORAGE_CROP`, `GAP_DIMENSION_NOT_COMPARED`, `GAP_FUTURE_CLIMATE_UNAVAILABLE`, `GAP_NO_MARKET_DATA`, `GAP_EROSION_NOT_ASSESSED`, `GAP_NO_EQUIPMENT_DATA`, `GAP_RECALLED_RULES`, `RISK_LOCAL_REVIEW`, `RISK_RULE_CONDITIONS`, `RISK_RAINFED_ARID`, `RISK_WORSE_UNDER_FUTURE_CLIMATE`, `REMINDER_SUPPORTS_NOT_REPLACES`, `REMINDER_LOCAL_REVIEW`, `REMINDER_RULES_NOT_EXPERT_REVIEWED`, `REMINDER_AI_RECALL`, `BASELINE_NOT_PROVIDED`, `BASELINE_INFERRED_FROM_HISTORY`, `BASELINE_CROP_NOT_SCHEDULABLE`, `BASELINE_NO_FEASIBLE_SCHEDULE`, `BASELINE_STOPPED_BY_RULE`

### glossary group `effect` (6)

`pass`, `condition`, `failure`, `gap`, `deferred`, `info`

### glossary group `status` (61)

`eligible`, `conditional`, `excluded`, `insufficient_evidence`, `comparisons_available`, `no_feasible_rotation`, `schedulable`, `not_in_catalog`, `unsupported_for_plan`, `rejected`, `queued`, `running`, `submitted`, `completed`, `failed`, `awaiting_processing`, `verifying_evidence`, `generating_sequences`, `retrieving_weather`, `calculating`, `complete`, `awaiting_intake`, `verifying_intake`, `intake_complete`, `intake_failed`, `baseline_unavailable`, `insufficient_alternatives`, `scored`, `not_provided`, `not_evaluable`, `farmer_declared`, `inferred_from_history`, `engine_ranked`, `current`, `alternative`, `reviewed`, `pending`, `available`, `ready`, `unavailable`, `none`, `undetermined`, `ok`, `insufficient_history`, `too_few_observations`, `no_distinct_seasonal_signal`, `too_few_dates`, `no_distinct_season`, `no_data`, `similar`, `moderate`, `differs`, `not_measured`, `rising`, `falling`, `no_clear_trend`, `not_computed`, `close`, `partial`, `weak`, `insufficient_overlap`

### glossary group `evidence` (10)

`extracted`, `double_checked`, `expert_reviewed`, `model_recall`, `sourced`, `engineering_judgment`, `reference`, `soft`, `hard`, `synthetic`

### glossary group `score` (9)

`weightedLoss`, `rank`, `climate`, `water`, `soil_health`, `crop_health`, `versusCurrent`, `priorities`, `meanChange`

### glossary group `error` (54)

`INVALID_INPUT`, `UNAUTHORIZED`, `NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `CATALOG_UNAVAILABLE`, `CATALOG_NOT_FOUND`, `STORED_REQUEST_INVALID`, `PLAN_UNAVAILABLE`, `FIELD_UNAVAILABLE`, `AUTH_UNAVAILABLE`, `INVALID_ORIGIN_OR_CONTENT_TYPE`, `INVALID_REDIRECT`, `RETRIES_EXHAUSTED`, `QUEUE_TERMINAL_WITHOUT_RESULT`, `CATALOG_EVIDENCE_INVALID`, `WEATHER_UNAVAILABLE`, `PLANNING_LIMIT_EXCEEDED`, `WORKFLOW_VERSION_UNSUPPORTED`, `CALCULATION_FAILED`, `CROP_HEALTH_UNAVAILABLE`, `AI_NOT_CONFIGURED`, `AI_DAILY_LIMIT`, `AI_UNAVAILABLE`, `AI_BUSY`, `AI_DECLINED`, `AI_REQUEST_REJECTED`, `CROP_NOT_COVERED`, `EXPLANATION_CHECK_FAILED`, `NOT_READY`, `PHOTO_INVALID`, `PHOTO_TOO_LARGE`, `PHOTO_TOO_SMALL`, `PHOTO_UNREADABLE`, `INVALID_WEATHER_REQUEST`, `WEATHER_BUSY`, `WEATHER_TIMEOUT`, `WEATHER_UPSTREAM_INVALID`, `WEATHER_UPSTREAM_UNAVAILABLE`, `WEATHER_STORAGE_UNAVAILABLE`, `WEATHER_CANCELLED`, `OBSERVATIONS_NOT_CONFIGURED`, `OBSERVATION_AUTH_FAILED`, `OBSERVATION_UPSTREAM_UNAVAILABLE`, `OBSERVATION_UPSTREAM_INVALID`, `OBSERVATION_CANCELLED`, `SCENARIO_UPSTREAM_UNAVAILABLE`, `SCENARIO_UPSTREAM_INVALID`, `SCENARIO_STORAGE_UNAVAILABLE`, `SCENARIO_CANCELLED`, `FIELD_TOO_LARGE_FOR_TERRAIN`, `NO_CLEAN_PIXEL`, `OBSERVATION_UPSTREAM_FAILED`, `OBSERVATION_TIMEOUT`

### glossary group `term` (38)

`ndvi`, `green_season`, `bare_field_period`, `vegetation_stress`, `field_history_anomaly`, `cloud_gap`, `modis.ndvi_history`, `modis.usually_low`, `modis.pixel_size`, `modis.peak_trend`, `modis.hls_agreement`, `terrain.elevation`, `terrain.dem_noise`, `terrain.slope`, `terrain.aspect`, `terrain.slope_below_noise`, `terrain.erosion_ls`, `terrain.frost_pocket`, `ecostress.lst`, `ecostress.esi`, `ecostress.irregular_sampling`, `grace.equivalent_water_height`, `grace.trend`, `grace.regional_not_field`, `gedi.agbd`, `gedi.hedges_and_trees`, `gedi.not_crop_biomass`, `product.hls`, `product.smap`, `product.gpm`, `product.power`, `product.nex_gddp`, `product.nasadem`, `product.modis`, `product.ecostress`, `product.grace`, `product.gedi`, `product.soilgrids`

### rotation reason codes (`rotationReasonCodes`)

`CROP_NOT_IN_CATALOG`, `CATALOG_GAP`, `CROP_EXCLUDED_BY_FARMER`, `MODEL_TYPE_UNSUPPORTED`, `REGION_UNRESOLVED`, `REGION_BOUNDARY_UNAVAILABLE`, `CROP_NOT_APPLICABLE_IN_REGION`, `FARMING_SYSTEM_UNRESOLVED`, `CULTIVAR_NOT_IN_CATALOG`, `RULE_NOT_VERIFIED`, `RULE_REFERENCE_ONLY`, `RULE_OUT_OF_SCOPE`, `RULE_SCOPE_UNSPECIFIED`, `RULE_STAGE_TIMING_UNKNOWN`, `RULE_MEASUREMENT_UNSUPPORTED`, `CALENDAR_EVIDENCE_UNAVAILABLE`, `DURATION_EVIDENCE_UNAVAILABLE`, `TEMPERATURE_EVIDENCE_UNAVAILABLE`, `WATER_CLASS_UNAVAILABLE`, `SOIL_UNKNOWN`, `SOIL_METHOD_MISMATCH`, `SOIL_DATE_UNKNOWN`, `SOIL_LIMIT_FAILED`, `SOIL_LIMIT_WARNING`, `SOIL_LIMIT_PASSED`, `SOIL_CHECK_UNIMPLEMENTED`, `HISTORY_UNKNOWN`, `HISTORY_PARTIAL`, `HISTORY_DATES_UNKNOWN`, `PREVIOUS_CROP_UNRESOLVED`, `FIRST_WINDOW_OUTSIDE_RANGE`, `NO_WINDOW_BEFORE_HORIZON`, `RETURN_INTERVAL_VIOLATION`, `PREDECESSOR_FAMILY_PROHIBITED`, `HEALTH_BREAK_VIOLATION`, `HEALTH_ISSUE_NOT_IN_CATALOG`, `HEALTH_REPORT_UNCONFIRMED`, `WATER_UNKNOWN`, `RAINFED_ARID_RISK`, `SOIL_ESTIMATE_USED`, `SOIL_ESTIMATE_OUTSIDE`, `SOIL_ESTIMATE_UNAVAILABLE`, `IRRIGATION_ADEQUACY_UNKNOWN`, `CLIMATE_ANALOGS_INSUFFICIENT`, `CLIMATE_CHECKS_DIFFER`, `SOIL_PREFERENCES_UNEVEN`, `FUTURE_CLIMATE_UNAVAILABLE`, `SEARCH_PRUNED`, `SEARCH_TRUNCATED`, `NOT_EXPERT_REVIEWED`, `EXPOSURE_HEAT`, `EXPOSURE_COLD`, `EXPOSURE_RAIN_DEFICIT`, `EXPOSURE_UNAVAILABLE`, `TERRAIN_CONTEXT_UNRANKED`, `EROSION_FACTORS_MISSING`, `INFILTRATION_DRAINAGE_UNKNOWN`, `EQUIPMENT_DATA_UNAVAILABLE`, `MARKET_ACCESS_DATA_UNAVAILABLE`, `INCOME_DATA_UNAVAILABLE`

### future climate reasons

`CLIMATE_NOT_COMPARED`, `SCENARIO_TILE_NOT_PREPARED`, `SCENARIO_DATA_INCOMPLETE`, `FUTURE_ANALOGS_INSUFFICIENT`; near-term: `NEAR_TERM_TILE_NOT_PREPARED`, `NEAR_TERM_DATA_INCOMPLETE`, `NEAR_TERM_ANALOGS_INSUFFICIENT`

### plan failure codes

`STORED_REQUEST_INVALID`, `CATALOG_EVIDENCE_INVALID`, `WEATHER_UNAVAILABLE`, `PLANNING_LIMIT_EXCEEDED`, `RETRIES_EXHAUSTED`, `QUEUE_TERMINAL_WITHOUT_RESULT`, `WORKFLOW_VERSION_UNSUPPORTED`, `CALCULATION_FAILED`

## APPENDIX C. SEED COPY (tone and wording anchors; the full message files are written in slice F1 and reviewed at gate G2)

| Key                    | Français                                                                                                               | English                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `shell.reminder`       | Un guide, pas un remplacement de votre jugement ni de vos conseillers locaux.                                          | A guide, not a replacement for your own judgement or your local advisers.                                |
| `welcome.title`        | Votre terre a un plan.                                                                                                 | Your land has a plan.                                                                                    |
| `welcome.line1`        | Rotavise lit les données satellite de la NASA pour votre parcelle.                                                     | Rotavise reads NASA satellite data for your field.                                                       |
| `welcome.line2`        | Il compare votre rotation à deux autres au moins.                                                                      | It compares your rotation with at least two others.                                                      |
| `welcome.line3`        | Il dit à quel point il est sûr, et ce qu'il faut vérifier sur place.                                                   | It tells you how sure it is and what to check locally.                                                   |
| `field.add`            | Ajouter une parcelle                                                                                                   | Add a field                                                                                              |
| `field.detect.hint`    | Zoomez puis touchez votre parcelle.                                                                                    | Zoom in, then tap your field.                                                                            |
| `field.detect.outline` | Tracer cette parcelle pour moi                                                                                         | Outline this field for me                                                                                |
| `field.detect.check`   | Contour suggéré : vérifiez-le.                                                                                         | Suggested outline: check it.                                                                             |
| `plan.send`            | Comparer les rotations                                                                                                 | Compare rotations                                                                                        |
| `result.lowerIsBetter` | Plus bas, c'est mieux.                                                                                                 | Lower is better.                                                                                         |
| `result.notForecast`   | Scénario, pas une prévision.                                                                                           | Scenario, not a forecast.                                                                                |
| `evidence.sourced`     | Source vérifiée                                                                                                        | Sourced                                                                                                  |
| `evidence.recalled`    | Rappelé par une IA : à vérifier sur place                                                                              | AI-recalled: check locally                                                                               |
| `evidence.missing`     | Aucune donnée                                                                                                          | No data                                                                                                  |
| `nasa.ask`             | Demander à la NASA                                                                                                     | Ask NASA                                                                                                 |
| `nasa.wait`            | La NASA répond en général en quelques heures. Vous pouvez quitter : nous gardons la demande.                           | NASA usually answers in a few hours. You can leave: we keep the request.                                 |
| `photo.consent`        | J'accepte d'envoyer cette photo à un fournisseur d'IA. Je comprends que c'est une piste à vérifier, pas un diagnostic. | I agree to send this photo to an AI provider. I understand this is a possibility check, not a diagnosis. |
| `error.generic`        | Un problème est survenu. Réessayez.                                                                                    | Something went wrong. Try again.                                                                         |

Message key namespaces (one JSON object each in `fr.json` and `en.json`): `shell`,
`welcome`, `auth`, `map`, `field`, `history`, `inputs`, `priorities`, `plan`,
`progress`, `result`, `strategy`, `evidence`, `whatif`, `crops`, `glossary`,
`photo`, `plans`, `account`, `about`, `demo`, `error`, `validation`, `common`.
