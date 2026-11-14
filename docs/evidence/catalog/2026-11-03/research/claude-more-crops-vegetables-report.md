# Remaining vegetable crops: sourced layer and training-knowledge layer

Prepared 2026-11-06. Output: `claude-more-crops-vegetables.json` (503 records, valid JSON, no duplicate item ids). Research only: no code, catalog, migration or git changes.

## What the file contains

| Layer | Records | Meaning |
| --- | --- | --- |
| Tier 1 sourced (`status: found`) | 87 | Moroccan PNTTA/IAV Hassan II bulletins (1999–2003 series) and HCP provincial tables. Every `quote` is a list of fragments that machine-matched the saved text extract. |
| Tier 2 sourced, low confidence (`found`, `coverage: partial`) | 95 | FAO ECOCROP rows (same file and caveats as `claude-supplement-A.json`): temperature bounds, growing-cycle days, botanical family. Not daily extremes, not stage-specific, not Moroccan. |
| `not_found` | 4 | Sweet-potato yield (the printed HCP row is internally inconsistent), and ECOCROP has no row for kohlrabi, chives and Jerusalem artichoke. |
| `training_based` | 317 | Recalled from model training. `valueKind: model_recall_unverified`, `catalogReady: false`. |

32 crops: cucumber, gherkin, pumpkin/winter squash, cauliflower, broccoli, Brussels sprout, kohlrabi, turnip, radish, spinach, Swiss chard, celery, celeriac, leek, spring onion, artichoke, cardoon, okra, sweet potato, bulb fennel, parsley, coriander, chilli, endive/chicory, arugula, asparagus, dill, basil, chives, sweet corn, garden cress, Jerusalem artichoke. Courgette also gets new yield rows (HCP Settat).

## New sources saved (`.research-sources/2026-11-06/`)

All four are PNTTA monthly bulletins (Moroccan Ministry of Agriculture, written at IAV Hassan II), tier 1, licence unknown, downloaded from `agrimaroc.net/bulletins/`. Text was extracted with `pdftotext` and saved next to each PDF.

| File | SHA-256 | Covers |
| --- | --- | --- |
| `pntta-btta-97.pdf` | `2971816b13a577c811b1b2cf5f2f073339c75d1b9add0f323e89743fda88ebe3` | spinach, tarragon, Florence fennel, mint, niora, parsley |
| `pntta-btta-100.pdf` | `baa305f0cadb7eb13aea766234fa15e2f4b96a5a23a3c842b91a4c25c8a19c50` | tomato, eggplant, pepper, okra |
| `pntta-btta-102.pdf` | `464117526e062bc25ee993fe613d046ecf97821f34a26eb56472509b4911127c` | artichoke, cardoon, sweet corn, asparagus, leek |
| `pntta-btta-103.pdf` | `ac246bcc940659a8c8937bdacd1fe1eed4c967ae648dc1d66091d3f22f322ab9` | lettuce, endive, Jerusalem artichoke, verbena |

Previously saved Codex sources were re-used for cucumber, gherkin, turnip, cabbage group, celery and coriander (`pntta-cucurbits`, `pntta-brassicas`, `pntta-garlic`) and for yields (`hcp-alhoceima-2025`, `hcp-settat-2021`), each with its existing SHA-256.

## Highest-value sourced results (tier 1)

