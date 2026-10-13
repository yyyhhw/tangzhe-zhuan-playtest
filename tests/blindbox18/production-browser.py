"""Real production boot with isolated synthetic P1 saves, never user storage.
Expects blindbox18-{formal,preview}-p1.json in OUT. Does not regenerate any art.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('BLINDBOX_EVIDENCE_DIR','/tmp/blindbox18-evidence'));BASE=os.environ.get('BLINDBOX_BASE_URL','http://127.0.0.1:8765').rstrip('/')
clothes=['c_skewer_loop_tunic','c_smoke_split_bolero','c_pepper_scale_wrap','c_corn_rib_jacket'];hats=['h_charcoal_crescent','h_grill_press','h_tin_foil_puff','h_corn_sail'];people=['c77','pearl','otaku','rocket'];out=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for scope in ['formal','preview']:
  c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
  seed=(OUT/f'blindbox18-{scope}-p1.json').read_text();c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const [k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}')
  pg=c.new_page();pg.set_default_timeout(15000);errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(BASE+('/preview/' if scope=='preview' else '/'));pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
  for _ in range(4):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click();pg.wait_for_timeout(150)
  draws=pg.evaluate('''()=>{const r=[];while(Economy.gachaRemaining(__tzz.state).length){const q=__tzz.atomic(()=>Economy.gachaDraw(__tzz.state,0),'synthetic actual draw');if(!q.ok)throw Error('draw');r.push(q.item.id);}return r;}''')
  pg.evaluate('__tzz.showReveal(false)');pg.locator('#mOk').click();pg.wait_for_timeout(150)
  assert all(x in draws for x in clothes+hats);assert pg.evaluate('Economy.ITEMS.length')==58;assert pg.evaluate('Economy.REGULAR_ITEMS.length')==52
  pg.locator('[data-tab="gacha"]').click();pg.wait_for_timeout(100)
  for id in ['d_opening_photo','d_ward_charm']:pg.locator(f'[data-act="claimHidden"][data-arg="{id}"]').click();pg.wait_for_timeout(100)
  before=pg.evaluate('JSON.stringify(__tzz.state.collectiblesV1)');pg.locator('[data-tab="col"]').click();pg.wait_for_timeout(100);checked=0
  for pair in range(4):
   for who in people:
    pg.locator(f'[data-act="wearWho"][data-arg="{who}"]').click();pg.wait_for_timeout(80)
    for slot,id in [('clothes',clothes[pair]),('hat',hats[pair])]:
     pg.locator(f'[data-act="equip"][data-arg="{who}:{slot}:{id}"]').click();pg.wait_for_timeout(80);assert pg.evaluate('([who,slot])=>__tzz.state.wear[who][slot]',[who,slot])==id;checked+=1
   pg.locator('.wear-preview').screenshot(path=str(OUT/f'blindbox18-{scope}-actual-wardrobe-pair{pair}.png'))
   pg.locator('[data-tab="shop"]').click();pg.wait_for_timeout(100);pg.screenshot(path=str(OUT/f'blindbox18-{scope}-actual-shop-pair{pair}.png'))
   pg.locator('[data-tab="home"]').click();pg.wait_for_timeout(100);pg.screenshot(path=str(OUT/f'blindbox18-{scope}-actual-home-pair{pair}.png'))
   for fid,pose in ([('furn_sofa','sit'),('furn_bed','lie')] if scope=='formal' else []):
    pg.locator(f'#roomFloor .furn[data-fid="{fid}"]').click();pg.wait_for_function('(kind)=>__tzz.homeActor.c77?.pose?.kind===kind',arg=pose,timeout=15000);pg.wait_for_timeout(150)
    assert pg.locator('#homeActor').evaluate('(el)=>el.classList.contains("posed")')
    pg.locator('#roomFloor').screenshot(path=str(OUT/f'blindbox18-{scope}-actual-{pose}-pair{pair}.png'))
   pg.locator('[data-tab="col"]').click();pg.wait_for_timeout(100)
  state=pg.evaluate('({wear:__tzz.state.wear,gacha:__tzz.state.gacha,ledger:__tzz.state.collectiblesV1,blocked:__tzz.saveBlocked})');assert len(state['gacha']['owned'])==58;assert not state['blocked'];assert pg.evaluate('JSON.stringify(__tzz.state.collectiblesV1)')==before
  # Image retrieval at the actual mounted catalog, independent of isolated boards.
  loaded=pg.evaluate('''async ids=>{const display=window.QAWearables8Display;return await Promise.all(ids.map(id=>new Promise(resolve=>{const div=document.createElement('div');div.innerHTML=display.iconHTML(Economy,__tzz.state,id);const i=div.querySelector('img');i.onload=()=>resolve({id,w:i.naturalWidth,h:i.naturalHeight});i.onerror=()=>resolve({id,w:0,h:0});if(i.complete)resolve({id,w:i.naturalWidth,h:i.naturalHeight});})));}''',clothes+hats);assert all(x['w']==512 and x['h']==512 for x in loaded)
  pg.reload();pg.wait_for_function('!!window.__tzz');after=pg.evaluate('({wear:__tzz.state.wear,gacha:__tzz.state.gacha,ledger:__tzz.state.collectiblesV1,blocked:__tzz.saveBlocked})');assert state==after,json.dumps({"before":state,"after":after})
  cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4});timings=pg.evaluate('''async()=>{let a=[];for(let i=0;i<8;i++){let t=performance.now();if(!__tzz.persist())throw Error('save');a.push(performance.now()-t);await new Promise(r=>setTimeout(r,100));}return a;}''')
  assert not errors;out.append({'scope':scope,'warm58SaveMs4x':timings,'formalPoseCases':8 if scope=='formal' else 0,'previewPoseNote':'Preview baseline has no pose renderer; not added in this release' if scope=='preview' else None,'checkedActualEquipClicks':checked,'drawn':draws,'ownedAfterReload':58,'images':loaded,'errors':errors,'blocked':after['blocked']});print(json.dumps(out[-1]),flush=True);c.close()
 b.close()
(OUT/'blindbox18-production-browser.json').write_text(json.dumps(out,indent=2))
