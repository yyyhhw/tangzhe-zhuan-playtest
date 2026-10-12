'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const E=require('../economy.js'),T=require('./tdcore.js'),Host=require('./tdhost.js');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
const parentFixture=require('../../tests/fixtures/td-parent.cjs');
const block=parentFixture.bridgeBlock(src);
let checks=0;const tasks=[];
function check(fn){tasks.push(fn);}
async function fixture(){
  const wallet=await parentFixture.wallet(require('node:path').resolve(__dirname,'..')),E=wallet.E;
  const state=wallet.state;
  const ports=[],transfers=[];const classes=new Set(['hidden']);
  const frame={src:'about:blank',contentWindow:{location:{href:'about:blank'},postMessage:(...a)=>transfers.push(a)}};
  const overlay={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
  const ctx={URL,state,E,TD:T,tdOpen:false,tdPort:null,tdGeneration:0,zbOpen:false,cardsOpen:false,CARDS_SHOP:2,COLLECTION:{coordinator:wallet.coordinator,entryEnabled:false},frozen:false,dirty:false,location:{href:'https://game.test/preview/index.html',origin:'https://game.test'},window:{TDHost:Host,__tzz:{}},$:(s)=>s==='#tdFrame'?frame:overlay,zbBlocked:()=>false,audioPause:()=>{},audioResume:()=>{},txn:(apply,price)=>E.transact(state,{apply,price,save:st=>wallet.coordinator.commit(st)}),MessageChannel:function(){this.port1={onmessage:null,closed:false,messages:[],close(){this.closed=true;},postMessage(d){this.messages.push(d);}};this.port2={};ports.push(this.port1);}};
  vm.createContext(ctx);vm.runInContext(block+'\n'+src.slice(src.indexOf('function cardsCard()'),src.indexOf('function cardsSend(')),ctx);return {ctx,api:ctx.window.__tzz,frame,ports,transfers,classes};
}
check(async()=>{const f=await fixture();f.api.openTD();assert(f.api.tdOpen);assert(!f.classes.has('hidden'));assert(f.frame.src.includes('/preview/td/index.html?embed=1'));f.frame.contentWindow.location.href='https://evil.test/preview/td/index.html';f.frame.onload();assert.equal(f.ports.length,0);f.frame.contentWindow.location.href='https://game.test/preview/zombie/index.html';f.frame.onload();assert.equal(f.ports.length,0);f.frame.contentWindow.location.href=f.frame.src;f.frame.onload();assert.equal(f.transfers.length,1);assert.equal(f.transfers[0][1],'https://game.test');assert.equal(f.ports[0].messages[0].td,'state');});
check(async()=>{const f=await fixture();f.api.openTD();f.frame.contentWindow.location.href=f.frame.src;f.frame.onload();const p=f.ports[0];p.onmessage({data:{td:'buy',id:'bbq',requestId:'b1'}});assert.equal(f.ctx.state.td.lv.bbq,1);f.api.closeTD();assert(p.closed);const coins=f.ctx.state.coins;p.onmessage({data:{td:'buy',id:'bbq',requestId:'b2'}});assert.equal(f.ctx.state.coins,coins);assert(!f.api.tdOpen);assert(f.classes.has('hidden'));f.api.closeTD();});
check(async()=>{const f=await fixture();f.api.openTD();f.frame.contentWindow.location.href=f.frame.src;f.frame.onload();const old=f.ports[0];f.frame.onload();assert(old.closed);const before=f.ctx.state.coins;old.onmessage({data:{td:'buy',id:'tea',requestId:'b1'}});assert.equal(f.ctx.state.coins,before);});
check(async()=>{const f=await fixture();f.ctx.state.shops[3].open=false;f.api.openTD();assert(!f.api.tdOpen);f.ctx.state.shops[3].open=true;f.ctx.frozen=true;f.api.openTD();assert(!f.api.tdOpen);});
check(async()=>{const f=await fixture();vm.runInContext("const ZB_SHOP=0; function zbCard(){return 'zombie-card';}\n"+src.slice(src.indexOf('function shopGameCard(i)'),src.indexOf('function ceoPost(id)')),f.ctx);assert(f.ctx.shopGameCard(3).includes('data-act="td"'));assert.equal(f.ctx.shopGameCard(1),'');assert.equal(f.ctx.shopGameCard(2),'');assert(f.ctx.shopGameCard(0).includes('zombie-card'));assert(src.indexOf('h += shopGameCard(i)')>src.indexOf('function shopHTML') || src.includes('h += shopGameCard(i);'));});
check(()=>{for(const [dir,expected] of [['../','13k'],['../pet/game/','p7a']]){const html=fs.readFileSync(__dirname+'/'+dir+'index.html','utf8'),v=JSON.parse(fs.readFileSync(__dirname+'/'+dir+'version.json','utf8')).v;assert.equal(v,expected);assert(html.includes("var B='"+v+"'"));for(const m of html.matchAll(/\?v=([^"']+)/g))assert.equal(m[1],v);assert(html.includes("fetch('version.json?t='+Date.now(),{cache:'no-store'})"));}});

(async()=>{for(const task of tasks){await task();checks++;console.log('PASS parent bridge case',checks);}console.log('TD parent bridge:',checks,'checks passed (Node VM only)');})().catch(e=>{console.error(e);process.exitCode=1;});
