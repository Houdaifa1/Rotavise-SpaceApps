# B4 — crop benefits, opt-in catalog 0.15.0

User-authorized scoped task, 2026-11-10. Evidence records use **2026-11-11** as explicitly requested; retrieval and command timestamps retain their actual dates. This does not approve or advance a milestone. Work remains uncommitted and unpushed. No frontend files, prices, yields, margins or income calculations were added or changed by B4. Existing income evidence is preserved as part of the required strict superset.

## Outcome and scope

All **246 crops × 12 effects = 2,952 crop/effect combinations** have sourced evidence, explicit `model_recall`, or a reasoned not-applicable record. Crops with any sourced benefit increase **45 → 107**. The new release adds **3,136 records**: **184 sourced**, **2,729 recalled**, **223 not applicable**. All 102 preceding sourced findings and every historical gap remain intact. Coverage selection chooses sourced before recalled; retained record totals include multiple records for some combinations and must not be confused with coverage totals.

Research starts from Moroccan INRA cereal/food-legume guides and ICARDA/CGIAR Moroccan conservation-agriculture context, then FAO reference tables and Mediterranean hay guidance. **9 added catalog sources** support **192 new citation occurrences**, including the four role explanations. Eleven saved primary-source snapshots and all registered derivatives are SHA-256 checked. Two failed fetches (INRA web page 403, guessed ICARDA article path 404) are recorded in `benefits-capture-results.json`; neither contributes evidence. ICARDA's actual conservation-agriculture article was subsequently saved. No exhaustive individual literature search for every crop is claimed: unsupported combinations are filled from explicitly labelled model knowledge, as requested.

Scanned INRA PDF pages and covers were rendered and inspected in full with the PDF skill. The cereal-guide title was corrected from the rendered cover to include durum wheat, bread wheat and barley. Short manually transcribed quotations are labelled as such; original bytes, renders, uncorrected French OCR and transcription hashes remain in the source manifest. The pooled legume fixation figure on the scanned page is **not** assigned to individual crops or turned into residual N credit. FAO rooting-depth ranges are not measured infiltration gains. Moroccan system-level conservation-agriculture observations remain packages of cover, tillage and diversity, not isolated crop carbon measurements.

## Coverage before and after

These tables count one strongest available status per crop/effect. Earlier search gaps count as uncovered, not not applicable. All recalled records retain confidence, basis, `model_recall_unverified`, `researchItem` and `recordedOn: 2026-11-11`, with no quote or citation. Local sources sort first among sourced findings; all sourced and recalled evidence stays in the release.

| Effect                                | Before sourced | Before recalled | Before N/A | Before uncovered | After sourced | After recalled | After N/A |
| ------------------------------------- | -------------: | --------------: | ---------: | ---------------: | ------------: | -------------: | --------: |
| `biological_nitrogen_fixation`        |              6 |               0 |          0 |              240 |             6 |             26 |       214 |
| `residual_nitrogen_credit`            |              2 |               0 |          0 |              244 |             4 |            241 |         1 |
| `forage_residue_feed`                 |             40 |               0 |          0 |              206 |            40 |            201 |         5 |
| `disease_break`                       |              4 |               0 |          0 |              242 |             5 |            241 |         0 |
| `weed_break`                          |             10 |               0 |          0 |              236 |            12 |            234 |         0 |
| `pest_break`                          |              7 |               0 |          0 |              239 |             8 |            238 |         0 |
| `rooting_soil_structure_infiltration` |              3 |               0 |          0 |              243 |            80 |            165 |         1 |
| `erosion_cover_residue`               |              4 |               0 |          0 |              242 |             7 |            238 |         1 |
| `bare_soil_period_shortening`         |              2 |               0 |          0 |              244 |             2 |            243 |         1 |
| `organic_matter_soil_carbon`          |              0 |               0 |          0 |              246 |             3 |            243 |         0 |
| `drought_tolerance`                   |              0 |               0 |          0 |              246 |            29 |            217 |         0 |
| `water_demand`                        |              0 |               0 |          0 |              246 |            26 |            220 |         0 |

