# ECOSTRESS quality admission research and change (2026-11-09)

Scope: the user's ECOSTRESS task on `codex/ecostress-limit`, starting at
`3a0b715`. This does not authorize another milestone, a deployment or a push.

## Decision

No universal LST ceiling, dawn-specific limit, or validated Tadla plausibility
rule was found in the primary documents inspected. In particular, **64 C is
inside the documented instrument range**. The tiled V002 product does not
publish a numeric LST valid range. An arbitrary temperature cutoff would not
be justified.

Implement `ecostress-policy-2`: retain cloud-free land pixels with mandatory QA
`00` and **LST accuracy bits 15:14 equal to `10` or `11`**, the documented good
and excellent classes. This is Rotavise's conservative choice of documented
quality classes, not a NASA instruction to discard every marginal pixel and
not proof that an admitted value is physically correct. It also removes
plausible temperatures in the marginal class. No threshold was fitted to
make September look reasonable.

The rule and its citation text are in `ECOSTRESS_POLICY.lstQuality`. No new
temperature, emissivity, view-angle or direct `LST_err` cutoff is introduced.
The pre-existing 200–380 K normalizer guard and contract temperature bounds
are unchanged; **no primary-source justification for those legacy guards was
established**. They must not be presented as NASA valid ranges.

## Primary sources and exact excerpts

Original source bytes, extracted text, inspected page renders, a manifest and
`SHA256SUMS` are under `.research-sources/2026-11-09/ecostress/`, already
excluded by `.gitignore`. Hashes below identify the original downloads,
not reformatted copies. Page numbers are the documents' printed pages unless
stated otherwise. Excerpts preserve the words and numerical notation;
line wrapping is omitted.

### S1 — Collection 2 L2 user guide (implemented rule)

