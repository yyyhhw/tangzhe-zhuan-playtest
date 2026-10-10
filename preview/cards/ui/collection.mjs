import {DISPLAY_CARDS} from './collection-cards.mjs';
import {RARITY_LABELS,CLASS_LABELS,TYPE_LABELS,escapeHTML as esc,formatCoins,copiesFor,canTransact,addToDraft,inspectDraft,receiptSummary,createCollectionClient} from './collection-state.mjs';

/** Collection presentation. The private parent channel is the sole transaction authority. */
export function mountCollection({document:doc=document,send,pause,getMuted=()=>false,startDeck=null}) {
  let snapshot = null, tab = 'draw', filter = 'all', ownedOnly = false, selectedId = DISPLAY_CARDS[0].cardId;
  let busy = false, connected = false, status = '从书店预览入口进入后可抽卡。单独打开仅浏览，不会使用模拟金币。';
  let draft = {classId:'warrior',cards:[],error:''}, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, localMute = false;
  let quoteState = null, revealing = null, revealTimer = null, audio = null, queued = [], shown = new Set();
  let confirmKind = null;
  const $ = id=>doc.getElementById(id);
  const shell = doc.createElement('dialog');shell.id='collection-dialog';shell.className='cc-shell';shell.setAttribute('aria-labelledby','cc-title');
  shell.innerHTML = `<header class="cc-top"><div class="cc-brand"><span class="cc-mark" aria-hidden="true">册</span><div><small>书页之间 · 收藏试验</small><h2 id="cc-title">街巷牌册</h2></div></div><div class="cc-wallet"><span>经营金币 <strong id="cc-coins">未连接</strong></span><span>星尘 <strong id="cc-dust">— / 3200</strong></span></div><button id="cc-close" aria-label="关闭牌册，返回已暂停的对局">返回对局</button></header>
    <div class="cc-layout"><nav class="cc-nav" aria-label="牌册页面"><button data-cc-tab="draw" aria-current="page"><span aria-hidden="true">✦</span>抽卡</button><button data-cc-tab="collection"><span aria-hidden="true">▤</span>牌册</button><button data-cc-tab="deck"><span aria-hidden="true">▥</span>组牌</button><button data-cc-tab="settings"><span aria-hidden="true">⚙</span>设置</button></nav><main id="cc-content" class="cc-content"></main></div>
    <footer class="cc-status"><span id="cc-status" role="status" aria-live="polite"></span><button id="cc-refresh">刷新状态</button></footer><div class="cc-rotate"><span aria-hidden="true">↻</span><h3>横过手机，展开牌册</h3><p>对局已暂停。横屏后可抽卡、查看收藏和组牌。</p><button id="cc-portrait-close">返回对局</button></div>`;
  const confirm = doc.createElement('dialog');confirm.id='cc-confirm';confirm.className='cc-confirm';confirm.setAttribute('aria-labelledby','cc-confirm-title');
  const reveal = doc.createElement('dialog');reveal.id='cc-reveal';reveal.className='cc-reveal';reveal.setAttribute('aria-labelledby','cc-reveal-title');
  doc.body.append(shell,confirm,reveal);
  const openButton=doc.createElement('button');openButton.id='collection-open';openButton.className='quiet';openButton.textContent='牌册 · 抽卡与收藏';
  doc.querySelector('#menu-dialog .snapshot-actions')?.append(openButton);
  const client=createCollectionClient({send,onSnapshot:acceptSnapshot});
  function policies() {
    const byId=new Map((snapshot?.catalog || []).map(p=>[p.cardId,p]));
    return DISPLAY_CARDS.map(c=>({...c,...byId.get(c.cardId),rarity:byId.get(c.cardId)?.rarity || c.displayRarity}));
  }
  const policy=id=>policies().find(c=>c.cardId===id);
  function setStatus(text) { status=text;$('cc-status').textContent=text; }
  function markPending() { const count=queued.length+(revealing?1:0);openButton.textContent=count?`牌册 · ${count} 份已入账结果待查看`:'牌册 · 抽卡与收藏'; }
  function acceptSnapshot(next) {
    if (!next || typeof next !== 'object') return;
    snapshot=next; connected=next.connected === true;
    for(const item of next.pendingReceipts || []) enqueue(item,false);
    if (next.pending && ['confirmed','selected','debited'].includes(next.pending.stage)) status='有一笔已确认操作等待恢复。点击「恢复原操作」，不会重新扣费或重抽。';
    else if (next.pending?.stage==='awaiting-decision') status='有一笔操作等待确认。可继续查看费用，或取消。';
    else if (!canTransact(next)) status=next.code==='migration-required'?'经营预览尚未启用收藏存档，请先在书店完成预览迁移确认。':'收藏暂不可交易。已有对局照常保留；这里只展示父页面返回的状态。';
    else status='收藏由书店预览保存。每次单抽 500万经营金币；普通与金色共用同名上限。';
    render();
  }
  async function refresh() {
    if (busy) return;
    if (!connected) {setStatus('尚未连接书店预览。单独打开只可浏览，没有金币替代或自动赠卡。');return;}
    try {await client.request('snapshot');if(shell.open&&!revealing&&!confirm.open) showNextReceipt();}
    catch(e){setStatus(errorText(e));}
  }
  function errorText(e) {
    const codes={'insufficient-funds':'经营金币不足，需要 500万。','insufficient-dust':'星尘不足，无法镀金。','read-only':'目前只读，尚未启用收藏交易。','wallet-disabled':'经营钱包尚未启用。','busy':'有一笔操作仍在处理，请刷新状态恢复。','unavailable':'存档暂不可用；请刷新状态确认结果。','migration-required':'请先在经营预览确认收藏存档迁移。','wallet-bridge-disabled':'当前收藏交易尚未启用。','active-transaction-pending':'有一笔原操作尚未完成，请刷新状态后恢复。','no-normal-copy-to-gild':'需要先拥有一张普通卡才能镀金。','lock-not-owned':'另一个预览页面正在保存，请关闭另一个页面后重新进入。','write-failed':'存档未确认成功，请刷新状态恢复原操作。','capacity-read-only':'收藏存档已达到容量限制，已停止交易以保护原数据。'};
    const code=String(e?.code||'').toLowerCase().replaceAll('_','-');
    return codes[code] || e?.message || '操作未完成，请刷新状态检查。';
  }
  function closeShell() { if (busy) {setStatus('正在等待书店确认。可稍后返回，刷新也会恢复已入账结果。');} shell.close(); }
  function open() {
    pause();$('menu-dialog')?.close();
    if (!shell.open) shell.showModal();render();refresh();showNextReceipt();
  }
  function render() {
    const usable=canTransact(snapshot)&&!busy;
    $('cc-coins').textContent=formatCoins(snapshot?.balance?.coins);
    $('cc-coins').title=Number.isSafeInteger(snapshot?.balance?.coins)?`${snapshot.balance.coins.toLocaleString('zh-CN')} 经营金币`:'';
    $('cc-dust').textContent=Number.isSafeInteger(snapshot?.dust)?`${snapshot.dust} / 3200`:'— / 3200';
    $('cc-status').textContent=status;$('cc-refresh').disabled=busy;
    shell.querySelectorAll('[data-cc-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.ccTab===tab?'page':'false'));
    if(tab==='draw') renderDraw(usable);
    if(tab==='collection'||tab==='deck') renderCollection(usable);
    if(tab==='settings') renderSettings();
    if(busy) $('cc-content').querySelectorAll('button,select,input').forEach(el=>el.disabled=true);
    markPending();
  }
  function renderDraw(usable) {
    const pending=snapshot?.pending;
    $('cc-content').innerHTML=`<section class="cc-draw"><div class="cc-draw-art" aria-hidden="true"><div class="cc-orbit"></div><div class="cc-pack"><span class="cc-pack-star">✦</span><small>街巷拾光</small><strong>封存的<br>一页故事</strong><i>39 张原创卡牌</i></div></div><div class="cc-draw-copy"><small class="cc-eyebrow">街巷拾光 · 单张卡牌</small><h3>下一页，会遇见谁？</h3><p>一张卡，一段街巷故事。抽到满额同名牌会转为星尘；星尘能把普通卡镀成金色。</p><div class="cc-odds" aria-label="稀有度概率"><span class="cc-rarity-common">普通 <b>68%</b></span><span class="cc-rarity-rare">稀有 <b>22%</b></span><span class="cc-rarity-epic">史诗 <b>7%</b></span><span class="cc-rarity-legendary">传说 <b>3%</b></span></div><p class="cc-fine">传说中有 10% 为金色传说，即总概率 0.3%。无保底。只有金色传说可直接抽出；其他金色卡由镀金获得。</p><button id="cc-draw" class="cc-primary cc-draw-button" ${!usable||pending?'disabled':''}>${busy?'等待书店确认…':'单抽 · 500万经营金币'}</button><p class="cc-fine">先查看父页面费用，再确认单抽。扣费与结果已保存后才播放揭晓。</p>${pending?`<button id="cc-resume" class="cc-secondary" ${busy?'disabled':''}>${pending.stage==='awaiting-decision'?'查看待确认操作':'恢复原操作 · 不会重抽'}</button>`:''}${queued.length?'<button id="cc-view-pending" class="cc-secondary">查看已入账卡牌</button>':''}${!snapshot?'<p class="cc-offline">浏览模式：请从书店预览入口连接。</p>':''}</div></section>`;
    $('cc-draw')?.addEventListener('click',()=>beginQuote({kind:'draw'}));$('cc-resume')?.addEventListener('click',resumePending);$('cc-view-pending')?.addEventListener('click',showNextReceipt);
  }
  function filteredCards() {
    return policies().filter(c=>filter==='all'||(filter==='neutral'?c.classId==='neutral':filter==='class'?c.classId!=='neutral':c.classId===filter)).filter(c=>!ownedOnly||copiesFor(snapshot,c.cardId).normal+copiesFor(snapshot,c.cardId).golden>0).filter(c=>tab!=='deck'||c.classId==='neutral'||c.classId===draft.classId);
  }
  function cardMarkup(card,{focus=false,finish=null}={}) {
    const held=copiesFor(snapshot,card.cardId), gold=finish==='golden'||(!finish&&held.golden>0), count=held.normal+held.golden;
    return `<div class="cc-card-face cc-rarity-${esc(card.rarity)} ${gold?'cc-golden':''} ${!count&&!focus?'cc-unowned':''}"><img src="${esc(card.art)}" alt="" loading="${focus?'eager':'lazy'}"><span class="cc-mana" aria-label="${card.cost} 费">${card.cost}</span><span class="cc-rarity-tag">${RARITY_LABELS[card.rarity]||'未定'}${gold?' · 金色':''}</span><div class="cc-card-copy"><strong>${esc(card.name)}</strong><small>${TYPE_LABELS[card.type]}${card.attack!==null?` · ${card.attack} / ${card.health??card.durability}`:''}</small></div></div>`;
  }
  function renderCollection(usable) {
    const all=filteredCards();
    if(!all.some(c=>c.cardId===selectedId)&&all.length)selectedId=all[0].cardId;
    const card=all.find(c=>c.cardId===selectedId),held=card?copiesFor(snapshot,card.cardId):{normal:0,golden:0};
    const draftCount=new Map();draft.cards.forEach(id=>draftCount.set(id,(draftCount.get(id)||0)+1));
    const check=inspectDraft(draft,policies(),snapshot);
    $('cc-content').innerHTML=`<section class="cc-library"><div class="cc-library-main"><div class="cc-filters"><label class="cc-filter-label">${tab==='deck'?'职业':'卡牌范围'}<select id="cc-class-filter" aria-label="${tab==='deck'?'组牌职业':'卡牌范围'}">${tab==='deck'?Object.entries(CLASS_LABELS).filter(([id])=>id!=='neutral').map(([id,name])=>`<option value="${id}" ${draft.classId===id?'selected':''}>${name}</option>`).join(''):[['all','全部'],['neutral','公共牌'],['class','职业牌'],...Object.entries(CLASS_LABELS).filter(([id])=>id!=='neutral')].map(([id,name])=>`<option value="${id}" ${filter===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="cc-checkbox"><input type="checkbox" id="cc-owned" ${ownedOnly?'checked':''}>仅已拥有</label><span class="cc-count">${all.length} 张${tab==='deck'?` · 草稿 ${draft.cards.length}/30`:''}</span></div><div class="cc-grid">${all.length?all.map(c=>{const n=copiesFor(snapshot,c.cardId);return `<button class="cc-card ${c.cardId===selectedId?'cc-selected':''}" data-cc-card="${esc(c.cardId)}" aria-label="${esc(c.name)}，${RARITY_LABELS[c.rarity]}，普通 ${n.normal} 张，金色 ${n.golden} 张${tab==='deck'?`，已入牌组 ${draftCount.get(c.cardId)||0} 张`:''}">${cardMarkup(c)}<span class="cc-held">普通 ${n.normal} · 金色 ${n.golden}${tab==='deck'?` · 入组 ${draftCount.get(c.cardId)||0}`:''}</span></button>`}).join(''):'<p class="cc-empty">这里还没有已拥有的卡牌。取消筛选可浏览完整牌池。</p>'}</div></div><aside class="cc-inspector" aria-label="卡牌详情">${card?`<small class="cc-eyebrow">${CLASS_LABELS[card.classId]} · ${TYPE_LABELS[card.type]}</small><h3>${esc(card.name)}</h3><span class="cc-detail-rarity cc-rarity-${card.rarity}">${RARITY_LABELS[card.rarity]}${held.golden?' · 已有金色':''}</span><p class="cc-effect">${esc(card.text)}</p><p class="cc-fine">${card.cost} 费${card.attack!==null?` · 攻击 ${card.attack} · ${card.health!==null?'生命':'耐久'} ${card.health??card.durability}`:''}<br>普通 ${held.normal} · 金色 ${held.golden}${Number.isInteger(card.ownershipCap)?` · 同名上限 ${card.ownershipCap}`:''}</p>${tab==='deck'?`<div class="cc-deck-adjust"><button id="cc-remove" aria-label="从草稿移除一张 ${esc(card.name)}" ${!(draftCount.get(card.cardId)>0)?'disabled':''}>− 移除</button><button id="cc-add" class="cc-primary" ${!card.deckCap||!['neutral',draft.classId].includes(card.classId)||held.normal+held.golden<=(draftCount.get(card.cardId)||0)||(draftCount.get(card.cardId)||0)>=card.deckCap||draft.cards.length>=30?'disabled':''}>＋ 加入</button></div><p class="cc-fine cc-warning">草稿未保存，刷新或离开当前网页会丢失。不会更改当前对局。</p><p class="cc-deck-error" role="status">${esc(draft.error||check.issues[0]||'30 张齐备，可验证并选择新对局。')}</p><button id="cc-start-deck" class="cc-primary" ${!usable||!check.valid||!startDeck?'disabled':''}>验证并开始新对局</button><button id="cc-clear-draft" ${!draft.cards.length?'disabled':''}>清空草稿</button>`:`<button id="cc-gild" class="cc-primary" ${!usable||held.normal<1||!Number.isInteger(card.gildDustCost)||snapshot?.pending?'disabled':''}>镀金${Number.isInteger(card.gildDustCost)?` · ${card.gildDustCost} 星尘`:''}</button><p class="cc-fine">镀金升级一张已拥有的普通卡，不增加总张数。金色外观不改变效果。${held.normal<1?'需要先拥有普通卡。':''}</p>`}`:'<p>选择一张卡查看详情。</p>'}${tab==='deck'&&!startDeck?'<p class="cc-warning">收藏牌组开局尚未接入；现有固定牌组照常可玩。</p>':''}</aside></section>`;
    $('cc-class-filter').addEventListener('change',e=>{
      const next=e.target.value;
      if(tab!=='deck'){filter=next;render();return;}
      if(next===draft.classId)return;
      const change=()=>{draft={classId:next,cards:[],error:''};filter='all';render();};
      if(draft.cards.length){e.target.value=draft.classId;showLocalConfirmation('切换职业？','这会清空当前未保存的组牌草稿，不影响当前对局。',change);}else change();
    });
    $('cc-owned').addEventListener('change',e=>{ownedOnly=e.target.checked;render();});
    shell.querySelectorAll('[data-cc-card]').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.ccCard;render();}));
    $('cc-gild')?.addEventListener('click',()=>beginQuote({kind:'gild',cardId:card.cardId}));
    $('cc-add')?.addEventListener('click',()=>{draft=addToDraft(draft,card,snapshot);render();});
    $('cc-remove')?.addEventListener('click',()=>{const at=draft.cards.indexOf(card.cardId);if(at>=0)draft.cards.splice(at,1);draft.error='';render();});
    $('cc-clear-draft')?.addEventListener('click',()=>showLocalConfirmation('清空草稿？','仅清空这份未保存的组牌草稿。当前对局和收藏不变。',()=>{draft.cards=[];draft.error='';render();}));
    $('cc-start-deck')?.addEventListener('click',prepareDeck);
  }
  function renderSettings() {
    $('cc-content').innerHTML=`<section class="cc-settings"><small class="cc-eyebrow">按你的节奏翻页</small><h3>收藏设置</h3><label class="cc-setting"><span><strong>减少动态效果</strong><small>省略蓄光和展开，直接展示已入账卡牌。</small></span><input type="checkbox" id="cc-reduced" ${reduced?'checked':''}></label><label class="cc-setting"><span><strong>静音</strong><small>同时遵循书店静音。本次页面有效。</small></span><input type="checkbox" id="cc-muted" ${localMute||getMuted()?'checked':''} ${getMuted()?'disabled':''}></label><div class="cc-setting"><span><strong>星尘溢出提醒</strong><small>${snapshot?.preferences?.suppressOverflowWarning?'当前已关闭。继续抽卡时，超出 3200 的星尘会丢弃。':'当前开启。可能超过 3200 星尘时先确认。'}</small></span><button id="cc-restore" ${busy||!canTransact(snapshot)||!snapshot?.preferences?.suppressOverflowWarning?'disabled':''}>恢复提醒</button></div><p class="cc-fine">重复卡星尘：普通 5 / 稀有 20 / 史诗 100 / 传说 400（含金色传说）。镀金费用：360 / 700 / 1200 / 1600。传说最多 1 张，其他最多 2 张，普通与金色合计。</p><p class="cc-fine">满额时抽到金色传说：若已有普通卡，升级为金色并给重复星尘；如果已经全是金色，只给星尘。</p></section>`;
    $('cc-reduced').addEventListener('change',e=>reduced=e.target.checked);$('cc-muted').addEventListener('change',e=>{localMute=e.target.checked;if(localMute)stopAudio();});
    $('cc-restore').addEventListener('click',async()=>{if(busy)return;busy=true;render();try{await client.request('restore-reminders');setStatus('星尘溢出提醒已恢复。');}catch(e){setStatus(errorText(e));}finally{busy=false;render();}});
  }
  function confirmMarkup(title,text,actions,extra='') { return `<header><small>请先核对</small><h3 id="cc-confirm-title">${esc(title)}</h3></header><p>${text}</p>${extra}<div class="cc-confirm-actions">${actions}</div>`; }
  function showLocalConfirmation(title,text,action) {
    if(confirm.open||busy)return;confirmKind='local';confirm.innerHTML=confirmMarkup(title,esc(text),'<button id="cc-confirm-cancel">取消</button><button id="cc-confirm-continue" class="cc-primary">确认</button>');confirm.showModal();
    $('cc-confirm-cancel').onclick=()=>confirm.close();$('cc-confirm-continue').onclick=()=>{confirm.close();action();};
  }
  async function beginQuote(request) {
    if(busy||!canTransact(snapshot)||snapshot.pending)return;busy=true;render();
    try{const r=await client.request('quote',{request});quoteState={txId:r.txId,quote:r.quote,request};showQuote();}catch(e){setStatus(errorText(e));}finally{busy=false;render();}
  }
  function showQuote() {
    if(!quoteState?.txId||!quoteState.quote)return;confirmKind='transaction';
    const q=quoteState.quote,isDraw=quoteState.request.kind==='draw',name=policy(quoteState.request.cardId)?.name||'普通卡';
    const overflow=q.requiresOverflowConfirmation===true;
    const cost=isDraw?`${formatCoins(q.goldCost)}经营金币（${Number(q.goldCost).toLocaleString('zh-CN')}）`:`${q.dustCost} 星尘`;
    confirm.innerHTML=confirmMarkup(isDraw?'确认单抽':'确认镀金',`${isDraw?'抽取 1 张卡牌':`将「${esc(name)}」的一张普通卡升为金色`}，本次消耗 <strong>${esc(cost)}</strong>。${overflow?`<br><span class="cc-warning">本次最多获得 ${q.maximumDustEarned} 星尘，最多 ${q.maximumDustDiscarded} 星尘可能超过 3200 上限而丢弃。</span>`:''}`,'<button id="cc-confirm-cancel">取消</button><button id="cc-confirm-continue" class="cc-primary">继续</button>',overflow?'<label class="cc-checkbox cc-overflow-choice"><input id="cc-suppress" type="checkbox">下次不再提醒（仅本次点继续后生效）</label>':'');
    if(!confirm.open)confirm.showModal();$('cc-confirm-cancel').onclick=()=>decideQuote(false);$('cc-confirm-continue').onclick=()=>decideQuote(true);
  }
  async function decideQuote(proceed) {
    if(busy||!quoteState)return;const original=quoteState;const suppress=proceed&&$('cc-suppress')?.checked===true;
    busy=true;confirm.querySelectorAll('button,input').forEach(el=>el.disabled=true);render();
    try{const r=await client.request('confirm',{txId:original.txId,decision:proceed?'continue':'cancel',allowDustOverflow:proceed&&original.quote.requiresOverflowConfirmation===true,suppressFutureOverflowWarnings:suppress});quoteState=null;confirm.close();if(r.receipt)enqueue(r,true);else setStatus(proceed?'书店正在处理，请刷新状态恢复原操作。':'已取消，未抽卡。');}
    catch(e){confirm.close();setStatus(errorText(e));}
    finally{busy=false;render();if(!confirm.open)showNextReceipt();}
  }
  async function resumePending() {
    if(busy||!snapshot?.pending)return;
    const p=snapshot.pending;if(p.stage==='awaiting-decision'){quoteState={txId:p.txId,quote:p.quote,request:p.request};showQuote();return;}
    busy=true;render();try{const r=await client.request('resume',{txId:p.txId});if(r.receipt)enqueue(r,true);else setStatus('正在恢复原操作，请稍后刷新状态。');}catch(e){setStatus(errorText(e));}finally{busy=false;render();showNextReceipt();}
  }
  async function prepareDeck() {
    if(busy||!startDeck||!canTransact(snapshot))return;const candidate={classId:draft.classId,cards:[...draft.cards]};
    busy=true;render();try{const r=await client.request('validate-deck',candidate);const verdict=r.validation||r.result||r;
      if(!verdict.valid){setStatus('父页面未通过组牌校验，请检查持有数量、职业和 30 张限制。');return;}
      busy=false;showLocalConfirmation('替换当前对局并开局？','这会使用已验证的 30 张收藏牌创建新对局，并替换当前自动存档。上一份存档仍按原机制备份；需要保留当前局，请先下载快照。',async()=>{
        if(busy)return;busy=true;render();try{const checked=await client.request('validate-deck',candidate);const result=checked.validation||checked.result||checked;if(!result.valid)throw Error('收藏已变化，请重新验证牌组。');
          await startDeck({...candidate,collectionRevision:result.collectionRevision,validated:true});shell.close();setStatus('已开始收藏牌组对局。');
        }catch(e){setStatus(errorText(e));}finally{busy=false;render();}
      });
    }catch(e){setStatus(errorText(e));}finally{busy=false;render();}
  }
  function enqueue(item,openNow) {
    const receipt=item?.receipt,result=item?.result;if(!receipt?.txId||!receipt.outcome||!result||shown.has(receipt.txId)||revealing?.receipt.txId===receipt.txId||queued.some(q=>q.receipt.txId===receipt.txId))return;
    if(!DISPLAY_CARDS.some(c=>c.cardId===receipt.outcome.cardId))return;
    queued.push({receipt,result});markPending();if(openNow&&shell.open&&!busy&&!confirm.open)showNextReceipt();
  }
  function showNextReceipt() {
    if(revealing||confirm.open||!shell.open||!queued.length)return;revealing=queued.shift();
    const {receipt}=revealing,card=policy(receipt.outcome.cardId),legend=receipt.outcome.rarity==='legendary',gold=receipt.outcome.finish==='golden';
    const useReduced=reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phase=useReduced?'focus':'windup';reveal.className=`cc-reveal ${legend?'cc-legendary':''} ${gold?'cc-gold-reveal':''}`;reveal.dataset.phase=phase;
    reveal.innerHTML=`<div class="cc-reveal-aura" aria-hidden="true"></div><header><small>结果已保存 · 不会再次扣费</small><h3 id="cc-reveal-title">${legend?(gold?'金色传说':'传说卡牌'):'街巷来信'}</h3></header><div class="cc-reveal-layout"><div class="cc-reveal-card"><div class="cc-reveal-back" aria-hidden="true"><span>✦</span><strong>书页之间</strong></div><div class="cc-reveal-front">${cardMarkup({...card,rarity:receipt.outcome.rarity},{focus:true,finish:receipt.outcome.finish})}</div></div><div class="cc-reveal-copy"><span class="cc-detail-rarity cc-rarity-${receipt.outcome.rarity}">${RARITY_LABELS[receipt.outcome.rarity]} · ${gold?'金色':'普通外观'}</span><h4>${esc(card.name)}</h4><p>${esc(card.text)}</p><p class="cc-receipt-summary">${esc(receiptSummary(receipt))}</p><p class="cc-fine">金色只改变外观，不增加战斗效果。</p><button id="cc-reveal-finish" class="cc-primary" ${phase==='windup'?'hidden':''}>收好，继续</button><button id="cc-reveal-skip" ${phase==='focus'?'hidden':''}>跳过动画，查看结果</button></div></div><button id="cc-reveal-later" class="cc-reveal-later">稍后查看</button><button id="cc-reveal-mute" class="cc-reveal-mute">${localMute||getMuted()?'已静音':'静音'}</button>`;
    reveal.showModal();$('cc-reveal-later').onclick=()=>{if(busy)return;clearTimeout(revealTimer);revealTimer=null;queued.unshift(revealing);revealing=null;reveal.close();stopAudio();markPending();render();};$('cc-reveal-skip').onclick=focusReveal;$('cc-reveal-finish').onclick=finishReveal;$('cc-reveal-mute').onclick=()=>{localMute=true;stopAudio();$('cc-reveal-mute').textContent='已静音';};
    if(!useReduced){playSound(legend,gold);revealTimer=setTimeout(focusReveal,legend?(gold?2600:1900):950);}markPending();
  }
  function focusReveal() {clearTimeout(revealTimer);revealTimer=null;if(!revealing)return;reveal.dataset.phase='focus';$('cc-reveal-skip').hidden=true;$('cc-reveal-finish').hidden=false;$('cc-reveal-finish').focus();}
  async function finishReveal() {
    if(!revealing||busy)return;const id=revealing.receipt.txId;busy=true;$('cc-reveal-finish').disabled=true;
    try{await client.request('acknowledge',{txId:id});shown.add(id);revealing=null;reveal.close();stopAudio();setStatus('卡牌已收好。');}
    catch(e){setStatus('卡牌已经入账，但查看标记尚未保存。刷新后可能再次展示，同一结果不会重扣。');$('cc-reveal-finish').disabled=false;}
    finally{busy=false;render();if(!revealing)showNextReceipt();}
  }
  function stopAudio() {if(audio){try{audio.close();}catch{}audio=null;}}
  function playSound(legend,gold) {
    if(localMute||getMuted())return;
    try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;audio=new Audio();const now=audio.currentTime;
      (legend?(gold?[220,330,440,660,880]:[196,294,392,588]):[330,440]).forEach((hz,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,now+i*.13);gain.gain.linearRampToValueAtTime(.026,now+i*.13+.12);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.13+1.25);osc.connect(gain);gain.connect(audio.destination);osc.start(now+i*.13);osc.stop(now+i*.13+1.3);});
    }catch{stopAudio();}
  }
  openButton.onclick=open;$('cc-close').onclick=closeShell;$('cc-portrait-close').onclick=closeShell;$('cc-refresh').onclick=refresh;
  shell.querySelectorAll('[data-cc-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.ccTab;filter='all';render();});
  confirm.addEventListener('cancel',e=>{if(confirmKind==='transaction'){e.preventDefault();decideQuote(false);}});
  reveal.addEventListener('cancel',e=>{e.preventDefault();focusReveal();});
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden'){stopAudio();focusReveal();}});
  return {receive(d){if((d?.card==='hello'||d?.card==='mute')&&d.muted)stopAudio();return client.receive(d);},connected(){connected=true;client.reconnect();refresh();},open};
}
