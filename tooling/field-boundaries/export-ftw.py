"""Export existing 2025 Morocco polygons, no inference or imagery processing.

Usage: python export-ftw.py OUTPUT.ndjson [--bbox west south east north]
Only a bbox-free export is labelled 'morocco'; bbox exports require the explicit
sample flag at import. Install the pinned research requirements separately.
"""
import argparse
import hashlib
import json
import pathlib
import tempfile
import urllib.request
import duckdb

URL = 'https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=MA/Morocco.parquet'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=pathlib.Path)
parser.add_argument('--bbox', type=float, nargs=4)
args = parser.parse_args()
if args.bbox:
    w, s, e, n = args.bbox
    if not (-17.1 <= w < e <= -.9 and 20.7 <= s < n <= 36):
        parser.error('bbox outside Morocco source envelope')
with urllib.request.urlopen(urllib.request.Request(URL, method='HEAD'), timeout=45) as response:
    etag = response.headers['ETag']
con = duckdb.connect(config={'extension_directory': str(pathlib.Path(tempfile.gettempdir()) / 'rotavise-field-boundaries-duckdb')})
con.execute('INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;')
predicate = ''
parameters = []
if args.bbox:
    predicate = ' AND bbox.xmax >= ? AND bbox.xmin <= ? AND bbox.ymax >= ? AND bbox.ymin <= ? AND ST_Intersects(geometry,ST_MakeEnvelope(?,?,?,?))'
    parameters = [w, e, s, n, w, s, e, n]
cursor = con.execute(f'''SELECT id, confidence, "metrics:area", ST_AsGeoJSON(geometry)
FROM read_parquet('{URL}') WHERE year("determination:datetime")=2025 {predicate}
ORDER BY id''', parameters)
digest = hashlib.sha256()
count = 0
with args.output.open('xb') as output:
    while True:
        rows = cursor.fetchmany(1000)
        if not rows:
            break
        for field_id, confidence, area, geometry in rows:
            feature = {'type': 'Feature', 'properties': {'id': field_id, 'year': 2025,
                       'confidence': confidence, 'areaSquareMetres': area}, 'geometry': json.loads(geometry)}
            body = (json.dumps(feature, separators=(',', ':'), allow_nan=False) + '\n').encode()
            digest.update(body)
            output.write(body)
            count += 1
with urllib.request.urlopen(urllib.request.Request(URL, method='HEAD'), timeout=45) as response:
    if response.headers['ETag'] != etag:
        raise RuntimeError('Upstream changed during export; discard export and retry')
manifest = {'format': 'ftw-morocco-2025-1', 'sourceUrl': URL, 'sourceEtag': etag,
            'license': 'CC-BY-4.0', 'attribution': 'Fields of The World (Robinson et al., 2026), CC BY 4.0',
            'year': 2025, 'sha256': digest.hexdigest(), 'scope': 'sample' if args.bbox else 'morocco'}
args.output.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'exported': count, **manifest}))
