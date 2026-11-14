# Step 06 revision — selectable weather

Authorized by the user's request to add the discussed variables and shorten the
documents. Scope: existing weather backend, contracts, tests/demo and documentation.
Step 07 and farmer UI are not started. Status: **READY_FOR_REVIEW**.

## Supported measurements

| App variable     | NASA parameter    | Returned app unit | Earliest supported date |
| ---------------- | ----------------- | ----------------- | ----------------------- |
| temperatureMin   | T2M_MIN           | degC              | 1981-01-01              |
| temperatureMax   | T2M_MAX           | degC              | 1981-01-01              |
| temperatureMean  | T2M               | degC              | 1981-01-01              |
| precipitation    | PRECTOTCORR       | mm per UTC day    | 1981-01-01              |
| relativeHumidity | RH2M              | %                 | 1981-01-01              |
| windSpeed        | WS2M              | m/s               | 1981-01-01              |
| solarRadiation   | ALLSKY_SFC_SW_DWN | MJ/m2/day         | 2001-01-01              |

Request any unique subset; inclusive UTC dates, at most 366 days, ending at least
120 days before today. This is application policy, not guaranteed data coverage.
Solar's 2001 bound avoids introducing the earlier SRB source into this adapter.

[Official daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
supports selectable parameters, explicit UTC and up to 20 point parameters.
[Source methodology](https://power.larc.nasa.gov/docs/methodology/data/sources/)
distinguishes MERRA-2 meteorology (0.5° × 0.625°) and CERES SYN1deg solar (1° × 1°).
These are grid estimates. Solar source changes must not be used as climate trends.
[Temporal processing](https://power.larc.nasa.gov/docs/methodology/data/processing/)
describes daily aggregation. NASA AG returns solar in MJ/m^2/day; the app only
normalizes that unit label. It does not convert the measurement to instantaneous W/m².

[NASA-managed registry](https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/nasa-power.yaml)
was rechecked on 2026-09-27: unrestricted POWER use/access/download with CC BY 4.0
credit. [Referencing guidance](https://power.larc.nasa.gov/docs/referencing/) requires
service/version/access date. Those identities are retained; no paid service added.

## Implementation

Shared metadata drives contracts, provider parameters and capabilities. V2 checks
source sets, units, physical values, date availability and per-variable coverage.
Humidity must be 0–100%; wind/rain/solar cannot be negative. Missing/-999 stays null.
Solar-only requests require SYN1DEG. Unknown sources fail. Recent revisions can
still occur beyond the 120-day policy; unreviewed source responses fail explicitly.

Adapter version 2 separates new cache identity from immutable V1 snapshots; V1
contracts remain readable. No database migration or dependency change. Existing
cache/retry/concurrency/lease/access controls stay in place. Crop calculations
retain their four-variable vocabulary and explicitly reject the display-only
measurements until supported methods exist. No new scoring weights or advice.

README, progress, decisions and goals now summarize current state and link to
existing reports; handoff/provider notes reflect seven variables. Evidence and
historical acceptance reports are preserved.

## Live evidence and verification

Four sequential NASA requests on 2026-09-27 all returned HTTP 200: seven variables
for Beni Mellal 2024-02-27–03-02, humidity/wind at 1981-01-01–02, solar at
2001-01-01–02 and solar alone at 2024-02-27–03-02. Responses were 556–1569 bytes,
278–1129 ms; API v2.10.0. Exact URLs/times/hashes and unmodified bodies:
[manifest](../../evidence/weather/2026-09-27/manifest.json). These small connectivity
samples do not establish accuracy, public capacity or uptime.

| Check                                                         | Status           |
| ------------------------------------------------------------- | ---------------- |
| Four actual probes, metadata and preserved hashes             | PASSED           |
| Seven-variable and subset/unit/date/missing/source checks     | PASSED           |
| Real PostgreSQL persistence/cache/legacy/protected HTTP       | PASSED           |
| Existing engine behavior and explicit scoring boundary        | PASSED           |
| Full verification, production container, clean install/build  | PASSED           |
| Reviewed local agricultural evidence and regional calibration | BLOCKED          |
| Farmer weather UI                                             | FUTURE — Step 08 |

The first affected run had 6 failures out of 153 tests: one old four-variable
fixture accidentally requested all seven, and five assertions expected errors
from later engine checks now rejected earlier by stronger V2 schemas. The fixture
and expected rejection labels were corrected; all rejection tests remain.

No ordinary automated check calls the public NASA service. Controlled corruption
fixtures are labeled and cannot become agricultural output.

Actual final commands/results, all exit 0:

| Command                                                                         | Result                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm build:server`                                                             | Compiled shared/backend packages                                                                              |
| `pnpm test:weather`                                                             | 89 passed; real PostgreSQL and API/cache/recovery checks                                                      |
| `pnpm test:climate`                                                             | 82 passed; V1/V2 metrics agree, new variables cannot enter scoring                                            |
| `pnpm verify`                                                                   | 401 passed (399 Jest + 2 Chromium); strict checks, production container and clean frozen install/build passed |
| `node tooling/weather/demo.mjs` with disposable migrated PostgreSQL environment | Real seven-variable cache miss → hit, same UUID, five complete days, one stored snapshot; test DB removed     |
| `pnpm peers check` / `pnpm audit --prod`                                        | No peer issues / no known runtime advisories at this check                                                    |

Logs: `.artifacts/weather-expansion-{tests,climate,verify}.log`; live demo:
`.artifacts/weather-expansion-live-demo.json`. No dependency, lockfile, frontend
source, real catalog or migration files changed. Main README/progress/decisions/goals
were reduced from 1,310 to 326 lines, with historical evidence retained.
Remote CI, public-load performance and agronomic accuracy were not verified.

## Demo and internal request

```sh
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm weather:demo
pnpm test:weather
pnpm test:climate
pnpm verify
```

The demo performs a real request on cache miss, persists seven measurements and
asserts the repeat returns the same snapshot ID with a cache hit. No API/worker
process is required; PostgreSQL must be running.

For protected HTTP, enable WEATHER_ENABLED and an independent random
WEATHER_INTERNAL_TOKEN in server configuration, start the API, then POST JSON
with `x-weather-token` to `/api/v1/internal/weather/query`:

```json
{
  "latitude": 32.3373,
  "longitude": -6.3498,
  "startDate": "2024-02-27",
  "endDate": "2024-03-02",
  "variables": [
    "temperatureMin",
    "temperatureMax",
    "temperatureMean",
    "precipitation",
    "relativeHumidity",
    "windSpeed",
    "solarRadiation"
  ]
}
```

GET `/api/v1/internal/weather/capabilities` advertises units, availability and
source grid per measurement. The internal token must never be exposed in frontend
configuration. Accounts/full planning remain Step 07; charts remain Step 08.
