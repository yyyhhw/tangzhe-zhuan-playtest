"""Run against a local HTTP server at repo root. No real save or production boot.
python -m http.server 8765 --bind 127.0.0.1
python tests/blindbox18/browser_evidence.py
"""
import base64, json, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/reports/blindbox18'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.add_init_script("Storage.prototype.setItem=function(){throw Error('STORAGE_WRITE_FORBIDDEN')};Storage.prototype.removeItem=function(){throw Error('STORAGE_DELETE_FORBIDDEN')};Storage.prototype.clear=function(){throw Error('STORAGE_CLEAR_FORBIDDEN')};")
    page.goto('http://127.0.0.1:8765/candidates/blindbox18/review.html')
    page.wait_for_function('window.reviewReady')
    report=page.evaluate((ROOT/'tests/blindbox18/browser-checks.js').read_text())
    for item in page.evaluate('review.ITEMS'):
        data=page.evaluate("id=>{const c=review.canvas(512,512);review.render.drawCatalog(c.getContext('2d'),id);return c.toDataURL('image/png').split(',')[1]}",item['id'])
        (ROOT/'candidates/blindbox18/art'/f"{item['id']}.png").write_bytes(base64.b64decode(data))
    page.reload();page.wait_for_function('window.reviewReady')
    page.wait_for_function("[...document.querySelectorAll('#copy img')].every(i=>i.complete&&i.naturalWidth===512&&i.naturalHeight===512)")
    report['catalogAssetsLoaded']=page.locator('#copy img').count()
    assert report['catalogAssetsLoaded']==8
    page.locator('#catalog').screenshot(path=str(OUT/'catalog-512-thumbnails.png'))
    page.locator('#wardrobe').screenshot(path=str(OUT/'four-ceo-wardrobe.png'))
    for width in [390,667]:
        page.set_viewport_size({'width':width,'height':900})
        for pair in range(4):
            page.select_option('#choice',str(pair))
            page.evaluate('(w)=>{document.querySelector("#scene").width=w;review.poses()}',width)
            page.locator('#pose').screenshot(path=str(OUT/f'home-poses-{width}-pair{pair+1}.png'))
            page.locator('#scene').screenshot(path=str(OUT/f'shop-anchors-{width}-pair{pair+1}.png'))
    assert not errors, errors
    report['browser']=browser.version
    report['pageErrors']=errors
    report['scope']='Actual shipped person and home pose functions on isolated synthetic canvas boards, not full production page or save admission.'
    (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    browser.close()
