# Frontend plan: design, structure and build order (proposal, not approved)

Status: proposal written 2026-11-10 for the user's approval. No UI work starts
until the user agrees the design direction and the three key screens
(section 12). Sources of truth for requirements: the challenge text and
`docs/specification/FIELD_SHIFT_AUDIT_AND_PLAN.md` section 1 and section 4.

## 0. Research basis and revisions (2026-11-10)

The first draft chose a palette from mood ("warm paper, zellige"). Research
says identity must come from deliberate decisions grounded in users and the
product's own subject, and that big teams win on craft and scope, not on a
palette. Revisions that override the sections below where they conflict:

1. **The signature element is the crop strip** (one coloured block per season),
   the core object of the product. It is the logo mark, the loader, the divider
   and the chart motif. The zellige pattern is dropped as the identity; colours
   are derived from the real satellite imagery of the pilot fields (vegetation
   ramp, bare-soil tones, water), tested for contrast, not chosen from a mood.
   All palette and type values below are hypotheses until tested with farmers.
2. **User needs first.** Before the build, test a clickable prototype with at
   least five real farmers or farm families in Morocco (user-organised; phone,
   in Darija or French), watch where they hesitate, and change the design.
3. **Low-literacy rules** (from the research): icons with words, never icons
   alone; icons tested locally; audio for key sentences where a quality voice
   exists (not promised for Darija); no required typing of non-numeric text
   (pick from lists, tap, draw); shallow navigation; no scrolling menus.
4. **Reduce scope, then polish.** The vertical slice is: field, current
   rotation, two alternatives, evidence for each. Everything else waits until
   that slice meets the quality bar (Saarinen, rules 5, 6, 8).
5. **Sources visible on every chart**, controls split into "what is shown" and
   "how it looks", shareable state in the link (Our World in Data practice).
6. **Maps:** a limited palette, progressive disclosure by zoom, layers on
   demand, contrast checked between data and basemap.
7. **Design system:** start small, semantic tokens (`--water`, `--heat`, not raw
   colours), decisions recorded in `docs/DECISIONS.md`, one owner for review.
8. **No hand-off between design and build:** the same people build what they
   design; weekly critique of the running app against a written bar.

Sources: GOV.UK Government Design Principles; Karri Saarinen, "10 rules for
crafting products that stand out" (Figma); Our World in Data, "Redesigning our
interactive data visualizations"; research on low-literacy interfaces
(participatory icon design for rural users; KrishiPustak; Farmer.Chat);
Mapbox and Adobe guidance on map UI; public writing on Polaris, Material and
the Airbnb DLS (secondary, to verify before citing).

## 0b. Chosen reference: OneSoil (user decision, 2026-11-10)

The user picked OneSoil as the reference to match and beat. Binding consequences
(override anything below that conflicts):

1. **Map-first.** The map is the main surface, full bleed. Controls float over
   it (rounded floating bars, bottom sheet on phones). The steps of the flow
   happen on top of the map, not on separate pages.
2. **Grid selection of the field.** At field zoom a grid aligned to the NASA
   HLS 30 m cells appears under the finger or cursor. The farmer paints cells
   (drag to add, tap a painted cell to remove, two-finger or modifier to pan) and
   the field is the union of cells; an outline tool stays available. Live
   readout: area, number of NASA cells, which products cover it. Painted cells
   animate in (short scale and fade, staggered by distance). The grid is
   generated in a web worker and drawn as one vector layer, so it stays at 60
   fps with thousands of cells. Automatic field-boundary suggestion from open
   data (OpenStreetMap farmland, Fields of The World) is an optional later add.
3. **Imagery is real.** Satellite imagery of real Moroccan fields (NASA
   HLS/GIBS now, a self-hosted basemap later) is the visual world; no stock
   photography.
4. **Motion system.** One easing set and three durations (120, 220, 380 ms),
   spring for sheets and panels, shared-element transitions between steps
   (the field outline becomes the map thumbnail, the crop strip grows into the
   results), charts draw in left to right, numbers count up once, skeletons
   instead of spinners, layer changes cross-fade on the map. All motion honours
   `prefers-reduced-motion`; nothing blocks input; frame budget checked in a
   performance test.
5. **Start by who you are**, as OneSoil does (grow / advise), with the farmer
   flow first.
6. **Free of friction:** sign-in is optional until saving; the whole flow works
   as a guest.
7. Libraries: MapLibre GL JS for the map and the grid layer, the `motion`
   library (MIT) for spring and layout animation, the browser View Transitions
   API where available. All recorded in `THIRD_PARTY_NOTICES.md`.

