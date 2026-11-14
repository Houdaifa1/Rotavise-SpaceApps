# How to do a task

Follow these steps in order for "do task <ID>". `<name>` is your short git
name (`git config user.name`).

## 1. Claim it (on `main`, fast, no GitHub check)

1. `git checkout main && git pull --ff-only`
2. In `docs/tasks/BOARD.md`, check the task's row: status must be `todo`,
   "Who" must be empty or your name, and every task in "Needs" must be `done`.
   Otherwise stop and tell the user.
3. Set the row to `in progress` and "Who" to your name. Commit only that file:
   `git commit -m "<name><mon d> : <id> is taken by <name>" docs/tasks/BOARD.md`
   and `git push`.

## 2. Build it (on a branch)

1. `git checkout -b task/<ID>`
2. Read the task file `docs/tasks/<ID>.md` completely, then everything it
   lists under "Read first".
3. Make sure the app runs (`pnpm dev`; see `docs/SETUP.md` if it does not).
4. Build the task. Change only the files the task file allows.
5. Commit in small steps as you go, one line each, in the format from
   `AGENTS.md`.

## 3. Check it

1. Run every command listed under "Checks" in the task file and read the real
   exit codes. Fix failures at their cause.
2. For screens: open each new screen at http://127.0.0.1:5173 at widths
   390, 768, 1024 and 1440, in French and English. Check keyboard use.
3. Write the task notes file named in the task file: what was built per
   screen, what is not done and why, checks with exit codes, any backend
   requests.

## 4. Show it

Give the user, in the chat:

- the local links to open and the clicks needed to reach each new screen;
- what works, what is not done, and the check results.

Wait for the user to try it. Fix what they report.

## 5. Hand it in

When the user says it is good:

1. `git fetch origin && git rebase origin/main`, rerun the checks if anything
   changed, then `git push -u origin task/<ID>`.
2. Open a pull request into `main`:
   `gh pr create --base main --title "<ID>: <task title>" --body "See docs/tasks/<ID>.md and the task notes."`
3. On `main`, set the board row to `review` with the pull request link, commit
   with `<name><mon d> : <id> is ready for review` and push (fast, no check).

Houdaifa reviews and merges the pull request, then sets the row to `done`.
