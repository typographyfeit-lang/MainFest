'use strict';
// Crystal Dominion 3.0. Original arena, automatic shrine and independent rune cooldowns.
const W=360,H=560,RY=280,DEPLOY=322,SHRINE={x:180,y:280,rad:54,period:30};
const $=s=>document.querySelector(s),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rnd=(a,b)=>a+Math.random()*(b-a);
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const CARDS={
 guard:{n:'Страж',ic:'🛡️',c:3,hp:420,d:55,r:16,s:38,as:1.1,k:1,col:'#7b8794',hd:'#d2a679'},
 archer:{n:'Лучники',ic:'🏹',c:3,hp:130,d:28,r:100,s:34,as:1,k:2,col:'#4e9a4e',hd:'#d2a679'},
 colossus:{n:'Колосс',ic:'🗿',c:5,hp:1500,d:90,r:22,s:24,as:1.6,k:1,bld:1,big:1,col:'#8d8d8d',hd:'#a9a9a9'},
 imp:{n:'Бес-подрывник',ic:'🧨',c:2,hp:80,d:250,r:16,s:72,as:1,k:1,boom:40,col:'#d9602a',hd:'#f08a4b'},
 mage:{n:'Маг огня',ic:'🔥',c:4,hp:190,d:65,r:95,s:30,as:1.4,k:1,spl:34,col:'#a04ad9',hd:'#d2a679'},
 hounds:{n:'Гончие',ic:'🐺',c:3,hp:100,d:28,r:15,s:75,as:.8,k:3,col:'#b0b0b8',hd:'#c8c8d0'},
 swarm:{n:'Рой',ic:'🪨',c:2,hp:45,d:18,r:14,s:52,as:.9,k:4,col:'#6b5b4b',hd:'#8a7866'},
 brute:{n:'Громила',ic:'🧱',c:4,hp:800,d:95,r:22,s:30,as:1.3,k:1,big:1,col:'#a8553a',hd:'#d2a679'},
 meteor:{n:'Метеорит',ic:'☄️',c:4,sp:1,d:250,rad:50},
 spark:{n:'Искра',ic:'⚡',c:3,sp:1,d:170,rad:28}
};

