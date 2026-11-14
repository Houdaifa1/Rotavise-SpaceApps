# Rotavise runbook: running the app on your Mac

Written for the owner, who is not a system administrator. Every command is
typed in the Terminal, inside the project folder (`~/projects/Rotavise`). If a
step fails, copy the error text and send it to Claude; do not retry random
things.

What runs: seven pieces in Docker (a database, the API, a background worker,
the science service, a web server, and two jobs that prepare the database and
the crop catalog on every start). The app is reachable **only on this Mac**, at
`http://127.0.0.1:8088`. Nothing is public yet.

## Database: one source of truth

The application database is **`rotavise`**. Every API and worker must select
that database. The existing container and volume names retain `rotavise-dev`
so the physical backup volume stays attached. The databases `rotavise_dev`
and `rotavise_live` are read-only source backups for the one-time copy.

Run these commands from the reviewed checkout. In a worktree without its own
configuration file, select the existing project configuration file through the
loader. The commands consume its database setting without displaying it.

```bash
export ROTAVISE_CONFIG_ENV_FILE=/Users/houdaifadrahm/projects/rotavise_project/.env
pnpm db:check-complete
pnpm db:consolidate --verify-only
ROTAVISE_LOCAL_DATABASE=rotavise pnpm ops:status
```

`db:check-complete` checks `rotavise` on the configured PostgreSQL server. The
compiled production command `node dist/entrypoints/db-check-complete.main.js`
checks the database configured for that container. Readiness checks the actual
API database. Both `/health/ready` and `/api/v1/health/ready` return 503 when any
required dataset or dependency fails. `dataCompleteness` lists each dataset and
the missing requirements. Capabilities includes the same object. Results are
cached for at most 60 seconds. A production startup logs `DATABASE_INCOMPLETE`
when the gate fails.

To reproduce the one-time consolidation on a server where `rotavise` has yet
to be created, preserve the original NASA files and extract national coverage.
The GRACE and GEDI Python environments below are the environments already used
for the local imports. Substitute their paths when restoring on another Mac.

```bash
mkdir -p .artifacts/b6
TASK_SOURCE=/Users/houdaifadrahm/projects/rotavise_project/.artifacts
"$TASK_SOURCE/grace-venv/bin/python" tooling/earth-observations/grace-extract.py \
  --input "$TASK_SOURCE/live/grace/GRCTellus.JPL.200204_202608.GLO.RL06.3M.MSCNv04CRI.nc" \
  --bbox 20 37 -18 0 --product grace --output .artifacts/b6/grace-morocco.json
TASK_GEDI="$TASK_SOURCE/live/gedi/out/GEDI_L4B_Gridded_Biomass_V2_1_2299/data"
"$TASK_SOURCE/gedi-venv/bin/python" tooling/earth-observations/gedi-extract.py \
  --agbd "$TASK_GEDI/GEDI04_B_MW019MW223_02_002_02_R01000M_MU.tif" \
  --se "$TASK_GEDI/GEDI04_B_MW019MW223_02_002_02_R01000M_SE.tif" \
  --bbox 20 28 -18 0 --output .artifacts/b6/gedi-south.json
"$TASK_SOURCE/gedi-venv/bin/python" tooling/earth-observations/gedi-extract.py \
  --agbd "$TASK_GEDI/GEDI04_B_MW019MW223_02_002_02_R01000M_MU.tif" \
  --se "$TASK_GEDI/GEDI04_B_MW019MW223_02_002_02_R01000M_SE.tif" \
  --bbox 28 37 -18 0 --output .artifacts/b6/gedi-north.json
pnpm db:consolidate \
  --grace-file=.artifacts/b6/grace-morocco.json \
  --gedi-file=.artifacts/b6/gedi-south.json \
  --gedi-file=.artifacts/b6/gedi-north.json
pnpm db:check-complete
```

The consolidator refuses an existing target. `--replace-new` explicitly removes
and recreates only `rotavise`. After users begin saving data, restore from a
verified backup when recovery is needed. Source databases have read-only
connections during copy and verification. The command checks that the configured
server and `ROTAVISE_DB_CONTAINER` identify the same PostgreSQL cluster.
`ROTAVISE_DB_CONTAINER` defaults to `rotavise-dev-postgres-1`.

