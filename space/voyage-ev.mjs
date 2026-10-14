/** 星途-113（星途-07 存档接入）骨架：航行事件 voyage.ev 字段 + 迁移。纯函数：不读写 Storage、不取时钟/随机数、不碰钱包。
 * 已接进 planMoon 规则 xingtu-moon-10min-ev-v2（新出航挂事件）；旧规则 xingtu-moon-10min-8pts-v1 的航程/回执仍是 ev:null，照旧读、照旧领 8 点。
 *
 * 存档形状（向后兼容 schema 1，不升 SPACE_SCHEMA_VERSION）：
 *   voyage.ev      null | 事件 ID 字符串（domain.validateSpace 早就允许这两种）
 *   voyage.evState 只在 ev 是字符串时出现：{schemaVersion:1,id,choice,outcome,resolvedAt,reward}
 *                  （voyage 上的未知扩展字段，普通 commit 原样保留、不能改，见 space/README.md）
 *   旧档：没有 space / voyage 为 null / ev 为 null（月面往返）→ 读作「这趟没有事件」，不需要也不会写盘。
 * 事件文案见下方 EVENTS（星途-07）。 */
import {readSpace} from './domain.mjs?v=xt11art-20261014-r1';
export const VOYAGE_EV_SCHEMA=1;
export const EVENT_IDS=Object.freeze(['ev_drift_pod','ev_meteor_rain','ev_pirates','ev_supply_low','ev_strange_signal','ev_alien_caravan']);
/** 星途-07 文案（王大妈 2/2，16:22）。按钮小字用「现在」版（星途-06 舱室等级未上）；hint06 留给 06 上线后换。
 * 数值（熊大未定，取 demo 保守值）：基础 8 点；A 成功 ×1.5=12、失败 ×0.75=6；B「照常」=8、「少拿一点」×0.9=7。 */
export const EVENTS=Object.freeze({
  ev_drift_pod:{name:'漂流舱求救',situation:'雷达上亮起一个求救信号，是一只小小的漂流舱。',
    a:{label:'救人',hint:'有六成把握，没救成会少拿一点',hint06:'珍珠姐的医疗舱越强越稳',chance:60,pts:12,failPts:6},
    b:{label:'记下坐标',hint:'不冒险，照常返航',pts:8},
    success:'救上来的是隔壁星系的外卖员，塞给你一大袋探索记录。',fail:'舱里只有一只猫。猫也上船了，还把探索记录踩乱了几页。',bText:'坐标记下了，飞船照常往家开。'},
  ev_meteor_rain:{name:'陨石雨',situation:'前方一大片陨石，正好横在航线上。',
    a:{label:'开炮清路',hint:'有六成把握',hint06:'阿宅的战斗舱越强越稳',chance:60,pts:12,failPts:6},
    b:{label:'绕远路',hint:'稳妥，探索点少拿一点',pts:7},
    success:'阿宅一炮一个，打出了名场面。',fail:'船身被砸了几个坑，掉了一点货。',bText:'绕了一大圈，平安到家。'},
  ev_pirates:{name:'海盗拦截',situation:'一艘挂着骷髅奶茶杯旗子的船靠了过来。',
    a:{label:'打',hint:'有六成把握',hint06:'阿宅的战斗舱越强越稳',chance:60,pts:12,failPts:6},
    b:{label:'交过路费',hint:'稳妥，探索点少拿一点',pts:7},
    success:'海盗跑了，还落下一箱星图。',fail:'货被抢走一部分，好在人都没事。',bText:'交了过路费，对方还挥手说欢迎下次光临。'},
  ev_supply_low:{name:'补给见底',situation:'冰箱里只剩两包泡面和一瓶辣椒油。',
    a:{label:'省着吃',hint:'有六成把握',hint06:'77 的生活舱越强越稳',chance:60,pts:12,failPts:6},
    b:{label:'临时停靠补给',hint:'稳妥，探索点少拿一点',pts:7},
    success:'77 用两包泡面做出了四人份宵夜，大家精神十足。',fail:'大家饿着肚子，干活都慢了半拍。',bText:'在补给站囤了一箱吃的，吃饱再上路。'},
  ev_strange_signal:{name:'奇怪的信号',situation:'频道里传来一段有节奏的哔哔声。',
    a:{label:'解码',hint:'有六成把握',hint06:'火箭老板的科技舱越强越稳',chance:60,pts:12,failPts:6},
    b:{label:'当没听见',hint:'什么也不发生',pts:8},
    success:'解出来是一张星图，多标了好几个点。',fail:'解了半天，原来是某颗卫星在放广告。',bText:'哔哔声慢慢远了，飞船继续往前。'},
  ev_alien_caravan:{name:'外星商队',situation:'一支外星商队挥着触手，想跟你做生意。',
    a:{label:'做生意',hint:'换一笔探索点',chance:100,pts:8,failPts:8},
    b:{label:'合个影',hint:'多拿一点探索点',pts:10},
    success:'外星人很喜欢四家店的东西，用一大袋探索记录做了交换。',fail:'',bText:'四个人和外星人拍了张合影，照片背面写着一串坐标。'}
});
export const EVENT_POOL=Object.freeze(EVENT_IDS.filter(id=>id!=='ev_alien_caravan'));
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
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;};
/** 出航时给航程挂事件（planMoon 的 xingtu-moon-10min-ev-v2 调用）。确定性：由 voyageId（含出航时的随机 UUID）推出事件，刷新不重抽。
 * 默认只抽 EVENT_POOL（不含外星商队：频率熊大未定 + 它的 A 是金币，113 只发探索点）。 */
export function pickEvent(voyageId,pool=EVENT_POOL){
  if(typeof voyageId!=='string'||!voyageId||!Array.isArray(pool)||!pool.length)return null;
  return pool[fnv(voyageId)%pool.length];
}
/** 选 A 的成败：由 voyageId+选择确定（六成把握）；先算出、和选择同一笔写进存档，再给玩家看。选 B / 外星商队永远 success。 */
export function outcomeFor(voyageId,id,choice){
  if(choice==='b'||id==='ev_alien_caravan')return 'success';
  return fnv(`${voyageId}|${id}|a`)%100<EVENTS[id].a.chance?'success':'fail';
}
/** 本趟最终探索点（113 只发探索点；金币/剧情卡/隐藏物留给星途-114）。 */
export function rewardPoints(id,choice,outcome){
  const e=EVENTS[id];if(!e||!CHOICES.includes(choice)||!OUTCOMES.includes(outcome))return null;
  if(choice==='b')return e.b.pts;
  return outcome==='success'?e.a.pts:e.a.failPts;
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
