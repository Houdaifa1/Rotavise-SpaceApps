# Rotavise — initial external-data evidence and selection procedure

Research date: 2026-09-26. Status: documentation reviewed; no live provider benchmark, authenticated extraction, or comparative farm/station validation was performed for this pack. This is a defensible initial shortlist, not an exhaustive search of every service or a claim of a universally best API.

Historical shortlist: actual selection and samples are in [provider decision](../decisions/weather-provider.md). The backend now supports seven NASA measurements; see [weather expansion](../steps/06/weather-expansion.md). This file retains provider-selection requirements; it is not the current implementation status.

## 1. Initial decisions and evidence

### Historical weather: NASA POWER — initial candidate

POWER exposes daily point data as JSON, supports explicit LST/UTC selection, and allows up to 20 parameters per point request. The initial variables are `T2M_MIN`, `T2M_MAX`, `T2M`, and `PRECTOTCORR`; validate definitions and returned units before calculating. Cache and deduplicate requests instead of making a separate call for every candidate crop. [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).

Its meteorological source is MERRA-2 reanalysis on an approximately 0.5° × 0.625° grid. Values describe a surrounding grid area, not a sensor on the field. This makes it useful for regional historical screening but does not prove farm-level accuracy. [Meteorological methodology](https://power.larc.nasa.gov/docs/methodology/meteorology/).

NASA warns against excessive/redundant requests and notes replacement of near-real-time data with improved products later. Treat retrieved evidence as a versioned snapshot, not a permanently immutable upstream value. [Request guidance](https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/).

Engineering judgment: retain POWER as the first implementation candidate because it fits the required historical point-series workflow and NASA context. Finalize that decision only after comparing relevant alternatives and inspecting actual samples. Do not call it a forecast or a universally most accurate provider.

### Historical comparison: ERA5 / ERA5-Land through Open-Meteo

The Historical Weather API provides selectable reanalysis datasets and daily variables. The documentation recommends fixed ERA5/ERA5-Land selections for consistent multi-decade analysis instead of default model blending. ERA5-Land's distributed resolution is 0.1°. Derived ET₀ and modeled soil variables are available in supported configurations; neither establishes the farmer's actual irrigation sufficiency. [Historical API](https://open-meteo.com/en/docs/historical-weather-api).

The hosted free service is for non-commercial evaluation/prototyping. Current pricing documentation says commercial historical access requires the Professional plan or higher. Recheck endpoint, current commercial terms, historical coverage, attribution, and call accounting before committing. Do not substitute a nominally free endpoint into a startup's production deployment. [Commercial access](https://open-meteo.com/en/pricing).

Engineering judgment: a credible benchmark candidate and possible selected commercial provider if it improves relevant evidence and operating requirements. No subscription is authorized by this pack. A higher-resolution grid alone is not proof of better decision accuracy.

### Direct Copernicus ERA5-Land data

The official dataset offers hourly global land reanalysis from 1950, distributed at 0.1° × 0.1° with a native resolution of 9 km. The dataset page lists GRIB and a CC-BY license. It explicitly discusses uncertainty in model estimates. [Official dataset](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land?tab=overview).

Engineering judgment: investigate direct access if bulk ingestion, source control, costs, or reproducibility warrant it. Verify current API authentication, dataset acceptance terms, request limits, variable accumulation semantics, and ingestion tooling before implementation. It is not automatically a low-latency JSON point API. Do not introduce a Python service or scientific-file pipeline into Step 01 because this option exists.

### Soil: farmer/laboratory inputs first; SoilGrids remains optional

ISRIC's current access documentation says the SoilGrids REST service is temporarily paused, identifies beta status, and provides no restoration date or uptime guarantee. It describes alternative distribution methods. [SoilGrids access](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html).

Engineering judgment: do not make that REST endpoint mandatory for the first live product. If gridded soil information later improves a defined decision, investigate supported distribution/caching, units, depth intervals, uncertainty, and actual applicability. Keep predicted gridded values distinct from field samples; do not silently fill “unknown” farmer measurements with apparently measured facts.

### Crop requirements: maintained sourced catalog

FAO says ECOCROP was discontinued around 2015 and incorporated into GAEZ. This supports broad reference use, not an assumption of a maintained live crop-advice API. [FAO ECOCROP](https://www.fao.org/land-water/resources/tools/databases/ecocrop/en).

Engineering judgment: use versioned profiles built from applicable sources and reviewed assumptions. No sufficiently authoritative universal crop recommendation API has been selected or tested here. Research specific crop/variety/calendar sources during the catalog milestone. Do not invent a crop API, scrape during every request, or ask an LLM to manufacture thresholds.

### Optional NASA Earth observations: AppEEARS

AppEEARS documents Earthdata Login authentication, bearer tokens, extraction tasks, explicit product/layer selection, and result retrieval. [AppEEARS API](https://appeears.earthdatacloud.nasa.gov/api/).

Engineering judgment: add a satellite layer only after selecting an exact currently supported product/version/layer and defining how it changes a decision. Verify scale, dates, quality flags, aggregation, and authentication with a small reproducible extraction. A vegetation layer is not a pH measurement; land-surface temperature is not 2-metre air temperature. No product/layer is selected by this pack.

### Mapping and optional AI

Mapping library and map-tile/geocoding service are different choices. Research current commercial use, attribution, request limits, privacy, and reliability before the map milestone. Do not assume a community tile or geocoding endpoint is unrestricted production infrastructure. Coordinate input must remain a working fallback.

AI is not required for deterministic ranking. A later translation/input-assistance feature needs its own requirements, provider evaluation, cost and data-flow review, and tests preserving engine output. No AI provider is authorized for integration in Step 01.

## 2. How the agent must select providers at the authorized milestone

Start from the measurement or decision needed, not from a list of fashionable APIs. Search broadly for credible candidates, then rely on provider documentation, scientific methodology, dataset metadata, official terms, and actual small samples for decisions. Do not rely on SEO comparisons or a search snippet alone.

For historical weather, compare POWER and at least one relevant ERA5/ERA5-Land access route. Research further only if coverage, variables, cost, reliability, or scientific suitability leaves a material gap. “Entire internet” does not justify an unbounded search or integrating every provider.

Create `docs/decisions/weather-provider.md` with:

| Criterion | Evidence required |
| --- | --- |
| Decision purpose | What calculation changes when this data is included |
| Scientific meaning | Observation/reanalysis/forecast, grid, elevation treatment, uncertainty |
| Temporal meaning | Daily aggregation, accumulation conventions, time standard/time zone |
| Coverage | Locations, dates, supported variables, missing-value behavior |
| Access | Exact dataset/endpoint/version, authentication, documented limits |
| Commercial use | Current service terms, source attribution, redistribution/cache conditions |
| Operations | Small-request latency, rate/failure behavior, documented support/guarantees |
| Cost | Multi-year request accounting and intended workload, dated verified prices if needed |
| Provenance | What can be stored to reproduce calculations |
| Accuracy | Appropriate station comparison where available; limits if not evaluated |

Label the distinction between documented facts, observations from your own tests, and engineering judgments. If credentials or a paid plan are required, complete public research first and request the missing authorized access. Do not claim authenticated behavior was verified without access.

## 3. Implementation rules after a provider is selected

1. Define one normalized contract with units, dates/time standard, provider/dataset identity, quality flags, coverage, retrieval time, and snapshot hash.
2. Keep provider-specific normalization in adapters; keep calculations provider-independent.
3. Validate actual metadata and missing values, not only a hard-coded happy-path example.
4. Cache matching snapshots, deduplicate concurrent misses, limit retries/concurrency, and bound request ranges.
5. Request complete historical windows, preserve consecutive sequence years, and record the actual sample count.
6. Never silently blend sources. A provider switch changes evidence and requires a fresh assessment with explicit provenance.
7. Separate deterministic stored-fixture tests from optional live smoke tests. Do not make ordinary CI depend on an upstream service being available.
8. Make unknown/insufficient evidence and provider failure explicit product states.

Provider selection is complete when a documented decision and tested small sample support the intended use. It is not complete merely because the newest endpoint returns HTTP 200.

## 4. Basis for the staged engineering workflow

The handoff uses small milestones, explicit acceptance criteria, verification, and persistent decision/progress reports. These are consistent with OpenAI's documented long-task workflow. [Official Codex guidance](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex).

Repository instructions stay short and point to the relevant detailed specification instead of requiring every document to be reread before every edit. [Official instruction guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

The explicit approval gate is the user's requirement. No prompt guarantees defect-free work or scientific validity; concrete evidence and review enforce the working standard.
