# Step 02 — historical weather backend

Authorized by the user's “Okay, go ahead” after discussion of this milestone.
This step implements weather infrastructure only. Step 03 remains unauthorized.

## Deliverable

A provider independent request for WGS84 coordinates, inclusive calendar date
range and supported daily variables. Start with mean/minimum/maximum 2 m air
temperature and total corrected precipitation. Publish capabilities, explicit
units, UTC day semantics, missingness and provenance. Additional variables need
a verified registry entry and tests, rather than a new request architecture.

Compare NASA POWER daily meteorology with a fixed Open-Meteo ERA5 dataset using
current primary documentation, commercial terms and a small measured sample.
Select one adapter; do not blend or silently switch datasets. Persist validated
snapshots and cache them in real PostgreSQL. Protect backend weather routes with
an internal server token, bounded input and concurrency. No frontend secrets.

## Acceptance

| ID  | Required evidence                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W01 | Current primary sources, exact datasets, terms, real requests with status/latency/hash and a documented provider decision                                                |
| W02 | Strict runtime contracts: real dates, bounded coordinates/range, unique supported variables, explicit units and UTC semantics                                            |
| W03 | Real NASA response validated; provenance retained; missing sentinel becomes null, never zero; incomplete coverage visible                                                |
| W04 | Bounded HTTP deadlines/bytes/concurrency and retries; 429, 5xx, timeouts, invalid JSON/units/source/date coverage tested with identified synthetic faults                |
| W05 | Reviewed PostgreSQL migration; immutable snapshots, exact canonical cache keys, expiry and safe refresh failure                                                          |
| W06 | Concurrent consumers deduplicate through PostgreSQL; expired ownership recovers; obsolete owners cannot publish; no transaction held across upstream HTTP                |
| W07 | Protected internal capabilities/query routes; missing/invalid token rejected; default disabled; production harness remains absent; no raw upstream errors or credentials |
| W08 | Deterministic unit and real PostgreSQL/API integration checks plus existing Step 01 regression gates pass                                                                |
| W09 | Live selected-provider demo and repeat cache hit observed, exact run instructions and honest limitations documented                                                      |
| W10 | Step report, decisions and progress updated to READY_FOR_REVIEW when required checks pass                                                                                |

No crop advice, NASA-derived agronomic claims, catalog, accounts, planner,
weather explorer UI, paid subscription purchase or external deployment.
Component verification does not establish whole-product production readiness.
