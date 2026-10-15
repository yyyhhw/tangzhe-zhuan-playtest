import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1]; bad=0
with sync_playwright() as pw:
  for n in ['chromium','webkit']:
    b=getattr(pw,n).launch()
    for path in ['','pet/game/']:
      c=b.new_context(viewport={'width':390,'height':844}); p=c.new_page(); errs=[]
      p.on('pageerror',lambda e:errs.append(str(e)))
      p.goto(base+path)
      try: p.wait_for_function("()=>!!window.__tzz&&!document.getElementById('collectionStartup')",timeout=25000); ok=True
      except Exception: ok=False
      v=p.evaluate("()=>[...document.scripts].map(s=>s.src).filter(s=>s.includes('xtearth-20261015-r3')).length")
      print(n,path or '/','ok' if ok and not errs and v else 'BAD',v,errs[:2]); bad+= not(ok and not errs and v)
      c.close()
    b.close()
print('BAD',bad); sys.exit(bad)
