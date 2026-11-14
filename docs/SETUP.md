# Set up Rotavise on a new machine (macOS)

About 30–45 minutes, most of it downloads. Claude Code can run these steps
for you: say "set up the project with docs/SETUP.md".

## 1. Install the tools

- Docker Desktop (running), Git, GitHub CLI (`brew install gh`, then
  `gh auth login`).
- Node 24.19.0 (with nvm: `nvm install 24.19.0 && nvm use 24.19.0`).
- pnpm 12.6.0: `npm install --global pnpm@12.6.0`.

## 2. Get the code

```sh
git clone https://github.com/Houdaifa1/Rotavise-SpaceApps.git
cd Rotavise-SpaceApps
git config user.name "<your short name>"
git config user.email "<your GitHub email>"
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm env:team
```

`pnpm env:team` writes your own `.env` with fresh local tokens. It is
git-ignored; never commit or share it.

## 3. Get the database

The app needs the `rotavise` database (catalogs, climate, GRACE and GEDI data,
about 3 GB). It is not in git. Ask Houdaifa for the link to
`rotavise-2026-11-14.dump` and its `.sha256` file, download both into the
project folder, then:

```sh
shasum -a 256 -c rotavise-2026-11-14.dump.sha256
pnpm db:up
docker exec -i rotavise-dev-postgres-1 pg_restore -U rotavise -d rotavise --no-owner --exit-on-error < rotavise-2026-11-14.dump
rm rotavise-2026-11-14.dump rotavise-2026-11-14.dump.sha256
```

The restore takes several minutes. Run it only once, on an empty database.

## 4. Start the helper services

```sh
pnpm mail:up
docker compose -f infra/science/compose.yaml up -d --build
```

The science service build takes a few minutes the first time.

## 5. Run the app

```sh
pnpm dev
```

Open http://127.0.0.1:5173. Check the data is complete:

```sh
curl -s http://127.0.0.1:3000/api/v1/capabilities
```

`dataCompleteness.ok` must be `true`. The banner "limited services" is normal:
NASA observations need a personal Earthdata account and the photo check needs
an AI key; neither is needed for frontend tasks.

## 6. Start working

Read `AGENTS.md`, then `docs/tasks/BOARD.md`. Tell Claude Code
"do task F06" (or the task you were given).
