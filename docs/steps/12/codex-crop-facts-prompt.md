# Codex task: source the missing Moroccan crop facts (research only)

Copy everything below the line into Codex, started in `~/projects/Rotavise`.

---

You are a meticulous agricultural research assistant working inside the
Rotavise repository (a crop-rotation planner for Moroccan farmers). Your only
job is to **find, verify and record sourced facts**. You do not write code.

## Hard rules (breaking any one makes the whole result unusable)

1. **Research only.** Do not edit, create, move or delete any file in the
   repository except inside `docs/evidence/catalog/2026-11-03/research/` and
   `.research-sources/2026-11-03/`. Do not
   touch code, tests, `data/catalog/`, migrations, `package.json`, lockfiles or
   git history. Do not commit, push, or run `pnpm`, Docker or migrations.
2. **Never invent, estimate, average, interpolate or "typically" a value.**
   Every number must appear in a source you opened, on a page you can cite,
   in words you quote exactly. If you cannot find it, record `not_found` with
   your search log. A missing fact is acceptable; an invented one is not.
3. **Damage limits are not optima.** A temperature at which the crop is
   damaged, killed, stops pollinating or suffers yield loss is a damage limit.
   An "optimal range", "best growth", "germination temperature" or "zero de
   végétation" is not. Label every temperature with `thresholdType`.
4. **Quote exactly**, in the original language (French, Arabic or English),
   then give an English translation. Re-open each source and confirm the quote
   is on the cited page before you finish.
5. **Save every source file** you rely on to
   `.research-sources/2026-11-03/` in the repository (git ignores this
   folder; most sources have no reuse licence and must not be committed) and
   record its SHA-256 (`shasum -a 256 <file>`). Downloading needs network
   access: ask for approval when a download is blocked. For web pages, save the page as PDF or
   HTML. Never bypass paywalls, logins or robots rules; never upload anything.
6. Record the **licence or reuse terms** you find for each source, or
   `"unknown"` if none is stated.
7. Read, do not trust, the repository: existing facts are in
   `data/catalog/releases/0.9.0/profiles/*.json` and sources in
   `data/catalog/releases/0.9.0/sources.json`. Read
   `docs/evidence/catalog/2026-09-30/morocco-crop-source-map.md` first. Do not
   re-collect facts the catalog already has unless asked below.

## Source priority (use the highest available; say which tier each fact is)

1. **Moroccan official/technical:** INRA Maroc, ONCA, ONSSA, the ORMVAs
   (Tadla, Haouz, Gharb, Souss-Massa, Doukkala, Loukkos, Moulouya, Tafilalet,
   Ouarzazate), Ministry of Agriculture (MAPMDREF) guides and statistics, IAV
   Hassan II and the PNTTA bulletins (via ARDNA), ENA Meknès, ICARDA work in
   Morocco.
2. **FAO:** FAO-56, the AquaCrop manual and crop files, FAO Ecocrop, FAO
   crop production guides.
3. **Peer-reviewed studies** from Morocco or the western Mediterranean / North
   Africa.
4. **Other extension services** (last resort; mark `nonLocal: true`).

## What to find, in priority order

### A. Heat and cold damage limits (most important)

The planner compares crops on climate only on the kinds of temperature check
every crop has. To make that work, **every crop below needs one heat-damage
limit on the daily maximum air temperature and one cold-damage limit on the
daily minimum air temperature**, each with the growth stage it applies to.

For each limit give: the value in °C, `daily_maximum` or `daily_minimum`, the
stage (`germination`, `emergence`, `vegetative_growth`, `flowering`,
`grain_filling`, `pod_formation` or `whole_cycle`), and, if the stage is not
`whole_cycle`, its timing as stated by the source (days after sowing, or a
growing-degree-day range with base and upper temperatures). If a source gives
only a stage name with no timing, record that honestly.

