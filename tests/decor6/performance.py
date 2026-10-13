"""Serial normal-clock CPU4 samples, same synthetic large fixture, published52 vs candidate58."""
import json,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/decor6-on52');seed=(OUT/'decor6-formal-large-p1.json').read_text();out=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for label,port in [('published-7ce857d',8866),('decor6-candidate',8765)]:
  c=b.new_context(viewport={'width':390,'height':844});c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const[k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}')
  pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(f'http://127.0.0.1:{port}/');pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
  for _ in range(4):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click()
  pg.evaluate('''()=>{while(Economy.gachaRemaining(__tzz.state).length){if(!__tzz.atomic(()=>Economy.gachaDraw(__tzz.state,0),'synthetic').ok)throw Error('draw');}__tzz.showReveal(false);}''');pg.locator('#mOk').click()
  if label=='decor6-candidate':
   pg.locator('[data-tab="gacha"]').click()
   for id in ['d_opening_photo','d_ward_charm']:pg.locator(f'[data-act="claimHidden"][data-arg="{id}"]').click()
  pg.locator('button[data-tab="shop"]').click();pg.wait_for_timeout(1500);cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
  data=pg.evaluate('''async()=>{let times=[];for(let n=0;n<12;n++){let t=performance.now();if(!__tzz.persist())throw Error('save');times.push(performance.now()-t);await new Promise(r=>setTimeout(r,150));}let tabs=[];for(let n=0;n<3;n++)for(const tab of ['col','gacha','shop']){let t=performance.now();__tzz.setTab(tab);tabs.push({round:n,tab,ms:performance.now()-t});await new Promise(r=>setTimeout(r,150));}window.__writes=[];const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)__writes.push(performance.now());return r;};return {times,tabs,owned:__tzz.state.gacha.owned.length,bytes:localStorage.getItem(__tzz.SAVE_KEY).length};}''')
  pg.wait_for_timeout(32000);data.update(pg.evaluate('({automaticWrites:__writes,blocked:__tzz.saveBlocked})'));assert not errors and not data['blocked'];data.update({'label':label,'cpuThrottle':4,'errors':errors,'browser':b.version});out.append(data);print(json.dumps({'label':label,'owned':data['owned'],'medianSaveMs':statistics.median(data['times']),'automaticWrites':len(data['automaticWrites'])}),flush=True);c.close()
 b.close()
(OUT/'performance.json').write_text(json.dumps(out,indent=2))
