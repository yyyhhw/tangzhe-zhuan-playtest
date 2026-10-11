import {defaultDeck} from '../cardcore.mjs?v=card-shield-10';
import {createSavedDeckStore,emptyLibrary,deckStorageKey} from './saved-decks.mjs?v=saved-decks-1';
import {CLASS_LABELS,escapeHTML as esc,copiesFor,inspectDraft} from './collection-state.mjs?v=saved-decks-1';

/** Recipe editing only. Ownership, wallet and match state are never written here. */
export function createDeckEditor({document:doc, getSnapshot, getCards, confirm, onStart, canStart=()=>false, getBusy=()=>false, isVisible=()=>true}) {
  const win=doc.defaultView;
  let storage;try{storage=win.localStorage;}catch{}
  const store=createSavedDeckStore({storage,key:deckStorageKey(new URL(import.meta.url).href),locks:win.navigator.locks});
  let loaded=store.load(), library=loaded.data||emptyLibrary(), raw=loaded.raw;
  let activeClass=library.activeClassId||'warrior', draft, original='', message='', saving=false, container=null;
  const classes=Object.keys(CLASS_LABELS).filter(id=>id!=='neutral');
  const clone=x=>JSON.parse(JSON.stringify(x));
  const serialize=d=>JSON.stringify({id:d.id,name:d.name,classId:d.classId,cards:d.cards});
  const dirty=()=>serialize(draft)!==original;
  function choose(classId,id) {
    const saved=library.decks.find(d=>d.id===id&&d.classId===classId);
    activeClass=classId;draft=saved?clone(saved):{id:null,name:'',classId,cards:defaultDeck(classId)};
    original=serialize(draft);
  }
  choose(activeClass,library.selectedDeckIds[activeClass]);
  const errorText=code=>({'conflict':'另一页面已更新牌组。当前草稿保留；请重新读取后再编辑，未覆盖另一页面。','future-version':'牌组来自较新版本，当前只读；原始数据保留。','corrupt':'牌组存档损坏，当前只读；原始数据保留。','unavailable-locks':'浏览器不支持安全多标签保存，当前只读。请使用支持 Web Locks 的新版浏览器。','storage-read':'无法读取牌组存档；当前只读。','storage-write':'保存失败，未确认写入；当前草稿保留，请重新读取核对。','storage-verify':'写入结果无法确认；当前草稿保留，请重新读取核对。','duplicate-name':'本职业已有同名牌组，请换一个名称。','unavailable':'牌组存储不可用。','invalid-library':'牌组格式无效，未保存。','invalid-deck':'牌组格式无效，未保存。'}[code]||`牌组操作失败（${code||'unknown'}）。`);
  if(!loaded.ok)message=errorText(loaded.error);
  function askDiscard(action) {if(dirty())confirm('放弃未保存的编辑？','当前草稿有更改。继续会放弃这些更改；已保存牌组、收藏和当前对局不变。',action);else action();}
  async function commit(next,done) {
    if(saving||getBusy())return;
    if(!loaded.ok){message=errorText(loaded.error);render();return;}
    saving=true;render();
    const result=await store.commit(next,raw);
    saving=false;
    if(!result.ok){message=errorText(result.error);render();return;}
    loaded=result;library=result.data;raw=result.raw;done?.();render();
  }
  function switchDeck(classId,id) {askDiscard(()=>{const next=clone(library);next.activeClassId=classId;next.selectedDeckIds[classId]=id||null;commit(next,()=>{choose(classId,id);message='已切换编辑牌组，当前对局不变。';});});}
  function validateRecipe() {
    const cards=new Map(getCards().map(c=>[c.cardId,c])), counts=new Map();
    if(draft.cards.length>30)return '最多保存 30 张。';
    for(const id of draft.cards){const c=cards.get(id),n=(counts.get(id)||0)+1;counts.set(id,n);if(!c)return '请先移除当前牌池中不存在的卡牌。';if(!['neutral',draft.classId].includes(c.classId))return '只能保存本职业及公共牌。';if(!Number.isInteger(c.deckCap)||n>c.deckCap)return `${c.name} 超过同名上限，或当前规则尚未连接。`;}
    return '';
  }
  function save(asNew=false) {
    if(saving||getBusy())return;
    const name=draft.name.trim(),problem=validateRecipe();
    if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name)){message='请填写 1–60 字的牌组名称。';render();return;}
    if(problem){message=problem;render();return;}
    const id=asNew||!draft.id?win.crypto?.randomUUID?.():draft.id;
    if(!id){message='当前浏览器不能生成牌组编号，未保存。';render();return;}
    if(library.decks.some(d=>d.classId===activeClass&&d.id!==id&&d.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase())){message='本职业已有同名牌组，请换一个名称。';render();return;}
    const next=clone(library),saved={id,name,classId:activeClass,cards:[...draft.cards]},at=next.decks.findIndex(d=>d.id===id);
    if(at<0&&next.decks.length>=100){message='已保存 100 套牌组，达到本地上限。可保存更改到已有牌组。';render();return;}
    if(at<0)next.decks.push(saved);else next.decks[at]=saved;
    next.activeClassId=activeClass;next.selectedDeckIds[activeClass]=id;
    commit(next,()=>{choose(activeClass,id);message=`已保存「${name}」。${inspectDraft(draft,getCards(),getSnapshot()).valid?'可验证开局。':'配方尚未齐备，可继续补齐；不能用于开局。'}`;});
  }
  function render(target=container) {
    if(target)container=target;if(!container||!isVisible())return;
    const policies=getCards(),snapshot=getSnapshot(),byId=new Map(policies.map(c=>[c.cardId,c]));
    const available=policies.filter(c=>c.classId==='neutral'||c.classId===activeClass), counts=new Map();
    for(const id of draft.cards)counts.set(id,(counts.get(id)||0)+1);
    const check=inspectDraft(draft,policies,snapshot),size=draft.cards.length,remaining=size<30?`还差 ${30-size} 张`:size>30?`超出 ${size-30} 张`:'数量齐备';
    let missing=0;for(const [id,n] of counts){const held=copiesFor(snapshot,id);missing+=Math.max(0,n-held.normal-held.golden);}
    const disabled=saving||getBusy(),readonly=!loaded.ok;
    container.innerHTML=`<section class="cc-deck-editor" aria-label="保存牌组编辑器"><header class="cc-deck-toolbar"><label>职业<select id="de-class">${classes.map(id=>`<option value="${id}" ${id===activeClass?'selected':''}>${esc(CLASS_LABELS[id])}</option>`).join('')}</select></label><label>已保存牌组<select id="de-list"><option value="">基础模板 · 只读原本</option>${library.decks.filter(d=>d.classId===activeClass).map(d=>`<option value="${esc(d.id)}" ${d.id===draft.id?'selected':''}>${esc(d.name)} · ${d.cards.length}/30</option>`).join('')}</select></label><button id="de-new">新建空牌组</button><button id="de-reload">重新读取</button></header><div class="cc-deck-summary"><strong id="de-count">已选 ${size}/30</strong><span>${remaining} · 缺卡 ${missing} 张</span><span id="de-dirty">${dirty()?'有未保存更改':draft.id?'已保存':'基础模板的编辑副本'}</span></div><div class="cc-deck-save"><label>牌组名称<input id="de-name" maxlength="60" value="${esc(draft.name)}" placeholder="给这套牌起个名字" autocomplete="off"></label><button id="de-save" class="cc-primary" ${readonly?'disabled':''}>${saving?'保存中…':draft.id?'保存更改':'保存为新牌组'}</button><button id="de-save-as" ${readonly?'disabled':''}>另存一套</button><button id="de-reset">重置为基础牌组</button><button id="de-template">查看基础模板</button></div><p class="cc-fine">基础模板始终只读。重置仅改当前草稿；点击保存才替换这套牌组。缺卡配方可以保存，开局仍须通过收藏验证。</p><p id="de-message" class="cc-deck-message" role="status" aria-live="polite">${esc(message||check.issues[0]||'30 张已齐备，可验证并开始新对局。')}</p><div class="cc-deck-columns"><div><h3>可选卡牌</h3><div class="cc-deck-catalog">${available.map(c=>{const n=counts.get(c.cardId)||0,h=copiesFor(snapshot,c.cardId),cap=Number.isInteger(c.deckCap)?Math.max(0,Math.min(c.deckCap-n,30-size)):0,owned=h.normal+h.golden;return `<article class="cc-deck-card"><button class="cc-deck-card-info" data-de-info="${esc(c.cardId)}" aria-label="查看 ${esc(c.name)} 详情"><strong>${c.cost} 费 · ${esc(c.name)}</strong><span>${esc(c.text)}</span></button><small>持有 ${owned}（普 ${h.normal}/金 ${h.golden}） · 入组 ${n}<br>可加入 ${cap} · 尚缺 ${Math.max(0,n-owned)}</small><button data-de-add="${esc(c.cardId)}" ${cap===0?'disabled':''} aria-label="加入一张 ${esc(c.name)}">＋ 加入${owned<=n?'配方':''}</button></article>`;}).join('')}</div></div><aside class="cc-deck-recipe"><h3>当前配方</h3><p class="cc-fine">点击减号移除一张；持有数量含普通与金色。</p>${[...counts].map(([id,n])=>{const c=byId.get(id),h=copiesFor(snapshot,id),lack=Math.max(0,n-h.normal-h.golden);return `<div class="cc-deck-row"><span>${esc(c?.name||id)} <strong>×${n}</strong>${lack?`<small class="cc-warning">缺 ${lack} 张</small>`:''}</span><button data-de-remove="${esc(id)}" aria-label="移除一张 ${esc(c?.name||id)}">−</button></div>`;}).join('')||'<p>空牌组，先从左侧加入卡牌。</p>'}<button id="de-start" class="cc-primary" ${!check.valid||!canStart()?'disabled':''}>验证并开始新对局</button><p class="cc-fine">保存和切换只影响牌组编辑。新开局会另行确认。</p></aside></div></section>`;
    const $=id=>container.querySelector('#'+id);
    $('de-name').oninput=e=>{draft.name=e.target.value;$('de-dirty').textContent=dirty()?'有未保存更改':draft.id?'已保存':'基础模板的编辑副本';};
    $('de-class').onchange=e=>{const next=e.target.value;e.target.value=activeClass;switchDeck(next,library.selectedDeckIds[next]);};
    $('de-list').onchange=e=>{const id=e.target.value;e.target.value=draft.id||'';switchDeck(activeClass,id);};
    $('de-new').onclick=()=>askDiscard(()=>{draft={id:null,name:'',classId:activeClass,cards:[]};original=serialize(draft);message='新建空牌组，命名后可保存。';render();});
    $('de-save').onclick=()=>save();$('de-save-as').onclick=()=>save(true);
    $('de-reset').onclick=()=>confirm('重置当前编辑稿？','会用本职业基础牌组替换当前草稿。已保存牌组、其他套牌、收藏和当前对局不变；保存后才替换这套牌组。',()=>{draft.cards=defaultDeck(activeClass);message='已重置当前草稿，尚未保存。';render();});
    $('de-template').onclick=()=>{const entries=new Map();for(const id of defaultDeck(activeClass))entries.set(id,(entries.get(id)||0)+1);confirm(`${CLASS_LABELS[activeClass]} · 基础模板（只读）`,[...entries].map(([id,n])=>`${byId.get(id)?.name||id} ×${n}`).join('；'),()=>{});};
    $('de-reload').onclick=()=>askDiscard(()=>{const r=store.load();loaded=r;if(r.ok){library=r.data;raw=r.raw;choose(library.activeClassId||'warrior',library.selectedDeckIds[library.activeClassId||'warrior']);message='已重新读取已保存牌组。';}else message=errorText(r.error);render();});
    container.querySelectorAll('[data-de-add]').forEach(b=>b.onclick=()=>{const c=byId.get(b.dataset.deAdd),n=draft.cards.filter(id=>id===c.cardId).length;if(n<c.deckCap&&draft.cards.length<30){draft.cards.push(c.cardId);message='';render();}});
    container.querySelectorAll('[data-de-remove]').forEach(b=>b.onclick=()=>{const at=draft.cards.indexOf(b.dataset.deRemove);if(at>=0)draft.cards.splice(at,1);message='';render();});
    container.querySelectorAll('[data-de-info]').forEach(b=>b.onclick=()=>{const c=byId.get(b.dataset.deInfo);confirm(c.name,`${c.cost} 费。${c.text}`,()=>{});});
    $('de-start').onclick=()=>onStart({classId:activeClass,cards:[...draft.cards]});
    if(disabled)container.querySelectorAll('button,select,input').forEach(el=>el.disabled=true);
  }
  return {render};
}
