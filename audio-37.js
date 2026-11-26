'use strict';
/* Living Battlefield 3.3.2 — bounded voices, rate-limited audio and Safari recovery.
   Keeps the public ArenaAudio.begin/frame/ui API and the 3.1 master-sound key.
   Audio reads the simulation only. No combat values, timers or saves are mutated. */
window.ArenaAudio = (() => {
  const AC=window.AudioContext||window.webkitAudioContext, $=s=>document.querySelector(s);
  const game=$('#game'), pause=$('#pausemenu'), masterButtons=[...document.querySelectorAll('[data-sound]')];
  const statusNodes=[...document.querySelectorAll('[data-audio-status]')], modeNodes=[...document.querySelectorAll('[data-audio-mode]')];
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
  let pageGone=false, lastStatus='', lastPreference='', statusWrites=0, denied=0, soundAttempts=0;
  let primeAt=-10000, gestureAt=-10000, controlAt=-10000, stepAt=-10000, quiet=false;
  const normalStarts=[], criticalStarts=[], nativeTimers=new Set();
  let profile=read('cd-audio-profile-37','auto');const profileSelect=$('#imperial-audio-profile');if(!['auto','low','balanced','full'].includes(profile))profile='auto';const queryProfile=new URLSearchParams(location.search).get('sound');if(['auto','low','balanced','full'].includes(queryProfile))profile=queryProfile;
  const perfLevel=()=>Math.min(window.CDPerformance?.level?.()??1,profile==='low'?0:profile==='balanced'?1:2);
  if(profileSelect){profileSelect.value=profile;profileSelect.addEventListener('change',()=>{profile=profileSelect.value;write('cd-audio-profile-37',profile);clearBudget();stopLoops();stopVoices();refresh()})}
  let duckUntil=0,ducked=false;function duck(){if(!ctx||nativeMode()||!buses.music)return;duckUntil=Math.max(duckUntil,ctx.currentTime+.8);if(!ducked){ducked=true;gain(buses.music,cfg.music/100*2.8*.48,.075)}}
  function unduck(force=false){if(ducked&&(force||ctx.currentTime>=duckUntil)){ducked=false;duckUntil=0;gain(buses.music,cfg.music/100*2.8,.20)}}
  function budget(now,priority,ui){
    if(ui)return true;
    if(priority>=5){soundAttempts++;return true} // rare mission-critical cues get reserved voices
    const media=nativeMode(), eco=perfLevel()===0;
    const cap=media?(eco?3:6):(eco?6:perfLevel()===1?10:12);
    const q=priority>=3?criticalStarts:normalStarts, limit=priority>=3?5:cap;
    while(q.length&&now-q[0]>=1000)q.shift();
    if(q.length>=limit){denied++;return false}
    q.push(now);soundAttempts++;return true;
  }
  function clearBudget(){normalStarts.length=0;criticalStarts.length=0;controlAt=-10000;stepAt=-10000;quiet=false;}
  const isBattle=()=>!!current && game && !game.hidden;
  const suspended=()=>pageGone||document.hidden||!isBattle()||!!current?.paused||!!(pause&&!pause.hidden);
  const showStatus=()=>{
    const detail=nativeMode()?`Совместимый звук · ${nativeError?'не удалось запустить: '+nativeError:'обычный аудиоплеер'}`:!AC?'Web Audio недоступен':ctx?.state==='running'?`Web Audio активен · ${loaded.sfx?'эффекты готовы':'резервные эффекты'} · ${['theme','drums','ambient'].filter(k=>loaded[k]).length}/3 дорожек`:ctx?`Web Audio: ${ctx.state} · коснись «Проверить звук»`:'Звук ожидает касания';
    const message=(!enabled?'Звук выключен':detail)+(testMessage?' · '+testMessage:'');
    if(message!==lastStatus){lastStatus=message;statusWrites++;for(const el of statusNodes)el.textContent=message}
    if(preference!==lastPreference){lastPreference=preference;for(const el of modeNodes)el.value=preference}
  };
  const mediaVolume=(el,v)=>{try{el.volume=clamp(v,0,1)}catch(_){}el.muted=v<=0};
  function stopNativeMusic(preservePrime=false){if(preservePrime&&nativeMusic._priming)return;if(nativeMusic.paused&&!nativeMusicPending&&!nativeMusic._priming)return;nativeMusic._primeToken=(nativeMusic._primeToken||0)+1;nativeMusic._priming=false;nativeMusicPending=false;nativeMusicTry=-10000;nativeMusic.pause()}
  function stopNativeEffects(){nativeEpoch++;for(const timer of nativeTimers)clearTimeout(timer);nativeTimers.clear();for(const el of mediaPool){if(!el._busy&&!el._priming&&el.paused)continue;el._token=(el._token||0)+1;el._busy=false;el._priming=false;el.pause()}}
  // The browser grants playback permission per media element on some iOS versions.
  // Prime a bounded pool in the actual touch/click event, using a genuinely silent clip.
  function primeNative(){
    if(!clips._silent||!enabled||performance.now()-primeAt<700)return;primeAt=performance.now();
    while(mediaPool.length<3){const el=new Audio();el.preload='none';el._busy=false;el._token=0;el.addEventListener('ended',()=>{el._busy=false});mediaPool.push(el)}
    for(const el of mediaPool){if(el._primed||el._priming||el._busy)continue;el._priming=true;const token=++el._token;el.src=clips._silent;el._clipKey='_silent';mediaVolume(el,1);try{Promise.resolve(el.play()).then(()=>{if(token===el._token){el._primed=true;el._priming=false;el.pause()}}).catch(()=>{if(token===el._token){el._primed=false;el._priming=false}})}catch(_){el._priming=false;el._primed=false}}
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
      const busy=mediaPool.filter(e=>e._busy&&!e.ended).length;
      let el=null;
      if(ui||priority>=3||busy<2)el=mediaPool.find(e=>(!e._busy||e.ended)&&e._clipKey===key)||mediaPool.find(e=>!e._busy||e.ended);
      if(!el&&priority>=2){for(const candidate of mediaPool){if(!candidate._busy||candidate.ended)continue;if(!el||(candidate._priority||0)<(el._priority||0))el=candidate}if(el&&(el._priority||0)>=priority&&!ui)el=null}
      if(!el)return;
      const token=++el._token;el.pause();el._priming=false;el._busy=true;el._priority=priority;
      if(el._clipKey!==key){el.src=clips[key];el._clipKey=key}else{try{el.currentTime=0}catch(_){}}
      mediaVolume(el,Math.min(1,vol*2.6*cfg[bus]/100));
      try{Promise.resolve(el.play()).then(()=>{if(token===el._token){el._primed=true;el._priming=false;const hadError=!!nativeError;nativeError='';nativeStarts++;counts[key]=(counts[key]||0)+1;if(hadError)showStatus()}}).catch(e=>{if(token===el._token){el._busy=false;nativeError=e.name||'play';showStatus()}})}catch(e){el._busy=false;nativeError=e.name||'play';showStatus()}
    };
    if(delay>0){if(nativeTimers.size>=4){denied++;return false}const timer=setTimeout(()=>{nativeTimers.delete(timer);run()},Math.min(250,delay*1000));nativeTimers.add(timer);return true}run();return true;
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
    if(gesture&&nativeMode()){primeNative();}
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
      if(gesture&&ctx.state!=='running'){try{const b=ctx.createBuffer(1,1,22050),n=ctx.createBufferSource();n.buffer=b;n.connect(main);n.onended=()=>n.disconnect();n.start(0)}catch(_){}}
      if(!isBattle()||(!loaded.sfx&&!loading&&!loadFail))prepare();
    }catch(e){nativeError=e.name||'AudioContext';autoFallback=true;stopLoops();stopVoices();if(gesture)primeNative();refresh();showStatus()}
  }
  function decode(bytes){return new Promise((resolve,reject)=>{try{const p=ctx.decodeAudioData(bytes,resolve,reject);if(p&&typeof p.then==='function')p.then(resolve,reject)}catch(e){reject(e)}})}
  async function prepare(){
    if(!ctx||loading||(loaded.sfx&&loaded.theme&&loaded.drums&&loaded.ambient))return loading;
    const now=performance.now();
    const get=async path=>{const controller=typeof AbortController!=='undefined'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),12000):0;try{const r=await fetch(path,controller?{signal:controller.signal}:{});if(!r.ok)throw Error(path+' HTTP '+r.status);return path.endsWith('.json')?await r.json():await r.arrayBuffer()}finally{clearTimeout(timer)}};
    const dec=async path=>decode(await get(path));
    const jobs=[];
    const task=(k,fn)=>{if(loaded[k]||now-(lastDecode[k]??-10000)<5000)return;lastDecode[k]=now;jobs.push(async()=>{if(nativeMode())return;try{loaded[k]=await fn();delete loadErrors[k];loadFail=Object.keys(loadErrors).length>0;refresh();showStatus()}catch(e){loadErrors[k]=String(e.message||e);loadFail=true;showStatus()}})};
    task('sfx',async()=>{let map,sfx;try{[map,sfx]=await Promise.all([get('battle-sfx-37.json'),dec('battle-sfx-37.wav')])}catch(_){[map,sfx]=await Promise.all([get('battle-sfx-33.json'),dec('battle-sfx-33.wav')])};for(const list of Object.values(map))for(const [start,duration] of list)if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<=0||start+duration>sfx.duration+.02)throw Error('Invalid sample atlas');loaded.map=map;return sfx});
    task('theme',()=>dec('battle-theme-33.mp3'));task('drums',()=>dec('battle-tension-33.mp3'));task('ambient',()=>dec('battle-ambience-37.mp3').catch(()=>dec('battle-ambience-33.mp3')));
    if(!jobs.length)return;
    loading=(async()=>{for(const job of jobs)await job()})().finally(()=>{loading=null;refresh();showStatus()});return loading;
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
    if(!ui&&priority===0&&(nativeMode()||perfLevel()===0))return false;
    if(!ui&&priority<3&&now-prev<(priority===0?.24:nativeMode()?.14:.085))return false;
    if(!budget(performance.now(),priority,ui))return false;
    if(nativeMode()){lastSound.set(key,now);return nativePlay(key,vol,bus,priority,ui,delay)}
    const cap=perfLevel()===0?5:perfLevel()===1?7:8;
    const limit=ui||priority>=3?cap:cap-2;
    if(playing.size>=limit){let victim=null;for(const v of playing)if(!victim||v.priority<victim.priority)victim=v;if(!victim||victim.priority>=priority)return false;kill(victim)}
    if(priority===0&&playing.size>=3)return false;
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
      if(priority>=4&&!ui)duck();const v={node,g,pan,priority};playing.add(v);node.onended=()=>remove(v);lastSound.set(key,now);counts[key]=(counts[key]||0)+1;return true;
    }catch(_){try{node?.disconnect();g.disconnect();pan?.disconnect()}catch(_){}return false}
  }
  function stopLoops(preservePrime=false){unduck(true);stopNativeMusic(preservePrime);for(const item of loops){const n=item.node;try{n.stop();n.disconnect()}catch(_){}}loops=[];if(tension)gain(tension,0)}
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
  function refresh(){if(!enabled||pageGone||document.hidden||(isBattle()&&suspended())){if(!quiet){quiet=true;stopLoops();stopVoices()}}else{quiet=false;if(!isBattle()||current?.done){stopLoops(!isBattle()&&enabled&&!document.hidden)}else startLoops()}}
  for(const b of masterButtons)b.addEventListener('click',()=>{enabled=!enabled;write(masterKey,enabled?'on':'off');sync();if(enabled){unlock(true);play('ui',{priority:2,ui:true,vol:.12})}refresh()});
  for(const e of document.querySelectorAll('[data-audio-mix]'))e.addEventListener('input',()=>{const k=e.dataset.audioMix;if(names.includes(k))cfg[k]=clamp(Number(e.value)||0,0,100);else if(k==='vibration')cfg.vibration=e.checked;write(cfgKey,JSON.stringify(cfg));sync();refresh()});
  for(const b of document.querySelectorAll('[data-audio-reset]'))b.addEventListener('click',()=>{cfg={...defaults};write(cfgKey,JSON.stringify(cfg));sync()});
  sync();
  function gesture(e){if(!e.isTrusted)return;if(e.type==='pointerdown'&&e.pointerType!=='mouse')return;
    // Native media is primed only when the compatibility route is in use.
    const now=performance.now();if((nativeMode()||ctx?.state==='running')&&now-gestureAt<250)return;gestureAt=now;unlock(true);
  }
  for(const type of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(type,gesture,{capture:true,passive:true});
  for(const e of document.querySelectorAll('[data-audio-mode]'))e.addEventListener('change',()=>{preference=e.value==='media'?'media':'auto';write('cd-battle-audio-mode-331',preference);autoFallback=false;clearTimeout(resumeTimer);stopLoops();stopVoices();lastSound.clear();clearBudget();testMessage='';nativeError='';unlock(true);if(!nativeMode())prepare();sync();refresh()});
  for(const b of document.querySelectorAll('[data-audio-test]'))b.addEventListener('click',()=>{
    enabled=true;write(masterKey,'on');if(!cfg.sfx){cfg.sfx=80;write(cfgKey,JSON.stringify(cfg))}testMessage='должен прозвучать колокол';nativeError='';lastSound.delete('guardian');unlock(true);if(!nativeMode())prepare();sync();
    if(!play('guardian',{priority:6,ui:true,vol:.65})){setTimeout(()=>{if(!play('guardian',{priority:6,ui:true,vol:.65})){testMessage='нет доступа к звуку — выбери совместимый режим и повтори';showStatus()}},450)}
    showStatus();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(resumeTimer);stopLoops();stopVoices()}else{refresh();showStatus()}});
  addEventListener('pagehide',()=>{pageGone=true;stopLoops();stopVoices()});addEventListener('pageshow',()=>{pageGone=false;refresh()});
  if(game&&pause){const o=new MutationObserver(()=>{if(game.hidden){current=null;stopLoops();stopVoices()}else refresh()});o.observe(game,{attributes:true,attributeFilter:['hidden']});o.observe(pause,{attributes:true,attributeFilter:['hidden']})}
  const hand=$('#hand');if(hand)hand.addEventListener('click',e=>{if(e.target.closest('.card'))ui('click')},{passive:true});
  function ui(kind){unlock();const key=kind==='error'?'error':kind==='unlock'||kind==='upgrade'?'upgrade':'ui';if(kind==='error')vibrate(12);play(key,{priority:2,ui:true,vol:key==='upgrade'?.23:.16})}
  function begin(state){stopLoops();stopVoices();current=state||null;ended=false;seen=new WeakSet();stepped=new WeakMap();lastUnits=new Set();evi=0;shrineOwner=-1;shrineTick=-1;lastMix=0;intensity=0;lastSound.clear();clearBudget();unlock();startLoops();play('start',{priority:3,vol:.31})}
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
    if(suspended()){if(!quiet){quiet=true;stopLoops();stopVoices()}return}quiet=false;
    const wall=performance.now();if(!state.done&&wall-controlAt>=220){controlAt=wall;startLoops()}
    const now=nativeMode()?performance.now()/1000:ctx?.currentTime||0, events=state.ev||[], units=state.u||[];
    while(evi<events.length)event(events[evi++]);
    for(const f of state.fx||[])if(!seen.has(f)){seen.add(f);fx(f)}
    unduck();
    if(!state.done){
      const sh=state.shrine;if(sh){if(sh.owner!==shrineOwner){if(sh.owner>=0)play('shrine',{vol:.34,priority:3});shrineOwner=sh.owner}const tick=Math.ceil(sh.next);if(tick>=1&&tick<=5&&tick!==shrineTick)play('tick',{vol:.19,priority:3});shrineTick=tick}
      if(wall-stepAt>=200){stepAt=wall;if(ready()&&!nativeMode()&&perfLevel()>0){const live=new Set(units.filter(u=>u.hp>0));
        for(const u of lastUnits)if(!live.has(u)&&!u.boom)play('death',{...pos(u),vol:.10,priority:0,bus:'voice'});
        // At most one footstep per 200 ms control tick. No footsteps in compatibility/eco modes.
        let emitted=0;for(const u of units){if(emitted>=1||!u.moving||u.hp<=0||now<(stepped.get(u)||0))continue;const interval=u.big?.65:.75;stepped.set(u,now+interval);if(play(feet(u.id),{...pos(u),vol:u.big?.12:.075,priority:0}))emitted++}
      lastUnits=live;}else if(lastUnits.size)lastUnits.clear();}
      if(!nativeMode()&&now-lastMix>.23){lastMix=now;const n=units.filter(u=>u.attacking&&u.hp>0).length;const danger=(state.tw||[]).some(t=>t.king&&t.hp<t.max*.35);intensity=clamp(.08+n*.045+(danger?.23:0)+(state.t<=60?.58:0),0,1);gain(tension,intensity,.48)}
    }
    if(state.done&&!ended){ended=true;stopLoops();play(state.result>0?'win':state.result<0?'lose':'draw',{priority:6,vol:.48});}
  }
  return {begin(state){destroyed=new WeakSet();oldBegin(state)},frame,ui,stop(){current=null;stopLoops();stopVoices()},stats(){return{loaded:!!loaded.sfx&&!!loaded.theme&&!!loaded.drums&&!!loaded.ambient,bank:!!loaded.sfx,tracks:['theme','drums','ambient'].filter(k=>!!loaded[k]),loadFail,loadErrors:{...loadErrors},enabled,mode:nativeMode()?'media':'web',settings:{...cfg},activeVoices:playing.size+mediaPool.filter(e=>e._busy).length,loops:loops.length,starts,intensity,counts:{...counts},ctx:ctx?.state||'none',nativeStarts,nativeError,statusWrites,denied,profile,ducked,soundAttempts,pendingNative:nativeTimers.size,poolSize:mediaPool.length,normalLastSecond:normalStarts.filter(t=>performance.now()-t<1000).length,criticalLastSecond:criticalStarts.filter(t=>performance.now()-t<1000).length,nativeMusic:!nativeMusic.paused&&nativeMusic.src.endsWith('battle-safe-theme-331.mp3')}}};
})();
