# Rotavise

Rotavise is an open-source decision-support tool for farmers in Morocco. It
helps a farmer **explore multi-year crop rotations** by combining NASA Earth
observations, local soil information, crop characteristics and the farmer's own
priorities. It supports the farmer's judgment and does not replace local
agricultural expertise.

It is a non-commercial project, licensed under the [Apache License 2.0](LICENSE).
It was built for the NASA Space Apps 2026 challenge
[Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).
The project started on 26 September 2026, before the event; the history is in
this repository's commit log and is described openly in
[the audit](docs/specification/FIELD_SHIFT_AUDIT_AND_PLAN.md).

## The problem

Temperatures are shifting, rain is less predictable, water is scarce and soils
are losing health. A crop that helps the soil in one place can use too much
water, bring disease or miss the growing season somewhere else. Choosing which
crops to rotate over several years is hard.

## What it does

- Takes a field location (and, for satellite history, an outline), what was
  grown before, and what the farmer cares about.
- Searches rotations of 3 to 5 years from a catalog of 207 crops and 557
  varieties, and compares them with explained reasons, benefits, risks and gaps.
- Checks each rotation against past weather and against **future climate in
  five climate models, two emission pathways, for 2041–2065**, and reports
  ranges, not single numbers.
- Estimates water balance, soil carbon and yield with published models. These
  are **not calibrated** for Moroccan crops, so they are used only to compare.
- Offers an optional photo check that suggests which known crop problems a leaf
  photo resembles. It can answer "not sure" and never gives a diagnosis or a
  treatment.

Results always state their evidence, uncertainty and where a local expert or
the farmer must decide.

## How NASA data are used

| NASA data                                        | How it enters the tool                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| POWER (MERRA-2 based daily weather)              | Past daily temperature and rain at the centre of the grid cell that holds the field; input to the rotation engine             |
| GPM IMERG daily rain                             | Satellite rain used to correct the POWER rain series                                                                          |
| SMAP L4 soil moisture                            | Soil and root-zone moisture context for a saved field (shown, not yet used to rank)                                           |
| HLS (Landsat and Sentinel-2) surface reflectance | Greenness (NDVI) history and green or bare periods for a drawn field outline (shown, not yet used to rank)                    |
| NEX-GDDP-CMIP6                                   | Future daily temperature and rain for five climate models under SSP2-4.5 and SSP5-8.5; each rotation's change in climate risk |

Not used so far: ECOSTRESS, GRACE and GRACE-FO, GEDI, MODIS and an elevation
product. Non-NASA data are SoilGrids (soil estimates), geoBoundaries (regions),
GBIF (names), FAO methods and Moroccan agricultural guides. Every source,
licence and how it is used is in [docs/REFERENCES.md](docs/REFERENCES.md);
software licences are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Current state

Verified on 2026-11-07 (GitHub Actions, `pnpm verify`): the backend, the rotation
engine, the catalog import and the production container checks pass.

- The **interface is the old one**: English only, no map, free-text crop names.
  It cannot yet show the multi-year results; the redesign is planned.
- Google sign-in works locally with a configured Google client. Email sign-up
  is tested against a local test inbox; no real email delivery is set up.
- The photo check is built and tested against a fake server; **it has never
  been run against the real Claude API**, and its accuracy on real photos is
  unmeasured.
- The future-climate data cover the Morocco tiles downloaded so far; a
  full download is still running.
- Not built: a map interface, staging, monitoring beyond the local scripts.

## Limits and honesty

- About **80 % of the rules in catalog 0.10.0 come from AI model recall**, not
  from a checked source. Each rule carries its provenance (`model_recall` or a
  source citation) and a confidence. None of the rules is expert-reviewed. A
  sourced fact is preferred when it disagrees with a recalled one.
- Water curves, soil limits and region checks exist only for 33 of the 207
  crops. 194 crops are applicable to Morocco in general, not to a specific
  region.
- The rotation search is a bounded beam search. It reports how many options it
  pruned and never claims to have listed every rotation.
- Satellite and reanalysis values describe a grid area, not a sensor on the
  field. Soil values from SoilGrids are estimates.
- Climate scores compare each crop with its own sourced limits; they are not
  yield forecasts.

## How AI was used (Space Apps disclosure)

The code, tests, catalog build and documents were written with AI coding agents
(Claude by Anthropic and Codex by OpenAI) under the owner's direction. Catalog
facts were gathered by web research and checked against saved sources where
possible; the facts that could not be sourced were filled from model recall and
are labelled as such. The optional photo check and plain-language explanations
use the Claude API at run time. The decision log is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Run locally

Requires Node **24.19.0**, pnpm **12.6.0**, and Docker with Compose v2.

```sh
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm catalog:import
pnpm accounts:setup
pnpm mail:up
pnpm dev
```

