# F5: priorities, plan builder and progress

2026-11-13. Branch `codex/fe-f5`. The user's concrete F5 authorization covers
S08, S09 and S10, irrespective of the older slice numbering in the master plan.
This report does not approve a milestone. Changes remain uncommitted and
unpushed. No F6 or later work is authorized or started.

## Implemented controls

| Screen             | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved-field entry  | Overview's comparison action and the field's Plans action open `/fields/:id/plan/new`. Existing plan summaries open `/plans/:id`. Invalid UUID routes make no private request. The builder waits for owner initialization and a positive plans capability before reading the field, history cursor pages or a retry plan.                                                                                                                                                                                                                   |
| S09 step 1         | Three-, four- and five-year horizon; editable earliest/latest calendar dates; schema and installed-server date validation before Next. Defaults use the next September after today's date and saved history. Latest sowing is bounded by the installed server's acceptance window.                                                                                                                                                                                                                                                          |
| S09 step 2         | Considered crops (20), exclusions (50), mutually exclusive selection, removal, paged selections and catalog varieties. The existing picker searches actual catalog names in four languages and supports keyboard selection. Empty consideration means suggest. Variety choices come from the selected crop's catalog options.                                                                                                                                                                                                               |
| S09 step 3         | Up to six ordered crops in the shared crop strip, add, remove and move earlier/later; use distinct recent history crops; explicitly omit a fixed rotation to permit backend inference. Repeated crops in a declared cycle remain valid.                                                                                                                                                                                                                                                                                                     |
| S09 step 4         | History rows and completeness answer; soil readings with units/source; saved water availability and optional plan allocation in mm per season/year; health reports with dates, reporter and confirmation; saved-history/input edit actions; optional plan salinity, method, source and measurement date. Unknown sections explain the resulting gap. Returning from saved-field edits refreshes profile/history inputs while preserving plan-only values. Changed history requires a fresh completeness answer.                             |
| S08                | Four keyboard-operable priorities, default 3, zero-to-five bounds and the sum-above-zero rule. Meanings and glossary links accompany them. Income remains omitted until touched and can be reset to unspecified. Editing an accepted plan shows its server-applied percentages beneath the sliders. Equipment size, market access and all four farmer-context pickers serialize the contract enums. Context's explanatory role and limited income evidence are stated explicitly.                                                           |
| S09 step 5         | Plain-language date/horizon review, crop and current-cycle disclosures, requested priorities, edit-step actions, schema validation and mapped correction links. Compare sends the validated format-2 request through the existing client. Back/Next, Cancel, reload recovery, offline, catalog unavailable, owner recovery, conflict and Retry-After behavior are implemented.                                                                                                                                                              |
| S10                | Reads actual plan stages and shows a six-stage stepper, elapsed seconds, the server's expiry instant, field navigation and confirmed deletion. All eight failure codes resolve through the active glossary, with bilingual fallback sentences. Weather and planning-limit failures provide specific next steps. Edit and send again restores the accepted input and persists subsequent edits. Polling stops on terminal states or a request error; errors expose a paced manual retry. Existing hidden-tab pause/focus behavior is reused. |
| Completed boundary | The same `/plans/:id` URL shows honest completion and retention, available server-applied priority percentages, a synthetic-data warning when applicable, deletion and adjustment of priorities as a new request. The detailed S11 comparison is explicitly unavailable; it is outside this task. Earlier-format plans receive an explicit unsupported-view state.                                                                                                                                                                          |

`buildPlanRequest` is the single construction path. Field v1 organic-matter
percent units, pH, texture, health names and water availability convert into the
exact v2 request shapes. No score, crop threshold or ranking is calculated in
the browser. Submission keys persist through ambiguous failures and owner
refresh, change after edited input or a conflict, and clear after acceptance. Identity uses the validated request serialization so schema property ordering after reload cannot generate a new key.
Field-specific drafts use guarded, runtime-validated sessionStorage. Storage
failure leaves an editable in-memory draft and a visible explanation. Unfinished dates, all-zero priorities and out-of-range plan water/salinity measurements survive reload but cannot be sent.

## Design and boundaries

Read the complete master plan, frontend-plan 0b–0f, inspection notes, measured
tokens, current OpenAPI request/status definitions and relevant source contracts.
Viewed local reference images without copying their assets. New controls reuse
self-hosted fonts, neutral surfaces, existing tokens and the single green action
color. Crop names retain the shared bidirectional-safe name system. Selection
lists page at seven items; the crop picker windows five rows; declared cycles
have at most six crops.

