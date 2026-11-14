# F1 — shell, routing, language, API, ownership and boot

2026-11-11. Branch `codex/fe-f1`. This work follows the user's explicit F1 task;
it does not close Step 12, advance to F2 or record design/copy approval. Changes
remain uncommitted and unpushed. No server, engine, database, migration, catalog,
OpenAPI or environment file is edited. The local reference pack stays ignored;
no OneSoil asset, font, logo or name is used in the product.

## Review and demo

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use the web URL printed by the developer supervisor. The normal API needs its
existing configuration and PostgreSQL; F1 needs no new account or key. With
optional services off, boot explains the installed capabilities. `/` opens the
first-run screen, `/glossary` uses the real public glossary, `/map` explains that
the map belongs to F2. `/legacy/planner`, `/legacy/weather`, and `/account` retain
the existing working tools while their replacement slices are pending.
`/?welcome=1` revisits welcome. `/design` remains development-only.

For the same disposable API/PostgreSQL/browser checks used here:

```sh
pnpm test:unit
pnpm test:e2e
pnpm design:budgets
pnpm web:client:check
```

The macOS shell sandbox cannot launch Chromium (Mach-port permission denied).
The existing optional `ROTAVISE_BROWSER_WS` connection was exercised with a
local `mcr.microsoft.com/playwright:v1.63.0-noble` `playwright run-server`, exposing
loopback through Playwright. This changes browser transport, not assertions,
API processes or PostgreSQL. App tests use Vite **production preview**; the F0
project uses the development server because `/design` is deliberately excluded
from production. The two origins and ports persist across Playwright workers.
No external deployment or production data is involved.

## Implemented screens and controls

| Surface        | What exists and what each control does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S00 boot       | Shell-sized skeleton; language and guest storage read safely; five parallel, abortable, four-second requests: readiness, capabilities, account, current catalog and language-specific glossary. Readiness accepts the real 503 Health body. Account 401/404 means signed out. Other errors retain a visible, separate retry. Server failure keeps the shell and saved-work explanation, a ten-second automatic retry/countdown, and a manual retry. Retry-After waits are respected.                                                            |
| S01 welcome    | French default; French/English buttons update immediately and persist `rv.lang` safely. Product purpose, three NASA/comparison/uncertainty lines, explicit construction status, reminder, Start and optional account link. Start records `rv.welcomed` and navigates to `/map`. Subsequent root visits redirect when welcomed or an owner exists. No owner is created on welcome, boot or glossary reads. Demo is absent because there is no BG-6 capability/endpoint.                                                                          |
| Shell          | Original crop-strip logo; desktop 64 px rail, 290 px contextual panel, optional 440 px detail panel, remaining surface reserved for F2; tablet top navigation and a single active content panel; phone five-tab navigation, resources menu, language switch and non-modal bottom sheet. Map, Fields, Plans, Crops, Account, Glossary and About navigate within one origin. Photo navigation reads real availability; missing AI configuration is explained. Context links open the working prior planner/weather/account tools when configured. |
| Phone sheet    | Peek **120 px**, half and full; direct detent buttons, interruptible spring, pointer drag, velocity-based snapping and reduced motion. The translated reminder stays in the visible viewport. Peek hides/inerts body content; the title remains accessible. Escape/close exposes an Open panel button with focus restored; opening it restores the sheet. Tabs remain usable because this is non-modal.                                                                                                                                         |
| Shared states  | Reminder in every open panel/sheet and the bare phone surface; top offline bar for browser offline or two consecutive transport failures; recovery on successful transport. Toast region starts empty and only exposes an explicit action-driven API, with six-second dismissal. Route error boundaries preserve shell navigation. Invalid UUIDs/crop ids/evidence tabs show 404 without private requests.                                                                                                                                      |
| S16 glossary   | Real `GET /glossary?lang=fr` or `?lang=en`, schema validation and ETag/304 byte reuse isolated by URL/language. Search matches term, meaning or adviser code. Terms first; groups split into pages of at most seven controls; entries seven at a time; previous/next; empty/error/retry states; deep links select the correct group/page. Provenance is based on the returned review status and includes the server note. Sourced entries retain their citation links/quotes.                                                                   |
| GlossaryTerm   | Resolves a code/group through the same query; opaque Radix popover with term, meaning, marked adviser code, provenance, citations where present, and a link to the glossary anchor. Missing entries show a generic localized sentence. Escape dismisses and restores focus.                                                                                                                                                                                                                                                                     |
| Previous tools | English Step 08 planner, result, weather and account controls retain real API/SMTP/database behavior. They are explicitly labelled as the previous English interface, wrapped with the localized shell and `lang=en`. Account response/page schemas now use the contracts; guest planner calls use the shared owner client; opaque request/snapshot ids and raw instants were removed from visible metadata. Multi-year saved plans open their honest future results route; no replacement multi-year interface is claimed.                     |

