# B8 name evidence review

Task date: 2026-11-12. Retrieval and visual inspection: 2026-11-13 (actual
UTC retrieval instants are recorded in `b8-name-sources.json`). Recall records
use the task's explicitly requested `recordedOn: 2026-11-12`.

The quick search tried Darija Wikipedia/Wikidata/Wiktionary and Moroccan
agricultural documents. It did not establish reliable vernacular attestations
for all 68 gaps. Unrelated or wrong-language search hits were not relabelled
as Darija evidence. The fallback is explicitly unverified model recall, with
loan/transliteration candidates for uncommon introduced crops. Local usage of
those forms needs native review; filling the language field is not a usage
survey or a botanical validation.

Two original documents were successfully downloaded. Poppler extracted their
text, but damaged Arabic glyphs made literal matching of all names unreliable.
The PDF skill was used to render and inspect the complete relevant pages:

- [Official bulletin hosted by ONSSA](https://www.onssa.gov.ma/wp-content/uploads/2022/11/ARR.1979-20.Ar_.pdf):
  PDF page 2, printed page 1161, article 5, names the Moroccan Picholine,
  Haouzia and Menara olive varieties. The three short Arabic-script names were
  visually checked on the original page.
- [INRA annual report 2012, Arabic](https://www.inra.org.ma/sites/default/files/docs/rapactivites/rapactivites12ar.pdf):
  PDF page 39, printed page 37, pairs the Arabic Sulla loan name with Latin
  Sulla and discusses Hedysarum sp in northern Moroccan pasture research.
  The short name was visually checked. This establishes the genus-level
  designation, not an exclusive vernacular for Hedysarum coronarium.

These documents are written in Arabic. Their shared proper names and Sulla
loan are interpreted as usable in Darija by the model; the sources do not
label their own text as Darija. This limitation is recorded on each source
and on the relevant citation, with low or medium confidence. They outrank
the separate recalled entries for display, without increasing the recalled
entries' confidence or deleting them.

`b8-name-sources.json` retains source URLs, sizes, original SHA-256, PDF and
printed page locators, render SHA-256 and short visual transcriptions. Original
PDFs and full-page renders stay in ignored `.research-sources/2026-11-12-b8/`;
no full documents are redistributed. Only four very short name quotes enter
the release. No rights to redistribute the original documents are claimed.

The release builder checks each quote against this explicitly labelled visual
transcription. `--verify-originals` additionally verifies the original PDF bytes
and renders. Offline tests bind every new citation to the original source hash,
transcription, render hash and release extract hash, retaining every older
quote-check entry unchanged. This is a reproducible transcript check, not a
claim of an undamaged literal PDF-text match or independent human review.