## 0c. UI system taken from the OneSoil screenshots (user decision, binding)

Observed in the user's screenshots of the OneSoil web app and phone app
(2026-11-10). The Rotavise UI follows the same system and is cleaner where it can
be. No more design previews are made: this section is the record, and the first
build step builds the real thing.

**Desktop**

- One white side panel on the left (about a third of the width, 360 to 380 px),
  the full-height map on the right. The panel holds a title with one line of
  context, then a few labelled fields. Nothing else.
- Fields are light-bordered rounded inputs (10 to 12 px radius), one per row,
  label above in small grey type, units inline (`3 ha`). Toggles for yes/no
  choices. Selects with a chevron. No boxes inside boxes.
- Actions are rounded pills at the bottom of the panel: one filled primary (green)
  and at most one secondary (dark or outlined). Never more than two.
- The map shows the field outlines thin and white, small dark number chips for
  zones, a small dark "Source: layer, date" label top-left, and a legend card
  bottom-left with a title and three or four swatches.
- Round dark icon buttons float on the right edge of the map: zoom in, zoom
  out, 3D or tilt, measure. Maximum four.
- Two maps side by side (compare) use the same view, each with its source label.

**Phone**

- The map fills the screen. At the top, floating rounded dark chips with a
  chevron choose layer and field/season. At the bottom, a white tab bar with five
  icons and labels (Map, Fields, Options, Evidence, Profile).
- One floating action card at a time (for example the next step), coloured
  by purpose, above the tab bar.
- A time scrubber above the tab bar: rounded dark bar, current time label, a
  handle; it drives the map layer.
- Detail opens in a bottom sheet that covers up to two thirds of the screen and
  closes by drag. Never a new page for detail.

**Cleanliness rules (a review checklist, enforced in code review)**

1. One primary action per screen.
2. At most seven items in any list or section before it is split or collapsed.
3. Three text sizes per screen plus the headline; two weights.
4. One accent colour for actions (green). Colours that carry meaning (water,
   heat, vegetation, caution) appear only on data, never on chrome.
5. Spacing, not borders, separates groups; hairlines only between list rows.
6. No more than four icon buttons on the map; icons use one stroke weight and
   always have an accessible name.
7. Words come before numbers: every figure sits beside a plain label and unit.
8. Empty space is part of the design; a panel is never filled just because it
   has room.
9. Rotavise additions to the OneSoil system, kept quiet: the crop strip (the logo
   and the rotation visual), source chips (sourced, recalled, mixed, missing),
   and the evidence sheet. They follow the same pill and chip style.

**Reference limits**

- The OneSoil web app (`app.onesoil.ai`) needs an account. We do not create
  accounts. The user shares further screenshots or a screen recording of the
  flows to match; the build copies the system and behaviour, not their
  code, assets, name or logo.
- Imagery: the real map uses NASA GIBS (HLS Sentinel-2 true colour at 30 m, MODIS
  behind it) through MapLibre. A test on 2026-11-10 confirmed 127 daily HLS image
  dates over the pilot field between September 2025 and June 2026; clouds and gaps
  on some dates are real and the interface says so.

## 0d. Detailed OneSoil inspection

The measured layout, every screen seen, what we copy, where we are better and
what to avoid are in `docs/steps/15/onesoil-inspection.md`. It is binding for the
frontend build together with sections 0b and 0c.

## 0e. Anti-flaw rules from the OneSoil second pass

The table "Flaws seen, and the rule Rotavise follows instead" in
`docs/steps/15/onesoil-inspection.md` is binding: one app shell, performance
budgets, toasts only after an action, a DOM scan for leaked placeholders,
opaque panels over the map, plain words before jargon, colour-blind-safe ramps,
no empty tabs, phone first with tests at four widths, no floating bubbles over
controls, explained partial images, our own crop picker, and ranges with
sources on every figure. Each rule is a test or a review checklist item.

## 0f. The master plan

`docs/steps/15/FRONTEND_MASTER_PLAN.md` is the build specification: every
screen, control, API call, state, test and backend task, written for Codex. It
supersedes the screen outline in section 7 below wherever they differ.

## 1. Goal

A farmer in Morocco, with little technical skill, opens the app on a phone,
marks the field, says what grew there and what matters, and gets the existing
rotation compared with at least two alternatives, each with the reason, the
evidence, the benefits, the gaps and the risks. The NASA evidence is visible and
explained. The app supports the farmer's judgment and says so everywhere.
It must also look like one finished product with its own identity.

