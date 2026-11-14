# New Moroccan crops beyond the current catalog — candidate list and first pass

Research done 2026-11-06. The catalog (`data/catalog/releases/0.9.0/profiles/`)
currently has 33 crops: alfalfa, apricot, barley, bread-wheat, cabbage,
carrot, chickpea, citrus, courgette, durum-wheat, eggplant, faba-bean, fig,
green-bean, groundnut, lentil, lettuce, maize, melon, olive, onion, pea,
peach, pepper, pomegranate, potato, rapeseed, sesame, sugar-beet, sunflower,
table-beet, tomato, watermelon. This note researches genuinely new crops not
on that list. It is research only — no catalog or code change — and should
be read with `docs/evidence/catalog/2026-11-03/research/report.md` (Codex's
parallel pass on the existing 33).

## Prioritized candidate list, with rotation-planner fit

The engine plans **annual or short-cycle rotations**; it already treats a
separate "orchard" category for long-lived trees (apricot, citrus, fig,
olive, peach, pomegranate). That split matters for fit:

| Crop | Significance (brief, see sources below) | Fit for THIS planner | Priority |
| --- | --- | --- | --- |
| Strawberry (Fragaria × ananassa) | Major Gharb/Loukkos export crop, tens of thousands of tonnes historically, though exports have fallen for four seasons in a row | Good — grown as an annual/short-stand bedding crop, fits the existing crop schema directly | 1 (researched below) |
| Saffron (Crocus sativus) | Culturally and economically significant, concentrated in Taliouine/Taznakht (Souss-Massa, 57%) and Drâa-Tafilalet (43%); roughly 1,600–1,900 ha, 6–7 t/year in normal years | Medium — a perennial corm harvested yearly for several years before replanting, closer to alfalfa's "stand_lifetime" shape than to an annual crop | 2 (identified, not yet researched) |
| Red/soft fruit — raspberry, blueberry | Fast-growing recent investment in Loukkos, now reportedly overtaking strawberry in new planting | Medium — perennial canes/bushes, semi-annual management; would need its own cycle shape, not plain annual rotation | 3 |
| Mint (nana/spearmint) and other PAM (plantes aromatiques et médicinales, e.g. verbena, rosemary, thyme) | Significant aromatic/export sector, grown across several regions | Medium — perennial but cut several times a year and replanted periodically; needs a distinct model | 4 |
| Cumin | Moderate, grown as an annual in semi-arid cereal zones (e.g. Settat, Sidi Bennour) | Good — annual, rotates with cereals/legumes like the crops already in the catalog | 4 |
| Grapevine (table grapes) | Established export/local crop | Poor as a rotation crop — perennial vine; orchard-type fit only | 5 |
| Almond | Large recent planting push (part of the same orchard expansion drive as olive) | Poor as a rotation crop — orchard-type fit only, same shape as the existing tree crops | 5 |
| Walnut | Minor, regional (Azrou/Middle Atlas) | Poor as a rotation crop — orchard-type fit only | 6 |
| Avocado, banana (Souss, often under plastic) | Significant and growing export value | Poor as a rotation crop — orchard-type fit (avocado) or ratoon/perennial (banana) | 6 |
| Date palm | Major (103,000–160,000 t/year depending on season), Tafilalet/Drâa oases | Poor fit — multi-decade perennial tree, does not rotate; would need the orchard model, not this planner's rotation logic, and arguably sits outside a rotation planner's scope entirely | 6 |
| Prickly pear / cactus pear (nopal) | Was significant fodder/fruit crop in Essaouira/Safi before the cochineal (*Dactylopius opuntiae*) outbreak devastated plantations from 2014 | Poor fit — long-lived perennial, and the main current "crop fact" is a pest crisis, not a rotation question | 7 |
| Rice (Gharb irrigated paddy) | Historically grown in the Gharb; current production is understood to be marginal/declining, not confirmed by an official figure in this pass | Good fit if still grown at meaningful scale, but significance needs verification before spending research time | 7, needs a significance check first |
| Cotton (historically Gharb/Loukkos) | Understood to be effectively abandoned in Morocco since the 1990s | Fit would be good (annual), but current significance is likely too low to justify the work — needs a quick verification search before any real research | 8, needs a significance check first |
| Quinoa | Agronomic trial crop (INRA trials since roughly 2015), minimal current commercial area | Good fit (annual, short cycle) but low current economic significance | 8 |

