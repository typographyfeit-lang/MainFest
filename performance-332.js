'use strict';
/* 3.3.2. Additive load governor; the battle clock and simulation are untouched.
   Renderer 3.1 retains its own DPR/shadow adaptation. This module controls the NEW scenery
   and sound budget; it does not skip render calls or drop simulation ticks. */
(() => {
  const params=new URLSearchParams(location.search), key='cd-performance-v332', debugKey='cd-perf-debug-v332';
  const modes=['auto','eco','balanced','full'], $=s=>document.querySelector(s);
  const get=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}}, put=(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}};
  const requested=params.get('perf');let preference=modes.includes(requested)?requested:get(key,'auto');if(!modes.includes(preference))preference='auto';
  const quality=params.get('quality');const maxLevel=quality==='low'?0:quality==='medium'?1:2;
  const touch=!!(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);
  const initial=()=>Math.min(maxLevel,preference==='eco'?0:preference==='balanced'?1:preference==='full'?2:touch?1:2);
  const labels=['Экономичная','Сбалансированная','Максимальная'];
  let level=initial(), slow=0, fast=0, drops=0, raises=0, debug=params.get('debug')==='1'||get(debugKey,'0')==='1';
  const select=$('#perf-mode'), toggle=$('#perf-toggle'), note=$('#perf-mode-note'), output=$('#perf332'), oldOutput=$('#perf');
  const capacity=240, samples=new Float64Array(capacity);let count=0, sum=0, work=0, worst=0, nSamples=0, start=0, last=0, running=false;
  let snapshot={fps:0,p95:0,workMs:0,worstMs:0,units:0,drawCalls:0,triangles:0,geometries:0,textures:0,dpr:0,shadow:'—',voices:0,loops:0,audioMode:'—',denied:0,decor:'—',decorHz:0};
  function description(){if(note)note.textContent=`${preference==='auto'?'Авто: ':''}${labels[level]}. ${level===0?'Без тумана и новых частиц.':level===1?'Декорации до 20 Гц, меньше частиц.':'Полные декорации до 30 Гц.'}${quality==='low'?' Графика low ограничивает нагрузку.':''}`}
  function clearWindow(now=0){count=sum=work=worst=nSamples=0;start=last=now}
  function reset(){level=initial();slow=fast=0;clearWindow();description()}
  function adapt(fps,p95,workMs){
    if(preference!=='auto')return;
    const bad=fps<27||p95>55||(fps<42&&workMs>25), good=fps>=50&&p95<28&&workMs<19;
    slow=bad?slow+1:0;fast=good?fast+1:0;
    if(slow>=2&&level>0){level--;drops++;slow=fast=0;description()}
    else if(fast>=15&&level<maxLevel){level++;raises++;slow=fast=0;description()}
  }
  function show(){if(oldOutput)oldOutput.hidden=true;if(output)output.hidden=!debug;if(toggle)toggle.checked=debug}
  if(select){select.value=preference;select.addEventListener('change',()=>{preference=modes.includes(select.value)?select.value:'auto';put(key,preference);reset()})}
  if(toggle)toggle.addEventListener('change',()=>{debug=toggle.checked;put(debugKey,debug?'1':'0');show()});description();show();
  function collect(state){
    let rs={},a={},d={};try{rs=typeof V!=='undefined'&&V.stats?V.stats():{}}catch(_){}try{a=window.ArenaAudio?.stats?.()||{}}catch(_){}try{d=window.Battlefield33?.stats?.()||{}}catch(_){}
    const ordered=Array.from(samples.subarray(0,nSamples)).sort((a,b)=>a-b), fps=Math.round(1000*count/Math.max(1,sum)), p95=ordered[Math.max(0,Math.ceil(ordered.length*.95)-1)]||0;
    snapshot={fps,p95:+p95.toFixed(1),workMs:+(work/Math.max(1,count)).toFixed(1),worstMs:+worst.toFixed(1),units:state.u?.length||0,drawCalls:rs.drawCalls||0,triangles:rs.triangles||0,geometries:rs.geometries||0,textures:rs.textures||0,dpr:rs.dpr||0,shadow:rs.shadowMode||'—',voices:a.activeVoices||0,loops:a.loops||0,audioMode:a.enabled===false?'off':a.mode||'—',denied:a.denied||0,decor:d.mode||'—',decorHz:d.decorHz||0};
    adapt(snapshot.fps,snapshot.p95,snapshot.workMs);
    if(debug&&output){output.textContent=`${fps} FPS · p95 ${snapshot.p95} мс · CPU ${snapshot.workMs} мс\n${labels[level]} · DPR ${snapshot.dpr.toFixed(2)} · ${snapshot.units} бойцов · ${snapshot.drawCalls} calls\nЗвук ${snapshot.audioMode}: ${snapshot.voices} эффектов · декор ${snapshot.decorHz} Гц · G/T ${snapshot.geometries}/${snapshot.textures}`;output.hidden=false}
  }
  window.CDPerformance={level:()=>level,stats:()=>({...snapshot,level,preference,drops,raises,debug})};
  if(typeof V==='undefined'||!V.ok||typeof V.frame!=='function')return;
  const originalFrame=V.frame, originalBegin=V.begin, originalStop=V.stop;
  V.begin=function(state){drops=raises=0;running=false;reset();if(output){output.textContent='Измерение FPS…';show()}return originalBegin.call(this,state)};
  V.frame=function(state){
    const active=!!state&&!state.paused&&!state.done&&!document.hidden, begin=performance.now();
    if(!active){if(running){running=false;clearWindow();slow=fast=0;}return originalFrame.call(this,state)}
    if(!running){running=true;clearWindow(begin);return originalFrame.call(this,state)}
    const dt=Math.max(.01,begin-last);last=begin;
    const result=originalFrame.call(this,state);
    const elapsed=performance.now()-begin;count++;sum+=dt;work+=elapsed;worst=Math.max(worst,dt);
    samples[(count-1)%capacity]=dt;nSamples=Math.min(capacity,count);
    if(begin-start>=1000&&count>0){collect(state);count=sum=work=worst=nSamples=0;start=begin}
    return result;
  };
  V.stop=function(...args){running=false;clearWindow();try{window.ArenaAudio?.stop?.()}catch(_){}return originalStop.apply(this,args)};
  document.addEventListener('visibilitychange',()=>{running=false;clearWindow();slow=fast=0});
})();
