# Codex task 2: run Rotavise in production on one Mac (Step 16, local part)

Give this to Codex only after task 1 (crop facts research) is committed and
pushed. Handing it to Codex is the user's go-ahead for this part of Step 16:
local production operations only, with nothing exposed to the internet and no
account created. Start Codex in `~/projects/Rotavise` with:

```
git switch field-shift && git pull
git switch -c codex/local-operations
codex --search --sandbox workspace-write --ask-for-approval on-request
```

and type: "Read `docs/steps/16/codex-local-operations-prompt.md` and do
exactly the task below its first `---` line."

---

You are a senior site-reliability and backend engineer working in the
Rotavise repository (Node 24.19.0, pnpm 12.6.0, NestJS/Fastify API, pg-boss
worker, PostgreSQL 18, a Vite web build, a Python science service, Docker).
Your job is to make Rotavise run **in production on the owner's Mac** to a
standard you would sign off for real farmers. Another agent (Claude) works on
the crop catalog and the AI photo check at the same time and reviews your
branch before it is merged.

## Read first, and obey

1. `AGENTS.md` and `CLAUDE.md` (binding rules), then
   `docs/specification/ROTAVISE_HANDOFF.md` section 12 ("Production gates"),
   `docs/architecture/structure.md`, `docs/DECISIONS.md` and
   `docs/PROGRESS.md`.
2. Read the existing code you build on: `infra/docker/*.Dockerfile`,
   `infra/postgres/compose.yaml`, `infra/science/compose.yaml`,
   `apps/server/src/entrypoints/*`, `apps/server/src/config/environment.ts`,
   `apps/server/src/common/http/security-headers.ts`,
   `tooling/verification/container-check.mjs`, `package.json` and
   `.github/workflows/verify.yaml`. Verify how things work; do not assume.

## Hard rules

- **Work only on branch `codex/local-operations`.** Commit in small, clear
  steps. Never push to `field-shift` or `main`, never force-push, never
  rewrite history.
- **Nothing public.** Every port binds to `127.0.0.1`. Do not create accounts,
  tunnels, DNS records or cloud resources, and do not send email. Public
  access (subdomain, tunnel, HTTPS certificate) is a later step done with the
  owner.
- **Secrets:** never print, log or commit them. Generated secrets go to a
  git-ignored `.env.production` with mode 600. Never read or copy the owner's
  `.env` (it holds a NASA Earthdata password).
- **Do not change** the crop catalog (`data/catalog/`), the rotation engine
  (`packages/domain/src/rotation/`), the crop-health module
  (`apps/server/src/modules/crop-health/`) or existing migrations. If you
  need a change there, stop and write it down as a request in your report.
- **Do not edit** `docs/DECISIONS.md`, `docs/PROGRESS.md`, `CLAUDE.md` or
  `AGENTS.md`. Put proposed decision and progress text in your report; Claude
  merges it. Keep edits to shared files (`package.json`, `.gitignore`, the
  Jest config, the CI workflow) small and additive.
- **No shortcuts:** no skipped or weakened tests, no `--force`, no disabled
  checks, no `latest` image tags, no unpinned dependencies, no `TODO` left in
  delivered code. Never stop processes or containers you did not start.
- **Never invent** numbers, results or guarantees. State each check's date,
  command and outcome exactly as it ran.

## What to build

Put new files in `infra/production/`, `tooling/operations/`,
`tests/operations/` and `docs/operations/` unless an existing place fits
better.

1. **The production stack** (`infra/production/compose.yaml`): PostgreSQL 18
   with a named volume, a one-shot migration, a one-shot catalog import of
   the committed releases, the API, the worker, the science service, and a
   reverse proxy that serves the built web app and forwards `/api` to the API.
   Use the existing Dockerfiles, pinned image digests, non-root users,
   read-only file systems where possible, health checks, `restart:
unless-stopped`, resource limits and log rotation. It must start cleanly
   on an Apple-silicon Mac with Docker Desktop and survive a reboot.
2. **Configuration and secrets:** `pnpm ops:init` creates `.env.production`
   from a documented template with strong random secrets (mode 600), and
   refuses to overwrite an existing file. Production settings must pass the
   server's own validation (`NODE_ENV=production`, `TRUST_PROXY` set
   explicitly). Leave `ANTHROPIC_API_KEY`, Earthdata and SMTP/Resend empty
   with a comment saying the owner fills them in.
3. **Backups and a restore drill:** a nightly logical backup of PostgreSQL
   (custom format, checksum file, kept for 14 days, stored outside the Docker
   volume), scheduled with macOS `launchd`, and `pnpm ops:restore-drill` that
   restores the latest backup into a disposable database and proves it works:
   row counts match, migrations are current, and the stored plan hash checks
   (migration 0005 triggers) still pass. Write an automated test for the
   backup and restore path using a disposable database.
4. **Upgrade and rollback:** images tagged with the git commit; `pnpm
ops:upgrade` (backup first, then migrate, then switch) and `pnpm
ops:rollback <tag>` that returns to the previous images. Migrations are
   forward-only, so document exactly when a rollback also needs a restore.
5. **Monitoring and alerts:** a local monitor that checks the API's health and
   readiness, the worker's heartbeat, queue age, disk space and the last
   backup's age every minute, keeps a small status log, and raises a macOS
   notification when something fails or recovers. Document what each alert
   means and what to do.
6. **Security checks:** verify the security headers and CSP the reverse proxy
   and API send, that only `127.0.0.1` ports are open, that containers run as
   non-root, and record `pnpm audit --prod` with how each finding was handled.
7. **Load test at a stated concurrency:** measure the API on this Mac (for
   example 20 and 50 concurrent users submitting and reading plans with
   synthetic fixtures, never live NASA or Claude calls), and report latency
   percentiles, error rate and the point where it degrades. State the machine
   and date. Do not tune numbers to look good.
8. **Runbook** (`docs/operations/RUNBOOK.md`): plain steps to install, start,
   stop, upgrade, roll back, back up, restore, read logs, rotate secrets and
   respond to each alert, written for the owner, who is not a system
   administrator.

## Verify before you finish

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and your new tests pass.
- `pnpm verify` passes on this Mac (Docker must be running). If anything
  fails, fix the cause; never weaken a check.
- A full run from a clean clone: `pnpm ops:init`, start the stack, open the
  app at its local address, submit a plan with the synthetic fixture, then
  `pnpm ops:restore-drill`, an upgrade and a rollback. Record each command
  and its outcome.
- Push the branch (`git push -u origin codex/local-operations`) so GitHub
  Actions runs `pnpm verify` on it, and confirm it passed.

## Report

Write `docs/steps/16/codex-local-operations-report.md`: what you built, how
each part was verified (date, command, outcome), the load-test numbers, the
security findings, everything not done or not verified and why, proposed
text for `docs/DECISIONS.md` and `docs/PROGRESS.md`, and any changes you
need in files you were told not to touch. Then stop and tell the owner it is
ready for Claude's review.
