"""Read published Morocco GeoParquet via HTTP; never infer new boundaries."""
import hashlib
import json
import pathlib
from datetime import datetime, timezone
import duckdb

ROOT = pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
URL = 'https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=MA/Morocco.parquet'
SITES = {'tadla': (-6.55, 32.4), 'beni-mellal': (-6.34, 32.37),
         'gharb': (-5.95, 34.5), 'souss': (-9.15, 30.4), 'saiss': (-5.1, 33.9)}
c = duckdb.connect(config={'extension_directory': '/tmp/rotavise-b2r-duckdb'})
c.execute('LOAD spatial; LOAD httpfs;')
summary = {'url': URL, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sites': {}}
summary['country'] = c.execute(f'''SELECT year("determination:datetime"),count(*),count(confidence),min(confidence),max(confidence)
FROM read_parquet('{URL}') GROUP BY 1 ORDER BY 1''').fetchall()
for name, (lon, lat) in SITES.items():
    bbox = [lon-.01, lat-.01, lon+.01, lat+.01]
    rows = c.execute(f'''SELECT id, year("determination:datetime"), confidence, "metrics:area", ST_AsGeoJSON(geometry)
FROM read_parquet('{URL}') WHERE bbox.xmax >= ? AND bbox.xmin <= ? AND bbox.ymax >= ? AND bbox.ymin <= ?
AND ST_Intersects(geometry,ST_MakeEnvelope(?,?,?,?))''', [bbox[0], bbox[2], bbox[1], bbox[3], *bbox]).fetchall()
    features = [{'type':'Feature', 'properties':{'id':r[0], 'year':r[1], 'confidence':r[2], 'areaSquareMetres':r[3]}, 'geometry':json.loads(r[4])} for r in rows]
    body = json.dumps({'type':'FeatureCollection','bbox':bbox,'features':features}, separators=(',',':')).encode()
    path = ROOT / 'samples' / f'ftw-{name}.geojson'
    path.write_bytes(body)
    summary['sites'][name] = {'bbox':bbox, 'features':len(rows),'countsByYear':{str(y):sum(r[1]==y for r in rows) for y in [2024,2025]}, 'nullConfidence':sum(r[2] is None for r in rows), 'sha256':hashlib.sha256(body).hexdigest()}
    print(name, summary['sites'][name], flush=True)
(ROOT/'samples/ftw-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