**Note on fit:** several of the highest-production-value items (date palm,
grapevine, almond, walnut, avocado) are trees best handled the same way the
catalog already handles apricot/citrus/fig/olive/peach/pomegranate — as
orchards, not as rotation crops. Adding them as new *rotation* crops would be
a schema mismatch; if the user wants them in the product at all, they belong
with the existing orchard-tree crops, not this research track.

## What was actually researched (Step 2), and to the standard the research
prompt requires (exact quote, real cited/saved source, no invented values)

Only **strawberry** was researched to completion in the time available for
this pass, and even then only two of its ~10 required facts met the
quote-and-source standard:

| Item | Status | Value | Source | Tier | Confidence |
| --- | --- | --- | --- | --- | --- |
| A.strawberry.cold | found | -1°C daily minimum, flowering ("full bloom"), 30 min / 90% kill | Manitoba Agriculture extension page (nonLocal) | 4 | medium |
| A.strawberry.heat | not_found | — | FAO Ecocrop gave an unlabelled, unit-less "absolute max 28" with blank killing-temperature fields — did not meet the standard | — | — |
| B.strawberry.planting_window | not_found | — | FAO Ecocrop gave an unlabelled "crop cycle 180–270" with no unit and no calendar dates | — | — |
| B.strawberry.cycle_duration | not_found | — | same as above | — | — |
| C, F, G for strawberry | not researched | — | not reached in this pass | — | — |

Full detail and the exact quotes/translations are in
`docs/evidence/catalog/2026-11-03/research/claude-new-crops.json`. The saved
source file is at `.research-sources/2026-11-06/mb-strawberry-frost.html`
with its SHA-256 recorded in that JSON entry.

**Important caveat on the one found fact:** it comes from a Canadian
(Manitoba) extension page, not a Moroccan or FAO/Mediterranean source —
it is marked `nonLocal: true`, tier 4 (last resort), per the research rules.
No Moroccan-specific strawberry frost threshold was found in this pass. It
should not be treated as more authoritative than that.

## Not yet researched after pass 1 (superseded in part by "Second pass" at the end of this file)

This pass only completed Step 1 (the candidate list above) and made a start
on strawberry. None of the following were researched at all in this pass:

- The rest of strawberry's required facts (heat limit from a real source,
  Moroccan planting window and cycle duration from INRA/ORMVA du Gharb or du
  Loukkos/ONCA, rotation facts, observed Moroccan yields, diseases/pests).
- Saffron, raspberry/blueberry, mint/PAM, cumin — identified as good
  candidates but not researched at all.
- Grapevine, almond, walnut, avocado/banana, date palm, prickly pear —
  identified as orchard-type/poor rotation fit; not researched, and a
  decision on whether to research them at all (given they'd need the
  orchard model, not the rotation one) should come before spending time on
  them.
- Rice and cotton — current Moroccan production significance was not
  verified; check that first before researching either.
- Quinoa — identified, not researched, low priority given minimal
  current commercial area.

No files outside `docs/evidence/catalog/2026-11-03/research/` and
`.research-sources/2026-11-06/` were touched; no code, catalog, git or
package-manager command was run.

---

# Second pass (2026-11-06): strawberry, cumin, saffron, mint, raspberry/blueberry

Records are in `claude-new-crops.json` (56 records in all: the 3 from pass 1,
untouched, plus 53 new; 37 of the new are `found`, nearly all with
`coverage: "partial"`, and 16 are `not_found`). Every quote was machine-checked
against its saved source text before the file was written. Sources are saved in
`.research-sources/2026-11-06/` (not committed) with SHA-256 in each record.
No record is `catalogReady`. No treatment, product or dose was recorded.
Items that replace a pass-1 `not_found` carry a `.pass2` suffix and a
`supersedes` field; the pass-1 entries were left in place.

