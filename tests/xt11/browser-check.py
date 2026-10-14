"""Actual overlay + styles in Chromium, mocked read-only coordinator (no player save)."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for path in ['/','/pet/game/','/preview/']:
  page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  page.route(base+path,lambda route:route.fulfill(body='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button>游戏入口</button></body></html>',content_type='text/html'))
  page.goto(base+path)
  page.evaluate('''async()=>{const {installMoonOverlay}=await import('/space/overlay.mjs');window.fixtureView={ok:true,unlocked:true,phase:'idle',space:{pts:24,visits:{moon:3},cards:{moon:0},hidden:{},alienCards:0}};const app={xingtuContext:()=>({}),persist:()=>true,xingtuAudioPause(){},xingtuAudioResume(){}};installMoonOverlay({app,runtime:{coordinator:{readOnly:false,spaceView:()=>window.fixtureView}}}).open();}''')
  page.locator('#xingtuTabAlbum').click();assert page.locator('#xingtuContent img').count()==0
  page.locator('#xingtuCard-moon-1').click();assert page.locator('#xingtuCardDetail img').count()==0
  page.evaluate("fixtureView.space.cards.moon=3;XingTu.close();XingTu.open()")
  page.locator('#xingtuTabAlbum').click();assert page.locator('#xingtuContent img').count()==3
  for i in range(1,4):
   page.locator(f'#xingtuCard-moon-{i}').click();img=page.locator('#xingtuCardDetail img');img.wait_for()
   page.wait_for_function("[...document.querySelectorAll('#xingtuContent img')].every(x=>x.complete&&x.naturalWidth===1024&&x.naturalHeight===768)")
   assert img.get_attribute('src')==base+f'/art/spacecards/moon_{i}.webp'
  assert page.locator('#xingtuCard-station-1').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if path=='/':
   page.locator('#xingtuCardDetail').scroll_into_view_if_needed();page.screenshot(path=str(ROOT/'tests/xt11/moon-album-mobile.png'))
   page.evaluate("fixtureView={...fixtureView,phase:'arrived',voyage:{voyageId:'mock',sequence:1},arrival:Date.now(),award:{card:1,hidden:null}};XingTu.close();XingTu.open()")
   page.wait_for_function("document.querySelector('#xingtuNewCard img')?.naturalWidth===1024")
   page.locator('#xingtuNewCard').scroll_into_view_if_needed();page.screenshot(path=str(ROOT/'tests/xt11/moon-reward-mobile.png'))
  results.append({'entry':path,'lockedImages':0,'earnedThumbnails':3,'detailImagesLoaded':3,'overflow':False})
  page.close()
 browser.close()
server.shutdown()
(ROOT/'tests/xt11/browser-results.json').write_text(json.dumps({'browser':'system Chromium','fixture':'actual overlay, mocked read-only coordinator, no Storage','results':results},indent=2)+'\n')
print(json.dumps(results))
