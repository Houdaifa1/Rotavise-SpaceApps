# Training-knowledge fill for new crops (Claude, 2026-11-06)

**None of these values may enter a catalog release or drive planner results until an agronomist or a real source verifies them.** They are recalled from model training, not read from a document. Every record is `status: training_based`, `valueKind: model_recall_unverified`, `catalogReady: false`, has no source, quote or hash, and is not a Moroccan field observation. No treatments or products are recorded; Arabic names and Moroccan occurrence are null.

106 records in `claude-training-new-crops.json`. Confidence: 9 medium, 97 low, 0 high. Item ids follow `T.<section>.<crop>.<field>` as in `claude-training-knowledge.json`.

## Coverage

- **Gaps in first-pass crops (sourced facts untouched):** strawberry 3 (heat, rotation, yield), cumin 3 (heat, preferred and prohibited predecessor), saffron 4 (planting window, cold, rotation, yield), mint 6 (cold, heat, planting, stand lifetime, rotation, diseases and pests), blueberry 3 (planting window, stand lifetime, rotation), raspberry 7 (cold, heat, planting, stand lifetime, rotation, yield, issues).
- **Full A/B/C/F/G:** cotton, rice, quinoa (7 each); prickly pear, date palm, avocado, banana, argan (7 each); grapevine, almond, walnut (8 each, including a chill-hours entry).
- Tree and perennial crops carry a stand lifetime and an orchard note: they fit the catalog's orchard model better than the annual rotation engine, and their rotation records are `null` or a replant caution.

## Low-confidence clusters

- Every heat limit (cultivar and humidity dependent).
- All yield ranges (recalled, not Moroccan statistics); argan is per tree because per-hectare is not meaningful.
- Planting windows for quinoa, cotton, rice, saffron and prickly pear (approximate months only).
- Rotation intervals for strawberry, saffron, mint, raspberry, cotton and quinoa.
- Cold limits for date palm, argan, avocado, prickly pear and saffron.
- Diseases and pests: organisms are generic host associations; Moroccan occurrence not confirmed (cochineal on prickly pear, Bayoud on date palm and Capnodis on almond are the ones most likely true locally).

Medium confidence is limited to well-known thresholds: cotton and banana chilling, rice spikelet sterility, grapevine budburst frost, almond and walnut flower frost, and date-palm stand life.
