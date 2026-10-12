/* 家宅-56：CEO 没人点时在已摆家具之间自主活动（第一步，只用现有动作）。
 * 纯决策层：挑去处、停多久、说不说话。不读写存档、不碰 DOM、不影响收益；状态全在调用方内存里。
 * 规则来源：家宅-60 修订版（2026-10-12 22:55）+ 熊大 23:01 / 23:22 复核口径。
 * 只认现有白名单：home-interaction.js 的能躺 / 能坐（含唯一可坐地毯 s77_quilt_island_rug），
 * 以及 economy.furnLiveAct 为 read / dress 的书架、衣柜。其它家具一律不选（新动作归家宅-57）。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeAutonomy=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 // 每个动作：停留秒数区间、时段系数（只有拿得到有效时段时才乘，拿不到一律 ×1）、台词用 LIVE_LINES 的哪一组
 const KINDS=Object.freeze({
  lie:  Object.freeze({stay:[25,60],period:{night:3,morning:.5},lines:'rest'}),
  sit:  Object.freeze({stay:[10,25],period:{dusk:2},lines:'sit'}),
  rug:  Object.freeze({stay:[12,30],period:{},lines:'sit'}),
  read: Object.freeze({stay:[15,35],period:{day:1.5},lines:'read'}),
  dress:Object.freeze({stay:[4,8],period:{},lines:'dress'})
 });
 const PACE=Object.freeze({walk:[2,5],stay:[3,10]});
 const IDLE=Object.freeze([0,15]);
 const MOVE_MAX_SEC=3, WALK_SPEED=2.8, AFTER_PLAYER_SEC=60, LINE_SEC=3.5, LINE_REPEAT_SEC=600;
 // CEO 偏好 ×1.5，只列 56 用得到的部分（77 桌子/家电、火箭灯/家电/墙饰属于家宅-57）
 const PREF=Object.freeze({c77:[],pearl:['sit','rug'],otaku:['read','lie','rug'],rocket:[]});
 const RUG_FID='furn_s77_quilt_island_rug';

 function kindOf(fid,capability,liveAct){
  const cap=capability(fid);
  if(cap==='lie')return 'lie';
  if(cap==='sit')return fid===RUG_FID?'rug':'sit';
  const a=liveAct(fid);
  return a==='read'||a==='dress'?a:null;
 }
 // placed: 房间 placed 数组；只收地面家具里白名单内的，墙面一律跳过
 function candidates(placed,{capability,liveAct,itemSurf}){
  const out=[];
  for(const p of placed||[]){if(itemSurf(p)==='wall')continue;const kind=kindOf(p.fid,capability,liveAct);if(kind)out.push({uid:p.uid,fid:p.fid,kind});}
  return out;
 }
 const between=([a,b],rng)=>a+(b-a)*rng();
 // 规则 2：排除上一件；只有一件时与空地交替；一件都没有只踱步。返回 {pace:true} 或候选项
 function pick(list,{last,ceo,period,rng}){
  if(!list.length)return {pace:true};
  if(list.length===1)return last===list[0].uid?{pace:true}:list[0];
  const pool=list.filter(c=>c.uid!==last),pref=PREF[ceo]||[];
  const w=pool.map(c=>{let v=1;const m=period&&KINDS[c.kind].period[period];if(m)v*=m;if(pref.includes(c.kind))v*=1.5;return v;});
  let r=rng()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<pool.length;i++){r-=w[i];if(r<0)return pool[i];}
  return pool[pool.length-1];
 }
 const stayFor=(kind,rng)=>between(KINDS[kind].stay,rng);
 const idleFor=rng=>between(IDLE,rng);
 const paceWalk=rng=>between(PACE.walk,rng), paceStay=rng=>between(PACE.stay,rng);
 // 规则 4：家具之间单程 ≤3 秒，超过就淡出淡入；空地踱步按 2–5 秒另算
 const needsFade=(dist,reducedMotion)=>!!reducedMotion||dist/WALK_SPEED>MOVE_MAX_SEC;
 // 规则 5：停下时 50%（空房 25%）冒一句；同一句 10 分钟内不重复；冷却后没有可用句就不说
 function chooseLine(pool,said,{now,rng,emptyRoom}){
  if(rng()>=(emptyRoom?.25:.5))return null;
  const ok=(pool||[]).filter(l=>!(said[l]>now-LINE_REPEAT_SEC));
  if(!ok.length)return null;
  const line=ok[Math.floor(rng()*ok.length)];said[line]=now;return line;
 }
 return Object.freeze({KINDS,PACE,IDLE,PREF,MOVE_MAX_SEC,WALK_SPEED,AFTER_PLAYER_SEC,LINE_SEC,LINE_REPEAT_SEC,RUG_FID,kindOf,candidates,pick,stayFor,idleFor,paceWalk,paceStay,needsFade,chooseLine});
});
