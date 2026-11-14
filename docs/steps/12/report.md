# Step 12 report — crop knowledge pilot and disease tables

Status: **READY_FOR_REVIEW**. Built and verified on 2026-10-18.

For the first time a real request from a Tadla field gets compared rotations.
The rules come from official Moroccan guides and FAO methods. Every value
carries its document, page and exact words, and a machine checks each quote.
The rules are **not yet expert-reviewed**, and every result says so.

## What changed

- **Catalog release 0.3.0** (`data/catalog/releases/0.3.0`). It has 33 sources,
  10 crop profiles, 39 rules (33 binding), 4 disease entries, 1 registered
  conflict and 126 quoted citations. It is built by
  `pnpm catalog:build <snapshot-directory>` from local copies of the source
  documents.
- **Machine quote check (C04).** The builder pulls the text out of each PDF
  page with PDF.js 6.3.289, and out of each web page or GBIF response. It then
  looks for every quote on the page cited. The comparison ignores case,
  whitespace and typographic quote and dash forms, and nothing else. A missing
  quote stops the build. `quote-check.json` records the page and the quote's
  SHA-256 for every check: 126 checked, 126 found.
- **When a rule is `double_checked`.** A rule gets this status only when:
  - its quote was found on its cited page, and
  - I read the page a second time and confirmed the interpretation
    (`method: quote_match_and_second_reading`).

  The contract refuses that status unless a citation has both a page and a
  quote. Lentil and chickpea rules stay `extracted` with `reference` severity.

- **Thermal-time stage windows.** A temperature rule can now apply only during
  a stage. The stage is located by growing degree days counted from sowing,
  using AquaCrop method 3 (AquaCrop reference manual, chapter 3, page 12). This
  times wheat and barley flowering from the FAO AquaCrop 7.3 defaults. It adds
  no new engine version: older catalogs cannot express the window, so their
  results are unchanged.
- **Regions (C06).** Both come from geoBoundaries gbOpen (OpenStreetMap, ODbL)
  and carry its attribution:
  - `beni-mellal-tadla` is the three ADM2 provinces that contain the ORMVAT
    Tadla perimeter (Béni Mellal, Fquih Ben Saleh, Azilal), stored unchanged
    (936 points).
  - `morocco-general` is the national ADM0 outline, simplified with
    Douglas–Peucker at 0.0005° (about 50 m), from 52,607 to 8,201 points.
- **Default catalog (C07).** `ROTATION_CATALOG_VERSION` now defaults to 0.3.0.
  `pnpm catalog:import` adds it beside 0.1.0 and 0.2.0 without changing them.

## Crop knowledge

| Crop        | Plannable | What is sourced                                                                                                                                                                                                                                                                                |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durum wheat | yes       | Sowing 1 Nov–15 Dec (ONCA p. 43); 165–240 days (FAO-56 Table 11); flowering heat > 35 °C and cold < 5 °C at 1,100–1,830 GDD (AquaCrop annex pp. 45, 47); legume before it; crown rot and common root rot 2-year breaks (ONCA pp. 81–82); well-drained soil. Registered: Karim, Marzak, Carioca |
| Bread wheat | yes       | Same calendar, flowering and break rules; well-drained soil. Registered: Achtar, Arrehane                                                                                                                                                                                                      |
| Barley      | yes       | Sowing 1 Nov–15 Dec; 165–200 days; flowering at 700–1,550 GDD (upper 15 °C); avoid a cereal before it (ONCA p. 23); 1-year break after the main barley diseases (p. 89); crown and root rot breaks. Six INRA varieties                                                                         |
| Faba bean   | yes       | Sowing 15 Oct–31 Dec (ONCA legume reference p. 40); 235 days (FAO, European row: registered conflict); frost below −4 °C (p. 28); cereal before it. Karabiga, Lobab, Hiba                                                                                                                      |
| Sugar beet  | yes       | Tadla sowing 1 Sep–15 Nov for Béni Moussa, Dir and Béni Amir (regional sheet p. 10); 205–250 days; days above 28 °C, because summer heat is the main limit in Morocco (p. 6). Irrigated                                                                                                        |
| Lentil      | no        | Sowing windows (irrigated 15 Oct–15 Nov; semi-arid 15 Nov–15 Dec), 170 days, 5-year anthracnose break, all reference only. Five INRA varieties                                                                                                                                                 |
| Chickpea    | no        | Spring sowing in February and the anthracnose break, reference only. Six INRA varieties                                                                                                                                                                                                        |
| Maize       | no        | Identity, Tadla silage area, three INRA varieties                                                                                                                                                                                                                                              |
| Sesame      | no        | Identity, four-month cycle in Tadla (ORMVAT), no dated window                                                                                                                                                                                                                                  |
| Alfalfa     | no        | Identity (multi-year stand), Tadla area, three INRA varieties                                                                                                                                                                                                                                  |

