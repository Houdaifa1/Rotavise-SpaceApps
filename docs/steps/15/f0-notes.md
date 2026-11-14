# F0 — design system and development showcase

2026-11-11. Branch `codex/fe-f0`. Implemented for review at gate G1; no approval is recorded. Work is uncommitted and unpushed. No backend source, contract, database, migration, catalog release or existing end-to-end test was edited.

## Review

```sh
pnpm install --frozen-lockfile
pnpm --filter @rotavise/web dev --port 5178
```

Open <http://127.0.0.1:5178/design>. French is the default; the header switches the entire workshop to English. Review at 390, 768, 1024 and 1440 px. Section links, state selectors and disclosure rows expose the catalogue. The workshop is light only. Component identifiers and CSS token names remain technical identifiers in both languages.

The development route dynamically imports the workshop and its test specimens. Vite eliminates this branch in production. `design:budgets` checks the resulting files for workshop text/assets, fonts and fixtures. The production application still opens its existing interface; this slice creates no farmer screens, map, API client or application router.

## What exists, screen and control inventory

The only new screen is `/design`:

| Section          | Components and controls                                                                            | Reachable states / behaviour                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header and index | Crop-strip logo, language switch, seven section links, skip link                                   | French/English, pressed language, keyboard focus; desktop index becomes a horizontal phone/tablet index                                                                                                                  |
| Foundations      | Semantic token swatches, type specimens, spacing ruler, token disclosures, original icon catalogue | Every token value; 400/500 interface weights; headline, interface, numbers and Arabic script; 42 original 24 px / 1.75 px SVG icons                                                                                      |
| Controls         | Button and IconButton inspector                                                                    | Four variants, two sizes, default, hover, pressed, focus, loading and disabled; live presses update a workshop count                                                                                                     |
| Controls         | TextField, NumberField, DateField inspector                                                        | Default, keyboard focus, inline error, disabled, read only; labels, units and descriptions remain associated                                                                                                             |
| Controls         | Select and SearchSelect                                                                            | Native select; opaque portalled searchable menu; open/closed, selected and disabled choices, empty search, seven choices per search page; arrows/Enter/Escape                                                            |
| Controls         | Switch, Slider, SegmentedControl, Tabs                                                             | On/off/disabled, slider endpoints and current value, selected/default/disabled choices, arrow-key navigation and labelled panels                                                                                         |
| Navigation       | AppShell, IconRail, TabBar                                                                         | Desktop rail/list/detail/content, tablet top rail/list/content, phone content/list/tab bar; active items, badge and hover/focus labels                                                                                   |
| Navigation       | FloatingChip, MapTools, LegendCard                                                                 | Default/open/disabled chips, up to four tools, pressed/disabled tools, collapsed/open legend                                                                                                                             |
| Navigation       | DateStepper and CompareSlider                                                                      | Previous/next boundaries; no dates, no image, cloudy and loading messages; native range supports pointer and arrow keys                                                                                                  |
| States           | Chip, SourceChip, StatusChip, TermChip                                                             | Meaning plus an icon; sourced/mixed/recalled/missing, expert-reviewed adjunct; ready/loading/partial/failed/unavailable                                                                                                  |
| States           | Skeleton, EmptyState, ErrorState, PartialState                                                     | Four content-sized skeleton shapes; optional single action; honest missing/error/partial copy                                                                                                                            |
| States           | ProgressBar, StepProgress                                                                          | Bounded values, indeterminate progress, current/completed/future steps and unknown current step                                                                                                                          |
| States           | ReminderBar, OfflineBar, Toast                                                                     | Reminder in panels and sheet; read-only offline sentence; toast only after a workshop action, dismissible and expires after six seconds                                                                                  |
| Crops            | CropStrip                                                                                          | Regular/compact, static/interactive, selected slot, empty slot, unknown crop, duration-proportional slots                                                                                                                |
| Crops            | CropName, CropSwatch                                                                               | French/English/Arabic/Darija/all names, preferred name precedence, French/English fallback, labelled Arabic fallback for absent Darija, low-confidence underline/title, unknown id, compact form, bidi-safe inline names |
| Data             | RangeBar, ScoreBar, StatCard, DataTable                                                            | Range, single value, missing hatch, not compared, lower-is-better text, dark stat; sortable/empty table and seven rows per page                                                                                          |
| Charts           | SeriesChart                                                                                        | Handwritten SVG line/area/band/bars/timeline; complete/partial/empty, gaps, finite single-value domains, visible source, min/max/latest/trend table, pointer/keyboard cursor and opaque tooltip                          |
| Overlays         | Dialog, ConfirmDialog, Tooltip, Popover, GlossaryTerm                                              | Closed/open, Escape and dismissal, opaque portal surfaces, named dialogs; modal focus trap/return, cancel before destructive callback; glossary entry supplied by caller                                                 |
| Overlays         | Panel, DetailPanel, BottomSheet                                                                    | Open/closing/loading; close/reopen; sheet buttons and drag choose peek/half/full, spring settling, interruptible drag and reduced motion; reminder stays in the visible sheet viewport                                   |
| Overlays         | PhotoPicker                                                                                        | Keyboard file choice or drop, dragging, invalid MIME, too large, ready preview, remove; declared formats/size; memory-only object URL revoked on change/unmount                                                          |
| Overlays         | StepWizard                                                                                         | First/intermediate/last, back/next/finish, invalid step cannot advance; current step shown                                                                                                                               |

