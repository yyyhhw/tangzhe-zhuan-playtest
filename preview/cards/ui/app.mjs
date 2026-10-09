import {
  createGame, legalActions, apply, serialize, deserialize,
  chooseAIAction, getReplay, hashState, CARDS, CARD_METADATA, nextRandom, actionsThisTurn, spellDamageBonus, effectiveSpellDamage,
} from '../cardcore.mjs';

import {artForSource, presentationClass} from './presentation.mjs';
import {createActionInputGuard} from './action-input-guard.mjs';
const actionInputGuard = createActionInputGuard();

const $ = (id) => document.getElementById(id);
const HEROES = {
  warrior: {name:'77',role:'战士',mark:'七',power:'英雄技能'},
  mage: {name:'阿宅',role:'法师',mark:'宅',power:'英雄技能'},
  paladin: {name:'珍珠姐',role:'圣骑士',mark:'珠',power:'英雄技能'},
  warlock: {name:'火箭',role:'术士',mark:'火',power:'英雄技能'},
};
const TYPES = {minion:'随从',spell:'法术',weapon:'武器'};
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let game = createGame({rulesSeed:123,aiSeed:456,heroes:['warrior','mage']});
let selected = null;
let paused = document.visibilityState === 'hidden';
let pauseReason = paused ? '页面不可见，点击继续后恢复' : '';
let aiTimer = null;
let aiGeneration = 0;
let commandSerial = 0;
let notice = '';
let uiLog = [];
let importGeneration = 0;
let importBusy = false;

