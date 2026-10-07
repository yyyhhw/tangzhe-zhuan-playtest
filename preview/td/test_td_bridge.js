'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const E=require('../economy.js'),T=require('./tdcore.js'),Host=require('./tdhost.js');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
const block=src.slice(src.indexOf('/* ================= 科技公司塔防：'),src.indexOf('/* ================= 打僵尸（zombie/'));
let checks=0;
function check(fn){fn();checks++;}
function fixture(){
  const state=E.newState(1);state.shops[3]={open:true,lv:1,emp:0};state.coins=5e10;
  const ports=[],transfers=[];const classes=new Set(['hidden']);
  const frame={src:'about:blank',contentWindow:{location:{href:'about:blank'},postMessage:(...a)=>transfers.push(a)}};
  const overlay={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
  const ctx={URL,state,E,TD:T,tdOpen:false,tdPort:null,tdGeneration:0,zbOpen:false,frozen:false,dirty:false,location:{href:'https://game.test/preview/index.html',origin:'https://game.test'},window:{TDHost:Host,__tzz:{}},$:(s)=>s==='#tdFrame'?frame:overlay,zbBlocked:()=>false,audioPause:()=>{},audioResume:()=>{},txn:(apply,price)=>E.transact(state,{apply,price,save:()=>true}),MessageChannel:function(){this.port1={onmessage:null,closed:false,messages:[],close(){this.closed=true;},postMessage(d){this.messages.push(d);}};this.port2={};ports.push(this.port1);}};
  vm.createContext(ctx);vm.runInContext(block,ctx);return {ctx,api:ctx.window.__tzz,frame,ports,transfers,classes};
}
check(()=>{const f=fixture();f.api.openTD();assert(f.api.tdOpen);assert(!f.classes.has('hidden'));assert(f.frame.src.includes('/preview/td/index.html?embed=1'));f.frame.contentWindow.location.href='https://evil.test/preview/td/index.html';f.frame.onload();assert.equal(f.ports.length,0);f.frame.contentWindow.location.href='https://game.test/preview/zombie/index.html';f.frame.onload();assert.equal(f.ports.length,0);f.frame.contentWindow.location.href=f.frame.src;f.frame.onload();assert.equal(f.transfers.length,1);assert.equal(f.transfers[0][1],'https://game.test');assert.equal(f.ports[0].messages[0].td,'state');});
check(()=>{const f=fixture();f.api.openTD();f.frame.contentWindow.location.href=f.frame.src;f.frame.onload();const p=f.ports[0];p.onmessage({data:{td:'buy',id:'bbq',requestId:'b1'}});assert.equal(f.ctx.state.td.lv.bbq,1);f.api.closeTD();assert(p.closed);const coins=f.ctx.state.coins;p.onmessage({data:{td:'buy',id:'bbq',requestId:'b2'}});assert.equal(f.ctx.state.coins,coins);assert(!f.api.tdOpen);assert(f.classes.has('hidden'));f.api.closeTD();});
check(()=>{const f=fixture();f.api.openTD();f.frame.contentWindow.location.href=f.frame.src;f.frame.onload();const old=f.ports[0];f.frame.onload();assert(old.closed);const before=f.ctx.state.coins;old.onmessage({data:{td:'buy',id:'tea',requestId:'b1'}});assert.equal(f.ctx.state.coins,before);});
check(()=>{const f=fixture();f.ctx.state.shops[3].open=false;f.api.openTD();assert(!f.api.tdOpen);f.ctx.state.shops[3].open=true;f.ctx.frozen=true;f.api.openTD();assert(!f.api.tdOpen);});
check(()=>{const f=fixture();vm.runInContext("const ZB_SHOP=0; function zbCard(){return 'zombie-card';}\n"+src.slice(src.indexOf('function shopGameCard(i)'),src.indexOf('function ceoPost(id)')),f.ctx);assert(f.ctx.shopGameCard(3).includes('data-act="td"'));assert.equal(f.ctx.shopGameCard(1),'');assert.equal(f.ctx.shopGameCard(2),'');assert(f.ctx.shopGameCard(0).includes('zombie-card'));assert(src.indexOf('h += shopGameCard(i)')>src.indexOf('function shopHTML') || src.includes('h += shopGameCard(i);'));});
check(()=>{for(const [dir,expected] of [['../','13j'],['../pet/game/','p6b']]){const html=fs.readFileSync(__dirname+'/'+dir+'index.html','utf8'),v=JSON.parse(fs.readFileSync(__dirname+'/'+dir+'version.json','utf8')).v;assert.equal(v,expected);assert(html.includes("var B='"+v+"'"));for(const m of html.matchAll(/\?v=([^"']+)/g))assert.equal(m[1],v);assert(html.includes("fetch('version.json?t='+Date.now(),{cache:'no-store'})"));}});

console.log('TD parent bridge:',checks,'checks passed (isolated Node VM, not visual E2E)');
