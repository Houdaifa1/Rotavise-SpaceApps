# Step 09 — Field Shift re-baseline and foundation hardening

Authorized by the user's 2026-10-16 messages: win Space Apps Field Shift with a
production-grade product, work one step at a time, decide technical matters
("Don't ask me, you are the expert"), and leave the frontend until its design
is agreed. A later message asked to fix earlier weaknesses before the next step:
"if anything is not good before the next step, you should go back to it, fix
it". Part A re-baselines the plan. Part B hardens existing backend, data and
build foundations. No crop evidence, engine behavior or interface design
changes; frontend defects are recorded for Step 15.

## Acceptance

### Part A — re-baseline

| ID  | Required behavior                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | The specification maps every phrase of the Field Shift summary to a capability and step; the previous specification and goals are archived.  |
| R02 | Competition constraints are recorded from the official FAQ and terms, with dates, without disguising pre-existing work.                      |
| R03 | Material decisions are recorded with their authority and reasons; superseded rules are marked, not silently deleted.                         |
| R04 | Progress, roadmap, repository instructions and README point to the new plan; Step 08 is closed by the user's instruction.                    |
| R05 | Inaccurate Step 08 claims are corrected in a dated note: unbounded polling, the dropped map pin, and the real causes of "no recommendation". |
| R06 | Browser tests choose free API, worker and web ports, so `pnpm verify` passes while unrelated processes hold 3000, 3001 or 5178.              |
| R07 | Full `pnpm verify` and affected checks are run; the report records exact commands, results, limits and anything blocked.                     |

### Part B — foundation hardening

| ID  | Required behavior                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R08 | Client addresses come from a validated trusted-proxy setting that production must state explicitly; untrusted forwarding headers are ignored.        |
| R09 | API responses carry security headers: no MIME sniffing, no framing, a restrictive policy for JSON, no referrer, same-origin resources, HSTS in prod. |
| R10 | OAuth provider access, refresh and ID tokens are never stored; the database enforces it.                                                             |
| R11 | Saved plans, fields and crop history list in a stable, meaningful order (newest plans and fields first, history by date) with an opaque cursor.      |
| R12 | Bounded maintenance deletes expired weather cache rows and unreferenced snapshots, which hold exact coordinates; evidence used by live plans stays.  |
| R13 | Repeated sign-in attempts from one address cannot lock a user out for everyone; test containers are removed even when a run is interrupted.          |
| R14 | Container base images and CI actions are pinned to immutable digests; server and package code passes type-aware promise lint rules.                  |
| R15 | Every change has real PostgreSQL or process-level tests, and the full gate passes again after Part B.                                                |
