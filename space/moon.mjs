/** Candidate-only moon rules. Pure host planner; no Storage, timers, UI results or wallet changes. */
import {readSpace} from './domain.mjs?v=ux116-20261014-r1';
import {EVENT_IDS,readVoyageEv,pickEvent,defaultEvState,resolveEvent,outcomeFor,rewardPoints} from './voyage-ev.mjs?v=ux116-20261014-r1';
// 杨总 2026-10-14 01:32「星途所有店铺35级就可以了」：全部店铺 Lv35+ 解锁。正式航程 10 分钟、每次 8 探索点。
export const MOON_RULES=Object.freeze({id:'xingtu-moon-10min-8pts-v1',route:'moon',duration:600000,points:8,minShopLevel:35});
// 星途-113：新规则版本，新出航一律挂一件返航事件（星途-07）。旧 v1 航程/回执照旧可读可领（8 点、ev:null）。
export const MOON_EV_RULES=Object.freeze({id:'xingtu-moon-10min-ev-v2',route:'moon',duration:600000,points:8,minShopLevel:35});
const RULESETS=[MOON_RULES.id,MOON_EV_RULES.id];
export const spaceUnlocked=state=>Array.isArray(state?.shops)&&state.shops.length>0&&state.shops.every(s=>s?.open===true&&Number.isSafeInteger(s.lv)&&s.lv>=MOON_RULES.minShopLevel);
const copy=x=>JSON.parse(JSON.stringify(x)),own=(x,k)=>Object.hasOwn(x,k),int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const bad=code=>({ok:false,code}),MAX_TIME=8640000000000000;
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.sort().join('|');
export function parseVoyageId(id,scope){
 if(typeof id!=='string')return null;
 const m=id.match(/^moon:(formal|preview):([1-9][0-9]*):([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/);
 return m&&m[1]===scope&&int(Number(m[2]),1)?{seq:Number(m[2])}:null;
}
const R1=['voyageId','sequence','route','ruleset','start','arrival','claimedAt','points'],R2=[...R1,'ev','choice','outcome'];
function receiptOk(r,ledger,scope){
 if(!r||typeof r!=='object'||!RULESETS.includes(r.ruleset))return false;
 const v2=r.ruleset===MOON_EV_RULES.id;
 if(!keys(r,v2?[...R2]:[...R1])||r.sequence!==ledger.claimed||parseVoyageId(r.voyageId,scope)?.seq!==r.sequence||r.route!=='moon'||!int(r.start)||!int(r.arrival)||r.arrival!==r.start+MOON_RULES.duration||!int(r.claimedAt)||r.claimedAt<r.arrival||r.claimedAt>MAX_TIME)return false;
 if(!v2)return r.points===MOON_RULES.points;
 return EVENT_IDS.includes(r.ev)&&r.outcome===outcomeFor(r.voyageId,r.ev,r.choice)&&r.points===rewardPoints(r.ev,r.choice,r.outcome);
}
// v2 航程事件：必须有显式 evState；已选 → 成败/奖励必须和确定性规则一致（坏档只读，不猜不洗）。
function voyageEvOk(v,arrival){
 if(v.ruleset===MOON_RULES.id)return v.ev===null&&!own(v,'evState')?{event:null}:null;
 const e=readVoyageEv(v);if(!e.ok||!e.event||e.event.implicit)return null;
 const st=e.event.state;
 if(st.choice!==null){const pts=rewardPoints(st.id,st.choice,st.outcome);if(st.outcome!==outcomeFor(v.voyageId,st.id,st.choice)||!keys(st.reward,['pts'])||st.reward.pts!==pts||st.resolvedAt<arrival)return null;}
 return {event:st};
}
export function moonView(state,{scope,now}){
 if(!['formal','preview'].includes(scope))return bad('SPACE_SCOPE_INVALID');
 if(!int(now)||now>MAX_TIME)return bad('SPACE_TIME_INVALID');
 const read=readSpace(state);if(!read.ok)return read;
 const space=read.space,ledger=own(space,'moonLoop')?space.moonLoop:null,v=space.voyage;
 if(own(space,'moonLoop')){
  if(!ledger||ledger.schemaVersion!==1||!int(ledger.sequence)||!int(ledger.claimed)||ledger.claimed>ledger.sequence||!own(ledger,'lastReceipt'))return bad('SPACE_LEDGER_COMPATIBILITY');
  const r=ledger.lastReceipt;
  if(ledger.claimed===0?r!==null:!receiptOk(r,ledger,scope))return bad('SPACE_RECEIPT_COMPATIBILITY');
 }
 if(v!==null){
  if(!ledger||!int(v.sequence,1)||v.sequence!==ledger.sequence||parseVoyageId(v.voyageId,scope)?.seq!==v.sequence||v.route!=='moon'||!RULESETS.includes(v.ruleset)||v.dur!==MOON_RULES.duration||!voyageEvOk(v,v.start+v.dur)||typeof v.completed!=='boolean'||!int(v.start)||v.start+v.dur>MAX_TIME)return bad('SPACE_VOYAGE_COMPATIBILITY');
  if(v.completed?(ledger.claimed!==v.sequence||ledger.lastReceipt?.voyageId!==v.voyageId||ledger.lastReceipt.start!==v.start||ledger.lastReceipt.arrival!==v.start+v.dur||ledger.lastReceipt.ruleset!==v.ruleset||(v.ruleset===MOON_EV_RULES.id&&(v.evState.choice===null||ledger.lastReceipt.ev!==v.ev||ledger.lastReceipt.choice!==v.evState.choice||ledger.lastReceipt.outcome!==v.evState.outcome||ledger.lastReceipt.points!==v.evState.reward.pts||v.evState.resolvedAt>ledger.lastReceipt.claimedAt))):(ledger.claimed!==v.sequence-1||ledger.lastReceipt&&ledger.lastReceipt.claimedAt>v.start))return bad('SPACE_VOYAGE_COMPATIBILITY');
  if(now<v.start)return bad('SPACE_TIME_BACKWARDS');
 }else if(ledger&&ledger.sequence!==0)return bad('SPACE_LEDGER_COMPATIBILITY');
 if(ledger?.lastReceipt&&now<ledger.lastReceipt.claimedAt)return bad('SPACE_TIME_BACKWARDS');
 const unlocked=spaceUnlocked(state),ev=v?voyageEvOk(v,v.start+v.dur).event:null;
 if(ev&&ev.resolvedAt!==null&&now<ev.resolvedAt)return bad('SPACE_TIME_BACKWARDS');
 return {ok:true,event:ev?copy(ev):null,needsChoice:!!(ev&&ev.choice===null&&v&&!v.completed),unlocked,missing:read.missing,space:copy(space),ledger:copy(ledger),voyage:copy(v),receipt:copy(ledger?.lastReceipt??null),phase:v===null?'ready':v.completed?'report':now>=v.start+v.dur?'arrived':'flying',remaining:v&&!v.completed?Math.max(0,v.start+v.dur-now):0,arrival:v?v.start+v.dur:null,ruleset:v?v.ruleset:MOON_EV_RULES.id};
}
export function planMoon(state,intent,{scope,now,makeId}){
 const input=readSpace({intent});if(!input.ok)return bad('SPACE_INTENT_INVALID');
 const view=moonView(state,{scope,now});if(!view.ok)return view;
 if(!view.unlocked)return bad('SPACE_TECH_LEVEL_REQUIRED');
 const depart=keys(intent,['type','route'])&&intent.type==='depart'&&intent.route==='moon';
 const claim=keys(intent,['type','voyageId'])&&intent.type==='claim'&&typeof intent.voyageId==='string';
 const choose=keys(intent,['type','voyageId','choice'])&&intent.type==='choose'&&typeof intent.voyageId==='string'&&['a','b'].includes(intent.choice);
 if(!depart&&!claim&&!choose)return bad('SPACE_INTENT_INVALID');
 const space=copy(view.space),ledger=copy(view.ledger??{schemaVersion:1,sequence:0,claimed:0,lastReceipt:null});
 if(depart){
  if(view.voyage&&!view.voyage.completed)return {ok:true,noop:true,code:'SPACE_ALREADY_IN_FLIGHT',view};
  if(ledger.sequence===Number.MAX_SAFE_INTEGER||now+MOON_RULES.duration>MAX_TIME)return bad('SPACE_OVERFLOW');
  if(typeof makeId!=='function')return bad('SPACE_ID_REQUIRED');
  const sequence=ledger.sequence+1,uuid=makeId(),voyageId=`moon:${scope}:${sequence}:${uuid}`;
  if(parseVoyageId(voyageId,scope)?.seq!==sequence)return bad('SPACE_ID_INVALID');
  ledger.sequence=sequence;space.moonLoop=ledger;
  const ev=pickEvent(voyageId);if(!ev)return bad('SPACE_EV_UNKNOWN');
  const base=copy(space.voyage??{});delete base.evState;// 上一趟的事件状态不带进新航程；其它未知扩展照旧保留
  space.voyage={...base,route:'moon',start:now,dur:MOON_EV_RULES.duration,ev,evState:defaultEvState(ev),voyageId,sequence,ruleset:MOON_EV_RULES.id,completed:false};
 }else if(choose){
  const parsed=parseVoyageId(intent.voyageId,scope);
  if(!parsed)return bad('SPACE_VOYAGE_ID_INVALID');
  if(parsed.seq<=ledger.claimed)return {ok:true,noop:true,stale:true,code:'SPACE_EV_ALREADY_CLAIMED',view};
  if(!view.voyage||intent.voyageId!==view.voyage.voyageId)return bad('SPACE_VOYAGE_ID_MISMATCH');
  if(view.phase!=='arrived')return bad('SPACE_NOT_ARRIVED');
  if(!view.event)return bad('SPACE_EV_NONE');
  if(view.event.choice!==null)return {ok:true,noop:true,code:'SPACE_EV_ALREADY_CHOSEN',view};// 已选过：只读，绝不重掷
  const outcome=outcomeFor(intent.voyageId,view.event.id,intent.choice),pts=rewardPoints(view.event.id,intent.choice,outcome);
  const r=resolveEvent(space.voyage,{choice:intent.choice,outcome,reward:{pts},now});if(!r.ok)return r;
  space.voyage=r.voyage;
 }else{
  const parsed=parseVoyageId(intent.voyageId,scope);
  if(!parsed)return bad('SPACE_VOYAGE_ID_INVALID');
  if(parsed.seq<=ledger.claimed)return {ok:true,noop:true,stale:true,receipt:ledger.lastReceipt?.voyageId===intent.voyageId?copy(ledger.lastReceipt):null,view};
  if(!view.voyage||intent.voyageId!==view.voyage.voyageId)return bad('SPACE_VOYAGE_ID_MISMATCH');
  if(view.phase!=='arrived')return bad('SPACE_NOT_ARRIVED');
  if(view.needsChoice)return bad('SPACE_EV_CHOICE_REQUIRED');
  const v2=view.voyage.ruleset===MOON_EV_RULES.id,points=v2?view.event.reward.pts:MOON_RULES.points;
  const visits=space.visits.moon??0;
  if(!int(visits)||space.pts>Number.MAX_SAFE_INTEGER-points||visits===Number.MAX_SAFE_INTEGER)return bad('SPACE_OVERFLOW');
  space.pts+=points;space.visits.moon=visits+1;space.voyage.completed=true;
  ledger.claimed=view.voyage.sequence;
  ledger.lastReceipt={voyageId:intent.voyageId,sequence:view.voyage.sequence,route:'moon',ruleset:view.voyage.ruleset,start:view.voyage.start,arrival:view.arrival,claimedAt:now,points,...(v2?{ev:view.event.id,choice:view.event.choice,outcome:view.event.outcome}:{})};space.moonLoop=ledger;
 }
 const next=copy(state);next.space=space;
 const checked=moonView(next,{scope,now});if(!checked.ok)return checked;
 return {ok:true,noop:false,state:next,view:checked};
}
