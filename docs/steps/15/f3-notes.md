# F3 field creation

2026-11-12 · branch `codex/fe-f3` · changes uncommitted and unpushed.

This is the explicitly requested F3 frontend slice, including the optional B2r
selector requested in this task. It does not close Step 12, authorize deployment,
or implement the subsequent field detail/history/input slices. User review is
pending. The existing F2 map stays mounted through creation and saving.

## Screens and controls

| Surface                | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S03 Add field          | Four working methods; Tap on the map appears only when `capabilities.fieldBoundaries.available` is true. The off state explains that suggestions are unavailable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| S04 layout             | A separate narrow white panel on desktop; on phones an embedded sheet with peek/half/full controls, initially full (up to two thirds of the map). The form scrolls independently of its Cancel/Save footer. The map, zoom, layers, locate and imagery controls remain available. Draft selections survive a change between phone and desktop and a live French/English switch.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Paint                  | Faint 30 m UTM grid from zoom 15, stronger pointer cell, add/remove direction fixed at stroke start, supercover interpolation, Alt/modifier or two-finger panning. Keyboard arrows move the cell and Space toggles it. New cells scale/fade over 280 ms; reduced motion is immediate. A same-origin worker generates visible grid geometry and processes the union, holes and simplification. The settled selection uses MapLibre feature state. A temporary canvas draws the brush preview during a stroke, and a vector layer draws the grid lines. Cell feedback is immediate. The worker recomputes the outline at most every 100 ms during a stroke and again on release. Live cell count and area are shown. A second component is rejected; holes under 1 ha are filled and labelled; larger holes need correction. |
| Draw                   | Map clicks add vertices; first point, double click or Close outline closes. Vertex drag, keyboard adjustment/deletion, midpoint insertion, Backspace, Undo/Redo, and a keyboard centre-point alternative. Optional snapping to suggested edges within 12 screen pixels, initially on when suggestions are available; without visible suggestions the reason is shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Upload                 | Local GeoJSON/JSON, KML and zipped shapefile parsing; MultiPolygons become separate fields. Names and other file properties are not rendered as HTML. Shapefiles require a matching `.prj`; Proj4js reprojects them. RFC 7946 uses WGS84; supported legacy named GeoJSON EPSG 4326/3857 and UTM 32601–32660/32701–32760 are explicitly reprojected. Unknown projections fail closed. Invalid polygons are reported individually, at most seven problems shown at once. File limit 10 MB; KML 1 MB; archive expanded-size admission limit 40 MB. KML DTD/entities are rejected. Files are not sent to providers.                                                                                                                                                                                                            |
| Pin                    | Click or Enter at the map centre selects a location without an outline. Area is explicitly unknown. The panel explains the outline requirement for NASA requests. Location-only comparisons remain a subsequent slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Optional B2r selection | From zoom 12, thin white outlines from real owner-authenticated zoom-14 tile reads, six requests in flight, session cache and overlap deduplication. Click/Enter calls `/field-boundaries/at`; selecting an already selected suggestion removes it. Empty coverage and `NO_FIELD_FOUND` offer manual methods. Hovering highlights a suggestion. Selecting an outline that extends outside the view fits it to the map. Selected outlines have the “Suggested outline: check it” chip, and attribution and limits explain that accuracy is unmeasured and confidence is regional. Edit, Reset and Merge controls use the shared geometry validation. Disconnected merges are refused.                                                                                                                                       |
| Selected fields        | Outline thumbnail, area, editable name, irrigation, Remove; optional last crop with a seven-result searchable picker using the real catalog and four-language names, planting and harvest dates. More than seven selections are paged. Dates and history use the shared contract. Variety is not stored in the v1 history contract and is not offered here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Save                   | Runtime-validated v1 profile and optional boundary in the same `POST /fields` request; `/fields-with-history` when the optional history is filled. Polygon location is its metric pole of inaccessibility, verified strictly inside. No follow-up boundary PUT. Successful rows are marked and never reposted during partial-save recovery. Cache invalidation and navigation open the existing S05 panel, focus the field and show a success toast. A new creation action dismisses the preceding toast so it cannot cover edit controls.                                                                                                                                                                                                                                                                                 |
| Error/cancel states    | Shared translated service errors, 409 explanation, Retry-After countdown, unavailable planning capability, offline Save disabled, invalid names/history/geometry. Cancel/Escape closes the workflow; requests/workers are cancelled on unmount. An ambiguous network or invalid-response result after POST blocks blind resubmission and links to the saved list.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Geometry and real HLS evidence