Group totals sum across all 12 effects; each crop belongs to one reporting group. The full group-by-effect breakdown is in [benefits-coverage.md](../../evidence/catalog/2026-11-11/benefits/benefits-coverage.md) and `benefits-summary.json` (`groups.*.effects`).

| Crop group                 | Crops | Before sourced | Before recalled | Before N/A | Before uncovered | After sourced | After recalled | After N/A |
| -------------------------- | ----: | -------------: | --------------: | ---------: | ---------------: | ------------: | -------------: | --------: |
| `orchard_perennial`        |    65 |              6 |               0 |          0 |              774 |            28 |            688 |        64 |
| `forage_cover`             |    27 |             26 |               0 |          0 |              298 |            36 |            275 |        13 |
| `aromatic_wild_other`      |    38 |              2 |               0 |          0 |              454 |             5 |            406 |        45 |
| `vegetables_other_annuals` |    65 |              3 |               0 |          0 |              777 |            36 |            679 |        65 |
| `cereals`                  |    14 |             16 |               0 |          0 |              152 |            46 |            108 |        14 |
| `oilseeds`                 |    10 |              6 |               0 |          0 |              114 |            19 |             92 |         9 |
| `roots_industrial`         |    12 |              0 |               0 |          0 |              144 |            14 |            117 |        13 |
| `grain_legumes`            |    15 |             19 |               0 |          0 |              161 |            38 |            142 |         0 |

## API and engine behavior

`GET /api/v1/glossary?lang=fr&group=role` serves `nitrogen_fixing`, `cover`, `deep_rooting`, and `drought_tolerant`. Each has English, French, Standard Arabic and Darija text plus exact quotations, source URLs, original hashes and quote-check identifiers. Arabic and Darija retain `model_translated_unreviewed`; French is also disclosed as machine translated and all text awaits human review. `glossary-6` invalidates older glossary caches. Seven new strategy-note codes, all 12 benefit-effect labels and the not-applicable status have all four languages. The glossary coverage test enumerates the effect and role codes explicitly.

Catalog 0.15.0 acceptance selects **`policy.research = benefits-2`** through the existing hashed and immutable versions mechanism. Default `ROTATION_CATALOG_VERSION` remains **0.13.0**. Earlier pins retain their behavior. New per-slot selections and nine benefit-note groups show each crop's sourced, recalled, not-applicable or no-data status, selected finding IDs and source IDs. Full evidence is shared once per crop in `catalogResearch`; slots retain the following crop. Existing research gaps remain historical evidence; active new-policy gaps are computed from current selections. Benefits are conditional context and do not change existing scores or income ordering.

`outputs.terrain.erosion.cropCover[].scenarios` reports the existing explicit sourced olive/vineyard C ranges with quotations and management/non-local conditions; it does not collapse a range into a single field C. There are still only **two C-bearing crops** and **zero rankable erosion estimates**. Generic historical USLE land-use rows, ordinal cover classes and qualitative recall do not become RUSLE C. R/K/P and verified slope length remain absent, so erosion stays unranked and the reason is returned. The new research did not establish an additional crop-specific RUSLE C factor.

The engine remains pure. Runtime contracts reject missing effect coverage, reversed ranges, mislabelled provenance and absent source citations. No Node, HTTP, database or clock access was added to `packages/domain`.

## Release and database

The builder only appends `research.benefits.version/records`, source entries and quote checks, apart from the release version. Every previous profile field, identity, name, rule, reference, source, income fact and gap is preserved. The release hash is `b1c18550fdb08feedba05a149fbe4e017380d2604d7260e30bc0ff55f0b5c44b`; canonical bytes **10,125,754**. The old 0.14.0 hash remains `8a59fc79f0320a3033278a308e26507b090a06fe370008be64f42045abb8a43a`.

The larger evidence release needs a **16 MiB canonical catalog / PostgreSQL JSON-text ceiling** and **24 MiB formatted release-read ceiling**; format 1 limits and the **8 MiB result ceiling** remain unchanged. Generated and reviewed migration **0027_catalog_benefit_capacity** changes only the format 2 catalog body constraint. The first database test exposed SQLSTATE 23514 (`catalog_body_limit`), confirmed by a disposable-database diagnostic. This was fixed in schema and migration, not by skipping import tests. Production/development databases were not changed. The required terrain integration project is included after this migration.

