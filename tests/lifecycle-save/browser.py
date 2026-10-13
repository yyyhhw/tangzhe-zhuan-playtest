"""Real close/reload; isolated synthetic P1, natural income, post-event storage reads."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('LIFECYCLE_BASE','http://127.0.0.1:8870');OUT=Path(os.getenv('LIFECYCLE_OUT','/tmp/lifecycle-baseline.json'))
TRACE=r'''(()=>{const native=Storage.prototype.setItem,add=EventTarget.prototype.addEventListener;let n=0,trace=[];function log(kind){const a=window.__tzz,r=window.FormalCollectionRuntime||window.PreviewCollectionRuntime;trace.push({kind,blocked:a?.saveBlocked,owns:r?.ownsLock(),coins:a?.state.coins,at:Date.now()});native.call(localStorage,'lifecycleTrace',JSON.stringify(trace));}Storage.prototype.setItem=function(k,v){const result=native.call(this,k,v);if(window.__tzz&&k===__tzz.SAVE_KEY){window.__mainWrites=(window.__mainWrites||0)+1;log('main-write');}return result;};EventTarget.prototype.addEventListener=function(type,fn,opts){if(type==='pagehide'&&typeof fn==='function'){const id=++n;const original=fn;fn=function(e){log('pagehide-'+id+'-start');try{return original.call(this,e);}finally{log('pagehide-'+id+'-end');queueMicrotask(()=>log('pagehide-'+id+'-microtask'));}};}return add.call(this,type,fn,opts);};window.__initialStorage=Object.fromEntries(Object.entries(localStorage));})();'''
results=[]
PATHS=[('formal','/'),('preview','/preview/'),('formal','/pet/game/')]
if os.getenv('LIFECYCLE_SINGLE'):PATHS=PATHS[:1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in PATHS:
  for action in ['reload','close']:
   c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();pg.goto(BASE+'/probe',wait_until='domcontentloaded')
   seed=json.loads((Path(__file__).parent/'fixtures'/f'{scope}-p1.json').read_text());pg.evaluate('(rows)=>{for(const [k,v]of rows)localStorage.setItem(k,v)}',seed)
   c.add_init_script(TRACE);pg.goto(BASE+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
   for _ in range(3):
    for sel in ['#claim','#mOk','#mX']:
     if pg.locator(sel).is_visible():pg.locator(sel).click(force=True)
   count=pg.evaluate('window.__mainWrites||0');pg.wait_for_function('(n)=>(window.__mainWrites||0)>n',arg=count,timeout=25000);pg.wait_for_timeout(9000)
   before=pg.evaluate('({memory:__tzz.state.coins,disk:JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).coins,key:__tzz.SAVE_KEY,raw:localStorage.getItem(__tzz.SAVE_KEY)})');assert before['memory']>before['disk']
   if action=='reload':
    pg.reload();pg.wait_for_function('!!window.__tzz');raw=pg.evaluate('(key)=>window.__initialStorage[key]',before['key']);trace=pg.evaluate('JSON.parse(window.__initialStorage.lifecycleTrace)')
   else:
    pg.close(run_before_unload=True);pg=c.new_page();pg.goto(BASE+'/probe');raw=pg.evaluate('(key)=>localStorage.getItem(key)',before['key']);trace=pg.evaluate('JSON.parse(localStorage.lifecycleTrace)')
   after=json.loads(raw)
   if action=='close':pg.goto(BASE+path);pg.wait_for_function('!!window.__tzz')
   reopened=pg.evaluate('({coins:__tzz.state.coins,pending:__tzz.state.pending,blocked:__tzz.saveBlocked})')
   row={'path':path,'action':action,'memoryBefore':before['memory'],'diskBefore':before['disk'],'diskAfter':after['coins'],'savedTail':after['coins']>=before['memory'],'reopened':reopened,'reopenedCoinsPlusPending':reopened['coins']+(reopened.get('pending') or {}).get('amount',0),'trace':trace};results.append(row);print(json.dumps(row),flush=True);c.close()
 b.close()
OUT.write_text(json.dumps(results,indent=2))
if os.getenv('EXPECT_SAVED')=='1':
 for r in results:
  assert r['savedTail'] and r['reopenedCoinsPlusPending']>=r['memoryBefore']
  trace=r['trace'];start=next(i for i,x in enumerate(trace) if x['kind']=='pagehide-1-start');end=next(i for i,x in enumerate(trace) if x['kind']=='pagehide-1-end');writes=[x for x in trace[start:end] if x['kind']=='main-write'];assert len(writes)==1 and writes[0]['owns'] and not writes[0]['blocked'];assert not trace[end]['owns']