## 2. Design principles

1. **One screen, one decision.** A farmer is never asked two things at once.
2. **Words and pictures before numbers.** Every number has a plain sentence next
   to it, in the chosen language.
3. **Honest by default.** Every claim shows where it came from: NASA data,
   a cited source, or AI-recalled and unverified (colour and label, never
   hidden). Projections say "scenario, not a forecast".
4. **The data is the decoration.** No ornament that is not information.
5. **Two interface languages, four name languages.** The app is French and English; crop and variety names show in English, French, Arabic and Darija. Arabic-script names sit inside left-to-right text without breaking the layout.
6. **Works on a cheap phone and a slow connection.**
7. **No dark patterns, no tracking, no ads.** Privacy follows `AGENTS.md`.

## 3. Identity ("Almanac")

A farmer's field notebook made digital: warm paper, ink, restrained colour,
editorial type, one geometric motif.

### Colour tokens (CSS variables; contrast checked to WCAG AA)

| Token            | Value     | Use                                      |
| ---------------- | --------- | ---------------------------------------- |
| `--paper`        | `#F4EDE0` | page background                          |
| `--paper-raised` | `#FBF7EE` | cards, drawers                           |
| `--ink`          | `#2A2418` | text                                     |
| `--ink-soft`     | `#5A5040` | secondary text                           |
| `--rule`         | `#D8CCB4` | lines                                    |
| `--terracotta`   | `#B4512D` | accent, heat, primary action             |
| `--cobalt`       | `#1F4E8C` | water, rain, soil moisture               |
| `--olive`        | `#5C6B3A` | vegetation, green seasons, "good"        |
| `--saffron`      | `#D9A21B` | caution, "recalled, not sourced"         |
| `--soil`         | `#6B4F36` | bare ground, soil                        |
| `--night`        | `#1B1A17` | optional dark map mode (not the default) |

The same colour always means the same thing (water is cobalt everywhere).
Final values are tuned in the mockups and checked with a contrast script; any
pair that fails AA changes.

### Type

- Display: **Fraunces** (serif, variable). Interface and body: **IBM Plex Sans**
  (and **IBM Plex Sans Arabic**, used only to show Arabic and Darija crop
  names). Numbers: **IBM Plex
  Mono**, tabular. All SIL OFL, self-hosted, subset, preloaded; no external font
  requests.
- Scale: 14, 16 (body default), 20, 28, 40, 56. Minimum body size 16 px;
  data labels never below 13 px.

### Shape, space, motion

- Square corners with a 4 px radius at most; 1 px rules instead of shadows;
  8 px spacing unit; generous whitespace.
- Motion only to explain change (a bar growing, a layer fading in), 150–250 ms,
  honouring `prefers-reduced-motion`.

### Motif

A restrained zellige-inspired geometric pattern (a small set of SVG tiles),
used only as the bar fill and divider in charts and the header band. Never as a
page background. Drawn once, owned by the project, no third-party asset.

### Things we will not do

Gradients, glassmorphism, drop-shadow cards everywhere, emoji or stock icons,
purple or blue defaults, centred hero with a gradient headline, identical
feature-card grids, default Inter, placeholder copy. Icons are a small custom
set (about 40 line icons, one stroke weight) drawn for the project.

## 4. Languages (decided by the user, 2026-11-10)

- **Interface: French (default) and English only.** Every button, sentence,
  chart label, error and glossary card the app shows is French or English. The
  glossary endpoint keeps serving Arabic and Darija, but the app does not
  display them for now.
- **Crop and variety names: English, French, Arabic and Darija**, shown from the
  catalog (names by language). The user picks which name language to display
  for crops (default: French, with the Arabic or Darija name beside it) and can
  search crops by a name in any of the four.
- No right-to-left page layout. Arabic and Darija names are rendered inline with
  `dir="auto"` and a bidirectional-safe wrapper, so they never reorder numbers or
  punctuation around them; the font is IBM Plex Sans Arabic.
- Interface text lives in message files (ICU format) in fr and en, reviewed by a
  native speaker before the demo; any non-reviewed string is flagged in the
  build report.
- Language switch (fr/en) is on every screen; the choice is remembered.
- Consequence to test with farmers: a farmer who cannot read French or English
  sees words only for crop names. Icons with words, the crop strip and large
  colour-coded bars carry the rest; if the farmer test shows this is not
  enough, a Darija interface is the first extension.

## 5. Technology

Existing: Vite 8, React 19, TypeScript strict, shared Zod contracts
(`@rotavise/contracts`), Playwright tests.

