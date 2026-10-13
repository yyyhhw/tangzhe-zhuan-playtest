"""Attribution only: exact common P2 disk inputs, fixed clock/no rAF, real production persist.
A published52 code+52 owned; B candidate code+same52; C candidate+56; D candidate+58/receipts.
No save validation, locks, evidence reads or storage operations are replaced.
"""
import json,statistics,time
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/decor6-controlled');rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def page(port,seed,clock=None):
  c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();pg.goto(f'http://127.0.0.1:{port}/probe');pg.evaluate('(seed)=>{for(const[k,v]of seed)localStorage.setItem(k,v)}',seed)
  if clock is not None:c.add_init_script(f'Date.now=()=>{clock};window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{{}};')
  pg.goto(f'http://127.0.0.1:{port}/')
  pg.wait_for_function('!!window.__tzz || !!document.getElementById("collectibleUpgradeConfirm")',timeout=60000,polling=50)
  if pg.locator('#collectibleUpgradeConfirm').is_visible():pg.locator('#collectibleUpgradeConfirm').click(force=True)
  pg.wait_for_function('!!window.__tzz',polling=50)
  for _ in range(3):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
  return c,pg
 c,pg=page(8866,json.loads((OUT/'decor6-formal-large-p1.json').read_text()))
 pg.evaluate('''()=>{while(Economy.gachaRemaining(__tzz.state).length){if(!__tzz.atomic(()=>Economy.gachaDraw(__tzz.state,0),'synthetic').ok)throw Error('draw');}__tzz.showReveal(false);}''');pg.locator('#mOk').click(force=True);seed52=pg.evaluate('Object.entries(localStorage)');clock=pg.evaluate('Date.now()');c.close()
 c,pg=page(8765,seed52,clock);pg.evaluate('''()=>{while(Economy.gachaRemaining(__tzz.state).length){if(!__tzz.atomic(()=>Economy.gachaDraw(__tzz.state,0),'synthetic').ok)throw Error('draw');}__tzz.showReveal(false);}''');pg.locator('#mOk').click(force=True);seed56=pg.evaluate('Object.entries(localStorage)')
 pg.locator('[data-tab="gacha"]').click(force=True)
 for id in ['d_opening_photo','d_ward_charm']:pg.locator(f'[data-act="claimHidden"][data-arg="{id}"]').click(force=True)
 seed58=pg.evaluate('Object.entries(localStorage)');c.close()
 seeds={'A':seed52,'B':seed52,'C':seed56,'D':seed58};(OUT/'controlled-seeds.json').write_text(json.dumps({'clock':clock,'seeds':seeds}))
 for index,label in enumerate('ABBACDDC'):
  port=8866 if label=='A' else 8765;c,pg=page(port,seeds[label],clock);pg.locator('button[data-tab="shop"]').click(force=True);pg.wait_for_timeout(1500);cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
  result=pg.evaluate('''async()=>{let times=[];for(let i=0;i<15;i++){const t=performance.now();if(!__tzz.persist())throw Error('persist');times.push(performance.now()-t);await new Promise(r=>setTimeout(r,150));}return {times,chars:localStorage.getItem(__tzz.SAVE_KEY).length,owned:__tzz.state.gacha.owned.length,blocked:__tzz.saveBlocked};}''');result.update({'index':index,'arm':label,'medianWarmMs':statistics.median(result['times'][3:]),'browser':b.version,'clock':clock,'cpu':4});rows.append(result);(OUT/'controlled-performance.json').write_text(json.dumps(rows,indent=2));print(json.dumps(result),flush=True);c.close()
 b.close()
