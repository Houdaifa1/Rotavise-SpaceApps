# Free field boundaries for Morocco — B2r decision, 10 November 2026

**Decision: use precomputed FTW 2025 polygons as optional suggested outlines,
with manual painting/drawing/upload whenever a suggestion is absent or wrong.
Do not add an OSM fallback, a detector, or a segmentation service.** Keep the
backend switch off by default. The farmer must check every suggestion. Accuracy
on Moroccan fields is **unmeasured**. The samples support useful assistance,
not automatic selection of the correct field everywhere.

This is the separately authorized B2r backend task, not completion or approval
of Step 12 or of the Step 15 frontend. No frontend work, paid service, account,
external publication, commit or push is part of this task. The newer B2r request
supersedes the detector and automatic fallback in the frontend master plan.

## Evidence and method

[Source index and SHA-256 ledger](source-index.md) identifies saved response
bytes, original URLs, retrieval failures, derived samples and overlays.
`retrievals.json` contains HTTP status/headers and retrieval times. Files ending
in `.raw` preserve upstream bytes, including unsuccessful HTTP responses; open
as text where appropriate. A successful page request alone is not a licence.
Assertions below are limited to those saved sources and our saved samples.
Unconfirmed coverage, prices, limits or quality are **not verified**.

Five deliberately small windows were used: longitude/latitude centre plus or
minus 0.01 degrees on both axes (roughly 2 km across). These are **sample
windows, not regional surveys**: Tadla (-6.55, 32.40), Beni Mellal (-6.34,
32.37), Gharb (-5.95, 34.50), Souss (-9.15, 30.40), Saiss (-5.10, 33.90).
FTW was queried through its actual Morocco GeoParquet; OSM areas were assembled
from the actual Geofabrik Morocco PBF with libosmium. All requested OSM landuse
classes were considered, including relations and closed ways. Counts describe
polygons intersecting a window, including those extending outside it.

Sentinel-2 Level-2A RGB windows were read from public Earth Search COGs. For
each site the least cloudy scene **by whole-scene metadata** in the April 2025
search results was selected. This does not measure cloud cover in the window.
The saved RGB GeoTIFFs, search responses and `samples/imagery-provenance.json`
record scene identity, date, source and hash. Overlays enlarge roughly 10 m
pixels threefold without adding detail. They are visual comparisons with a
single date, not reference parcels or an accuracy evaluation. No IoU, precision,
recall, orchard recall, or total number of real fields was measured.

## Comparison

The evidence keys below correspond to names in the source index. “Not usable”
means for the requested free Moroccan tap-to-select feature, not for every
possible use of the product.

