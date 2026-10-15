"""Real start handshake, isolated Chromium saves; no combat rule changes."""
import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765/'
OUT=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/xingtu02-zombie');OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name)
 print(name,flush=True)
def boot(ctx,path):
 q=ctx.new_page();q.goto(BASE+path)
 for _ in range(80):
  if q.evaluate('!!window.__tzz'):break
  for sel in ['#collectibleUpgradeConfirm','button:has-text("同意并继续")']:
   button=q.locator(sel)
   if button.is_visible() and button.is_enabled():
    try:button.click(timeout=1000)
    except PlaywrightTimeoutError:pass # transient consent/migration DOM; wait for the real app below
  q.wait_for_timeout(100)
 q.wait_for_function('window.__tzz');q.evaluate('__tzz.closeModal()');return q
def child(q):
 q.evaluate('__tzz.openZombie()');q.wait_for_function('document.querySelector("#zbFrame").contentWindow.__zb?.proto.ready')
 return next(f for f in q.frames if '/zombie/' in f.url)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal',''),('preview','preview/')]:
  if len(sys.argv)>3 and scope!=sys.argv[3]:continue
  for action in ['timeout','timeout-lost-invalidation','cancel','navigation','close-reopen','pagehide','expired-confirmation']:
   ctx=b.new_context();q=boot(ctx,path);f=child(q)
   q.evaluate("""()=>{const send=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(d,...rest){if(d?.ack==='start' && !window.allowAck)return;return send.call(this,d,...rest)};}""")
   if action in ['pagehide','expired-confirmation']:
    q.evaluate('window.allowAck=true')
    f.evaluate("""()=>{const send=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(d,...rest){if(d?.zb==='started')return;return send.call(this,d,...rest)};}""")
   if action=='timeout-lost-invalidation':
    f.evaluate("""()=>{const send=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(d,...rest){if(d?.zb==='startInvalidated')return;return send.call(this,d,...rest)};}""")
   f.evaluate('__zb.start("level",1)');q.wait_for_function('__tzz.zbRun !== null')
   q.evaluate("""()=>{const w=document.querySelector('#zbFrame').contentWindow;const r=__tzz.zbRun;window.oldRun={runId:r.runId,ceo:r.ceoId};window.oldSend=w.__zb.send;window.replay=()=>oldSend({zb:'started',...oldRun});}""")
   if action.startswith('timeout'):f.wait_for_function('__zb.G===null',timeout=6000)
   elif action=='cancel':f.evaluate('document.querySelector("#menuBtn").click()');f.wait_for_function('__zb.G===null')
   elif action=='navigation':
    f.goto(BASE+path+'zombie/?embed=1&reloaded=1');q.wait_for_function('document.querySelector("#zbFrame").contentWindow.__zb?.proto.ready')
   elif action=='close-reopen':q.evaluate('__tzz.closeZombie()');f=child(q)
   elif action=='pagehide':f.evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide"))')
   elif action=='expired-confirmation':q.wait_for_timeout(4200)
   # For dropped started notification cases restore the raw port method to allow replay.
   if action in ['pagehide','expired-confirmation']:
    # Parent prototype is unfiltered for zb messages, and ports share the native brand.
    f.evaluate('()=>{MessagePort.prototype.postMessage=parent.MessagePort.prototype.postMessage;}')
   q.evaluate('replay()');q.wait_for_timeout(150)
   check(scope+' '+action+' old confirmation rejected',q.evaluate('!Object.hasOwn(__tzz.state.milestones?.events??{},"firstZombie")'))
   check(scope+' '+action+' disk has no fabricated date',q.evaluate('!Object.hasOwn(JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).milestones?.events??{},"firstZombie")'))
   q.evaluate('window.allowAck=true');q.evaluate('__tzz.closeZombie()');f=child(q)
   f.locator('#startBtn').click();q.wait_for_function('Number.isSafeInteger(__tzz.state.milestones?.events.firstZombie)')
   before=q.evaluate('localStorage.getItem(__tzz.SAVE_KEY)')
   f.evaluate('__zb.send({zb:"started",runId:__zb.G.runId,ceo:__zb.G.ceo})');q.wait_for_timeout(50)
   check(scope+' '+action+' new real start succeeds once',q.evaluate('localStorage.getItem(__tzz.SAVE_KEY)')==before)
   ctx.close()
 b.close()
(OUT/'results.json').write_text(json.dumps({'browser':'installed Chromium','passed':len(checks),'checks':checks},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':len(checks)}))
