import {chromium,webkit} from 'playwright';
import {startServer} from '../webkit-smoke/static-server.mjs';
import fs from 'node:fs';
const OUT=process.env.COPY87_OUT||new URL('./output/',import.meta.url).pathname;fs.mkdirSync(OUT,{recursive:true});
const {server,url}=await startServer();const checks=[];
for(const engine of ['chromium','webkit']){const browser=await({chromium,webkit}[engine]).launch();
for(const entry of ['/','/pet/game/']){
 const context=await browser.newContext(),page=await context.newPage(),errors=[],navigations=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())navigations.push(f.url());});
 await context.addInitScript(()=>{window.__storageCalls=0;for(const name of ['getItem','setItem','removeItem','clear'])Storage.prototype[name]=()=>{window.__storageCalls++;throw Error('unexpected storage access');};});
 const v=JSON.parse(fs.readFileSync(new URL('../../'+entry.slice(1)+'version.json',import.meta.url))).v;
 await page.route('**/*',route=>{const r=route.request();if(r.isNavigationRequest())return route.fulfill({contentType:'text/html',body:`<!doctype html><body><script>window.Economy={CFG:{}};</script><script src="${entry}app.js?v=${v.replace(/^formal-/,'')}"></script></body>`});return route.continue();});
 await page.goto(url.slice(0,-1)+entry+'?v=obsolete');await page.getByText('页面资源尚未更新完整，存档未写入。请关闭此页后重新打开。',{exact:true}).waitFor();
 const data={url:page.url(),navigations,errors,storageCalls:await page.evaluate(()=>window.__storageCalls)};
 const ok=new URL(page.url()).searchParams.get('v')===v&&navigations.length===2&&errors.length===0&&data.storageCalls===0;
 checks.push({engine,entry,ok,data});console.log(ok?'PASS':'FAIL',engine,entry,JSON.stringify(data));await context.close();
}await browser.close();}server.close();fs.writeFileSync(OUT+'/stale-lock-report.json',JSON.stringify(checks,null,2));console.log('TOTAL',checks.filter(x=>x.ok).length,checks.length);