The builder/progress use the existing app's catalog layout, without composing a
map background. The map-first backdrop remains a visual deviation: this F5
satisfies the explicitly authorized saved-field workflow without changing map
renderers, imagery, controls, basemaps or credentials. The current preview was
not used or restarted. Test API/web ports are isolated; test PostgreSQL is
disposable. No backend, domain, database, migration or environment file changed.

Feature copy loads with the planning routes; progress loads only its own copy; French/English keys remain typed
and are tested for parity and ICU syntax. Core interface messages are fetched as hashed, self-hosted JSON for the chosen language; the second language loads on demand. Switching retains the current language until loading succeeds, and failures offer retry. Startup language failures have a bilingual retry screen. The design showcase loads both languages locally. This removes message data from compiled JavaScript; the budget report lists translation data bytes separately rather than hiding their transfer cost. Copy is machine-written and awaits
native-speaker review. Shared request feedback and selection/progress primitives
were separated to prevent new builder controls from increasing unrelated entry
bundles. Existing component exports remain available through the design index.
The bundle gate includes initial builder, review/crop steps, the separately loaded input step, cold retry variants and progress including its response-validation transport. A cold retry plus input step originally exceeded the JavaScript budget; loading interface copy as JSON resolved this without weakening response validation. Planning routes preload their static module graph, stylesheet and self-hosted medium font. They show their own reference-data loading/errors without delaying the shell. Private requests still wait for owner initialization.
No dependencies were added, so no new third-party notice is required.

## Contract precedence and backend requests

- **Additional intake date rules:** `validateIntakeDates` accepts first sowing
  only from today's UTC date through today + 366 days, and rejects future
  observation dates. These conditions are absent from `planRequestV2Schema`
  and OpenAPI. The master plan's next-September plus a full additional year
  default can therefore receive 400 despite passing that schema. F5 bounds the
  default and adds mapped client validation. Request: expose these acceptance
  rules and server-date context through shared contracts/capabilities, and
  return structured validation issue paths for rejected submissions.
- **Capability precision:** capabilities expose `plans`, but no accepted-request
  formats or separate full-planning/intake-only switch. Request an explicit
  format-2 planning capability. Unknown capabilities show a degraded state;
  an intake-only server can still reject v2 with generic INVALID_INPUT.
- **Field v1 / BG-8:** salinity and quantified water allocation cannot persist
  in the saved field profile. F5 preserves them per field in the plan draft and
  accepted plan. Health names convert to `issue.other_name`; no unsupported
  field-profile properties are sent. Structured field issue IDs and saved
  history varieties still need their own backend contract work.
- **History capacity:** the saved-field store permits 500 history rows, while
  the shared format-2 request permits 40. F5 reads all rows and refuses an
  oversized request with a translated explanation; it never silently truncates
  saved history. Its draft can preserve the field's larger history. Request:
  define an explicit, loss-aware history projection or align these capacities.
- **Expired guest ownership / BG-7:** a replacement guest token is a new owner;
  there is no guest-field claim/migration contract. The client retries once with
  the original body/key, but this cannot restore ownership of an expired guest's
  field. A field may then be unavailable; its tab draft is retained. No ownership
  recovery guarantee is made.
- **Operation vocabulary / BG-15:** specific unavailable-operation selection
  is absent because the backend supplies no sourced operation vocabulary.
  Existing operation IDs from a retried plan are preserved. No vocabulary was
  invented. The future About screen's pending-features list is outside F5.
- There is no plan results route separate from `/plans/:id`. Completion keeps
  this URL without a redirect loop. S11, detailed comparison, strategy/evidence
  views and their actions remain future authorized work.
- API errors provide a code without rejected field paths. Client schema issues
  map to their step/section; history/health corrections open the page containing the indexed row and focus it; fixing saved
  history or reports opens the existing field editor. Server-only INVALID_INPUT
  remains an honest form error rather than fabricated field attribution.

## Verification

Logs are under `.artifacts/f5-verification/`; browser images, traces and
attachments are under `.artifacts/playwright/test-results/`. These temporary
artifacts and local reference images are not deliverable source files.

