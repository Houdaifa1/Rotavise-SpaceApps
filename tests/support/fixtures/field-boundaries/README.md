# Real Moroccan boundary fixtures

`morocco-2025.ndjson` contains 29 unmodified FTW 2025 feature records derived
from the real Tadla, Beni Mellal and Souss GeoParquet samples retrieved on
2026-11-10. No geometry is synthetic. Selection: first eight records and the
two records with the most outer-ring positions from each window; duplicate IDs
removed. Oversized/tiny/complex source features are deliberately retained to
exercise rejection. The manifest pins the exact LF-terminated NDJSON bytes;
its SHA-256 must change if that file changes. `interior-points.json` contains
Shapely representative points of the original shapes, for lookup tests.

Source: [Fields of The World](https://source.coop/ftw/global-data),
Robinson et al. (2026), CC BY 4.0. Known confidence is a rescaled 500 m cell
score, not geometric accuracy. See the
[research report](../../../../docs/evidence/field-boundaries/2026-11-10/field-boundaries-report.md)
for URLs, saved sources, hashes and all five original window collections.

Tests import these real data into disposable PostgreSQL only. Controlled
mutations inside tests (null confidence, corrupt geometry, wrong hashes) are
explicit failure fixtures, not new production evidence. A sample manifest is
rejected by the operator importer unless `--allow-sample` is explicit; that
flag is prohibited in production.