function actions() { return game.phase === 'main' ? legalActions(game) : []; }
function humanTurn() { return game.phase === 'main' && game.active === 0 && !paused; }
function currentSelectionActions() {
  if (!selected || !humanTurn()) return [];
  return actions().filter((a) => a.player === 0 && a.type === selected.type &&
    (selected.type === 'power' || a.source === selected.source));
}
function targetIsLegal(uid) { return currentSelectionActions().some((a) => a.target === uid); }
function cardInfo(cardId) { return (CARDS[cardId] ? {...CARDS[cardId],metadata:CARD_METADATA[cardId]} : null) || {id:cardId,name:String(cardId),cost:'?',type:'spell',text:'未知测试卡牌'}; }
// Assets are looked up by immutable metadata source ID; engine art stays "placeholder".
function artMarkup(card, slot='card-art') {
  const art = artForSource(card.metadata?.sourceId);
  if (!art) return `<span class="${slot} placeholder-art ${card.type === 'minion' ? 'art-type-minion' : esc(card.type)}" aria-hidden="true"><span class="art-fallback">插画待补</span></span>`;
  return `<span class="${slot} original-art" aria-hidden="true"><img src="${esc(art.src)}" width="${art.width}" height="${art.height}" alt="" decoding="async" draggable="false"></span>`;
}
function cardStatsText(card, entity=null) {
  if (card.type === 'minion') return `攻击 ${entity?.atk ?? card.attack} / 生命 ${entity?.hp ?? card.health}`;
  if (card.type === 'weapon') return `攻击 ${entity?.atk ?? card.attack} / 耐久 ${entity?.dur ?? card.durability}`;
  return '';
}
function spellDamageText(card,player=0) {
  const n=effectiveSpellDamage(game,player,card);
  return n===null?'':`当前伤害 ${n}（基础 ${card.effect.n} + 法伤 ${spellDamageBonus(game,player)}）`;
}
function friendlyHero() { return HEROES[game.players[0].classId] || HEROES.warrior; }
function selectedInfo() {
  if (!selected) return null;
  if (selected.type === 'power') {
    const p = game.config.powers;
    const descriptions = {warrior:`获得 ${p.warriorArmor} 点护甲。`,mage:`向一个角色施加 ${p.mageDamage} 点伤害，可选择己方角色。`,paladin:'召唤一个折纸助手测试随从。',warlock:`抽 ${p.warlockDraw} 张牌，并对自己施加 ${p.warlockDamage} 点伤害。`};
    return {name:`${friendlyHero().name} · 英雄技能`,text:descriptions[game.players[0].classId],cost:p.cost};
  }
  const player = game.players[0];
  const entity = [...player.hand, ...player.board].find((c) => c.uid === selected.source);
  if (entity) return {...cardInfo(entity.cardId), entity};
  if (selected.source === player.hero.uid) return {name:`${friendlyHero().name} · 英雄攻击`,text:'使用当前攻击力攻击可选目标。',entity:player.hero};
  return null;
}
function selectableClass(uid, base='') {
  return `${base}${selected?.source === uid ? ' selected' : ''}${targetIsLegal(uid) ? ' valid-target' : ''}`;
}
function cancelAITimer() {
  aiGeneration += 1;
  if (aiTimer !== null) clearTimeout(aiTimer);
  aiTimer = null;
}
function pause(reason='对局已暂停') {
  cancelAITimer();
  paused = true;
  pauseReason = reason;
  selected = null;
  render();
}
function invalidatePendingImport() {
  importGeneration += 1;
  importBusy = false;
  $('import-button').disabled = false;
  // Reset the native selection now: choosing this same file again must emit change.
  // A stale read's finally block must never reset a newer file selection.
  $('import-file').value = '';
}
function resume() {
  if (document.visibilityState === 'hidden') return;
  invalidatePendingImport();
  paused = false;
  pauseReason = '';
  notice = '';
  render();
  scheduleAI();
}
function recordEvent(action, events) {
  const who = action.player === 0 ? '你' : '对手';
  const labels = {end:'结束回合',attack:'发动攻击',power:'使用英雄技能',play:'打出卡牌'};
  const playedCard = events?.find((event) => event.type === 'play')?.cardId;
  let line = `${who}${labels[action.type] || '执行行动'}`;
  if (action.type === 'play' && playedCard) line += `：${cardInfo(playedCard).name}`;
  if (action.target) line += '（目标已结算）';
  uiLog.push({revision:game.revision,text:line,eventCount:events?.length || 0});
  if (uiLog.length > 100) uiLog.shift();
}
function commitAction(action, fromAI=false, inputEvent=null) {
  if (paused || game.phase !== 'main') return false;
  if (fromAI ? game.active !== 1 : game.active !== 0) return false;
  let command = action;
  if (!fromAI) command = {...action,commandId:`ui-${game.revision}-${++commandSerial}`,expectedRevision:game.revision};
  const before = game;
  let result;
  try { result = apply(game, command); }
  catch (err) {
    notice = `规则执行失败：${err.message || '未知错误'}`;
    pause('规则执行失败，请检查快照后再继续');
    return false;
  }
  if (!result.ok) {
    notice = `操作未执行：${result.error?.message || result.error?.code || '动作已失效'}`;
    if (fromAI) pause('AI 操作未通过校验，请检查快照');
    else render();
    return false;
  }
  game = result.game;
  if (game.revision !== before.revision && !result.duplicate) {
    recordEvent(action,result.events);
    if (!fromAI) actionInputGuard.remember(inputEvent);
  }
  selected = null;
  notice = result.duplicate ? '重复操作已忽略。' : '';
  render();
  scheduleAI();
  return true;
}
function scheduleAI() {
  if (aiTimer !== null || paused || document.visibilityState === 'hidden' || game.phase !== 'main' || game.active !== 1) return;
  const generation = aiGeneration;
  const revision = game.revision;
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (generation !== aiGeneration || paused || document.visibilityState === 'hidden' || game.revision !== revision || game.phase !== 'main' || game.active !== 1) return;
    let command;
    try {
      if (actionsThisTurn(game,1) >= 30) {
        const safeEnd = actions().find((a) => a.player === 1 && a.type === 'end');
        if (!safeEnd) { pause('AI 达到安全步数上限，等待人工检查'); return; }
        command = {...safeEnd,commandId:`ui-guard-${game.revision}-${++commandSerial}`,expectedRevision:game.revision,_ai:{algorithm:'greedy-v1',before:game.rng.aiState,after:nextRandom(game.rng.aiState)}};
      } else command = chooseAIAction(game);
      if (!command) { pause('AI 无可执行动作，等待人工检查'); return; }
      commitAction(command,true);
    } catch (err) {
      notice = `AI 已停止：${err.message || '未知错误'}`;
      pause('AI 发生异常，请检查快照后再继续');
    }
  }, 260);
}
function resultText() {
  if (!game.result) return '对局结束';
  if (game.result.winner === null) return '平局';
  return game.result.winner === 0 ? '你赢得了这一章' : '这一章，对手获胜';
}
function renderPlayer(index) {
  const p = game.players[index];
  const h = p.hero;
  const definition = HEROES[p.classId] || {name:h.name,role:'英雄',mark:'册'};
  const canAttack = humanTurn() && index === 0 && actions().some((a) => a.type === 'attack' && a.source === h.uid);
  const targetable = targetIsLegal(h.uid);
  const canPower = humanTurn() && index === 0 && actions().some((a) => a.type === 'power');
  const equipped = p.weapon ? cardInfo(p.weapon.cardId) : null;
  const manaDots = Array.from({length:Math.min(p.maxMana,20)},(_,n) => `<i class="${n >= p.mana ? 'spent' : ''}"></i>`).join('');
  $(index === 0 ? 'player' : 'opponent').innerHTML = `
    <button class="${selectableClass(h.uid,'hero-button')}" data-class="${esc(p.classId)}" data-entity="${esc(h.uid)}" data-player="${index}" ${!canAttack && !targetable ? 'disabled' : ''} aria-label="${esc(definition.name)} ${esc(definition.role)}，生命 ${h.hp}，护甲 ${h.armor || 0}${targetable ? '，可选目标' : ''}">
      <span class="hero-avatar" aria-hidden="true">${esc(definition.mark)}</span><span><strong class="hero-title">${esc(definition.name)} · ${esc(definition.role)}</strong><span class="hero-stats"><span class="hp">♥ ${h.hp}/${h.maxHp}</span> <span class="armor">⬡ ${h.armor || 0}</span>${h.attack > 0 ? ` · ⚔ ${h.attack}` : ''}</span></span>
    </button>
    <div class="player-metadata"><span class="mana-label">法力 ${p.mana}/${p.maxMana}</span><span class="mana-dots" aria-hidden="true">${manaDots}</span><div class="resource-line"><span>牌库 ${p.deck.length}</span><span>手牌 ${p.hand.length}</span><span>疲劳 ${p.fatigue}</span><span class="spell-damage-total">法伤 +${spellDamageBonus(game,index)}</span>${p.weapon ? `<span class="weapon-status">武器 · ${esc(equipped.name)} · 攻击 ${p.weapon.atk} / 耐久 ${p.weapon.dur}</span>` : ''}</div></div>
    ${index === 0 ? `<button id="hero-power" class="power-button ${selected?.type === 'power' ? 'selected' : ''}" ${!canPower ? 'disabled' : ''}>英雄技能<br><small>${h.powerUsed ? '本回合已用' : '点击查看 / 选择'}</small></button>` : ''}`;
}
function renderBoard(index) {
  const p = game.players[index];
  const el = $(index === 0 ? 'friendly-board' : 'enemy-board');
  if (!p.board.length) { el.innerHTML = '<span class="empty-board">尚无随从</span>'; return; }
  const legal = actions();
  el.innerHTML = p.board.map((m) => {
    const c = cardInfo(m.cardId);
    const canAttack = humanTurn() && index === 0 && legal.some((a) => a.type === 'attack' && a.source === m.uid);
    const targetable = targetIsLegal(m.uid);
    const taunt=m.keywords?.includes('taunt');
    const charge=m.keywords?.includes('charge');
    const spellDamage=m.hp>0?(c.spellDamage??0):0;
    const status = legal.some((a) => a.type === 'attack' && a.source === m.uid) ? '可攻击' : m.frozen ? '已冻结' : m.attacksLeft <= 0 ? '已行动' : m.summoningSick && !charge ? '刚刚入场' : '等待回合';
    return `<button class="${selectableClass(m.uid,taunt?'minion taunt':'minion')}" data-class="${presentationClass(c.metadata)}" data-entity="${esc(m.uid)}" data-player="${index}" ${!canAttack && !targetable ? 'disabled' : ''} aria-label="${esc(c.name)}，攻击 ${m.atk}，生命 ${m.hp}，${status}${taunt ? '，嘲讽' : ''}${charge ? '，冲锋' : ''}${spellDamage ? `，法术伤害 +${spellDamage}` : ''}${targetable ? '，可选目标' : ''}"><span class="minion-name">${esc(c.name)}</span>${taunt ? '<span class="taunt-badge">嘲讽</span>' : ''}${charge ? '<span class="charge-badge">冲锋</span>' : ''}${spellDamage ? `<span class="spell-damage-badge">法伤 +${spellDamage}</span>` : ''}${artMarkup(c,'minion-art')}<span class="minion-stats"><b class="attack-stat"><span class="stat-label">攻</span> ${m.atk}</b><span class="minion-status">${index === 0 ? status : ''}</span><b class="health-stat"><span class="stat-label">生</span> ${m.hp}</b></span></button>`;
  }).join('');
}
function renderHand() {
  const p = game.players[0];
  $('hand-count').textContent = `(${p.hand.length})`;
  const legal = actions();
  $('hand').innerHTML = p.hand.length ? p.hand.map((item) => {
    const c = cardInfo(item.cardId);
    const playable = humanTurn() && legal.some((a) => a.type === 'play' && a.source === item.uid);
    return `<button class="${selectableClass(item.uid,'hand-card')}${playable ? ' playable' : ''}" data-class="${presentationClass(c.metadata)}" data-card="${esc(item.uid)}" aria-label="${esc(c.name)}，${c.cost} 点法力，${esc(cardStatsText(c))}，${esc(c.text || '')}${spellDamageText(c)?'，'+esc(spellDamageText(c)):''}${playable ? '，可出牌' : '，点击查看'}" aria-pressed="${selected?.source === item.uid}"><span class="card-heading"><span class="cost"><small>费</small>${c.cost}</span><strong>${esc(c.name)}</strong></span><span class="card-type">${esc(TYPES[c.type] || c.type)} · ${esc(c.metadata?.classLabel || '实验生成物')}${playable ? ' · 可出牌' : ''}</span>${artMarkup(c)}<span class="card-preview">${esc(c.text || '原创测试卡牌')}</span>${spellDamageText(c)?`<span class="effective-spell-damage">${esc(spellDamageText(c))}</span>`:''}<span class="card-bottom">${esc(cardStatsText(c) || '法术')}</span></button>`;
  }).join('') : '<span class="empty-board">手牌为空</span>';
}
function renderSelection() {
  const info = selectedInfo();
  const legal = currentSelectionActions();
  const noTarget = legal.find((a) => !a.target);
  let content;
  if (info) {
    const hint = paused ? '已暂停。点击「继续」恢复后操作。' : !humanTurn() ? '可查看卡牌，等待你的回合。' : legal.some((a) => a.target) ? '请点击金色边框的目标。' : noTarget ? '确认后执行，本操作不会自动触发。' : '当前无法使用：可能受法力、场位、次数或目标限制。';
    const statsText = cardStatsText(info, info.entity);
    const stats = statsText ? ` · ${statsText}` : '';
    const selectedArt = artForSource(info.metadata?.sourceId) ? artMarkup(info, 'selection-art') : '';
    content = `<div class="selection-detail">${selectedArt}<div class="selection-copy"><strong>${esc(info.name)}</strong>${info.cost !== undefined ? ` · ${info.cost} 法力` : ''}${esc(stats)}<p>${esc(info.text || '原创测试随从')}</p>${spellDamageText(info)?`<p class="effective-spell-damage">${esc(spellDamageText(info))}</p>`:''}${info.metadata ? `<p class="source-info">来源 ${esc(info.metadata.sourceId)} · ${esc(info.metadata.classLabel)}${info.metadata.tribe ? ` · 种族 ${esc(info.metadata.tribe)}（仅保留元数据）` : ''}<br>原始效果：${esc(info.metadata.sourceEffectText)}</p>` : ''}<p class="selection-hint">${hint}</p></div></div>`;
  } else if (game.phase === 'ended') content = `<strong>${esc(resultText())}</strong><p>${esc(game.result?.reason || '')} · 可下载快照或开始新对局。</p>`;
  else if (paused) content = `<strong>对局已暂停</strong><p>${esc(pauseReason)}。点击上方「继续」恢复。</p>`;
  else if (game.active === 1) content = '<strong>对手正在思考</strong><p>随时可以暂停。你的操作不会由计时器代替。</p>';
  else content = '<strong>轮到你了</strong><p>点选手牌查看全文，或选择可攻击的随从。</p>';
  $('selection').innerHTML = content;
  $('confirm').hidden = !noTarget;
  $('confirm').textContent = selected?.type === 'power' ? '确认使用技能' : '确认出牌';
  $('cancel').hidden = !selected;
  $('end-turn').disabled = !humanTurn() || !actions().some((a) => a.player === 0 && a.type === 'end');
}
function render() {
  const focus = document.activeElement;
  const focusMarker = focus?.dataset?.card ? ['data-card',focus.dataset.card] : focus?.dataset?.entity ? ['data-entity',focus.dataset.entity] : focus?.id ? ['id',focus.id] : null;
  const scrollPositions = ['hand','enemy-board','friendly-board'].map((id) => [id,$(id).scrollLeft]);
  $('pause').textContent = paused ? '继续' : '暂停';
  $('pause').setAttribute('aria-pressed',String(paused));
  $('pause').disabled = game.phase === 'ended';
  const status = game.phase === 'ended' ? resultText() : paused ? '已暂停' : game.active === 0 ? '你的回合' : '对手回合';
  $('turn-bar').innerHTML = `<span>第 ${game.turn} 回合 · <strong>${esc(status)}</strong></span><span class="${paused ? 'paused-pill' : ''}">${paused ? 'AI 已停止 · 手动继续' : '规则与 AI 随机流独立'}</span>`;
  const config = game.config || {};
  $('rules-label').textContent = `${config.heroHealth ?? 30} HP / ${config.deckSize ?? 30} 牌（实验） / ${config.boardLimit ?? config.maxBoard ?? 7} 场`;
  renderPlayer(1); renderBoard(1); renderBoard(0); renderPlayer(0); renderHand(); renderSelection();
  for (const [id,left] of scrollPositions) $(id).scrollLeft = left;
  if (focusMarker) document.querySelector(`[${focusMarker[0]}="${CSS.escape(focusMarker[1])}"]`)?.focus({preventScroll:true});
  $('notice').textContent = notice;
  $('revision-label').textContent = `状态 #${game.revision} · ${game.rulesVersion} · 卡池 ${game.cardPoolVersion}`;
  $('log').innerHTML = uiLog.length ? uiLog.slice().reverse().map((l) => `<li>#${l.revision} · ${esc(l.text)}${l.eventCount ? ` · ${l.eventCount} 个规则事件` : ''}</li>`).join('') : '<li>新对局已准备好。完整动作记录见「下载回放」。</li>';
}
function onEntityClick(uid,index,event) {
  if (!humanTurn()) return;
  if (selected) {
    const legalTarget = currentSelectionActions().find((a) => a.target === uid);
    if (legalTarget) { commitAction(legalTarget,false,event); return; }
  }
  if (index === 0 && actions().some((a) => a.type === 'attack' && a.source === uid)) {
    actionInputGuard.reset();
    selected = {type:'attack',source:uid}; notice = ''; render();
  }
}
$('app').addEventListener('click',(event) => {
  if (actionInputGuard.ignores(event)) return;
  const card = event.target.closest('[data-card]');
  if (card) { selected = selected?.source === card.dataset.card ? null : {type:'play',source:card.dataset.card}; if (selected) actionInputGuard.reset(); notice = ''; render(); return; }
  const entity = event.target.closest('[data-entity]');
  if (entity) { onEntityClick(entity.dataset.entity,Number(entity.dataset.player),event); return; }
  if (event.target.closest('#hero-power') && humanTurn()) { actionInputGuard.reset(); selected = {type:'power'}; notice = ''; render(); }
});
$('pause').addEventListener('click',() => paused ? resume() : pause());
$('cancel').addEventListener('click',() => { selected = null; render(); });
$('confirm').addEventListener('click',(event) => { if (actionInputGuard.ignores(event)) return; const action = currentSelectionActions().find((a) => !a.target); if (action) commitAction(action,false,event); });
$('end-turn').addEventListener('click',(event) => {
  if (actionInputGuard.ignores(event)) return;
  const end = actions().find((a) => a.player === 0 && a.type === 'end');
  if (humanTurn() && end) { selected = null; commitAction(end,false,event); }
});
$('hero-options').innerHTML = Object.entries(HEROES).map(([id,h],index) => `<label class="hero-option"><input type="radio" name="hero" value="${id}" ${index === 0 ? 'checked' : ''}><span>${h.name}<small>${h.role}</small></span></label>`).join('');
$('new-game').addEventListener('click',() => { invalidatePendingImport(); pause('设置已打开'); $('setup-error').textContent = ''; $('setup-dialog').showModal(); });
$('snapshot-open').addEventListener('click',() => { pause('快照窗口已打开'); $('import-result').textContent = ''; $('snapshot-dialog').showModal(); });
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click',() => {
  if (button.dataset.close === 'snapshot-dialog') invalidatePendingImport();
  $(button.dataset.close).close();
}));
$('snapshot-dialog').addEventListener('cancel',() => invalidatePendingImport());
$('snapshot-dialog').addEventListener('close',() => {
  // Native close is queued; do not cancel a new import after the dialog reopens.
  if (!$('snapshot-dialog').open) invalidatePendingImport();
});
$('setup-form').addEventListener('submit',(event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const config = Object.fromEntries(['heroHealth','deckSize','boardLimit','handLimit','maxMana'].map((key) => [key, Number(data.get(key))]));
  try {
    const nextGame = createGame({rulesSeed:Number(data.get('rulesSeed')),aiSeed:Number(data.get('aiSeed')),heroes:[data.get('hero'),data.get('opponentHero')],config});
    cancelAITimer(); invalidatePendingImport();
    actionInputGuard.reset();
    game = nextGame; paused = false; pauseReason = ''; selected = null; uiLog = []; notice = '';
    $('setup-dialog').close(); render(); scheduleAI();
  } catch (err) { $('setup-error').textContent = `无法开始：${err.message || '实验参数无效'}`; }
});
function download(filename,text) {
  const url = URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('download').addEventListener('click',() => { download(`bookcard-snapshot-r${game.revision}.json`,serialize(game)); $('import-result').textContent = '已准备下载当前快照。'; });
$('download-replay').addEventListener('click',() => { download(`bookcard-replay-r${game.revision}.json`,JSON.stringify(getReplay(game),null,2)); $('import-result').textContent = '已准备下载动作回放。回放用于技术复核，恢复进度请导入快照。'; });
function importSnapshot(text) {
  try {
    const candidate = deserialize(text);
    cancelAITimer(); actionInputGuard.reset(); game = candidate; selected = null; paused = true; pauseReason = '快照已导入'; uiLog = []; notice = '快照已导入。关闭窗口后点击「继续」恢复。';
    $('import-result').textContent = notice; render(); return true;
  } catch (err) {
    $('import-result').textContent = `导入失败，当前对局已保留：${err.message || '快照无效'}`; return false;
  }
}
$('import-button').addEventListener('click',() => { if (!importBusy) { importGeneration += 1; pause('正在导入快照'); importSnapshot($('import-text').value); } });
$('import-file').addEventListener('change',async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  // Keep this File reference, then reset native selection before any asynchronous work.
  // Re-selecting the same file must trigger change, including while this read is pending.
  event.target.value = '';
  pause('正在读取快照'); const generation = ++importGeneration; importBusy = true; $('import-button').disabled = true;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB 限制');
    const text = await file.text();
    if (generation === importGeneration) importSnapshot(text);
  } catch (err) { if (generation === importGeneration) $('import-result').textContent = `导入失败，当前对局已保留：${err.message}`; }
  finally { if (generation === importGeneration) { importBusy = false; $('import-button').disabled = false; } }
});
document.addEventListener('visibilitychange',() => { if (document.visibilityState === 'hidden') pause('页面已隐藏，返回后请手动继续'); });
window.addEventListener('pagehide',() => pause('页面已离开，返回后请手动继续'));
window.addEventListener('pageshow',(event) => { if (event.persisted) pause('页面已恢复，请手动继续'); });
document.addEventListener('keydown',(event) => {
  // Held Enter/Space is one intent. A released-and-repressed key remains immediate.
  if (event.repeat && ['Enter',' ','Spacebar'].includes(event.key) && event.target?.closest?.('#confirm,#cancel,#end-turn,[data-card],[data-entity],#hero-power')) { event.preventDefault(); return; }
  if (event.key === 'Escape' && selected) { selected = null; render(); }
});
render(); scheduleAI();

// Read-only diagnostics for local browser regression checks. No global state hooks.
export function getDiagnostics() {
  return {revision:game.revision,hash:hashState(game),active:game.active,phase:game.phase,paused,aiScheduled:aiTimer !== null,aiSteps:game.active === 1 ? actionsThisTurn(game,1) : 0,selected:selected ? {...selected} : null,turn:game.turn,config:JSON.parse(JSON.stringify(game.config))};
}
