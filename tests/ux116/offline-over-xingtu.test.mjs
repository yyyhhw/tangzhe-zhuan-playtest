// 体验-116：页面一直在前台但时钟跳过一大段（睡眠/冻结恢复、快进）→ 离线结算弹窗出现时星途浮层必须先关掉，弹窗可点；不动存档/领取。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
// 真实 showOffline 函数（四份各自抽出）在 VM 里跑：其余依赖全用万能桩，只记录 openModal 与星途 close 的先后。
function stub(){const f=function(){return P;};const P=new Proxy(f,{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='then'?undefined:P,apply:()=>P,has:()=>true});return P;}
function run(file,{open,modalBusy=false}){
 const text=readFileSync(new URL('../../'+file,import.meta.url),'utf8'),i=text.indexOf('function showOffline() {'),body=text.slice(i,text.indexOf('\n}',i)+2);
 const log=[],any=stub(),xt={isOpen:()=>open,close(){log.push('close');open=false;}};
 const env={globalThis:{XingTu:xt},state:{pending:{cap:7200,gap:660,sec:660,amount:5,id:'x'}},modalOpen:()=>modalBusy,mq:[],openModal:()=>log.push('modal')};
 const scope=new Proxy(env,{has:()=>true,get:(t,k)=>k===Symbol.unscopables?undefined:k in t?t[k]:k in globalThis?globalThis[k]:any});
 const c=vm.createContext({scope});vm.runInContext('with(scope){'+body+'\nshowOffline();}',c);return {log,env};
}
for(const file of ['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js']){
 test(file+' 体验-116: offline popup with 星途 open → 星途 closes BEFORE the popup opens (popup on top, clickable)',()=>{const {log}=run(file,{open:true});assert.deepEqual(log.slice(0,2),['close','modal']);});
 test(file+' 体验-116: 星途 closed → nothing extra; popup busy → only queued, 星途 untouched until it really shows',()=>{assert.deepEqual(run(file,{open:false}).log.slice(0,1),['modal']);assert(!run(file,{open:false}).log.includes('close'));const q=run(file,{open:true,modalBusy:true});assert.deepEqual(q.log,[]);assert.equal(q.env.mq.length,1);});
}
test('four app.js copies carry the identical 体验-116 line inside showOffline, after the modal-queue guard',()=>{
 const lines=['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'].map(f=>{const s=readFileSync(new URL('../../'+f,import.meta.url),'utf8'),i=s.indexOf('function showOffline() {'),body=s.slice(i,s.indexOf('openModal(',i));const l=body.split('\n').filter(x=>x.includes('体验-116'));assert.equal(l.length,1,f);assert(body.indexOf('mq.unshift(showOffline)')<body.indexOf('体验-116'),f);return l[0];});
 for(const l of lines)assert.equal(l,lines[0]);assert.match(lines[0],/globalThis\.XingTu\?\.isOpen\(\)\) globalThis\.XingTu\.close\(\)/);
});