| Candidate                                                                       | Morocco evidence and observed quality                                                                                                                                                                                                                                                                                                      | Rights, cost and access                                                                                                                                                                                                                                                                           | Verdict and practical effort/risk                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FTW Global Map, current published Morocco vectors**                           | Actual 2024/2025 polygons at all five windows; hundreds at Tadla/Beni Mellal. Many follow visible strips and blocks, but there are merged fields, missed edges and fragments. Orchard-like textured blocks cannot be reliably judged at this resolution.                                                                                   | CC BY 4.0; attribution, licence link and indication of modifications required; commercial use allowed. Anonymous HTTP GeoParquet and PMTiles. No key or download charge observed; published request quota and future availability guarantee not verified. See `ftw-*`, `cc-by`.                   | **Usable with filtering and farmer checking; chosen.** Import existing data once and serve locally; modest engineering, continuing storage/refresh work. No model to train or run. Wrong suggestions remain a material risk.            |
| **OSM farmland, farmyard, orchard, vineyard, meadow; Overpass/Geofabrik**       | Real assembled areas: 10/16/6/0/8 in the five windows. Large farmland blocks include multiple visible fields; landuse area is not an individual management parcel. Orchards are explicitly tagged but also coarsely bounded.                                                                                                               | ODbL; credit OpenStreetMap contributors and link licence. Database redistribution/adaptation carries share-alike duties; it is not Apache-licensed data. Free PBF download or public Overpass. Public API fair-use limits apply, not an SLA. `geofabrik*`, `osm-copyright`, `odbl`, `overpass-*`. | **Not usable as a general field selector in these samples.** Easy download, substantial semantic filtering; adding it behind FTW could silently select an entire agricultural district. Excluded from runtime integration.              |
| **OneSoil get-data.onesoil.ai / Fields API**                                    | Saved current landing HTML describes a purchase calculator and lists regions without Morocco. Saved client bundle contains a global country-name dictionary; that is not coverage evidence. Both unauthenticated Moroccan API probes returned HTTP 403.                                                                                    | API guide requires a team-issued token. Free redistribution of Moroccan boundaries, an open boundary licence, commercial/non-commercial rights, exact price and quotas **not verified**. Current get-data page is not evidence of a free open-data release.                                       | **Not usable under verified free/open terms.** Requires provider agreement; no account or credential requested. No sample polygons obtained or visual quality measured.                                                                 |
| **OneSoil Canadian open boundary release**                                      | Official Canadian portal has a 2023 boundary release; no Moroccan coverage supplied by that release.                                                                                                                                                                                                                                       | Open Government Licence – Canada according to the saved official record. Downloadable GPKG. See `onesoil-canada`.                                                                                                                                                                                 | **Not usable for Morocco.** Shows that an open release for one country does not open the commercial global service.                                                                                                                     |
| **Digital Earth Africa cropland extent**                                        | Official 2019 northern product explicitly includes Morocco, 10 m raster. Saved WMS samples over Tadla/Beni Mellal. Cropland masks indicate agricultural cover, not individual field instances.                                                                                                                                             | CC BY 4.0; free S3/ODC/OGC access. Exact service quotas and complete regional download size not verified. `deafrica-products`, `deafrica-crop`, `deafrica-wms`.                                                                                                                                   | **Not usable as field boundaries.** Useful background context. Turning a mask into parcels would need a new method and validation, outside this task.                                                                                   |
| **ESA WorldCereal**                                                             | Official global 2021 temporary-crop/crop-type/irrigation maps, 10 m. Real WMS images saved over both sites. Temporary crops explicitly exclude perennial crops and temporary pasture; it cannot supply orchard parcel boundaries.                                                                                                          | Saved official product and Earth Engine catalogue describe access/licence. CC BY 4.0 according to the saved catalogue. Public raster downloads and DE Africa WMS; Earth Engine is a separate account/usage regime. Quotas and Morocco byte size not verified.                                     | **Not usable for field selection.** Crop extent is useful context, not a field-vector service. A parcel-making pipeline would add substantial work and risk.                                                                            |
| **ESA WorldCover**                                                              | Global 2020/2021 land cover, 10 m raster; real WMS samples saved at both sites. An agricultural class forms connected cover regions, not individual fields.                                                                                                                                                                                | CC BY 4.0 per saved catalogue. Public COGs/S3/WMS; official access page describes 3-degree tiles and approximately 117 GB for the global map layer. Country subset size/quotas not verified. `worldcover*`.                                                                                       | **Not usable as field boundaries.** Cheap to display, but extracting true parcel boundaries is a different problem.                                                                                                                     |
| **Other Copernicus cropland products**                                          | Saved CLMS croplands product page. A reusable, free Moroccan parcel-vector product was **not verified**.                                                                                                                                                                                                                                   | Product-specific access and licence must be checked; no Moroccan vector sample or quota verified. `copernicus-cropland`.                                                                                                                                                                          | **Not usable on present evidence.** Do not infer Moroccan vector coverage from the Copernicus name.                                                                                                                                     |
| **Google Dynamic World / Open Buildings; Microsoft Global Building Footprints** | Saved producer catalogues describe land-cover probabilities/classes or buildings. None is evidence of Moroccan agricultural field vectors. No field sample obtained.                                                                                                                                                                       | Dynamic World CC BY 4.0 according to its catalogue; other products have their own stated terms. Field-boundary licence, quotas and download size do not apply to these non-field products. `google-*`, `microsoft-buildings`.                                                                     | **Not usable as a field source.** Building or land-cover footprints cannot be relabelled as fields.                                                                                                                                     |
| **fiboa catalogue; FTW training benchmark; Lacuna Africa labels**               | Saved fiboa list has multiple country datasets and FTW; a standalone Morocco registry entry was not found in that saved list. The global FTW predictions above are distinct from benchmark labels. Lacuna AWS record describes Africa training labels, not complete Moroccan parcels. Moroccan coverage for those labels **not verified**. | fiboa is an interoperability schema/catalogue, not one blanket licence. Individual datasets vary, including non-commercial terms. Lacuna AWS listing names Planet NICFI participant licence, not unrestricted CC BY.                                                                              | **No additional usable national source verified.** Catalogue discovery is low effort; extrapolating training labels to missing fields would require the prohibited detector.                                                            |
| **GFSAD / GFSAD1000**                                                           | Saved official Earth Engine GFSAD1000 record is a global cropland extent product at 1 km. The requested USGS GFSAD30 Africa page failed TLS; its current access, licence and Moroccan data are **not verified here**.                                                                                                                      | Saved GFSAD1000 catalogue supplies its terms/access. No free field-vector endpoint or Moroccan parcel sample verified.                                                                                                                                                                            | **Not usable as individual boundaries.** Extent classification is too coarse/semantically different; no detector built.                                                                                                                 |
| **Moroccan national portals: data.gov.ma, ONCA, ORMVA, ANCFCC**                 | Saved CKAN parcel/cadastre/agriculture searches and ONCA landing page; no reusable national field vector download verified. ORMVA request failed certificate validation. ANCFCC plan page is a title-specific ordering form, requiring identity/title information, not a bulk open parcel API.                                             | Free bulk reuse licence, rate limits and country data size **not verified**. No purchase, form submission, or scraping of private land records performed. `morocco-portal*`, `onca`, `ancfcc*`; failed ORMVA request in retrieval log.                                                            | **Not usable on verified evidence.** This is a bounded search, not proof no government data exists. Obtaining a data agreement would require separate work.                                                                             |
| **Moroccan academic crop/irrigation ground truth (Ouassanouan et al.)**         | Saved paper and Figshare v2 metadata plus actual 832,851-byte shapefile RAR. Survey data, not wall-to-wall coverage. Window counts and extracted geometries in `academic-summary.json`/`academic-*.geojson`.                                                                                                                               | **Dataset** metadata says CC BY 4.0; the **article** separately says CC BY-NC-ND 4.0. Do not confuse the two. Free download; photos archive is over 17 GB and was not downloaded. `morocco-groundtruth*`.                                                                                         | **Useful for future validation/local reference, not a national selector.** Sparse survey coverage cannot fill all taps. No crop/irrigation attributes or photos imported.                                                               |
| **Segment Anything / SAM 2 / SamGeo; Mundi online tool**                        | Producer repositories document point/box segmentation and browser ONNX decoding. No automatic Moroccan field accuracy, minimum usable ground resolution, free production API or Moroccan sample verified. Mundi says own-area segmentation requires a paid subscription; free demos are fixed examples.                                    | SAM repository Apache 2.0; model/repository and imagery terms are separate. Open source code is not free hosted inference. Imagery, image embeddings, georeferencing and polygon cleaning would still be needed. `sam-*`, `sam2`, `samgeo`, `mundi-sam`.                                          | **Not usable as an existing free field service.** A site-specific segmentation pipeline would violate B2r. No model downloaded or run. Prefer imagery where edges are visibly resolved; no universal resolution threshold was measured. |

