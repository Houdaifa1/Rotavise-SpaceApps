# Catalog release 0.10.0: all crop knowledge, honestly labelled

Authority: DECISIONS "Model-recall crop knowledge in the catalog" (2026-11-07).
Inputs: `docs/evidence/catalog/2026-11-03/research/*.json` (commit bdf538f) and
release 0.9.0. Releases 0.1.0–0.9.0 and migrations are not changed.

## How a release works today (verified by reading the code)

- A release is a directory under `data/catalog/releases/<version>` with
  `manifest.json` (regions, issues, conflicts), `sources.json` and
  `profiles/*.json`. `loadCatalogRelease` reads it (4 MiB per file, 8 MiB
  total), `prepareCatalogV2` validates it with Zod plus cross-reference checks
  and hashes its canonical JSON, `CatalogStore.import` stores it append-only in
  `catalog_versions` (a version never changes; a different hash is a conflict).
  Plans pin catalog id, version and hash. The version a deployment uses is
  `PLAN_CATALOG_VERSION`; nothing hardcodes 0.9.0 in server code.
- Every rule needs a citation, and a binding rule (`soft`/`hard`) must be
  `double_checked` or `expert_reviewed`. The engine ignores `reference` and
  `extracted` rules, counts used rules by verification tier and states
  `NOT_EXPERT_REVIEWED` in every result.
- Orchards and protected crops are listed but `unsupported_for_plan`.

## What changes

1. **Evidence class `model_recall`** (contract, format 2 only, all additive):
   `{confidence, basis, valueKind: "model_recall_unverified", recordedOn,
researchItem}`.
   - A rule may have `verification.status = "model_recall"` and then needs no
     citation; this small provenance record (confidence, basis) is all that
     marks it. The engine treats it like any other rule. It has no quote, so
     `quote-check.json` has no entry for it.
   - Identity, cultivars, applicability and issues may carry `recall` instead
     of citations (at least one of the two is required).
   - New optional `references` on a profile hold facts that are not planner
     rules (yield ranges, chill hours, harvest window, background); new
     optional `visibleSymptoms` on issues.
   - Temperature `stage` gains `other` (the real stage is written in
     `conditions`); like any stage without a day window it is evidence only.
   - `modelType` gains `wild_harvested` (never planned, like `orchard`).
   - Size ceilings raised: sources 600, issues 1500.
2. **Engine**: recalled rules are scheduled, checked against climate and ranked
   like sourced ones, and count toward fair ranking. The only trace is a
   provenance count `evidence.rulesUsed.model_recall` (present only when above
   zero, so results for 0.9.0 are unchanged); the existing "not expert
   reviewed" wording stays. Fair ranking is unchanged.
3. **Release 0.10.0** is produced by `tooling/catalog/build-release-0.10.0.mjs`
   (deterministic, no network): 0.9.0 profiles and sources unchanged, plus
   - sourced research facts: a source entry from the saved file's SHA-256; a
     rule is `double_checked` (quote-match method) when the builder re-finds
     the quote in the saved text; a sourced fact whose quote cannot be re-found
     is kept as `extracted` + `reference` (evidence, never binding);
   - recall facts as `model_recall` rules/references/issues/cultivars;
   - sourced beats recall: a recalled rule is dropped where a sourced rule
     answers the same question and the conflict is recorded; every drop, skip
     and unmappable item is written to `docs/evidence/catalog/2026-11-07/merge-log.json`.
   - Thresholds that are not damage limits (optimum, germination, species
     bounds) never become damage rules.
   - Crops that cannot rotate are `orchard`, `wild_harvested` or
     `multi_year_stand` as the research marks them; only annual crops with a
     window and a duration can be scheduled.

## Not done / limits

No fact is expert-reviewed. Recalled values are unverified; sourced facts from
press pages or FAO Ecocrop stay evidence-only. Region resolution, cultivar
rules and Moroccan validation are unchanged.
