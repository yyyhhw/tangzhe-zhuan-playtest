'use strict';
// Executes the actual child script in Node VM with minimal DOM/timer fakes.
// This tests protocol/state logic, not browser rendering or WebKit behavior.
const vm=require('node:vm'), fs=require('node:fs'), assert=require('node:assert/strict'), T=require('./tdcore.js');
let checks=0;
function check(fn){fn();checks++;}
function child(embed=true){
  const arcs=[],drawLabels=[]; const nodes=new Map(), timers=new Map(), listeners={}, sent=[], writes=[];let serial=0;
  const noop=()=>{};
  function node(id){if(!nodes.has(id)){const cls=new Set();nodes.set(id,{style:{},setAttribute:noop,innerHTML:'',textContent:'',disabled:false,classList:{toggle:(x,on)=>on?cls.add(x):cls.delete(x),add:x=>cls.add(x),remove:x=>cls.delete(x),contains:x=>cls.has(x)},events:{},addEventListener(k,fn){this.events[k]=fn;},getContext:()=>new Proxy({},{get:(_,k)=>k==='arc'?((...args)=>arcs.push(args)):k==='fillText'?((...args)=>drawLabels.push(args)):noop})});}return nodes.get(id);}
  const w={TDCore:T,ZBSfx:new Proxy({},{get:()=>noop}),addEventListener:(k,fn)=>listeners[k]=fn};w.parent=embed?{}:w;
  const ctx={window:w,location:{search:embed?'?embed=1':'',origin:'https://local.test'},document:{hidden:false,documentElement:{},querySelector:node,querySelectorAll:()=>[],addEventListener:noop},Image:function(){},innerWidth:390,innerHeight:844,getComputedStyle:()=>({getPropertyValue:()=>0}),addEventListener:noop,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:k=>{writes.push(['read',k]);return null;},setItem:(k,v)=>writes.push(['write',k,v])}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/td.js','utf8'),ctx);
  const f={arcs,drawLabels,api:w.__td, node, timers, sent, writes, ctx, listeners};
  f.connect=(source=w.parent,origin=ctx.location.origin)=>listeners.message({source,origin,data:{td:'port'},ports:[{postMessage:d=>sent.push(d)}]});
  f.state=(extra={})=>f.api.onState(Object.assign({td:'state',coins:5e10,z:T.norm(),blocked:false,muted:true},extra));
  f.expire=ms=>{for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
  return f;
}

const fresh=()=>{const f=child(false);f.api.start(1);return f;};
const pick=(f,id)=>f.node('#twGrid').events.click({target:{closest:()=>({dataset:{tw:id}})}});
const cell=(f,x,y)=>{const a=f.api.geo;f.node('#cv').events.pointerdown({clientX:a.OX+(x+.5)*a.S,clientY:a.OY+(y+.5)*a.S});};
check(()=>{const f=fresh(),g=f.api.G;assert.equal(g.breakT,5);f.api.nextWave();assert.equal(g.wave,0);f.api.step(4.9);assert.equal(g.wave,0);f.api.step(.11);assert.equal(g.wave,1);const count=g.q.length+g.es.length;f.api.nextWave();assert.equal(g.wave,1);assert.equal(g.q.length+g.es.length,count);});
check(()=>{const f=fresh(),g=f.api.G;f.api.setPause(true);f.api.step(10);assert.equal(g.breakT,5);assert.equal(g.energy,0);f.api.setPause(false);f.ctx.document.hidden=true;f.api.step(10);assert.equal(g.breakT,5);f.ctx.document.hidden=false;f.api.step(1);assert.equal(g.breakT,4);});
check(()=>{const f=fresh(),g=f.api.G;g.wave=1;g.breakT=0;g.q=[];g.es=[];f.api.step(.1);assert.equal(g.cash,185);assert.equal(g.breakT,4.9);f.api.step(1);assert.equal(g.cash,185);f.api.step(4);assert.equal(g.wave,2);assert.equal(g.cash,185);});
check(()=>{const f=fresh(),g=f.api.G;const c=JSON.stringify(g.c);assert.equal(f.api.moveCmd(5,4),false);assert.equal(JSON.stringify(g.c),c);});
check(()=>{const f=fresh(),g=f.api.G;for(const id of T.TOWER_IDS){pick(f,id);assert(f.node('#buildInfo').innerHTML.includes('目标：'));assert(f.node('#buildInfo').innerHTML.includes('间隔'));assert.equal(g.cash,160);}pick(f,'bbq');cell(f,3,2);assert.equal(g.cash,160);assert.equal(g.tw.size,0);cell(f,4,2);f.node('#buildConfirm').onclick();assert.equal(g.cash,100);assert(g.tw.has('4,2'));assert(!g.tw.has('3,2'));});
check(()=>{const f=fresh(),g=f.api.G;pick(f,'tea');cell(f,3,2);f.node('#buildX').onclick();assert.equal(g.cash,160);assert.equal(g.tw.size,0);pick(f,'tea');cell(f,3,2);f.node('#cv').events.pointerdown({clientX:0,clientY:0});f.node('#buildConfirm').onclick();assert.equal(g.tw.size,0);assert.equal(g.cash,160);});
check(()=>{const f=fresh(),g=f.api.G;pick(f,'bbq');cell(f,2,1);assert(f.node('#buildConfirm').disabled);f.node('#buildConfirm').onclick();assert.equal(g.cash,160);assert.equal(g.tw.size,0);assert(f.node('#toast').textContent.includes('不能建造'));});
check(()=>{const f=fresh(),g=f.api.G;f.api.build('tea',3,2);cell(f,3,2);assert(!f.node('#barTower').classList.contains('hidden'));assert(f.node('#barBuild').classList.contains('hidden'));assert(f.node('#buildActions').classList.contains('hidden'));});
check(()=>{const f=fresh();f.api.cmdSel='otaku';f.api.start(1);pick(f,'book');assert(f.node('#buildInfo').innerHTML.includes('范围 3.25格'));assert.equal(f.api.towerRange({id:'book',lv:1}),3.25);f.api.proto.lv.book=2;pick(f,'book');assert(f.node('#buildInfo').innerHTML.includes('伤害 18.51'));});
check(()=>{for(const cmd of T.CEO_IDS){const f=fresh();f.api.cmdSel=cmd;f.api.start(1);const g=f.api.G;g.energy=100;f.api.step(.01);assert.equal(g.energy,100);g.es=[{type:'walk',hp:10000,max:10000,d:2,sp:0,r:.28,slowK:1,slowT:0,stunT:0,burnT:0,burnD:0,x:2.5,y:1.5}];f.api.step(.01);assert.equal(g.energy,0);assert(g.es[0].hp<10000);}});
check(()=>{const f=fresh(),g=f.api.G;pick(f,'bbq');cell(f,3,2);f.ctx.window.advanceTime(16);const state=JSON.parse(f.ctx.window.render_game_to_text());assert.equal(state.selection.id,'bbq');assert.equal(state.selection.x,3);assert.equal(state.towers.length,0);});
check(()=>{const expected={bbq:3,tea:3,book:3,tech:4,t77:1,tpearl:3,totaku:3,trocket:3};for(const id of T.TOWER_IDS){const f=fresh(),g=f.api.G;g.breakT=1e9;g.c.x=g.c.y=100;g.cash=1e5;f.ctx.Math=Object.create(Math);f.ctx.Math.random=()=>.999;g.es=[5,5.3,4.7,4].map(d=>({type:'walk',hp:1e6,max:1e6,d,sp:0,r:.28,slowK:1,slowT:0,stunT:0,burnT:0,burnD:0,x:0,y:0}));f.api.step(.001);f.api.build(id,4,2);f.api.step(.001);const hit=g.es.filter(e=>e.hp<1e6).length;assert(hit>=expected[id],id+' attack target count');}});
check(()=>{const f=fresh();f.api.build('tea',3,2);pick(f,'trocket');cell(f,3,2);f.ctx.window.advanceTime(0);assert(f.arcs.some(a=>Math.abs(a[2]-3.2*f.api.geo.S)<1e-6));assert(f.node('#buildConfirm').disabled);assert(f.node('#buildInfo').innerHTML.includes('范围 3.2格'));assert.equal(f.api.G.tw.get('3,2').id,'tea');});
check(()=>{const f=fresh(),g=f.api.G;pick(f,'tpearl');cell(f,3,2);f.ctx.window.advanceTime(0);assert(f.drawLabels.some(a=>a[0]==='待建'));assert.equal(g.tw.size,0);assert.equal(g.cash,160);cell(f,2,1);f.ctx.window.advanceTime(0);assert(f.drawLabels.some(a=>a[0]==='不可建'));assert.equal(g.tw.size,0);assert.equal(g.cash,160);});
check(()=>{const f=fresh(),g=f.api.G;f.api.renderMenu();assert(f.node('#heroDesc').innerHTML.includes(`固定入口支援位（${g.c.x},${g.c.y}）`));});
console.log('TD passive/placement:',checks,'checks passed (Node VM, not browser E2E)');
