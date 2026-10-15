import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import display from '../../qa-protocol2/wearables8-display.mjs';import {prepareEightWearableCatalog,EIGHT_WEARABLES} from '../../qa-protocol2/eight-catalog.mjs';import {assembly,until,source,RELEASE,ROOT} from './production-harness.mjs';
const ENTRY_TOKEN='xtearth-20261015-r2';
const UI_TOKEN="xtearth-20261015-r2";
const root=path.fileURLToPath?path.fileURLToPath(ROOT):decodeURIComponent(ROOT.pathname),require=createRequire(import.meta.url);const sha=b=>createHash('sha256').update(b).digest('hex');
test('actual candidate production flag/token, root/preview/rootpet version chain and separate unchanged previewpet',()=>{
 assert(source('collectibles/release.mjs').includes('COLLECTIBLES_PRODUCTION_ENABLED = true'));assert.equal(RELEASE,'xtearth-20261015-r2');
 for(const prefix of ['','preview/','pet/game/']){const kind=prefix==='preview/'?'preview':'formal',html=source(prefix+'index.html');assert.equal(JSON.parse(source(prefix+'version.json')).v,kind+'-'+RELEASE);assert(html.includes("var B='"+kind+'-'+RELEASE+"'"));assert(html.includes('collection/bootstrap.mjs?v='+RELEASE));for(const m of html.matchAll(/(?:src|href)="([^"?]+)\?v=([^"']+)"/g))assert(fs.existsSync(new URL(m[1],new URL(prefix,ROOT))),prefix+m[1]);}
 assert.equal(JSON.parse(source('preview/pet/game/version.json')).v,'preview-tea-td-cards-out-20261012-r1');assert(!source('preview/pet/game/app.js').includes('WEARABLES8'));
 for(const p of ['collection/bootstrap.mjs','preview/collection/bootstrap.mjs']){assert(source(p).includes('collectibles/release.mjs?v='+RELEASE));assert(source(p).includes('collectibles/entry.mjs?v='+ENTRY_TOKEN));assert(source(p).includes('cardEntryEnabled:false'));}
});
test('all literal imports in new module closure resolve inside project and use the final token; derived pins match executed bytes',()=>{
 let count=0;const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
 for(const dir of ['collectibles','qa-protocol2','candidates/blindbox18','space'])for(const file of walk(path.join(root,dir)).filter(p=>p.endsWith('.mjs'))){const src=fs.readFileSync(file,'utf8');for(const m of src.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)){if(!m[1].startsWith('./')&&!m[1].startsWith('../'))continue;const u=new URL(m[1],'file://'+file);assert.equal(u.searchParams.get('v'),RELEASE,file+m[1]);assert(u.pathname.startsWith(root));assert(fs.existsSync(u));count++;}}
 assert.equal(count,81);// 星途v2-B：overlay.mjs 新增 moon.mjs（TIER_PRICE）
// 星途v2-A：moon.mjs 新增 xingtu-views（四岗出航检查）
// 星途-04：xingtu-views 新增 voyage-ev（探索点范围）
// 星途v2-1：overlay.mjs 新增 xingtu-css/xingtu-views，xingtu-views 新增 xingtu-art
// 星途-114：moon.mjs + overlay.mjs 各新增 album.mjs
// 星途-113：moon.mjs + overlay.mjs 各新增 voyage-ev.mjs 字面量 import
for(const pin of JSON.parse(source('qa-protocol2/dependency-pins.json'))){const bytes=fs.readFileSync(new URL(pin.path,ROOT));assert.equal(pin.sha256,sha(bytes));assert.equal(pin.bytes,bytes.length);}
});
test('all eight exact owned images are present and versioned; display does not grant ownership or add decoration gameplay',()=>{
 const file=new URL('../../economy.js',import.meta.url);delete require.cache[require.resolve(file.pathname)];const E=require(file.pathname),reg=prepareEightWearableCatalog(E);reg.setActive(true);const s=E.newState(1);assert.equal(E.ITEMS.length,44);assert.equal(E.ITEMS.filter(x=>x.type==='super').length,4);assert.deepEqual(EIGHT_WEARABLES.map(x=>x.id),Object.values(display.ids??{clothes:['c_charcoal_vest','c_matcha_knit','c_ember_fan_mantle','c_grill_grid_tabard'],hat:['h_guokui','h_antenna_clip','h_skewer_pinwheel','h_mushroom_parasol']}).flat());
 for(const it of EIGHT_WEARABLES){const before=JSON.stringify(s);assert(display.iconHTML(E,s,it.id).includes('❓'));assert.equal(JSON.stringify(s),before);s.gacha.owned.push(it.id);const html=display.iconHTML(E,s,it.id),match=html.match(/src="([^"]+)"/);assert(match);const u=new URL(match[1]);assert.equal(u.searchParams.get('v'),RELEASE);assert(fs.existsSync(u));}
});
for(const scope of ['formal','preview'])test(scope+': actual no-query bootstrap uses production entry under GitHub project subpath; new closure comes from exact candidate files', {timeout:15000},async t=>{
 const h=await assembly({scope,projectRoot:'/tangzhe-zhuan-playtest/',mode:'bootstrap'});t.after(()=>h.close());await until(()=>h.view()?.phase==='prompt'||h.app||h.errors.length,'prompt or formal auto-upgrade');if(scope==='formal'){assert.equal(h.node('collectibleUpgradeConfirm'),null,'formal has no upgrade prompt');assert.equal(h.node('collectibleUpgradeCancel'),null);}else await h.click('collectibleUpgradeConfirm');await until(()=>h.app,'app');assert.equal(h.runtime.qa,false);assert.equal(h.runtime.entryEnabled,false);
 for(const [url,row]of h.loadedSources){assert(row.file.startsWith(root));assert.equal(row.sha256,sha(fs.readFileSync(row.file)));if(/\/(?:collectibles|qa-protocol2)\//.test(new URL(url).pathname))assert.equal(new URL(url).searchParams.get('v'),RELEASE,url);}
});

// The shared renderer changed in this candidate; existence alone cannot detect stale HTTP URLs.
const homeEntries=['index.html','pet/game/index.html'];
function assertHomeRenderer(html,entry){
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>new URL(m[1],new URL(entry,'https://example.test/tangzhe-zhuan-playtest/'))).filter(u=>u.pathname==='/tangzhe-zhuan-playtest/home-interaction.js');
 assert.equal(scripts.length,1,entry+' must load the shared renderer exactly once');assert.equal(scripts[0].searchParams.get('v'),'xtearth-20261015-r2',entry+' changed renderer must use the production combination token');
}
test('changed shared home renderer: every actual HTML entry uses the exact production token',()=>{
 for(const entry of homeEntries)assertHomeRenderer(source(entry),entry);
 const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
 const references=walk(root).filter(p=>p.endsWith('.html')&&/<script\b[^>]*\bsrc="[^"]*home-interaction\.js(?:\?|")/.test(fs.readFileSync(p,'utf8'))).map(p=>path.relative(root,p).split(path.sep).join('/')).sort();assert.deepEqual(references,[...homeEntries].sort(),'complete actual HTML reference inventory');
});
test('negative control: old v=15c renderer URL is rejected for both root and formal pet',()=>{
 for(const entry of homeEntries){const html=source(entry),stale=html.replace('home-interaction.js?v=xtearth-20261015-r2','home-interaction.js?v=15c');assert.notEqual(stale,html);assert.throws(()=>assertHomeRenderer(stale,entry),{code:'ERR_ASSERTION'});}
});
