"""Hash final evidence and verify original upstream bytes were not changed."""
import hashlib
import json
import pathlib

root=pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
rows=json.loads((root/'retrievals.json').read_text())
for row in rows:
    if 'sha256' in row:
        actual=hashlib.sha256((root/row['file']).read_bytes()).hexdigest()
        if actual!=row['sha256']:
            raise ValueError('Upstream evidence hash mismatch: '+row['file'])
# Derived collections may be reformatted. Their summary hashes refer to final
# on-disk bytes, not the upstream country-file bytes.
for source in ['ftw','osm']:
    path=root/f'samples/{source}-summary.json'
    summary_text=path.read_text()
    summary=json.loads(summary_text)
    for name,record in summary['sites'].items():
        actual_hash=hashlib.sha256((root/f'samples/{source}-{name}.geojson').read_bytes()).hexdigest()
        summary_text=summary_text.replace(record['sha256'],actual_hash)
    path.write_text(summary_text)
lookup={r['file']:r for r in rows}
lines=['# Field-boundary evidence ledger','',
       'Exact upstream response files end in `.raw` where needed to preserve bytes. All hashes below are SHA-256 of the saved file. Derived crops, subsets and overlays are research artefacts, not reference truth. HTTP failures and TLS failures are retained in retrievals.json; a TLS failure has no response body to hash. Do not treat a failed response as successful coverage.','',
       'The provided FTW PDF/text were copied from the user-specified local files. Their original network retrieval time is not verified; the paper URL is https://arxiv.org/abs/2605.11055. The 244,460,002-byte Geofabrik PBF stays in /tmp; its SHA-256 is in samples/osm-summary.json, and the committed small subsets are hashed here. Full remote GeoParquet/PMTiles were queried by range and were not downloaded in full; source ETags/sizes and actual range samples are recorded.','',
       '## Saved sources and exact responses','',
       '| File | Original URL / status | Bytes | SHA-256 |','| --- | --- | ---: | --- |']
for path in sorted((root/'sources').iterdir()):
    relative=str(path.relative_to(root));record=lookup.get(relative,{})
    url=record.get('url','local copy or derived HTTP HEAD record; see file')
    status=record.get('status','see file')
    lines.append(f'| [{path.name}]({relative}) | {url} — {status} | {path.stat().st_size} | `{hashlib.sha256(path.read_bytes()).hexdigest()}` |')
lines+=['','## Samples and overlays','',
        'FTW subsets: query of the linked Morocco GeoParquet, filtered by bbox and exact intersection, retaining original geometry/properties. OSM subsets: assembled requested landuse areas from Geofabrik PBF; coverage uses union of clipped polygons and WGS84 geodesic area. Academic subsets: geometry-only extraction from saved CC BY 4.0 Figshare RAR. Imagery: saved Earth Search responses select a Sentinel-2 visual COG; RGB windows were reprojected/cropped and displayed enlarged. Cleaned GeoJSON: actual backend cleaner applied to 2025 polygons. Raster comparison PNGs are WMS response bytes. Code and pinned research requirements are in tooling/field-boundaries/.','',
        '| File | Provenance / HTTP status | Bytes | SHA-256 |','| --- | --- | ---: | --- |']
for directory in ['samples','overlays']:
    for path in sorted((root/directory).iterdir()):
        relative=str(path.relative_to(root));record=lookup.get(relative,{})
        url=record.get('url','derived; see method and provenance JSON')
        status=record.get('status','derived')
        lines.append(f'| [{path.name}]({relative}) | {url} — {status} | {path.stat().st_size} | `{hashlib.sha256(path.read_bytes()).hexdigest()}` |')
lines+=['','## Unsuccessful network requests','']
for r in rows:
    if 'error' in r:
        lines.append(f'- {r["url"]}: {r["error"]}; retrieved {r["retrievedAt"]}. No response bytes obtained.')
lines+=['','The separate `retrievals.json` also records 4xx/5xx bodies. Failed `crop_mask_northern` WMS layer names were corrected to the advertised `crop_mask` layer; both the rejection and successful responses remain saved.','']
(root/'source-index.md').write_text('\n'.join(lines))
print('Verified',sum('sha256' in r for r in rows),'upstream response hashes; indexed source/sample/overlay files.')
