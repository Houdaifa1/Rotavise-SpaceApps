# Catalog 0.13.0 notes

Built on 2026-11-09, on `codex/catalog-0.13.0`, from immutable 0.12.0 and
the [verified Darija research](../../evidence/catalog/2026-11-09/codex/darija-report.md).
This is the specifically authorized catalog task, not authorization to advance
the wider frontend milestone. The default catalog version is unchanged.
Final verification completed on 2026-11-10. All work is left uncommitted, as
the user instructed on resuming; the sandbox blocks the shared Git index.
Nothing was pushed.

## Contents

| Measure                                | Count |
| -------------------------------------- | ----: |
| Crops (unchanged)                      |   246 |
| Cultivars (unchanged)                  | 1,226 |
| Crops with sourced Darija              |   157 |
| Crops with recalled Darija only        |    21 |
| Crops with no Darija name              |    68 |
| Added distinct crop spellings          |   258 |
| Added cultivar names                   |     3 |
| Added sources                          |   170 |
| New citations and passing quote checks |   273 |
| Literal matches in source text         |   226 |
| Research visual PDF transcriptions     |    47 |

The research had 158 confirmed crops and 272 crop attestations. Both
lamb's-lettuce attestations are held back, leaving 157 crops, 270 crop
attestations and three cultivar attestations. Repeated identical sourced
spellings share one new entry with several citations. The three cultivar names
are Aakria **عكرية**, Moussa **موسى**, and Aissa **عيسى**. No `ar_only`, null,
unconfirmed or flagged name is added. All 88 crops without a confirmed
research name retain their entire profile, except its release version.

Every previous name stays unchanged and in place, including its recall record,
even when a sourced name has the same spelling. A source-backed entry is added
separately. Optional `citations`, `confidence` and `preferred` fields preserve
the hashes of older releases; the tests pin the recorded 0.11.0 and 0.12.0
hashes. Only one sourced name per language may be preferred. The first
attested spelling in research order is the display fallback, not a claim that
it is the best regional spelling. All added names have conservative `low`
confidence pending botanical and native-speaker review. The options API exposes
names, confidence and preference; it exposes no provenance text or citations.

Name citations allow short exact quotes; agronomic rule citations keep their
eight-character minimum. Source metadata now allows URLs up to 8,192
characters and original documents up to 64 MB so the complete SPARQL URLs
(maximum 4,372 characters) and the 50,290,776-byte INRA Tanji PDF are recorded
accurately. These are metadata bounds, not a change to the release loader's
file limits. Migration `0024_catalog_source_capacity` raises PostgreSQL's
source-count bound from 300 to the existing contract limit of 600, because this
release has 312 total sources. All other evidence checks and earlier migration
files stay unchanged. There is no dependency change.

## Evidence and limits

The builder reopens every new name source and verifies its SHA-256 against
`darija-sources.json` before checking quotes. All 170 original snapshots remain
outside Git. `sources.json` retains the original document hash, byte count,
URL, UTC retrieval time and exact licence string. Full PDFs and HTML are not
redistributed. The included
[name-only extracts](../../evidence/catalog/2026-11-09/codex/darija-0.13.0-quote-extracts.json)
bind each short name to the original hash, page, research audit location and
verification method. Quote checks also bind the extract file's SHA-256.

226 citations are literal NFC/case/whitespace-insensitive matches in extracted
source text. 47 use the completed research audit's visually checked PDF
transcriptions where the text layer is damaged: 46 in Smaili (2023), one in the
ONCA cactus photograph label. The machine checks those transcription extracts;
it does not independently read the Arabic pixels. ONCA PDF page 6 and Smaili
page 61 were also reopened visually during implementation. No claim is made
that the original websites were fetched again. INRA's reproduction restriction
and unknown licences remain recorded; the names-only extracts do not grant
rights to redistribute the source documents.

Botanical mappings, shared words and regional crop-form specificity still need
review. The AESVT educational herbarium has no individual authors/field records
in the research and is not independent expert validation. Grapefruit retains
the research note about the Wiktionary heading's Moroccan-Arabic language and
its inconsistent `ar` span tag. Decorative kashida and Arabic presentation
forms remain exactly as researched; no spelling normalization was applied.
The accepted cactus cultivar names are name-level pairings, not proof of
genetic identity for every clone. All five held identities are listed in
[the flagged review file](codex-0.13.0-flagged.md).

Existing agronomic knowledge, source rights issues, expert-review status and
planning limitations are unchanged. No climate, what-if, engine or download
code is changed. Nothing is deployed or pushed.

## Verification commands and exit codes

Every required command was rerun on 2026-11-10, sequentially, from the
repository root. The actual subprocess exit codes were captured without shell
pipelines; full output is saved locally under
`/tmp/rotavise-catalog-0.13.0-verification-2026-11-10/`, with the command ledger
in `results.json`. Every required command exited zero.

| Command               | Exit code | Result                                                                                                 |
| --------------------- | --------: | ------------------------------------------------------------------------------------------------------ |
| `pnpm lint`           |         0 | ESLint passed.                                                                                         |
| `pnpm format:check`   |         0 | Repository formatting passed.                                                                          |
| `pnpm typecheck`      |         0 | Workspace build and typechecks passed.                                                                 |
| `pnpm test:catalog`   |         0 | 83 tests: superset, counts, quote checks, immutable hashes, PostgreSQL import and source bounds.       |
| `pnpm test:plans`     |         0 | 58 unit, integration and recovery tests.                                                               |
| `pnpm test:backend`   |         0 | 73 tests across six suites, including 0.13.0 options and historical names.                             |
| `pnpm test:api-docs`  |         0 | 23 tests, including OpenAPI freshness and real-response validation.                                    |
| `pnpm test:unit`      |         0 | 30 foundation unit tests.                                                                              |
| `pnpm test:container` |         0 | All nine production-container checks passed; every release imported and repeat imports were unchanged. |

