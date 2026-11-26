'use strict';
/* 3.5: cosmetic variants and day/night lighting. No simulation writes. */
(() => {
  const read=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}}, write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  const SKINS=['titan','dragon','phoenix','frost'], SKIN_NAMES={titan:'Титан',dragon:'Дракон',phoenix:'Феникс',frost:'Ледяной дух'};
  const params=new URLSearchParams(location.search), legacy=params.get('visual')==='legacy';
  let selected=read('cd-guardian-35','titan');if(!SKINS.includes(selected))selected='titan';
  let day=read('cd-daylight-35','on')!=='off';let phase='dawn', renderPhase=0, runes=false, skinState='idle';
  const motion=matchMedia('(prefers-reduced-motion: reduce)'), phaseLabel=document.querySelector('#kingdom-phase');
  function preload(skin=selected){
    if(legacy||typeof ArenaCharacterModels==='undefined'||!ArenaCharacterModels?.preloadSkin)return Promise.resolve(false);
    if(skin===selected)skinState='loading';
    return ArenaCharacterModels.preloadSkin(skin).then(ok=>{if(skin===selected)skinState=ok?'ready':'fallback';return ok});
  }
  function equip(skin){if(!SKINS.includes(skin))return false;selected=skin;write('cd-guardian-35',skin);preload();return true}
  const API={skins:SKINS.slice(),names:{...SKIN_NAMES},selected:()=>selected,equip,preload,day:()=>day,setDay:on=>{day=!!on;write('cd-daylight-35',day?'on':'off')},stats:()=>({phase,renderPhase,runes,selected,skinState,legacy,day})};
  window.CDKingdom=API;
  if(legacy||typeof THREE==='undefined'||typeof ArenaArt3D==='undefined'||!ArenaArt3D)return;
  const A=ArenaArt3D,T=THREE;
  // Keep u.id/bonus and all stats untouched; resolve the cosmetic only inside the renderer.
  if(typeof ArenaCharacters3D!=='undefined'&&ArenaCharacters3D){
    const build=ArenaCharacters3D.build;
    ArenaCharacters3D.build=function(u,opts={}){
      const skin=u.bonus?(u.team===0?selected:'titan'):undefined;
      const level=u.bonus?1:(u.team===0&&typeof levelOf==='function'?levelOf(u.id):1);
      return build.call(this,u,{...opts,skin,level});
    };
  }
  if(typeof ArenaEnvironment3D==='undefined'||!ArenaEnvironment3D)return;
  const original=ArenaEnvironment3D.build;
  const palettes=[
    {sky:'#3d365a',hemi:'#eadfcf',ground:'#78657b',sun:'#ffe5b6',fill:'#acd0fa',hi:.76,si:1.25,fi:.34},
    {sky:'#43304d',hemi:'#dfc3e0',ground:'#72557b',sun:'#ffd3a0',fill:'#aabaf7',hi:.78,si:1.18,fi:.42},
    {sky:'#202746',hemi:'#c2d8f6',ground:'#514765',sun:'#d2e7ff',fill:'#b2a7f3',hi:.82,si:1.09,fi:.50}
  ].map(p=>({...p,sky:A.lin(p.sky),hemi:A.lin(p.hemi),ground:A.lin(p.ground),sun:A.lin(p.sun),fill:A.lin(p.fill)}));
  const names=['Золотой рассвет','Магический закат','Пробуждение магии'];
  const keys=['dawn','sunset','moon'];
  const blend=(a,b,t)=>a+(b-a)*t, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function routeTexture(){
    return A.texture(256,512,(g,w,h)=>{g.scale(w/360,h/560);g.lineCap='round';g.strokeStyle='#ffdda2';g.lineWidth=1.15;
      for(const s of [-1,1]){const x=180+s*92;g.beginPath();g.moveTo(180,72);g.bezierCurveTo(x,130,x,180,x,280);g.bezierCurveTo(x,380,x,430,180,490);g.stroke();for(const z of [157,202,237,324,361,407]){g.beginPath();g.moveTo(x,z-3);g.lineTo(x+3,z);g.lineTo(x,z+3);g.lineTo(x-3,z);g.closePath();g.fillStyle='#ffce82';g.fill()}}
    });
  }
  ArenaEnvironment3D.build=function(scene){
    const env=original.call(this,scene);if(!env?.root)return env;
    let route=null;try{const m=new T.MeshBasicMaterial({map:routeTexture(),color:A.lin('#ffdb93'),transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});route=new T.Mesh(new T.PlaneGeometry(360,560),m);route.rotation.x=-Math.PI/2;route.position.set(180,.151,280);route.visible=false;route.name='Kingdom awakening paths';env.root.add(route)}catch(e){console.warn('Kingdom paths fallback:',e.message)}
    let lastBucket=-1, lastPhase=-1, wasDay=null, lastMotion=null, lastLevel=-1;
    const update=env.update;
    env.update=function(time,state){
      const result=update.call(this,time,state);if(!state||!Number.isFinite(state.t))return result;
      const elapsed=clamp(180-state.t,0,180), phaseIndex=elapsed>=120?2:elapsed>=60?1:0;
      const reduced=motion.matches, level=window.CDPerformance?.level?.()??1;
      const enabled=day, bucket=Math.floor(elapsed*4);
      if(lastPhase!==phaseIndex||wasDay!==enabled){lastPhase=phaseIndex;phase=keys[phaseIndex];if(phaseLabel){phaseLabel.textContent=names[phaseIndex];phaseLabel.hidden=!enabled}}
      if(bucket!==lastBucket||wasDay!==enabled||lastMotion!==reduced||lastLevel!==level){
        lastBucket=bucket;lastMotion=reduced;lastLevel=level;wasDay=enabled;
        const progress=!enabled?0:reduced?phaseIndex:Math.min(2,elapsed/60),i=Math.min(1,Math.floor(progress)),k=progress-i,a=palettes[i],b=palettes[i+1];renderPhase=progress;
        const hemi=scene.children.find(o=>o.isHemisphereLight), dirs=scene.children.filter(o=>o.isDirectionalLight);
        if(scene.background?.isColor)scene.background.copy(a.sky).lerp(b.sky,k);
        if(hemi){hemi.color.copy(a.hemi).lerp(b.hemi,k);hemi.groundColor.copy(a.ground).lerp(b.ground,k);hemi.intensity=blend(a.hi,b.hi,k)}
        if(dirs[0]){dirs[0].color.copy(a.sun).lerp(b.sun,k);dirs[0].intensity=blend(a.si,b.si,k)}
        if(dirs[1]){dirs[1].color.copy(a.fill).lerp(b.fill,k);dirs[1].intensity=blend(a.fi,b.fi,k)}
        runes=!!route&&enabled&&level>0&&phaseIndex===2;
        if(route){route.visible=runes;route.material.opacity=runes?(reduced?.32:.22+.09*Math.sin(elapsed*1.4)**2):0}
      }
      return result;
    };return env;
  };
  // Load default and chosen appearance in the background, without delaying mandatory assets.
  // One optional model is enough when the player selects Titan.
  preload('titan');if(selected!=='titan')preload(selected);
})();
