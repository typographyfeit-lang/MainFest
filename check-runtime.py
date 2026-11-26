"""Browser integration against a non-rendering Three API double.
The browser environment blocks navigation; fetch is replaced by exact GLB ArrayBuffers, not fake geometries.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, re, base64
root=Path(__file__).resolve().parent
files={p.name:base64.b64encode(p.read_bytes()).decode() for p in root.glob('*.glb')}
stub=(root/'test-three-stub.js').read_text()
fetch_double='window.__requests=[];const _testFiles='+json.dumps(files)+';window.fetch=async url=>{const name=url.split("?")[0].split("/").pop();window.__requests.push(name);const s=_testFiles[name];return {ok:!!s,status:s?200:404,arrayBuffer:async()=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer}};'
html=(root/'index.html').read_text();html=re.sub(r'<link rel="stylesheet"[^>]+>','',html)
def replace(m):
 src=m.group(1)
 # Three.js (bundled three.min.js since 3.1, or a CDN URL) is replaced by the non-rendering double.
 if src.startswith('https://') or src.split('?')[0]=='three.min.js':return '<script>'+stub+'\n'+fetch_double+'</script>'
 return '<script>'+(root/src.split('?')[0]).read_text()+'</script>'
html=re.sub(r'<script src="([^"]+)"></script>',replace,html)
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']};
 if Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
 b=p.chromium.launch(**opts)
 pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
 pg.set_content(html,wait_until='load');assert pg.evaluate('V.ok'),errs
 pg.locator('#play').click();pg.wait_for_function('G!==null',timeout=10000);
 result=pg.evaluate('''()=>{G.paused=true;for(const [i,id] of Object.keys(CARDS).filter(k=>!CARDS[k].sp).entries()){const c=CARDS[id];G.u.push({...c,id,team:i%2,x:90+i*10,y:350,max:c.hp,cd:.4,rad:12})}G.fx.push({k:'c',x:80,y:340,r:25,l:.2,card:'spark'},{k:'l',a:G.tw[0],b:G.u[1],l:.08},{k:'m',a:G.u[0],b:G.u[1],l:.08});V.frame(G);G.shrine.owner=0;G.shrine.next=9;G.shrine.pulse=1;V.frame(G);G.tw[0].hp=0;G.u[0].hp-=20;V.frame(G);G.u=[];G.fx=[];V.frame(G);start();G.paused=true;V.frame(G);return {renderer:V.ok,unitsTested:8,towers:G.tw.length,frames:window.__frames,stats:V.stats(),assetsFetched:new Set(window.__requests).size}}''')
 assert pg.evaluate('Object.keys(V.stats().hdModels).length===1&&Object.keys(V.stats().characterModels).length===8');assert result['assetsFetched']==9,result;assert not errs,errs
 print(json.dumps({'test':'JS API integration, exact GLB ArrayBuffers via mocked fetch, NO WebGL',**result,'errors':errs},indent=2));b.close()
