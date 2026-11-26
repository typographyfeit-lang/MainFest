"""Original tower meshes: beveled masonry, custom radial wedges, layered trim, baked vertex AO.
Generates glTF 2.0 GLB and an embedded copy for the synchronous browser loader.
No external assets or dependencies. Run from any directory: python3 build-hd-models.py.
"""
import math, random, struct, json, base64, pathlib
from collections import defaultdict
P=pathlib.Path(__file__).resolve().parent
TAU=math.tau

def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def unit(a): return tuple(v/(math.sqrt(dot(a,a)) or 1) for v in a)
def lin(c): return ((c+.055)/1.055)**2.4 if c>.04045 else c/12.92
def rgb(h): return tuple(lin(int(h[i:i+2],16)/255) for i in [0,2,4])
class Model:
 def __init__(self,seed): self.parts=defaultdict(lambda:dict(p=[],n=[],uv=[],c=[],idx=[])); self.r=random.Random(seed)
 def face(self,mat,pts,base,out,ao=1):
  normal=unit(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])))
  if dot(normal,out)<0: pts=list(reversed(pts)); normal=tuple(-x for x in normal)
  o=self.parts[mat]; start=len(o['p'])//3
  # Continuous world-space stone UVs. Orientation is face-dependent.
  axis=max(range(3),key=lambda i:abs(normal[i])); axes=[i for i in range(3) if i!=axis]
  for v in pts:
   o['p']+=v;o['n']+=normal;o['uv'] += [v[axes[0]]/17,v[axes[1]]/17]
   shade=ao*(.86+.14*min(1,max(0,v[1]/55)))
   o['c'] += [min(1,max(0,x*shade)) for x in base]
  for i in range(1,len(pts)-1):o['idx'] += [start,start+i,start+i+1]
 def prism(self,poly,y,h,mat,hex,bevel=.65):
  # Convex polygon XZ; bevel top and bottom by inset toward centroid.
  cx=sum(x for x,z in poly)/len(poly);cz=sum(z for x,z in poly)/len(poly);col=rgb(hex)
  layers=[];k=min(bevel,h*.24)
  for yy,ins in [(y,k),(y+k,0),(y+h-k,0),(y+h,k)]:
   layer=[]
   for x,z in poly:
    l=math.hypot(x-cx,z-cz) or 1; q=min(ins,l*.3)
    layer.append((x+(cx-x)*q/l,yy,z+(cz-z)*q/l))
   layers.append(layer)
  self.face(mat,layers[0],col,(0,-1,0),.62);self.face(mat,layers[-1],col,(0,1,0),1.06)
  for a,b in zip(layers,layers[1:]):
   for i in range(len(poly)):
    j=(i+1)%len(poly);out=((poly[i][0]+poly[j][0])/2-cx,0,(poly[i][1]+poly[j][1])/2-cz)
    self.face(mat,[a[i],a[j],b[j],b[i]],col,out,.82 if a is layers[0] else .95 if a is layers[2] else 1)
 def box(self,x,z,y,w,d,h,hex,mat='stone',angle=0,bevel=.65,chamfer=True):
  a=w/2;b=d/2;c=min(.85,a*.23,b*.23);p=[(-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),(a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c)];p=p if chamfer else [(-a,-b),(a,-b),(a,b),(-a,b)];s=math.sin(angle);q=math.cos(angle);self.prism([(x+u*q+v*s,z-u*s+v*q) for u,v in p],y,h,mat,hex,bevel)
 def wedge(self,angle,span,inner,outer,y,h,hex,mat='stone',bevel=.65):
  # curved polygon wedge; subdivide outer arc, inner arc in reverse.
  a=angle-span/2;b=angle+span/2
  # trapezoid with clipped edges; convex, no concave triangulation
  p=[(math.sin(a)*inner,math.cos(a)*inner),(math.sin(a)*outer,math.cos(a)*outer),(math.sin(b)*outer,math.cos(b)*outer),(math.sin(b)*inner,math.cos(b)*inner)]
  self.prism(p,y,h,mat,hex,bevel)
 def disc(self,r,y,h,hex,mat='stone',n=16,bevel=.65): self.prism([(math.sin(i*TAU/n)*r,math.cos(i*TAU/n)*r) for i in range(n)],y,h,mat,hex,bevel)
 def ring(self,n,inner,outer,y,h,offset=0,mat='stone',colors=None,gap=.025,bevel=.65):
  colors=colors or ['927984','aa8f90','9a8089','b29a94','816e80']
  for i in range(n): self.wedge((i+offset)*TAU/n,TAU/n-gap,inner,outer+self.r.uniform(-.30,.30),y+self.r.uniform(-.12,.12),h,self.r.choice(colors),mat,bevel)
 def export(self,name):
  buf=bytearray();views=[];acc=[];prims=[];mats=[];counts={}
  def add(a,typ,comp,fmt,target):
   while len(buf)%4:buf.append(0)
   off=len(buf);buf.extend(struct.pack('<'+fmt*len(a),*a));vi=len(views);views.append(dict(buffer=0,byteOffset=off,byteLength=len(buf)-off,target=target));n={'SCALAR':1,'VEC2':2,'VEC3':3}[typ];d=dict(bufferView=vi,componentType=comp,count=len(a)//n,type=typ)
   if target==34962 and len(a) and typ=='VEC3':d.update(min=[min(a[i::n]) for i in range(n)],max=[max(a[i::n]) for i in range(n)])
   acc.append(d);return len(acc)-1
  for mat,o in self.parts.items():
   m=len(mats);mats.append({'name':mat,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':.35 if mat=='gold' else 0,'roughnessFactor':.42 if mat=='gold' else .85}})
   attrs={k:add(o[v],typ,5126,'f',34962) for k,v,typ in [('POSITION','p','VEC3'),('NORMAL','n','VEC3'),('TEXCOORD_0','uv','VEC2'),('COLOR_0','c','VEC3')]}
   idx=add(o['idx'],'SCALAR',5123,'H',34963);prims.append({'attributes':attrs,'indices':idx,'material':m,'mode':4});counts[mat]=len(o['idx'])//3
  data={'asset':{'version':'2.0','generator':'Block Arena original mesh workshop 2.8'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':name}],'meshes':[{'name':name,'primitives':prims}],'materials':mats,'accessors':acc,'bufferViews':views,'buffers':[{'byteLength':len(buf)}]}
  j=json.dumps(data,separators=(',',':')).encode();j+=b' '*((-len(j))%4);buf+=b'\0'*((-len(buf))%4)
  raw=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(buf))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buf),0x004e4942)+buf
  (P/(name+'.glb')).write_bytes(raw);return raw,counts

def citadel():
 m=Model(803)
 m.disc(34.8,0,4.7,'605061',bevel=.8);m.ring(14,27,35,4.8,5.5,colors=['937b85','796476','a78c8b']);m.disc(28.7,9.5,34,'685264',bevel=.5)
 for j in range(4):m.ring(14,25.8,30.4,10.5+j*8,7.65,offset=(j%2)*.5,gap=.025,bevel=.6)
 # crown cornice and separate capstones, deep mortar and gold inlays
 m.ring(14,25.5,33.6,42.2,4.3,colors=['ad9694','b79e99','947b86'],bevel=.75)
 m.ring(14,22.8,34,46.8,6.8,colors=['b9a19b','a58a8e','c3aaa0'],bevel=.85)
 m.disc(22,50,3.1,'66536d',n=20);m.ring(12,15.5,20.5,53.0,2.1,mat='gold',colors=['c58c45','e0aa57','edbb72'],gap=.018,bevel=.25)
 # Stone pilasters offset to front/side, decorative capital and metal fastener.
 for a in [-2.5,-.68,.68,2.5]:
  x,z=math.sin(a)*30.5,math.cos(a)*30.5
  m.box(x,z,11,5.8,4.8,28,'927886',angle=a,bevel=.6)
  for y in [10.5,39]:m.box(x*1.025,z*1.025,y,7.3,5.7,3.3,'b99b91',angle=a,bevel=.4)
  m.box(x*1.08,z*1.08,23,3.1,1.3,3.6,'c48b46','gold',angle=a,bevel=.3)
 # Sculpted rising horn segments: crown in two open arcs with angular upswept tips.
 for sign in [-1,1]:
  for i in range(7):
   a=sign*(.50+i*.28);y=57+max(0,i-2)*1.32;x,z=math.sin(a)*23.5,math.cos(a)*23.5
   m.box(x,z,y,7.5,5.9,4.3+i*.17,['bd853d','e2ad5c','f0bd6f'][i%3],'gold',angle=a,bevel=.72)
  a=sign*2.18;x,z=math.sin(a)*23.5,math.cos(a)*23.5;m.box(x,z,65,6.5,5.8,7.0,'ecc27c','gold',angle=a,bevel=.8)
 return m

def guardian():
 m=Model(719);m.box(0,0,0,53.4,53.4,4.2,'69566c');m.box(0,0,4.4,50.8,50.8,3.4,'ad9698');m.box(0,0,7.8,40.5,40.5,27.5,'5f4c62',bevel=.8)
 colors=['957c87','ad9193','b79c97','857083','a18a91']
 for j in range(3):
  for s in [-1,1]:
   for i in range(3):
    q=(i-1)*13; y=8.4+j*8.9;m.box(q,s*21.1,y,12.55,6.1,8.5,m.r.choice(colors),chamfer=False);m.box(s*21.1,q,y,6.1,12.55,8.5,m.r.choice(colors),chamfer=False)
 m.box(0,0,35.4,50,50,4.5,'b49a98');m.box(0,0,39.9,32,32,1.8,'62536c',bevel=.25)
 for x in [-21,21]:
  for z in [-21,21]:
   m.box(x,z,39.4,13.3,13.3,8.5,'ad9295');m.box(x,z,48,14.2,14.2,4.0,'c2aaa1',bevel=.9)
   if z>0:m.box(x,z+7,43.1,5.6,1.15,3.3,'c69a59','gold',bevel=.3)
 # front pilasters and gold banner hooks, leaving room for emissive windows
 for x in [-12.3,12.3]:
  m.box(x,23.9,8,3.8,3.5,23,'8c7483');m.box(x,25.4,9,4.4,1.9,3.5,'bca096');m.box(x,25.4,28,4.4,1.9,3.5,'bca096')
  m.box(x,26.3,34,2.3,2.3,3.1,'d9a75e','gold',bevel=.3)
 return m
if __name__=='__main__':
 assets={};report={}
 for name,model in [('citadel-hd',citadel()),('guardian-hd',guardian())]:
  data,counts=model.export(name);assets[name]=base64.b64encode(data).decode();report[name]={'triangles':sum(counts.values()),'by_material':counts,'bytes':len(data)}
 (P/'hd-model-data.js').write_text('// Generated from the original GLB files by build-hd-models.py.\nconst ArenaHDData='+json.dumps(assets,separators=(',',':'))+';\n')
 (P/'model-budget.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
