# Crop evidence review — 2026-09-27

This is research extraction, not specialist approval. Release `rotavise-pilot`
`0.1.0` contains three candidate profiles, all pending local review. All extracted
rules are `reference` / `research`; none is a production recommendation threshold.
The source manifest stores exact URLs, retrieval instants, hash type, SHA-256,
byte counts, geographic scope and limitations. Rule citations include PDF page
and section/table locators. Page numbers below count from the first PDF page.

## Primary evidence and interpretation

| Source                                                                                                                                                                                                               | Verification and use                                                                                                                                                                                                              | Limits                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ONCA cereals](https://ardna.org/admincockpit/files/contenus_files/ticket_file641196ed6f8cc-N891-R%C3%A9f%C3%A9rentiel-c%C3%A9r%C3%A9ales-MEP-HB-29_05_2017-%28final%29.pdf)                                         | 133-page document downloaded, HTTP 200. Page 23 section 3.1 distinguishes durum wheat: drainage preference and germination reference.                                                                                             | Adjacent bread-wheat water figures are excluded. Cover does not establish publication year.                                                                                                                                                    |
| [INRA wheats](https://www.inra.org.ma/sites/default/files/Fiche_technique_des_ble%CC%81s_0.pdf)                                                                                                                      | Nine-page document, HTTP 200 with curl and TLS verification. Cover page 2 states 2023. Pages 3–4 support soil references, legume rotation preference and November sowing preference.                                              | National guidance, not locally validated cultivar duration or water accounting.                                                                                                                                                                |
| [ONCA sugar crops, Beni Mellal-Khenifra](https://ardna.org/admincockpit/files/contenus_files/ticket_file622f2a0dc6c9a-N1077_Cultures-sucri%C3%A8res-Fiche-technique-Beni-Mellal-Khenifra-ardna.pdf)                  | 45 pages, HTTP 200. Page 10 Table 3 visually inspected: Beni Moussa, Dir and Beni Amir share an early September to mid-November sowing window. Page 6 supplies pH, favorable temperature and a yield-conditioned water reference. | Window normalized approximately to 09-01–11-15. Page 8 requires campaign commission dates. Page 10's 250-day example is not a cultivar maturity interval; no duration generated. Degree-day base unspecified, excluded.                        |
| [ONCA food legumes, Rabat-Sale-Kenitra](https://ardna.org/admincockpit/files/contenus_files/ticket_file641194211727c-N1077-Fiche-technique-l%C3%A9gumineuse_RSK_VD_5.pdf)                                            | 44 pages, HTTP 200. Page 8 section 2.1 visually inspected: faba soil, stage means and annual water reference. Page 11 faba subsection supplies the broad autumn window.                                                           | Different region. Emergence is retained as emergence. Stage means do not become daily air limits. Annual water is not seasonal ET. Ambiguous fertility sentence excluded rather than silently corrected.                                       |
| [INRA Afourer demonstration](https://benimellal.inra.org.ma/actualites/journee-de-demonstration-sur-les-nouvelles-varietes-de-cereales-legumineuses)                                                                 | Official event dated 2024-05-06; curl HTTP 200. Includes durum and faba among demonstration crops.                                                                                                                                | Context only. Does not establish farm suitability or local rule validity.                                                                                                                                                                      |
| [Kew durum](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:77188896-1), [faba](https://powo.science.kew.org/taxon/524737-1), [beet](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:164505-1) | Official accepted names and classification inspected through browser retrieval. Three short factual extracts committed and hashed.                                                                                                | Direct Node downloads returned 403. Challenge bytes are logged as failures, never used as taxonomy hashes. Beet's current family is Amaranthaceae; the older guide uses Chenopodiaceae. Taxonomy supplies no cultivar or suitability evidence. |

## What remains unknown

- No cultivar or farm production system has been selected and reviewed.
- No locally reviewed sowing-to-harvest duration intervals for these profiles.
- No consistent sourced low/moderate/high water-demand comparison method.
- No locally reviewed numerical crop-return intervals or transition exclusions.
- Soil pH measurement methods and temperature averaging/media are incomplete.
- No irrigation water balance, adequacy verdict or measured soil improvement.
- No agronomist has reviewed these extractions or supplied approval.

Unknowns are mandatory structured fields with reasons, not missing columns or
invented defaults. The readiness function returns `insufficient_evidence` for
all three profiles, with named field/rule gaps. Region identifiers describe the
evidence; they do not create a hard coordinate or city boundary. A request for a
crop outside the catalog preserves its ID and reports `CROP_NOT_IN_CATALOG`.

## Retrieval integrity and limits

`retrievals.json` records successful requests, failed TLS attempts and HTTP 403
responses. Node could not validate INRA's certificate chain; normal curl using
system trust succeeded. No TLS verification was disabled. The regional beet
document was fetched from its working publisher host, not silently replaced by
an unofficial copy. Full PDFs/HTML remain in ignored local research artifacts;
release data retains factual references and document byte hashes. The Kew hash
explicitly covers our committed verified extraction, not original HTML bytes.

No explicit full-document redistribution license was verified. Full source
documents are not bundled in the repository or image. Retrieval proves access
at the recorded time; hashes detect byte changes, not factual correctness,
commercial rights or ongoing availability. Publication years are null where
the inspected source did not establish them; filename, contract and crawler
dates are not substituted for publication dates. Ordinary tests use retained
evidence and need no live source request.
