'use strict';
/* 3.5: collection hall, optional 2.5D intro and reward presentation. No writes to game save. */
(() => {
  const $=s=>document.querySelector(s), K=window.CDKingdom, app=$('#app'), game=$('#game'), res=$('#res'), hall=$('#kingdom-hall'), intro=$('#kingdom-intro');
  if(!K||!hall||!intro||!game||!res)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)'), read=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}}, write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  const items=[['guard','Страж','Крепкий защитник. Меч и щит.','metal'],['archer','Лучники','Два стрелка атакуют на расстоянии.','arrow'],['colossus','Колосс','Массивный боец, атакует сооружения.','heavy'],['imp','Бес-подрывник','Быстрый боец с магическим взрывом.','imp'],['mage','Маг огня','Огненный шар поражает область.','firehit'],['hounds','Гончие','Три быстрых зверя.','hound'],['swarm','Рой','Четыре маленьких голема.','swarm'],['brute','Громила','Тяжёлый боец с сильным ударом.','heavy'],['meteor','Метеорит','Заклинание большой области.','meteor'],['spark','Искра','Магический электрический разряд.','spark']].map((v,i)=>({id:v[0],name:v[1],info:v[2],sound:v[3],index:i,spell:i>=8}));
  const skins=[['titan','Титан','Древняя корона, золотые плиты и кристальное сердце.'],['dragon','Дракон','Драконьи рога и пластинчатые крылья.'],['phoenix','Феникс','Огненное оперение и золотой гребень.'],['frost','Ледяной дух','Ледяные наросты и серебряная броня.']].map((v,i)=>({id:'guardian-'+v[0],skin:v[0],name:v[1],info:v[2],index:i,sound:'guardian'}));
  const all=[...items,...skins], sel=$('#kingdom-item'), portrait=$('#kingdom-portrait'), host=$('#kingdom-model'), stage=$('#kingdom-showcase'), note=$('#kingdom-showcase-note'), status=$('#kingdom-hall-status'), equip=$('#kingdom-equip'), rotateBtn=$('#kingdom-rotate');
  const prefs={intro:read('cd-intro-35','on')!=='off'}, introPref=$('#kingdom-intro-pref'), dayPref=$('#kingdom-day-pref');
  introPref.checked=prefs.intro;dayPref.checked=K.day();introPref.addEventListener('change',()=>{prefs.intro=introPref.checked;write('cd-intro-35',prefs.intro?'on':'off')});dayPref.addEventListener('change',()=>K.setDay(dayPref.checked));
  function syncEquipped(){$('#guardian-equipped').textContent=K.names[K.selected()]||'Титан'}syncEquipped();
  for(const [title,list] of [['Руны',items],['Облики хранителя',skins]]){const group=document.createElement('optgroup');group.label=title;for(const x of list){const o=document.createElement('option');o.value=x.id;o.textContent=x.name;group.append(o)}sel.append(group)}
  let item=all[0], token=0, viewer=null, frame=0, rotating=!motion.matches, attackUntil=0, savedFocus=null, audio=null, portraitTimer=0, noGL=false, switching=false;
  const level=x=>{try{return typeof levelOf==='function'?levelOf(x.id):1}catch(_){return 1}};
  const owned=x=>{try{return typeof S==='undefined'||S.own.includes(x.id)}catch(_){return true}};
  function statusText(text){if(status.textContent!==text)status.textContent=text}
  function syncItem(){
    sel.value=item.id;$('#kingdom-item-name').textContent=item.name;$('#kingdom-item-level').textContent=item.skin?(K.selected()===item.skin?'Выбран':'Облик'):(owned(item)?'Уровень '+level(item):'Не открыта');
    $('#kingdom-item-info').textContent=item.info+(item.skin?' Влияет только на внешний вид.':level(item)>=3?' Улучшенный материал и золотая отделка интерфейса.':'');
    equip.hidden=!item.skin;equip.disabled=!!item.skin&&K.selected()===item.skin;equip.textContent=equip.disabled?'Выбранный облик':'Выбрать облик';
    portrait.dataset.type=item.skin?'skin':'rune';portrait.style.backgroundPosition=item.skin?`${item.index*100/3}% 0%`:`${(item.index%5)*25}% ${item.index<5?0:100}%`;
    rotateBtn.setAttribute('aria-pressed',String(rotating));rotateBtn.disabled=!!item.spell||stage.dataset.live!=='1';$('#kingdom-attack').textContent=item.spell?'Заклинание':'Атака';
  }
  function stopAudio(){if(audio){try{audio.pause();audio.removeAttribute('src');audio.load()}catch(_){}}}
  function playSample(){
    if(hall.hidden||!game.hidden||document.hidden)return;
    if(read('ba_audio_v27','on')==='off'){statusText('Общий звук выключен. Включи его в меню.');return}
    let vol=.65;try{const s=JSON.parse(read('cd-battle-audio-v33','{}'));if(Number.isFinite(s.sfx))vol=Math.max(0,Math.min(1,s.sfx/100))}catch(_){}
    if(!vol){statusText('Громкость звуков сражения равна нулю.');return}
    const clip=window.CD331Clips?.[item.sound];if(!clip){statusText('Звуковой образец недоступен.');return}
    try{if(!audio)audio=new Audio();audio.pause();audio.src=clip;audio.volume=vol;audio.play().then(()=>statusText('Звук персонажа.')).catch(()=>statusText('Браузер не разрешил звук. Проверь системную громкость.'))}catch(_){statusText('Звук недоступен.')}
  }
  function destroyViewer(){
    token++;if(frame)cancelAnimationFrame(frame);frame=0;const v=viewer;viewer=null;stage.dataset.live='0';
    if(v){try{v.rig?.dispose();v.renderer.dispose();v.renderer.forceContextLoss()}catch(_){}try{v.renderer.domElement.remove()}catch(_){}}
    host.replaceChildren();
  }
  function fallback(text){destroyViewer();note.textContent=text;rotateBtn.disabled=true}
  function resize(v){const w=host.clientWidth,h=host.clientHeight;if(w<2||h<2)return false;if(w!==v.w||h!==v.h){v.w=w;v.h=h;const aspect=w/h,half=Math.max(v.half,v.radius/aspect);v.cam.left=-half*aspect;v.cam.right=half*aspect;v.cam.top=half;v.cam.bottom=-half;v.cam.updateProjectionMatrix();v.renderer.setSize(w,h,false)}return true}
  async function startViewer(){
    destroyViewer();const mine=token,x=item;note.textContent=x.spell?'Художественное заклинание · 2D':'Загрузка модели…';rotateBtn.disabled=!!x.spell;attackUntil=0;
    if(x.spell)return;
    if(noGL||typeof THREE==='undefined'||typeof ArenaCharacterModels==='undefined'||!ArenaCharacterModels||typeof ArenaArt3D==='undefined'||!ArenaArt3D){fallback('Портрет модели · 3D недоступно');return}
    let renderer;
    try{
      const T=THREE,A=ArenaArt3D;
      renderer=new T.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
      const v={renderer,rig:null,scene:new T.Scene(),cam:new T.OrthographicCamera(-25,25,25,-25,.1,450),body:new T.Group(),w:0,h:0,half:25,radius:22,yaw:.4,last:0,slow:0,measure:0,work:0};viewer=v;
      renderer.setPixelRatio(Math.min(1.25,window.devicePixelRatio||1));renderer.setClearColor(0,0);renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
      v.scene.add(v.body,new T.HemisphereLight(A.lin('#e8dbff'),A.lin('#6c567c'),.92));const light=new T.DirectionalLight(A.lin('#ffe6bf'),1.38);light.position.set(-30,65,75);v.scene.add(light);const rim=new T.DirectionalLight(A.lin('#8fe3ff'),.75);rim.position.set(50,24,-30);v.scene.add(rim);
      await ArenaCharacterModels.preload();let ok=true;if(x.skin)ok=await K.preload(x.skin);
      if(mine!==token||hall.hidden||item!==x||viewer!==v)return;
      if(x.skin&&!ok){fallback('Новый облик недоступен · портрет');return}
      const id=x.skin?'colossus':x.id;v.rig=ArenaCharacterModels.instantiate(id,0,v.body,{shadows:false,skin:x.skin,level:x.skin?1:level(x)});
      // Bind-pose bounds; horizontal radius remains valid as the model rotates.
      const bounds=new T.Box3();for(const mesh of v.rig.meshes){if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox)}
      const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());v.body.position.y=-bounds.min.y;v.radius=Math.max(13,Math.hypot(size.x,size.z)*.58);v.half=Math.max(17,size.y*.70,v.radius*.90);const targetY=size.y*.49;v.cam.position.set(0,targetY+12,100);v.cam.lookAt(0,targetY,0);
      v.body.rotation.y=v.yaw;v.rig.pose('Idle',.16);host.replaceChildren(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(viewer===v){noGL=true;fallback('Портрет модели · 3D остановлено')}},{once:true});
      if(!resize(v))throw Error('Preview size');renderer.render(v.scene,v.cam);stage.dataset.live='1';note.textContent='3D · проведи пальцем для вращения';rotateBtn.disabled=false;
      function tick(now){
        if(viewer!==v||hall.hidden||document.hidden||!game.hidden)return;
        frame=requestAnimationFrame(tick);if(now-v.last<32)return;const dt=v.last?Math.min(.10,(now-v.last)/1000):.033;v.last=now;
        try{resize(v);if(rotating&&!motion.matches)v.yaw+=dt*.55;v.body.rotation.y=v.yaw;v.rig.pose(now<attackUntil?'Attack':'Idle',dt);const started=performance.now();renderer.render(v.scene,v.cam);v.work+=performance.now()-started;v.measure++;if(v.measure>=60){if(v.work/v.measure>32)v.slow++;else v.slow=0;v.work=0;v.measure=0;if(v.slow>=2){noGL=true;fallback('Портрет модели · лёгкий режим');return}}}catch(_){noGL=true;fallback('Портрет модели · 3D недоступно')}
      }
      frame=requestAnimationFrame(tick);
    }catch(e){if(mine===token){console.warn('Kingdom collection fallback:',e.message);if(!renderer)noGL=true;fallback('Портрет модели · 3D недоступно')}}
  }
  function choose(id){const x=all.find(x=>x.id===id);if(!x)return;item=x;stopAudio();statusText(x.skin?'Облики меняют только внешность. Сила хранителя прежняя.':'Осмотри модель или послушай характерный звук.');syncItem();startViewer()}
  function modalGuard(){const locked=!hall.hidden||!intro.hidden;for(const el of [app.querySelector('header'),app.querySelector('main'),app.querySelector('nav')])if(el&&'inert' in el)el.inert=locked}
  function openHall(id='guard',reason=''){
    if(!game.hidden||!res.hidden||!intro.hidden)return;savedFocus=document.activeElement;hall.hidden=false;modalGuard();rotating=!motion.matches;choose(id);if(reason){stage.classList.remove('upgraded');void stage.offsetWidth;stage.classList.add('upgraded');statusText(reason==='upgrade'?'Руна улучшена! Новый уровень сохранён.':'Новая руна открыта!')}
    $('#kingdom-hall-close').focus({preventScroll:true});
  }
  function closeHall(){if(hall.hidden)return;hall.hidden=true;modalGuard();destroyViewer();stopAudio();clearTimeout(portraitTimer);if(savedFocus?.isConnected)savedFocus.focus({preventScroll:true});savedFocus=null}
  $('#open-kingdom-hall').addEventListener('click',()=>openHall('guard'));$('#open-kingdom-profile').addEventListener('click',()=>openHall('guardian-'+K.selected()));$('#kingdom-hall-close').addEventListener('click',closeHall);
  sel.addEventListener('change',()=>choose(sel.value));$('#kingdom-prev').addEventListener('click',()=>choose(all[(all.indexOf(item)+all.length-1)%all.length].id));$('#kingdom-next').addEventListener('click',()=>choose(all[(all.indexOf(item)+1)%all.length].id));
  rotateBtn.addEventListener('click',()=>{rotating=!rotating;rotateBtn.setAttribute('aria-pressed',String(rotating))});
  $('#kingdom-attack').addEventListener('click',()=>{if(viewer?.rig){viewer.rig.pose('Attack',0,1,true);attackUntil=performance.now()+550}else{stage.classList.remove('demo');void stage.offsetWidth;stage.classList.add('demo');clearTimeout(portraitTimer);portraitTimer=setTimeout(()=>stage.classList.remove('demo'),600)}playSample()});$('#kingdom-voice').addEventListener('click',playSample);
  equip.addEventListener('click',()=>{if(!item.skin)return;K.equip(item.skin);syncEquipped();syncItem();statusText('Облик сохранён. Бонусный хранитель появится в новом оформлении, если модель загрузилась.');});
  let pointer=null;host.addEventListener('pointerdown',e=>{if(!viewer||stage.dataset.live!=='1')return;pointer={id:e.pointerId,x:e.clientX};rotating=false;rotateBtn.setAttribute('aria-pressed','false');try{host.setPointerCapture(e.pointerId)}catch(_){}});host.addEventListener('pointermove',e=>{if(!viewer||!pointer||pointer.id!==e.pointerId)return;viewer.yaw+=(e.clientX-pointer.x)*.018;pointer.x=e.clientX});for(const t of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(t,()=>pointer=null);
  // Detect successful forge transactions using the existing save. We do not grant any extra rewards.
  $('#unlock-list').addEventListener('click',e=>{const btn=e.target.closest('[data-upgrade],[data-unlock]');if(!btn||btn.disabled)return;const id=btn.dataset.upgrade||btn.dataset.unlock,x=all.find(i=>i.id===id);if(!x)return;const before=level(x),had=owned(x);setTimeout(()=>{if((btn.dataset.upgrade&&level(x)>before)||(btn.dataset.unlock&&!had&&owned(x)))openHall(id,btn.dataset.upgrade?'upgrade':'unlock')},0)},{capture:true});
  // Optional 2.5D intro, before the original play handler creates the match. Clock stays at 3:00.
  const play=$('#play'), originalPlay=play.onclick;let introTimer=0, introEvent=null;
  function cancelIntro(){clearTimeout(introTimer);introTimer=0;intro.hidden=true;modalGuard();introEvent=null;switching=false;play.disabled=false}
  function launchOriginal(e){if(typeof originalPlay==='function')return originalPlay.call(play,e)}
  function finishIntro(){if(intro.hidden||!switching)return;const e=introEvent;cancelIntro();if(!document.hidden&&game.hidden)launchOriginal(e)}
  if(typeof originalPlay==='function')play.onclick=function(e){
    if(switching||!game.hidden)return;closeHall();K.preload();if(!prefs.intro||motion.matches||typeof V==='undefined'||!V.ok){return launchOriginal(e)}
    switching=true;introEvent=e;play.disabled=true;intro.hidden=false;modalGuard();$('#kingdom-intro-skip').focus({preventScroll:true});// In the native-media route, retain a real second gesture for Safari.
    let media=false;try{media=window.ArenaAudio?.stats?.().mode==='media'}catch(_){}
    if(!media)introTimer=setTimeout(finishIntro,1650);
  };
  $('#kingdom-intro-skip').addEventListener('click',finishIntro);
  let rewardFrame=0,shownResult=false;const reward=$('#kingdom-reward'), count=$('#kingdom-reward-count');
  function rewardUpdate(){
    if(res.hidden){shownResult=false;if(rewardFrame)cancelAnimationFrame(rewardFrame);rewardFrame=0;return}if(shownResult)return;shownResult=true;
    const result=$('#rt').textContent;res.dataset.result=result.includes('ПОБЕДА')?'win':result.includes('ПОРАЖЕНИЕ')?'loss':'draw';const m=$('#rp').textContent.match(/\+(\d+)\s*осколк/i),n=m?Number(m[1]):0;reward.hidden=!m;if(!m)return;reward.setAttribute('aria-label',`Получено ${n} осколков`);
    if(motion.matches||document.hidden){count.textContent='+'+n;return}const start=performance.now();count.textContent='+0';function tick(now){if(res.hidden)return;const k=Math.min(1,(now-start)/650);count.textContent='+'+Math.round(n*(1-(1-k)**3));if(k<1)rewardFrame=requestAnimationFrame(tick);else rewardFrame=0}rewardFrame=requestAnimationFrame(tick);
  }
  const obs=new MutationObserver(()=>{if(!game.hidden){closeHall();if(!intro.hidden)cancelIntro()}rewardUpdate()});obs.observe(game,{attributes:true,attributeFilter:['hidden']});obs.observe(res,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!hall.hidden){e.preventDefault();closeHall()}else if(!intro.hidden){e.preventDefault();cancelIntro()}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){closeHall();if(!intro.hidden)cancelIntro();if(rewardFrame){cancelAnimationFrame(rewardFrame);rewardFrame=0;const m=$('#rp').textContent.match(/\+(\d+)\s*осколк/i);if(m)count.textContent='+'+m[1]}}});
  addEventListener('pagehide',()=>{closeHall();if(!intro.hidden)cancelIntro()});
  window.CDKingdomUI={stats:()=>({hall:!hall.hidden,intro:!intro.hidden,viewer:!!viewer,live:stage.dataset.live==='1',item:item.id,rotating,reward:count.textContent})};
})();
