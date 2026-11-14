# Training-knowledge fill (Claude, 2026-11-06)

**None of these values may enter a catalog release or drive planner results until an agronomist or a real source verifies them.** They are recalled from model training, not read from a document. Every record is `status: training_based`, `valueKind: model_recall_unverified`, `catalogReady: false`, has no source, quote or hash, and is not a Moroccan field observation.

82 records in `claude-training-knowledge.json`: 66 items still not_found after web research, 13 items where the web pass found only an FAO Ecocrop field that is not a daily max/min damage limit, and 3 items Codex left partial (groundnut, maize and melon cold). Confidence: 8 high, 34 medium, 40 low.

Low-confidence clusters: all heat limits (thresholds vary with cultivar and humidity), lettuce, table-beet and garlic temperatures, wheat ear-frost timing, all three yield ranges (not Moroccan statistics), and the sesame and groundnut rotation rows. No treatments or products are recorded. Arabic names are null (not recalled reliably); Moroccan occurrence is null for every organism.

| Item | Value | Confidence |
|---|---|---|
| T.A.courgette.cold | 0 C, daily_minimum, whole_cycle | medium |
| T.A.eggplant.cold | 0 C, daily_minimum, whole_cycle | low |
| T.A.green-bean.cold | 0 C, daily_minimum, whole_cycle | medium |
| T.A.lentil.cold | -6 C, daily_minimum, vegetative_growth | low |
| T.A.lettuce.cold | -2 C, daily_minimum, whole_cycle | low |
| T.A.lettuce.heat | 30 C, daily_maximum, vegetative_growth | low |
| T.A.watermelon.cold | 0 C, daily_minimum, whole_cycle | medium |
| T.B.garlic.cold | -10 C, daily_minimum, vegetative_growth | low |
| T.B.garlic.heat | 35 C, daily_maximum, bulb_formation | low |
| T.A.groundnut.cold | 0 C, daily_minimum, whole_cycle | medium |
| T.A.maize.cold | -2 C, daily_minimum, vegetative_growth | medium |
| T.A.melon.cold | 0 C, daily_minimum, whole_cycle | medium |
| T.A.cabbage.heat | 30 C, daily_maximum, vegetative_growth | low |
| T.A.chickpea.cold | 5 C, daily_minimum, flowering | low |
| T.A.chickpea.heat | 35 C, daily_maximum, flowering | medium |
| T.A.courgette.heat | 35 C, daily_maximum, flowering | low |
| T.A.eggplant.heat | 35 C, daily_maximum, flowering | medium |
| T.A.green-bean.heat | 32 C, daily_maximum, flowering | medium |
| T.A.groundnut.heat | 38 C, daily_maximum, flowering | low |
| T.A.melon.heat | 38 C, daily_maximum, flowering | low |
| T.A.onion.heat | 35 C, daily_maximum, bulb_formation | low |
| T.A.rapeseed.heat | 30 C, daily_maximum, flowering | medium |
| T.A.table-beet.cold | -2 C, daily_minimum, whole_cycle | low |
| T.A.table-beet.heat | 32 C, daily_maximum, vegetative_growth | low |
| T.A.watermelon.heat | 38 C, daily_maximum, flowering | low |
| T.B.chickpea.duration.spring | 100-130 days | low |
| T.B.faba-bean.duration | 160-200 days | low |
| T.B.garlic.duration | 150-200 days | low |
| T.C.cabbage.minimum_return_interval | 4 years (Brassicaceae) | medium |
| T.C.cabbage.preferred_predecessor | Fabaceae | medium |
| T.C.cabbage.prohibited_predecessor | Brassicaceae | high |
| T.C.carrot.preferred_predecessor | Poaceae | low |
| T.C.chickpea.prohibited_predecessor | Fabaceae | medium |
| T.C.courgette.minimum_return_interval | 3 years (Cucurbitaceae) | medium |
| T.C.courgette.preferred_predecessor | Poaceae | low |
| T.C.courgette.prohibited_predecessor | Cucurbitaceae | high |
| T.C.eggplant.preferred_predecessor | Fabaceae | low |
| T.C.faba-bean.prohibited_predecessor | Fabaceae | medium |
| T.C.garlic.preferred_predecessor | Poaceae | low |
| T.C.garlic.prohibited_predecessor | Amaryllidaceae | high |
| T.C.green-bean.minimum_return_interval | 3 years (Fabaceae) | low |
| T.C.green-bean.prohibited_predecessor | Fabaceae | medium |
| T.C.groundnut.prohibited_predecessor | Fabaceae | low |
| T.C.lentil.minimum_return_interval | 3 years (Fabaceae) | medium |
| T.C.lentil.prohibited_predecessor | Fabaceae | medium |
| T.C.lettuce.minimum_return_interval | 2 years (Asteraceae) | low |
| T.C.lettuce.preferred_predecessor | Poaceae | low |
| T.C.lettuce.prohibited_predecessor | Asteraceae | medium |
| T.C.maize.minimum_return_interval | 2 years (Poaceae) | low |
| T.C.maize.prohibited_predecessor | Poaceae | low |
| T.C.melon.minimum_return_interval | 4 years (Cucurbitaceae) | medium |
| T.C.melon.preferred_predecessor | Poaceae | low |
| T.C.melon.prohibited_predecessor | Cucurbitaceae | high |
| T.C.pea.minimum_return_interval | 5 years (Fabaceae) | medium |
| T.C.pea.preferred_predecessor | Poaceae | medium |
| T.C.pea.prohibited_predecessor | Fabaceae | high |
| T.C.potato.preferred_predecessor | Poaceae | medium |
| T.C.potato.prohibited_predecessor | Solanaceae | high |
| T.C.sesame.minimum_return_interval | 3 years (Pedaliaceae) | low |
| T.C.sesame.prohibited_predecessor | Pedaliaceae | low |
| T.C.sugar-beet.minimum_return_interval | 4 years (Amaranthaceae) | medium |
| T.C.sugar-beet.preferred_predecessor | Poaceae | medium |
| T.C.table-beet.minimum_return_interval | 3 years (Amaranthaceae) | low |
| T.C.table-beet.preferred_predecessor | Poaceae | low |
| T.C.table-beet.prohibited_predecessor | Amaranthaceae | high |
| T.C.watermelon.minimum_return_interval | 5 years (Cucurbitaceae) | medium |
| T.C.watermelon.preferred_predecessor | Poaceae | low |
| T.C.watermelon.prohibited_predecessor | Cucurbitaceae | high |
| T.D.durum-wheat.ear_frost_timing | ear 1 cm at about day 100-130 | low |
| T.D.bread-wheat.ear_frost_timing | ear 1 cm at about day 100-130 | low |
| T.D.sugar-beet.cercosporiosis_return | 3 years (Amaranthaceae) | low |
| T.F.cabbage.observed_yield | 25-40 t/ha irrigated | low |
| T.F.lettuce.observed_yield | 20-30 t/ha irrigated | low |
| T.F.table-beet.observed_yield | 25-35 t/ha irrigated | low |
| T.G.eggplant.diseases | Verticillium dahliae; Leveillula taurica; Botrytis cinerea | medium |
| T.G.green-bean.pests | Tetranychus urticae; Aphis fabae; Helicoverpa armigera | medium |
| T.G.maize.diseases | Exserohilum turcicum; Ustilago maydis; Puccinia sorghi | medium |
| T.G.sesame.diseases | Fusarium oxysporum f. sp. sesami; Macrophomina phaseolina; Cercospora sesami | medium |
| T.G.sesame.pests | Antigastra catalaunalis; Bemisia tabaci; Aphis gossypii | medium |
| T.G.sunflower.pests | Orobanche cumana; Homoeosoma nebulella; Helicoverpa armigera; Aphis fabae | medium |
| T.G.table-beet.diseases | Cercospora beticola; Peronospora farinosa f. sp. betae; Beet yellows virus (aphid-borne) | medium |
| T.G.table-beet.pests | Aphis fabae; Pegomya hyoscyami; Scrobipalpa ocellatella | medium |
