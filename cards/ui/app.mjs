import {createCardBgm} from './bgm.mjs?v=formal-cards-candidate-7';
import {mechanismText, mechanismLabels, powerDescription, createHeavyFeedback} from './readable-effects.mjs?v=formal-cards-candidate-7';
import {createMatchStorageScope} from './match-storage-scope.mjs?v=formal-cards-candidate-7';
import {mountCollection} from './collection.mjs?v=formal-cards-candidate-7';
import {
  createGame, legalActions, apply, serialize, deserialize,
  chooseAIAction, getReplay, hashState, CARDS, CARD_METADATA, nextRandom, actionsThisTurn, spellDamageBonus, effectiveSpellDamage,
} from '../cardcore.mjs?v=card-shield-10';
import * as cardcore from '../cardcore.mjs?v=card-shield-10';
import {createCardSave} from './save.mjs?v=formal-cards-candidate-7';

import {artForCard, presentationClass} from './presentation.mjs?v=card-shield-10';
import {createSpellFeedback, planSpellFeedback, keywordLabels, clonePublicCharacter, addShieldBreak, SPELL_TIMING, SHIELD_ATTACK_TIMING} from './spell-feedback.mjs?v=card-shield-10a';
import {createActionInputGuard} from './action-input-guard.mjs?v=card-s1';
import {attachBattleGestures} from './gesture-input.mjs?v=card-feedback-6a';
const actionInputGuard = createActionInputGuard();
let gestures = null;
const portrait = matchMedia('(orientation: portrait)');

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
let handExpanded = false;
let paused = document.visibilityState === 'hidden';
let pauseReason = paused ? '页面不可见，点击继续后恢复' : '';
let aiTimer = null;
let aiGeneration = 0;
let commandSerial = 0;
let notice = '';
let resultRecoveryNote = '';
let uiLog = [];
let recentPlayedCards = [];
let importGeneration = 0;
let importBusy = false;
const embed = new URLSearchParams(location.search).get('embed') === '1' && window.parent !== window;
const matchScope = createMatchStorageScope({storage:localStorage,locks:navigator.locks,embedded:embed,hostname:location.hostname,qaRequested:new URLSearchParams(location.search).get('collectionQA') === '1'});
const store = createCardSave({storage:matchScope.storage,locks:matchScope.locks,core:cardcore});
let saveBusy = false, saveFailure = null, saveNote = '', lastSave = null, tmpLeftCount = 0;
let restoreArmed = false, abandonArmed = false;
let parentPort = null, muted = false, closing = false, closeSent = false;
let collection = null;
const bgm=createCardBgm({url:new URL('./assets/audio/the-old-tower-inn-loop.m4a',import.meta.url)});
for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{if(e.isTrusted)bgm.unlock();},{capture:true});
window.addEventListener('pagehide',()=>bgm.update({hidden:true}));
const freshGame = () => createGame({rulesSeed:123,aiSeed:456,heroes:['warrior','mage']});

