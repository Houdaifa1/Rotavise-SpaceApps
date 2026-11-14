# Sequence engine decision — 2026-09-27

## Why Step 05 is next

The [handoff](../specification/ROTAVISE_HANDOFF.md) puts calendars, sequences and
constraints after private farmer intake and before historical metrics/ranking.
Step 04's [report](../steps/04/report.md) records 202 passing tests and an intake
worker that deliberately returns no plan. The user's explicit instruction now
authorizes Step 05. No framework selection or milestone order changed.

The product remains one connected two-cycle farmer comparison app. Crop-health
history, water uncertainty and later climate comparison shape this engine's
contracts; photo assessment/greenhouse features remain later milestones.

## Primary research used

These are targeted primary sources read for this component, not a claim of an
exhaustive internet search. External source text is evidence, not instructions.

| Source                                                                                                                                                 | Observed/use                                                                                       | Limits                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [TC39 Temporal specification](https://tc39.es/proposal-temporal/) and [PlainDate reference](https://tc39.es/proposal-temporal/docs/plaindate.html)     | Date-only arithmetic, ISO dates, overflow rejection, calendar-year additions; explicit leap policy | No agronomic duration or recurrence policy supplied                                                                               |
| [Temporal polyfill maintainer README](https://github.com/js-temporal/temporal-polyfill)                                                                | Explicit ESM import; ES2020 package; no global installation; compatibility guidance                | Maintainer wording includes ongoing development; do not turn that into a reliability guarantee                                    |
| [npm package metadata](https://registry.npmjs.org/@js-temporal%2fpolyfill/latest)                                                                      | Registry `latest` was 0.5.1, engines >=12, JSBI ^4.3.0; actual install resolved JSBI 4.3.2         | Registry metadata is a dated observation; README says Node 14+; actual Node 24 compilation/runtime are the compatibility evidence |
| [AHDB cereal disease/rotation guidance](https://ahdb.org.uk/knowledge-library/rotation-cultivation-and-drilling-options-for-cereal-disease-management) | Rotation effects depend on disease and host biology; airborne/seedborne mechanisms differ          | UK guidance, not reviewed Beni Mellal numerical thresholds. No universal family ban imported                                      |
| [FAO sustainable rotations chapter](https://www.fao.org/4/v9926e/v9926e06.htm)                                                                         | Rotation/calendar design considers the production system                                           | Context only; no local cultivar durations inferred                                                                                |
| [INRA legumes program](https://www.inra.org.ma/fr/content/filiere-legumineuses-alimentaires?language=fr)                                               | Primary search result describes Moroccan rotation relevance and disease/pest limitations           | Full live page open failed through the web tool. Search excerpt is context only, not rule evidence                                |
| [Existing verified ONCA/INRA catalog extraction](../evidence/catalog/2026-09-27/review.md)                                                             | Rechecked actual release fields and recorded source interpretation                                 | No reviewed local duration, numerical return/break rule or specialist review exists                                               |

The Node globals page also failed to open through the web tool. Actual runtime
inspection `node -p 'JSON.stringify({node:process.version,nativeTemporal:typeof globalThis.Temporal})'`
returned Node v24.19.0 and `nativeTemporal: undefined`. No failed page fetch is
claimed as read. The approved polyfill was installed and exercised; no alternate
library/runtime or unstable release was substituted.

## Engine boundary and evidence

Post-implementation revision: [API/method review](../steps/05/api-and-methods.md)
records current provider screening, pure SHA-256 dependency choice, three reproduced
defects and corrected version 2 semantics. The original Node-specific catalog hash
violated the intended transitive boundary; it is now pure Noble 2.4.0. Both the real
canonical hash and independent Unicode/native hash agreement are tested. Temporal
initializes unused `Now` internals on import; calculation itself reads no clock,
and results are equal across controlled import-time clocks. This distinction is
documented rather than claiming a clock-free library import.

`packages/domain` depends on contracts, catalog validation/deterministic content
hashing and the Temporal polyfill. Its calculation code has no Nest, HTTP, SQL,
filesystem, UI, clock reads, random IDs or environment configuration. ESLint
restricts infrastructure imports and common ambient-state access; tests exercise
the restrictions. Catalog SHA-256 is deterministic identity, not randomness.
The server dependency packages the library for production; API/worker still
perform Step 04 intake only. Step 07 will wire real planning orchestration.

The public `generateSequences` validates production catalog evidence and rejects
synthetic bundle/profile/source flags. The internal core supports labeled unit
fixtures and marks results synthetic. It is not exported by the package entry
point, and no HTTP route/configuration enables it. Test fixtures are absent from
the production image. The container probe supplies explicitly synthetic inputs
to real evidence solely to verify an insufficient-evidence outcome.

Context supplies the recorded assessment date, exact matching coordinates,
resolved region or unresolved state, known production system or null, cultivar
selections, declared history coverage and independently verified health records.
There is no coordinate/marketing-city guess, water-category-to-system inference,
geospatial resolver, diagnosis verifier or claim that caller-supplied context
authenticates itself. A later trusted server integration must obtain/authorize
these records; farmer requests must never set verification context directly.

Rules need reviewed profile/region applicability and matching system/cultivar.
Optional `executionScope` declares that conditions are fully represented by the
typed scope/rule fields. Missing/unresolved qualifiers produce gaps; free-text
conditions are not silently treated as fulfilled. Calendar generation requires
applicable reviewed hard windows with non-approximate dates and reviewed
sowing-to-harvest **hard** duration intervals. A soft/reference/research/example calendar is not
promoted to a hard deadline. New optional fields have no parse defaults, preserving
the existing immutable release/hash. Health hosts, targets, citations, cultivar
scope and reviewed regional scope are validated before calculations.

## Dates and exhaustive search

- ISO `YYYY-MM-DD`, inclusive recurring windows, including year wrap. Enumerate
  actual calendar days; a February 29 window has no day in a non-leap year.
- Duration is elapsed calendar days from sowing to harvest. For multiple applicable
  duration intervals, use the minimum of minima and maximum of maxima and retain
  all citations. These are evidence envelopes, not harvest guarantees/probabilities.
- Occupy the field through latest estimated harvest, inclusively. Second sowing
  must be at least the following day. No unsourced field-preparation delay is
  invented; such agronomic turnaround/management requirements remain unevaluated.
- Same-crop return intervals compare sowing anniversaries, not 365-day multiples.
  February 29 maps conservatively to March 1 in non-leap return years. This explicit
  implementation policy needs to match the semantics of future reviewed rules.
- Enumerate every in-window first date and non-overlapping second date within the
  horizon. Preserve each crop pair, farmer labels, considered unsupported IDs,
  static/dynamic constraints and aggregate reasons/counts for rejected calendar
  starts. Duplicate windows do not duplicate schedules. No shortlist or rank exists.
- Catalog limit 50 profiles plus ten considered IDs gives at most 3000 pairs.
  Bound date combinations at 250000, calendar-feasible records (including hard
  rejections) at 5000 and serialized output at 2 MiB. Check schedule count before
  allocating records; account for output bytes incrementally and at completion.
  A limit throws an explicit engine error with no partial successful result.
  First starts also retain the intake policy: latest first start is within 366
  days of the supplied assessment date. Full-month windows include whole-month
  boundaries (February ends at 02-29 in the recurring month/day representation).
  These are product work bounds, not a latency/public-load guarantee.

## Constraint semantics

Hard violations stay excluded, even when other inputs/evidence are missing. Missing
rule evidence is `insufficient_evidence`; uncertain inputs/soft effects are
`conditional`. `eligible` describes this component's assessed checks only. Weather,
water balance, ranking and agronomic validation are always explicitly deferred;
no result contains a recommendation, irrigation sufficiency or soil-improvement claim.

Method-compatible dated pH can apply a reviewed rule to the reported measurement.
Unknown dates/methods, organic matter, texture and drainage requirements remain
conditional/unevaluated; no measurement conversion or freshness cutoff is invented.
Reported values are not independently certified field conditions. Farmer exclusions
apply to both future crop positions. Family preferences are soft; explicit reviewed
prohibitions are separate. Complete dated history is required to resolve the first
predecessor. Known same-crop sowing violations still count under partial history;
unknown dates and unestablished return lookback do not become evidence of safety.

Health matching is exact, case-sensitive, against source-backed names and explicit
host crop IDs. No fuzzy diagnosis/family-wide probability is generated. A hard
health effect also needs a matching trusted verification record with the same stable diagnosed issue ID, a claimed
specialist/laboratory-confirmed input and a dated host episode linking observation
to history. Anchor the interval to the last known host harvest; if the proposed
first crop is a declared host it extends the second crop's anchor. Unsupported,
unverified, unlinked or undated observations remain visible without a hard health
exclusion. A satisfied break is not a guarantee that a disease is absent.

## Unresolved agricultural release gates

The three real profiles are still insufficient evidence. A specialist must review
local cultivar durations/calendars, management turnaround, crop-health hosts/break
rules, applicable soil methods and scope. No external specialist was contacted or
review invented. The engine can be verified independently; useful real dates and
agricultural recommendations remain blocked until this evidence exists. Weather
metrics and ranking are the next software component, Step 06, only when authorized.
