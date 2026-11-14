# FM — map imagery and usability, 2026-11-12

Status: frontend implementation and required checks verified; ready for scoped review. The 10 m imagery does not meet OneSoil-like field sharpness, and the cold-paint/native-GPU acceptance limits below remain open.

User-authorized FM follow-up on `codex/fe-fm`, limited to the requested frontend, tests, tooling and documentation. No backend source changes, milestone approval, commit, push or deployment.

## Preserved work and evidence

The interrupted run preserved 90 baseline renderer captures, six blocked-shell captures, six live EOX/HLS side-by-side comparisons and an initial 90-capture after matrix. Visual QA caught a missing stylesheet in the isolated provider harness. It now loads the real built styles and rejects incomplete tiles. The six final comparisons were regenerated successfully and inspected; both maps report loaded tiles at each zoom. Baseline evidence is not being regenerated. The final after matrix was refreshed and reviewed. Source OneSoil screenshots remain local in `.research-sources/onesoil-reference/` and are not copied into deliverables.

The real disposable PostgreSQL API returned readiness 503 because the national climate/GRACE/GEDI datasets are absent from the browser-test harness. The original shell therefore never mounted its map. `before/shell-*.json` and `shell-blocked-*.png` preserve that actual failure. The 90 baseline map screenshots mount the **unchanged original renderer in isolation** inside that blocked shell, with its MODIS `default` source; they are not evidence of a working original full app or of its HLS date-probing workflow. No readiness response or imagery was fabricated for these captures.

Evidence root: [live captures](../../evidence/live/2026-11-12-fm/). Each matrix covers Tadla (-6.55, 32.40), Beni Mellal (-6.34, 32.37), Gharb (-6.30, 34.30), zooms 10/12/14/15/16, 1440×900, 768×1024, 390×844, DPR 1 and 2 (90 combinations). JSON records source definitions, actual canvas dimensions, tile completion and load timings.

## Findings and measured causes

- Original MODIS source: 250 m pixels, tileSize 256, maxzoom 9. Original HLS: 30 m pixels, tileSize 256, maxzoom 12. Comparing numerical z16 with source limits gives 128× and 16× respectively. More precisely, MapLibre 5.24 uses a 512-pixel world tile and `cameraZoom + log2(512 / sourceTileSize)`: a 256-pixel source at camera z16 requests coverage level 17. Thus a max9 texture is stretched 256× in CSS pixels, max12 32×, and EOX max15 4× (its delivered z15 is already resampled from native 10 m data). DPR adds display samples without increasing this native resolution. Increasing source maxzoom cannot invent detail.
- Original raster interpolation was the default linear resampling. Raster fade was 220 ms, blending parent/child textures during transition; map style/collision fade used the separate 300 ms default. The map allowed camera z21 despite much coarser imagery. Tile caching was automatic (no explicit limit), not a measured independent blur defect. The source resolution is the dominant confirmed cause; changing cache or fade cannot recover missing pixels.
- No CSS canvas scaling defect was found. Intrinsic canvas dimensions follow CSS dimensions times DPR. Retina doubles rendering samples, not the source image's native detail. EOX serves 256-pixel JPEG tiles and has no verified @2x endpoint; no fictitious retina URL is used.
- Each site made 14 centre-tile probes in two parallel batches; both selected nonempty imagery dated 2026-11-01. The final Tadla run returned seven HTTP 404s, five fully transparent tiles and two nonempty tiles; Beni Mellal returned seven HTTP 404s, one HTTP 500, four transparent and two nonempty tiles. These are recorded service results, not seven invented empty scenes. Alpha/nonempty probing does not detect clouds: the date list must not imply cloud-free scenes. The saved provider comparison shows actual imagery, not replacement fixtures.
- The original readiness gate blocked the whole shell. Unconditional `/account` on an auth-disabled installation returned 404. Map child routes lacked elements and emitted React Router leaf warnings. These were frontend causes; no backend status was falsified.
- The original tablet shell displayed its header and tab bar instead of a compact rail/list/map arrangement. Phone Add field was buried below the sheet peek. Loading was text without a stable final map skeleton. Multiple status banners consumed the workspace. The layer controls exposed NASA's technical product/date choices before a usable base photo.

## Provider decision and legal limits

**EOxCloudless 2025 is the best verified key-less candidate for this non-commercial prototype, but it does not meet OneSoil-like field sharpness.** Its 10 m Sentinel-2 pixels improve on 30 m HLS and 250 m MODIS; at z16 they remain visibly soft. The source's z15 response is resampled imagery, not native z15 detail. This limitation remains an acceptance gap, not a claim of sub-metre imagery.