Lentil and chickpea cannot be planned yet for two reasons:

- The engine compares climate only when every candidate crop has a sourced
  temperature limit.
- The sources give these two crops only germination temperatures, which are
  not damage limits.

French names come from the guides. Arabic names were read from the scanned
INRA Arabic guide covers; they are context citations that cannot be checked by
machine. Arabic names for sugar beet, maize, sesame and alfalfa are recorded
as missing.

## Real Tadla demonstration (C07)

`pnpm plans:tadla-demo` runs the production planning workflow (no test
fixture) in a disposable PostgreSQL database. The prepared NEX-GDDP-CMIP6
32N 7W tile is copied read-only from the dev database, and weather is fetched
live from NASA POWER. The field (32.5, −6.69, near Fquih Ben Saleh, irrigated,
durum wheat last season) is illustrative, not a real farm.

The output is recorded in `docs/evidence/plans/2026-10-18/tadla-demo.json`.
On 2026-10-18 the run:

- completed in 26.6 s with outcome `comparisons_available`;
- used 35 POWER weather snapshots, 690 climate-model units and 30 historical
  analog years;
- compared all 10 future model worlds (5 models × 2 pathways).

Results:

- Five crops were schedulable. 125 rotations were completed and compared, with
  no pruning.
- First place is a tie between faba bean → bread wheat → faba bean and
  faba bean → durum wheat → faba bean (historical mean loss 0.013). The top
  rotation stays first in every future world.
- Under SSP2-4.5 and SSP5-8.5 the losses fall slightly (−0.005, −0.006),
  because warming reduces the frost days that drive faba's score.
- Sugar beet's best rotation is rank 49 (loss 0.113), because many late-cycle
  days pass 28 °C.
- The result lists `NOT_EXPERT_REVIEWED` (C08) and `IRRIGATION_ADEQUACY_UNKNOWN`.

## Verification

| Date       | Command                                                    | Outcome                                                                                                                                            |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-18 | `pnpm catalog:build ~/Desktop/Rotavise-sources/2026-10-18` | 33 sources, 10 profiles, 39 rules, 126/126 quotes found; a second build produced identical files                                                   |
| 2026-10-18 | catalog-unit, rotation, scenarios Jest projects            | 89 passed                                                                                                                                          |
| 2026-10-18 | rotation-integration Jest project                          | 8 passed                                                                                                                                           |
| 2026-10-18 | `pnpm plans:tadla-demo`                                    | completed, `comparisons_available`, as above                                                                                                       |
| 2026-10-18 | `pnpm verify`                                              | passed: 540 Jest and 5 Chromium tests, build, production container checks (three catalog imports, 0.3.0 rules present), clean frozen install/build |

New tests:

- **Catalog:**
  - 0.3.0 passes production validation;
  - the recorded quote check covers exactly the release's quoted citations,
    with matching hashes;
  - every binding rule is quote-checked and cites a page and quote;
  - Béni Mellal, Azilal, Casablanca, Khouribga, Madrid and the open Atlantic
    resolve to the right regions;
  - the committed GBIF responses match their hashes.
- **Engine:** a Tadla request with the real catalog gives the five plannable
  crops. Every slot stays inside its sourced window, a legume comes first after
  durum wheat, and the flowering rules enter the comparison.
- **Thermal time:** the window starts and ends on the right days and is unknown
  when a day is missing.
- **Integration:**
  - the worker resolves the Tadla field and asks POWER for its cell;
  - it refuses weather labelled synthetic in a production run;
  - a field in Spain gets `insufficient_evidence` and no weather requests.
- **Container check:** it now expects the three imports and binding rules for
  exactly the five plannable crops.

## Limits

