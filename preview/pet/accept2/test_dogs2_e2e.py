"""Current dog compatibility acceptance: one purchase per species, preserved old dogs.

Run against a disposable local preview only. Requires an existing Playwright
installation; never installs browsers. Default WebKit, --browser chromium for
an explicitly labelled Chromium run. Two simulated phone sizes, never real devices.
Mixed-species replacement and the unified portal are in test_pet_portal_e2e.mjs.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

def require(value, message):
    if not value:
        raise AssertionError(message)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url',nargs='?',default='http://127.0.0.1:8765/preview/')
    parser.add_argument('--browser',choices=['webkit','chromium'],default='webkit')
    parser.add_argument('--shots',type=Path,default=Path(__file__).parent/'_dogs2_shots')
    args=parser.parse_args()
    parsed=urlparse(args.url)
    require(parsed.hostname in ['127.0.0.1','localhost','::1'] and '/preview/' in parsed.path and 'test=homes' not in parsed.query,'Disposable local preview only')
    from playwright.sync_api import sync_playwright
    rows=[]
    with sync_playwright() as pw:
        browser=getattr(pw,args.browser).launch()
        for width,height in [(375,667),(393,852)]:
            context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,is_mobile=True,has_touch=True)
            context.add_init_script("let api;Object.defineProperty(window,'__tzz',{get:()=>api,set:v=>{api=v;v?.pets?.manual(true)}})")
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            def boot():
                page.wait_for_function("window.__tzz&&document.body.dataset.petReady==='1'")
                page.evaluate("async()=>{for(let i=0;i<5;i++){if(__tzz.modalOpen())__tzz.closeModal();await new Promise(r=>setTimeout(r,70));}__tzz.setTab('home');__tzz.homeAct('homeWho','c77');__tzz.homeAct('homeSub','room');__tzz.renderTab();__tzz.pets.draw()}")
            def snapshot():
                return page.evaluate("()=>({state:JSON.stringify(__tzz.state),main:localStorage.getItem(__tzz.SAVE_KEY),bak:localStorage.getItem(__tzz.BAK_KEY)})")
            def draw():
                page.evaluate("()=>{__tzz.renderTab();__tzz.pets.draw()}")
            page.goto(args.url);boot()
            page.evaluate("""()=>{const E=__tzz.E,s=E.newState(Date.now());for(const c of E.CEOS){s.ceos[c.id].unlocked=true;E.homeOf(s,c.id).lv=2;E.homeOf(s,c.id).placed=[];}s.coins=50000;s.muted=true;localStorage.setItem('tangzhe-save','FORMAL-SENTINEL');localStorage.setItem(__tzz.SAVE_KEY,JSON.stringify(s));localStorage.setItem(__tzz.BAK_KEY,JSON.stringify(s));}""")
            page.reload();boot();page.locator('#petEntry').click();page.locator('.pet-selected [data-act="homePetBuy"]').click();page.locator('#pbYes').click();draw()
            before=snapshot();require(json.loads(before['state'])['coins']==47000,'First dog charged once')
            for room in ['c77','pearl']:
                page.evaluate("r=>__tzz.homeAct('homePetBuy',r+'|dog')",room)
                require(page.locator('#pbYes').count()==0 and snapshot()==before,'Second dog must be blocked without charging or saving')
            uid=page.evaluate('__tzz.state.pets.list[0].uid')
            page.locator('[data-act="petStandby"]').click();draw();before=snapshot()
            page.evaluate("__tzz.homeAct('homePetBuy','pearl|dog')")
            require(snapshot()==before and page.locator('#pbYes').count()==0,'Standby ownership must also block second purchase')
            page.locator('[data-act="petPlace"]').click();draw()
            # Seed a historical duplicate record, not a new purchase. Preserve both growth records.
            page.evaluate("""()=>{const s=JSON.parse(JSON.stringify(__tzz.state)),a=s.pets.list[0];a.eng={v:1,home:'c77',savedAt:Date.now(),dog:{x:2,y:2,affinity:51,energy:80}};s.pets.list.push({...a,uid:'legacy-extra',boughtAt:77,eng:{...a.eng,dog:{...a.eng.dog,affinity:73}}});localStorage.setItem(__tzz.SAVE_KEY,JSON.stringify(s));localStorage.setItem(__tzz.BAK_KEY,JSON.stringify(s));}""")
            page.reload();boot();require(page.locator('#roomFloor .pet-sprite').count()==1,'Only active legacy dog runs')
            page.locator('#petEntry').click();page.locator('[data-act="petSelectRecord"][data-arg="legacy-extra"]').click();draw()
            require(page.locator('#petPanel [data-act="homePetPat"]').count()==0,'Management must not contain interaction buttons')
            # Actual main-write failure must roll back the legacy swap.
            before=snapshot()
            page.evaluate("""()=>{const set=Storage.prototype.setItem;window.restoreStorage=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(k,v){if(k===__tzz.SAVE_KEY)throw new DOMException('isolated quota','QuotaExceededError');return set.call(this,k,v)}}""")
            page.locator('[data-act="petActivate"]').click();draw()
            after=snapshot();require(after['state']==before['state'] and after['main']==before['main'],'Failed swap must preserve full state/main')
            page.evaluate('()=>{restoreStorage()}');page.locator('[data-act="petActivate"]').click();draw()
            require(page.locator('#roomFloor .pet-sprite').get_attribute('data-uid')=='legacy-extra','Explicit swap activates chosen old dog')
            result=page.evaluate("()=>({coins:__tzz.state.coins,pets:__tzz.state.pets.list.map(p=>[p.uid,p.eng.dog.affinity,p.boughtAt]),formal:localStorage.getItem('tangzhe-save')})")
            require(result['coins']==47000 and result['formal']=='FORMAL-SENTINEL','Coins/formal sentinel unchanged')
            require([x[1] for x in result['pets']]==[51,73] and result['pets'][1][2]==77,'Old growth and boughtAt retained')
            page.reload();boot();require(page.locator('#roomFloor .pet-sprite').get_attribute('data-uid')=='legacy-extra','Refresh keeps selected legacy record')
            require(page.locator('#petPanel').count()==0,'Refresh collapses manager')
            require(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'No horizontal overflow')
            # A second live tab claims this disposable save. The frozen first tab
            # must not buy, replace, change room or send a pet to standby.
            page.wait_for_function("PetGame.speciesReady('cat')&&PetGame.speciesReady('rabbit')")
            fixture=page.evaluate("""()=>{const E=__tzz.E,s=__tzz.state,save=st=>E.commitSave(localStorage,__tzz.SAVE_KEY,__tzz.BAK_KEY,st);const ids={dog:s.pets.list.find(p=>p.uid==='legacy-extra').uid};for(const [species,room] of [['cat','c77'],['rabbit',null]]){const r=PetGame.buy(s,E,room,Date.now(),PetGame.assetOf(species).manifest,save,false,{species});if(!r.ok)throw Error(JSON.stringify(r));ids[species]=r.uid;}return ids;}""")
            second=context.new_page();second.goto(args.url);second.wait_for_function('window.__tzz');page.wait_for_function('__tzz.frozen')
            frozen_before=snapshot()
            for action,arg in [('homePetBuy','c77|robot'),('petPlace',fixture['rabbit']),('petStandby',fixture['dog'])]:
                page.evaluate('([a,b])=>__tzz.homeAct(a,b)',[action,arg]);require(snapshot()==frozen_before,'Frozen tab wrote during '+action)
            page.evaluate("([uid])=>{__tzz.homeAct('homeWho','pearl');__tzz.homeAct('petPlace',uid)}",[fixture['dog']]);require(snapshot()==frozen_before,'Frozen tab changed room')
            require(page.evaluate("localStorage.getItem('tangzhe-save')")=='FORMAL-SENTINEL','Multitab changed formal sentinel');second.close()
            require(not errors,'Page errors: '+repr(errors));args.shots.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(args.shots/f'legacy-{width}.png'))
            rows.append({'width':width,'browser':args.browser,'purchaseOnce':True,'standbyBlocksRepurchase':True,'legacySwapAndSaveFailure':True,'reload':True,'realTwoTabGuards':True,'errors':errors});print(json.dumps(rows[-1]));context.close()
        browser.close()
    (args.shots/'results.json').write_text(json.dumps(rows,indent=2));return 0

if __name__=='__main__':
    raise SystemExit(main())
