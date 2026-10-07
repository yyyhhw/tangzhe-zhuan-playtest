'use strict';
// Executes the actual child script in Node VM with minimal DOM/timer fakes.
// This tests protocol/state logic, not browser rendering or WebKit behavior.
const vm=require('node:vm'), fs=require('node:fs'), assert=require('node:assert/strict'), T=require('./tdcore.js');
let checks=0;
function check(fn){fn();checks++;}
function child(embed=true){
  const nodes=new Map(), timers=new Map(), listeners={}, sent=[], writes=[];let serial=0;
  const noop=()=>{};
  function node(id){if(!nodes.has(id)){const cls=new Set();nodes.set(id,{style:{},setAttribute:noop,innerHTML:'',textContent:'',disabled:false,classList:{toggle:(x,on)=>on?cls.add(x):cls.delete(x),add:x=>cls.add(x),remove:x=>cls.delete(x),contains:x=>cls.has(x)},addEventListener:noop,getContext:()=>new Proxy({},{get:()=>noop})});}return nodes.get(id);}
  const w={TDCore:T,ZBSfx:new Proxy({},{get:()=>noop}),addEventListener:(k,fn)=>listeners[k]=fn};w.parent=embed?{}:w;
  const ctx={window:w,location:{search:embed?'?embed=1':'',origin:'https://local.test'},document:{hidden:false,documentElement:{},querySelector:node,querySelectorAll:()=>[],addEventListener:noop},Image:function(){},innerWidth:390,innerHeight:844,getComputedStyle:()=>({getPropertyValue:()=>0}),addEventListener:noop,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:k=>{writes.push(['read',k]);return null;},setItem:(k,v)=>writes.push(['write',k,v])}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/td.js','utf8'),ctx);
  const f={api:w.__td, node, timers, sent, writes, ctx, listeners};
  f.connect=(source=w.parent,origin=ctx.location.origin)=>listeners.message({source,origin,data:{td:'port'},ports:[{postMessage:d=>sent.push(d)}]});
  f.state=(extra={})=>f.api.onState(Object.assign({td:'state',coins:5e10,z:T.norm(),blocked:false,muted:true},extra));
  f.expire=ms=>{for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
  return f;
}
check(()=>{const f=child();f.connect({},'https://evil.test');assert.equal(f.sent.length,0);f.connect();assert.equal(f.sent[0].td,'hello');assert.equal(f.writes.length,0);});
check(()=>{const f=child();f.state({z:{...T.norm(),cmd:'pearl'}});assert.equal(f.api.cmdSel,'pearl');f.api.cmdSel='otaku';f.state({z:{...T.norm(),cmd:'rocket'}});assert.equal(f.api.cmdSel,'otaku');});
check(()=>{const f=child();f.state();assert(f.api.buyUp('bbq'));const req=f.api.lastSent;assert(req.requestId);assert(f.api.pend);f.state();assert(f.api.pend);f.state({ack:'buy',requestId:'old',id:'bbq',ok:true,coins:1});assert(f.api.pend);assert.equal(f.api.proto.coins,5e10);f.expire(4000);assert(!f.node('#buyRetryBtn').classList.contains('hidden'));f.node('#buyRetryBtn').onclick();assert.equal(f.api.lastSent.requestId,req.requestId);f.state({ack:'buy',requestId:req.requestId,id:'bbq',ok:true,z:{...T.norm(),lv:{...T.norm().lv,bbq:1}},coins:5e10-1e6});assert(!f.api.pend);assert.equal(f.api.proto.lv.bbq,1);assert.equal(f.writes.length,0);});
check(()=>{const f=child();f.state();f.api.buyUp('tea');const req=f.api.lastSent;f.state({ack:'buy',requestId:req.requestId,id:'tea',ok:false,why:'disk'});assert(!f.api.pend);assert.equal(f.api.proto.lv.tea,0);});
check(()=>{const f=child();f.state();f.api.cmdSel='c77';f.api.start(1);const g=f.api.G;f.state({ack:'start',runId:'old',ok:false});assert(g.pendStart);f.state({ack:'start',runId:g.runId,ok:true});assert(!g.pendStart);f.api.cmdSel='rocket';assert.equal(g.cmd,'c77');f.node('#quitBtn').onclick();assert(g.over && g.wait);f.expire(4000);assert(!g.wait);assert(!f.node('#retryBtn').classList.contains('hidden'));const result=f.api.lastSent;f.node('#retryBtn').onclick();assert(g.wait);assert.equal(f.api.lastSent,result);f.state({ack:'result',runId:'old',ok:true,coins:1});assert(g.wait);f.state({ack:'result',runId:g.runId,ok:false,why:'disk'});assert(!g.wait && !g.saveOk);f.node('#retryBtn').onclick();f.state({ack:'result',runId:g.runId,ok:true});assert(g.saveOk);f.state({ack:'result',runId:g.runId,ok:false,why:'late error'});assert(g.saveOk);assert.equal(f.writes.length,0);});
check(()=>{const f=child();f.state({blocked:true});assert.equal(f.api.start(1),false);assert.equal(f.api.buyUp('bbq'),false);});
check(()=>{const f=child();f.state();f.api.start(1);const id=f.api.G.runId;f.expire(4000);assert.equal(f.api.G,null);f.state({ack:'start',runId:id,ok:true});assert.equal(f.api.G,null);});
check(()=>{const f=child(false);assert.equal(f.api.EMBED,false);f.api.buyUp('bbq');assert(f.writes.length>0);assert(f.writes.every(x=>x[1]==='tangzhe-td-proto'));});
check(()=>{const f=child();f.state();f.api.start(1);const old=[...f.timers.values()].find(t=>t.ms===4000);f.api.start(1);const current=f.api.G;old.fn();assert.equal(f.api.G,current);});
console.log('TD child protocol:',checks,'checks passed (Node VM, not browser E2E)');
