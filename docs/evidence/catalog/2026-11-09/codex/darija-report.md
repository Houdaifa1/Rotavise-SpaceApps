# Darija names research — catalog 0.12.0

Research only, on `codex/darija-names`. The ten batch files cover all 246 crop
IDs, once each: 83 gaps first, four low-confidence claims next, then 159 other
recalled claims. Batches 01–09 contain 25 crops; batch 10 contains 21.

| Measure                                         | Confirmed | Contradicted | Not found |
| ----------------------------------------------- | --------: | -----------: | --------: |
| Crops with an accepted Darija attestation       |       158 |            0 |        88 |
| Exact recalled crop spellings (163 claims)      |        76 |            0 |        87 |
| Local/Arabic-labelled cultivar candidates (140) |         3 |            0 |       137 |

There are 272 crop name/source attestations. `confirmed` means **attested in
the cited source**, not approved for the app. A different spelling or synonym
does not contradict the recalled spelling. `not_found` means no accepted match
in the documented search, not that no Moroccan name exists. Null names/quotes
are deliberate missing evidence, never suggested labels. Standard Arabic is
separate: 229 crops and 26 cultivar candidates have `ar_only` evidence.

All 1,226 cultivar entries were inventoried; 140 candidates have detailed
records inside their parent crop. The inventory is not 1,226 individual web
searches. Official cultivar catalogs and the twelve recalled Darija cultivar
claims were checked without creating Arabic transliterations. The three
accepted local-name pairings concern Aakria, Moussa and Aissa; they do not prove
genetic identity of every clone bearing those names.

There is **one separate cultivar identity contradiction**: Derbana is identified
as _Opuntia megacantha_ in [Bourhia et al. (2019), DOI
10.1155/2019/9873146](https://doi.org/10.1155/2019/9873146), rather than the
catalog parent's _O. ficus-indica_. Its recalled Arabic spelling remains
unverified.

Reviewer decisions:

- Prioritize the 62 crops supported only by the AESVT educational herbarium;
  individual authors/field records were not shown. Literal source wording is
  evidence of an attestation, not independent validation of that website.
- Resolve shared/regional words, crop-form specificity, the broad `citrus`
  identity, and the flagged lamb's-lettuce/mung-bean naming ambiguity.
- Preserve quoted spelling. Decide display normalization of articles, vowels,
  Arabic presentation forms and decorative kashida separately. Grapefruit's
  Wiktionary heading explicitly says Moroccan Arabic, but its span has an
  inconsistent `ar` tag; that discrepancy is recorded.
- Do not transfer a name between related species: for example, the field-study
  eucalyptus is _E. globulus_, while this catalog specifies _E. camaldulensis_.

Final verification reopened all **344 saved source files**, checked every
SHA-256 with `shasum -a 256`, and checked **714 quotes: 667 literal text checks
and 47 visual PDF checks**, with **zero failures**. Damaged PDF extraction was
handled by rendered-page inspection, not guessed text. The detailed audit is
`darija-verification.json`; source URLs, times, licences, authors/DOIs and saved
paths are in `darija-sources.json`. This final pass reopened saved snapshots;
it does not claim every remote page was downloaded again. Search logs and
snapshots are in `.research-sources/2026-11-09/` (git-ignored). Tanji's INRA book
reserves reproduction rights: retain its copy for local research, not public
redistribution. Other unknown licences remain `unknown`.

Preview/check commands from the repository root:

```sh
python3 -m json.tool docs/evidence/catalog/2026-11-09/codex/darija-batch-01.json
shasum -a 256 .research-sources/2026-11-09/sparql-gap.json
```

No application code, catalog data, tests, migrations, locks or git history were
changed. No pnpm, Docker, commit or push was run. Please review the flagged
names and botanical mappings before choosing farmer-facing display labels.
