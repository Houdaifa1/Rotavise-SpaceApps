# B7 — regional ranking and per-rotation climate comparison

User-authorized backend follow-up, verified on 2026-11-12. **All changes remain
uncommitted and unpushed.** No files under `apps/web`, immutable catalog
releases, historical evidence, dependency locks or migration history changed.
Only the consolidated `rotavise` application database was used for real regional
reads; older application databases were not modified. Required integration
suites use disposable real PostgreSQL 18 containers.

The new pinned policy fixes disappearance of mainstream crop options and the
all-finalists climate gate. It does **not** establish locally validated advice:
several leading minor-crop sequences still look agronomically questionable to
me. Their ranks and my explicitly unverified assessment are retained below.
No milestone approval, deployment or production-readiness claim is recorded.

## Diagnosis with real data

Read: B5/B6 notes, the three unrestricted B6 regional cases and original
`backend-after.json`, DECISIONS “Fair ranking”, “Near-term” and “Model worlds”,
the specification, structure guide, AGENTS/CLAUDE and rotation-domain code.
The preserved [initial baseline](../../evidence/live/2026-11-12-b7/initial-baseline.json)
reproduced the six-crop outcome with the real engine/catalog/POWER/model tiles.
The final [evaluation JSON](../../evidence/live/2026-11-12-b7/regional-eval.json)
contains normalized independent requests, all policy pins, timings, per-crop
placement/rejection/rank data, raw-source digests and complete candidate coverage.

B6 recorded national-only planting/cycle guidance for 165/165 Souss-Massa,
167/169 Gharb and 165/166 Oriental schedulable crops. Those are the dated B6
evidence counts; B7 does not add local agronomic facts or alter that catalog.

The failure was a chain, rather than a missing tile:

1. All 165–169 schedulable crops in the three regions share two ranked kinds:
   daily-minimum air/cold and daily-maximum air/heat. Extra mean-temperature
   checks are left out. Mainstream crops were **not** losing because the final
   score counted more check kinds for them. Actual stages/limits differ and
   evidence quality differs; equal kinds do not establish equivalent agronomic
   confidence or calibrated yield risk.
2. The 150-per-view / 25-per-first-crop beam kept thousands of near-duplicate
   finalists and hit 2,000,000 expansions. Most mainstream first crops still
   had 25 finalists, all tied at rank 1 after climate and water dropped out.
   Their disappearance was principally an output-selection/size failure,
   not total pruning of every mainstream path. Search's available-dimension
   normalization and mixed FAO/ordinal water estimates also differed from
   final comparison rules and could bias pruning.
3. Historical work exceeded the nominal 80-million accounting ceiling:
   temperature checked it, while water/extremes continued accumulating visits.
   Complete historical climate disappeared; mixed water methods prevented
   water comparison. Remaining soil/health losses tied at zero. Lexicographic
   ordering then favored amaranth-based sequences.
4. The output added up to 500 Pareto ties and copied full catalog research,
   slot conditions and citations repeatedly. Its size loop discarded unprotected
   first-crop choices, including explicitly considered crops, down to a handful
   of strategy candidates. The old 2 MiB target was itself unattainable with
   some mandatory research/strategy payloads; the preserved old results remain
   valid historical behavior.
5. Future comparison first required every historical finalist to have climate.
   The live failure exited there with `CLIMATE_NOT_COMPARED`, before comparing
   complete stored model tiles. A second all-or-nothing gate inside each model
   world rejected the whole world if any finalist lacked a comparison. New
   per-candidate tests exercise both gates independently.

| Region (suggest) | Schedulable | Old finalists | Old expansions / pruned | Old accounted day visits | Old ranked crop IDs                               |
| ---------------- | ----------- | ------------- | ----------------------- | ------------------------ | ------------------------------------------------- |
| Souss-Massa      | 165         | 3389          | 2000000 / 723739        | 162213111                | amaranth, berseem, arugula, chard, cowpea, endive |
| Gharb            | 169         | 3351          | 2000000 / 751409        | 200105819                | amaranth, berseem, arugula, chard, cowpea, endive |
| Oriental         | 166         | 3377          | 2000000 / 696701        | 178138574                | amaranth, berseem, arugula, chard, cowpea, endive |

