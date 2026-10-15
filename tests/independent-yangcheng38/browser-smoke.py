#!/usr/bin/env python3
"""Loopback-only synthetic browser baseline, no real profiles or external sites."""
import pathlib, sys, threading, http.server, functools, json
from playwright.sync_api import sync_playwright
base=pathlib.Path(__file__).resolve().parent
root=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else base/'main'
out=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else base/'reports/browser'
out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as pw:
 for engine in ['chromium','webkit']:
  exe='/usr/bin/chromium' if engine=='chromium' else pw.webkit.executable_path
  if not pathlib.Path(exe).exists():
   results.append({'engine':engine,'status':'NOT_COVERED','reason':'existing executable absent; no download'}); continue
  try: browser=getattr(pw,engine).launch(executable_path=exe,headless=True)
  except Exception as e:
   results.append({'engine':engine,'status':'BLOCKED','reason':str(e)}); continue
  for scope in ['formal','preview']:
   for width in [320,375,390,430,768]:
    ctx=browser.new_context(viewport={'width':width,'height':844})
    ctx.route('**/*',lambda route: route.continue_() if route.request.url.startswith(origin+'/') or route.request.url.startswith('data:') else route.abort())
    page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    row={'engine':engine,'scope':scope,'width':width}
    try:
     page.goto(origin+('/preview/' if scope=='preview' else '/'))
     for _ in range(4):
      page.wait_for_function("!!window.__tzz || Array.from(document.querySelectorAll('button')).some(b=>['同意并继续','保留备份并升级'].includes(b.textContent))",timeout=30000)
      if page.evaluate('!!window.__tzz'): break
      for label in ['同意并继续','保留备份并升级']:
       button=page.get_by_role('button',name=label,exact=True)
       if button.is_visible(): button.click(); break
     page.wait_for_function('!!window.__tzz && !window.__tzz.saveBlocked',timeout=30000)
     row['seed']=page.evaluate('''async()=>{const t=window.__tzz; const ids=Array.from({length:8},(_,i)=>'k_'+(i+1)); const r=await t.atomic(()=>{t.state.gacha.owned=[...new Set([...t.state.gacha.owned,...ids])];return {ok:true};},'isolated QA fixture');return {ok:r.ok,key:t.SAVE_KEY,owned:t.state.gacha.owned};}''')
     assert row['seed']['ok'],row['seed']
     page.reload();page.wait_for_function('!!window.__tzz && !window.__tzz.saveBlocked',timeout=30000)
     row['reloaded']=page.evaluate('window.__tzz.state.gacha.owned')
     assert all('k_'+str(i) in row['reloaded'] for i in range(1,9))
     page.evaluate("window.__tzz.closeModal(); window.__tzz.setTab('col')")
     page.screenshot(path=str(out/f'{engine}-{scope}-{width}-collection.png'))
     row['overflow']=page.evaluate('document.documentElement.scrollWidth>innerWidth')
     assert not row['overflow'],'document horizontal overflow'
     assert not errors,errors
     row['status']='PASS'
    except Exception as e:row.update(status='FAIL',reason=str(e),errors=errors,body=page.locator('body').inner_text()[:2000])
    results.append(row);print(json.dumps(row,ensure_ascii=False),flush=True);ctx.close()
  browser.close()
server.shutdown()
(out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
sys.exit(any(r['status'] in ['FAIL','BLOCKED'] for r in results))
