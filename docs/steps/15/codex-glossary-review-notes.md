# Glossary translation review and Darija addition

Date: 2026-11-10. Branch: `codex/glossary-review`, this worktree.
Scope: the user's glossary-only follow-up to [P7](p7-notes.md).
This is a model-assisted language review, **not native-speaker approval**.
French, Standard Arabic and Darija remain `model_translated_unreviewed`.
English remains `model_written_unreviewed`. Nothing is `human_reviewed`.

## Changes and counts

Every French and Standard Arabic label and explanation was read against its
English counterpart. Wording that was already clear was retained. Counts below
compare row values with `HEAD`, ignoring formatting. A changed entry can have
both its label and explanation changed.

| Language                         | Entries examined | Existing entries changed | Labels changed | Explanations changed | Entries added |
| -------------------------------- | ---------------: | -----------------------: | -------------: | -------------------: | ------------: |
| English (`en`, reference)        |              332 |                        0 |              0 |                    0 |             0 |
| French (`fr`)                    |              332 |                       59 |             42 |                   27 |             0 |
| Standard Arabic (`ar`)           |              332 |                      191 |             88 |                  159 |             0 |
| Moroccan Arabic / Darija (`ary`) |              332 |                        — |              — |                    — |           332 |

Darija adds 664 strings: one label and one explanation per entry. All four
languages have the same 332 `(group, code)` keys in the same order. The groups
are `reason_code` (116), `strategy_note` (38), `effect` (6), `status` (61),
`evidence` (10), `score` (9), `error` (54), and `term` (38). P7's historical
count of 329 predates the three `NEAR_TERM_*` reason entries already present in
this checkout; no codes were added, renamed or removed by this review.

Material wording corrections:

- Fixed Arabic `status/insufficient_alternatives`: the old sentence said it
  was impossible to find fewer than two alternatives. It now says two or more
  could not be found and scored, matching the English.
- Restored the missing reference to regional rules in French
  `CROP_NOT_APPLICABLE_IN_REGION`, preserving missing evidence versus refusal.
- Replaced literal sowing “windows” with periods, awkward Arabic disease-break
  wording with waiting periods before recultivation, and language implying
  suspicion about a rainfed crop with uncertainty about its success.
- Standardized Arabic crop rotations as `الدورة الزراعية`, the crop catalog as
  `دليل المحاصيل`, rainfed farming as `الزراعة البورية`, and irrigation as
  `السقي`. Checked agreement after those changes. Kept growth-cycle duration
  distinct from a multi-crop rotation.
- Changed French expert-review labels from “validated” to “reviewed”; clarified
  AI recall as writing from a model's memory. Replaced literal Arabic interface
  “sliders” and GRACE “anomaly” wording with explanations of their meaning.
- Preserved units, numbers, identifiers, scenario names, uncertainty and the
  distinctions between estimates, observations, diagnoses and predictions.
  `field_history_anomaly` needs the English clarification described below.

The shared contract adds `ary` after `en`, `fr`, `ar`. Domain tuples require
all four translations at compile time. The existing endpoint already parses
that contract and selects text by language, so it accepts `lang=ary` without
another allowlist or route change. It returns `Content-Language: ary`,
`direction: rtl` and a Darija provenance notice. Arabic also remains RTL.
The glossary version is now `glossary-2`. Response fields, groups, codes,
ordering and default English behavior remain unchanged. OpenAPI's description
and three language enums were regenerated.

No engine, climate, catalog, download or what-if code was edited. The task
prompt Markdown was formatted after the first formatting check identified it;
its whitespace-separated words were checked against a saved original and are
unchanged. It was already untracked and remains uncommitted.

## Terminology sources

Consulted on 2026-11-09/10 for terminology, **not as validation of crop rules,
thresholds or satellite products**. Plain-language paraphrases are model
choices; no organization reviewed the translations.