The **in-progress routes** are `/map` (F2), `/fields/new` (F3/F4),
`/fields/:id` and `/fields/:id/history` (F5), `/fields/:id/plan/new` (F6),
`/plans/:id` (F6/F7), `/plans/:id/strategy/:strategyId` (F7),
`/plans/:id/evidence/:tab` (F8), `/plans/:id/what-if`, `/crops`, `/crops/:id`,
`/photo-check` (F9), `/plans`, `/about`, `/demo` (F10). These screens explicitly
say they are being built, include the relevant off-service note, and link to
implemented tools. They contain no simulated result, fake field or decorative
map. `/account` keeps the working previous account screen until F10. All route
modules are lazy; `/design` remains excluded from production.

## API, server state and ownership

S00 reads start in a small first-party deferred `/boot.js` script while the
application modules load. The HTTP boundary consumes each response once and
still performs its normal status handling, cancellation and Zod validation.
The transport has four-second aborts and never exposes unparsed data to a
screen. Only the account probe sends cookies. Critical local Latin UI/headline
fonts are preloaded from the built asset names. The app entry is eager so Vite
can preload its dependencies; route modules and phone motion remain lazy.

The frontend build marks pure contract-schema construction and the OpenAPI
metadata registries for tree shaking. It does not alter contract files or
annotate parsing calls. This removes unused engine/result schema construction
from boot; the retained planner loads its needed schemas in its own chunk.
A unit probe guards the construction/validation distinction, and the real
production-build e2e suite exercises parsing after this optimization.

- `tooling/web/generate-client.mjs` derives 13 resource modules from the exact
  contract registry that builds OpenAPI. Concrete exported Zod schemas retain
  inference and tree shaking; the registry intentionally erases schema value
  types. Request bodies, path/query parameters, idempotency keys, success
  responses and error bodies are validated. There are no handwritten response
  interfaces. `web:client:check` rejects drift. The generated API inventory lists
  every operation and the documentation-only exception.
- Every Part 4.2 endpoint is covered, plus current capabilities, crop detail,
  label and precomputed boundary endpoints. This is transport availability, not
  a claim that later screens use them. Native Better Auth routes remain under
  `/api/auth/*` with their existing response checks and callback URLs; they
  are explicitly outside the repository's OpenAPI contract.
- Same-origin HTTP only; abort propagation; malformed responses fail closed;
  seconds/date Retry-After parsing; ETag response bytes are cached only after
  schema validation. Errors use glossary meanings, localized operational
  fallbacks and an unknown-code fallback without status/code leakage.
- TanStack Query central keys never contain guest tokens or coordinates. Public
  catalog/glossary are fresh for 24 hours; pinned catalog versions and completed
  plans are immutable; fields/history/boundaries 30 seconds; analysis 60 seconds.
  Plan polling is two seconds for 30 seconds, then five; NASA polling 30 seconds
  for ten minutes, then two minutes; terminal results stop. Hidden-tab polling
  pauses; focus resumes stale queries. Completed observation/extraction reads
  invalidate analysis queries for that owner and field. Route queries consume
  AbortSignal.
- Owner storage is memory plus validated `sessionStorage`, with safe access
  even when storage throws. Guest creation is lazy and deduplicated. Guest
  calls omit cookies; account calls omit Authorization. The claim endpoint
  is the sole dual-credential exception. UNAUTHORIZED renews a guest once and
  retries the action once; simultaneous failures share renewal. Further
  failure requires sign-in. A persistent sentence explains lost access to old
  guest data. Private query scopes change and old scoped caches are cancelled
  and removed when ownership changes.
- Cross-feature consumers use the implemented features’ public `index.ts`
  exports.
