/** 星途-113（星途-07 存档接入）骨架：航行事件 voyage.ev 字段 + 迁移。纯函数：不读写 Storage、不取时钟/随机数、不碰钱包。
 * 还没接进 planMoon / host / overlay：月面往返（xingtu-moon-10min-8pts-v1）仍然只写 ev:null，现有 space 存档语义不变。
 *
 * 存档形状（向后兼容 schema 1，不升 SPACE_SCHEMA_VERSION）：
 *   voyage.ev      null | 事件 ID 字符串（domain.validateSpace 早就允许这两种）
 *   voyage.evState 只在 ev 是字符串时出现：{schemaVersion:1,id,choice,outcome,resolvedAt,reward}
 *                  （voyage 上的未知扩展字段，普通 commit 原样保留、不能改，见 space/README.md）
 *   旧档：没有 space / voyage 为 null / ev 为 null（月面往返）→ 读作「这趟没有事件」，不需要也不会写盘。
 * 事件文案、选项数值、奖励、概率等王大妈 17:30 星途-07 稿后再定；这里的 ID 只是 6 种事件的占位（对照 demo EVENTS + ALIEN_EVENT）。 */
import {readSpace} from './domain.mjs?v=sfx111-20261014-r1';
export const VOYAGE_EV_SCHEMA=1;
export const EVENT_IDS=Object.freeze(['ev_drift_pod','ev_meteor_rain','ev_pirates','ev_supply_low','ev_strange_signal','ev_alien_caravan']);
export const CHOICES=Object.freeze(['a','b']);
export const OUTCOMES=Object.freeze(['success','fail']);
const own=(x,k)=>Object.hasOwn(x,k),obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const copy=x=>JSON.parse(JSON.stringify(x)),bad=code=>({ok:false,code});
const EV_KEYS=['schemaVersion','id','choice','outcome','resolvedAt','reward'];
/** 奖励只允许已有 space 字段能落的东西：探索点 / 剧情卡进度 / 隐藏物（星途-08 才会用到 cards/hidden）。 */
function validReward(r){
  if(r===null)return true;
  if(!obj(r)||Object.keys(r).some(k=>!['pts','cards','hidden'].includes(k)))return false;
  if(own(r,'pts')&&!int(r.pts))return false;
  if(own(r,'cards')&&!(obj(r.cards)&&Object.values(r.cards).every(v=>int(v,1))))return false;
  if(own(r,'hidden')&&!(Array.isArray(r.hidden)&&r.hidden.every(x=>typeof x==='string'&&x.length>0&&x.length<=160)))return false;
  return true;
}
export function defaultEvState(id){return {schemaVersion:VOYAGE_EV_SCHEMA,id,choice:null,outcome:null,resolvedAt:null,reward:null};}
/** 读一趟航程的事件。旧档/月面往返 ev:null → {event:null}；坏数据只读拒绝，从不清洗。 */
export function readVoyageEv(voyage){
  if(voyage===null||voyage===undefined)return {ok:true,event:null};
  if(!obj(voyage)||!own(voyage,'ev'))return bad('SPACE_EV_VOYAGE_INVALID');
  const ev=voyage.ev;
  if(ev===null)return own(voyage,'evState')?bad('SPACE_EV_STATE_WITHOUT_EVENT'):{ok:true,event:null};
  if(typeof ev!=='string')return bad('SPACE_EV_INVALID');
  if(!EVENT_IDS.includes(ev))return bad('SPACE_EV_UNKNOWN_READ_ONLY');// 未来事件：只读，不猜
  if(!own(voyage,'evState'))return {ok:true,event:{id:ev,state:defaultEvState(ev),implicit:true}};// 只有事件 ID、还没状态：按未选择读
  const s=voyage.evState;
  if(!obj(s)||Object.keys(s).sort().join('|')!==[...EV_KEYS].sort().join('|'))return bad('SPACE_EV_STATE_INVALID');
  if(s.schemaVersion!==VOYAGE_EV_SCHEMA)return bad('SPACE_EV_VERSION_READ_ONLY');
  if(s.id!==ev)return bad('SPACE_EV_STATE_MISMATCH');
  const open=s.choice===null&&s.outcome===null&&s.resolvedAt===null&&s.reward===null;
  const done=CHOICES.includes(s.choice)&&OUTCOMES.includes(s.outcome)&&int(s.resolvedAt)&&validReward(s.reward);
  if(!open&&!done)return bad('SPACE_EV_STATE_INVALID');
  return {ok:true,event:{id:ev,state:copy(s),implicit:false}};
}
/** 整份存档的事件视图（经 domain.readSpace，同一套 JSON/只读规则）。 */
export function readSpaceEv(state){
  const r=readSpace(state);if(!r.ok)return r;
  const e=readVoyageEv(r.space.voyage);if(!e.ok)return e;
  return {ok:true,missing:r.missing,event:e.event};
}
/** 迁移提议：旧档一律原样（没有事件就不写 evState），只把「有事件 ID 无状态」补成显式未选择状态。不改调用方、幂等。 */
export function migrateVoyageEv(state){
  const r=readSpaceEv(state);if(!r.ok)return r;
  if(!r.event||!r.event.implicit)return {ok:true,changed:false,state:copy(state)};
  const next=copy(state);next.space.voyage.evState=defaultEvState(r.event.id);
  return {ok:true,changed:true,state:next};
}
/** 出航时给航程挂事件（以后由 planMoon 的新规则版本调用）。确定性：由 voyageId 推出事件，不取随机数。 */
export function pickEvent(voyageId){
  if(typeof voyageId!=='string'||!voyageId)return null;
  let h=2166136261;for(let i=0;i<voyageId.length;i++){h^=voyageId.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return EVENT_IDS[h%EVENT_IDS.length];
}
export function attachEvent(voyage,id){
  if(!obj(voyage)||voyage.ev!==null||own(voyage,'evState'))return bad('SPACE_EV_ALREADY_SET');
  if(!EVENT_IDS.includes(id))return bad('SPACE_EV_UNKNOWN');
  return {ok:true,voyage:{...copy(voyage),ev:id,evState:defaultEvState(id)}};
}
/** 玩家在事件里选一次。只记结果，不发奖励（奖励入账留给后续 planMoon 规则在同一笔私有事务里做）。已选过 → noop。 */
export function resolveEvent(voyage,{choice,outcome,reward=null,now}){
  const e=readVoyageEv(voyage);if(!e.ok)return e;if(!e.event)return bad('SPACE_EV_NONE');
  if(e.event.state.choice!==null)return {ok:true,noop:true,voyage:copy(voyage)};
  if(!CHOICES.includes(choice)||!OUTCOMES.includes(outcome)||!int(now)||!validReward(reward))return bad('SPACE_EV_RESOLVE_INVALID');
  return {ok:true,noop:false,voyage:{...copy(voyage),evState:{schemaVersion:VOYAGE_EV_SCHEMA,id:e.event.id,choice,outcome,resolvedAt:now,reward:reward===null?null:copy(reward)}}};
}
