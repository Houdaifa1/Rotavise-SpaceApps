# Rotavise — product and engineering specification

Version 2, 2026-10-16 (Field Shift re-baseline). It supersedes the 2026-09-27
handoff, kept at [archive/rotavise-handoff-2026-09-27.md](../archive/rotavise-handoff-2026-09-27.md).
This document is the plan. It does not claim that anything below is built:
see [PROGRESS](../PROGRESS.md) for the actual state, [DECISIONS](../DECISIONS.md)
for recorded choices and [GOALS](GOALS.md) for goal-level acceptance.

## 1. Purpose and priorities

Rotavise helps a farmer explore multi-year crop rotations for one field. It
combines NASA Earth observations, local soil information, crop characteristics
and the farmer's priorities, and shows which rotations protect the soil,
conserve water and hold up under changing weather, with reasons and uncertainty.

1. **First priority:** win the NASA Space Apps Challenge 2026 challenge
   [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/).
   Every part of the challenge text, and of the full statement due 2026-10-28,
   must be answered by working features.
2. **Same quality bar:** a production-grade product Moroccan farmers can use
   after the competition. Coverage before the event is **all of Morocco**, with
   Tadla / Béni Mellal as the detailed pilot (user, 2026-10-25). Worldwide
   coverage comes after Space Apps. The engine stays location-independent;
   evidence coverage differs by region and is shown.
3. If Space Apps does not accept the pre-existing project, Rotavise continues as
   an independent product under this same plan.

### Competition constraints (checked 2026-10-16)

- The [participant FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/)
  says teams may not begin working on the challenges before the hackathon.
  Rotavise predates the event. The user will ask the organizers in writing
  whether it may be submitted with full disclosure. Never disguise prior work.
