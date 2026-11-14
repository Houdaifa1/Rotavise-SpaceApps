# Step 07 — accounts, saved history and complete backend workflow

Authorized by the user's “go ahead” after the Step 07 explanation. Implement the
account/history gate first, then connect worker, weather and engine. Step 08 UI,
external deployment and fabricated agricultural evidence are outside this step.

## Acceptance

| ID  | Required behavior                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 | Current primary-source authentication/mail research, installed compatible stable pins, reviewed Drizzle migrations; preserve approved stack.                                            |
| B02 | Verified contact, sign-up/in/out, password recovery/change, expiring/revocable database sessions; safe cookies, strict origins/CSRF, bounded input and shared quotas.                   |
| B03 | Durable encrypted verification/recovery email jobs; actual disposable SMTP delivery, retries/recovery; no secrets/payloads in logs or browser configuration.                            |
| B04 | Owned saved fields, dated crop history, plan history; bounded lists/records, versioned inputs/results, retention and account deletion.                                                  |
| B05 | Guest planning remains private/temporary; account ownership on every read/write/list/job; explicit atomic repeatable guest claim requiring both live sessions.                          |
| B06 | Existing intake records remain readable; full planning requests pin catalog/context/policy/engine versions and enqueue atomically, with clear stages and terminal outcomes.             |
| B07 | Worker verifies evidence, generates all selected/alternative choices, retrieves only needed historical windows and calls pure engine; missing rules prevent invented schedules.         |
| B08 | Complete comparable groups yield explained main/alternative plans with ties/sensitivity; incompatible groups and insufficient evidence cannot become a universal recommendation.        |
| B09 | Persist weather snapshot identities/results; retry/crash recovery is fenced/idempotent; deletion/expiry/late workers cannot resurrect or overwrite results.                             |
| B10 | Operational provider/storage failures remain failures, separate from unsuitable crops; bounded weather/search/work/result sizes and job lifetime.                                       |
| B11 | Real PostgreSQL ownership/concurrency/migration/deletion/expiry tests, native auth HTTP/session/SMTP tests and explicitly labeled synthetic pipeline fixtures.                          |
| B12 | Full verification, production container, clean frozen installation/build; short report, exact commands/versions/demo and passed/failed/blocked matrix; READY_FOR_REVIEW then stop.      |
| A01 | Reviewed local calendars/cultivars/durations/rules, trusted geography and health verification remain required for real recommendations; missing evidence is BLOCKED, never substituted. |
| A02 | Real sending domain/deliverability, intended-load/security/agronomic review and production backup/deletion policy are release gates; report unverified checks explicitly.               |

## Files and checks

- Server `modules/auth`, `modules/fields`, and existing `modules/plans` application/
  worker boundaries; auth/mail configuration and explicit migration/queue wiring.
- Shared auth/history/planning contracts and PostgreSQL schema/reviewed migrations.
- Pure result-selection methods when required; calculation code stays independent.
- Tests grouped by auth/history/planning verification; disposable SMTP and PostgreSQL.
- Developer demos and concise Step 07 report/decisions/progress/run instructions.
- Install/peers/audit, strict builds/types, affected suites, durable real integration/
  recovery and full `pnpm verify`. No public service is required by deterministic CI.