[Hulley & Freepartner, Level 2 Product User Guide v002, 19 August 2024](https://lpdaac.usgs.gov/documents/1574/ECOL2_User_Guide_V2.pdf),
Table 6, pp.17–18. Exact LST accuracy entries:

> 10 = 1 - 1.5 K (Good performance)

> 11 = <1 K (Excellent performance)

Other entries classify `00` as error above 2 K and `01` as 1.5–2 K. Mandatory
bits 1:0 describe TES production/degradation; `00` does not certify clear sky.
Collection 2 cloud/ocean bits 5:4 are unset; the separate cloud layer is needed.
Emissivity accuracy bits 13:12 classify error as above 0.02, 0.015–0.02,
0.01–0.015, and below 0.01 respectively.

Section 2.2, p.12 describes modeled per-pixel uncertainty using view angle,
water vapor and land cover. Table 3, p.13 lists swath LST raw values
7500–65535, scale 0.02 K, fill 0: this encodes 150–1310.7 K, not an
agricultural plausibility interval. Swath `LST_Err` raw values 1–255 use a
0.04 K scale (0.04–10.2 K), with fill 0. These encodings are not the float
units of the tiled AppEEARS LST column.

Saved: `ECOL2_User_Guide_V2.pdf`.
SHA-256: `66b4c53068c5024692e8e791d336e200004e5827aa2ad9e59d3f70f44d344d42`.

### S2 — LSTE ATBD and algorithm limits

[Hulley, LSTE ATBD v1.1, revision 25 October 2023](https://lpdaac.usgs.gov/documents/2235/ECO2_LSTE_ATBD_V1.1.pdf),
Table 2, p.11; §§5.2, 5.5, pp.38, 43; §§7–8, pp.66–72.
The product page links this revision. Exact instrument range entry:

> Bands 1–5 = 200 K – 500 K;

Exact iterative emissivity limit in §5.5:

> 0.5 < 𝜖𝑖 < 1.0.

TES depends on accurate radiance and atmospheric correction. NEM iterations
stop beyond 12; divergence or emissivity outside the algorithm's bounds
aborts TES and records error information. These are internal retrieval
conditions, not a time-of-day LST ceiling; they cannot be reconstructed from
this CSV. The documented QC LST accuracy classes agree with S1. The wide
swath storage range likewise cannot reject 337.1000061 K.

Saved: `ECO2_LSTE_ATBD_V1.1.pdf`.
SHA-256: `1f2e27cd25229b071a05ffa939daa8b03ff3fa64420833d17077732cb3db526f`.
The older [2018 LSTE ATBD](https://ecostress.jpl.nasa.gov/downloads/atbd/ECOSTRESS_L2_ATBD_LSTE_2018-03-08.pdf)
was also inspected and retained for comparison as
`ECOSTRESS_L2_ATBD_LSTE_2018-03-08.pdf`, SHA-256
`7c749fbdc7a67a78beef42a0d173c2aec073901e8f7251e7567ced0ba1902ac5`.
The 2023 revision removes plans to apply WVS: historical WVS discussion is
not evidence that the operational ECOSTRESS product uses it.

### S3 — Gridded/tiled user guide

[Halverson, Cawse-Nicholson & Johnson, Collection 2 Gridded and Tiled Data Products User Guide, 4 April 2023](https://lpdaac.usgs.gov/documents/1655/ECO_L1C-4_Grid_Tile_User_Guide_V2.pdf),
§3.2, p.12, exact excerpt:

> The uncertainty of the ST estimate is provided as LST_err

The guide states that swath QC is resampled into the tiled product and refers
users to the L2 guide to interpret it. Table 5, p.13, lists LST and its error
as float32 Kelvin, view zenith in degrees, QC as uint16, and separate cloud
and water masks. No recommended numeric view-zenith rejection limit is given
there. Do not apply the swath temperature scale again.

Saved: `ECO_L1C-4_Grid_Tile_User_Guide_V2.pdf`.
SHA-256: `ac14bfaa99e512f74af9914720b9b5be58d83aa9e6193e3fa87c6e57646abb21`.

### S4 — Official V002 tiled product page

[NASA LP DAAC / Earthdata, ECO_L2T_LSTE.002](https://www.earthdata.nasa.gov/data/catalog/lpcloud-eco-l2t-lste-002),
Variables table, exact LST description:

> Land Surface Temperature, Fill Value = NaN

Its LST, LST_err and view_zenith valid-range cells are all `N/A`.
Known Issues confirms the separate Collection 2 cloud mask, warns of
historical solar-array obstruction/geolocation problems, and reports that
LST_err was absent from tiled data generated for observations between
16 December 2025 and 10 June 2026. A direct error-layer filter would require
new input evidence and an explicit missing-data policy. This change uses the
QC column already present in the recorded file.

The web reader returned HTTP 403; `curl --fail --location` downloaded the
complete official page successfully, including its Variables table and links.
Saved: `ECO_L2T_LSTE_002_product.html`.
SHA-256: `07032e073ae277d17064cb8f99c4a225294b031880f3dfe8efebddf3a8aa15cb`.

### S5 — Collection 2 cloud ATBD

[Hulley, L2 Cloud ATBD, revision 6 October 2022](https://lpdaac.usgs.gov/documents/1575/ECOL2_ATBD_V2.pdf),
§5.1, p.14, exact excerpt:

> brightness temperatures less than Q1 are considered to be confident cloudy pixels.

The algorithm uses clear-sky brightness-temperature climatology with thresholds
interpolated in location and time. This is cold-cloud detection, not an upper
bound on retrieved ground temperature. Its LUT is not part of the real CSV;
a binary clear mask cannot certify that a hot value is plausible.
Despite its generic filename, this PDF is the **cloud** ATBD, not the LSTE ATBD.
The obsolete `/documents/1496/ECOL2_ATBD_V2.pdf` URL returned HTTP 404.

Saved: `ECOL2_ATBD_V2.pdf`.
SHA-256: `379eb0de4b522da685348d55ded10a831a3d224d009d3423f6bc15a864349f1f`.

### S6 — Validation of Collections 1 and 2

[Zhang et al. (2025), Remote Sensing of Environment 326, 114799](https://doi.org/10.1016/j.rse.2025.114799),
§3.2.1, pp.7–8, exact excerpt:

> the “3σ-Hampel identifier” rule was applied to both C1 and C2 estimates

[Author-hosted full paper](https://cas222huan.github.io/papers/2025RSE.pdf).
The evaluation uses ground matchups, the C2 cloud mask, an additional band-5
emissivity condition over gray bodies, and outlier rejection. This is a
validation workflow, not a universally applicable dawn cutoff. The real CSV
has neither ground reference LST nor band-5 emissivity; variable overpass times
and three September acquisitions do not justify copying that workflow into
this field summary. Aggregate validation accuracy is not a guaranteed bound
on each pixel's true error.

Saved: `Zhang_2025_C1_C2_validation.pdf`.
SHA-256: `ad97c434f667ec1c17a44e56bb879d050f0d6fa46326f151cf7716db9e67809a`.

## Real data and before/after

The complete original 684-row LSTE CSV was copied byte-for-byte from the
existing local `.artifacts/live/lste.csv` into
`docs/evidence/live/2026-11-09/ECO-L2T-LSTE-002-results.csv`.
SHA-256: `e7c0e429e459bed3b1546ea9599d1212b9531b76ecf009172f929d8cd37bb2a5`.
No new NASA extraction was submitted. Existing sample and ESI fixtures are
unchanged. None of the evidence rows were edited or synthesized.

The 2024-09-04 06:37:33 UTC row at all four sample points is 337.1000061 K
(63.9500061 C), raw QC 17088. Mandatory QA is `00`, data quality `00`, cloud
and water are zero, LST accuracy `01` (marginal), and emissivity accuracy `00`
(poor). The report's earlier statement that no flag catches the pixel needs
this qualification: no flag proves an outlier, but quality-class admission
can exclude it without inventing a temperature limit.

| Measure                         | Policy 1 (before) | Policy 2 (after) |
| ------------------------------- | ----------------: | ---------------: |
| Admitted LST pixels, whole file |               228 |               96 |
| LST acquisitions, whole file    |                57 |               24 |
| Combined LST/ESI acquisitions   |                58 |               27 |
| September 2024 LST acquisitions |                 3 |                0 |
| September 2024 mean (C)         |             34.32 |      unavailable |
| September 2024 maximum (C)      |             63.95 |      unavailable |

All three September acquisitions have marginal LST accuracy: 63.95 C on
4 September, 18.77 C on 5 September and 20.25 C on 9 September. Policy 2
removes all of them. There is no September ESI in the saved fixture either,
so **the summary omits that month entirely**, rather than fabricating zero
or a replacement temperature. The LST-accuracy selection is not an independent
emissivity-quality filter; it retains some pixels with poor emissivity
accuracy, as the source categories are distinct.

The before column replays the code present at task start, including its
mandatory-QA filter. The first live extraction described in `p9-live-runs.md`
predated that filter, so its stored totals differ. A direct comparison with
the task-start normalizer confirmed identical policy-1 pixel arrays.
`before-after.json` in the ignored research folder records the measured results.

## Versioning and verification

New ECOSTRESS requests persist `ecostressPolicyVersion: ecostress-policy-2`
before provider submission. Requests without a pin default to policy 1,
including queued/submitted requests created by the previous build. The
normalizer also accepts an explicit policy-1 argument for replay. Unknown
policies fail. Both result versions remain accepted by the contract and
OpenAPI. Existing results are read with their stored hashes, never rewritten.
No migration or change to terrain/MODIS/ESI handling is needed.

Policy 2 requires the raw uint16 QC column (which AppEEARS included in the
real response). Missing QC values are excluded; an absent column or malformed,
non-integer/out-of-range value fails validation. Raw mandatory bits are checked
even when the optional decoded mandatory-QA column is absent. QC fill zero
has poor LST accuracy and is excluded. Synthetic QC mutations are explicitly
labeled in tests; the real dawn row and whole-month regression use original
NASA evidence.

Targeted verification: 52 tests passed in `terrain` and `terrain-integration`,
including real CSV regression, all four LST accuracy categories, raw mandatory
QA, malformed/missing QC, ESI invariance, both contract versions, request
pinning, legacy processing and unchanged persisted result hashes. Integration
tests use disposable real PostgreSQL and pg-boss. The first targeted run
exited 1 because the new provenance reference exceeded the existing 300-character
contract limit; the reference was shortened, then the affected suite exited 0.

All six required checks completed with final exit code 0:

| Command              | Exit code | Result                                      |
| -------------------- | --------: | ------------------------------------------- |
| `pnpm lint`          |         0 | passed                                      |
| `pnpm format:check`  |         0 | passed                                      |
| `pnpm typecheck`     |         0 | server build and all workspace types passed |
| `pnpm test:backend`  |         0 | 72 tests, 6 suites                          |
| `pnpm test:unit`     |         0 | 30 tests, 1 suite                           |
| `pnpm test:api-docs` |         0 | 23 tests, 3 suites                          |

The initial API-docs run exited 1 because OpenAPI still allowed only policy 1.
Regenerating `docs/api/openapi.json` changed only the ECOSTRESS policy-version
field; the rerun passed. `pnpm test:unit` selects the foundation suite, so the
52 ECOSTRESS/terrain tests were run separately as described above. Full output
and captured subprocess exit codes are in the ignored `verification/`
directory; no command output was piped to `tail`. All seven original source
hashes passed `shasum -a 256 -c SHA256SUMS`.

Dependencies were installed with `pnpm install --frozen-lockfile` (exit 0),
using Node 24.19.0 and pnpm 12.6.0; the dependency lock was not modified.

## Reproduce locally

```sh
pnpm build:server
node --experimental-vm-modules node_modules/jest/bin/jest.js --config tooling/verification/jest.config.mjs --selectProjects terrain terrain-integration --runInBand
```

To print the September comparison after building:

```sh
node --input-type=module <<'JS'
import { readFileSync } from "node:fs";
import { normalizeEcostress } from "./apps/server/dist/modules/earth-observations/providers/terrain/normalization.js";
import { summarizeEcostress } from "./packages/domain/dist/index.js";
const raw = new Uint8Array(readFileSync("docs/evidence/live/2026-11-09/ECO-L2T-LSTE-002-results.csv"));
for (const version of ["ecostress-policy-1", "ecostress-policy-2"]) {
  const pixels = normalizeEcostress(raw, "lst", new Set(["p1", "p2", "p3", "p4"]), version);
  const month = summarizeEcostress(pixels).months.find(m => m.month === "2024-09");
  console.log(version, month ?? "September LST unavailable");
}
JS
```

## Unverified and remaining limitations

- The physical cause of the 4 September scene is unverified. No original
  granule, radiances, band emissivities, solar/view geometry, obstruction
  list match or ground thermometer was examined. The four points' agreement
  is not independent ground validation.
- Good/excellent modeled accuracy cannot guarantee actual temperature error;
  the same 63.95 C value would pass if its QC class were good/excellent.
- The scientific suitability and loss of coverage from selecting only these
  classes have not been evaluated for other fields or seasons. This change
  does not claim to recover a correct September temperature.
- Original stored results from before the earlier unversioned mandatory-QA
  fix remain intact, but their policy-1 label already spans two historical
  behaviors. This task reproduces policy 1 **as present at task start**;
  it cannot repair that earlier provenance ambiguity retroactively.
- No deployed app, live database or production data was modified. Source
  downloads and local fixture replay are the only new real-data operations.

## Commit handoff

The implementation and verification are complete, but **no commit was created**.
The requested `git add` exited 128 before staging any files:

```text
fatal: Unable to create '/Users/houdaifadrahm/projects/rotavise_project/.git/worktrees/codex-ecostress/index.lock': Operation not permitted
```

The managed sandbox permits worktree-file changes but treats the main
repository's Git metadata outside this worktree as read-only. Approval
escalation is disabled in this session. No alternate index, Git object store,
remote operation or permission workaround was attempted.

Run these commands in a local terminal in this worktree to create the requested
commit. The pre-existing untracked `codex-ecostress-limit-prompt.md` is excluded.

```sh
git add -- \
  apps/server/src/modules/earth-observations/application/extraction-store.ts \
  apps/server/src/modules/earth-observations/providers/terrain/normalization.ts \
  packages/contracts/src/observations/terrain-water.contract.ts \
  packages/domain/src/index.ts \
  packages/domain/src/terrain/ecostress.ts \
  tests/integration/terrain.test.mjs \
  tests/unit/terrain.test.mjs \
  docs/api/openapi.json \
  docs/PROGRESS.md \
  docs/steps/15/p9-live-runs.md \
  docs/steps/15/codex-ecostress-limit-notes.md \
  docs/evidence/live/2026-11-09/ECO-L2T-LSTE-002-results.csv
git diff --cached --check
git commit -m "Add sourced ECOSTRESS accuracy policy with legacy replay"
```

Nothing was pushed. Review remains pending.

## Proposed DECISIONS text (for review)

**ECOSTRESS accuracy admission (ecostress-policy-2).** Do not infer a universal
or dawn-specific LST ceiling from instrument range, storage range, or aggregate
validation error. New field extractions require cloud/water masks to be clear,
mandatory QC bits 1:0 = 00, and LST accuracy bits 15:14 = 10 or 11, following
the good/excellent classes in Hulley & Freepartner's 19 August 2024 L2 v002 user
guide, Table 6 pp.17–18. This admission choice is engineering judgment using
sourced categories and may remove otherwise plausible measurements. Keep
missing months missing, report the quality limitation, persist the policy on
requests, and retain policy 1 for older requests/results and explicit replay.
This filter is not a proof of physical plausibility or a crop heat threshold.

User review is pending; no approval is recorded by this task.
