"""Original low-poly skeletal character assets for Block Arena. Standard GLB 2.0 skin and six animation clips.
No dependencies. Each armor/body piece is weighted to its own articulated bone; smooth surfaces use indexed normals.
"""
import math, json, struct, pathlib, importlib.util
from collections import defaultdict
P=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('tower_builder',P/'build-hd-models.py'); mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
TAU=math.tau

def rgb(h):return mod.rgb(h.lstrip('#'))
def quat(x=0,y=0,z=0):
 a,b,c=map(lambda t:t/2,(x,y,z));sx,cx=math.sin(a),math.cos(a);sy,cy=math.sin(b),math.cos(b);sz,cz=math.sin(c),math.cos(c)
 return [sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz]
class Rig:
 def __init__(self,name):self.name=name;self.bones=[];self.parts=defaultdict(lambda:{'p':[],'n':[],'uv':[],'c':[],'idx':[],'joint':[],'weight':[]});self.bone('root',None,(0,0,0))
 def bone(self,name,parent,pos):
  if parent is not None:parent=self.index(parent)
  self.bones.append((name,parent,pos));return name
 def index(self,name):return next(i for i,b in enumerate(self.bones) if b[0]==name)
 def append(self,bone,material,pos,norm,uv,indices,color):
  d=self.parts[material];base=len(d['p'])//3;d['p']+=pos;d['n']+=norm;d['uv']+=uv;d['idx'] += [i+base for i in indices];j=self.index(bone);col=rgb(color)
  for i in range(len(pos)//3):
   # Mild vertex shading, highlights above, dark crevices below.
   a=.82+.18*max(0,norm[3*i+1]);d['c'] += [min(1,x*a) for x in col];d['joint'] += [j,0,0,0];d['weight'] += [1,0,0,0]
 def ell(self,bone,p,r,color,material='body',segments=10,rings=6,tilt=0):
  # Indexed sphere with smooth normals, unique poles per seam.
  x,y,z=p;rx,ry,rz=r;co,si=math.cos(tilt),math.sin(tilt);pos=[];norm=[];uv=[];ind=[]
  for j in range(rings+1):
   a=math.pi*j/rings
   for i in range(segments+1):
    b=TAU*i/segments;u,v,w=math.sin(a)*math.cos(b),math.cos(a),math.sin(a)*math.sin(b);px,py,pz=u*rx,v*ry,w*rz;nx,ny,nz=mod.unit((u/rx,v/ry,w/rz));pos.extend((x+px*co-py*si,y+px*si+py*co,z+pz));norm.extend((nx*co-ny*si,nx*si+ny*co,nz));uv.extend((i/segments,1-j/rings))
  for j in range(rings):
   for i in range(segments):
    a=j*(segments+1)+i;b=a+segments+1
    if j:ind.extend([a,a+1,b])
    if j<rings-1:ind.extend([a+1,b+1,b])
  self.append(bone,material,pos,norm,uv,ind,color)
 def prism(self,bone,p,sz,color,mat='body',angle=0,bevel=.4,poly=None):
  x,y,z=p;w,h,d=sz;m=mod.Model(12)
  if poly is None:m.box(x,z,y-h/2,w,d,h,color,mat,angle,bevel,chamfer=False)
  else:m.prism([(x+px*w,z+pz*d) for px,pz in poly],y-h/2,h,mat,color,bevel)
  a=m.parts[mat];self.append(bone,mat,a['p'],a['n'],a['uv'],a['idx'],color)
 def rod(self,bone,a,b,r1,r2,color,mat='body',n=8):
  d=mod.unit(mod.sub(b,a));ref=(0,1,0) if abs(d[1])<.9 else (1,0,0);u=mod.unit(mod.cross(d,ref));v=mod.cross(d,u);pos=[];norm=[];uv=[];idx=[]
  for p,r in [(a,r1),(b,r2)]:
   for i in range(n):
    t=TAU*i/n;nr=tuple(u[k]*math.cos(t)+v[k]*math.sin(t) for k in range(3));pos += [p[k]+r*nr[k] for k in range(3)];norm+=list(nr);uv += [i/n,0 if p==a else 1]
  for i in range(n):j=(i+1)%n;idx += [i,j,n+j,i,n+j,n+i]
  self.append(bone,mat,pos,norm,uv,idx,color)
 def gem(self,bone,p,r,color,mat='magic'):
  x,y,z=p;rx,ry,rz=r;pts=[(x,y+ry,z),(x,y-ry,z),(x+rx,y,z),(x,y,z+rz),(x-rx,y,z),(x,y,z-rz)];pos=[];normal=[];uv=[];idx=[]
  for i in range(4):
   for t in [(0,2+i,2+(i+1)%4),(1,2+(i+1)%4,2+i)]:
    pp=[pts[k] for k in t];n=mod.unit(mod.cross(mod.sub(pp[1],pp[0]),mod.sub(pp[2],pp[0])));out=tuple(sum(q[k] for q in pp)/3-p[k] for k in range(3))
    if mod.dot(n,out)<0:pp.reverse();n=tuple(-k for k in n)
    a=len(pos)//3;idx += [a,a+1,a+2];pos+=sum((list(q) for q in pp),[]);normal+=list(n)*3;uv += [0,0,1,0,.5,1]
  self.append(bone,mat,pos,normal,uv,idx,color)
 def export(self):
  buf=bytearray();views=[];acc=[];prims=[];mats=[]
  def add(vals,typ,comp=5126,target=None,bounds=False):
   while len(buf)%4:buf.append(0)
   off=len(buf);fmt={5126:'f',5123:'H'}[comp];buf.extend(struct.pack('<'+fmt*len(vals),*vals));n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[typ];view={'buffer':0,'byteOffset':off,'byteLength':len(buf)-off}
   if target:view['target']=target
   views.append(view);a={'bufferView':len(views)-1,'componentType':comp,'count':len(vals)//n,'type':typ}
   if bounds:a.update(min=[min(vals[i::n]) for i in range(n)],max=[max(vals[i::n]) for i in range(n)])
   acc.append(a);return len(acc)-1
  count=0
  for k,d in self.parts.items():
   attrs={name:add(d[src],typ,comp,34962,name=='POSITION') for name,src,typ,comp in [('POSITION','p','VEC3',5126),('NORMAL','n','VEC3',5126),('TEXCOORD_0','uv','VEC2',5126),('COLOR_0','c','VEC3',5126),('JOINTS_0','joint','VEC4',5123),('WEIGHTS_0','weight','VEC4',5126)]};ix=add(d['idx'],'SCALAR',5123,34963);count+=len(d['idx'])//3
   m={'name':k,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':.08,'roughnessFactor':.72}}
   if k=='magic':m['emissiveFactor']=[.3,.7,.9]
   mats.append(m);prims.append({'attributes':attrs,'indices':ix,'material':len(mats)-1,'mode':4})
  nodes=[];inverse=[]
  for name,pa,p in self.bones:
   parent=self.bones[pa][2] if pa is not None else (0,0,0);nodes.append({'name':name,'translation':[p[i]-parent[i] for i in range(3)]});inverse.extend([1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1])
  for i,(_,pa,p) in enumerate(self.bones):
   if pa is not None:nodes[pa].setdefault('children',[]).append(i)
  meshnode=len(nodes);nodes.append({'name':self.name+'-skin','mesh':0,'skin':0})
  ib=add(inverse,'MAT4');animations=[]
  for clip,duration in [('Idle',1.6),('Walk',.68),('Attack',.55),('Hit',.26),('Death',.62),('Spawn',.36)]:
   times=[0,duration*.25,duration*.5,duration*.75,duration];ti=add(times,'SCALAR',bounds=True);samplers=[];channels=[]
   for i,(name,pa,p) in enumerate(self.bones):
    rotations=[]
    for k in range(5):rotations+=quat(*self.pose(clip,name,k/4))
    ai=add(rotations,'VEC4');samplers.append({'input':ti,'output':ai,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':i,'path':'rotation'}})
   if clip in ('Spawn','Death'):
    scales=([.16,.72,1.12,1.04,1] if clip=='Spawn' else [1,.99,.85,.48,.04]);ai=add([x for s in scales for x in [s,s,s]],'VEC3');samplers.append({'input':ti,'output':ai,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':0,'path':'scale'}})
   animations.append({'name':clip,'samplers':samplers,'channels':channels})
  j={'asset':{'version':'2.0','generator':'Block Arena character workshop 2.9'},'scene':0,'scenes':[{'nodes':[0,meshnode]}],'nodes':nodes,'meshes':[{'primitives':prims}],'skins':[{'joints':list(range(len(self.bones))),'skeleton':0,'inverseBindMatrices':ib}],'animations':animations,'materials':mats,'accessors':acc,'bufferViews':views,'buffers':[{'byteLength':len(buf)}]}
  js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);buf+=b'\0'*((-len(buf))%4);raw=struct.pack('<III',0x46546c67,2,28+len(js)+len(buf))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(buf),0x004e4942)+buf
  (P/(self.name+'-unit.glb')).write_bytes(raw);return {'triangles':count,'bones':len(self.bones),'clips':list(a['name'] for a in animations),'bytes':len(raw)}
 def pose(self,clip,n,t):
  phase=math.sin(TAU*t);pulse=math.sin(math.pi*t);side=-1 if n.endswith('L') else 1;animal=self.name=='hounds';rock=self.name=='swarm';heavy=self.name in ('colossus','brute')
  if clip=='Idle':return (phase*.035 if n in ('torso','head') else 0,0,phase*.035 if n=='head' else 0)
  if clip=='Walk':
   if n.startswith('leg'):return (phase*.63*side*(-1 if 'back' in n else 1),0,0)
   if n.startswith('arm'):return (-phase*.49*side,0,side*.055)
   if n=='tail':return (0,phase*.5,0)
   if n=='torso':return (.05,0,phase*.035)
  if clip=='Attack':
   if n=='torso':return ((-.18 if animal else -.09)*pulse,(-.34 if self.name in ('guard','brute') else .12)*pulse,0)
   if n=='head':return ((.45 if animal else -.08)*pulse,0,0)
   if n.startswith('arm'):
    if self.name=='archer':return (-1.1*pulse,side*.68*pulse,side*.38*pulse)
    if self.name=='mage':return (-1.35*pulse,side*.22*pulse,side*.25*pulse)
    if self.name=='colossus':return (-1.85*pulse,0,side*.14*pulse)
    return (-1.7*pulse if n.endswith('R') else -.55*pulse,0,side*.14*pulse)
  if clip=='Hit' and n in ('torso','head','root'):return ((-.24 if n!='root' else -.12)*pulse,0,.13*pulse)
  if clip=='Death' and n=='root':return (0,0,t*1.45)
  if clip=='Spawn' and n=='root':return (-.18*(1-t),0,0)
  return (0,0,0)

TEAM='dedede'; GOLD='c99b50'; DARK='394155'; STEEL='aab9ca'; LEATHER='754e37'; SKIN='d7a77a'; EYE='f9eeca'
def humanoid(name):
 r=Rig(name);r.bone('torso','root',(0,11,0));r.bone('head','torso',(0,26,0));
 for side,s in [('L',-1),('R',1)]:r.bone('leg'+side,'root',(s*4.3,9,0));r.bone('arm'+side,'torso',(s*8,20,0))
 e=r.ell;b=r.prism;g=r.gem;rod=r.rod
 base={'guard':'7c91ae','archer':'5c7947','mage':'7754a0','imp':'bc663b','colossus':'776e83','brute':'99654e'}[name]
 heavy=name in ('colossus','brute');mage=name=='mage';imp=name=='imp';archer=name=='archer';guard=name=='guard'
 # Broad chest plates and shaped tabard, belt, gem clasp and layered tunic.
 e('torso',(0,15,0),(8.1,9,5.6),base,segments=12,rings=6)
 if heavy or guard:
  b('torso',(0,16,4.2),(13.2,9.5,3.2),STEEL if guard else base,bevel=.65);b('torso',(0,12,5.8),(8.8,3.5,1.2),DARK,bevel=.3)
 else:e('torso',(0,15,2.4),(7.8,8.6,4.2),TEAM,'team',10,5)
 b('torso',(0,9.5,0),(14.6,3.4,10.8),LEATHER,bevel=.5);b('torso',(0,9.5,5.9),(4.4,3.6,1.6),GOLD,bevel=.35);g('torso',(0,17.5,6.1),(2.0,2.5,1.0),'e2e2e2','magic')
 if mage or archer:e('torso',(0,15,-4.4),(7.9,10.7,2.1),TEAM,'team',10,5)
 for side,s in [('L',-1),('R',1)]:
  leg='leg'+side;arm='arm'+side
  e(leg,(s*4.3,5.2,0),(3.3,4.7,3.3),base,segments=8,rings=4);e(leg,(s*4.3,2,1.7),(3.6,2,4.6),LEATHER,segments=8,rings=4);b(leg,(s*4.3,5.0,2.4),(4.2,4.2,1.7),DARK,bevel=.4)
  e(arm,(s*8,18.1,0),(3.6,4.9,3.5),TEAM,'team',8,4);e(arm,(s*8,13.4,0),(2.7,4.4,2.8),base,segments=8,rings=4);e(arm,(s*8,9.8,1),(2.9,3.1,3.0),SKIN if not heavy else base,segments=8,rings=4)
  if guard or heavy:
   b(arm,(s*8.3,20,0),(7.8,4.7,7.4),STEEL if guard else base,bevel=.65);b(arm,(s*8.3,20.8,3.7),(6.4,1.7,1.15),GOLD,bevel=.25)
 # Face and distinct head silhouettes.
 if mage or archer:
  e('head',(0,27,-.8),(10,10.8,8.2),TEAM if mage else base,'team' if mage else 'body',12,7);rod('head',(0,31,-1),(0,40,-2),7.8,0.2,TEAM if mage else base,'team' if mage else 'body',10);e('head',(0,25.5,6),(6.4,6.8,3),DARK if mage else SKIN,segments=10,rings=5)
 elif guard or heavy:
  e('head',(0,26,0),(9.4,9.3,8),STEEL if guard else base,segments=12,rings=6);b('head',(0,26,7),(13.3,5.8,2.1),DARK,bevel=.6);b('head',(0,32,6.2),(4.3,8.1,2.0),GOLD if guard else STEEL,bevel=.45)
 else:e('head',(0,26,0),(8.9,8.8,7.8),SKIN,segments=10,rings=6)
 for s in [-1,1]:
  e('head',(s*3.0,26.2,8.0),(1.9,1.55,.85),'ededed','magic' if mage or heavy else 'body',8,4)
  if not (mage or heavy):e('head',(s*3.0,26.1,8.73),(.72,.88,.35),'262235',segments=6,rings=3)
 if guard:b('head',(0,34,-.6),(6,4.2,8.4),TEAM,'team',bevel=.5)
 if heavy or imp:
  for s in [-1,1]:rod('head',(s*6,31,-.8),(s*9,38,-2),2.8,.18,GOLD if heavy else 'e1c49a',n=7)
 if name=='colossus':g('head',(0,31,8.1),(2.4,2.7,1.2),'eeeeee','magic')
 if guard:
  # Shield made from layered faceted plates, not a flat card.
  e('armL',(-11.5,13,4.5),(6.9,9,2.0),GOLD,segments=10,rings=5);e('armL',(-11.5,13,6),(5.8,7.7,1.3),TEAM,'team',10,5);g('armL',(-11.5,13,7.1),(2.8,3.6,1.3),GOLD,'body');rod('armR',(8,7,3.8),(8,16,3.8),1.35,1.35,LEATHER);b('armR',(8,17,3.8),(7.8,1.5,2.2),GOLD,bevel=.28);b('armR',(8,23.7,3.8),(3.2,12,1.8),STEEL,bevel=.5);rod('armR',(8,29.7,3.8),(8,33,3.8),1.4,0.02,STEEL,n=4)
 elif mage:
  rod('armR',(8,5,4),(8,31,4),1.1,1.25,LEATHER);b('armR',(8,29,4),(3.4,2.6,3.4),GOLD);g('armR',(8,35,4),(3.7,5.5,3.7),'e4e4e4','magic')
 elif archer:
  for i in range(6):
   a=(8,10+i*3.2,3+math.sin(math.pi*i/6)*5);j=i+1;bb=(8,10+j*3.2,3+math.sin(math.pi*j/6)*5);rod('armR',a,bb,.8,.8,LEATHER,n=6)
  rod('armR',(8,10,3),(8,29.2,3),.19,.19,'eee3c7',n=4);rod('armL',(-8,13,2),(-8,13,19),.34,.34,LEATHER,n=5)
 elif imp:e('armR',(8,11,4),(5.3,5.3,5.3),'43334b',segments=10,rings=5);rod('armR',(8,15,4),(9,20,4),.7,.35,GOLD,n=6);g('armR',(9,20,4),(1.3,1.7,1.3),'ffaf5a','magic')
 elif name=='brute':rod('armR',(8,5,3),(8,24,3),1.7,1.7,LEATHER);b('armR',(8,24,3),(8.9,8.4,7.6),DARK,bevel=.8);b('armR',(8,24,3),(9.5,2.5,8.2),GOLD,bevel=.4)
 else:
  for s,side in [(-1,'L'),(1,'R')]:b('arm'+side,(s*8,10,1),(7.8,7.8,7.5),base,bevel=.9);g('arm'+side,(s*8,10,5.4),(1.9,2.4,.8),'dedede','magic')
 return r

def hound():
 r=Rig('hounds');r.bone('torso','root',(0,10,0));r.bone('head','torso',(0,15,9));r.bone('tail','torso',(0,13,-12));e=r.ell;rod=r.rod;g=r.gem;b=r.prism
 e('torso',(0,10,-2),(7.5,6.3,12),'817a91',segments=12,rings=6);e('torso',(0,12,4),(7.7,5.1,4.8),TEAM,'team',10,5);g('torso',(0,15,6),(2.5,2.6,2.5),GOLD,'body')
 e('head',(0,15,8.5),(7,6.4,6),'9890a5',segments=10,rings=5);e('head',(0,13.2,14),(4.6,3.3,5.1),'baaaae',segments=10,rings=5);e('head',(0,14.5,18),(2.5,1.7,1.6),DARK,segments=8,rings=4)
 for s in [-1,1]:rod('head',(s*4.2,19,7),(s*6,26,5),2.8,.1,'827a93',n=7);e('head',(s*3.2,17,13.6),(1.4,1.25,.85),'ededed','magic',8,4)
 rod('tail',(0,13,-12),(0,19,-22),2.6,.22,'817a91',n=8)
 for label,z in [('front',7),('back',-9)]:
  for side,s in [('L',-1),('R',1)]:
   n='leg'+label+side;r.bone(n,'root',(s*4.8,8,z));e(n,(s*4.8,4.6,z),(2.6,4.6,2.7),'817a91',segments=8,rings=4);e(n,(s*4.8,1.6,z+1.3),(2.8,1.6,3.3),DARK,segments=8,rings=4)
 return r

def swarm():
 r=Rig('swarm');r.bone('torso','root',(0,6,0));r.bone('head','torso',(0,13,0));b=r.prism;g=r.gem;e=r.ell
 g('torso',(0,8,0),(8.4,8.9,7.7),'9b857d','body');b('torso',(0,6,0),(12,5,10),'786977',bevel=.8);g('head',(0,15,0),(6.1,5.5,5.8),TEAM,'team')
 for side,s in [('L',-1),('R',1)]:
  r.bone('leg'+side,'root',(s*4.8,4,0));b('leg'+side,(s*4.8,2.2,0),(5.9,4.4,6),'8c7b7f',bevel=.6);e('head',(s*3.2,13,5),(1.4,1.5,1.1),'e8e8e8','magic',8,4)
 return r
if __name__=='__main__':
 report={}
 for name in ['guard','archer','colossus','imp','mage','hounds','swarm','brute']:
  r=hound() if name=='hounds' else swarm() if name=='swarm' else humanoid(name);report[name]=r.export()
 (P/'character-budget.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
