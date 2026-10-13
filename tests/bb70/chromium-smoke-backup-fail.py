import json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8877';out={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 for path in ['/','/pet/game/']:
  c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto(BASE+'/version.json');seed=json.loads(Path('tests/lifecycle-save/fixtures/formal-p1.json').read_text())
  pg.evaluate('(rows)=>{for(const [k,v]of rows)localStorage.setItem(k,v)}',seed)
  pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz');pg.wait_for_selector('#claimBb70')
  before=pg.evaluate("()=>localStorage.getItem('tangzhe-formal-collection-v1-save')")
  pg.evaluate("()=>{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='tangzhe-formal-collection-v1-save-bak')throw new Error('INJECTED_BACKUP_FAIL');return o.call(this,k,v)}}")
  pg.locator('#claimBb70').click();pg.wait_for_timeout(800)
  st=pg.evaluate("()=>({modalOpen:!document.querySelector('#modal').classList.contains('hidden'),note:document.getElementById('bb70ClaimNote')?.textContent||null,disabled:['claimDouble','claim','claimBb70'].map(i=>document.getElementById(i)?.disabled),tab:document.querySelector('.tab.on,[data-tab].on,.tabs .on')?.textContent||null,flags:Object.keys(localStorage).filter(k=>k.startsWith('tzz-bb70')),saveBlocked:__tzz.saveBlocked,protectedPanel:document.getElementById('collectionStartup')?.innerText?.slice(0,30)||null,pendingInMemory:!!__tzz.state.pending})")
  st['mainUnchanged']=pg.evaluate("(b)=>localStorage.getItem('tangzhe-formal-collection-v1-save')===b",before)
  pg.screenshot(path=f"/tmp/bb70fail{path.replace('/','_')}.png")
  out[path]={**st,'errors':errs};c.close()
 b.close()
print(json.dumps(out,ensure_ascii=False,indent=1))
