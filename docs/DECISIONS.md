# Material decisions

Updated 2026-10-16. [Progress](PROGRESS.md) states what is actually implemented;
[specification](specification/ROTAVISE_HANDOFF.md) and [goals](specification/GOALS.md)
define the product. Historical commands/results stay in the milestone reports.

## Glossary languages and translation review (2026-11-10)

The user's glossary-only follow-up adds Moroccan Arabic (`ary`) alongside
English, French and Standard Arabic. The existing contract-driven endpoint
accepts it without a duplicate language allowlist; both Arabic variants report
RTL direction. Every existing code has all four translations, and the glossary
version is bumped to `glossary-2`. French and Arabic wording was checked against
English with Moroccan terminology sources, but all three translated languages
remain `model_translated_unreviewed` until a person reviews them. See the
[review notes](steps/15/codex-glossary-review-notes.md) for counts, citations,
Darija technical fallbacks and verification. No engine behavior is changed.

## Field Shift re-baseline (2026-10-16)

Authority: the user's messages of 2026-10-16 set winning Space Apps Field Shift
as the top priority with a production-grade farmer product as the same bar, and
delegated technical choices: "for anything you want to add, just add it… Don't
ask me, you are the expert." The frontend design stays a joint decision. The
2026-10-15 audit and the sources cited in the specification support each item.

- **Priority:** answer every part of the Field Shift challenge with working
  features, then run as a real product in Morocco. The user will ask the
  organizers whether the pre-existing project may be submitted, with full
  disclosure; the official FAQ forbids starting work before the event, and
  submissions become open source. If refused, the product continues unchanged.
- **Rotation horizon:** 3–5 year rotations replace the fixed two-cycle model,
  because the challenge asks for long-term resilience. Two-cycle results stay
  readable as historical versions.
- **Engine core is redesigned, not the whole app:** accounts, ownership, jobs,
  weather caching and their tests are kept. The audit showed the current engine
  fails at realistic window sizes, cannot compare crops with different rule
  shapes, and never resolves region or cultivar in production.
- **Established models replace ordinal proxies:** FAO-56 water need, AquaCrop
  7.3 and RothC (FAO GSOCseq approach), each with calibration status.
  Uncalibrated crops get relative comparisons only.
- **NASA Earth observations are core:** POWER plus GPM IMERG, SMAP context, HLS
  field history, OPERA DIST alerts and NEX-GDDP-CMIP6 scenarios. MODIS is
  avoided because its science collection ends in 2027.
- **Python science service:** supersedes the earlier "no Python service" rule.
  It is stateless, has no database or identity access, is called only by the
  TypeScript worker and is validated by shared schemas. Reason: FAO's official
  AquaCrop code and the standard raster/NetCDF tools are Python.
- **Crop health is part of rotation planning:** sourced host/break rules,
  pick-list reports and photo triage that can abstain. No diagnosis claims or
  treatment advice.
- **AI (Claude) is allowed for** extraction with citations, explanations and
  translation, diary structuring and photo triage. It never ranks rotations or
  adds unsourced values. Expert review stays a pre-launch gate; until then
  results are labelled "not yet expert-reviewed".
- **Pilot crops (Tadla):** durum wheat, bread wheat, barley, faba bean,
  chickpea, lentil, sugar beet, maize, sesame and alfalfa as a multi-year stand.
- **Frontend waits** for a design agreed with the user (Step 15). Greenhouse
  monitoring leaves the plan until after Step 16.

## Architecture

- TypeScript, pnpm workspaces, native ESM; NestJS/Fastify API and separate pg-boss
  worker; React/Vite; strict Zod contracts; PostgreSQL 18 and reviewed Drizzle SQL.
- Pure calculation engine: no framework, HTTP, database, UI, ambient clock or
  environment access. Temporal calendar dates for crops; UTC instants for operations.
- Seven root categories; group behavior by feature and responsibility.
  [Structure](architecture/structure.md).
- Install/build with exact runtime/package-manager pins and frozen lockfile.
  API/worker do not run migrations. PostgreSQL 18 mounts `/var/lib/postgresql`.
  Production uses compiled packages and a non-root container.

## Weather

NASA POWER daily point AG with explicit UTC remains selected. The original
comparison found meaningful differences from fixed ERA5; neither was validated
against local station ground truth. [Provider decision](decisions/weather-provider.md).

Adapter **2** adds humidity, 2 m wind and daily solar energy to the four temperature/
rain variables. Shared metadata defines IDs, units, availability and source grid.
Solar is restricted to CERES SYN1deg from 2001; meteorology uses MERRA-2 from 1981.
No earlier SRB, near-real-time source, raw parameter passthrough or fallback.
[Current implementation/evidence](steps/06/weather-expansion.md).

Queries: selected subsets, at most 366 days, end at least 120 days old.
Unknown/source/unit mismatches fail; missing stays null. Cache identity includes
location/range/variables/provider/adapter. Thirty-day expiry; immutable raw and
normalized evidence with hashes. Snapshots hold requested coordinates, so since
Step 09 a bounded worker job deletes cache rows one day past expiry and snapshots
no plan pins after one day; only that flagged transaction may delete (migration
0008). Coordinate snapping to the source grid is planned for Step 11. PostgreSQL leases deduplicate misses and recover
failed owners; fetches run outside transactions. Bounds remain 16 consumers and
2 upstream requests per process, not a validated public capacity guarantee.

V1 evidence remains readable; V2 uses separate cache keys. New variables are for
retrieval/display. The crop engine still consumes only temperature and rain;
using the new measurements in ranking requires supported calculation methods.
Internal routes require a server token; frontend secrets are prohibited. Step 08
adds a public server boundary for browser weather exploration: selected variables,
validated dates/location, trusted-origin JSON POST and 12 requests/IP/hour.
The browser receives provenance, units, coverage and nulls from persisted real
snapshots. A cache miss still uses the same provider adapter; no browser token or
alternate fabricated data path exists. The public quota is a conservative pilot
limit, not a load-tested capacity claim.

## Catalog, intake and engine

- Append-only real catalog versions; synthetic/research evidence cannot become
  reviewed agricultural output. Three real profiles still lack local review.
- Guest sessions: random 256-bit bearer credentials, hash-only storage, seven-day
  sessions and requests lasting at most one day; owned deletion/revocation and
  owner-scoped idempotency. Intake pins catalog evidence and enqueues atomically.
  [Step 04](steps/04/report.md).
- Jobs may repeat. Row locks, uniqueness and terminal-state guards make results
  idempotent; no claim of exactly-once external effects. Fault injection is test-only.
- Two future crop cycles per sequence; many candidate sequences can be compared.
  Conservative duration bounds, no overlaps, hard failures outside scoring,
  unsupported choices preserved. [Calendar decisions](decisions/sequence-engine.md).
- Historical analogs preserve consecutive years and leap behavior. Incomplete
  metrics are null. Compare only compatible evidence and shared complete years.
  Weights are declared uncalibrated product heuristics; show ties/sensitivity.
  Water-demand/family transitions are sourced ordinal proxies; irrigation remains
  unknown, and measured soil improvement is not claimed.
  [Calculation definitions](steps/06/api-and-methods.md).

## Optional accounts

Guest planning stays available. Better Auth with its native Fastify handler and
Drizzle adapter supplies verified email/password, recovery, database sessions and
account deletion. Argon2id uses the maintained native library: 64 MiB/three
iterations/one lane, bounded per-process work. Cookie/origin checks stay enabled;
public responses never expose session tokens. SMTP runs in the worker using an
encrypted transactional outbox. Local Mailpit verifies delivery; no external
sending service or farmer email-access validation is claimed.

