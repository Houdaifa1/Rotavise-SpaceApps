# Common analysis grid — rotation-outputs-1

The analysis unit is one field and one calendar schedule. There is no shared
raster onto which every NASA input is resampled. The engine joins summaries by
field, calendar dates, and pinned source identities. A fine output display does
not make coarse weather or regional water storage field measurements.

`result.outputs.grids` has one structured record for each input below. `use`
is `engine_input`, `reported_context`, or `not_used`. Unused records have no
selected cell or evidence IDs. Unknown pixel IDs and upstream resampling stay
`null` / `not_found`; a requested sample point is never labelled a native pixel
centre. `resampling: none_added` describes this reporting policy, not the
provider's upstream processing.

| Input     | Existing selection retained                                                                                                                                                                  | Resolution metadata                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| POWER     | Actual pinned snapshot request points. Current adapter 3 requests the intersection centre of the meteorological and solar source cells; older adapter coordinates remain actual coordinates. | Meteorology 0.5° latitude × 0.625° longitude; solar 1° as described in the record. |
| GPM       | Monthly reference's own cell, only when the POWER rain correction succeeded. Daily timing remains POWER's.                                                                                   | 0.1° cell.                                                                         |
| HLS       | Completed owned-field AppEEARS extraction points, when pinned; otherwise unused.                                                                                                             | 30 m nominal input. No new interpolation.                                          |
| SMAP      | AppEEARS row (`line`) and column (`sample`), plus request points.                                                                                                                            | 9 km nominal EASE grid.                                                            |
| NEX-GDDP  | Actual prepared cell and pinned model/experiment/year/variable unit IDs. The preparation tile is a storage partition, not the analysis resolution.                                           | 0.25° cell within the existing 1° preparation tile.                                |
| NASADEM   | Extraction request points and reported sampling resolution; full grid layout, stride and missing points remain in `analysisContext.terrain.result.grid`.                                     | Native input described as 30 m; the result's sampling resolution takes precedence. |
| GRACE     | The existing water-storage service's nearest imported mascon cell, copied into the plan at acceptance.                                                                                       | Effective resolution remains regional; no field-scale resolution is assigned.      |
| ECOSTRESS | Completed owned-field extraction points and quality-policy summary.                                                                                                                          | 70 m nominal input.                                                                |
| MODIS     | Completed owned-field extraction points.                                                                                                                                                     | 250 m nominal input.                                                               |
| GEDI      | Not used by the rotation engine or this terrain report.                                                                                                                                      | 1 km nominal input recorded, selected cell remains absent.                         |

These resolutions describe existing adapter metadata or the task's requested
metadata, not new provider verification. The exact implementation quotes and
SHA-256 records are in
[`source-ledger.json`](../evidence/engine-outputs/2026-11-10/source-ledger.json).
Independent provider re-verification for this change is `not_found`. Existing
saved provider evidence remains under `docs/evidence/weather`,
`docs/evidence/earth-observations` and `docs/evidence/climate-scenarios`; this work
does not modify those files or claim a new live NASA run.

For a format 2 request, optional `field_id` must identify an owned field with the
same coordinates as the request. At acceptance, completed extraction/observation
rows are hash-checked and their summaries or grid metadata copied into the
already hashed `planning_runs.versions.analysisContext`. GRACE is evaluated by
the existing service and its summary hash is pinned there too. Workers use that
copy, including explicit missing values, on retries. New extractions require a
new plan. No migration, new provider request, download, or raster resampling is
introduced by this policy.

The temporal join also preserves source calendars. POWER reporting uses the
same consecutive-year historical analog offsets and representative sowings as
the score. Temperature periods are envelopes of the named rule's stage across
complete analog samples, with exposed and checked day counts. Cold-bound
exposure can describe a frost limit or a favourable range; the engine does not
reinterpret either as a frost forecast. The four FAO water stages reuse the
existing ET0/Kc arrays and report rain shortfall. Soil storage, runoff and
irrigation supply remain absent, so rain shortfall is not measured plant stress.

The summaries are context for every candidate through `candidate.terrainContext`
and `outputs.analysisContext`. They do not alter the spatial support of climate
scores, compare surface temperature to air-temperature crop limits, or turn
regional GRACE trends into infiltration/drainage measurements.