[EOX pricing](https://cloudless.eox.at/pricing), [FAQ](https://cloudless.eox.at/documentation/faq), [usage](https://cloudless.eox.at/documentation/usage): the public endpoints allow direct application use under CC BY-NC-SA 4.0 for 2018–2025; 2016 is CC BY 4.0. 2025 was the newest listed public vintage checked in this run. Non-commercial permission is appropriate to the authorized local prototype; the application being open source does **not** authorize later commercial use. Commercial deployment requires a different provider or licence review. No account/key was created, no service bought, no SLA claimed.

Exact displayed credit: **EOxCloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)**, with EOxCloudless linking to https://cloudless.eox.at. Tile layer: `s2cloudless-2025_3857`, `GoogleMapsCompatible`, 256 px, source maxzoom 15. EOX describes native EPSG:3857 coverage through z14; overzoom is explicitly acknowledged.

Other candidates:

| Candidate               | Evidence and outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NASA GIBS HLS / MODIS   | Real comparisons retained as analysis/date layers. HLS 30 m max12, MODIS 250 m max9; neither can be the field photo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| NASA Landsat WELD       | Official GIBS capabilities expose historical annual 1983–2000 and monthly imagery, max12; not a finer current field base.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Esri World Imagery      | Official item licence links to [Esri terms summary](https://goto.arcgis.com/termsofuse/viewsummary). An anonymously reachable service is not sufficient permission for this non-Esri application. [MapLibre integration](https://developers.arcgis.com/maplibre-gl-js/get-started/) requires an account/access token. Excluded before tile requests; no unauthorized comparison screenshot. A free Location Platform account may resolve access, subject to its tier/terms and real Moroccan coverage evaluation. User was asked about an existing account; no secret requested or received. |
| OpenAerialMap           | Real Tadla/Beni bbox query returned two roughly 278 m weather rasters, not suitable aerial photos. Incomplete local coverage cannot provide a consistent Moroccan base. [API documentation](https://docs.openaerialmap.org/api/api/).                                                                                                                                                                                                                                                                                                                                                        |
| Google / Bing / OneSoil | No tiles requested or reused. OneSoil screenshots used only as local visual references.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Orientation uses [OpenFreeMap](https://openfreemap.org/): public key-less tiles, commercial use allowed, no registration/cookies, no SLA. TileJSON and glyphs stay on `tiles.openfreemap.org`; no tile hosting is added. OSM data is ODbL; OpenMapTiles and OpenFreeMap attribution is displayed. French and Arabic names are used when present, with a two-pixel halo. MapLibre 5 requires the bundled deferred Mapbox RTL 0.3.0 plugin; its BSD-2-Clause and Unicode/ICU notices ship in `/licenses/mapbox-gl-rtl-text.txt`.

## Implementation

EOX is the default base across world and field zooms. NASA HLS/MODIS remain explicitly selectable, with existing real-date probing, date stepping and compare. EOX stays underneath transparent NASA gaps; unverified `default` NASA tiles are hidden. Compare alone creates a second map. Roads/labels load after the base renderer.

Raster fades are zero; NASA uses nearest resampling to preserve its honest coarse pixels; the photo uses linear interpolation for smooth overzoom. Source limits stay provider-specific. Cache limit is 256 tiles and five zoom levels; pending requests survive zoom changes so sharp cached tiles remain reusable. MapLibre uses actual device DPR and resizes through ResizeObserver. There is no CSS canvas transform. Sharpness is bounded by provider data; parent-tile reuse during zoom still cannot provide missing native field detail.

The shell renders immediately. Initial health checks use API liveness; full national-data readiness is checked in service details, where failures remain visible. Account reads wait for capabilities and are skipped when auth is off. One compact, dismissible status chip contains Retry and a detail popover. Feature failures stay local. Map child routes have explicit empty elements. WebGL failure has a clear fallback/retry; a full-map skeleton covers renderer startup.

The original zoom/locate/layer hit boxes were 36 px. They are now 40 px (44 px on phone), with visible focus and keyboard access. The 14 px base, weights 400/500, 8 px control corners and compact dark map pills are retained. The rail is 64 px; the normal list is 290 px on desktop and 250 px on tablet. Map buttons animate for 300 ms; locate/field selection fly for 600 ms, reduced-motion respected. Native MapLibre wheel rates are 1/320 (about 0.245 levels per 120-unit notch); pinch remains native continuous input. Desktop/tablet use rail, field list and map; phone sizes the actual canvas to the space above the current sheet detent and uses a bottom sheet with an exposed Add field action and bottom tabs. The layer menu starts with Satellite photo or NASA image and explains NASA's 30 m/cloud limit. Attribution remains linked and visible.

## Before / after review

All 90 after views were reviewed as a contact sheet, with native-size desktop, tablet, phone and z14–16 provider comparisons inspected separately. All 90 reported tiles loaded. No after context recorded a console error, HTTP error response or unapproved host on normal map load; one software-GL context recorded four `ReadPixels` performance warnings. These warnings remain in the evidence. The 90 before views are isolated renderer evidence, not a comparable working shell.

[All 90 paired links](../../evidence/live/2026-11-12-fm/comparisons.md) include every width and DPR. Representative field-level comparisons below use 1440×900 / DPR1.

| Place / zoom     | Original MODIS renderer                                                              | Full app with EOX                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| tadla / 14       | [Before](../../evidence/live/2026-11-12-fm/before/tadla-z14-1440x900-dpr1.png)       | [After](../../evidence/live/2026-11-12-fm/after/tadla-z14-1440x900-dpr1.png)       |
| tadla / 15       | [Before](../../evidence/live/2026-11-12-fm/before/tadla-z15-1440x900-dpr1.png)       | [After](../../evidence/live/2026-11-12-fm/after/tadla-z15-1440x900-dpr1.png)       |
| tadla / 16       | [Before](../../evidence/live/2026-11-12-fm/before/tadla-z16-1440x900-dpr1.png)       | [After](../../evidence/live/2026-11-12-fm/after/tadla-z16-1440x900-dpr1.png)       |
| beni-mellal / 14 | [Before](../../evidence/live/2026-11-12-fm/before/beni-mellal-z14-1440x900-dpr1.png) | [After](../../evidence/live/2026-11-12-fm/after/beni-mellal-z14-1440x900-dpr1.png) |
| beni-mellal / 15 | [Before](../../evidence/live/2026-11-12-fm/before/beni-mellal-z15-1440x900-dpr1.png) | [After](../../evidence/live/2026-11-12-fm/after/beni-mellal-z15-1440x900-dpr1.png) |
| beni-mellal / 16 | [Before](../../evidence/live/2026-11-12-fm/before/beni-mellal-z16-1440x900-dpr1.png) | [After](../../evidence/live/2026-11-12-fm/after/beni-mellal-z16-1440x900-dpr1.png) |
| gharb / 14       | [Before](../../evidence/live/2026-11-12-fm/before/gharb-z14-1440x900-dpr1.png)       | [After](../../evidence/live/2026-11-12-fm/after/gharb-z14-1440x900-dpr1.png)       |
| gharb / 15       | [Before](../../evidence/live/2026-11-12-fm/before/gharb-z15-1440x900-dpr1.png)       | [After](../../evidence/live/2026-11-12-fm/after/gharb-z15-1440x900-dpr1.png)       |
| gharb / 16       | [Before](../../evidence/live/2026-11-12-fm/before/gharb-z16-1440x900-dpr1.png)       | [After](../../evidence/live/2026-11-12-fm/after/gharb-z16-1440x900-dpr1.png)       |

The clearer field shapes and crisp vector names are an improvement; visible softness at z15–16 is still present. Retina does not recover the missing image detail. The baseline renderer had no field-list panel because its shell could not reach ready.

| Viewport / DPR | Before CSS → canvas px | After CSS → canvas px | Navigation → canvas |
| -------------- | ---------------------- | --------------------- | ------------------- |
| 1440×900 / 1   | 1376×900 → 1376×900    | 1085×852 → 1085×852   | 887 ms              |
| 1440×900 / 2   | 1376×900 → 2752×1800   | 1085×852 → 2170×1704  | 552 ms              |
| 768×1024 / 1   | 768×912 → 768×912      | 453×976 → 453×976     | 541 ms              |
| 768×1024 / 2   | 768×912 → 1536×1824    | 453×976 → 906×1952    | 1166 ms             |
| 390×844 / 1    | 390×716 → 390×716      | 390×528 → 390×528     | 383 ms              |
| 390×844 / 2    | 390×716 → 780×1432     | 390×528 → 780×1056    | 451 ms              |

After-camera-change idle times across the 90 captures were 31–2431 ms (median 207.5 ms). These sequential captures reuse provider/browser caches; they are **not cold first-sharp-paint timings**. The 2,431 ms maximum already prevents claiming an unconditional two-second tile-load guarantee. Navigation-to-canvas is 383–1,166 ms, and measures renderer availability rather than image sharpness.

## Verification

All required commands completed successfully. [Exact exit codes and timestamps](../../evidence/live/2026-11-12-fm/checks/results.json), [full logs](../../evidence/live/2026-11-12-fm/checks/), and the [Playwright JSON report](../../evidence/live/2026-11-12-fm/checks/playwright-report.json) are retained. The reporter flag only records evidence; it does not select or omit tests.

| Command                              | Exit | Result                          |
| ------------------------------------ | ---- | ------------------------------- |
| `pnpm lint`                          | 0    | boundaries and ESLint           |
| `pnpm format:check`                  | 0    | repository formatting           |
| `pnpm typecheck`                     | 0    | all workspace types             |
| `pnpm build`                         | 0    | server and web production build |
| `pnpm test:unit`                     | 0    | 423 tests / 12 suites           |
| `pnpm test:web`                      | 0    | 388 tests / 10 suites           |
| `pnpm test:map`                      | 0    | 9 FM tests                      |
| `pnpm test:e2e --reporter=list,json` | 0    | 83 passed; zero failed/skipped  |

`pnpm map:evidence` and `pnpm map:providers` also exited 0. The targeted field-detail run passed all seven cases after its setup correction. [Capture/targeted command records](../../evidence/live/2026-11-12-fm/checks/evidence-runs.json). No backend source was changed.

Earlier failures were corrected, not filtered: mobile landmark semantics, the auth-disabled account 404, obsolete blocking-health assertions, and attribution/sheet overlap that intercepted phone drawing. The fractional-wheel assertion now counts every intermediate value, rather than discarding the upper part of the quarter-level gesture. A responsive reparent had also scheduled heading focus after the user opened a map control; focus now runs once per newly selected field and respects later user focus. The two affected flows passed three consecutive runs. The field-detail setup had polled national-data readiness forever in a deliberately incomplete database; it now starts on liveness and retains the default hook timeout and every real feature assertion. The prior full run (76 passes, one setup failure, six not run) is [archived](../../evidence/live/2026-11-12-fm/checks/previous/readiness-gate-e2e.log).

Chromium ran through the pinned Playwright Docker browser server because native Chromium was denied the macOS bootstrap port by the sandbox. PostgreSQL, API responses and provider tiles were real. Controlled outage/fixture cases remain in tests only. Upstream Radix bundler directives and software-driver warnings remain visible in logs.

### Performance and React commit profiling

[Raw six-viewport/DPR profiles](../../evidence/live/2026-11-12-fm/fm-profile.json) include the renderer identity, complete wheel samples, canvas dimensions and timings. The test-only React DevTools hook measures root commits; production component-duration profiling is not claimed.

Across six fresh contexts, the 650 ms wheel gesture caused exactly one React root commit per context and showed 3–9 distinct intermediate zoom values. There is no per-frame React rendering. Navigation-to-field-tile/label idle was 1334–2012 ms; camera-change-to-idle was 943–1577 ms. These timings do not turn the 10 m image into a sharp field photograph and do not establish a universal cold-cache two-second guarantee.

The single real map benchmark observed pan/zoom median frame intervals of 16.7/16.7 ms (about 60 fps median), worst intervals 33.4/33.3 ms, 17 intermediate button-zoom values, and 0.245 levels per 120-unit notch. The 2,000-cell paint test observed 16.7 ms median, 49.9 ms worst, and 33.1 ms maximum worker time. Software rendering and occasional longer frames mean sustained native-GPU 60 fps remains unproven.

## Remaining limits and backend requests

- Main unresolved gate: 10 m imagery is not fine enough to match the supplied OneSoil field photo. A lawfully accessible finer provider/account is required; increasing maxzoom is not a resolution fix.
- The first field-tile/label idle timings are recorded above; they are not a direct measurement of first sharp pixels or a universal cold-cache guarantee. Sustained native-GPU 60 fps remains unproven; the measured software-Chromium frame pacing and React commit counts are reported explicitly.
- No cloud-quality classifier or guaranteed daily imagery is introduced.
- Backend request **B-FM-1 (not implemented here):** expose a contracted optional-session/account-presence read that returns HTTP 200 with an anonymous state, or contract the existing optional-session route. The current auth-enabled anonymous `/account` can return an expected 401 and a browser console resource error; the auth-disabled harness is clean. Avoiding this in all auth modes needs that discovery contract, without weakening account authentication.
- Full national data readiness remains correctly unavailable in the minimal browser harness. No backend implementation or database changes were made in this task.

## Review and demo

Use `pnpm dev` with the existing real API configuration and open `/map`. `pnpm test:map` runs the FM checks; `pnpm map:evidence` captures the after matrix against a disposable real API; `pnpm map:providers` captures the six live source comparisons. The before command requires the original built snapshot captured at `/tmp/fm-baseline-dist`; preserved before images are the durable baseline.

The baseline was built from clean HEAD `320f66e2a3a85e082609b94b3d11f9f30f6c4c54`. In the restricted Mac environment, run the pinned browser server from the repository root in a separate terminal, then provide its address to any browser command:

```sh
docker run --rm --init --name rotavise-fm-browser \
  -p 127.0.0.1:53671:3000 --ipc=host -v "$PWD:/work:ro" -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 \
  node node_modules/@playwright/test/cli.js run-server --host 0.0.0.0 --port 3000
ROTAVISE_BROWSER_WS=ws://127.0.0.1:53671 pnpm test:map
```

All changes remain uncommitted and unpushed. Review is requested after final verification; no user approval is recorded here.