The real Tadla granule `HLS.S30.T29SQR.2025122T105619.v2.0` has
`proj:transform = [30, 0, 699960, 0, -30, 3600000, 0, 0, 1]`, EPSG 32629.
Its offsets are multiples of 30; no alternative anchor was needed. An independent
zone-15 granule is checked too. Tests compare projected pixel corners and centres,
not an assumed approximate degree spacing. Exact upstream metadata and hashes
are preserved under
[HLS grid evidence](../../evidence/earth-observations/2026-11-11/hls-grid/tadla-stac.json);
formatted test copies and source links are in
[fixture notes](../../../tests/support/fixtures/hls/README.md).

The grid uses the local UTM zone with HLS signed northing. Neighboring-zone raster
overlap can have another lattice; this does not promise alignment with every
overlapping acquisition. HLS imagery availability and accuracy are separate from
this geometric check. Boundary limits are the contract's 0.1–1,000 ha, maximum
0.1-degree span, one simple outer ring, 200 vertices plus closure. Exact collinear
collapse precedes Douglas–Peucker simplification, at most 15 m tolerance and 2%
area change; failure to meet all limits is rejected. Small-hole filling is
explicitly disclosed separately from simplification. `boundarySamplePoints`
provides the warning when the shared sampler finds no usable inset point.

## Contract precedence and limitations

- B2r supersedes the proposed detector: no `/field-detection`, 202/computing flow,
  automatic outline fallback, polygon accuracy confidence tiers or invented
  country coverage. It uses the actual `/field-boundaries/tiles/14/{x}/{y}` and
  `/field-boundaries/at` schemas. Suggestions are optional and depend on an
  operator import. Tests import the existing **real** FTW sample into disposable
  PostgreSQL; production code has no fixture or sample selection data.
- B0 already accepts the boundary atomically. The pre-BG-14 two-request failure
  state is superseded. Two-pin partial-save recovery is tested separately.
- Creation has no expectedVersion/idempotency-key contract. A real create-version
  conflict cannot be manufactured through valid create inputs. The 409 UI uses
  a controlled transport failure, then retries the real API. Multi-field saving
  is sequential, not a transaction across fields.
- Existing S05 remains the F2 summary; full NASA request gating, field inputs,
  editable history, plan building and persisted boundary editing belong to F5+.
  This slice edits selected unsaved shapes, not stored boundary versions.
- No country dataset, new service account, API credential, external deployment,
  production write, proprietary asset or external font was added. Imagery remains
  the F2 NASA GIBS source. FTW provider readiness is not inferred from capability.
- French/English additions remain machine-written pending native-speaker review.
  Performance observations are a controlled local browser measurement, not a
  device-wide frame-rate or network guarantee.

## Verification

The checks below ran on 2026-11-12 from `codex/fe-f3`. Process exit codes and
logs for the resumed run are in `.artifacts/f3-verification/recorded/`.

| Command                                                  | Exit | Result                                                                                        |
| -------------------------------------------------------- | ---: | --------------------------------------------------------------------------------------------- |
| `pnpm lint`                                              |    0 | ESLint and browser import boundaries                                                          |
| `pnpm format:check`                                      |    0 | Prettier                                                                                      |
| `pnpm typecheck`                                         |    0 | Workspace TypeScript                                                                          |
| `pnpm build`                                             |    0 | Server prerequisites and production web bundle                                                |
| `pnpm test:unit`                                         |    0 | 415 tests across 11 suites                                                                    |
| `pnpm design:budgets`                                    |    0 | F3 phone shell 228,333 gzip bytes, below 250,000. Map and editor renderer chunks remain lazy. |
| `pnpm web:client:check`                                  |    0 | Generated client matches the checked-in contracts                                             |
| `pnpm design:contrast`                                   |    0 | Semantic contrast pairs                                                                       |
| `ROTAVISE_BROWSER_WS=ws://127.0.0.1:60546 pnpm test:e2e` |    0 | 67 browser tests passed, including all 23 F3 cases                                            |

Browser tests use disposable real PostgreSQL and the actual built API. Recorded
NASA tile responses are confined to browser tests, with a separate F2 live GIBS
check. The macOS sandbox blocks native Chromium's Mach-port registration, so
Playwright connects to an isolated local Chromium server in Docker.

Browser tests use the built API and disposable PostgreSQL. The native browser
cannot register a Mach port in this sandbox, so Playwright connects to a local
Chromium server in Docker. Recorded NASA tile responses stay in browser tests.
The live GIBS case renders actual imagery and checks the requested origins.

The final browser run completed in 12.3 minutes. The map's throttled phone LCP
was 1,960 ms in French and 1,976 ms in English, below 2,500 ms. The brush benchmark
with 2,000 selected cells measured 16.7 ms median frame spacing, 83.4 ms longest
frame and 50.5 ms maximum worker round trip across 11 jobs. Its median passed
the 18 ms threshold. Each command's `.exit` file records its process status.

