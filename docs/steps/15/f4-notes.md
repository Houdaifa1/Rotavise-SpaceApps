# F4 field detail, history, inputs and crop catalog

Branch `codex/fe-f4`. This report covers the field and crop work explicitly named
in the F4 task prompt. The older slice table in Part 9.2 assigns field detail to
F5 and detection to F4. The individual prompt governs this branch. Work remains
uncommitted and unpushed for review.

## Screens and controls

| Surface                 | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S05 workspace           | The map, field list and contextual detail are distinct siblings at 1024 px and above. Tab changes preserve the map canvas and selected field. Tablet shows a detail panel beside the map. Phone opens the existing bottom sheet at its full two-thirds detent so the first tab content is visible. `/fields/:id?tab=` and `/fields/:id/history` are direct links. The header uses the saved name, boundary area and rounded coordinates. Closing returns to the fields workspace.                                                                                                                                            |
| S05 field actions       | The pencil and field action menu start an inline rename. Enter and blur save a changed name with the field's `expectedVersion`. A 409 reloads the field and offers an explicit reapply. Reapply merges the name into the latest profile. Delete asks for confirmation and calls `DELETE /fields/{id}`. Edit outline uses the existing map editor and its keyboard vertices, validates the outline against the saved point and calls the versioned boundary PUT.                                                                                                                                                              |
| S05 overview            | The checklist links to history, inputs and outline editing when the corresponding information is absent. A latest-comparison chip opens Plans. The comparison action explains its availability in the panel.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| S05 NASA request cards  | The six rows read the two job lists. Ask sends the exact `{kind}` through the matching observation or extraction POST. The UI shows the saved creation and completion timestamps, a manual status GET and provider errors. Waiting jobs poll every 30 seconds for the first ten minutes and every two minutes afterward, while Overview or NASA is open. Polling pauses in hidden tabs and terminal jobs stop polling. Completed jobs invalidate dependent analysis. The regional disclosure reads GRACE and GEDI independently when opened and shows the server's coverage reasons.                                         |
| S05 NASA evidence       | Ready jobs expose HLS greenness by year with seasonal bands, usually-low periods, latest anomaly status and quality notes. MODIS shows the seasonal shares, typical periods and trend/agreement. Rain compares the IMERG and POWER series. SMAP shows both soil moisture series with explicit missing percentiles. Terrain, ECOSTRESS, GRACE and GEDI show their returned field or regional measurements, limitations and product attribution. Charts are lazy-loaded and include the existing text alternative and keyboard interaction.                                                                                    |
| S05 Plans               | The panel reads owner-scoped summary pages, filters by the field's returned ID, and shows newest-first summaries and status. Expand a row to see its date and horizon when available. The comparison builder and full result screen belong to later frontend work.                                                                                                                                                                                                                                                                                                                                                           |
| S06 history             | The latest four seasons and their gaps form a duration-weighted crop strip using `cropColor`. The full history is accessible in seven-row pages. Strip and list buttons open the same dialog. Crop, planting and harvest are checked through `cropHistoryEntrySchema`. Saving reads all cursor pages before checking for inclusive overlap. The server also enforces overlap transactionally. Updates preserve the draft across a version conflict, and deletion requires confirmation. The optional variety selector explains the v1 history payload.                                                                       |
| S07 soil                | Add, edit and remove pH, organic matter and texture. The editor records the v1 method, date and source fields, and admits one reading of each metric. Removing the final reading sends `status: "unknown"`. The SoilGrids section reads a saved completed comparison's estimate when present and labels it as an estimate.                                                                                                                                                                                                                                                                                                   |
| S07 water               | The four choices send the v1 unknown or reported availability object. The panel explains how allocation relates to a comparison.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| S07 crop health         | Add, edit and remove reports. The shared picker chooses the crop. The crop detail lookup supplies listed disease and pest options, and the farmer can enter an observation in their own words. The confirmation control follows the reporter and the shared profile schema validates duplicate and invalid reports.                                                                                                                                                                                                                                                                                                          |
| S15 picker and settings | Search checks every recorded English, French, Arabic and Darija name and the scientific name. Normalization removes Arabic diacritics and tatweel and folds alef forms. A family filter and a windowed keyboard-operable list work against the real catalog options. The standalone catalog uses the normal app navigation without a second context column. Recently recorded crops come first in history. The preference is stored locally and available in the picker and account route. Primary and secondary names follow the configured preference, with inline bidirectional isolation and low-confidence underlining. |
| S15 crop detail         | The route reads the immutable versioned endpoint. It shows identity, available names, family, model type, calendar and rotation rules, reported problems, varieties, citations and limitations. Research releases display all twelve returned effect selections with their evidence class, recorded confidence, selected findings and gaps. The role explanations and citations come from the endpoint in the active interface language. The panel renders an explicit no-data state for older releases without research.                                                                                                    |

## Contract precedence, follow-ups and limitations

- The field profile is v1. It has no salinity, allocation, structured `issue_id`
  or persisted history variety. The crop health UI stores the endpoint's
  recorded name for supported listed issues. A v2 field profile and a versioned
  history variety field would enable those values to persist. The current v1
  history writes also reject future harvest dates at the server.
- Catalog options have no `modelType`. Crop detail carries it for one crop.
  Request an additive options field for the model-type filter. The public crop
  detail contract has no owner-specific usage count. Request a separate private
  usage summary for the requested “Used in” count.
- `GET /plans` accepts cursor and limit. There is no `fieldId` query parameter.
  The field view filters the returned plan summaries. A server-side filter
  would avoid scanning other comparisons. The F4 panel exposes summaries while
  S09 submission and full plan navigation await their own slice.
