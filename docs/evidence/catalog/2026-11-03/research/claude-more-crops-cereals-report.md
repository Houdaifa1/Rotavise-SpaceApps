# More crops: cereals, forage, pulses and industrial field crops

Written 2026-11-06. Two layers. **Sourced** records (41) carry a saved file, hash and a re-found quote or a copied Ecocrop row. **Training-recall** records (260) are `training_based`, `model_recall_unverified`, `catalogReady: false`.

Crops covered (19): oat, triticale, rye, sorghum, pearl-millet, common-vetch, bitter-vetch, white-lupin, berseem, fenugreek, dry-bean, cowpea, grass-pea, safflower, flax, sugarcane, tobacco, hemp, italian-ryegrass.

## Sourced layer

| Item | Crop | Value | Source | Tier | Confidence |
|---|---|---|---|---|---|
| B.safflower.cycle_days.ecocrop | safflower | {"basis": "growing_cycle_days_unspecified", "minDays": 120.0, "maxDays": 245.0} | ECOCROP database (bulk export), FAO ECOCROP | 2 | low |
| F.sugarcane.observed_yield | sugarcane | {"yield_t_per_ha": 72, "unit": "tonnes of cane per hectare", "season": "2025/2026", "farmingSystem": "irrigate | Cosumar sugar-crop campaign statement (Finances News He | 4 | medium |
| B.safflower.planting_window | safflower | {"start": "04-01", "end": "04-07", "precision": "approximate", "seedRate_kg_per_ha": 15, "irrigation": "monthl | Mise en culture du carthame dans la région de Tafilalet | 3 | low |
| F.safflower.observed_yield | safflower | {"yield_q_per_ha": {"Goulmima": 23.6, "Tinjdad": 21, "Jorf": 17}, "yield_t_per_ha": {"Goulmima": 2.36, "Tinjda | Mise en culture du carthame dans la région de Tafilalet | 3 | medium |
| F.hemp.observed_yield | hemp | {"average_q_per_ha": 20, "local_variety_q_per_ha": 17, "imported_varieties_q_per_ha": 28, "year": 2024, "yield | Morocco's legal cannabis production soars to 4,082 tons | 4 | medium |

FAO Ecocrop rows (tier 2, partial, low): 36 records for 18 crops (temperature bounds and cycle days). They are species-wide bounds, not daily damage limits or Moroccan data. Triticale has no Ecocrop row (`not_found`).

## Training-recall layer

260 records: per crop heat, cold, planting window, cycle, family, preferred and prohibited predecessor, return interval, yield range, 2-6 diseases/pests (no treatments, Moroccan occurrence null) and varieties/types. Confidence: high 19, medium 71, low 170.

## Weak spots

- Every heat, cold, window, cycle, rotation and yield figure outside the four sourced facts is recall, mostly low confidence.
- Moroccan sources were thin or blocked for every crop in this group; no Moroccan stage-timed damage limit was found for any of them.
- Sugarcane yield is a company figure for one flood-affected season; hemp yield is an agency figure with the product unspecified.
- Variety names are mostly omitted on purpose; none are sourced.
- Tree and orchard crops are out of scope for this file.

## Leads not recorded as facts

- Berseem Tadla: search summary cites 38-60 t green matter/ha (ORMVAT 2015); the core.ac.uk PDF was bot-blocked, so not recorded as a fact.
- Tobacco El Hajeb 1.5-3 t/ha and 0.75 ha average farm (Medias24/SMT); page blocked, not recorded as a fact.
- Cereal/triticale INRA 2022 demonstration (two triticale varieties unnamed): news summary only.
- Moroccan lupin collections 1998-99 and CIHEAM Options Mediterraneennes forage-selection review (oat, vetch cultivars): pages not opened.
- Safflower varieties Cartafri, Cartamar, Rancho, Sharda at Oujda (Ben Moumen et al.): summary only; oil-quality paper.
- Fenugreek: only an Algerian Sahara trial found (6.9 q/ha, ~100 days); no Moroccan source.
- Sorghum: only a Tetouan study of traditional north-west cultivation found; no agronomic figures read.

Nothing here is for a catalog release. Review and agronomist sign-off come first.
