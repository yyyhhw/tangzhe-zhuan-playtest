// Real entry/cache tests against a local server. Fresh contexts; no real player saves.
// 测试-133 ②：改到现行协议（原稿写死 15c / 15c-rc2-preview 版本号、app.js 脚本标签、tangzhe-save 主档、tzz-reload-<版本> 旧刷新标记）：
//  · 每个入口的期望版本从该入口自己的 version.json 读，页面里实际加载的入口脚本（collection/bootstrap.mjs 或 app.js）缓存号要和它同一发布
//  · 主档 key：正式版根/pet = tangzhe-formal-collection-v1-save，新版 /preview/ = tangzhe-preview-collection-v1-save，/preview/pet/game/ 旧链路 = tangzhe-preview-save
//  · 打开塔防（现行入口挂在奶茶店 shops[1]，原稿用 shops[3]）：iframe 和里面的脚本/样式都带缓存号、无 4xx（各文件缓存号现行是分文件管理，不再要求全部一样）
//  · 刷新标记现行是按路径记的 tzz-reload-path:<路径>:<版本>：另一个入口的标记不能挡住本入口的刷新
import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:8782';const browser=await chromium.launch();const rows=[];
const ver=entry=>JSON.parse(fs.readFileSync(new URL('.'+entry+'version.json',import.meta.url))).v;
const KEYS={'/':'tangzhe-formal-collection-v1-save','/pet/game/':'tangzhe-formal-collection-v1-save','/preview/':'tangzhe-preview-collection-v1-save','/preview/pet/game/':'tangzhe-preview-save'};
const boot=async p=>{const ok=p.getByRole('button',{name:'同意并继续'});if(await ok.isVisible().catch(()=>false)){await ok.click();const up=p.getByRole('button',{name:'保留备份并升级'});await up.waitFor({timeout:5000}).then(()=>up.click(),()=>{});}await p.waitForFunction(()=>window.__tzz);};
try{
 for(const entry of ['/','/pet/game/','/preview/','/preview/pet/game/']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url())});await p.goto(base+entry);await p.waitForTimeout(800);await boot(p);
  const expected=ver(entry);
  const data=await p.evaluate(async()=>({version:(await (await fetch('version.json',{cache:'no-store'})).json()).v,entryScript:[...document.scripts].map(s=>s.src).find(s=>/\/(app\.js|collection\/bootstrap\.mjs)\?/.test(s)),title:document.title,key:__tzz.SAVE_KEY,bak:__tzz.BAK_KEY}));
  assert.equal(data.version,expected);assert(data.entryScript,'entry script tag');const scriptV=new URL(data.entryScript).searchParams.get('v');assert(scriptV&&expected.endsWith(scriptV),`entry script v=${scriptV} not from release ${expected}`);
  assert.equal(data.key,KEYS[entry]);assert.equal(data.bak,data.key+'-bak');if(!entry.includes('preview'))assert(!/候选|预览/.test(data.title));
  if(entry==='/'){
   await p.evaluate(()=>{__tzz.closeModal();__tzz.state.shops[1].open=true;__tzz.openTD()});await p.waitForFunction(()=>document.querySelector('#tdFrame').contentWindow.__td?.proto.ready);const f=p.frames().find(f=>f.url().includes('/td/index.html'));assert(new URL(f.url()).searchParams.get('v'));const versions=await f.evaluate(()=>[...document.querySelectorAll('script[src],link[href*="td.css"]')].map(e=>new URL(e.src||e.href).searchParams.get('v')));assert(versions.length>=5&&versions.every(Boolean),'every TD asset carries a cache token');await p.evaluate(()=>__tzz.closeTD());data.tdVersions=versions;
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);rows.push({entry,case:'entry/runtime/published-TD-cache',pass:true,data});await c.close();
 }
 for(const [entry,other] of [['/','/preview/'],['/preview/','/']]){
  const current=ver(entry),otherFlag='tzz-reload-path:'+other+':'+ver(other),flag='tzz-reload-path:'+entry+':'+current;
  const c=await browser.newContext(),p=await c.newPage();await c.addInitScript(k=>sessionStorage.setItem(k,'1'),otherFlag);
  await c.route('**/*',async route=>{if(route.request().resourceType()==='document'){const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/var B='[^']+'/,"var B='stale-cache'")});}else await route.continue();});
  await p.goto(base+entry,{waitUntil:'domcontentloaded'});await p.waitForURL(u=>u.searchParams.get('v')===current);await p.waitForTimeout(500);const flags=await p.evaluate(([a,b])=>[sessionStorage.getItem(a),sessionStorage.getItem(b)],[flag,otherFlag]);assert.deepEqual(flags,['1','1']);rows.push({entry,case:'other-environment-reload-flag-does-not-suppress-refresh',pass:true,flags});await c.close();
 }
}finally{await browser.close();}
fs.writeFileSync(process.env.CACHE_OUT||'/tmp/rc2-cache.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