### Every requested mainstream crop

The following cells are **old first-crop finalists → new shown first-crop
options (new best rank)** in suggest mode. Exact losses, source rule ids,
windows, durations and both modes are in the evaluation JSON; the linked
regional summary also counts every displayed rotation containing each crop.

| Crop        | Tadla                | Souss-Massa          | Gharb             | Oriental             | Saiss                | Haouz                |
| ----------- | -------------------- | -------------------- | ----------------- | -------------------- | -------------------- | -------------------- |
| durum-wheat | 25 → 1 (rank 178)    | 25 → 1 (rank 56)     | 25 → 1 (rank 46)  | 25 → 1 (rank 142)    | 25 → 1 (rank 99)     | 25 → 1 (rank 118)    |
| bread-wheat | 25 → 1 (rank 178)    | 25 → 1 (rank 56)     | 25 → 1 (rank 46)  | 25 → 1 (rank 142)    | 25 → 1 (rank 99)     | 25 → 1 (rank 118)    |
| barley      | 25 → 1 (rank 181)    | 25 → 1 (rank 61)     | 25 → 1 (rank 71)  | 25 → 1 (rank 146)    | 25 → 1 (rank 176)    | 25 → 1 (rank 175)    |
| lentil      | 0 → 0 (window)       | 0 → 0 (window)       | 0 → 0 (window)    | 0 → 0 (window)       | 0 → 0 (window)       | 0 → 0 (window)       |
| chickpea    | 25 → 1 (rank 15)     | 25 → 1 (rank 65)     | 25 → 1 (rank 55)  | 28 → 1 (rank 65)     | 25 → 1 (rank 202)    | 25 → 1 (rank 203)    |
| faba-bean   | 25 → 1 (rank 163)    | 25 → 1 (rank 168)    | 25 → 1 (rank 163) | 25 → 1 (rank 134)    | 25 → 1 (rank 162)    | 25 → 1 (rank 163)    |
| maize       | 25 → 1 (rank 118)    | 25 → 1 (rank 93)     | 25 → 1 (rank 85)  | 25 → 1 (rank 73)     | 25 → 1 (rank 119)    | 25 → 1 (rank 117)    |
| sunflower   | 0 → 0 (calendar gap) | 0 → 0 (calendar gap) | 25 → 1 (rank 74)  | 0 → 0 (calendar gap) | 0 → 0 (calendar gap) | 0 → 0 (calendar gap) |
| potato      | 25 → 1 (rank 172)    | 25 → 1 (rank 169)    | 25 → 1 (rank 149) | 25 → 1 (rank 130)    | 25 → 1 (rank 174)    | 25 → 1 (rank 169)    |
| tomato      | 25 → 1 (rank 188)    | 25 → 1 (rank 177)    | 25 → 1 (rank 171) | 25 → 1 (rank 149)    | 25 → 1 (rank 194)    | 25 → 1 (rank 193)    |
| olive       | 0 → 0 (orchard)      | 0 → 0 (orchard)      | 0 → 0 (orchard)   | 0 → 0 (orchard)      | 0 → 0 (orchard)      | 0 → 0 (orchard)      |

- Wheat (both), barley, chickpea, faba bean, maize, potato and tomato have a
  feasible first placement in all six requests and now keep a comparison at
  their measured rank. All had viable old finalists in the three original
  regions, but no old shown starting option. No preferential score was added.
- Lentil is schedulable but its applicable irrigated first window ends November
  15, before the declared November 17 start. `FIRST_WINDOW_OUTSIDE_RANGE`
  explains zero first placements in every region. Later lentil slots remain
  searchable and appear in some outputs; absence from other displayed rotations
  is a bounded-search outcome, not proof every later lentil sequence was tested.
  A unit case with an earlier first-date range verifies lentil first-crop retention.
- Sunflower has usable applicable calendar evidence in Gharb and is retained
  there. The other five requests retain `CALENDAR_EVIDENCE_UNAVAILABLE` /
  `RULE_OUT_OF_SCOPE`; no national calendar was invented to fill those gaps.
