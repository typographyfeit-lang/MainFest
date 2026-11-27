'use strict';
/* Ultimate Vision 3.9 — preferences only. Live camera never follows units. */
(() => {
  const params=new URLSearchParams(location.search),legacy=params.get('visual')==='legacy';
  const modes={royal:{pitch:72,fov:24},tactical:{pitch:84,fov:24,orthographic:true}};
  const alias=v=>v==='plan'?'tactical':v==='classic'?'royal':v;
  const valid=v=>Object.hasOwnProperty.call(modes,v);
  const read=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}},write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),number=(v,d,a,b)=>v!==''&&v!==null&&Number.isFinite(Number(v))?clamp(Number(v),a,b):d;
  let mode=alias(read('cd-camera-38','royal'));if(!valid(mode))mode='royal';if(valid(alias(params.get('camera'))))mode=alias(params.get('camera'));
  let automatic=read('cd-smart-39','on')!=='off',pitch=number(read('cd-pitch-39',modes[mode].pitch),modes[mode].pitch,58,85);
  if(params.has('camera')){pitch=modes[mode].pitch;automatic=true;if(params.get('camera')==='classic'){pitch=60;automatic=false;}}
  if(params.has('pitch')&&params.get('pitch')!==''&&Number.isFinite(Number(params.get('pitch')))){pitch=number(params.get('pitch'),pitch,58,85);automatic=false;}
  let scale=number(params.get('zoom'),number(read('cd-zoom-381',100),100,85,100),85,100),markers=read('cd-markers-381','on')!=='off',compact=read('cd-compact-39','on')!=='off',cinema=read('cd-cinema-38','on')!=='off',intro=read('cd-intro3d-39',read('cd-intro-35','on'))!=='off',battle=null;
  if(params.has('markers'))markers=params.get('markers')!=='0';if(params.has('compact'))compact=params.get('compact')!=='0';if(params.has('intro3d'))intro=params.get('intro3d')!=='0';
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const editable=()=>!legacy&&(!battle||battle.paused||battle.done);
  const notify=()=>{document.querySelector('#app')?.classList.toggle('vision-compact',compact&&!legacy);if(typeof V!=='undefined'&&V.ok&&battle?.paused&&!battle.done)V.refitCamera();document.dispatchEvent(new Event('cd-camera-38-change'));};
  const api={modes,legacy,settings:()=>({mode,pitch,automatic,scale,markers,compact,shake:false,cinema,intro,legacy}),
    enter(s){battle=s;},leave(){battle=null;},
    setMode(v){v=alias(v);if(!editable()||!valid(v))return false;mode=v;pitch=modes[v].pitch;automatic=true;write('cd-camera-38',v);write('cd-pitch-39',pitch);write('cd-smart-39','on');notify();return true;},
    setPitch(v){if(!editable()||!Number.isFinite(Number(v)))return false;pitch=number(v,pitch,58,85);automatic=false;write('cd-pitch-39',pitch);write('cd-smart-39','off');notify();return true;},
    setAuto(v){if(!editable())return false;automatic=!!v;write('cd-smart-39',automatic?'on':'off');notify();return true;},
    setScale(v){if(!editable()||!Number.isFinite(Number(v)))return false;scale=number(v,scale,85,100);write('cd-zoom-381',scale);notify();return true;},
    setMarkers(v){if(!editable())return false;markers=!!v;write('cd-markers-381',markers?'on':'off');notify();return true;},
    setCompact(v){if(!editable())return false;compact=!!v;write('cd-compact-39',compact?'on':'off');notify();return true;},
    setShake(){return false;},
    setCinema(v){if(!editable())return false;cinema=!!v;write('cd-cinema-38',cinema?'on':'off');notify();return true;},
    setIntro(v){if(!editable())return false;intro=!!v;write('cd-intro3d-39',intro?'on':'off');notify();return true;},
    reset(){if(!editable())return false;mode='royal';pitch=72;automatic=true;scale=100;markers=compact=cinema=intro=true;for(const [k,v] of [['cd-camera-38',mode],['cd-pitch-39',pitch],['cd-smart-39','on'],['cd-zoom-381',scale],['cd-markers-381','on'],['cd-compact-39','on'],['cd-cinema-38','on'],['cd-intro3d-39','on']])write(k,v);notify();return true;},
    view(aspect){return legacy?{pitch:Math.max(58,Math.min(64,58+(0.75-aspect)*24)),fov:22,margin:.978,legacy:true}:{pitch:automatic?modes[mode].pitch:pitch,fov:modes[mode].fov,margin:.96*scale/100,orthographic:!!modes[mode].orthographic,scale,automatic,mode};},
    markersAllowed(){return !legacy&&markers;},shakeAllowed(){return legacy&&!motion.matches;},
    cinemaAllowed(){return !legacy&&cinema&&!motion.matches&&!document.hidden&&(window.CDPerformance?.level?.()??1)>0;},
    introAllowed(){return intro&&api.cinemaAllowed();},
    stats(){return typeof V!=='undefined'&&V.ok?V.cameraStats():{available:false};}
  };window.CDCamera38=window.CDCamera381=window.CDVision39=api;notify();
})();