| Concern     | Decision                                                                                                       | Why                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Map         | **MapLibre GL JS** (open source, no key)                                                                       | Custom style = our identity; works with vector and raster                                 |
| Basemap     | Morocco vector tiles as **PMTiles** (Protomaps, OpenStreetMap data, ODbL) self-hosted, styled in our palette   | No third-party tile service or key; attribution kept; works offline                       |
| NASA layers | **NASA GIBS** WMTS (MODIS, HLS where offered) as optional overlays, plus our own data as GeoJSON/raster layers | Directly shows NASA data on the map; no key; attribute NASA                               |
| Charts      | **d3-scale / d3-shape + hand-written SVG** components                                                          | Distinct look, full control of RTL and accessibility, no chart-library default aesthetics |
| Server data | **TanStack Query** with typed fetchers built from the OpenAPI/Zod contracts                                    | Caching, retries, polling long NASA jobs                                                  |
| Routing     | React Router                                                                                                   | Deep links, back button                                                                   |
| Styling     | Plain CSS with tokens and CSS Modules                                                                          | No utility-framework look; small bundle                                                   |
| Primitives  | **Radix UI** (unstyled) for dialog, tooltip, slider, tabs, popover                                             | Accessibility done right, styled by us                                                    |
| i18n        | ICU messages with a small loader (own code or `@formatjs/intl`)                                                | RTL, plurals, number formats                                                              |
| Offline     | Service worker: app shell, glossary, catalog names, last results, basemap tiles of the saved field             | Poor connectivity in rural areas                                                          |
| Auth        | Existing Google sign-in (Better Auth) and guest mode                                                           | Already verified                                                                          |

Every new dependency is open source with a compatible licence and is recorded
in `THIRD_PARTY_NOTICES.md`. Initial JavaScript budget: 250 kB gzip for the
first screen; the map and charts load on demand.

## 6. Information architecture and flow

```
Language → Welcome → My field → What grew here → What matters → Results
                                                      │
                                       Compare ← Evidence drawer ← What-if
                                       Glossary and "how to read this" everywhere
```

