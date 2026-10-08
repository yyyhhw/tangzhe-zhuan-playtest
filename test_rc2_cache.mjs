// Real entry/cache tests against a local server. Fresh contexts; no real player saves.
import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const base=process.env.INTEGRATION_BASE||'http://127.0.0.1:8782';const browser=await chromium.launch();const rows=[];
try{
 for(const entry of ['/','/pet/game/','/preview/','/preview/pet/game/']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url())});await p.goto(base+entry);await p.waitForFunction(()=>window.__tzz);
  const expected=entry.includes('preview')?'15c-rc2-preview':entry==='/'?'15c':'15c';
  const data=await p.evaluate(async()=>({version:(await (await fetch('version.json',{cache:'no-store'})).json()).v,app:document.querySelector('script[src^="app.js?"]').src,title:document.title,key:__tzz.SAVE_KEY,bak:__tzz.BAK_KEY}));
  assert.equal(data.version,expected);assert.equal(new URL(data.app).searchParams.get('v'),expected);assert.equal(data.key,entry.includes('preview')?'tangzhe-preview-save':'tangzhe-save');assert.equal(data.bak,data.key+'-bak');if(!entry.includes('preview'))assert(!data.title.includes('候选'));
  if(entry==='/'){
   await p.evaluate(()=>{__tzz.closeModal();__tzz.state.shops[3].open=true;__tzz.openTD()});await p.waitForFunction(()=>document.querySelector('#tdFrame').contentWindow.__td?.proto.ready);const f=p.frames().find(f=>f.url().includes('/td/index.html'));assert.equal(new URL(f.url()).searchParams.get('v'),'15c');const versions=await f.evaluate(()=>[...document.querySelectorAll('script[src],link[href*="td.css"]')].map(e=>new URL(e.src||e.href).searchParams.get('v')));assert(versions.length>=5&&versions.every(v=>v==='15c'));await p.evaluate(()=>__tzz.closeTD());data.tdVersions=versions;
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);rows.push({entry,case:'entry/runtime/published-TD-cache',pass:true,data});await c.close();
 }
 for(const [entry,current,other] of [['/','15c','15c-rc2-preview'],['/preview/','15c-rc2-preview','15c']]){
  const c=await browser.newContext(),p=await c.newPage();await c.addInitScript(other=>sessionStorage.setItem('tzz-reload-'+other,'1'),other);
  await c.route('**/*',async route=>{if(route.request().resourceType()==='document'){const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/var B='[^']+'/,"var B='stale-cache'")});}else await route.continue();});
  await p.goto(base+entry,{waitUntil:'domcontentloaded'});await p.waitForURL(u=>u.searchParams.get('v')===current);await p.waitForFunction(()=>window.__tzz);const flags=await p.evaluate(([current,other])=>[sessionStorage.getItem('tzz-reload-'+current),sessionStorage.getItem('tzz-reload-'+other)],[current,other]);assert.deepEqual(flags,['1','1']);rows.push({entry,case:'other-environment-reload-flag-does-not-suppress-refresh',pass:true,flags});await c.close();
 }
}finally{await browser.close();}
fs.writeFileSync(process.env.CACHE_OUT||'/tmp/rc2-cache.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
