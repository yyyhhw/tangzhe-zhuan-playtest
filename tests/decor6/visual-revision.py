"""Actual game pages; before comparison changes only the previous two placement coordinates.
Uses fresh synthetic storage. Approved art bytes and all scene rendering remain unchanged.
"""
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/decor6-on52');results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for mode,scope,width in [('before','formal',320),('before','formal',390)]+[('after',s,w) for s in ['formal','preview'] for w in [320,390]]:
  c=b.new_context(viewport={'width':width,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True);seed=(OUT/f'decor6-{scope}-large-p1.json').read_text();c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const[k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}')
  if mode=='before':
   def old_positions(route):
    r=route.fetch();s=r.text().replace('x:W*.18,y:l.counterY-98*U','x:W*.20,y:l.counterY-56*U').replace('x:W*.94,y:l.counterY-98*U','x:W*.96,y:l.counterY-70*U');route.fulfill(response=r,body=s)
   c.route(re.compile(r'/collectibles/decor6-display\.mjs\?'),old_positions)
  pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto('http://127.0.0.1:8765'+('/preview/' if scope=='preview' else '/'));pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
  for _ in range(4):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click()
  pg.evaluate('''()=>{while(Economy.gachaRemaining(__tzz.state).length){if(!__tzz.atomic(()=>Economy.gachaDraw(__tzz.state,0),'synthetic').ok)throw Error('draw');}__tzz.showReveal(false);}''');pg.locator('#mOk').click();pg.locator('[data-tab="gacha"]').click()
  for id in ['d_opening_photo','d_ward_charm']:pg.locator(f'[data-act="claimHidden"][data-arg="{id}"]').click()
  assert pg.evaluate('__tzz.state.gacha.owned.length')==58
  # Capture the real full scrollable catalog in consecutive viewport segments.
  if mode=='after':
   count=pg.evaluate("document.querySelectorAll('#panel .item-grid:not(.collectible-preview) > .item').length");assert count==52,count
   assert pg.locator('#panel .card.super').count()==4 and pg.locator('[data-hidden-decor]').count()==2
   segments=pg.evaluate('Math.ceil(document.querySelector("#panel").scrollHeight/(document.querySelector("#panel").clientHeight*.8))')
   for n in range(segments):
    pg.evaluate('(n)=>{const panel=document.querySelector("#panel");panel.scrollTop=n*panel.clientHeight*.8}',n);pg.wait_for_timeout(100);pg.screenshot(path=str(OUT/f'catalog-{scope}-{width}-part{n}.png'))
  pg.locator('[data-tab="shop"]').click();pg.evaluate('()=>{for(let n=0;n<13;n++)__tzz.tapShop(120,120)}');pg.wait_for_timeout(4000)
  for shop in range(4):
   pg.evaluate('(i)=>__tzz.switchShop(i)',shop);pg.wait_for_timeout(400);pg.wait_for_function('!__tzz.bubble||__tzz.bubble.until<performance.now()/1000');pg.locator('#stage').screenshot(path=str(OUT/f'{mode}-{scope}-{width}-shop{shop}.png'))
  metrics=pg.evaluate('''()=>{const {W,H}=__tzz.canvasSize,U=H/260,rects=Decor6Display.placements(W,{counterY:H*.6},U);return {W,H,rects,hud:{x:6*U,y:H*.33,w:96*U,h:40*U}};}''')
  chime=next(x for x in metrics['rects'] if x['id']=='d_charcoal_chime');hud=metrics['hud'];overlap=chime['x']+chime['size']/2>hud['x'] and chime['x']-chime['size']/2<hud['x']+hud['w'] and chime['y']+chime['size']/2>hud['y'] and chime['y']-chime['size']/2<hud['y']+hud['h']
  assert overlap==(mode=='before'),metrics
  if mode=='after':
   for r in metrics['rects']:assert r['x']-r['size']/2>=0 and r['x']+r['size']/2<=metrics['W'] and r['y']-r['size']/2>=0
  assert not errors,errors;results.append({'mode':mode,'scope':scope,'width':width,'owned':58,'chimeOverlapsComboHud':overlap,'metrics':metrics,'errors':errors});print(json.dumps({'mode':mode,'scope':scope,'width':width,'passed':True}),flush=True);c.close()
 b.close()
(OUT/'visual-revision.json').write_text(json.dumps(results,indent=2))
