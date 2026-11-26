"""Verify bundled GLB binary layout, index bounds, triangle counts and embedded bytes."""
import pathlib,struct,json,base64,math
P=pathlib.Path(__file__).resolve().parent
embedded=json.loads((P/'hd-model-data.js').read_text().split('const ArenaHDData=',1)[1].rstrip().rstrip(';'))
report=json.loads((P/'model-budget.json').read_text())
for name,encoded in embedded.items():
 b=(P/(name+'.glb')).read_bytes();assert base64.b64decode(encoded)==b
 magic,version,size=struct.unpack_from('<III',b);assert (magic,version,size)==(0x46546c67,2,len(b));jl,typ=struct.unpack_from('<II',b,12);assert typ==0x4e4f534a
 d=json.loads(b[20:20+jl]);end=20+jl;bl,typ=struct.unpack_from('<II',b,end);assert typ==0x004e4942 and end+8+bl==len(b)
 def acc(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];k={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];fmt={5123:'H',5126:'f'}[a['componentType']];n=a['count']*k;offset=end+8+v.get('byteOffset',0)+a.get('byteOffset',0);assert offset+struct.calcsize('<'+fmt*n)<=end+8+bl;return a,struct.unpack_from('<'+fmt*n,b,offset)
 total=0
 for p in d['meshes'][0]['primitives']:
  assert p['mode']==4
  pos,coords=acc(p['attributes']['POSITION']);idx,inds=acc(p['indices']);assert max(inds)<pos['count'] and len(inds)%3==0 and all(math.isfinite(v) for v in coords)
  for attr in ['NORMAL','TEXCOORD_0','COLOR_0']:assert acc(p['attributes'][attr])[0]['count']==pos['count']
  total+=len(inds)//3
 assert total==report[name]['triangles'];print(name,total,'triangles, valid layout and identical embedded GLB: PASS')