The user selected **Resend as the intended production email provider after a
sending domain is chosen and verified**. Its SMTP service fits the existing
worker transport. Current [free-plan terms](https://resend.com/pricing) are
3,000 transactional emails/month, 100/day and three domains; recheck limits at
integration time. Configure a verified sender, TLS credentials and delivery/
bounce monitoring then. The domain, Resend account and credentials are not yet
configured, and no external message has been sent. Keep local Mailpit for tests.

The user selected **Google sign-in as an optional Step 08 feature** beside
email/password. The provider, exact public route allowlist, callback forwarding,
frontend redirect and explicit linking are implemented conditionally. Implicit
same-email linking is disabled. Synthetic-credential tests prove OAuth URL/state
creation, invalid-state rejection and no-session linking rejection. A real Google
callback, consent screen and account ownership after login remain **unverified**
until a Google Console client and allowed origin are configured. See
[Better Auth Google](https://www.better-auth.com/docs/authentication/google)
and [account linking](https://www.better-auth.com/docs/concepts/users-accounts).

The Step 08 frontend uses same-origin API requests and HttpOnly account cookies.
Guest tokens stay in `sessionStorage` for one browser tab and never enter URLs;
closing that tab can lose guest access. Server records remain owner-scoped.
Catalog options expose review status so the form cannot imply that unreviewed
research profiles are local advice. Browser weather selection changes retrieval
and display only; ranking continues to use supported temperature/rain methods.
Saved results fetch the catalog version and checksum pinned at intake, preventing
later catalog releases from changing displayed names or citations. Creating a
field with dated history uses one transaction so a later entry failure cannot
leave a partial record. A lost response after commit remains ambiguous to the
browser; users must inspect saved fields before manually retrying.

Every field/history/plan operation is owner scoped. Saved edits use version checks.
Guest claims require explicit confirmation, live guest proof and an account login
no more than five minutes old; transfer is atomic/repeatable without changing
input/evidence/result IDs. Account plans last 365 days (maximum 200), guest requests
one day (maximum 20). Fields/history persist until deletion: maximum 30 fields,
500 entries per field. Session expiry is seven days. Account deletion cascades.
History is farmer-reported; saving it does not verify agronomy or silently change
an existing plan's input. These are explicit product policies pending release review.
Detailed release checks: [archived G06](archive/goals-2026-09-30.md#g06--optional-accounts-and-history).

Auth dependency failures return a generic response. Operational logs use only a
fixed endpoint, failure stage and category; the user-creation error response is
logged too. Disposable PostgreSQL tests hold a quota row through a statement
timeout and reject a user insert, then check recovery and absence of private
values in logs. The cause of one earlier isolated signup 503 remains unknown;
these controls do not claim public-load reliability.

## Complete backend workflow

New full requests atomically pin inputs/catalog/context/policy/engine and queue
one durable job. The worker enumerates choices, checkpoints needed weather,
calculates and persists one immutable result. Leases fence retries/late workers;
operational failures stay separate from unsuitable crops. Choose main/tied/alternative
plans inside compatible evidence groups only. Missing reviewed rules produce
`insufficient_evidence`; no real schedules can currently be recommended.

The default historical period is 1991–2020; 24 complete analogs/12 per half are
uncalibrated product coverage policies. Bounds: 128 snapshots, 20,000 daily rows,
8 MiB result, three tries, 600 seconds work and 900-second leases. Regional/cultivar/
health context remains unresolved. [Methods and primary sources](steps/07/methods.md).

## Exact versions

Step 07 adds account/history/workflow migrations and the auth/mail packages below.
Manifests and `pnpm-lock.yaml` remain the reproducible source of all resolutions.

| Component                                   | Version                  |
| ------------------------------------------- | ------------------------ |
| Node / pnpm                                 | 24.19.0 / 12.6.0         |
| Nest common/core/platform-fastify / Fastify | 12.1.0 / 5.12.5          |
| React / React DOM / Vite                    | 19.3.0 / 19.3.0 / 8.3.1  |
| Zod / TypeScript                            | 4.6.5 / 6.0.3            |
| PostgreSQL / pg / pg-boss                   | 18.4 / 8.23.0 / 12.35.0  |
| Drizzle ORM / Kit                           | 0.45.3 / 0.31.11         |
| Temporal polyfill / JSBI / Noble hashes     | 0.5.1 / 4.3.2 / 2.4.0    |
| reflect-metadata / RxJS                     | 0.2.2 / 7.8.2            |
| ESLint / typescript-eslint / Prettier       | 10.11.0 / 8.70.1 / 3.9.9 |
| Jest / Playwright                           | 30.5.2 / 1.63.0          |
| @types/node / @types/pg                     | 24.19.0 / 8.23.1         |
| @types/react / @types/react-dom             | 19.3.0 / 19.3.0          |
| Better Auth / Drizzle adapter               | 1.7.6 / 1.7.6            |
| Native Argon2 / Nodemailer / mail types     | 2.2.1 / 10.0.11 / 8.0.2  |
| Mailpit / scoped legacy esbuild override    | 1.31.3 / 0.28.2          |

Compiler 6.0.3 satisfies the installed linter's peer range; the earlier 7.x attempt
was corrected. Compatibility was established by installation/build/runtime checks;
[Step 01 evidence](steps/01/report.md) and [Step 06 evidence](steps/06/report.md).

## Foundation hardening (Step 09, 2026-10-16)

Requested by the user before Step 10: fix earlier weaknesses for production.

- **Client addresses:** a validated `TRUST_PROXY` (`false`, 1–9 hops or proxy
  addresses/CIDRs; never `true`). The production API refuses to start without
  it. Quotas and auth rate limits use the resulting address.
- **Security headers** on every API response: `nosniff`, `X-Frame-Options:
DENY`, `default-src 'none'` CSP, `no-referrer`, same-origin resources; HSTS
  only in production. Frontend hosting headers belong to Step 16.
- **No OAuth provider tokens:** a database trigger (migration 0007) nulls access,
  refresh and ID tokens on every write. Rotavise never calls Google APIs.
- **Lists:** plans and fields newest first, crop history by planting date, with
  opaque keyset cursors using exact microsecond or date keys plus ids.
- **Sign-in limits:** 10 attempts per email and client address per 10 minutes,
  plus 100 per email, so one address cannot lock a farmer out everywhere.
- **Supply chain:** Node and PostgreSQL images pinned by digest, CI actions by
  commit, type-aware promise lint for server and packages.
- Test databases carry a disposable label; stopped ones older than an hour are
  pruned. Mail inboxes are removed when stopped.

## Rotation engine (Step 10, 2026-10-16)

- **Formats:** catalog format 2 and request format 2 sit beside format 1.
  Format 1 keeps the two-cycle interface and older plans readable until Step 15.
  Release 0.2.0 is a mechanical, reproducible conversion of 0.1.0
  (`tooling/catalog/convert-release-v1.mjs`); its rules stay `extracted` and its
  source rights `unknown`, exactly as the 2026-09-27 review recorded.
- **Evidence policy:** only double-checked or expert-reviewed `soft`/`hard` rules
  bind. A scope the source leaves `unspecified` applies with a visible
  condition. Regions resolve only from sourced boundaries; 0.2.0 has none, so
  real requests still return insufficient evidence.
- **Scheduling:** each slot has an earliest and latest sowing date. The next
  crop starts after the previous earliest sowing plus its longest duration and
  the preparation gap (policy 0 days; crop rules may raise it). Each crop takes
  its next window occurrence only; rotations are maximal, so explicit fallow
  seasons are not generated yet.
- **Search:** beam search keeps the best partial rotations under five views
  (farmer weights and each single dimension) plus 25 per first crop, and counts
  every pruned and rejected extension. Exhausted budgets truncate visibly.
- **Climate:** exposure is computed once per crop, sowing date and analog year,
  and rotations combine it in consecutive-year analog sequences (1991–2020
  anchors, at least 20 complete). A climate budget exhaustion disables the
  dimension rather than failing the plan.
- **Comparison:** absolute 0–1 losses; a dimension is scored only if every
  candidate has it; weights renormalize over compared dimensions; Pareto set,
  ties, single-dimension and ±0.1 views. This replaces format 1's groups that
  required identical rule shapes.
- **Day arithmetic:** hot paths cache day numbers computed through Temporal;
  a unit test checks identical results over 1899–2100 dates. Benchmark: 12
  crops, 5 years, 30 analogs in under 1 s and about 0.66 MB.
- **Workflow 2:** `planning-workflow-2` pins policy and acceptance date;
  migrations 0010–0011 allow format 2 catalogs, inputs and results while
  keeping result kinds tied to their workflow.

## NASA data layer, Part A (Step 11, 2026-10-17)

Services, products and terms were checked live on 2026-10-17; the responses
are in `docs/evidence/climate-scenarios/2026-10-17/`.

- **POWER location (adapter 3):** POWER returned identical values for every
  recorded point inside one source cell and different values across cells, so
  requests send the centre of the intersection of the MERRA-2 (0.5° × 0.625°)
  and CERES SYN1deg (1°) cells. Cache keys, upstream calls and stored snapshots
  hold that centre, never the field position. Adapter 2 evidence (exact
  coordinates) still re-verifies for older plans; one assessment never mixes
  the two.
- **Future climate source:** NEX-GDDP-CMIP6 v2.0 (0.25°, daily, bias-corrected
  to GMFD) through the NCCS THREDDS subset service, which needs no account. A
  request for one 1° × 1° tile (16 cells) costs about the same as one point
  (7–12 s observed), so data are prepared per tile and shared by every field in
  it. Direct S3 reads were rejected: each yearly file is about 245 MB, chunked
  by whole days.
- **Licence:** the file metadata says CC BY-SA 4.0; the AWS registry entry says
  CC0 since September 2022. Rotavise follows the stricter terms: attribution in
  every result, and any redistributed data stays under CC BY-SA 4.0.
- **Ensemble:** the five ISIMIP3b primary models (GFDL-ESM4, IPSL-CM6A-LR,
  MPI-ESM1-2-HR, MRI-ESM2-0, UKESM1-0-LL). ISIMIP chose them for data
  availability and historical performance; their mean equilibrium climate
  sensitivity matches the CMIP6 mean (3.7 °C). Scenarios SSP2-4.5 and SSP5-8.5.
  Five models do not span every possible future; results say so.
- **Model worlds:** each model's historical run is its own baseline. Rotations
  start 1985–2004 in the baseline and 2041–2060 in each scenario, with
  consecutive years kept. The change in loss is future minus that model's
  baseline, so model bias cancels and POWER and model data never meet in one
  number. Each future world also ranks the candidates with the farmer's
  weights; the result says whether the current top rotation stays first.
- **Calendars:** exposure runs in each model's own calendar. A 365-day year has
  no 29 February (sowings on it have no analog, as in common Gregorian years);
  a 360-day year has no 31st, so the 31st maps to the 30th.
- **Preparation:** tiles are prepared by a `stately` pg-boss queue in slices of
  at most ten minutes, two requests at a time, resuming from what is stored.
  Plans never wait: a plan in an unprepared tile requests it (at most
  `SCENARIO_TILES_PER_DAY` new tiles per rolling day) and completes without
  future climate, saying why. `pnpm climate:prepare <lat> <lon>` prepares a
  tile directly. A tile is 1,125 requests (about 1.5 h at two at a time).
  Stored units are immutable and re-verified from their raw bytes on every read.
- **Workflow 3:** new format 2 requests pin engine 4 and policy 2. Engine 3 is
  retired: workflow 2 results stay readable, and an unfinished workflow 2 run
  fails with `WORKFLOW_VERSION_UNSUPPORTED`. Migration 0012 adds the tables and
  allows workflow 3.
- **OPERA DIST-ALERT moves to Step 14.** AppEEARS does not offer it, reading
  its UTM tiles belongs in the Step 13 science service, and its use is crop
  health ("check this area"), not rotation choice.

## NASA data layer, Part B (Step 11, 2026-10-18)

Real responses: `docs/evidence/earth-observations/2026-10-17/` (the account
e-mail that AppEEARS echoes was removed before commit).

- **Credentials:** the user stores the Earthdata username and password in the
  server `.env`; the assistant never handles them. The app exchanges them for
  an AppEEARS token (about 48 hours) and an Earthdata user token for GES DISC;
  neither is logged.
- **AppEEARS is slow:** the test point task (4 points, two years of HLS and
  SMAP) took 5.5 hours from submission to completion
  (16:13–21:47 UTC). Extractions
  are therefore durable background jobs: one step per job (submit, poll every
  10 minutes, download), a `stately` queue with one job per observation, and
  failure after 48 hours. The request row is the outbox: the API only stores
  it and the worker queues it within seconds, because a keyed job needs the
  worker's queue connection. Remote tasks are deleted once downloaded.
- **HLS greenness:** Landsat (B04, B05) and Sentinel-2 (B04, B8A) reflectance
  from HLS v2.0 at the outline's sample points. A pixel is clear when Fmask
  bits 1–5 are 0 and the aerosol level is not high; the bit layout was checked
  against the AppEEARS decoder. In the test record, excluding high aerosol cut
  clear Sentinel-2 observations from 851 to 573 of 1,120 and Landsat from 300
  to 262 of 360; a date still needs half its points clear.
- **Green seasons** (`vegetation-policy-1`, declared heuristics): a centred
  median of five observations; a season is a run above 50% of the record's
  amplitude (TIMESAT's amplitude-fraction rule, Jönsson & Eklundh 2004) that
  lasts at least 30 days, merges gaps up to 30 days and peaks above 75% of the
  amplitude; the amplitude must exceed four times the series' own noise. On
  the real Tadla record this gives January–April 2023 (peak NDVI 0.77) and
  January–April 2024 (0.49). Seasons are suggestions; the farmer names the crop.
- **SMAP:** SPL4SMGP.008 root-zone soil moisture, 3-hourly, averaged per day for
  the 9 km cell. Its percentile was undefined (fill value) on 468 of 731 days
  at the test cell, mostly March–November; those days keep the volumetric
  value and an empty percentile.
- **GPM IMERG:** Final daily V07 through the Giovanni time-series service for
  the 0.1° cell, shown by month beside POWER's monthly total for its own cell;
  a month counts only when every day has a value. Context only.
- **Location:** HLS needs the field's own pixels, so its sample points (from
  the saved outline) go to AppEEARS. SMAP and GPM receive the field point
  rounded to 0.01° (about 1 km). Requests are owned through the field and
  deleted with it; a task already at AppEEARS when a field is deleted remains
  there until AppEEARS expires it (30 days).

## Crop knowledge pilot (Step 12, 2026-10-18)

Release 0.3.0; report in `docs/steps/12/report.md`.

- **Extraction:** I read each source page myself and wrote the values into
  `tooling/catalog/release-0.3.0.data.mjs` with the exact words. The builder
  finds every quote on its page by machine (PDF.js text; case, whitespace and
  quote/dash forms ignored) and refuses to build if one is missing.
  `double_checked` now means "quote found by machine and interpretation read a
  second time"; it is not expert review. The Claude API was not needed here.
- **Which source wins:**
  - Moroccan official guidance (ONCA/ARDNA regional sheets, the ONCA legume
    reference, INRA) sets windows, rotations and disease breaks.
  - FAO-56 Table 11 sets durations when no Moroccan range exists.
  - FAO AquaCrop 7.3 defaults set stage timing and pollination stress, which
    no Moroccan guide gives.
  - Ranges keep the widest sourced span. A mismatch between sources is
    registered as a conflict, not averaged.
- **Rules use their source's scope.** National rules are scoped
  `morocco-general` and show as conditions in Tadla. Only the regional
  sugar-beet sheet is scoped to `beni-mellal-tadla`.
- **Thermal time:** stage windows use AquaCrop growing-degree-day method 3
  counted from sowing. The flowering window runs from the earliest start to the
  latest end of AquaCrop's cultivar ranges. A window that is not reached within
  the longest duration, or has a missing day, leaves the exposure unknown.
  Engine 4 keeps its version because older catalogs cannot express such
  windows.
- **Beet heat limit.** The sheet gives a favourable range (20–28 °C) and says
  summer heat is the main limit. Only days above 28 °C count; cool days would
  need a sourced threshold.
- **Reference-only crops:** lentil and chickpea have sourced windows but no
  damage temperature. Since climate is compared only when every candidate has
  one, they stay reference-only rather than receiving invented limits.
- **Regions:** geoBoundaries gbOpen (OpenStreetMap, ODbL 1.0):
  - Tadla is the three provinces containing the ORMVAT perimeter, unchanged.
  - Morocco is the ADM0 outline, simplified to about 50 m (closed-ring
    Douglas–Peucker) to fit the catalog's vertex limit.
  - The derived geometry in the release is shared under ODbL with attribution.
- **Varieties:** only INRA Morocco entries of the ONSSA registers are listed.
  Registration does not mean a recommendation, local performance or seed
  availability. The sugar-beet register has no INRA entry, so beet lists none.
- **Snapshots:** documents without a reuse licence are hashed, quoted and kept
  out of git. GBIF responses (CC BY 4.0) are committed. The local copies are in
  `~/Desktop/Rotavise-sources/2026-10-18/`.
- **Demo database:** the real-data demo runs in a disposable database and copies
  the prepared climate tile read-only from the dev database, so a demo never
  pins an unfinished release in the dev database. A first draft run did import
  an early 0.3.0 there (two guest test plans). Removing it needs the
  immutability triggers paused, which waits for the user's decision. Until
  then, `pnpm catalog:import` on that database reports
  `CATALOG_VERSION_CONFLICT` for 0.3.0.

## Morocco water balance (Step 12 Part B, 2026-11-01)

- **Method:** FAO-56 crop water use from temperature only (Hargreaves eq. 52, radiation eq. 21) with Table 12 coefficients and Table 11 stage shares, against NASA POWER rain in the crop's own season, per historical year. Hargreaves was chosen because the same formula can later run on climate-model temperatures. FAO says eq. 52 should be verified in each new region; that has not been done.
- **Score:** the water dimension is the share of crop water use not covered by rain. All rain counts as usable; soil storage and runoff are not modelled.
- **Arid warning:** rainfed cereals warn at or below 200 mm mean annual rain (ONCA cereals guide, page 24). It warns only; it never excludes.
- **Future rain:** NEX-GDDP-CMIP6 `pr` is now stored (kg m-2 s-1 converted to mm/day; migration 0016), so each model world runs the same balance on its own rain and temperature, and future rankings use it. NASA's rain files declare CC-BY 4.0, its temperature files CC-BY-SA 4.0; each unit records its own. A tile is now 1,500 requests.
- **Versions:** catalog 0.5.0, engine 5 and workflow 4 (migration 0015). Older results stay readable.

## Moroccan soil (Step 12 Part B, 2026-11-01)

- **Source:** SoilGrids 2.0 (ISRIC, CC BY 4.0) through its WCS, because its REST API returned 503. Fertimap was checked on 2026-11-01: its public site offers no data service and its map page relies on an old Google Maps setup, so it is not used.
- **Unit table:** ISRIC's documentation returned 502 and was blocked in the shell on 2026-11-01, so the divisors are from ISRIC's published table as recalled and are checked only physically (texture sums to 100, pH and bulk density in range). **Recheck against the docs when they return.**
- **Privacy:** requests name a 0.01° cell window (about 1 km) and values are the median of its pixels.
- **Use:** modelled pH only warns and never rejects; a farmer's test takes precedence. Cities and water have no values and report soil as unavailable.
- **Limits:** pH from the Moroccan guides (sugar beet, faba bean, chickpea as reference); no pH limit is sourced for wheat or barley. Salinity thresholds (FAO table in the AquaCrop annex) apply only to a farmer's test; SoilGrids has no salinity layer. No limit exists for faba bean salinity because the table has no faba row.
- **Versions:** catalog 0.6.0; migration 0017 adds immutable `soil_estimates`.

## Satellite rain and extremes (Step 12 Part B, 2026-11-01)

- **GPM correction:** POWER rain (about 50 km) is corrected month by month to GPM IMERG Final V07 (0.1°) over 2001–2020, limited to factors 0.2–3 (declared). Daily timing stays POWER's. Errachidia went from 278 to 182 mm a year. Without an Earthdata account the plan says `power_only`.
- **Extremes:** hottest day, coldest night, longest dry spell (<1 mm) and wettest day (ETCCDI definitions), with drought seasons declared as below half the slot's mean rain. They are reported past and future; they do not change the ranking beyond the existing temperature limits and water.
- **HLS and SMAP stay field context.** AppEEARS takes hours, so they cannot feed a plan that answers in a minute. They appear beside the plan, not in its score.

## Science service and yields (Step 12 Part B, 2026-11-01)

- **Service:** `apps/science`, a stateless Python container with AquaCrop-OSPy 3.1.0 (locked dependencies), no database and no farmer identity. Run it with `docker compose -f infra/science/compose.yaml up -d` and set `SCIENCE_URL`.
- **Setup:** temperature-timed (GDD) parameter sets, because the calendar-day defaults harvested barley in February. Seasons start 75 days before sowing on dry soil, filled by autumn rain; starting at field capacity gave rainfed Tadla wheat 7.3 t/ha, starting dry gave 1.07 t/ha. The start is a declared choice.
- **Status:** default parameters, reported as `uncalibrated_default_parameters`. The specification requires reproducing published Tadla wheat calibrations before showing absolute yields; that is **not done**, so yields are for comparison only and do not change the ranking. Faba bean has no parameter set and reports `no_crop_model`.
- **Failure:** the crop model never decides a plan; without it a plan completes without yields.
- **Unexplained:** in one 10-field run on 2026-11-01 the last three plans ended `failed`. The error was not captured and two later runs (3 and 10 fields) did not repeat it.

## Soil carbon (Step 12 Part B, 2026-11-01)

- **Model:** RothC on a monthly step in the pure domain package instead of the Python service, because it is short, deterministic and needs no Python library. Pool constants are the published Coleman & Jenkinson 1996 values, recalled rather than read from a retrieved document (the Rothamsted guide returned 404): **recheck**. The FAO GSOCseq manual gives the set-up, DPM/RPM 1.44, soil cover 0.6 and inert carbon (eq. 4).
- **Inputs:** IPCC 2019 Refinement Table 11.1A for residues and roots. AquaCrop yields, or the national legume mean of 7.6 qx/ha (ONCA legume reference, page 11) for faba bean. Sugar beet uses IPCC's generic row. Carbon share 0.45 of dry matter is declared.
- **Relative use:** today's soil is assumed balanced under the top rotation with residues grazed. Crop residues alone were far too low to hold a mapped stock (58 falling to 32 t C/ha), so an even background input (weeds, root exudates, other sources not counted) makes up the difference and stays constant, and only real residue differences change a result. Scaling all inputs instead gave an unrealistic 58 to 83 t C/ha. Results show direction between rotations and practices, not absolute forecasts.
- **Residues:** both cases are shown: grazed (ONCA cereals page 30, stubble usually grazed) and 30% kept (ONCA legume reference page 33, direct seeding). Results do not change the ranking.

## Crop health with Claude (Step 12 Part B, 2026-11-01)

- **Built, not yet exercised against the real API:** no key is set. `ANTHROPIC_API_KEY` goes in the server `.env`; without it the routes answer `AI_NOT_CONFIGURED`. The photo prompt and the model's accuracy are unevaluated, and the specification requires a labelled local evaluation before release.
- **Routes:** `POST /api/v1/crop-health/photo` and `POST /api/v1/plans/:id/explanation`, for guests and accounts, with per-owner quotas (20 photos, 30 explanations an hour). Model `claude-opus-5-5`, with server-side refusal fallback on.
- **Rules enforced by code, not by the prompt:** candidates must be on the crop's sourced list, a poor photo names nothing, at most three, and consent is required. An explanation containing a number not in the plan's facts is refused. Photos are not stored. No treatment advice is requested; since 2026-11-03 code also removes text that looks like treatment advice (see "Photo check hardening").
- **Limit:** the disease list has only four entries so far, so most real problems will come back "not sure".

## Guest access (Step 12 Part B, 2026-11-01)

Guests can do what accounts do: plans, crop health, fields, outlines, history and satellite requests, using their plan-session bearer token. `fields` has either a user or a guest owner (migration 0019). Guest data goes when the session expires or is revoked, and a guest's fields move to the account when the guest claims a plan. Accounts add permanent history. Satellite requests by guests use the same per-owner limits; there is no extra per-address limit on them yet, so a public launch must add one because AppEEARS work is slow.

## More Moroccan crops (Step 12 Part B, 2026-11-01)

- **Catalog 0.7.0** adds sunflower (Rabat-Salé-Kénitra), rapeseed (Saïs, Gharb, Loukkos regions), potato and open-field tomato (national), and onion (Tangier region), plus sugar beet in the Oriental, Casablanca-Settat and Rabat-Salé-Kénitra. Sources are ONCA's references and regional sheets on ARDNA, with FAO tables for what they lack.
- **Not plannable:** lentil and chickpea, since no damage temperature has been found. FAO ECOCROP now requires a Google sign-in, so it was not used.
- **Soil score corrected:** a crop with no sourced rotation preference used to count as a failure, which made legume–cereal rotations win everywhere. It now counts as neutral.
- **Known problem:** an unbiased 2026-11-01 test still gave most regions the same top rotation, rainfed or irrigated (it does change with the previous crop). Nothing in the ranking rewards yield yet. This must be resolved before results are shown as advice.

## Yield in the ranking (Step 12 Part B, 2026-11-01)

The final order is half the farmer-weighted comparison and half yield attainment (AquaCrop yield as a share of the same crop's unstressed potential that year); the half is a declared choice. Tonnes of different crops are never compared. A crop with no parameter set (faba bean, onion, rapeseed) takes the field's mean attainment. Only the 50 rotations shown are re-ranked, and yields stay uncalibrated. On 2026-11-01 the middle crop changed with region and water (barley in Souss, bread wheat in the Gharb and irrigated Tadla), while faba bean stayed first after a wheat season, in part through its sourced legume-after-cereal preference. Water still scores the rain shortfall the same for irrigated and rainfed fields; for irrigated fields it reads as irrigation demand.

## Crops without a temperature limit, and catalog 0.8.0 (Step 12 Part B, 2026-11-01)

- **Rule change:** a missing temperature limit no longer blocks a crop. It is left out of the climate score and listed as not checked; a rotation of only such crops takes the mean. Lentil is plannable this way. So far this holds for table beet, melon, courgette, pea, green bean, lettuce, groundnut and lentil.
- **Added:** table beet, melon, courgette, sweet pepper, cabbage, pea, green bean, lettuce and groundnut, from PNTTA bulletins (about 2002) with FAO tables. Vegetables and groundnut are offered to irrigated fields only, because their sources describe irrigated production; a test with them open to rainfed fields ranked summer courgette first.
- **Calendar limit:** a sowing window cannot cross the new year in one rule, so cabbage's September–January is encoded to December, and pea and green bean use two rules.
- **Still missing a required fact:** chickpea (no duration), garlic and carrot (no usable duration or date), watermelon, eggplant, maize, sesame. Trees and perennials are not modelled.

## All Moroccan crops so far: catalog 0.9.0 (Step 12 Part B, 2026-11-01)

Adds eggplant, watermelon, carrot and maize (irrigated) and lists olive, citrus, pomegranate, fig, apricot and peach as orchards that are never put in a rotation; 24 crops can be planned, some by region or water. Weak dates are stated in each rule: carrot's month is FAO's Mediterranean row, and maize's comes from silage trials. **Not plannable because a required fact is missing:** chickpea and garlic (no season length), sesame (no date). Web search found no Moroccan chickpea source on 2026-11-01. Almond, grape, date palm and other trees are not listed yet. **Open checks:** ISRIC's documentation was still returning 502, so soil units remain unchecked against it; RothC constants still need their primary source.

## Fair ranking: engine 6 (Step 12, 2026-11-02)

**Problem found:** faba bean ranked first after wheat in every test. Part of
that is sourced advice (a legume after a cereal), but part came from uneven
evidence. Catalog 0.9.0 checks cereals for heat and cold at flowering, faba
bean only for frost below −4 °C over the whole cycle, and 14 crops not at all,
so faba bean's climate loss was near zero because its test is lenient. Soil
gave full marks to crops with a sourced preferred predecessor and half marks
to crops without one (lentil, pea, chickpea).

**Decision:** rotation-engine-6 (planning-workflow-5) ranks on a dimension only
when every schedulable crop was checked the same way:

- **Climate** compares crops only on the kinds of temperature check every
  schedulable crop has. A kind is the variable, medium and limited side (for
  example "daily minimum, air, lower limit" is a cold check), not the limit
  value or stage. Other checks are left out of the ranked score and listed in
  `CLIMATE_CHECKS_DIFFER` (`comparedChecks`, `leftOutRules`). With barley,
  bread wheat and faba bean, climate is compared on the shared cold check and
  the cereals' heat checks are left out. If no kind is shared (a crop has no
  check), climate is reported but not ranked (weight 0). Future worlds still
  run; each rotation's change is compared with its own baseline. (Revised
  2026-11-03 from "only when every crop has identical checks", which disabled
  climate whenever one crop differed.)
- **Soil** scores only crop changes that can be checked: the incoming crop has
  a sourced preferred predecessor and the previous crop is known. Other changes
  are left out instead of counting as half met, so faba bean after wheat and
  lentil after wheat score the same, while barley straight after durum wheat
  still breaks barley's sourced preference. `SOIL_PREFERENCES_UNEVEN` names
  the crops left out. A first attempt that stopped ranking soil whenever one
  crop lacked a preference put barley first after durum wheat in the 0.3.0
  Tadla test, so it was replaced.
- The beam search uses the same applied weights, so uneven evidence cannot
  prune a crop early either.
- Water (one FAO-56 method), crop health and yields are unchanged.

**Consequence:** with mixed crops, ranking rests on water, checkable soil
changes, crop health and (where available) yields. Climate ranks on heat and
cold once every plannable crop has a sourced heat limit (daily maximum) and
cold limit (daily minimum); finding them is the next research task.
Workflow-4 results stay readable; unfinished workflow-4 runs fail as
`WORKFLOW_VERSION_UNSUPPORTED`, as older workflows already do.

## Engine speed: extremes loop (Step 12, 2026-11-02)

The Step 10 benchmark (12 crops, 5 years, 30 analogs) took 0.44 s in Step 10
but 33 s on CI and 63 s in the cloud container by Step 12, inside Jest. A CPU
profile put 87 % of the time in `rotationExtremes`: its daily loop called
`Math.max`, `Math.min` and `Number.isNaN` per day, and under Jest's VM modules
the loop was never optimized. The loop now uses plain comparisons, checks the
series end once per slot and computes each slot's sowing date once. Results are
byte-identical (SHA-256 of the full output for the default and benchmark
requests, old and new code). Benchmark in Jest: 65.9 s to 2.96 s; standalone:
3.0 s to 2.05 s. The 60 s test limit is unchanged.

## Photo check hardening (Step 12, 2026-11-03)

Audit of `apps/server/src/modules/crop-health` against the Claude API
documentation (vision limits read 2026-11-03: 10 MB per image, 8000 px a side,
accuracy drops below 200 px; Opus 5.5 reads up to 2576 px on the long edge).

- **Metadata removed before sending.** Phone photos carry GPS position, device
  and time. `photo-image.ts` checks that the bytes match the declared JPEG, PNG
  or WebP, reads the size without decoding, refuses under 200 px or over
  8000 px a side, and drops EXIF, XMP, IPTC, comments and PNG text chunks.
  Pixels are untouched (verified with Pillow). EXIF orientation goes with the
  metadata, so the website must re-encode photos with orientation applied
  before upload (Step 15).
- **No call without a sourced list.** A crop with no catalog problems answers
  `CROP_NOT_COVERED` and is never sent to the model. Catalog 0.9.0 lists 4
  problems for 5 crops (wheats, barley, lentil, chickpea) and no insect
  pests, so 19 plannable crops are not covered until research section G is
  imported.
- **The model can only pick listed ids** (enum in the output schema); code
  still filters, removes duplicates and keeps at most three.
- **Treatment advice is removed by code:** model text with a digit or a
  treatment, product or dose word (English, French, Arabic, Darija) is blanked
  and `text_removed` is set. A fixed `notice` in the farmer's language says it
  is not a diagnosis and to ask ONCA before any treatment. The Arabic and
  Darija notices need a native speaker's review.
- **Cost and limits:** `AI_DAILY_REQUEST_LIMIT` (default 300 calls a day for
  all users, 0 turns the AI off) on top of the per-owner quotas; 60 s timeout
  with one retry; 16,000 max tokens for thinking plus answer. Each call logs
  status, model and token counts only.
- **Errors:** 401/403 `AI_NOT_CONFIGURED`, 429 `AI_BUSY`, an image the API
  cannot read `PHOTO_UNREADABLE`, refusal `AI_DECLINED`, cut-off answers never
  shown. Over-long text is shortened instead of failing the request.
- **Tests:** 24 unit tests (photos, rules, the real SDK client against a local
  stand-in API) and an end-to-end API test with a stand-in provider (metadata
  gone, uncovered crop not sent, daily cap). No real API call has been made.
- **Release gate:** `pnpm crop-health:eval <folder> --confirm-cost` measures
  hit rate, "not sure" rate, false reassurance and false alarms on photos an
  agronomist labelled. It needs the key and real Moroccan field photos; until
  it has run, accuracy is unknown and the feature stays labelled unreviewed.

## Model-recall crop knowledge in the catalog (2026-11-07)

Authority: the user's message of 2026-11-07: "for the crops, knowledge that's
coming from AI, I trust it… make it as it's documented… I want to work with all
the crop knowledge we have, either from the resources or the research or from
AI… build the most perfect crops catalog with all the variety."

- **Rule:** the next catalog release contains rules and facts from Claude's
  training knowledge and treats them like every other knowledge: they work in
  the engine, climate checks, rotation and ranking the same way. Each item
  carries a small provenance field (`model_recall`, confidence, one-line basis;
  no quote and no invented citation) so its origin stays visible.
- **Sourced beats recall:** where a sourced fact and a recalled one disagree,
  the sourced one is used and the conflict is recorded.
- **Honest labelling:** provenance is recorded per item and recalled values are
  never presented as quote-checked. Results keep the existing "rules not
  expert-reviewed" limitation.
- **Records:** `docs/evidence/catalog/2026-11-03/research/` (facts.json plus the
  `claude-*.json` files; commit bdf538f).

## Near-term climate period beside mid-century (2026-11-09)

Authority: the user delegates technical decisions; asked on 2026-11-09 "should
we add it or what", the session recommended a near-term period (rotations
starting 2026 to 2035) because mid-century alone says nothing about the
farmer's own coming years, and started the work.

- **What:** the future-climate policy gains an optional `nearTerm` block: SSP2-4.5
  and SSP5-8.5 windows with anchors 2026-2035 and data to 2040, compared with each
  model's own historical 1985-2004 baseline, exactly as mid-century is. Results
  show it as `futureClimate.nearTerm` and per rotation as `future.nearTerm`,
  labelled `notAForecast: true`.
- **Data fetched:** only SSP 2026-2040 (600 units per tile). Historical
  2010-2014 and SSP 2015-2025 are not fetched: the baseline is 1985-2004 and no
  anchor starts before 2026, so the method never reads them. Checked on
  2026-11-09 against NCCS THREDDS: SSP2-4.5 2026 and SSP5-8.5 2040 files exist,
  historical ends in 2014 (2015 is a 404), so the CMIP6 split is as assumed.
- **Declared policy, not sourced:** 8 complete analogs of 10 anchors are needed
  (mid-century needs 20 of 20). A decade samples year-to-year variability more
  thinly than 20 years; the result states its window and minimum.
- **Compatibility:** the stored policy constant `futureClimatePolicy` is unchanged.
  The live `currentFutureClimatePolicy` is that plus `nearTerm`, so it has a new
  policy key, while stored units are shared by identity (an extended tile fetches
  only the new years and old tile rows stay as they were). Plans pinned to the
  old policy read exactly as before: with no `nearTerm` in the policy no key is
  added and the engine's output is byte-identical (golden hash unchanged). No
  new engine or workflow version, no migration: the pinned policy selects the
  behaviour, as with the what-if.
- **Degrading:** near-term units are pinned apart and only after the
  mid-century ones. A tile without them completes with mid-century compared and
  `nearTerm.reason = NEAR_TERM_TILE_NOT_PREPARED`, and asks to be extended under
  the live policy's key (same daily limit as any new tile).
- **Limit:** one-worker download of the extra years at the measured rate is
  about 1.5 to 2 days for 91 tiles; the fetch concurrency cap of 4 is deliberate.

## Release limits

Reviewed agricultural rules, regional validation, farmer UI, real email delivery,
measured public load, security review, production role separation
and backup/restore remain required. Remote CI is unverified. No provider is universally best,
no tests establish future uptime, and READY_FOR_REVIEW is not launch approval.

## Scoped engine outputs under a pinned policy (2026-11-10)

The user's engine-output task authorizes this backend follow-up, not the full
Step 15 frontend milestone. New format 2 plans pin optional
`outputs: "rotation-outputs-1"` in rotation-policy-2. Older policies omit it;
no defaults or stored releases are rewritten. The output schema checks the
policy against the presence of the reporting blocks.

Vulnerability periods report the same historical analog exposures, growth-stage
windows, temperature bounds, representative sowings and FAO water arrays already
used by the engine. They include rule IDs, exact catalog citations and the
original verification record (including model_recall confidence/basis). They
are stage/calendar envelopes with exposure numbers, not forecasts. Cold bounds
are not automatically reinterpreted as frost damage; rain shortfall is not
measured water stress when storage/runoff/irrigation supply are unknown.

Terrain, ECOSTRESS and regional water-storage summaries are reported per field
and referenced per rotation. Completed owned-field evidence is copied at plan
acceptance into hashed versions JSON. Slope and the existing RUSLE LS indicator
are reported, with full original provenance. **No erosion ranking is applied**:
R, K and P are unavailable and the existing LS method includes recalled and
engineering assumptions. Explicit dimensionless C factors can be represented by
the additive catalog reference topic `rusle_cover_management_factor`; a single
scalar reference is echoed with citations or the catalog's exact recall record.
Ordinal `erosion_protection` references are never converted to C. Missing or
ambiguous C stays `not_found`; missing factors and null soil loss are explicit.
No catalog release was edited. Infiltration/drainage remains unknown. New-policy
strategies replace the stale `GAP_EROSION_NOT_ASSESSED` note with structured
terrain context; old-policy strategy text remains byte-identical.

`preferences.equipment_limits` accepts optional capacity (`none`, `small`,
`medium`, `large`) and/or 1–32 unique unavailable operation IDs, each using the
existing crop/operation ID string bound. `market_access` accepts `none`, `local`,
`regional`, `export`; `income_weight` is a dimensionless integer 0–5, like the
existing priorities. These are product input bounds, not agronomic thresholds.
The current catalog has no structured machinery/operation requirements, market
access requirements, or comparable net income with costs, currency, area and
period. Therefore all three report `not_found` and apply **zero filtering and
zero ranking adjustment**. Yield and forage/protection classes are not prices,
income or equipment evidence. Future economic or machinery scoring requires
explicit catalog semantics, source scope and a new pinned policy; these inputs
must not silently start changing old results after a catalog extension.

Every new-policy result records all ten requested NASA inputs, their actual
selection where used, resolution, evidence identities and resampling status.
Unused inputs are labelled `not_used`; unavailable native cell IDs and provider
processing are `not_found`, not guessed. No common raster is constructed. See
[common-grid.md](architecture/common-grid.md) and the saved implementation quote
ledger. Scientific/provider facts were not independently re-researched here.

## B2r — free Moroccan field suggestions (2026-11-10)

The user separately authorized research, provider selection and backend
integration for B2r; this does not advance or approve a milestone. Choose the
**existing FTW 2025 Morocco GeoParquet**, CC BY 4.0, as an optional source of
suggested outlines. Use manual painting/drawing/upload for absent or wrong
suggestions. No detector, point-seeded segmentation or imagery pipeline is
built. Leave `FIELD_BOUNDARIES_ENABLED=false` by default. No frontend changes.

The real Tadla and Beni Mellal windows yielded 243 and 167 2025 polygons;
visual overlays show useful alignment with many visible agricultural blocks
and strips, alongside merged plots, fragments and omissions. Accuracy,
small-field recall and orchard correctness are **unmeasured**. OSM's sampled
farmland/orchard polygons mostly bound much larger landuse areas, so adding
OSM as a fallback risks selecting many fields at once and is rejected. OneSoil
free Moroccan reuse rights are not verified. Other inspected products are
crop-extent rasters, buildings, partial survey/reference data, or would need
new inference. The source evidence, SHA-256 ledger, licence distinctions,
comparison and limitations are in the
[B2r report](evidence/field-boundaries/2026-11-10/field-boundaries-report.md).

Import one selected year into separate shared reference tables with a pinned
export hash, upstream URL/ETag, attribution, licence and cleaning report.
Activate an import atomically; never combine two yearly versions. Existing
private saved-field boundaries remain independent. Reference geometry is
public data shared across owners; both read endpoints require a guest/account
owner and enforce per-owner quotas. Taps and identities never go upstream and
are not persisted. Known FTW confidence is divided by 100, null is preserved;
it describes a 500 m cell and must never be called polygon accuracy. Reject
unusable geometry and count drops. Return only shapes passing the shared
boundary contract, at most 200 vertices plus closure, with at most 2% area
change (including dropped holes) and at most 5 m simplification tolerance.

The country partition is about 1.8 GB across both years; a complete
country Postgres load and its performance are not measured. Small real samples
exercise the integration in disposable PostgreSQL. No automatic refresh,
accuracy promise, deployment, purchase or new provider credential is implied.

## Sourced income and benefits, opt-in catalog 0.14.0 (2026-11-10)

This scoped user-authorized implementation adds research evidence to a new,
strictly additive release. Earlier releases and the default catalog version
remain unchanged. Acceptance selects `income-benefits-1` only for a catalog
carrying that evidence, pins it in the existing hashed policy, and replays older
pins without new result fields. No milestone approval is recorded.

Gross revenue is a **derived historical scenario**, never predicted farm income
or profit: multiply only matched crop/product, scenario, region and observation
year price/yield records, retaining the original facts and MAD. The exact mass
identity 1 tonne = 1,000 kg reconciles FAOSTAT's kg/ha and LCU/tonne; it is not an
exchange rate or inflation adjustment. No quintal, UF, undated-budget, currency
or inflation conversion is inferred. Costs and margins remain published figures
with their source definitions and conflicts. The research's original eligibility
flags remain visible; historical scenario calculations do not claim current
production calibration or independent expert review.

Income can reorder only fully supported rotations within their existing ranking
positions, with a common historical year and region for that peer cohort. Other
rotations retain their positions and base scores, with explicit gaps. The latest
common year is used; conservative gross-revenue bounds are normalized within
the cohort and combined with the requested income weight and existing priority
weights. `weightedLoss`, sensitivity views and Pareto flags retain their original
four-dimension meaning; `resources.income.ranking.combinedLoss` explains the
additional ordering. The bounded search is unchanged and does not search by
income. If crop-model yields arrive, the income comparison is reapplied to that
final base ordering. Evidence is shared once per crop and referenced from each
candidate/strategy to bound result size.

Benefits remain conditional sourced context, including following-crop identity,
regions, non-local flags, named pest/disease relationships, management conditions,
conflicts and numerical gaps. Biological fixation is never substituted for a
following-crop nitrogen credit. Mixtures and site conditions are not assumed to
match a farmer's management. No non-local value replaces Moroccan evidence.

**Erosion decision:** use only explicitly sourced dimensionless RUSLE C values
for partial `LS * C` exposure scenarios when the existing pinned terrain LS is
available. Label the product derived, with its inputs and conditions. Do not
average C over a rotation or report soil loss: R, K and P are absent, slope length
is assumed, and the olive/vineyard C observations lack local management
validation. These scenarios stay unranked. Generic historical USLE land-use rows
and ordinal erosion-protection classes cannot supply crop C factors. Actual
RUSLE soil-loss ranking requires complete locally applicable factors and a new
pinned policy; this task does not invent those inputs.

Coverage distinguishes crops with any income inputs, derivable historical gross
revenue, benefits, C factors and rankable erosion. Bounded formatted format 2
release reads allow 12 MiB because this research release exceeds 8 MiB on disk;
the canonical catalog and result ceilings remain 8 MiB. New quotes are checked
against hash-verified originals and saved research text, with prior visual
transcriptions identified rather than represented as a fresh visual review.

## B4 — complete benefit coverage and sourced-only erosion scenarios (2026-11-10)

This separately authorized task adds opt-in catalog 0.15.0 and the pinned
`benefits-2` research policy. It preserves all preceding data, including
historical search gaps and income evidence, and does not change the default
catalog or income calculations. Every crop/effect receives sourced evidence,
explicit model recall, or a genuine not-applicable reason. Source-backed
findings precede recall; local sourced evidence sorts first. Recalled ranges
remain unverified and must not masquerade as quotes, measurements or a
following-crop fertilizer recommendation. Botanical family alone does not make
non-nodulating carob a nitrogen fixer.

Four plain-language crop-role explanations belong to the API glossary's `role`
group, with exact quotations, source URLs/hashes and all four languages. Arabic
and Darija remain `model_translated_unreviewed`. New-policy strategy notes and
slot selections link to shared per-crop evidence; they are conditional context,
not new scoring thresholds. Earlier policies/catalogs keep their output paths.

**Erosion decision:** report explicit sourced RUSLE C observations as separate
crop/management scenarios, including ranges and non-local conditions. Never
turn historical USLE land-use rows, ordinal protection classes or recalled
qualitative cover into a numeric RUSLE C. Do not collapse multiple scenarios
into a field estimate. Erosion cannot affect ranking unless every factor
actually used (R, K, L/S, C and P) is sourced and applicable, including measured
or otherwise verified slope length and management. R/K/P and verified slope
length are still absent, so this implementation remains unranked and says why;
it reports partial LS*C context and no soil-loss estimate. A future complete
factor implementation requires a separately versioned policy and tests.

Release 0.15.0 exceeds the old catalog-body bound. Generated, reviewed migration
0027 raises only format 2 catalog JSON-text capacity to 16 MiB; application
canonical capacity is also 16 MiB and formatted release reads are bounded at
24 MiB. Format 1 and the 8 MiB engine-result ceiling stay unchanged. This does
not alter old rows, source hashes or immutability protections. Verification,
coverage, source restrictions and proposed progress wording are recorded in
[the B4 report](steps/15/b4-notes.md). No milestone approval, UI work, deployment
or production-data change is implied.

## FM — separate the field photo from dated science imagery (2026-11-12)

The user authorized a scoped map/usability repair in Step 15. Use EOxCloudless 2025 as the default base for the non-commercial local prototype; retain NASA HLS (30 m) and MODIS (250 m) as explicitly selected dated science layers and compare views. Real Tadla/Beni Mellal screenshots at z14–16 show that EOX's 10 m detail improves on HLS but still cannot match OneSoil-like field sharpness. Source maxzoom 15 describes delivered tiles, including resampling, not 5 m/sub-metre native detail. This limitation remains open for review.

[EOX pricing](https://cloudless.eox.at/pricing) permits direct public-endpoint use subject to **CC BY-NC-SA 4.0** for 2018–2025; 2025 was the newest listed public vintage checked. Exact displayed credit: **[EOxCloudless](https://cloudless.eox.at) by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)**. Open-source application code does not grant commercial rights to this imagery. Review or replace the provider before any commercial deployment. No publication, service purchase or account creation is authorized by this decision.

Esri's anonymous tile URL is excluded because its [item terms summary](https://goto.arcgis.com/termsofuse/viewsummary) does not establish free use in a non-Esri application. The official [MapLibre integration](https://developers.arcgis.com/maplibre-gl-js/get-started/) requires an account/token; no credential was available. OpenAerialMap's actual local query found weather rasters rather than a consistent high-resolution aerial base. NASA Landsat WELD is historical and not finer than EOX. Google, Bing and OneSoil tiles are not used.

Use [OpenFreeMap](https://openfreemap.org/) for key-less vector orientation only. Its public service permits commercial use, has no SLA, and requires OpenFreeMap/OpenMapTiles/OSM credits. Render French and Arabic names when available with a halo; lazy-load orientation after the base. Keep MapLibre's required Arabic shaping worker local and retain its BSD/Unicode licence. No tiles are built or hosted.

Service liveness controls initial shell health; national-data readiness is available on demand in the compact status popover and cannot block the map. Capabilities gate optional account reads to avoid auth-disabled 404s. Feature-specific errors remain within their feature. Preserve the actual readiness 503 in evidence rather than inventing complete national datasets in the test harness.

Details, live evidence, verification and remaining acceptance gaps: [FM notes](steps/15/fm-notes.md). No milestone approval or backend change is recorded.

## Explicit crop names and display preference, opt-in catalog 0.16.0 (B8, 2026-11-13)

The scoped B8 task adds English entries copied verbatim from primary crop and
cultivar display names (`origin: primary_name`), and explicitly qualified
model-recalled Darija names for the 68 remaining crop gaps and 136 selected
Moroccan cultivar names. These records use the requested provenance date
2026-11-12. Rare introduced crop loan forms are review candidates; language
coverage does not prove actual farmer usage or species-safe local naming.

Preference is a display selection independent of evidence quality. Existing
preferred sourced names remain preferred; otherwise sources outrank recall,
and existing order breaks ties. Earlier entries are preserved unchanged and
preferred copies are appended where necessary. Copied English labels do not
invent citations or recall; runtime validation requires an exact match to the
owning crop/cultivar's primary name. Optional metadata has no parse defaults,
preserving historical catalog and detail hashes.

Four new name citations are checked against explicitly labelled visual PDF
transcriptions with original and render hashes. Their sources are Moroccan
Arabic-language documents; Darija use of the proper names/loan is a model
interpretation, not a claim that the documents are written in Darija. Native
and botanical review remains open. No default catalog setting or frontend
was changed. See [B8 notes](steps/15/b8-notes.md) and
[native review](evidence/catalog/2026-11-12/names-for-native-review.md).

## Regional comparison policy (B7, merged 2026-11-14)

New format-2 requests pin `comparison: regional-comparison-1`: 60 finalists per
scoring view and one per first crop, consistent missing-component handling in
search and final ranking, memoized pure calendar lookups, and per-candidate
future-climate comparisons, so one candidate without climate no longer removes
the comparison for all others. Old pins, results and golden hashes are
unchanged; no migration. Every feasible first crop keeps its best rotation and
real rank. Measured on six regions (Tadla, Souss-Massa, Gharb, Oriental, Saïss,
Haouz): engine time fell from 7.6–9.0 s to 4.1–5.9 s.

Known limit, accepted for now: in suggest mode the top-ranked rotations often
use minor crops whose rules are model recall (amaranth, rocket, berseem, chard),
while sourced staples rank lower (durum wheat 46–178). This reflects uneven
evidence, not agronomic merit. The demo uses consider mode; task B06 addresses
suggest mode. Details: [B7 notes](steps/15/b7-notes.md),
[regional comparison](architecture/regional-comparison.md).
