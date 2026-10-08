// Standalone prototype only: independent wallet, old 10-wave archive, separate td50 progress.
// Every write re-reads and merges under one origin-wide Web Lock.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tdprogress.js'));
  else root.TDProto=factory(root.TDProgress);
})(this,function(DefaultProgress){
'use strict';
const KEY='tangzhe-formal-td-proto-v1',LEGACY='tangzhe-td-proto',LOCK=KEY+'-write';
function create({storage,locks,T,Progress=DefaultProgress}){
 const P=Progress,runs=new Map();let current=null;
 const defaults=()=>Object.assign({coins:5e10},P.legacy(null),{td50:P.fresh()});
 function read(){
  if(!P.configured())throw Error('塔防规则模块未就绪，原型存档只读');
  const own=storage.getItem(KEY),text=own===null?storage.getItem(LEGACY):own;
  if(text===null)return defaults();
  const raw=JSON.parse(text);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('原型存档损坏，未覆盖原数据');
  if(raw.coins!==undefined&&(!Number.isFinite(raw.coins)||raw.coins<0||raw.coins>1e15))throw Error('原型余额无效，未覆盖原数据');
  if(raw.lv!==undefined&&(!raw.lv||typeof raw.lv!=='object'||Array.isArray(raw.lv)||T.IDS.some(id=>raw.lv[id]!==undefined&&(!Number.isInteger(raw.lv[id])||raw.lv[id]<0||raw.lv[id]>T.MAX_UP))))throw Error('原型升级数据无效');
  if(raw.best!==undefined&&(!Number.isInteger(raw.best)||raw.best<0||raw.best>10))throw Error('旧原型进度无效');
  if(raw.cleared!==undefined&&(!Number.isInteger(raw.cleared)||raw.cleared<0||raw.cleared>1))throw Error('旧原型通关记录无效');
  if(raw.cmd!==undefined&&!T.CEO_IDS.includes(raw.cmd))throw Error('原型统帅记录无效');
  if(raw.endless!==undefined&&(!raw.endless||!Number.isSafeInteger(raw.endless.best)||raw.endless.best<0||!Number.isSafeInteger(raw.endless.kills)||raw.endless.kills<0||(raw.endless.top!==undefined&&!T.validTop(raw.endless.top))))throw Error('旧原型榜单损坏，未覆盖原数据');
  if(P.check(raw.td50).length)throw Error('50波存档版本不兼容或结构损坏，已只读保护，原数据未覆盖');
  if(raw._buys!==undefined){const seen=new Set();if(!Array.isArray(raw._buys)||raw._buys.length>4096||!raw._buys.every(r=>{if(!r||!P.validId(r.requestId)||seen.has(r.requestId)||!T.TOWER_IDS.includes(r.id)||!Number.isInteger(r.level)||r.level<1||r.level>T.MAX_UP)return false;seen.add(r.requestId);return true;}))throw Error('原型购买记录损坏');}
  return Object.assign({},raw,P.legacy(raw),{coins:raw.coins===undefined?5e10:raw.coins,td50:raw.td50===undefined?P.fresh():raw.td50});
 }
 const load=()=>{try{return{ok:true,state:read()};}catch(e){return{ok:false,state:Object.assign(defaults(),{blocked:true}),why:e.message};}};
 async function write(action){
  try{const manager=typeof locks==='function'?locks():locks;
   if(!manager||typeof manager.request!=='function')return{ok:false,why:'浏览器没有安全存档锁；未写入。请保留本局，安全锁可用后重试。'};
   return await manager.request(LOCK,{mode:'exclusive'},()=>{
    const fresh=read(),draft=JSON.parse(JSON.stringify(fresh)),result=action(draft);
    if(typeof result==='string')return{ok:false,state:fresh,why:result};
    if(result&&result.skipWrite)return{ok:true,state:fresh,dup:true};
    if(P.check(draft.td50).length)throw Error('50波存档校验失败');
    const text=JSON.stringify(draft);storage.setItem(KEY,text);
    if(storage.getItem(KEY)!==text)throw Error('保存后校验失败');
    return{ok:true,state:draft};
   });
  }catch(e){return{ok:false,uncertain:true,why:'本机存储失败或未确认；结果保留，可重试（'+e.message+'）'};}
 }
 async function start(d,endless=false){
  const loaded=load();if(!loaded.ok)return loaded;
  const state=loaded.state;
  if(!d||d.ruleset!==P.RULESET_ID||!P.validId(d.runId)||d.n!==1||!T.CEO_IDS.includes(d.cmd))return{ok:false,state,why:'开局规则、编号、统帅或关卡无效'};
  const old=runs.get(d.runId),mode=endless?'endless':'normal';
  if(old){if(old!==current||old.mode!==mode||old.n!==d.n||old.cmd!==d.cmd||old.parentRunId!==d.parentRunId||old.settled)return{ok:false,state,why:'这局编号已用过'};return{ok:true,state,dup:true};}
  if(state.td50.results.some(r=>r.runId===d.runId))return{ok:false,state,why:'这局编号已结算'};
  if(runs.size>=P.MAX_RESULTS||state.td50.results.length>=P.MAX_RESULTS)return{ok:false,state,why:'本规则结算记录已满，请保留存档'};
  if(endless){const parent=runs.get(d.parentRunId),saved=state.td50.results.find(r=>r.runId===d.parentRunId);if(!P.validId(d.parentRunId)||!parent||parent!==current||parent.mode!=='normal'||!parent.settled||!parent.won||parent.n!==d.n||parent.cmd!==d.cmd||!saved||saved.kind!=='normal'||!saved.win||saved.waves!==P.NORMAL_WAVES)return{ok:false,state,why:'先保存普通50波胜利，再进入无尽'};}
  current={runId:d.runId,n:d.n,cmd:d.cmd,mode,parentRunId:endless?d.parentRunId:undefined,settled:false};runs.set(d.runId,current);return{ok:true,state};
 }
 async function settle(d){
  if(!d||d.ruleset!==P.RULESET_ID)return{ok:false,why:'塔防规则版本不一致，未保存'};
  const kind=d.td==='result'?'normal':d.td==='endlessResult'?'endless':null,run=runs.get(d.runId);
  if(!kind||!run||run.mode!==kind||run.n!==d.n||run.cmd!==d.cmd||(!run.settled&&run!==current))return{ok:false,why:'本局登记不匹配'};
  if(d.parentRunId!==undefined&&d.parentRunId!==run.parentRunId)return{ok:false,why:'无尽前局编号不匹配'};
  const res=Object.assign({},d,kind==='endless'?{parentRunId:run.parentRunId}:{});
  if(!P.validResult(res,kind))return{ok:false,why:'本局结果无效'};
  const signature=P.signature(P.receipt(res,kind));
  if(run.result&&run.result!==signature)return{ok:false,why:'结算内容已锁定'};
  run.result=signature;
  const r=await write(s=>{
   const saved=s.td50.results.find(r=>r.runId===res.runId);
   if(saved)return P.signature(saved)===signature?{skipWrite:true}:'结算编号内容不匹配';
   if(!(kind==='normal'?P.applyResult(s.td50,res):P.applyEndless(s.td50,res)))return'50波结果无效';
   s.cmd=run.cmd;
  });
  if(r.ok){run.settled=true;run.won=kind==='normal'&&d.win;}
  return r;
 }
 return{load,key:KEY,legacy:LEGACY,lock:LOCK,start:d=>start(d),endlessStart:d=>start(d,true),settle,
  select:cmd=>write(s=>{if(!T.CEO_IDS.includes(cmd))return'统帅无效';s.cmd=cmd;}),
  buy:({id,requestId,expectedLevel})=>write(s=>{if(!T.TOWER_IDS.includes(id)||!P.validId(requestId))return'购买请求无效';const receipts=s._buys||[];const old=receipts.find(r=>r.requestId===requestId);if(old)return old.id===id?{skipWrite:true}:'购买编号不匹配';if(receipts.length>=4096)return'原型购买记录已满';const level=s.lv[id];if(level!==expectedLevel)return'其他页面已更新等级，请按新价格重试';if(level>=T.MAX_UP)return'已满级';const price=T.price(id,level);if(s.coins<price)return'模拟余额不足';s.coins-=price;s.lv[id]++;s._buys=[...receipts,{requestId,id,level:s.lv[id]}];})};
}
return{KEY,LEGACY,LOCK,create};
});