## Exact FTW access and measured sample sizes

The task names the release v1.1; a matching release identifier in the retrieved
metadata is **not verified**. The paper describes 3.17 billion polygons across both years and 241
countries/territories. The retrieved README instead says 1.63/1.58 billion and
195 countries; collection text says 219 countries/598 partitions. These are
**upstream differences**, not independently reconciled counts. The number of
countries is not evidence of local accuracy. The queried Morocco partition
actually has **9,585,681 records**. Year-specific counts and confidence counts
are saved in `samples/ftw-summary.json`. Do not add two years and call that the
number of distinct fields in Morocco.

Verified country asset base:

```text
https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=MA/Morocco
```

- `.parquet`: GeoParquet, EPSG:4326, **1,798,476,832 bytes** by saved HTTP HEAD;
  both years, geometry, bbox, id, determination date/method, area/perimeter,
  admin codes and confidence. Country records were actually queried.
- `.pmtiles`: **961,953,406 bytes** by HEAD; country STAC declares 2024/2025
  layers. Actual header/metadata and tile probes are in
  `samples/ftw-pmtiles.json`. Availability at zoom 14 must not be inferred from
  the catalogue description; use the stored geometries for our zoom-14 API.
- `.json`, `.README.md`, `.2025.style.json`, `.2024.style.json`, and
  `.confidence-2025.style.json` are linked by the saved country STAC item.
  The item and README were fetched; other style files were not individually
  verified. The root also lists global PMTiles, not needed for this backend.

