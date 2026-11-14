# HLS geotransform evidence (retrieved 2026-11-11)

These are formatted copies of public NASA LP DAAC STAC records for real HLS S30 v2 granules.

- `morocco-stac.json`: `HLS.S30.T29SQR.2025122T105619.v2.0`, covering the Tadla query window. Source: https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-public/HLSS30.020/HLS.S30.T29SQR.2025122T105619.v2.0/HLS.S30.T29SQR.2025122T105619.v2.0_stac.json
- `granule-stac.json`: independent northern-hemisphere tile `HLS.S30.T15UYR.2025124T165711.v2.0`. Source: https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-public/HLSS30.020/HLS.S30.T15UYR.2025124T165711.v2.0/HLS.S30.T15UYR.2025124T165711.v2.0_stac.json

`proj:transform` uses a 30 m pixel with a negative northing step. Both offsets are multiples of 30, confirming the zero-origin lattice for these granules. Tests compare actual pixel corners and centres to our projected grid. This establishes geometric alignment for the recorded granules, not availability or quality of imagery on arbitrary dates. NASA's HLS tiling description specifies UTM signed northing (no southern false northing): https://hls.gsfc.nasa.gov/data-products/ . The app uses that convention. UTM zone overlaps can contain observations from another zone; the selected local-zone lattice does not claim to match every overlapping raster.

NASA HLS product DOI: https://doi.org/10.5067/HLS/HLSS30.002 . No Earthdata credentials were needed for these public metadata records.

Exact upstream bytes are preserved under `docs/evidence/earth-observations/2026-11-11/hls-grid/`. SHA-256: Tadla `fb9e282fc328234c18927fca760843a343374a36c9681138bcc4df4e3c8621f4`; comparison `79b5d6d777e7d498e69d67e1580d6134dad96500e24c6e9aa2178a131b992a4e`.
