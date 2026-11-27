'use strict';
(() => {
  const api=window.CDVision39;if(!api)return;
  const $=q=>document.querySelector(q),blocks=[...document.querySelectorAll('[data-camera-controls]')],available=typeof V!=='undefined'&&V.ok&&!api.legacy;
  const inspector=$('#vision-inspection'),intro=$('#vision-intro'),touch=$('#vision-touch'),open=$('#vision-inspect-open'),game=$('#game'),pause=$('#pausemenu');
  let orbit={yaw:0,pitch:60,zoom:100,focus:'arena'},points=new Map(),introTimer=0,introGame=null;
  function refresh(){const s=api.settings();for(const el of blocks){const q=x=>el.querySelector(x);q('[data-camera-mode]').value=s.mode;q('[data-camera-pitch]').value=s.pitch;q('[data-camera-angle]').textContent=s.automatic?'Авто':`${Math.round(s.pitch)}°`;q('[data-camera-zoom]').value=s.scale;q('[data-camera-zoom-value]').textContent=`${Math.round(s.scale)}%`;for(const k of ['auto','markers','compact','intro','cinema'])q(`[data-camera-${k}]`).checked=k==='auto'?s.automatic:s[k];q('[data-camera-desc]').textContent=available?`${s.mode==='tactical'?'Tactical · ортографический':'Smart Battle · перспектива'} · ${s.automatic?'автоцентрирование':'ручной наклон'}`:'Камера 3D недоступна.';for(const c of el.querySelectorAll('input,select,button'))c.disabled=!available;}}
  for(const el of blocks){const q=x=>el.querySelector(x);q('[data-camera-mode]').addEventListener('change',e=>{api.setMode(e.target.value);refresh()});q('[data-camera-pitch]').addEventListener('input',e=>{api.setPitch(Number(e.target.value));refresh()});q('[data-camera-zoom]').addEventListener('input',e=>{api.setScale(Number(e.target.value));refresh()});for(const [key,method] of [['auto','setAuto'],['markers','setMarkers'],['compact','setCompact'],['intro','setIntro'],['cinema','setCinema']])q(`[data-camera-${key}]`).addEventListener('change',e=>api[method](e.target.checked));q('[data-camera-reset]').addEventListener('click',()=>api.reset());}
  document.addEventListener('cd-camera-38-change',refresh);refresh();
  if(open)open.disabled=!available;
  const oldIntro=$('#kingdom-intro-pref');if(available&&oldIntro){const label=oldIntro.closest('label');if(label)label.hidden=true;}
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function showOrbit(){if(inspector.hidden||!G||!G.paused||G.done)return false;orbit.yaw=((orbit.yaw+180)%360+360)%360-180;orbit.pitch=clamp(orbit.pitch,35,85);orbit.zoom=clamp(orbit.zoom,85,150);$('#vision-yaw').value=orbit.yaw;$('#vision-orbit-pitch').value=orbit.pitch;$('#vision-orbit-zoom').value=orbit.zoom;$('#vision-zoom-value').textContent=Math.round(orbit.zoom)+'%';for(const b of inspector.querySelectorAll('[data-focus]'))b.setAttribute('aria-pressed',String(b.dataset.focus===orbit.focus));return V.inspectCamera(G,orbit);}
  function closeInspector(restore=true){if(inspector.hidden)return;for(const id of points.keys())try{touch.releasePointerCapture(id)}catch(_){}points.clear();inspector.hidden=true;V.closeInspection?.();if(restore&&G?.paused&&!G.done){pause.hidden=false;open.focus({preventScroll:true});}}
  function openInspector(){if(!available||!G?.paused||G.done||!intro.hidden)return false;cancelGesture();cancelDrag();orbit={yaw:0,pitch:60,zoom:100,focus:'arena'};inspector.hidden=false;pause.hidden=true;if(!showOrbit()){closeInspector();return false;}$('#vision-inspect-close').focus({preventScroll:true});return true;}
  open.onclick=openInspector;$('#vision-inspect-close').onclick=()=>closeInspector();
  for(const [id,key] of [['vision-yaw','yaw'],['vision-orbit-pitch','pitch'],['vision-orbit-zoom','zoom']])$('#'+id).addEventListener('input',e=>{orbit[key]=Number(e.target.value);showOrbit()});
  for(const b of inspector.querySelectorAll('[data-focus]'))b.onclick=()=>{orbit.focus=b.dataset.focus;orbit.zoom=100;showOrbit()};
  $('#vision-orbit-reset').onclick=()=>{orbit={yaw:0,pitch:60,zoom:100,focus:'arena'};showOrbit()};
  const span=()=>{const a=[...points.values()];return a.length===2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;};
  touch.addEventListener('pointerdown',e=>{if(inspector.hidden||!G?.paused||G.done||e.button>0||points.size>=2)return;e.preventDefault();e.stopPropagation();points.set(e.pointerId,{x:e.clientX,y:e.clientY});try{touch.setPointerCapture(e.pointerId)}catch(_){}});
  touch.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||inspector.hidden||!G?.paused)return;e.preventDefault();e.stopPropagation();const old=points.get(e.pointerId),before=span();points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){const after=span();if(before>6&&after>6)orbit.zoom*=after/before;}else{orbit.yaw+=(e.clientX-old.x)*.55;orbit.pitch+=(e.clientY-old.y)*.28;}showOrbit();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])touch.addEventListener(ev,e=>{points.delete(e.pointerId);e.stopPropagation()});
  touch.addEventListener('wheel',e=>{if(inspector.hidden)return;e.preventDefault();orbit.zoom+=e.deltaY>0?-5:5;showOrbit();},{passive:false});
  // Separate 1.4 s opening shot. The existing simulation is paused before its first tick.
  const originalStart=start,originalPause=setPaused,originalLeave=leaveBattle;
  function finishIntro(resume){clearTimeout(introTimer);introTimer=0;if(intro.hidden)return;intro.hidden=true;V.endIntro?.();const same=G&&G===introGame;introGame=null;if(same&&!G.done){if(resume&&!document.hidden)originalPause(false);else originalPause(true);}}
  start=function(){const result=originalStart.apply(this,arguments);if(available&&G&&api.introAllowed()){G.paused=true;G.menu=true;G.acc=0;G.last=performance.now();if(V.beginIntro(G)){introGame=G;intro.hidden=false;pause.hidden=true;introTimer=setTimeout(()=>finishIntro(true),1450);$('#vision-intro-skip').focus({preventScroll:true});}else{G.paused=false;G.menu=false;}}return result;};
  setPaused=function(on){if(!intro.hidden){finishIntro(false);if(!on)return originalPause(false);return;}if(!inspector.hidden)closeInspector(false);return originalPause(on);};
  leaveBattle=function(){clearTimeout(introTimer);introTimer=0;introGame=null;intro.hidden=true;closeInspector(false);V.endIntro?.();return originalLeave.apply(this,arguments);};
  $('#vision-intro-skip').onclick=()=>finishIntro(true);
  document.addEventListener('keydown',e=>{if(inspector.hidden&&intro.hidden)return;if(['Escape','p','з'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(!inspector.hidden)closeInspector();else finishIntro(true);}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!intro.hidden)finishIntro(false);if(!inspector.hidden)closeInspector();}});
  addEventListener('pagehide',()=>{if(!intro.hidden)finishIntro(false);if(!inspector.hidden)closeInspector();});
  new MutationObserver(()=>{if(game.hidden){clearTimeout(introTimer);introTimer=0;introGame=null;intro.hidden=true;closeInspector(false);}}).observe(game,{attributes:true,attributeFilter:['hidden']});
})();
