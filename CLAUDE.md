# CLAUDE.md

@AGENTS.md

`AGENTS.md` (imported above) is binding. Extra notes for Claude Code:

- When the user says "do task <ID>", read `docs/tasks/WORKFLOW.md`, the
  task's file `docs/tasks/<ID>.md` and `docs/tasks/BOARD.md`, then follow the
  workflow without asking for routine confirmation. Ask only when the task
  file is unclear or a decision belongs to the user.
- If the project is not set up on this machine yet (no `node_modules`, no
  `.env`, or the database is missing), follow `docs/SETUP.md` first.
- Keep `pnpm dev` running in a background shell while building screens, and
  check your work in a browser at the four widths. When a frontend task is
  ready, give the user the exact local links to open (for example
  http://127.0.0.1:5173/plans/<id>) and the steps to reach each new screen.
- Never stop processes you did not start. Never print `.env` values.