## What remains unquantified or not applicable

[benefits-not-applicable.json](../../evidence/catalog/2026-11-11/benefits/benefits-not-applicable.json) lists all 223 not-applicable records and crop-specific reasons. Most are biological fixation for non-fixers, including non-nodulating carob. Fungal truffles have no own crop-root/cover/calendar/residue-credit trait. Five crops are unsuitable as routine forage/straw. Not applicable is never used for an unsuccessful literature search.

Many effects remain qualitative. No new locally measured crop-specific N-credit range, soil-C sequestration rate, infiltration rate, bare-soil-day reduction, named-pest break magnitude, or additional crop-management RUSLE C has been established. Recalled N ranges are low-confidence general knowledge, not fertilizer prescriptions. Toxicity, legume poor seedling competition, wide-host-range diseases and competition for water are retained as conditions. Tree canopy alone never establishes protected orchard-floor soil. Regional/global evidence is `nonLocal: true`; model knowledge is not presented as a Moroccan observation. Expert review, native-speaker review and source rights clearance where unknown remain outstanding.

## Checkout state

The starting checkout had six unresolved merge conflicts. File contents were reconciled by preserving both sets of additions: B2r/crop-detail capabilities, earlier research exports and tests, glossary terms, and both decisions. No index write or commit was attempted. Git therefore still reports the six pre-existing unmerged index entries; their working files contain no conflict markers. The reviewer will need to stage the resolved files when completing that existing merge outside this task.

## Verification

Final checks and actual exit codes are recorded below. Logs and timestamped JSON results are in `/private/tmp/rotavise-b4-verification/`. Checks are never piped into `tail`. Earlier assembly syntax/row-label errors, a missing TypeScript type import and the database capacity failure were inspected and corrected; no timeout, golden hash or assertion was relaxed.

Failures retained and resolved:

