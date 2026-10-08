import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TD_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.TD_CHROMIUM});
const out=new URL('./evidence/',import.meta.url).pathname;
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:out,size:{width:390,height:844}}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:8876/preview/td/');await page.locator('#startBtn').click();
 for(const id of ['bbq','tea','book','tech','t77','tpearl','totaku','trocket']) {await page.locator(`[data-tw="${id}"]`).click();assert((await page.locator('#buildInfo').innerText()).includes('伤害'));}
 await page.locator('#cancelChoice').click();
 // Explicit combat fixture: extra LOCAL construction points allow exercising every family in one run.
 // No primary wallet, real profile, or production storage is accessed.
 await page.evaluate(()=>{const g=__td.G;g.cash=5000;for(const [id,x,y] of [['bbq',4,2],['tea',4,3],['book',2,2],['tech',3,3],['t77',2,5],['tpearl',4,6],['totaku',2,6],['trocket',6,6]]){__td.build(id,x,y);__td.upTower(x,y);__td.upTower(x,y);}advanceTime(12000);});
 await page.screenshot({path:out+'combat-fixture-390.png'});
 await page.evaluate(()=>{for(let i=0;i<6000;i++){advanceTime(1000/60);if([...__td.G.tw.values()].some(t=>t.flash>0) && __td.G.es.length)break;}});
 await page.screenshot({path:out+'attack-effects-390.png'});
 const waves=await page.evaluate(()=>{const g=__td.G,seen=[];let prev=g.wave;for(let i=0;i<36000 && !g.over;i++){advanceTime(1000/60);if(g.wave!==prev){seen.push({wave:g.wave,time:g.t});prev=g.wave;}}return {seen,wave:g.wave,win:g.win,over:g.over,kills:g.kills,lives:g.lives,keys:Object.keys(localStorage),audio:{state:ZBSfx.state.ctx?.state,counts:ZBSfx.state.count}};});
 assert(waves.over);assert.equal(waves.wave,10);assert(waves.win);assert(waves.seen.every((x,i)=>!i || x.wave===waves.seen[i-1].wave+1));assert(waves.keys.every(k=>k==='tangzhe-td-proto'));assert(waves.audio.counts.shot>0);assert(waves.audio.counts.hit>0);
 await page.screenshot({path:out+'combat-result-390.png'});assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'combat-fixture-result.json',JSON.stringify(waves,null,2));console.log(JSON.stringify(waves));
} finally {const video=page.video();await context.close();await video.saveAs(out+'combat-fixture-390.webm');await browser.close();}
