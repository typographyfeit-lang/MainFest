"""DOM/logic regression against a mock renderer; no WebGL claims."""
import json, re, base64
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text()
css=(root/'style.css').read_text().replace('cards-v27.svg','data:image/svg+xml;base64,'+base64.b64encode((root/'cards-v27.svg').read_bytes()).decode())
html=re.sub(r'<link rel="stylesheet"[^>]*>','<style>'+css+'</style>',html)
html=re.sub(r'<script src="[^"]+"></script>','',html)
mock="""Object.defineProperty(window,'localStorage',{value:{_m:new Map([['ba1',JSON.stringify({tr:120,coin:210,own:['brute'],deck:['brute','archer','guard','meteor','mage','colossus','imp','swarm']})]]),getItem(k){return this._m.get(k)||null},setItem(k,v){this._m.set(k,String(v))}}});const V={ok:true,begin(){},frame(){},stop(){},preview(){},pick(){return window.__pick||{x:180,y:340}}};"""
html=html.replace('</body>','<script>'+mock+'</script><script>'+(root/'audio.js').read_text()+'</script><script>'+(root/'game.js').read_text()+'</script></body>')
results=[]
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']}
 if Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
 b=p.chromium.launch(**opts)
 for w in [320,375,390,430,480]:
  pg=b.new_page(viewport={'width':w,'height':int(w*2.12)},device_scale_factor=1);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.set_content(html,wait_until='load');pg.locator('#play').click();pg.wait_for_function('G!==null');
  res=pg.evaluate('''()=>{const assert=(v,m)=>{if(!v)throw Error(m)};cancelAnimationFrame(raf);raf=0;
    assert(S.coin===210&&S.tr===120&&S.own.includes('brute')&&S.deck.length===4,'migration');assert(JSON.parse(localStorage.getItem('ba1')).deck.length===8,'legacy retained');assert(G.tw.length===6&&G.hand.length===4,'structures and fixed squad');assert(JSON.stringify(G.tw.map(t=>[t.x,t.y]))===JSON.stringify([[53,391],[307,391],[180,508],[53,169],[307,169],[180,52]]),'new geometry');assert(G.t<=180&&G.t>179,'timer');assert(!('e' in G)&&!('q' in G),'no shared elixir or card queue');
    const r=cv.getBoundingClientRect(),hud=document.querySelector('#hud').getBoundingClientRect(),handRect=document.querySelector('#hand').getBoundingClientRect();assert(r.top>=hud.bottom&&r.bottom<=handRect.top+.5&&r.width<=innerWidth&&r.height>0,'layout');assert(document.documentElement.scrollWidth<=innerWidth,'no overflow');
    const guard=G.hand.indexOf('guard');G.sel=guard;window.__pick={x:180,y:150};cv.onpointerdown({});cv.onpointerup({});assert(!G.u.length&&G.cool[0].guard===0,'enemy zone forbidden');window.__pick={x:180,y:350};cv.onpointerdown({});assert(!G.u.length,'preview free');cv.onpointerup({});assert(G.u.length===1&&G.cool[0].guard===CD.guard,'confirmed summon');assert(G.hand[guard]==='guard','same rune stays');assert(!playRune(0,'guard',{x:180,y:350}),'cooldown blocks repeat');G.at=1000;G.u=[];step(.1);assert(G.cool[0].guard<CD.guard,'independent recharge');assert(G.cool[0].archer===0,'other rune ready');
    const meteor=G.hand.indexOf('meteor');G.sel=meteor;window.__pick={x:-10,y:52};cv.onpointerdown({});cv.onpointerup({});assert(G.cool[0].meteor===0,'outside spell rejected');window.__pick={x:180,y:52};cv.onpointerdown({});cancelGesture();cv.onpointerup({});assert(G.cool[0].meteor===0,'cancel free');cv.onpointerdown({});cv.onpointerup({});assert(G.cool[0].meteor===CD.meteor&&core(1).hp===3500,'spell and cooldown');
    const unit=(team,x=180,y=280)=>({...CARDS.guard,id:'guard',team,x,y,rad:12,max:420,cd:0,path:'center'});
    G.u=[unit(0)];G.shrine.next=2;for(let i=0;i<50;i++)shrineStep(1/30);assert(G.shrine.owner===0,'exclusive capture');G.u.push(unit(1));shrineStep(.1);assert(G.shrine.owner===-1&&G.shrine.contested,'contest resets');G.shrine.next=.01;shrineStep(.02);assert(G.shrine.awards[0]+G.shrine.awards[1]===0,'contested no reward');
    G.u=[unit(1)];G.shrine.next=2;for(let i=0;i<60;i++)shrineStep(1/30);assert(G.shrine.awards[1]===1&&G.shrine.owner===-1&&G.u.filter(u=>u.bonus).length===1,'guardian and reset');assert(G.u[0].path==='attack','release center units after pulse');G.u=G.u.filter(u=>u.bonus);shrineStep(2);assert(G.shrine.owner===-1,'guardian cannot capture');
    G.u=[];const center=unit(0,180,350);for(let i=0;i<100;i++)act(center,1/30);assert(dist(center,SHRINE)<54,'center auto route');const flank=unit(0,96,350);flank.path='left';for(let i=0;i<100;i++)act(flank,1/30);assert(flank.x<130&&flank.y<260,'flank route');const touch=unit(0,53,391);constrain(touch,53,425);assert(dist(touch,G.tw[0])>=28,'structure collision');const rear=unit(0,180,548);rear.rad=12;constrain(rear,180,560);for(let i=0;i<240;i++)act(rear,1/30);assert(rear.y<420,'bypass own core');
    // Timeout uses only core health, not obelisk count; no duplicate rewards.
    G.tw[0].hp=0;G.tw[1].hp=0;core(0).hp=2200;core(1).hp=2000;G.t=.01;const coins=S.coin;step(FIXED);assert(G.done&&G.result===1&&S.coin===coins+60,'timeout core ratio');end();assert(S.coin===coins+60,'reward once');assert(JSON.parse(localStorage.getItem(SAVE)).coin===S.coin,'save');document.querySelector('#rb').click();assert(G===null,'exit');start();cancelAnimationFrame(raf);raf=0;assert(G.u.length===0&&G.shrine.next===30&&G.hand.length===4,'restart');
    // 3.1: pause, final minute, fortified core, rune levels, backup code, varied bot squads.
    G.at=1000;G.paused=true;assert(!playRune(0,G.hand[0],{x:180,y:400}),'pause blocks runes');G.paused=false;
    setPaused(true);assert(!document.querySelector('#pausemenu').hidden&&G.menu,'pause menu');setPaused(false);assert(document.querySelector('#pausemenu').hidden&&!G.paused,'resume');
    const id0=G.hand.find(id=>!CARDS[id].sp);assert(playRune(0,id0,{x:180,y:400}),'summon');const before=G.cool[0][id0];G.t=FINAL-1;step(FIXED);assert(Math.abs((before-G.cool[0][id0])-2*FIXED)<1e-6,'final minute doubles recharge');
    const k=core(1),as=k.as,dmg=k.d,range=k.r;G.tw[3].hp=0;step(FIXED);assert(G.rage[1]>0&&k.as<as&&k.d>dmg&&k.r>range,'obelisk loss fortifies its core');
    S.lv[id0]=3;assert(Math.abs(levelMult(levelOf(id0))-1.14)<1e-9,'rune level multiplier');
    const code=exportCode(),back=importCode(code);assert(back&&back.lv[id0]===3&&back.coin===S.coin,'backup code round trip');assert(importCode(code.replace(/[.][a-z0-9]+$/,'.0'))===null,'checksum rejects edits');
    const decks=new Set();for(let i=0;i<40;i++)decks.add(pickAiDeck().join());assert(decks.size>=3,'bot squads vary');
    S.lv[id0]=1;document.querySelector('#rb').click();assert(G===null,'leave');
    return {width:innerWidth,canvas:[Math.round(r.width),Math.round(r.height)],status:'PASS'};}''')
  assert not errs,errs;results.append(res);pg.close()
 b.close()
print(json.dumps({'test':'DOM and gameplay; renderer mocked', 'results':results},ensure_ascii=False,indent=2))
