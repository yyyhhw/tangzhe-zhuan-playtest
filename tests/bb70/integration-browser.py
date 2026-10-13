"""Real Chromium UI against combined candidate; isolated synthetic saves only.
Failure scenarios inject Storage faults; all user actions use normal clicks (no force).
"""
import json,os,math
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('BB70_BASE','http://127.0.0.1:8875');OUT=Path(os.getenv('BB70_OUT','/tmp/bb70-r4-review'));OUT.mkdir(exist_ok=True);rows=[]
SEED=json.loads(Path('tests/lifecycle-save/fixtures/formal-p1.json').read_text())
FLAGS='({launch:localStorage.getItem(__tzz.BB70_LAUNCH_KEY),visit:localStorage.getItem(__tzz.BB70_VISIT_KEY)})'
OBSERVER='''()=>{window.__writes=[];const put=Storage.prototype.setItem,get=Storage.prototype.getItem;window.__nativePut=put;window.__nativeGet=get;window.__fault=null;let wrote=false;Storage.prototype.setItem=function(k,v){if(k===__tzz.BAK_KEY&&__fault==='backup')throw Error('synthetic backup fail');const result=put.call(this,k,v);if(k===__tzz.SAVE_KEY){wrote=true;__writes.push(v);}return result;};Storage.prototype.getItem=function(k){if(k===__tzz.SAVE_KEY&&wrote&&__fault==='unknown')throw Error('synthetic readback unknown');return get.call(this,k);};window.__readMain=()=>get.call(localStorage,__tzz.SAVE_KEY);}'''
def start(b,path):
 c=b.new_context(viewport={'width':int(os.getenv('BB70_WIDTH','390')),'height':844});c.add_init_script('const fixedNow=Date.now();Date.now=()=>fixedNow;');pg=c.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto(BASE+'/probe');pg.evaluate('(rows)=>{for(const[k,v]of rows)localStorage.setItem(k,v)}',SEED);pg.goto(BASE+path);return c,pg,errs
