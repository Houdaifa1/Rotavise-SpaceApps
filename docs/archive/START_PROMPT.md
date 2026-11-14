I am starting Rotavise as a real software product. Implement Step 01 only in the selected project workspace.

Read `AGENTS.md`, `ROTAVISE_HANDOFF.md`, `STEP_01.md`, and `API_EVIDENCE.md` once before implementation. If these are attachments, copy them into the project without overwriting existing instructions blindly. Treat my current instructions and this updated handoff as the project specification; the earlier blueprint is background and contains superseded stack and scope choices.

Use the selected TypeScript architecture: pnpm workspaces; Node.js 24 LTS; NestJS with Fastify; React with Vite; Zod contracts; PostgreSQL 18; Drizzle migrations; pg-boss; separate API and worker entry points. Verify current stable package compatibility against official documentation and actual installation before pinning versions. Do not reopen framework selection unless a concrete incompatibility makes the approved choice unworkable; show the evidence before proposing a change.

Begin with a concise explanation of Step 01, the files you will create or modify, and the checks you will run. Then execute it. You are authorized to perform the normal local implementation, dependency installation, disposable database setup, tests, debugging, and fixes required for this step. Do not ask me to approve routine commands. Preserve existing work and follow the environment's real permissions.

Deliver the foundation specified in `STEP_01.md`: reproducible workspace, API health checks, real PostgreSQL migrations, a durable development-only test job, worker recovery and idempotency, a minimal frontend showing real backend availability, automated checks, and exact run instructions. Do not implement crop advice, NASA adapters, accounts, the full planner, or future milestones in this step.

Research only the dependencies needed for this step. At the later data-provider milestone, compare credible providers using current primary sources, exact datasets, commercial terms, real sample requests, uncertainty, and measured behavior. Do not assume any provider is universally best or add integrations without a decision they improve.

Fix defects within the authorized step until the required checks pass. Do not remove tests, weaken validation, hide errors, use fake database behavior, or claim unrun checks passed. Clearly identified synthetic fixtures and controlled failure injection are required for infrastructure testing; they must never appear as agricultural output or survive as enabled public production routes.

Write `docs/steps/01-report.md`, `docs/DECISIONS.md`, and `docs/PROGRESS.md` with what was built, why, exact dependency versions, actual commands/results, a demo, limitations, and a passed/failed/blocked acceptance matrix. Use the status **READY_FOR_REVIEW**, not “approved,” when the step passes. If blocked, show the exact blocker and complete independent work without silently substituting an inferior system.

Stop after Step 01. Give me a self-contained review report and the exact commands to verify it. Wait for my explicit approval and instruction to start the next step. A successful test run, silence, or “looks interesting” is not authorization to advance. If I request fixes, stay in Step 01 and rerun the affected checks.

Be direct and precise. Explain material decisions and limitations. Do not promise perfection; demonstrate correctness with evidence. Start the work now.
