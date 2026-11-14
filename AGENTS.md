# Rotavise — team instructions (binding)

Rotavise helps Moroccan farmers choose multi-year crop rotations from NASA data
(NASA Space Apps 2026, challenge "Field Shift"). The backend, data and engine
are built; the team is finishing the web app during the hackathon
(14–15 November 2026). Team lead: Houdaifa (GitHub `Houdaifa1`).

## How work is assigned

- All work is listed in `docs/tasks/BOARD.md`; each task has its own file in
  `docs/tasks/` (for example `docs/tasks/F06.md`). The task file is the
  authorization: do the task you were asked for, nothing else.
- "Do task F06" (or "do the next frontend task") means: follow
  `docs/tasks/WORKFLOW.md` from start to finish for that task.
- Never start a task whose row on the board says someone else has it, or
  whose dependencies are not done. If in doubt, ask the person you work for.
- Files outside a task's "may change" list are off limits. Two tasks never
  change the same files at the same time; the board says who owns which area.

## Setup and commands

- First time on a machine: `docs/SETUP.md`.
- Node 24.19.0, pnpm 12.6.0, Docker running.
- `pnpm dev` starts API (3000), worker (3001) and web (http://127.0.0.1:5173).
- Checks: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:web`,
  `pnpm test:unit`, `pnpm build`; browser tests `pnpm test:e2e` (about 15 min;
  run single files while working, e.g. `pnpm test:e2e plan-builder.spec.mjs`).
- Full gate: `pnpm verify`. During the hackathon the GitHub check is manual
  only, so every task runs its checks locally before its pull request.
- Database: `rotavise` on 127.0.0.1:54329 (Docker). Migrations only
  (`pnpm --filter @rotavise/database exec drizzle-kit generate`, review the SQL,
  `pnpm db:migrate`). Never push schema, never drop data.

## Sources of truth

- Contracts in `packages/contracts/src` and `docs/api/openapi.json` are the
  truth for every API shape. Where a plan or task file disagrees, the contract
  wins; write the difference in the task notes.
- Frontend design and screens: `docs/steps/15/FRONTEND_MASTER_PLAN.md`
  (screen numbers S01–S20, Parts 0–10), `docs/steps/15/frontend-plan.md`
  (sections 0b–0f), `docs/steps/15/onesoil-measured-tokens.md` and
  `docs/steps/15/onesoil-inspection.md`. OneSoil is a visual reference only:
  never use its font, logo, name or assets.
- Decisions: `docs/DECISIONS.md`. Layout: `docs/architecture/structure.md`.
  Data providers: `docs/specification/API_EVIDENCE.md`.

## Engineering rules

- `packages/domain` stays pure (no Node built-ins, framework, DB, clock or
  randomness). Shared Zod contracts live in `packages/contracts`.
- Frontend: network access and state stay inside their feature folder in
  `apps/web/src/features`; the app shell only composes features. Interface
  languages are French (default) and English; crop names show in en, fr, ar
  and Darija (ary). Every text goes through `apps/web/src/i18n` (fr and en).
- No mocks, placeholders or sample data in production code. Every control
  calls the real API; when a feature is off or has no data, show that honestly.
- Never invent crop thresholds, names, citations, dates, weather or test
  results. Crop rules are labelled "not expert reviewed"; keep that label.
- Synthetic fixtures live only in `tests/support/fixtures`.
- Plan, field and history SQL is owner-scoped; accepted inputs and results are
  hash-checked and trigger-protected. Keep both.
- Design rules: one primary action per screen, at most seven items in a list,
  three text sizes plus a headline, one action colour (green), spacing instead
  of borders, words before numbers; no gradients, glass cards, emoji or stock
  icons. Check widths 390, 768, 1024 and 1440 px.
- Accessibility: keyboard reachable, visible focus, labels, axe clean.
- New dependencies: open-source, compatible licence, added to
  `THIRD_PARTY_NOTICES.md`. No analytics, no third-party scripts, fonts are
  self-hosted. Map tiles come only from the providers in
  `apps/web/src/features/map/basemap.ts`.
- Secrets live only in `.env` (git-ignored). Never print, commit or paste
  them; never put a secret in a `VITE_*` variable.
- Run checks with their real exit codes; fix causes, never skip or weaken a
  test to make it pass.

## Git

- Work on a branch `task/<ID>` (for example `task/F06`). Only board updates go
  straight to `main` (see `docs/tasks/WORKFLOW.md`).
- Commit message: one line, `<name><mon d> : <lowercase sentence>`, using the
  committer's own short name and the real date, for example
  `hdrahm<nov 14> : the map is sharp at field zoom`. No body, no trailers, no
  period, no mention of AI tools. Never change dates.
- Never force-push, never rewrite `main`, never commit `.env`, `.claude/`,
  `.artifacts/`, `.research-sources/` or database dumps.
