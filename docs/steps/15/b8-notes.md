# B8 — complete crop and variety names, opt-in catalog 0.16.0

User-authorized B8 task, completed locally for review on 2026-11-13. Initial
`git status --short` was empty and no B8 notes or release existed; there was
no preserved B8 work to redo. Recall uses **2026-11-12**, the date explicitly
requested in the task. Source retrieval and verification retain their actual
2026-11-13 dates. Work remains **uncommitted and unpushed** as instructed;
no commit was attempted. This is not milestone approval.

## Outcome

Release `data/catalog/releases/0.16.0` is a strict names-only superset of
0.15.0. Every prior profile value, cultivar, name/provenance entry and array
position survives; only the version changes and name lists grow. Existing
sources, rules, research, issues, regions and conflicts are preserved. Two
name sources are appended. No existing release, dependency lock, default
catalog setting, calculation code or file under `apps/web` was changed.
The default remains **0.15.0**; choosing 0.16.0 remains the user's decision.
No shared application/production database was imported or modified.

| Language coverage      | 0.15.0 crops | 0.16.0 crops | 0.15.0 cultivars | 0.16.0 cultivars |
| ---------------------- | -----------: | -----------: | ---------------: | ---------------: |
| English (`en`)         |            0 |          246 |                0 |            1,226 |
| French (`fr`)          |          246 |          246 |                0 |                0 |
| Standard Arabic (`ar`) |          246 |          246 |              123 |              123 |
| Darija (`ary`)         |          178 |          246 |               12 |              148 |

The 1,472 English entries copy primary labels verbatim, including cultivar
proper names and type labels, with `origin: primary_name`. They do not claim
new model recall or source evidence. Runtime validation requires an English
label identical to its owning crop/cultivar's primary name and rejects
invented recall/citations on it. The crop-detail evidence field remains null
for these mechanical copies; `origin` records their provenance.

All **68** formerly missing crop Darija labels and **136** selected cultivar
labels carry individual `model_recall_unverified` records: confidence,
explicit basis, research item and `recordedOn: 2026-11-12`, with no quote or
citation. Imported international varieties are not blanket-transliterated.
The remaining **1,078** cultivars have no reasonably secure local form
recalled in this task; all are enumerated in the review file. This is a
model-knowledge limit, not proof that no Moroccan name exists.

Every represented language on every crop/cultivar has exactly one
`preferred: true` entry. Preference is a display selection, not confirmation
of correctness. Existing preferred sourced entries retain their status;
otherwise sources outrank recall and prior order breaks ties. Where an old
entry needed preference, a preferred copy is appended; its original remains
unchanged. Unknown preference/provenance on the retained original is still
unknown, not silently rewritten as false or confirmed.

## Evidence and native review

The quick search tried Darija Wikipedia/Wikidata/Wiktionary and Moroccan
agricultural documents. It did not turn unrelated or Arabic-only search hits
into claimed Darija attestations. Two actual Moroccan documents support four
new citation occurrences: Sulla and the Moroccan Picholine, Haouzia and Menara
olive cultivar names. Original PDF bytes were downloaded, hashed, rendered and
visually inspected using the PDF skill. Damaged Arabic extraction required
explicitly labelled visual transcriptions. Each citation binds the source
hash, page, render hash, short transcription and release extract hash.
All **1,986** older quote-check records survive, giving **1,990** checks.
There are **362** sources, up from 360.

The sources are Arabic-language Moroccan documents. Darija use of their
shared proper names/loan is the model's interpretation, not a claim that the
source itself is in Darija. INRA's Sulla passage is genus-level; it does not
establish a species-exclusive vernacular for H. coronarium. Those limits
remain in the source/citation metadata. Sourced entries are preferred over
separate recall entries even when their confidence is lower.

Rare introduced crops use recalled Arabic-script loans/transliterations
where no distinct inherited Darija term was reasonably recalled. These
candidates are explicitly qualified; local farmer use and spelling are not
established by completing a language field. Broad plant names can also be
species-ambiguous. No native-speaker or botanical review, usage survey or
claim of national prevalence is made.

- [Native review and remaining cultivar gaps](../../evidence/catalog/2026-11-12/names-for-native-review.md):
  every appended Darija entry, including preferred copies; every appended
  low-confidence entry (104 total: 74 Darija entries, comprising 46 crop and
  28 cultivar entries, plus 30 preserved Arabic entries copied for preference); all remaining
  cultivar Darija gaps.
- [Name ledger](../../evidence/catalog/2026-11-12/b8-names-log.json):
  exact counts and all additions, including basis and origin.
- [Source manifest](../../evidence/catalog/2026-11-12/b8-name-sources.json)
  and [source review](../../evidence/catalog/2026-11-12/b8-source-review.md):
  original URLs, exact retrieval instants, byte sizes, source/render hashes,
  PDF/printed pages and short transcriptions. Full originals/renders remain
  ignored under `.research-sources/2026-11-12-b8/`; no redistribution rights
  for those documents are claimed.

## Backend and implementation