- [INRA Meknès: technologies économes en eau, Abdellah Kajji](https://mag.inrameknes.info/?p=172)
  supports French `rotation culturale`, `stress hydrique`, `semis`, and
  `variété` in calendar, water, crop and strategy entries. The simpler “période
  de semis” is an editorial choice, not a quote.
- [INRA Al Awamia: soil-type index and rotation/residue study](https://www.inra.org.ma/fr/tags/type-de-sol)
  supports French soil organic matter, crop residues and rotation vocabulary.
  [INRA Arabic press-release listing](https://www.inra.org.ma/index.php/ar/gestion-du-menu-principal/blaghat%3Flanguage%3Dar?page=1)
  uses `الدورة الزراعية` and adapted varieties. These two listings were available
  as indexed excerpts; direct reads returned a 502 or timed out. They were not
  read as complete papers or complete press releases.
- [INRA Settat: environment and sustainable natural-resource management](https://settat.inra.org.ma/ar/whdt-albhth-albyyt-waltdbyr-almstdam-llmward-altbyyt-stat)
  uses Arabic nitrogen terminology (`الأزوت`), food legumes and soil analyses.
  This informed the nitrogen-fixing legume entry; `الآزوت` is the spelling
  retained here. No nitrogen quantity was introduced.
- [ONSSA: santé végétale et avertissements agricoles](https://www.onssa.gov.ma/sante-vegetale-dsa/protection-des-vegetaux/protection-du-patrimoine-vegetale/sante-vegetale-et-avertissements-agricoles/)
  and its [Arabic version](https://www.onssa.gov.ma/الصحة-النباتية/حماية-النباتات/حماية-الرصيد-النباتي/الصحة-النباتية-والإنذارات-الفلاحية/?lang=ar)
  distinguish monitoring, field observations, laboratory analysis and harmful
  organisms. This informed pest/disease, reported-versus-confirmed problem and
  local-specialist wording. `صحة المحاصيل` is the farmer-facing wording here
  for plant health, not a claim of an ONSSA diagnosis.
- The MAPMDREF website could not be fetched. Instead, the official Moroccan
  portal reports the agriculture minister's statements about the agricultural
  season and irrigation in [French](https://maroc.ma/fr/actualites/campagne-agricole-2025-2026-la-recolte-cerealiere-prevue-pres-de-90-mqx)
  and [Arabic](https://maroc.ma/ar/الأخبار/الموسم-الفلاحي-2025-2026-توقع-بلوغ-محصول-الحبوب-نحو-90-مليون-قنطار).
  These support local agricultural campaign and irrigation/supply vocabulary.
  This is government reporting of the ministry, not a directly consulted
  MAPMDREF technical glossary. Compare with current ministry extension
  materials during local review.

## Conservative Darija fallbacks

Every Darija explanation was written individually in Arabic script, with
everyday Moroccan grammar (`القطعة`, `البور`, `السقي`, `الشتا`, `الما`). Brand
names and scientific identifiers retain their spelling. For these technical
concepts, a clear Standard Arabic expression was preferred to inventing a
dialect word. Ordinary shared Arabic words are not all classified as uncertain.

| Expression retained                                                                             | Entries to review                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crop rotation, `الدورة الزراعية`                                                                | `MODEL_TYPE_UNSUPPORTED`, `HISTORY_UNKNOWN`, `PREVIOUS_CROP_UNRESOLVED`, `ROTATION_KNOWLEDGE_UNAVAILABLE`, `ROTATION_PROXY_UNAVAILABLE`, `ROTATION_PROXY_COMPARISON`, `REMINDER_LOCAL_REVIEW`; status `no_feasible_rotation`, `unsupported_for_plan`, `not_provided`, `not_evaluable`, `farmer_declared`; score `soil_health` |
| Botanical family and legumes, `الفصيلة النباتية`, `البقوليات`                                   | `PREVIOUS_CROP_UNRESOLVED`, `PREDECESSOR_FAMILY_PROHIBITED`, `BENEFIT_NITROGEN_FIXING_CROP`, `BENEFIT_MORE_CROP_FAMILIES`, `BENEFIT_FEWER_SAME_FAMILY_REPEATS`; score `soil_health`                                                                                                                                           |
| Nitrogen fixation, `تثبيت الآزوت`                                                               | `BENEFIT_NITROGEN_FIXING_CROP`                                                                                                                                                                                                                                                                                                |
| Water stress/balance, `الإجهاد المائي`, `حصيلة مائية`                                           | `IRRIGATION_ADEQUACY_UNKNOWN`, `WATER_CLASS_COMPARISON`, `BENEFIT_LOWER_WATER_LOSS`; score `water`; term `ecostress.esi`                                                                                                                                                                                                      |
| Evaporative stress, `الإجهاد التبخري`                                                           | `ecostress.esi`, `product.ecostress`                                                                                                                                                                                                                                                                                          |
| Erosion, slope and terrain, `التعرية`, `الانحدار`, `التضاريس`                                   | `PRIORITIES_CONTEXT_NOT_RANKED`, `GAP_EROSION_NOT_ASSESSED`, `FIELD_TOO_LARGE_FOR_TERRAIN`, `terrain.slope`, `terrain.erosion_ls`                                                                                                                                                                                             |
| Biomass, woody vegetation and hedges, `الكتلة الحيوية`, `النباتات الخشبية`, `السياجات النباتية` | `CANOPY_BIOMASS_NOT_IMPORTED`, `CANOPY_BIOMASS_OUTSIDE_IMPORT`, `CANOPY_BIOMASS_NO_ESTIMATE_NEARBY`, `gedi.agbd`, `gedi.hedges_and_trees`, `gedi.not_crop_biomass`, `product.gedi`                                                                                                                                            |
| Uncertainty and rule strength, `هامش عدم اليقين`, `درجة إلزام القاعدة`                          | `grace.trend`; evidence `reference`, `soft`, `hard`                                                                                                                                                                                                                                                                           |
| Weighted loss, `الخسارة الموزونة`                                                               | `WHY_RANKED_BY_PRIORITIES`, `WHY_LOWER_LOSS_THAN_CURRENT`; scores `weightedLoss`, `rank`                                                                                                                                                                                                                                      |
| Climate scenarios, `سيناريوهات`, and model language                                             | `FUTURE_CLIMATE_UNAVAILABLE`, `SCENARIO_TILE_NOT_PREPARED`, `NEAR_TERM_ANALOGS_INSUFFICIENT`, `EVIDENCE_FUTURE_CLIMATE`, `BENEFIT_BETTER_UNDER_FUTURE_CLIMATE`, `GAP_FUTURE_CLIMATE_UNAVAILABLE`, `RISK_WORSE_UNDER_FUTURE_CLIMATE`, `meanChange`, `product.nex_gddp`                                                         |
| AI model memory, `نموذج ذكاء اصطناعي`                                                           | `EVIDENCE_RULE_SOURCES`, `GAP_RECALLED_RULES`, `REMINDER_AI_RECALL`, evidence `model_recall`                                                                                                                                                                                                                                  |
| Technical service terms rather than dialect coinages                                            | `IDEMPOTENCY_CONFLICT` (request key), `RATE_LIMITED` (`Retry-After`), `INVALID_ORIGIN_OR_CONTENT_TYPE` (`origin`, JSON), `PHOTO_UNREADABLE` (decoding); `product.*` retain product identifiers                                                                                                                                |

## Least certain entries and remaining human review

- **`field_history_anomaly`:** the English says “Below usual” but then describes
  both greener and less green values. French, Arabic and Darija now describe
  general deviation in either direction without repeating that contradictory
  label. The observation constant and its English glossary text were left
  unchanged. Resolve that English ambiguity before approving a literal
  translation.
- **`HEALTH_BREAK_VIOLATION`, `HEALTH_BREAK_SATISFIED`, `RETURN_INTERVAL_*`:**
  verify that farmers understand a period before growing a crop again, rather
  than a pesticide preharvest interval. Have an agronomist approve disease-break
  and predecessor-family terminology.
- **`weightedLoss`, `climate`, `water`, `soil_health`, `crop_health`,
  `meanChange`, `versusCurrent`:** confirm that “loss” means a score, not measured
  yield, money or a disease probability. Check positive/negative change,
  lower-is-better and the priority controls aloud.
- **`SOIL_ESTIMATE_USED`:** the inherited English headline says satellite-based,
  while the explanation describes a SoilGrids map/model estimate. The
  translations preserve that distinction; the headline's scientific precision
  needs separate review.
- **`ndvi`, `modis.usually_low`, `modis.hls_agreement`, `terrain.erosion_ls`,
  `ecostress.esi`, `grace.equivalent_water_height`, `gedi.agbd`,
  `gedi.hedges_and_trees`:** the Standard Arabic fallback terms may be too
  technical for spoken Darija. Test with farmers from different regions while
  preserving the limits on what these observations can establish.
- **`product.ecostress`, `product.gedi`, `terrain.elevation`,
  `terrain.dem_noise`, `grace.regional_not_field`:** product resolution,
  sensor-versus-derived-model statements and reliability wording are inherited
  from English. This review did not revalidate the science or establish any
  reliability guarantee.

A Moroccan French reader, a fluent Standard Arabic editor and native Darija
speakers with agricultural experience must still read **all** entries, not only
those listed above. Check regional wording, address forms, Darija spelling,
crop-versus-harvest meaning, rotation-versus-growth-cycle meaning and labels
without their explanations. Test Arabic mixed with Latin names, units and
numbers in an actual RTL interface; these tests verify API metadata, not browser
typography or frontend design. No native reader or agronomist participated.

## Verification

Rerun after resuming on 2026-11-10, with Node 24.19.0 and pnpm 12.6.0.
Each command was executed directly with stdout/stderr redirected to a log under
`/tmp/glossary-*.log`; the process exit code was collected from the execution
tool. Nothing was piped into `tail` or another process that could mask its exit
status. PostgreSQL tests use disposable Docker PostgreSQL 18.4 containers, not
mocks. No live NASA or AI service was exercised.

| Command                             | Exit code | Result                                                                                              |
| ----------------------------------- | --------: | --------------------------------------------------------------------------------------------------- |
| `pnpm openapi:generate`             |         0 | Regenerated `docs/api/openapi.json`                                                                 |
| `pnpm lint`                         |         0 | Passed                                                                                              |
| `pnpm format:check` (first attempt) |         1 | Only the pre-existing untracked task prompt needed formatting; corrected without changing its words |
| `pnpm format:check` (final)         |         0 | Passed after formatting the task prompt and notes                                                   |
| `pnpm typecheck`                    |         0 | Server build and all workspace type checks passed                                                   |
| `pnpm test:unit`                    |         0 | 30 tests passed                                                                                     |
| `pnpm test:api-docs`                |         0 | 26 tests passed across glossary, OpenAPI and real-PostgreSQL integration                            |
| `pnpm test:backend`                 |         0 | 72 tests passed across six suites using real PostgreSQL                                             |
| `git diff --check`                  |         0 | No patch whitespace errors at the time checked                                                      |

Additional AST comparison against `git show HEAD:<file>` exited 0: all 332
group/code keys, their order and all English labels and explanations are
unchanged; all have a Darija label and explanation. New tests explicitly keep
the existing three languages, require Darija for every code, reject empty
texts, check Arabic script in Darija explanations and require RTL and honest
provenance for `ar` and `ary`. Endpoint integration also checks language
headers, identical code coverage, per-language ETags, 304s and Darija group
filtering. Existing coverage and OpenAPI freshness tests remain enabled.

Not run: full `pnpm verify`, browser/end-to-end, container-build, performance or
other engine/science suites. Their behavior is not claimed by this report.

## Local demo and handoff

With the API already running locally:

```sh
curl --fail --silent --show-error 'http://127.0.0.1:3000/api/v1/glossary?lang=ary'
curl --fail --silent --show-error 'http://127.0.0.1:3000/api/v1/glossary?lang=ar&group=reason_code'
curl --fail --silent --show-error 'http://127.0.0.1:3000/api/v1/glossary?lang=fr&group=evidence'
```

Left **uncommitted**, following the user's continuation instruction that the
sandbox blocks git-index writes. No commit was attempted after that instruction;
nothing was pushed or deployed. Please review the local diff and translations.
This report does not record user approval or advance a milestone.
