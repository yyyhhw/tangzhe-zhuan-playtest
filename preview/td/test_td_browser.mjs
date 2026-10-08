// Run with a preinstalled Playwright + browser. Isolated contexts never use a user's profile.
// TD_PLAYWRIGHT=/path/to/playwright/index.mjs node preview/td/test_td_browser.mjs [URL]
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.TD_PLAYWRIGHT || 'playwright');
const url=process.argv[2] || 'http://127.0.0.1:8876/preview/td/';
const out=new URL('./evidence/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.TD_CHROMIUM ? {executablePath:process.env.TD_CHROMIUM} : {})});
try {
 for(const size of [{width:390,height:844},{width:375,height:667},{width:1280,height:900}]) {
  const context=await browser.newContext({viewport:size,hasTouch:size.width<700,recordVideo:{dir:out,size}});
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#startBtn').click();
  await page.locator('[data-tw="bbq"]').click();
  assert.equal(await page.evaluate(()=>__td.G.cash),160);
  const geo=await page.evaluate(()=>__td.geo);
  const clickCell=async(x,y)=>page.mouse.click(geo.OX+(x+.5)*geo.S,geo.OY+(y+.5)*geo.S);
  await clickCell(3,2);await page.screenshot({path:out+`preview-${size.width}.png`});
  const rect=await page.locator('#buildConfirm').boundingBox();assert(rect.height>=44);
  for(const [x,y] of [[0,0],[6,10]]) {await clickCell(x,y);const r=await page.locator('#buildActions').boundingBox();assert(r.x>=0 && r.x+r.width<=size.width);const cellTop=geo.OY+y*geo.S,cellBottom=cellTop+geo.S;assert(r.y+r.height<=cellTop || r.y>=cellBottom);}
  await clickCell(4,2);await page.locator('#buildConfirm').click();
  assert(await page.evaluate(()=>__td.G.tw.has('4,2')));
  assert.equal(await page.evaluate(()=>__td.G.cash),100);
  await page.locator('[data-tw="tea"]').click();await clickCell(3,2);await page.locator('#buildX').click();
  assert.equal(await page.evaluate(()=>__td.G.tw.size),1);
  await page.locator('[data-tw="tea"]').click();await clickCell(2,1);assert(await page.locator('#buildConfirm').isDisabled());
  await page.mouse.click(3,120);assert(await page.locator('#buildActions').isHidden());
  await page.waitForTimeout(5500);await page.screenshot({path:out+`battle-${size.width}.png`});
  await page.locator('#pauseBtn').click();const before=await page.evaluate(()=>__td.G.t);
  await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__td.G.t),before);
  await page.locator('#sndBtn').click();await page.locator('#resumeBtn').click();
  await page.waitForTimeout(500);assert.deepEqual(errors,[]);
  fs.writeFileSync(out+`state-${size.width}.json`,await page.evaluate(()=>render_game_to_text()));
  const video=page.video(); await context.close(); await video.saveAs(out+`interaction-${size.width}.webm`);
 }
} finally {await browser.close();}
console.log('Browser interaction + screenshots/video captured; audio hearing is not verified.');