The previous full browser log in `.artifacts/f3-verification/completed/`
reports 67 passes. Map LCP measured 1,948 ms in French and 1,956 ms in English.
The brush benchmark measured 16.7 ms median frame spacing, 50 ms longest frame,
and 35.1 ms maximum worker round trip across 10 jobs with 2,000 selected cells.
The interruption left no `pnpm test:e2e` process exit code in that run's result
file. The resumed run records the exit code for every command separately.

Earlier logs below are relative to `.artifacts/f3-verification/`.

| Earlier verification log             | Outcome                                  | Cause and correction                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resumed/pnpm-test-e2e.log`          | 64 of 67 passed, process code unrecorded | Save disabled all input targets in a scroll region, painting missed the frame budget, and map LCP exceeded 2.5 s. The scroll region stays keyboard-focusable during Save.                                       |
| `repairs/resume-focused.log`         | Exit 0, four cases passed                | Painting used one renderer and waited for the grid to load before measuring. Median frame spacing was 16.7 ms against the existing 18 ms threshold. Both map languages and the keyboard-accessible save passed. |
| `final/pnpm-test-e2e.log`            | Exit 1, 65 of 67 passed                  | One test inherited the previous case's IP rate counter. An opaque black MODIS tile was also accepted as imagery.                                                                                                |
| `repairs/final-recovery-imagery.log` | Exit 0, three cases passed               | Both ambiguous write cases and the live NASA rendering case passed after the changes below.                                                                                                                     |
| `final-verified/pnpm-test-e2e.log`   | Exit 1, 66 of 67 passed                  | English map LCP reached 2,748 ms. Direct map visits now preload the map stylesheet and medium UI font. The welcome display font is requested on the welcome route.                                              |
| `repairs/critical-map-assets.log`    | Exit 0, four cases passed                | Throttled welcome LCP measured 2,148/2,024 ms and map LCP 2,064/2,008 ms (fr/en) against the existing 2,500 ms threshold.                                                                                       |

Painting uses a separate worker-generated grid-line source and caches unchanged
selected cells in a bitmap during a stroke. The settled selection uses a
MapLibre fill with feature state. This differs from the plan's single grid
source and avoids redrawing every selected cell path per frame. The frame
measurement describes the tested browser profile.

The field creation fixture clears `plan_quotas` between independent cases in its
disposable database, matching the integration tests. Real limits still apply
within each case and explicit 429 coverage remains. The live GIBS check found
that the 12 November MODIS centre tile returned HTTP 200, 1,665 bytes, and a
single black colour. The 11 November tile contained 3,653 colours. The MODIS
probe now rejects an entirely black JPEG and selects an available date. HLS
still uses alpha to check coverage. The unit test covers both behaviours. Live
response evidence is under `.artifacts/f3-verification/gibs-2026-11-12/`.

The welcome screen starts reference reads alongside rendering. The design
interaction test has a longer overall timeout and retains its assertion
deadlines. Throttled browser tests restore their profile settings. The file
picker uses a French or English button from the active app language. The S03
menu assertion now checks working methods in place of coming-soon labels.
Screenshots are under `.artifacts/playwright/`.

## Demo commands

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `/map`, Add a field, then choose a method; or open `/fields/new?mode=paint`,
`draw`, `upload` or `pin`. Zoom to your field before painting (grid from zoom 15).
Planning must be enabled and the existing database reachable. No new credential
is required. FTW suggestions require the existing optional backend configuration
and operator import; this task does not enable or seed a persistent installation.

For isolated verification use `pnpm test:e2e`; in this sandbox the run uses
`ROTAVISE_BROWSER_WS=ws://127.0.0.1:<local-port>` with a locally started
`mcr.microsoft.com/playwright:v1.63.0-noble` browser server. Never reuse the
reported port as a permanent configuration.

## Backend requests

Consider an idempotency key for field creation (and optionally a batch transaction)
so a lost POST response can be retried safely. Current UI explains the ambiguity
and requires checking the saved list. No backend changes were made or regenerated.
The fields HTTP handler also reports `Retry-After: 86400` for its 120-per-minute
IP limit, discarding that limiter's 60-second retry value. Preserve the actual
limiter retry duration when setting that header. This is a backend request; the
frontend displays the real header rather than inventing a shorter wait.

The lack of automated detection/fallback is the documented B2r product limit,
not a frontend endpoint to invent.

## Proposed DECISIONS and PROGRESS text

- **DECISIONS:** Use a persistent map with a contextual creation panel, local
  worker-based 30 m UTM painting verified against real HLS metadata, browser-only
  outline import and metric pole-of-inaccessibility location. Save the shared
  validated boundary atomically with the profile. Surface optional FTW suggestions
  as unmeasured suggestions with their attribution and regional-confidence limit.
  Stop blind retries after ambiguous creation responses.
- **PROGRESS:** F3 implements S04 paint, draw, upload, pin, optional B2r selection
  and atomic save with optional crop history. All required checks passed. The
  changes are uncommitted and ready for review.
