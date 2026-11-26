"""Regression test of game.js 2.9 + HTML/CSS; deliberately mocks V (no WebGL claims)."""
import json, os, pathlib
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parent
def run():
    import re, base64
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="style.css(?:\?[^"]*)?">',lambda _: '<style>'+ (ROOT/'style.css').read_text().replace('cards-v27.svg','data:image/svg+xml;base64,'+base64.b64encode((ROOT/'cards-v27.svg').read_bytes()).decode())+'</style>',html)
    html=re.sub(r'<script src="[^"]+"></script>', '',html)
    mock="""Object.defineProperty(window,'localStorage',{value:{_m:new Map(),getItem(k){return this._m.get(k)||null},setItem(k,v){this._m.set(k,String(v))}}}); const V={ok:true,begin(g){window.__lastGame=g;window.ArenaAudio.begin(g)},frame(){},pick(){return window.__pick||{x:90,y:400}}};"""
    html=html.replace('</body>','<script>'+mock+'</script><script>'+(ROOT/'audio.js').read_text()+'</script><script>'+(ROOT/'game.js').read_text()+'</script></body>')
    results=[]
    with sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox']}
        if os.path.exists('/usr/bin/chromium'):launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch)
        for w in [320,375,390,430,480]:
            page=browser.new_page(viewport={'width':w,'height':int(w*2.12)},device_scale_factor=1)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(html,wait_until='load');page.locator('#play').click();page.wait_for_function('G !== null')
            res=page.evaluate('''() => {
                const assert=(v,m)=>{if(!v)throw Error(m)};
                assert(G.tw.length===6,'tower count');
                assert(JSON.stringify(G.tw.map(t=>[t.x,t.y,t.hp,t.rad]))===JSON.stringify([[90,455,1400,24],[270,455,1400,24],[180,515,2400,30],[90,105,1400,24],[270,105,1400,24],[180,45,2400,30]]),'tower coordinates and stats');
                assert(G.hand.length===4&&G.q.length===4,'deck');assert([...document.querySelectorAll('#hand .card em')].every(e=>getComputedStyle(e).backgroundImage.includes('data:image/svg+xml')),'illustrated cards');const audio=document.querySelector('#sound');const old=audio.getAttribute('aria-pressed');audio.click();assert(audio.getAttribute('aria-pressed')!==old,'audio toggle');audio.click();
                assert(G.t>179&&G.t<=180,'timer');
                G.hand[0]='guard';G.sel=0;G.e=5;window.__pick={x:90,y:140};cv.onpointerdown({});cv.onpointerup({});assert(G.u.length===0&&G.e===5,'enemy placement prohibited');
                window.__pick={x:90,y:400};cv.onpointerdown({});assert(G.u.length===0&&G.e===5,'preview does not spend');cv.onpointerup({});assert(G.u.length===1&&G.u[0].id==='guard'&&G.e===2,'unit placement and elixir');
                G.hand[0]='meteor';G.sel=0;G.e=5;window.__pick={x:-10,y:105};cv.onpointerdown({});cv.onpointerup({});assert(G.e===5&&G.sel===0,'outside spell rejected');window.__pick={x:90,y:105};cv.onpointerdown({});cv.onpointerup({});assert(G.tw[3].hp===1300&&G.e===1,'spell damage and cost');
                G.e=5;G.hand[0]='guard';G.sel=0;cv.onpointerdown({});cancelGesture();cv.onpointerup({});assert(G.e===5&&G.u.length===1,'cancel placement');G.e=0;G.hand[0]='guard';G.sel=0;window.__pick={x:90,y:400};cv.onpointerdown({});cv.onpointerup({});assert(G.u.length===1,'insufficient elixir');
                const rr=cv.getBoundingClientRect(), hud=document.querySelector('#hud').getBoundingClientRect(), hand=document.querySelector('#hand').getBoundingClientRect();
                assert(rr.width<=innerWidth&&rr.height>0&&rr.top>=hud.bottom-.5&&rr.bottom<=hand.top,'canvas layout');
                assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
                // Existing pathing: center river gate cannot be crossed; lane can be crossed.
                G.u=[];const p={...CARDS.colossus,id:'colossus',team:0,x:180,y:296.1,rad:19,max:1500,cd:0};G.tw=[{...tower(1,180,100),hp:1400}];act(p,.1);assert(p.y===296.1,'center blocked');
                p.x=90;p.y=296.1;act(p,.1);assert(p.y<296.1,'bridge passage');const edge={x:-4,y:560,rad:12};constrain(edge,12,548);assert(edge.x===12&&edge.y===548,'field bounds');const push={x:160,y:285,rad:12};constrain(push,160,298);assert(push.y===298,'water displacement rejected');
                G.tw=[tower(0,90,455),tower(0,270,455),tower(0,180,515,1),tower(1,90,105),tower(1,270,105),tower(1,180,45,1)];G.tw[5].hp=0;const oldCoin=S.coin;end();assert(G.done&&S.coin===oldCoin+60,'victory/reward');end();assert(S.coin===oldCoin+60,'reward only once');assert(JSON.parse(localStorage.getItem('ba1')).coin===S.coin,'save');
                document.querySelector('#rb').click();assert(G===null&&document.querySelector('#game').hidden,'return');start();assert(G.tw.length===6&&G.u.length===0&&G.done===0,'restart');cancelAnimationFrame(raf);raf=0;const before=G.t;const now=G.last+200;loop(now);cancelAnimationFrame(raf);raf=0;assert(Math.abs((before-G.t)-.2)<.001,'fixed step advances full .2 s at 5 FPS');
                return {width:innerWidth,canvas:[Math.round(rr.width),Math.round(rr.height)],result:'PASS'};
            }''')
            assert not errors,errors
            results.append(res);page.close()
        browser.close()
    print(json.dumps({'test':'logic+DOM+card atlas+audio toggle; V and localStorage mocked; no WebGL','viewports':results},ensure_ascii=False,indent=2))

if __name__=='__main__':run()
