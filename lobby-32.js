'use strict';
// Living Sanctuary: entirely visual layer. Never writes battle state, deck, currency or progression.
(() => {
  const $=s=>document.querySelector(s), app=$('#app'), stage=$('#lobby-stage'), game=$('#game'), main=app.querySelector('main');
  if(!stage || !game) return;
  const modes=['auto','full','light','static'], modeKey='cd-lobby-quality-v32', musicKey='cd-lobby-music-v32';
  function stored(k, fallback){try{return localStorage.getItem(k) ?? fallback}catch(_){return fallback}}
  function write(k,v){try{localStorage.setItem(k,v)}catch(_){}}
  const motion=matchMedia('(prefers-reduced-motion: reduce)'), requested=new URLSearchParams(location.search).get('lobby');
  let preference=stored(modeKey,'auto');if(!modes.includes(preference))preference='auto';
  if(modes.includes(requested))preference=requested;
  let musicEnabled=stored(musicKey,'on')!=='off', interacted=false, blocked=false, inView=true, state=null, ticket=0, starting=false, frameID=0, greeting=0, greetTimer=0;
  let menuVisible=false, active=false;
  const quality=$('#lobby-quality'), note=$('#lobby-quality-note'), musicButton=$('#lobby-music');quality.value=preference;
  const live=$('#lobby-live3d'), motes=$('#lobby-motes'), squad=$('#lobby-squad');
  const soundButton=app.querySelector('header [data-sound]');
  const music=new Audio('sanctuary-ambient.mp3');music.loop=true;music.preload='none';music.volume=.27;
  function masterOn(){return soundButton?.getAttribute('aria-pressed')!=='false' && stored('ba_audio_v27','on')!=='off'}
  function syncMusic(){
    musicButton.textContent=musicEnabled?'Включена':'Выключена';musicButton.setAttribute('aria-pressed',String(musicEnabled));
    if(interacted && menuVisible && musicEnabled && masterOn()) {if(music.paused)music.play().catch(()=>{});} else if(!music.paused)music.pause();
  }
  document.addEventListener('pointerdown',e=>{if(!e.isTrusted)return;interacted=true;syncMusic()},{passive:true});
  document.addEventListener('keydown',e=>{if(!e.isTrusted)return;interacted=true;syncMusic()});
  musicButton.addEventListener('click',()=>{musicEnabled=!musicEnabled;write(musicKey,musicEnabled?'on':'off');interacted=true;syncMusic()});
  if(soundButton)new MutationObserver(syncMusic).observe(soundButton,{attributes:true,attributeFilter:['aria-pressed']});
  // Small bounded set of CSS particles; never a continuously running JS particle loop.
  let seed=8732;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<20;i++){const p=document.createElement('i');for(const [k,v] of Object.entries({'--x':`${8+84*rand()}%`,'--y':`${34+48*rand()}%`,'--s':`${(1.5+2*rand()).toFixed(1)}px`,'--t':`${(6+6*rand()).toFixed(1)}s`,'--delay':`${(-12*rand()).toFixed(1)}s`,'--dx':`${(-32+64*rand()).toFixed(1)}px`}))p.style.setProperty(k,v);motes.append(p)}
  const ids=['guard','archer','colossus','imp','mage','hounds','swarm','brute','meteor','spark'];
  const role={guard:'Крепкий защитник',archer:'Двое стрелков, бьют издалека',colossus:'Очень прочный, атакует только сооружения',imp:'Быстро бежит и взрывается',mage:'Огненный шар бьёт по площади',hounds:'Три быстрых зверя',swarm:'Четыре маленьких голема',brute:'Сильный и выносливый боец',meteor:'Удар по большой области',spark:'Молния по небольшой области'};
  function syncSquad(){const fragment=document.createDocumentFragment();for(const el of $('#deck').querySelectorAll('[data-id]')){const id=el.dataset.id,i=ids.indexOf(id);if(i<0)continue;const token=document.createElement('span');token.className='squad-token';token.style.backgroundPosition=`${(i%5)*25}% ${i<5?0:100}%`;const name=el.querySelector('.rune-name')?.textContent||id;token.title=name;token.setAttribute('role','img');token.setAttribute('aria-label',name);fragment.append(token)}squad.replaceChildren(fragment)}
  new MutationObserver(syncSquad).observe($('#deck'),{childList:true,subtree:true});syncSquad();
  $('#lobby-edit').addEventListener('click',()=>app.querySelector('nav [data-t="cards"]').click());
  $('#cards').addEventListener('click',e=>{const el=e.target.closest('[data-id]');if(!el||!role[el.dataset.id])return;const name=el.querySelector('.rune-name')?.textContent||el.dataset.id;$('#lobby-rune-info').textContent=`${name} — ${role[el.dataset.id]}.`});
  const help=$('#lobby-help'),rules=$('#lobby-rules');help.addEventListener('click',()=>{rules.hidden=!rules.hidden;help.setAttribute('aria-expanded',String(!rules.hidden));if(!rules.hidden)rules.scrollIntoView({block:'nearest',behavior:motion.matches?'auto':'smooth'})});
  function pulse(){greeting=performance.now();stage.classList.remove('blessed');void stage.offsetWidth;stage.classList.add('blessed');$('#lobby-whisper').textContent='Хранитель приветствует тебя';clearTimeout(greetTimer);greetTimer=setTimeout(()=>{stage.classList.remove('blessed');$('#lobby-whisper').textContent='Святилище ждёт тебя'},2100);}
  $('#lobby-bless').addEventListener('click',pulse);
  // A very small pointer-driven parallax; no orientation permission or motion sensor.
  stage.addEventListener('pointermove',e=>{
    if(!active||!['auto','full'].includes(effective())||e.pointerType==='touch')return;
    const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;
    stage.style.setProperty('--pan-x',`${Math.max(-4,Math.min(4,((e.clientX-r.left)/r.width-.5)*8))}px`);
    stage.style.setProperty('--pan-y',`${Math.max(-4,Math.min(4,((e.clientY-r.top)/r.height-.5)*8))}px`);
  },{passive:true});
  stage.addEventListener('pointerleave',()=>{stage.style.removeProperty('--pan-x');stage.style.removeProperty('--pan-y')});
  function effective(){if(motion.matches||preference==='static')return 'static';if(preference==='light'||blocked)return 'light';if(preference==='full')return 'full';return (navigator.hardwareConcurrency<=2 || (navigator.deviceMemory && navigator.deviceMemory<=2))?'light':'auto'}
  function refresh(){
    menuVisible=!document.hidden&&game.hidden&&$('#res').hidden;
    active=menuVisible&&$('#battle').classList.contains('on')&&inView;
    const mode=effective();app.dataset.menuVisible=menuVisible?'1':'0';app.dataset.lobbyActive=active?'1':'0';app.dataset.lobbyMode=mode;
    note.textContent=motion.matches?'Включено системное уменьшение движения.':blocked&&preference==='full'?'3D недоступно или слишком тяжёлое. Включён лёгкий режим.':mode==='full'?'3D только на главном экране; в бою выгружается.':mode==='static'?'Движение отключено.':mode==='light'?'Минимум эффектов и расхода энергии.':'Многослойная анимация без дополнительного WebGL.';
    if(!active||mode==='static'||mode==='light'){stage.style.removeProperty('--pan-x');stage.style.removeProperty('--pan-y')}
    if(active&&mode==='full'){if(!state&&!starting)start3D()}else stop3D();
    syncMusic();
  }
  quality.addEventListener('change',()=>{preference=quality.value;write(modeKey,preference);blocked=false;refresh()});
  const observer=new MutationObserver(refresh);observer.observe(game,{attributes:true,attributeFilter:['hidden']});observer.observe($('#res'),{attributes:true,attributeFilter:['hidden']});observer.observe($('#battle'),{attributes:true,attributeFilter:['class']});
  app.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{main.scrollTop=0;refresh()}));
  document.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>{music.pause();stop3D()});window.addEventListener('pageshow',refresh);
  if(motion.addEventListener)motion.addEventListener('change',refresh);else motion.addListener(refresh);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;refresh()},{threshold:.04}).observe(stage);
  // One additional transparent canvas, only when explicitly requested. Reuse the game's shared
  // CPU mesh library; do not dispose its shared geometry/materials when leaving the menu.
  function stop3D(){
    if(!state&&!starting)return;ticket++;starting=false;
    if(frameID)cancelAnimationFrame(frameID);frameID=0;
    const s=state;state=null;stage.dataset.live='0';
    if(s){try{s.rig?.dispose();if(s.crystal)ArenaArt3D.disposeTree(s.crystal.root);s.renderer.dispose();s.renderer.forceContextLoss()}catch(_){}s.renderer.domElement.remove()}
    live.replaceChildren();
  }
  function fallback(){blocked=true;stop3D();refresh()}
  async function start3D(){
    starting=true;const mine=++ticket;
    try{
      if(typeof THREE==='undefined'||typeof ArenaArt3D==='undefined'||!ArenaArt3D||typeof ArenaCharacterModels==='undefined'||!ArenaCharacterModels)throw Error('3D library unavailable');
      await ArenaCharacterModels.preload();if(mine!==ticket||!active||effective()!=='full')return;
      const A=ArenaArt3D,T=THREE,renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      const s={renderer,scene:new T.Scene(),camera:new T.OrthographicCamera(-50,50,65,-65,.1,500),crystal:null,rig:null,guardian:null,w:0,h:0,last:0,age:0,slow:0,samples:0,work:0,interval:0};state=s;
      renderer.setPixelRatio(Math.min(1.35,devicePixelRatio||1));renderer.setClearColor(0,0);renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
      s.camera.position.set(0,0,160);s.camera.lookAt(0,0,0);
      s.scene.add(new T.HemisphereLight(A.lin('#d9c7fa'),A.lin('#57496f'),.95));const key=new T.DirectionalLight(A.lin('#ffe3b6'),1.5);key.position.set(-30,50,65);s.scene.add(key);const rim=new T.DirectionalLight(A.lin('#72e5ff'),.95);rim.position.set(65,25,-50);s.scene.add(rim);
      s.crystal=A.crystal(s.scene,0,0,0,0,27,46,false);s.guardian=new T.Group();s.scene.add(s.guardian);s.rig=ArenaCharacterModels.instantiate('colossus',0,s.guardian,{shadows:false});s.guardian.rotation.y=-.34;
      // Render before showing the canvas, so transparent-image fallback is never missing while loading.
      live.replaceChildren(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(state===s)fallback()},{once:true});
      if(!draw(s,performance.now(),true))throw Error('3D frame unavailable');stage.dataset.live='1';starting=false;
      function tick(now){if(state!==s||!active)return;frameID=requestAnimationFrame(tick);if(now-s.last<31)return;try{draw(s,now,false)}catch(_){fallback()}}
      frameID=requestAnimationFrame(tick);
    }catch(e){if(mine===ticket){console.warn('Living Sanctuary uses 2.5D:',e.message);fallback()}}
    finally{if(mine===ticket)starting=false}
  }
  function draw(s,now,first){
    const w=stage.clientWidth,h=stage.clientHeight;if(w<2||h<2)return false;
    if(s.w!==w||s.h!==h){s.w=w;s.h=h;s.renderer.setSize(w,h,false);const H=100*h/w;s.camera.left=-50;s.camera.right=50;s.camera.top=H/2;s.camera.bottom=-H/2;s.camera.updateProjectionMatrix();s.H=H;}
    const elapsed=s.last?now-s.last:33,dt=Math.min(.12,elapsed/1000);s.last=now;s.age+=dt;
    const H=s.H,cr=s.crystal.root;cr.position.set(0,H*.09+Math.sin(s.age*.8)*1.7,0);cr.rotation.y=s.age*.38+.4;const scale=Math.min(1,H*.32/46);cr.scale.setScalar(scale);
    const hello=greeting&&now-greeting<950?Math.sin(Math.PI*(now-greeting)/950):0;
    s.guardian.position.set(23,-H*.12+hello*2,0);s.guardian.scale.setScalar(Math.min(.95,H*.25/38));s.guardian.rotation.y=-.35+.12*Math.sin(s.age*.7)+hello*.55;s.rig.pose('Idle',dt,.8);
    const begin=performance.now();s.renderer.render(s.scene,s.camera);s.work+=performance.now()-begin;s.interval+=elapsed;s.samples++;
    if(!first&&s.samples>=45){const poor=s.work/s.samples>25||s.interval/s.samples>66;s.slow=poor?s.slow+1:Math.max(0,s.slow-1);s.samples=0;s.work=0;s.interval=0;if(s.slow>=2){fallback();return false}}
    return true;
  }
  refresh();
})();
