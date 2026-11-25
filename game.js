'use strict';
// Block Arena — оригинальная игра жанра «колода + эликсир + башни». Сцена и интерфейс используют локальные атласы.
const W=360,H=560,RY=280,RW=16,BR=[90,270];
const $=s=>document.querySelector(s),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rnd=(a,b)=>a+Math.random()*(b-a);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};

// c — цена, hp, d — урон, r — дальность, s — скорость, as — пауза атаки, k — число юнитов,
// bld — бьёт только башни, boom — радиус взрыва (камикадзе), spl — радиус сплэша, sp — заклинание
const CARDS={
 guard:{n:'Страж',ic:'🛡️',c:3,hp:420,d:55,r:12,s:38,as:1.1,k:1,col:'#7b8794',hd:'#d2a679'},
 archer:{n:'Лучники',ic:'🏹',c:3,hp:130,d:28,r:100,s:34,as:1,k:2,col:'#4e9a4e',hd:'#d2a679'},
 colossus:{n:'Колосс',ic:'🗿',c:5,hp:1500,d:90,r:14,s:24,as:1.6,k:1,bld:1,big:1,col:'#8d8d8d',hd:'#a9a9a9'},
 imp:{n:'Бес-подрывник',ic:'🧨',c:2,hp:80,d:250,r:12,s:72,as:1,k:1,boom:30,col:'#d9602a',hd:'#f08a4b'},
 mage:{n:'Маг огня',ic:'🔥',c:4,hp:190,d:65,r:95,s:30,as:1.4,k:1,spl:28,col:'#a04ad9',hd:'#d2a679'},
 hounds:{n:'Гончие',ic:'🐺',c:3,hp:100,d:28,r:12,s:75,as:.8,k:3,col:'#b0b0b8',hd:'#c8c8d0'},
 swarm:{n:'Рой',ic:'🪨',c:2,hp:45,d:18,r:12,s:52,as:.9,k:4,col:'#6b5b4b',hd:'#8a7866'},
 brute:{n:'Громила',ic:'🧱',c:4,hp:800,d:95,r:14,s:30,as:1.3,k:1,big:1,col:'#a8553a',hd:'#d2a679'},
 meteor:{n:'Метеорит',ic:'☄️',c:4,sp:1,d:250,rad:50},
 spark:{n:'Искра',ic:'⚡',c:3,sp:1,d:170,rad:28}
};
const START=['guard','archer','colossus','imp','mage','hounds','swarm','meteor'];

// ---------- Сохранение и меню ----------
let S;try{S=JSON.parse(localStorage.getItem('ba1'))}catch(e){}
S=S||{tr:0,coin:150,own:[...START],deck:[...START]};
const save=()=>{try{localStorage.setItem('ba1',JSON.stringify(S))}catch(e){}};
let pick=null;
function cardEl(id, state = '') {
 const card = CARDS[id], style = ArenaArt.portraitStyle(id);
 return `<button type="button" class="card ${state}" data-id="${id}" aria-label="${card.n}, эликсир ${card.c}">
   <b class="cost">${card.c}</b><i class="portrait${style ? '' : ' fallback'}" aria-hidden="true" style="${style}">${style ? '' : card.ic}</i>
   <span class="card-name">${card.n}</span></button>`;
}
function ui(){
 $('#tr').textContent=S.tr;$('#co').textContent=S.coin;
 $('#deck').innerHTML=S.deck.map(id=>cardEl(id)).join('');
 $('#coll').innerHTML=Object.keys(CARDS).filter(id=>!S.deck.includes(id)).map(id=>cardEl(id,(S.own.includes(id)?'':'lock ')+(pick==id?'sel':''))).join('');
}
$('#deck').onclick=e=>{const c=e.target.closest('.card');if(!c||!pick)return;S.deck[[...c.parentNode.children].indexOf(c)]=pick;pick=null;save();ui()};
$('#coll').onclick=e=>{const c=e.target.closest('.card');if(c&&S.own.includes(c.dataset.id)){pick=c.dataset.id;ui()}};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('on'));
 b.classList.add('on');$('#'+b.dataset.t).classList.add('on')});
$('#chest').onclick=()=>{
 const m=$('#shopmsg'),l=Object.keys(CARDS).filter(id=>!S.own.includes(id));
 if(S.coin<100)return m.textContent='Не хватает монет';
 if(!l.length)return m.textContent='Все карты уже открыты!';
 const id=l[Math.random()*l.length|0];S.coin-=100;S.own.push(id);save();ui();
 m.textContent='Новая карта: '+CARDS[id].ic+' '+CARDS[id].n};

// ---------- Бой ----------
const cv=$('#cv'),ctx=cv.getContext('2d');let G=null, animation=0;
let pointer=null;
const tower=(team,x,y,king)=>({team,x,y,king:!!king,hp:king?2400:1400,max:king?2400:1400,rad:king?22:18,r:130,d:king?60:50,as:king?1:.8,cd:0});
const crowns=t=>Math.min(3,G.tw.filter(o=>o.team!==t&&o.hp<=0).reduce((s,o)=>s+(o.king?3:1),0));

