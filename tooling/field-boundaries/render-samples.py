"""Render real published vectors over a clipped Sentinel-2 RGB image for review."""
import hashlib
import json
import pathlib
from datetime import datetime, timezone
import numpy as np
import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.transform import from_bounds
from PIL import Image, ImageDraw

ROOT = pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
rows=[]
for name in ['tadla','beni-mellal','gharb','souss','saiss']:
    collection=json.loads((ROOT/f'samples/ftw-{name}.geojson').read_text())
    west,south,east,north=collection['bbox']
    features=collection['features']
    search=json.loads((ROOT/f'samples/sentinel-{name}-search.json.raw').read_text())
    scene=min(search['features'],key=lambda s:s['properties']['eo:cloud_cover'])
    url=scene['assets']['visual']['href']
    transform=from_bounds(west,south,east,north,190,222)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
        with rasterio.open(url) as src:
            with WarpedVRT(src,crs='EPSG:4326',transform=transform,width=190,height=222) as vrt:
                rgb=vrt.read([1,2,3])
    path=ROOT/f'samples/sentinel-{name}-rgb.tif'
    with rasterio.open(path,'w',driver='GTiff',width=190,height=222,count=3,dtype='uint8',crs='EPSG:4326',transform=transform,compress='deflate') as out:
        out.write(rgb)
    rows.append({'site':name,'scene':scene['id'],'datetime':scene['properties']['datetime'],'source':url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bbox':collection['bbox'],'note':'Reprojected 10 m RGB window; nearest resampling. Display enlarged, no extra detail.'})
    base=Image.fromarray(np.moveaxis(rgb,0,2)).resize((570,666),Image.Resampling.NEAREST)
    panels=[]
    for source in ['imagery','FTW 2025','OSM']:
        im=base.copy();d=ImageDraw.Draw(im)
        selected=[f for f in features if f['properties']['year']==2025] if source=='FTW 2025' else []
        osm=ROOT/f'samples/osm-{name}.geojson'
        if source=='OSM' and osm.exists(): selected=json.loads(osm.read_text())['features']
        for f in selected:
            polygons=[f['geometry']['coordinates']] if f['geometry']['type']=='Polygon' else f['geometry']['coordinates']
            for poly in polygons:
                for ring in poly:
                    d.line([((p[0]-west)/(east-west)*570,(north-p[1])/(north-south)*666) for p in ring],fill=(255,240,0) if source=='FTW 2025' else (0,255,255),width=2)
        panel=Image.new('RGB',(570,726),'white');panel.paste(im,(0,60));pd=ImageDraw.Draw(panel)
        pd.text((10,8),f'{name} | {source} | {len(selected)} polygons' if source!='imagery' else f'{name} | Sentinel-2 {scene["id"]}',fill='black')
        pd.text((10,27),'Contains modified Copernicus Sentinel data (2025) | FTW CC-BY-4.0 | OSM ODbL',fill='black')
        pd.text((10,43),'0.02 x 0.02 degrees; image enlarged 3x; visual review, accuracy unmeasured',fill='black')
        panels.append(panel)
    out=Image.new('RGB',(1710,726),'white')
    for i,panel in enumerate(panels):out.paste(panel,(570*i,0))
    out.save(ROOT/f'overlays/{name}.png')
(ROOT/'samples/imagery-provenance.json').write_text(json.dumps(rows,indent=2)+'\n')
