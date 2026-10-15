import pathlib,threading,http.server,functools,json,sys,tempfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(tempfile.mkdtemp(prefix='copy127-integration-'));out.mkdir(parents=True,exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=str(root)));threading.Thread(target=srv.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{srv.server_port}'
def ready(p):
 for _ in range(5):
  p.wait_for_function("!!window.__tzz || [...document.querySelectorAll('button')].some(b=>['同意并继续','保留备份并升级'].includes(b.textContent))",timeout=30000)
  if p.evaluate('!!window.__tzz'):break
  for label in ['同意并继续','保留备份并升级']:
   b=p.get_by_role('button',name=label,exact=True)
   if b.is_visible():b.click();break
 p.wait_for_function("window.__tzz?.pet?.PG?.speciesReady('rabbit')&&window.__tzz.pet.PG.speciesReady('cat')",timeout=30000)
rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for entry in ['/','/pet/game/','/preview/','/preview/pet/game/']:
  for duplicate in [False,True]:
   row={'entry':entry,'duplicate':duplicate};ctx=b.new_context(viewport={'width':390,'height':844});ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin+'/') else r.abort());p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   try:
    p.goto(origin+entry);ready(p)
    before=p.evaluate('''duplicate=>{const t=__tzz;t.closeModal();t.pets.manual(true);t.state.coins=50000;t.state.ceos.c77.unlocked=true;const h=t.E.homeOf(t.state,'c77');h.lv=3;h.placed=[];delete t.state.pet;t.state.pets={v:2,opaqueTop:{retain:['a',3]},list:[{uid:'qa-dog-original',species:'dog',room:'c77',boughtAt:1,eng:{v:99,opaque:'dog-growth'},custom:{keep:1}},{uid:'qa-cat-original',species:'cat',room:'c77',boughtAt:2,eng:{v:99,opaque:'cat-growth'}},{uid:'qa-unknown-original',species:'unknown-future',room:'rocket',boughtAt:3,eng:{v:99,whole:[1,2]},future:{value:'KEEP'},arbitrary:null}]};if(duplicate)t.state.pets.list.push({uid:'qa-dog-second',species:'dog',room:null,boughtAt:4,eng:{v:99,opaque:'second-growth'},future:[9]});t.setTab('home');t.homeAct('homeSub','room');t.homeAct('homeMode','live');t.homeAct('petOpen');t.renderTab();return JSON.stringify(t.state.pets);}''',duplicate)
    p.locator('.pet-quarantine summary').click();row['quarantine']=p.locator('.pet-quarantine').inner_text();assert '第 1 条' in row['quarantine'];assert 'qa-unknown-original' not in row['quarantine']
    assert p.evaluate('JSON.stringify(__tzz.state.pets)')==before
    p.evaluate("__tzz.homeAct('homePetBuy','c77|rabbit')")
    p.locator('#petBuyReplace').click();row['replaceLabels']=p.locator('[data-replace-uid]').all_text_contents();ids=p.locator('[data-replace-uid]').evaluate_all('(es)=>es.map(e=>e.dataset.replaceUid)');assert ids==['qa-dog-original','qa-cat-original'],ids
    assert all('qa-' not in s for s in row['replaceLabels']);assert ('第 1 只' in row['replaceLabels'][0])==duplicate
    p.screenshot(path=str(out/f'{entry.strip("/").replace("/","-") or "root"}-{duplicate}.png'))
    p.locator('#petReplaceCancel').click();assert p.evaluate('JSON.stringify(__tzz.state.pets)')==before
    row['rawPetsUnchanged']=True;row['internalIds']=ids;assert not errors,errors;row['result']='PASS'
   except Exception as e:row.update(result='FAIL',reason=str(e),errors=errors,body=p.locator('body').inner_text()[-1800:])
   rows.append(row);print(json.dumps(row,ensure_ascii=False),flush=True);ctx.close()
 b.close()
srv.shutdown();(out/'browser127-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
raise SystemExit(any(x['result']!='PASS' for x in rows))
