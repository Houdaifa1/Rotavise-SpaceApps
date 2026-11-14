# Codex task: native-quality review of the glossary translations (French, Standard Arabic) and Darija addition

Branch `codex/glossary-review`, this worktree. Do not push. The glossary lives in `packages/domain/src/glossary/*.ts` (served at `GET /api/v1/glossary?lang=`; see `docs/steps/15/p7-notes.md`). The French and Arabic text was machine-written by Claude and is marked `model_translated_unreviewed`.

Do:

1. Review every French and Standard Arabic entry for accuracy, plain farmer-friendly wording, consistent agronomic terminology (use the terms used by Moroccan agricultural sources: INRA Maroc, ONSSA, MAPMDREF; cite where you rely on a source in the notes file), and correct meaning against the English. Fix wording directly in the source files; keep codes and structure unchanged.
2. Add Moroccan Arabic (Darija, language code `ary`) to the glossary only if it can be done cleanly: extend the language list additively in the contract, the domain glossary types, the endpoint, the OpenAPI document, and tests. Write Darija text in Arabic script in everyday Moroccan wording; mark provenance `model_translated_unreviewed` for it (honestly: it is machine-written, not native-reviewed). Where you are unsure of a Darija word, fall back to a clear Standard Arabic phrase rather than invent a dialect word, and list those entries in the notes.
3. Keep all existing glossary tests green and add tests: every code has `ary`, no entry is empty, right-to-left direction for `ar` and `ary`.
4. Run with real exit codes (never pipe into `tail`): `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:api-docs`, `pnpm test:backend`; regenerate `docs/api/openapi.json` with `pnpm openapi:generate`. Commit on the branch. Write `docs/steps/15/codex-glossary-review-notes.md`: what changed (counts per language), the entries you are least sure about, what a native speaker must still check, commands and exit codes.
   Do not touch engine, climate, catalog, download or what-if code.
