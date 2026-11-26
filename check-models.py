"""Validate GLB buffers, index bounds, joint/weight consistency, inverse bind, animation tracks."""
import pathlib,struct,json,math
P=pathlib.Path(__file__).resolve().parent
reports={**json.loads((P/'model-budget.json').read_text()),**{k+'-unit':v for k,v in json.loads((P/'character-budget.json').read_text()).items()}}
for name,report in reports.items():
 b=(P/(name+'.glb')).read_bytes();magic,version,size=struct.unpack_from('<III',b);assert (magic,version,size)==(0x46546c67,2,len(b));jl,typ=struct.unpack_from('<II',b,12);assert typ==0x4e4f534a
 d=json.loads(b[20:20+jl]);end=20+jl;bl,typ=struct.unpack_from('<II',b,end);assert typ==0x004e4942 and end+8+bl==len(b)
 def acc(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];fmt={5123:'H',5126:'f'}[a['componentType']];n=a['count']*k;off=a.get('byteOffset',0);offset=end+8+v.get('byteOffset',0)+off;assert off+struct.calcsize('<'+fmt*n)<=v['byteLength'] and offset+struct.calcsize('<'+fmt*n)<=len(b);vals=struct.unpack_from('<'+fmt*n,b,offset);assert all(math.isfinite(x) for x in vals);return a,vals
 total=0
 for p in d['meshes'][0]['primitives']:
  assert p['mode']==4
  pos,coords=acc(p['attributes']['POSITION']);idx,inds=acc(p['indices']);assert max(inds)<pos['count'] and len(inds)%3==0
  for attr in ['NORMAL','TEXCOORD_0','COLOR_0']:assert acc(p['attributes'][attr])[0]['count']==pos['count']
  if 'skins' in d:
   jt,j=acc(p['attributes']['JOINTS_0']);wt,w=acc(p['attributes']['WEIGHTS_0']);assert jt['count']==wt['count']==pos['count'];assert min(j)>=0 and max(j)<report['bones'];assert all(abs(sum(w[i:i+4])-1)<1e-6 for i in range(0,len(w),4))
  total+=len(inds)//3
 assert total==report['triangles']
 if 'skins' in d:
  sk=d['skins'][0];n=len(sk['joints']);assert n==report['bones'];a,inv=acc(sk['inverseBindMatrices']);assert a['count']==n
  # Validate each joint rest transform against its inverse translation, bone hierarchy is a tree.
  world={}
  def visit(i,p):
   v=[x+y for x,y in zip(p,d['nodes'][i]['translation'])];assert i not in world;world[i]=v
   for j in d['nodes'][i].get('children',[]):visit(j,v)
  visit(sk['skeleton'],[0,0,0]);assert len(world)==n
  for i,j in enumerate(sk['joints']):assert all(abs(world[j][k]+inv[16*i+12+k])<1e-5 for k in range(3))
  assert [a['name'] for a in d['animations']]==report['clips']
  for a in d['animations']:
   assert len(a['channels'])>=n
   for ch in a['channels']:
    s=a['samplers'][ch['sampler']];_,t=acc(s['input']);v,vs=acc(s['output']);assert all(t[i]<t[i+1] for i in range(len(t)-1));assert v['count']==len(t);assert ch['target']['node'] in world
    if ch['target']['path']=='rotation':assert all(abs(sum(x*x for x in vs[i:i+4])-1)<1e-5 for i in range(0,len(vs),4))
 print(name,total,'triangles; validated'+(' skin and 6 clips' if 'skins' in d else ' static GLB'))
