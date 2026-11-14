"""Extract geometry-only samples from the published Moroccan survey shapefile.

Extract saved RAR using tar into /tmp/b2r-groundtruth before running.
"""
import json
import pathlib
import shapefile
from shapely.geometry import shape, mapping, box

root=pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
f=pathlib.Path('/tmp/b2r-groundtruth/Shapefile_Crop and irrigation dataset/lulc_fielddata.shp')
s=shapefile.Reader(str(f))
# The downloaded .prj explicitly declares GCS_WGS_1984, degrees.
crs=f.with_suffix('.prj').read_text()
if 'GCS_WGS_1984' not in crs:
    raise ValueError('Unexpected source CRS')
sites={'tadla':(-6.55,32.4),'beni-mellal':(-6.34,32.37),'gharb':(-5.95,34.5),'souss':(-9.15,30.4),'saiss':(-5.1,33.9)}
collections={n:[] for n in sites}
nulls=0
for feature in s.iterShapeRecords():
    if feature.shape.shapeType == 0:
        nulls+=1
        continue
    p=shape(feature.shape.__geo_interface__)
    for name,(lon,lat) in sites.items():
        if p.intersects(box(lon-.01,lat-.01,lon+.01,lat+.01)):
            collections[name].append({'type':'Feature','properties':{'recordIndex':feature.record.oid},'geometry':mapping(p)})
summary={'records':len(s),'nullGeometries':nulls,'crs':crs,'source':'https://doi.org/10.6084/m9.figshare.28486022.v2','sites':{n:len(fs) for n,fs in collections.items()}}
for name,features in collections.items():
    (root/f'samples/academic-{name}.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features}))
(root/'samples/academic-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
