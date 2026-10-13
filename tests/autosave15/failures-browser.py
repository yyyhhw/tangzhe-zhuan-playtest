"""Actual coordinator failure/readback/lease tests, fresh synthetic storage for every case."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/autosave15');CONTROL=Path(__file__).with_name('browser.py').read_text().split("CONTROL='''",1)[1].split("'''",1)[0];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal','/'),('preview','/preview/')]:
  for fault in ['backup-write','main-readback','lease-loss']:
   c=b.new_context();seed=(OUT/f'blindbox18-{scope}-p1.json').read_text();c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const [k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}');c.add_init_script(CONTROL)
   pg=c.new_page();pg.goto('http://127.0.0.1:8765'+path);pg.locator('#collectibleUpgradeConfirm').click(force=True);pg.wait_for_function('!!window.__tzz',polling=50)
   for _ in range(4):
    for sel in ['#claim','#mOk','#mX']:
     if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
   pg.evaluate('''fault=>{__tzz.persist();window.__attempts=[];window.__baselineRaw=localStorage.getItem(__tzz.SAVE_KEY);const put=Storage.prototype.setItem,get=Storage.prototype.getItem;let wrote=false;Storage.prototype.setItem=function(k,v){if(k===__tzz.SAVE_KEY||k===__tzz.BAK_KEY)__attempts.push(k);if(fault==='backup-write'&&k===__tzz.BAK_KEY)throw Error('synthetic backup write failure');const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)wrote=true;return r;};Storage.prototype.getItem=function(k){if(fault==='main-readback'&&wrote&&k===__tzz.SAVE_KEY)throw Error('synthetic uncertain readback');return get.call(this,k);};}''',fault)
   if fault=='lease-loss':pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
   for _ in range(15):pg.evaluate('__advance(1000)')
   first=pg.evaluate('__attempts.length');blocked=pg.evaluate('__tzz.saveBlocked')
   for _ in range(90):pg.evaluate('__advance(1000)')
   assert pg.evaluate('__attempts.length')==first
   if fault=='backup-write':assert blocked and pg.evaluate('localStorage.getItem(__tzz.SAVE_KEY)===__baselineRaw')
   if fault=='main-readback':assert blocked and first>0
   if fault=='lease-loss':assert not pg.evaluate('(window.FormalCollectionRuntime||window.PreviewCollectionRuntime).ownsLock()')
   results.append({'scope':scope,'fault':fault,'attemptsAtFailure':first,'noRetriesAcross90Seconds':True,'blocked':blocked});c.close()
 b.close()
(OUT/'failures-browser.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
