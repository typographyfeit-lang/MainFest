from playwright.sync_api import sync_playwright
from pathlib import Path
import re,json
root=Path(__file__).resolve().parent; stub=(root/'test-three-stub.js').read_text()
html=(root/'index.html').read_text(); html=re.sub(r'<link rel="stylesheet"[^>]+>','',html)
def replace(m):
 src=m.group(1)
 if src.startswith('https://'):return '<script>'+stub+'</script>'
 return '<script>'+(root/src.split('?')[0]).read_text()+'</script>'
html=re.sub(r'<script src="([^"]+)"></script>',replace,html)
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']};
 if Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
 b=p.chromium.launch(**opts)
 pg=b.new_page(viewport={'width':390,'height':844}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
 pg.set_content(html,wait_until='load');print('renderer',pg.evaluate('({ok:V.ok,error:V.error||null})'));assert pg.evaluate('V.ok'),errs
 result=pg.evaluate('''()=>{start();G.done=1;for(const [i,id] of Object.keys(CARDS).filter(k=>!CARDS[k].sp).entries()){const c=CARDS[id];G.u.push({...c,id,team:i%2,x:90+i*10,y:350,max:c.hp,cd:.4,rad:12})}G.fx.push({k:'c',x:80,y:340,r:25,l:.2},{k:'l',a:G.tw[0],b:G.u[1],l:.08});V.frame(G);G.tw[0].hp=0;V.frame(G);G.u=[];G.fx=[];V.frame(G);start();G.done=1;V.frame(G);return {renderer:V.ok,unitsTested:8,towers:G.tw.length,frames:window.__frames}}''')
 assert pg.evaluate('JSON.stringify(V.stats().hdModels)===JSON.stringify({"guardian-hd":2388,"citadel-hd":5404})');assert not errs,errs;print(json.dumps({'test':'renderer JavaScript integration with non-rendering Three API double; not WebGL',**result,'errors':errs},indent=2));b.close()
