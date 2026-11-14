import json,math,pathlib,requests,gzip
from pmtiles.reader import Reader
from mapbox_vector_tile import decode
root=pathlib.Path('docs/evidence/field-boundaries/2026-11-10')
url='https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=MA/Morocco.pmtiles'
def get_bytes(offset,length):
 r=requests.get(url,headers={'Range':f'bytes={offset}-{offset+length-1}'},timeout=45);r.raise_for_status()
 if r.status_code!=206:raise ValueError('Expected range response')
 return r.content
reader=Reader(get_bytes)
summary={'url':url,'header':reader.header(),'metadata':reader.metadata(),'tiles':{}}
for name,lon,lat in [('tadla',-6.55,32.4),('beni-mellal',-6.34,32.37)]:
 z=14;x=int((lon+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
 z=min(14,summary['header']['max_zoom']);x=int((lon+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z);raw=reader.get(z,x,y)
 print(name,summary['header'],flush=True)
 if raw is None:
  summary['tiles'][name]={'z':z,'x':x,'y':y,'status':'missing'}
  continue
 (root/f'samples/ftw-{name}-z13.mvt.gz').write_bytes(raw)
 summary['tiles'][name]={'z':z,'x':x,'y':y,'bytes':len(raw),'layers':{k:len(v['features']) for k,v in decode(gzip.decompress(raw)).items()}}
(root/'samples/ftw-pmtiles.json').write_text(json.dumps(summary,indent=2,default=lambda x:x.name)+'\n')
print(json.dumps(summary,indent=2,default=lambda x:x.name)[:4000])
