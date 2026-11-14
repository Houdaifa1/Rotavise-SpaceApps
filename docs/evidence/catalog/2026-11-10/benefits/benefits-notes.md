# Benefits research notes — 2026-11-10

## Scope and state

User-authorized research only in `docs/evidence/catalog/2026-11-10/benefits/` and `.research-sources/2026-11-10/`. AGENTS.md and CLAUDE.md were read. The current task is the benefits prompt under `docs/steps/15/`; it does not authorize Step 15 UI implementation or a new milestone. The pre-existing untracked prompt file was left untouched.

Finished artifacts: ten coverage batches for catalog 0.13.0, source manifest, original/English quotes, locality and management conditions, C-factor tables, context/rejection records, counts and gap report. Final research validation passed with exit 0: 131 quote occurrences, 92 distinct quote/file pairs, 36 text artifacts and 23 manifest sources checked; 1,755 tracked files unchanged.

Unfinished/unverified: exhaustive individual searches for every crop, expert agronomic and translation review, source conflicts, unknown redistribution terms, missing quantitative and local evidence, and production integration. No model_recall facts added. No code, contracts, runtime reason codes, translations/glossary entries or OpenAPI definitions changed; application tests and `pnpm openapi:generate` are not applicable to this research-only change.

## Executed command record

Commands ran on 2026-11-10. Inline Python snippets were used for data assembly and validation; no executable code file was added. No check was piped into `tail`.

| Command / operation                                                                                                                               | Exit code / outcome                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read repository instructions and task prompt; `git status --short`; `git branch --show-current`                                                   | 0; branch `codex/benefits`; one pre-existing untracked prompt                                                                                                                                                                                                        |
| Initial catalog inspection using the wrong `crop` key                                                                                             | 1; fixed to the existing `identity` structure, then inspection completed with 0                                                                                                                                                                                      |
| Hash tracked files using Python + `git ls-files -z`                                                                                               | 0; baseline contains 1,755 files                                                                                                                                                                                                                                     |
| Batched Python `urllib.request` retrievals and SHA-256 recording                                                                                  | 0 for batch processes; four individual HTTP 403 outcomes explicitly recorded; one non-document denial response rejected                                                                                                                                              |
| `pdftotext` extraction, `pdftoppm` page rendering, `tesseract` OCR                                                                                | 0 for completed commands; selected source pages inspected visually                                                                                                                                                                                                   |
| Inline effect assembly                                                                                                                            | Three exit-1 extraction-boundary failures; corrected exact apostrophe/line-end-hyphen anchors, affected assembly reruns completed with 0                                                                                                                             |
| Inline context assembly                                                                                                                           | 1 for an OCR apostrophe mismatch; corrected the exact source anchor, completed with 0                                                                                                                                                                                |
| Final batch/source/context/table/report assembly                                                                                                  | 0                                                                                                                                                                                                                                                                    |
| Inline Python research validator: catalog/effect coverage, numeric quote support, fresh source extraction/OCR, source hashes and tracked baseline | Two exit-1 checks exposed a decimal-format matcher bug (4.90 vs 4.9); corrected comparison without changing a fact. A subsequent exit-1 check found an unregistered copyright-page derivative; added its hash and image provenance. Final run: 0, all checks passed. |
| `pnpm exec prettier --write docs/evidence/catalog/2026-11-10/benefits`                                                                            | 0; unexpectedly bootstrapped local dependencies first; scoped artifact formatting completed.                                                                                                                                                                         |
| Direct Prettier CLI scoped write/check                                                                                                            | 0 for the direct scoped write and 0 for `node node_modules/prettier/bin/prettier.cjs --check docs/evidence/catalog/2026-11-10/benefits`; all matched files passed.                                                                                                   |

A batch retrieval process returning 0 does not mean every HTTP request succeeded. The per-request outcomes above remain explicit. Saved web-extracted publisher text is labelled as such; inaccessible full text is not claimed as downloaded.

## Review commands

From the repository root:

```sh
python3 -m json.tool docs/evidence/catalog/2026-11-10/benefits/benefits-summary.json
python3 -m json.tool docs/evidence/catalog/2026-11-10/benefits/benefits-batch-03.json
git status --short
```

Batch 03 contains chickpea; the crops are ordered lexically. The report links the context and tables. These are file-review commands, not a runtime planner demo.

## Proposed DECISIONS text — for reviewer adoption only

> Research-only rotation-benefit evidence for catalog 0.13.0 has been recorded separately from immutable releases. Preserve the distinction between biological fixation, net N balance and N recovered by the following crop. Retain mixture, management, harvest-mode and geographic restrictions; do not fill absent crop values from another crop or generic land-use table. Non-local C factors and month-level calendars remain context until local validation. Source conflicts remain unresolved, and all evidence requires review before catalog or planner use.

## Proposed PROGRESS text — for reviewer adoption only

> Benefits research pass delivered 10 batches covering all 246 catalog 0.13.0 identities: 102 sourced records across 45 crops, with explicit gaps for the other 201 crops. Saved evidence, SHA-256, quote/translation pairs, two C-factor tables and source restrictions are recorded in the dated benefits directory. This does not complete exhaustive research, expert review or planner integration. No catalog or application release changed. Verification results are in the research report; no user approval or milestone advancement is recorded.

## Dependency-bootstrap correction

The initial pnpm formatter invocation automatically installed dependencies. Birth-time inspection identified exactly seven newly created `node_modules` directories (root, apps/server, apps/web and the four packages), all created at 05:21 UTC by that invocation. Tracked source and lock hashes remained unchanged. The final formatter uses the installed CLI directly, then only those newly created directories are removed; cleanup result is recorded in `benefits-scope-verification.json` after removal.

No commit or push was attempted. Work remains uncommitted; restricted/unknown-licence source snapshots remain local research files.

## Final command outcomes

- Research validator: exit 0 (after the recorded failures were fixed).
- Scoped format check: exit 0.
- Cleanup and final scope/hash guard: recorded separately in `benefits-scope-verification.json`; this entry was written before removal.

Final cleanup and scope guard completed with exit 0: all seven newly created dependency directories were removed, all 1,755 tracked-file hashes still match, and no unexpected changed or untracked path was found. Source snapshots remain ignored local files. See `benefits-scope-verification.json`.
