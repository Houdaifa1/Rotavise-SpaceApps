# B7 real regional evaluation

Illustrative farmer inputs, real catalog 0.15.0, hash-verified PostgreSQL NEX-GDDP-CMIP6 series and original POWER responses. No field measurements or expert validation. `regional-eval.json` contains the exact normalized requests, policy, weather digests/times, scenario unit digest, candidate model ledgers, top five rotations, per-crop evidence and work accounting.

The three-year request starts 2026-11-17 through 2027-05-03; pH 7 and available irrigation with unknown allocation are explicit test inputs. Consider mode declares durum wheat, bread wheat, barley, lentil, chickpea, faba bean, maize, sunflower, potato, tomato and olive. The full candidate pool remains available in both modes.

## Before and after

| Region / mode          | Old seconds | New seconds | Old / new finalists | Old / new shown | Old / new distinct first crops | Future / near term (new) | New bytes |
| ---------------------- | ----------- | ----------- | ------------------- | --------------- | ------------------------------ | ------------------------ | --------- |
| Tadla / suggest        | 8.919       | 4.993       | 3303 / 326          | 4 / 121         | 1 / 115                        | compared / compared      | 7,141,268 |
| Tadla / consider       | 8.331       | 4.693       | 3303 / 326          | 4 / 121         | 1 / 115                        | compared / compared      | 7,143,292 |
| Souss-Massa / suggest  | 7.914       | 4.612       | 3389 / 295          | 4 / 124         | 1 / 114                        | compared / compared      | 7,308,453 |
| Souss-Massa / consider | 7.766       | 4.488       | 3389 / 295          | 4 / 124         | 1 / 114                        | compared / compared      | 7,310,531 |
| Gharb / suggest        | 7.805       | 4.148       | 3351 / 302          | 4 / 122         | 1 / 117                        | compared / compared      | 7,112,807 |
| Gharb / consider       | 9.038       | 4.158       | 3351 / 302          | 4 / 122         | 1 / 117                        | compared / compared      | 7,114,954 |
| Oriental / suggest     | 7.611       | 4.233       | 3377 / 301          | 4 / 133         | 1 / 114                        | compared / compared      | 6,926,787 |
| Oriental / consider    | 8.154       | 4.253       | 3377 / 301          | 4 / 133         | 1 / 114                        | compared / compared      | 6,928,700 |
| Saiss / suggest        | 8.194       | 4.579       | 3281 / 312          | 4 / 124         | 1 / 114                        | compared / compared      | 7,237,105 |
| Saiss / consider       | 8.826       | 4.921       | 3281 / 312          | 4 / 124         | 1 / 114                        | compared / compared      | 7,239,188 |
| Haouz / suggest        | 8.557       | 5.030       | 3440 / 337          | 4 / 121         | 1 / 115                        | compared / compared      | 7,202,608 |
| Haouz / consider       | 8.692       | 5.850       | 3440 / 337          | 4 / 121         | 1 / 115                        | compared / compared      | 7,204,686 |

All old blocks were unavailable with `CLIMATE_NOT_COMPARED`. Each new candidate ledger lists the model and SSP pathway separately for mid-century and the near term; block comparison does not imply universal coverage.

## Search and work (suggest mode)

| Region      | Schedulable | Old / new expansions | Old / new pruned | Old / new truncated | Old / new historical day visits | Largest new model-world visits | Unavailable detailed exposures |
| ----------- | ----------- | -------------------- | ---------------- | ------------------- | ------------------------------- | ------------------------------ | ------------------------------ |
| Tadla       | 168         | 2000000 / 414576     | 665230 / 104477  | true / false        | 189229507 / 80000000            | 16908005                       | 623                            |
| Souss-Massa | 165         | 2000000 / 354704     | 723739 / 89681   | true / false        | 162213111 / 80000000            | 17317631                       | 673                            |
| Gharb       | 169         | 2000000 / 399638     | 751409 / 102176  | true / false        | 200105819 / 79999998            | 16256947                       | 334                            |
| Oriental    | 166         | 2000000 / 287299     | 696701 / 80410   | true / false        | 178138574 / 80000000            | 16405847                       | 73                             |
| Saiss       | 166         | 2000000 / 404661     | 663717 / 97146   | true / false        | 183893237 / 80000000            | 17049413                       | 526                            |
| Haouz       | 166         | 2000000 / 405326     | 737811 / 101697  | true / false        | 170600364 / 79999995            | 17154489                       | 651                            |

