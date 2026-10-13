import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/decor6-order-functional');rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
  for width in [320,390]:
   c=b.new_context(viewport={'width':width,'height':844});pg=c.new_page();pg.goto('http://127.0.0.1:8872/probe');pg.evaluate('(rows)=>{for(const[k,v]of rows)localStorage.setItem(k,v)}',json.loads((out/f'decor6-{scope}-p1.json').read_text()));pg.goto('http://127.0.0.1:8872'+path);pg.locator('#collectibleUpgradeConfirm').click();pg.wait_for_function('!!window.__tzz')
   for _ in range(8):
    for sel in ['#claim','#mOk','#mX']:
     if pg.locator(sel).is_visible():pg.locator(sel).click(force=True);pg.wait_for_timeout(200)
   pg.locator('[data-tab="gacha"]').click();text=pg.locator('.ch-note').inner_text();assert '普通 52 + 超级 4 + 隐藏 2' in text
   key=path.strip('/').replace('/','-') or 'root';pg.screenshot(path=str(out/f'copy-{key}-{width}.png'));rows.append({'path':path,'width':width,'text':text});c.close()
 b.close()
(out/'catalog-copy.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
