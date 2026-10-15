import {createMoonHost} from './host.mjs?v=xtcopyfix-20261015-r1';
import {moonArt} from './art.mjs?v=xtcopyfix-20261015-r1';
import {MOON_CSS} from './styles.mjs?v=xtcopyfix-20261015-r1';
import {EVENTS} from './voyage-ev.mjs?v=xtcopyfix-20261015-r1';
import {TIER_PRICE} from './moon.mjs?v=xtcopyfix-20261015-r1';
import {XT2_CSS} from './xingtu-css.mjs?v=xtcopyfix-20261015-r1';
import {renderMap,renderShip,gate,ART,ROUTE_TIME,renderEnding,renderCredits,renderEarth,renderRecap} from './xingtu-views.mjs?v=xtcopyfix-20261015-r1';
import {ROUTES,ROUTE_BY_ID,OPEN_ROUTES,TOTAL_CARDS,ALIEN_DENOM,cardOf} from './album.mjs?v=xtcopyfix-20261015-r1';
const RID=view=>view.voyage?.route??'moon',RN=view=>ROUTE_BY_ID[RID(view)]?.name??'月面基地',DUR=view=>view.voyage?.dur||600000;
const TABS=[['xingtuTabVoyage','出航','voyage'],['xingtuTabMap','星图','map'],['xingtuTabShip','飞船','ship'],['xingtuTabAlbum','册子','album']];
export function installMoonOverlay({app,runtime,document:doc=globalThis.document,window:win=globalThis}){
 if(win.XingTu)throw Error('SPACE_HOST_ALREADY_INSTALLED');
 let cover=null,body=null,content=null,timer=null,host,closeButton=null,origin=null,signature=null,revoked=false,renderFailed=false;
 let background=[],tab='voyage',albumPick=null,mapPick='moon',shipRoom='tech';
 const connected=n=>!!n&&(n.isConnected===undefined?!!n.parentNode:n.isConnected);
 const usable=n=>{if(!connected(n)||n.disabled)return false;for(let p=n;p;p=p.parentNode){if(p.nodeType!==undefined&&p.nodeType!==1)break;if(p.hidden||p.inert||p.getAttribute?.('aria-hidden')==='true')return false;const style=win.getComputedStyle?.(p);if(style&&(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'))return false;}return true;};
 const focus=n=>{if(usable(n))n.focus?.();};
 const controls=()=>[...(cover?.querySelectorAll?.('button, a[href], input, select, textarea, [tabindex]')??[])].filter(n=>usable(n)&&n.tabIndex!==-1);
 const isolate=()=>{background=[...(doc.body.children??[])].filter(n=>n!==cover).map(n=>({n,inert:n.inert,attribute:n.getAttribute?.('inert')}));for(const {n} of background)n.inert=true;};
 const restoreBackground=()=>{for(const {n,inert,attribute}of background){n.inert=inert;if(attribute!==undefined){if(attribute===null)n.removeAttribute?.('inert');else n.setAttribute('inert',attribute);}}background=[];};
 const node=(tag,id,text)=>{const n=doc.createElement(tag);if(id)n.id=id;if(text!==undefined)n.textContent=text;return n;};
 const cardImage=(route,n,title,thumb=false)=>{
  if(!OPEN_ROUTES.includes(route)||!Number.isInteger(n)||!cardOf(route,n))return null;
  const img=node('img');img.className='xingtu-cardart'+(thumb?' xingtu-cardart-thumb':'');img.src=new URL(`../art/spacecards/${route}_${n}.webp?v=xtcopyfix-20261015-r1`,import.meta.url).href;img.alt=thumb?'':title;img.width=1024;img.height=768;img.loading=thumb?'lazy':'eager';img.decoding='async';img.onerror=()=>{img.hidden=true;};return img;
 };
 const appendCardImage=(parent,route,n,title,thumb=false)=>{const img=cardImage(route,n,title,thumb);if(img)parent.append(img);};
 const fmt=ms=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`;};
 // 文案-102: phone-local wall time — 今天/明天/昨天 HH:MM, else M月D日 (other year: YYYY年M月D日).
 const when=t=>{const a=new Date(t),b=new Date(Date.now()),dd=Math.round((new Date(a.getFullYear(),a.getMonth(),a.getDate())-new Date(b.getFullYear(),b.getMonth(),b.getDate()))/864e5),hm=`${String(a.getHours()).padStart(2,'0')}:${String(a.getMinutes()).padStart(2,'0')}`;return `${dd===0?'今天':dd===1?'明天':dd===-1?'昨天':a.getFullYear()===b.getFullYear()?`${a.getMonth()+1}月${a.getDate()}日`:`${a.getFullYear()}年${a.getMonth()+1}月${a.getDate()}日`} ${hm}`;};
 const detail=code=>{const d=node('details');d.className='xingtu-detail';d.append(node('summary',null,'详情'),node('small',null,code));return d;};
 const clearTimer=()=>{if(timer!==null){win.clearTimeout(timer);timer=null;}};
 const closeView=()=>{clearTimer();cover?.remove();restoreBackground();cover=null;body=null;content=null;signature=null;closeButton=null;const saved=origin;origin=null;
  let allowed=false;try{allowed=!renderFailed&&!revoked&&!doc.hidden&&!app.xingtuContext().blocked&&!runtime.coordinator.readOnly&&host.view().code!=='SPACE_SESSION_REVOKED';}catch{}
  if(allowed){if(usable(saved))focus(saved);else if(!connected(saved)&&saved?.matches?.('button[data-act="xingtu"]')){const entries=[...doc.querySelectorAll('button[data-act="xingtu"]')];if(entries.length===1&&usable(entries[0]))focus(entries[0]);}}
 };
 const button=(id,label,fn)=>{const b=node('button',id,label);b.type='button';b.onclick=fn;return b;};
 function ensure(){if(cover)return false;origin=doc.activeElement;cover=node('section','xingtuOverlay');cover.className='xingtu-overlay';cover.setAttribute('role','dialog');cover.setAttribute('aria-modal','true');cover.setAttribute('aria-label','星途');body=node('div','xingtuPanel');body.className='xingtu-panel';cover.append(body);
  const head=node('div');head.className='xingtu-head';closeButton=button('xingtuClose','返回经营',()=>host.close());head.append(node('h2',null,'星途'),closeButton);body.append(head);
  const warning=node('p','xingtuRuleset','');warning.className='xingtu-test';body.append(warning);
  // 星途-114：「出航」「册子」两个页签（星途-08 稿三）
  const tabs=node('div','xingtuTabs');tabs.className='xingtu-tabs';tabs.setAttribute('role','tablist');tab='voyage';albumPick=null;mapPick='moon';shipRoom='tech';
  for(const [id,label,key] of TABS){const b=button(id,label,()=>{if(tab===key)return;tab=key;albumPick=null;signature=null;host.refresh();});b.setAttribute('role','tab');tabs.append(b);}
  body.append(tabs);
  content=node('div','xingtuContent');body.append(content);
  // 星途 v2：demo 样式（限定在 .xt2 内）和 SVG 公共 defs，只装一次
  if(!doc.getElementById('xingtuV2Css')){const st=node('style','xingtuV2Css');st.textContent=XT2_CSS;doc.head?.append?.(st);}
  const defs=node('div','xingtuDefs');defs.setAttribute('aria-hidden','true');defs.style&&(defs.style.cssText='position:absolute;width:0;height:0;overflow:hidden');defs.innerHTML=ART.allDefs();cover.append(defs);doc.body.append(cover);isolate();return true;
 }
 const schedule=view=>{if(view.ok&&view.phase==='flying')timer=win.setTimeout(()=>{timer=null;if(host.isOpen()&&!doc.hidden)host.refresh();},1000);};
 function render(view){try{return renderView(view);}catch(error){renderFailed=true;try{host.close();}finally{renderFailed=false;}throw error;}}
 function renderView(view){
  if(!host?.isOpen())return;const created=ensure();clearTimer();
  const next=JSON.stringify([view.ok,view.code,view.phase,view.voyage?.voyageId,view.receipt,view.space?.pts,view.space?.visits,view.event,view.award,tab,albumPick,mapPick,shipRoom,view.space?.lv,view.space?.items,host.token]);
  if(signature===next){if(view.phase==='flying'&&tab==='voyage'&&doc.getElementById('xingtuRemaining')){doc.getElementById('xingtuRemaining').textContent=`剩余 ${fmt(view.remaining)}`;doc.getElementById('xingtuProgress').value=DUR(view)-view.remaining;const p=1-view.remaining/DUR(view);doc.getElementById('xingtuStarMap').querySelector?.('use')?.setAttribute('transform',`translate(${72+p*160} ${84-Math.sin(p*Math.PI)*38}) rotate(65)`);}schedule(view);return;}
  signature=next;const previousFocus=doc.activeElement;while(content.firstChild)content.firstChild.remove();
  // 星途-04 第7条：副标题跟当前航线（出航中=这趟航线，否则=星图选中）
  {const rid=view.voyage?.route??mapPick??'moon',rs=doc.getElementById('xingtuRuleset');if(rs)rs.textContent=`这趟：${ROUTE_BY_ID[rid]?.name??'月面基地'} · ${ROUTE_TIME[rid]??'10 分钟'} · 返航途中会遇到一件事，看完再领探索点`;}
  renderContent(view);if(created||!usable(previousFocus))focus(closeButton);schedule(view);
 }
 function renderContent(view){
  for(const [id,,key] of TABS)doc.getElementById(id)?.setAttribute('aria-selected',String(tab===key));
  if(view.ok&&tab==='album'){renderAlbum(view);return;}
  // 星途 v2 第一批：星图 / 飞船（只读）
  // 星途 v2-D：结局 / 制作手记 / 创业史（只读页；买地球走 earth 意图）
  if(view.ok&&['ending','credits','recap'].includes(tab)){const wrap=node('div','xingtuV2');wrap.className='xt2';content.append(wrap);
   if(tab==='ending')renderEnding(wrap,{doc,next:()=>{tab='credits';host.refresh();}});
   else if(tab==='credits')renderCredits(wrap,{doc,next:()=>{tab='voyage';host.refresh();}});
   else renderRecap(wrap,{doc,space:view.space,next:()=>{tab='voyage';host.refresh();}});return;}
  if(view.ok&&(tab==='map'||tab==='ship')){const wrap=node('div','xingtuV2');wrap.className='xt2';content.append(wrap);
   if(tab==='map')renderMap(wrap,{doc,space:view.space,pick:mapPick,flying:!!(view.voyage&&!view.voyage.completed),onPick:id=>{mapPick=id;host.refresh();},goVoyage:()=>{tab='voyage';host.refresh();},launch:id=>{const r=host.perform({type:'depart',route:id},host.token);if(r.ok){try{app.xingtuSfx?.('swoosh');}catch{}tab='voyage';}host.refresh();return r;}});
   else renderShip(wrap,{doc,space:view.space,room:shipRoom,onRoom:k=>{shipRoom=k;host.refresh();},artUrl:rel=>new URL(`${rel}?v=xtcopyfix-20261015-r1`,import.meta.url).href,upgrade:k=>{const r=host.perform({type:'upgrade',sys:k},host.token);host.refresh();return r;},coins:Number.isFinite(app.state?.coins)?app.state.coins:null,prices:TIER_PRICE,research:(k,t)=>{const r=host.perform({type:'research',sys:k,tier:t},host.token);if(r.ok)try{app.render?.();}catch{}host.refresh();return r;}});return;}
  if(!view.ok){const error=node('p','xingtuProtection',view.code.includes('COMPATIBILITY')?'这趟航程的记录读不懂，先原样留着：航程没清，探索点也没多发。点「返回经营」接着玩就好。':'星途现在存不了档，先不动它。看看手机时间对不对、别的页面是不是也开着游戏，处理好后点「返回经营」，再重新打开星图。');error.className='xingtu-error';content.append(error,detail(view.code));return;}
  const art=node('div','xingtuStarMap');art.className='xingtu-art';art.innerHTML=moonArt(view.phase==='flying'?1-view.remaining/DUR(view):0,RN(view));content.append(art);
  const status=node('div','xingtuStatus');status.className='xingtu-status';content.append(status);
  const token=host.token,actions=node('div','xingtuActions');actions.className='xingtu-actions';content.append(actions);
  const act=(intent)=>{const r=host.perform(intent,token);if(!r.ok&&content){const message=node('p','xingtuSaveResult',r.status==='unknown'?'这一步还没确认存上，星途先停一下。刷新页面，看看实际存下的结果。':'这一步没存上，航程和探索点都还是原样，稍后再点一次就行。');message.className='xingtu-error';content.append(message,detail(r.code));}
   // 音效-112：星途开着只停 BGM，音效照常；出航 swoosh、领返航报告 reveal（静音/后台由 app 侧挡）
   if(r.ok){const n=intent.type==='depart'?'swoosh':intent.type==='claim'?'reveal':null;if(n)try{app.xingtuSfx?.(n);}catch{}}return r;};
  if(view.phase==='flying'){
   status.append(node('p',null,`航线：地球 → ${RN(view)} → 地球`),node('p','xingtuRemaining',`剩余 ${fmt(view.remaining)}`),node('p','xingtuArrival',`${when(view.arrival)} 到达`));
   const progress=node('progress','xingtuProgress');progress.max=DUR(view);progress.value=DUR(view)-view.remaining;status.append(progress);
  }else if(view.phase==='arrived'&&view.event&&EVENTS[view.event.id]){
   // 星途-113（星途-07 稿）：同一张卡——先「返航途中」事件，选完翻成「返航报告」。选择和成败先存再显示；关掉再开还是这张卡。
   const e=EVENTS[view.event.id],id=view.voyage.voyageId,card=node('div','xingtuEvent');card.className='xingtu-event';
   art.className='xingtu-art xingtu-ev-art';art.innerHTML=moonArt(1,RN(view));
   if(view.needsChoice){
    status.append(node('p','xingtuEvStatus','已经回到地球。路上遇到了点事，看完再领探索点。'));
    card.append(node('p','xingtuEvKicker',RID(view)==='moon'?`返航途中 · 第 ${view.voyage.sequence} 次月面往返`:`返航途中 · 第 ${view.voyage.sequence} 次出航 · ${RN(view)}`),node('h3','xingtuEvTitle',e.name),node('p','xingtuEvText',e.situation));
    for(const k of ['a','b']){const b=button(k==='a'?'xingtuChoiceA':'xingtuChoiceB',e[k].label,()=>act({type:'choose',voyageId:id,choice:k}));b.className=k==='a'?'xingtu-choice':'xingtu-choice xingtu-choice-b';const hint=node('small',null,e[k].hint);hint.className='xingtu-hint';card.append(b,hint);}
   }else{
    const fail=view.event.outcome==='fail';art.classList?.add?.(fail?'xingtu-ev-fail':'xingtu-ev-ok');
    status.append(node('p','xingtuArrival',`已于${when(view.arrival)} 到达`));
    card.append(node('p','xingtuEvKicker',`返航报告 · ${RN(view)}`),node('h3','xingtuEvTitle',fail?'有点狼狈地回来了':'平安返航'),node('p','xingtuEvText',view.event.choice==='b'?e.bText:fail?e.fail:e.success));
    const reward=node('div','xingtuReward',`+${view.event.reward.pts} 探索点`);reward.className='xingtu-reward';card.append(reward);
    awardBlocks(card,view);
    const take=button('xingtuClaim','收下',()=>{const r=act({type:'claim',voyageId:id});if(r?.ok&&RID(view)==='signal'){tab='ending';host.refresh();}return r;});take.className='xingtu-choice';card.append(take);
    if(view.award?.card&&Object.values(view.space.cards??{}).every(n=>!n)){const tip=node('small','xingtuAlbumTip','放进星途册子了');tip.className='xingtu-hint';card.append(tip);}
   }
   actions.append(card);
  }else if(view.phase==='arrived'){
   const arrPts=Number.isInteger(view.event?.reward?.pts)?view.event.reward.pts:8;/* 旧 v1 航程固定 8 点（MOON_RULES.points） */status.append(node('p','xingtuArrivedLine',`${RN(view)}往返已完成，返航报告待确认。`),node('p','xingtuArrival',`已于${when(view.arrival)} 到达`));const box=node('div','xingtuEvent');box.className='xingtu-event';awardBlocks(box,view);if(box.firstChild)actions.append(box);actions.append(button('xingtuClaim',`确认返航报告 · 领取${arrPts}探索点`,()=>act({type:'claim',voyageId:view.voyage.voyageId})));
  }else{
   status.append(node('p',null,`当前探索点：${view.space.pts} · 月面往返次数：${view.space.visits.moon??0}`));
   // 杨总 10/14 22:26：出航需要四个岗位科研——月面也要过四岗检查
   const g=gate(view.space,'moon'),dep=button('xingtuDepart',g.ok?'出航月面基地':'岗位科研不够，先去升级',()=>gate(view.space,'moon').ok?act({type:'depart',route:'moon'}):undefined);dep.disabled=!g.ok;actions.append(dep);
   if(!g.ok){const l=node('p','xingtuLack',`还差：${g.lack}`);l.className='xingtu-error';actions.append(l);}
   if(view.space.ended){const wrap=node('div','xingtuEndWrap');wrap.className='xt2';actions.append(wrap);
    wrap.append(button('xingtuReplay','再看一遍回信',()=>{tab='ending';host.refresh();}));
    renderEarth(wrap,{doc,space:view.space,coins:Number.isFinite(app.state?.coins)?app.state.coins:null,buy:()=>{const r=host.perform({type:'earth'},host.token);if(r.ok)tab='recap';host.refresh();return r;},recap:()=>{tab='recap';host.refresh();}});}
  }
   if(view.receipt){const evName=view.receipt.ev?EVENTS[view.receipt.ev]?.name:null;const got=view.receipt.card?cardOf(view.receipt.route,view.receipt.card):null,extra=got?` · 剧情卡「${got.title}」`:'';const report=node('div','xingtuReport',evName?`最近返航报告：${evName} · 已入账 ${view.receipt.points} 探索点${extra} · ${when(view.receipt.claimedAt)}`:`最近返航报告：月面基地 · 已入账 ${view.receipt.points} 探索点（一次）${extra} · ${when(view.receipt.claimedAt)}`);report.className='xingtu-receipt';content.append(report);}

 }

 // 星途-114：返航报告里的「新剧情卡」块 + 隐藏物金色一行（点一下展开介绍）。显示的就是 claim 会写入的（同一个 awardFor）。
 function awardBlocks(parent,view){
  const a=view.award;if(!a)return;
  if(a.card){const route=RID(view),c=cardOf(route,a.card),box=node('div','xingtuNewCard');box.className='xingtu-newcard'+(c.alien?' xingtu-alien':'');appendCardImage(box,route,a.card,c.title);box.append(node('p','xingtuNewCardTag',c.alien?'外星来客 · 四家店产速永久 +25%':'新剧情卡'),node('h4','xingtuNewCardTitle',c.title),node('p','xingtuNewCardText',c.text));parent.append(box);}
  if(a.hidden){const h=ROUTE_BY_ID[a.hidden].hid,line=button('xingtuNewHidden',`◆ 找到隐藏物「${h.name}」`,()=>{const d=doc.getElementById('xingtuNewHiddenIntro');if(d)d.hidden=!d.hidden;});line.className='xingtu-hidline';const intro=node('p','xingtuNewHiddenIntro',h.intro);intro.hidden=true;parent.append(line,intro);}
 }
 // 星途-114：册子页签。只有已开航的航线露卡名/线索；别的整行「还没开航」。外星卡不写产速加成（等星途-09）。
 function renderAlbum(view){
  const sp=view.space,cards=sp.cards??{},hidden=sp.hidden??{};
  const got=ROUTES.reduce((a,r)=>a+Math.min(cards[r.id]??0,r.cards.length),0),hid=ROUTES.filter(r=>hidden[r.id]===true).length,alien=ROUTES.reduce((a,r)=>a+r.cards.slice(0,cards[r.id]??0).filter(c=>c.alien).length,0);
  const head=node('p','xingtuAlbumHead',got===TOTAL_CARDS&&hid===ROUTES.length?'这本册子满了。':`${got}/${TOTAL_CARDS} 剧情卡   ${hid}/${ROUTES.length} 隐藏物   ${alien}/${ALIEN_DENOM} 外星`);head.className='xingtu-albumhead';content.append(head);
  const shelf=node('div','xingtuShelf');shelf.className='xingtu-shelf';shelf.append(node('p',null,'隐藏物展柜'));const grid=node('div');grid.className='xingtu-shelfgrid';
  for(const r of ROUTES){const on=hidden[r.id]===true,b=button('xingtuHid-'+r.id,on?r.hid.name:`？ ${r.name}`,()=>{albumPick='h:'+r.id;signature=null;host.refresh();});b.className='xingtu-hcell'+(on?' on':'');grid.append(b);}
  shelf.append(grid);
  if(albumPick?.startsWith('h:')){const r=ROUTE_BY_ID[albumPick.slice(2)],on=hidden[r.id]===true;const d=node('p','xingtuHidDetail',on?`${r.hid.name}：${r.hid.intro}`:OPEN_ROUTES.includes(r.id)?`线索：${r.hid.clue}`:'还没开航');d.className='xingtu-detailtext';shelf.append(d);}
  content.append(shelf);
  for(const r of ROUTES){const open=OPEN_ROUTES.includes(r.id),n=Math.min(cards[r.id]??0,r.cards.length),row=node('div','xingtuRow-'+r.id);row.className='xingtu-row';
   row.append(node('p',null,`${r.name}${r.ring?' · '+r.ring:''}    ${n}/${r.cards.length}`));
   if(!open){const bar=node('div',null,'还没开航');bar.className='xingtu-closed';row.append(bar);content.append(row);continue;}
   const list=node('div');list.className='xingtu-cards';
   r.cards.forEach((c,i)=>{const have=i<n,b=button(`xingtuCard-${r.id}-${i+1}`,have?c.title:`第 ${i+1} 张${c.alien?' · 外星来客':''}`,()=>{albumPick=`c:${r.id}:${i+1}`;signature=null;host.refresh();});b.className='xingtu-cardcell'+(have?' on':'')+(c.alien?' xingtu-alien':'');if(have)appendCardImage(b,r.id,i+1,c.title,true);if(!have){const s=node('small',null,`再去一趟${r.name}`);b.append(s);}list.append(b);});
   row.append(list);
   if(albumPick?.startsWith(`c:${r.id}:`)){const k=Number(albumPick.split(':')[2]),c=r.cards[k-1],have=k<=n;const d=node('p','xingtuCardDetail',have?`${c.title}：${c.text}`:`第 ${k} 张还没拿到，再去一趟${r.name}。`);d.className='xingtu-detailtext';if(have)appendCardImage(d,r.id,k,c.title);row.append(d);}
   content.append(row);}
 }
 const c=runtime.coordinator;
 host=createMoonHost({app,coordinator:c,readReconcile:()=>runtime.reconcile(),render,closeView,audioPause:()=>app.xingtuAudioPause(),audioResume:()=>app.xingtuAudioResume()});
 const style=node('style','xingtuStyles');style.textContent=MOON_CSS;doc.head.append(style);
 // 星途-101: back in front with offline earnings waiting -> close the star map so the parent's offline modal is reachable; otherwise refresh as before.
 const hide=()=>{if(doc.hidden){clearTimer();host.suspend();}else queueMicrotask(()=>{const r=host.resume();if(r.ok||!host.isOpen())return;let offline=false;try{offline=!!app.xingtuContext().offlinePending;}catch{}if(offline)host.close();});};
 doc.addEventListener('visibilitychange',hide);win.addEventListener('pagehide',()=>{revoked=true;host.invalidate();},{once:true});win.addEventListener('pageshow',e=>{if(e.persisted){revoked=true;host.invalidate();}});doc.addEventListener('keydown',e=>{
  if(!host.isOpen())return;if(e.key==='Escape'){e.preventDefault?.();host.close();return;}if(e.key!=='Tab')return;
  const list=controls(),first=list[0]??closeButton,last=list.at(-1)??closeButton,active=doc.activeElement;
  if(!list.includes(active)||(e.shiftKey?active===first:active===last)){e.preventDefault?.();focus(e.shiftKey?last:first);}
 });
 win.XingTu=host;return host;
}