Detailed exposure gaps are not silently counted as safe days. Full per-period counts are in `exposureCoverage`; `searchWork`, `dimensions.dayVisits` and `work` distinguish search, ranking and post-ranking reporting. Model-world visits include each model baseline once and each future window separately.

## Tadla

**suggest:** future compared; near term compared. Top three:

1. Rocket → Chickpea → Pearl millet → Pea → Sudan grass → Black oat (bristle oat) → Purslane → Pearl millet (rank 1; loss 0.00013034006).
2. Rocket → Chickpea → Pearl millet → Pea → Sudan grass → Rye → Purslane → Pearl millet (rank 2; loss 0.000139839562).
3. Rocket → Chickpea → Pearl millet → Pea → Sudan grass → Black oat (bristle oat) → Melon → Pearl millet (rank 3; loss 0.000208689195).

Candidate coverage: {"mid_century":{"counts":{"full":121,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":121,"partial":0,"none":0},"missing":{}}}.

**consider:** future compared; near term compared. Top three:

1. Rocket → Chickpea → Pearl millet → Pea → Sudan grass → Black oat (bristle oat) → Purslane → Pearl millet (rank 1; loss 0.00013034006).
2. Rocket → Chickpea → Pearl millet → Pea → Sudan grass → Rye → Purslane → Pearl millet (rank 2; loss 0.000139839562).
3. Rocket → Chickpea → Pearl millet → Pea → Sudan grass → Black oat (bristle oat) → Melon → Pearl millet (rank 3; loss 0.000208689195).

Candidate coverage: {"mid_century":{"counts":{"full":121,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":121,"partial":0,"none":0},"missing":{}}}.

| Crop        | Status / first placement | Old finalists / best rank / shown | New finalists / best rank / shown | Rotations containing crop (new) | Future / near term complete rotations containing crop | Explanation                                                                                                              |
| ----------- | ------------------------ | --------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Durum wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 178 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Bread wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 178 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Barley      | schedulable; 1           | 25 / 1 / 0                        | 1 / 181 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Lentil      | schedulable; 0           | 0 / — / 0                         | 0 / — / 0                         | 23                              | 23 / 23                                               | FIRST_WINDOW_OUTSIDE_RANGE: irrigated lentil window ends Nov 15, before requested Nov 17; later slots remain searchable. |
| Chickpea    | schedulable; 1           | 25 / 1 / 0                        | 1 / 15 / 1                        | 23                              | 23 / 23                                               | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Faba bean   | schedulable; 1           | 25 / 1 / 0                        | 1 / 163 / 1                       | 5                               | 5 / 5                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Maize       | schedulable; 1           | 25 / 1 / 0                        | 1 / 118 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Sunflower   | insufficient_evidence; 0 | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | No applicable usable calendar/cycle rule; see CALENDAR_EVIDENCE_UNAVAILABLE / RULE_OUT_OF_SCOPE.                         |
| Potato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 172 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Tomato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 188 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Olive       | unsupported_for_plan; 0  | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | Orchard profile; annual rotation planner does not support it.                                                            |

These per-crop counts use suggest mode; the JSON records both modes independently. A crop without a candidate receives no invented future result. When lentil has no first placement, its absence as a starting option is a calendar constraint, not a climate-data failure. If no later displayed rotation contains it, that is also a consequence of the bounded search/output, not proof that every lentil rotation was evaluated.

**Agronomic judgment (model recall, unverified):** The top sequences combine plausible cereal/legume/forage components with repeated rocket, pearl millet and purslane. I would not call these sensible default farm recommendations for Tadla without a specified intensive vegetable/forage system and local review. The preserved wheat, barley and pulse options are more recognizable rotation comparisons. This is my qualitative assessment from recalled knowledge, not a sourced new crop rule or expert sign-off.

## Souss-Massa

**suggest:** future compared; near term compared. Top three:

1. Rocket → Green bean → Chickpea → Sudan grass → Black oat (bristle oat) → Purslane → Pearl millet (rank 1; loss 0.001019680807).
2. Cucumber → Chickpea → Black cumin → Pearl millet → Watermelon (rank 2; loss 0.001068844636).
3. Phacelia → Chickpea → Cucumber → Pearl millet → Watermelon (rank 3; loss 0.001142922976).

Candidate coverage: {"mid_century":{"counts":{"full":124,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":124,"partial":0,"none":0},"missing":{}}}.

**consider:** future compared; near term compared. Top three:

1. Rocket → Green bean → Chickpea → Sudan grass → Black oat (bristle oat) → Purslane → Pearl millet (rank 1; loss 0.001019680807).
2. Cucumber → Chickpea → Black cumin → Pearl millet → Watermelon (rank 2; loss 0.001068844636).
3. Phacelia → Chickpea → Cucumber → Pearl millet → Watermelon (rank 3; loss 0.001142922976).

Candidate coverage: {"mid_century":{"counts":{"full":124,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":124,"partial":0,"none":0},"missing":{}}}.

| Crop        | Status / first placement | Old finalists / best rank / shown | New finalists / best rank / shown | Rotations containing crop (new) | Future / near term complete rotations containing crop | Explanation                                                                                                              |
| ----------- | ------------------------ | --------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Durum wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 56 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Bread wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 56 / 1                        | 2                               | 2 / 2                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Barley      | schedulable; 1           | 25 / 1 / 0                        | 1 / 61 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Lentil      | schedulable; 0           | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | FIRST_WINDOW_OUTSIDE_RANGE: irrigated lentil window ends Nov 15, before requested Nov 17; later slots remain searchable. |
| Chickpea    | schedulable; 1           | 25 / 1 / 0                        | 1 / 65 / 1                        | 35                              | 35 / 35                                               | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Faba bean   | schedulable; 1           | 25 / 1 / 0                        | 1 / 168 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Maize       | schedulable; 1           | 25 / 1 / 0                        | 1 / 93 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Sunflower   | insufficient_evidence; 0 | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | No applicable usable calendar/cycle rule; see CALENDAR_EVIDENCE_UNAVAILABLE / RULE_OUT_OF_SCOPE.                         |
| Potato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 169 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Tomato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 177 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Olive       | unsupported_for_plan; 0  | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | Orchard profile; annual rotation planner does not support it.                                                            |

These per-crop counts use suggest mode; the JSON records both modes independently. A crop without a candidate receives no invented future result. When lentil has no first placement, its absence as a starting option is a calendar constraint, not a climate-data failure. If no later displayed rotation contains it, that is also a consequence of the bounded search/output, not proof that every lentil rotation was evaluated.

**Agronomic judgment (model recall, unverified):** A vegetable/legume/forage sequence is conceivable with irrigation, but rocket, Sudan grass, black oat and purslane as the leading all-purpose suggestion is not convincing. The unknown irrigation allocation and absent market evidence prevent treating its tiny temperature loss as a practical recommendation. This is my qualitative assessment from recalled knowledge, not a sourced new crop rule or expert sign-off.

## Gharb

**suggest:** future compared; near term compared. Top three:

1. Fenugreek → Cucumber → Chickpea → Pearl millet → Watermelon (rank 1; loss 0.000333501193).
2. Garden cress → Green bean → Cucumber → Chickpea → Pearl millet → Watermelon (rank 2; loss 0.000335081768).
3. Calendula → Chickpea → Black cumin → Pearl millet → Watermelon (rank 3; loss 0.000367599492).

Candidate coverage: {"mid_century":{"counts":{"full":122,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":122,"partial":0,"none":0},"missing":{}}}.

**consider:** future compared; near term compared. Top three:

1. Fenugreek → Cucumber → Chickpea → Pearl millet → Watermelon (rank 1; loss 0.000333501193).
2. Garden cress → Green bean → Cucumber → Chickpea → Pearl millet → Watermelon (rank 2; loss 0.000335081768).
3. Calendula → Chickpea → Black cumin → Pearl millet → Watermelon (rank 3; loss 0.000367599492).

Candidate coverage: {"mid_century":{"counts":{"full":122,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":122,"partial":0,"none":0},"missing":{}}}.

| Crop        | Status / first placement | Old finalists / best rank / shown | New finalists / best rank / shown | Rotations containing crop (new) | Future / near term complete rotations containing crop | Explanation                                                                                                              |
| ----------- | ------------------------ | --------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Durum wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 46 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Bread wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 46 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Barley      | schedulable; 1           | 25 / 1 / 0                        | 1 / 71 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Lentil      | schedulable; 0           | 0 / — / 0                         | 0 / — / 0                         | 1                               | 1 / 1                                                 | FIRST_WINDOW_OUTSIDE_RANGE: irrigated lentil window ends Nov 15, before requested Nov 17; later slots remain searchable. |
| Chickpea    | schedulable; 1           | 25 / 1 / 0                        | 1 / 55 / 1                        | 37                              | 37 / 37                                               | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Faba bean   | schedulable; 1           | 25 / 1 / 0                        | 1 / 163 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Maize       | schedulable; 1           | 25 / 1 / 0                        | 1 / 85 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Sunflower   | schedulable; 1           | 25 / 1 / 0                        | 1 / 74 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Potato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 149 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Tomato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 171 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Olive       | unsupported_for_plan; 0  | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | Orchard profile; annual rotation planner does not support it.                                                            |

These per-crop counts use suggest mode; the JSON records both modes independently. A crop without a candidate receives no invented future result. When lentil has no first placement, its absence as a starting option is a calendar constraint, not a climate-data failure. If no later displayed rotation contains it, that is also a consequence of the bounded search/output, not proof that every lentil rotation was evaluated.

**Agronomic judgment (model recall, unverified):** Chickpea, vegetables and summer crops can form plausible options in an irrigated setting, but an automatic fenugreek/cucumber/chickpea/millet/watermelon sequence lacks a stated farm system and market justification. I would show it as an exploratory comparison alongside the retained wheat, barley and sunflower alternatives. This is my qualitative assessment from recalled knowledge, not a sourced new crop rule or expert sign-off.

## Oriental

**suggest:** future compared; near term compared. Top three:

1. Amaranth → Berseem clover → Amaranth → Bitter vetch → Sorghum → Rocket (rank 1; loss 0.00011220245).
2. Amaranth → Berseem clover → Amaranth → Bitter vetch → Pearl millet → Rocket (rank 2; loss 0.00012096421).
3. Amaranth → Berseem clover → Amaranth → Bitter vetch → Cowpea → Rocket (rank 3; loss 0.000132442631).

Candidate coverage: {"mid_century":{"counts":{"full":133,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":133,"partial":0,"none":0},"missing":{}}}.

**consider:** future compared; near term compared. Top three:

1. Amaranth → Berseem clover → Amaranth → Bitter vetch → Sorghum → Rocket (rank 1; loss 0.00011220245).
2. Amaranth → Berseem clover → Amaranth → Bitter vetch → Pearl millet → Rocket (rank 2; loss 0.00012096421).
3. Amaranth → Berseem clover → Amaranth → Bitter vetch → Cowpea → Rocket (rank 3; loss 0.000132442631).

Candidate coverage: {"mid_century":{"counts":{"full":133,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":133,"partial":0,"none":0},"missing":{}}}.

| Crop        | Status / first placement | Old finalists / best rank / shown | New finalists / best rank / shown | Rotations containing crop (new) | Future / near term complete rotations containing crop | Explanation                                                                                                              |
| ----------- | ------------------------ | --------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Durum wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 142 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Bread wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 142 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Barley      | schedulable; 1           | 25 / 1 / 0                        | 1 / 146 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Lentil      | schedulable; 0           | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | FIRST_WINDOW_OUTSIDE_RANGE: irrigated lentil window ends Nov 15, before requested Nov 17; later slots remain searchable. |
| Chickpea    | schedulable; 1           | 28 / 1 / 0                        | 1 / 65 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Faba bean   | schedulable; 1           | 25 / 1 / 0                        | 1 / 134 / 1                       | 4                               | 4 / 4                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Maize       | schedulable; 1           | 25 / 1 / 0                        | 1 / 73 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Sunflower   | insufficient_evidence; 0 | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | No applicable usable calendar/cycle rule; see CALENDAR_EVIDENCE_UNAVAILABLE / RULE_OUT_OF_SCOPE.                         |
| Potato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 130 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Tomato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 149 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Olive       | unsupported_for_plan; 0  | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | Orchard profile; annual rotation planner does not support it.                                                            |

These per-crop counts use suggest mode; the JSON records both modes independently. A crop without a candidate receives no invented future result. When lentil has no first placement, its absence as a starting option is a calendar constraint, not a climate-data failure. If no later displayed rotation contains it, that is also a consequence of the bounded search/output, not proof that every lentil rotation was evaluated.

**Agronomic judgment (model recall, unverified):** Repeated amaranth and berseem remain an odd leading suggestion for a generic Oriental farmer. Barley, wheat and pulse alternatives are now visible, but the numerical winner is still not a convincing locally validated recommendation. This is my qualitative assessment from recalled knowledge, not a sourced new crop rule or expert sign-off.

## Saiss

**suggest:** future compared; near term compared. Top three:

1. Black oat (bristle oat) → Pea → Rocket → Berseem clover → Pearl millet → Rocket (rank 1; loss 0.001198224734).
2. Pea → Rocket → Flax → Berseem clover → Pearl millet → Rocket (rank 2; loss 0.001348508571).
3. Pea → Rocket → Chickpea → Sudan grass → Berseem clover → Pearl millet → Rocket (rank 3; loss 0.00151931183).

Candidate coverage: {"mid_century":{"counts":{"full":124,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":124,"partial":0,"none":0},"missing":{}}}.

**consider:** future compared; near term compared. Top three:

1. Black oat (bristle oat) → Pea → Rocket → Berseem clover → Pearl millet → Rocket (rank 1; loss 0.001198224734).
2. Pea → Rocket → Flax → Berseem clover → Pearl millet → Rocket (rank 2; loss 0.001348508571).
3. Pea → Rocket → Chickpea → Sudan grass → Berseem clover → Pearl millet → Rocket (rank 3; loss 0.00151931183).

Candidate coverage: {"mid_century":{"counts":{"full":124,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":124,"partial":0,"none":0},"missing":{}}}.

| Crop        | Status / first placement | Old finalists / best rank / shown | New finalists / best rank / shown | Rotations containing crop (new) | Future / near term complete rotations containing crop | Explanation                                                                                                              |
| ----------- | ------------------------ | --------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Durum wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 99 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Bread wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 99 / 1                        | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Barley      | schedulable; 1           | 25 / 1 / 0                        | 1 / 176 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Lentil      | schedulable; 0           | 0 / — / 0                         | 0 / — / 0                         | 1                               | 1 / 1                                                 | FIRST_WINDOW_OUTSIDE_RANGE: irrigated lentil window ends Nov 15, before requested Nov 17; later slots remain searchable. |
| Chickpea    | schedulable; 1           | 25 / 1 / 0                        | 1 / 202 / 1                       | 27                              | 27 / 27                                               | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Faba bean   | schedulable; 1           | 25 / 1 / 0                        | 1 / 162 / 1                       | 3                               | 3 / 3                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Maize       | schedulable; 1           | 25 / 1 / 0                        | 1 / 119 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Sunflower   | insufficient_evidence; 0 | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | No applicable usable calendar/cycle rule; see CALENDAR_EVIDENCE_UNAVAILABLE / RULE_OUT_OF_SCOPE.                         |
| Potato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 174 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Tomato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 194 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Olive       | unsupported_for_plan; 0  | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | Orchard profile; annual rotation planner does not support it.                                                            |

These per-crop counts use suggest mode; the JSON records both modes independently. A crop without a candidate receives no invented future result. When lentil has no first placement, its absence as a starting option is a calendar constraint, not a climate-data failure. If no later displayed rotation contains it, that is also a consequence of the bounded search/output, not proof that every lentil rotation was evaluated.

**Agronomic judgment (model recall, unverified):** The leading black-oat/pea/rocket/berseem/millet sequence reads as an intensive forage/vegetable system. It is not a convincing general default for Saiss; cereal/pulse alternatives now remain available for comparison. This is my qualitative assessment from recalled knowledge, not a sourced new crop rule or expert sign-off.

## Haouz

**suggest:** future compared; near term compared. Top three:

1. Black oat (bristle oat) → Pea → Rocket → Pearl millet → Purslane → Pearl millet (rank 1; loss 0.000584724828).
2. Black oat (bristle oat) → Pea → Rocket → Pearl millet → Camelina → Green bean → Pearl millet → Rocket (rank 2; loss 0.001363539771).
3. Black oat (bristle oat) → Pea → Rocket → Pearl millet → Fenugreek → Green bean → Pearl millet → Rocket (rank 3; loss 0.001469423672).

Candidate coverage: {"mid_century":{"counts":{"full":121,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":121,"partial":0,"none":0},"missing":{}}}.

**consider:** future compared; near term compared. Top three:

1. Black oat (bristle oat) → Pea → Rocket → Pearl millet → Purslane → Pearl millet (rank 1; loss 0.000584724828).
2. Black oat (bristle oat) → Pea → Rocket → Pearl millet → Camelina → Green bean → Pearl millet → Rocket (rank 2; loss 0.001363539771).
3. Black oat (bristle oat) → Pea → Rocket → Pearl millet → Fenugreek → Green bean → Pearl millet → Rocket (rank 3; loss 0.001469423672).

Candidate coverage: {"mid_century":{"counts":{"full":121,"partial":0,"none":0},"missing":{}},"near_term":{"counts":{"full":121,"partial":0,"none":0},"missing":{}}}.

| Crop        | Status / first placement | Old finalists / best rank / shown | New finalists / best rank / shown | Rotations containing crop (new) | Future / near term complete rotations containing crop | Explanation                                                                                                              |
| ----------- | ------------------------ | --------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Durum wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 118 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Bread wheat | schedulable; 1           | 25 / 1 / 0                        | 1 / 118 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Barley      | schedulable; 1           | 25 / 1 / 0                        | 1 / 175 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Lentil      | schedulable; 0           | 0 / — / 0                         | 0 / — / 0                         | 50                              | 50 / 50                                               | FIRST_WINDOW_OUTSIDE_RANGE: irrigated lentil window ends Nov 15, before requested Nov 17; later slots remain searchable. |
| Chickpea    | schedulable; 1           | 25 / 1 / 0                        | 1 / 203 / 1                       | 12                              | 12 / 12                                               | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Faba bean   | schedulable; 1           | 25 / 1 / 0                        | 1 / 163 / 1                       | 2                               | 2 / 2                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Maize       | schedulable; 1           | 25 / 1 / 0                        | 1 / 117 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Sunflower   | insufficient_evidence; 0 | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | No applicable usable calendar/cycle rule; see CALENDAR_EVIDENCE_UNAVAILABLE / RULE_OUT_OF_SCOPE.                         |
| Potato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 169 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Tomato      | schedulable; 1           | 25 / 1 / 0                        | 1 / 193 / 1                       | 1                               | 1 / 1                                                 | Retained at its measured rank; old output lost ties during size trimming.                                                |
| Olive       | unsupported_for_plan; 0  | 0 / — / 0                         | 0 / — / 0                         | 0                               | 0 / 0                                                 | Orchard profile; annual rotation planner does not support it.                                                            |

These per-crop counts use suggest mode; the JSON records both modes independently. A crop without a candidate receives no invented future result. When lentil has no first placement, its absence as a starting option is a calendar constraint, not a climate-data failure. If no later displayed rotation contains it, that is also a consequence of the bounded search/output, not proof that every lentil rotation was evaluated.

**Agronomic judgment (model recall, unverified):** An intensive mixed sequence with minor crops needs an explicit irrigation supply, outlet and management plan. I would not endorse this leading rotation as a general Haouz recommendation. Visible cereal/pulse options improve exploration, while local agronomic validation remains necessary. This is my qualitative assessment from recalled knowledge, not a sourced new crop rule or expert sign-off.
