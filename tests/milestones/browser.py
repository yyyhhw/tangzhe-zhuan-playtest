"""Isolated synthetic saves, installed Chromium only. Run against a local candidate server."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765/'
OUT=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/xingtu02-browser');OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name, condition):
    assert condition, name
    checks.append(name)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Shanghai')
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE);page.wait_for_function('window.__tzz && window.XingTu')
    page.get_by_role('button',name='开摊！',exact=True).click()
    first=page.evaluate('__tzz.state.milestones.events.firstShop')
    check('new game records real opening time',first==page.evaluate('__tzz.state.created'))
    # Funding is an explicit synthetic fixture; hire itself uses the real UI/transaction.
    page.evaluate('__tzz.state.coins=1000000; __tzz.persist(); __tzz.renderTab()')
    page.locator('button[data-act="hire"][data-arg="0"]').click()
    page.wait_for_function('__tzz.state.milestones.events.firstEmployee !== undefined')
    employee=page.evaluate('__tzz.state.milestones.events.firstEmployee')
    check('real hire click records successful event',employee>=first)
    m=page.evaluate('__tzz.state.milestones')
    page.reload();page.wait_for_function('window.__tzz && window.XingTu')
    check('refresh preserves exact first times',page.evaluate('__tzz.state.milestones')==m)
    page.goto(BASE+'pet/game/');page.wait_for_function('window.__tzz && window.XingTu')
    check('root to pet preserves ledger and formal save namespace',page.evaluate('__tzz.state.milestones')==m)
    second=ctx.new_page();second.goto(BASE);second.wait_for_timeout(700)
    check('second live tab cannot own writer',not second.evaluate('!!window.FormalCollectionRuntime?.ownsLock()'))
    check('second live tab does not initialize gameplay',not second.evaluate('!!window.__tzz'))
    check('second tab leaves milestone bytes unchanged',page.evaluate('__tzz.state.milestones')==m)
    second.close()
    seed=page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    default=page.evaluate("async()=> (await import('/space/domain.mjs')).defaultSpace()")
    ctx.close()
    # Old progressed save, no ledger: no migration timestamp may be inferred.
    key='tangzhe-formal-collection-v1-save';old=json.loads(seed[key]);old.pop('milestones',None)
    for shop in old['shops']:shop.update(open=True,lv=35,emp=1)
    old['space']=default;old['space']['ended']=True;old['coins']=10**15
    old['lastSeen']=old['maxSeen']=int(time.time()*1000)
    seed[key]=json.dumps(old);seed.pop('tangzhe-formal-collection-v1-tab-lock',None)
    legacy=b.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Shanghai')
    q=legacy.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
    q.goto(BASE+'icon.svg');q.evaluate('(seed)=>{localStorage.clear();for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v)}',seed)
    q.goto(BASE);q.wait_for_function('window.__tzz && window.XingTu')
    # Resolve any real offline panel through its existing claim button.
    if q.locator('#claim').is_visible(): q.locator('#claim').click()
    opened=q.evaluate('XingTu.open()');check('legacy space opens under existing guard',opened['ok'])
    q.locator('#xingtuBuyEarth').click();q.locator('#xingtuRecapView').wait_for()
    check('Earth purchase and timestamp commit together',q.evaluate('__tzz.state.space.earth && Number.isSafeInteger(__tzz.state.milestones.events.earth)'))
    check('legacy first shop has no fabricated date',q.evaluate('__tzz.state.milestones.events.firstShop === null'))
    check('unknown unproven zombie event omitted',q.locator('#milestone-firstZombie').count()==0)
    check('legacy confirmed event has grey prior-record label','记录开始之前' in q.locator('#milestone-firstShop').inner_text())
    check('total uses from-recorded wording','从有记录起' in q.locator('#xingtuRecapView').inner_text())
    q.locator('#milestone-earth summary').click()
    local=q.evaluate("new Date(__tzz.state.milestones.events.earth).toLocaleString('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})")
    check('cell opens browser local date',q.locator('#milestone-earth p').inner_text()==local)
    check('390 viewport has no horizontal overflow',q.evaluate('document.documentElement.scrollWidth <= 390'))
    q.screenshot(path=str(OUT/'recap-390.png'),full_page=True)
    stored=q.evaluate('__tzz.state.milestones');q.locator('#xingtuRecapDone').click();q.reload();q.wait_for_function('window.__tzz && window.XingTu')
    check('Earth timestamp survives refresh exactly',q.evaluate('__tzz.state.milestones')==stored)
    check('no page JavaScript errors',not errors)
    legacy.close();b.close()
(OUT/'results.json').write_text(json.dumps({'browser':'installed /usr/bin/chromium','checks':checks,'count':len(checks),'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'output':str(OUT)},ensure_ascii=False))