Persistent: language switch, the one-line reminder ("a guide, not a
replacement for your own judgment and local advisers"), save/sign-in.

## 7. Screens

1. **Language and welcome.** Two large language buttons (Français, English,
   الدارجة) and English. One sentence on what the tool does. Continue.
2. **My field.** Map (basemap in our palette). Search a place or use the phone's
   location, drop a pin, then draw the outline (vertex handles, large). Shows area and
   the NASA cell the data comes from. Soil: "we estimate your soil from
   SoilGrids" with a label and an edit option (texture, depth, drainage).
   Water: a three-choice picker (rain only / sometimes irrigated /
   irrigated) with a supply amount if irrigated.
3. **What grew here.** A horizontal strip of seasons (one block per year, up to
   five). Tap a block, pick the crop by name in the chosen language (search by
   fr/en/ar/ary; photo later). Marks fallow. This produces the current rotation.
4. **What matters.** Six sliders with a word and a small drawing each: water,
   soil health, climate risk, crop health, income, effort. Equipment and market
   access as simple pickers. Defaults explained.
5. **Results (the main screen).** Map on top (field outline, selected layer).
   Below, three columns on desktop and swipeable cards on phone: **Your
   rotation** and two or more **alternatives**. Each card: the crop sequence as
   coloured blocks on a time strip; one plain sentence "why"; benefit bars (water,
   soil carbon, climate risk, income, nitrogen) with ranges; chips for gaps and
   "check locally" items; evidence class chip (sourced / recalled / mixed).
   Tapping a card opens the evidence drawer.
6. **Evidence drawer.** Tabs: **Seasons** (greenness timeline, green vs bare bands
   over the year, with the field's own history and the 27-year MODIS context),
   **Water** (rain from POWER vs GPM, soil moisture, groundwater trend from
   GRACE, crop water need), **Heat and frost** (vulnerable seasons per crop stage,
   ECOSTRESS where available), **Land** (slope, erosion and drainage note,
   frost-pocket note), **Future** (near-term and mid-century bands, two
   scenarios, five models, "scenario not forecast"), **Sources** (every rule with
   its citation or "AI-recalled", dataset list with how each NASA product was
   used).
7. **What-if.** Sliders for rain (−50 to +50 %), temperature (−3 to +6 °C) and
   sowing date shift; the cards update; the label says what-if, not a forecast.
8. **Glossary and help.** Tap any dotted-underlined term for a card (from
   `GET /api/v1/glossary`); a "how to read this" panel per chart; satellite vs
   ground measurement note.
9. **Saved fields and plans**, **photo check** (crop health; blocked behind the
   Anthropic key, shown as "available soon" until it works), **account**.

## 8. States that must be designed (not left to the browser)

Empty, loading skeletons, partial data (a NASA request takes hours: show
"requested, expected in about N hours" and let the farmer continue with what we
have), failed requests with a plain reason and a retry, offline, no data for a
crop ("we have no sourced income data"), expired session, and plan
still computing (poll with progress).

## 9. Data mapping (existing API; OpenAPI at `/api/v1/openapi.json`)

| Screen          | Endpoints                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------- |
| Field, soil     | fields CRUD, soil estimate, weather explorer                                                |
| Crops           | `GET /catalog/options/...` (names by language)                                              |
| Plan and result | `POST /plans`, `GET /plans/:id`, `POST /plans/:id/what-if`, plan explanation                |
| Evidence        | analysis/vegetation, /rain, /vegetation-history, water-storage, canopy-biomass, extractions |
| Glossary        | `GET /glossary?lang=`                                                                       |
| Photo check     | crop-health status and request                                                              |

Gaps in the API that the frontend needs and the backend still has to provide are
tracked in `docs/PROGRESS.md` (income, benefits, vulnerable-season output,
terrain in the result, extra priorities).

## 10. Quality bars (each is a test or a script, not a promise)

- Accessibility: axe checks on every screen and language, keyboard-only
  completion of the whole flow, correct rendering of Arabic names inside French/English text, 48 px minimum touch targets,
  colour never the only signal.
- Performance: Lighthouse mobile budget (performance 85+, LCP under 2.5 s on a
  throttled mid-range phone profile), bundle budgets enforced in CI.
- Correctness: Playwright flows in fr and en, with Arabic and Darija crop names (field setup to result,
  what-if, offline reload), visual regression snapshots of the key screens,
  no raw reason codes or untranslated strings visible (a test scans the DOM).
- Honesty: a test asserts that every number shown has a unit and a source chip,
  and that "not a forecast" and the support-not-replace reminder are present.
- Typecheck, lint, format and the existing `pnpm verify` stay green.

## 11. Build order

| Step | Work                                                                                      | Output                                         |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| F0   | Design system: tokens, fonts, motif tiles, icon set, primitives, bidi-safe name component | Storybook-like page in the app, contrast check |
| F1   | Three mockups: results, field setup, evidence drawer (static HTML, real data)             | **user approval gate**                         |
| F2   | App shell, routing, i18n, data layer from the OpenAPI types                               | typed client, language switch                  |
| F3   | Field setup with the map, crop strip, priorities                                          | flow to a submitted plan                       |
| F4   | Results screen and cards, polling, states                                                 | comparison view on real result                 |
| F5   | Evidence drawer tabs and charts; what-if; glossary                                        | NASA panels with sources                       |
| F6   | Offline, saved fields, account, photo-check shell                                         | works on a phone                               |
| F7   | Seeded demo field (real Tadla data) so the demo never waits for NASA                      | one-click demo                                 |
| F8   | Accessibility, performance, translation review, visual tests; full verify                 | green CI                                       |

Codex builds F0, F2 and parts of F3 to F5 from this document, one branch per
step, and Claude reviews each against the mockups and the checks, as with the
backend. Claude writes the mockups (F1) and the key components.

## 12. What the user approves first

1. The direction (Almanac, with the map-first results screen).
2. The palette, fonts and the zellige motif, seen in the three mockups (F1).
3. The language set: interface French and English (French default); crop names English, French, Arabic, Darija.
4. The stack in section 5, especially a self-hosted Morocco basemap.

## 13. Risks and honest limits

- **Prior-work rule.** The challenge FAQ says teams may not begin work on
  challenges before the hackathon (14–15 Nov). The user has to resolve this with
  the organizers (audit section 3a); this plan builds now and would have to be
  compressed into the event weekend if the answer is no.
- **Time.** About five days of work for one engineer plus Codex. If it slips,
  cut in this order: offline mode, evidence-drawer tabs
  beyond Seasons, Water and Future, photo-check shell.
- **Translations** are machine-written until a native speaker reviews them; the
  app says so.
- **Basemap data** (OpenStreetMap, ODbL) needs attribution on the map and in the
  notices. NASA GIBS layers need NASA attribution.
- **Icons, fonts, motif** are created or OFL-licensed; nothing is copied from a
  reference site.