- Under the [participant terms](https://www.spaceappschallenge.org/legal/),
  submitted original content is open source (Apache 2.0 unless another OSI
  licence is named), every source must be cited, and submissions must not
  promote a commercial product. AI tool use must be described.
- Dates: full statements 2026-10-28; submission and judging guides 2026-11-13;
  event 2026-11-14 to 15; nominees December 2026; winners January 2027.
- Recheck the full statement, listed resources and judging criteria when they
  are published, and update section 2.

## 2. Challenge coverage

| Challenge text                                       | Required capability                                                                           | Step   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Shifting temperatures, changing rainfall             | Stage-level temperature and rain exposure per rotation; historical trend and future scenarios | 11, 13 |
| Water shortages; conserve water                      | Crop water need against reported supply, with shortage periods                                | 13     |
| Extreme weather                                      | Heat, frost, heatwave, heavy-rain and dry-spell indicators at sensitive crop stages           | 13     |
| Declining soil health; strengthen soil health        | Soil-carbon trajectory, legume and family diversity, residue, disease breaks                  | 10, 13 |
| Protect fields; long-term resilience                 | Rotations of 3–5 years compared on all dimensions, with robustness across climates            | 10, 13 |
| Decision-support tool to explore rotation strategies | Generated and farmer-built rotations compared side by side; priorities change the order       | 10, 15 |
| NASA Earth observations                              | POWER, GPM IMERG, SMAP, HLS, NEX-GDDP-CMIP6 (section 5); OPERA DIST in Step 14                | 11, 14 |
| Local soil information                               | Farmer or lab soil tests first; Fertimap and SoilGrids as labelled estimates                  | 11, 12 |
| Crop characteristics                                 | Moroccan guides plus FAO AquaCrop crop parameters, each value with its source                 | 12     |
| Farmer priorities                                    | Soil health, water saving, climate risk; yield stability only where a model is calibrated     | 10, 15 |

Additions that serve the same decision: crop-health history and disease breaks
(rotation is a main way to break disease cycles), photo triage of crop problems,
a field diary, Arabic and French, and low-bandwidth use.

## 3. Farmer workflow

1. Locate the field: draw its boundary on a map, or enter coordinates.
2. History: past crops and dates from the diary or entered directly. Satellite
   green-up history suggests missing seasons; the farmer confirms or rejects.
3. Soil: measured values with method, date and source; otherwise labelled
   regional estimates with uncertainty.
4. Water: rainfed, irrigated with a reported allocation per period, or unknown.
5. Crops: considered, excluded, or "suggest options"; variety when known.
6. Priorities and horizon: weights for each dimension; 3–5 years.
7. Submit. The request is stored, processed durably and shows real progress.
8. Explore: ranked rotations and any rotation the farmer builds, each with a
   timeline, scores per dimension, reasons, sources, uncertainty and robustness.
9. Crop health: report problems from a pick-list or with a photo. Confirmed
   problems feed the rotation rules.
10. Save, revisit and compare scenarios. Each result keeps its evidence versions.

Guests can do everything an account can: draw a field, run plans, request
satellite history and report crop problems. Their data lives in a private
guest workspace that expires; an account keeps fields, diary, history and plans
permanently and can claim a guest workspace (user requirement, 2026-10-18).

## 4. Decision engine

### Rotation model

- A rotation is a sequence of crop slots over a 3–5 year horizon, starting after
  the last known crop. Slots follow crop calendars; in irrigated systems winter
  and summer crops may alternate within a year.
- Model types: annual crops; multi-year forage stands such as alfalfa.
  Orchards and protected (greenhouse) crops are listed but marked
  `unsupported_for_plan` with the reason.
- Sowing dates are representative points inside each window (for example,
  weekly), not every calendar day.

### Processing

1. **Resolve context:** region (versioned areas declared in the catalog),
   farming system and cultivar or generic profile. Unresolved items are shown
   and limit the result; they never pass silently.
2. **Generate** candidates with bounded search and full accounting. Every
   candidate ends as ranked, rejected (with the rule), unrankable (with the
   missing evidence) or pruned (with the reason). Every crop the farmer named
   appears in the result.
3. **Hard constraints before scoring:** calendar fit, no overlap plus a
   field-preparation gap, return intervals, disease breaks, soil limits and
   farmer exclusions.
4. **Evaluate:** climate exposure, water, soil health and crop health; yield or
   water productivity only where a model is calibrated for that crop and region.
5. **Climate runs:** historical analog years (1991–2020 baseline, consecutive
   years kept together) and future scenarios (NEX-GDDP-CMIP6, at least two
   emission pathways, mid-century). Report distributions, not single values.
6. **Compare** in one space: the Pareto set, the priority-weighted order, ties,
   weight sensitivity and robustness across scenarios. A dimension missing for
   some candidates is disclosed and cannot create an advantage.
7. **Explain** in plain language, tied to inputs, rules, sources and model runs.

### Invariants

- Unknown evidence never counts as favorable; missing values stay missing.
- Hard violations are never averaged away.
- Same inputs and versions give the same result and order, including ties.
- No invented thresholds, yields, savings, disease probabilities or profit.
- Weights are declared heuristics; their sensitivity is shown.
- Results store the versions of catalog, models, data snapshots, engine and
  policy, and label every value's source tier: Moroccan guide, FAO generic,
  model estimate, satellite, farmer-reported or expert-reviewed.

### Scale

A committed benchmark must show that at least 12 crops, month-long windows,
5-year horizons, 30 historical years and 2 future scenarios complete within a
recorded time and size budget. Over budget, the search narrows explicitly and
accounts for what it skipped; size alone never fails a whole plan.

## 5. Data sources

### NASA

| Source                                                                                                   | Use                                                                         | Limits                                                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [POWER](https://power.larc.nasa.gov/docs/services/api/) (built, adapter 2)                               | Daily temperature, rain, humidity, wind, solar energy; inputs to water need | About 0.5° × 0.625° grid; POWER wind is weak for ET₀; compare with Moroccan stations |
| GPM IMERG                                                                                                | Satellite precipitation cross-check                                         | About 0.1° grid; the final product arrives months later                              |
| SMAP                                                                                                     | Regional soil-moisture and drought context                                  | 9 km; never presented as a field value                                               |
| [HLS v2.0](https://hls.gsfc.nasa.gov/about-hls/)                                                         | Field green-up history, suggested past crops, productivity trend            | 30 m; clouds; needs enough clean pixels inside the field boundary                    |
| [OPERA DIST-ALERT](https://www.earthdata.nasa.gov/s3fs-public/2024-04/OPERA-DIST_Fact_Sheet.pdf)         | Alerts where vegetation dropped                                             | Shows change, not its cause                                                          |
| [NEX-GDDP-CMIP6](https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6) | Future daily climate scenarios                                              | 0.25°; files say CC BY-SA 4.0, AWS registry says CC0 (2026-10-17); follow CC BY-SA   |

Access uses a free Earthdata Login, [AppEEARS](https://appeears.earthdatacloud.nasa.gov/api/)
or cloud-hosted files, and the [AWS open-data copy](https://registry.opendata.aws/nex-gddp-cmip6)
of NEX-GDDP. Do not build on MODIS: Terra and Aqua science collection is
[scheduled to end in 2027](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/).

### Other sources

- Moroccan crop knowledge: INRA, ONCA/ARDNA, ORMVAT, the ONSSA variety
  catalog and HCP statistics. See the
  [source map](../evidence/catalog/2026-09-30/morocco-crop-source-map.md).
- Soil: farmer and laboratory tests; [Fertimap](http://www.fertimap.ma/)
  (access and terms to confirm); [SoilGrids](https://docs.isric.org/globaldata/soilgrids/)
  at 250 m (CC BY 4.0; its REST API is paused, so use WCS or files).
- Methods: FAO-56, [AquaCrop 7.3](https://www.fao.org/aquacrop/news-events/news/detail/new-version-of-aquacrop-7.3-available---now-with-python-source-code/en)
  and RothC as used by [FAO GSOCseq](https://www.fao.org/soils-portal/data-hub/soil-maps-and-databases/global-soil-organic-carbon-sequestration-potential-map-gsocseq/en/).

Every source records its licence or terms, date, geography and hash. Changing a
provider forces recalculation; sources are never spliced silently.

### Further NASA sources (checked 2026-10-18)

Use NASA data wherever it changes a decision or what the farmer sees:

| Source                                                                | Use                                                                                           | Step  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| ECOSTRESS ECO_L3T_JET / ECO_L4T_ESI / ECO_L4T_WUE v2 (70 m, AppEEARS) | Field evapotranspiration, evaporative stress and water-use efficiency: water stress per field | 13    |
| NASADEM (30 m, AppEEARS)                                              | Elevation and slope: drainage and erosion risk                                                | 13    |
| VIIRS VNP22Q2 land-surface phenology (500 m, AppEEARS)                | Regional green-up and senescence dates to cross-check crop calendars                          | 12–13 |
| HLS thermal bands (Landsat B10/B11)                                   | Canopy surface temperature at heat-sensitive stages                                           | 13    |
| GRACE-FO terrestrial water storage, FLDAS                             | Regional groundwater and drought context for water shortages (access to confirm)              | 13    |
| NASA GIBS (HLS true colour, OPERA DIST layers)                        | Satellite pictures on the map; no account                                                     | 15    |
| VIIRS VNP14A1 thermal anomalies                                       | Residue-burning and fire context                                                              | 14    |

## 6. Scientific methods

| Method                       | Purpose                                                     | Validation before results are shown                                                                   |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| FAO-56 Penman–Monteith       | Crop water need and net irrigation need against supply      | Compare POWER-based ET₀ with Moroccan station data; tabulated crop coefficients marked FAO generic    |
| AquaCrop 7.3                 | Water-limited yield and water productivity, salinity effect | Reproduce published Tadla wheat calibrations first; uncalibrated crops show relative comparisons only |
| RothC (FAO GSOCseq approach) | 20-year topsoil carbon trajectory per rotation              | Carbon inputs per crop from cited tables; uncertainty from soil ranges                                |
| Climate-extreme indicators   | Heat, frost, heavy rain and dry spells at crop stages       | Thresholds from crop sources with matching measurement basis; definitions documented                  |

Each output carries the model name, version and calibration status.

## 7. Crop knowledge

- **Identity inventory** for Moroccan crops: species, harvest product, French
  and Arabic names, registered varieties, model type and planning status
  (assessable, `unsupported_for_plan` with reason, or out of scope).
- **Profile v2:** calendars by region and farming system, duration ranges,
  stage timing, temperature and water needs, soil limits (pH, salinity,
  texture, drainage), rotation effects, disease and pest hosts and breaks, an
  AquaCrop parameter reference, and per value its source, page, strength and
  conflicts.
- **Pipeline:** snapshot and hash each source; AI-assisted extraction with page
  citations; a second check against the page; a conflict and gap register;
  versioned release with a changelog. Until a specialist reviews a profile,
  results say "based on official guides, not yet expert-reviewed".
- **Pilot (Tadla):** durum wheat, bread wheat, barley, faba bean, chickpea,
  lentil, sugar beet, maize and sesame, plus alfalfa as a multi-year stand.
  Step 12 Part B extends national rules to every Moroccan region, adds
  regional rules and Moroccan soil data, and adds crops whose sources allow a
  complete profile. Countries outside Morocco follow after Space Apps.
- **Rights:** confirm reuse terms for each document before release.

## 8. Crop health

- A disease and pest table per crop from sources: hosts, survival and minimum
  break before a host crop returns.
- Farmers report problems from a pick-list with local names. Unconfirmed
  reports produce warnings; specialist or laboratory confirmation can make a
  break rule binding.
- Photo triage with an AI vision model checks image quality, says healthy or
  affected, and offers at most three candidates from that crop's list or "not
  sure". Published zero-shot results for fine-grained plant disease are mostly
  below 65% ([LeafBench 2026](https://arxiv.org/html/2602.13662)), so results
  stay "possible" and are evaluated on a labelled local set before release.
- Satellite anomalies (HLS, OPERA DIST) prompt "check this area"; they are never
  a diagnosis.
- No pesticide or treatment advice.

## 9. AI use

Allowed, with Claude as the default provider:

1. Extracting rules from source documents (Moroccan guides and other official
   sources) with page citations, always checked against the page. Claude's own
   knowledge may point to a source or flag a doubtful value; it never becomes
   a rule without a citation.
2. Plain-language explanations and translation of engine results into Arabic,
   Darija and French, without changing any number.
3. Turning diary text into structured entries that the farmer confirms.
4. Photo triage as in section 8.

Not allowed: ranking rotations, inventing values, or adding unsourced knowledge
to the catalog. Photos and diary text sent to an AI provider require farmer
consent and a privacy record. AI use is recorded for the Space Apps submission.

## 10. Architecture

Kept: TypeScript, pnpm, Node 24, NestJS/Fastify API, a separate worker,
React/Vite, Zod contracts, PostgreSQL 18, Drizzle migrations, pg-boss, the pure
TypeScript domain package, owner-scoped storage and accounts.

Added: a stateless internal Python **science service** for AquaCrop, RothC and
raster/NetCDF extraction. It has no database access and no farmer identity, is
called only by the TypeScript worker, validates every input and output against
shared schemas, and is versioned, deterministic and containerized. Python is
used because FAO's official AquaCrop code and the standard geospatial tools are
Python. Caching, provenance and ownership stay in PostgreSQL.

## 11. Frontend

Deferred to Step 15. The design is agreed with the user before any UI work.
Requirements: Arabic (right to left) and French; a map to find the place and
draw the field outline, with a coordinate fallback; NASA satellite pictures of
the field by date (GIBS and HLS) beside its greenness history and seasons;
the rotation explorer with future-climate views; plain reasons; low bandwidth;
WCAG 2.2 AA; usable on low-cost phones. The user's bar: the experience must be
excellent, not merely working.

## 12. Production gates

Before public launch: trusted-proxy client addresses, security headers and CSP,
encrypted OAuth tokens, reduced location precision and defined retention, a
privacy record under Morocco's Law 09-08 (CNDP), staging, monitoring and alerts,
a backup restore drill, rollback, a load test at a stated concurrency, CI on a
remote, dependency review, an accessibility audit, a farmer usability test and
a public demo. Advice is called expert-reviewed only after a specialist review.

## 13. Roadmap

| Step | Scope                                                                         | External accounts                                   |
| ---- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| 09   | Re-baseline specification; correct Step 08 claims; portable browser tests     | None                                                |
| 10   | Engine core: context, multi-year rotations, scale, one comparison, catalog v2 | None                                                |
| 11   | NASA data layer, future climate and location privacy                          | NASA Earthdata Login                                |
| 12   | Crop knowledge pilot and disease tables; Part B: all of Morocco and its soil  | None                                                |
| 13   | Science service: water, soil carbon, AquaCrop, extremes; ECOSTRESS, terrain   | None                                                |
| 14   | Crop health: rules, reports, photo triage, OPERA DIST alerts, fire context    | Anthropic API key                                   |
| 15   | Guest parity; frontend after design agreement; maps and NASA imagery          | Map tiles provider; Google OAuth; Resend and domain |
| 16   | Production operations and public demo                                         | GitHub remote; hosting; domain                      |
| 17   | Space Apps submission material, after the organizers answer                   | Space Apps team page                                |

Target: Steps 10–16 before 2026-11-13, with the frontend design agreed by the
end of October. Greenhouse monitoring is outside this plan and is reconsidered
after Step 16. Each step is authorized by the user, verified, reported and then
stops for review.
