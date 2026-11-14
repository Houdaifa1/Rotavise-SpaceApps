# Step 09 report — Field Shift re-baseline and foundation hardening

Status: **READY_FOR_REVIEW**. Updated 2026-10-16. Part A re-baselined the plan;
Part B hardened existing backend, data and build foundations at the user's
request. No crop evidence, engine behavior or interface design changed.

## Part A — what changed

- **Specification v2** ([ROTAVISE_HANDOFF](../../specification/ROTAVISE_HANDOFF.md))
  maps each phrase of the Field Shift summary to a capability and step. It
  defines multi-year rotations, NASA Earth observation layers, FAO-56,
  AquaCrop and RothC methods, crop health, AI use rules, the Python science
  service, production gates and the Step 09–17 roadmap.
  [GOALS](../../specification/GOALS.md) now lists G01–G10.
- **Archived** the 2026-09-27 specification and 2026-09-30 goals under
  `docs/archive/`, each with a banner.
- **Decisions** ([DECISIONS](../../DECISIONS.md)) records the re-baseline with the
  user's delegation as its authority. It marks the old "no Python service" rule
  as superseded. The older
  [Field Shift coverage review](../../decisions/field-shift-coverage.md) is
  marked superseded too.
- **Progress, AGENTS.md, CLAUDE.md, README and the structure guide** point to
  Step 09 and the new plan. Step 08 is closed by the user's instruction.
- **Step 08 corrections** are a dated section in its
  [report](../08/report.md): unbounded browser polling, the dropped map pin, the
  real causes of "no recommendation", fixed test ports, and the issues left for
  Step 15.
- **Portable browser tests:** `tests/support/browser-ports.mjs` picks free API
  and web ports once. The Playwright config passes the API port to the Vite proxy
  through `API_PROXY_TARGET`. `pnpm dev` points the proxy at `API_PORT`.
- **Competition facts (checked 2026-10-16):**
  - The official FAQ forbids starting work before the hackathon.
  - The terms make submissions open source, require every source to be cited,
    forbid promoting a commercial product, and require AI use to be described.
  - Dates: statements 2026-10-28; guides 2026-11-13; event 2026-11-14 to 15.

  The user will ask the organizers whether the pre-existing project may be
  submitted with full disclosure.

Checkpoint: Steps 08 and Part A were committed as `e33c4de` on the local branch
`field-shift`. `main` is unchanged, and nothing was pushed.

## Part B — foundation hardening

| Area                  | Change                                                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client addresses      | Validated `TRUST_PROXY` (`false`, 1–9 hops, proxy addresses/CIDRs; never `true`). Production API refuses to start without it. Hop counts become the equivalent trust function because Nest's adapter type omits numbers.                                                                                        |
| Security headers      | Every API response: `nosniff`, `X-Frame-Options: DENY`, `default-src 'none'` CSP, `no-referrer`, same-origin resources; HSTS only in production (`common/http/security-headers.ts`).                                                                                                                            |
| OAuth tokens          | Migration 0007 adds a trigger that nulls provider access, refresh and ID tokens on every insert and update; password hashes are untouched.                                                                                                                                                                      |
| Ordered lists         | Plans and fields newest first, crop history by planting date; opaque keyset cursors with exact microsecond or date keys plus ids (`common/http/page-cursor.ts`). The account client accepts the new cursor format; no screen changed.                                                                           |
| Weather location data | Migration 0008 allows snapshot deletion only inside a flagged retention transaction. The worker runs a bounded job every 10 minutes that deletes cache rows one day past expiry and snapshots no plan pins after one day. Migration 0009 indexes the lookups. Grid snapping of coordinates remains Step 11.     |
| Sign-in limits        | 10 attempts per email and client address per 10 minutes, plus 100 per email; signup, recovery and verification keep their per-email limits.                                                                                                                                                                     |
| Test containers       | Disposable label; stopped test databases older than an hour are pruned when a suite starts (outage tests stop and restart databases, so `--rm` is unusable there); mail inboxes use `--rm`. Three stopped containers from this project's 2026-09-30 run were removed.                                           |
| Supply chain and lint | Node and PostgreSQL images pinned by index digest, CI actions by commit (same commits as their `v4` tags), CI timeout 30 minutes; type-aware `no-floating-promises`, `no-misused-promises` and `await-thenable` for server and package code. A probe confirmed the rule fires; existing code had no violations. |