| Command or case                                                            |                  Exit | Cause and correction                                                                                                                                                                  |
| -------------------------------------------------------------------------- | --------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node tooling/catalog/assemble-benefits-2026-11-11.mjs` (initial attempts) |                     1 | Template-string endings and the exact singular FAO Potato/Sweet Potato row labels; corrected before admitting data.                                                                   |
| `pnpm build:server` (initial implementation builds)                        |                     1 | Moving the shared recall contract also required importing its `ModelRecall` type; corrected, without changing previous schema fields.                                                 |
| `pnpm test:catalog` (first pass), disposable DB probe                      |                     1 | SQLSTATE 23514 on `catalog_body_limit`; generated/reviewed migration 0027 aligns PostgreSQL with the new bounded catalog size.                                                        |
| Added PostgreSQL 0.15.0 result replay (before fix)                         |                     1 | A crop with no research returns 12 effect gaps, while the response schema allowed 10. The bound now matches the 12 effects, with a regression test.                                   |
| Two direct catalog test attempts; overlapping backend retry                |                     1 | Concurrent rebuilds temporarily removed imported `dist` modules. The overlap was an orchestration mistake; final checks run sequentially. No assertions or time limits were weakened. |
| Failed HTTP requests                                                       | per-request 403 / 404 | Neither response supplies evidence; failures remain in the capture results. Successful primary sources were saved and hashed separately.                                              |

<!-- B4_CHECKS -->

Final resumed verification ran on **2026-11-10 UTC**, after all implementation and source/glossary corrections. Every requested command completed with its actual process exit code; all database tests used disposable PostgreSQL. The interrupted intermediate verifier was not counted as a pass.

| Command                            | Exit | Result                                                                                                          | Finished (UTC)          |
| ---------------------------------- | ---: | --------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `pnpm lint`                        |    0 | Passed                                                                                                          | 2026-11-10 15:10:15.796 |
| `pnpm format:check`                |    0 | Passed                                                                                                          | 2026-11-10 15:10:26.551 |
| `pnpm typecheck`                   |    0 | Passed                                                                                                          | 2026-11-10 15:10:39.063 |
| `pnpm test:catalog`                |    0 | 110 tests passed                                                                                                | 2026-11-10 15:12:07.701 |
| `pnpm test:plans`                  |    0 | 62 tests passed                                                                                                 | 2026-11-10 15:12:50.394 |
| `pnpm test:backend`                |    0 | 89 tests passed                                                                                                 | 2026-11-10 15:14:39.152 |
| `pnpm test:engine`                 |    0 | 285 tests passed                                                                                                | 2026-11-10 15:18:31.647 |
| `pnpm test:api-docs`               |    0 | 29 tests passed                                                                                                 | 2026-11-10 15:18:41.957 |
| `pnpm test:unit`                   |    0 | 35 tests passed                                                                                                 | 2026-11-10 15:18:49.431 |
| `pnpm test:container`              |    0 | Production image; all 15 catalog releases imported and repeat import unchanged; runtime/lifecycle checks passed | 2026-11-10 15:19:53.505 |
| `terrain-integration Jest project` |    0 | 13 tests passed                                                                                                 | 2026-11-10 15:19:56.253 |

The requested Jest suites report **610 passing tests**, plus **13 terrain integration tests** after migration 0027. Existing golden result hashes and speed bounds pass unchanged. No new threshold or default catalog was introduced.

Additional checks completed with exit **0**: `pnpm openapi:generate`; original and derivative SHA-256/exact-quote audit; final release rebuild (all **250 release files byte-identical**); `git diff --check`; and the protected baseline check (**1,370 earlier-release/frontend files unchanged**). The default environment setting and lockfile also have no diff.

`pnpm test:container` uses `BUILDX_CONFIG=/private/tmp/rotavise-b4-buildx` only for writable Docker client metadata. It uses the unchanged production Dockerfile and runtime assertions. No development or production database was modified. Timestamped process records are in `/private/tmp/rotavise-b4-verification/resumed-results.json`; a durable copy is [benefits-checks.json](../../evidence/catalog/2026-11-11/benefits/benefits-checks.json).

<!-- /B4_CHECKS -->

## Reproduce and demo

Original snapshots must be available locally under `.research-sources/2026-11-11/`; full originals are not redistributed. The source manifest records exact upstream URLs, retrieval times, hashes, extraction methods and visual-review derivatives. CI verifies committed quote extracts and all research input hashes without pretending the original bytes are in git.

```sh
node tooling/catalog/assemble-benefits-2026-11-11.mjs
node tooling/catalog/assemble-benefit-roles-2026-11-11.mjs
pnpm build:server
node tooling/catalog/build-release-0.15.0.mjs
pnpm openapi:generate
```

For the API demo, use a disposable migrated database, run the catalog importer there, and explicitly select `ROTATION_CATALOG_VERSION=0.15.0` for format 2 plans. Do not change the default or import into a production database for this task. With a running local API:

```sh
curl 'http://localhost:3000/api/v1/glossary?lang=fr&group=role'
```

The catalog and backend integration suites demonstrate immutable PostgreSQL import, opt-in acceptance, persisted evidence and replay. Weather in engine transport fixtures is clearly synthetic; catalog quotations are real. No live farm-advice or frontend claim is made.

## Proposed DECISIONS text

> B4 adds opt-in catalog 0.15.0 as a strict superset and pins benefits-2 on acceptance. Sourced evidence outranks but never deletes recall; every crop/effect has explicit provenance or a reasoned not-applicable record. Role explanations are served in the four-language glossary. Benefits remain conditional context. Only explicit sourced C observations enter terrain scenarios; missing R/K/P or verified slope length prevents erosion ranking. Catalog capacity increases through migration 0027, while result bounds and defaults stay unchanged.

The scoped implementation/erosion decision is also recorded in `docs/DECISIONS.md`; adoption of a full milestone is not recorded.

## Proposed PROGRESS text

> Scoped B4 follow-up: all 246 crops have 12 benefit-effect records with sourced/recall/not-applicable provenance in opt-in release 0.15.0; four multilingual role explanations and pinned per-strategy evidence are served. Erosion remains unranked. Default catalog and earlier releases are preserved; no income or frontend work. See b4-notes.md for current commands, exit codes and limits. Work remains uncommitted and unpushed for user review; no milestone approval is implied.

Please review the benefit evidence, recalled estimates, translations, migration and scoped engine/API changes.
