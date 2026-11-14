"""Render saved real geometry and raster windows, without generating evidence."""
import json
import pathlib
import rasterio
import numpy as np
from PIL import Image, ImageDraw

root=pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
for name in ['tadla','beni-mellal','gharb','souss','saiss']:
    collection=json.loads((root/f'samples/ftw-{name}.geojson').read_text())
    west,south,east,north=collection['bbox']
    with rasterio.open(root/f'samples/sentinel-{name}-rgb.tif') as src:
        base=Image.fromarray(np.moveaxis(src.read(),0,2)).resize((570,666),Image.Resampling.NEAREST)
    variants=['cleaned']
    if name in ['tadla','beni-mellal']:
        variants+=['deafrica-crop','esa_worldcereal_temporarycrops','esa_worldcover_2021','academic']
    panels=[]
    for source in ['Sentinel-2']+variants:
        im=base.copy();d=ImageDraw.Draw(im)
        title=source
        if source in ['cleaned','academic']:
            features=json.loads((root/f'samples/{source}-{name}.geojson').read_text())['features']
            title+=f' | {len(features)} polygons'
            for f in features:
                polygons=[f['geometry']['coordinates']] if f['geometry']['type']=='Polygon' else f['geometry']['coordinates']
                for poly in polygons:
                    for ring in poly:
                        d.line([((p[0]-west)/(east-west)*570,(north-p[1])/(north-south)*666) for p in ring],fill=(255,240,0) if source=='cleaned' else (255,60,255),width=2)
        elif source!='Sentinel-2':
            im=Image.open(root/f'samples/{source}-{name}.png').convert('RGB').resize((570,666),Image.Resampling.NEAREST)
        panel=Image.new('RGB',(570,726),'white');panel.paste(im,(0,60));pd=ImageDraw.Draw(panel)
        pd.text((10,8),f'{name} | {title}',fill='black')
        pd.text((10,27),'FTW / academic survey / DE Africa: CC BY 4.0 | ESA WorldCereal / WorldCover',fill='black')
        pd.text((10,43),'Contains modified Copernicus Sentinel data (2025) | accuracy unmeasured',fill='black')
        panels.append(panel)
    image=Image.new('RGB',(570*len(panels),726),'white')
    for i,panel in enumerate(panels):image.paste(panel,(570*i,0))
    image.save(root/f'overlays/{name}-comparisons.png')
