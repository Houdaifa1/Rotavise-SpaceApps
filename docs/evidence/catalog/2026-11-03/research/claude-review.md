# Claude's review of Codex's crop-facts research

Spot-check performed 2026-11-06 against the saved local sources in
`.research-sources/2026-11-03/` (445 files, not committed). This is a
representative sample, not a full re-audit of all 261 records: all 30
non-partial "found" records, ~15 "partial" records across sections A/C/E/F,
and 6 of the 34 "training_based" K.* entries. No catalog file or `facts.json`
was edited.

## Records checked

| Item | Verdict | Note |
| --- | --- | --- |
| B.alfalfa.planting_window.coastal | confirmed | "d'août à novembre" found verbatim on the cited INRA page 139; SHA-256 of `inra-forage.pdf` matches. |
| B.alfalfa.planting_window.cold_winter | confirmed | "septembre-octobre" verbatim, same page. |
| B.alfalfa.planting_window.spring | confirmed | "mars-avril" verbatim, same page; page also states alfalfa stands last "3 à 4 ans" (relevant to the still-partial `B.alfalfa.stand_lifetime`). |
| B.garlic.planting_window.coastal_spring_harvest | confirmed | "Octobre-Novembre" (OCR-split across lines in the raw PDF) verified against the plain-text extract; correctly attributed to the coastal spring-harvest cycle, not a Morocco-wide window. |
| B.garlic.planting_window.late_summer_autumn_harvest | confirmed | "Décembre-Janvier" verbatim, same source. |
| C.carrot.minimum_return_interval | confirmed | "avant 5 années" verbatim; record explicitly notes and rejects a conflicting "6" from a search-index rendering — good diligence. |
| C.onion.preferred_predecessor | confirmed | "Précédents favorables : céréales, pomme de terre, betterave, cultures sarclées" — "céréales" correctly mapped to Poaceae only, not over-generalized to the other named predecessors. |
| E.rothc.dpm_rate / bio_rate / hum_rate / rpm_rate / agricultural_dpm_rpm / clay_partition / temperature_modifier | confirmed (7 records) | All constants (10.0, 0.66, 0.02, 0.3, 1.44, clay formula, temperature formula) verified verbatim against `rothc-guide.pdf` §1.3/1.5/1.6/1.7; the temperature-modifier record also cross-checked its -5°C floor against the official RothC v1.0.0 Fortran source, a nice extra rigor step. |
| E.soilgrids.bdod / cec / clay / nitrogen / phh2o / sand / silt / soc | confirmed (8 records) | All 8 conversion factors verified verbatim against ISRIC's own conversion table in `isric-layers.html`/`.txt`. |
| F.carrot/chickpea/courgette/eggplant/faba-bean/lentil/onion/potato .settat.* | confirmed (8 records) | Re-extracted the HCP Settat PDF's text and manually tracked page-footer markers to confirm each value sits on the page claimed. One subtlety resolved correctly by Codex: the document has TWO adjacent yield tables for different campaigns (2015-2016 on page 71, 2014-2015 on page 72) with different values for the same crops — Codex used distinct item ids per campaign/page and did not mix them. |
| A.faba-bean.heat, A.potato.heat, A.lentil.heat, A.pea.heat (partial) | confirmed | Quotes verbatim in their sources; correctly flagged `nonLocal: true` and tier 4 for the two non-Moroccan journal/university sources (Bishop et al.; Bueckert & Warkentin, U. Saskatchewan). |
| A.pea.cold, A.sugar-beet.cold, A.carrot.cold (partial) | confirmed, with context added | All three cite FAO's frost-protection Chapter 4, Table 4.5 "A range of critical damage temperatures (°C) ... relative to phenological stages", germination column. Verified this is genuinely a damage table (not an optimum/germination-rate table it happens to call "GERMINATION" as a growth stage, not a condition) — `thresholdType: "damage"` and `stage: "germination"` are both correct. |
| K.alfalfa, K.barley, K.bread-wheat, K.table-beet, K.tomato, K.watermelon | confirmed honest labeling | All carry `status/coverage: "training_based"`, `provenance.kind: "model_training"`, `documentAttribution: null`, and `moroccoOccurrence: null` on every crop-issue candidate — no field pretends to be sourced evidence. |

## Systemic issues

None found. Every sampled quote matches its source file verbatim (allowing
for stated OCR line-splits), every spot-checked SHA-256 matches the file on
disk, the damage-vs-optimum labeling rule was applied correctly in every
temperature record checked, tier/nonLocal classification was consistent with
the prompt's priority order, and the training-knowledge supplement is
honestly distinguished from sourced research in every sampled entry. The one
genuinely tricky case (two HCP yield tables, same crops, different
campaigns/pages) was handled correctly with distinct item ids.

## Records NOT safe to use in a catalog release as-is

None identified by this sample. This is a spot-check, not a full audit: the
remaining ~215 "partial"/"found" records this pass did not open are not yet
individually re-verified, and the explicit agronomic review this research
still needs (per `docs/steps/12/codex-crop-facts-prompt.md` and
`report.md`'s own caveats) has not happened — `catalogReady: false` on every
record remains correct until that review and an actual catalog-integration
pass occur.