New tests on real PostgreSQL or real processes:

- **Proxy:** forged forwarding headers share one quota; a trusted hop separates
  clients; production refuses to start without the setting.
- **Headers:** present on success and error responses; HSTS only in production.
- **Tokens:** discarded on insert and update.
- **Paging:** three fields, history entries and plans across pages; forged
  cursors are rejected.
- **Sign-in:** a lockout from one address leaves another address working.
- **Retention:** pinned evidence survives and is deleted once its plan is gone;
  a plain delete is still refused.
- **Config:** nine unit cases for the proxy setting.

Frontend defects stay recorded for Step 15: Google error message, unbounded
polling, raw reason codes and English only.

## Verification

Run on 2026-10-16 while an unrelated `next-server` process held port 3000.

- **Part A gate, `pnpm verify`, 05:44–05:49 UTC: passed.** Lint, Prettier,
  strict types, 436 Jest and 5 Chromium tests, build, 9 production-container
  checks and a clean frozen install/build.
- **Part B targeted runs: all passed.** Unit (25), foundation integration (10),
  plans and foundation (34), accounts (24), planning and weather integration
  (29), foundation and catalog outage tests (24), and the lint probe.
- **Part B gate, `pnpm verify`, 09:37–09:42 UTC: passed.** Lint including the
  typed promise rules, Prettier, strict types, **452 Jest tests**, **5 Chromium
  tests**, build, **9 production-container checks** using the digest-pinned
  Node image, and a clean frozen install/build. No test containers were left.

Not re-run: `pnpm peers check` and `pnpm audit --prod`, because no dependency
or lockfile entry changed (both passed on 2026-10-15). A relative-link check
covered every changed document.

## Acceptance

| ID  | Status | Evidence                                                                            |
| --- | ------ | ----------------------------------------------------------------------------------- |
| R01 | Passed | Specification section 2 maps the summary; old specification and goals archived      |
| R02 | Passed | Section 1 records the FAQ rule, terms and dates with links                          |
| R03 | Passed | Decisions entries with authority; Python rule and coverage review marked superseded |
| R04 | Passed | PROGRESS, AGENTS.md, CLAUDE.md, README and structure guide updated                  |
| R05 | Passed | Dated correction section in the Step 08 report                                      |
| R06 | Passed | Browser suite passed on free ports while port 3000 was held by another process      |
| R07 | Passed | Both full gates passed; commands and results above                                  |
| R08 | Passed | Proxy setting, startup refusal and quota-separation tests                           |
| R09 | Passed | Header test on success, error and production responses                              |
| R10 | Passed | Migration 0007 trigger and insert/update test                                       |
| R11 | Passed | Paging test for fields, history and plans, forged cursors rejected                  |
| R12 | Passed | Migrations 0008–0009, worker job and retention test                                 |
| R13 | Passed | Lockout test; labelled, pruned and auto-removed test containers                     |
| R14 | Passed | Digest and commit pins; typed lint passes and its probe fails as expected           |
| R15 | Passed | New real-database and process tests; second full gate passed                        |

## Limits and next step

- **Real recommendations are still impossible** until Step 10 adds context
  resolution, scale and one comparison, and Step 12 adds sourced pilot crop
  rules.
- **Not exercised:** the proxy setting has no deployed proxy test, which
  belongs to Step 16 staging, and the token rule has no real Google sign-in
  (no credentials yet).
- **Still open:** frontend security headers and CSP need hosting (Step 16).
  Separate database roles and coordinate snapping remain Steps 16 and 11.
- **Recheck on 2026-10-28:** the full challenge statement.

Next proposed step: **Step 10, engine core**. It needs no external account.
