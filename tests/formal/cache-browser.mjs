import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),b=await chromium.launch(),resources=[],errors=[];const version='formal-cards-candidate-7';
try{const c=await b.newContext(),p=await c.newPage();let first=true;
 await p.route('http://127.0.0.1:8788/**',async r=>{if(r.request().isNavigationRequest()&&r.request().frame()===p.mainFrame()&&first){first=false;await r.fulfill({contentType:'text/html',body:fs.readFileSync('/tmp/formal-baseline/index.html','utf8')});}else await r.continue();});
 p.on('request',r=>{if(/(?:app\.js|economy\.js|\.mjs|readable-effects\.css|cards\/ui\/index\.html)/.test(r.url()))resources.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8788/');await p.waitForURL(u=>u.searchParams.get('v')===version);await p.getByRole('button',{name:'同意并继续'}).click();await p.waitForFunction(()=>window.__tzz);
 await p.evaluate(()=>{__tzz.closeModal();__tzz.state.shops[2].open=true;__tzz.state.shops[2].lv=1;if(!__tzz.persist())throw Error('fixture');__tzz.openCards();});
 const f=await(await p.$('#cardsFrame')).contentFrame();await f.waitForURL('**/cards/ui/index.html?**');await f.waitForSelector('#hand-count');
 let d;for(let i=0;i<100;i++){d=await f.evaluate(async()=>(await import(document.querySelector('script[type=module]').src)).getDiagnostics());if(d.ported&&d.lastSaved)break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(d.ported,true);assert(d.lastSaved);for(const part of ['collection/bootstrap.mjs','/app.js','/economy.js','cards/ui/index.html','cards/ui/app.mjs','cards/ui/save.mjs','cards/ui/match-storage-scope.mjs','cards/ui/readable-effects.mjs','cards/ui/readable-effects.css'])assert(resources.some(u=>u.includes(part)&&new URL(u).searchParams.get('v')===version),part);
 assert.deepEqual(errors,[]);await c.close();
}finally{await b.close();fs.writeFileSync('evidence/cache-chain.json',JSON.stringify({scenario:'stale baseline HTML self-update to new formal entry; actual port and saved match asserted',resources,errors},null,2));}console.log('cache-chain passed');
