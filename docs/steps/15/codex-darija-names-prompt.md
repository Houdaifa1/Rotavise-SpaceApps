# Codex task: source Moroccan Arabic (Darija) names for crops and varieties (research only)

Run from the repository root of a worktree on branch `codex/darija-names`.

You are a careful research assistant. Your only job is to **find and record
sourced Darija (Moroccan Arabic, language code `ary`) names** for the crops and
varieties in catalog release 0.12.0, so a farmer-facing app can show them.

## Hard rules

1. Research only. Write only inside `docs/evidence/catalog/2026-11-09/codex/`
   and `.research-sources/2026-11-09/`. Do not edit code, tests, `data/`,
   migrations, lockfiles or git history. Do not commit or push. Do not run pnpm
   or Docker.
2. Never invent, guess or "reconstruct" a name. Every name must appear in a
   source you opened, with the exact text (Arabic script) quoted. If no source
   gives a Darija name, record `not_found` with a short search log.
3. Distinguish Darija from Modern Standard Arabic. A source that only gives
   standard Arabic is evidence for `ar`, not `ary`; record it under `ar_only`.
   Record whether the source says the word is Moroccan (a Moroccan source, a
   Moroccan Arabic Wikipedia/Wiktionary entry, a Moroccan dictionary, an ONSSA /
   INRA / ministry / ORMVA document, or a Darija label on Wikidata) or just
   Arabic.
4. Save each source page you rely on to `.research-sources/2026-11-09/` and
   record its SHA-256 (`shasum -a 256`). Do not bypass paywalls or logins.
   Record the licence or `unknown`.
5. Quote exactly, then say which crop id it matches and why you are sure it is
   the same plant (give the scientific name shown by the source).

## Sources to use, best first

Wikidata labels and Wikipedia pages in Moroccan Arabic (`ary`), Wiktionary
`ary` entries, Moroccan official and technical documents (ONSSA, INRA Maroc,
MAPMDREF, ORMVA, IAV Hassan II, ONCA), AGROVOC and FAO multilingual pages where
a Moroccan name is shown, Moroccan agricultural publications and the Darija
names printed in ethnobotany studies of Morocco (peer-reviewed, with the author
and DOI).

## Inputs

- `data/catalog/releases/0.12.0/profiles/*.json` (246 crops: `identity.name`,
  `identity.scientificName`, `identity.localNames`, `cultivars`).
- `docs/evidence/catalog/2026-11-09/names-for-native-review.md` lists the names
  the AI recalled (language `ary`, with confidence) and the crops with no
  Darija name yet. **Treat the recalled names as claims to verify, not as
  sources.**

## Work, in this order

1. All crops with no Darija name (the gap list), then every recalled Darija
   name with confidence `low`, then every other recalled Darija name.
2. Then the cultivars that have a real local Moroccan name.

## Output

One JSON file per batch of 25 crops in
`docs/evidence/catalog/2026-11-09/codex/darija-batch-NN.json`:

```json
{
  "cropId": "apple",
  "scientificName": "Malus domestica",
  "ary": [
    {
      "name": "التفاح",
      "script": "arabic",
      "status": "confirmed | contradicted | not_found",
      "sourceId": "S1",
      "quote": "exact text",
      "isMoroccanSource": true,
      "recalledNameWas": "التفاح"
    }
  ],
  "ar_only": [{ "name": "…", "sourceId": "S2", "quote": "…" }],
  "searchLog": "short"
}
```

plus `darija-sources.json` (id, url, retrievedOn, sha256, savedFile, licence,
title) and a short `darija-report.md` with counts (confirmed, contradicted,
not_found) and anything the reviewer must decide. Finish by re-opening each
source and confirming every quote is on the page.
