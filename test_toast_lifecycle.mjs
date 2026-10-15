// Real browser first pageshow: hold one image response until boot has queued feedback.
// No synthetic pageshow dispatch. Synthetic storage fixtures; no live player data.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=path.resolve(process.env.TOAST_ROOT||path.dirname(new URL(import.meta.url).pathname));const require=createRequire(import.meta.url),E=require(path.join(root,'economy.js'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const rows=[];
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
// 测试-133 ⑤：/preview/ 现在先要「同意并继续」建新版预览档；先用真实页面建一份新版档当造档，不再用旧 preview 档
const PREVIEW_KEY='tangzhe-preview-collection-v1-save';
const previewSeed=await (async()=>{const c=await browser.newContext({viewport:{width:393,height:852}}),p=await c.newPage();const st=E.newState(Date.now());st.coins=100000;st.taps=1;st.muted=true;
 await c.addInitScript(st=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('tangzhe-preview-save',JSON.stringify(st));localStorage.setItem('tangzhe-preview-save-bak',JSON.stringify(st));}},st);
 await p.goto(base+'/preview/');await p.getByRole('button',{name:'同意并继续'}).click();const later=p.getByRole('button',{name:'保留备份并升级'});await later.waitFor({timeout:5000}).then(()=>later.click(),()=>{});await p.waitForFunction(()=>window.__tzz);await p.waitForTimeout(500);
 const seed=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>!/tab-lock/.test(k))));await c.close();assert(seed[PREVIEW_KEY],'new preview save created');return seed;})();
for(const entry of ['/','/pet/game/','/preview/','/preview/pet/game/'])for(const mode of ['boot-error','missing-main','bad-main']){
 const context=await browser.newContext({viewport:{width:393,height:852}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let release;const gate=new Promise(r=>release=r);let detail;
 try{
 const st=E.newState(Date.now());st.coins=100000;st.taps=1;st.muted=true;
 await context.addInitScript(({st,entry,mode,seed,PREVIEW_KEY})=>{if(entry==='/preview/'){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);localStorage.setItem(PREVIEW_KEY+'-bak',seed[PREVIEW_KEY]);if(mode==='missing-main')localStorage.removeItem(PREVIEW_KEY);if(mode==='bad-main')localStorage.setItem(PREVIEW_KEY,'{broken');}else{const key=entry.includes('preview')?'tangzhe-preview-save':'tangzhe-save';localStorage.setItem(key+'-bak',JSON.stringify(st));if(mode!=='missing-main')localStorage.setItem(key,mode==='bad-main'?'{broken':JSON.stringify(st));}window.__firstShows=[];window.addEventListener('pageshow',e=>__firstShows.push({persisted:e.persisted,trusted:e.isTrusted,bootReady:!!window.__tzz}));let t;Object.defineProperty(window,'__tzz',{get:()=>t,set:v=>{t=v;v?.pets?.manual(true);if(window.__toastProbe){if(mode==='boot-error')__toastProbe.error('开局测试错误');__toastProbe.normal('开局后续提示');}}});},{st,entry,mode,seed:previewSeed,PREVIEW_KEY});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/__pageshow_gate.png'){await gate;await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=','base64')});return;}
 if(route.request().resourceType()==='document'){const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('</body>','<img src="/__pageshow_gate.png" alt="" style="display:none"></body>')});return;}
 if(url.pathname.endsWith('/app.js')){const r=await route.fetch();const src=(await r.text()).replace('window.__tzz = {','window.__toastProbe={normal:(...a)=>toast(...a),error:msg=>saveFailNote({stage:"save"},msg)};\nwindow.__tzz = {');await route.fulfill({response:r,body:src});return;}await route.continue();});
 await page.goto(base+entry,{waitUntil:'domcontentloaded'});
 // 测试-133 ④：正式版（根、pet）和新版 preview 主档缺失/坏档时锁成「存档已保护」，不从备份自动恢复、不写入；只有 /preview/pet/game/ 旧链路还会从备份恢复
 if(mode!=='boot-error'&&entry!=='/preview/pet/game/'){release();await page.waitForLoadState('load');const snap=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/save/.test(k))));const s0=await snap();
  await page.getByText('存档已保护').waitFor();await page.waitForTimeout(1500);const body=await page.evaluate(()=>document.body.innerText);const s1=await snap();detail={locked:true,status:(body.match(/状态：(\S+)/)||[])[1],keys:Object.keys(s1)};
  assert.equal(await page.evaluate(()=>!!window.__tzz),false,'locked save must not boot gameplay');assert(body.includes(entry==='/preview/'?'COLLECTIBLES_BOOT_FAILED_READ_ONLY':mode==='bad-main'?'INVALID_JSON_READ_ONLY':'SOURCE_BACKUP_REQUIRES_REVIEW'),'lock reason shown');/* 新版 preview 在收藏层先锁，原因码和正式版不同，已报熊大定 */assert.deepEqual(s1,s0,'locked page must not write saves');assert.deepEqual(errors,[]);
  rows.push({entry,mode,status:'pass',detail});continue;}
 await page.waitForFunction(()=>window.__tzz&&window.__toastProbe);
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
