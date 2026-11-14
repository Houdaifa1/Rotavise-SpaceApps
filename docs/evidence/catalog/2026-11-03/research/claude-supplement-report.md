# Claude Task 2 — Sections B, C, D supplement (2026-11-06)

Continuation of Codex's 2026-11-04/05 research pass (`facts.json`, `report.md`),
scoped to the season-fact (B), rotation-fact (C) and stage-timing (D) items it
left `not_found` or `partial`. Output: `claude-supplement-BCD.json` (70
entries). Sections A, E, F, G and the new-crop research are out of scope for
this file (handled by parallel tasks).

## What this pass found

| Item | Result |
| --- | --- |
| C.rapeseed.preferred_predecessor | **Found.** A straw cereal (Poaceae) is an easy predecessor (ONCA oilseeds, p.59). |
| C.potato.minimum_return_interval | **Found, improves on not_found.** 5–6 years (ONCA vegetables, p.42) — a general figure, not disease-specific. |
| C.eggplant.prohibited_predecessor | **Found.** 4–5 years without another Solanaceae crop (PNTTA solanums bulletin 100, p.3), independently corroborating the catalog's existing 5-year nematode-management figure from a different source (pntta-roots.pdf). |
| C.green-bean.preferred_predecessor | **Found, low confidence.** Gherkin (a cucurbit) is named as a good predecessor for green bean — but the source is about gherkin specifically, not courgette/melon/watermelon, its SHA-256 was not re-verified against the manifest, and the locator is a text line, not a PDF page. Flagged `catalogReady: false`; needs re-verification before use. |
| C.potato.prohibited_predecessor | Still not_found — the ONCA guide's "don't grow potato near eggplant" advice is spatial (field-to-field), not a predecessor-crop (temporal) rule. Recorded as closest evidence, not promoted to a fact. |

Everything else searched (~40 items across cabbage, courgette, chickpea,
garlic, green-bean, groundnut, lentil, lettuce, maize, melon, pea, rapeseed
(prohibited), sesame, sugar-beet, table-beet, watermelon, plus the two wheat
ear-frost-timing items and the sugar-beet cercosporiosis interval) remained
`not_found` after checking the already-downloaded corpus
(`.research-sources/2026-11-03/`, 445 files) and one or two targeted web
searches each. Each entry in `claude-supplement-BCD.json` records what was
checked and the closest (insufficient) evidence, per the prompt's rule that a
missing fact is acceptable and must not be invented.

**Important correction to how the original punch list was read:** most of the
`coverage: "partial"` items on the assigned list (21 of them, e.g.
`C.chickpea.minimum_return_interval`, `C.groundnut.preferred_predecessor`,
`C.rapeseed.minimum_return_interval`, `D.sugar-beet.bolting`'s temperature
figure) are **not research gaps**. Codex already found an exact, quoted,
sourced fact for each; the recorded `missingFields` is a catalog-authoring
decision — months-to-days conversion, scalar-vs-range representation, or an
expert call on disease-specific vs. general scope/severity. Re-opening these
sources would not add information. They are marked
`"status": "reviewed_no_new_research_needed"` in the supplement with a note
explaining why, so the full assigned list is still accounted for one-for-one,
but no invented "resolution" was written for a decision that belongs to
catalog-release expert review.

## Leads not yet confirmed (flag for the next research pass, not for catalog use)

- **Sugar beet vs. Rhizoctonia solani**: a 1991 Doukkala study (surfaced via
  agris.fao.org) reportedly names barley and maize as the best predecessors
  for sugar beet against this pathogen. Real Moroccan source, but not opened
  or quote-verified by this fork — do not cite until the primary document is
  retrieved and checked.
- **Garlic's own référentiel**: ONCA/ARDNA publishes a dedicated technical
  reference for potato, onion and tomato (the source already in the corpus);
  no equivalent for garlic was located. If one exists, it likely holds the
  garlic planting-window, duration, heat/cold and rotation facts this catalog
  still needs (`B.garlic.*`, `C.garlic.*`).
- **Sugar beet cercosporiosis**: Ezzahiri (2013), *Guide de protection
  phytosanitaire de la betterave à sucre au Maroc* (AMPP), was identified as
  the likely primary source but not retrieved.
- **ONCA Taza memoir (2017)** on chickpea phenology, intercropped with olive
  — a possible source for `B.chickpea.duration.spring`, not opened.

## Conflicts between sources

None found in this pass's own findings. (Codex's `report.md` already lists
the sugar-beet OrMVAT yield conflict and others; unchanged here.)

## Open questions for an agronomist

- Is the ONCA vegetables guide's "5–6 years" potato return interval general
  good practice, or should it defer to the more specific wart/nematode
  figures used elsewhere in the same document (unreviewed here)?
- Does a 4–5 year Solanaceae-family break, sourced independently twice now
  (nematode management; general disease/monoculture caution), justify a
  single catalog rule for eggplant/pepper/potato/tomato as a group, or should
  each crop keep its own figure and condition?
- The low-confidence green-bean/gherkin predecessor lead: worth pursuing with
  a courgette/melon/watermelon-specific source, or discard as not
  catalog-grade?