- **No expert review.** No agronomist has reviewed the rules. National
  guidance applies in Tadla only as a visible condition (`RULE_SCOPE_UNSPECIFIED`
  for farming system and cultivar).
- **Climate scores compare each crop with its own sourced limits.** The kinds
  of limit differ:
  - cereals: flowering damage limits;
  - faba bean: frost;
  - sugar beet: the top of a favourable range.

  So the scores do not compare yields, and sugar beet is judged more strictly
  than the cereals. Step 13 (AquaCrop yields and the water balance) replaces
  this with yield-based comparisons.

- **Data still missing:**
  - water demand for every crop;
  - lentil and chickpea temperature limits;
  - a Moroccan faba duration;
  - beet bolting timing;
  - wheat ear-frost timing;
  - maize, sesame and alfalfa calendars.

  The two sclerotinia advice lines and colza are not encoded. Sowing windows
  are national optima, except sugar beet.

- **Regions are approximate.** They are administrative provinces, wider than
  the irrigated plain and including mountains. The national outline is
  simplified, so points within about 50 m of the border or coast may resolve
  differently.
- **Some sources cannot be shared.** Source PDFs without a reuse licence are
  hashed and quoted but not committed. They stay in the local snapshot
  directory, so `pnpm catalog:build` can only be rerun where the snapshots
  exist.
- **Synthetic weather in integration tests.** Production runs refuse it by
  design, so the full success path with real weather is shown by the demo, not
  by an automated test.

## Part B, first stage — plans across Morocco (2026-11-01)

Release 0.4.0 keeps the rules of 0.3.0 unchanged, adds Morocco's 12 regions
(geoBoundaries ADM1, ODbL, simplified to about 100 m) and makes durum and bread
wheat, barley, faba bean, lentil and chickpea applicable nationally, citing the
guides' national scope. Lentil and chickpea remain unschedulable. Sugar beet
stays with its Tadla sheet. All 138 quotes were found by machine.

`pnpm plans:morocco-demo` ran 10 illustrative rainfed fields with live NASA
POWER on 2026-11-01 (`docs/evidence/plans/2026-11-01/morocco-demo.json`): all 10
returned `comparisons_available` with 4 schedulable crops. `pnpm verify` passed:
543 Jest and 5 Chromium tests, build, container and clean-install checks.

**Serious limit, not yet fixed:** all 10 fields get the same top rotation, and
Dakhla and Errachidia get rainfed wheat and faba bean. Dakhla has the best
climate score (loss 0.000). Scores count only temperature limits; rainfall is
not checked, and sowing windows are national. These desert results must not be
shown to farmers as advice until a sourced rainfall check exists.

Not done in Part B: rainfall check, soil data, regional sugar-beet dates, more
crops, future-climate tiles outside Tadla.

Correction: the Part A run was recorded as 535 Jest tests; the log shows 540.

## Part B, second stage — water balance (2026-11-01)

Catalog 0.5.0 and engine 5 compare water per field. `pnpm plans:morocco-demo` with live NASA POWER on 2026-11-01: top rotations now vary (barley or bread wheat in the middle slot). The share of crop water not covered by rain ranges from 0.42 (Meknès) to 0.94 (Dakhla), and Dakhla's rainfed cereals carry the arid warning. `pnpm verify` passed: 547 Jest and 5 Chromium tests.

Limits: POWER's coarse grid gives Errachidia 276 mm a year, which looks high and is unchecked against stations, so it gets no arid warning. Faba bean still comes first everywhere and has no arid rule. Future water is not compared because the climate download has temperature only. This replaces the "Serious limit" above in part: desert fields now score badly on water, but they are still listed.

## Part B, fair ranking and engine speed (2026-11-02)

- **Fair ranking (rotation-engine-6, planning-workflow-5, migration 0020).**
  Faba bean ranked first after wheat everywhere partly because crops were
  judged by different temperature checks (cereals at flowering, faba bean only
  for frost below −4 °C, 14 crops not at all) and because a crop with no
  sourced preferred predecessor got half marks. Climate now ranks only when
  every schedulable crop has the same kind of check; otherwise it is reported
  with weight 0 and `CLIMATE_CHECKS_DIFFER`. Soil scores only checkable crop
  changes and names the others in `SOIL_PREFERENCES_UNEVEN`. A first version
  that dropped soil entirely put barley first after durum wheat in the 0.3.0
  Tadla test and was replaced. Three new tests cover cereals only, cereals with
  faba bean, and lentil.
