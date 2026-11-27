'use strict';
(() => {
  const api=window.CDCamera38;if(!api)return;
  const blocks=[...document.querySelectorAll('[data-camera-controls]')],available=typeof V!=='undefined'&&V.ok&&!api.legacy;
  const labels={classic:'Классический',royal:'Королевский',tactical:'Тактический'};
  function refresh(){const s=api.settings();for(const el of blocks){const mode=el.querySelector('[data-camera-mode]'),pitch=el.querySelector('[data-camera-pitch]'),out=el.querySelector('[data-camera-angle]');mode.value=s.mode;pitch.value=s.pitch;out.textContent=`${Math.round(s.pitch)}°`;el.querySelector('[data-camera-shake]').checked=s.shake;el.querySelector('[data-camera-cinema]').checked=s.cinema;el.querySelector('[data-camera-desc]').textContent=available?`${labels[s.mode]} · ${api.modes[s.mode].fov}° FOV · адаптивное кадрирование`:'Камера 3D недоступна в текущем режиме.';for(const c of el.querySelectorAll('input,select'))c.disabled=!available;}}
  for(const el of blocks){el.querySelector('[data-camera-mode]').addEventListener('change',e=>{api.setMode(e.target.value);refresh()});el.querySelector('[data-camera-pitch]').addEventListener('input',e=>{api.setPitch(Number(e.target.value));refresh()});el.querySelector('[data-camera-shake]').addEventListener('change',e=>api.setShake(e.target.checked));el.querySelector('[data-camera-cinema]').addEventListener('change',e=>api.setCinema(e.target.checked));}
  document.addEventListener('cd-camera-38-change',refresh);refresh();
})();
