# P11 notes: complete crop and variety names (catalog 0.12.0)

Date: 2026-11-09. Branch `claude/p11-names`. Nothing is pushed. The default
catalog is unchanged (`ROTATION_CATALOG_VERSION` stays 0.11.0); the parent
switches it after review.

## What was built

- **Catalog 0.12.0** (`data/catalog/releases/0.12.0`, built by
  `tooling/catalog/build-release-0.12.0.mjs` from the committed 0.11.0 and
  `tooling/catalog/release-0.12.0.names.mjs`). Strictly additive: the builder
  aborts if any profile differs from 0.11.0 outside the two name fields, if an
  earlier name moved or changed, or if the manifest, problems, regions or
  sources changed. A unit test checks the same.
- **Names added, with per-name provenance.** Each new name is
  `{ language, name, recall }` where `recall` is the existing model-recall record
  (`valueKind: model_recall_unverified`, `confidence` low/medium/high, `basis`,
  `recordedOn: 2026-11-09`, `researchItem: C12.name.<id>.<language>`).
- **Contract (additive):** `localNameSchema` gained an optional `recall`; varieties
  gained an optional `localNames` (`packages/contracts/src/catalog/catalog-v2.contract.ts`).
  The language code `ary` (Moroccan Arabic) already existed, so no language was added.
  Older releases still load and hash exactly as before.
- **API:** `GET /api/v1/catalog/options` (and the versioned form) now returns, per crop,
  `localNames` and `cultivars` (`id`, `name`, `localNames`). A name has `language`,
  `name` and, when recorded, `confidence`; the provenance text is not exposed.
  Format 1 catalogs return empty lists. OpenAPI regenerated (`docs/api/openapi.json`).
- **Search:** the server has no catalog search route; the frontend searches the options
  list it already loads, now with names in every language.

## Counts (catalog 0.12.0, from `docs/evidence/catalog/2026-11-09/names-log.json`)

|                                            | Before (0.11.0) | After (0.12.0) | Added                 |
| ------------------------------------------ | --------------- | -------------- | --------------------- |
| Crops with a French name                   | 243             | 246 of 246     | 3                     |
| Crops with a Modern Standard Arabic name   | 182             | 246 of 246     | 64                    |
| Crops with a Moroccan Arabic (Darija) name | 0               | 163 of 246     | 163                   |
| Varieties with any extra name              | 0               | 133 of 1,226   | 123 Arabic, 12 Darija |

- 83 crops have no Darija name. I left them out unless I was reasonably sure of a real,
  commonly used Moroccan word; they are listed in the review file.
- Most of the 1,226 varieties are international proper names (Fuji, Hass, Nules) and keep
  their one name by design. Only varieties with a real Arabic or Moroccan name got one: the
  Moroccan wheat, barley, lentil, chickpea, faba bean, olive, date, fig, pomegranate and
  prickly-pear cultivars and the named local populations.

## What is unverified (all of it)

- Every added name is recalled by the AI model; no source was consulted. Existing names from
  0.11.0 were not changed or checked.
- Darija spelling is not standardised. The 163 Darija crop names and 12 variety names, plus
  every name recorded as low, are in
  `docs/evidence/catalog/2026-11-09/names-for-native-review.md` for a native speaker.
- Some Modern Standard Arabic names for rarely grown crops are literal renderings
  (for example camelina, phacelia, phalaris, teff); they are marked `low`.
- Some existing 0.11.0 Arabic names look doubtful (for example `amaranth`, `common-vetch`,
  `cistus`). I did not change them because the release is additive; the review file does not
  re-check them either.
- The "same word as Modern Standard Arabic" Darija entries (for example barley, olive) are
  recorded so a Darija interface needs no fallback; they are not evidence of a distinct word.
- Nothing was run against real users. The glossary (`GET /api/v1/glossary`) still has no
  Darija text; a Darija screen falls back to Arabic there.

## Checked (2026-11-09, in the worktree; exit codes read)

| Command                                                                         | Result     |
| ------------------------------------------------------------------------------- | ---------- |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck`                              | all exit 0 |
| `pnpm test:catalog` (76 tests, incl. the 0.12.0 additive check and name counts) | exit 0     |
| `pnpm test:api-docs` (23 tests)                                                 | exit 0     |
| `pnpm test:plans` (58), `pnpm test:unit` (30)                                   | exit 0     |
| `pnpm test:backend` (70, incl. 0.12.0 import and the options route by language) | exit 0     |
| `pnpm test:container` (import list now ends at 0.12.0)                          | exit 0     |

No migration was added, so `terrain-integration` was not run. `pnpm verify`, `test:e2e`
and the web build were not run.

## For the parent to merge

- `tooling/verification/container-check.mjs` expects 0.12.0 in the import list.
- `tests/integration/rotation.test.mjs` imports 0.12.0 and adds the options-by-language test.
- The release directory adds about 4.6 MB of canonical JSON (0.11.0 is about 4.5 MB).

Proposed DECISIONS text:

> **Names in the catalog (2026-11-09).** Release 0.12.0 adds French, Modern Standard Arabic
> and Moroccan Arabic (Darija, `ary`) names to crops, and names to varieties that have a real
> Arabic or Moroccan one. All are model recall with a per-name confidence and are listed for
> native-speaker review. Nothing was removed; names do not affect the engine or any hash of an
> earlier release. The options API returns names by language; the frontend falls back
> ary to ar to fr to en. Gaps stay gaps rather than guesses.

Proposed PROGRESS text:

> Catalog 0.12.0 built (not default): every crop has a French and Arabic name, 163 of 246 have
> a Darija name, 133 varieties have extra names. Review file written; native-speaker review
> open. Options API exposes names.
