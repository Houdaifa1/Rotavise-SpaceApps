# Fruit and nut trees: second research pass (Claude, 2026-11-06)

Research only. Nothing here enters a catalog release. File: `claude-more-crops-trees.json` (348 records).

## Scope

Orchard and perennial fruit crops not in catalog 0.9.0 or earlier passes: apple, pear, plum, cherry, quince, loquat, kiwi, mango, papaya, pistachio, hazelnut, pecan, carob, jujube, persimmon, guava, passion fruit, lychee, pineapple, white and black mulberry, plus caper, cherimoya and pitahaya (added because they are plausible Moroccan crops). Walnut also gets one sourced yield record. Trees are modelled as orchards (stand lifetime, chill requirement, bloom frost, replant caution), not as rotation crops.

## Layer 1: sourced (32 found, 9 not found)

Four press pages saved with SHA-256 in `.research-sources/2026-11-06/` (all tier 4: press relaying ministry or professional figures; no primary MAPMDREF, INRA or ONCA page was reached). Every quote was machine-checked against the saved page text. Ecocrop rows come from the file saved by the earlier pass.

| Item | Value | Publisher | Confidence |
| --- | --- | --- | --- |
| F.apple.national_yield_fnh | {"unit": "t/ha", "meanYieldTPerHa": 16, "areaHa": 50590, "productionT": 697000, "farmingSy | Finances News Hebdo | medium |
| F.apple.campaign_2017_2018 | {"unit": "t/ha", "meanYieldTPerHa": 16, "productionT": 697000, "campaign": "2017-2018", "r | Le360 | medium |
| B.cherry.chilling_requirement | {"hoursBelow": 7.2, "unit": "chill hours below 7.2 C", "minHours": 1500, "qualifier": "mos | La Vie Éco | medium |
| F.cherry.area_production | {"areaHa": 1700, "productionT": 8000, "unit": "production in tonnes per year, area in ha", | La Vie Éco | medium |
| F.cherry.production_t | {"productionT": 8000, "unit": "t per year", "region": "national, Morocco", "year": 2014} | La Vie Éco | medium |
| B.cherry.harvest_window | {"start": "05-15", "end": "07-20", "precision": "exact_day", "basis": "national harvest se | La Vie Éco | medium |
| F.walnut.yield_fruits_secs | {"meanYieldTPerHa": 0.6, "unit": "t/ha in-shell walnuts", "areaHa": 6923, "productionT": 1 | Le360 | medium |
| F.pistachio_pecan.presence_note | {"note": "Pistachio and pecan are named as nut crops introduced in Morocco in recent years | Le360 | medium |

Plus 24 FAO Ecocrop temperature records (tier 2, low confidence, species-level bounds, not daily damage limits, not Moroccan).

Not found: F.kiwi.observed_yield, F.mango.observed_yield, F.papaya.observed_yield, F.pistachio.observed_yield, F.pecan.observed_yield, F.hazelnut.observed_yield, F.carob.observed_yield, A.cherry.local_beldi_chill, F.apple.rainfed_vs_irrigated. Search logs are in the JSON.

## Conflicts and leads (not recorded as facts)

- Apple area: 50,590 ha (FNH) against a snippet citing about 30,662 ha in an older source and about 52,000 ha (FAOSTAT 2022, 923,000 t, 18 t/ha). Year and counting method differ.
- Cherry chill: La Vie Éco says most commercial cultivars need more than 1,500 h below 7.2 C; a snippet attributed 500 to 1,200 h to CTIFL/Réussir for cherry in general. Pages not saved.
- Carob: INRA reference of about 59,700 t on 11,160 harvestable ha (about 18,160 ha with young plantings) seen only in a search snippet; other snippets give over 30,000 ha and 68,000 ha (forest domain). Médias24 page was blocked.
- Leads to open in a follow-up: Oukabli and Laghezali (INRA Meknès) sweet cherry evaluation; ressources.ciheam.org carob paper; Cahiers Agricultures 2024 apple paper; cahiers FAO pistachio document.
- Blocked pages: medias24.com (caroubier), freshplaza.com (pistachio).

## Layer 2: training knowledge (307 records, all `model_recall_unverified`, `catalogReady: false`)

Confidence: {'medium': 53, 'low': 254}. Per crop: stand lifetime, chill requirement (null for tropical crops), bloom-frost and dormant-cold temperatures, heat limit, family and replant caution, mature yield range (not Moroccan statistics), Moroccan status, 2 to 4 diseases or pests with scientific names and visible symptoms (no treatments, Moroccan occurrence null), and varieties.

Low-confidence clusters: all temperature limits; all yield ranges; Moroccan status of mango, papaya, kiwi, lychee, pineapple, guava, passion fruit, cherimoya, pitahaya, loquat, persimmon and jujube (extent unverified); every variety list. Crops with no variety recalled with confidence (quince, jujube, guava, caper, cherimoya, pitahaya) carry an explicit empty record. Carob's two variety names come from a search snippet, source not saved.

None of this may enter a catalog or drive planner results until a source or an agronomist verifies it.
