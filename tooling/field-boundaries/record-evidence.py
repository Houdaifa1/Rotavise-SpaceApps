"""Save exact public responses with URL, status, UTC retrieval time and SHA-256."""
import concurrent.futures
import hashlib
import json
import pathlib
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path('docs/evidence/field-boundaries/2026-11-10')

def fetch(item):
    name, url = item
    if (name.startswith('sources/') and pathlib.Path(name).suffix in ['.html', '.json', '.md', '.js', '.xml']) or name.endswith('-search.json') or '-response.json' in name:
        name += '.raw'
    if (ROOT / name).exists():
        raise FileExistsError('Refusing to overwrite saved response: ' + name)
    started = datetime.now(timezone.utc).isoformat()
    request = urllib.request.Request(url, headers={'User-Agent': 'Rotavise-field-boundaries-research/1.0'})
    try:
        response = urllib.request.urlopen(request, timeout=55)
    except urllib.error.HTTPError as error:
        response = error
    except Exception as error:
        return {'file': name, 'url': url, 'retrievedAt': started, 'error': str(error)}
    with response:
        body = response.read()
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return {'file': name, 'url': url, 'retrievedAt': started,
                'status': response.status, 'headers': dict(response.headers),
                'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}

if __name__ == '__main__':
    items = json.loads(pathlib.Path(sys.argv[1]).read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(fetch, items))
    manifest = ROOT / 'retrievals.json'
    old = json.loads(manifest.read_text()) if manifest.exists() else []
    manifest.write_text(json.dumps(old + rows, indent=2) + '\n')
    for row in rows:
        print(row['file'], row.get('status', row.get('error')), row.get('bytes'))