| Crop | Fact | Source | Note |
| --- | --- | --- | --- |
| leek | withstands −15 to −20 °C; germination starts 2–5 °C; mean yield 30–40 t/ha | PNTTA 102 | survival statement, not a damage onset |
| artichoke | optimum 18–20 °C; plant Jul–Aug (autumn crop) or Sep–Oct (spring crop); national mean 10–15 t/ha; no cardoon/artichoke after a composite | PNTTA 102 | no return interval in years |
| asparagus | stand life 10–20 years; yield 5–6 t/ha (large-scale); rust *Puccinia asparagi* | PNTTA 102 | |
| cardoon | no germination below 10 °C; national mean 20–25 t/ha | PNTTA 102 | |
| okra | no germination below 15 °C; optimum 26–28 °C; national mean 12–15 t/ha; no okra after okra | PNTTA 100 | |
| spinach | bolts above 25 °C in long days; mean 20–25 t/ha; Moroccan varieties listed | PNTTA 97 | cold hardiness only "same as cabbages" |
| parsley | young plants survive to −9 °C, "but not frosts" (source contradicts itself, recorded as printed); leaf 5–8 t/ha, root 30–35 t/ha | PNTTA 97 | see conflicts |
| endive | yield 30–40 t/ha; optimum growth 25–28 °C | PNTTA 103 | attribution by column order |
| cucumber | national mean 17–20 t/ha open field, 90–100+ t/ha under greenhouse; tunnel sowing Nov–Dec | PNTTA 99 | |
| gherkin | vegetation stops <14 °C or >40 °C; sown Jun–Jul (late crop); predecessors tomato, pepper, potato, alfalfa | PNTTA 99 | growth cessation, not damage |
| turnip | cold exposure <10 °C triggers bolting; frost-tolerant; mean 15–16 t/ha; Al Hoceima 11.3 t/ha; Settat 18–20 t/ha irrigated | PNTTA 101, HCP | |
| cabbage group (cauliflower, broccoli, Brussels sprout, kohlrabi) | growth minimum 4 °C, maximum 24 °C; planting Sep–Jan; cauliflower late crop 30 t/ha | PNTTA 101 | group-level text applied to each crop |
| HCP yields | Al Hoceima 2023–24: cauliflower 15, cucumber 15, turnip 11.33, squash/courgette 12 t/ha. Settat: courgette 20.0 (2015–16) and 15.0 (2014–15), sweet potato 20.0, artichoke 25.0 | HCP | small areas; single provinces |

## Conflicts and cautions

* **Parsley cold:** "young plants resist down to −9 °C. However, they do not resist frosts" in the same passage. Both statements recorded; the −9 °C value is `low` confidence.
* **Sweet potato (HCP Al Hoceima):** the row "Patate douce 150 45 000 30" gives 150 ha and 45 000 q, which implies 300 q/ha, but the printed productivity is 30. No yield was constructed from area and production; the entry is `not_found`.
* **Courge/courgette:** the HCP Al Hoceima category is combined ("Courge courgette"). It is attached to `pumpkin` at low confidence and is not pumpkin-specific.
* **Gherkin yield:** "une dizaine de tonnes" has no explicit "/ha"; per-hectare reading is inferred.
* **"nuile":** the cucumber and gherkin pest lists print "la nuile" (probably a typo for mildew). Recorded as printed, identity unresolved.
* **ECOCROP vs PNTTA:** ECOCROP bounds (for example cucumber TMIN 6, TMAX 38) are species-level and not stage-specific; where a PNTTA growth statement exists it is more useful, but neither is a damage limit.
* **Column interleaving:** the PNTTA bulletins are typeset in 2–3 columns, so a few attributions (endive yield, leek sowing, sweet-corn pests) rest on reading order. They are marked `low`.

## Web search status

Targeted searches for Moroccan artichoke and spinach technical sheets returned only French and generic sources (non-local), which were not used. The productive route was the PNTTA bulletin series (numbers 90–105 checked by title). Bulletins not yet mined for this task: 98 (potato, beet, onion, carrot), 99 and 101 (used), 104–105 (tropical fruits, almond/olive/fig/pomegranate), and the series before 90 and after 105.

## Training-knowledge layer (317 records)

Everything not sourced above is recalled, not verified: heat and cold damage levels (`T.A.*`), sowing windows and cycle lengths (`T.B.*`), predecessor and return-interval rules (`T.C.*`), yield ranges (`T.F.*`), generic disease and pest associations with scientific names and visible symptoms (`T.G.*`, no treatments, `moroccoOccurrence: null`) and variety or type names (`V.*`).

Low-confidence clusters: every heat limit; sowing windows for crops where the source gave none; yield ranges (not Moroccan statistics); return intervals; asparagus and artichoke stand lifetimes; any variety marked `type`. Organism lists are host associations from general knowledge, not Moroccan occurrence claims. Where a sourced `G.*` record names the same organism for Morocco, prefer the sourced record.

## Not covered

* Other vegetables possibly grown in Morocco but not researched: Chinese cabbage, kale, mustard greens, garden/curly kale, salsify, horseradish, taro, cucumber-type melons (snake melon), lamb's lettuce, purslane, mallow (khobiza), jute mallow, amaranth leaves, tomatillo.
* Varieties are listed only where the bulletins name them or where recall was reasonably firm; many crops have none.

No record here may enter a catalog release or drive planner results until an agronomist or a source verifies it (`catalogReady: false` throughout).