The demo uses a fresh seven-day guest owner. Its private credential is stored
in `.artifacts/b6/demo-session.json` with mode 600. Use its `accessToken` as the
Bearer credential and its `fieldId` to inspect the copied pilot. Its soil,
water and history reflect the original records. New field evidence is requested
through the ordinary field APIs. After expiry the ordinary guest retention
policy applies. Completeness is independent of the demo.

To switch the app, open `.env` in your editor and change only the final database
name in **`DATABASE_URL`** to `/rotavise`, preserving the scheme, credentials,
host, port and any query settings. Restart the API and worker with your normal
backend start command, then check `/health/ready` and `/api/v1/capabilities`.
The local example is in `infra/production/env.template`. To reverse the switch,
stop those application processes and restore the previous `DATABASE_URL` line
in your editor. Keep both source databases read only during inspection and use
a restored backup of `rotavise` for further application writes.

The download Compose configuration selects `rotavise` by default, following the
B6 single-database requirement. Set `ROTAVISE_DOWNLOAD_DATABASE_URL` to the
intended `rotavise` URL for a different server. Restart only after the app's
switch and a passed completeness check.

```bash
pnpm climate:status
# Optional read-only source inspection for the dated download evidence
ROTAVISE_CLIMATE_DATABASE=rotavise_dev pnpm climate:status
# Apply the configured consolidated destination when download work is needed
# docker compose -f infra/science/download.compose.yaml up -d --build
```

Back up the consolidated local database with the existing snapshot-consistent
backup implementation. It writes a dump, SHA-256 sidecar and row-count manifest
into `.artifacts/backups`, with a 14-day retention policy plus the newest backup.
The local national backup uses PostgreSQL zstd level 3 compression, which the
pinned PostgreSQL image supports. Restore tools detect its compression automatically.
Select durable storage with `ROTAVISE_BACKUP_DIR` before relying on scheduled
backups. The verified national backup is about 3 GiB: budget roughly 42 GiB for
14 nightly snapshots, plus the live database, a disposable restore, images and
working space. Check actual disk use as the database grows.

```bash
ROTAVISE_LOCAL_DATABASE=rotavise pnpm ops:backup
ROTAVISE_LOCAL_DATABASE=rotavise pnpm ops:restore-drill
```

The restore drill creates a disposable PostgreSQL container, restores the dump,
checks every table count, migration replay, catalog/result hashes and protection
triggers, then runs national completeness for a full reference backup. It removes
its disposable container when finished.

For a deliberate local recovery, first stop your API, worker and download
processes. Choose the exact verified backup file. These commands replace only
the consolidated database in the existing container.

```bash
# Replace BACKUP.dump with the exact verified dump filename
docker exec rotavise-dev-postgres-1 dropdb -U rotavise rotavise
docker exec rotavise-dev-postgres-1 createdb -U rotavise rotavise
docker exec -i rotavise-dev-postgres-1 pg_restore -U rotavise -d rotavise \
  --no-owner --exit-on-error < .artifacts/backups/BACKUP.dump
pnpm db:check-complete
```

Schedule the local database backup at 02:30 using the existing launchd tooling.
Use a dedicated prefix so its status is visible independently from the full
production stack. The `ROTAVISE_LAUNCHD_DIR` override supports a writable local
plist directory. Omit it to use the normal `~/Library/LaunchAgents` directory.
For reboot persistence, install from your long-lived checkout and keep the plist
in `~/Library/LaunchAgents`.

```bash
export ROTAVISE_LOCAL_DATABASE=rotavise
export ROTAVISE_BACKUP_DIR="$PWD/.artifacts/backups"
export ROTAVISE_DATA_DIR="$PWD/.artifacts/b6/operations"
export ROTAVISE_LAUNCHD_PREFIX=local.rotavise-database
pnpm ops:schedule install
pnpm ops:schedule status
# Remove this dedicated job when moving it to another checkout
# pnpm ops:schedule uninstall
```

The local database schedule selects the backup job. The existing production
schedule also selects the health monitor. macOS must permit `launchctl bootstrap`
and the Mac must be awake and logged in for the scheduled job to run.