- Olive is an orchard profile and `unsupported_for_plan` in this annual-rotation
  engine in all six regions. It was not silently converted into an annual crop.

A read-only replay of existing income derivations found no complete rotation
income scenario in any displayed candidate in these six suggest runs
([income coverage](../../evidence/live/2026-11-12-b7/income-coverage.json)).
The requested income weight therefore does not reorder those candidates.
No current price, profit or crop boost was supplied to change the outcome.

### Calendar, duration and evidence asymmetry

These are the **existing accepted catalog values**, not new B7 advice. Extracted
reference-only alternatives are not promoted. The evaluation's
`representativeEvidence` records regional accepted rules and verification tiers.

| Crop        | Accepted cycle days in Souss-Massa | Cycle provenance | Accepted temperature checks                                  |
| ----------- | ---------------------------------- | ---------------- | ------------------------------------------------------------ |
| amaranth    | 90–150                             | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| berseem     | 180–240                            | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| arugula     | 30–50                              | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| chard       | 60–120                             | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| cowpea      | 70–120                             | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| endive      | 70–100                             | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| durum-wheat | 165–240                            | double_checked   | daily_minimum: double_checked; daily_maximum: double_checked |
| bread-wheat | 165–240                            | double_checked   | daily_minimum: double_checked; daily_maximum: double_checked |
| barley      | 165–200                            | double_checked   | daily_minimum: double_checked; daily_maximum: double_checked |
| lentil      | 170–170                            | double_checked   | daily_maximum: double_checked; daily_minimum: model_recall   |
| chickpea    | 100–130                            | model_recall     | daily_minimum: model_recall; daily_maximum: model_recall     |
| faba-bean   | 235–235                            | double_checked   | daily_minimum: double_checked; daily_maximum: model_recall   |
| maize       | 150–150                            | double_checked   | daily_maximum: double_checked; daily_minimum: model_recall   |
| sunflower   | unavailable                        | unavailable      | unavailable                                                  |
| potato      | 80–150                             | double_checked   | daily_minimum: double_checked; daily_maximum: model_recall   |
| tomato      | 135–145                            | double_checked   | daily_minimum: double_checked; daily_maximum: double_checked |
| olive       | unavailable                        | unavailable      | unavailable                                                  |

Rocket's recalled 30–50-day cycle, for example, contrasts with sourced wheat's
165–240 days and faba bean's 235 days. Shorter recalled cycles can pack many
slots into a maximal three-year rotation. Return-interval/predecessor rules are
still hard or soft exactly as the catalog says; repeated soft violations remain
conditions, rather than an invented penalty. National or recalled windows do
not become locally validated merely because a sequence fits. These differences
help explain the remaining odd winners. B7 changes no agronomic value, citation,
calendar, verification tier or source release.

## Implemented behavior and compatibility

[Regional comparison contract and policy](../../architecture/regional-comparison.md)
documents the additive fields and selection rules. New requests pin
`comparison: regional-comparison-1` in the existing protected versions/hash.
The historical exported policy stays unchanged; absent pins retain the old
search, arithmetic and serialization. No migration is required.

The new default retains 60 per scoring view and one per first crop, instead of
150 and 25. Per-crop diversity is stronger than just reserving a family winner:
each feasible first crop keeps its best finalist and actual rank through output
trimming. Narrowing redundant branches avoids truncation and frees work for
real comparisons. Search neutralizes missing components consistently across
partials and excludes mixed water methods just as final ranking does. It skips
water estimates when no search view uses them. The current-rotation path uses
the same check selection. The latest known same-crop sowing supplies the most
restrictive return-date warning, with one unknown-date warning if needed.

Pure per-source calendar lookups are memoized under this policy, including
invalid-calendar nulls. A regression checks identical calculated values with
fewer source lookups, while day-visit accounting stays unchanged.

Each candidate now records every requested period/model/scenario in
`future.comparisons`, using existing unavailable reason codes. A candidate
receives numerical changes only for its own complete model baseline and future;
other candidates cannot erase that comparison. No missing climate loss is filled
from other rotations in these future blocks. Verified partial unit reads are
pinned independently; missing mid-century worlds no longer prevent near-term
retrieval. Model baselines remain separate from POWER and are reused across
periods. A missing model water balance removes water from that world's common
ranking weights; it never substitutes historical POWER water. Applied weights
and compared/not-compared candidate counts are exposed per world. Partial
universes make top-stability unknown.

