# Step 03 — versioned crop catalog and provenance

Authorized by the user's “go ahead” after the proposed setup fix and catalog
milestone. This is a catalog component, not a planning or recommendation engine.

## Deliverable

Fix ordinary pnpm selection and verified configuration. Build a framework-free
catalog package with strict Zod contracts, sourced research profiles for three
initial annual crops relevant to the Beni Mellal/Tadla pilot, explicit unknowns,
source identities and evidence hashes, applicability and human review status.
Store imported catalog versions as immutable PostgreSQL snapshots through a
bounded local importer. Keep source documents under their publishers' control;
retain retrieval metadata and factual extraction notes with page references.

Catalog research and agricultural validation are separate states. National,
other-region, old or underspecified evidence must not become a reviewed local
threshold. Import can preserve research profiles, but recommendation readiness
must return insufficient evidence until required applicable knowledge and
documented specialist review exist. Synthetic catalogs are test fixtures and
must be rejected by the production importer.

## Acceptance

| ID  | Required evidence                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | Ordinary shell pnpm resolves to 12.6.0; native pnpm configuration is effective; frozen install and version enforcement are verified                                           |
| C02 | Current primary-source research, exact source URLs, publication dates when known, retrieval timestamps/hashes and page/section locators                                       |
| C03 | Three real research profiles with identity/family, cultivar/method context, region applicability, planting/duration/soil/temperature/water/rotation fields; unknowns explicit |
| C04 | Strict bounded runtime validation; impossible calendar values/ranges, unknown fields, duplicate IDs, inconsistent units/metrics and dangling references rejected              |
| C05 | Rules retain metric, unit, stage, time basis, severity, applicability and sources; unsuitable source measurements cannot silently become daily air-temperature rules          |
| C06 | Review and evidence gaps visible; no hard geographical city cutoff; missing/other-region evidence and unreviewed profiles report insufficient evidence                        |
| C07 | Production import rejects synthetic bundles, profiles and sources; controlled fixtures remain in tests and do not enter runtime catalog data                                  |
| C08 | Canonical content hashes, immutable real PostgreSQL versions, idempotent repeat imports, version conflict rejection, reviewed migration and transaction behavior verified     |
| C09 | Bounded import/demo commands use actual catalog and database; persisted versions can be retrieved and validated                                                               |
| C10 | Meaningful catalog unit and real PostgreSQL integration tests plus all existing regression gates pass; clean/container builds include the catalog component                   |
| C11 | Exact commands, versions, results, source limitations and passed/failed/blocked matrix recorded in report, decisions and progress                                             |

No farmer input workflow, crop sequence generation, weather scoring, irrigation
adequacy calculation, ranking, planning endpoints, accounts, farmer UI, specialist
approval fabrication or external deployment. Steps 04 onward are unauthorized.
Human agricultural review is a later validation gate, recorded honestly here.
