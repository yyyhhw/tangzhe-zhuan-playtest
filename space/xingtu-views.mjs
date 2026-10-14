// 星途 v2 第一批：星图（5 圈 9 航线 + 出航需要四个岗位科研）与飞船（四个舱室）——只读，不写存档。
// 画面与数值直接搬自王大妈 demo（wangdama/xingtu-demo、xingtu-4post-mock fd614ae）。
import * as A from './xingtu-art.mjs?v=xingtuv2-6-20261014-r1';
export const RING_MIN=A.RING_MIN,RING_SUM=A.RING_SUM,ORDER=A.ORDER,POST=A.POST;
export const OPEN_NOW=['moon','station','mars','venus','belt','pirate','europa','saturn','signal'];
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
export function renderMap(parent,{doc,space,pick,onPick,goVoyage,launch,flying=false}){
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
 else if(flying){b.disabled=true;b.textContent='飞船还在路上';b.onclick=goVoyage;}
 else if(open){b.textContent='出航 →';b.onclick=()=>launch?launch(r.id):goVoyage();}
 else{b.disabled=true;b.textContent='这条航线下一版开放';}
 d.append(b);
 if(!g.ok){const l=doc.createElement('div');l.className='lackline';l.id='xingtuLack';l.textContent=`还差：${g.lack}`;d.append(l);}
 parent.append(d);
}
export const money=n=>n>=1e12?`${+(n/1e12).toFixed(2)} 万亿`:n>=1e8?`${+(n/1e8).toFixed(2)} 亿`:n>=1e4?`${+(n/1e4).toFixed(2)} 万`:String(n);
export function renderShip(parent,{doc,space,room,onRoom,upgrade,cabinArt,research,coins=null,prices=null}){
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
 <div class="muted">每升一级，舱室换一张新插画。已摆进 ${have} / 5 件科研成果，还没买的显示成全息虚影。点飞船上的舱室可以切换。</div>`;
 // 熊大写实插画接口：art/xingtu-cabins/<tech|war|med|life>-<1..5>.webp；没有图时（加载失败）留 SVG 场景
 if(cabinArt){const big=c.querySelector?.('.bigroom');if(big){const img=doc.createElement('img');img.className='cabinart';img.alt=st[0];img.src=cabinArt(k,lv);img.decoding='async';img.onerror=()=>{img.remove?.();};img.onload=()=>{big.classList?.add?.('hasart');};big.append(img);}}
 const pts=Number.isInteger(space?.pts)?space.pts:0;
 const up=doc.createElement('button');up.type='button';up.id='xingtuUpgrade';up.className='btn';up.disabled=lv>=5||pts<cost||!upgrade;
 up.textContent=lv>=5?'已满级':`升到 ${lv+1} 级 · ${cost} 探索点`;if(upgrade)up.onclick=()=>upgrade(k);c.append(up);
 const have2=doc.createElement('div');have2.className='muted';have2.id='xingtuPts';have2.textContent=`现有探索点 ${pts}`;c.append(have2);
 // 星途 v2-B：科研成果用金币买（一件一买；第 t 件要科研 t 级）
 if(research&&prices){const lab=doc.createElement('div');lab.className='lab2';lab.id='xingtuLab';
  const h=doc.createElement('div');h.className='hudline';h.textContent=`◢ ${sy.ceo} 的研究台 · 金币 ${coins===null?'—':money(coins)}`;lab.append(h);
  A.ITEMS[k].forEach((n,i)=>{const t=i+1,own=!!S.items[k+':'+t],price=prices[i],b=doc.createElement('button');b.type='button';b.id=`xingtuBuy-${k}-${t}`;b.className='btn small'+(own?' ghost':'');
   b.textContent=own?`✓ ${n}`:t>lv?`${t} 级 · 科研 ${t} 级可买`:`${t} 级 · ${n} · ${money(price)} 金币`;b.disabled=own||t>lv||!(coins>=price);if(!b.disabled)b.onclick=()=>research(k,t);lab.append(b);});
  const sumv=doc.createElement('div');sumv.className='muted';sumv.textContent=`这一岗 5 件全买合计 ${money(prices.reduce((a,b)=>a+b,0))} 金币`;lab.append(sumv);c.append(lab);}parent.append(c);
 const sl=doc.createElement('div');sl.className='box sumline';sl.innerHTML=`<span>四人等级合计</span><span class="num">${LVK.reduce((a,x)=>a+S.lv[x],0)} / 20</span>`;parent.append(sl);
}
export {A as ART};
// ===== 星途 v2-D：结局「回信」四格 / 制作手记 / 买下地球 / 创业史（画面和文案照 demo） =====
const btn=(doc,id,label,fn,cls='btn')=>{const b=doc.createElement('button');b.type='button';b.id=id;b.className=cls;b.textContent=label;if(fn)b.onclick=fn;return b;};
export function renderEnding(parent,{doc,next}){
 const box=doc.createElement('div');box.className='box sheet';box.id='xingtuEnding';
 box.innerHTML=`<span class="hudline dark">◢ 未知信号源 · 已解码</span><h3>回信</h3><div class="muted">信号是一段漫画。四个人一格一格看下去。</div>
 <div class="endcomic">${A.ENDING.map((p,i)=>`<figure><svg viewBox="0 0 320 200" aria-hidden="true">${p.art()}</svg><figcaption>${i+1} · ${p.cap}</figcaption></figure>`).join('')}</div>`;
 box.append(btn(doc,'xingtuToCredits','看制作手记 →',next));parent.append(box);
}
export function renderCredits(parent,{doc,next}){
 const box=doc.createElement('div');box.className='credits';box.id='xingtuCredits';
 box.innerHTML=`<span class="kick">制作手记</span><h2>谢谢你玩到这里</h2>
 <div class="figs"><div><b>8 天</b><span>从第一句话到星途（10月5日—10月12日）</span></div><div><b>5 位</b><span>AI 电子员工，加 1 位制作人</span></div></div>
 <h3 class="sec">这个游戏是怎么做出来的</h3><div class="comic">${A.COMIC.map(A.comicPanel).join('')}</div>
 <blockquote class="first"><span>第一句话 · 10月5日</span>${A.esc(A.COMIC[0].quote)}</blockquote>
 <h3 class="sec">电子员工群</h3><div class="cast">${A.CAST.map(c=>`<div class="mem" style="--tint:${c.tint}"><svg viewBox="-4 -6 108 126" aria-hidden="true"><use href="#c-${c.id}"/></svg><b>${c.name}</b><span class="r">${c.role}</span><span class="l">「${c.line}」</span></div>`).join('')}</div>`;
 box.append(btn(doc,'xingtuCreditsDone','继续经营 · 新目标：买下地球 →',next));parent.append(box);
}
export const EARTH_PRICE=1e15;
export function renderEarth(parent,{doc,space,coins,buy,recap}){
 const box=doc.createElement('div');box.className='box pdetail';box.id='xingtuEarth';
 if(space?.earth){box.innerHTML=`<span class="hudline">◢ 地球 · 已买下</span><h3>宇宙级摸鱼大王</h3>`;box.append(btn(doc,'xingtuRecap','看看我的创业史 →',recap));parent.append(box);return;}
 box.innerHTML=`<span class="hudline">◢ 最后一站 · 买下地球</span><h3>目标：买下地球</h3><div class="pd-desc">要 1000 万亿金币（金币上限）。现在 ${coins===null?'—':money(coins)}。</div>`;
 const b=btn(doc,'xingtuBuyEarth','买下地球 · 1000 万亿金币',buy);b.disabled=!(coins>=EARTH_PRICE)||!buy;box.append(b);parent.append(box);
}
export function renderRecap(parent,{doc,space,next}){
 const cards=Object.values(space?.cards??{}).reduce((a,b)=>a+(Number.isInteger(b)?b:0),0),hidden=Object.values(space?.hidden??{}).filter(x=>x===true).length;
 const items=Object.keys(space?.items??{}).length,trips=Object.values(space?.visits??{}).reduce((a,b)=>a+(Number.isInteger(b)?b:0),0);
 const box=doc.createElement('div');box.className='credits';box.id='xingtuRecapView';
 box.innerHTML=`<span class="kick">你的创业史</span><h2>从一个烧烤摊，到整个地球</h2>
 <div class="hero-yang"><svg viewBox="-4 -6 108 126" aria-hidden="true"><use href="#c-yang"/></svg><div class="bub static">恭喜！你买下了整个地球。</div></div>
 <div class="figs"><div><b>${trips}</b><span>次星途出航</span></div><div><b>${cards}</b><span>张星途剧情卡</span></div><div><b>${hidden}</b><span>件隐藏物</span></div><div><b>${items}</b><span>件科研成果</span></div></div>
 <div class="strip">${A.PRE.map(([n,sub,,ic],i)=>`<div class="cell" style="--tilt:${i%2?0.8:-0.8}deg"><div class="ic" style="background:#fff4d6">${A.icon(ic)}</div><b>${n}</b>${sub?`<span class="sub">${sub}</span>`:''}</div>`).join('')}${[['第一次出航','rocket'],['收到回信','mail'],['买下地球','earth']].map(([n,ic])=>`<div class="cell${n==='买下地球'?' last':''}"><div class="ic" style="background:#e6f0ff">${A.icon(ic)}</div><b>${n}</b></div>`).join('')}</div>`;
 box.append(btn(doc,'xingtuRecapDone','继续经营 →',next));parent.append(box);
}