## Strawberry

| Item | Status | Value | Source | Tier | Confidence |
| --- | --- | --- | --- | --- | --- |
| A.strawberry.cold | found (pass 1) | -1 C, full bloom, 30 min | Manitoba Agriculture | 4, nonLocal | medium |
| A.strawberry.heat (+ .pass2) | not found | none usable; ECOCROP TMAX 28 recorded as low-confidence partial | FAO ECOCROP | 2 | low |
| B.strawberry.planting_window.pass2 | partial | from 15 Sep to "early October" (no end day) | le360 2019 citing INRA | 4 | low |
| B.strawberry.planting_window.conflict_iav_blog | partial | 10 Nov-15 Dec fresh plants; 1 Jul-15 Aug cold-stored plants | student blog | 4 | low |
| B.strawberry.cycle_duration.pass2 | partial | soil work August, production ends July; no day count | le360 2019 | 4 | low |
| C.strawberry.rotation | not found | - | - | - | - |
| F.strawberry.observed_yield | not found | 2010: 3,035 ha, 140,600 t stated, no t/ha; not divided | Mouden 2013 | - | - |
| G.strawberry.disease.grey_mould | partial | Botrytis cinerea; fruit browns then covers with whitish-grey then grey growth | Mouden et al. 2013, J. Appl. Biosci. | 3 | medium |
| G.strawberry.disease.powdery_mildew | partial | Sphaerotheca macularis; no symptom text in source | Mouden et al. 2013 | 3 | medium |
| G.strawberry.pest.mites_noctuids_aphids | partial | list of pest groups only | Mouden et al. 2013 | 3 | low |

**Conflict (not resolved):** planting dates in le360/INRA (mid-September to
early October) and in the student blog (mid-November to mid-December for fresh
plants, July-August for cold-stored plants) differ. They may refer to different
plant types; an agronomist or the INRA original must decide.

## Cumin

Main source: Homrani Bakali et al. 2024, Al Awamia 145: 197-210 (INRA Maroc and
ORMVA Tafilalet authors; survey of 69 farmers). Tier 3 (arguably tier 1).

| Item | Status | Value | Confidence |
| --- | --- | --- | --- |
| A.cumin.cold | partial | damage to flowers and seeds below 2 C; basis, duration not stated | medium |
| A.cumin.heat | not found | only an optimum (9-26 C); ECOCROP TMAX 30 recorded low-confidence | low |
| B.cumin.planting_window | partial | late Oct to early Feb nationally; Marrakech-Safi mostly January; colder oases late Jan-Feb | medium |
| B.cumin.cycle_duration (3 records) | partial | arid oases 140-180 d; mountains 115-140 d; Marrakech-Safi 103 +/- 14.2 d; national 134 +/- 27.2 d | medium |
| C.cumin.minimum_return_interval | partial | 3 years in wilt-affected fields (Lal et al. 2014, India, as cited) | medium |
| C.cumin.preferred_predecessor / prohibited_predecessor | not found | common farmer systems listed (with onion, fallow, alfalfa, henna, cereals, watermelon) but no stated preference | - |
| F.cumin.observed_yield | partial | mean 0.37 t/ha (0.05-1.15); rain-fed 0.30, irrigated 0.41; farmer-reported | medium |
| G.cumin.disease.fusarium_wilt | partial | F. oxysporum f. sp. cumini; most frequent disease; wilting and damping-off | medium |
| G.cumin.pest.aphids | partial | most frequent insect pests (oases) | medium |
| G.cumin.weed.spergularia | partial | Spergularia diandra in oases | medium |

## Saffron

Main sources: Mzabri et al. 2021 (Oujda), Bentata et al. 2017 (Taliouine and
Taznakht, abstract), Ourras et al. (Taliouine chapter).

