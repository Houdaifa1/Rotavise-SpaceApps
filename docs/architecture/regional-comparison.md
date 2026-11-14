# Pinned regional comparison policy

`regional-comparison-1` is an optional format 2 rotation policy field, pinned in
`planning_runs.versions` and its existing protected hash. New requests select it
through `regionalRotationPlanningPolicy`; the exported historical
`rotationPlanningPolicy`, existing workflows, engine version, catalogs and
migration history are unchanged. Absence selects the previous arithmetic,
search, serialization and future-comparison behavior. No migration is needed.

The default beam retains 60 candidates per scoring view and one per first crop,
across every depth, instead of 150 per view and 25 per first crop. These are
search resource policies, not agronomic thresholds or crop boosts. The engine
retains each feasible first crop's best finalist in both suggest and consider
outputs, with its actual rank. Consider remains a request for explicit
comparisons, not a whitelist of allowed subsequent crops. Hard rules and
calendar applicability still govern feasibility. Search remains bounded and
reports pruning and truncation.

Search compares the same temperature-check kinds for all schedulable crops, as
engine 6 already intended. A kind includes variable, medium and limited side;
limits and stages stay attached to their original evidence. Water is not a
search or final ranking dimension when schedulable crops mix FAO water curves
and ordinal demand classes. Search skips water estimates when water has zero
weight in every search view; the final per-rotation water report remains.
Missing search components take the current
frontier's mean, matching neutral final imputation instead of changing the
weights for each partial. Profile conditions remain explicit; no recalled
calendar, duration, temperature or water value is altered or upgraded.

For one return-interval rule the latest known sowing gives the most restrictive
return date. This policy retains that warning and one unknown-date warning,
instead of emitting a warning for every earlier sowing. Rule severity and
feasibility are unchanged. Soft violations are still conditions, not newly
invented penalties or hard exclusions.

## Future and near-term coverage

Every rotation is evaluated separately against each model's own historical
baseline and future window, on the same temperature-check kinds used for the
historical comparison when common kinds exist. A missing crop rule, model,
calendar date, complete analog or exhausted work budget cannot cancel another
rotation's complete comparison. Missing losses are not filled from other
rotations. Each climate source retains its own 80-million-day default budget;
this policy enforces it for temperature, thermal stages, water, extremes and
vulnerability reporting. Rejected work is not charged beyond the ceiling.
Calendar positions and year shifts are memoized per immutable source under this
policy, including null/invalid-calendar results. This changes neither numerical
results nor visit accounting; repeated reporting reuses pure calendar lookups.

The additive `candidate.future.comparisons` array records every requested
`period` (`mid_century` or `near_term`), `model`, `experiment`, `status` and
nullable existing reason code. Compared rows have numerical model entries in
`scenarios` or `nearTerm`; unpaired rows have a reason and no fabricated model
loss. Missing whole worlds use `SCENARIO_DATA_INCOMPLETE` (or its near-term
counterpart); missing evaluable rules use `CLIMATE_NOT_COMPARED`; insufficient
analogs or work use the period's existing insufficient-analogs code. A completely
absent prepared tile keeps the existing tile-not-prepared reason. A complete
near-term comparison survives an unavailable mid-century comparison.

Block and world statuses stay `compared` / `unavailable` and `compared` /
`not_compared`; no `partial` enum is added. A block says `compared` only if at
least one rotation was compared in at least one world. A world adds
`comparedCandidateCount` and `notComparedCandidateCount`, measured over all
finalists, including those not shown. `weightedRank` ranks only that world's
complete candidates. `appliedWeights` records its common dimensions: if any
compared candidate lacks a model water balance, water has weight zero for that
world and remaining positive weights are normalized. With no remaining requested
weight, all losses tie; historical POWER water is never substituted. A partial
candidate universe makes `topStableAcrossFutures` null. Consumers must inspect
candidate coverage, rather than interpreting a compared block as universal
coverage. Runtime refinement rejects inconsistent statuses, counts and candidate
model ledgers for this policy.

The scenario store's opt-in partial read still verifies every present unit's raw
bytes and normalized hash. The planning workflow pins just those verified units
and requests completion through the existing bounded tile mechanism. Old pins
retain the store's all-required-units read. Missing mid-century units no longer
prevent independent near-term retrieval under this policy.

## Response size and evidence references

The new policy reserves up to 7 MiB for engine output, within the existing
8 MiB production storage ceiling. It preserves first-crop representatives during
size trimming. Repeated evidence is referenced instead of copied:

- `evidence.ruleDetails: pinned_catalog`: `ruleIds` resolve in the assessment's
  immutable catalog id, version and SHA-256. Repeated inline rule citations can
  be empty; the catalog and crop-detail endpoint retain the full citations.
- `candidate.cropConditions: assessment_crops`: inherit the conditions from
  `assessment.crops` for each slot crop. Candidate `reasons` retain schedule
  warnings; `conditional` status still includes inherited conditions.
- Vulnerability periods retain rule ids, numerical exposure and explicit
  `verificationStatus`, including `model_recall`. Full `verification` and
  repeated citations resolve through the pinned catalog. No provenance tier is
  upgraded; null inline detail does not mean verified evidence.
- `catalogResearch.evidenceLocation: pinned_catalog`: coverage and identifiers
  remain, while full repeated research lives in the pinned catalog. Strategies
  and candidate resources still carry their original selections and derivations.
- Ties retain their rank and up to ten peer ids, rather than 500 repeated ids.

Every new field is optional for older results and has no default. Glossary 7
explains coverage and evidence references in en/fr/ar/ary, retaining its explicit
machine-written, unreviewed translation disclosure. OpenAPI is generated from
the runtime contracts. See [B7 notes](../steps/15/b7-notes.md) for measured
behavior, complete commands, agronomic limitations and proposed review text.