- A separate browser import-boundary check is part of `pnpm lint`, including
  dynamic imports of the engine/database. The allowed task scope excludes the
  root ESLint configuration, so this is an AST check under `tooling/web`.

## Language and design decisions

Flat typed ICU keys extend the F0 message files. Every key in this slice is
present in French and English; tests parse every ICU message, reject a missing
key, and walk `plan-v2.contract.ts` to require both translations for every
explicit schema message. Language storage exceptions do not stop rendering.
Calendar dates format in UTC without shifting their day; instants format in the
user's time zone; month-day ranges, finite numbers, Western digits, explicit
units and loss-point display have dedicated formatting functions. Existing F0
CropName keeps the four-language, bidi-safe name rules for later crop screens.

The measured OneSoil values supersede the older token hypotheses: 14 px base,
400/500, near-black and two greys, opaque white/light-grey panels, 8 px controls,
32 px desktop controls, one action green, original icons and local fonts. The
64/290/440 desktop dimensions use the measured pack and F0 tokens. No MapLibre
is added. A real 120 px peek is possible by keeping only detents/reminder and
an accessible title there; content becomes available at half/full, rather than
claiming all content fits in the peek. Motion uses the small imperative motion
API in a lazy phone chunk to meet the first-screen JavaScript budget.

## Contract differences, backend requests and limits

1. Capabilities already exist. The obsolete fallback-probe sequence is not used;
   readiness/account/catalog/glossary still have their own boot requests.
2. Capabilities describe **configuration**, not provider readiness. No enabled
   service is presented as a reliability guarantee. `capabilities.version` is
   the contract version `1`, not an application build identifier.
3. Current field creation uses `FieldCreateRequest`, which adds an optional
   atomic boundary to the older profile. Plan creation uses the metadata
   envelopes and accepts both request formats; plan lists include current
   summary fields. The client follows these contracts, not Appendix A's older
   shapes. Glossary has nine groups, including `role`.
4. There is no demo availability flag or demo-session contract. No demo button
   is manufactured; `/demo` is an honest future route. No backend edit requested
   by F1 is necessary. BG-6/demo discovery remains a future backend request.
5. Full offline caches/service worker/write queue are F11 work. F1 implements
   the connectivity state/bar and in-memory query reuse, not durable offline
   storage or replay. Map, multi-year builder/results, NASA panels, crop detail,
   photo check, and replacement account screens remain their named slices.
6. Retained English tools keep their established functionality; their complete
   French redesign and full migration to query hooks are future work. This is
   explicitly visible. F1's complete-translation claim covers F1 screens/copy,
   not those unreplaced screens. Native-speaker review and gates G1/G2 remain
   user review items. No human review is invented.
7. The DOM scan recognizes actual uppercase snake codes and named message
   namespaces. Whole uppercase words and domains/emails are not message keys;
   `NaN` is matched as a word, so legitimate “provenance” does not falsely fail.
   Adviser codes use `data-code`; placeholders, UUIDs and raw instants remain
   forbidden even inside that marker. The sole native-URL exception is an image
   `src` with an exact same-origin `blob:` UUID handle generated by the browser.
   It keeps photo bytes in memory and exposes no application record id; visible
   UUID text remains forbidden. A positive/negative unit probe and the existing
   upload e2e cover this necessary difference from the literal “any attribute”
   wording. The prior account test's unique email
   now uses dashless random hex, preserving its intent without inserting a
   UUID into a user-editable email field.
8. Budget checks use Vite's manifest and count transitive static imports plus
   each F1 entry variant. Fonts are now real app assets (F0's blanket “no fonts
   in production” rule was specific to that slice). Chart/map/workshop fixtures
   remain excluded. Runtime LCP and interaction timings are scoped to the
   measured phone profile; they are not a release-wide guarantee or map test.

## Verification record

