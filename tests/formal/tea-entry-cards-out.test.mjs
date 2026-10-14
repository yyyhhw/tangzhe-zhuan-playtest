// Node/VM and isolated in-memory storage only; not real browser evidence.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
import {createSaveCoordinator,KEYS} from '../../collection/host-save.mjs';import {createApprovedTrialModel} from '../../collection/domain/model.mjs';import {TRIAL_CONFIG} from '../../collection/domain/trial-config.mjs';import {canonical} from '../../collection/domain/json.mjs';
const pageToken='xingtuv2-1-20261014-r1';
const uiToken='xingtuv2-1-20261014-r1';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),require=createRequire(import.meta.url),token='xingtuv2-1-20261014-r1';
function fn(src,name){const start=src.indexOf('function '+name+'(');assert(start>=0);const next=src.indexOf('\nfunction ',start+1);return src.slice(start,next===-1?undefined:next);}
for(const prefix of ['', 'preview/']){
 test(prefix+' actual parent entry gate and origin-checked iframe handshake (VM)',()=>{
  const src=read(prefix+'app.js'),events=[],els=new Map();for(const id of ['#tdFrame','#tdOverlay'])els.set(id,{classList:{remove:x=>events.push(x)},contentWindow:{location:{href:'https://example.test/'+prefix+'td/index.html'},postMessage:(...x)=>events.push(x)}});
  const state={shops:Array.from({length:4},()=>({open:false}))};state.shops[3].open=true;
  const c={state,frozen:false,tdOpen:false,zbOpen:false,tdGeneration:0,tdPort:null,tdController:{reset(){},reply(){},msg(){}},location:{href:'https://example.test/'+prefix+'index.html',origin:'https://example.test'},URL,$:s=>els.get(s),audioPause:()=>events.push('audio'),MessageChannel:class{constructor(){this.port1={close(){}};this.port2={};}},window:{TDStageProgress:require('../../td/tdcampaign-progress.js')}};vm.createContext(c);
  // Only evaluate actual function text, leaving its body and guards intact.
  vm.runInContext(src.slice(src.indexOf('function openTD()'),src.indexOf('\nfunction closeTD()')),c);
  c.openTD();assert.equal(c.tdOpen,false);assert.equal(events.length,0,'tech open cannot bypass unopened tea');
  state.shops[1].open=true;state.shops[3].open=false;c.openTD();assert(c.tdOpen);assert(els.get('#tdFrame').src.includes(token));
  els.get('#tdFrame').contentWindow.location.href='https://evil.test/'+prefix+'td/index.html';els.get('#tdFrame').onload();assert(!events.some(Array.isArray),'wrong origin receives no port');
  els.get('#tdFrame').contentWindow.location.href='https://example.test/'+prefix+'td/index.html';els.get('#tdFrame').onload();assert(events.some(x=>Array.isArray(x)&&x[1]===c.location.origin));
  if(prefix===''){const cardContext={E:{SHOPS:[{short:'烧烤摊'},{short:'奶茶店'},{short:'漫画书店'},{short:'科技公司'}]},ZB_SHOP:0,zbCard:()=>'<zombie>',tdCard:()=>'<td>',state:{shops:[{},{},{},{open:true,lv:49}]},SHOP_ICON:['','','','<tech-svg>']};vm.createContext(cardContext);vm.runInContext(src.slice(src.indexOf('function shopGameCard('),src.indexOf('\n}',src.indexOf('function shopGameCard('))+2)+'\n'+fn(src,'xingtuMissing')+'\n'+fn(src,'xingtuLockText')+'\n'+fn(src,'xingtuCard'),cardContext);
assert(cardContext.shopGameCard(1).includes('<td>'));assert(cardContext.shopGameCard(2).includes('data-act="xingtu"'));assert(cardContext.shopGameCard(3).includes('data-act="xingtu"'));assert(cardContext.shopGameCard(3).includes('星途未解锁'));for(const x of cardContext.state.shops){x.open=true;x.lv=35;}assert(!cardContext.shopGameCard(3).includes('disabled'));assert(!cardContext.shopGameCard(3).includes('星途未解锁'));}else{ // preview 不动：旧 Lv35 禁用按钮
const cardContext={ZB_SHOP:0,zbCard:()=>'<zombie>',tdCard:()=>'<td>',state:{shops:[{},{},{},{open:true,lv:49}]},SHOP_ICON:['','','','<tech-svg>']};vm.createContext(cardContext);vm.runInContext(src.slice(src.indexOf('function shopGameCard('),src.indexOf('\n}',src.indexOf('function shopGameCard('))+2)+'\n'+fn(src,'xingtuCard'),cardContext);
assert(cardContext.shopGameCard(1).includes('<td>'));assert.equal(cardContext.shopGameCard(2),'');assert(cardContext.shopGameCard(3).includes('data-act="xingtu"'));assert(cardContext.shopGameCard(3).includes('disabled'));for(const x of cardContext.state.shops){x.open=true;x.lv=35;}assert(!cardContext.shopGameCard(3).includes('disabled'));}
 });
 test(prefix+' battle removed, shared save/wallet callbacks retained, retired links inert',()=>{
  const app=read(prefix+'app.js'),html=read(prefix+'index.html'),boot=read(prefix+'collection/bootstrap.mjs');
  for(const s of ['openCards','cardsMsg','cardsSend','cardsFrame','cardsOverlay','CARDS_SHOP'])assert(!app.includes(s),s);assert(!html.includes('cardsFrame'));
  for(const s of ['collectionReplaceState','collectionReadOnly','COLLECTION.coordinator','COLLECTION.storage','COLLECTION.ownsLock'])assert(app.includes(s),s);
  for(const s of ['createSaveCoordinator','createCollectionHost','scopedStorage','ownsLock','host.handle'])assert(boot.includes(s),s);
  assert.equal(fs.existsSync(new URL(prefix+'cards/ui/app.mjs',root)),false);
  for(const p of ['cards/index.html','cards/ui/index.html','cards/ui/art-preview.html']){const s=read(prefix+p);assert(!/<script|<iframe|refresh/i.test(s));assert(s.includes('target="_top"'));assert(s.includes('返回经营游戏'));}
  assert(app.includes('E.gachaDraw'));assert(app.includes('E.cardsComplete'));assert(app.includes("case 'card': return showCard(arg)"));assert(app.includes('data-act="card"'));assert(!app.includes('data-act="cards"'));
 });
}
test('formal TD second gate, handshake/read-only protection and zero history mutation',()=>{
 const E=require('../../economy.js'),H=require('../../td/tdhost.js'),P=require('../../td/tdcampaign-progress.js'),C=require('../../td/tdcampaign.js');const state=E.newState(1);state.shops[3].open=true;let reply,ro=false;const raw=JSON.stringify(state);
 const h=H.create({state:()=>state,blocked:()=>ro,balance:()=>state.coins,send:r=>reply=r,changed(){},close(){},transact(){throw Error('entry must not transact');}});
 const start={td:'start',ruleset:P.RULESET_ID,runId:'tea-gate',n:1,cmd:'c77',mapId:C.getStage(1).mapId};h.msg(start);assert.equal(reply.ok,false);h.msg({td:'hello',protocol:3,ruleset:P.RULESET_ID});h.msg(start);assert.equal(reply.ok,false);assert.equal(JSON.stringify(state),raw);
 state.shops[1].open=true;state.shops[1].lv=1;state.shops[3].open=false;const before=JSON.stringify(state);ro=true;h.msg(start);assert.equal(reply.ok,false);ro=false;h.msg(start);assert.equal(reply.ok,true);assert.equal(JSON.stringify(state),before);h.reset();h.msg({...start,runId:'after-close'});assert.equal(reply.ok,false);
});
test('preview TD keeps legacy protocol/progress while using tea gate',()=>{
 const E=require('../../preview/economy.js'),H=require('../../preview/td/tdhost.js');const state=E.newState(1);let reply;state.shops[3].open=true;const h=H.create({state:()=>state,blocked:()=>false,balance:()=>state.coins,send:r=>reply=r,close(){},changed(){},transact(){throw Error('entry only');}});h.reply();assert(reply.blocked);state.shops[1].open=true;state.shops[3].open=false;h.reply();assert.equal(reply.blocked,false);assert(!('tdCampaign' in reply));
});
test('isolated real coordinator preserves card compatibility keys and TD history during business gacha save',()=>{
 delete require.cache[require.resolve('../../economy.js')];const E=require('../../economy.js'),data=new Map(),writes=[];const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:['isolated-test'],walletBridgeApproved:false});
 const legacy=E.newState(1);legacy.coins=1e9;legacy.coinFrac=.25;legacy.shops.forEach(s=>{s.open=true;s.lv=1;s.emp=1;});legacy.gacha.owned=['k_1'];legacy.td50=require('../../td/tdprogress.js').fresh();
 // Sentinel keys are additional isolated user data, never read/written by coordinator.
 for(const key of [...['formal','preview'].flatMap(channel=>[...['','-tmp','-bak','-quarantine'].map(suffix=>'tangzhe-'+channel+'-card-save'+suffix),'tangzhe-'+channel+'-card-decks-v1']),'unrelated-user-key'])data.set(key,'raw:'+key);
 const untouched=new Map(data);data.set(KEYS.source,JSON.stringify(legacy));data.set(KEYS.sourceBackup,JSON.stringify(legacy));
 const c=createSaveCoordinator({storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push(k);data.set(k,v);}},economy:E,model,ownsLock:()=>true});E.installFormalCollectionProtocol(c);const i=c.inspect();assert(i.ok);assert.equal(writes.length,0);let out=c.initialize({approvedSourceRaw:i.sourceRaw,approvedSourceEvidence:i.sourceEvidence,now:1});assert(out.ok);const state=out.state,history=JSON.stringify({td:state.td,tdCampaign:state.tdCampaign,td50:state.td50,tdUpgradeReceipts:state.tdUpgradeReceipts,collection:state.collection});
 const coins=state.coins,price=E.gachaPrice(state),g=E.transact(state,{price:0,apply:s=>E.gachaDraw(s,.5,price),save:s=>c.commit(s)});assert(g.ok,JSON.stringify(g));assert.equal(state.coins,coins-price);assert(state.gacha.owned.includes('k_1'));assert.equal(state.gacha.owned.length,2);assert.equal(JSON.stringify({td:state.td,tdCampaign:state.tdCampaign,td50:state.td50,tdUpgradeReceipts:state.tdUpgradeReceipts,collection:state.collection}),history);
 for(const [k,v]of untouched)assert.equal(data.get(k),v);assert.equal(data.get(KEYS.source),JSON.stringify(legacy));assert.equal(data.get(KEYS.sourceBackup),JSON.stringify(legacy));assert(writes.every(k=>Object.values(KEYS).includes(k)));assert(c.adopt().ok);
});
test('four entry version/changed-resource closure and preserved pet channel',()=>{
 for(const p of ['','preview/','pet/game/','preview/pet/game/']){
  const kind=p.startsWith('preview/')?'preview':'formal',html=read(p+'index.html');assert.equal(JSON.parse(read(p+'version.json')).v,kind+'-'+(p==='preview/pet/game/'?'tea-td-cards-out-20261012-r1':pageToken));assert(html.includes("var B='"+kind+'-'+(p==='preview/pet/game/'?'tea-td-cards-out-20261012-r1':pageToken)+"'"));assert(!html.includes('cardsFrame'));
  for(const m of html.matchAll(/(?:src|href)="([^"?]+)\?v=([^"']+)"/g)){assert(fs.existsSync(new URL(m[1],new URL(p,root))),p+m[1]);if(/collection\/bootstrap\.mjs/.test(m[1]))assert.equal(m[2],pageToken);if(/td\/tdhost\.js/.test(m[1]))assert.equal(m[2],'tea-td-cards-out-20261012-r1');}
 }
 assert(read('collection/bootstrap.mjs').includes('../app.js?v='+uiToken));assert.equal((read('collection/bootstrap.mjs').match(new RegExp('pet/game/app\\.js\\?v='+token,'g'))||[]).length,2);assert(read('preview/collection/bootstrap.mjs').includes('../app.js?collectionHost=1c&v='+uiToken));
 assert(read('pet/game/app.js').includes('COLLECTION.coordinator'));assert(!read('pet/game/app.js').includes('openCards'));assert(!read('preview/pet/game/app.js').includes('openCards'));
});
