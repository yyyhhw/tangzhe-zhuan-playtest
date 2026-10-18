/** Candidate-only moon rules. Pure host planner; no Storage, timers, UI results or wallet changes. */
import {readSpace} from './domain.mjs?v=xingtu135-20261015-r1';
import {ROUTE_BY_ID,albumOk,awardFor,applyAward} from './album.mjs?v=xingtu135-20261015-r1';
import {gate} from './xingtu-views.mjs?v=copy04-20261018-r1';
import {EVENT_IDS,readVoyageEv,pickEvent,defaultEvState,resolveEvent,outcomeFor,rewardPoints} from './voyage-ev.mjs?v=xingtu135-20261015-r1';
// 杨总 2026-10-14 01:32「星途所有店铺35级就可以了」：全部店铺 Lv35+ 解锁。正式航程 10 分钟、每次 8 探索点。
export const MOON_RULES=Object.freeze({id:'xingtu-moon-10min-8pts-v1',route:'moon',duration:600000,points:8,minShopLevel:35});
// 星途-113：新规则版本，新出航一律挂一件返航事件（星途-07）。旧 v1 航程/回执照旧可读可领（8 点、ev:null）。
export const MOON_EV_RULES=Object.freeze({id:'xingtu-moon-10min-ev-v2',route:'moon',duration:600000,points:8,minShopLevel:35});
// 星途 v2-A（杨总 22:27 / 王大妈 22:30）：多航线 + 科研升级。月面照旧走 v2 规则；其它航线新规则 v3（时长按圈，探索点 = 事件点 × 航线倍数）。
export const ROUTE_RULES=Object.freeze({id:'xingtu-routes-v3',dur:Object.freeze({station:1800000,mars:3600000,venus:3600000,belt:7200000,pirate:7200000,europa:14400000,saturn:14400000,signal:28800000}),mult:Object.freeze({station:1,mars:2.5,venus:2.5,belt:5,pirate:5,europa:10,saturn:10,signal:20})});
export const ROUTE_IDS=Object.freeze(['moon',...Object.keys(ROUTE_RULES.dur)]);
export const LV_COST=Object.freeze([20,60,150,400]);// 科研 1→2 … 4→5 花的探索点（demo LV_COST）
export const SYS_KEYS=Object.freeze(['tech','war','med','life']);
const durOf=(route,ruleset)=>ruleset===ROUTE_RULES.id?ROUTE_RULES.dur[route]:route==='moon'&&ruleset!==ROUTE_RULES.id?MOON_RULES.duration:undefined;
export const routePoints=(route,ev,choice,outcome)=>{const p=rewardPoints(ev,choice,outcome);return p===null?null:route==='moon'?p:Math.round(p*ROUTE_RULES.mult[route]);};
const RULESETS=[MOON_RULES.id,MOON_EV_RULES.id,ROUTE_RULES.id];
// 星途 v2-B（杨总 22:28 steering）：科研成果用金币买，每个岗位 5 件升满合计正好 1000 亿，四岗 4000 亿；按 demo 曲线每档 ×10（1:10:100:1000:10000）。
// 一件一买（不抽卡），买第 t 件要该岗位科研 ≥ t 级。最后一档吸收取整误差，保证合计精确。
export const RESEARCH_TOTAL_PER_POST=1e11;
export const TIER_PRICE=Object.freeze((()=>{const w=[1,10,100,1000,10000],W=11111,p=w.map(x=>Math.round(RESEARCH_TOTAL_PER_POST*x/W));p[4]=RESEARCH_TOTAL_PER_POST-p[0]-p[1]-p[2]-p[3];return p;})());
const ITEM_RE=/^(tech|war|med|life):([1-5])$/;
/** 两份 space 之间买科研成果花了多少金币：只允许新增 'sys:t'=1；删、改、未知 key 一律 null（不是科研购买）。 */
// 星途 v2-D：买下地球 = 10 万亿（1e13；杨总 2026-10-15 09:34 由 1000 万亿 1e15 改），只能在收到回信（ended）之后买一次。金币上限 COIN_CAP 仍是 1e15。
export const EARTH_PRICE=1e13;
export function researchSpend(prev,next){
 const a=prev?.items??{},b=next?.items??{};let sum=0;
 if(prev?.earth===true&&next?.earth!==true)return null;
 if(prev?.earth!==true&&next?.earth===true)sum+=EARTH_PRICE;
 for(const k of Object.keys(a))if(b[k]!==a[k])return null;
 for(const k of Object.keys(b)){if(Object.hasOwn(a,k))continue;const m=k.match(ITEM_RE);if(!m||b[k]!==1)return null;sum+=TIER_PRICE[Number(m[2])-1];}
 return sum;
}
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
// 星途-114：114 起每次领取都在回执里记本趟发的剧情卡（第几张 | null）和隐藏物（航线 id | null）。113 及更早的回执没有这两项，照旧有效。
const AW=['card','hidden'];
function awardOk(r,space){
 if(!own(r,'card'))return !own(r,'hidden');
 const total=ROUTE_BY_ID[r.route]?.cards.length??0,got=space.cards?.[r.route]??0;
 return (r.card===null||(int(r.card,1)&&r.card<=total&&r.card<=got))&&(r.hidden===null||(r.hidden===r.route&&space.hidden?.[r.route]===true));
}
function receiptOk(r,ledger,scope,space){
 if(!r||typeof r!=='object'||!RULESETS.includes(r.ruleset))return false;
 const v2=r.ruleset!==MOON_RULES.id,base=v2?[...R2]:[...R1];
 if(!(keys(r,[...base])||keys(r,[...base,...AW]))||!awardOk(r,space)||r.sequence!==ledger.claimed||parseVoyageId(r.voyageId,scope)?.seq!==r.sequence||!ROUTE_IDS.includes(r.route)||(r.route==='moon')===(r.ruleset===ROUTE_RULES.id)||!int(r.start)||!int(r.arrival)||r.arrival!==r.start+durOf(r.route,r.ruleset)||!int(r.claimedAt)||r.claimedAt<r.arrival||r.claimedAt>MAX_TIME)return false;
 if(!v2)return r.points===MOON_RULES.points;
 return EVENT_IDS.includes(r.ev)&&r.outcome===outcomeFor(r.voyageId,r.ev,r.choice)&&r.points===routePoints(r.route,r.ev,r.choice,r.outcome);
}
// v2 航程事件：必须有显式 evState；已选 → 成败/奖励必须和确定性规则一致（坏档只读，不猜不洗）。
function voyageEvOk(v,arrival){
 if(v.ruleset===MOON_RULES.id)return v.ev===null&&!own(v,'evState')?{event:null}:null;
 const e=readVoyageEv(v);if(!e.ok||!e.event||e.event.implicit)return null;
 const st=e.event.state;
 if(st.choice!==null){const pts=routePoints(v.route,st.id,st.choice,st.outcome);if(st.outcome!==outcomeFor(v.voyageId,st.id,st.choice)||!keys(st.reward,['pts'])||st.reward.pts!==pts||st.resolvedAt<arrival)return null;}
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
  if(ledger.claimed===0?r!==null:!receiptOk(r,ledger,scope,space))return bad('SPACE_RECEIPT_COMPATIBILITY');
 }
 if(v!==null){
  if(!ledger||!int(v.sequence,1)||v.sequence!==ledger.sequence||parseVoyageId(v.voyageId,scope)?.seq!==v.sequence||!ROUTE_IDS.includes(v.route)||!RULESETS.includes(v.ruleset)||v.dur!==durOf(v.route,v.ruleset)||!voyageEvOk(v,v.start+v.dur)||typeof v.completed!=='boolean'||!int(v.start)||v.start+v.dur>MAX_TIME)return bad('SPACE_VOYAGE_COMPATIBILITY');
  if(v.completed?(ledger.claimed!==v.sequence||ledger.lastReceipt?.voyageId!==v.voyageId||ledger.lastReceipt.start!==v.start||ledger.lastReceipt.arrival!==v.start+v.dur||ledger.lastReceipt.ruleset!==v.ruleset||(v.ruleset!==MOON_RULES.id&&(v.evState.choice===null||ledger.lastReceipt.ev!==v.ev||ledger.lastReceipt.choice!==v.evState.choice||ledger.lastReceipt.outcome!==v.evState.outcome||ledger.lastReceipt.points!==v.evState.reward.pts||v.evState.resolvedAt>ledger.lastReceipt.claimedAt))):(ledger.claimed!==v.sequence-1||ledger.lastReceipt&&ledger.lastReceipt.claimedAt>v.start))return bad('SPACE_VOYAGE_COMPATIBILITY');
  if(now<v.start)return bad('SPACE_TIME_BACKWARDS');
 }else if(ledger&&ledger.sequence!==0)return bad('SPACE_LEDGER_COMPATIBILITY');
 if(ledger?.lastReceipt&&now<ledger.lastReceipt.claimedAt)return bad('SPACE_TIME_BACKWARDS');
 if(!albumOk(space))return bad('SPACE_ALBUM_COMPATIBILITY');
 const unlocked=spaceUnlocked(state),ev=v?voyageEvOk(v,v.start+v.dur).event:null;
 if(ev&&ev.resolvedAt!==null&&now<ev.resolvedAt)return bad('SPACE_TIME_BACKWARDS');
 const award=v&&!v.completed?awardFor(space,v.route):null;
 return {ok:true,award,event:ev?copy(ev):null,needsChoice:!!(ev&&ev.choice===null&&v&&!v.completed),unlocked,missing:read.missing,space:copy(space),ledger:copy(ledger),voyage:copy(v),receipt:copy(ledger?.lastReceipt??null),phase:v===null?'ready':v.completed?'report':now>=v.start+v.dur?'arrived':'flying',remaining:v&&!v.completed?Math.max(0,v.start+v.dur-now):0,arrival:v?v.start+v.dur:null,ruleset:v?v.ruleset:MOON_EV_RULES.id};
}
export function planMoon(state,intent,{scope,now,makeId,hiddenRules}){
 const input=readSpace({intent});if(!input.ok)return bad('SPACE_INTENT_INVALID');
 const view=moonView(state,{scope,now});if(!view.ok)return view;
 if(!view.unlocked)return bad('SPACE_TECH_LEVEL_REQUIRED');
 const depart=keys(intent,['type','route'])&&intent.type==='depart'&&ROUTE_IDS.includes(intent.route);
 const upgrade=keys(intent,['type','sys'])&&intent.type==='upgrade'&&SYS_KEYS.includes(intent.sys);
 const earth=keys(intent,['type'])&&intent.type==='earth';
 const research=keys(intent,['type','sys','tier'])&&intent.type==='research'&&SYS_KEYS.includes(intent.sys)&&[1,2,3,4,5].includes(intent.tier);
 const claim=keys(intent,['type','voyageId'])&&intent.type==='claim'&&typeof intent.voyageId==='string';
 const choose=keys(intent,['type','voyageId','choice'])&&intent.type==='choose'&&typeof intent.voyageId==='string'&&['a','b'].includes(intent.choice);
 if(!depart&&!claim&&!choose&&!upgrade&&!research&&!earth)return bad('SPACE_INTENT_INVALID');
 const space=copy(view.space),ledger=copy(view.ledger??{schemaVersion:1,sequence:0,claimed:0,lastReceipt:null});
 let coins=null;
 if(earth){
  if(space.earth)return {ok:true,noop:true,code:'SPACE_EARTH_OWNED',view};
  if(!space.ended)return bad('SPACE_ENDING_REQUIRED');
  if(!(Number.isSafeInteger(state.coins)&&state.coins>=EARTH_PRICE))return bad('SPACE_COINS_NOT_ENOUGH');
  space.earth=true;coins=state.coins-EARTH_PRICE;
 }else if(research){
  const key=`${intent.sys}:${intent.tier}`,price=TIER_PRICE[intent.tier-1];
  if(space.items[key])return {ok:true,noop:true,code:'SPACE_RESEARCH_OWNED',view};
  if(space.lv[intent.sys]<intent.tier)return bad('SPACE_RESEARCH_LV_REQUIRED');
  if(!(Number.isSafeInteger(state.coins)&&state.coins>=price))return bad('SPACE_COINS_NOT_ENOUGH');
  space.items[key]=1;coins=state.coins-price;
 }else if(upgrade){
  // 科研升级：花探索点，1→5 级；飞行中也能升（demo 同）。不动航程/回执。
  const lv=space.lv[intent.sys];if(!int(lv,1))return bad('SPACE_INTENT_INVALID');
  if(lv>=5)return {ok:true,noop:true,code:'SPACE_LV_MAX',view};
  const cost=LV_COST[lv-1];if(space.pts<cost)return bad('SPACE_PTS_NOT_ENOUGH');
  space.pts-=cost;space.lv[intent.sys]=lv+1;
 }else if(depart){
  if(view.voyage&&!view.voyage.completed)return {ok:true,noop:true,code:'SPACE_ALREADY_IN_FLIGHT',view};
  // 出航需要四个岗位科研（圈最低级 + 合计 + 短板），月面也查
  if(!gate(space,intent.route).ok)return bad('SPACE_POSTS_REQUIRED');
  if(ledger.sequence===Number.MAX_SAFE_INTEGER||now+MOON_RULES.duration>MAX_TIME)return bad('SPACE_OVERFLOW');
  if(typeof makeId!=='function')return bad('SPACE_ID_REQUIRED');
  const sequence=ledger.sequence+1,uuid=makeId(),voyageId=`moon:${scope}:${sequence}:${uuid}`;
  if(parseVoyageId(voyageId,scope)?.seq!==sequence)return bad('SPACE_ID_INVALID');
  ledger.sequence=sequence;space.moonLoop=ledger;
  const ev=pickEvent(voyageId);if(!ev)return bad('SPACE_EV_UNKNOWN');
  const base=copy(space.voyage??{});delete base.evState;// 上一趟的事件状态不带进新航程；其它未知扩展照旧保留
  const moon=intent.route==='moon',ruleset=moon?MOON_EV_RULES.id:ROUTE_RULES.id,dur=durOf(intent.route,ruleset);
  if(now+dur>MAX_TIME)return bad('SPACE_OVERFLOW');
  space.voyage={...base,route:intent.route,start:now,dur,ev,evState:defaultEvState(ev),voyageId,sequence,ruleset,completed:false};
 }else if(choose){
  const parsed=parseVoyageId(intent.voyageId,scope);
  if(!parsed)return bad('SPACE_VOYAGE_ID_INVALID');
  if(parsed.seq<=ledger.claimed)return {ok:true,noop:true,stale:true,code:'SPACE_EV_ALREADY_CLAIMED',view};
  if(!view.voyage||intent.voyageId!==view.voyage.voyageId)return bad('SPACE_VOYAGE_ID_MISMATCH');
  if(view.phase!=='arrived')return bad('SPACE_NOT_ARRIVED');
  if(!view.event)return bad('SPACE_EV_NONE');
  if(view.event.choice!==null)return {ok:true,noop:true,code:'SPACE_EV_ALREADY_CHOSEN',view};// 已选过：只读，绝不重掷
  const outcome=outcomeFor(intent.voyageId,view.event.id,intent.choice),pts=routePoints(view.voyage.route,view.event.id,intent.choice,outcome);
  const r=resolveEvent(space.voyage,{choice:intent.choice,outcome,reward:{pts},now});if(!r.ok)return r;
  space.voyage=r.voyage;
 }else{
  const parsed=parseVoyageId(intent.voyageId,scope);
  if(!parsed)return bad('SPACE_VOYAGE_ID_INVALID');
  if(parsed.seq<=ledger.claimed)return {ok:true,noop:true,stale:true,receipt:ledger.lastReceipt?.voyageId===intent.voyageId?copy(ledger.lastReceipt):null,view};
  if(!view.voyage||intent.voyageId!==view.voyage.voyageId)return bad('SPACE_VOYAGE_ID_MISMATCH');
  if(view.phase!=='arrived')return bad('SPACE_NOT_ARRIVED');
  if(view.needsChoice)return bad('SPACE_EV_CHOICE_REQUIRED');
  const v2=view.voyage.ruleset!==MOON_RULES.id,points=v2?view.event.reward.pts:MOON_RULES.points,route=view.voyage.route;
  const visits=space.visits[route]??0;
  if(!int(visits)||space.pts>Number.MAX_SAFE_INTEGER-points||visits===Number.MAX_SAFE_INTEGER)return bad('SPACE_OVERFLOW');
  // 星途-114：剧情卡/隐藏物和探索点、回执在同一笔私有写里落盘；按已发张数推进，同一张卡/同一件隐藏物不可能发两次。
  const award=awardFor(space,route,hiddenRules),awarded=applyAward(space,route,award);if(!awarded)return bad('SPACE_OVERFLOW');
  for(const k of ['cards','hidden','alienCards'])space[k]=awarded[k];
  space.pts+=points;space.visits[route]=visits+1;if(route==='signal')space.ended=true;/* 收到回信 = 结局 */space.voyage.completed=true;
  ledger.claimed=view.voyage.sequence;
  ledger.lastReceipt={voyageId:intent.voyageId,sequence:view.voyage.sequence,route,ruleset:view.voyage.ruleset,start:view.voyage.start,arrival:view.arrival,claimedAt:now,points,...(v2?{ev:view.event.id,choice:view.event.choice,outcome:view.event.outcome}:{}),card:award.card,hidden:award.hidden};space.moonLoop=ledger;
 }
 const next=copy(state);next.space=space;if(coins!==null)next.coins=coins;
 const checked=moonView(next,{scope,now});if(!checked.ok)return checked;
 return {ok:true,noop:false,state:next,view:checked};
}
