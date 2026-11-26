'use strict';
// 3D-рендер боя: мультяшная стилизованная графика (Three.js), камера 2.5D под наклоном.
// Все «рисованные» пиксельные текстуры генерируются кодом — внешних картинок нет.
const V=(()=>{
if(!window.THREE)return{ok:false};
try{
const T=THREE,W=360,H=560,RY=280,RW=16,BR=[90,270],rn=(a,b)=>a+Math.random()*(b-a);
const cv=document.querySelector('#cv'),R=new T.WebGLRenderer({canvas:cv,antialias:true});
R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
const sc=new T.Scene(),cam=new T.PerspectiveCamera(34,.64,10,3000),ray=new T.Raycaster(),gp=new T.Plane(new T.Vector3(0,1,0),0);
sc.background=new T.Color('#9fd8f5');
let items=new Set(),fxs=new Set(),puffs=[],tws=[],zone,last=performance.now(),on=0;

// ---- «рисованные» пиксельные текстуры ----
const px=(w,h,f,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;if(rep)t.wrapS=t.wrapT=T.RepeatWrapping;return t};
const pal=(g,w,h,f)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){g.fillStyle=f(x,y,Math.random());g.fillRect(x,y,1,1)}};
const p3=(r,a,b,c)=>r<.6?a:r<.85?b:c;
const TX={
 sp:px(8,8,(g,w,h)=>pal(g,w,h,(x,y,r)=>`hsl(0,0%,${82+r*18}%)`)),
 st:px(32,32,(g,w,h)=>pal(g,w,h,(x,y,r)=>(y%8==0||(x+(y>>3)*5)%12==0)?'#6b7079':p3(r,'#a7adb5','#9aa1a9','#b8bec6'))),
 pl:px(16,16,(g,w,h)=>pal(g,w,h,(x,y,r)=>y%4==0?'#6a4423':p3(r,'#b07c42','#a5733b','#bc8750')),1),
 wt:px(32,8,(g,w,h)=>pal(g,w,h,(x,y,r)=>r>.9?'#bfe6ff':p3(r,'#3f86e0','#3a7dd6','#4a93ec')),1),
 gr:px(90,140,(g,w,h)=>pal(g,w,h,(x,y,r)=>{const l=Math.abs(x-22.5)<6||Math.abs(x-67.5)<6,t=((x/5|0)+(y/5|0))%2;
  if(l)return p3(r,'#cdb27a','#c2a56b','#d8c08a');if(r>.992)return['#fff3a0','#ff9bb8','#fff'][Math.random()*3|0];
  return t?p3(r,'#5fb446','#55a83e','#6cc04f'):p3(r,'#58ab40','#4e9f38','#63b84a')}))
};
TX.pl.repeat.set(4,3);TX.wt.repeat.set(12,1);

// ---- материалы (мультяшные ступенчатые тени) ----
const grad=new T.DataTexture(new Uint8Array([120,175,225,255]),4,1,T.LuminanceFormat);grad.minFilter=grad.magFilter=T.NearestFilter;grad.needsUpdate=true;
const mt={},bm={},M=(c,m)=>{m=m||TX.sp;const k=c+m.id;return mt[k]||(mt[k]=new T.MeshToonMaterial({color:c,map:m,gradientMap:grad}))};
const B=c=>bm[c]||(bm[c]=new T.MeshBasicMaterial({color:c}));
const BOX=new T.BoxGeometry(1,1,1),CYL=new T.CylinderGeometry(1,1,1,20),PL=new T.PlaneGeometry(1,1);
const bx=(p,w,h,d,x,y,z,m,sh)=>{const o=new T.Mesh(BOX,m);o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=sh!==0;p.add(o);return o};
const dk=c=>'#'+new T.Color(c).multiplyScalar(.65).getHexString();
const BM={k:new T.MeshBasicMaterial({color:'#000',depthTest:false}),0:new T.MeshBasicMaterial({color:'#4aa8ff',depthTest:false}),1:new T.MeshBasicMaterial({color:'#ff5a4a',depthTest:false})};
function bar(team,wd){const g=new T.Group(),a=new T.Mesh(PL,BM.k),f=new T.Mesh(PL,BM[team]);a.scale.set(wd+3,6,1);f.scale.set(wd,4,1);f.position.z=.1;a.renderOrder=9;f.renderOrder=10;g.add(a,f);g.f=f;g.wd=wd;return g}
const setBar=(b,p)=>{const w=Math.max(.5,b.wd*Math.min(1,Math.max(0,p)));b.f.scale.x=w;b.f.position.x=-(b.wd-w)/2};

// ---- бойцы: большие головы и глаза, блочные тела ----
// [родитель(g корень, h голова, b тело, l/r руки от плеча), w,h,d, x,y,z, цвет, свечение]
const ACC={
 guard:[['h',23,7,21,0,11,0,'#aab4c0'],['h',4,10,2,0,-1,10.5,'#aab4c0'],['l',3,14,12,-4,-6,3,'#8a5a2b'],['r',7,2,3,0,-10,3.5,'#8a5a2b'],['r',2.5,17,2.5,0,-2,3.5,'#e4e8ee']],
 archer:[['h',22,6,20,0,10,0,'#3f8a3f'],['h',3,9,3,6,13,-3,'#f4f4f4'],['l',2,26,2,0,-6,5,'#7b4b22'],['l',.8,24,.8,0,-6,6.6,'#f4f4f4']],
 colossus:[['h',23,5,20,0,10,0,'#5faa3d'],['b',9,9,2,0,1,4.6,'#ffb347',1],['r',7,5,7,2,1,0,'#7d8590'],['l',7,5,7,-2,1,0,'#7d8590']],
 imp:[['h',5,7,5,-7,13,0,'#8a1f12'],['h',5,7,5,7,13,0,'#8a1f12'],['h',2,5,2,0,11.5,0,'#ffd24a',1],['r',4,12,4,0,-8,4,'#d33'],['r',1,4,1,0,-1,4,'#222']],
 mage:[['h',24,3,24,0,10.5,0,'#6a3fb5'],['h',17,5,17,0,14,0,'#7b4bc9'],['h',11,5,11,0,19,0,'#7b4bc9'],['h',6,5,6,0,24,0,'#7b4bc9'],['r',2,30,2,0,-4,4,'#7b4b22'],['r',6,6,6,0,12,4,'#ff8a2b',1]],
 hounds:[['h',5,7,3,-6,11,0,'#8e8e98'],['h',5,7,3,6,11,0,'#8e8e98'],['h',9,7,6,0,-4,11,'#d8d8e0'],['h',3,3,1,0,-1.5,14.2,'#222'],['g',3,3,10,0,14,-9,'#8e8e98']],
 swarm:[['h',10,4,10,0,10,0,'#5faa3d'],['h',4,6,4,2,13,0,'#5faa3d']],
 brute:[['h',23,6,21,0,10,0,'#6b3a24'],['h',4,7,4,-7,15,0,'#e8e0c8'],['h',4,7,4,7,15,0,'#e8e0c8'],['r',5,5,5,0,-11,4,'#7b4b22'],['r',5,20,5,0,2,4,'#7b4b22'],['r',10,10,10,0,13,4,'#8d5a35']]
};
function model(u){
 const w=new T.Group(),g=new T.Group(),S=u.big?1.5:u.k>2?.8:1,tc=u.team?'#e0463c':'#3c7be0',sk=M(u.hd),bd=M(u.col),dd=M(dk(u.col)),W2=B('#fff'),K=B('#1b1b22'),PK=B('#ff9aa8');
 w.add(g);g.scale.setScalar(S);
 const legL=bx(g,5,8,5,-3.5,4,0,dd),legR=bx(g,5,8,5,3.5,4,0,dd);
 const b=new T.Group();b.position.y=14;g.add(b);bx(b,13,12,8,0,0,0,bd);bx(b,14,3,9,0,-4.5,0,M(tc));bx(b,12,13,1.5,0,1,-4.8,M(tc));
 const arm=s=>{const a=new T.Group();a.position.set(s*8.5,19,0);bx(a,4,11,4,0,-5.5,0,sk);g.add(a);return a},aL=arm(-1),aR=arm(1);
 const h=new T.Group();h.position.y=29;g.add(h);bx(h,20,18,18,0,0,0,sk);
 for(const s of[-1,1]){bx(h,5,5,1,s*5,1,9.2,W2,0);bx(h,2.5,3,1,s*5,.6,9.8,K,0);bx(h,3.5,2,1,s*8,-4,9.2,PK,0)}
 bx(h,6,1.5,1,0,-5,9.2,K,0);
 const P={g,h,b,l:aL,r:aR};
 for(const[p,x1,y1,z1,x,y,z,c,gl]of ACC[u.id]||[])bx(P[p],x1,y1,z1,x,y,z,gl?B(c):M(c));
 const ring=new T.Mesh(CYL,new T.MeshBasicMaterial({color:tc,transparent:true,opacity:.55}));ring.scale.set(13*S,.5,13*S);ring.position.y=.3;w.add(ring);
 const hb=bar(u.team,22);hb.position.y=44*S+8;w.add(hb);
 return{u,w,g,legL,legR,aL,aR,hb,S,t0:performance.now(),px:u.x,pz:u.y,ry:u.team?0:Math.PI}}

// ---- башни ----
function tower(t){
 const w=new T.Group(),g=new T.Group(),r=t.rad,k=t.king,hh=k?54:42,tc=t.team?'#d84a3a':'#3f7ee0',st=M('#fff',TX.st),sd=M('#9aa1a9',TX.st),tm=M(tc);
 w.position.set(t.x,0,t.y);w.add(g);
 bx(g,2*r+10,5,2*r+10,0,2.5,0,sd);bx(g,2*r,hh,2*r,0,5+hh/2,0,st);bx(g,2*r+10,5,2*r+10,0,5+hh+2.5,0,sd);
 const y=5+hh+5;
 for(const sx of[-1,1])for(const sz of[-1,1])bx(g,9,9,9,sx*(r+1),y+4.5,sz*(r+1),st);
 bx(g,r*1.3,7,r*1.3,0,y+3.5,0,tm);bx(g,r*.8,7,r*.8,0,y+10.5,0,tm);
 if(k){for(const x of[-9,0,9])bx(g,6,9,6,x,y+21,0,B('#ffd24a'));bx(g,24,5,8,0,y+16,0,B('#ffd24a'))}
 else{bx(g,2,16,2,0,y+18,0,sd);bx(g,12,7,1.5,6,y+22,0,tm)}
 for(const s of[-1,1])bx(g,7,11,2,0,hh*.6,s*(r+.6),M('#2a2f36'),0);
 const hb=bar(t.team,44);hb.position.y=y+(k?36:34);w.add(hb);
 return{t,w,g,hb,dead:0}}

// ---- арена: трава с тропинками, река, мосты, деревья ----
function arena(){
 const gm=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshLambertMaterial({map:TX.gr}));gm.rotation.x=-Math.PI/2;gm.position.set(W/2,0,H/2);gm.receiveShadow=true;sc.add(gm);
 const out=new T.Mesh(new T.PlaneGeometry(1000,1500),new T.MeshLambertMaterial({color:'#4a9a3a'}));out.rotation.x=-Math.PI/2;out.position.set(W/2,-.5,H/2);out.receiveShadow=true;sc.add(out);
 const wm=new T.Mesh(new T.PlaneGeometry(W+80,RW*2),new T.MeshBasicMaterial({map:TX.wt}));wm.rotation.x=-Math.PI/2;wm.position.set(W/2,.6,RY);sc.add(wm);
 for(const s of[-1,1])bx(sc,W+80,2,3,W/2,1.2,RY+s*(RW+1),B('#e8f6ff'),0);
 for(const x of BR){const br=new T.Group();br.position.set(x,0,RY);sc.add(br);
  bx(br,68,4,RW*2+10,0,2,0,M('#fff',TX.pl));
  for(const s of[-1,1]){bx(br,4,7,RW*2+10,s*32,7,0,M('#7a5230'));for(const z of[-1,1])bx(br,6,12,6,s*32,6,z*(RW+3),M('#5e3d20'))}}
 const tree=(x,z,s)=>{const t=new T.Group();t.position.set(x,0,z);sc.add(t);bx(t,6*s,14*s,6*s,0,7*s,0,M('#7a5230'));bx(t,24*s,16*s,24*s,0,22*s,0,M('#3f9a3a'));bx(t,15*s,12*s,15*s,0,36*s,0,M('#55b84a'))};
 for(let z=-30;z<=600;z+=52){tree(-24+rn(-8,6),z,rn(1,1.5));tree(384+rn(-6,8),z+22,rn(1,1.5))}
 for(const[x,z]of[[34,200],[326,200],[34,370],[326,370],[180,170],[180,395],[40,44],[320,44],[40,516],[320,516]]){const s=rn(.8,1.2);bx(sc,14*s,9*s,14*s,x,4.5*s,z,M('#4cae42'));bx(sc,8*s,6*s,8*s,x+3,11*s,z-2,M('#62c654'))}
 zone=new T.Mesh(PL,new T.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.16}));zone.rotation.x=-Math.PI/2;zone.scale.set(W,H-RY-RW,1);zone.position.set(W/2,.8,(RY+RW+H)/2);zone.visible=false;sc.add(zone);
}
arena();
sc.add(new T.HemisphereLight('#e4f4ff','#6f9a58',.8));
const sun=new T.DirectionalLight('#fff1d6',.85);sun.position.set(60,280,560);sun.target.position.set(180,0,280);sc.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0008;
Object.assign(sun.shadow.camera,{left:-320,right:320,top:400,bottom:-400,near:50,far:1000});sun.shadow.camera.updateProjectionMatrix();