| Item | Status | Value | Confidence |
| --- | --- | --- | --- |
| B.saffron.flowering_period | partial | flowers October-November (eastern Morocco); trial planted 28 Aug 2018 | medium |
| B.saffron.planting_window | not found | no recommended window retrieved | - |
| B.saffron.stand_lifetime | partial | yields can decline "even after 6 years"; no lifetime stated | low |
| A.saffron.heat.ecocrop | partial | ECOCROP TMAX 23 | low |
| A.saffron.cold | not found | ECOCROP has no killing temperature | - |
| C.saffron.rotation | not found | corm perennial; may not fit rotation logic | - |
| F.saffron.observed_yield | not found | 3 t on 600 ha (2009), 6.8 t on about 1,800 ha (2018) stated; not divided | - |
| G.saffron.disease.corm_root_rot | partial | Rhizoctonia violacea and Fusarium oxysporum; corm necrosis, plant death | medium |

## Mint (nana / spearmint)

Only two press articles (tier 4) were usable. No Moroccan agronomic sheet was found.

| Item | Status | Value | Confidence |
| --- | --- | --- | --- |
| B.mint.cuts_per_year | partial | up to 6 cuts/year (FNH 2021); 5 scheduled (La Vie éco 2015) | low |
| F.mint.observed_yield | partial | about 22-22.5 t/ha/year; Settat 40-120 t derived from bunch counts (conflict shown); national 70,000 t on 4,500 ha | low |
| A.mint.cold_heat, C.mint.rotation, G.mint.diseases_pests | not found | ECOCROP has no Mentha spicata row | - |

## Blueberry and raspberry

Main source: Nouere, Amiri, Lahlali 2020, RMSAV 8(3): 307-316 (Moroccan review
of blueberry pests and diseases; compiles non-Moroccan literature).

| Item | Status | Value | Confidence |
| --- | --- | --- | --- |
| A.blueberry.cold | partial | dormancy tolerance -14 to -26 C (Southern Highbush, Rabbiteye); no single value | low |
| A.blueberry.heat | partial | above 30 C fruit wrinkles and burns | low |
| F.blueberry.observed_yield | found | 12 t/ha national average, 2017-2018 | medium |
| B/C blueberry | not found | no planting window, lifetime or rotation fact | - |
| G.blueberry: grey mould, anthracnose, Phytophthora root rot, D. suzukii, thrips | partial | symptoms quoted; Moroccan occurrence general or inferred | low to medium |
| A.raspberry (ECOCROP heat, cold), A.blueberry.heat.ecocrop | partial | low confidence adaptability bounds | low |
| B/C/F raspberry | not found | no opened Moroccan source | - |
| G.raspberry.pest.drosophila_suzukii | partial | EPPO: present, first observed 2013 on raspberries | medium |
| G.berry-crops.diseases.survey | partial | grey mould, root rot, powdery mildew in Gharb/Loukkos berries (2025 survey abstract) | low |

## What remains

- **Strawberry:** Moroccan heat limit, rotation, yield (the Maatala et al. 2020
  paper, RMSAV 8(3): 339-346, was the likely source and was blocked), and the INRA original
  for the planting dates.
- **Saffron:** a recommended planting window and stand lifetime (an INRA
  Taliouine paper, core.ac.uk 230581481, returned 403 and was not opened), a
  published kg/ha yield, cold limits.
- **Mint:** any agronomic sheet (INRA Meknès, ENA Meknès); the 2024 survey of
  264 growers (Agricultural Research) was not opened.
- **Raspberry:** everything except the pest record.
- **Not started:** cotton, rice, quinoa, prickly pear, and the tree crops (date
  palm, grapevine, almond, walnut, avocado, banana), which fit an orchard
  model better than rotation planning. Several sources were refused with
  HTTP 403 or a bot check (core.ac.uk, doaj.org, freshplaza.com, medias24.com);
  none was bypassed.
