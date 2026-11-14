# Step 07 — important implementation decisions

## Authentication and email

Research date: 2026-09-27. Select self-hosted Better Auth **1.7.6** (MIT) and
Drizzle adapter **1.7.6**. Official declared peers accept installed Drizzle 0.45.3,
Kit 0.31.11, pg 8.23.0 and Zod 4.6.5. Use the
[official Fastify handler](https://better-auth.com/docs/integrations/fastify) and
[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), without the
community Nest integration's beta Fastify support. Actual installation/build/
PostgreSQL/auth tests establish compatibility; final checks are in the report.

Verified email/password is the initial login method. This avoids a new hosted
identity account or paid integration. Farmer email accessibility is not validated;
phone/social login remains a later evidence-based choice. Use the maintained
library's password/session/verification implementation, not custom authentication.
[Email/password](https://better-auth.com/docs/authentication/email-password),
[sessions](https://better-auth.com/docs/concepts/session-management),
[security](https://better-auth.com/docs/reference/security),
[rate limits](https://better-auth.com/docs/concepts/rate-limit).

SMTP transport: Nodemailer **10.0.11**, Node >=20, MIT-0; types **8.0.2** compile
against the installed package. [Official SMTP options](https://nodemailer.com/smtp).
Queue verification/recovery emails durably with encrypted content; SMTP runs in
the separate worker. Use a disposable local inbox for tests/development. No real
sending domain or commercial SMTP provider is selected/configured by this step,
and no external recipient is contacted. Production delivery/deliverability remains
unverified until authorized credentials/domain exist.

## Boundaries

Guest intake/session data and every earlier migration/evidence record are preserved.
Optional accounts add ownership and persistence; they do not validate crop rules.
Unknown geographic/health/cultivar facts must remain unresolved in server context.
No fabricated boundaries, diagnoses, crop thresholds or weather.

Detailed operational policies, actual pins and verification results are
recorded in the final report. No claim of whole-product launch readiness.

Passwords use **@node-rs/argon2 2.2.1** through Better Auth's
[documented extension](https://better-auth.com/docs/authentication/email-password#configuration):
Argon2id v19, 64 MiB, three iterations, one lane, 32-byte output; native random
salt. These exceed the current
[OWASP minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
At most two hash/verify operations run per API process and 16 wait; reject excess
work and malformed/excessive stored parameters. Verify native binaries on both
this Mac and the production Linux container. No hashing algorithm is implemented
in application code; sessions/verification remain Better Auth's responsibility.

## Important methods

- Public `getCurrentAdapter` and a private plugin table put sign-up and encrypted
  mail in the same native auth transaction. Better Auth absorbs mail callback
  errors; request-local failure tracking refuses HTTP success if enqueue fails.
  PostgreSQL rollback is tested with an injected constraint failure. No library
  internals are patched, and no fire-and-forget operation is used for durability.
- AES-256-GCM uses a random nonce and message identity as authenticated data;
  its domain-separated key derives from the server auth secret. Delivery leases
  last 60 seconds, at most five tries. Same Message-ID on retries; SMTP can still
  duplicate after a crash following acceptance. Content is erased on terminal
  state. Pending mail must be drained before rotating this secret.
- Thirty anchor years **1991–2020** use the current
  [WMO reference period](https://wmo.int/wmo-climatological-normals). These are
  matched growing windows from POWER, not certified WMO station normals.
  Split 1991–2005/2006–2020; require 24 complete analogs and 12 in each period.
  Completeness thresholds and ranking weights are explicit, uncalibrated product
  policies. Differences describe history, not forecasts or climate attribution.
- Enumerate first; merge only required growing windows, split to 366-day queries
  and persist each snapshot identity before calculation. Maximum 128 snapshots,
  20,000 daily rows, 8 MiB result, three attempts, 600 seconds of work and a
  900-second queue/database lease. First persisted snapshots remain pinned across
  retries. Terminal results, input versions and weather references are immutable.
- Choose all tied first-place schedules and up to two different crop-pair
  alternatives **inside each comparable group**. No global winner. Keep every
  rejected/unranked choice and linked reasons/rules/weather identities.
- The component assessment retains earlier engine scope/deferred markers; use
  the full result's `processing` summary for actual workflow completion. Local
  geography/cultivars/health remain unresolved until trusted evidence exists.

## Dependency correction

Better Auth's Drizzle Kit peer pulled `@esbuild-kit/core-utils`' legacy esbuild into
the production dependency graph. The initial audit found
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
The scoped pnpm override installs current stable **0.28.2** instead. Test actual
Drizzle generation, peer consistency, audit and frozen builds after this change;
do not exclude the advisory or loosen peer checks.
