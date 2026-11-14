# Catalog 0.11.0 notes

Built on 2026-11-08 by `node tooling/catalog/build-release-0.11.0.mjs` from the
committed release 0.10.0. The release is strictly additive: every crop,
cultivar, rule, reference, regional entry, problem, source and quote of 0.10.0
is carried over unchanged (the builder and a unit test both check this).

## What 0.11.0 adds (counts from `docs/evidence/catalog/2026-11-08/merge-log.json`)

| Item         | 0.10.0 | 0.11.0 | Added |
| ------------ | ------ | ------ | ----- |
| Crops        | 207    | 246    | 39    |
| Cultivars    | 557    | 1,226  | 669   |
| Problems     | 387    | 586    | 199   |
| Rules        | 1,366  | 2,646  | 1,280 |
| References   | 753    | 1,983  | 1,230 |
| Regional use | 219    | 913    | 694   |

- **Regional presence** (655 entries on existing crops, the rest on new ones): the
  main agro-regions where each crop is grown, from recall, as candidate entries.
- **FAO-56 style water curves**: 105 annual crops gained Kc ini, mid, end and four
  stage lengths. Stands, orchards and wild plants get none (the water balance
  reads one curve per cycle, which is not defined for a multi-year stand).
- **Soil limits**: pH range (212), salinity ECe threshold (214, saturated paste)
  and drainage (212).
- **Water demand class** (low, moderate, high) for all 171 schedulable crops that
  lacked one, with one shared comparison method so crops can be compared.
- **Benefit classes** as references on every crop, with new contract topics:
  `nitrogen_fixation`, `rooting_depth`, `organic_matter_contribution`,
  `erosion_protection`, `forage_value`. Values are ordinal classes (1 low to 3
  high; forage 0 to 3; nitrogen fixation a 0 or 1 flag; rooting depth a metre
  range).
- **Further crops (39)**: forage legumes and grasses, cover crops, minor
  vegetables, forest and wild plants, citrus species views, aromatic plants.
- **Cultivars (669)**, **problems (199: diseases, pests, weeds, parasitic
  plants; no treatments)** and **231 crop-health break rules** (years without
  host crops) from recall. 45 problem rows already existed and were skipped.

Every added item is recalled by the AI model, labelled `model_recall`, low
confidence, with no quote and no invented citation. The engine uses recalled
items like any other rule (decision of 2026-11-07).

## Decisions taken while building

1. **Licence cleanup deferred.** The Ecocrop-derived values and the long quotes
   stay exactly as in 0.10.0 (user instruction of 2026-11-08). The licence work
   remains open and is listed in `docs/REFERENCES.md`.
2. **Additive only.** Nothing from 0.10.0 is removed or edited. The profile
   `version` field is the release version, the only changed field of an
   existing profile.
3. **Schema.** One additive change to `catalog-v2.contract.ts`: five new
   reference topics. No migration: the catalog is stored as one hashed JSON
   document.
4. **Water curves only for annual crops.** The water balance cannot interpret a
   stand or orchard curve.
5. **Drainage rules** are included as asked. The engine does not evaluate them
   yet and reports `SOIL_CHECK_UNIMPLEMENTED` for each, so results for the new
   release carry one more condition line per crop with a drainage rule.

## Effects the next steps should know

- Every schedulable crop now has a water demand class with the same method, so
  the engine's water dimension becomes comparable for the whole catalog. Rankings
  from 0.11.0 can differ from 0.10.0 for that reason; that is intended.
- `PLAN_CATALOG_VERSION` and `ROTATION_CATALOG_VERSION` still default to
  0.10.0. Switching the default to 0.11.0 is a one-line change in
  `apps/server/src/config/environment.ts` and `infra/production/env.template`.
- The benefit classes are plain references: the P2 comparison work can read them
  (`profile.references` with the five topics) to explain nitrogen fixation, water
  use, organic matter, erosion protection and forage value.

## Limits

- All new content is unverified recall, low confidence. None of it is expert
  reviewed. Regional presence especially needs local confirmation.
- Cultivar names were recalled; some may not be grown in Morocco or may be
  spelled differently. Arabic names are given for only a few crops.
- Kc values are patterned on FAO-56 tables from memory, not checked against them.
- 194 crops of 0.10.0 had only national applicability; most now have regions, but
  region boundaries and field resolution are unchanged.

## Proposed text for DECISIONS.md

> **Catalog 0.11.0 (2026-11-08):** strictly additive over 0.10.0. Adds recalled
> regional presence, water curves for annual crops, soil limits, water demand
> classes, five benefit classes, 39 crops, 669 cultivars, 199 problems and 231
> crop-health break rules, all `model_recall` and treated like any other rule.
> Licence cleanup is deferred by the user's instruction.

## Proposed text for PROGRESS.md

> Catalog 0.11.0 (246 crops, 1,226 cultivars, 586 problems, 2,646 rules) is built
> and tested (`pnpm test:catalog`). It is not the default yet.
