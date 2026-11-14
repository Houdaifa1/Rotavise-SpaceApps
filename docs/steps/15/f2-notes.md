# F2 map workspace and field list

2026-11-11 · `codex/fe-f2`

## Review and demo

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `/map` at the web URL printed by the developer supervisor. Field reads use
the existing API with planning enabled and its PostgreSQL database. NASA GIBS
imagery requires no account or API key. An owner with saved fields can open
one from the list or click its geometry. A new guest sees the empty state and
the creation methods scheduled for F3 and F4.

For a disposable API and database with both populated and empty field lists,
run `pnpm test:e2e --project app --grep S03`. This work used the existing
`ROTAVISE_BROWSER_WS` option with a local
`mcr.microsoft.com/playwright:v1.63.0-noble` browser server. The test runner
used production Vite preview for the app and the normal disposable PostgreSQL
harness. Changes are uncommitted and unpushed. F3 was outside this run.

## Screens and controls

| Surface                     | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S03 fields                  | The workspace reads `GET /fields` in pages of 20 and passes the server cursor through unchanged. Search filters names in loaded pages. Sort orders by name, saved boundary area or most recently changed. Local pages show seven rows at a time. Load more fetches the next API page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Field row                   | The outline thumbnail and saved area use `GET /fields/{id}/boundary`. A boundary-less field shows its saved position on the map and an explicit no-outline state. The boundary queue is shared across the workspace and limits requests to six. Reads are abortable and cached by owner. Latest comparison chips use the latest matching `fieldId` from `GET /plans`, with status text from the localized glossary.                                                                                                                                                                                                                                                                                                                                                                                      |
| Field selection             | Clicking a row, an outline or a point opens `/fields/:id` with the field name, saved area, position and any latest comparison status. A direct link outside the loaded page reads `GET /fields/{id}`. Selection fits the boundary or centres the saved point and marks it in yellow. Desktop shows the separate white detail panel and retains the same interactive map and list. Tablet shows a single contextual panel alongside the map. Phones use the existing three-detent sheet above the tab bar. Close and Escape return to the map, with focus restored. Malformed route IDs are rejected before a private request.                                                                                                                                                                            |
| Add field                   | A single primary action opens an opaque menu with five methods. The four F3 methods say they are coming in this release. Suggested outlines show the actual `fieldBoundaries` capability state. No save action appears before its workflow exists. The BG-6 demo action is absent because the capability and endpoint are unavailable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Map controls                | The source chip and Layers tool open the same popover. The search pill opens and focuses the field search. The right tool group contains Zoom in, Zoom out, Use my location and Layers. Wheel, pinch, double-click and double-tap use MapLibre's continuous camera handlers with zoom snapping disabled. Plus and minus animate for 300 ms, and arrows pan from the focused canvas. Reduced motion applies to camera operations and raster fades. Geolocation is read only when requested. Legend and NASA attribution are visible on the map.                                                                                                                                                                                                                                                           |
| Imagery and compare         | The map uses GIBS Terra MODIS true colour through source zoom 9 and Sentinel-2 HLS through source zoom 12. HLS is eligible at map zoom 9 and above. Gaps retain the Terra overview. The date stepper checks a 14-day window of UTC calendar days against the tile containing the map centre, with earlier windows and direct date entry. Only decoded tiles with visible pixels enter the stepper. The shared probe queue limits concurrent checks to eight and caches results for the running tab. Transparent tiles and missing days have a no-image state, while partial alpha and provider failures have separate copy. Two verified dates enable the comparison slider. Both views use the same camera, and the divider works with a pointer or keyboard. Overzoom carries a quiet resolution note. |
| Loading, offline and errors | Field loading has row-sized skeletons. List, boundary and comparison summary failures provide retry. An already-open workspace keeps its owner-scoped field data available in memory while offline. Geometry, area and comparison details use API data and the existing client validates responses. Full reload offline requires F11's service worker.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Differences and open work

- On direct map visits, the boot script starts loading the same-origin
  workspace and phone sheet. The map can render once the readiness,
  capabilities and account checks settle. The catalogue and glossary finish
  in the background. The WebGL renderer, its worker and phone spring code load
  after their respective surfaces mount. The tablet uses one adjacent panel so
  the field controls and the map each keep a usable interaction area.
