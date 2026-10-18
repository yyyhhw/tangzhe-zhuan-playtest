/** First-event ledger. Pure: no storage, clock, wallet, lock or gameplay mutation. */
export const EVENTS=Object.freeze([
 ['firstShop','开张第一家店','77烧烤摊，炭火点着了。','shop'],
 ['firstEmployee','雇来第一个员工','从此躺着也能赚。','staff'],
 ['firstBox','第一次开盲盒','手气怎么样，只有你自己知道。','box'],
 ['teaShop','开张奶茶店','珍珠姐加入，账目从此算得清清楚楚。','tea'],
 ['firstZombie','第一次打僵尸','烧烤摊夜里也不太平。','zombie'],
 ['bookShop','开张漫画书店','阿宅店长加入，书架开始变满。','book'],
 ['techShop','开张摸鱼科技公司','写字楼里的灯，比烧烤摊熄得还晚。','rocket'],
 ['rocketJoined','火箭老板加入','他自己找上门来了。','rocket'],
 ['firstTDWin','第一次保卫奶茶成功','奶茶保住了。','shield'],
 ['shopsReady','四家店达到星途门槛','发射台的灯亮了。','rocket'],
 ['firstVoyage','第一次出航','向太空出发。','rocket'],
 ['firstStory','第一张剧情卡','星途故事开始了。','book'],
 ['firstAlien','第一位外星朋友','原来宇宙里也有人爱吃烧烤。','stars'],
 ['firstHidden','第一件隐藏物','你开始翻宇宙的抽屉了。','box'],
 ['firstResearch','第一个科研成果','飞船里多了一件新成果。','stars'],
 ['reply','收到回信','一条亮着灯的街。','mail'],
 ['earth','买下地球','这一格，画大一点。','earth']
].map(Object.freeze));
const ids=new Set(EVENTS.map(e=>e[0]));
const own=(v,k)=>Object.hasOwn(v,k),obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const validTime=v=>Number.isSafeInteger(v)&&v>=0&&v<=8640000000000000;
export function validMilestones(state){
 if(!own(state,'milestones'))return true;
 const m=state.milestones;
 return obj(m)&&Object.keys(m).sort().join('|')==='events|schemaVersion'&&m.schemaVersion===1&&obj(m.events)&&Object.entries(m.events).every(([id,t])=>ids.has(id)&&(t===null||validTime(t)));
}
/** Persisted legacy participation evidence; dates are never inferred from scores. */
export function evidence(s,{minShopLevel}){
 const shops=s.shops??[],sp=s.space??{},positive=v=>Number.isSafeInteger(v)&&v>0,any=v=>Object.values(v??{}).some(positive);
 return {
  firstShop:shops[0]?.open===true,firstEmployee:shops.some(x=>positive(x.emp)),firstBox:positive(s.gacha?.draws),
  teaShop:shops[1]?.open===true,firstZombie:positive(s.zombie?.cleared)||positive(s.zombie?.best)||(s.zombie?.endBest?.t>0),bookShop:shops[2]?.open===true,techShop:shops[3]?.open===true,
  rocketJoined:s.ceos?.rocket?.unlocked===true,firstTDWin:positive(s.td?.cleared)||positive(s.td50?.cleared)||positive(s.tdCampaign?.highestCleared),
  shopsReady:shops.length===4&&shops.every(x=>x.open===true&&Number.isSafeInteger(x.lv)&&x.lv>=minShopLevel),
  firstVoyage:positive(sp.moonLoop?.sequence)||!!sp.voyage||any(sp.visits),firstStory:any(sp.cards),firstAlien:positive(sp.alienCards),
  firstHidden:Object.values(sp.hidden??{}).some(x=>x===true),firstResearch:any(sp.items),reply:sp.ended===true,earth:sp.earth===true
 };
}
/** Called only on an already authorized candidate, before its existing atomic write.
 * Existing evidence is null (unknown date); only false→true gets a timestamp.
 * Caller must reject edits to the previous ledger, then use this returned value.
 */
export function recordTransition(before,after,now,rules,{zombieStarted=false}={}){
 if(!validMilestones(before)||!validMilestones(after))throw Error('MILESTONES_INVALID');
 const a=evidence(before,rules),b=evidence(after,rules),events={...(before.milestones?.events??{})};
 for(const [id] of EVENTS){
  if(own(events,id))continue;
  if(a[id])events[id]=null;
  else if(b[id]||(id==='firstZombie'&&zombieStarted))events[id]=(id!=='firstZombie'||zombieStarted)&&validTime(now)&&(!validTime(after.created)||now>=after.created)?now:null;
 }
 return {schemaVersion:1,events};
}
export function newGameMilestones(now){
 if(!validTime(now))throw Error('MILESTONES_TIME_INVALID');
 return {schemaVersion:1,events:{firstShop:now}};
}
// 体验-158：不到 1 天不写「0 天」，不到 1 小时写「不到 1 小时」；文案-167：整天不写「0 小时」。
const spent=ms=>{const d=Math.floor(ms/86400000),h=Math.floor(ms/3600000)%24;return d?(h?`用了 ${d} 天 ${h} 小时`:`用了 ${d} 天`):h?`用了 ${h} 小时`:'用了不到 1 小时';};
export function recap(state,rules){
 const known=evidence(state,rules),saved=validMilestones(state)?state.milestones?.events??{}:{};
 const rows=EVENTS.flatMap(([id,title,description,icon])=>{
  if(!own(saved,id)&&!known[id])return [];
  const at=own(saved,id)?saved[id]:null;
  const elapsed=at!==null&&validTime(state.created)&&at>=state.created?at-state.created:null;
  const when=at===null?'记录开始之前':elapsed===null?'已记录':elapsed<86400000?`开局 ${Math.floor(elapsed/3600000)} 小时`:`开局第 ${Math.floor(elapsed/86400000)+1} 天`;
  return [{id,title:id==='shopsReady'?`四家店都到了 Lv${rules.minShopLevel}`:title,description,icon,at,when}];
 });
 const dates=rows.filter(r=>r.at!==null).map(r=>r.at),end=saved.earth;
 // A historical Earth purchase has no endpoint: never substitute today's date.
 const duration=validTime(end)&&dates.length?end-Math.min(...dates):null;
 const total=duration===null?'早期没记时间，总用时就不算了':`从有记录起，你${spent(duration)}，买下了整个地球。`;
 return {rows,total,duration};
}
