# Step 08 report — farmer web workflow

Status: **READY_FOR_REVIEW**. Updated 2026-09-30. This report covers the Step 08
component, not launch readiness.

## Built

- Responsive farmer form with actual coordinates, reported crop history/health,
  explicit unknown soil/water, two future crop cycles, considered/excluded crops
  and priority. Runtime contracts validate requests; the farmer reviews before
  submission. Crop options show the real catalog's pending local review status.
- Private guest session, idempotent submission key, durable status polling,
  refresh recovery, controlled failure/retry, explicit account claim and result
  rendering. Rejected pairs, missing evidence, sources, versions and warnings
  remain visible. A real catalog result does **not** show invented schedules.
- Historical NASA POWER browser explorer for seven supported measurements,
  bounded date/location requests, charts, daily values, coverage, nulls, units
  and source/grid provenance. A public API boundary enforces trusted origins,
  JSON, input limits and 12 requests per IP per hour. The internal token stays
  on the server. Weather selection does not change crop ranking.
- Optional email account screens for verification, sign-in/out, recovery,
  saved fields/history/plans, guest claim and deletion. Field and dated-history
  creation uses one PostgreSQL transaction; controlled second-entry failure
  rolls the whole write back.
- Conditional Google login and explicit linking. Implicit same-email account
  linking is disabled. Without credentials, the routes/button are disabled.
  Synthetic credentials exercise OAuth URL/state creation and rejection paths;
  a real Google callback is unverified.
- Saved results fetch their pinned catalog release and verify its checksum before
  rendering crop names and citations. Browser tests cover a controlled change
  in the current catalog.

## Material decisions

The browser uses relative same-origin API requests and HttpOnly account cookies.
Guest credentials stay in tab-scoped `sessionStorage`, never a URL. A failed
account-session check pauses planning rather than silently changing ownership.
The current catalog has three research profiles with unreviewed local rules, so
the honest production result is `insufficient_evidence` with no recommendation.
Recorded NASA responses in tests are identified fixtures; they are not crop
output. No database migration or provider adapter change was needed.

Exact versions added/used: Node **24.19.0**, pnpm **12.6.0**; web React/React DOM
**19.3.0**, Vite **8.3.1**, direct Zod **4.6.5** (new web manifest entry);
server NestJS **12.1.0**, Fastify **5.12.5**, Better Auth/Drizzle adapter
**1.7.6**, Drizzle ORM **0.45.3**, `pg` **8.23.0**, pg-boss **12.35.0**,
Nodemailer **10.0.11**, TypeScript **6.0.3**, Jest **30.5.2**, Playwright
**1.63.0**, PostgreSQL image **18.4-bookworm** and local Mailpit **1.31.3**.
Versions are
locked in `pnpm-lock.yaml`; `pnpm install --frozen-lockfile --offline` restored
the workspace after a sandboxed registry lookup failed. The installed build
completed. Better Auth's [Google setup](https://www.better-auth.com/docs/authentication/google)
and [account-linking guidance](https://www.better-auth.com/docs/concepts/users-accounts)
inform the conditional provider configuration.

## Verification

Final `pnpm verify`: **passed** — lint, Prettier, strict TypeScript, **436 Jest
tests**, **5 Chromium tests**, build, production Linux API/worker containers and
clean frozen install/build. The production container verified non-root startup,
a real catalog and full worker pipeline, protected internal weather, native
Argon2id and rejection of test harness/synthetic evidence. Affected commands
also passed: `pnpm build`; accounts + weather integration **39 tests**;
`pnpm test:e2e` **5 tests**. The Vite proxy connection errors in two health tests
come from their deliberate API shutdown.

Earlier runs exposed and resolved: a sandbox-denied local test port before
assertions (rerun with permitted access); unauthenticated Google linking
returning 503 instead of 401; a 390 px horizontal overflow; and a test fixture
constraint that matched an existing row. A full gate was deliberately
interrupted while atomic save and pinned catalog features were added; it is not
counted as a pass.

| ID  | Status                    | Evidence                                                                                                                                                                        |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 | Passed                    | Form, shared schema, browser submit, narrow viewport                                                                                                                            |
| U02 | Passed                    | Real catalog route, review form, versioned catalog test                                                                                                                         |
| U03 | Passed                    | Real worker/DB browser flow, refresh, injected 503 and retry, private token check                                                                                               |
| U04 | Passed for real catalog   | Insufficient-evidence result; controlled current-catalog change proves pinned display. Supported timelines remain synthetic-test-only pending local rules.                      |
| U05 | Passed locally            | Recorded real NASA response through PostgreSQL cache; origin/validation/quota integration and chart/table browser test. Live public provider capacity is unmeasured.            |
| U06 | Passed locally            | Disposable SMTP verification/login, field save; account integration proves ownership, recovery, claim/deletion and atomic batch rollback. External delivery remains unverified. |
| U07 | Partial; external blocker | Conditional route/state and link authorization passed; real Google callback, consent and post-login ownership need Google Console credentials.                                  |
| U08 | Passed locally            | Full `pnpm verify`, disposable DB/worker/SMTP/browser, production container and clean install/build passed.                                                                     |

## Run and inspect

From the repository root with Node 24.19.0, pnpm 12.6.0 and Docker:

```sh
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm catalog:import
pnpm accounts:setup
pnpm mail:up
pnpm dev
```

Open `http://127.0.0.1:5173`. Existing `.env` files must set
`AUTH_BASE_URL=http://127.0.0.1:5173` and
`AUTH_TRUSTED_ORIGINS=http://127.0.0.1:5173`. Mailpit is at
`http://127.0.0.1:8025`. Enter the field coordinates, submit a guest request,
inspect the saved insufficient-evidence result, select historical measurements,
then create/verify an account if saved history is needed. Stop `pnpm dev` before
`pnpm verify`; the browser test owns ports 3000 and 5178.

## Remaining limits

No crop recommendation is released until local planting/rule evidence and
agronomic review exist. No live Google OAuth, Resend delivery, production
reverse proxy, deployment, intended-load test, full accessibility audit or
external security review was performed. These are release gates, not implied by
Step 08 completion. Closing a guest tab may lose its bearer credential, though
the server record remains private until expiry. A network failure after a field
write commits can leave the browser unsure whether it saved; the UI directs the
farmer to inspect saved fields before manually retrying.

## Corrections (2026-10-16)

Added in Step 09 after the 2026-10-15 audit. The text above is unchanged as the
historical record; these points correct it.

- **U03 polling is not bounded in the browser.** `PlanWorkspace.tsx` polls every
  3 seconds with no limit or backoff until a terminal state. Server attempts and
  leases are bounded, but a stopped worker leaves a request `queued` and the tab
  polls until the request expires (one day for guests).
- **The map pin was dropped.** The product specification asked for a map pin
  with a coordinate fallback; U01 accepted coordinates only, and no map exists.
- **"No recommendation" has more causes than missing evidence.** Production
  planning always sets the region to `unresolved` with no cultivars
  (`planning-store.ts`), and the request has no cultivar field, so even
  reviewed rules could not produce schedules. With invented crops, 5-day sowing
  windows exceeded the climate work limit and month-long windows exceeded the
  2 MiB sequence limit, failing the whole plan.
- **U08 depended on free ports.** The browser suite hard-coded ports 3000 and
  5178, so `pnpm verify` failed when another process held them. Step 09 fixed it.
- **Not covered by the passed criteria:** a Google error return is discarded
  without a message (`AccountPanel.tsx`); results show raw reason codes; the
  interface is English only. These are recorded for the Step 15 redesign.
