"""Actual production pages, isolated synthetic storage; controlled elapsed time/rAF for cadence cases."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('AUTOSAVE_EVIDENCE_DIR','/tmp/autosave15'));BASE=os.environ.get('AUTOSAVE_BASE_URL','http://127.0.0.1:8765');results=[]
CONTROL='''(()=>{const base=Date.now();let t=0,q=[];Date.now=()=>base+t;performance.now=()=>t;window.requestAnimationFrame=f=>{q.push(f);return q.length};window.cancelAnimationFrame=()=>{};window.__advance=ms=>{t+=ms;const work=q;q=[];for(const f of work)f(t);};window.__clock=()=>t;})();'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
  c=b.new_context(viewport={'width':390,'height':844});seed=(OUT/f'blindbox18-{scope}-p1.json').read_text();c.add_init_script('if(!sessionStorage.getItem("seeded")){for(const [k,v]of '+seed+')localStorage.setItem(k,v);sessionStorage.setItem("seeded","1");}');c.add_init_script(CONTROL)
  pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click(force=True);pg.wait_for_function('!!window.__tzz',polling=50)
  for _ in range(4):
   for sel in ['#claim','#mOk','#mX']:
    if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
  pg.evaluate('''()=>{window.__writes=[];const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)__writes.push({at:__clock(),raw:v});return r;};__tzz.persist();__writes=[];}''')
  initial=pg.evaluate('({coins:__tzz.state.coins,taps:__tzz.state.taps})')
  # 1 fps: elapsed 15 s must save despite the 0.1 s animation clamp.
  for _ in range(14):pg.evaluate('__advance(1000)')
  assert pg.evaluate('__writes.length')==0
  pg.evaluate('__tzz.tapShop(100,100)');assert pg.evaluate('__writes.length')==0
  pg.evaluate('__advance(1000)');assert pg.evaluate('__writes.length')==1
  assert pg.evaluate('JSON.parse(__writes.at(-1).raw).taps===__tzz.state.taps')
  assert pg.evaluate('JSON.parse(__writes.at(-1).raw).coins===__tzz.state.coins')
  assert pg.evaluate('__tzz.state.coins')>initial['coins'];assert pg.evaluate('__tzz.state.taps')==initial['taps']+1
  # Equip just before next deadline, persisted immediately and no automatic duplicate.
  for _ in range(14):pg.evaluate('__advance(1000)')
  pg.evaluate('__tzz.act("equip","c77:clothes:none",null)');assert pg.evaluate('__writes.length')==2
  pg.evaluate('__advance(1000)');assert pg.evaluate('__writes.length')==2
  for _ in range(13):pg.evaluate('__advance(1000)')
  assert pg.evaluate('__writes.length')==2
  pg.evaluate('__advance(1000)');assert pg.evaluate('__writes.length')==3
  # Real gacha handler commits before animation; showing reveal commits seen.
  pg.evaluate('__tzz.act("draw","",null)');assert pg.evaluate('__writes.length')==4
  # showReveal itself marks seen durably before the dismiss button.
  pg.wait_for_timeout(1000);assert pg.locator('#mOk').is_visible();pg.locator('#mOk').click(force=True)
  assert pg.evaluate('__writes.length')==5;assert pg.evaluate('JSON.parse(__writes.at(-1).raw).gacha.last.seen')
  # Actual upgrade handler and actual special reward economic function remain atomic.
  pg.evaluate('__tzz.doUpgradeShop(0,null)');assert pg.evaluate('__writes.length')==6
  pg.evaluate('__tzz.atomic(()=>({ok:true,paid:Economy.settleSpecial(__tzz.state,0)}),"synthetic special reward")');assert pg.evaluate('__writes.length')==7
  durable=pg.evaluate('({gacha:__tzz.state.gacha,wear:__tzz.state.wear,shops:__tzz.state.shops})')
  pg.reload();pg.wait_for_function('!!window.__tzz',polling=50);assert pg.evaluate('({gacha:__tzz.state.gacha,wear:__tzz.state.wear,shops:__tzz.state.shops})')==durable
  # Visibility boundary must flush immediately; pagehide keeps original lease behavior.
  pg.evaluate('''()=>{window.__writes=[];const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){const r=put.call(this,k,v);if(k===__tzz.SAVE_KEY)__writes.push({at:__clock()});return r;};Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}''')
  assert pg.evaluate('__writes.length')>=1
  pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
  assert not errors,errors
  results.append({'scope':scope,'path':path,'lowFpsCadence':True,'incomeFlushed':True,'immediateEquipSuppressesDuplicate':True,'gachaSeenPurchaseRewardDurable':True,'hiddenFlushed':True,'errors':errors});c.close()
 b.close()
(OUT/'browser.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
