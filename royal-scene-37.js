'use strict';
/* Royal Visual Upgrade — bounded cosmetic layer over the 3.5 renderer. No mutation of simulation. */
(() => {
  const params=new URLSearchParams(location.search), legacy=params.get('visual')==='legacy';
  const read=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}}, write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  const worlds={royal:{name:'Королевское святилище',tone:'#f8ebe0',sky:'#554268',key:'#ffe1ad',fill:'#a9d9f5',accent:'#e7bd72',flow:['#d8f7ff','#83d8ed','#547da9']},forest:{name:'Зачарованный лес',tone:'#c4ded0',sky:'#38574f',key:'#ffe9bf',fill:'#b3e5cc',accent:'#98e1ac',flow:['#e1fff2','#80dbb9','#3d9f8c']},frost:{name:'Ледяное королевство',tone:'#d1e7fa',sky:'#3e6082',key:'#e8f2ff',fill:'#c4d8ff',accent:'#b5e8ff',flow:['#f2fcff','#a7deff','#7196d6']},ember:{name:'Огненная цитадель',tone:'#c9a6a4',sky:'#573447',key:'#ffca8a',fill:'#c1a3e6',accent:'#ffa968',flow:['#ffe5a1','#fba14c','#c25338']},sky:{name:'Небесный храм',tone:'#f4ecdf',sky:'#798bb4',key:'#fff0cf',fill:'#bfdcff',accent:'#e8d9a2',flow:['#ffffff','#c4ebff','#8fb7ed']}};
  let choice=read('cd-world-36','royal');if(!worlds[choice])choice='royal';if(worlds[params.get('world')])choice=params.get('world');
  let vfx=read('cd-vfx-36','on')!=='off';const images=new Map(), loading=new Map(), info={enabled:!legacy,models:{},world:choice,floor:false,damageChanges:0,spellBursts:0,activeEffects:0,decor:0};
  const preload=name=>{if(images.has(name))return Promise.resolve(images.get(name));if(loading.has(name))return loading.get(name);const p=new Promise(resolve=>{const im=new Image();im.onload=()=>{if(name===choice){images.clear();images.set(name,im)}resolve(im)};im.onerror=()=>resolve(null);im.src=`royal-floor-${name}-37.webp`});loading.set(name,p);p.then(()=>loading.delete(name));return p};
  const api={worlds:Object.fromEntries(Object.entries(worlds).map(([k,x])=>[k,x.name])),selected:()=>choice,select(k){if(!worlds[k])return false;choice=k;write('cd-world-36',k);if(!legacy)preload(k);return true},vfx:()=>vfx,setVfx(on){vfx=!!on;write('cd-vfx-36',on?'on':'off')},preload:()=>preload(choice),stats:()=>({...info,models:{...info.models},selected:choice})};window.CDRoyal=api;
  if(legacy||typeof THREE==='undefined'||typeof ArenaArt3D==='undefined'||!ArenaArt3D)return;
  const T=THREE,A=ArenaArt3D, motion=matchMedia('(prefers-reduced-motion: reduce)'), tier=params.get('quality'), TAU=2*Math.PI;
  const budget=()=>Math.max(0,Math.min(2,window.CDPerformance?.level?.()??(tier==='high'?2:tier==='low'?0:1)));
  const lin=x=>A.lin(x), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  // 3.4 replacement chain remains intact. If the new asset fails, the previous versions still load.
  if(typeof ArenaBinary!=='undefined'&&ArenaBinary){const old=ArenaBinary.load;const names=['guard','archer','colossus','imp','mage','hounds','swarm','brute'];const replace=Object.fromEntries(names.map(n=>[n+'-unit',n+'-imperial-37']));replace['citadel-hd']='citadel-imperial-37';ArenaBinary.load=async function(name){if(!replace[name])return old.call(this,name);try{const asset=await old.call(this,replace[name]);info.models[name]='royal';return asset}catch(e){info.models[name]='fallback';console.warn('Royal model fallback:',name,e.message);return old.call(this,name)}}}
  preload(choice);
  // Stage-specific shared crack decals; no new geometry or material allocated when HP changes.
  const cracks=[];for(let stage=1;stage<=3;stage++){
    const texture=A.texture(128,128,(g,w,h)=>{const r=A.rng(3600+stage);for(let j=0;j<stage*3;j++){let x=15+r()*98,y=10+r()*108;const path=[[x,y]];for(let k=0;k<3+stage;k++){x+=-13+r()*26;y+=7+r()*12;path.push([x,y])}g.lineJoin='round';g.lineCap='round';const stroke=(dx,col,width)=>{g.strokeStyle=col;g.lineWidth=width;g.beginPath();path.forEach(([a,b],i)=>g[i?'lineTo':'moveTo'](a+dx,b));g.stroke()};stroke(1,'rgba(247,218,174,.56)',1.5);stroke(0,'rgba(28,20,33,.95)',1.5+stage*.45);if(stage===3){stroke(0,'rgba(255,159,90,.65)',.65)}}});
    cracks.push(new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.12,depthWrite:false,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));
  }
  if(typeof ArenaTowers3D!=='undefined'&&ArenaTowers3D){
    const oldBuild=ArenaTowers3D.build, tmp=new T.Object3D();
    const keeperMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.12});
    function combine(parts){const pos=[],nor=[],cols=[],idx=[],vec=new T.Vector3(),normal=new T.Vector3(),normalMatrix=new T.Matrix3(),o=new T.Object3D();for(const [geo,p,scale,hex] of parts){o.position.set(...p);o.scale.set(...scale);o.updateMatrix();normalMatrix.getNormalMatrix(o.matrix);const base=pos.length/3,a=geo.attributes.position,n=geo.attributes.normal,c=lin(hex);for(let i=0;i<a.count;i++){vec.fromBufferAttribute(a,i).applyMatrix4(o.matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();pos.push(vec.x,vec.y,vec.z);nor.push(normal.x,normal.y,normal.z);cols.push(c.r,c.g,c.b)}if(geo.index)for(let i=0;i<geo.index.count;i++)idx.push(base+geo.index.getX(i));else for(let i=0;i<a.count;i++)idx.push(base+i)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(cols,3));g.setIndex(idx);g.computeBoundingSphere();return g}
    const keeperGeos=['#365c70','#6c407f'].map(cloth=>combine([[A.G.cone,[0,4.6,0],[4,9,4],cloth],[A.G.sphere,[0,10.5,0],[2.6,2.8,2.6],'#d9bda1'],[A.G.cone,[0,13,0],[3.1,5,3.1],'#caa269'],[A.G.cyl,[4,6,0],[.42,12,.42],'#caa269']]));
    const trimParts=[];for(const sign of [-1,1]){trimParts.push([A.G.bevel,[sign*10.8,12,0],[3.2,17,4.6],'#b8a9b5'],[A.G.box,[sign*12.3,20,0],[1.2,7,3],'#d6ad66'])}trimParts.push([A.G.cyl,[0,26.5,0],[12,1.2,12],'#d6ad66']);const trimGeo=combine(trimParts);
    ArenaTowers3D.build=function(t){const obj=oldBuild.call(this,t),intact=obj.root.children[0];if(!intact?.isGroup)return obj;
      const panels=new T.InstancedMesh(A.G.plane,cracks[0],4);panels.frustumCulled=false;panels.castShadow=false;panels.visible=false;panels.renderOrder=3;intact.add(panels);
      for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,r=t.king?31.5:11.8;tmp.position.set(Math.sin(a)*r,t.king?28:16,Math.cos(a)*r);tmp.rotation.set(0,a,0);tmp.scale.set(t.king?24:13,t.king?32:18,1);tmp.updateMatrix();panels.setMatrixAt(i,tmp.matrix)}panels.instanceMatrix.needsUpdate=true;
      // Royal obelisk: carved buttresses plus a small animated keeper effigy on the ledge.
      let keeper=null,wand=null;if(!t.king){const trim=new T.Mesh(trimGeo,keeperMat);trim.castShadow=false;intact.add(trim);
        keeper=new T.Group();keeper.position.set(9,29,7);intact.add(keeper);keeper.add(new T.Mesh(keeperGeos[t.team],keeperMat));wand=A.mesh(keeper,A.G.oct,A.material(A.C.team[t.team],'glow'),4,13,0,1.25,2.2,1.25,0,0,0,false);
      }
      const crystal=intact.children.find(o=>o.isGroup&&o.position.y>(t.king?65:32)&&o.children.some(c=>c.isMesh&&c.material?.emissive));const crystalMat=crystal?.children.find(c=>c.isMesh&&c.material?.emissive)?.material;
      let stage=-1,flash=0,lastBucket=-1;const update=obj.update;obj.update=function(time,dt,cam,attack){const result=update.call(this,time,dt,cam,attack);const r=t.hp/t.max,next=r<=0?4:r<=.25?3:r<=.5?2:r<=.75?1:0;if(stage!==next){stage=next;info.damageChanges++;panels.visible=stage>0&&stage<4;if(panels.visible)panels.material=cracks[stage-1];if(crystalMat)crystalMat.emissiveIntensity=[.26,.20,.13,.06,0][stage]}
        if(crystalMat&&stage===3&&!motion.matches)crystalMat.emissiveIntensity=.09+.055*Math.sin(time*5);
        if(keeper){keeper.visible=budget()>0&&t.hp>0;flash=attack ? .17 : Math.max(0,flash-dt);const bucket=Math.floor(time*15);if(keeper.visible&&bucket!==lastBucket){lastBucket=bucket;keeper.rotation.z=motion.matches?0:Math.sin(time*1.65)*.045;keeper.rotation.y=motion.matches?0:Math.sin(time*.72)*.15;wand.scale.set(1.25*(1+flash*3),2.2*(1+flash*3),1.25*(1+flash*3))}}
        return result};return obj};
  }
  if(typeof ArenaCharacters3D!=='undefined'&&ArenaCharacters3D){const old=ArenaCharacters3D.build;ArenaCharacters3D.build=function(u,opts){const obj=old.call(this,u,opts),update=obj.update;let age=0;obj.update=function(time,dt,x,z){age+=dt;const out=update.call(this,time,dt,x,z);if(age>.37&&!motion.matches){const factor=(u.big||u.bonus) ? .62 : (u.id==='hounds'||u.id==='imp') ? 1.24 : 1;obj.root.position.y*=factor}return out};return obj}}
  if(typeof ArenaEnvironment3D==='undefined'||!ArenaEnvironment3D)return;
  // Texture-only gold flourishes. One shared 256px magic texture, one bounded instanced batch.
  const fxTex=A.texture(256,256,(g,w,h)=>{g.translate(128,128);const a=g.createRadialGradient(0,0,8,0,0,125);a.addColorStop(0,'rgba(255,255,255,0)');a.addColorStop(.64,'rgba(255,255,255,0)');a.addColorStop(.79,'rgba(255,255,255,.38)');a.addColorStop(.87,'rgba(255,255,255,.08)');a.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=a;g.fillRect(-128,-128,256,256);g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=2;for(const r of [72,76,103,108]){g.beginPath();g.arc(0,0,r,0,TAU);g.stroke()}for(let i=0;i<12;i++){g.save();g.rotate(i*TAU/12);g.beginPath();g.moveTo(0,-112);g.lineTo(7,-99);g.lineTo(0,-88);g.lineTo(-7,-99);g.closePath();g.stroke();g.restore()}});
  const fxMat=new T.MeshBasicMaterial({map:fxTex,transparent:true,opacity:.85,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
  const decorMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.83,metalness:.04}), decorGeo=A.G.oct, leafGeo=A.G.leaf, lightMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  // Each themed water image is generated once, on demand. Keep original scrolling UVs.
  const waters=new Map();function waterImage(k){if(waters.has(k))return waters.get(k);const c=document.createElement('canvas');c.width=96;c.height=128;const g=c.getContext('2d'),p=worlds[k].flow;const gr=g.createLinearGradient(0,0,96,0);gr.addColorStop(0,p[2]+'16');gr.addColorStop(.2,p[1]+'ad');gr.addColorStop(.47,p[0]+'ef');gr.addColorStop(.77,p[1]+'aa');gr.addColorStop(1,p[2]+'16');g.fillStyle=gr;g.fillRect(0,0,96,128);const r=A.rng(3603);for(let i=0;i<55;i++){const x=r()*96,y=r()*128,h=12+r()*58;g.fillStyle=p[0]+(i%3?'40':'90');g.fillRect(x,y,1+r()*1.8,h);if(y+h>128)g.fillRect(x,0,1,y+h-128)}waters.set(k,c);return c}
  const original=ArenaEnvironment3D.build;
  ArenaEnvironment3D.build=function(scene){
    const env=original.call(this,scene);if(!env?.root)return env;const root=env.root,tmp=new T.Object3D(), color=new T.Color();
    const newDecor=new T.Group();newDecor.name='Royal theme decor';root.add(newDecor);
    const shapes=new T.InstancedMesh(decorGeo,decorMat,24), flora=new T.InstancedMesh(leafGeo,decorMat,24), gems=new T.InstancedMesh(decorGeo,lightMat,16);
    for(const m of [shapes,flora,gems]){m.frustumCulled=false;m.castShadow=false;m.receiveShadow=false;m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count*3),3);m.count=0;newDecor.add(m)}
    const fx=new T.InstancedMesh(A.G.plane,fxMat,16);fx.frustumCulled=false;fx.castShadow=false;fx.instanceColor=new T.InstancedBufferAttribute(new Float32Array(fx.instanceMatrix.count*3),3);fx.count=0;fx.visible=false;fx.renderOrder=5;root.add(fx);
    const pool=Array.from({length:16},()=>({active:false,pri:0,start:0,life:0,x:0,z:0,r:0,c:0,kind:0}));
    let current=null,theme=choice,floorMesh=null, floorApplied='', smallFloor=null,smallKey='', changed=false,lastLight='',lastState=null,seen=new WeakSet(),destroyed=new WeakSet(), evi=0,lastFx=-1,lastT=180,lightBase=null;
    const writeInst=(m,i,x,y,z,sx,sy,sz,ry,hex)=>{tmp.position.set(x,y,z);tmp.rotation.set(0,ry,0);tmp.scale.set(sx,sy,sz);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);m.setColorAt(i,lin(hex))};
    function themeDecor(k){const r=A.rng(3611),p=worlds[k];let ns=0,nf=0,ng=0;
      for(const side of [-1,1])for(const z of [38,128,218,342,432,522]){const x=side<0?-24:384,lean=r()*.8;
        if(k==='forest'||k==='royal'){
          writeInst(shapes,ns++,x,7,z,2.4,8,2.4,lean,'#8c7654');writeInst(flora,nf++,x,16,z,8,8,8,lean,k==='forest'?'#6aa67d':'#a981b1');writeInst(flora,nf++,x+side*5,20,z+4,6,6,6,lean,k==='forest'?'#9bc895':'#d1a5ce');
        }else if(k==='frost'){
          writeInst(shapes,ns++,x,11,z,7,15,6,lean,'#acc9e3');writeInst(shapes,ns++,x+side*5,6,z+7,4,8,4,lean,'#e2f4ff');
        }else if(k==='ember'){
          writeInst(shapes,ns++,x,10,z,7,13,6,lean,'#524050');writeInst(shapes,ns++,x+side*5,6,z+7,4,8,4,lean,'#977278');
        }else{
          writeInst(flora,nf++,x,4,z,12,4,8,lean,'#d6e1f0');writeInst(shapes,ns++,x,13,z,4,14,4,lean,'#eee2cb');
        }writeInst(gems,ng++,x, k==='forest'||k==='royal'?24:19,z,1.8,3.8,1.8,lean,p.accent)
      }
      for(const [m,n] of [[shapes,ns],[flora,nf],[gems,ng]]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}info.decor=ns+nf+ng;
      // Identify the existing 3.3 waterfall texture by its exact dimensions/repeat. No extra draw calls.
      root.traverse(o=>{const tex=o.material?.map;if(tex?.image?.width===96&&tex.image.height===128&&Math.abs(tex.repeat.y-1.65)<.01){tex.image=waterImage(k);tex.needsUpdate=true}});
      A.stone.color.copy(lin(p.tone));info.world=k;lastLight='';
    }
    function applyFloor(){if(!floorMesh)floorMesh=root.getObjectByName('Reforged stone mosaic');const img=images.get(theme);if(floorMesh&&img){const low=budget()===0,k=theme+':'+low;if(floorApplied!==k){if(low){if(smallKey!==theme){smallFloor=document.createElement('canvas');smallFloor.width=512;smallFloor.height=1024;smallFloor.getContext('2d').drawImage(img,0,0,512,1024);smallKey=theme}floorMesh.material.map.image=smallFloor}else floorMesh.material.map.image=img;floorMesh.material.map.needsUpdate=true;floorApplied=k;info.floor=true}}}
    function addFx(pri,start,life,x,z,r,c,kind=0){if(!Number.isFinite(x)||!Number.isFinite(z))return;let slot=pool.find(o=>!o.active||o.start+o.life<start-.25);if(!slot){slot=pool.reduce((a,b)=>a.pri<=b.pri?a:b);if(slot.pri>=pri)return}Object.assign(slot,{active:true,pri,start,life,x,z,r,c,kind});info.spellBursts++}
    function updates(state,t,level){
      const on=vfx&&level>0&&!motion.matches&&!state.paused;
      if(!on){fx.count=0;fx.visible=false;info.activeEffects=0;pool.forEach(p=>p.active=false);for(const f of state.fx||[])seen.add(f);evi=(state.ev||[]).length;return}
      // All hit/rune events are read once; simulation coordinates and damage stay untouched.
      for(const f of state.fx||[]){if(seen.has(f))continue;seen.add(f);if(f.k==='c'){
        const key=f.card,palette=key==='spark'?'#98eaff':key==='shrine'?'#ffe0a1':'#ffc17b';
        if(key==='meteor'||key==='mage'){const delay=key==='meteor' ? .14 : .15;addFx(2,t,delay,f.x,f.y,Math.min(f.r||28,50)*.8,palette,1);addFx(3,t+delay,.55,f.x,f.y,f.r||28,palette)}
        else if(key==='spark'||key==='imp'||key==='shrine')addFx(key==='shrine'?5:3,t,key==='shrine'?1.1:.55,f.x,f.y,f.r||30,palette);
      }else if(f.k==='m'&&level>1&&f.b)addFx(1,t,.17,f.b.x,f.b.y,10,'#ffe3b1');else if(f.k==='l'&&level>1&&f.b)addFx(1,t+(f.a?.king!==undefined ? .16 : .14),.19,f.b.x,f.b.y,12,A.C.team[f.a?.team||0])}
      const events=state.ev||[];while(evi<events.length){const e=events[evi++];if(e.type==='cast'&&!e.sp)addFx(2,t,.55,e.x,e.y,21,A.C.team[e.team||0],1);else if(e.type==='tower'){const tower=state.tw?.find(o=>o.team===e.team&&!!o.king===!!e.king&&o.hp<=0&&!destroyed.has(o));if(tower){destroyed.add(tower);addFx(5,t,1,tower.x,tower.y,tower.king?62:34,A.C.team[e.team||0])}}}
      const max=level===1?5:10;let count=0;for(const p of pool){if(!p.active)continue;const age=t-p.start;if(age<0)continue;if(age>=p.life){p.active=false;continue}if(count>=max)continue;const k=clamp(age/p.life,0,1),scale=p.r*2*(p.kind?1-.22*k:.45+.78*k);tmp.position.set(p.x,.54,p.z);tmp.rotation.set(-Math.PI/2,0,p.kind?k*.6:k*.2);tmp.scale.set(scale,scale,1);tmp.updateMatrix();fx.setMatrixAt(count,tmp.matrix);color.copy(lin(p.c)).multiplyScalar(p.kind ? .55+.25*k : Math.pow(1-k,1.4)*.78);fx.setColorAt(count,color);count++}
      fx.count=count;fx.visible=count>0;if(count){fx.instanceMatrix.needsUpdate=true;if(fx.instanceColor)fx.instanceColor.needsUpdate=true}info.activeEffects=count;
    }
    const update=env.update;env.update=function(time,state){const result=update.call(this,time,state);if(!state)return result;
      if(state!==lastState){lastState=state;theme=choice;floorApplied='';info.floor=false;themeDecor(theme);seen=new WeakSet();destroyed=new WeakSet();evi=0;pool.forEach(p=>p.active=false);lastFx=-1;lastT=180;lastLight=''}
      applyFloor();const level=budget();newDecor.visible=level>0;const t=clamp(180-(state.t??180),0,180)+(state.done?(state.finishAge||0):0);
      // Blend with the 3.5 time-of-day palette without accumulating color multiplication.
      const key=theme+':'+Math.floor(t*4);if(lastLight!==key){lastLight=key;const p=worlds[theme],day=window.CDKingdom?.day?.()!==false,night=day?clamp(t/180,0,1):0;const dirs=scene.children.filter(o=>o.isDirectionalLight),hemi=scene.children.find(o=>o.isHemisphereLight);
        if(scene.background?.isColor)scene.background.copy(lin(p.sky)).lerp(lin('#242a46'),night*.53);
        if(dirs[0]){dirs[0].color.copy(lin(p.key)).lerp(lin('#c6ddff'),night*.58);dirs[0].intensity=1.30-night*.18}
        if(dirs[1]){dirs[1].color.copy(lin(p.fill));dirs[1].intensity=.38+night*.10}
        if(hemi){hemi.groundColor.copy(lin('#675875'));hemi.intensity=.75+night*.05}}
      // If new visual effects are disabled, clear immediately; otherwise update at a bounded frequency.
      if(!vfx||level===0||motion.matches||state.paused){updates(state,t,level);lastFx=-1}else if(lastFx<0||t-lastFx>=1/(level===2?30:20)||state.done){lastFx=t;updates(state,t,level)}
      return result};return env;
  };
})();
