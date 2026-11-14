# Codex task: build catalog release 0.13.0 with the sourced Darija names (code, on this branch)

Work on branch `codex/catalog-0.13.0` in this worktree. Do not push. Commit when checks pass.

## Goal

Release 0.13.0 is a strict superset of 0.12.0 (nothing removed, no existing value changed except adding names). It adds **source-backed** Darija (`ary`) crop names from the verified research in
`docs/evidence/catalog/2026-11-09/codex/` (`darija-batch-*.json`, `darija-sources.json`, `darija-report.md`).

## Rules

1. Follow the exact pattern of `tooling/catalog/build-release-0.12.0.mjs` and `release-0.12.0.names.mjs`, and how 0.12.0 names carry a `recall` record. Add `tooling/catalog/build-release-0.13.0.mjs` (+ data module). Release 0.12.0 and earlier stay immutable.
2. Use only records with `status: "confirmed"` and a non-empty `quote`, for `ary`. Never use `ar_only` as Darija. Never use null names. Do not invent, normalise or "fix" spelling: store the quoted spelling exactly (keep Arabic presentation forms out only if the data already has a cleaned form; if you must normalise, record the original in the citation).
3. A sourced name needs a citation like other sourced items in the catalog (look at how `citations`, `sources.json` and `quote-check.json` work in 0.11.0/0.12.0) pointing to a source entry built from `darija-sources.json` (id, title, url, retrievedOn, licence, sha256). The quote-check must pass for every new citation; follow the existing quote-check mechanism and make the new sources' quotes verifiable the same way as existing ones (never commit non-redistributable source files; keep only what the existing mechanism needs).
4. A sourced name beats a recalled one: if a crop already has an `ary` name by recall with a different spelling, keep both names (both stay in the list), mark the sourced one as preferred if the schema has such a notion; if not, add an additive way (e.g. a `preferred` flag or ordering) with a contract change that keeps older releases loading and hashing.
5. For the 88 crops with no confirmed Darija name, change nothing.
6. List every crop where the quote's botanical identity was flagged in `darija-report.md` (lamb's lettuce, mung bean, broad `citrus`, eucalyptus species mismatch, Derbana) in `docs/steps/15/codex-0.13.0-flagged.md` and do NOT add those names; the reviewer decides.
7. Do not change the default catalog version. Do not touch climate, what-if, engine or download code.
8. Tests: a unit test that 0.13.0 removes nothing from 0.12.0 (copy the existing 0.12.0 superset test), counts of sourced Darija names, quote-check passing, and import into PostgreSQL in the existing container/integration tests the way 0.12.0 is (update `tooling/verification/container-check.mjs` and `tests/integration/*` lists accordingly). Expose provenance (sourced vs recalled) in the catalog options API/OpenAPI only if existing names expose it; keep the existing rule that names carry confidence and no provenance text. Regenerate `docs/api/openapi.json` with `pnpm openapi:generate` if contracts change.
9. Run with real exit codes (do not pipe checks into `tail`): `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:catalog`, `pnpm test:plans`, `pnpm test:backend`, `pnpm test:api-docs`, `pnpm test:unit`, `pnpm test:container`. Fix causes, never suppress.
10. Write `docs/steps/15/codex-0.13.0-notes.md`: counts (crops with sourced Darija, with recalled only, with none), what is unverified, the commands you ran with their exit codes, proposed DECISIONS/PROGRESS text.