Block status remains `compared` only when at least one candidate/world was
compared. There is no new partial-status enum. Runtime refinements check the
candidate ledger, counts and status consistency. Contracts are additive with
no defaults for old results; OpenAPI is regenerated. Glossary 7 explains these
semantics and evidence references in en/fr/ar/ary; translations remain explicitly
machine-written and unreviewed.

Full research, repeated citations and shared crop conditions resolve through
explicit `pinned_catalog` / `assessment_crops` references, instead of silently
removing evidence. The immutable catalog id/version/hash and rule ids remain;
recall still has `verificationStatus: model_recall`. Numerical vulnerability
reports keep their own availability. New output targets 7 MiB within the
existing 8 MiB storage limit; all first-crop representatives survive size trimming
in the verified requests. Ties retain their rank and up to ten peer ids.

## Six-region real evaluation and performance

Run:

```sh
ROTAVISE_CONFIG_ENV_FILE=/Users/houdaifadrahm/projects/rotavise_project/.env pnpm test:regional-eval
```

The command uses B6's private real-database role/completeness helper. Reference
catalog/model tables are read-only. POWER is live on the first request; later
runs revalidate saved original response bytes and hashes. Use
`pnpm test:regional-eval --refresh-power` to request fresh provider responses.
The environment file is consumed by the existing loader and was not printed,
inspected or edited. No new account or credential was needed. Local POWER
response cache is `.artifacts/b7/power`; in-memory weather identifiers are
content-derived UUIDs for this evaluator, not claims of persisted weather rows
or production plans. Model series use actual verified stored unit identities.

All positions use catalog 0.15.0, illustrative pH 7, irrigation with unknown
allocation, unknown history/health, three years and 2026-11-17..2027-05-03 first
sowing dates. Consider declares the eleven mainstream crop IDs above; it is not
a whitelist for later rotation crops. No measured farm data was fabricated.
Engine timings include validation, calculation, result construction and runtime
contract validation; database/raw-byte/provider preparation is outside that timer.
The command's wall time and timestamps are in the ledger.

| Region / mode          | Before seconds | After seconds | Old / new finalists | Old / new first crops | After future / near term | After bytes |
| ---------------------- | -------------- | ------------- | ------------------- | --------------------- | ------------------------ | ----------- |
| Tadla / suggest        | 8.919          | 4.993         | 3303 / 326          | 1 / 115               | compared / compared      | 7141268     |
| Tadla / consider       | 8.331          | 4.693         | 3303 / 326          | 1 / 115               | compared / compared      | 7143292     |
| Souss-Massa / suggest  | 7.914          | 4.612         | 3389 / 295          | 1 / 114               | compared / compared      | 7308453     |
| Souss-Massa / consider | 7.766          | 4.488         | 3389 / 295          | 1 / 114               | compared / compared      | 7310531     |
| Gharb / suggest        | 7.805          | 4.148         | 3351 / 302          | 1 / 117               | compared / compared      | 7112807     |
| Gharb / consider       | 9.038          | 4.158         | 3351 / 302          | 1 / 117               | compared / compared      | 7114954     |
| Oriental / suggest     | 7.611          | 4.233         | 3377 / 301          | 1 / 114               | compared / compared      | 6926787     |
| Oriental / consider    | 8.154          | 4.253         | 3377 / 301          | 1 / 114               | compared / compared      | 6928700     |
| Saiss / suggest        | 8.194          | 4.579         | 3281 / 312          | 1 / 114               | compared / compared      | 7237105     |
| Saiss / consider       | 8.826          | 4.921         | 3281 / 312          | 1 / 114               | compared / compared      | 7239188     |
| Haouz / suggest        | 8.557          | 5.030         | 3440 / 337          | 1 / 115               | compared / compared      | 7202608     |
| Haouz / consider       | 8.692          | 5.850         | 3440 / 337          | 1 / 115               | compared / compared      | 7204686     |