function actions() { return game.phase === 'main' ? legalActions(game) : []; }
function humanTurn() { return !spellFX.active() && game.phase === 'main' && game.active === 0 && !paused && !saveBusy && !saveFailure && !portrait.matches; }
// Availability comes only from legalActions; explanations never enable a move.
function inactiveLabel() {
  return game.phase !== 'main' ? '已结束' : spellFX.active() ? '反馈中' : paused || portrait.matches ? '已暂停' : saveBusy || saveFailure ? '保存中' : game.active !== 0 ? '等回合' : '';
}
function handAvailability(item, card, legal) {
  const inactive = inactiveLabel();
  if (inactive) return {ready:false,label:inactive,kind:'waiting'};
  if (legal.some(a => a.player === 0 && a.type === 'play' && a.source === item.uid)) return {ready:true,label:'可出',kind:'ready'};
  const p = game.players[0];
  if (card.cost > p.mana) return {ready:false,label:'缺法力',kind:'mana'};
  if (card.type === 'minion' && p.board.length >= game.config.boardLimit) return {ready:false,label:'场已满',kind:'blocked'};
  return {ready:false,label:'不可出',kind:'blocked'};
}
function attackAvailability(entity,index,legal) {
  if (index !== 0) return {ready:false,label:'',kind:'enemy'};
  const inactive = inactiveLabel();
  if (inactive) return {ready:false,label:inactive,kind:'waiting'};
  if (legal.some(a => a.player === 0 && a.type === 'attack' && a.source === entity.uid)) return {ready:true,label:'⚔ 可攻击',kind:'ready'};
  if (entity.frozen) return {ready:false,label:'❄ 冻结',kind:'frozen'};
  if ((entity.atk ?? entity.attack) <= 0) return {ready:false,label:'无攻击',kind:'waiting'};
  if (entity.summoningSick && !entity.keywords?.includes('charge')) return {ready:false,label:'Zz 待命',kind:'sleeping'};
  if (entity.attacksLeft <= 0) return {ready:false,label:'已行动',kind:'used'};
  return {ready:false,label:'无目标',kind:'blocked'};
}
function manaDots(p) {
  return Array.from({length:Math.min(Math.max(p.maxMana,p.mana),30)},(_,n) => `<i class="${n >= p.maxMana ? 'temporary' : n >= p.mana ? 'spent' : ''}"></i>`).join('');
}
// Purely visual, bounded feedback. Never delays or issues a game command.
const ATTACK_MOTION_MS = 1000;
const COMBAT_FEEDBACK_MS = 1250;
const AI_ACTION_INTERVAL_MS = 1600;
// Reading time for an already-resolved public play; no rules or animation gate.
const AI_CARD_READ_MS = 2800;
let combatFX = null;
const heavyFX = createHeavyFeedback({document,matchMedia});
const spellFX = createSpellFeedback({document,matchMedia,isBlocked:()=>paused || portrait.matches || !!saveFailure || document.visibilityState === 'hidden',onFinish:()=>{render();scheduleAI();}});
function clearCombatFX() {
  heavyFX.clear();
  spellFX.clear();
  if (!combatFX) return;
  const previous = combatFX;
  combatFX = null;
  clearTimeout(previous.timer);
  for (const animation of previous.animations) { try { animation.cancel(); } catch {} }
  previous.layer.remove();
}
function captureCombat(action) {
  // Capture all existing characters before resolution: spells, skills, random
  // targets and fatigue may hurt entities other than the command's target.
  const nodes = {};
  for (const el of document.querySelectorAll('[data-entity]')) {
    const uid = el.dataset.entity;
    nodes[uid] = {sceneClone:['play','power','attack'].includes(action.type)?clonePublicCharacter(el):null,isHero:el.dataset.entityKind === 'hero',player:Number(el.dataset.player),avatarRect:el.querySelector?.('.hero-avatar')?.getBoundingClientRect() || null,rect:el.getBoundingClientRect(),clone:action.type === 'attack' && uid === action.source ? el.cloneNode(true) : null,deathArt:el.querySelector?.('.minion-art')?.cloneNode(true) || null,publicName:el.querySelector?.('.minion-name')?.textContent || el.getAttribute?.('aria-label')?.split('，')[0] || '随从',publicSide:el.dataset.player === '0' ? '我方' : '对手'};
  }
  return nodes;
}
function showCombat(action,events,captured,actionStartedAt=null) {
  if (!captured || paused || portrait.matches || saveFailure || document.visibilityState === 'hidden') return;
  clearCombatFX();
  const spellPlan = planSpellFeedback(events,captured,cardInfo);
  if (spellPlan && spellFX.show(spellPlan,captured,actionStartedAt)) {
    const timing = spellPlan.kind === 'attack' ? SHIELD_ATTACK_TIMING : SPELL_TIMING;
    heavyFX.show(events,captured,timing.windup+timing.flight);
    return;
  }
  heavyFX.show(events,captured,events?.some(e=>e.type==='attack') ? ATTACK_MOTION_MS*.42 : 0);
  const attack = (events || []).find(event => event.type === 'attack');
  const hits = (events || []).filter(event => (event.type === 'damage' && event.amount > 0) || event.type === 'shieldBreak');
  const deaths = new Set((events || []).filter(event => event.type === 'death').map(event => event.uid));
  const source = attack && captured[attack.source], target = attack && captured[attack.target];
  if (!hits.length && !(source?.clone && target)) return;
  const layer = document.createElement('div'); layer.className = 'combat-fx'; layer.setAttribute('aria-hidden','true');
  const animations = []; const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = (el,frames,options) => {
    try { if (el.animate) animations.push(el.animate(frames,options)); } catch {}
  };
  const position = (el,r) => { el.style.left=`${r.left}px`; el.style.top=`${r.top}px`; el.style.width=`${r.width}px`; el.style.height=`${r.height}px`; };
  if (!reduced && source?.clone && target) {
    const ghost = source.clone; ghost.removeAttribute('id'); ghost.removeAttribute('data-entity'); ghost.removeAttribute('data-gesture-target'); ghost.tabIndex=-1; ghost.disabled=true; ghost.className='combat-attacker';
    position(ghost,source.rect); layer.append(ghost);
    const dx=target.rect.left+target.rect.width/2-source.rect.left-source.rect.width/2;
    const dy=target.rect.top+target.rect.height/2-source.rect.top-source.rect.height/2;
    animate(ghost,[{transform:'translate(0,0)',opacity:.9},{transform:`translate(${dx*.7}px,${dy*.7}px) scale(1.08)`,opacity:1,offset:.42},{transform:`translate(${dx*.7}px,${dy*.7}px) scale(1.08)`,opacity:1,offset:.58},{transform:'translate(0,0)',opacity:0}],{duration:ATTACK_MOTION_MS,easing:'ease-in-out',fill:'forwards'});
  }
  let deathLane = null;
  const deathBand = document.getElementById?.('last-action-status')?.getBoundingClientRect();
  for (const uid of new Set(hits.map(event => event.target))) {
    const anchor=captured[uid]; if (!anchor) continue;
    const liveNode = [...document.querySelectorAll('[data-entity]')].find(el => el.dataset.entity === uid);
    const hitRect = !deaths.has(uid) && liveNode ? liveNode.getBoundingClientRect() : anchor.rect;
    const received=hits.filter(event => event.target === uid);
    const shield=received.filter(event=>event.type==='shieldBreak').reduce((n,event)=>n+event.prevented,0);
    const amount=received.reduce((n,event)=>n+(event.amount || 0),0), armor=received.reduce((n,event)=>n+(event.absorbed || 0),0);
    // Never put a removed card back on a reflowed board. Public death identity
    // belongs to the reserved action-status band; survivors keep their own hits.
    if (deaths.has(uid)) {
      if (deathBand) {
        if (!deathLane) {
          deathLane=document.createElement('div'); deathLane.className='combat-death-lane';
          position(deathLane,deathBand); layer.append(deathLane);
        }
        const badge=document.createElement('div'); badge.className='combat-death-badge';
        badge.dataset.fallenTarget=uid; badge.dataset.damageTarget=uid;
        if (anchor.deathArt) { anchor.deathArt.className='combat-death-art'; badge.append(anchor.deathArt); }
        const copy=document.createElement('span'); copy.textContent=`${anchor.publicSide}·${anchor.publicName} 阵亡 −${amount}`;
        badge.title=copy.textContent; badge.append(copy); deathLane.append(badge);
      }
      continue;
    }
    if(shield)addShieldBreak({document,layer,rect:hitRect,uid,reduced,animate});
    const burst=document.createElement('span'); burst.className='combat-impact'; burst.dataset.damageTarget=uid; position(burst,hitRect); layer.append(burst);
    // Readable hit information is static. WAAPI/compositor scheduling must
    // never determine whether a damage amount or its target ring can be seen.
    const number=document.createElement('span'); number.className='combat-damage'; number.dataset.damageTarget=uid;
    number.textContent=shield ? `圣盾破碎 · 抵挡 ${shield}${amount ? ` · 生命 −${amount-armor}` : ''}` : armor ? `生命 −${amount-armor} · 护甲 −${armor}` : `−${amount}`;
    number.style.left=`${hitRect.left+hitRect.width/2}px`; number.style.top=`${hitRect.top+hitRect.height/2}px`; layer.append(number);

  }
  if (!layer.childNodes.length) return;
  const fxStartedAt = globalThis.performance?.now?.() ?? Date.now();
  layer.dataset.fxStartedAt = String(fxStartedAt);
  layer.dataset.fxExpiresAt = String(fxStartedAt + COMBAT_FEEDBACK_MS);
  layer.dataset.actionStartedAt = String(actionStartedAt ?? fxStartedAt);
  document.body.append(layer);
  const current = {layer,animations,timer:null};
  combatFX = current;
  current.timer = setTimeout(() => { if (combatFX === current) clearCombatFX(); }, COMBAT_FEEDBACK_MS);
}
function currentSelectionActions() {
  if (!selected || !humanTurn()) return [];
  return actions().filter((a) => a.player === 0 && a.type === selected.type &&
    (selected.type === 'power' || a.source === selected.source));
}
function targetIsLegal(uid) { return currentSelectionActions().some((a) => a.target === uid); }
function cardInfo(cardId) { return (CARDS[cardId] ? {...CARDS[cardId],metadata:CARD_METADATA[cardId]} : null) || {id:cardId,name:String(cardId),cost:'?',type:'spell',text:'未知测试卡牌'}; }
// Assets are looked up by immutable metadata source ID; engine art stays "placeholder".
function artMarkup(card, slot='card-art') {
  const art = artForCard(card);
  if (!art) return `<span class="${slot} placeholder-art ${card.type === 'minion' ? 'art-type-minion' : esc(card.type)}" aria-hidden="true"><span class="art-fallback">插画待补</span></span>`;
  return `<span class="${slot} original-art" data-art-source="${esc(card.metadata?.sourceId || card.id)}" aria-hidden="true"><img src="${esc(art.src)}" width="${art.width}" height="${art.height}" alt="" decoding="async" draggable="false"></span>`;
}
function cardStatsText(card, entity=null) {
  if (card.type === 'minion') return `攻击 ${entity?.atk ?? card.attack} / 生命 ${entity?.hp ?? card.health}`;
  if (card.type === 'weapon') return `攻击 ${entity?.atk ?? card.attack} / 耐久 ${entity?.dur ?? card.durability}`;
  return '';
}
// Compact visible labels fit inside the exposed hand strip; aria-label keeps full prose.
function handStatsMarkup(card) {
  if (card.type === 'minion') return `<span class="hand-stat attack-stat"><small>攻</small><span class="hand-value">${card.attack}</span></span><span class="hand-stat health-stat"><small>血</small><span class="hand-value">${card.health}</span></span>`;
  if (card.type === 'weapon') return `<span class="hand-stat attack-stat"><small>攻</small><span class="hand-value">${card.attack}</span></span><span class="hand-stat durability-stat"><small>耐</small><span class="hand-value">${card.durability}</span></span>`;
  return '<span class="hand-stat">法术</span>';
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
    return {name:`${friendlyHero().name} · 英雄技能`,text:powerDescription(game,0,CARDS),cost:p.cost};
  }
  const player = game.players[0];
  const entity = [...player.hand, ...game.players.flatMap(p => p.board)].find((c) => c.uid === selected.source);
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
  clearCombatFX();
  gestures?.cancel();
  cancelAITimer();
  paused = true;
  pauseReason = reason;
  selected = null; handExpanded = false;
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
  if (document.visibilityState === 'hidden' || saveBusy || portrait.matches) return;
  if (saveFailure) { showSaveFail(); return; }
  invalidatePendingImport();
  paused = false;
  pauseReason = '';
  notice = '';
  render();
  scheduleAI();
}
function combatEntityName(state,uid) {
  for (const [index,player] of state.players.entries()) {
    const side = index === 0 ? '我方' : '对手';
    if (player.hero.uid === uid) return `${side}·${(HEROES[player.classId] || player.hero).name}`;
    const entity = [...player.board,...player.graveyard].find(item => item.uid === uid);
    if (entity) return `${side}·${cardInfo(entity.cardId).name}`;
  }
  return '角色';
}
function recordEvent(action, events, before) {
  const who = action.player === 0 ? '你' : '对手';
  const name = uid => combatEntityName(before,uid);
  const resolved = events || [];
  const attack = resolved.find(event => event.type === 'attack');
  const played = resolved.find(event => event.type === 'play');
  const power = resolved.find(event => event.type === 'power');
  let label = `${who}执行行动`;
  if (attack) label = `${name(attack.source)} 攻击 ${name(attack.target)}`;
  else if (played) label = `${who}打出「${cardInfo(played.cardId).name}」${action.target ? ` → ${name(action.target)}` : ''}`;
  else if (power) label = `${who}使用${(HEROES[power.classId] || {}).name || ''}的英雄技能${action.target ? ` → ${name(action.target)}` : ''}`;
  else if (resolved.some(event => event.type === 'turnEnd')) label = `${who}结束回合`;
  const details = [];
  for (const event of resolved) {
    if (event.type === 'damage') {
      const armor = event.absorbed || 0;
      details.push(`${name(event.target)} 伤害 ${event.amount}${armor ? `（生命 −${event.amount-armor}，护甲 −${armor}）` : ''}`);
    } else if (event.type === 'shieldGrant') details.push(`${name(event.target)} ${event.already ? '圣盾已存在' : '获得圣盾'}`);
    else if (event.type === 'shieldBreak') details.push(`${name(event.target)} 圣盾破碎，抵挡 ${event.prevented} 点伤害`);
    else if (event.type === 'heal') details.push(`${name(event.target)} 生命 +${event.amount}`);
    else if (event.type === 'armor') details.push(`${name(event.target)} 护甲 +${event.amount}`);
    else if (event.type === 'death') details.push(`${name(event.uid)} 阵亡`);
    else if (event.type === 'summon') details.push(`召唤「${cardInfo(event.cardId).name}」`);
    else if (event.type === 'equip') details.push(`装备「${cardInfo(event.cardId).name}」`);
    else if (event.type === 'weaponBreak') details.push(event.reason === 'replaced' ? '旧武器已替换' : '武器耐久耗尽');
    else if (event.type === 'mana') details.push(`法力 +${event.amount}`);
    else if (event.type === 'fatigue') details.push(`${event.player === 0 ? '我方' : '对手'}疲劳 ${event.amount}`);
  }
  // Draw counts are public; never reveal the opponent's drawn card names.
  for (const player of [0,1]) {
    const draws = resolved.filter(event => event.type === 'draw' && event.player === player).length;
    const burns = resolved.filter(event => event.type === 'burn' && event.player === player).length;
    if (draws) details.push(`${player === 0 ? '我方' : '对手'}抽牌 ${draws}`);
    if (burns) details.push(`${player === 0 ? '我方' : '对手'}手牌已满，弃牌 ${burns}`);
  }
  if (resolved.some(event => event.type === 'gameEnd')) details.push(resultText());
  const detail = details.join(' · ') || '行动已结算';
  uiLog.push({revision:game.revision,player:action.player,type:action.type,playedCardId:played?.cardId || null,label,detail,text:`${label} · ${detail}`,eventCount:resolved.length});
  if (played) {
    recentPlayedCards.push({revision:game.revision,player:action.player,playedCardId:played.cardId});
    if (recentPlayedCards.length > 8) recentPlayedCards.shift();
  }
  if (uiLog.length > 100) uiLog.shift();
}
function renderCombatStatus() {
  const status = $('last-action-status');
  if (!status) return;
  status.hidden = false;
  const latest = uiLog.at(-1);
  const label = latest?.label || '行动记录';
  const detail = latest?.detail || (game.revision ? `已恢复第 ${game.revision} 步，下一次行动会显示在这里` : '出牌、攻击和伤害结果会保留在这里');
  const text = `${label} · ${detail}`;
  // Saving and inspection redraws must not re-announce the same resolved action.
  if (status.dataset.summary === text && status.dataset.revision === (latest ? String(latest.revision) : '')) return;
  status.dataset.summary = text;
  status.dataset.actionType = latest?.type || 'idle';
  status.dataset.player = latest ? String(latest.player) : '';
  status.dataset.revision = latest ? String(latest.revision) : '';
  status.setAttribute('aria-label',text);
  status.title = text;
  status.innerHTML = `<strong class="last-action-label">${esc(label)}</strong><span class="last-action-detail">${esc(detail)}</span>`;
}
// This list is presentation-only and derives exclusively from successful resolved
// play.cardId events recorded above. Never read an opponent hand or draw event.
function publicPlays() { return recentPlayedCards.slice().reverse(); }
function publicCardMarkup(entry, slot='reveal-art', compact=false) {
  const card = cardInfo(entry.playedCardId);
  if (compact) return `${artMarkup(card,slot)}<div class="revealed-copy"><strong>${esc(card.name)}</strong><span>${esc(card.cost)} 费 · ${esc(TYPES[card.type] || card.type)}</span></div>`;
  return `${artMarkup(card,slot)}<div class="revealed-copy"><small>${entry.player === 1 ? '对手' : '你'}打出 · 第 ${entry.revision} 步</small><strong>${esc(card.name)}</strong><span>${esc(card.cost)} 费 · ${esc(TYPES[card.type] || card.type)}${cardStatsText(card) ? ` · ${esc(cardStatsText(card))}` : ''}</span><p>${esc(card.text || '无额外效果')}</p></div>`;
}
function renderRecentPlays() {
  const plays = publicPlays();
  const latest = plays.find(entry => entry.player === 1) || plays[0];
  const button = $('recent-open');
  // The left action rail takes priority while aiming, including 320px height.
  button.hidden = !!selected;
  button.disabled = !latest;
  button.setAttribute('aria-label',latest ? `最近出牌：${cardInfo(latest.playedCardId).name}，打开图片记录` : '最近出牌，尚无记录');
  const key = latest ? String(latest.revision) : '';
  if (button.dataset.revision !== key) {
    button.dataset.revision = key;
    button.innerHTML = latest ? `${artMarkup(cardInfo(latest.playedCardId),'recent-thumb')}<span>最近出牌</span>` : '<span>最近出牌</span>';
  }
  const reveal = $('played-reveal');
  const current = uiLog.at(-1);
  const show = current?.player === 1 && !!current.playedCardId && game.active === 1 && game.phase === 'main' && !paused && !portrait.matches && !saveFailure && document.visibilityState !== 'hidden';
  reveal.hidden = !show;
  button.hidden = !!selected || !!show;
  if (!show) delete reveal.dataset.revision;
  if (show && reveal.dataset.revision !== String(current.revision)) {
    reveal.dataset.revision = String(current.revision);
    reveal.innerHTML = publicCardMarkup(current,'reveal-art',true);
  }
  const history = $('recent-cards');
  const historyKey = plays.map(entry => entry.revision).join(',');
  if (history.dataset.revisions !== historyKey) {
    history.dataset.revisions = historyKey;
    history.innerHTML = plays.length ? plays.map(entry => `<article class="recent-card">${publicCardMarkup(entry)}</article>`).join('') : '<p>本次打开对局后，已公开打出的牌会保留在这里。</p>';
  }
}
function commitAction(action, fromAI=false, inputEvent=null) {
  if (spellFX.active() || paused || portrait.matches || saveBusy || saveFailure || document.visibilityState === 'hidden' || game.phase !== 'main') return false;
  if (fromAI ? game.active !== 1 : game.active !== 0) return false;
  let command = action;
  if (!fromAI) command = {...action,commandId:`ui-${game.revision}-${++commandSerial}`,expectedRevision:game.revision};
  const before = game;
  const actionStartedAt = globalThis.performance?.now?.() ?? Date.now();
  const captured = captureCombat(action);
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
    clearCombatFX();
    recordEvent(action,result.events,before);
    if (!fromAI) actionInputGuard.remember(inputEvent);
  }
  selected = null; handExpanded = false;
  notice = result.duplicate ? '重复操作已忽略。' : '';
  render();
  if (game.revision !== before.revision && !result.duplicate) showCombat(action,result.events,captured,actionStartedAt);
  if (game.revision !== before.revision) persist(); else scheduleAI();
  return true;
}
function scheduleAI() {
  if (aiTimer !== null || paused || portrait.matches || saveBusy || saveFailure || document.visibilityState === 'hidden' || game.phase !== 'main' || game.active !== 1) return;
  const generation = aiGeneration;
  const revision = game.revision;
  const timer = setTimeout(() => {
    // A cancelled callback may already be queued. It must never clear a newer
    // timer's handle or issue a command after pause/resume or a save cycle.
    if (generation !== aiGeneration || aiTimer !== timer) return;
    aiTimer = null;
    if (generation !== aiGeneration || paused || portrait.matches || saveBusy || saveFailure || document.visibilityState === 'hidden' || game.revision !== revision || game.phase !== 'main' || game.active !== 1) return;
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
  }, Math.max(uiLog.at(-1)?.player === 1 && uiLog.at(-1)?.playedCardId ? AI_CARD_READ_MS : AI_ACTION_INTERVAL_MS,spellFX.remaining()));
  aiTimer = timer;
}
function resultText() {
  if (!game.result) return '对局结束';
  if (game.result.winner === null) return '平局';
  return game.result.winner === 0 ? '你赢得了这一章' : '这一章，对手获胜';
}
// Display derives from the committed weapon instance, never hero.attack (which
// resets off-turn) or the printed maximum durability. No new game/save state.
function heroWeaponStatus(index) {
  const weapon = game.players[index].weapon;
  if (weapon) return {state:'equipped',attack:weapon.atk,durability:weapon.dur,
    label:`武器 ${cardInfo(weapon.cardId).name}，武器攻击 ${weapon.atk}，剩余耐久 ${weapon.dur}`,
    markup:`<span class="hero-weapon-title">武器</span><span class="hero-weapon-values"><b><small>攻</small>${weapon.atk}</b><b><small>耐</small>${weapon.dur}</b></span>`};
  let last = null;
  for (let i=game.eventLog.length-1;i>=0;i--) {
    const event=game.eventLog[i];
    if(event.player===index && ['equip','weaponBreak'].includes(event.type)){last=event;break;}
  }
  const broken=last?.type==='weaponBreak' && last.reason==='durability';
  return {state:broken?'broken':'empty',attack:null,durability:broken?0:null,
    label:broken?'武器耐久 0，已破碎移除；当前无武器':'当前无武器',
    markup:broken?'<span class="hero-weapon-title">武器已移除</span><span class="hero-weapon-empty">耐久 0</span>':'<span class="hero-weapon-title">武器</span><span class="hero-weapon-empty">未装备</span>'};
}
function renderPlayer(index) {
  const p = game.players[index];
  const h = p.hero;
  const definition = HEROES[p.classId] || {name:h.name,role:'英雄',mark:'册'};
  const attackState = attackAvailability(h,index,actions());
  const canAttack = attackState.ready;
  const targetable = targetIsLegal(h.uid);
  const canPower = humanTurn() && index === 0 && actions().some((a) => a.type === 'power');
  const equipped = p.weapon ? cardInfo(p.weapon.cardId) : null;
  const weaponStatus = heroWeaponStatus(index);
  const dots = manaDots(p);
  $(index === 0 ? 'player' : 'opponent').innerHTML = `
    <button class="${selectableClass(h.uid,`hero-button${canAttack ? ' can-attack' : ''}`)}" data-class="${esc(p.classId)}" data-gesture-target data-entity-kind="hero" data-entity="${esc(h.uid)}" data-player="${index}" aria-label="${esc(definition.name)} ${esc(definition.role)}，生命 ${h.hp}，护甲 ${h.armor || 0}${index === 0 ? '，'+attackState.label : ''}，${esc(weaponStatus.label)}${targetable ? '，可选目标' : ''}">
      <span class="hero-avatar" aria-hidden="true">${esc(definition.mark)}</span><span><strong class="hero-title">${esc(definition.name)} · ${esc(definition.role)}</strong><span class="hero-stats"><span class="hp">${h.hp}</span> <span class="armor">${h.armor || 0}</span>${h.attack > 0 ? `<span class="hero-attack-stat">⚔ ${h.attack}</span>` : ''}</span></span>
      ${index === 0 && h.attack > 0 ? `<span class="hero-readiness readiness-${attackState.kind}">${attackState.label}</span>` : ''}
    </button>
    <span class="hero-weapon" data-weapon-player="${index}" data-state="${weaponStatus.state}" data-weapon-attack="${weaponStatus.attack ?? ''}" data-weapon-durability="${weaponStatus.durability ?? ''}" aria-hidden="true">${weaponStatus.markup}</span>
    <div class="player-metadata"><span class="mana-label">法力 ${p.mana}/${p.maxMana}</span><span class="mana-dots" aria-hidden="true">${dots}</span><div class="resource-line"><span>牌库 ${p.deck.length}</span><span>手牌 ${p.hand.length}</span><span>疲劳 ${p.fatigue}</span><span class="spell-damage-total">法伤 +${spellDamageBonus(game,index)}</span>${p.weapon ? `<span class="weapon-status">武器 · ${esc(equipped.name)} · 攻击 ${p.weapon.atk} / 耐久 ${p.weapon.dur}</span>` : ''}</div></div>
    ${index === 1 ? `<span class="opponent-hand-count" aria-label="对手手牌 ${p.hand.length} 张"><span aria-hidden="true">▣</span> 手牌 <strong>${p.hand.length}</strong></span><span class="opponent-power-status${h.powerUsed ? ' is-used' : ''}" aria-label="对方英雄技能${h.powerUsed ? '本回合已使用' : '本回合未使用'}">技能 · ${h.powerUsed ? '已使用' : '未使用'}</span>` : ''}
    ${index === 0 ? `<button id="hero-power" class="power-button ${selected?.type === 'power' ? 'selected' : ''}" data-available="${canPower}" title="${esc(powerDescription(game,0,CARDS))}"><span>英雄技能</span><small>${h.powerUsed ? '本回合已用' : `${game.config.powers.cost}费 · 说明`}</small></button>` : ''}`;
}
function renderBoard(index) {
  const p = game.players[index];
  const el = $(index === 0 ? 'friendly-board' : 'enemy-board');
  if (!p.board.length) { el.innerHTML = '<span class="empty-board">尚无随从</span>'; return; }
  const legal = actions();
  const acceptsPlacement = index === 0 && isMinionPlacement() && currentSelectionActions().some(a => !a.target);
  el.innerHTML = p.board.map((m) => {
    const c = cardInfo(m.cardId);
    const attackState = attackAvailability(m,index,legal);
    const canAttack = attackState.ready;
    const targetable = targetIsLegal(m.uid);
    const taunt=m.keywords?.includes('taunt');
    const charge=m.keywords?.includes('charge');
    const divineShield=m.keywords?.includes('divineShield');
    const keywords=keywordLabels(m);
    const spellDamage=m.hp>0?(c.spellDamage??0):0;
    const status = attackState.label;
    return `<button class="${selectableClass(m.uid,`minion${divineShield ? ' has-divine-shield' : ''}${taunt ? ' taunt' : ''}${canAttack ? ' can-attack' : ''}`)}" data-class="${presentationClass(c.metadata)}" data-gesture-target data-entity="${esc(m.uid)}" data-player="${index}" aria-label="${esc(c.name)}，攻击 ${m.atk}，生命 ${m.hp}，${status}${keywords.map(k=>'，'+k.label).join('')}${spellDamage ? `，法术伤害 +${spellDamage}` : ''}${targetable ? '，可选目标' : ''}"><span class="minion-name">${esc(c.name)}</span>${keywords.length || spellDamage ? `<span class="minion-keywords">${keywords.map(k=>`<span class="minion-keyword keyword-${k.key}">${k.label}</span>`).join('')}${spellDamage ? `<span class="minion-keyword keyword-spell">法伤 +${spellDamage}</span>` : ''}</span>` : ''}${artMarkup(c,'minion-art')}${divineShield ? '<span class="divine-shield-shell" aria-hidden="true"></span>' : ''}<span class="minion-status readiness-${attackState.kind}">${index === 0 ? status : ''}</span><span class="minion-stats"><b class="attack-stat"><span class="stat-label">攻</span> ${m.atk}</b><b class="health-stat"><span class="stat-label">生</span> ${m.hp}</b></span></button>`;
  }).join('');
}
function isMinionPlacement() { return selected?.type === 'play' && selectedInfo()?.type === 'minion'; }
function renderAimGuide() {
  const legal=currentSelectionActions(), info=selectedInfo();
  const active=selected?.type==='play' && !!info;
  $('aim-guide').hidden=!active;
  $('app').classList.toggle('card-aim',active);
  $('hand-browser-nav').hidden=!handExpanded;
  $('aim-arrows').innerHTML='';
  if(!active)return;
  const item=game.players[0].hand.find(c=>c.uid===selected.source);
  const availability=item?handAvailability(item,info,actions()):{label:'不可出'};
  const targeted=legal.some(a=>a.target),placement=isMinionPlacement()&&legal.some(a=>!a.target);
  const instruction=targeted?'再点绿色箭头目标使用':placement?'再点绿色己方战场上场':legal.some(a=>!a.target)?'再点「确认使用」生效':availability.label+' · 可取消或返回手牌';
  $('aim-guide').textContent=`${info.name} · ${info.cost}费 · ${instruction}`;
  if(!legal.length)return;
  const targets=targeted?[...new Set(legal.map(a=>a.target))].map(id=>document.querySelector(`[data-entity="${CSS.escape(id)}"]`)):placement?[$('friendly-board')]:[$('confirm')];
  $('aim-arrows').setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  $('aim-arrows').innerHTML='<defs><marker id="green-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#38ed72"/></marker></defs>'+targets.filter(Boolean).map(el=>{const r=el.getBoundingClientRect(),x=targeted?r.left+5:r.left+r.width/2,y=targeted?r.top+r.height*.35:r.top+5,sx=targeted?Math.max(2,x-28):x,sy=targeted?y:y-22;return `<path d="M ${sx} ${sy} L ${x} ${y}" stroke="#176436" stroke-width="7"/><path d="M ${sx} ${sy} L ${x} ${y}" stroke="#38ed72" stroke-width="3" marker-end="url(#green-tip)"/>`;}).join('');
}
function renderHand() {
  const p = game.players[0];
  $('hand-count').textContent = `手牌 ${p.hand.length} ${handExpanded ? '↓' : '↑'}\n${handExpanded ? '收起浏览' : selected?.type==='play' ? '返回手牌' : '展开看图'}`;
  $('hand-count').setAttribute('aria-expanded',String(handExpanded));
  $('hand-count').setAttribute('aria-label',`${handExpanded ? '收起' : '展开'}手牌，共 ${p.hand.length} 张`);
  $('hand').classList.toggle('is-expanded',handExpanded);
  $('hand').classList.toggle('is-crowded',p.hand.length > 5);
  $('hand').style.setProperty('--hand-count', Math.max(1,p.hand.length));
  $('hand').style.setProperty('--fan-divisor', Math.max(1,p.hand.length-1));
  const legal = actions();
  $('hand').innerHTML = p.hand.length ? p.hand.map((item,handIndex) => {
    const c = cardInfo(item.cardId);
    const availability = handAvailability(item,c,legal);
    const playable = availability.ready;
    if(handExpanded)return `<button class="browse-card ${playable?'playable':''}" data-card="${esc(item.uid)}" aria-label="${esc(c.name)}，${c.cost}费，${esc(cardStatsText(c))}，${esc(c.text)}，${esc(mechanismText(c))}，${availability.label}"><span class="browse-heading"><b>${c.cost}<small> 费</small></b><strong>${esc(c.name)}</strong><em>${availability.label}</em></span><span class="browse-type">${esc(TYPES[c.type])} · ${esc(c.metadata?.classLabel||'测试')}</span><span class="browse-body">${artMarkup(c,'browse-art')}<span class="browse-copy">${esc(c.text||'无额外效果')}${mechanismText(c)?`<strong>${esc(mechanismText(c))}</strong>`:''}${spellDamageText(c)?`<strong>${esc(spellDamageText(c))}</strong>`:''}</span></span><span class="browse-stats">${esc(cardStatsText(c)||'法术 · 效果见上方')}<small>点选后再确认 · 不会立即扣费</small></span></button>`;

    return `<button class="${selectableClass(item.uid,'hand-card')}${playable ? ' playable' : ''}" data-class="${presentationClass(c.metadata)}" data-card="${esc(item.uid)}" aria-label="${esc(c.name)}，${c.cost} 点法力，${esc(cardStatsText(c))}，${esc(c.text || '')}，${esc(mechanismText(c))}${spellDamageText(c)?'，'+esc(spellDamageText(c)):''}，${availability.label}，点击查看" aria-pressed="${selected?.source === item.uid}"><span class="card-heading"><span class="cost"><small>费</small>${c.cost}</span><span class="hand-readiness readiness-${availability.kind}">${availability.label}</span><strong>${esc(c.name)}</strong></span><span class="card-type">${esc(TYPES[c.type] || c.type)} · ${esc(c.metadata?.classLabel || '实验生成物')}${playable ? ' · 可出牌' : ''}</span>${artMarkup(c)}${artMarkup(c,'hand-peek')}${mechanismLabels(c)?`<span class="hand-mechanisms">${esc(mechanismLabels(c))}</span><span class="hand-mechanism-copy">${esc(mechanismText(c))}</span>`:''}<span class="card-preview">${esc(c.text || '原创测试卡牌')}</span>${spellDamageText(c)?`<span class="effective-spell-damage">${esc(spellDamageText(c))}</span>`:''}<span class="card-bottom">${handStatsMarkup(c)}</span></button>`;
  }).join('') : '<span class="empty-board">手牌为空</span>';
  [...$('hand').querySelectorAll('[data-card]')].forEach((el,i) => {
    el.style.setProperty('--fan-angle',(i-(p.hand.length-1)/2)*2);
    el.style.setProperty('--hand-index',i);
    el.style.setProperty('--fan-divisor',Math.max(1,p.hand.length-1));
    el.style.gridColumn = 'auto';
  });
}
function renderSelection() {
  const info = selectedInfo();
  const legal = currentSelectionActions();
  const noTarget = legal.find((a) => !a.target);
  let content;
  if (info) {
    const hint = selected?.type === 'inspect' ? '查看随从信息；点击取消后继续行动。' : paused ? '已暂停。点击「继续」恢复后操作。' : !humanTurn() ? '可查看卡牌，等待你的回合。' : legal.some((a) => a.target) ? '点击绿色箭头指向的合法目标。' : noTarget ? '随从再点己方绿色战场；其他无目标牌再点确认使用。' : '当前无法使用：可能受法力、场位、次数或目标限制。';
    const statsText = cardStatsText(info, info.entity);
    const stats = statsText ? ` · ${statsText}` : '';
    const selectedArt = artForCard(info) ? artMarkup(info, 'selection-art') : '';
    content = `<div class="selection-detail">${selectedArt}<div class="selection-copy"><strong>${esc(info.name)}</strong>${info.cost !== undefined ? ` · ${info.cost} 法力` : ''}${esc(stats)}<p>${esc(info.text || '原创测试随从')}</p>${mechanismText({...info,keywords:info.entity?.keywords??info.keywords})?`<p class="mechanism-explanation">${esc(mechanismText({...info,keywords:info.entity?.keywords??info.keywords}))}</p>`:''}${spellDamageText(info)?`<p class="effective-spell-damage">${esc(spellDamageText(info))}</p>`:''}${info.metadata ? `<p class="source-info">来源 ${esc(info.metadata.sourceId)} · ${esc(info.metadata.classLabel)}${info.metadata.tribe ? ` · 种族 ${esc(info.metadata.tribe)}（仅保留元数据）` : ''}<br>原始效果：${esc(info.metadata.sourceEffectText)}</p>` : ''}<p class="selection-hint">${hint}</p></div></div>`;
  } else if (game.phase === 'ended') content = `<strong>${esc(resultText())}</strong><p>${esc(game.result?.reason || '')} · 可下载快照或开始新对局。</p>`;
  else if (paused) content = `<strong>对局已暂停</strong><p>${esc(pauseReason)}。点击上方「继续」恢复。</p>`;
  else if (spellFX.active()) content = '<strong>正在展示施法</strong><p>结算已完成，命中反馈结束后可继续行动；仍可暂停或返回。</p>';
  else if (game.active === 1) content = '<strong>对手正在思考</strong><p>随时可以暂停。你的操作不会由计时器代替。</p>';
  else content = '<strong>轮到你了</strong><p>点选手牌查看全文，或选择可攻击的随从。</p>';
  $('selection').innerHTML = content;
  const noTargetPlay = isMinionPlacement() && !!noTarget;
  $('friendly-board').classList.toggle('drop-ready',noTargetPlay);
  // The board is a group of inspectable/targetable buttons, not a disabled
  // placement control. Group aria-disabled would incorrectly disable children.
  $('friendly-board').removeAttribute('aria-disabled');
  $('friendly-board').dataset.placementAvailable = String(noTargetPlay);
  $('friendly-board').tabIndex = noTargetPlay ? 0 : -1;
  $('friendly-board').setAttribute('aria-describedby','battle-hint');
  $('friendly-board').setAttribute('aria-label',noTargetPlay ? '我的战场：点击空白处或按回车出牌' : '我的战场：随从可查看，绿色边框表示可选目标');
  const empty = $('friendly-board').querySelector('.empty-board');
  if (empty && noTargetPlay) empty.textContent = '点击这里让随从上场';
  $('detail-open').disabled = !info;
  $('battle-hint').textContent = info ? `${info.name} · ${selected?.type === 'inspect' ? '点击牌面详情查看' : legal.some(a => a.target) ? '点击绿色箭头目标' : noTarget ? selected.type === 'power' ? '点击确认使用技能' : isMinionPlacement() ? '点击己方绿色战场出牌' : '点击确认使用后生效' : '当前不可使用，可查看详情'}` : game.phase === 'ended' ? resultText() : paused ? `${pauseReason} · 点击继续` : spellFX.active() ? '正在展示命中 · 反馈结束后可继续行动' : game.active === 1 ? '对手回合' : handExpanded ? '手牌完整浏览 · 左右滑动，点牌进入第二步' : '点「手牌 ↑」完整浏览，选牌后再确认';
  $('confirm').hidden = !noTarget || isMinionPlacement();
  $('confirm').textContent = selected?.type === 'power' ? '确认使用技能' : '确认使用';
  $('cancel').hidden = !selected;
  $('end-turn').disabled = !humanTurn() || !actions().some((a) => a.player === 0 && a.type === 'end');
}
function renderResult() {
  const ended = game.phase === 'ended';
  $('result-panel').hidden = !ended;
  if (!ended) return;
  $('result-title').textContent = resultText();
  $('result-note').textContent = saveFailure ? '结果尚未保存，请先处理保存提示。' : saveBusy ? '正在保存本局结果…' : !store.writable ? '本局未存档；返回将离开当前结果。' : '本局已结束，可返回书店，或设置下一局。';
  if (resultRecoveryNote) $('result-note').textContent += ` ${resultRecoveryNote}`;
  $('result-finish').disabled = closeSent;
  $('result-finish').textContent = closing ? '正在返回…' : '结束游戏 · 返回书店';
  $('result-replay').disabled = saveBusy || !!saveFailure || closing || closeSent;
}
function render() {
  bgm.update({muted,paused:paused||closing||closeSent,hidden:document.hidden});
  $('app').classList.toggle('blocked-aim',notice.startsWith('先处理嘲讽'));
  $('app').dataset.interactionMode = handExpanded ? 'inspect-hand' : selected ? 'aim' : 'battle';
  const focus = document.activeElement;
  const focusMarker = focus?.dataset?.card ? ['data-card',focus.dataset.card] : focus?.dataset?.entity ? ['data-entity',focus.dataset.entity] : focus?.id ? ['id',focus.id] : null;
  const scrollPositions = ['hand','enemy-board','friendly-board'].map((id) => [id,$(id).scrollLeft]);
  $('pause').textContent = paused ? '继续' : '暂停';
  $('pause').setAttribute('aria-pressed',String(paused));
  $('pause').disabled = game.phase === 'ended' && !spellFX.active();
  const status = game.phase === 'ended' ? resultText() : paused ? '已暂停' : game.active === 0 ? '你的回合' : '对手回合';
  $('turn-bar').innerHTML = `<span>第 ${game.turn} 回合 · <strong>${esc(status)}</strong></span><span class="${paused ? 'paused-pill' : ''}">${paused ? 'AI 已停止 · 手动继续' : '规则与 AI 随机流独立'}</span>`;
  const config = game.config || {};
  $('rules-label').textContent = `${config.heroHealth ?? 30} HP / ${config.deckSize ?? 30} 牌 / ${config.boardLimit ?? config.maxBoard ?? 7} 场`;
  renderPlayer(1); renderBoard(1); renderBoard(0); renderPlayer(0); renderHand(); renderSelection();
  const p = game.players[0];
  const overflow = Math.max(0,p.mana-p.maxMana);
  const manaHint = game.phase !== 'main' ? '对局结束' : paused ? '已暂停 · 点继续' : saveBusy ? '正在保存' : game.active === 0 ? '可用 / 上限' : `下回合恢复 ${Math.min(p.maxMana+1,game.config.maxMana)}`;
  const compactManaHint = paused ? '已暂停' : saveBusy ? '保存中' : game.active === 1 ? `下回合 ${Math.min(p.maxMana+1,game.config.maxMana)}` : overflow ? `临时 +${overflow}` : '';
  $('mana-rail').setAttribute('aria-label',`我的法力：可用 ${p.mana}，上限 ${p.maxMana}。${manaHint}。蓝色可用，空心已用${overflow ? `，紫色临时 ${overflow}` : ''}`);
  $('mana-rail').title = `${manaHint}；蓝色可用，空心已用${overflow ? `；紫色临时 +${overflow}` : ''}`;
  $('mana-rail').innerHTML = `法力<strong>${p.mana}/${p.maxMana}</strong><span class="mana-dots" aria-hidden="true">${manaDots(p)}</span>${compactManaHint ? `<small class="mana-hint">${compactManaHint}</small>` : ''}`;
  for (const [id,left] of scrollPositions) $(id).scrollLeft = left;
  if (focusMarker) document.querySelector(`[${focusMarker[0]}="${CSS.escape(focusMarker[1])}"]`)?.focus({preventScroll:true});
  $('notice').textContent = [notice, saveNote].filter(Boolean).join(' · ');
  $('revision-label').textContent = `状态 #${game.revision} · ${game.rulesVersion} · 卡池 ${game.cardPoolVersion}`;
  renderCombatStatus(); renderRecentPlays(); renderResult(); renderAimGuide();
  $('log').innerHTML = uiLog.length ? uiLog.slice().reverse().map((l) => `<li>#${l.revision} · ${esc(l.text)}${l.eventCount ? ` · ${l.eventCount} 个规则事件` : ''}</li>`).join('') : '<li>新对局已准备好。完整动作记录见「下载回放」。</li>';
}
function onEntityClick(uid,index,event) {
  const inspect = () => {
    if ((!selected || selected.type === 'inspect') && game.players[index].board.some(m => m.uid === uid)) {
      handExpanded = false; selected = {type:'inspect',source:uid}; notice = ''; render();
    }
  };
  if (!humanTurn()) { inspect(); return; }
  if (selected) {
    const legalTarget = currentSelectionActions().find((a) => a.target === uid);
    if (legalTarget) { commitAction(legalTarget,false,event); return; }
    if (index === 1 && selected.type !== 'inspect' && currentSelectionActions().some(a => a.target)) {
      const taunts = game.players[1].board.filter(m => m.hp > 0 && m.keywords?.includes('taunt'));
      notice = selected.type === 'attack' && taunts.length ? '先处理嘲讽：请选择绿色标出的随从。' : '这个目标不可选，请选择绿色标出的目标。';
      render(); return;
    }
  }
  if (index === 0 && isMinionPlacement() && event.target.closest('#friendly-board')) {
    const placement = currentSelectionActions().find(a => !a.target);
    if (placement) { commitAction(placement,false,event); return; }
  }
  if (selected?.type === 'play') { notice='这个位置不可用，请按绿色指引选择，或返回手牌。'; render(); return; }
  if (index === 0 && actions().some((a) => a.type === 'attack' && a.source === uid)) {
    actionInputGuard.reset();
    handExpanded = false; selected = {type:'attack',source:uid}; notice = ''; render(); return;
  }
  inspect();
}
$('app').addEventListener('click',(event) => {
  if (actionInputGuard.ignores(event)) {
    // A newly played Charge unit may occupy the previous drop point. Permit
    // only source selection here; never bypass the guard for a command.
    const source = event.target.closest('[data-entity][data-player="0"]');
    if (!selected && source && humanTurn() && actions().some(a => a.type === 'attack' && a.player === 0 && a.source === source.dataset.entity)) {
      handExpanded = false; selected = {type:'attack',source:source.dataset.entity}; notice = ''; render();
    }
    return;
  }
  const card = event.target.closest('[data-card]');
  if (card) {
    const collapsedHand=handExpanded;
    handExpanded=false;selected=selected?.source===card.dataset.card?null:{type:'play',source:card.dataset.card};
    if(selected){actionInputGuard.reset();if(collapsedHand)actionInputGuard.remember(event);}
    // Collapsing changes hit targets. Ignore a rapid second pointer activation
    // at this point; a different target or keyboard second step remains usable.
    notice='';render();return;
  }
  const entity = event.target.closest('[data-entity]');
  if (entity) { onEntityClick(entity.dataset.entity,Number(entity.dataset.player),event); return; }
  if (event.target.closest('#friendly-board') && isMinionPlacement()) {
    const placement = currentSelectionActions().find(a => !a.target);
    if (placement) { commitAction(placement,false,event); return; }
  }
  if (event.target.closest('#hero-power')) { handExpanded = false; actionInputGuard.reset(); selected = {type:'power'}; notice = ''; render(); }
});
$('friendly-board').addEventListener('keydown',(event) => {
  if (event.target !== event.currentTarget || event.repeat || !['Enter',' '].includes(event.key)) return;
  event.preventDefault();
  const placement = isMinionPlacement() && currentSelectionActions().find(a => !a.target);
  if (placement) commitAction(placement,false,event);
});
$('menu-open').addEventListener('click',() => { pause('菜单已打开'); $('menu-dialog').showModal(); });
$('detail-open').addEventListener('click',() => {
  gestures?.cancel();
  if (game.active === 1) { const viewing = selected; pause('牌面详情已打开'); selected = viewing; render(); }
  $('detail-dialog').showModal();
});
$('recent-open').addEventListener('click',() => {
  if (!publicPlays().length) return;
  pause('正在查看最近出牌');
  $('recent-dialog').showModal();
});
$('pause').addEventListener('click',() => paused ? resume() : pause());
for(const [id,dir] of [['hand-prev',-1],['hand-next',1]]) $(id).addEventListener('click',()=>$('hand').scrollBy({left:dir*286,behavior:'instant'}));
$('cancel').addEventListener('click',() => { actionInputGuard.reset();clearCombatFX(); selected = null; handExpanded = false; render(); });
$('hand-count').addEventListener('click',() => { actionInputGuard.reset();gestures?.cancel(); handExpanded = !handExpanded; selected = null; notice = ''; render(); });
$('confirm').addEventListener('click',(event) => { if (actionInputGuard.ignores(event)) return; const action = currentSelectionActions().find((a) => !a.target); if (action) commitAction(action,false,event); });
$('end-turn').addEventListener('click',(event) => {
  if (actionInputGuard.ignores(event)) return;
  const end = actions().find((a) => a.player === 0 && a.type === 'end');
  if (humanTurn() && end) { selected = null; commitAction(end,false,event); }
});
$('hero-options').innerHTML = Object.entries(HEROES).map(([id,h],index) => `<label class="hero-option"><input type="radio" name="hero" value="${id}" ${index === 0 ? 'checked' : ''}><span>${h.name}<small>${h.role}</small></span></label>`).join('');
function openSetup() {
  if (saveBusy || saveFailure || closing || closeSent || $('setup-dialog').open) return;
  $('menu-dialog').close(); invalidatePendingImport(); pause('设置已打开');
  $('setup-error').textContent = ''; $('setup-dialog').showModal();
}
$('new-game').addEventListener('click',openSetup);
$('result-replay').addEventListener('click',openSetup);
$('result-finish').addEventListener('click',requestExit);
$('save-finish').addEventListener('click',requestExit);
$('snapshot-open').addEventListener('click',() => { $('menu-dialog').close(); pause('快照窗口已打开'); $('import-result').textContent = ''; $('snapshot-dialog').showModal(); });
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
  if (!$('setup-dialog').open || saveBusy || saveFailure || closing || closeSent) return;
  const data = new FormData(event.currentTarget);
  const config = Object.fromEntries(['heroHealth','deckSize','boardLimit','handLimit','maxMana'].map((key) => [key, Number(data.get(key))]));
  try {
    const nextGame = createGame({rulesSeed:Number(data.get('rulesSeed')),aiSeed:Number(data.get('aiSeed')),heroes:[data.get('hero'),data.get('opponentHero')],config});
    clearCombatFX(); cancelAITimer(); invalidatePendingImport();
    actionInputGuard.reset();
    resultRecoveryNote = ''; game = nextGame; paused = portrait.matches; pauseReason = paused ? '请横过手机再继续' : ''; selected = null; uiLog = []; recentPlayedCards = []; notice = '';
    $('setup-dialog').close(); render(); persist();
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
    clearCombatFX(); cancelAITimer(); actionInputGuard.reset(); resultRecoveryNote = ''; game = candidate; selected = null; paused = true; pauseReason = '快照已导入'; uiLog = []; recentPlayedCards = []; notice = '快照已导入。关闭窗口后点击「继续」恢复。';
    $('import-result').textContent = notice; render(); persist(); return true;
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
  if (event.key === 'Escape' && (spellFX.active() || combatFX || document.querySelector('.heavy-impact'))) { clearCombatFX(); render(); }
  // Held Enter/Space is one intent. A released-and-repressed key remains immediate.
  if (event.repeat && ['Enter',' ','Spacebar'].includes(event.key) && event.target?.closest?.('#confirm,#cancel,#end-turn,[data-card],[data-entity],#hero-power')) { event.preventDefault(); return; }
  if (event.key === 'Escape' && (selected || handExpanded) && !document.querySelector('dialog[open]')) { clearCombatFX(); gestures?.cancel(); selected = null; handExpanded = false; render(); }
});
function failText(r) {
  if (r.kind === 'rollback-failed') return '存档异常：主档状态不确定' + (r.backupVerified ? '。已验证的备份可以恢复' : '，也没有可用的备份');
  if (r.kind === 'conflict') return r.step === 'main-readable' ? '主档已能读取，是有效存档，请重新读取存档' : '另一个页面更新了这局，请重新读取存档';
  if (r.kind === 'readonly') return '存档版本不兼容，本页只读、不会写入，请刷新到新版。';
  if (r.kind === 'unreadable') return '主档仍然读不出来，本页保持暂停、不写任何存档，请稍后再试';
  if (r.kind === 'reconfirm') return '主档已能读取但已损坏' + (r.backupVerified ? '。确认后用已验证的备份覆盖主档' : '，也没有可用的备份');
  const last = store.lastSaved;
  return '保存失败，进度还在本页' + (last ? `；存档仍是第 ${last.revision} 步` : '；还没有成功的存档');
}
async function persist() {
  if (!store.writable) {
    saveNote = store.readOnly ? '只读：本页不会保存，请重新读取存档或刷新页面' : '当前浏览器无法安全保存，本局不会存档';
    render(); scheduleAI(); flushClose(); return false;
  }
  saveBusy = true; cancelAITimer(); render();
  const r = await store.save(game);
  saveBusy = false; lastSave = r;
  if (r.ok) {
    if (r.tmpLeft) tmpLeftCount += 1;
    saveNote = ''; render(); scheduleAI(); flushClose(); return true;
  }
  saveFailure = r; pause(failText(r)); showSaveFail(); return false;
}
function showSaveFail(exiting = closing) {
  const r = saveFailure; if (!r) return;
  const last = store.lastSaved;
  restoreArmed = false;
  $('save-text').textContent = failText(r) + (exiting ? '。仍要退出的话，本页没存上的进度会丢失。' : '。');
  $('save-error-info').textContent=['kind','why','step','code'].filter(k=>r[k]!==undefined).map(k=>k+': '+String(r[k])).join('；');
  const viaBackup = r.kind === 'rollback-failed' || r.kind === 'unreadable' || r.kind === 'reconfirm';
  $('save-retry').hidden = r.kind === 'conflict' || viaBackup;
  const canRestore = r.kind === 'conflict' || r.kind === 'readonly' || r.kind === 'unreadable' || (viaBackup ? r.backupVerified : !!last);
  $('save-restore').hidden = !canRestore;
  $('save-restore').textContent = r.kind === 'conflict' || r.kind === 'readonly' ? '重新读取存档' : r.kind === 'rollback-failed' ? '从备份恢复' : r.kind === 'unreadable' ? '再试一次' : r.kind === 'reconfirm' ? '用备份覆盖主档' : `回到最后成功档（第 ${last?.revision ?? 0} 步）`;
  $('save-exit').hidden = !exiting;
  $('save-finish').hidden = exiting || game.phase !== 'ended';
  if (!$('save-dialog').open) $('save-dialog').showModal();
}
$('save-dialog').addEventListener('cancel',(e) => e.preventDefault());
$('save-retry').addEventListener('click',async () => {
  if (saveBusy) return;
  const failedPauseReason = pauseReason;
  saveFailure = null;
  $('save-dialog').close();
  const saved = await persist();
  // Retain the pause; only replace the stale failure text after verified success.
  // A newer visibility, rotation or exit reason during the await takes precedence.
  if (saved && paused && pauseReason === failedPauseReason) {
    pauseReason = `已保存到第 ${store.lastSaved.revision} 步`;
    notice = '';
    render();
  } else if (!saved && !saveFailure) flushClose();
});
$('save-restore').addEventListener('click',() => {
  if (!restoreArmed && saveFailure?.kind !== 'conflict') { restoreArmed = true; $('save-restore').textContent = '确定？本页没存上的步数会丢失'; return; }
  $('save-dialog').close();
  if (closing) { closing = false; parentPort?.postMessage({card:'stay'}); }
  if (['rollback-failed','unreadable','reconfirm'].includes(saveFailure?.kind)) restoreFromBackup(); else boot();
});
async function restoreFromBackup() {
  saveBusy = true; cancelAITimer();
  const r = await store.restoreBackup();
  saveBusy = false;
  if (!r.ok) { saveFailure = r; pause(failText(r)); showSaveFail(); return; }
  saveFailure = null; actionInputGuard.reset();
  game = r.game; uiLog = []; recentPlayedCards = []; selected = null; notice = ''; saveNote = '';
  pause('已从备份恢复，点击继续');
  showResume(`已从备份恢复：第 ${r.turn} 回合 / 第 ${r.revision} 步。`, {resume:true});
}
$('save-download').addEventListener('click',() => download(`bookcard-snapshot-r${game.revision}.json`,serialize(game)));
$('save-exit').addEventListener('click',() => { if (!closing) return; $('save-dialog').close(); sendClose(); });
function showResume(text, {resume=false, abandon=false, fresh=false}) {
  abandonArmed = false;
  $('resume-text').textContent = text;
  $('resume-continue').hidden = !resume; $('resume-abandon').hidden = !abandon; $('resume-new').hidden = !fresh;
  $('resume-abandon').textContent = '放弃';
  if (!$('resume-dialog').open) $('resume-dialog').showModal();
}
$('resume-dialog').addEventListener('cancel',(e) => e.preventDefault());
$('resume-continue').addEventListener('click',() => { $('resume-dialog').close(); resume(); });
function startFresh() {
  clearCombatFX(); $('resume-dialog').close(); cancelAITimer(); actionInputGuard.reset();
  resultRecoveryNote = ''; game = freshGame(); uiLog = []; recentPlayedCards = []; selected = null; notice = '';
  paused = document.visibilityState === 'hidden' || portrait.matches; pauseReason = paused ? portrait.matches ? '请横过手机再继续' : '页面不可见，点击继续后恢复' : '';
  render(); persist();
}
$('resume-abandon').addEventListener('click',() => {
  if (!abandonArmed) { abandonArmed = true; $('resume-abandon').textContent = '确定放弃上一局？'; return; }
  startFresh();
});
$('resume-new').addEventListener('click',startFresh);
async function boot() {
  clearCombatFX(); resultRecoveryNote = ''; cancelAITimer(); saveFailure = null; closing = false; closeSent = false; paused = true; pauseReason = '正在读取存档'; render();
  // A missing or mismatched QA handshake stays paused and never falls back to live keys.
  await matchScope.ready;
  if (closeSent) return; // An exit queued before the handshake must not start a new save.
  const r = await store.load();
  if (closeSent) return; // Async load/quarantine may complete after an exit.
  const q = r.quarantine === 'saved' ? '原数据已另存。' : r.quarantine === 'occupied' ? '原数据未另存（隔离区已占用）。' : r.quarantine ? '原数据未能备份。' : '';
  const noWrite = r.writable === false ? ' 当前浏览器无法写存档。' : '';
  if (r.status === 'empty') { startFresh(); return; }
  if (r.status === 'ok' || r.status === 'recovered') {
    actionInputGuard.reset(); game = r.game; uiLog = []; recentPlayedCards = []; selected = null; notice = '';
    pause('上一局已恢复，点击继续');
    const head = r.status === 'recovered' ? `存档损坏，已回到最后一次成功存档（第 ${r.revision} 步）。${q}` : '';
    if (game.phase === 'ended') { resultRecoveryNote = `${head}${noWrite}`; pause('上一局已结束'); return; }
    showResume(`${head}继续上一局：第 ${r.turn} 回合 / 第 ${r.revision} 步。${noWrite}`, {resume:true, abandon:true});
    return;
  }
  if (r.status === 'future') { pause('只读'); showResume(`${r.why}，请刷新到新版。本页不会写存档。`, {fresh:true}); return; }
  pause('存档无法恢复');
  showResume(`存档无法恢复（${r.why}）。${q}${noWrite}`, {fresh:true});
}
// Embedded in the business page: the parent only opens, closes and syncs mute. It never reads card saves.
function onParent(d) {
  if (!d || typeof d !== 'object') return;
  if (collection?.receive(d)) return;
  if ((d.card === 'hello' || d.card === 'mute') && typeof d.muted === 'boolean') { muted = d.muted; document.body.dataset.muted = String(muted); bgm.update({muted}); }
  if (d.card === 'requestClose') requestExit();
}
function sendClose() {
  if (closeSent) return;
  if (embed && !parentPort) {
    notice = '正在连接书店，请稍候；也可使用书店的返回按钮。'; render(); return;
  }
  closeSent = true; closing = false;
  clearCombatFX(); cancelAITimer(); invalidatePendingImport();
  if (embed) parentPort.postMessage({card:'close'});
  else location.assign(new URL('../../',location.href).href);
  render();
}
function flushClose() { if (!closing || saveBusy) return; if (saveFailure) { showSaveFail(true); return; } sendClose(); }
function requestExit() { if (closing || closeSent) return; closing = true; pause('正在返回书店'); flushClose(); }
if (embed) {
  document.body.classList.add('embedded'); $('exit-embed').hidden = false;
  $('exit-embed').addEventListener('click',requestExit);
  window.addEventListener('message',(e) => {
    if (e.origin !== location.origin || e.source !== window.parent || e.data?.card !== 'port' || !e.ports?.[0]) return;
    if (!matchScope.authorize(e.data)) { e.ports[0].close(); notice = '书店存档隔离信息不匹配，未读取或写入对局存档。'; render(); return; }
    parentPort?.close(); parentPort = e.ports[0]; parentPort.onmessage = (ev) => onParent(ev.data); parentPort.postMessage({card:'ready'}); collection?.connected(); flushClose();
  });
}
// Every drop is resolved against current legal actions, never against a cached rule guess.
function gestureIntent(element) {
  if (!humanTurn() || document.querySelector('dialog[open]')) return null;
  if(element.closest('[data-card]')) return null; // Cards use explicit two-step click; horizontal browsing stays native.
  const sourceElement = element.closest('[data-entity]');
  if (!sourceElement || sourceElement.disabled) return null;
  const type = sourceElement.dataset.card ? 'play' : 'attack';
  const source = sourceElement.dataset.card || sourceElement.dataset.entity;
  if (!actions().some(a => a.player === 0 && a.type === type && a.source === source)) return null;
  return {type,source,fromExpandedHand:handExpanded && type === 'play',revision:game.revision,sourceElement,label:sourceElement.getAttribute('aria-label')?.split('，')[0] || '卡牌'};
}
function gestureDrop(intent,element) {
  if (!element || !humanTurn() || document.querySelector('dialog[open]') || game.revision !== intent.revision || selected?.source !== intent.source || selected?.type !== intent.type) return null;
  if (element.closest('#hand') || element.closest('[data-card]')) return null;
  const legal = currentSelectionActions();
  const entity = element.closest('[data-entity]');
  if (entity) {
    if (entity.dataset.entity === intent.source) return null;
    const targeted = legal.find(a => a.target === entity.dataset.entity);
    if (targeted) return targeted;
  }
  if (intent.type === 'play' && element.closest('#friendly-board')) return legal.find(a => !a.target) || null;
  return null;
}
gestures = attachBattleGestures({
  root:$('app'),getIntent:gestureIntent,
  begin(intent) {
    if (!humanTurn() || game.revision !== intent.revision) return false;
    handExpanded = false; selected = {type:intent.type,source:intent.source}; notice = ''; render();
  },
  getDropAction:gestureDrop,
  allowRevealedTarget(intent,element,action) {
    // Only an expanded hand collapsing may expose a new entity under its old
    // rectangle. gestureDrop already revalidates turn/revision/selection.
    const entity = element?.closest('[data-entity]');
    return intent.fromExpandedHand === true && intent.type === 'play' && !!action.target &&
      action.target !== intent.source && entity?.dataset.entity === action.target &&
      !element.closest('#hand,[data-card]');
  },
  commit(action,event) { commitAction(action,false,{detail:1,clientX:event.clientX,clientY:event.clientY}); },
  cancel() { clearCombatFX(); selected = null; render(); },
});
portrait.addEventListener('change',() => { gestures.cancel(); selected = null; actionInputGuard.reset(); pause(portrait.matches ? '请横过手机再继续' : '方向已改变，点击继续'); });
window.addEventListener('resize',() => { clearCombatFX(); gestures.cancel(); selected = null; render(); });
// Collection drafts never replace an active game without parent ownership validation
// and the collection's explicit replacement confirmation. Save the candidate before
// switching the in-memory game, using the unchanged v10a atomic save adapter.
async function startCollectionDeck(candidate) {
  if (candidate?.validated !== true || saveBusy || saveFailure || closing || closeSent || !store.writable) throw new Error('当前对局尚不能安全保存，请先处理存档状态。');
  cardcore.validateDeck(candidate.cards,candidate.classId,30);
  const nextGame = createGame({rulesSeed:123,aiSeed:456,heroes:[candidate.classId,'mage'],decks:[[...candidate.cards],cardcore.defaultDeck('mage')]});
  pause('正在保存收藏牌组新对局'); saveBusy = true; render();
  let result;
  try { result = await store.save(nextGame); }
  finally { saveBusy = false; }
  lastSave = result;
  if (!result.ok) { saveFailure = result; pause(failText(result)); showSaveFail(); throw new Error('新对局尚未确认安全保存，当前画面保留原对局。请处理存档提示。'); }
  if (result.tmpLeft) tmpLeftCount += 1;
  clearCombatFX(); cancelAITimer(); invalidatePendingImport(); actionInputGuard.reset();
  resultRecoveryNote = ''; game = nextGame; selected = null; uiLog = []; recentPlayedCards = []; notice = ''; saveNote = '';
  paused = true; pauseReason = '收藏牌组已保存，点击继续开始'; render(); flushClose();
}
collection = mountCollection({document,send:message=>{if(!parentPort)throw new Error('尚未连接书店');parentPort.postMessage(message);},pause:()=>pause('牌册已打开，对局保持暂停'),getMuted:()=>muted,startDeck:startCollectionDeck});
render(); boot();

// Read-only diagnostics for local browser regression checks. No global state hooks.
export function getDiagnostics() {
  return {bgm:bgm.status,combatFXActive:!!combatFX || spellFX.active(),spellFeedbackRemainingMs:spellFX.remaining(),spellFeedbackError:spellFX.error(),aiActionIntervalMs:AI_ACTION_INTERVAL_MS,aiCardReadMs:AI_CARD_READ_MS,publicPlays:publicPlays().map(entry => ({revision:entry.revision,player:entry.player,cardId:entry.playedCardId})),lastAction:uiLog.at(-1) ? {...uiLog.at(-1)} : null,handExpanded,interactionMode:handExpanded ? 'inspect-hand' : selected ? 'aim' : 'battle',revision:game.revision,hash:hashState(game),active:game.active,phase:game.phase,paused,aiScheduled:aiTimer !== null,aiSteps:game.active === 1 ? actionsThisTurn(game,1) : 0,selected:selected ? {...selected} : null,turn:game.turn,saveBusy,saveFailure:saveFailure ? {...saveFailure} : null,lastSaved:store.lastSaved,readOnly:store.readOnly,tmpLeftCount,muted,embed,closing,ported:!!parentPort,config:JSON.parse(JSON.stringify(game.config))};
}