def settle_normal(pg):
 for _ in range(8):
  if pg.locator('#claim').is_visible():pg.locator('#claim').click()
  elif pg.locator('#mOk').is_visible():pg.locator('#mOk').click()
  elif pg.locator('#mNo').is_visible():pg.locator('#mNo').click()
  else:break
  pg.wait_for_timeout(180)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for path in ['/','/pet/game/']:
  tag=path.strip('/').replace('/','-') or 'root'
  c,pg,errs=start(b,path);pg.locator('#collectibleUpgradeCancel').click();pg.wait_for_function('!!window.__tzz');assert pg.evaluate('__tzz.state._collectionProtocol')==1;assert pg.evaluate('Economy.ITEMS.length')==36;assert pg.locator('#claimBb70').count()==0;settle_normal(pg);pg.locator('button[data-tab="gacha"]').click();assert pg.evaluate(FLAGS)=={'launch':None,'visit':None};pg.screenshot(path=str(OUT/f'{tag}-p1-gacha.png'))
  with pg.expect_event('close'):pg.close(run_before_unload=True)
  pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz');assert pg.evaluate('Economy.ITEMS.length')==58
  if pg.locator('#claim').is_visible():pg.locator('#claim').click()
  pg.wait_for_selector('#mGo');notice=pg.locator('#modal').inner_text();assert '16 件新衣服和帽子' in notice and '22 件' not in notice;assert pg.evaluate(FLAGS)['launch']=='1';assert pg.evaluate(FLAGS)['visit'] is None;pg.screenshot(path=str(OUT/f'{tag}-p2-first-notice.png'));pg.locator('#mGo').click();assert pg.evaluate(FLAGS)=={'launch':'1','visit':'1'};assert pg.locator('button[data-tab="gacha"]').evaluate('(el)=>el.classList.contains("on")');assert not errs;rows.append({'path':path,'scenario':'P1 cancel/old gacha/real close/P2 first notice','pass':True,'errors':errs});c.close()
  for fault in ['none','backup','unknown']:
   c,pg,errs=start(b,path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz');pg.wait_for_selector('#claimBb70');assert pg.evaluate('Economy.ITEMS.length')==58;before=pg.evaluate('({raw:localStorage.getItem(__tzz.SAVE_KEY),pending:__tzz.state.pending,coins:__tzz.state.coins,coinFrac:__tzz.state.coinFrac,dailyDoubleDay:__tzz.state.dailyDoubleDay})');pg.evaluate(OBSERVER);pg.evaluate('(fault)=>window.__fault=fault',fault);pg.locator('#claimBb70').click()
   if fault=='none':
    assert pg.evaluate('__writes.length')==1;disk=pg.evaluate('JSON.parse(__readMain())');assert disk['coins']==before['coins']+math.floor(before['coinFrac']+before['pending']['amount']),(disk['coins'],before);assert disk['dailyDoubleDay']==before['dailyDoubleDay'];assert disk['pending'] is None;assert sum(x['id']==before['pending']['id'] for x in disk['claimLog'])==1;assert pg.evaluate(FLAGS)=={'launch':'1','visit':'1'};assert pg.locator('button[data-tab="gacha"]').evaluate('(el)=>el.classList.contains("on")');owned=pg.evaluate('__tzz.state.gacha.owned.length');wallet=pg.evaluate('__tzz.state.coins');draws=pg.evaluate('__tzz.state.gacha.draws')
    for reward in ['d_opening_photo','d_ward_charm']:pg.locator(f'[data-act="claimHidden"][data-arg="{reward}"]').click()
    assert pg.evaluate('__tzz.state.gacha.owned.length')==owned+2;assert pg.evaluate('__tzz.state.coins')==wallet;assert pg.evaluate('__tzz.state.gacha.draws')==draws
    pg.reload();pg.wait_for_function('!!window.__tzz');assert pg.evaluate('(id)=>__tzz.state.claimLog.filter(x=>x.id===id).length',before['pending']['id'])==1;assert pg.evaluate('Object.keys(__tzz.state.collectiblesV1.grants).length')==2;rows.append({'path':path,'hiddenClaimsFreeAndDurable':True,'scenario':'success and reload','exactOneCommit':True,'exactClaimAmount':before['pending']['amount'],'pass':True});c.close();continue
   assert pg.evaluate('__tzz.saveBlocked');assert pg.evaluate(FLAGS)=={'launch':None,'visit':None};assert pg.locator('#bb70ClaimNote').count()==1;assert pg.locator('#claim').is_disabled();assert pg.locator('#collectibleReconcile').is_visible();pg.screenshot(path=str(OUT/f'{tag}-{fault}-protected.png'));raw=pg.evaluate('__readMain()');writes=pg.evaluate('__writes.length');assert writes==(0 if fault=='backup' else 1)
   if fault=='backup':assert raw==before['raw']
   else:assert sum(x['id']==before['pending']['id'] for x in json.loads(raw)['claimLog'])==1
   pg.evaluate('window.__fault=null');pg.locator('#collectibleReconcile').click();assert not pg.evaluate('__tzz.saveBlocked');assert pg.evaluate('__writes.length')==writes;assert pg.evaluate('__readMain()')==raw;assert pg.locator('#collectionStartup').count()==0;pg.locator('#bb70ClaimOk').click();pg.wait_for_timeout(200)
   if pg.locator('#mNo').is_visible():pg.locator('#mNo').click()
   if fault=='backup':
    pg.reload();pg.wait_for_function('!!window.__tzz');pg.wait_for_selector('#claimBb70');pg.locator('#claimBb70').click()
   pg.reload();pg.wait_for_function('!!window.__tzz');assert pg.evaluate('(id)=>__tzz.state.claimLog.filter(x=>x.id===id).length',before['pending']['id'])==1;assert not errs;rows.append({'path':path,'scenario':fault,'initialWrites':writes,'realReconcileClick':True,'reconcileWrites':0,'realAcknowledgeClick':True,'noDuplicateClaimAfterReopen':True,'pass':True,'errors':errs});c.close()
 b.close()
(OUT/'integration-browser.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(json.dumps(rows,ensure_ascii=False))
