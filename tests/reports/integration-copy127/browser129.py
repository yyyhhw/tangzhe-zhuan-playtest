import pathlib,threading,http.server,functools,json,sys,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(tempfile.mkdtemp(prefix='copy127-integration-'));out.mkdir(parents=True,exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
rows=[]
def ready(p):
 for _ in range(5):
  p.wait_for_function("!!window.__tzz || [...document.querySelectorAll('button')].some(b=>['同意并继续','保留备份并升级'].includes(b.textContent))",timeout=30000)
  if p.evaluate('!!window.__tzz'):break
  for label in ['同意并继续','保留备份并升级']:
   b=p.get_by_role('button',name=label,exact=True)
   if b.is_visible():b.click();break
 p.wait_for_function('!!window.__tzz && !!window.XingTu',timeout=30000)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for entry in ['/','/pet/game/','/preview/']:
  for route in ['station','mars','moon']:
   row={'entry':entry,'route':route};ctx=browser.new_context(viewport={'width':390,'height':844});p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin+'/') else r.abort())
   try:
    p.goto(origin+entry);ready(p);key=p.evaluate('window.__tzz.SAVE_KEY');p.goto(origin+'/version.json')
    row['fixture']=p.evaluate('''async({key,route})=>{const {defaultSpace}=await import('/space/domain.mjs');const {planMoon,TIER_PRICE}=await import('/space/moon.mjs');let s=JSON.parse(localStorage.getItem(key));for(const shop of s.shops){shop.open=true;shop.lv=35;shop.emp=0;}s.coins=TIER_PRICE[0]-1;s.coinFrac=0;s.space=defaultSpace();s.space.lv={tech:5,war:5,med:5,life:5};s.space.pts=120;const now=Date.now(),T=now-4000000;const run=(intent,t)=>{const r=planMoon(s,intent,{scope:key.includes('preview')?'preview':'formal',now:t,makeId:()=> '00000000-0000-4000-8000-000000000001'});if(!r.ok)throw Error(r.code);s=r.state;};run({type:'depart',route},T);const id=s.space.voyage.voyageId,arrival=T+s.space.voyage.dur;run({type:'choose',voyageId:id,choice:'b'},arrival);run({type:'claim',voyageId:id},arrival+1);s.coins=TIER_PRICE[0]-1;s.lastSeen=now;s.maxSeen=now;localStorage.setItem(key,JSON.stringify(s));return {price:TIER_PRICE[0],coins:s.coins};}''',{'key':key,'route':route})
    p.goto(origin+entry);ready(p);p.evaluate('window.__tzz.closeModal(); window.__tzz.switchShop(3)')
    # Use real installed host, same open action as production entry.
    p.locator('[data-act="xingtu"]').click();assert p.evaluate('window.XingTu.isOpen()')
    snapshot=p.evaluate('JSON.stringify(window.__tzz.state.space)');row['completedTabs']={}
    for tab in ['Voyage','Map','Ship','Album']:
     p.click('#xingtuTab'+tab)
     subtitle=p.locator('#xingtuRuleset').inner_text();row['completedTabs'][tab]=subtitle
     assert subtitle.startswith('上趟：') and subtitle.endswith('返航报告已收下'),subtitle
     assert '看完再领探索点' not in subtitle
     assert p.evaluate('JSON.stringify(window.__tzz.state.space)')==snapshot
     if route=='station':p.screenshot(path=str(out/f'{entry.strip("/").replace("/","-") or "root"}-{tab}.png'))
    assert len(set(row['completedTabs'].values()))==1
    p.click('#xingtuTabVoyage')
    row['report']=p.locator('#xingtuRuleset').inner_text();assert row['report'].startswith('上趟：') and '返航报告已收下' in row['report']
    assert p.locator('#xingtuNextRoute').inner_text()=='下次出航：月面基地 · 其他目的地请到星图选择'
    row['statusText']=p.locator('#xingtuStatus').inner_text();assert '月面基地累计往返次数' in row['statusText']
    p.screenshot(path=str(out/f'{entry.strip("/").replace("/","-") or "root"}-{route}-report.png'))
    p.click('#xingtuTabShip');row['labPoor']=p.locator('#xingtuLab').inner_text();assert '火箭老板的研究台' in row['labPoor'];assert '900.1 万' in row['labPoor'];assert p.locator('#xingtuBuy-tech-1').is_disabled()
    result=p.evaluate('''async()=>{window.XingTu.close();return await window.__tzz.atomic(()=>{window.__tzz.state.coins=9000090;return {ok:true};},'isolated exact price fixture');}''');assert result['ok'],result
    p.evaluate('window.XingTu.open()');p.click('#xingtuTabShip');assert not p.locator('#xingtuBuy-tech-1').is_disabled();row['labExact']=p.locator('#xingtuLab').inner_text()
    p.screenshot(path=str(out/f'{entry.strip("/").replace("/","-") or "root"}-{route}-lab.png'))
    before=p.evaluate('window.__tzz.state.coins');p.click('#xingtuBuy-tech-1');p.wait_for_function("window.__tzz.state.space.items['tech:1']===1");after=p.evaluate('window.__tzz.state.coins');assert before-after==9000090,(before,after);row['actualSpend']=before-after
    p.click('#xingtuTabVoyage');prev=p.evaluate('window.XingTu.view().space');p.click('#xingtuDepart');p.wait_for_function("window.XingTu.view().phase==='flying'");nxt=p.evaluate('window.XingTu.view()');assert nxt['voyage']['route']=='moon';assert nxt['space']['pts']==prev['pts'];assert nxt['space']['visits']==prev['visits'];assert p.locator('#xingtuRuleset').inner_text().startswith('这趟：月面基地')
    row['flyingTabs']={}
    for tab in ['Voyage','Map','Ship','Album']:
     p.click('#xingtuTab'+tab);subtitle=p.locator('#xingtuRuleset').inner_text();row['flyingTabs'][tab]=subtitle
     assert subtitle.startswith('这趟：月面基地') and '返航报告已收下' not in subtitle,subtitle
    row['horizontalOverflow']=p.evaluate('document.documentElement.scrollWidth>innerWidth');assert not row['horizontalOverflow'];assert not errors,errors;row['result']='PASS'
   except Exception as e:row.update(result='FAIL',reason=str(e),errors=errors,body=p.locator('body').inner_text()[-2200:])
   print(json.dumps(row,ensure_ascii=False),flush=True);rows.append(row);ctx.close()
 browser.close()
server.shutdown();(out/'browser-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
