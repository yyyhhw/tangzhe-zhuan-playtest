"""Real close with injected storage failures or pre-existing read-only state."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
rows=[];BASE='http://127.0.0.1:8870'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
  for fault in ['backup-write','main-readback','already-protected']:
   c=b.new_context();pg=c.new_page();pg.goto(BASE+'/probe');pg.evaluate('(rows)=>{for(const[k,v]of rows)localStorage.setItem(k,v)}',json.loads((Path(__file__).parent/'fixtures'/f'{scope}-p1.json').read_text()));pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
   for _ in range(3):
    for sel in ['#claim','#mOk','#mX']:
     if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
   pg.wait_for_timeout(250);before=pg.evaluate('({key:__tzz.SAVE_KEY,raw:localStorage.getItem(__tzz.SAVE_KEY),coins:__tzz.state.coins})')
   pg.evaluate('''fault=>{const put=Storage.prototype.setItem,get=Storage.prototype.getItem;let wrote=false,attempts=[];Storage.prototype.setItem=function(k,v){if(k===__tzz.SAVE_KEY||k===__tzz.BAK_KEY){attempts.push(k);put.call(localStorage,'faultAttempts',JSON.stringify(attempts));}if(fault==='backup-write'&&k===__tzz.BAK_KEY)throw Error('synthetic backup failure');const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)wrote=true;return r;};Storage.prototype.getItem=function(k){if(fault==='main-readback'&&wrote&&k===__tzz.SAVE_KEY)throw Error('synthetic readback failure');return get.call(this,k);};if(fault==='already-protected')__tzz.collectionReadOnly('synthetic protection');}''',fault)
   pg.close(run_before_unload=True);pg=c.new_page();pg.goto(BASE+'/probe');actual=pg.evaluate('(key)=>localStorage.getItem(key)',before['key']);attempts=pg.evaluate('JSON.parse(localStorage.getItem("faultAttempts")||"[]")')
   if fault in ['backup-write','already-protected']:assert actual==before['raw'];assert len(attempts)==(1 if fault=='backup-write' else 0)
   else:assert json.loads(actual)['coins']>=before['coins'];assert attempts.count(before['key'])==1
   rows.append({'path':path,'fault':fault,'attempts':attempts,'mainUnchanged':actual==before['raw'],'pass':True});c.close()
 b.close()
Path('/tmp/lifecycle-fault-close.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
