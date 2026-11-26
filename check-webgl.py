"""Run with Chromium + Playwright + Internet, or --three /path/to/three.min.js (r128).
Captures real WebGL screenshots and renderer.info. Not a mobile-device benchmark.
"""
import argparse,json,os,pathlib,threading
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent

def run():
    parser=argparse.ArgumentParser();parser.add_argument('--three',type=pathlib.Path);parser.add_argument('--out',type=pathlib.Path,default=ROOT/'test-output');parser.add_argument('--quality',choices=['low','medium','high'],default='medium');args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/?quality={args.quality}'
    results=[]
    try:
        with sync_playwright() as p:
            launch={'headless':True,'args':['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
            if os.path.exists('/usr/bin/chromium'):launch['executable_path']='/usr/bin/chromium'
            browser=p.chromium.launch(**launch)
            for w in [320,375,390,430,480]:
                page=browser.new_page(viewport={'width':w,'height':round(w*2.12)},device_scale_factor=2);errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
                if args.three:page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=args.three.read_bytes()))
                page.goto(base,wait_until='load',timeout=30000)
                assert page.evaluate('typeof V !== "undefined" && V.ok===true'),f'WebGL renderer failed: {errors}'
                assert page.evaluate('THREE.REVISION')=='128','Expected Three.js r128'
                page.locator('#play').click();page.wait_for_function('G !== null',timeout=30000);page.evaluate('G.paused=true') # freeze simulation, not the rendering loop
                page.wait_for_timeout(2200)
                result=page.evaluate('''()=>{
                  const assert=(v,m)=>{if(!v)throw Error(m)};
                  assert(G.tw.length===6,'tower count');assert(Object.keys(V.stats().characterModels).length===8,'all eight skeletal GLB loaded');
                  for(const t of G.tw){for(const h of [0,t.king?122:91]){const p=V.project(t.x,t.y,h);assert(Math.abs(p.ndcX)<1&&Math.abs(p.ndcY)<1&&p.ndcZ<1,'tower clipped')}}
                  for(const [x,z] of [[90,105],[270,455],[180,280],[40,350],[320,420]]){const p=V.project(x,z),q=V.pick(p);assert(q&&Math.hypot(q.x-x,q.y-z)<.01,'raycast round-trip')}
                  const rect=cv.getBoundingClientRect();assert(rect.width<=innerWidth&&rect.height>0&&document.documentElement.scrollWidth<=innerWidth,'layout');
                  return {width:innerWidth,empty:V.stats()};
                }''')
                page.locator('#cv').screenshot(path=str(args.out/f'arena-{w}.png'),timeout=30000)
                if w==390:
                    page.evaluate('''()=>{let i=0;for(const id of Object.keys(CARDS).filter(k=>!CARDS[k].sp)){for(let j=0;j<(i<4?3:2);j++){const c=CARDS[id];G.u.push({...c,id,team:j%2,x:55+(G.u.length%5)*62,y:140+Math.floor(G.u.length/5)*83,max:c.hp,cd:.4,rad:c.big?19:c.k>2?10:12})}i++}G.tw[0].hp=1000;G.tw[3].hp=900;}''')
                    page.wait_for_timeout(2500);result['stress']=page.evaluate('V.stats()');page.locator('#cv').screenshot(path=str(args.out/'arena-390-stress.png'),timeout=30000)
                    page.evaluate('G.tw[3].hp=0');page.wait_for_timeout(500);page.locator('#cv').screenshot(path=str(args.out/'arena-390-destroyed.png'),timeout=30000)
                    page.evaluate('document.querySelector("#rb").click();start();G.paused=true');page.wait_for_timeout(1000);assert page.evaluate('G.tw.every(t=>t.hp===t.max)&&G.u.length===0'),'restart'
                result['errors']=errors;assert not errors,errors;results.append(result);page.close()
            browser.close()
    finally:server.shutdown()
    (args.out/'webgl-report.json').write_text(json.dumps({'browser':'Chromium headless, software WebGL; not physical mobile FPS','results':results},ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))
if __name__=='__main__':run()