New-policy median 4.596 s; range 4.148–5.850 s on the recorded host.
The [regional summary](../../evidence/live/2026-11-12-b7/regional-summary.md)
records the top three named rotations for every region/mode, per-crop numerical
before/after tables, model/period coverage, unavailable reasons and my qualitative
agronomic judgment. The JSON retains the top five and every displayed candidate's
complete ledger. Missing detailed exposure counts and work by phase are explicit.

**Agronomic judgment (model recall, unverified):** the winners often combine
rocket, amaranth, berseem, minor forages or short-cycle vegetables. I do not
consider those convincing generic farm recommendations for the six regions.
Some components are plausible in a deliberate intensive vegetable/forage system,
but unknown irrigation allocations, markets, labor and unreviewed recalled rules
cannot justify an automatic recommendation. Wheat/barley/pulse and applicable
summer-crop alternatives are now fairly retained, with their actual scores.
No artificial boost makes them look like numerical winners. Expert/local
validation and better reviewed crop evidence remain necessary.

## Tests and verification

The [verification audit](../../evidence/live/2026-11-12-b7/verification.json)
confirms all 12 real legacy result hashes and all 24 pre/post-calendar-cache
result hashes match, with explicit size/work/timing and protected-path checks.

Unit regressions cover mixed candidate completeness, missing model worlds,
near-term survival without mid-century, no fabricated gap scores, honest block
statuses, no POWER water fallback, water-work skipping, response size/diversity,
explicit recall provenance and policy consistency. Real PostgreSQL regressions
cover verified partial reads/corrupt bytes, pinned model ledgers, owner reads and
completed-result replay. Existing full-result golden hashes for older catalogs,
engines, policies, exhausted budgets and futures remain unchanged; the new-policy
unit case also reruns an old 0.15.0 pin after the new one to catch cache leakage.

Every required command is listed below with a real process exit code. Full logs
stay under `.artifacts/b7/logs`; the timestamped [command ledger](../../evidence/live/2026-11-12-b7/commands.json)
retains failures and retries. No check was piped into tail or suppressed. Docker
client metadata uses the existing writable `BUILDX_CONFIG=/tmp/rotavise-b7-buildx`
workaround. No SQL migration was introduced; terrain integration is still run.

| Command                   | Exit | Finished UTC             | Evidence              |
| ------------------------- | ---- | ------------------------ | --------------------- |
| `pnpm lint`               | 0    | 2026-11-12T21:36:15.152Z | passed                |
| `pnpm format:check`       | 0    | 2026-11-12T21:38:49.103Z | passed                |
| `pnpm typecheck`          | 0    | 2026-11-12T21:36:04.110Z | passed                |
| `pnpm test:backend`       | 0    | 2026-11-12T21:34:01.152Z | 94 passed, 94 total   |
| `pnpm test:plans`         | 0    | 2026-11-12T20:59:52.437Z | 62 passed, 62 total   |
| `pnpm test:catalog`       | 0    | 2026-11-12T21:01:54.143Z | 114 passed, 114 total |
| `pnpm test:engine`        | 0    | 2026-11-12T21:31:28.312Z | 295 passed, 295 total |
| `pnpm test:api-docs`      | 0    | 2026-11-12T21:09:31.564Z | 29 passed, 29 total   |
| `pnpm test:unit`          | 0    | 2026-11-12T21:09:51.026Z | 423 passed, 423 total |
| `pnpm test:container`     | 0    | 2026-11-12T21:35:42.491Z | passed                |
| `terrain-integration`     | 0    | 2026-11-12T21:09:54.436Z | 13 passed, 13 total   |
| `pnpm test:regional-eval` | 0    | 2026-11-12T21:25:00.185Z | passed                |
| `pnpm openapi:generate`   | 0    | 2026-11-12T20:48:40.739Z | passed                |

### Failures and corrections retained

- The initial focused scenario fixture reused a rule id after changing its
  variable, incorrectly sharing a memo entry. It now has a distinct rule id and
  deliberately missing variable. The first-crop fixture also ended before maize's
  April window; its new-policy case uses the declared range through May while
  the old golden request stays unchanged.