| Command                                               |    Exit | Evidence                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                           |       0 | ESLint and browser import boundaries; latest `lint-final.log`.                                                                                                                                                                                                                                                         |
| `pnpm format:check`                                   |       0 | Earlier complete check; `format-final.log`. Final report formatting is rechecked below.                                                                                                                                                                                                                                |
| `pnpm typecheck`                                      |       0 | Workspace check; `typecheck-final.log`. Latest web compilation is also part of the browser build.                                                                                                                                                                                                                      |
| `pnpm build`                                          |       0 | Workspace production build; `build-final.log`. Browser reruns rebuild server prerequisites and production web assets.                                                                                                                                                                                                  |
| `pnpm test:unit`                                      |       0 | Earlier complete run: 452 tests, 14 suites; `unit-final.log`.                                                                                                                                                                                                                                                          |
| `pnpm test:web`                                       |       0 | Latest web changes: 418 tests, 12 suites; `unit-web-final.log`.                                                                                                                                                                                                                                                        |
| `pnpm test:e2e` with isolated ports and local browser |       1 | Earlier full run: 76 passed, 4 failed, 15.6 minutes; `e2e-final-direct.log`. See failure details below.                                                                                                                                                                                                                |
| Affected browser rerun with traces                    | pending | All six F5 cases and the four failed cases (one overlaps F5), nine tests total; `e2e-affected-trace.log`.                                                                                                                                                                                                              |
| `pnpm design:budgets`                                 |       0 | Builder 221,690 B; review/crop steps 225,974 B; input step 227,582 B; cold retry plus input step 241,900 B; progress including parser 227,420 B gzip. Translation JSON data is 12,200 B French or 10,701 B English gzip, reported separately. Every existing scenario also stays below 250,000 B; `budgets-final.log`. |
| `pnpm design:contrast`                                |       0 | 37 semantic color pairs pass WCAG AA; `contrast-final.log`.                                                                                                                                                                                                                                                            |
| `pnpm web:client:check`                               |       0 | 13 existing contract-derived resource modules verified; `client-final.log`.                                                                                                                                                                                                                                            |

The full browser run failed two unchanged FTW selection checks (French 390 and
1440), the unchanged saved-field list/offline check, and F5's reload check.
Snapshots show the selection still checking or reporting no suggestion; the F5
snapshot shows unavailable capabilities, rather than a changed draft value.
The saved-field failure has no captured DOM snapshot. These failures are retained,
not suppressed. Their exact intermittent cause has not been established. No map
implementation or existing map test assertion was changed.

The request suite contains 18 exact golden states, each parsed by the actual
request schema, plus full v1 conversion, validation message/control mapping,
additional intake dates, unfinished measurement drafts, paged correction rows and idempotency checks including ambiguous reloads. A client test
checks that owner refresh preserves the submitted body and key. Browser tests
cover a real accepted request and production-worker completion, every persisted
stage and all eight failure codes, failure editing, deletion, offline state,
rate limiting and conflict keys. They use the normal DOM scan and axe checks.
Review/failure layouts exercise 390, 768, 1024 and 1440 pixels in French and
English. Throttled phone performance tests cover the new builder, progress and direct retry, with the HTTP cache disabled. A separate browser test verifies startup and in-form language-load failures and recovery using controlled asset failures.

Earlier failures were investigated rather than suppressed: a web-only typecheck
ran before workspace declarations existed; implementation type/JSX mistakes were
fixed; the builder's initial owner-read race was fixed; real submission exposed
the stricter intake date rule; a test's assumed engine outcome was removed in
favor of checking the actual completed result/input. A proposed synthetic weather
transport was rejected by the existing production evidence guard and removed.
The final completion check uses the production worker and real public NASA POWER
weather in disposable storage, so it remains dependent on NASA availability.
No synthetic weather was admitted as production evidence. Controlled stored
stage/failure transitions are confined to disposable database tests; completed
results are produced only by the real worker.

Native Chromium could not launch under the macOS Mach-port sandbox. Browser
checks use the repository's supported local Playwright websocket connection.
Loopback ports are forwarded directly inside that disposable browser container (`ROTAVISE_E2E_BROWSER_FORWARDING=direct`) so its
APIRequestContext reaches the isolated local test servers. Initial connection
and selector failures are retained in the logs. The preview is untouched.

## Demo and review

```sh
pnpm test:e2e plan-builder.spec.mjs
pnpm design:budgets
```

In this restricted macOS environment, use a matching locally started Playwright
container with `ROTAVISE_BROWSER_WS` and forward its isolated test ports. Outside
the sandbox the normal local Chromium command is supported. For a manual review
on an independently configured development instance, open a saved field and use
Compare rotations. Follow the five steps, then open its actual progress URL.
No new provider account or Mapbox credential is needed for these screens.

Proposed **DECISIONS** text: Construct format-2 requests in one validated builder;
keep per-field tab drafts and idempotency identity separate from accepted plans.
Honor installed intake date limits while requesting shared contract coverage.
Load planning copy and controls on their feature boundary. Render unavailable
future screens honestly and preserve production evidence guards.

Proposed **PROGRESS** text: F5 implements S08 priorities, S09 saved-field plan
building and S10 status/failure handling, with field draft persistence and real
submission. Its notes contain final checks, contract gaps and visual deviations.
S11 and later frontend tasks remain unimplemented here. The report records verification limitations explicitly; this is not milestone approval.
