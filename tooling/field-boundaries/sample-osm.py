"""Extract real requested OSM landuse areas from the Geofabrik Morocco PBF."""
import hashlib
import json
import pathlib
from datetime import datetime, timezone
import osmium
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union
from pyproj import Geod

ROOT=pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
PBF=pathlib.Path('/tmp/b2r-morocco.osm.pbf')
SITES={'tadla':(-6.55,32.4),'beni-mellal':(-6.34,32.37),'gharb':(-5.95,34.5),'souss':(-9.15,30.4),'saiss':(-5.1,33.9)}
bounds={k:box(x-.01,y-.01,x+.01,y+.01) for k,(x,y) in SITES.items()}
tags=['farmland','farmyard','orchard','vineyard','meadow']
counts=dict.fromkeys(tags,0)
sites={k:[] for k in SITES}
fact=osmium.geom.GeoJSONFactory()
failed=0
for area in osmium.FileProcessor(str(PBF)).with_areas():
    if not isinstance(area,osmium.osm.Area):continue
    landuse=area.tags.get('landuse')
    if landuse not in counts:continue
    counts[landuse]+=1
    try:geom=json.loads(fact.create_multipolygon(area));p=shape(geom)
    except Exception:failed+=1;continue
    for name,b in bounds.items():
        if p.intersects(b):sites[name].append({'type':'Feature','properties':{'id':('way/' if area.from_way() else 'relation/')+str(area.orig_id()),'landuse':landuse},'geometry':geom})
g=Geod(ellps='WGS84')
summary={'source':'https://download.geofabrik.de/africa/morocco-latest.osm.pbf','retrievedAt':datetime.now(timezone.utc).isoformat(),'pbfBytes':PBF.stat().st_size,'pbfSha256':hashlib.sha256(PBF.read_bytes()).hexdigest(),'pbfMd5':hashlib.md5(PBF.read_bytes()).hexdigest(),'countryAreaCounts':counts,'geometryFailures':failed,'sites':{}}
for name,features in sites.items():
    bbox=list(bounds[name].bounds)
    path=ROOT/f'samples/osm-{name}.geojson'
    path.write_text(json.dumps({'type':'FeatureCollection','bbox':bbox,'features':features},separators=(',',':')))
    union=unary_union([shape(f['geometry']).intersection(bounds[name]) for f in features])
    size=abs(g.geometry_area_perimeter(bounds[name])[0])
    coverage=abs(g.geometry_area_perimeter(union)[0]) if not union.is_empty else 0
    summary['sites'][name]={'bbox':bbox,'count':len(features),'counts':{t:sum(f['properties']['landuse']==t for f in features) for t in tags},'coveredHectares':coverage/10000,'boxHectares':size/10000,'mappedAreaPercentOfBox':coverage/size*100,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    print(name,summary['sites'][name],flush=True)
(ROOT/'samples/osm-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
