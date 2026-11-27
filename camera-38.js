'use strict';
/* Persistent camera preferences. Renderer owns the actual fit, projection and picking. */
(() => {
  const params=new URLSearchParams(location.search),legacy=params.get('visual')==='legacy';
  const modes={classic:{pitch:60,fov:22},royal:{pitch:66,fov:26},tactical:{pitch:76,fov:24}}, has=k=>Object.prototype.hasOwnProperty.call(modes,k);
  const read=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}},write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  let mode=read('cd-camera-38','royal');if(!has(mode))mode='royal';if(has(params.get('camera')))mode=params.get('camera');
  const stored=Number(read('cd-pitch-38',modes[mode].pitch));let pitch=Number.isFinite(stored)?clamp(stored,58,78):modes[mode].pitch;
  if(has(params.get('camera')))pitch=modes[mode].pitch;
  if(params.has('pitch')&&params.get('pitch')!==''&&Number.isFinite(Number(params.get('pitch'))))pitch=clamp(Number(params.get('pitch')),58,78);
  let shake=read('cd-shake-38','off')==='on',cinema=read('cd-cinema-38','on')!=='off',battle=null;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const editable=()=>!legacy&&(!battle||battle.paused||battle.done);
  const notify=()=>{if(typeof V!=='undefined'&&V.ok&&battle?.paused&&!battle.done)V.refitCamera();document.dispatchEvent(new Event('cd-camera-38-change'));};
  window.CDCamera38={modes,legacy,settings:()=>({mode,pitch,shake,cinema,legacy}),
    enter(state){battle=state;},leave(){battle=null;},
    setMode(v){if(!editable()||!has(v))return false;mode=v;pitch=modes[v].pitch;write('cd-camera-38',v);write('cd-pitch-38',pitch);notify();return true;},
    setPitch(v){if(!editable()||!Number.isFinite(Number(v)))return false;pitch=clamp(Number(v),58,78);write('cd-pitch-38',pitch);notify();return true;},
    setShake(v){if(legacy)return;shake=!!v;write('cd-shake-38',shake?'on':'off');notify();},
    setCinema(v){if(legacy)return;cinema=!!v;write('cd-cinema-38',cinema?'on':'off');notify();},
    view(aspect){return legacy?{pitch:Math.max(58,Math.min(64,58+(0.75-aspect)*24)),fov:22,margin:.978}:{pitch,fov:modes[mode].fov,margin:.945};},
    shakeAllowed(){return !motion.matches&&(legacy||shake);},
    cinemaAllowed(){return !legacy&&cinema&&!motion.matches&&!document.hidden&&(window.CDPerformance?.level?.()??1)>0;},
    stats(){return typeof V!=='undefined'&&V.ok?V.cameraStats():{available:false};}
  };
})();
