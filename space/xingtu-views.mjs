// 星途 v2 第一批：星图（5 圈 9 航线 + 出航需要四个岗位科研）与飞船（四个舱室）——只读，不写存档。
// 画面与数值直接搬自王大妈 demo（wangdama/xingtu-demo、xingtu-4post-mock fd614ae）。
import * as A from './xingtu-art.mjs?v=xingtuv2-1-20261014-r1';
export const RING_MIN=A.RING_MIN,RING_SUM=A.RING_SUM,ORDER=A.ORDER,POST=A.POST;
export const OPEN_NOW=['moon'];
const LVK=['tech','war','med','life'];
function demoState(space,sel){
 const lv={};for(const k of LVK){const v=space?.lv?.[k];lv[k]=Number.isInteger(v)&&v>=1?Math.min(5,v):1;}
 const items={};for(const [k,v] of Object.entries(space?.items??{}))if(Number.isInteger(v)&&v>=1)items[k]=v;
 return {lv,items,cards:{},hidden:{...(space?.hidden??{})},visits:{...(space?.visits??{})},wins:0,voyage:null,sel};
}
export const routeOf=id=>A.DEMO_ROUTES.find(r=>r.id===id);
// 每个岗位这条航线需要的科研等级：圈的最低级、短板、终点要求，取最大
export function needOf(route,k){return Math.max(RING_MIN[route.ring],route.need&&route.need[0]===k?route.need[1]:0,route.needAll||0);}
export function gate(space,id){
 const r=routeOf(id),S=demoState(space,id),lv=S.lv,total=LVK.reduce((a,k)=>a+lv[k],0);
 const posts=ORDER.map(k=>({k,post:POST[k],ceo:A.SYSK[k].ceo,sys:A.SYSK[k].sys,lv:lv[k],need:needOf(r,k),ok:lv[k]>=needOf(r,k)}));
 const sumOk=total>=RING_SUM[r.ring],ok=posts.every(p=>p.ok)&&sumOk;
 const lack=posts.filter(p=>!p.ok).map(p=>`${p.post}（${p.ceo}）科研 Lv${p.need}`).join('、')||(sumOk?'':`四岗科研合计 ${RING_SUM[r.ring]}`);
 return {route:r,posts,total,sum:RING_SUM[r.ring],sumOk,ok,lack};
}
export function renderMap(parent,{doc,space,pick,onPick,goVoyage}){
 const S=demoState(space,pick);A.use(S);const g=gate(space,pick),r=g.route,info=A.ROUTE_INFO[r.id];
 const box=doc.createElement('div');box.className='box mapbox';box.id='xingtuMap2';box.innerHTML=A.mapSvg();parent.append(box);
 box.querySelectorAll('[data-r]').forEach(n=>{const go=()=>onPick(n.getAttribute('data-r'));n.addEventListener('click',go);n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
 const d=doc.createElement('div');d.className='box pdetail';d.id='xingtuRouteDetail';
 const reqs=[`<span class="${g.sumOk?'y':'n'}">四岗科研合计 ${g.total} / ${g.sum}</span>`];
 if(r.need)reqs.push(`<span class="${S.lv[r.need[0]]>=r.need[1]?'y':'n'}">${A.SYSK[r.need[0]].sys} ≥ ${r.need[1]}（短板）</span>`);
 if(r.needAll)reqs.push(`<span class="${LVK.every(k=>S.lv[k]>=r.needAll)?'y':'n'}">四个系统都 ≥ ${r.needAll}</span>`);
 const open=OPEN_NOW.includes(r.id);
 d.innerHTML=`<div class="pd-top"><svg class="pd-art" viewBox="-50 -50 100 100" aria-hidden="true"><rect x="-50" y="-50" width="100" height="100" fill="url(#deep)"/>${A.stars(14,-50,-50,100,100,r.id.length*7)}<g${g.ok?'':' class="plock"'}>${A.planet(r.id,26)}</g></svg>
 <div class="pd-txt"><span class="hudline">◢ ${A.RING[r.ring]} · 航程 ${r.time}</span><h3 id="xingtuRouteName">${r.name}</h3><div class="pd-desc">${info.desc}</div></div></div>
 <div class="post4" id="xingtuPosts"><div class="post4-t">出航需要四个岗位科研 · ${A.RING[r.ring]}</div>${g.posts.map(p=>`<div class="post ${p.ok?'y':'n'}" data-post="${p.k}"><b>${p.post}</b><span>${p.ceo}</span><span>${p.sys}科研</span><em>Lv${p.lv} / 需 Lv${p.need}</em><i>${p.ok?'✓':'✗'}</i></div>`).join('')}</div>
 <div class="req">${reqs.join('')}</div>
 <div class="pd-stats"><span><b>${r.pts[0]}–${r.pts[1]}</b>探索点</span><span><b>${r.cards.length}</b>剧情卡</span>${r.ring>=1&&!r.final?'<span class="alienchip"><b>👽</b>有外星剧情</span>':''}</div>`;
 const b=doc.createElement('button');b.type='button';b.id='xingtuLaunch';b.className='btn launch';
 if(!g.ok){b.disabled=true;b.textContent='岗位科研不够，先去升级';}
 else if(open){b.textContent='出航 →';b.onclick=goVoyage;}
 else{b.disabled=true;b.textContent='这条航线下一版开放';}
 d.append(b);
 if(!g.ok){const l=doc.createElement('div');l.className='lackline';l.id='xingtuLack';l.textContent=`还差：${g.lack}`;d.append(l);}
 parent.append(d);
}
export function renderShip(parent,{doc,space,room,onRoom}){
 const S=demoState(space,'moon');A.use(S);const k=room,lv=S.lv[k],st=A.STAGES[k][lv-1],sy=A.SYSK[k];
 const box=doc.createElement('div');box.className='box shipbox';box.id='xingtuShip';box.innerHTML=A.shipSvg(k);parent.append(box);
 box.querySelectorAll('[data-room]').forEach(n=>n.addEventListener('click',()=>onRoom(n.getAttribute('data-room'))));
 const c=doc.createElement('div');c.className='box roomcard';c.id='xingtuRoom';
 const have=A.ITEMS[k].filter((n,i)=>S.items[k+':'+(i+1)]).length,cost=A.LV_COST[lv-1];
 c.innerHTML=`<span class="hudline">◢ ${A.ROOM[k].en} · SYSTEM ${A.ROOM[k].sys} · POWER ${lv*20}%</span>
 <div class="bigroom"><svg viewBox="0 0 ${A.W0} ${A.H0}" role="img" aria-label="${st[0]}">${A.roomInner(k,lv)}</svg></div>
 <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h3 id="xingtuRoomStage">${st[0]}</h3><span class="tag">${A.ROOM[k].name} · ${sy.ceo} · ${sy.sys}科研 Lv${lv}</span></div>
 <div class="blurb">${st[1]}</div>
 <div class="stages">${A.STAGES[k].map((s,i)=>{const L=i+1,o=L<=lv;return `<div class="stg${L===lv?' on':''}${o?'':' lock'}"><svg viewBox="0 0 ${A.W0} ${A.H0}" aria-hidden="true">${A.roomInner(k,L,{bare:true})}</svg><span>${o?'Lv'+L:'🔒 Lv'+L}</span></div>`;}).join('')}</div>
 <div class="unl">${A.ITEMS[k].map((n,i)=>S.items[k+':'+(i+1)]?`<span class="y">${n}</span>`:`<span class="n">${i+1} 级 · ？？？</span>`).join('')}</div>
 <div class="muted">每升一级，舱室换一张新插画。已摆进 ${have} / 5 件科研成果，没抽到的显示成全息虚影。点飞船上的舱室可以切换。</div>`;
 const up=doc.createElement('button');up.type='button';up.id='xingtuUpgrade';up.className='btn';up.disabled=true;
 up.textContent=lv>=5?'已满级':`升到 ${lv+1} 级 · ${cost} 探索点（下一版开放）`;c.append(up);parent.append(c);
 const sl=doc.createElement('div');sl.className='box sumline';sl.innerHTML=`<span>四人等级合计</span><span class="num">${LVK.reduce((a,x)=>a+S.lv[x],0)} / 20</span>`;parent.append(sl);
}
export {A as ART};