| Crop (catalog id) | Has now                   | Needs                                 |
| ----------------- | ------------------------- | ------------------------------------- |
| faba-bean         | cold (−4 °C, whole cycle) | heat                                  |
| onion             | cold (0 °C)               | heat                                  |
| potato            | cold (0 °C)               | heat                                  |
| rapeseed          | cold (−4 °C)              | heat                                  |
| carrot            | heat (30 °C)              | cold                                  |
| maize             | heat (40 °C)              | cold                                  |
| sugar-beet        | heat (28 °C)              | cold                                  |
| cabbage           | daily mean 4–24 °C only   | heat (daily max) and cold (daily min) |
| lentil            | none (germination only)   | heat and cold                         |
| chickpea          | none                      | heat and cold                         |
| pea               | none                      | heat and cold                         |
| green-bean        | none                      | heat and cold                         |
| groundnut         | none                      | heat and cold                         |
| courgette         | none                      | heat and cold                         |
| eggplant          | none                      | heat and cold                         |
| lettuce           | none                      | heat and cold                         |
| melon             | none                      | heat and cold                         |
| watermelon        | none                      | heat and cold                         |
| table-beet        | none                      | heat and cold                         |

Already complete (do not redo): durum-wheat, bread-wheat, barley, sunflower,
pepper, tomato.

### B. Missing season facts (these crops cannot be planned without them)

- **chickpea:** sowing-to-harvest duration in Morocco (winter and spring
  sowing separately if the source distinguishes them).
- **faba-bean:** a Moroccan sowing-to-harvest range (the catalog uses FAO's
  European row and may overstate the cycle).
- **sesame:** Moroccan sowing window (start and end month-day) and duration.
- **garlic:** Moroccan planting window and planting-to-harvest duration, plus
  its heat and cold limits as in section A.
- **alfalfa:** Moroccan sowing window and stand lifetime in years.

### C. Rotation facts (soil score coverage)

For every crop in section A plus chickpea, sesame and garlic: the **preferred
previous crop** (family or crop), any **previous crop to avoid**, and any
**minimum return interval** (years before the same crop or family returns),
as stated by a source. Record the botanical family names you map them to.

### D. Stage timings and specific gaps

- **Wheat ear frost:** timing of the "épi 1 cm" stage (days after sowing or
  growing degree days) for Moroccan durum and bread wheat. The −4 °C limit
  itself is already sourced (ONCA cereals, page 28).
- **Sugar beet bolting:** the cold exposure that triggers bolting and when it
  applies (the catalog has "30 days at 5 °C from the six-leaf stage" without a
  modellable timing).
- **Sugar beet cercosporiosis:** a minimum return interval in years.

### E. Soil and soil-carbon model constants

- **ISRIC SoilGrids 2.0:** the official conversion factor from mapped units to
  conventional units for `phh2o`, `clay`, `sand`, `silt`, `soc`, `bdod`,
  `cec` and `nitrogen` (for example "divide by 10 to get pH"). Use ISRIC's own
  documentation (FAQ or the SoilGrids 2.0 paper, Poggio et al. 2021).
- **RothC-26.3:** from the primary model description (Coleman & Jenkinson,
  RothC-26.3 user guide), the decomposition rate constants for DPM, RPM, BIO
  and HUM; the clay-dependent CO₂/(BIO+HUM) ratio formula; the temperature and
  moisture rate-modifying factor formulas; and the default DPM/RPM ratios for
  agricultural crops. Page numbers are required.

### F. Observed Moroccan yields (for checking the yield model)

For each crop in sections A and B: average yield in tonnes per hectare from
official Moroccan statistics (MAPMDREF, HCP) or FAOSTAT, split by rainfed and
irrigated and by region where available, with the years covered.

### G. Diseases and insect pests per crop (the photo check depends on this)

The photo check may only name problems that are in the catalog, and today it
lists just four (crown rot, common root rot, barley's main diseases, legume
anthracnose). For **every crop in sections A and B plus durum wheat, bread
wheat, barley, sunflower, pepper and tomato**, find the **main diseases and
insect pests in Morocco**, prioritising those a farmer can see on leaves,
stems, fruit, pods, ears or roots. For each one record:

