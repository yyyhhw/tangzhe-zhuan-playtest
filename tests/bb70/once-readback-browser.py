"""Correct one-shot readback faults: consume an explicit boolean, never return undefined."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8875';OUT=Path('/tmp/bb70-r4-once');OUT.mkdir(exist_ok=True);rows=[];seed=json.loads(Path('tests/lifecycle-save/fixtures/formal-p1.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for path in ['/','/pet/game/']:
  for fault in ['stale-once','throw-once']:
   c=b.new_context(viewport={'width':390,'height':844});c.add_init_script('const fixedNow=Date.now();Date.now=()=>fixedNow;');pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(BASE+'/probe');pg.evaluate('(rows)=>{for(const[k,v]of rows)localStorage.setItem(k,v)}',seed);pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz');pg.wait_for_selector('#claimBb70');pid=pg.evaluate('__tzz.state.pending.id')
   pg.evaluate('''fault=>{const put=Storage.prototype.setItem,get=Storage.prototype.getItem,key=__tzz.SAVE_KEY,stale=get.call(localStorage,key);let armed=false,consumed=false;window.__once={writes:0,injections:0,reads:[]};window.__nativeMain=()=>get.call(localStorage,key);Storage.prototype.setItem=function(k,v){const r=put.call(this,k,v);if(k===key){__once.writes++;armed=true;}return r;};Storage.prototype.getItem=function(k){if(k===key&&armed&&!consumed){consumed=true;__once.injections++;if(fault==='throw-once'){__once.reads.push({kind:'throw'});throw Error('synthetic once-only readback exception');}__once.reads.push({kind:'stale-once',type:typeof stale,length:stale.length});return stale;}const value=get.call(this,k);if(k===key&&armed)__once.reads.push({kind:'native',type:typeof value,length:value?.length??null});return value;};}''',fault)
   pg.locator('#claimBb70').click();assert pg.evaluate('__tzz.saveBlocked');assert pg.evaluate('__once.writes')==1;assert pg.evaluate('__once.injections')==1;disk=pg.evaluate('JSON.parse(__nativeMain())');assert sum(x['id']==pid for x in disk['claimLog'])==1;assert pg.evaluate('localStorage.getItem(__tzz.BB70_VISIT_KEY)') is None;before=pg.evaluate('__once.writes')
   pg.locator('#collectibleReconcile').click();assert pg.evaluate('__once.writes')==before
   if fault=='throw-once':
    assert not pg.evaluate('__tzz.saveBlocked');pg.locator('#bb70ClaimOk').click();pg.wait_for_timeout(100)
    if pg.locator('#mNo').is_visible():pg.locator('#mNo').click()
   else:
    assert pg.evaluate('__tzz.saveBlocked');assert pg.locator('#collectibleReload').is_visible()
   audit=pg.evaluate('__once');assert audit['injections']==1;assert all(r.get('type','string')=='string' for r in audit['reads']);pg.screenshot(path=str(OUT/f'{path.strip("/").replace("/","-") or "root"}-{fault}.png'))
   if fault=='stale-once':
    with pg.expect_navigation(wait_until='domcontentloaded'):pg.locator('#collectibleReload').click()
   else:pg.reload()
   pg.wait_for_function('!!window.__tzz');assert not pg.evaluate('__tzz.saveBlocked');count=pg.evaluate('(id)=>__tzz.state.claimLog.filter(x=>x.id===id).length',pid);assert count==1;assert pg.evaluate('__tzz.state.pending') is None;assert not errors;rows.append({'path':path,'fault':fault,'audit':audit,'claimWritesBeforeReload':1,'ledgerBeforeReload':1,'ledgerAfterReload':count,'reconcileWrites':0,'topReloadNeeded':fault=='stale-once','reloadedReadOnly':False,'errors':errors});c.close()
 b.close()
(OUT/'once-readback.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
