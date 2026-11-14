# Step 12 — crop knowledge pilot and disease tables

Authorized by the user's 2026-10-18 messages "Please, I need you to, you know,
fix all the what's left, of course, uh, as planned" and "So, go ahead, and start
with the" (the message ended there; read as the next planned step). Build the
first real, cited crop knowledge for the Tadla / Béni Mellal pilot so real plans
can be compared. No science models (Step 13), photo work (Step 14) or interface
change (Step 15).

Extraction is done by the assistant reading each source page; the Anthropic
API is not needed for this step. Every value keeps its document, page and exact
quote. Nothing is added from memory without a citation.

## Acceptance

| ID  | Required behavior                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C01 | Each source is snapshotted with URL, retrieval time, size, SHA-256, publisher, year, geography and recorded reuse terms. Snapshots that may not be redistributed are hashed but not committed.                                                         |
| C02 | Crop identity inventory for the pilot (durum wheat, bread wheat, barley, faba bean, chickpea, lentil, sugar beet, maize, sesame, alfalfa): French and Arabic names, harvest product, model type, planning status and ONSSA-registered varieties.       |
| C03 | Profiles by farming system: sowing windows, duration ranges, stage timing, temperature and water needs, soil limits, rotation effects, each value with document, page and quote; units explicit.                                                       |
| C04 | A binding rule is `double_checked` only when its quote is found by machine in the page text and a second, separate reading confirms the interpretation. Everything else stays `extracted`. Conflicts and gaps are registered, never resolved silently. |
| C05 | Disease and pest table per crop from sources: hosts and minimum breaks before a host returns, with citations.                                                                                                                                          |
| C06 | Sourced region boundaries for the pilot (open-licence administrative boundaries for the ORMVAT provinces), with licence and attribution.                                                                                                               |
| C07 | Release 0.3.0 is append-only, imports beside earlier releases and becomes the format 2 default. A real Tadla request produces compared rotations, or lists exactly which evidence is still missing.                                                    |
| C08 | Results say "based on official guides, not yet expert-reviewed" until a specialist review is recorded.                                                                                                                                                 |
| C09 | Unit and integration tests, full `pnpm verify`, and a report with commands, results and limits.                                                                                                                                                        |

## Part B — all of Morocco (added 2026-10-25)

Authorized by the user's 2026-10-25 messages "Extend the current crops to all
of Morocco now" and "for the worldwide after the event, after everything, but
now just focus on Morocco lands and stuff like that, like Moroccan corpse in
stuff like that, like Moroccan soil, Moroccan stuff" ("corpse" read as
"crops"). Worldwide coverage moves after Space Apps. Same rules as Part A:
every value cited with page and quote; nothing invented.

| ID  | Required behavior                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 | Every Moroccan field resolves to its administrative region (the 12 ADM1 regions, open-licence boundaries) and to national guidance; Tadla stays the detailed pilot.                                                              |
| M02 | Crops whose sources are national are plannable anywhere in Morocco, with citations stating national scope. Regional rules (for example sugar-beet sowing per sugar region) apply only where their source applies.                |
| M03 | Where a source defines Moroccan agroclimatic zones (rainfall classes, irrigated or rainfed), rules carry that scope and the field's zone is derived from recorded evidence or the farmer's answer, never guessed.                |
| M04 | More Moroccan crops where sources allow a complete comparable profile (sowing window, duration, a damage temperature limit), for example chickpea, lentil, pea, rapeseed, sunflower; others stay listed with their gaps.         |
| M05 | Moroccan soil: a field gets sourced soil properties (pH, texture, organic carbon, depth or drainage where available) with dataset, licence and resolution; a farmer or laboratory test overrides them; crop soil rules use them. |
| M06 | Release 0.4.0 imports beside earlier releases; real requests in several Moroccan regions (not only Tadla) produce compared rotations or name the missing evidence; tests, `pnpm verify`, report.                                 |
