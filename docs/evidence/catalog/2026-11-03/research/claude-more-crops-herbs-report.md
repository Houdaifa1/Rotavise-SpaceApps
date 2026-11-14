# Aromatic, medicinal and spice crops (PAM) and other remaining crops

Research date 2026-11-06. Companion file: `claude-more-crops-herbs.json` (318 records: 53 found, 21 not_found, 244 training_based). Nothing here is catalog-ready (`catalogReady: false` everywhere). No code, catalog or git changes.

## Layer 1: web research

Moroccan technical sources for these crops are almost absent. Searches (coriander, nigella, fenugreek, caper, carob, damask rose, rosemary/thyme, PAM sector) returned French or Algerian seed and extension sheets, wild-harvest press, and Moroccan news. Several Moroccan news sites (Médias24, TelQuel) sit behind a Cloudflare challenge, so no file could be saved from them.

| Source | Tier | Used for | Status |
| --- | --- | --- | --- |
| Finances News Hebdo, 17 Jul 2023 (carob) | 4 (press) | carob yield 1-5 t/ha, harvest from year 6, lifespan >400 years, 50,000 t national | quotes machine-verified in saved HTML |
| Yabiladi / MAP (caper, Fès DPA study day) | 4 (press) | caper 20,000 t, main regions, lack of technical references | quotes machine-verified in saved HTML |
| FAO EcoCrop CSV (19 species) | 2, `nonLocal` | cold killing temperature (where listed), absolute maximum, growing-period range | 33 partial, low-confidence records |

EcoCrop caveat (also raised by the earlier Section A pass): its killing and maximum temperatures are species-level bounds with no stage and no daily-extreme definition. They are recorded with distinct `thresholdType` values (`species_killing_temperature_unstaged`, `species_absolute_maximum_not_damage_limit`) and must not be treated as damage limits.

Source conflict kept open: search snippets (not saved, not citable) gave carob area/production figures that disagree (INRA 11,160 ha harvestable and about 59,700 t; FAO 21,976 t for 2021; press 50,000 t). Only the 50,000 t press figure is recorded, with its source.

Not found (21 records): damask rose (Rosa damascena, Kelaat M'Gouna) for heat, cold, planting, yield, rotation and pests, because the pages that carry the ORMVA Ouarzazate figures were blocked; Moroccan sowing windows, yields and rotation for coriander, nigella, fenugreek, rosemary and thyme.

## Layer 2: training knowledge (unverified)

28 crops, 244 records, all `model_recall_unverified`. Fit flags tell which model each crop needs:

- **Rotation candidates (annual):** coriander, anise, caraway, nigella, fenugreek, sweet basil, chamomile, marjoram, cannabis, parsley, dill.
- **Perennial stands (alfalfa-like stand model):** rosemary, thyme, oregano, sage, lavender, lemon verbena, rose geranium, damask rose, caper, henna.
- **Orchard model:** bitter orange (orange blossom), carob, pistachio.
- **Wild-harvested, not plannable:** Cladanthus mixtus (wild chamomile), Artemisia herba-alba, Ammi visnaga, Cistus ladanifer. The PAM sector is mostly wild collection; a search snippet put the cultivated share near 2%.

Confidence is low throughout. Weakest: every heat and cold limit, all yield ranges, all planting months, perennial stand lifetimes. Disease and pest records are generic host associations with no symptoms, no Moroccan occurrence claim and no treatment. Variety entries are few on purpose: only names I recall with some confidence (Origanum compactum, Thymus satureioides, Kerman pistachio, Genovese basil, Beldia cannabis landrace, Capparis subspecies/species groups). Everything else is "local populations (unnamed)" or omitted.

Cannabis: only the regulatory fact is noted (Law 13-21 of 2021, licensed medical, cosmetic and industrial use, recalled and to be verified). No agronomic guidance beyond generic rotation logic.

## Not covered

Cotton, rice, quinoa and tree crops are in the earlier files. Remaining PAM species not listed here (for example wormwood, Marrubium, juniper cade, sandarac tree, geranium varieties) are not covered.

## Before any use

A Moroccan source or an agronomist must verify each value. The plannable set here is small: perennials and wild-harvest crops need the stand or orchard model, not the rotation engine.