See the final command/outcome table below. Failed development iterations were
inspected and fixed: missing workspace dependency links, TypeScript's maximum
schema serialization length, narrow query inference, macOS browser launch,
separate production/development test origins, landmark/label/contrast issues,
actual opaque identifier/timestamp leakage in retained metadata, and the cold
boot request/module/font waterfall. A final regression also verifies that a
language change preserves glossary search and the active phone-sheet detent;
loading the next glossary no longer restarts S00 or remounts the current route. No check
is piped through tail, disabled, changed to suppress a failure or claimed from a
previous milestone. Controlled failures and synthetic session fixtures are
confined to tests. Database workflows use disposable PostgreSQL. An initial attempt to run two
commands that rebuild shared output concurrently caused a generated-output
race; affected checks were rerun sequentially. Performance measurements scan
the DOM at each interaction and run axe after recording timings, so axe itself
does not distort the CPU-throttled measurement. Runtime timings describe the
observed language-switch interaction, not a full-release INP certification.

Final gates on 2026-11-11 (recorded at 14:19 UTC), with real process exit codes:

| Command                                                         | Exit | Verified outcome                                                     |
| --------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `pnpm lint`                                                     | 0    | ESLint and browser import-boundary check                             |
| `pnpm format:check`                                             | 0    | Repository formatting                                                |
| `pnpm typecheck`                                                | 0    | All workspaces                                                       |
| `pnpm build`                                                    | 0    | Backend and production web build                                     |
| `pnpm test:unit`                                                | 0    | 399 tests, 9 suites, including frontend components                   |
| `pnpm test:e2e` with `ROTAVISE_BROWSER_WS=ws://127.0.0.1:39791` | 0    | 34 tests: 9 design, 25 app; real disposable PostgreSQL, SMTP and API |
| `pnpm test:web`                                                 | 0    | 364 frontend unit/component tests                                    |
| `pnpm web:client:generate`                                      | 0    | 13 contract-derived modules and API inventory                        |
| `pnpm web:client:check`                                         | 0    | Generated sources match current contracts                            |
| `pnpm design:contrast`                                          | 0    | 37 of 37 semantic contrast pairs                                     |
| `pnpm design:budgets`                                           | 0    | All F1 entry variants below 250,000 gzip bytes                       |
| `git diff --check`                                              | 0    | No whitespace errors                                                 |

Logs are local ignored artifacts under `.artifacts/f1-*-final.log`. The successful
e2e run includes all four widths in French and English, automatic DOM/axe checks
after UI actions, keyboard and pointer-drag sheet controls, photo upload, boot endpoint failures,
first run, language persistence and mid-screen state preservation, glossary
search/groups/popovers/deep links,
offline connectivity, invalid identifiers, account verification/field saving,
guest durable results and recorded NASA weather. Screenshots at 390 and 1440 px
were opened for visual inspection; all width screenshots are retained in the
Playwright artifacts.

Production JavaScript gzip totals, including the first-party boot script:
welcome **196,426 bytes**; desktop glossary **197,395**; phone glossary with its
sheet **223,719**; phone future-route surface with sheet **222,991**. The full
run measured welcome LCP **2,272 ms (fr)** and **2,248 ms (en)** at 390 px with
4x CPU throttling, 150 ms RTT and 1.6 Mbps download. The interaction probe uses
Event Timing at a 16 ms reporting threshold and asserts a 200 ms limit; the observed
input durations were **16 ms** in both languages. The probe waits two animation
frames to drain the observer before reading it. This is the
measured profile, not a guarantee for every device, connection or future map.

Vite reports upstream package “use client” directive warnings in its standalone
client build; these are not suppressed. Its real build exit is 0. No required
check remains blocked. Native-speaker copy review and review of F1 remain open.

## Proposed DECISIONS text (for reviewer)

“F1 adds the shared app shell, lazy route table, French/English ICU provider,
contract-derived API modules, TanStack Query policies, owner isolation and
capability-driven boot. It retains Step 08 workflows on explicit previous-
interface routes until their replacement slices land. The measured F0 tokens
remain the visual source; the 120 px mobile peek contains detent controls and
the judgment reminder. No map or backend changes are included. Browser checks
separate the production app from the development-only design catalogue.”

## Proposed PROGRESS text (for reviewer)

“User-requested F1 frontend work on 2026-11-11 is ready for review: S00, S01,
shell/session/API foundation and S16 glossary. Later-slice routes explicitly
show construction status; previous planning/weather/account flows remain
available. Verification, performance scope and remaining limits are in
`docs/steps/15/f1-notes.md`. Work remains uncommitted and unpushed. This records
scoped work, not milestone closure, design approval or release approval.”