- The backend needs outlines for HLS and the three extractions. GPM and SMAP
  accept location-only fields. The backend currently counts observations and
  extractions in separate ten-request daily quotas, reflected in the copy.
  This task binds to the installed backend and introduces no provider or key.
- This slice uses cached read-only data when offline. The service worker,
  persistent offline writes and replay are later work. An idempotent history
  create would support safer replay after an ambiguous network failure.
- The field-level NASA view covers datasets available to a saved field. The
  plan-specific evidence tabs, sample-grid overlays and additional weather
  chart remain later work. Crop history uses a short recent strip above the
  paged full history. The old F3 creation picker retains its existing control
  behavior and shares the search normalizer.
- Catalog passages, findings and citations retain their recorded wording. UI
  chrome, evidence labels and glossary headings are French and English. For
  the gap text that refers to the JSON null sentinel, the UI renders
  “an unrecorded value” to keep the explanation readable and pass the DOM
  scan. Structured research income is outside this crop-detail task. No
  translation or agronomic review is claimed.
- Regional data coverage depends on operator imports. Live Earthdata requests
  require the configured Earthdata Login credentials. Browser verification
  uses the real API and disposable PostgreSQL, with a replay of recorded
  AppEEARS files and controlled provider errors. Live provider readiness and
  wait times remain unverified.

## Verification

Checks run on 2026-11-12. Full-run logs and process exit codes are recorded under
`.artifacts/f4-verification/resumed/`. The standalone picker styling follow-up
records its reruns under `.artifacts/f4-verification/picker-style/`.

| Command                                                                                      | Exit | Result                                                                                             |
| -------------------------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                                                                  |    0 | ESLint and browser import boundaries                                                               |
| `pnpm format:check`                                                                          |    0 | Repository Prettier check                                                                          |
| `pnpm typecheck`                                                                             |    0 | Workspace typecheck                                                                                |
| `pnpm build`                                                                                 |    0 | Server prerequisites and production web bundle                                                     |
| `pnpm test:unit`                                                                             |    0 | 423 tests in 12 suites. Covers exact input bodies, crop search and naming, overlap and polling.    |
| `pnpm test:e2e` with local Playwright websocket                                              |    0 | 74 tests including seven F4 cases. Disposable PostgreSQL, real HTTP, axe and the DOM scan.         |
| `pnpm test:e2e field-detail.spec.mjs --grep 'S06\|S07\|S15'` with local Playwright websocket |    0 | Three tests passed for history, inputs and catalog after the standalone picker search styling fix. |
| `pnpm design:budgets`                                                                        |    0 | First-screen gzip budgets for map, detail and crops                                                |
| `pnpm design:contrast`                                                                       |    0 | Semantic token contrast                                                                            |
| `pnpm web:client:check`                                                                      |    0 | Checked-in client against the current contract definitions                                         |

The initial focused browser run identified missing keyboard access on the
scrolling crop list. The listbox now has its own tab stop and keyboard
navigation. The first full run exited 1 with 70 passes. Two French desktop FTW
cases lost the map centre across the detail skeleton transition. Both passed a
focused rerun after the loading and loaded panels adopted the same widths. The
history form also stayed disabled when catalog options arrived before the lazy
map tab subscribed. The boot context now publishes catalog and glossary updates
and the history route uses the map boot path. The first full run's paint
benchmark lost its browser execution context during development. The next run
reported 70 passes including all seven F4 cases and four browser-context or
axe timeouts in existing S04 cases. That interrupted run left no process exit
record. The resumed run uses the same checks and thresholds in a fresh browser.

The field workspace initially exceeded the 250 kB gzip gate. The history and
input editors, chart code, regional disclosure and SoilGrids estimate now load
on demand. The expanded budget gate includes Overview, History and Inputs and
the NASA job list. The existing name invariant checks the primary Darija name's
inline Arabic-script language markup, as specified in Part 7.2. The largest
measured F4 first screen was Inputs at about 249 kB gzip, below the 250 kB
limit. The inherited throttled map test measured LCP of 2,048 ms in French and
2,028 ms in English, with 16 ms observed input events in both. Painting 2,000
cells measured a 16.7 ms median frame interval and a 50 ms longest frame. These
measurements describe the test profile. Separate S05 and S15 LCP and INP runs
remain part of the performance follow-up.

S05 and S15 browser screenshots are under `.artifacts/playwright/test-results/`.
The final S15 screenshots are under `.artifacts/f4-verification/picker-style/browser/`.
Visual review confirmed the desktop map beside the field panel and the phone
sheet's two-thirds opening. Direct catalog visits now get the picker search
styling from the picker stylesheet itself.

## Demo commands

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `/map`, choose a saved field and use the Overview, History, Inputs, NASA
and Plans tabs. Open `/crops` to browse the configured catalog release. For
isolated verification, run `pnpm test:e2e field-detail.spec.mjs`. In this macOS
sandbox the browser suite uses an isolated local Chromium server in the matching
Playwright container. Outside the sandbox normal local Chromium is supported.

## Proposed DECISIONS and PROGRESS text

- **DECISIONS:** Keep the field record, map and contextual field list mounted in
  one workspace. Preserve draft changes through version conflicts and reapply
  only the edited profile section. Use the versioned public crop-detail
  response for evidence, and render the selected effects without deriving a
  new agronomic assessment in the browser.
- **PROGRESS:** F4 adds the contextual field workspace, versioned history and
  profile editing, NASA request and evidence panels, and the shared multilingual
  crop picker and crop catalog. The F4 notes record the checks, API gaps and
  remaining follow-ups. Branch changes are ready for user review after
  verification.