Open [127.0.0.1:5173](http://127.0.0.1:5173). The API listens on loopback port
3000, the worker health check on 3001 and the development PostgreSQL on 54329.
If 3000 or 3001 is taken, set `API_PORT` or `WORKER_PORT` in `.env`.
`env:setup` keeps an existing `.env`. Keep database credentials and internal
tokens out of `VITE_*` variables. Ctrl-C stops the app; `pnpm db:down` stops
PostgreSQL and keeps its data. The local test inbox is at
[127.0.0.1:8025](http://127.0.0.1:8025) (SMTP 1025).

Account links work only when the web app and the API share one browser origin,
so set `AUTH_BASE_URL=http://127.0.0.1:5173` and
`AUTH_TRUSTED_ORIGINS=http://127.0.0.1:5173` (`accounts:setup` does this).
Optional Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in
`.env` and an OAuth web client whose redirect address is
`http://127.0.0.1:5173/api/auth/callback/google`; without them the Google route
stays off. Optional photo check: set `ANTHROPIC_API_KEY` in `.env`, then run
`pnpm crop-health:selfcheck`.

Running on one computer for real use is described in
[docs/operations/RUNBOOK.md](docs/operations/RUNBOOK.md) (`pnpm ops:*`).

## Verify

Tests create and remove their own disposable PostgreSQL databases and test
inboxes, and browser checks pick free ports.

```sh
pnpm exec playwright install chromium
pnpm verify
pnpm peers check
pnpm audit --prod
```

`verify` runs lint, formatting, strict types, unit, database, recovery and
browser checks, builds, production containers and a clean frozen installation.
Individual commands are in [package.json](package.json).

## Demos

| Command                 | What it shows                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm weather:demo`     | NASA POWER measurements, a stored snapshot and a repeat cache hit (needs the development DB)    |
| `pnpm catalog:demo`     | Immutable catalog import with the research gaps visible (needs the development DB)              |
| `pnpm engine:demo`      | Real catalog constraints and missing evidence (no database)                                     |
| `pnpm plans:tadla-demo` | Plans a Tadla field with live NASA POWER and the prepared climate tile in a disposable database |
| `pnpm backend:demo`     | Disposable API, worker, PostgreSQL and mail: account, field, plan and result                    |

## Interfaces

- Health: `/api/v1/health/live` and `/api/v1/health/ready`; worker `/health/live` and `/health/ready` on port 3001.
- Plans: `PLANS_ENABLED=true` and `PLANNING_ENABLED=true`. POST `/api/v1/plans` with
  `schema_version: "2"` runs the multi-year engine on catalog
  `ROTATION_CATALOG_VERSION` (default 0.10.0); `"1"` keeps the old two-cycle format.
  `pnpm catalog:import` imports every release in `data/catalog/releases`.
- Accounts: `AUTH_ENABLED=true`. Verified email and password, recovery, Google,
  guest access that can be claimed later. Fields, crop history and plan history
  are private to their owner.
- Weather: `/api/v1/weather/query` serves bounded historical queries through the server.
- Future climate: `CLIMATE_SCENARIOS_ENABLED=true`; `pnpm climate:prepare <lat> <lon>`
  prepares one 1° tile; `infra/science/download.compose.yaml` downloads all of Morocco.
- Field satellite context: `OBSERVATIONS_ENABLED=true` and an Earthdata account;
  `PUT /api/v1/fields/:id/boundary` and `POST /api/v1/fields/:id/observations`
  (`hls`, `smap`, `gpm`). AppEEARS requests can take hours.
- Crop health: `GET /api/v1/crop-health/status` and the photo check routes.
- Catalog: `/api/v1/catalog/options` lists the immutable release, its sources and review status.
- Behind a proxy set `TRUST_PROXY`; the production API refuses to start without it.

## Structure and documents

`apps/`: API and worker, web interface, science service. `packages/`: contracts,
catalog, rotation engine, database. `data/`: versioned crop catalog releases.
`tests/`, `tooling/` and `infra/`: checks, developer commands and containers.
`docs/`: specifications, decisions and evidence.
[Detailed structure](docs/architecture/structure.md).

- [Current progress](docs/PROGRESS.md)
- [Decisions and exact versions](docs/DECISIONS.md)
- [Product specification](docs/specification/ROTAVISE_HANDOFF.md)
- [References and licences](docs/REFERENCES.md)
- [Field Shift audit and plan](docs/specification/FIELD_SHIFT_AUDIT_AND_PLAN.md)

Generate reviewed migrations with
`pnpm --filter @rotavise/database exec drizzle-kit generate` and apply them
with `pnpm db:migrate`; never push the schema directly. "Ready for review"
in the progress files describes tested components, not launch readiness.

## Licence

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party
software and data keep their own licences
([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [docs/REFERENCES.md](docs/REFERENCES.md)).
