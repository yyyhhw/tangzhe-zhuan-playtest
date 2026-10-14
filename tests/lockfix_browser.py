"""锁修复回归：陈旧锁自动接管、活页面才拦+在本页继续、刷新/重开/bfcache不卡。python3 tests/lockfix_browser.py [base]"""
import sys
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8731/'
LOCK='tangzhe:formal:collection-v1:writer'
PANEL="()=>{const e=document.getElementById('collectionStartup');return e?e.innerText:''}"
fails=0
def check(c,msg):
  global fails
  print(('PASS ' if c else 'FAIL ')+msg); fails+= (not c)
def ready(p,t=20000):
  try: p.wait_for_function("()=>!document.getElementById('collectionStartup')&&!!window.__tzz",timeout=t); return True
  except Exception: return False
with sync_playwright() as pw:
  for name in ['chromium','webkit']:
    b=getattr(pw,name).launch()
    ctx=b.new_context(**{**({**pw.devices['iPhone 13']} if name=='webkit' else {}),'viewport':{'width':390,'height':844}})
    p=ctx.new_page(); p.goto(BASE); check(ready(p),f'{name} first open')
    p.evaluate("()=>{window.__tzz.state&&(window.__tzz.state.__probe=1)}")
    p.reload(); check(ready(p),f'{name} reload')
    p.close(); p=ctx.new_page(); p.goto(BASE); check(ready(p),f'{name} close+reopen')
    p.goto(BASE+'version.json'); p.go_back(); check(ready(p),f'{name} back/bfcache')
    # stale lease: a non-responding holder (like frozen iOS tab) holds the lock forever
    p.goto(BASE+'version.json'); p.evaluate("n=>{navigator.locks.request(n,()=>new Promise(()=>{}))}",LOCK)
    q=ctx.new_page(); q.goto(BASE); check(ready(q,25000),f'{name} stale lock auto takeover')
    # live second tab: must block, offer button, then takeover without double-write
    r=ctx.new_page(); r.goto(BASE)
    try: r.wait_for_selector('#collectibleTakeOver',timeout=15000); ok=True
    except Exception: ok=False
    check(ok and '另一个页面正在经营' in r.evaluate(PANEL),f'{name} live tab blocks with 在本页继续')
    if ok:
      r.click('#collectibleTakeOver'); check(ready(r),f'{name} takeover button works')
      q.wait_for_timeout(1500); print('  old panel:',q.evaluate(PANEL)[:60].replace(chr(10),' ')); check('已在另一页继续' in q.evaluate(PANEL),f'{name} old tab stops writing')
      check(q.evaluate("()=>window.FormalCollectionRuntime.ownsLock()")==False,f'{name} old tab lease revoked')
    b.close()
print('FAILS',fails); sys.exit(1 if fails else 0)
