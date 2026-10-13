import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];BASE='http://127.0.0.1:8877';results=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  try:b=getattr(p,engine).launch(**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if engine=='chromium' else {}),headless=True)
  except Exception as e:results.append({'engine':engine,'blocked':str(e)});continue
  for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
   c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   try:
    pg.goto(BASE+'/probe');seed=json.loads((ROOT/'tests/lifecycle-save/fixtures'/f'{scope}-p1.json').read_text());pg.evaluate('(rows)=>{for(const [k,v]of rows)localStorage.setItem(k,v)}',seed);pg.goto(BASE+path)
    if scope=='preview':pg.locator('#collectibleUpgradeConfirm').click()
    pg.wait_for_function('!!window.__tzz && !!window.XingTu')
    for _ in range(3):
     for sel in ['#claim','#mOk','#mX']:
      if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
    gate=pg.evaluate('''()=>{const s=__tzz.state;s.pending=null;s.shops[3].open=true;s.shops[3].lv=49; if(!__tzz.persist())throw Error('persist49');return XingTu.open();}''');assert gate['ok']==False
    pg.evaluate("__tzz.state.shops[3].lv=50; if(!__tzz.persist())throw Error('persist50'); if(!XingTu.open().ok)throw Error('open');")
    pg.locator('#xingtuDepart').click();pg.wait_for_function('!!__tzz.state.space?.voyage');flight=pg.evaluate('__tzz.state.space.voyage');pg.locator('#xingtuClose').click();pg.reload();pg.wait_for_function('!!window.XingTu');assert pg.evaluate('__tzz.state.space.voyage.voyageId')==flight['voyageId']
    pg.evaluate('XingTu.open()');pg.wait_for_selector('#xingtuClaim',timeout=15000);pg.locator('#xingtuClaim').click();assert pg.evaluate('__tzz.state.space.pts')==8
    pg.evaluate('XingTu.close();XingTu.open()');assert pg.evaluate('__tzz.state.space.pts')==8
    # Actual second page steals native lock; hold it while stale callbacks attempt writes.
    pg.evaluate("window.__oldMoon=XingTu;window.__oldIntent=()=>__oldMoon.perform({type:'depart',route:'moon'});window.__oldData=JSON.stringify(Object.entries(localStorage).sort());")
    other=c.new_page();other.goto(BASE+'/probe');other.evaluate("""name=>{window.__stolen=false;navigator.locks.request(name,{steal:true},async()=>{window.__stolen=true;await new Promise(r=>window.__release=r);});} """,f'tangzhe:{scope}:collection-v1:writer');other.wait_for_function('__stolen');pg.wait_for_function("!(window.FormalCollectionRuntime||window.PreviewCollectionRuntime).ownsLock()")
    rejected=pg.evaluate("({save:__tzz.persist(),intent:__oldIntent().ok,unchanged:__oldData===JSON.stringify(Object.entries(localStorage).sort()),open:__oldMoon.isOpen()})");assert rejected=={'save':False,'intent':False,'unchanged':True,'open':False},rejected
    results.append({'engine':engine,'path':path,'pass':True,'roundtripPts':8,'nativeSteal':rejected,'pageErrors':errors})
   except Exception as e:results.append({'engine':engine,'path':path,'pass':False,'error':str(e),'pageErrors':errors})
   finally:c.close()
   print(json.dumps(results[-1],ensure_ascii=False),flush=True)
  b.close()
Path('/tmp/space-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
assert all(r.get('pass') for r in results),results