`tooling/catalog/release-0.16.0.names.mjs` is the explicit recall input;
`tooling/catalog/build-release-0.16.0.mjs` assembles and validates the release
offline and asserts unchanged old-name prefixes and non-name profile values.
Its optional `--verify-originals` verifies saved PDFs and renders as well.
All 250 release files plus the generated ledger/review file (252 total) were
rebuilt byte for byte. Canonical catalog SHA-256:

`bb5118283c119860e1d331d3aaa79899d24a255a242b66e6583afe7827f3b789`

Canonical size: **10,437,544 bytes**, below the existing 16 MiB format-2
storage limit. No migration or dependency change is needed. Preserved 0.15.0
canonical SHA-256:
`b1c18550fdb08feedba05a149fbe4e017380d2604d7260e30bc0ff55f0b5c44b`.

Optional `origin` metadata has no parse defaults, preserving historical
catalog hashes and legacy crop-detail projection hashes. Both catalog
options endpoints expose names, confidence, preference and primary-copy
origin while keeping citations and recall text out of options. Crop detail
exposes the stored names with their actual citations/recall/origin. OpenAPI
was regenerated. No UI or search implementation was changed.

PostgreSQL integration lists include 0.16.0 in catalog round trips, crop-detail
imports and rotation options tests. The production-container importer list
also includes 0.16.0 and verifies import/reimport identity. HTTP assertions
check English/Darija crop coverage and cultivar counts, plus detailed sourced
and recalled provenance. Unversioned options uses an explicit test-only
`ROTATION_CATALOG_VERSION=0.16.0` override; executable defaults are preserved.

## Verification

All nine required commands passed on **2026-11-13**, with their real process
exit codes. No check was piped into `tail`. Full local logs remain in ignored
`.artifacts/b8/`; dates, counts and the API assertions are recorded in the
[verification ledger](../../evidence/catalog/2026-11-12/b8-verification.json).

| Command               | Exit code | Verified result                                                                                                                                                                        |
| --------------------- | --------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`           |         0 | ESLint and browser boundary checks                                                                                                                                                     |
| `pnpm format:check`   |         0 | Full repository formatting                                                                                                                                                             |
| `pnpm typecheck`      |         0 | Server build and workspace typechecks                                                                                                                                                  |
| `pnpm test:catalog`   |         0 | 122 tests / 7 suites; superset, counts, quote bindings, legacy hashes, runtime origin guards, PostgreSQL round trips and detail                                                        |
| `pnpm test:plans`     |         0 | 62 tests / 3 suites                                                                                                                                                                    |
| `pnpm test:backend`   |         0 | 95 tests / 8 suites; both options URLs, 246 en/ary crops, 1,226 en / 148 ary cultivars, preserved historical coverage                                                                  |
| `pnpm test:api-docs`  |         0 | 29 tests / 3 suites; OpenAPI freshness and real responses                                                                                                                              |
| `pnpm test:unit`      |         0 | 423 tests / 12 suites, including the existing web unit suite                                                                                                                           |
| `pnpm test:container` |         0 | Built production image, imported all 16 releases into disposable PostgreSQL 18, unchanged reimports, en/ary API coverage and detail provenance, existing engine/planning/worker checks |

The container command used
`BUILDX_CONFIG=/private/tmp/rotavise-b8-buildx`, a writable activity directory;
no image settings or checks were weakened. Additional successful checks:
standalone release build with `--verify-originals`, byte-for-byte rebuild of
252 generated files, OpenAPI generation, `git diff --check`, and unchanged
tracked earlier releases, `apps/web`, dependency lock and default config.
No migration was added. Full `pnpm verify`, browser e2e and the web build were
not run. Earlier missing-provenance detail gaps remain visible because their
original records were preserved, even though crop language coverage is complete.

The initial lint run exited 1 for an unused destructured variable; fixed.
The initial catalog run exited 1 (120 passed, 1 failed): the old preference
test rejected any recalled preference. It now tests the still-invalid case
of duplicate same-language preferences; provenance/quote rejection checks
remain. The next catalog run passed. After adding 0.16.0 to the generic
PostgreSQL round-trip list and another primary-origin corruption probe,
the final catalog suite passed all 122 tests. No failure was suppressed.

## Reproduce and review

```sh
pnpm build:server
node tooling/catalog/build-release-0.16.0.mjs
pnpm test:catalog
pnpm test:backend
BUILDX_CONFIG=/private/tmp/rotavise-b8-buildx pnpm test:container
```

The normal build is offline and needs only committed inputs. Add
`--verify-originals` when the saved PDFs and page renders are available.
The container check creates its own disposable PostgreSQL 18 database,
imports all releases and exercises the compiled API. It does not import into
the shared application database. After importing into an explicitly selected
demo database with the existing importer, read the versioned routes without
changing the default:

```sh
curl http://127.0.0.1:3000/api/v1/catalog/options/rotavise-pilot/0.16.0
curl http://127.0.0.1:3000/api/v1/catalog/crops/rotavise-pilot/0.16.0/olive
```

Please review the names and provenance, especially low-confidence loan forms,
regional/taxonomic mappings and the explicitly listed cultivar gaps. No
milestone advancement or default-version change is recorded.