- The GIBS capabilities XML advertises `.jpeg` for Terra MODIS. The build uses
  that spelling from the provider, and `.png` for HLS. Both use the planned
  matrix sets. The live checks confirmed an empty HLS tile with a successful
  response, a nonempty HLS tile, a missing day with HTTP 404, and Terra MODIS
  imagery with browser CORS. [NASA GIBS WMTS documentation](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- The globe has no vector basemap, roads or place labels pending BG-12. Saved
  field names are local annotations from zoom 13. F2 includes the selected
  field summary for S03. Editing, history, inputs, observations, sample points
  and NASA cell footprints belong to F3/F5/F8. Date coverage is measured from
  the centre tile's alpha channel. The imagery endpoints used here do not
  provide a per-tile cloud classification, so the map explains possible cloud
  and shadow without assigning a cloud score or declaring the ground clear.
- The contracts expose an owner-wide plans cursor with `fieldId` in each
  result and no `fieldId` query parameter. F2 walks those pages to find the
  newest item for each field and caches the summaries. Backend request for
  F5 and large accounts is an owner-scoped per-field plans filter or a batch
  latest-plan summary. No API, schema, database, migration or generated client
  changes were needed for F2.
- **Production deployment blocker.** The existing
  `infra/production/security-headers.conf` restricts `connect-src` and
  `img-src` to the application origin (plus data images). A scoped operations
  change must permit `https://gibs.earthdata.nasa.gov` for GIBS requests before
  this map can display imagery behind that header. The MapLibre worker is
  already served from the application origin. Local production preview
  verification uses its normal headers.
- The OneSoil pack stayed local. The UI uses the existing Rotavise tokens,
  self-hosted fonts and icons. French and English F2 keys were checked for
  parity. Native-language editorial review remains pending.

## Verification

Verification ran on 2026-11-11 with real process exit codes. Browser
tests use real fields created in a disposable PostgreSQL database through the
API. Deterministic imagery interaction tests replay documented NASA tiles from
`tests/support/fixtures/gibs`. A separate browser test checks live NASA imagery
in the painted canvas and permits only the application origin and GIBS.
Four-width screenshots and accessibility and DOM scans cover both languages.
The focused renderer test measures frame pacing during pan and zoom at
800 × 640 CSS pixels and checks intermediate fractional zoom levels and a
quarter-level wheel movement. Physical touch hardware and F3's painting-grid
benchmark are outside this run.

| Command                                                                                                                                                           | Exit | Result                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                                                                                                                                       | 0    | ESLint and browser import boundaries                                                               |
| `pnpm format:check`                                                                                                                                               | 0    | Repository formatting                                                                              |
| `pnpm typecheck`                                                                                                                                                  | 0    | All workspaces                                                                                     |
| `pnpm build`                                                                                                                                                      | 0    | Server and production web build                                                                    |
| `pnpm test:unit`                                                                                                                                                  | 0    | 403 tests in ten suites                                                                            |
| `ROTAVISE_BROWSER_WS=ws://127.0.0.1:39793 pnpm test:e2e`                                                                                                          | 0    | 43 tests in the initial final run                                                                  |
| `ROTAVISE_BROWSER_WS=ws://127.0.0.1:39793 pnpm exec playwright test --config tooling/web/playwright.config.mjs --project app --grep 'selected field and imagery'` | 0    | Selected field, layers and comparison across all four widths in French and English                 |
| `ROTAVISE_BROWSER_WS=ws://127.0.0.1:39793 pnpm test:e2e` (expanded suite)                                                                                         | 0    | 44 tests, including all four widths for selected fields and imagery controls in French and English |
| `pnpm design:budgets`                                                                                                                                             | 0    | Map shell 212,396 gzip bytes, or 213,742 with the phone sheet, below 250,000                       |
| `pnpm web:client:check`                                                                                                                                           | 0    | Existing generated client matches the contracts                                                    |
| `pnpm design:contrast`                                                                                                                                            | 0    | Semantic contrast pairs                                                                            |

The additional responsive case was followed by another complete browser run.
All 44 tests passed, including DOM scans and axe checks after user actions. Logs are retained locally under `.artifacts/f2-verification` and screenshots under
`.artifacts/playwright/test-results`.

On the final full browser run, the throttled phone profile used 4× CPU,
150 ms RTT and 1.6 Mbps download. Browser LCP was 1,848 ms in French and
2,308 ms in English, with observed input durations of 16 ms. The French LCP
candidate was the boot heading and the English candidate was the reminder.
These timings measure the application surface. Imagery completion depends on
NASA and is verified separately by the live painted-canvas test. The actual
renderer measured median frame spacing of 16.7 ms during pan and zoom, 16
intermediate fractional zoom values, and a 0.245-level change for one wheel
notch. The longest observed zoom frame was 33.3 ms, and the longest pan frame
was 16.8 ms. These measurements do not establish a sustained frame-rate
guarantee across devices. The deferred renderer plus worker total 371,590 gzip bytes.

Earlier checks exposed a missing workspace installation, strict prop typing,
a shared error-boundary regression, a canvas label race, hidden phone map
controls, a missing promoted feature ID for selection, and a phone load over
the timing budget. Each affected implementation was corrected and the checks
rerun. Vite still reports its upstream module-directive warnings and the
MapLibre chunk-size notice. The renderer is an explicit lazy chunk.

## Proposed DECISIONS and PROGRESS entries

- **DECISIONS.** Use a persistent, lazy MapLibre workspace for the map and
  field selection routes. Use the two NASA GIBS raster products, verify dates
  against the centre tile, keep the worker on the application origin and
  defer geographic context to BG-12.
- **PROGRESS.** F2 implements S03 with live imagery, local date discovery
  and comparison, the owner-scoped field list, field geometry and a separate
  selected-field panel. Review F2 in the browser and update production GIBS
  permissions in the deployment configuration before release.