function spawn(id,team,x,y){const c=CARDS[id];
 for(let i=0;i<c.k;i++)G.u.push({...c,id,team,x:x+(i-(c.k-1)/2)*14+rnd(-3,3),y:y+rnd(-6,6),max:c.hp,cd:.5,rad:c.big?12:8,phase:x+y+i*2,moving:false})}

function blast(x,y,r,d,team,m,card){G.fx.push({k:'c',x,y,r,l:.3,card});
 for(const o of[...G.u,...G.tw])if(o.team!==team&&o.hp>0&&Math.hypot(o.x-x,o.y-y)<=r+o.rad)o.hp-=d*(o.king===undefined?1:m)}

function createTowers() {
 return [tower(0,90,455),tower(0,270,455),tower(0,180,515,1),
   tower(1,90,105),tower(1,270,105),tower(1,180,45,1)];
}
function start(){
 const q=shuffle([...S.deck]);
 G={t:180,e:5,ae:5,q,hand:q.splice(0,4),u:[],fx:[],sel:-1,at:3,done:0,last:performance.now(),
  ai:Object.keys(CARDS).filter(k=>!CARDS[k].sp),
  tw:createTowers()};
 pointer=null;
 $('#game').hidden=false;$('#res').hidden=true;
 ArenaArt.surface(cv,W,H);hand();draw();upd();
 animation=requestAnimationFrame(loop)}
function hand(){
 $('#hand').innerHTML=G.hand.map((id,i)=>cardEl(id,G.sel==i?'sel':'')).join('');
 const next=$('#next-card'), id=G.q[0];
 next.style.cssText=ArenaArt.portraitStyle(id);
 next.classList.toggle('fallback',!next.style.cssText);
 next.textContent=next.style.cssText?'':CARDS[id].ic;
 next.setAttribute('role','img');
 next.setAttribute('aria-label',CARDS[id].n);
 next.title=CARDS[id].n;
}
$('#hand').onclick=e=>{const c=e.target.closest('.card');if(c&&G&&!G.done){G.sel=[...c.parentNode.children].indexOf(c);hand()}};
function boardPoint(e) {
 const r=cv.getBoundingClientRect();
 return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
}
cv.onpointermove=e=>{pointer=e.pointerType==='touch'?null:boardPoint(e)};
cv.onpointerleave=()=>{pointer=null};
cv.onpointerdown=e=>{
 if(!G||G.done||G.sel<0)return;
 const {x,y}=boardPoint(e),id=G.hand[G.sel],c=CARDS[id];
 if(G.e<c.c||(!c.sp&&y<RY+RW+10))return;
 G.e-=c.c;c.sp?blast(x,y,c.rad,c.d,0,.4,id):spawn(id,0,Math.max(12,Math.min(W-12,x)),Math.min(H-12,y));
 G.hand[G.sel]=G.q.shift();G.q.push(id);G.sel=-1;hand()};

function loop(now){if(!G)return;const dt=Math.min(.05,(now-G.last)/1000);G.last=now;
 if(!G.done)step(dt);draw();upd();if(!G.done)animation=requestAnimationFrame(loop)}

function step(dt){
 G.t-=dt;const rt=G.t<60?1/1.4:1/2.8;G.e=Math.min(10,G.e+dt*rt);G.ae=Math.min(10,G.ae+dt*rt);
 if((G.at-=dt)<=0){ // простой бот-соперник
  const o=G.ai.filter(i=>CARDS[i].c<=G.ae);
  if(o.length){const id=o[Math.random()*o.length|0];G.ae-=CARDS[id].c;spawn(id,1,BR[Math.random()*2|0]+rnd(-30,30),rnd(120,200))}
  G.at=rnd(2,4.5)}
 G.u.forEach(u=>act(u,dt));G.tw.forEach(t=>t.hp>0&&tow(t,dt));
 sep();G.u=G.u.filter(u=>u.hp>0);G.fx.forEach(f=>f.l-=dt);G.fx=G.fx.filter(f=>f.l>0);
 if(G.tw[2].hp<=0||G.tw[5].hp<=0||G.t<=0)end()}

function act(u,dt){
 if(u.hp<=0)return;u.moving=false;u.cd-=dt;let tg=null,bd=1e9;
 if(!u.bld)for(const o of G.u)if(o.team!==u.team&&o.hp>0){const d=dist(u,o)-o.rad;if(d<bd&&d<90){bd=d;tg=o}}
 if(!tg)for(const o of G.tw)if(o.team!==u.team&&o.hp>0){const d=dist(u,o)-o.rad;if(d<bd){bd=d;tg=o}}
 if(!tg)return;
 if(bd<=u.r){
  if(u.cd>0)return;u.cd=u.as;
  if(u.boom){blast(u.x,u.y,u.boom,u.d,u.team,1);u.hp=0}
  else{u.spl?blast(tg.x,tg.y,u.spl,u.d,u.team,1):tg.hp-=u.d;if(u.r>40)G.fx.push({k:'l',a:u,b:tg,l:.1})}
 }else{
  let tx=tg.x,ty=tg.y;
  if((u.y-RY)*(ty-RY)<0){tx=BR[Math.abs(u.x-BR[0])<Math.abs(u.x-BR[1])?0:1];ty=RY} // идти к мосту
  const d=Math.hypot(tx-u.x,ty-u.y)||1,nx=u.x+(tx-u.x)/d*u.s*dt;let ny=u.y+(ty-u.y)/d*u.s*dt;
  if(Math.abs(ny-RY)<RW&&Math.abs(nx-BR[0])>24&&Math.abs(nx-BR[1])>24)ny=u.y; // в реку нельзя
  u.moving=nx!==u.x||ny!==u.y;u.x=nx;u.y=ny}}

