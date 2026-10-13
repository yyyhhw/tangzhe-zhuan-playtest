"""Actual pet purchase at t=14.9s, synthetic storage, all three production entry paths."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/autosave15');CONTROL=Path(__file__).with_name('browser.py').read_text().split("CONTROL='''",1)[1].split("'''",1)[0];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
  for fault in ['none','backup-write','main-readback']:
   c=b.new_context();seed=(OUT/f'blindbox18-{scope}-p1.json').read_text();c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const [k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}');c.add_init_script(CONTROL)
   pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto('http://127.0.0.1:8765'+path);pg.locator('#collectibleUpgradeConfirm').click(force=True);pg.wait_for_function('!!window.__tzz?.pet?.M',polling=50)
   for _ in range(4):
    for sel in ['#claim','#mOk','#mX']:
     if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
   pg.evaluate('__tzz.persist()');initialDeadline=pg.evaluate('__tzz.persist.nextAutoAt')
   for _ in range(14):pg.evaluate('__advance(1000)')
   pg.evaluate('__advance(900)');pg.evaluate('__tzz.homeAct("homePetBuy","c77|dog")')
   if pg.locator('#petBuyStandby').is_visible():pg.locator('#petBuyStandby').click(force=True)
   assert pg.locator('#pbYes').is_visible() and pg.locator('#pbYes').is_enabled()
   pg.evaluate('''fault=>{window.__attempts=[];window.__before=localStorage.getItem(__tzz.SAVE_KEY);const put=Storage.prototype.setItem,get=Storage.prototype.getItem;let wrote=false;Storage.prototype.setItem=function(k,v){if(k===__tzz.SAVE_KEY||k===__tzz.BAK_KEY)__attempts.push(k);if(fault==='backup-write'&&k===__tzz.BAK_KEY)throw Error('synthetic pet backup failure');const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)wrote=true;return r;};Storage.prototype.getItem=function(k){if(fault==='main-readback'&&wrote&&k===__tzz.SAVE_KEY)throw Error('synthetic pet uncertain readback');return get.call(this,k);};}''',fault)
   pg.locator('#pbYes').click(force=True);count=pg.evaluate('__attempts.length');deadline=pg.evaluate('__tzz.persist.nextAutoAt');blocked=pg.evaluate('__tzz.saveBlocked')
   if fault=='none':
    assert deadline==29900,(deadline,initialDeadline)
    assert pg.evaluate('PetGame.speciesOwned(__tzz.state,Economy,"dog")')
    assert pg.evaluate('PetGame.speciesOwned(JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)),Economy,"dog")')
    pg.evaluate('__advance(100)');assert pg.evaluate('__attempts.length')==count
    for _ in range(14):pg.evaluate('__advance(1000)')
    pg.evaluate('__advance(899)');assert pg.evaluate('__attempts.length')==count
    pg.evaluate('__advance(1)');assert pg.evaluate('__attempts.length')>count
   else:
    assert deadline==initialDeadline and blocked,(deadline,initialDeadline,blocked)
    for _ in range(90):pg.evaluate('__advance(1000)')
    assert pg.evaluate('__attempts.length')==count
    if fault=='backup-write':assert pg.evaluate('localStorage.getItem(__tzz.SAVE_KEY)===__before')
   assert not errors,errors
   results.append({'scope':scope,'path':path,'fault':fault,'petPurchaseAtMs':14900,'initialDeadline':initialDeadline,'deadlineAfterPurchase':deadline,'blocked':blocked,'attempts':count,'passed':True});print(json.dumps(results[-1]),flush=True);c.close()
 b.close()
(OUT/'pet-deadline-browser.json').write_text(json.dumps(results,indent=2))
