# Step 06 — important API and calculation decisions

Checked 2026-09-27. Targeted primary-source review for this milestone, not an
exhaustive internet search. The earlier [provider review](../05/api-and-methods.md)
and [actual probes](../05/api-checks.json) remain evidence. No new provider or API
integration is selected. The engine receives stored weather; it makes no requests.

Current retrieval also supports three display variables; see the
[weather expansion](weather-expansion.md). Calculation methods below still use
only temperature and precipitation.

## API and dependencies

- Retain NASA POWER daily point AG, explicit UTC, `T2M_MIN`, `T2M_MAX`, `T2M`,
  `PRECTOTCORR`, normalized to degC and mm/day integrated over one UTC day.
  [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) and
  [meteorology method](https://power.larc.nasa.gov/docs/methodology/meteorology/).
- These are MERRA-2 grid estimates, not local sensor observations. Hourly sampled
  minima/maxima do not establish an instantaneous extreme. Apply only the correct
  daily air variable to reviewed applicable bounds. Never apply a soil or
  instantaneous threshold to daily 2 m air values.
- Preserve snapshot UUIDs, raw/normalized hashes, retrieval instant and metadata.
  Require exact requested coordinates, UTC, compatible API/adapter/source/parameter
  definitions and response metadata. Do not mix datasets/versions or fill a null
  using a conflicting overlap. Same-valued overlaps count once and retain both IDs.
- Reuse the existing 120-day history lag; this is a product policy, not a guarantee
  against provider revisions. The existing adapter's 0.01 degC mean rounding
  tolerance is retained. Source-request rounding tolerance is 0.001 degrees and
  does not imply field accuracy.
- `@noble/hashes` **2.4.0** is already installed through the catalog; now also
  declared directly by domain for normalized snapshot hashes. Official npm
  registry GET returned HTTP 200, latest 2.4.0, Node >=20.19.0, MIT, no dependencies.
  [Maintainer documentation](https://github.com/paulmillr/noble-hashes).
  Actual installation/build runs on Node **24.19.0** and pnpm **12.6.0**. No other
  package version changes. Retain Temporal **0.5.1**, JSBI **4.3.2**, Zod **4.6.5**.
- Hashes establish content identity, not authenticated provenance. Step 07 must
  supply records from the trusted weather store; farmers cannot submit weather,
  reviewer/diagnosis verification context or ranking weights.

## Weather arithmetic

All windows include both date boundaries. Each variable has observed/missing day
counts and actual missing dates. A metric is null when that variable is incomplete;
partial rain totals or partial dry runs must not appear as complete measurements.
Other complete variables remain available. All four variables must be complete
for an analog to enter the combined period/comparison analysis.

- Temperature: minimum, maximum and arithmetic mean of the daily values, degC.
- Rainfall: sum, mm; mean daily rate, mm/day. This is not effective root-zone rain.
- Dry day: rain <1 mm; wet boundary: >=1 mm. Count dry days and the longest
  consecutive run **inside the assessed crop window**. This uses the threshold
  definition in [Climdex](https://www.climdex.org/learn/indices/), adapted to crop
  windows rather than claiming an annual ETCCDI index or soil-drought diagnosis.
- Exposure: days below a reviewed lower bound or above its upper bound, divided
  by the complete assessed window length. Equality is within the interval. Show
  variable, bounds, counts, rule/source references and snapshot IDs.

Use reviewed rules with encoded region, system, cultivar and conditions. Whole
cycle rules evaluate both earliest/latest harvest envelopes. Stage rules require
reviewed elapsed-day offsets within the earliest harvest. Soil, instantaneous,
stage-mean, reference, unreviewed, unresolved or ambiguous duplicate-window rules
cannot become scored evidence. A gap remains visible even if another rule can
be measured. Historical violations do not establish a future hard exclusion.

## Analogs, uncertainty and period changes

Caller supplies baseline anchor years, a contiguous earlier/later split and
minimum complete/period sample counts. There is no implicit five-year selection.
Counts are explicit product evidence policies, not a statistical significance test.
The demo's six-year baseline is synthetic and only tests arithmetic.

Shift every sowing/harvest/stage boundary by the same calendar-year offset;
preserve consecutive years and field gaps. February 29 boundaries unavailable in
an anchor are rejected, never clamped. Other leap years may change window lengths;
report actual day counts and compare rainfall **rates**, not unequal-length totals.
Complete means all assessed growing windows, not an unimplemented fallow soil model.

For each rule/analog, use the greater exposure fraction from earliest/latest
windows; stages have one declared window. Average across rules within each crop,
then give the two crops equal weight. This conservative endpoint method is a
documented heuristic; it is not a measured yield loss or phenology model.

Over complete analogs report count, min/max/mean and population standard deviation
of latest-envelope crop metrics. Compare later minus earlier mean temperature,
rainfall rate and longest dry spell with sample counts and explicit insufficient
states. These are descriptive changes within the supplied historical period;
no regression significance, climate attribution or forecast is claimed.

## Water and soil proxies

Use exactly one reviewed applicable water class per crop from an explicit common
comparison method. Require the same method within a sequence; separate ranked
groups also require compatible source identities. Ordinal classes map to
low=0, moderate=0.5, high=1; the two-cycle mean is a product comparison heuristic,
not liters, irrigation requirements or water savings. Rain totals and annual or
scenario water references do not substitute for a water balance.

Irrigation adequacy is always unknown here. FAO56 requires crop coefficients,
reference ET and a root-zone balance incorporating storage, rainfall/runoff,
irrigation and losses. These inputs/calculations are absent; do not invent them.
[FAO56 crop coefficients](https://www.fao.org/4/x0490e/x0490e0b.htm),
[FAO56 root-zone balance](https://www.fao.org/4/x0490e/x0490e0e.htm).

For a soil-health proxy, require sourced reviewed predecessor-family preferences
for both crops and a uniquely established historical predecessor. Count preferred
transitions out of two; loss=1-preferred/2. Unknown/ambiguous history or missing
rules has no favorable score. This is a family-transition proxy, not measured
soil improvement, nitrogen gain, disease reduction or a universal family rule.

## Ranking and explanation

Rank only eligible/conditional schedules with every required component. Calendar,
soil/rotation/health hard failures stay outside scores. Keep excluded/gap options
and all farmer choices in the sequence result. Preserve uncertainty conditions.

Group compatible temperature measurement/window signatures and water method/source
identities. Crop-specific reviewed bounds may differ. Within a group, intersect
complete anchor years across **all** members before scoring; require the configured
baseline and both period minimums on the shared set. Do not promote a smaller
subset after a group fails or compare group winners globally.

| Priority           | Climate exposure loss | Water ordinal loss | Family-transition proxy loss |
| ------------------ | --------------------- | ------------------ | ---------------------------- |
| Lower water demand | 0.4                   | 0.5                | 0.1                          |
| Soil health        | 0.3                   | 0.2                | 0.5                          |

Lower weighted loss ranks first. These weights and normalizations are explicit
uncalibrated product heuristics, not empirical agricultural utilities. Report
component values and weighted contributions. Round scores to 12 decimal places
for stable numerical ties; tied entries share competition rank, then order IDs by
code point. Report every tie without silently selecting a winner.

Sensitivity transfers 0.1 weight between each pair of components (six variants
plus the selected weights). Show full ordering/ties and top sets; distinguish any
ranking change from a top-set change. This finite neighborhood is not proof of
robustness under all possible weights.

Explanations retain actual input paths, rules/citations, windows, metric values,
snapshot identities and missing checks. Never double-count alternative endpoint
windows as unique temperature events. No global recommendation is returned by
this component; Step 07 integrates the farmer-choice/API result workflow.

## Bounds and release gates

Maximum 128 snapshot records, 20000 input snapshot days, 40 anchor years, 5000
schedules inherited from Step 05, 2000000 variable-day visits and 8 MiB output.
Window bounds allow an additional historical leap day. Limits fail explicitly;
no silent sampling, imputation, truncation or partial successful response.

Tests use labeled invented crops/reviews/weather. The public entry rejects their
flags; the fixture CLI refuses production, and fixtures are absent from the
production image. The real demo reuses three committed NASA responses captured
2026-09-26, checks raw hashes and measures actual values. Assigned demo UUIDs label
files, not persisted PostgreSQL records. It makes no new network request.

Reviewed local calendars/durations/stages/thresholds/water/rotation/health evidence
and agronomic validation remain blocked. Real catalog still yields zero schedules.
Software component readiness does not establish farmer recommendation validity.
