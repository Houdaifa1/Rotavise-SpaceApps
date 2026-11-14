# P2: current rotation, alternatives and keyed reasons (engine 7)

Work package P2 of [the Field Shift plan](../../specification/FIELD_SHIFT_AUDIT_AND_PLAN.md).
Branch `claude/p2-current-rotation`. Proposed text for `docs/DECISIONS.md` and
`docs/PROGRESS.md` is below; this branch edits neither.

## What changed

- **Request (format 2, optional fields):** `current_rotation.crop_ids` (1–6
  crops, one cycle in order) and `farmer_context` (`equipment`,
  `market_preference`, `forage_need`, `erosion_concern`). Old stored requests
  are unchanged.
- **Versions:** new requests run on `planning-workflow-6` with
  `rotation-engine-7`. Workflow 5 / engine 6 results stay readable and
  unfinished workflow-5 runs still complete on engine 6 (the worker passes the
  pinned engine version). Migration `0021` only widens the
  `planning_versions` CHECK to accept workflow 6 (same pattern as 0020).
- **Baseline:** the farmer's cycle is repeated and each crop placed at its
  earliest sowing by the same `place` rules and scored by the same `extend`
  estimate as every searched rotation, then joins the candidate pool, so it is
  ranked on equal terms. Order of precedence: declared rotation, else the last
  four dated history crops (flagged as a guess), else none.
- **Strategies:** `result.strategies` holds the baseline, up to three
  alternatives (best-ranked rotations whose crop order differs from the
  baseline and from each other) and, per strategy, keyed notes of five kinds
  (`why`, `evidence`, `benefit`, `gap`, `risk`) with an English default text,
  plus requested/applied priorities and a `reminders` list.
- **Honest failure:** `status` is `complete`, `baseline_unavailable` (no
  rotation given, a crop not schedulable, or the declared rotation breaks a hard
  rule from the first slot) or `insufficient_alternatives` (fewer than two
  distinct alternatives). The run still completes; nothing is hidden.
- **Evidence counts per strategy:** rules used by its crops, split into
  `extracted`, `double_checked`, `expert_reviewed` and `model_recall`.
- **Farmer context never changes the ranking.** The four sliders remain the
  only weights. The context decides which benefits and gaps are written out
  (forage crops, market, equipment, erosion). Reason: the catalog holds no
  prices, machinery or slope data, so any weight mapping would be invented.
- **Yields:** the strategies' rotations always get modelled yields and their
  ranks follow the final (yield-adjusted) ranking through
  `syncStrategyRanks`.

## What the notes can and cannot say today

Derived from catalog data: nitrogen-fixing crop (family Fabaceae), crop-family
spread and back-to-back same-family repeats (pest-cycle break), water,
climate, soil-preference and crop-health score changes against the current
rotation, forage crops (`harvestProduct`), future-climate change, the
bare-field share **from the crop calendar** (not from satellite images).
Always a gap: market/income, equipment, erosion and infiltration (no slope or
terrain data yet; NASADEM is package P4), organic matter unless the soil-carbon
model ran.

## Proposed DECISIONS text

> **Current rotation and strategies (engine 7, 2026-11-08).** The Field Shift
> challenge asks to compare at least three rotation strategies including the
> existing one. Format 2 requests accept `current_rotation` and
> `farmer_context`; engine 7 scores the current rotation on the same placement
> rules and estimates as every searched rotation and returns it with at least
> two alternatives and keyed notes (why, evidence, benefit, gap, risk). When the
> baseline or two alternatives are missing the result says so. The four sliders
> remain the only ranking weights; the extra answers only choose which notes are
> written, because the catalog has no price, machinery or terrain data.
> Workflow 5 results stay readable; new requests use workflow 6 (migration
> 0021 widens a CHECK only).

## Proposed PROGRESS text

> P2 (2026-11-08): current rotation, strategies and reminders added to format 2
> (engine 7, workflow 6). Verified on branch `claude/p2-current-rotation`; not
> merged or pushed. The interface does not show them yet (Step 15 frontend).

## Not verified

- No live run with real NASA data on engine 7; tests use the synthetic catalog
  and a disposable PostgreSQL.
- Strategies on catalog 0.10.0 were not exercised with the full real catalog
  (the existing real-catalog engine tests still use engine 6).
- Alternatives are "best-ranked distinct crop orders"; no diversity or
  agronomic filter beyond the existing hard rules.
- Plain-language text exists in English only; the interface translates by
  `code`.
- A one-off `RangeError: Maximum call stack size exceeded` appeared once in the
  crop-health 10 MB upload test during a combined `test:engine` run; it did not
  repeat in the isolated run or in the next full run.
