"""Serial baseline/candidate 120-second actual-page samples, 4x CPU, synthetic large P1 save.
Only instrumentation is try/finally timing around actual persist; never alters storage semantics.
"""
import json,re,os,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('AUTOSAVE_EVIDENCE_DIR','/tmp/autosave15'));OUT.mkdir(parents=True,exist_ok=True)
seed=Path(os.environ.get('AUTOSAVE_LARGE_FIXTURE',str(Path(__file__).with_name('fixtures')/'large-p1.json'))).read_text();results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for label,port in [('baseline',8866),('candidate',8765)]:
  c=b.new_context(viewport={'width':390,'height':844});c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const [k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}')
  def instrument(route):
   r=route.fetch();source=r.text();match=re.search(r'function persist\(\) \{[\s\S]*?\n\}',source);assert match
   fn=match[0];wrapped=fn.replace('function persist() {','function persist() { const sampleStart=performance.now();try {',1)[:-1]+"}finally{(window.__saveSamples??=[]).push({at:sampleStart,ms:performance.now()-sampleStart,stack:new Error().stack});}}"
   route.fulfill(response=r,body=source[:match.start()]+wrapped+source[match.end():])
  c.route(re.compile(r'/app\.js\?'),instrument);pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4});pg.goto(f'http://127.0.0.1:{port}/');pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
  for _ in range(4):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click();pg.wait_for_timeout(100)
  pg.evaluate('''()=>{__tzz.persist();window.__saveSamples=[];window.__longTasks=[];window.__observe=new PerformanceObserver(l=>__longTasks.push(...l.getEntries().map(x=>({at:x.startTime,ms:x.duration}))));__observe.observe({type:'longtask'});window.__start=performance.now();}''')
  for segment in range(4):
   pg.wait_for_timeout(30000);print(json.dumps({'label':label,'elapsed':30*(segment+1),'saves':pg.evaluate('__saveSamples.length')}),flush=True)
  data=pg.evaluate('''()=>{__observe.disconnect();return {samples:__saveSamples,longTasks:__longTasks,elapsed:performance.now()-__start,blocked:__tzz.saveBlocked,bytes:localStorage.getItem(__tzz.SAVE_KEY).length,owned:__tzz.state.gacha.owned.length};}''');assert not data['blocked'] and not errors;data.update({'label':label,'cpuThrottle':4,'errors':errors,'browser':b.version});results.append(data);c.close()
 b.close()
(OUT/'long-run.json').write_text(json.dumps(results,indent=2));print(json.dumps([{'label':r['label'],'saves':len(r['samples']),'medianMs':statistics.median(s['ms'] for s in r['samples'])} for r in results]),flush=True)
