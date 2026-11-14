# Weather provider decision — Step 02

Original comparison: 2026-09-26. Current adapter is **2** with seven variables;
see [weather expansion](../steps/06/weather-expansion.md). The comparison below
records the original four-variable evidence.

Original decision: NASA POWER daily point meteorology, AG
community, explicit UTC, adapter version 1. This enables historical weather
infrastructure; it does not validate crop recommendations or field accuracy.

## Comparison

| Criterion                        | NASA POWER                                                                                | Open-Meteo fixed ERA5                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Exact source                     | Daily point API; MERRA2/POWER in observed headers                                         | Archive API with `models=era5`, not default Best Match                                         |
| Parameters                       | `T2M_MIN,T2M_MAX,T2M,PRECTOTCORR`                                                         | `temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum`                  |
| Daily convention tested          | `time-standard=UTC`                                                                       | `timezone=GMT`, zero UTC offset                                                                |
| Units observed                   | C; mm/day                                                                                 | °C; mm                                                                                         |
| History documented               | Meteorology from 1981                                                                     | ERA5 from 1940                                                                                 |
| Source spatial resolution        | MERRA-2: 0.5° latitude × 0.625° longitude                                                 | ERA5: 0.25°                                                                                    |
| Commercial service               | NASA-managed registry states unrestricted access/use and links CC BY 4.0; preserve credit | Public hosted tier is noncommercial; commercial historical API requires Professional or higher |
| Observed latency, three requests | 876 / 781 / 589 ms                                                                        | 678 / 83 / 150 ms                                                                              |
| Observed HTTP failures           | 0 of 3                                                                                    | 0 of 3                                                                                         |
| Availability commitment          | No service commitment established                                                         | Paid page describes a 99.9% target; free evaluation has no guarantee                           |

Source definitions and resolutions: [NASA meteorology](https://power.larc.nasa.gov/docs/methodology/meteorology/),
[Open-Meteo archive documentation](https://open-meteo.com/en/docs/historical-weather-api).
NASA's general daily catalog page uses an approximate half-degree description;
we report the source MERRA-2 resolution from its methodology page. Neither
response is a farm sensor reading. NASA response coordinates round the requested
point; they are not evidence of a grid centre. Open-Meteo returned a selected
grid point and elevation; `elevation=nan` disables elevation downscaling in this
comparison.

Commercial terms: [NASA-managed POWER registry declaration](https://github.com/awslabs/open-data-registry/blob/main/datasets/nasa-power.yaml),
[NASA referencing guide](https://power.larc.nasa.gov/docs/referencing/),
[Open-Meteo pricing and service terms](https://open-meteo.com/en/pricing).
NASA attribution includes provider, source, service/API version and access time
in each snapshot. The registry's CC BY 4.0 link supports commercial reuse with
attribution; we do not treat all NASA-hosted third-party products as public domain.
No paid subscription was purchased. Recheck terms before commercial release.

## Actual sample and uncertainty

Six sequential live requests on this machine: Beni Mellal 2024-02-27–03-02,
Sydney 2023-12-30–2024-01-03, and Beni Mellal 2023-12-01–2024-03-31. All returned
HTTP 200. Exact URLs, retrieval instants, durations, bytes and SHA-256 are in
`docs/evidence/weather/2026-09-26/manifest.json`; unmodified JSON response bodies
are beside it. These are a small connectivity sample, not uptime estimates or
a controlled performance benchmark. Provider-side caches and network conditions
were not controlled. Deterministic CI never calls either public service.

For the 122-day sample, mean absolute differences between the datasets were
3.8395°C minimum, 2.0750°C maximum and 2.2263°C mean temperature, and 0.6316 mm
daily precipitation. Precipitation totals were 182.22 mm versus 223.00 mm.
See `comparison.json`, reproduced by `node tooling/weather/compare.mjs
docs/evidence/weather/2026-09-26`. There is no local ground truth here, so these
differences do not establish which provider is more accurate. Different grids,
elevations, assimilation and processing matter. A smaller grid alone is not an
accuracy guarantee.

[NASA precipitation validation](https://power.larc.nasa.gov/docs/methodology/meteorology/precipitation/)
documents false alarms/misses and variation with aggregation period. This adapter
uses corrected MERRA-2 precipitation; it does not select or mix IMERG. NASA's
[download guidance](https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/)
warns about duplicate cell downloads and replacement of recent data after 2–3
months. We restrict Step 02 requests to dates at least 120 UTC days old, a
conservative application policy rather than a claim of immutable upstream data.

## Why this selection

NASA supplies all four required historical variables, observed source metadata,
global coverage and usable commercial redistribution terms without a new paid
service. That improves this milestone's reproducible deployment and provenance.
The sample also shows Open-Meteo can be faster; NASA is not selected as an
accuracy or latency winner. Fixed ERA5 remains a credible later alternative if
regional validation or required variables justify its commercial service cost.
Default blended model selection is unsuitable for reproducible evidence.

Only the selected adapter is installed. Adding another provider requires a
documented decision, dataset/units/coverage tests, a separate identity in cache
keys and provenance, and commercial credentials where needed. An outage produces
an error, never a hidden fallback or a crop-suitability result.