function tow(t,dt){t.cd-=dt;let tg=null,bd=t.r;
 for(const o of G.u)if(o.team!==t.team&&o.hp>0){const d=dist(t,o);if(d<bd){bd=d;tg=o}}
 if(tg&&t.cd<=0){t.cd=t.as;tg.hp-=t.d;G.fx.push({k:'l',a:t,b:tg,l:.1})}}

function sep(){for(let i=0;i<G.u.length;i++)for(let j=i+1;j<G.u.length;j++){
 const a=G.u[i],b=G.u[j],d=dist(a,b),m=a.rad+b.rad;
 if(d<m&&d>0){const p=(m-d)/d/4,dx=(a.x-b.x)*p,dy=(a.y-b.y)*p;a.x+=dx;a.y+=dy;b.x-=dx;b.y-=dy}}}

function end(){
 const a=crowns(0),b=crowns(1),hp=t=>G.tw.filter(o=>o.team===t).reduce((s,o)=>s+Math.max(0,o.hp),0);
 const r=a!==b?(a>b?1:-1):hp(0)!==hp(1)?(hp(0)>hp(1)?1:-1):0;
 G.done=1;S.tr=Math.max(0,S.tr+(r>0?30:r<0?-20:0));S.coin+=r>0?60:20;save();ui();
 $('#rt').textContent=r>0?'ПОБЕДА! 👑':r<0?'ПОРАЖЕНИЕ':'НИЧЬЯ';
 $('#rp').textContent=`Короны ${a}:${b} · ${r>0?'+30 🏆 +60 🪙':r<0?'−20 🏆 +20 🪙':'+20 🪙'}`;
 $('#res').hidden=false}
$('#rb').onclick=()=>{cancelAnimationFrame(animation);G=null;$('#game').hidden=true;$('#res').hidden=true};
$('#play').onclick=start;

// ---------- Поле, фигуры и интерфейс боя ----------
function deployment() {
 if(G.sel<0)return;
 const card=CARDS[G.hand[G.sel]], boundary=RY+RW+10;
 ctx.save();
 if(!card.sp) {
  ctx.fillStyle='#51292e30';
  ctx.fillRect(0,0,W,boundary);
  ctx.setLineDash([4,4]);
  ctx.strokeStyle='#fff4cbbf';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,boundary);ctx.lineTo(W,boundary);ctx.stroke();
 }
 if(pointer && G.e>=card.c && (card.sp || pointer.y>=boundary)) {
  ctx.beginPath();
  ctx.arc(pointer.x,pointer.y,card.sp?card.rad:12,0,Math.PI*2);
  ctx.fillStyle='#fff4c52c';ctx.fill();
  ctx.strokeStyle='#fff9d9';ctx.lineWidth=1.5;ctx.stroke();
 }
 ctx.restore();
}
function draw() {
 const elapsed=180-G.t;
 ctx.drawImage(ArenaArt.ground,0,0,W,H);
 ArenaArt.water(ctx,elapsed,W,RY,RW,BR);
 deployment();
 const objects=[...G.tw,...G.u].sort((a,b)=>a.y-b.y);
 for(const o of objects) {
  if(o.king===undefined) ArenaArt.troop(ctx,o,elapsed);
  else ArenaArt.tower(ctx,o);
 }
 for(const fx of G.fx)ArenaArt.effect(ctx,fx);
}
const hud={time:$('#time'),double:$('#double'),home:$('#home-score'),away:$('#away-score'),
 fill:$('#el'),energy:$('#ev'),hand:$('#hand')};
function value(el,text){if(el.textContent!==String(text))el.textContent=text}
function upd(){
 const t=Math.max(0,Math.ceil(G.t));
 value(hud.time,`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`);
 hud.double.hidden=G.t>=60;
 value(hud.home,crowns(0));value(hud.away,crowns(1));
 hud.fill.style.width=(G.e*10).toFixed(2)+'%';value(hud.energy,Math.floor(G.e));
 for(let i=0;i<G.hand.length;i++)hud.hand.children[i].classList.toggle('lock',CARDS[G.hand[i]].c>G.e);
}
new ResizeObserver(()=>{
 if(G){ArenaArt.surface(cv,W,H);draw()}
}).observe(cv);
ui();
ArenaArt.ready.then(()=>{
 ArenaArt.prepareGround(W,H,RY,RW,BR,createTowers());
 $('#play').disabled=false;
}).catch(()=>{$('#load-error').hidden=false});