const CD={guard:7,archer:9,colossus:14,imp:7,mage:11,hounds:10,swarm:8,brute:12,meteor:15,spark:12};
const START=['guard','archer','colossus','imp','mage','hounds','swarm','meteor'];
const DEFAULT=['guard','mage','colossus','meteor'];
const UNIT_IDS=Object.keys(CARDS).filter(id=>!CARDS[id].sp);
const DIFF={easy:{wait:4.2,factor:1.35},normal:{wait:2.3,factor:1},hard:{wait:1.25,factor:.88}};
const SAVE='crystal-dominion-v1';
function readSave(k){try{return JSON.parse(localStorage.getItem(k))}catch(_){return null}}
function unique(a){return Array.isArray(a)?[...new Set(a.filter(id=>hasOwn(CARDS,id)))]:[]}
function sanitize(raw){raw=raw&&typeof raw==='object'?raw:{};const own=unique([...START,...unique(raw.own)]),deck=unique(raw.deck).filter(id=>own.includes(id));if(!deck.some(id=>!CARDS[id].sp))deck.unshift('guard');for(const id of DEFAULT)if(!deck.includes(id))deck.push(id);const safe=v=>Number.isFinite(v)?Math.max(0,Math.min(999999,Math.floor(v))):0;return {version:1,tr:safe(raw.tr),coin:Number.isFinite(raw.coin)?safe(raw.coin):150,own,deck:deck.slice(0,4),wins:safe(raw.wins),battles:safe(raw.battles),difficulty:hasOwn(DIFF,raw.difficulty)?raw.difficulty:'normal'};}
let S=sanitize(readSave(SAVE)||readSave('ba1'));const save=()=>{try{localStorage.setItem(SAVE,JSON.stringify(S))}catch(_){}};save();
let selected=null;
function cardEl(id,x='',battle=false){const c=CARDS[id];return `<button type="button" class="card rune ${x}" data-id="${id}" aria-label="${c.n}, перезарядка ${CD[id]} сек."><b>${CD[id]}с</b><em>${c.ic}</em><span class="rune-name">${c.n}</span>${battle?'<span class="ready-label">Готов</span><i class="cooldown-track"><i></i></i>':''}</button>`}
function ui(){
 $('#tr').textContent=`Побед: ${S.wins}`;$('#co').textContent=`Осколки: ${S.coin}`;
 $('#deck').innerHTML=S.deck.map(id=>cardEl(id)).join('');
 $('#coll').innerHTML=Object.keys(CARDS).filter(id=>!S.deck.includes(id)).map(id=>cardEl(id,(!S.own.includes(id)?'lock ':'')+(selected===id?'sel':''))).join('');
 const locked=Object.keys(CARDS).filter(id=>!S.own.includes(id));$('#unlock-list').innerHTML=locked.length?locked.map(id=>`<div class="unlock-item">${cardEl(id)}<button type="button" data-unlock="${id}" ${S.coin<100?'disabled':''}>Открыть · 100</button></div>`).join(''):'<p class="hint">Все руны открыты.</p>';
 $('#difficulty').value=S.difficulty;$('#record').textContent=`Сражений: ${S.battles} · Побед: ${S.wins}`;
}
$('#deck').onclick=e=>{const el=e.target.closest('.card');if(!el||!selected||!S.own.includes(selected))return;const i=[...el.parentNode.children].indexOf(el),next=[...S.deck];next[i]=selected;if(!next.some(id=>!CARDS[id].sp)){ $('#deckhint').textContent='Оставь хотя бы одного бойца в отряде.';return}S.deck=next;selected=null;$('#deckhint').textContent='Выбери руну в коллекции, затем замени одну из четырёх.';save();ui()};
$('#coll').onclick=e=>{const el=e.target.closest('.card');if(el&&S.own.includes(el.dataset.id)){selected=el.dataset.id;ui()}};
$('#unlock-list').onclick=e=>{const id=e.target.closest('[data-unlock]')?.dataset.unlock;if(!id||S.own.includes(id)||!hasOwn(CARDS,id)||S.coin<100)return;S.coin-=100;S.own.push(id);save();ui();$('#shopmsg').textContent=`Открыта руна: ${CARDS[id].n}`};
$('#difficulty').onchange=e=>{if(hasOwn(DIFF,e.target.value)){S.difficulty=e.target.value;save()}};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.t).classList.add('on')});
// World: uninterrupted stone floor. Center path leads to the shrine; two flanks bypass it.
const cv=$('#cv');let G=null,raf=0,gesture=null;const FIXED=1/30;
const route=x=>x<130?'left':x>230?'right':'center';
const tower=(team,x,y,king)=>({team,x,y,king:!!king,hp:king?3600:1100,max:king?3600:1100,rad:king?37:16,r:king?112:96,d:king?65:42,as:king?1:1.1,cd:0});
function structures(){return [tower(0,53,391,false),tower(0,307,391,false),tower(0,180,508,true),tower(1,53,169,false),tower(1,307,169,false),tower(1,180,52,true)]}
function core(team){return G.tw.find(t=>t.team===team&&t.king)}
function ratio(team){const t=core(team);return Math.max(0,t.hp)/t.max}
function constrain(u,oldX=u.x,oldY=u.y){const rad=u.rad||12;u.x=clamp(u.x,rad,W-rad);u.y=clamp(u.y,rad,H-rad);for(const t of G.tw){if(t.hp<=0)continue;const min=t.rad+rad,dx=u.x-t.x,dy=u.y-t.y,d=Math.hypot(dx,dy);if(d>=min)continue;let nx=dx,ny=dy,len=d;if(len<.001){nx=oldX-t.x;ny=oldY-t.y;len=Math.hypot(nx,ny);if(len<.001){nx=0;ny=u.team?1:-1;len=1}}u.x=clamp(t.x+nx/len*(min+.01),rad,W-rad);u.y=clamp(t.y+ny/len*(min+.01),rad,H-rad);}}
function validPoint(p){return !!(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H)}
function placement(p,c,slot=G?.sel){if(!G||!c||!validPoint(p)||G.done||G.paused||!(G.cool[0][G.hand[slot]]<=.0001))return false;if(c.sp)return true;if(p.y<DEPLOY||G.u.filter(u=>u.team===0&&u.hp>0).length>=36)return false;return !G.tw.some(t=>t.hp>0&&dist(p,t)<t.rad+(c.big?19:12));}
function spawn(id,team,x,y,{bonus=false}={}){const c=CARDS[id];if(!c||c.sp)return;const limit=36;for(let i=0;i<c.k;i++){if(G.u.filter(u=>u.team===team&&u.hp>0).length>=limit)break;const u={...c,id,team,x:x+(i-(c.k-1)/2)*18,y:y+rnd(-4,4),max:c.hp,cd:.5,rad:c.big?19:c.k>2?10:12,path:bonus?'attack':route(x),bonus,attackSeq:0};if(bonus){u.hp=u.max=1050;u.d=75;u.s=34;u.r=20;u.as=1.2;u.bld=0;u.rad=19;}else u.y=team?Math.min(u.y,H-DEPLOY):Math.max(u.y,DEPLOY);constrain(u);G.u.push(u)}}
function blast(x,y,r,d,team,m,card='impact'){G.fx.push({k:'c',x,y,r,l:.3,card,team});for(const o of [...G.u,...G.tw])if(o.team!==team&&o.hp>0&&Math.hypot(o.x-x,o.y-y)<=r+o.rad)o.hp-=d*(o.king===undefined?1:m)}
function playRune(team,id,p){const c=CARDS[id];if(!G||G.done||G.paused||!c||!validPoint(p)||!hasOwn(G.cool[team],id)||G.cool[team][id]>0)return false;if(!c.sp&&(team===0?p.y<DEPLOY:p.y>H-DEPLOY))return false;if(!c.sp&&G.tw.some(t=>t.hp>0&&dist(p,t)<t.rad+(c.big?19:12)))return false;if(!c.sp&&G.u.filter(u=>u.team===team&&u.hp>0).length>=36)return false;G.cool[team][id]=CD[id]*(team?DIFF[G.difficulty].factor:1);if(c.sp)blast(p.x,p.y,c.rad,c.d,team,.4,id);else spawn(id,team,p.x,p.y);return true;}
function start(){if(raf)cancelAnimationFrame(raf);raf=0;gesture=null;const ai=['guard','mage','colossus','spark'];G={t:180,u:[],fx:[],hand:[...S.deck],ai,sel:-1,at:2.5,done:0,last:performance.now(),acc:0,finishAge:0,hud:{},difficulty:S.difficulty,tw:structures(),cool:[Object.fromEntries(S.deck.map(id=>[id,0])),Object.fromEntries(ai.map(id=>[id,0]))],shrine:{next:30,owner:-1,contested:false,charge:0,candidate:-1,pulse:0,lastAward:-1,awards:[0,0]}};$('#game').hidden=false;$('#res').hidden=true;hand();V.begin(G);upd();raf=requestAnimationFrame(loop)}
function hand(){$('#hand').innerHTML=G.hand.map((id,i)=>cardEl(id,G.sel===i?'sel':'',true)).join('');G.hud.runes='';}
$('#hand').onclick=e=>{const el=e.target.closest('.card');if(!el||!G||G.done)return;const i=G.hand.indexOf(el.dataset.id);if(G.cool[0][G.hand[i]]>0)return;cancelGesture();G.sel=G.sel===i?-1:i;hand();upd()};
cv.onpointerdown=e=>{if(!G||G.done||G.sel<0||gesture||e.button>0)return;const c=CARDS[G.hand[G.sel]],p=V.pick(e);gesture={id:e.pointerId,slot:G.sel};if(V.preview)V.preview(p,c,placement(p,c));if(e.pointerId!==undefined&&cv.setPointerCapture)try{cv.setPointerCapture(e.pointerId)}catch(_){}};
cv.onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(V.preview)V.preview(null);if(!G||G.done||G.sel!==g.slot||G.sel<0)return;const p=V.pick(e),id=G.hand[G.sel];if(!placement(p,CARDS[id])||!playRune(0,id,p))return;G.sel=-1;hand();upd()};
cv.addEventListener('pointermove',e=>{if(!G||G.done||G.sel<0||!V.preview||gesture&&gesture.id!==e.pointerId)return;const c=CARDS[G.hand[G.sel]],p=V.pick(e);V.preview(p,c,placement(p,c))},{passive:true});
function cancelGesture(){gesture=null;if(V.preview)V.preview(null)}
cv.addEventListener('pointercancel',cancelGesture);cv.addEventListener('lostpointercapture',cancelGesture);cv.addEventListener('pointerleave',()=>{if(!gesture&&V.preview)V.preview(null)},{passive:true});
document.addEventListener('visibilitychange',()=>{if(G){cancelGesture();G.last=performance.now();G.acc=0}});
function loop(now){raf=0;if(!G)return;const dt=Math.max(0,Math.min(.5,(now-G.last)/1000));G.last=now;if(document.hidden){G.acc=0;raf=requestAnimationFrame(loop);return}if(!G.done&&!G.paused){G.acc+=dt;while(G.acc+1e-9>=FIXED&&!G.done){step(FIXED);G.acc-=FIXED}}V.frame(G);upd();if(G.done){G.finishAge+=dt;if(G.finishAge>=.7)return}raf=requestAnimationFrame(loop)}
// No accumulated permanent advantage: exclusive presence for 1.5 seconds, contested = neutral.
// Every 30 seconds the shrine awards at most one guardian, then resets. Bonus units cannot capture.
function shrineStep(dt){const s=G.shrine;s.pulse=Math.max(0,s.pulse-dt);const present=[false,false];for(const u of G.u)if(u.hp>0&&!u.bonus&&dist(u,SHRINE)<=SHRINE.rad)present[u.team]=true;s.contested=present[0]&&present[1];const side=present[0]===present[1]?-1:present[0]?0:1;if(side!==s.candidate){s.charge=0;s.candidate=side;s.owner=-1}if(side<0){s.owner=-1;s.charge=0}else{s.charge=Math.min(1.5,s.charge+dt);s.owner=s.charge>=1.5?side:-1} s.next-=dt;if(s.next<=1e-7){const winner=s.owner;s.lastAward=-1;s.pulse=.7;if(winner>=0){const count=G.u.filter(u=>u.team===winner&&u.hp>0).length;if(count<36){spawn('colossus',winner,180,280+(winner?23:-23),{bonus:true});s.awards[winner]++;s.lastAward=winner;s.pulse=2;G.fx.push({k:'c',x:180,y:280,r:SHRINE.rad,l:.3,card:'shrine',team:winner});}}else{s.lastAward=-1;s.pulse=.7}for(const u of G.u)if(u.path==='center')u.path='attack';s.owner=-1;s.candidate=-1;s.charge=0;s.contested=false;s.next+=SHRINE.period;}}
function aiStep(dt){if((G.at-=dt)>0)return;G.at=DIFF[G.difficulty].wait+rnd(0,.55);const available=G.ai.filter(id=>G.cool[1][id]<=0);if(!available.length)return;const enemies=G.u.filter(u=>u.team===0&&u.hp>0);const threat=enemies.filter(u=>u.y<205);const cluster=enemies.find(u=>enemies.filter(v=>dist(u,v)<28).length>=3);if(available.includes('spark')&&(cluster||threat.length>=2)){const p=cluster||threat[0];playRune(1,'spark',p);return}const units=available.filter(id=>!CARDS[id].sp);if(!units.length)return;let id=units[Math.floor(Math.random()*units.length)];if(threat.length&&units.includes('guard'))id='guard';else if(G.shrine.next<12&&units.includes('mage'))id='mage';const center=G.shrine.next<15||Math.random()<.38;let x=threat.length?clamp(threat[0].x,25,335):center?180:Math.random()<.5?96:264;const y=threat.length?205:225;if(!playRune(1,id,{x,y}))playRune(1,id,{x:180,y:225});}
function step(dt){G.t=Math.max(0,G.t-dt);for(const cd of G.cool)for(const id of Object.keys(cd))cd[id]=cd[id]-dt<1e-7?0:cd[id]-dt;aiStep(dt);G.u.forEach(u=>act(u,dt));G.tw.forEach(t=>t.hp>0&&tow(t,dt));sep();G.u=G.u.filter(u=>u.hp>0);G.fx.forEach(f=>f.l-=dt);G.fx=G.fx.filter(f=>f.l>0);if(core(0).hp<=0||core(1).hp<=0||G.t<=1e-7){end();return}shrineStep(dt)}
// Detour around intact structures rather than pushing directly into them.
function move(u,x,y,dt){let dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);if(d<.001)return;let nx=dx/d,ny=dy/d;
 for(const t of G.tw){if(t.hp<=0||Math.hypot(x-t.x,y-t.y)<.1)continue;const ox=t.x-u.x,oy=t.y-u.y,dd=Math.hypot(ox,oy),clear=t.rad+u.rad+5,forward=ox*nx+oy*ny,side=ox*ny-oy*nx;
  if(dd>clear+28||forward<=0||forward>d||Math.abs(side)>=clear)continue;
  // Choose a stable bypass side. At the field edge prefer the direction into the arena.
  const rx=ox/(dd||1),ry=oy/(dd||1);let turn=side>=0?-1:1;
  if(Math.abs(side)<1)turn=u.x<180?1:-1;
  const px=-ry*turn,py=rx*turn;if(u.x+px*clear< u.rad||u.x+px*clear>W-u.rad||u.y+py*clear<u.rad||u.y+py*clear>H-u.rad)turn=-turn;
  nx=-ry*turn-rx*.14;ny=rx*turn-ry*.14;const n=Math.hypot(nx,ny)||1;nx/=n;ny/=n;break;
 }
 const amount=Math.min(d,u.s*dt),ox=u.x,oy=u.y;u.x+=nx*amount;u.y+=ny*amount;constrain(u,ox,oy)}