The application pool has eight connections per API or worker process, a 2-second
connection timeout, a 3-second statement timeout, a 4-second query timeout and a
10-second idle timeout. pg-boss owns a separate pool of up to ten connections
per process, with a 2-second connection timeout and 3-second statement timeout.
Migration statements use a 30-second queue timeout. Budget these pools across
all replicas against PostgreSQL's configured 100-connection ceiling, retaining
space for maintenance and backup sessions. National reference completeness
scans have a transaction-local 30-second statement limit and a 35-second client
limit. Ordinary endpoint queries retain their shorter limits.

Migration 0028 adds owner/list and tile/year indexes plus the latest-GEDI lookup
index. Existing catalog unique lookups, extraction/observation field lookups,
saved-boundary primary key and suggested-boundary GiST index remain required.
Migration 0029 enables earlier analyze/vacuum thresholds on reference tables and
plan requests. Migration 0030 stores the result's strategy projection as a
generated column for owner list reads. Completed plan responses reuse verified
serialized bytes after the existing access and revision checks. PostgreSQL autovacuum remains enabled. After bulk imports the
consolidator runs `ANALYZE`. The completeness gate verifies required indexes,
validated constraints, enabled triggers and the declared autovacuum settings.

## 0. Before the first install (once)

1. Docker Desktop is installed and running (whale icon in the menu bar, "Engine
   running").
2. Docker Desktop → Settings → General: turn on **Start Docker Desktop when you
   sign in to your computer**. Without this the app does not come back after a
   reboot.
3. System Settings → Energy (or Battery) → turn on **Prevent automatic sleeping
   on power adapter when the display is off**, and keep the Mac plugged in. A
   sleeping Mac does not serve anything and does not run backups on time.
4. After a reboot, log in. Docker Desktop and the scheduled jobs start only
   after you log in (if FileVault is on, the Mac waits for your password).
5. Keep at least 20 GB of free disk space. The monitor warns below 10 GB.

## 1. First install

```bash
git switch field-shift && git pull
pnpm install --frozen-lockfile
pnpm ops:init
pnpm ops:upgrade
```

- `pnpm ops:init` creates `.env.production` with fresh random secrets. It
  refuses to overwrite an existing file. Never commit this file and never paste
  its contents into a chat.
- `pnpm ops:upgrade` builds the images (the first build takes several minutes),
  starts everything and checks the app answers. It prints the address when done.
- Open `http://127.0.0.1:8088` in your browser.

Turn on the safety jobs (nightly backup at 02:30, health monitor every minute):

```bash
pnpm ops:schedule install
pnpm ops:schedule status
```

These add two small background jobs to your Mac (macOS `launchd`). Remove them
with `pnpm ops:schedule uninstall`.

## 2. Everyday commands

| What                          | Command                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| See whether everything is up  | `pnpm ops:status`                                                                      |
| Start after a stop            | `pnpm ops:up`                                                                          |
| Stop (keeps data and backups) | `pnpm ops:down`                                                                        |
| Read recent logs              | `pnpm ops:logs` or `pnpm ops:logs api` (also `worker`, `postgres`, `proxy`, `science`) |
| Back up now                   | `pnpm ops:backup`                                                                      |
| Prove the latest backup works | `pnpm ops:restore-drill`                                                               |
| Check the security setup      | `pnpm ops:security-check`                                                              |

Your data lives in two places that you should know about:

- the database, inside a Docker volume (`rotavise-prod_pgdata`);
- backups, in `~/Rotavise-data/backups` (outside Docker, kept 14 days, plus the
  newest one always). Copy this folder to an external drive or cloud storage
  from time to time: if the Mac dies, the backups on it die with it.

## 3. Upgrading to a new version

```bash
git pull
pnpm install --frozen-lockfile
pnpm ops:upgrade
```

`ops:upgrade` always does the same, in this order: **back up the database**,
build images tagged with the git commit, run the database migration and catalog
import, switch to the new version, and check the app answers. If the new
version does not become healthy within four minutes, it switches back to the
old version on its own and tells you.

It refuses to run with uncommitted changes (add `--allow-dirty` only on
Claude's instruction).

## 4. Rolling back

Images of the last few versions stay on the Mac. To go back:

```bash
pnpm ops:status                    # shows the running and the previous version
pnpm ops:rollback <previous-version>
```

Database migrations only move forward. So:

- **Usually** the old version works with the migrated database and
  `ops:rollback` is enough.
- **If the newer version changed the database structure**, `ops:rollback`
  stops and says `SCHEMA_NEWER`. Then the rollback must include a restore of
  the backup taken just before the upgrade. Data entered since that backup is
  lost:

```bash
ls ~/Rotavise-data/backups                     # pick the backup made by the upgrade
pnpm ops:rollback <previous-version> --restore=<backup-file-name.dump>
```

A safety backup of the current data is taken first, so even this can be undone.

## 5. Backups and restoring

- **Nightly** at 02:30 (when the schedule is installed). Each backup is three
  files: `rotavise-<date>.dump`, `.sha256` (its checksum) and `.manifest.json`
  (row counts at that moment).
- **Prove it works** (do this after installing, after upgrades, and monthly):

  ```bash
  pnpm ops:backup
  pnpm ops:restore-drill
  # Or test a specific retained backup:
  pnpm ops:restore-drill --file=<backup-file-name.dump>
  ```

  This restores the newest backup into a throwaway database and checks that the
  checksum matches, the restore completes, every table has the same number of
  rows as at backup time, migrations are current, saved plan input, catalog
  content and identity, planning-version and completed result hashes still
  recompute exactly and the protection against rewriting accepted plans is still
  in place. The report includes the number of catalogs, versions and results
  checked; zero means there were none to verify. It prints `"ok": true` when all pass. Your live data is not touched.

- **Restore for real** (the live database is replaced; a safety backup is taken
  first; review with the owner before running):

  ```bash
  pnpm ops:restore <backup-file-name.dump> --yes
  ```

## 6. Alerts

The monitor runs every minute and shows a macOS notification when something
fails, again every 6 hours while it stays broken, and once when it recovers. The
history is in `~/Rotavise-data/monitor/status.jsonl`.

| Alert              | Means                                                               | What to do                                                                                               |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `api_live`         | The web address does not answer (proxy or API down).                | `pnpm ops:status`; if something is not healthy, `pnpm ops:up`; then `pnpm ops:logs proxy` / `api`.       |
| `api_ready`        | The API is running but cannot reach its database or queue.          | `pnpm ops:logs postgres`; check disk space; `pnpm ops:up`.                                               |
| `containers`       | One of the five services is not healthy or not running.             | `pnpm ops:status` names it; `pnpm ops:up`; if it keeps failing, `pnpm ops:logs <service>`.               |
| `worker_heartbeat` | The background worker stopped checking in; plans will not progress. | `pnpm ops:logs worker`; `pnpm ops:up`.                                                                   |
| `queue_age`        | A job has waited over 5 minutes unprocessed.                        | Usually the worker is stuck or busy: check `worker_heartbeat`, then `pnpm ops:logs worker`.              |
| `disk_space`       | Less than 10 GB (or 10%) free on the Mac.                           | Free space. `docker system prune` removes unused images (never run it with `--volumes`).                 |
| `backup_age`       | The newest backup is older than 26 hours (or none exists).          | `pnpm ops:backup`; check the schedule with `pnpm ops:schedule status`; check the Mac was awake at 02:30. |

Additional checks are `operations` (the worker status endpoint can be read),
`failed_jobs` (any retained queue or application failure), `queue_depth`, and
`climate_tiles` (a preparation failed). Queue and application failure records
can refer to the same job. Counts describe retained records, not a lifetime
counter. Investigate with `pnpm ops:logs worker`; application failures remain
visible until the application's retention removes them. Do not delete records
just to clear an alert.

Run a check immediately (exit **0** for all checks passing, **1** for any failure
or command error):

```bash
pnpm ops:status
pnpm ops:monitor
```

`ops:status` prints aggregate queue depth/active/failed counts, the latest retained
successful ingest timestamp for each provider or data family (or `null`), tile
counts and unit progress by state, and free disk bytes. The host check measures
the filesystem holding `ROTAVISE_DATA_DIR`; the worker reports its container
filesystem separately. Neither measures unused capacity inside PostgreSQL's
volume specifically. Provider timestamps are retained observations, not a promise
of upstream availability: pruning all evidence can return them to `null`.

The worker's `GET /health/operations` endpoint accepts only a loopback socket;
it does not trust forwarding headers. It is absent from the public API and proxy.
Read it directly inside the worker, after installation:

```bash
ROTAVISE_TAG=<running-version> ROTAVISE_ENV_FILE="$PWD/.env.production" docker compose -p rotavise-prod -f infra/production/compose.yaml --env-file .env.production exec worker node -e "fetch('http://127.0.0.1:3001/health/operations').then(r=>r.text()).then(console.log)"
```

Replace `<running-version>` with the tag printed by `ops:status`.

Failures print a line starting `FAIL <check>:`. Notifications are throttled using
the existing six-hour repeat policy; failed email delivery is logged and retried
on the next run. The monitor still exits 1 while a check remains broken even
when a repeat notification is not due.

Email is **off** unless you set `OPS_ALERT_TO` in `.env.production`, alongside
valid `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS` (`implicit` or `starttls`), `MAIL_FROM`
and paired `SMTP_USER` / `SMTP_PASSWORD` if required. These reuse the existing
mail transport; no new service is required. An SMTP account/credential is needed
if you enable mail. Configure and test delivery with the owner separately; the
automated tests use a fake transport and send no email. Do not paste credentials
into chat. `ops:monitor` reads these host-side settings on each run.

Optional limits are owner choices, not provider reliability guarantees. Set only
the policies you need, as uncommented lines in the selected env file:

- `OPS_INGEST_MAX_AGE_HOURS`: an unquoted JSON object mapping an ingest ID from
  `ops:status` to your positive maximum age in hours. `{}` enables none. Missing
  or older retained ingests then fail `ingest_<id>`.
- `OPS_QUEUE_DEPTH_LIMIT`: your nonnegative maximum count of waiting jobs.
- `OPS_TILE_MAX_IDLE_MINUTES`: your positive maximum idle time for a requested
  or preparing tile. Omit this if long preparation is expected.

The inherited queue-age, disk-space, backup-age and notification defaults above
are local engineering policies recorded in the
[operations evidence](../evidence/operations/2026-11-10/sources.json). No new
provider timing threshold is supplied by this change.

If you do not understand an alert, send Claude the output of `pnpm ops:status`
and `pnpm ops:logs`.

## 7. Settings, secrets and rotating them

All settings are in `.env.production` (mode 600). After editing it, apply the
change with `pnpm ops:up --recreate`.

Lines that are off until you fill them (each is commented out with `#`):

- `ANTHROPIC_API_KEY` for the crop photo check and explanations. Paste it
  yourself into the file; never into a chat. Then `pnpm ops:up --recreate`.
- `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` and `OBSERVATIONS_ENABLED` for
  NASA field satellite history (needs accounts on).
- `AUTH_ENABLED` and the Google and email lines (`AUTH_BASE_URL`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_*`, `MAIL_FROM`). These need a
  public https address, a Google OAuth client and an email service first; do not
  turn them on before that.

Rotating generated secrets:

- **`WEATHER_INTERNAL_TOKEN`**: put a new random value in the file and
  `pnpm ops:up --recreate`. Nothing else is affected.
- **`AUTH_SECRET`** (only when accounts are on): change it and recreate; every
  signed-in user is signed out.
- **Database password**: (1) `pnpm ops:backup`; (2) create a new password with
  `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`; (3) run
  `docker exec -it rotavise-prod-postgres-1 psql -U rotavise -d rotavise` and type
  `ALTER USER rotavise PASSWORD 'the-new-password';` then `\q`; (4) put the same
  password in **both** `POSTGRES_PASSWORD` and `DATABASE_URL` in the file;
  (5) `pnpm ops:up --recreate`; (6) `pnpm ops:status` must show everything
  healthy.

## 8. What is and is not protected

Checked by `pnpm ops:security-check` (run it after every upgrade): strict
Content-Security-Policy and other headers, only one port open and only on
`127.0.0.1`, nothing running as root, read-only file systems, no extra
privileges, and the database and science service on a network with no internet
route.

Not covered yet: HTTPS and a public address (a later step done with you),
protection against someone with access to your Mac account, off-site backups,
and monitoring when the whole Mac is off.

## 9. When you add a public address later

Do not expose port 8088 directly. The public step needs: a domain or
subdomain, an HTTPS tunnel, and then the web server must be told to trust the
tunnel's client-address header (otherwise every visitor looks like one address
to the API's per-visitor limits). Claude will walk through it with you.

## 10. Backup safety and the restore drill

Retention keeps complete, checksummed backups for the configured window
(`BACKUP_RETENTION_DAYS`, a positive integer, default 14) and always retains the
newest verified file even when it is older. Incomplete or checksum-damaged files
are left for manual review. Copy a verified dump **with its `.sha256` and
`.manifest.json` sidecars** to another disk before repairing backup files.
A real restore always takes a safety backup first and pins its selected restore
source against retention during that backup. Never run Docker volume deletion
commands as part of this procedure.

Backups serialize using a `.backup-lock` directory in the backup folder. If a
process is interrupted, a later backup refuses with `BACKUP_BUSY`. Check that no
backup process is running before removing only that empty lock directory. Leave
dumps, sidecars and `.partial` files intact until reviewed.

For a drill: take a backup, run `ops:restore-drill`, require exit 0 and `ok: true`,
and retain the JSON report with the backup name/checksum. The restore uses a new
throwaway PostgreSQL container, compares every application/queue table count to
the same-snapshot manifest and recomputes the hashes listed in section 5. It
removes only its own drill container/network. A failed drill never replaces live
data. Investigate it before attempting a real restore. The check verifies logical
data and current migration compatibility; it is not a timed recovery guarantee.

## 11. Structured application error logs

API and worker stderr diagnostics are JSON with a UTC `at`, `level`, `event`
and allowlisted `code`. Every HTTP error response gets an `http_error` entry
and a server-generated UUID in `X-Request-Id`, also recorded as `requestId`.
Client-supplied IDs are ignored. Uncaught job-handler failures log
`CALCULATION_FAILED` before retaining the original queue retry behavior; handled
terminal failures are sampled from durable records each worker maintenance
cycle (and reported again after a worker restart). Logs may include an aggregate
count; they never serialize job payloads or exception messages.

The compatibility logger strips extra arguments from older diagnostics. It
allows existing codes, opaque server request IDs, status and counts; it omits
coordinates, URLs, query strings, bodies, IP addresses, emails, tokens, SQL,
provider error text and stacks. No new result/reason code or glossary term is
introduced. Existing structured success events keep their previous behavior.
The JSON policy covers application error logs; PostgreSQL, nginx and science
service logs have their own formats. Keep access to the Mac and Docker logs
private.

## 12. Staging on the same Mac

Staging runs the same images and production validation with its own secrets,
Compose project (`rotavise-staging`), volume/networks, loopback port (`8089`) and
host folder (`~/Rotavise-staging-data`). Production stays on its existing defaults.
Use synthetic/disposable data in staging; do not copy farmer data into it.

```bash
ROTAVISE_ENVIRONMENT=staging pnpm ops:init
ROTAVISE_ENVIRONMENT=staging pnpm ops:upgrade
ROTAVISE_ENVIRONMENT=staging pnpm ops:status
ROTAVISE_ENVIRONMENT=staging pnpm ops:backup
ROTAVISE_ENVIRONMENT=staging pnpm ops:restore-drill
ROTAVISE_ENVIRONMENT=staging pnpm ops:down
```

The staging selector loads `infra/staging/compose.yaml` after the production
base and uses `infra/staging/env.template` to generate git-ignored `.env.staging`.
It refuses known production project/data/env/port collisions. Keep any custom
settings separate too; custom production locations cannot be discovered from a
different environment. Never reuse a production SMTP recipient or credentials
just for a staging smoke check. Scheduling staging is optional and needs an
explicit separate `ROTAVISE_LAUNCHD_PREFIX` for install, status and uninstall;
leave the production schedule untouched. Local scheduler installation, SMTP
delivery, and running a full staging stack are owner follow-up checks; Compose
is validated automatically without starting those services.
