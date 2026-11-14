# Rotation-benefits research — catalog 0.13.0

Research date: 2026-11-10. Branch: `codex/benefits`. Research only; no catalog release, runtime contract, reason code or application behavior changed. No approval is recorded.

## Delivered coverage

- **246 crops in 10 batches:** nine batches of 25 and a final batch of 21, sorted by existing catalog crop ID.
- **102 sourced records for 45 crops**, using 18 crop-evidence sources. The source manifest contains **23** items including context and table sources.
- **201 crops have only `not_found` findings.** Across nine effect categories, **78 of 2,214 crop/effect slots** have some sourced evidence; **2,136 slots** are `not_found`.
- There are **27 records with an accepted numerical magnitude**, 74 with qualitative evidence but a missing compatible number, and one with conflicting numbers. These are record counts, not independent studies.
- No agronomic model-recall facts were added. Existing crop identities and their provenance are referenced from the unchanged catalog.

| Effect                           | Sourced records | Crops with evidence | Crops with a compatible number | Crops with no accepted effect |
| -------------------------------- | --------------: | ------------------: | -----------------------------: | ----------------------------: |
| Biological nitrogen fixation     |              11 |                   6 |                              5 |                           240 |
| Residual nitrogen credit         |               4 |                   2 |                              0 |                           244 |
| Forage / straw / feed            |              49 |                  40 |                             14 |                           206 |
| Disease break                    |               4 |                   4 |                              0 |                           242 |
| Weed break                       |              15 |                  10 |                              0 |                           236 |
| Pest break                       |               7 |                   7 |                              0 |                           239 |
| Roots / structure / infiltration |               3 |                   3 |                              1 |                           243 |
| Cover / residue / erosion        |               5 |                   4 |                              2 |                           242 |
| Bare-soil calendar               |               4 |                   2 |                              0 |                           244 |

A compatible number is not necessarily a planner-ready benefit: it may describe root depth, sample feed composition or a site-specific C factor. No following-crop nitrogen-credit range or bare-soil-day reduction is accepted in this pass.

## Reading the files

`benefits-batch-NN.json` contains every crop and every requested effect. Nitrogen fixation and following-crop credit are separate categories, as are disease, weed and pest breaks. `status: sourced` means a saved quote supports the stated observation under its conditions. Numerical gaps remain `magnitude.status: not_found`; `direction` is null where no effect was established. All findings are research candidates, not executable planner rules.

`benefits-sources.json` records URLs, actual UTC retrieval times, source SHA-256, saved files, title and licence status. PDFs, HTML, page renders and extraction/OCR text are saved under `.research-sources/2026-11-10/`. Three publisher records use explicitly labelled **web-service extracted publisher text**, not raw HTML or a saved full paper. Four raw requests returned HTTP 403, and a 213-byte denial page was rejected; dispositions are retained in `retrieval-log.json` and `benefits-screening.json`.

`benefits-context.json` preserves pooled, inconclusive and scope evidence without assigning unsupported crop values. `benefits-tables.json` preserves the complete relevant FAO Tunisia table and the olive/vineyard C-factor table with its saved image. Original quotes are preserved with declared NFKC/whitespace normalization; printed line-end hyphens are retained. English versions of French passages are assistant translations, not independent source quotations.

## Findings and important limits

- The nitrogen data distinguish fixation, crop N budget, soil N sparing, labelled-fertilizer recovery and N actually supplied to the following crop. The latter remains a gap. The faba-bean handbook's original nitrogen “units” were not silently converted to kg N/ha. See the faba-bean records and [context evidence](benefits-context.json).
- Feed composition has Moroccan sample evidence and Portuguese study evidence. These are feed-resource observations, not prices, a monetary valuation or complete ration recommendations. Perennial fodder/rangeland species remain separate from annual rotations.
- **Conflict retained:** Table 4 in the Moroccan feed study gives chickpea-straw crude protein as 7.4% DM, while the prose gives 7.1%. No single value was selected. The Portuguese rape-straw prose/table discrepancy was noticed during screening and no rape CP value was accepted.
- Break effects are often qualitative or mixture-specific. General cereal-disease prevention is not a quantified soil-borne pathogen effect. The groundnut guidance names a soil-borne disease and cereal predecessors; its nematode guidance names maize and sorghum. No new efficacy threshold or return interval is invented.
- Alfalfa rooting depth is not an infiltration-rate gain. Rapeseed and field-bean structure statements are qualitative. There is no accepted measured infiltration improvement.
- The FAO Tunisia C table is **historical USLE/Wischmeier evidence**, with broad crop groups. It is not a Moroccan RUSLE calibration, and no generic row was copied onto individual crops. Olive/vineyard values describe management systems and heterogeneous studies; they are explicitly `nonLocal: true` and cannot serve as unconditional crop constants. See [tables](benefits-tables.json).
- The Merchouch calendar supports prolonged cover in the **lentil–chickpea relay system**. It supplies harvest months, not exact avoided bare-soil days, canopy closure or residue-cover measurements.

## Search scope and gaps

This is a bounded evidence pass. Searches prioritized INRA Maroc, ICARDA and FAO, then Moroccan research and Mediterranean studies. Every catalog crop is present in the coverage matrix and has a literal-identity screening trace against the selected saved texts. **An exhaustive individual literature search for all 246 crops is not finished**, and `not_found` means “no acceptable record extracted in this pass,” not “the crop has no benefit.” Automatic text matches never create agronomic facts.

The largest open needs are locally measured crop-specific residual N credits, crop/family-specific soil-borne disease and pest comparisons, calibrated crop-and-management RUSLE C factors, measured structure/infiltration changes and ground-cover calendars with exact comparison periods. Expert agronomic review, translation review, redistribution permissions where unknown/restricted, source-conflict resolution and all planner integration remain outstanding.

## Verification and review

Final verification is recorded in `benefits-verification.json`; commands and actual exit codes are in [notes](benefits-notes.md). The validator passed with exit 0: 131 quote occurrences (92 distinct quote/file pairs) across 36 text artifacts were rechecked against saved sources, all 23 manifest source hashes matched, and all 1,755 tracked files matched the starting baseline. Scoped formatting and final dependency cleanup are recorded separately in the notes. All requested evidence files are intended to remain uncommitted. No push or deployment is authorized.

Please review the quoted records, conflicts and locality restrictions before any catalog or planner integration.