function act(u,dt){if(u.hp<=0)return;u.cd-=dt;u.attacking=false;let target=null,bd=Infinity;const center=u.path==='center'&&!u.bonus;const flank=(u.path==='left'||u.path==='right');const before=u.team?u.y<325:u.y>235;
 // Attack near opponents; central squads do not abandon the shrine for remote targets.
 if(!u.bld)for(const o of G.u){if(o===u||o.team===u.team||o.hp<=0)continue;const d=dist(u,o)-o.rad;const reach=center?Math.max(u.r,32):Math.max(85,u.r);if(d<bd&&d<=reach&&(!center||dist(o,SHRINE)<85||d<=u.r)){bd=d;target=o}}
 // Buildings are engaged opportunistically, or become the destination after the route.
 for(const o of G.tw)if(o.team!==u.team&&o.hp>0){const d=dist(u,o)-o.rad;if(d<bd&&(!center&&!flank||d<=u.r||flank&&!before)){bd=d;target=o}}
 if(target&&bd<=u.r){u.targetX=target.x;u.targetY=target.y;u.attacking=true;if(u.cd>0)return;u.cd=u.as;u.attackSeq++;if(u.boom){blast(u.x,u.y,u.boom,u.d,u.team,1,'imp');u.hp=0}else if(u.spl)blast(target.x,target.y,u.spl,u.d,u.team,1,u.id);else{target.hp-=u.d;G.fx.push({k:u.r>40?'l':'m',a:u,b:target,l:.13})}return}
 if(center){if(target&&target.king===undefined&&dist(target,SHRINE)<75){move(u,target.x,target.y,dt);return}const x=180+(u.x<180?-13:13),y=280+(u.team?-20:20);if(Math.hypot(u.x-x,u.y-y)>10)move(u,x,y,dt);return}
 if(flank&&before){if(target&&target.king===undefined&&bd<40){move(u,target.x,target.y,dt);return}move(u,u.path==='left'?96:264,u.team?328:232,dt);return}if(flank)u.path='attack';if(!target){target=core(1-u.team)}if(target&&target.hp>0){u.targetX=target.x;u.targetY=target.y;move(u,target.x,target.y,dt)}}
