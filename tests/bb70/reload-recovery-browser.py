"""Actual top protection-panel reload button. No force, DOM click, or scripted reconcile."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8875';OUT=Path('/tmp/bb70-r4-reload');OUT.mkdir(exist_ok=True);rows=[]
seed=json.loads(Path('tests/lifecycle-save/fixtures/formal-p1.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [320,390]:
  for path in ['/','/pet/game/']:
   for fault in ['backup','unknown']:
    c=b.new_context(viewport={'width':width,'height':844});c.add_init_script('const fixedNow=Date.now();Date.now=()=>fixedNow;');pg=c.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto(BASE+'/probe');pg.evaluate('(rows)=>{for(const[k,v]of rows)localStorage.setItem(k,v)}',seed);pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz');pg.wait_for_selector('#claimBb70');pid=pg.evaluate('__tzz.state.pending.id')
    pg.evaluate('''fault=>{let wrote=false;const put=Storage.prototype.setItem,get=Storage.prototype.getItem;Storage.prototype.setItem=function(k,v){if(fault==='backup'&&k===__tzz.BAK_KEY)throw Error('synthetic backup failure');const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)wrote=true;return r;};Storage.prototype.getItem=function(k){if(fault==='unknown'&&wrote&&k===__tzz.SAVE_KEY)throw Error('synthetic unknown');return get.call(this,k);};}''',fault)
    pg.locator('#claimBb70').click();assert pg.evaluate('__tzz.saveBlocked');assert pg.locator('#collectibleReload').is_visible()
    # The native UI overlay intentionally intercepts the acknowledgement below it.
    covered=pg.locator('#bb70ClaimOk').evaluate('(el)=>{const r=el.getBoundingClientRect();return !el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}');assert covered
    with pg.expect_navigation(wait_until='domcontentloaded'):pg.locator('#collectibleReload').click()
    pg.wait_for_function('!!window.__tzz');assert not pg.evaluate('__tzz.saveBlocked');assert pg.locator('#collectionStartup').count()==0;count=pg.evaluate('(id)=>(__tzz.state.claimLog||[]).filter(x=>x.id===id).length',pid);assert count==(0 if fault=='backup' else 1)
    if fault=='backup':pg.wait_for_selector('#claimBb70');pg.locator('#claimBb70').click()
    assert pg.evaluate('(id)=>__tzz.state.claimLog.filter(x=>x.id===id).length',pid)==1;pg.screenshot(path=str(OUT/f'{width}-{path.strip("/").replace("/","-") or "root"}-{fault}-recovered.png'));assert not errs;rows.append({'width':width,'path':path,'fault':fault,'lowerAckCovered':True,'topReloadNormalClick':True,'afterReloadOriginalClaimCount':count,'finalOriginalClaimCount':1,'blocked':False,'errors':errs});c.close()
 b.close()
(OUT/'reload-recovery.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