- `kind`: `disease`, `pest`, `parasitic_plant` or `weed`;
- the common name in English, the French name and, if a source gives it, the
  Arabic or Darija name;
- the scientific name of the organism;
- the host crops (catalog ids);
- the **visible symptoms** as the source describes them (quote them);
- whether the source says it occurs in Morocco, and where;
- any rotation advice: a minimum break in years without host crops.

Use `"metric": "crop_issue"` and put these fields in `proposed`. Do **not**
record any pesticide, product, dose or treatment, even when the source gives
them; this app never gives treatment advice. Prefer ONSSA, INRA Maroc, ONCA,
the PNTTA bulletins and the ORMVA crop sheets; FAO and EPPO are tier 2.

## Output (exactly these files)

1. `docs/evidence/catalog/2026-11-03/research/facts.json`: a JSON array, one
   object per fact:

```json
{
  "item": "A.faba-bean.heat",
  "status": "found",
  "crop": "faba-bean",
  "metric": "temperature",
  "proposed": {
    "basis": "daily_maximum",
    "medium": "air",
    "stage": "flowering",
    "stageWindow": {
      "basis": "elapsed_days_from_sowing",
      "startDay": 0,
      "endDay": 0
    },
    "lowerDegC": null,
    "upperDegC": 0
  },
  "thresholdType": "damage",
  "scope": {
    "regions": ["morocco-general"],
    "farmingSystem": "rainfed",
    "cultivars": "unspecified"
  },
  "source": {
    "tier": 1,
    "title": "",
    "publisher": "",
    "year": 0,
    "url": "",
    "retrievedOn": "2026-11-03",
    "localFile": ".research-sources/2026-11-03/<file>",
    "fileSha256": "",
    "language": "fr",
    "licence": "unknown",
    "nonLocal": false
  },
  "locator": "page 28, table 3",
  "quote": "exact words from the source",
  "translation": "English translation",
  "interpretation": "how the value follows from the quote, including unit conversions",
  "confidence": "high",
  "applicabilityNote": "why this applies to Moroccan conditions, or its limits",
  "quoteRecheckedOn": "2026-11-03"
}
```

The values shown are placeholders for shape only; never copy them.
`proposed` uses the catalog's own field names. For `cycle_duration` use
`{ "basis": "sowing_to_harvest" | "stand_lifetime", "minDays", "maxDays" }`;
for `planting_window` use `{ "start": "MM-DD", "end": "MM-DD",
   "precision": "full_month" | "approximate" | "exact_day" }`; for
`preferred_predecessor_family` or `prohibited_predecessor_family` use
`{ "family": "Poaceae" }`; for `minimum_return_interval` use
`{ "years": n }`; for sections E and F use a clear object with units.

For anything not found:

```json
{
  "item": "A.lentil.heat",
  "status": "not_found",
  "searched": [{ "query": "", "where": "", "on": "2026-11-03" }],
  "closestEvidence": "what you did find and why it is not enough"
}
```

Every item listed in sections A to G must appear at least once, as found
or not_found.

2. `docs/evidence/catalog/2026-11-03/research/report.md`: a short summary
   with one table row per item (found / partial / not found, value, source,
   tier, confidence), then a list of conflicts between sources (give both;
   do not pick one silently), then the open questions an agronomist should
   answer.

## Before you finish, check

- Every `found` fact has a saved local file, its SHA-256, a page or section
  locator and an exact quote that you re-found in the file.
- Every number in `proposed` matches its quote after the stated conversion.
- No optimum, germination or "zero de végétation" temperature is labelled as
  a damage limit.
- `facts.json` is valid JSON (`python3 -m json.tool facts.json`).
- You changed nothing outside `docs/evidence/catalog/2026-11-03/research/`
  and `.research-sources/2026-11-03/` (`git status` shows only the research
  folder).

Then stop and report what you found and what is still missing.
