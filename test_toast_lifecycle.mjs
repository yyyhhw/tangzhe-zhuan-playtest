// Real browser first pageshow: hold one image response until boot has queued feedback.
// No synthetic pageshow dispatch. Synthetic storage fixtures; no live player data.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=path.resolve(process.env.TOAST_ROOT||path.dirname(new URL(import.meta.url).pathname));const require=createRequire(import.meta.url),E=require(path.join(root,'economy.js'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const rows=[];
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
for(const entry of ['/','/pet/game/','/preview/','/preview/pet/game/'])for(const mode of ['boot-error','missing-main','bad-main']){
 const context=await browser.newContext({viewport:{width:393,height:852}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let release;const gate=new Promise(r=>release=r);let detail;
 try{
 const st=E.newState(Date.now());st.coins=100000;st.taps=1;st.muted=true;
 await context.addInitScript(({st,entry,mode})=>{const key=entry.includes('preview')?'tangzhe-preview-save':'tangzhe-save';localStorage.setItem(key+'-bak',JSON.stringify(st));if(mode!=='missing-main')localStorage.setItem(key,mode==='bad-main'?'{broken':JSON.stringify(st));window.__firstShows=[];window.addEventListener('pageshow',e=>__firstShows.push({persisted:e.persisted,trusted:e.isTrusted,bootReady:!!window.__tzz}));let t;Object.defineProperty(window,'__tzz',{get:()=>t,set:v=>{t=v;v?.pets?.manual(true);if(window.__toastProbe){if(mode==='boot-error')__toastProbe.error('开局测试错误');__toastProbe.normal('开局后续提示');}}});},{st,entry,mode});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/__pageshow_gate.png'){await gate;await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=','base64')});return;}
 if(route.request().resourceType()==='document'){const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('</body>','<img src="/__pageshow_gate.png" alt="" style="display:none"></body>')});return;}
 if(url.pathname.endsWith('/app.js')){const r=await route.fetch();const src=(await r.text()).replace('window.__tzz = {','window.__toastProbe={normal:(...a)=>toast(...a),error:msg=>saveFailNote({stage:"save"},msg)};\nwindow.__tzz = {');await route.fulfill({response:r,body:src});return;}await route.continue();});
 await page.goto(base+entry,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__tzz&&window.__toastProbe);
 const before=await page.evaluate(()=>({shows:__firstShows.length,text:document.querySelector('#toast').textContent,role:document.querySelector('#toast').getAttribute('role')}));
 release();await page.waitForLoadState('load');
 const actualShows=await page.evaluate(()=>__firstShows);await page.waitForTimeout(3800);
 const after=await page.evaluate(()=>({text:document.querySelector('#toast').textContent,visible:!document.querySelector('#toast').classList.contains('hidden'),source:__tzz.loadInfo.source}));detail={before,actualShows,after};
 assert.equal(before.shows,0,'boot must precede actual first pageshow');assert(actualShows.some(e=>e.trusted&&!e.persisted&&e.bootReady),'must observe real initial pageshow after boot');
 assert.equal(before.role,'alert');assert(before.text.includes(mode==='boot-error'?'保存失败':'完整备份恢复'),'critical boot message must remain visible');
 if(mode!=='boot-error')assert.equal(after.source,'bak');assert(after.visible&&after.text==='开局后续提示','initial pageshow must preserve queued feedback');assert.deepEqual(errors,[]);
 rows.push({entry,mode,status:'pass',detail});
 }catch(e){rows.push({entry,mode,status:'fail',error:e.message,detail});}finally{release();await context.close();}
}
await browser.close();await new Promise(r=>server.close(r));const out={kind:'Trusted native first pageshow, gated image load; isolated boot-error/missing-main/bad-main fixtures',rows,pass:rows.filter(x=>x.status==='pass').length,fail:rows.filter(x=>x.status==='fail').length};fs.writeFileSync(process.env.TOAST_OUTPUT||'/tmp/toast-lifecycle-results.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(out.fail)process.exitCode=1;