This is a downloadable data source, not a guaranteed free live parcel-query
service. A selected-year local import avoids sending farmer taps to a provider.
The full-country Postgres footprint, import duration and query performance
are **not measured**. There is no recurring data charge verified, but running
our own server still consumes disk, time and electricity.

| Window       | FTW 2024 | FTW 2025 | OSM farmland / farmyard / orchard / vineyard / meadow | OSM mapped area as % of window |
| ------------ | -------: | -------: | ----------------------------------------------------- | -----------------------------: |
| Tadla        |      292 |      243 | 4 / 1 / 5 / 0 / 0                                     |                          65.90 |
| Beni Mellal  |      177 |      167 | 6 / 0 / 9 / 0 / 1                                     |                          92.63 |
| Gharb sample |      101 |      106 | 6 / 0 / 0 / 0 / 0                                     |                          94.57 |
| Souss sample |       16 |       21 | 0 / 0 / 0 / 0 / 0                                     |                           0.00 |
| Saiss sample |      167 |      220 | 5 / 0 / 3 / 0 / 0                                     |                          35.80 |

OSM percentages are the geodesic area of the **union of clipped mapped landuse
polygons divided by the window area**, including farmyards/meadow. They are
not field detection recall, not accuracy and not the percentage of actual
cropland mapped. Geofabrik national assembled area counts: farmland 31,326;
farmyard 4,160; orchard 20,144; vineyard 123; meadow 3,123; geometry conversion
failures zero. The downloaded PBF was 244,460,002 bytes; its MD5 matched the
saved upstream MD5; its SHA-256 and extraction method are saved in
`samples/osm-summary.json`. The large PBF stays in `/tmp`, not git; small real
extracts are preserved here. The saved download page dates data to
2026-11-09T21:22:17Z and also lists free SHP/GPKG alternatives.

Overpass query (replace bounds for each site; south,west,north,east):

```overpass
[out:json][timeout:45];
nwr[landuse~"^(farmland|farmyard|orchard|vineyard|meadow)$"]
  (32.39,-6.56,32.41,-6.54);
out geom;
```

Our Overpass request failed TLS in Python and a separate curl probe returned
an HTTP rejection page. Those failures are recorded; the reported counts come
from Geofabrik, **not from a successful Overpass response**. The public
Overpass policy describes shared resources and load shedding. The usage page
advises remaining below 10,000 queries and 1 GB/day on the main instance; that
is a fair-use guideline, not an entitlement or reliability promise.

## What the overlays show

Open [Tadla](overlays/tadla.png), [Beni Mellal](overlays/beni-mellal.png),
[Gharb](overlays/gharb.png), [Souss](overlays/souss.png),
[Saiss](overlays/saiss.png). Left: unmodified display of clipped Sentinel RGB;
centre: FTW 2025 yellow outlines; right: OSM cyan areas. Data are unfiltered in
these comparisons, so the report can expose defects rather than hide them.

At Tadla, many narrow rectangular strips are individually suggested, while
some long strips merge and textured areas contain irregular fragments. At Beni
Mellal, many visible crop blocks have plausible outlines, but some neighbouring
blocks merge and small irregular shapes are suggested around textured areas.
The OSM layer covers broad landuse areas in both sites, often spanning numerous
visible strips. High area coverage therefore does not make it a good selector.
Detailed orchard and small-field correctness remain **not verified** at 10 m.
Additional visual findings are recorded below. No source is presented as a legal parcel map.