// ---- камера 2.5D: наклон 52°, максимально близко, пока вся арена в кадре ----
function fit(){
 const w=cv.clientWidth||360,h=cv.clientHeight||560,c=new T.Vector3(180,0,290),a=52*Math.PI/180;
 R.setSize(w,h,false);cam.aspect=w/h;
 const pts=[[10,20],[350,20],[10,548],[350,548]].map(p=>new T.Vector3(p[0],0,p[1])),
  put=d=>{cam.position.set(180,Math.sin(a)*d,290+Math.cos(a)*d);cam.lookAt(c);cam.updateProjectionMatrix();cam.updateMatrixWorld(true)};
 let lo=150,hi=2500;
 for(let i=0;i<24;i++){const d=(lo+hi)/2;put(d);pts.every(p=>{const v=p.clone().project(cam);return Math.abs(v.x)<=1&&Math.abs(v.y)<=1})?hi=d:lo=d}
 put(hi)}
addEventListener('resize',()=>on&&fit());

function puff(x,z,s){const m=new T.Mesh(BOX,new T.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.8}));m.position.set(x,12,z);m.scale.setScalar(s);m.userData={l:.4,s};sc.add(m);puffs.push(m)}

function begin(G){
 for(const m of items)sc.remove(m.w);items.clear();for(const f of fxs)sc.remove(f.m);fxs.clear();
 puffs.forEach(p=>sc.remove(p));puffs=[];tws.forEach(m=>sc.remove(m.w));
 tws=G.tw.map(t=>{const m=tower(t);sc.add(m.w);return m});
 on=1;last=performance.now();fit()}