- The new world's applied-weight metadata was initially placed on the wrong
  strict contract object. The failing PostgreSQL completion and a direct Zod
  probe exposed it; metadata now sits on the world schema, and runtime coverage
  refinements reject inconsistent statuses/counts.
- An intermediate real probe failed the 8 MiB bound. Full duplicated crop
  conditions, recalled-rule metadata and research were the main payload cost.
  Explicit shared references preserve their catalog provenance and the first
  crops instead of dropping the comparisons. Intermediate probe files remain
  labelled as such, not final evidence.
- The final reporting workload initially exceeded six seconds for some regions
  after unused search water work was removed and more exposure became calculable.
  Repeated pure calendar shifts/positions were the avoidable work. Per-source
  caches preserve values and visit accounting while reusing those lookups. The
  failed timing run is retained, with its actual exit code, a compact
  [timing ledger](../../evidence/live/2026-11-12-b7/timing-before-calendar-cache.json)
  and checksum-verified lossless full-report archive.
- One regional command failed during compilation when two checks rebuilt the
  same package directories concurrently. Checks now run sequentially; the actual
  failed exit remains in the ledger. No type failure was hidden.
- Early evaluator outputs, including the initial baseline, shared a mutable input
  object between modes. Capture
  now uses each result's independently normalized input; all 24 numerical hashes
  matched after that capture-only correction. The later unused-water-work fix
  intentionally affects only the new policy. Earlier complete runs/hashes are
  intermediate evidence; final timings/results are in the current JSON.

## Verified limits and remaining uncertainty

Verified: the six requested real points and both declared modes, real reference
data and engine execution, first-crop diversity/size bounds, independent climate
coverage, immutable old pins/goldens and required automated checks as recorded
above. Full API/worker persistence is tested with labelled synthetic fixtures in
real PostgreSQL. This task did not repeat B6's full live HTTP/extraction/account
journey, run a production deployment or validate a farm outcome.

Remaining: bounded search is not exhaustive; one branch per first crop can miss
better later choices. Detailed historical vulnerability reporting can reach its
accounted work budget and report unavailable periods; model-world comparisons
have independent budgets and candidate-specific reasons. Missing water methods
can disable water ranking despite a requested water priority. No explicit fallow,
orchard sequence engine, market/labor proof, locally calibrated yield or
expert-reviewed crop limits were added. Catalog recall and national-only guidance
remain unverified as local agronomy. Frontend consumption of the additive
coverage/evidence-reference fields is outside this backend task.

## Proposed DECISIONS text (not approval)

> B7 pins `regional-comparison-1` for new format 2 requests, preserving every
> older policy/result identity. Use the same available comparison dimensions
> during search and final ranking, exclude mixed water methods and skip unused
> search water work. Diversify by first crop, retain its best measured-rank
> representative through response trimming, and reduce redundant per-first-crop
> branches to respect work/time bounds. Compare each rotation independently in
> each model's own baseline/future for mid-century and the near term; expose
> candidate coverage/reasons, world counts and applied weights. A compared block
> requires at least one real candidate comparison and does not imply universal
> coverage. Never substitute POWER water or impute missing future losses.
> Reference repeated immutable catalog evidence explicitly, keep recall labelled,
> and retain historical pins byte-for-byte. Do not interpret these comparison
> fixes as local agronomic validation of the remaining minor-crop winners.

## Proposed PROGRESS text (not approval)

> The explicitly authorized B7 backend follow-up reproduces the B6 regional
> collapse, retains feasible mainstream crop alternatives and adds independent
> per-candidate/model/period climate coverage under a new immutable policy pin.
> Six real regions in suggest and consider modes compare both climate periods;
> measured timings, source digests, missing-crop reasons, top rotations and
> unverified agronomic critique are in the B7 notes/evidence. Required check
> results and legacy golden replays are recorded. No frontend, deployment,
> production-data modification or milestone approval is implied. Some top
> rotations remain agronomically questionable and need local review. All work
> remains uncommitted and unpushed for review.

Please review the B7 implementation, evidence and remaining agronomic limits.
