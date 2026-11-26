'use strict';
/* Royal UI — existing deck selection, save, audio, intro and reward logic stay in place. */
(() => {
  const $=s=>document.querySelector(s), app=$('#app'), api=window.CDRoyal;if(!app||!api)return;
  const legacy=new URLSearchParams(location.search).get('visual')==='legacy';
  const selectors=[$('#royal-world'),$('#royal-world-profile')].filter(Boolean), vfx=$('#royal-vfx'), celebration=$('#royal-intro-effects'), introTitle=$('#kingdom-intro-title'), res=$('#res');
  const read=(k,d)=>{try{return localStorage.getItem(k)??d}catch(_){return d}},write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  let celebrate=read('cd-celebration-36','on')!=='off';
  function refresh(){const k=api.selected();app.dataset.royalWorld=k;app.dataset.royalCelebrate=celebrate?'1':'0';for(const s of selectors)s.value=k;if(introTitle)introTitle.textContent=legacy?'Битва за святилище':api.worlds[k];if(vfx)vfx.checked=api.vfx();if(celebration)celebration.checked=celebrate}
  if(legacy){app.classList.remove('royal-36');for(const s of selectors)s.disabled=true;if(vfx)vfx.disabled=true;if(celebration)celebration.disabled=true}
  for(const s of selectors)s.addEventListener('change',()=>{if(!legacy&&api.select(s.value))refresh()});
  if(vfx)vfx.addEventListener('change',()=>api.setVfx(vfx.checked));if(celebration)celebration.addEventListener('change',()=>{celebrate=celebration.checked;write('cd-celebration-36',celebrate?'on':'off');refresh()});
  refresh();
  if(!legacy&&res){const sparks=document.createElement('div');sparks.className='royal-reward-sparks';sparks.setAttribute('aria-hidden','true');for(let i=0;i<12;i++){const el=document.createElement('i');el.style.setProperty('--i',i);el.style.setProperty('--dx',`${Math.cos(i*Math.PI/6)*100}px`);el.style.setProperty('--dy',`${Math.sin(i*Math.PI/6)*65}px`);sparks.append(el)}res.querySelector('.kingdom-result-emblem')?.append(sparks)}
})();
