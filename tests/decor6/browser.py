# Run make-fixtures.mjs first; serve the candidate over loopback HTTP.
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('DECOR6_EVIDENCE_DIR','/tmp/decor6-evidence'));OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('DECOR6_BASE_URL','http://127.0.0.1:8765').rstrip('/')
out=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for scope,width in [(s,w) for s in ['formal','preview'] for w in [320,390]]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2);c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const [k,v]of '+(OUT/f'decor6-{scope}-large-p1.json').read_text()+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}')
  pg=c.new_page();pg.set_default_timeout(10000);errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(BASE+('/preview/' if scope=='preview' else '/'));pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
  for _ in range(5):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click();pg.wait_for_timeout(200)
  pg.evaluate('''()=>{__tzz.state.coins=1000000000;while(Economy.gachaRemaining(__tzz.state).length){const r=__tzz.atomic(()=>Economy.gachaDraw(__tzz.state,0),'synthetic');if(!r.ok)throw Error('draw failed');} }''')
  pg.evaluate('__tzz.showReveal(false)');pg.locator('#mOk').click();
  pg.locator('[data-tab="gacha"]').click();pg.locator('[data-act="claimHidden"][data-arg="d_opening_photo"]').click();pg.wait_for_timeout(100);pg.locator('[data-act="claimHidden"][data-arg="d_ward_charm"]').click();pg.wait_for_timeout(200)
  assert pg.evaluate('__tzz.state.gacha.owned.length')==58
  assert pg.evaluate('Economy.ITEMS.length')==58 and pg.evaluate('Economy.REGULAR_ITEMS.length')==52
  assert pg.locator('[data-preview-item]').count()==0
  pg.locator('#panel').screenshot(path=str(OUT/f'decor6-{scope}-{width}-catalog.png'))
  pg.locator('[data-tab="col"]').click();pg.wait_for_timeout(200);clicks=[]
  ids=['d_borrow_register','d_rocket_piggy','d_opening_photo','d_ward_charm','d_charcoal_chime','d_spice_turntable']
  for id in ids:
   button=pg.locator('[data-act="decor"][data-arg="'+id+'"]');button.scroll_into_view_if_needed();box=button.bounding_box();assert box['width']>=44 and box['height']>=44 and box['x']>=0 and box['x']+box['width']<=width;button.click();pg.wait_for_timeout(100);assert pg.evaluate('(id)=>__tzz.state.decorHidden.includes(id)',id);button.click();pg.wait_for_timeout(100);assert not pg.evaluate('(id)=>__tzz.state.decorHidden.includes(id)',id);clicks.append({'id':id,'width':box['width'],'height':box['height'],'withinViewport':box['x']>=0 and box['x']+box['width']<=width})
  images=pg.evaluate('''async ids=>await Promise.all(ids.map(id=>new Promise(resolve=>{const el=document.querySelector(`[data-decor="${id}"] img`);if(el.complete)return resolve({id,w:el.naturalWidth,h:el.naturalHeight});el.onload=()=>resolve({id,w:el.naturalWidth,h:el.naturalHeight});el.onerror=()=>resolve({id,w:0,h:0});})))''',ids);assert all(x['w']>0 and x['h']>0 for x in images)
  pg.locator('[data-tab="shop"]').click();pg.wait_for_timeout(100)
  pg.evaluate('''()=>{window.__painted=new Set();const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(img,...args){if(img?.src?.includes('/art/collectibles/d_'))__painted.add(img.src.split('/').pop().split('?')[0].replace('_catalog_v1.webp','').replace('.png',''));return original.call(this,img,...args);};}''')
  painted=[]
  for i in range(4):
   pg.evaluate('(i)=>{__painted.clear();__tzz.switchShop(i)}',i);pg.wait_for_timeout(300);assert set(pg.evaluate('[...__painted]'))==set(ids)
   pg.screenshot(path=str(OUT/f'decor6-{scope}-{width}-shop{i}.png'));pg.locator('#stage').screenshot(path=str(OUT/f'decor6-{scope}-{width}-shop{i}-stage.png'))
   pg.evaluate('()=>{for(let n=0;n<13;n++)__tzz.tapShop(120,120)}');pg.wait_for_timeout(100);pg.locator('#stage').screenshot(path=str(OUT/f'decor6-{scope}-{width}-shop{i}-combo.png'));painted.append({'shop':i,'drawn':pg.evaluate('[...__painted]')})
  cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4});times=pg.evaluate('''async()=>{const a=[];for(let i=0;i<8;i++){let t=performance.now();if(!__tzz.persist())throw Error('failed');a.push(performance.now()-t);await new Promise(r=>setTimeout(r,100));}return a;}''')
  current=pg.evaluate('({gacha:__tzz.state.gacha,ledger:__tzz.state.collectiblesV1,hidden:__tzz.state.decorHidden,blocked:__tzz.saveBlocked})');pg.reload();pg.wait_for_function('!!window.__tzz');assert pg.evaluate('({gacha:__tzz.state.gacha,ledger:__tzz.state.collectiblesV1,hidden:__tzz.state.decorHidden,blocked:__tzz.saveBlocked})')==current;assert not errors
  out.append({'width':width,'owned':58,'scope':scope,'clicks':clicks,'images':images,'painted':painted,'saveMsAt4x':times,'errors':errors,'blocked':current['blocked'],'note':'Automated interaction evidence only; visually inspect all screenshots before acceptance'});print(json.dumps(out[-1]),flush=True);c.close()
 b.close()
(OUT/'decor6-full-browser.json').write_text(json.dumps(out,indent=2))
