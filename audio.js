'use strict';
// Original synthesized effects: no downloads, no copyrighted soundtrack. Audio does not affect simulation.
window.ArenaAudio=(()=>{
  const AC=window.AudioContext||window.webkitAudioContext;let ctx=null,bus=null,enabled=true,seen=new WeakSet(),units=new WeakSet(),dead=new WeakSet(),ended=false,lastFx=0,lastSpawn=0;
  try{enabled=localStorage.getItem('ba_audio_v27')!=='off'}catch(_){}
  const button=document.querySelector('#sound');
  function sync(){if(button){button.textContent=enabled?'Звук: вкл':'Звук: выкл';button.setAttribute('aria-pressed',String(enabled))}}
  function unlock(){if(!AC||!enabled)return;try{if(!ctx){ctx=new AC();bus=ctx.createGain();bus.gain.value=.23;bus.connect(ctx.destination)}if(ctx.state==='suspended')ctx.resume().catch(()=>{})}catch(_){ctx=null}}
  function tone(f0,f1,d,amp,type='sine',delay=0){if(!enabled||!ctx||ctx.state!=='running'||!bus)return;try{const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(bus);o.start(t);o.stop(t+d+.02);o.onended=()=>{o.disconnect();g.disconnect()}}catch(_){} }
  function vibrate(ms){if(enabled&&navigator.vibrate)try{navigator.vibrate(ms)}catch(_){} }
  function click(){unlock();tone(460,680,.075,.12,'sine')}
  if(button)button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem('ba_audio_v27',enabled?'on':'off')}catch(_){}sync();if(enabled){unlock();if(bus)bus.gain.value=.23;click()}else if(bus)bus.gain.value=0});sync();
  document.querySelector('#play').addEventListener('pointerdown',unlock,{passive:true});document.querySelector('#play').addEventListener('click',unlock,true);
  document.querySelector('#hand').addEventListener('click',e=>{if(e.target.closest('.card'))click()},{passive:true});
  function begin(state){seen=new WeakSet();units=new WeakSet();dead=new WeakSet();ended=false;lastFx=lastSpawn=0;unlock();tone(330,440,.20,.15,'triangle');tone(440,660,.26,.12,'sine',.12)}
  function frame(state){if(!enabled||!ctx||ctx.state!=='running')return;const now=ctx.currentTime;for(const u of state.u)if(!units.has(u)){units.add(u);if(u.team===0&&now-lastSpawn>.15){lastSpawn=now;tone(220,490,.14,.14,'triangle');vibrate(9)}}for(const f of state.fx){if(seen.has(f))continue;seen.add(f);if(now-lastFx<.095)continue;lastFx=now;if(f.k==='c'){tone(260,60,.24,.16,'triangle');tone(750,120,.18,.07,'sawtooth');vibrate(18)}else{tone(900,240,.075,.055,'triangle')}}for(const t of state.tw)if(t.hp<=0&&!dead.has(t)){dead.add(t);tone(150,45,.39,.22,'triangle');tone(430,70,.25,.065,'sawtooth');vibrate([25,35,30])}if(state.done&&!ended){ended=true;const victory=(document.querySelector('#rt')?.textContent||'').includes('ПОБЕДА');const notes=victory?[392,494,587,784]:[392,349,294];notes.forEach((f,i)=>tone(f,f,.32,.12,'triangle',i*.13))}}
  return {begin,frame};
})();
