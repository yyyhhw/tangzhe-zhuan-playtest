"""Close page, then close browser context; reopen the same on-disk isolated profile."""
import json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8870';rows=[]
with sync_playwright() as p:
 for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
  with tempfile.TemporaryDirectory(prefix='lifecycle-profile-') as profile:
   def launch():return p.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],viewport={'width':390,'height':844})
   c=launch();pg=c.pages[0];pg.goto(BASE+'/probe');pg.evaluate('(rows)=>{for(const[k,v]of rows)localStorage.setItem(k,v)}',json.loads((Path(__file__).parent/'fixtures'/f'{scope}-p1.json').read_text()));pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
   for _ in range(3):
    for sel in ['#claim','#mOk','#mX']:
     if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
   pg.wait_for_timeout(3000);before=pg.evaluate('({key:__tzz.SAVE_KEY,coins:__tzz.state.coins})');pg.close(run_before_unload=True);probe=c.new_page();probe.goto(BASE+'/probe');raw=probe.evaluate('(key)=>localStorage.getItem(key)',before['key']);assert json.loads(raw)['coins']>=before['coins'];c.close()
   c=launch();pg=c.pages[0];pg.goto(BASE+'/probe');actual=pg.evaluate('(key)=>localStorage.getItem(key)',before['key']);assert actual==raw;c.close();rows.append({'path':path,'savedTail':True,'newPersistentContextExactRaw':True})
Path('/tmp/lifecycle-profile.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
