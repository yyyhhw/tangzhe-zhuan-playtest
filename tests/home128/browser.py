"""390px real pointer clicks using installed Chromium; no browser downloads.
python tests/home128/browser.py [base URL] [evidence directory]
"""
import sys, json
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8732/').rstrip('/')+'/'
OUT = Path(sys.argv[2] if len(sys.argv)>2 else '_shots/home128'); OUT.mkdir(parents=True, exist_ok=True)
records=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for entry in ['', 'pet/game/']:
        tag='root' if not entry else 'pet'
        ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,timezone_id='UTC',has_touch=True,is_mobile=True)
        page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.clock.set_fixed_time(datetime(2026,10,15,20,tzinfo=timezone.utc))
        page.goto(BASE+entry);page.wait_for_function('!!window.__tzz')
        page.evaluate("__tzz.closeModal(); __tzz.setTab('home'); __tzz.homeAct('homeSub','room'); __tzz.homeAct('homeMode','live'); __tzz.renderTab()")
        page.wait_for_timeout(500)
        def setup(fid):
            return page.evaluate("""fid=>{const t=__tzz,E=t.E,H=E.homeOf(t.state,'c77');t.closeModal();t.homeAct('homeMode','decor');H.lv=1;H.placed=[];
            const inv=E.furnInvOf(t.state); inv[fid]=1;const at=E.findFree(t.state,'c77',fid,0);if(!at)throw Error('no fixture spot '+fid);
            const r=E.placeItem(t.state,'c77',fid,at.x,at.y,0,at.surf);if(!r.ok)throw Error(JSON.stringify(r));
            t.homeAct('homeMode','live');Object.assign(t.homeActor.c77,{x:0,y:3,tx:null,ty:null,pose:null,pendingPose:null,act:null,line:''});t.renderTab();return r.uid;}""",fid)
        def click(uid):
            # Playwright locator.click emits real browser pointer events and performs hit testing.
            page.locator('.furn[data-uid="'+uid+'"]').click()
        for kind,fid in [('lamp','furn_lamp'),('water','furn_plant'),('use','furn_fridge'),('wall','furn_painting'),('eat','furn_table')]:
            uid=setup(fid);click(uid)
            if entry and kind=='lamp':
                page.wait_for_timeout(300)
                assert page.evaluate("!__tzz.homeActor.c77.auto&&!__tzz.homeActor.c77.actIcon")
                records.append({'entry':entry,'kind':kind,'result':'no action: existing pet period is null'})
                print('PASS pet lamp: unchanged unavailable period gate',flush=True)
                continue
            page.wait_for_function("k=>__tzz.homeActor.c77.auto?.phase==='stay'&&__tzz.homeActor.c77.act===k",arg=kind,timeout=6000)
            result=page.evaluate("""kind=>{const a=__tzz.homeActor.c77;return {actor:__tzz.homeAutoState('c77'),icon:a.actIcon,lineOK:HomeAutonomy.linesFor(kind,'c77').includes(a.line),iconOK:a.actIcon===HomeAutonomy.iconFor(kind,'c77'),renderedLine:document.querySelector('.ha-line')?.textContent,renderedIcon:document.querySelector('.ha-act')?.innerHTML,lit:!!document.querySelector('.ha-lit'),width:innerWidth}}""",kind)
            assert result['lineOK'] and result['iconOK'],result
            assert result['renderedLine']==result['actor']['line'],result
            assert result['renderedIcon'] and result['width']==390,result
            if kind=='lamp':assert result['lit'],result
            if kind=='wall':assert result['actor']['y']<=1,result
            page.screenshot(path=str(OUT/(tag+'-'+kind+'.png')))
            records.append({'entry':entry or '/', 'kind':kind,**result});print('PASS',tag,kind,flush=True)
            # Mode switch cancels the live action. Clicking furniture in decor must only select it.
            page.locator('[data-act="homeMode"][data-arg="decor"]').click();click(uid)
            page.wait_for_timeout(100)
            assert page.evaluate("__tzz.homeMode==='decor'&&!__tzz.homeActor.c77.auto&&!__tzz.homeActor.c77.actIcon"),kind
            assert not page.locator('.ha-lit').count(),kind
        for fid,want in [('furn_sofa','sit'),('furn_bed','lie')]:
            uid=setup(fid);click(uid);page.wait_for_function("k=>__tzz.homeActor.c77.pose?.kind===k",arg=want,timeout=6000)
            print('PASS',tag,fid,want,flush=True)
        uid=setup('furn_catbed');click(uid)
        assert page.evaluate("!__tzz.homeActor.c77.auto?.player&&!__tzz.homeActor.c77.actIcon")
        assert '坐不上去' in page.locator('#toast').inner_text()
        assert not errors,errors
        records.append({'entry':entry or '/', 'pageerrors':errors,'decor': '4/4 passed' if entry else '5/5 passed','sitLie':'2/2 passed','unmatched':'passed'})
        ctx.close()
    browser.close()
(OUT/'results.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('PASS all Chromium390 checks; evidence:',OUT)
