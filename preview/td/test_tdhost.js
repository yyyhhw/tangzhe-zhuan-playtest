'use strict';
const assert = require('node:assert/strict'), E = require('../economy.js'), T = require('./tdcore.js'), Host = require('./tdhost.js');
let count = 0;
function check(fn) {fn(); count++;}
function fixture() {
  const s = E.newState(1000); s.coins = 5e10; s.shops[3] = {open:true,lv:1,emp:0};
  s.pet = {sentinel:'pet untouched'}; s.zombie = {sentinel:'zombie untouched'}; s.otherFutureField = {x:42};
  const data = new Map([['tangzhe-preview-save',JSON.stringify(s)]]);
  const f = {s,blocked:false,fail:null,sends:[],writes:[],changed:0};
  const storage = {getItem:k => data.get(k) ?? null, setItem:(k,v) => { if(f.fail === k) throw Error('disk'); f.writes.push(k); data.set(k,v); }};
  f.host = Host.create({state:()=>s, blocked:()=>f.blocked || E.isBlocked(s) || !E.walletOk(s), balance:()=>E.balance(s), send:d=>f.sends.push(d), close:()=>{}, changed:()=>f.changed++, transact:(apply,price)=>E.transact(s,{apply,price,save:st=>E.commitSave(storage,'tangzhe-preview-save','tangzhe-preview-save-bak',st)})});
  f.msg=d=>{ f.host.msg(d); return f.sends.at(-1); }; f.data=data;
  return f;
}
const buy=(id='bbq',requestId='b1')=>({td:'buy',id,requestId,price:0,coins:1e15});
const start=(runId='r1',cmd='pearl')=>({td:'start',runId,cmd,n:1});
const result=(runId='r1',cmd='pearl')=>({td:'result',runId,cmd,n:1,win:true,waves:10,kills:100});
for(const id of T.IDS) check(()=>{const f=fixture(),before=f.s.coins,r=f.msg(buy(id));assert.equal(r.ok,true);assert.equal(before-f.s.coins,T.price(id,0));assert.equal(f.s.td.lv[id],1);assert.equal(JSON.parse(f.data.get('tangzhe-preview-save')).td.lv[id],1);assert.equal(f.s.pet.sentinel,'pet untouched');assert.equal(f.s.otherFutureField.x,42);assert(f.writes.every(k=>k.startsWith('tangzhe-preview-save')));});
check(()=>{const f=fixture();assert(!('td'in f.s));f.msg({td:'hello'});assert(!('td'in f.s));assert.equal(f.writes.length,0);});
check(()=>{const f=fixture();f.msg(buy());const before=JSON.stringify(f.s),writes=f.writes.length;assert.equal(f.msg(buy()).dup,true);assert.equal(JSON.stringify(f.s),before);assert.equal(f.writes.length,writes);assert.equal(f.msg(buy('tea')).ok,false);});
for(const fail of ['tangzhe-preview-save','tangzhe-preview-save-bak']) check(()=>{const f=fixture(),before=JSON.stringify(f.s),disk=f.data.get('tangzhe-preview-save');f.fail=fail;const r=f.msg(buy());assert.equal(r.ok,false);assert.equal(r.requestId,'b1');assert.equal(JSON.stringify(f.s),before);assert.equal(f.data.get('tangzhe-preview-save'),disk);f.fail=null;assert.equal(f.msg(buy()).ok,true);assert.equal(f.s.td.lv.bbq,1);});
check(()=>{const f=fixture();f.blocked=true;const before=JSON.stringify(f.s);for(const d of [buy(),start(),result()]){const r=f.msg(d);assert.equal(r.ok,false);assert.equal(r[d.td==='buy'?'requestId':'runId'],d[d.td==='buy'?'requestId':'runId']);}assert.equal(JSON.stringify(f.s),before);assert.equal(f.writes.length,0);});
check(()=>{const f=fixture();f.s.coins=1;assert.equal(f.msg(buy()).ok,false);assert(!f.s.td);});
check(()=>{const f=fixture();f.s.td=T.norm();f.s.td.lv.bbq=30;const before=f.s.coins;assert.equal(f.msg(buy()).ok,false);assert.equal(f.s.coins,before);});
check(()=>{const f=fixture();assert.equal(f.msg(start()).ok,true);const run=f.host.run;assert.equal(f.msg(start()).dup,true);assert.equal(f.host.run,run);assert.equal(f.msg(start('r1','rocket')).ok,false);assert.equal(f.host.run,run);assert.equal(f.msg(result('r1','rocket')).ok,false);assert.equal(f.msg(result()).ok,true);const before=JSON.stringify(f.s),writes=f.writes.length;assert.equal(f.msg(result()).dup,true);assert.equal(JSON.stringify(f.s),before);assert.equal(f.writes.length,writes);assert.equal(f.msg(start()).ok,false);assert.equal(f.s.td.cmd,'pearl');});
check(()=>{const f=fixture();f.msg(start());f.msg(start('r2'));assert.equal(f.msg(start()).ok,false);assert.equal(f.host.run.runId,'r2');assert.equal(f.msg(result()).ok,false);assert.equal(f.msg(result('r2')).ok,true);});
check(()=>{const f=fixture();f.msg(start());f.host.reset();assert.equal(f.msg(start()).ok,false);assert.equal(f.msg(result()).ok,false);});
for(const fail of ['tangzhe-preview-save','tangzhe-preview-save-bak']) check(()=>{const f=fixture();f.msg(start());const before=JSON.stringify(f.s);f.fail=fail;assert.equal(f.msg(result()).ok,false);assert.equal(JSON.stringify(f.s),before);assert.equal(f.host.run.settled,false);f.fail=null;assert.equal(f.msg(result()).ok,true);assert.equal(f.s.td.cleared,1);assert.equal(f.s.coins,5e10);assert.equal(f.msg({...result(),kills:101}).ok,false);});
for(const mutation of [{waves:9},{waves:NaN},{n:1.2},{cmd:'bad'},{kills:-1},{win:1}]) check(()=>{const f=fixture();f.msg(start());assert.equal(f.msg({...result(),...mutation}).ok,false);assert(!f.s.td);});
check(()=>{const f=fixture();f.msg(buy());const loaded=E.loadSave(f.data.get('tangzhe-preview-save'),null,1000);assert.equal(loaded.st.td.lv.bbq,1);assert.equal(loaded.st.otherFutureField.x,42);assert.equal(E.checkSave(f.s).length,0);f.s.td.lv.bbq=-1;assert(E.checkSave(f.s).includes('td'));});
console.log('TD parent integration:',count,'checks passed');