function frame(G){
 const now=performance.now(),dt=Math.min(.05,(now-last)/1000),tt=now/1000;last=now;
 TX.wt.offset.x=(tt*.04)%1;
 const sel=G.sel>=0&&CARDS[G.hand[G.sel]];zone.visible=!!sel&&!sel.sp&&!G.done;
 const live=new Set(G.u);
 for(const m of items)if(!live.has(m.u)){sc.remove(m.w);items.delete(m);puff(m.u.x,m.u.y,14)}
 for(const u of G.u){
  let m=u.m;if(!m){m=u.m=model(u);sc.add(m.w);items.add(m)}
  const dx=u.x-m.px,dz=u.y-m.pz,mv=Math.hypot(dx,dz)>.05;
  if(mv){let d=Math.atan2(dx,dz)-m.ry;d=Math.atan2(Math.sin(d),Math.cos(d));m.ry+=d*Math.min(1,dt*12)}
  m.px=u.x;m.pz=u.y;
  const ph=tt*(6+u.s/8)+m.t0%7,sw=mv?Math.sin(ph)*.8:0,ta=u.as-u.cd,at=ta>=0&&ta<.28?Math.sin(ta/.28*Math.PI):0,a=Math.min(1,(now-m.t0)/300),pop=a<1?.3+.7*a+Math.sin(a*Math.PI)*.25:1;
  m.legL.rotation.x=sw;m.legR.rotation.x=-sw;m.aL.rotation.x=-sw;m.aR.rotation.x=sw-at*2.2;
  m.g.rotation.y=m.ry;m.g.scale.setScalar(m.S*pop);
  m.w.position.set(u.x,(mv?Math.abs(Math.sin(ph))*1.6:0)+(Math.abs(u.y-RY)<RW+6?3.5:0),u.y);
  setBar(m.hb,u.hp/u.max);m.hb.visible=u.hp<u.max;m.hb.quaternion.copy(cam.quaternion)}
 for(const f of G.fx){
  if(!f.m){f.m=f.k=='c'?new T.Mesh(CYL,new T.MeshBasicMaterial({color:'#ffb347',transparent:true})):new T.Mesh(BOX,B('#fff2a0'));if(f.k!='c')f.m.scale.setScalar(4);sc.add(f.m);fxs.add(f)}
  if(f.k=='c'){const p=1-f.l/.3,r=f.r*(.55+.5*p);f.m.scale.set(r,5,r);f.m.position.set(f.x,3,f.y);f.m.material.opacity=.75*Math.max(0,1-p)}
  else{const p=Math.min(1,1-f.l/.1);f.m.position.set(f.a.x+(f.b.x-f.a.x)*p,(f.a.king!==undefined?52:24)*(1-p)+16*p,f.a.y+(f.b.y-f.a.y)*p)}}
 const l2=new Set(G.fx);for(const f of fxs)if(!l2.has(f)){sc.remove(f.m);fxs.delete(f)}
 for(const m of tws){const t=m.t;setBar(m.hb,t.hp/t.max);m.hb.quaternion.copy(cam.quaternion);
  if(t.hp<=0&&!m.dead){m.dead=1;m.g.scale.y=.22;m.hb.visible=false;puff(t.x,t.y,t.rad)}}
 for(const p of puffs){const d=p.userData;d.l-=dt;const k=1-Math.max(0,d.l)/.4;p.scale.setScalar(d.s*(1+k*1.4));p.material.opacity=.8*(1-k);p.position.y+=dt*22;p.rotation.y+=dt*3;if(d.l<=0)sc.remove(p)}
 puffs=puffs.filter(p=>p.userData.l>0);
 R.render(sc,cam)}

function pick(e){const r=cv.getBoundingClientRect(),p=new T.Vector3();
 ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),cam);
 return ray.ray.intersectPlane(gp,p)?{x:p.x,y:p.z}:null}

return{ok:true,begin,frame,pick}
}catch(e){console.error(e);return{ok:false}}
})();
