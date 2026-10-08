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
const es=(runId='e1')=>({td:'endlessStart',runId,parentRunId:'r1',n:1,cmd:'pearl'});
const er=(runId='e1')=>({td:'endlessResult',runId,n:1,cmd:'pearl',waves:3,kills:45});
check(()=>{const f=fixture();f.msg(start());assert(!f.msg(es()).ok);assert(f.msg(result()).ok);const coins=f.s.coins;assert(f.msg(es()).ok);assert(f.msg(es()).ok);assert(!f.msg({...result(),runId:'e1'}).ok);assert(f.msg(er()).ok);assert.equal(f.s.td.best,10);assert.equal(f.s.td.endless.best,3);assert.equal(f.s.td.endless.kills,45);assert.equal(f.s.coins,coins);const writes=f.writes.length;assert(f.msg(er()).dup);assert.equal(f.writes.length,writes);assert(!f.msg({...er(),waves:4}).ok);assert.equal(E.checkSave(f.s).length,0);const saved=E.loadSave(f.data.get('tangzhe-preview-save'),null,1000);assert.equal(saved.st.td.endless.best,3);});
check(()=>{const f=fixture();f.msg(start());f.msg(result());f.msg(es());const before=JSON.stringify(f.s);f.fail='tangzhe-preview-save';assert(!f.msg(er()).ok);assert.equal(JSON.stringify(f.s),before);assert(!f.msg({...er(),kills:46}).ok);f.fail=null;assert(f.msg(er()).ok);f.msg(start('r2'));f.msg(result('r2'));assert(f.msg({...es('e2'),parentRunId:'r2'}).ok);assert(f.msg({...er('e2'),waves:1,kills:2}).ok);assert.equal(f.s.td.endless.best,3);assert.equal(f.s.td.endless.kills,45);});
check(()=>{const f=fixture();f.msg(start());f.msg({...result(),win:false,waves:9});assert(!f.msg(es()).ok);});
check(()=>{const f=fixture();f.msg(start());f.msg(result());f.msg(es());for(const bad of [{waves:-1},{waves:Infinity},{waves:1.1},{kills:NaN},{cmd:'bad'}])assert(!f.msg({...er(),...bad}).ok);f.host.reset();assert(!f.msg(er()).ok);});
console.log('Endless host:',count,'checks passed');
