// Standalone formal prototype only. Every write re-reads and merges under one origin-wide Web Lock.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TDProto=factory();})(this,function(){
'use strict';
const KEY='tangzhe-formal-td-proto-v1',LEGACY='tangzhe-td-proto',LOCK=KEY+'-write';
function create({storage,locks,T}){
 const defaults=()=>Object.assign({coins:5e10},T.norm(null));
 function read(){
  const own=storage.getItem(KEY),text=own===null?storage.getItem(LEGACY):own;
  if(text===null)return defaults();
  const raw=JSON.parse(text);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('原型存档损坏，未覆盖原数据');
  if(raw.coins!==undefined&&(!Number.isFinite(raw.coins)||raw.coins<0||raw.coins>1e15))throw Error('原型余额无效，未覆盖原数据');
  if(raw.lv!==undefined&&(!raw.lv||typeof raw.lv!=='object'||T.IDS.some(id=>raw.lv[id]!==undefined&&(!Number.isInteger(raw.lv[id])||raw.lv[id]<0||raw.lv[id]>T.MAX_UP))))throw Error('原型升级数据无效');
  if(raw.endless!==undefined&&(!raw.endless||!Number.isSafeInteger(raw.endless.best)||raw.endless.best<0||!Number.isSafeInteger(raw.endless.kills)||raw.endless.kills<0||(raw.endless.top!==undefined&&!T.validTop(raw.endless.top))))throw Error('原型榜单损坏，未覆盖原数据');
  if(raw._buys!==undefined&&(!Array.isArray(raw._buys)||raw._buys.length>4096||!raw._buys.every(r=>r&&typeof r.requestId==='string'&&T.TOWER_IDS.includes(r.id)&&Number.isInteger(r.level)&&r.level>=1&&r.level<=T.MAX_UP)))throw Error('原型购买记录损坏');
  return Object.assign({},raw,T.norm(raw),{coins:raw.coins===undefined?5e10:raw.coins});
 }
 const load=()=>{try{return{ok:true,state:read()};}catch(e){return{ok:false,state:defaults(),why:e.message};}};
 async function write(action){
  try{const manager=typeof locks==='function'?locks():locks;
  if(!manager||typeof manager.request!=='function')return{ok:false,why:'浏览器没有安全存档锁；未写入。请保留本局，安全锁可用后重试。'};
  return await manager.request(LOCK,{mode:'exclusive'},()=>{
   const fresh=read(),draft=JSON.parse(JSON.stringify(fresh));const why=action(draft);
   if(why)return{ok:false,state:fresh,why};
   const text=JSON.stringify(draft);storage.setItem(KEY,text);
   if(storage.getItem(KEY)!==text)throw Error('保存后校验失败');
   return{ok:true,state:draft};
  });}catch(e){return{ok:false,uncertain:true,why:'本机存储失败或未确认；结果保留，可重试（'+e.message+'）'};}
 }
 return{load,key:KEY,legacy:LEGACY,lock:LOCK,
 select:cmd=>write(s=>{if(!T.CEO_IDS.includes(cmd))return'统帅无效';s.cmd=cmd;}),
 buy:({id,requestId,expectedLevel})=>write(s=>{if(!T.TOWER_IDS.includes(id)||typeof requestId!=='string'||requestId.length>96)return'购买请求无效';const receipts=s._buys||[];const old=receipts.find(r=>r.requestId===requestId);if(old)return old.id===id?null:'购买编号不匹配';if(receipts.length>=4096)return'原型购买记录已满';const level=s.lv[id];if(level!==expectedLevel)return'其他页面已更新等级，请按新价格重试';if(level>=T.MAX_UP)return'已满级';const price=T.price(id,level);if(s.coins<price)return'模拟余额不足';s.coins-=price;s.lv[id]++;s._buys=[...receipts,{requestId,id,level:s.lv[id]}];}),
 settle:res=>write(s=>{if(res.td==='endlessResult'){if(!T.applyEndless(s,res))return'无尽结果无效';}else if(res.td==='result'){if(!T.applyResult(s,res))return'结果无效';}else return'结果类型无效';})};
}
return{KEY,LEGACY,LOCK,create};
});
