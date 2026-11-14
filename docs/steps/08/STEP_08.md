# Step 08 — farmer web workflow

Authorized by the user's “go ahead with it” on 2026-09-30. Build only the farmer
web experience and API boundaries it needs. Do not manufacture agricultural
evidence or begin external deployment, photo analysis or greenhouse work.

## Acceptance

| ID  | Required behavior                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 | A responsive, keyboard usable frontend gathers location coordinates, dated crop history and health observations, soil, water, two-cycle dates, considered/excluded crops or suggestion mode, and priority. Unknown is explicit; inputs use the shared runtime contract. |
| U02 | The form loads real catalog options with identity/review status. It shows a review before submit, validation errors, and a clear route to change inputs.                                                                                                                |
| U03 | Guest planning creates a private session, submits once with an idempotency key, polls boundedly, resumes after refresh, and distinguishes queued/running/completed/failed/expired/network states. No guest token enters a URL or log.                                   |
| U04 | Results present the real outcome, considered choices, dated main/tied/alternative timelines when supported, rejected/unranked reasons, missing evidence, provenance and caveats. No invented recommendation on insufficient evidence.                                   |
| U05 | A public weather explorer accepts supported variables/date/location only, uses a server-side quota, and displays daily chart/table, units, missing days, coverage, source/grid/time standard. Browser never receives the internal provider token.                       |
| U06 | Optional email account UI covers signup, verification instructions, login/logout, recovery, saved fields/history/plans, explicit guest claim and deletion. Owned data stays in backend sessions.                                                                        |
| U07 | Optional Google sign-in is configured safely with explicit linking and no implicit same-email account merge. Missing Google credentials leave the route disabled and are reported as an external verification blocker.                                                  |
| U08 | Browser tests exercise real API/DB/worker/SMTP where feasible, validation, privacy and failure states; full verification and a concise report record exact passes and blockers.                                                                                         |

Release gates remain in Steps 09–10: reviewed local crop evidence, agronomic and
security evaluation, intended-load checks, real mail and Google credentials,
backup/restore and deployment. Step 08 may be **READY_FOR_REVIEW** for its
verified component only; unresolved required U criteria are **BLOCKED**.
