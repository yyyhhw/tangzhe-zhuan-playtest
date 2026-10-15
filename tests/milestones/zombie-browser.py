"""Real start handshake, isolated Chromium saves; no combat rule changes."""
import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765/'
OUT=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/xingtu02-zombie');OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name)
def boot(ctx,path):
 q=ctx.new_page();q.goto(BASE+path)
 for _ in range(80):
  if q.evaluate('!!window.__tzz'):break
  for sel in ['#collectibleUpgradeConfirm','button:has-text("同意并继续")']:
   if q.locator(sel).is_visible():q.locator(sel).click()
  q.wait_for_timeout(100)
 q.wait_for_function('window.__tzz');q.evaluate('__tzz.closeModal()');return q
def child(q):
 q.evaluate('__tzz.openZombie()');q.wait_for_function('document.querySelector("#zbFrame").contentWindow.__zb?.proto.ready')
 return next(f for f in q.frames if '/zombie/' in f.url)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal',''),('preview','preview/')]:
  ctx=b.new_context(viewport={'width':390,'height':844});q=boot(ctx,path);errors=[];q.on('pageerror',lambda e:errors.append(str(e)));f=child(q)
  check(scope+' menu is not participation',q.evaluate('!Object.hasOwn(__tzz.state.milestones?.events??{},"firstZombie")'))
  check(scope+' locked endless start fails',f.evaluate('__zb.start("endless")') is False)
  check(scope+' failed start records nothing',q.evaluate('!Object.hasOwn(__tzz.state.milestones?.events??{},"firstZombie")'))
  q.evaluate('__tzz.closeZombie()');check(scope+' menu cancellation records nothing',q.evaluate('!Object.hasOwn(__tzz.state.milestones?.events??{},"firstZombie")'))
  f=child(q)
  q.evaluate('''()=>{const send=MessagePort.prototype.postMessage;window.dropStartAck=true;MessagePort.prototype.postMessage=function(d,...rest){if(window.dropStartAck&&d?.ack==='start')return;return send.call(this,d,...rest)};}''')
  f.evaluate('__zb.start("level",1)');q.wait_for_function('__tzz.zbRun !== null');q.wait_for_timeout(100)
  check(scope+' registration before child ack does not record',q.evaluate('!Object.hasOwn(__tzz.state.milestones?.events??{},"firstZombie")'))
  check(scope+' direct recorder refuses unconfirmed registration',not q.evaluate('(window.FormalCollectionRuntime??window.PreviewCollectionRuntime).coordinator.recordZombieStarted()')['ok'])
  f.wait_for_function('__zb.G === null',timeout=6000)
  check(scope+' timed-out start records nothing',q.evaluate('!Object.hasOwn(__tzz.state.milestones?.events??{},"firstZombie")'))
  q.evaluate('window.dropStartAck=false')
  f.locator('#startBtn').click();f.wait_for_function('__zb.G && !__zb.G.pendStart && __zb.G.t>0')
  q.wait_for_function('Number.isSafeInteger(__tzz.state.milestones?.events.firstZombie)')
  at=q.evaluate('__tzz.state.milestones.events.firstZombie')
  check(scope+' actual battle records before any victory',q.evaluate('__tzz.state.zombie.cleared===0'))
  # Force a collision in the synthetic game to exercise the existing defeat path.
  f.evaluate('''()=>{const g=__zb.G,p=g.p;p.hp=1;p.inv=0;p.fireCd=999;g.zs.push({x:p.x,y:p.y,r:15,hp:100000,sp:0,kx:0,ky:0,slow:0,flash:0,wob:0,dmg:999,type:'normal'});__zb.step(.01);}''')
  f.wait_for_function('__zb.G.over && __zb.G.win===false')
  check(scope+' defeat retains first participation time',q.evaluate('__tzz.state.milestones.events.firstZombie')==at)
  f.evaluate('__zb.send({zb:"started",runId:__zb.G.runId,ceo:__zb.G.ceo})');q.wait_for_timeout(100)
  check(scope+' repeated confirmation never overwrites',q.evaluate('__tzz.state.milestones.events.firstZombie')==at)
  q.evaluate('__tzz.closeZombie()');q.reload();q.wait_for_function('window.__tzz');check(scope+' refresh retains participation',q.evaluate('__tzz.state.milestones.events.firstZombie')==at)
  check(scope+' no page errors',not errors);ctx.close()
 # A private milestone write failure must not persist a date.
 ctx=b.new_context();q=boot(ctx,'');q.evaluate('''()=>{const set=Storage.prototype.setItem;window.mainWrites=0;Storage.prototype.setItem=function(k,v){if(k==='tangzhe-formal-collection-v1-save'&&Number.isSafeInteger(JSON.parse(v).milestones?.events.firstZombie)&&++window.mainWrites===1)throw Error('synthetic private failure');return set.call(this,k,v)};}''');f=child(q);f.locator('#startBtn').click();f.wait_for_function('__zb.G && !__zb.G.pendStart');q.wait_for_function('__tzz.saveBlocked');check('private save failure never writes date',q.evaluate('!Object.hasOwn(JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).milestones.events,"firstZombie")'));ctx.close()
 ctx=b.new_context();q=boot(ctx,'');q.evaluate('''()=>{const set=Storage.prototype.setItem,get=Storage.prototype.getItem;window.mainWrites=0;window.unknownRead=false;Storage.prototype.setItem=function(k,v){const r=set.call(this,k,v);if(k==='tangzhe-formal-collection-v1-save'&&Number.isSafeInteger(JSON.parse(v).milestones?.events.firstZombie)&&++window.mainWrites===1)window.unknownRead=true;return r};Storage.prototype.getItem=function(k){if(k==='tangzhe-formal-collection-v1-save'&&window.unknownRead){window.unknownRead=false;throw Error('synthetic unknown readback')}return get.call(this,k)};}''');f=child(q);f.locator('#startBtn').click();q.wait_for_function('__tzz.saveBlocked')
 at=q.evaluate('JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).milestones.events.firstZombie');check('unknown readback retains only intended persisted date',isinstance(at,int))
 q.evaluate('__tzz.closeZombie()');q.locator('#collectibleReconcile').click();q.wait_for_function('!__tzz.saveBlocked');check('unknown reconciliation adopts original date without replay',q.evaluate('__tzz.state.milestones.events.firstZombie')==at);check('reconciliation does not repeat milestone write',q.evaluate('window.mainWrites')==1);ctx.close();b.close()
(OUT/'results.json').write_text(json.dumps({'browser':'installed Chromium','passed':len(checks),'checks':checks},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':len(checks)}))
