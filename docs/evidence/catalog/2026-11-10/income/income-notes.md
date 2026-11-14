**Income research notes — 2026-11-10**

Scope: the task in docs/steps/15/codex-income-research-prompt.md, not authorization for a frontend milestone, income release, deployment or Step 12 approval. Final retained writes are confined to docs/evidence/catalog/2026-11-10/income/ and .research-sources/2026-11-10/. The pre-existing untracked prompt was preserved. No commit or push was attempted.

Verified: ten batches account for 246 profiles, with saved-source quotes, original units, explicit unknown dates/nominal basis, conservative mappings, source flags and per-profile search logs. There are 654 primary numeric records, six options and 39 source snapshots. No model-recall input was added. Arithmetic conflicts and margin definitions are retained; records are ineligible for automatic calculations.

Unverified/unfinished: 179 profiles have no admitted numeric record; 67 remain partial. There is no complete current farm-income dataset, exhaustive per-crop web search, representative farm price/yield distribution, agronomist review, human translation review, modern commercial-presence census or reuse clearance for restricted/unknown-licence sources. Saved context sources were not mined exhaustively. No catalog import or production income calculation was implemented.

| Command / operation                                                           | Exit code / outcome                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| git status --short; git branch --show-current; guidance/catalog reads         | 0; codex/income; pre-existing untracked task prompt preserved                                                                                                           |
| Python inventory and baseline hash capture                                    | 0; 246 profiles; 1,190 protected pre-existing files                                                                                                                     |
| Python urllib.request original-source retrieval batches                       | 0 for successful saved batches; URLs, UTC times, sizes and SHA-256 in source/retrieval indexes                                                                          |
| pdftotext -layout on saved PDFs                                               | 0; scanned forage book has no embedded page text                                                                                                                        |
| pdftoppm and tesseract -l eng on selected forage pages                        | 0; OCR used for navigation; admitted scanned quotes read from original-page renders                                                                                     |
| Initial admin.ardna.org retrieval                                             | 1; DNS failure; original PDFs retrieved successfully from ardna.org/admincockpit/files/contenus_files/                                                                  |
| Initial search-response snapshot write                                        | 1; encoding error; fixed using an ASCII-escaped Python literal, subsequent exit 0                                                                                       |
| Initial monolithic economic extraction                                        | 1; asserted header was split across PDF lines; no final records written by that attempt. Replaced with actual native-row extraction; saved extraction commands exited 0 |
| Interactive helper after usage interruption                                   | Process unavailable; not claimed as a successful check. Persisted JSON reused                                                                                           |
| First report-authoring orchestration                                          | JavaScript syntax error before shell execution; no files written; corrected authoring command succeeded                                                                 |
| Final Python source/quote/coverage/protected-file verification                | 0; all 39 original snapshots reopened, 529 native CSV records checked, 654 primary records accounted for, all 1,190 protected hashes unchanged                          |
| pnpm exec prettier --version                                                  | 0; unexpectedly installed dependencies. Newly created node_modules trees will be removed after direct scoped formatter use; no tracked dependency file changed          |
| Direct node Prettier --write and --check on the authorized evidence directory | Both 0; all matched files passed                                                                                                                                        |

No failure was suppressed. Source inconsistencies remain evidence gaps. Work remains uncommitted because the user prohibited commits and the sandbox blocks the Git index.

Application checks are not applicable: no code, contracts or reason codes changed, so no domain tests, four-language glossary changes or pnpm openapi:generate were needed. Protected hashes cover existing releases, domain/contracts and OpenAPI. Research-specific validation and scoped formatting are the checks for this change.

Review/demo commands, from the repository root:

```sh
python3 -m json.tool docs/evidence/catalog/2026-11-10/income/income-counts.json
python3 -m json.tool docs/evidence/catalog/2026-11-10/income/income-verification.json
pnpm exec prettier --check 'docs/evidence/catalog/2026-11-10/income/**/*.{json,md}'
git status --short
```

Open income-report.md, then a batch and the referenced saved source. Locators identify the native CSV archive/line, PDF page counted from the cover, or image table cell. Private source snapshots must accompany a reviewer handoff if that reviewer lacks this workspace; they are not committed.

Proposed DECISIONS text (not applied): “Store income research independently of immutable releases. Keep date, nominal basis, market stage, product, geography and source accounting explicit. Never combine an old price, another product/region and an undated cost into profit. Composite commodities, illustrative feed values and reuse restrictions require review before production use.”

Proposed PROGRESS text (not applied): “Scoped income research on codex/income accounts for catalog 0.13.0 in ten batches: 246 profiles, 67 partial, 179 not_found, none complete for current farm-income use. Sources are saved/hashed; quotes and protected files were rechecked as recorded in income-verification.json. No code/catalog integration, milestone approval, commit or push. Human evidence/licence review and current matched price/yield/cost research remain pending.”

These are proposals only. No user approval or milestone advancement has been recorded. Please review the evidence and limitations before further research or integration.

The final quote pass checked 134 fresh-PDF fragment references, 242 fresh-HTML fragment references (including currency support), and 94 references to visually rechecked image fragments. Repeated references are not independent observations. All 110 private snapshot/search/derivative files are hash-indexed in income-snapshot-manifest.json.

The formatter command was executed directly with node after pnpm unexpectedly
created dependency directories. Only directories whose creation timestamps match
that command are eligible for cleanup; pre-existing files are preserved.

Dependency cleanup completed successfully (exit 0): all seven newly created
workspace dependency directories were removed. No pre-existing tree was removed.
The optional pnpm formatting review command requires development dependencies;
the Python JSON review commands do not install anything.
