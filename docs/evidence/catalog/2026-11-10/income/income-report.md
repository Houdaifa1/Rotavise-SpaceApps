**Income evidence research — 2026-11-10**

Research-only output for catalog 0.13.0, branch codex/income. Ten batches account for all 246 profiles: nine of 25 and one of 21. The order is annual crops, orchards, multi-year stands, then wild-harvested profiles. Catalog identity/model metadata are not newly verified Moroccan commercial-presence claims.

**67 profiles are partial; 179 are not_found; none is complete for current farm-income use.** Here, not_found means no admissible crop/product-specific input was extracted in this bounded pass. It does not mean no Moroccan farmer grows the crop or no other source exists. Every profile has actual FAOSTAT lookups and a saved-corpus keyword-search log. This was not an exhaustive web search for all 246 crops.

| Catalog group    | Profiles | Partial | not_found |
| ---------------- | -------: | ------: | --------: |
| Annual           |      131 |      37 |        94 |
| Orchard          |       47 |      23 |        24 |
| Multi-year stand |       40 |       7 |        33 |
| Wild-harvested   |       28 |       0 |        28 |
| Total            |      246 |      67 |       179 |

| Input                                       | Records | Profiles with records |
| ------------------------------------------- | ------: | --------------------: |
| Prices                                      |     268 |                    53 |
| Yields                                      |     317 |                    59 |
| Variable / explicitly labelled budget costs |      27 |                    22 |
| Margins with source definitions             |      42 |                    31 |
| Rotation-linked income/feed options         |       6 |                     5 |

There are **654 primary numeric records**, 39 downloaded original source snapshots and 172 aligned FAOSTAT price/yield pairs. Coverage counts overlap. All records remain ineligible for automatic production calculations.

FAOSTAT's complete price and production archives were downloaded from the URLs in the saved official bulk manifest. Exact native English CSV rows, headers, archive line numbers, flags and original units are retained. The latest five available annual observations per accepted crop/product series were extracted. They are national annual values, not within-year price ranges, farm-level distributions or forecasts. Paired observations share the exact commodity and year; recent yields are not substituted for old prices.

Moroccan regional guides supply explicit published price ranges and scenario points. Original units are preserved. No averaging, currency conversion, inflation adjustment, quintal/tonne conversion, UF/mass conversion or income calculation was performed. MAD identifies the native dirham using the saved wording “Dirham (symbol DH or MAD)”; it is not an exchange-rate conversion. A null nominal field means nominal/constant-price basis was not explicitly stated. Original unadjusted numbers are kept.

Budget observation years not explicitly stated are null with a not_found explanation. Contract numbers, filenames, publication dates and upload dates were not substituted. The forage book's 1997 date is publication metadata. Apricot potential-yield ranges are study assumptions, not measured typical yields. Legume prose gives Qx without explicitly printing a hectare denominator; that limitation is retained.

Sugar-budget prices print DH only. Their tonne denominator is an explicit inference: 55 T/ha × 565 DH/T = 31,075 DH/ha for beet, and 80 T/ha × 405 DH/T = 32,400 DH/ha for virgin cane. Those are the source budget cells; the inferred denominator is not represented as printed evidence.

The principal evidence is:

- ONCA regional budgets for cereals, legumes, vegetables, oilseeds, sugar crops and orchards; each source, PDF page, original quote and English rendering is indexed in income-sources.json and the batches.
- [FAOSTAT price data](<https://bulks-faostat.fao.org/production/Prices_E_All_Data_(Normalized).zip>) and [production data](<https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip>), saved in full before extraction.
- [HCP provincial yields](https://www.hcp.ma/region-tanger/attachment/2870556/), Figure 64, campaign 2023–2024. These are not paired with unrelated market quotes.
- [INRA forage book](https://www.inra.org.ma/sites/default/files/publications/Document%20technique%20et%20scientique/production-utilisation-cultures-fourrageres.pdf), printed page 107 / PDF page 116. Illustrative feed values, green fodder/seed alternatives and assumed straw sales remain distinct from current cash income or livestock profit.
- [Peer-reviewed Loukkos berry study](https://www.agrimaroc.org/index.php/Actes_IAVH2/article/view/829), campaign 2017–2018. Table 1 says net margin, while the body also uses gross-margin terminology. The negative strawberry outcome, table rounding and terminology conflict are retained. Installation costs were not relabelled as variable production costs.

Published vegetable margins disagree with adjacent revenue/cost summaries. One grape margin exceeds its scenario's gross revenue. Some orchard “gross margins” deduct depreciation. Records retain these definitions and exclusion flags; source values were not silently repaired or used to calculate profit. The citrus and sweet-orange profiles share a catalog identity and source observations; do not double-count them.

Composite categories remain related evidence rather than individual-crop values: wheat subtypes, carrots/turnips, cauliflower/broccoli, cucumber/gherkin, onion/shallot, mixed spice seeds and pumpkin/squash/gourds. Green-garlic data were not assigned to dry bulbs, nor grain-maize data to sweet corn. See commodity-crosswalk.json.

The current Casa Prestations chart was saved but excluded: the inspected stacked-series encoding contains a negative cucumber component and does not explicitly print a currency/weight unit. Search snippets, simulators, export quotations and World Bank results for other countries were not substituted for eligible evidence.

Reuse is unresolved for some sources. Saved FAO database terms/metadata state CC BY 4.0. ONCA/HCP licences are not_found where no explicit licence was verified. The INRA book states all rights reserved. The berry article is CC BY-NC-SA 4.0. Original snapshots stay in the local .research-sources/2026-11-10/ directory; commercial reuse or public redistribution is not cleared.

Remaining work: current region/product/market-matched price ranges, representative yield distributions, dated variable budgets, reconciliation of source accounting, commercial-presence review for obscure entries, and human extraction/translation/licence review. No model-recall input was added.

Review income-batch-01.json through income-batch-10.json, income-sources.json, commodity-crosswalk.json, income-search-log.json, income-issues.json, income-counts.json and income-verification.json. Table quotes retain native numbers; the interpreted column is separately identified. Scanned/image quotes are selected verbatim fragments/cells with spatial locators and saved visual transcriptions.

See income-notes.md for commands, exit codes, verification and proposed DECISIONS/PROGRESS text. No code, contracts, reason codes, OpenAPI, release or stored result was changed. Work is uncommitted; nothing was pushed.
