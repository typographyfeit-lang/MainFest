'use strict';
/* Living Battlefield 3.3 — local, original sound bank and adaptive score.
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
  let enabled=read(masterKey,'on')!=='off', ctx=null, main=null, buses={}, tension=null, loaded=null, loading=null, loadFail=false;
  let lastLoadAttempt=0;
  let current=null, ended=false, seen=new WeakSet(), stepped=new WeakMap(), lastUnits=new Set(), evi=0, shrineOwner=-1, shrineTick=-1;
  let loops=[], lastMix=0, intensity=0, playing=new Set(), lastSound=new Map(), variants=new Map(), counts={}, starts=0;
  let pageGone=false;
  const isBattle=()=>!!current && game && !game.hidden;
  const suspended=()=>pageGone||document.hidden||!isBattle()||!!current?.paused||!!(pause&&!pause.hidden);
  const gain=(node,value,fade=.045)=>{if(!ctx||!node)return;const t=ctx.currentTime;try{node.gain.cancelScheduledValues(t);node.gain.setTargetAtTime(value,t,fade)}catch(_){node.gain.value=value}};
  function sync(){
    for(const b of masterButtons){b.textContent=b.dataset.sound==='icon'?(enabled?'🔊':'🔇'):(enabled?'Звук: вкл':'Звук: выкл');b.setAttribute('aria-pressed',String(enabled));b.setAttribute('aria-label',enabled?'Звук включён':'Звук выключен')}
    for(const e of document.querySelectorAll('[data-audio-mix]')){const k=e.dataset.audioMix;if(names.includes(k)){e.value=String(cfg[k]);const out=e.parentElement.querySelector('output');if(out)out.textContent=cfg[k]+'%'}else if(k==='vibration')e.checked=cfg.vibration}
    if(main)gain(main,enabled?.84:0);
    if(ctx){gain(buses.music,cfg.music/100*2);gain(buses.sfx,cfg.sfx/100);gain(buses.ambient,cfg.ambient/100*1.25);gain(buses.voice,cfg.voice/100)}
  }
  function unlock(){
    if(!enabled||!AC||pageGone)return;
    try{
      if(!ctx){ctx=new AC();main=ctx.createGain();main.gain.value=.84;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-15;comp.knee.value=18;comp.ratio.value=5;comp.attack.value=.006;comp.release.value=.22;main.connect(comp);comp.connect(ctx.destination);
        for(const k of names){buses[k]=ctx.createGain();buses[k].connect(main)}tension=ctx.createGain();tension.gain.value=0;tension.connect(buses.music);sync();}
      if(ctx.state==='suspended'||ctx.state==='interrupted')Promise.resolve(ctx.resume()).catch(()=>{});
      prepare();
    }catch(e){console.warn('Battlefield audio unavailable:',e.message)}
  }
  async function prepare(){
    if(!ctx||loaded||loading||(loadFail&&performance.now()-lastLoadAttempt<5000))return loading;lastLoadAttempt=performance.now();
    const get=async path=>{const r=await fetch(path);if(!r.ok)throw Error(path+' HTTP '+r.status);return r};
    const dec=async path=>ctx.decodeAudioData(await (await get(path)).arrayBuffer());
    loadFail=false;
    loading=Promise.all([get('battle-sfx-33.json').then(r=>r.json()),dec('battle-sfx-33.wav'),dec('battle-theme-33.mp3'),dec('battle-tension-33.mp3'),dec('battle-ambience-33.mp3')]).then(([map,sfx,theme,drums,ambient])=>{
      for(const variants of Object.values(map))for(const [start,duration] of variants)if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<=0||start+duration>sfx.duration+.02)throw Error('Invalid sample atlas');
      loaded={map,sfx,theme,drums,ambient};refresh();
    }).catch(e=>{loadFail=true;console.warn('Battlefield sound bank:',e.message)}).finally(()=>{loading=null});
    return loading;
  }
  const ready=()=>enabled&&ctx&&ctx.state==='running'&&!document.hidden&&!pageGone;
  function vibrate(ms){if(enabled&&cfg.vibration&&navigator.vibrate&&!document.hidden)try{navigator.vibrate(ms)}catch(_){}}
  function remove(v){if(!playing.delete(v))return;try{v.node.disconnect();v.g.disconnect();v.pan?.disconnect()}catch(_){}}
  function kill(v){try{v.node.stop()}catch(_){}remove(v)}
  function stopVoices(){for(const v of [...playing])kill(v);if(navigator.vibrate)try{navigator.vibrate(0)}catch(_){}}
  function play(key,{x=180,y=280,vol=.25,priority=1,delay=0,bus='sfx',ui=false}={}){
    if(!ready()||(!ui&&suspended())||cfg[bus]===0)return false;
    const now=ctx.currentTime, prev=lastSound.get(key)??-100;
    // Independent per-sound throttles; priority cues can never be suppressed by footsteps.
    if(priority<3&&now-prev<(priority===0?.13:.055))return false;
    if(playing.size>=16){let victim=null;for(const v of playing)if(!victim||v.priority<victim.priority)victim=v;if(!victim||victim.priority>=priority)return false;kill(victim)}
    if(priority===0&&playing.size>=9)return false;
    const output=buses[bus]||buses.sfx, g=ctx.createGain();
    const position=ui?0:clamp((x-180)/180,-1,1)*.72, distance=ui?1:1-.26*(1-clamp(y/560,0,1));
    g.gain.value=clamp(vol*distance,0,1);let pan=null;
    if(typeof ctx.createStereoPanner==='function'){pan=ctx.createStereoPanner();pan.pan.value=position;g.connect(pan);pan.connect(output)}else g.connect(output);
    let node,when=now+clamp(delay,0,.25);
    try{
      const list=loaded?.map[key];
      if(list?.length){const i=(variants.get(key)||0)%list.length;variants.set(key,i+1);const [start,duration]=list[i];node=ctx.createBufferSource();node.buffer=loaded.sfx;node.connect(g);node.start(when,start,duration)}
      else if(priority>=2||ui){ // quiet fallback for important events if decoding is unavailable
        node=ctx.createOscillator();node.type='sine';node.frequency.setValueAtTime(key==='error'?190:key==='guardian'?392:440,when);node.frequency.exponentialRampToValueAtTime(key==='error'?110:660,when+.13);g.gain.value=vol*.35;g.gain.setTargetAtTime(.001,when+.035,.045);node.connect(g);node.start(when);node.stop(when+.18);
      }else{g.disconnect();pan?.disconnect();return false}
      const v={node,g,pan,priority};playing.add(v);node.onended=()=>remove(v);lastSound.set(key,now);counts[key]=(counts[key]||0)+1;return true;
    }catch(_){try{node?.disconnect();g.disconnect();pan?.disconnect()}catch(_){}return false}
  }
  function stopLoops(){for(const n of loops){try{n.stop();n.disconnect()}catch(_){}}loops=[];if(tension)gain(tension,0)}
  function startLoops(){
    if(loops.length||!loaded||!ready()||suspended()||current?.done)return;
    try{
      const when=ctx.currentTime+.035, elapsed=Math.max(0,180-(current.t??180));
      for(const [buf,bus] of [[loaded.theme,buses.music],[loaded.drums,tension],[loaded.ambient,buses.ambient]]){
        const n=ctx.createBufferSource();n.buffer=buf;n.loop=true;n.loopEnd=buf.duration;n.connect(bus);n.start(when,elapsed%buf.duration);loops.push(n);
      }
      starts++;
    }catch(_){stopLoops()}
  }
  function refresh(){if(!enabled||pageGone||document.hidden||(isBattle()&&suspended())){stopLoops();stopVoices()}else if(!isBattle()||current?.done){stopLoops()}else startLoops()}
  for(const b of masterButtons)b.addEventListener('click',()=>{enabled=!enabled;write(masterKey,enabled?'on':'off');sync();if(enabled){unlock();play('ui',{priority:2,ui:true,vol:.12})}refresh()});
  for(const e of document.querySelectorAll('[data-audio-mix]'))e.addEventListener('input',()=>{const k=e.dataset.audioMix;if(names.includes(k))cfg[k]=clamp(Number(e.value)||0,0,100);else if(k==='vibration')cfg.vibration=e.checked;write(cfgKey,JSON.stringify(cfg));sync()});
  for(const b of document.querySelectorAll('[data-audio-reset]'))b.addEventListener('click',()=>{cfg={...defaults};write(cfgKey,JSON.stringify(cfg));sync()});
  sync();
  document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLoops();stopVoices()}else{unlock();refresh()}});
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
    if(!state.done)startLoops();
    const now=ctx?.currentTime||0, events=state.ev||[], units=state.u||[];
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
  return {begin(state){destroyed=new WeakSet();oldBegin(state)},frame,ui,stop(){current=null;stopLoops();stopVoices()},stats(){return{loaded:!!loaded,loadFail,enabled,settings:{...cfg},activeVoices:playing.size,loops:loops.length,starts,intensity,counts:{...counts},ctx:ctx?.state||'none'}}};
})();