Callbacks in this development workshop change the specimen's local display or show an explicitly labelled workshop acknowledgement. They do not pretend to save a field, request NASA data, zoom a map or diagnose a photograph. Feature consumers will supply real API behaviour in later authorized slices.

## Foundations and evidence

- Followed the complete master plan (Parts 0–10 and appendices), frontend-plan overrides 0b–0f, inspection notes, measured tokens, repository instructions, OpenAPI inventory and relevant contract definitions. The screenshot pack was viewed locally; it remains ignored and no reference asset was copied.
- The measured reference overrides the older hypotheses: 14 px base; 400/500; near-black with two grey roles; opaque white panels on light grey; 8 px controls; compact 32 px desktop controls; dark rounded floating chrome. Phone inputs are 16 px to avoid browser zoom and touch targets expand to 44 px (48 px primary).
- Fraunces is reserved for headlines at 500, IBM Plex Sans for interface text, IBM Plex Mono for numbers and IBM Plex Sans Arabic for Arabic-script names. Fontsource WOFF2 normal Latin/Latin-ext/Arabic subsets are local imports, preloaded with `font-display: swap`. Fallback size/ascent/descent/line-gap overrides were measured using the pinned font files against Arial, Times New Roman and Courier New; Arabic uses the target vertical metrics. No proprietary font is included.
- Original SVG icons and logo use the repository licence. All added package versions and their new transitive dependencies have licence entries in `THIRD_PARTY_NOTICES.md`; esbuild was already in the lock but is now an explicit test-transform dependency and is also listed.
- Contrast is an executable manifest of every semantic foreground/background role used for text, controls and focus. The script rejects missing tokens or ratios below their 4.5:1 / 3:1 requirements. Brand bars and crop swatches are identity marks with adjacent words, not text colours. Band boundaries have full-colour strokes; no data meaning relies on a pale fill alone.
- Release 0.15.0 is read only by tests/fixture verification. The development fixtures contain three actual recorded crop identities (with confidence/preference metadata), not invented names. Chart specimens describe the four verification widths in pixels. They are labelled as interface specimens and never represent weather, yield, income or agronomic advice.

## Plan differences and contract findings

1. **Colour cardinality:** sixteen discrete hues and three discrete lightness values provide only 48 colours, so the literal palette cannot also uniquely identify 246 crops. Kept sixteen family hue centres and three lightness bands, with deterministic fine hue/saturation offsets from the crop id. A test checks all 246 release crops for exact uniqueness and order independence. This is not a guarantee that 246 colours are perceptually distinguishable for every viewer; crop words remain essential.
2. **Measured values supersede earlier hypotheses:** 400/500 replaces 400/600 and bold display; 8 px replaces 10 px control radii; 14 px is the interface base, with 16 px phone input text. Caution/bare/vegetation/hint values were darkened where the contrast script found failures. Dark chrome is opaque. A separate light focus token serves dark chrome.
3. **Peek height:** 240 px rather than the shell proposal's 120 px. A translated title, touch-sized detent buttons and the mandatory reminder cannot all fit into 120 px. The visible viewport shrinks with the sheet, preserving the reminder at every detent. The peek size remains subject to G1 review.
4. **Contract-backed presentation:** crop props derive from `CatalogOptions`, including optional confidence/preferred names; unsupported interface languages are not offered. GlossaryTerm accepts the caller's contract entry; it does not fetch an invented definition. Chart trend is supplied by the caller, not calculated from agronomic values in the browser. Calendar dates are formatted in UTC without local-zone conversion, using day–month–year in both languages.
5. **Test configuration:** added `web-unit` through `tooling/web/jest.config.mjs`, extending the existing verification config without changing it. `test:unit` selects both existing `unit` and `web-unit`. The new browser config preserves all existing tests and pins the harness's current catalog to the real release 0.1.0 that its setup imports. Deployment's default rotation catalog is now 0.15.0; without that test-only pin the legacy form receives a catalog-unavailable response. No production default changed.
6. **Browser environment:** direct macOS Chromium launch fails with `bootstrap_check_in ... Permission denied`; the in-app browser host is unavailable. Verification therefore used the official matching Playwright container through a loopback-only websocket with `exposeNetwork: "<loopback>"`, not a different test implementation. The actual API, disposable PostgreSQL and Mailpit still run through the repository harness.
7. **Technical catalogue grids:** token and icon identifiers are marked `data-code`. Technical swatch/icon inventories are split into groups of at most seven; selectable search lists and tables show at most seven items per page. Component and token identifiers are intentionally not translated.

