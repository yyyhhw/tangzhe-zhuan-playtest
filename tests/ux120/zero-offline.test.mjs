// 体验-120：离线收益为 0 时不弹「今日双倍领取 +0」、不占当天双倍；走真实 economy.claimOffline。四份 app 的 showOffline 完全一致。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const FILES=['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'];
const fn=(src,name)=>{const i=src.indexOf('function '+name+'(');assert(i>=0,name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1);}};
const FMT=['fmtRound','fmt'];
test('四份的 体验-120 判断完全一致',()=>{const a=FILES.map(f=>fs.readFileSync(f,'utf8').split('\n').filter(l=>l.includes('体验-120')||l.includes("fmt(p.amount * 2) === '0'")).join('\n'));assert(a[0].length>0);for(const x of a)assert.equal(x,a[0]);});
function run(file,amount,{atomicFails=false}={}){
  const src=fs.readFileSync(file,'utf8');const eco=fs.readFileSync(file.replace(/app\.js$/,'economy.js'),'utf8');
  const ctx=vm.createContext({console,Math,Date,JSON,isFinite,Number,Array,Object,String});ctx.window=ctx;ctx.globalThis=ctx;vm.runInContext(eco,ctx);
  const E=ctx.Economy||ctx.window.Economy;assert(E,'Economy');
  const T=1700000000000,st=E.newState?E.newState(T):E.fresh?.(T);assert(st,'state');
  st.pending={id:'p1',amount,sec:3600,gap:3600,cap:28800};
  const tm=src.match(/const FMT_TIERS = [\s\S]*?;\n/),tiers=tm?tm[0]:'';
  const log={modal:0,html:'',sfx:0,toast:[]};
  Object.assign(ctx,{E,state:st,now:()=>T+1000,mq:[],modalOpen:()=>false,openModal:h=>{log.modal++;log.html=h;},bb70ShouldShowOfflineBanner:()=>false,fmtDur:s=>s+'s',fmtClockLocal:()=>'',coinSm:'',BB70_NEW_COUNT:0,
    atomic:(f)=>atomicFails?{ok:false,why:'saveFailed'}:f(),sfx:()=>log.sfx++,toast:m=>log.toast.push(m),popWord(){},bumpCoins(){},burstCoins(){},closeModal(){},W:390,H:844,dirty:false,document:{getElementById:()=>null},$:()=>null,audioUnlock(){}});
  vm.runInContext(tiers.replace('const ','var ')+FMT.filter(n=>src.includes('function '+n+'(')).map(n=>fn(src,n)).join('\n')+'\n'+fn(src,'showOffline')+'\ntry{showOffline()}catch(e){if(!/null|undefined/.test(String(e)))throw e}',ctx);
  return {st,log,E,T};
}
for(const f of FILES){
  test(`${f}：离线 0 → 不弹框、静默普通领取、不占双倍`,()=>{const {st,log,E,T}=run(f,0);assert.equal(log.modal,0);assert.equal(st.pending,null);assert.notEqual(st.dailyDoubleDay,E.dayKey?.(T+1000)??'x');assert.equal(st.claimLog.at(-1).dbl,false);assert(E.canDouble(st,T+1000),'双倍还在');assert.equal(log.sfx,0);});
  test(`${f}：离线 0.02（显示 +0）也不弹框`,()=>{const {log,st}=run(f,0.02);assert.equal(log.modal,0);assert.equal(st.pending,null);});
  test(`${f}：离线 >0 仍照常弹双倍框`,()=>{const {log,st}=run(f,120);assert.equal(log.modal,1);assert.match(log.html,/今日双倍领取 \+240/);assert(st.pending);});
}
