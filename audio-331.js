'use strict';
/* Living Battlefield 3.3.1 — Safari audio recovery, independent decoding and native-media fallback.
   Keeps the public ArenaAudio.begin/frame/ui API and the 3.1 master-sound key.
   Audio reads the simulation only. No combat values, timers or saves are mutated. */
window.ArenaAudio = (() => {
  const AC=window.AudioContext||window.webkitAudioContext, $=s=>document.querySelector(s);
  const game=$('#game'), pause=$('#pausemenu'), masterButtons=[...document.querySelectorAll('[data-sound]')];
  const cfgKey='cd-battle-audio-v33', masterKey='ba_audio_v27', names=['music','sfx','ambient','voice'];
  const defaults={music:30,sfx:80,ambient:25,voice:55,vibration:true};
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback}catch(_){return fallback}};
  const write=(key,v)=>{try{localStorage.setItem(key,v)}catch(_){}};
  let cfg={...defaults};try{const v=JSON.parse(read(cfgKey,'{}'));for(const k of names)if(Number.isFinite(v[k]))cfg[k]=clamp(v[k],0,100);if(typeof v.vibration==='boolean')cfg.vibration=v.vibration}catch(_){}
  let preference=read('cd-battle-audio-mode-331','auto');if(preference!=='media')preference='auto';const requestedMode=new URLSearchParams(location.search).get('audio');if(requestedMode==='auto'||requestedMode==='media')preference=requestedMode;
  let autoFallback=false,resumeTimer=0,loadErrors={},lastDecode={},testMessage='',nativeError='',nativeStarts=0,nativeEpoch=0;
  const clips=window.CD331Clips||{}, mediaPool=[], nativeMusic=new Audio();
  nativeMusic.preload='none';nativeMusic.loop=true;nativeMusic.src='battle-safe-theme-331.mp3';
  let nativeMusicPending=false,nativeMusicTry=-10000;
  const nativeMode=()=>preference==='media'||autoFallback;
  let enabled=read(masterKey,'on')!=='off', ctx=null, main=null, buses={}, tension=null, loaded={}, loading=null, loadFail=false;
  let lastLoadAttempt=0;
  let current=null, ended=false, seen=new WeakSet(), stepped=new WeakMap(), lastUnits=new Set(), evi=0, shrineOwner=-1, shrineTick=-1;
  let loops=[], lastMix=0, intensity=0, playing=new Set(), lastSound=new Map(), variants=new Map(), counts={}, starts=0;
  let pageGone=false;
  const isBattle=()=>!!current && game && !game.hidden;
  const suspended=()=>pageGone||document.hidden||!isBattle()||!!current?.paused||!!(pause&&!pause.hidden);
  const showStatus=()=>{
    const detail=nativeMode()?`Совместимый звук · ${nativeError?'не удалось запустить: '+nativeError:'обычный аудиоплеер'}`:!AC?'Web Audio недоступен':ctx?.state==='running'?`Web Audio активен · ${loaded.sfx?'эффекты готовы':'резервные эффекты'} · ${['theme','drums','ambient'].filter(k=>loaded[k]).length}/3 дорожек`:ctx?`Web Audio: ${ctx.state} · коснись «Проверить звук»`:'Звук ожидает касания';
    for(const el of document.querySelectorAll('[data-audio-status]'))el.textContent=(!enabled?'Звук выключен':detail)+(testMessage?' · '+testMessage:'');
    for(const el of document.querySelectorAll('[data-audio-mode]'))el.value=preference;
  };
  const mediaVolume=(el,v)=>{try{el.volume=clamp(v,0,1)}catch(_){}el.muted=v<=0};
  function stopNativeMusic(preservePrime=false){if(preservePrime&&nativeMusic._priming)return;nativeMusic._primeToken=(nativeMusic._primeToken||0)+1;nativeMusic._priming=false;nativeMusicPending=false;nativeMusicTry=-10000;nativeMusic.pause()}
  function stopNativeEffects(){nativeEpoch++;for(const el of mediaPool){el._token=(el._token||0)+1;el._busy=false;el._priming=false;el.pause()}}
  // The browser grants playback permission per media element on some iOS versions.
  // Prime a bounded pool in the actual touch/click event, using a genuinely silent clip.
  function primeNative(){
    if(!clips._silent||!enabled)return;
    while(mediaPool.length<6){const el=new Audio();el.preload='none';el._busy=false;el._token=0;el.addEventListener('ended',()=>{el._busy=false});mediaPool.push(el)}
    for(const el of mediaPool){if(el._primed||el._priming||el._busy)continue;el._priming=true;const token=++el._token;el.src=clips._silent;mediaVolume(el,1);try{Promise.resolve(el.play()).then(()=>{if(token===el._token){el._primed=true;el._priming=false;el.pause()}}).catch(()=>{if(token===el._token){el._primed=false;el._priming=false}})}catch(_){el._priming=false;el._primed=false}}
    // Keep the actual music URL on its own element. A direct gesture starts it in battle;
    // while on the menu use a genuinely silent priming clip, then restore the track.
    if(!nativeMusic._primed&&!nativeMusic._priming&&nativeMusic.paused&&!nativeMusicPending){
      nativeMusic._priming=true;const token=nativeMusic._primeToken=(nativeMusic._primeToken||0)+1;
      nativeMusic.src=clips._silent;mediaVolume(nativeMusic,1);
      try{Promise.resolve(nativeMusic.play()).then(()=>{if(token===nativeMusic._primeToken){nativeMusic._primed=true;nativeMusic._priming=false;nativeMusic.pause();nativeMusic.src='battle-safe-theme-331.mp3';nativeMusic.loop=true;if(nativeMode())startNativeMusic()}}).catch(()=>{if(token===nativeMusic._primeToken){nativeMusic._primed=false;nativeMusic._priming=false;nativeMusic.src='battle-safe-theme-331.mp3'}})}catch(_){nativeMusic._primed=false;nativeMusic._priming=false;nativeMusic.src='battle-safe-theme-331.mp3'}
    }
  }
  function nativePlay(key,vol,bus,priority,ui,delay){
    if(!enabled||document.hidden||pageGone||(!ui&&suspended())||cfg[bus]===0||!clips[key]||!mediaPool.length)return false;
    const epoch=nativeEpoch;
    const run=()=>{
      if(epoch!==nativeEpoch||!nativeMode()||!enabled||document.hidden||(!ui&&suspended()))return;
      let el=mediaPool.find(e=>!e._busy||e.ended);if(!el&&priority>=3){el=mediaPool.reduce((a,b)=>(a._priority||0)<=(b._priority||0)?a:b);if((el._priority||0)>=priority)return}
      if(!el)return;
      const token=++el._token;el.pause();el._busy=true;el._priority=priority;el.src=clips[key];mediaVolume(el,Math.min(1,vol*2.6*cfg[bus]/100));
      try{Promise.resolve(el.play()).then(()=>{if(token===el._token){el._primed=true;el._priming=false;nativeError='';nativeStarts++;counts[key]=(counts[key]||0)+1;showStatus()}}).catch(e=>{if(token===el._token){el._busy=false;nativeError=e.name||'play';showStatus()}})}catch(e){el._busy=false;nativeError=e.name||'play';showStatus()}
    };
    if(delay>0){setTimeout(run,Math.min(250,delay*1000));return true}run();return true;
  }
  function startNativeMusic(){
    if(!nativeMode()||!enabled||suspended()||current?.done||!cfg.music){if(!nativeMusic.paused&&!nativeMusicPending)stopNativeMusic();return}
    if((!nativeMusic.paused&&nativeMusic.src.endsWith('battle-safe-theme-331.mp3'))||nativeMusicPending||performance.now()-nativeMusicTry<3000)return;
    nativeMusicTry=performance.now();nativeMusicPending=true;nativeMusic._priming=false;const token=nativeMusic._primeToken=(nativeMusic._primeToken||0)+1;
    if(!nativeMusic.src.endsWith('battle-safe-theme-331.mp3'))nativeMusic.src='battle-safe-theme-331.mp3';
    nativeMusic.loop=true;mediaVolume(nativeMusic,cfg.music/100);
    try{Promise.resolve(nativeMusic.play()).then(()=>{if(token!==nativeMusic._primeToken)return;nativeMusicPending=false;if(!nativeMode()||suspended()||!enabled||!cfg.music||current?.done)nativeMusic.pause();else{nativeMusic._primed=true;nativeError='';showStatus()}}).catch(e=>{if(token!==nativeMusic._primeToken)return;nativeMusicPending=false;nativeError=e.name||'play';showStatus()})}catch(e){nativeMusicPending=false;nativeError=e.name||'play';showStatus()}
  }
  const gain=(node,value,fade=.045)=>{if(!ctx||!node)return;const t=ctx.currentTime;try{node.gain.cancelScheduledValues(t);node.gain.setTargetAtTime(value,t,fade)}catch(_){node.gain.value=value}};
  function sync(){
    for(const b of masterButtons){b.textContent=b.dataset.sound==='icon'?(enabled?'🔊':'🔇'):(enabled?'Звук: вкл':'Звук: выкл');b.setAttribute('aria-pressed',String(enabled));b.setAttribute('aria-label',enabled?'Звук включён':'Звук выключен')}
    for(const e of document.querySelectorAll('[data-audio-mix]')){const k=e.dataset.audioMix;if(names.includes(k)){e.value=String(cfg[k]);const out=e.parentElement.querySelector('output');if(out)out.textContent=cfg[k]+'%'}else if(k==='vibration')e.checked=cfg.vibration}
    if(main)gain(main,enabled?.84:0);
    if(ctx){gain(buses.music,cfg.music/100*2.8);gain(buses.sfx,cfg.sfx/100*1.65);gain(buses.ambient,cfg.ambient/100*1.25);gain(buses.voice,cfg.voice/100)}
    mediaVolume(nativeMusic,cfg.music/100);if(!cfg.music)stopNativeMusic();showStatus();
  }
  function unlock(gesture=false){
    if(!enabled||pageGone)return;
    if(gesture&&nativeMode()){primeNative();nativeMusicTry=-10000;}
    if(nativeMode()){refresh();return}
    if(!AC){autoFallback=true;if(gesture)primeNative();refresh();showStatus();return}
    // Audio creation/resume must happen synchronously inside a trusted tap. A pointerdown
    // on a touchscreen is not sufficient; begin() may run after asynchronous model loading.
    try{
      if(!ctx||ctx.state==='closed'){
        if(!gesture)return;
        ctx=new AC();main=ctx.createGain();main.gain.value=.84;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-15;comp.knee.value=18;comp.ratio.value=5;comp.attack.value=.006;comp.release.value=.22;main.connect(comp);comp.connect(ctx.destination);
        buses={};for(const k of names){buses[k]=ctx.createGain();buses[k].connect(main)}tension=ctx.createGain();tension.gain.value=0;tension.connect(buses.music);sync();
        ctx.onstatechange=()=>{if(ctx.state==='running')refresh();else if(ctx.state!=='closed'){stopLoops();stopVoices()}showStatus()};
      }
      if(ctx.state!=='running'&&gesture){
        const activeContext=ctx;
        try{Promise.resolve(activeContext.resume()).then(()=>{if(ctx===activeContext&&ctx.state==='running'){clearTimeout(resumeTimer);refresh();showStatus()}}).catch(()=>{})}catch(_){}
        clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{if(ctx===activeContext&&ctx.state!=='running'&&enabled&&!pageGone&&!document.hidden){autoFallback=true;stopLoops();stopVoices();refresh();showStatus()}},1300);
      }
      if(gesture){try{const b=ctx.createBuffer(1,1,22050),n=ctx.createBufferSource();n.buffer=b;n.connect(main);n.onended=()=>n.disconnect();n.start(0)}catch(_){}}
      prepare();
    }catch(e){nativeError=e.name||'AudioContext';autoFallback=true;stopLoops();stopVoices();if(gesture)primeNative();refresh();showStatus()}
  }
  function decode(bytes){return new Promise((resolve,reject)=>{try{const p=ctx.decodeAudioData(bytes,resolve,reject);if(p&&typeof p.then==='function')p.then(resolve,reject)}catch(e){reject(e)}})}
  async function prepare(){
    if(!ctx||loading||(loaded.sfx&&loaded.theme&&loaded.drums&&loaded.ambient))return loading;
    const now=performance.now();
    const get=async path=>{const controller=typeof AbortController!=='undefined'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),12000):0;try{const r=await fetch(path,controller?{signal:controller.signal}:{});if(!r.ok)throw Error(path+' HTTP '+r.status);return path.endsWith('.json')?await r.json():await r.arrayBuffer()}finally{clearTimeout(timer)}};
    const dec=async path=>decode(await get(path));
    const jobs=[];
    const task=(k,fn)=>{if(loaded[k]||now-(lastDecode[k]??-10000)<5000)return;lastDecode[k]=now;jobs.push(Promise.resolve().then(fn).then(v=>{loaded[k]=v;delete loadErrors[k];loadFail=Object.keys(loadErrors).length>0;refresh();showStatus()}).catch(e=>{loadErrors[k]=String(e.message||e);loadFail=true;showStatus()}))};
    task('sfx',async()=>{const [map,sfx]=await Promise.all([get('battle-sfx-33.json'),dec('battle-sfx-33.wav')]);for(const list of Object.values(map))for(const [start,duration] of list)if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<=0||start+duration>sfx.duration+.02)throw Error('Invalid sample atlas');loaded.map=map;return sfx});
    task('theme',()=>dec('battle-theme-33.mp3'));task('drums',()=>dec('battle-tension-33.mp3'));task('ambient',()=>dec('battle-ambience-33.mp3'));
    if(!jobs.length)return;
    loading=Promise.all(jobs).finally(()=>{loading=null;refresh();showStatus()});return loading;
  }
  const ready=()=>enabled&&!document.hidden&&!pageGone&&(nativeMode()||!!(ctx&&ctx.state==='running'));
  function vibrate(ms){if(enabled&&cfg.vibration&&navigator.vibrate&&!document.hidden)try{navigator.vibrate(ms)}catch(_){}}
  function remove(v){if(!playing.delete(v))return;try{v.node.disconnect();v.g.disconnect();v.pan?.disconnect()}catch(_){}}
  function kill(v){try{v.node.stop()}catch(_){}remove(v)}
  function stopVoices(){stopNativeEffects();for(const v of [...playing])kill(v);if(navigator.vibrate)try{navigator.vibrate(0)}catch(_){}}
  function play(key,{x=180,y=280,vol=.25,priority=1,delay=0,bus='sfx',ui=false}={}){
    if(!ready()||(!ui&&suspended())||cfg[bus]===0)return false;
    const now=nativeMode()?performance.now()/1000:ctx.currentTime, prev=lastSound.get(key)??-100;
    // Independent per-sound throttles; priority cues can never be suppressed by footsteps.
    if(priority<3&&now-prev<(priority===0?.13:.055))return false;
    if(nativeMode()){lastSound.set(key,now);return nativePlay(key,vol,bus,priority,ui,delay)}
    if(playing.size>=16){let victim=null;for(const v of playing)if(!victim||v.priority<victim.priority)victim=v;if(!victim||victim.priority>=priority)return false;kill(victim)}
    if(priority===0&&playing.size>=9)return false;
    const output=buses[bus]||buses.sfx, g=ctx.createGain();
    const position=ui?0:clamp((x-180)/180,-1,1)*.72, distance=ui?1:1-.26*(1-clamp(y/560,0,1));
    g.gain.value=clamp(vol*distance*1.25,0,1);let pan=null;
    if(typeof ctx.createStereoPanner==='function'){pan=ctx.createStereoPanner();pan.pan.value=position;g.connect(pan);pan.connect(output)}else g.connect(output);
    let node,when=now+clamp(delay,0,.25);
    try{
      const list=loaded.map?.[key];
      if(list?.length){const i=(variants.get(key)||0)%list.length;variants.set(key,i+1);const [start,duration]=list[i];node=ctx.createBufferSource();node.buffer=loaded.sfx;node.connect(g);node.start(when,start,duration)}
      else { // audible independent fallback while the sample atlas is loading or failed
        const f=key==='error'?190:/heavy|meteor|collapse|corefall|stepstone|imp/.test(key)?100:/arrow|spark|metal/.test(key)?900:/step/.test(key)?160:key==='guardian'?392:440;
        const duration=priority>=3?.26:.14;node=ctx.createOscillator();node.type=/metal|arrow|spark/.test(key)?'triangle':'sine';node.frequency.setValueAtTime(f,when);node.frequency.exponentialRampToValueAtTime(Math.max(35,f*(priority>=3?1.45:.45)),when+duration);g.gain.setValueAtTime(Math.max(.005,vol*.32),when);g.gain.exponentialRampToValueAtTime(.001,when+duration);node.connect(g);node.start(when);node.stop(when+duration+.01);
      }
      const v={node,g,pan,priority};playing.add(v);node.onended=()=>remove(v);lastSound.set(key,now);counts[key]=(counts[key]||0)+1;return true;
    }catch(_){try{node?.disconnect();g.disconnect();pan?.disconnect()}catch(_){}return false}
  }
  function stopLoops(preservePrime=false){stopNativeMusic(preservePrime);for(const item of loops){const n=item.node;try{n.stop();n.disconnect()}catch(_){}}loops=[];if(tension)gain(tension,0)}
  function startLoops(){
    if(!ready()||suspended()||current?.done)return;
    if(nativeMode()){startNativeMusic();return}
    try{
      const when=ctx.currentTime+.035,elapsed=Math.max(0,180-(current.t??180));
      for(const [key,bus] of [['theme',buses.music],['drums',tension],['ambient',buses.ambient]]){
        const buf=loaded[key];if(!buf||loops.some(item=>item.key===key))continue;
        const n=ctx.createBufferSource();n.buffer=buf;n.loop=true;n.loopEnd=buf.duration;n.connect(bus);n.start(when,elapsed%buf.duration);loops.push({key,node:n});starts++;
      }
    }catch(e){console.warn('Battle music:',e.message)}
  }
  function refresh(){if(!enabled||pageGone||document.hidden||(isBattle()&&suspended())){stopLoops();stopVoices()}else if(!isBattle()||current?.done){stopLoops(!isBattle()&&enabled&&!document.hidden)}else startLoops()}
  for(const b of masterButtons)b.addEventListener('click',()=>{enabled=!enabled;write(masterKey,enabled?'on':'off');sync();if(enabled){unlock(true);play('ui',{priority:2,ui:true,vol:.12})}refresh()});
  for(const e of document.querySelectorAll('[data-audio-mix]'))e.addEventListener('input',()=>{const k=e.dataset.audioMix;if(names.includes(k))cfg[k]=clamp(Number(e.value)||0,0,100);else if(k==='vibration')cfg.vibration=e.checked;write(cfgKey,JSON.stringify(cfg));sync();refresh()});
  for(const b of document.querySelectorAll('[data-audio-reset]'))b.addEventListener('click',()=>{cfg={...defaults};write(cfgKey,JSON.stringify(cfg));sync()});
  sync();
  function gesture(e){if(!e.isTrusted)return;if(e.type==='pointerdown'&&e.pointerType!=='mouse')return;
    // Native media is primed only when the compatibility route is in use.
    unlock(true);
  }
  for(const type of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(type,gesture,{capture:true,passive:true});
  for(const e of document.querySelectorAll('[data-audio-mode]'))e.addEventListener('change',()=>{preference=e.value==='media'?'media':'auto';write('cd-battle-audio-mode-331',preference);autoFallback=false;clearTimeout(resumeTimer);stopLoops();stopVoices();lastSound.clear();testMessage='';nativeError='';unlock(true);sync();refresh()});
  for(const b of document.querySelectorAll('[data-audio-test]'))b.addEventListener('click',()=>{
    enabled=true;write(masterKey,'on');if(!cfg.sfx){cfg.sfx=80;write(cfgKey,JSON.stringify(cfg))}testMessage='должен прозвучать колокол';nativeError='';lastSound.delete('guardian');unlock(true);sync();
    if(!play('guardian',{priority:6,ui:true,vol:.65})){setTimeout(()=>{if(!play('guardian',{priority:6,ui:true,vol:.65})){testMessage='нет доступа к звуку — выбери совместимый режим и повтори';showStatus()}},450)}
    showStatus();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(resumeTimer);stopLoops();stopVoices()}else{refresh();showStatus()}});
  addEventListener('pagehide',()=>{pageGone=true;stopLoops();stopVoices()});addEventListener('pageshow',()=>{pageGone=false;refresh()});
  if(game&&pause){const o=new MutationObserver(()=>{if(game.hidden){current=null;stopLoops();stopVoices()}else refresh()});o.observe(game,{attributes:true,attributeFilter:['hidden']});o.observe(pause,{attributes:true,attributeFilter:['hidden']})}
  const hand=$('#hand');if(hand)hand.addEventListener('click',e=>{if(e.target.closest('.card'))ui('click')},{passive:true});
  function ui(kind){unlock();const key=kind==='error'?'error':kind==='unlock'||kind==='upgrade'?'upgrade':'ui';if(kind==='error')vibrate(12);play(key,{priority:2,ui:true,vol:key==='upgrade'?.23:.16})}
  function begin(state){stopLoops();stopVoices();current=state||null;ended=false;seen=new WeakSet();stepped=new WeakMap();lastUnits=new Set();evi=0;shrineOwner=-1;shrineTick=-1;lastMix=0;intensity=0;lastSound.clear();unlock();startLoops();play('start',{priority:3,vol:.31})}
  const pos=o=>({x:Number.isFinite(o?.x)?o.x:180,y:Number.isFinite(o?.y)?o.y:280});
  const creature=id=>id==='hounds'?'voicebeast':id==='mage'||id==='imp'?'voicemagic':'voiceguard';
  const feet=id=>id==='guard'?'stepmetal':id==='colossus'||id==='brute'||id==='swarm'?'stepstone':id==='hounds'?'stepbeast':'steplight';
  const strike=id=>id==='colossus'||id==='brute'?'heavy':id==='hounds'?'hound':id==='swarm'?'swarm':'metal';
  function event(e){
    const at=pos(e);
    if(e.type==='cast'&&!e.sp){play('summon',{...at,vol:e.team===0?.22:.15,priority:2});if(e.id!=='swarm')play(creature(e.id),{...at,vol:.14,priority:1,bus:'voice',delay:.10});if(e.team===0)vibrate(9)}
    else if(e.type==='guardian'){play('guardian',{vol:.55,priority:5});vibrate([16,35,16])}
    else if(e.type==='final'){play('final',{vol:.45,priority:5});vibrate([15,40,15])}
    else if(e.type==='rage')play('rage',{vol:.35,priority:3});
    else if(e.type==='tower'){const o=current.tw?.find(t=>t.team===e.team&&!!t.king===!!e.king&&t.hp<=0&&!destroyed.has(t));if(o)destroyed.add(o);play(e.king?'corefall':'collapse',{...pos(o),vol:e.king?.66:.48,priority:5});vibrate(e.king?[40,40,25]:[25,35,20])}
  }
  let destroyed=new WeakSet();const oldBegin=begin;
  function fx(f){const a=pos(f.a),b=pos(f.b);if(f.k==='m'){play(strike(f.a?.id),{...b,vol:f.a?.big?.42:.28,priority:2});return}
    if(f.k==='l'){const tower=f.a?.king!==undefined;play(tower?'towercast':'arrow',{...a,vol:.20,priority:1});play(tower?'towerhit':'arrowhit',{...b,vol:.25,priority:2,delay:tower?.16:.14});return}
    if(f.k!=='c')return;const p=pos(f);switch(f.card){case 'mage':play('firecast',{...a,vol:.22,priority:1});play('firehit',{...p,vol:.35,priority:2,delay:.15});break;case 'meteor':play('meteorcast',{...p,vol:.28,priority:2});play('meteor',{...p,vol:.57,priority:4,delay:.14});vibrate(30);break;case 'spark':play('spark',{...p,vol:.46,priority:3});vibrate(16);break;case 'imp':play('imp',{...p,vol:.42,priority:3});break;case 'shrine':break;default:play('firehit',{...p,vol:.27,priority:2})}
  }
  function frame(state){
    if(!state||!game||game.hidden)return;current=state;
    if(suspended()){stopLoops();stopVoices();return}
    if(!state.done){startLoops();if(ctx&&!nativeMode()&&loadFail&&!loading&&performance.now()-lastLoadAttempt>5000){lastLoadAttempt=performance.now();prepare()}}
    const now=nativeMode()?performance.now()/1000:ctx?.currentTime||0, events=state.ev||[], units=state.u||[];
    for(const f of state.fx||[])if(!seen.has(f)){seen.add(f);fx(f)}
    while(evi<events.length)event(events[evi++]);
    if(!state.done){
      const sh=state.shrine;if(sh){if(sh.owner!==shrineOwner){if(sh.owner>=0)play('shrine',{vol:.34,priority:3});shrineOwner=sh.owner}const tick=Math.ceil(sh.next);if(tick>=1&&tick<=5&&tick!==shrineTick)play('tick',{vol:.19,priority:3});shrineTick=tick}
      const live=new Set(units.filter(u=>u.hp>0));if(ready()){
        for(const u of lastUnits)if(!live.has(u)&&!u.boom)play('death',{...pos(u),vol:.10,priority:0,bus:'voice'});
        // At most two step sounds per frame, closest to the player first. Never a sound per unit per frame.
        let emitted=0;for(const u of units){if(emitted>=2||!u.moving||u.hp<=0||now<(stepped.get(u)||0))continue;const interval=u.id==='hounds'?.25:u.big?.43:.33;stepped.set(u,now+interval);if(play(feet(u.id),{...pos(u),vol:u.big?.12:.075,priority:0}))emitted++}
      }lastUnits=live;
      if(now-lastMix>.23){lastMix=now;const n=units.filter(u=>u.attacking&&u.hp>0).length;const danger=(state.tw||[]).some(t=>t.king&&t.hp<t.max*.35);intensity=clamp(.08+n*.045+(danger?.23:0)+(state.t<=60?.58:0),0,1);gain(tension,intensity,.48)}
    }
    if(state.done&&!ended){ended=true;stopLoops();play(state.result>0?'win':state.result<0?'lose':'draw',{priority:6,vol:.48});}
  }
  return {begin(state){destroyed=new WeakSet();oldBegin(state)},frame,ui,stop(){current=null;stopLoops();stopVoices()},stats(){return{loaded:!!loaded.sfx&&!!loaded.theme&&!!loaded.drums&&!!loaded.ambient,bank:!!loaded.sfx,tracks:['theme','drums','ambient'].filter(k=>!!loaded[k]),loadFail,loadErrors:{...loadErrors},enabled,mode:nativeMode()?'media':'web',settings:{...cfg},activeVoices:playing.size+mediaPool.filter(e=>e._busy).length,loops:loops.length,starts,intensity,counts:{...counts},ctx:ctx?.state||'none',nativeStarts,nativeError,nativeMusic:!nativeMusic.paused&&nativeMusic.src.endsWith('battle-safe-theme-331.mp3')}}};
})();