function tow(t,dt){t.cd-=dt;let target=null,bd=t.r;for(const o of G.u)if(o.team!==t.team&&o.hp>0){const d=dist(t,o);if(d<bd){bd=d;target=o}}if(target&&t.cd<=0){t.cd=t.as;target.hp-=t.d;G.fx.push({k:'l',a:t,b:target,l:.1})}}
function sep(){for(let i=0;i<G.u.length;i++)for(let j=i+1;j<G.u.length;j++){const a=G.u[i],b=G.u[j];if(a.hp<=0||b.hp<=0)continue;let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),m=a.rad+b.rad;if(d>=m)continue;if(d<.001){dx=1;dy=0;d=1}const f=(m-d)/d*.25,ax=a.x,ay=a.y,bx=b.x,by=b.y;a.x+=dx*f;a.y+=dy*f;b.x-=dx*f;b.y-=dy*f;constrain(a,ax,ay);constrain(b,bx,by)}}
function end(){if(G.done)return;const a=ratio(0),b=ratio(1),r=Math.abs(a-b)<1e-9?0:a>b?1:-1;G.done=1;G.result=r;cancelGesture();S.battles++;if(r>0){S.wins++;S.tr+=30}S.coin+=r>0?60:20;save();ui();$('#rt').textContent=r>0?'ПОБЕДА!':r<0?'ПОРАЖЕНИЕ':'НИЧЬЯ';$('#rp').textContent=`Ядра: ${Math.round(a*100)}% : ${Math.round(b*100)}% · +${r>0?60:20} осколков`;$('#res').hidden=false}
$('#rb').onclick=()=>{cancelGesture();if(raf)cancelAnimationFrame(raf);raf=0;if(V.stop)V.stop();G=null;$('#game').hidden=true;$('#res').hidden=true};
let assetsReady=false,assetsLoading=null;
function prepareAssets(){if(assetsReady)return Promise.resolve();if(!assetsLoading)assetsLoading=Promise.resolve().then(()=>V.prepare?V.prepare():null).then(()=>{assetsReady=true}).catch(e=>{assetsLoading=null;throw e});return assetsLoading}
const playButton=$('#play'),loadStatus=$('#loadstatus');function status(text){loadStatus.textContent=text}
playButton.onclick=async()=>{if(!V.ok){status('3D-движок не загрузился. Проверьте интернет и WebGL.');return}playButton.disabled=true;try{status(assetsReady?'':'Загрузка 3D-моделей…');await prepareAssets();status('');start()}catch(e){console.error('Asset loading:',e);if(G){if(raf)cancelAnimationFrame(raf);raf=0;if(V.stop)V.stop();G=null;$('#game').hidden=true;$('#res').hidden=true}status('Не удалось загрузить модели. Нажмите «В БОЙ» ещё раз.')}finally{playButton.disabled=false}};
if(V.ok&&V.prepare)prepareAssets().then(()=>status('')).catch(()=>status('Модели не загружены. Нажмите «В БОЙ», чтобы повторить.'));
function upd(){if(!G)return;const h=G.hud,t=Math.ceil(G.t),a=Math.round(ratio(0)*100),b=Math.round(ratio(1)*100),s=G.shrine;const time=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;if(h.time!==time){$('#time').textContent=time;h.time=time}const hpKey=`${a}:${b}`;if(h.hp!==hpKey){$('#hp0').textContent=a+'%';$('#hp1').textContent=b+'%';$('#fill0').style.width=a+'%';$('#fill1').style.width=b+'%';h.hp=hpKey}const title=s.pulse>0&&s.lastAward>=0?(s.lastAward===0?'Твой хранитель пробудился!':'Враг призвал хранителя!'):s.contested?'Святилище: спор':s.owner===0?'Святилище: твоё':s.owner===1?'Святилище: врага':s.candidate>=0?'Святилище: захват':'Святилище: нейтрально';const key=title+Math.ceil(s.next);if(h.shrine!==key){$('#ev').textContent=`${title} · ${Math.ceil(s.next)}с`;$('#el').style.width=`${100*(1-s.next/30)}%`;$('#bar').dataset.owner=String(s.owner);h.shrine=key}const key2=G.hand.map(id=>Math.ceil(G.cool[0][id])).join(',');if(h.runes!==key2){[...$('#hand').children].forEach((el,i)=>{const id=G.hand[i],v=G.cool[0][id],wait=Math.ceil(v);el.classList.toggle('lock',wait>0);el.querySelector('.ready-label').textContent=wait>0?`${wait}с`:'Готов';el.querySelector('.cooldown-track i').style.width=`${100*(1-v/CD[id])}%`;el.setAttribute('aria-disabled',String(wait>0));});h.runes=key2}}
ui();