The FTW confidence column is derived from a **500 m confidence raster**, then
rescaled to 0–100; it is not an individual boundary accuracy score. Null means
no value available. Our API divides known values by 100 and preserves null;
it must not be presented as “96% accurate”. The paper warns about transfer
outside training distributions and cell confidence cannot certify geometry.
No Morocco-specific accuracy number was verified.

## Farmer-facing recommendation, ordered by effort

1. **Nothing: manual outline only** is immediately usable without this dataset:
   painting cells, drawing, upload or a pin. Least data/hosting work; the farmer
   spends more time, but can handle missed or changed fields. This remains the
   fallback and is the recommendation wherever suggestions look wrong.
2. **Chosen: optional FTW 2025 suggestions, farmer confirms/edits.** Existing
   polygons provide useful starting shapes without building a detector.
   Moderate import/storage/refresh work and a visible “check this outline”
   requirement. Keep it off until an operator imports data and checks the area.
   Dropping polygons that fail validation leaves honest gaps. No silent
   point-seeded fallback and no “finding fields” computation state.
3. **OSM as a second field source: reject for now.** Low access cost but coarse
   landuse units can select many fields at once; licence administration adds
   work. A known large agricultural area is not a better answer to a missing tap.
4. **Academic survey polygons:** useful for a later, separately scoped reference
   study. Partial coverage and observation dates need careful handling. They
   should not silently outrank a national product merely because ground surveys
   exist. No validation study was authorized here.
5. **Build/host segmentation:** outside this task, high effort, imagery/compute
   and accuracy risks. No implementation of it is proposed or included.

The source decision is delegated and made here; the user need not choose a
provider. Remaining product questions for review: when to enable suggestions
in a demo; how much visual checking/ground validation to require before wider
use; whether future competition packaging includes a prepared country dataset
or downloads it separately; and when to commission a native-speaker review of
new glossary text. No answer is required to keep the switch off and finish the
backend. No automatic refresh or completeness/accuracy guarantee is made.

## Final visual and geometry review

Gharb: FTW divides many of the visible long strips, but sometimes merges
contrasting pieces within a strip. OSM outlines huge blocks bounded by roads
and includes many of those strips in a single polygon. Saiss: many small
visible plots have candidate outlines, with obvious irregular subdivisions and
merged blocks; OSM remains sparse. Souss: this particular centre is mostly pale,
dry ground in the selected scene, with only a small dark cultivated corner.
FTW includes a very large irregular component and tiny fragments; it is a poor
example of usable field selection. Do not generalize this one window to all
Souss or treat bare soil as proof of non-agricultural use.

The [Tadla comparison](overlays/tadla-comparisons.png) and
[Beni Mellal comparison](overlays/beni-mellal-comparisons.png) show the
**cleaned** FTW suggestions next to Sentinel RGB, DE Africa, WorldCereal,
WorldCover and academic geometry. The three extent maps show large connected
coloured regions rather than the internal divisions visible in RGB. No
field-vector count can be assigned to those raster colours. The academic
archive has **10,383 records, one null geometry**; only Beni Mellal intersects
these five windows (**13 survey polygons**, all other windows zero). The Beni
Mellal overlay shows plausible local surveyed outlines in one small cluster,
with most of the image uncovered. Detailed survey-vs-image correctness was
not measured. This supports its reference value but does not replace national
coverage. No private photos or survey attributes were published in the extracts.

The actual Morocco PMTiles header reports **maximum zoom 13**. Saved/decompressed
zoom-13 tile probes contain layers `2024` and `2025`: Tadla 515/618 vector tile
features and Beni Mellal 650/587. These larger tile counts are not comparable
to the smaller 0.02-degree windows, and tile geometry may be simplified/clipped.
A zoom-14 probe yielded no tile. Our own zoom-14 backend therefore uses the
GeoParquet shapes rather than pretending the upstream contains native zoom-14
vectors. Read endpoints never query the remote PMTiles or imagery.