The container command uses
`BUILDX_CONFIG=/tmp/rotavise-catalog-0.13.0-buildx` so Docker can write its
Buildx activity state inside the sandbox's writable area. This changes no
checks, image configuration or catalog data.

Additional successful setup and verification:

| Command or check                                                                         | Exit code | Result                                                                                                                     |
| ---------------------------------------------------------------------------------------- | --------: | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                         |         0 | Dependencies installed; the lock stays unchanged.                                                                          |
| `pnpm build:server`                                                                      |         0 | Build completed before the final standalone release rebuild.                                                               |
| `pnpm exec drizzle-kit generate --name catalog_source_capacity` (in `packages/database`) |         0 | Generated and reviewed migration 0024, its journal entry and schema snapshot; only the catalog source-count guard changes. |
| `pnpm openapi:generate`                                                                  |         0 | Regenerated the API contract; the fresh API-docs check confirms it remains current.                                        |
| `pnpm exec prettier --write` (affected files)                                            |         0 | Formatted source, test and documentation additions and the pre-existing research/prompt formatting issues.                 |
| Research JSON comparison against `git show HEAD:<path>` (Python)                         |         0 | Every original research JSON value, including spellings, quotes, source URLs and hashes, is identical.                     |
| Rebuild byte comparison (Python SHA-256)                                                 |         0 | All 250 generated files reproduced byte for byte.                                                                          |
| `git diff --check`                                                                       |         0 | No whitespace errors.                                                                                                      |

The final standalone release build also exited **0**, with this exact command:

```sh
node tooling/catalog/build-release-0.13.0.mjs /Users/houdaifadrahm/projects/rotavise_project/.claude/worktrees/codex-darija
```

The canonical catalog SHA-256 is
`52e191350dba6f02aadcc1fee57d97b4071a950882ce2c9df7b0ae136141cc63`.
All **686** quote checks pass: 413 carried forward unchanged and 273 new.
Earlier release files, the default version configuration and the dependency
lock have no diff against HEAD.

Earlier failures were inspected and resolved; they are not counted as passes:

| Command                                                                        | Exit code | Cause and resolution                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial 0.13.0 builder command                                                 |         1 | The old source metadata size ceiling rejected the 50,290,776-byte INRA PDF. Raised the metadata bound to 64 MB; retained the exact hash and size.                                              |
| Initial `pnpm format:check`                                                    |         1 | Imported research records and the existing task prompt needed formatting. Applied formatting and verified that every research JSON value remains identical.                                    |
| Initial `pnpm test:catalog`                                                    |         1 | The 312-source release exceeded PostgreSQL's old 300-source guard. Migration 0024 aligns it with the existing 600-source contract.                                                             |
| Next `pnpm test:catalog`                                                       |         1 | The new round-trip assertion compared raw entity-list order with canonical database order. Corrected it to compare the complete canonical bodies, keeping name and citation order significant. |
| Initial `pnpm test:container`                                                  |         1 | The sandbox blocked Buildx's activity file under `~/.docker`. Used writable temporary Buildx state; all nine checks now pass.                                                                  |
| Rebuild attempted during another command's compilation                         |         1 | Concurrent compilation was replacing `dist`, causing a missing-module error. Serialized builds and checks, then reran the builder successfully and proved byte-identical output.               |
| `git add --dry-run tooling/catalog/build-release-0.13.0.mjs` (before resuming) |       128 | The sandbox blocks the shared worktree index lock. The user's resumed instruction explicitly requests leaving the work uncommitted; no new commit or push was attempted.                       |

## Rebuild and demo

Use the original hash-matching research snapshots, with Poppler's `pdftotext`
installed. Pass the root that contains the research's `.research-sources/`
directory; omitting it uses the current repository root:

```sh
pnpm build:server
node tooling/catalog/build-release-0.13.0.mjs /path/to/research-worktree
```

The release imports through the existing `pnpm catalog:import` command. For a
local review against an already configured disposable/development PostgreSQL,
import all releases, run the existing API with `PLAN_CATALOG_VERSION=0.13.0`,
and inspect `GET /api/v1/catalog/options`. Historical options are available at
`GET /api/v1/catalog/options/rotavise-pilot/0.13.0` after import, without
changing the configured default. `pnpm test:catalog` and `pnpm test:backend`
provide automated disposable-PostgreSQL demonstrations.

## Proposed DECISIONS text

> Catalog 0.13.0 adds sourced Darija names without changing any earlier values.
> Recalled entries remain, and optional name citations, confidence and preference
> preserve historical hashes. Preference follows research order and is not
> native-speaker approval. Short name quotes use a dedicated citation contract;
> every new citation has a machine check bound to original source and extract
> hashes. Visual PDF transcriptions are distinguished from literal source-text
> matches. Migration 0024 aligns the database source cap with the contract's
> existing 600-source bound. The five flagged identities remain for reviewer decision. The
> default catalog version stays unchanged.

## Proposed PROGRESS text

> Catalog 0.13.0 is ready for review: 157 crops with sourced Darija, 21 with
> recall only and 68 without, across the same 246 crops and 1,226 cultivars.
> It adds 258 crop spellings, three cultivar names and 273 passing quote checks.
> Earlier releases and agronomic values are unchanged. Botanical and
> native-speaker review remain pending. No default switch or deployment.

No approval or milestone advancement is recorded by this report.
