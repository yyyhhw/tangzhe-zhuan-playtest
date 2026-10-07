# Real parent app.js / persist integration; must run with installed WebKit.
# Use an isolated local preview URL, never a player's browser/profile.
# python3 preview/td/test_td_parent_e2e.py http://127.0.0.1:8765/preview/index.html
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/preview/index.html'
assert '/preview/' in URL, 'This integration test is preview-only'
passed = 0
def check(ok, message):
    global passed
    assert ok, message
    passed += 1
    print('PASS', message)
def child(pg):
    pg.wait_for_function("__tzz.tdOpen")
    for _ in range(100):
        for f in pg.frames:
            if '/td/index.html' in f.url:
                try:
                    if f.evaluate('!!(window.__td && __td.proto.ready)'): return f
                except Exception: pass
        pg.wait_for_timeout(50)
    raise AssertionError('TD child did not initialize')
def setup(pg):
    pg.goto(URL); pg.wait_for_function('!!window.__tzz')
    pg.evaluate("""() => {
      const t=__tzz, s=Economy.newState(Date.now());
      s.rev=t.state.rev; s.coins=5e10; s.totalEarned=1; s.cur=3; s.muted=true;
      s.shops.forEach(x=>{x.open=true;x.lv=1;x.emp=0;});
      s.zombie={sentinel:'untouched'}; s.integrationSentinel={value:42};
      t.state=s; t.closeModal(); t.persist(); t.switchShop(3); t.renderTab();
      localStorage.setItem('tangzhe-save','FORMAL-SENTINEL');
      localStorage.setItem('tangzhe-save-bak','FORMAL-BAK-SENTINEL');
      window.__origSet=Storage.prototype.setItem; window.__failKey=null;
      Storage.prototype.setItem=function(k,v){if(k===window.__failKey)throw Error('test write failure');return __origSet.call(this,k,v);};
    }""")
with sync_playwright() as p:
    browser=p.webkit.launch()
    for device in ['iPhone SE','iPhone 15']:
        c=browser.new_context(**p.devices[device]); errors=[]
        # Disable only root automatic ticking/saving, so assertions have no
        # unrelated income/autosave race. Real persist and iframe timers run.
        c.add_init_script('if(window===window.top) window.requestAnimationFrame=()=>0;')
        pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));setup(pg)
        check(pg.locator('[data-act=td]').count()==1,device+' tech entry exists')
        check(pg.evaluate("document.querySelector('.td-card')===document.querySelector('.td-card').parentElement.lastElementChild"),device+' entry is bottom card')
        pg.locator('[data-act=td]').click(); f=child(pg)
        for key in ['tangzhe-preview-save','tangzhe-preview-save-bak']:
            before=pg.evaluate('JSON.stringify(__tzz.state)');disk=pg.evaluate("localStorage.getItem('tangzhe-preview-save')")
            pg.evaluate('(k)=>window.__failKey=k',key)
            f.evaluate("__td.buyUp('bbq')");f.wait_for_function('!__td.pend')
            check(pg.evaluate('JSON.stringify(__tzz.state)')==before,device+' actual persist '+key+' failure rolls back full state')
            check(pg.evaluate("localStorage.getItem('tangzhe-preview-save')")==disk,device+' failure preserves main bytes')
            pg.evaluate('window.__failKey=null')
        coins=pg.evaluate('__tzz.state.coins')
        f.evaluate("__td.buyUp('bbq')");f.wait_for_function('!__td.pend')
        check(pg.evaluate('__tzz.state.coins')==coins-1e6 and pg.evaluate('__tzz.state.td.lv.bbq')==1,device+' debit and upgrade commit together')
        check(pg.evaluate('__tzz.state.integrationSentinel.value')==42 and pg.evaluate('__tzz.state.zombie.sentinel')=='untouched',device+' unrelated state preserved')
        f.evaluate("__td.cmdSel='pearl';__td.start(1)");f.wait_for_function('__td.G && !__td.G.pendStart')
        run=f.evaluate('__td.G.runId');check(pg.evaluate('__tzz.tdRun.cmd')=='pearl',device+' parent locks commander')
        pg.evaluate("window.__failKey='tangzhe-preview-save'")
        f.evaluate('__td.G.wave=10;__td.G.q=[];__td.G.es=[];__td.step(.01)');f.wait_for_function('__td.G.over && !__td.G.wait')
        check(not f.evaluate('__td.G.saveOk') and pg.evaluate('__tzz.state.td.cleared')==0,device+' real result save failure does not claim completion')
        pg.evaluate('window.__failKey=null');f.locator('#retryBtn').click();f.wait_for_function('__td.G.saveOk')
        check(pg.evaluate('__tzz.state.td.cleared')==1 and f.evaluate('__td.G.runId')==run,device+' same-run retry persists completion')
        check(pg.evaluate("localStorage.getItem('tangzhe-save')")=='FORMAL-SENTINEL' and pg.evaluate("localStorage.getItem('tangzhe-save-bak')")=='FORMAL-BAK-SENTINEL',device+' formal saves untouched')
        check(pg.evaluate("localStorage.getItem('tangzhe-td-proto')")==None,device+' embedded creates no prototype wallet')
        pg.evaluate('__tzz.closeTD()');pg.reload();pg.wait_for_function('!!window.__tzz')
        check(pg.evaluate('__tzz.state.td.lv.bbq')==1 and pg.evaluate('__tzz.state.td.cleared')==1,device+' refresh restores main-save TD progress')
        pg.evaluate('__tzz.closeModal();__tzz.openTD()');f=child(pg)
        check(f.evaluate('__td.cmdSel')=='pearl',device+' reopened menu restores saved commander')
        check(not errors,device+' no page errors: '+str(errors));c.close()
    browser.close()
print('Real parent WebKit E2E:',passed,'checks passed')