The geometry cleaner was run on every 2025 polygon in the five saved windows.
This is a **format/geometry admission measurement, not accuracy**:

| Window       | Input | Retained | Dropped | Holes removed from retained shapes |
| ------------ | ----: | -------: | ------: | ---------------------------------: |
| Tadla        |   243 |      171 |      72 |                                 35 |
| Beni Mellal  |   167 |      121 |      46 |                                 31 |
| Gharb sample |   106 |       78 |      28 |                                 60 |
| Souss sample |    21 |        8 |      13 |                                  1 |
| Saiss sample |   220 |      168 |      52 |                                 57 |

See `samples/cleaning-summary.json` and `samples/cleaned-*.geojson` for
reproduction. Retained shapes pass `fieldBoundarySchema`; maximum measured
area change was below 2% in every window. Very small/large shapes, excessive
span/complexity, or shapes whose holes/simplification exceed the permitted
area change leave gaps. Dropped counts are not false-positive counts, and
retained counts are not correct-field counts. A high regional confidence can
coexist with visibly imperfect geometry.

For the excluded building/extent candidates, additional licence detail from
the saved producer pages: Google Open Buildings offers CC BY 4.0 or ODbL at
the user's choice; Microsoft building footprints use CDLA-Permissive-2.0;
GFSAD1000 is described as USGS public-domain data for 2010. None of those
licences makes the product a Moroccan field-boundary dataset. No source with
unverified reuse rights is imported into the service.

The saved OneSoil May 2026 freemium announcement (`onesoil-freemium`) lists
boundary download as a subscription feature and offers continued free app
access for academic/non-commercial users who contact the company. That offer
is **not a verified open licence to redistribute Moroccan boundaries** and no
contact was made. It does not change the source decision.

The fiboa data page's current redirect was followed to the actual harmonized
catalogue (`fiboa-harmonized.json.raw`), which lists country/research collections
and no dedicated Moroccan collection. This strengthens the catalogue finding,
but does not establish absence from every multi-country research collection.
The separate guessed `fiboa.org/portolan/catalog.json` URL returned 404; the
correct linked Source Cooperative catalogue was then fetched successfully.

## Dates, access limits and unmeasured sizes

Observation year, file modification time and last webpage update are different
things. The country FTW assets' saved HEAD responses report
**2026-06-21T20:19:47Z** for GeoParquet and **2026-06-21T20:19:58Z** for PMTiles;
these do not establish when any individual field was last checked. The
selected observations are 2025. No repeat publication schedule or request quota
was verified. The queried Morocco counts are 4,226,301 records for 2024 and
5,359,380 for 2025 (see the saved aggregate query output); records are not
necessarily correct individual fields.

OSM extract time is stated above; individual contributor edits have different
ages and parcel correctness was not measured. Its sample GeoJSON sizes are in
the ledger. Public Overpass has fair-use/load limits; Geofabrik is a download,
not a parcel lookup SLA. OneSoil's current get-data/API reuse terms and exact
update cadence/quotas/data size for Morocco remain **not verified**; the
Canadian open release is for 2023, and the mobile pricing announcement is
May 2026. No Moroccan data were received from it to measure size or quality.

DE Africa's sampled map is 2019 (documentation says modified December 2024);
WorldCereal and WorldCover sampled layers are 2021. Their WMS response byte
sizes are recorded, but those image sizes do **not** measure country download
size. No current WMS production quota/SLA was verified. Dynamic World is a
land-cover time series, while the building releases are imagery-derived
building footprints: exact current Moroccan field data size/update/quota are
not applicable because no field dataset was verified there. GFSAD1000's
reference year is 2010; no current GFSAD30 Morocco access was verified.

The academic survey covers December 2023–January 2025; the saved Figshare
metadata identifies version 2 and its publication/modification timestamps.
It is a finite archive, not an updating vector API. There is no promised update
schedule or quota verified. The national portals and remaining fiboa datasets
have no verified national Moroccan field layer here, so Moroccan field vector
size/date/quotas remain **not verified**. SAM/SAM 2/SamGeo provide software,
not an updated Moroccan polygon collection; a minimum imagery resolution and
free hosted production capacity for this use remain **not verified**.
