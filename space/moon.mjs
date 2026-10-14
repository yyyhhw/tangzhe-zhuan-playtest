/** Candidate-only moon rules. Pure host planner; no Storage, timers, UI results or wallet changes. */
import {readSpace} from './domain.mjs?v=takeover-20261014-r1';
// 杨总 2026-10-14 01:32「星途所有店铺35级就可以了」：全部店铺 Lv35+ 解锁。正式航程 10 分钟、每次 8 探索点。
export const MOON_RULES=Object.freeze({id:'xingtu-moon-10min-8pts-v1',route:'moon',duration:600000,points:8,minShopLevel:35});
export const spaceUnlocked=state=>Array.isArray(state?.shops)&&state.shops.length>0&&state.shops.every(s=>s?.open===true&&Number.isSafeInteger(s.lv)&&s.lv>=MOON_RULES.minShopLevel);
const copy=x=>JSON.parse(JSON.stringify(x)),own=(x,k)=>Object.hasOwn(x,k),int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const bad=code=>({ok:false,code}),MAX_TIME=8640000000000000;
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.sort().join('|');
export function parseVoyageId(id,scope){
 if(typeof id!=='string')return null;
 const m=id.match(/^moon:(formal|preview):([1-9][0-9]*):([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/);
 return m&&m[1]===scope&&int(Number(m[2]),1)?{seq:Number(m[2])}:null;
}
export function moonView(state,{scope,now}){
 if(!['formal','preview'].includes(scope))return bad('SPACE_SCOPE_INVALID');
 if(!int(now)||now>MAX_TIME)return bad('SPACE_TIME_INVALID');
 const read=readSpace(state);if(!read.ok)return read;
 const space=read.space,ledger=own(space,'moonLoop')?space.moonLoop:null,v=space.voyage;
 if(own(space,'moonLoop')){
  if(!ledger||ledger.schemaVersion!==1||!int(ledger.sequence)||!int(ledger.claimed)||ledger.claimed>ledger.sequence||!own(ledger,'lastReceipt'))return bad('SPACE_LEDGER_COMPATIBILITY');
  const r=ledger.lastReceipt;
  if(ledger.claimed===0?r!==null:(!keys(r,['voyageId','sequence','route','ruleset','start','arrival','claimedAt','points'])||r.sequence!==ledger.claimed||parseVoyageId(r.voyageId,scope)?.seq!==r.sequence||r.route!=='moon'||r.ruleset!==MOON_RULES.id||r.points!==MOON_RULES.points||!int(r.start)||!int(r.arrival)||r.arrival!==r.start+MOON_RULES.duration||!int(r.claimedAt)||r.claimedAt<r.arrival||r.claimedAt>MAX_TIME))return bad('SPACE_RECEIPT_COMPATIBILITY');
 }
 if(v!==null){
  if(!ledger||!int(v.sequence,1)||v.sequence!==ledger.sequence||parseVoyageId(v.voyageId,scope)?.seq!==v.sequence||v.route!=='moon'||v.ruleset!==MOON_RULES.id||v.dur!==MOON_RULES.duration||v.ev!==null||typeof v.completed!=='boolean'||!int(v.start)||v.start+v.dur>MAX_TIME)return bad('SPACE_VOYAGE_COMPATIBILITY');
  if(v.completed?(ledger.claimed!==v.sequence||ledger.lastReceipt?.voyageId!==v.voyageId||ledger.lastReceipt.start!==v.start||ledger.lastReceipt.arrival!==v.start+v.dur):(ledger.claimed!==v.sequence-1||ledger.lastReceipt&&ledger.lastReceipt.claimedAt>v.start))return bad('SPACE_VOYAGE_COMPATIBILITY');
  if(now<v.start)return bad('SPACE_TIME_BACKWARDS');
 }else if(ledger&&ledger.sequence!==0)return bad('SPACE_LEDGER_COMPATIBILITY');
 if(ledger?.lastReceipt&&now<ledger.lastReceipt.claimedAt)return bad('SPACE_TIME_BACKWARDS');
 const unlocked=spaceUnlocked(state);
 return {ok:true,unlocked,missing:read.missing,space:copy(space),ledger:copy(ledger),voyage:copy(v),receipt:copy(ledger?.lastReceipt??null),phase:v===null?'ready':v.completed?'report':now>=v.start+v.dur?'arrived':'flying',remaining:v&&!v.completed?Math.max(0,v.start+v.dur-now):0,arrival:v?v.start+v.dur:null,ruleset:MOON_RULES.id};
}
export function planMoon(state,intent,{scope,now,makeId}){
 const input=readSpace({intent});if(!input.ok)return bad('SPACE_INTENT_INVALID');
 const view=moonView(state,{scope,now});if(!view.ok)return view;
 if(!view.unlocked)return bad('SPACE_TECH_LEVEL_REQUIRED');
 const depart=keys(intent,['type','route'])&&intent.type==='depart'&&intent.route==='moon';
 const claim=keys(intent,['type','voyageId'])&&intent.type==='claim'&&typeof intent.voyageId==='string';
 if(!depart&&!claim)return bad('SPACE_INTENT_INVALID');
 const space=copy(view.space),ledger=copy(view.ledger??{schemaVersion:1,sequence:0,claimed:0,lastReceipt:null});
 if(depart){
  if(view.voyage&&!view.voyage.completed)return {ok:true,noop:true,code:'SPACE_ALREADY_IN_FLIGHT',view};
  if(ledger.sequence===Number.MAX_SAFE_INTEGER||now+MOON_RULES.duration>MAX_TIME)return bad('SPACE_OVERFLOW');
  if(typeof makeId!=='function')return bad('SPACE_ID_REQUIRED');
  const sequence=ledger.sequence+1,uuid=makeId(),voyageId=`moon:${scope}:${sequence}:${uuid}`;
  if(parseVoyageId(voyageId,scope)?.seq!==sequence)return bad('SPACE_ID_INVALID');
  ledger.sequence=sequence;space.moonLoop=ledger;
  space.voyage={...copy(space.voyage??{}),route:'moon',start:now,dur:MOON_RULES.duration,ev:null,voyageId,sequence,ruleset:MOON_RULES.id,completed:false};
 }else{
  const parsed=parseVoyageId(intent.voyageId,scope);
  if(!parsed)return bad('SPACE_VOYAGE_ID_INVALID');
  if(parsed.seq<=ledger.claimed)return {ok:true,noop:true,stale:true,receipt:ledger.lastReceipt?.voyageId===intent.voyageId?copy(ledger.lastReceipt):null,view};
  if(!view.voyage||intent.voyageId!==view.voyage.voyageId)return bad('SPACE_VOYAGE_ID_MISMATCH');
  if(view.phase!=='arrived')return bad('SPACE_NOT_ARRIVED');
  const visits=space.visits.moon??0;
  if(!int(visits)||space.pts>Number.MAX_SAFE_INTEGER-MOON_RULES.points||visits===Number.MAX_SAFE_INTEGER)return bad('SPACE_OVERFLOW');
  space.pts+=MOON_RULES.points;space.visits.moon=visits+1;space.voyage.completed=true;
  ledger.claimed=view.voyage.sequence;
  ledger.lastReceipt={voyageId:intent.voyageId,sequence:view.voyage.sequence,route:'moon',ruleset:MOON_RULES.id,start:view.voyage.start,arrival:view.arrival,claimedAt:now,points:MOON_RULES.points};space.moonLoop=ledger;
 }
 const next=copy(state);next.space=space;
 const checked=moonView(next,{scope,now});if(!checked.ok)return checked;
 return {ok:true,noop:false,state:next,view:checked};
}