## Verification

Final command results are recorded after execution in the table below. Logs and reviewed PNGs live under ignored `.artifacts/design/`; Playwright also attaches full-page PNGs for all eight language/width combinations under `.artifacts/playwright/`.

To reproduce the sandbox browser setup, run this in one terminal, then run the websocket-prefixed test command in another. Outside the restricted sandbox, `pnpm test:e2e` uses normal local Chromium.

```sh
docker run --rm --init --name rotavise-f0-browser \
  -p 127.0.0.1:5369:3000 --ipc=host -v "$PWD:/work:ro" -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 \
  node node_modules/@playwright/test/cli.js run-server --host 0.0.0.0 --port 3000
```

After the test, stop only that container with `docker stop rotavise-f0-browser`.

| Command                                                  | Exit | Verified result                                                                          |
| -------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                         | 0    | Frozen install of the updated exact-version lock                                         |
| `pnpm lint`                                              | 0    | ESLint passes                                                                            |
| `pnpm format:check`                                      | 0    | Repository formatting passes                                                             |
| `pnpm typecheck`                                         | 0    | All seven workspace projects pass                                                        |
| `pnpm build`                                             | 0    | Server and production web build pass; development branch eliminated                      |
| `pnpm test:unit`                                         | 0    | 374 tests: 35 existing unit + 339 web component/invariant tests                          |
| `ROTAVISE_BROWSER_WS=ws://127.0.0.1:5369/ pnpm test:e2e` | 0    | 14 tests: nine F0 browser checks + all five existing real-API workflows                  |
| `pnpm test:web`                                          | 0    | 339 component/invariant cases, both interface languages                                  |
| `pnpm design:contrast`                                   | 0    | 37 semantic pairs, plus negative checker test                                            |
| `pnpm design:budgets`                                    | 0    | 139,535 gzip bytes for all production JavaScript; showcase/font/specimen assets excluded |

Initial failures were inspected and corrected: contrast pairs, prohibited logo ARIA, duplicate landmark names, named popovers, empty-listbox semantics, badge accessible name, test keyboard timing, and the test-only catalog mismatch. An initial typecheck overlapped another command's shared clean build and lost compiled catalog declarations; commands that clean the same `dist` directories were then serialized, and typecheck passed. A temporary test-edit syntax error was corrected. No test or accessibility rule was disabled, no failure was piped through `tail`, and no backend source was changed to make checks pass.

Browser checks cover French/English × four widths, no horizontal page overflow, fonts, local-only request origins, sources/text alternatives, actual SVG label boxes, DOM leaks, no initial toast, keyboard menus, modal focus return, reduced-motion detents, dragging, visible peek reminder, keyboard comparison, chart gaps/cursor, invalid/valid upload and toast expiry. The five original browser flows retain their assertions, real PostgreSQL and email round trip. Screenshots at all four widths were inspected manually, including controls, crops and charts.

## Remaining limits and backend requests

- G1 user review is pending. This note does not approve F0, F1, any farmer screen or a deployment. The field-selection/result/evidence screen renders in the wider G1 gate belong to later slices and are not built here.
- French and English copy is machine-written and awaits human review. The 42 icon meanings and crop palette have not been tested with farmers or across all visual impairments. Name confidence from the catalog is preserved.
- The 250 kB production JavaScript budget is verified. Production-route LCP/INP and map frame-rate budgets cannot be attested by this development-only workshop; F1/F2/F11 must measure them on their real production screens and map. No runtime performance guarantee is claimed here.
- Source chips, offline bars, API error states and the shell are presentation primitives. Their real feature lifecycles, caching, capability decisions and server effects remain F1 and later. No offline service worker, map, chart data request or production photo upload was added.
- **Backend requests: none required for F0.** Existing master-plan BG items remain outside this task. Contract/OpenAPI sources were not regenerated.

## Proposed DECISIONS text (for reviewer to merge)

> F0 adopts the measured compact interface system with original Rotavise crop-strip identity: 14 px interface, 400/500 weights, opaque panels, 8 px controls, green actions and meaning-only data colours. Fontsource subsets and project-drawn SVG icons are self-hosted. Crop colours keep family hue centres/three lightness bands with deterministic fine identity offsets because 48 discrete colours cannot uniquely represent 246 crops. Colours supplement names. A 240 px sheet peek preserves accessible detent controls and the mandatory reminder. `/design` and its test specimens are excluded from production. These choices remain subject to the user's G1 review.

## Proposed PROGRESS text (for reviewer to merge)

> Scoped F0 frontend design system implemented on `codex/fe-f0` for G1 review, with a French/English development-only `/design` catalogue, semantic tokens, local fonts, 42 original SVG icons, crop-strip mark, complete primitive catalogue, SVG charts and component/accessibility checks. No backend implementation or later frontend slice was added. Verification is recorded in `docs/steps/15/f0-notes.md`. User design approval and native-speaker review remain pending. Work is uncommitted and unpushed.
