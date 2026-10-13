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
  pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz');pg.wait_for_timeout(800)
  seq=[]
  for _ in range(6):
   t=pg.evaluate("()=>{const m=document.querySelector('#modal');return m&&!m.classList.contains('hidden')?m.innerText.replace(/\\s+/g,' ').slice(0,90):null}")
   seq.append(t)
   if t is None: break
   for sel in ['#claimBb70','#mNo','#claim','#mOk','#mX']:
    if pg.locator(sel).count() and pg.locator(sel).first.is_visible():seq.append('click '+sel);pg.locator(sel).first.click(force=True);break
   pg.wait_for_timeout(500)
  st=pg.evaluate("()=>({v:new URL(location.href).searchParams.get('v'),tab:document.querySelector('.tab.on,[data-tab].on,.tabs .on')?.textContent||null,flags:Object.keys(localStorage).filter(k=>k.startsWith('tzz-bb70')),pending:__tzz.state.pending,saveBlocked:__tzz.saveBlocked})")
  pg.screenshot(path=f"/tmp/bb70smoke{path.replace('/','_')}.png")
  out[path]={'seq':seq,**st,'errors':errs};c.close()
 b.close()
print(json.dumps(out,ensure_ascii=False,indent=1))