- **Engine speed.** `rotationExtremes` took 87 % of the benchmark under Jest
  (65.9 s); with plain comparisons it takes 2.96 s, with byte-identical output.
- **Checks.** `pnpm test:engine` in the cloud container: 190 passed.
  GitHub Actions `pnpm verify` for 42d7024: 594 Jest and 5 Chromium tests,
  build, container and clean-install checks passed.
- **Not rerun:** the live Morocco demo (NASA POWER is blocked from the cloud
  container), so how often faba bean still comes first on real fields is not
  yet measured. Run `pnpm plans:morocco-demo` on the Mac.

## Part B, catalog 0.10.0: all crop knowledge (2026-11-07)

Built by `node tooling/catalog/build-release-0.10.0.mjs` (deterministic, no
network) from release 0.9.0 and the research folder (commit bdf538f), plus two
recall gap-fill files in `docs/evidence/catalog/2026-11-07/` that give every
schedulable crop an evaluable heat and cold limit, a window and a duration, and
a first problem list for 14 crops that had none. The decision is in
DECISIONS "Model-recall crop knowledge in the catalog".

- **Contents:** 207 profiles (33 from 0.9.0, 174 new), 142 sources (68 new,
  each bound to the saved file's SHA-256), 557 cultivars, 753 references
  (yields, chill hours, background), 387 crop problems and 1,366 rules, of
  which 1,106 are `model_recall` and 51 new rules are `double_checked` because
  their quote was re-found by machine in the saved source text. The 0.9.0
  profiles, rules and quote checks are carried over unchanged.
- **Evidence class:** a rule, cultivar, problem, identity or reference may
  carry `recall` (confidence, basis, `model_recall_unverified`, no quote)
  instead of a citation. The engine uses these rules for scheduling, climate
  checks, rotation and ranking exactly like sourced ones; the only trace in a
  result is the count `evidence.rulesUsed.model_recall`, present only when
  above zero. The existing "not expert reviewed" reason is unchanged. Sourced
  beats recalled: the builder drops a recalled rule where an evaluable sourced
  rule answers the same question and logs the conflict.
- **Model types:** `wild_harvested` was added beside `orchard`; neither is ever
  scheduled. 147 crops are annual or stand crops and all have a planting
  window, a duration, a daily-maximum limit and a daily-minimum limit, so fair
  ranking always has shared heat and cold checks.
- **Crop problems:** names (English, French, Arabic when known), scientific
  name, hosts, visible symptoms and rotation break years; no treatments. The
  photo check now also sends each problem's other names and visible signs. Per
  group (problems / crop links): cereals, oilseeds and industrial 83 / 104;
  pulses 30 / 38; vegetables and roots 135 / 212; forage 28 / 33; orchard and
  nut trees 99 / 147; herbs, spices and medicinal 53 / 78; berries and other
  fruit 22 / 32; wild-harvested 9 / 10. Twelve crops (mostly wild-harvested) still have no
  problem list (see the merge log `cropsWithoutIssues`).
- **Verified on 2026-11-07 (Mac, Node 24.19.0):** `pnpm lint`, `pnpm
format:check`, `pnpm typecheck` clean; `pnpm test:catalog` 67 passed;
  `pnpm test:engine` 213 passed (includes the whole-catalog suggest run, 39 s,
  143 schedulable crops); `pnpm test:plans` 58 passed; `pnpm test:backend` 64
  passed. Added tests cover the release's provenance and completeness, the
  engine on recall-only crops, PostgreSQL import with hash round-trip, and a
  60-problem photo-check table.
- **Not run:** `pnpm verify` in full (Chromium, container and clean-install
  checks), a live Morocco demo with 0.10.0, and any expert review.
- **Limits:** about 80 % of the rules are recalled and mostly low confidence;
  many damage limits are whole-cycle approximations; FAO-56 water curves,
  soil limits and Moroccan region validation exist only for the 0.9.0 crops;
  194 of the 207 profiles have no regional applicability beyond
  `morocco-general`; the suggest search over the whole catalog is bounded and
  slow (39 s under Jest).
