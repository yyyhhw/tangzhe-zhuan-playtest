/** Isolated, experimental rules kernel. Not a complete Basic-compatible game. */
import {RUNTIME_CARDS, CARD_METADATA, CATALOG, CATALOG_VERSION, CARD_SCHEMA_VERSION, RUNTIME_CLASSIFICATION} from './catalog.mjs?v=card-s1';
export {CARD_METADATA, CATALOG, CATALOG_VERSION, CARD_SCHEMA_VERSION, RUNTIME_CLASSIFICATION};
import frozenDefaultDecks from './default-decks.mjs?v=card-s1';
export const RULES_VERSION = 'bookstore-tech-0.6.0';
export const CARD_POOL_VERSION = 'bk-supported38-spell-damage-v6-lab-system-v1';
export const DECK_RULES_VERSION = 'fixed30-class-max2-v4-frozen-charge-defaults';
export const SNAPSHOT_NAMESPACE = 'bookstore-cardcore-lab-v1';
export const RNG_ALGORITHM = 'xorshift32-v1';
const clone = x => JSON.parse(JSON.stringify(x));
const deepFreeze = o => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
deepFreeze(frozenDefaultDecks);
// These two existing laboratory generated cards are never legal deck entries.
export const SYSTEM_CARDS = deepFreeze({
  spareMinute: {id:'spareMinute',name:'加班书签 · 测试',type:'spell',cost:0,text:'本回合增加 1 点可用法力，不超过实验上限。',effect:{kind:'mana',n:1,target:'none'},art:'placeholder'},
  paperHelper: {id:'paperHelper',name:'折纸助手 · 测试衍生',type:'minion',cost:1,attack:1,health:1,text:'英雄技能的测试衍生随从。',art:'placeholder'}
});
export const CARDS = deepFreeze({...RUNTIME_CARDS,...SYSTEM_CARDS});
export const HEROES = deepFreeze({warrior:'77 战士',mage:'阿宅 法师',paladin:'珍珠姐 圣骑士',warlock:'火箭 术士'});
export const DEFAULT_CONFIG = deepFreeze({heroHealth:30,deckSize:30,boardLimit:7,handLimit:10,maxMana:10,openingHands:[3,4],firstPlayer:0,shuffle:true,coin:true,mulligan:'disabled-pending',powers:{cost:2,warriorArmor:2,mageDamage:1,paladinToken:'paperHelper',warlockDraw:1,warlockDamage:2}});
export const PENDING_RULES = deepFreeze(['mulligan-order','freeze-release','deathrattle-chains','hero-death-during-advanced-effects','silence-health','aura-health-removal','stealth-taunt-targeting','battlecry-with-no-target','charge-windfury-divine-shield','multi-hit-random-dying-targets']);

export function stableStringify(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
  throw new Error('Only finite JSON data is supported');
}
export function hashState(value) {
  const s = stableStringify(value); let h = 2166136261;
  for(let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i),16777619) >>> 0;
  return h.toString(16).padStart(8,'0');
}
export function nextRandom(state) { let x=state>>>0; x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0; }
function randomIndex(g,n) { g.rng.rulesState=nextRandom(g.rng.rulesState);return Math.floor((g.rng.rulesState/4294967296)*n); }
const requireInt=(x,min,max,name)=>{if(!Number.isInteger(x)||x<min||x>max)throw new Error('Invalid '+name);return x;};
function checkVersion(r) { if(r.rulesVersion!==RULES_VERSION || r.cardPoolVersion!==CARD_POOL_VERSION || r.deckRulesVersion!==DECK_RULES_VERSION || r.cardDefinitionSchemaVersion!==CARD_SCHEMA_VERSION) throw new Error('Unsupported rulesVersion, cardPoolVersion deckRulesVersion or cardDefinitionSchemaVersion; snapshot kept unchanged.'); }
function configFor(input={}) {
  const c={...clone(DEFAULT_CONFIG),...clone(input),powers:{...DEFAULT_CONFIG.powers,...clone(input.powers??{})}};
  for(const [k,min,max] of [['heroHealth',1,200],['deckSize',1,100],['boardLimit',1,20],['handLimit',1,30],['maxMana',1,30]])requireInt(c[k],min,max,k);
  if(c.deckSize!==30)throw new Error('Invalid deck size: this version requires exactly 30 cards');
  requireInt(c.firstPlayer,0,1,'firstPlayer');
  if(!Array.isArray(c.openingHands)||c.openingHands.length!==2)throw new Error('Invalid openingHands');
  c.openingHands.forEach(x=>requireInt(x,0,c.handLimit,'opening hand'));
  if(typeof c.shuffle!=='boolean'||typeof c.coin!=='boolean'||c.mulligan!=='disabled-pending')throw new Error('Unsupported experimental setup');
  for(const k of ['cost','warriorArmor','mageDamage','warlockDraw','warlockDamage']) requireInt(c.powers[k],0,30,'power '+k);
  if(c.powers.paladinToken!=='paperHelper')throw new Error('Unsupported token');
  return c;
}
export function deckCapacity(classId) {
  if(!Object.hasOwn(HEROES,classId))throw new Error('Invalid hero class');
  return Object.values(CARD_METADATA).filter(c=>c.class==='neutral'||c.class===classId).length*2;
}
export function validateDeck(deck,classId,size=30) {
  if(!Object.hasOwn(HEROES,classId))throw new Error('Invalid hero class');
  requireInt(size,30,30,'deck size (exactly 30)');
  if(!Array.isArray(deck)||deck.length!==size)throw new Error('Invalid deck: exact configured size required');
  const counts=new Map();
  for(const id of deck) {
    if(typeof id!=='string'||!Object.hasOwn(CARD_METADATA,id))throw new Error('Invalid deck: unsupported, unknown, legacy or generated card '+String(id));
    const metadata=CARD_METADATA[id];
    if(metadata.class!=='neutral'&&metadata.class!==classId)throw new Error('Invalid deck: wrong class '+id);
    const n=(counts.get(id)??0)+1;counts.set(id,n);
    if(n>2)throw new Error('Invalid deck: maximum two copies of '+id);
  }
  return true;
}
export function defaultDeck(classId,size=30) {
  if(!Object.hasOwn(HEROES,classId))throw new Error('Invalid hero class');
  requireInt(size,30,30,'deck size (exactly 30)');
  // Admission expansion is deliberately decoupled from established fixture order.
  const deck=clone(frozenDefaultDecks[classId]);validateDeck(deck,classId,size);return deck;
}
function normalizeSetup(setup={}) {
  for(const [key,value] of [['rulesVersion',RULES_VERSION],['cardPoolVersion',CARD_POOL_VERSION],['deckRulesVersion',DECK_RULES_VERSION],['cardDefinitionSchemaVersion',CARD_SCHEMA_VERSION]])if(setup[key]!==undefined&&setup[key]!==value)throw new Error('Unsupported '+key);
  const config=configFor(setup.config);const heroes=clone(setup.heroes??['warrior','mage']);
  if(!Array.isArray(heroes)||heroes.length!==2||heroes.some(h=>!Object.hasOwn(HEROES,h)))throw new Error('Invalid heroes');
  const decks=clone(setup.decks??heroes.map(h=>defaultDeck(h,config.deckSize)));
  if(!Array.isArray(decks)||decks.length!==2)throw new Error('Invalid deck pair');
  decks.forEach((deck,i)=>validateDeck(deck,heroes[i],config.deckSize));
  return {rulesVersion:RULES_VERSION,cardPoolVersion:CARD_POOL_VERSION,deckRulesVersion:DECK_RULES_VERSION,cardDefinitionSchemaVersion:CARD_SCHEMA_VERSION,config,decks,heroes,rng:{algo:RNG_ALGORITHM,rulesSeed:requireInt(setup.rulesSeed??12345,1,4294967295,'rules seed'),aiSeed:requireInt(setup.aiSeed??67890,1,4294967295,'AI seed')}};
}
function uid(g,prefix='u') {return prefix+(g.nextUid++);}
function emit(events,type,fields={}) {events.push({type,...fields});}
/** Public, derived only. No bonus is cached on heroes, players or minion instances.
 * Only living minions on the caster's current board contribute; enemy sources,
 * hand, graveyard, and board order never affect the sum. Silence is not admitted.
 */
export function spellDamageBonus(game,player) {
  return game.players[player].board.reduce((sum,m)=>sum+(m.hp>0?(CARDS[m.cardId]?.spellDamage??0):0),0);
}
/** Null for non-damaging spells and non-spells, so callers cannot boost skills/heals. */
export function effectiveSpellDamage(game,player,card) {
  return card?.type==='spell'&&['damage','areaDamage'].includes(card.effect?.kind)?card.effect.n+spellDamageBonus(game,player):null;
}
function hurt(g,entity,n,events) {
  if(n<=0)return;
  const armor=entity.armor===undefined?0:Math.min(entity.armor,n);
  if(entity.armor!==undefined)entity.armor-=armor;
  entity.hp-=n-armor;if(entity.damage!==undefined)entity.damage=entity.maxHp-entity.hp;
  emit(events,'damage',{target:entity.uid,amount:n,absorbed:armor,hp:entity.hp});
}
function draw(g,player,n,events) {
  const p=g.players[player];for(let i=0;i<n;i++) {
    if(!p.deck.length){p.fatigue++;emit(events,'fatigue',{player,amount:p.fatigue});hurt(g,p.hero,p.fatigue,events);continue;}
    const cardId=p.deck.shift(); const card={uid:uid(g,'c'),cardId};
    if(p.hand.length>=g.config.handLimit){p.graveyard.push({...card,reason:'burn'});emit(events,'burn',{player,cardId,uid:card.uid});}
    else {p.hand.push(card);emit(events,'draw',{player,uid:card.uid,cardId});}
  }
}
function startTurn(g,events) {
  const p=g.players[g.active];p.maxMana=Math.min(g.config.maxMana,p.maxMana+1);p.mana=p.maxMana;p.tempMana=0;
  p.hero.powerUsed=false;p.hero.attacksLeft=1;p.hero.attackedThisTurn=false;p.hero.attack=p.weapon?.atk??0;
  for(const m of p.board){m.summoningSick=false;m.attacksLeft=1;m.attackedThisTurn=false;}
  emit(events,'turnStart',{player:g.active,turn:g.turn});draw(g,g.active,1,events);settle(g,events);
}
function settle(g,events) {
  const dead=g.players.flatMap((p,player)=>p.board.filter(m=>m.hp<=0).map(m=>({player,m}))).sort((a,b)=>a.m.playOrder-b.m.playOrder);
  for(const {player,m} of dead){g.players[player].board=g.players[player].board.filter(x=>x.uid!==m.uid);g.players[player].graveyard.push({...m,reason:'death'});emit(events,'death',{player,uid:m.uid,cardId:m.cardId});}
  // Only plain/simple effects are supported. Advanced phase/death rules are explicitly pending.
  const defeated=g.players.map(p=>p.hero.hp<=0);
  if(defeated.some(Boolean)){g.phase='ended';g.result={winner:defeated[0]&&defeated[1]?null:defeated[0]?1:0,reason:'experimental-simple-lethal'};emit(events,'gameEnd',g.result);}
}
export function createGame(setup={}) {
  const initial=normalizeSetup(setup);const g={rulesVersion:RULES_VERSION,cardPoolVersion:CARD_POOL_VERSION,deckRulesVersion:DECK_RULES_VERSION,cardDefinitionSchemaVersion:CARD_SCHEMA_VERSION,config:clone(initial.config),initial,revision:0,rng:{algo:RNG_ALGORITHM,rulesState:initial.rng.rulesSeed,aiState:initial.rng.aiSeed},turn:1,active:initial.config.firstPlayer,phase:'main',players:initial.heroes.map((classId,i)=>({classId,hero:{uid:'h'+i,name:HEROES[classId],hp:initial.config.heroHealth,maxHp:initial.config.heroHealth,armor:0,attack:0,frozen:false,attacksLeft:0,attackedThisTurn:false,powerUsed:false},weapon:null,mana:0,maxMana:0,tempMana:0,deck:clone(initial.decks[i]),hand:[],board:[],fatigue:0,graveyard:[]})),nextUid:1,playCounter:0,log:[],receipts:[],eventQueue:[],eventLog:[],result:null};
  const events=[];
  if(g.config.shuffle)for(const p of g.players)for(let i=p.deck.length-1;i>0;i--){const j=randomIndex(g,i+1);[p.deck[i],p.deck[j]]=[p.deck[j],p.deck[i]];}
  // openingHands is ordered by role: [first player, second player], not by seat.
  for(let i=0;i<2;i++)draw(g,i,g.config.openingHands[i===g.active?0:1],events);
  if(g.config.coin){const p=g.players[1-g.active];const c={uid:uid(g,'c'),cardId:'spareMinute'};if(p.hand.length<g.config.handLimit)p.hand.push(c);else p.graveyard.push({...c,reason:'burn'});}
  startTurn(g,events);g.eventLog=events;return g;
}
function allCharacters(g) {return g.players.flatMap((p,player)=>[{player,entity:p.hero},...p.board.map(entity=>({player,entity}))]);}
// Project deterministic event order: seat 0 then 1; hero then current board order.
// This is a log contract, not a claim about any historical original client's order.
function areaEntities(g,player,scope) {
  return allCharacters(g).filter(x=>scope==='allCharacters'||
    (scope==='enemyCharacters'&&x.player!==player)||
    (scope==='allMinions'&&x.entity!==g.players[x.player].hero)||
    (scope==='enemyMinions'&&x.player!==player&&x.entity!==g.players[x.player].hero));
}
function entityById(g,id) {return allCharacters(g).find(x=>x.entity.uid===id);}
function targetIds(g,player,target) {return allCharacters(g).filter(x=>target==='any'||(target==='enemy'&&x.player!==player)||(target==='friendly'&&x.player===player)).map(x=>x.entity.uid);}
function fail(code,message=code){return {ok:false,error:{code,message}};}
function actionValidation(g,c) {
  if(g.phase!=='main'||g.result)return fail('NOT_MAIN_PHASE');
  if(c.player!==g.active)return fail('NOT_YOUR_TURN');
  const p=g.players[c.player];
  if(c.type==='end')return (c.source!==undefined||c.target!==undefined||c.position!==undefined||c.cards!==undefined)?fail('UNEXPECTED_FIELD'):{ok:true};
  if(c.type==='play') {
    const hand=p.hand.find(x=>x.uid===c.source);if(!hand)return fail('SOURCE_NOT_IN_HAND');const card=CARDS[hand.cardId];
    if(!card || hand.cardId==='paperHelper')return fail('UNSUPPORTED_RUNTIME_CARD');
    const metadata=CARD_METADATA[hand.cardId];
    if(metadata&&metadata.class!=='neutral'&&metadata.class!==p.classId)return fail('WRONG_CARD_CLASS');
    if(card.cost>p.mana)return fail('NOT_ENOUGH_MANA');
    if(c.cards!==undefined)return fail('UNEXPECTED_FIELD');
    if(card.type==='minion') {
      if(p.board.length>=g.config.boardLimit)return fail('BOARD_FULL');
      if(c.target!==undefined)return fail('UNEXPECTED_TARGET');
      if(c.position!==undefined&&(!Number.isInteger(c.position)||c.position<0||c.position>p.board.length))return fail('INVALID_POSITION');
    } else {
      if(c.position!==undefined)return fail('UNEXPECTED_POSITION');
      const target=card.effect?.target??'none';
      if(target==='none'&&c.target!==undefined)return fail('UNEXPECTED_TARGET');
      if(target!=='none'&&!targetIds(g,c.player,target).includes(c.target))return fail('INVALID_TARGET');
    }
    return {ok:true};
  }
  if(c.type==='attack') {
    if(c.position!==undefined||c.cards!==undefined)return fail('UNEXPECTED_FIELD');
    const a=entityById(g,c.source),t=entityById(g,c.target);
    if(!a||a.player!==c.player||a.entity.hp<=0)return fail('INVALID_ATTACKER');
    if(!t||t.player===c.player||t.entity.hp<=0)return fail('INVALID_TARGET');
    const e=a.entity;if((e.atk??e.attack)<=0)return fail('ZERO_ATTACK');
    if(e.frozen)return fail('FROZEN');
    // Charge suppresses summoning sickness at action time; it never grants attacks.
    // No effect that adds/removes keywords, silence or interrupt phase is implemented.
    if(e.summoningSick&&!e.keywords?.includes('charge'))return fail('SUMMONING_SICK');
    if(e.attacksLeft<=0)return fail('NO_ATTACKS_LEFT');
    const blockers=g.players[1-c.player].board.filter(m=>m.hp>0&&m.keywords?.includes('taunt'));
    if(blockers.length&&!blockers.some(m=>m.uid===c.target))return fail('TAUNT_BLOCKS_TARGET');
    return {ok:true};
  }
  if(c.type==='power') {
    if(c.source!==undefined||c.position!==undefined||c.cards!==undefined)return fail('UNEXPECTED_FIELD');
    if(p.hero.powerUsed)return fail('POWER_USED');if(p.mana<g.config.powers.cost)return fail('NOT_ENOUGH_MANA');
    if(p.classId==='mage'){if(!targetIds(g,c.player,'any').includes(c.target))return fail('INVALID_TARGET');}
    else if(c.target!==undefined)return fail('UNEXPECTED_TARGET');
    if(p.classId==='paladin'&&p.board.length>=g.config.boardLimit)return fail('BOARD_FULL');
    return {ok:true};
  }
  return fail(c.type==='mulligan'?'PENDING_RULE':'UNKNOWN_ACTION');
}
function commandValidation(g,c) {
  if(!c||typeof c!=='object'||Array.isArray(c))return fail('INVALID_COMMAND');
  try{stableStringify(c);}catch{return fail('NON_JSON_COMMAND');}
  if(Object.keys(c).some(k=>!['commandId','expectedRevision','player','type','source','target','position','cards','_ai'].includes(k)))return fail('UNKNOWN_FIELD');
  if(typeof c.commandId!=='string'||!c.commandId.length||c.commandId.length>128)return fail('INVALID_COMMAND_ID');
  if(!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)return fail('INVALID_REVISION');
  if(c.player!==0&&c.player!==1)return fail('INVALID_PLAYER');
  for(const k of ['source','target'])if(c[k]!==undefined&&(typeof c[k]!=='string'||c[k].length>128))return fail('INVALID_'+k.toUpperCase());
  const old=g.receipts.find(r=>r.commandId===c.commandId);
  if(old){if(stableStringify(g.log.find(x=>x.command.commandId===c.commandId)?.command)!==stableStringify(c))return fail('COMMAND_ID_CONFLICT');return {ok:true,duplicate:true,receipt:clone(old)};}
  if(c.expectedRevision!==g.revision)return fail('STALE_REVISION');
  if(c._ai!==undefined){const ai=c._ai;if(!ai||ai.algorithm!=='greedy-v1'||ai.before!==g.rng.aiState||ai.after!==nextRandom(ai.before)||Object.keys(ai).sort().join(',')!=='after,algorithm,before')return fail('INVALID_AI_STATE');}
  return actionValidation(g,c);
}
export function validate(g,c) {try {return commandValidation(g,c);}catch {return fail('INVALID_STATE_OR_COMMAND');}}
export function legalActions(g) {
  if(g.phase!=='main'||g.result)return [];
  const player=g.active,p=g.players[player],out=[];
  const add=c=>{if(actionValidation(g,c).ok)out.push(c);};
  for(const c of p.hand){const card=CARDS[c.cardId];if(!card)continue;const target=card.effect?.target??'none';if(target==='none')add({player,type:'play',source:c.uid});else for(const id of targetIds(g,player,target))add({player,type:'play',source:c.uid,target:id});}
  for(const a of [p.hero,...p.board])for(const target of targetIds(g,player,'enemy'))add({player,type:'attack',source:a.uid,target});
  if(p.classId==='mage')for(const target of targetIds(g,player,'any'))add({player,type:'power',target});else add({player,type:'power'});
  add({player,type:'end'});return out;
}
function summon(g,player,cardId,events,position) {
  const p=g.players[player];if(p.board.length>=g.config.boardLimit){emit(events,'summonSkipped',{player,reason:'boardFull'});return;}
  const c=CARDS[cardId],m={uid:uid(g,'m'),cardId,baseAtk:c.attack,baseHp:c.health,atk:c.attack,hp:c.health,maxHp:c.health,damage:0,keywords:clone(c.keywords??[]),enchantments:[],summoningSick:true,attacksLeft:1,frozen:false,attackedThisTurn:false,silenced:false,playOrder:++g.playCounter};
  p.board.splice(position??p.board.length,0,m);emit(events,'summon',{player,uid:m.uid,cardId});
}
function resolve(g,c,events) {
  const p=g.players[c.player];
  if(c.type==='end') {p.tempMana=0;p.mana=0;p.hero.attack=0;emit(events,'turnEnd',{player:c.player});g.active=1-g.active;g.turn++;startTurn(g,events);return;}
  if(c.type==='play') {
    const index=p.hand.findIndex(x=>x.uid===c.source),hand=p.hand.splice(index,1)[0],card=CARDS[hand.cardId];p.mana-=card.cost;emit(events,'play',{player:c.player,uid:hand.uid,cardId:hand.cardId});
    if(card.type==='minion')summon(g,c.player,hand.cardId,events,c.position);
    else if(card.type==='weapon') {if(p.weapon){p.graveyard.push({...p.weapon,reason:'replaced'});emit(events,'weaponBreak',{player:c.player,reason:'replaced'});}p.weapon={uid:uid(g,'w'),cardId:card.id,atk:card.attack,dur:card.durability};p.hero.attack=p.weapon.atk;emit(events,'equip',{player:c.player,cardId:card.id});}
    else {
      p.graveyard.push({...hand,reason:'played'});const e=card.effect;
      if(e.kind==='damage'||e.kind==='areaDamage') {
        // One cast, one current-board bonus and target-set snapshot. A source dying
        // during this batch still boosts every target; the next cast derives anew.
        const n=effectiveSpellDamage(g,c.player,card);
        const affected=e.kind==='damage'?[entityById(g,c.target).entity]:areaEntities(g,c.player,e.scope).map(x=>x.entity);
        for(const entity of affected)hurt(g,entity,n,events);
      }
      if(e.kind==='heal'){const t=entityById(g,c.target).entity;const n=Math.min(e.n,t.maxHp-t.hp);t.hp+=n;if(t.damage!==undefined)t.damage=t.maxHp-t.hp;emit(events,'heal',{target:c.target,amount:n});}
      if(e.kind==='draw')draw(g,c.player,e.n,events);
      if(e.kind==='mana'){const n=Math.min(e.n,g.config.maxMana-p.mana);p.mana+=n;p.tempMana+=n;emit(events,'mana',{player:c.player,amount:n});}
      if(e.kind==='randomDamage'){const ids=targetIds(g,c.player,'enemy'),id=ids[randomIndex(g,ids.length)];emit(events,'randomTarget',{target:id});hurt(g,entityById(g,id).entity,e.n,events);}
    }
  } else if(c.type==='attack') {
    const a=entityById(g,c.source).entity,t=entityById(g,c.target).entity,damage=a.atk??a.attack,retaliation=t.atk??t.attack;
    a.attacksLeft--;a.attackedThisTurn=true;emit(events,'attack',{source:a.uid,target:t.uid});hurt(g,t,damage,events);hurt(g,a,retaliation,events);
    if(a.uid===p.hero.uid&&p.weapon){p.weapon.dur--;if(p.weapon.dur===0){p.graveyard.push({...p.weapon,reason:'broken'});p.weapon=null;p.hero.attack=0;emit(events,'weaponBreak',{player:c.player,reason:'durability'});}}
  } else if(c.type==='power') {
    p.mana-=g.config.powers.cost;p.hero.powerUsed=true;emit(events,'power',{player:c.player,classId:p.classId});const cfg=g.config.powers;
    if(p.classId==='warrior'){p.hero.armor+=cfg.warriorArmor;emit(events,'armor',{target:p.hero.uid,amount:cfg.warriorArmor});}
    if(p.classId==='mage')hurt(g,entityById(g,c.target).entity,cfg.mageDamage,events);
    if(p.classId==='paladin')summon(g,c.player,cfg.paladinToken,events);
    if(p.classId==='warlock'){draw(g,c.player,cfg.warlockDraw,events);hurt(g,p.hero,cfg.warlockDamage,events);}
  }
  settle(g,events);
}
/** Test hooks run outside the state; throwing anywhere rolls the entire action back. */
export function apply(game,command,hooks={}) {
  const v=validate(game,command);if(!v.ok)return {...v,game,events:[]};
  if(v.duplicate)return {ok:true,game,events:[],duplicate:true,receipt:v.receipt};
  try {
    const g=clone(game),c=clone(command),events=[];
    if(c._ai)g.rng.aiState=c._ai.after;
    hooks.beforeResolve?.(g,c);resolve(g,c,events);hooks.afterResolve?.(g,c,events);
    if(g.eventQueue.length)throw new Error('Unsettled queue');
    g.revision++;
    const receipt={commandId:c.commandId,committedRevision:g.revision,commandFingerprint:hashState(c),eventHash:hashState(events)};
    g.receipts.push(receipt);g.log.push({command:c,aiRng:c._ai?{before:c._ai.before,after:c._ai.after}:null,receipt:clone(receipt)});g.eventLog.push(...events);
    return {ok:true,game:g,events,receipt:clone(receipt)};
  }catch(error){return {ok:false,game,events:[],error:{code:'ENGINE_EXCEPTION',message:String(error?.message??error)}};}
}
export function getReplay(game) {return {...clone(game.initial),commands:game.log.map(x=>({command:clone(x.command),aiRng:clone(x.aiRng)}))};}
export function replay(record) {
  checkVersion(record);if(record.rng?.algo!==RNG_ALGORITHM)throw new Error('Unsupported RNG algorithm');
  let game=createGame({config:record.config,decks:record.decks,heroes:record.heroes,rulesSeed:record.rng.rulesSeed,aiSeed:record.rng.aiSeed});
  if(!Array.isArray(record.commands)||record.commands.length>20000)throw new Error('Invalid replay command list');
  for(const [i,item] of record.commands.entries()) {
    const expected=item.command?._ai?{before:item.command._ai.before,after:item.command._ai.after}:null;
    if(stableStringify(item.aiRng)!==stableStringify(expected))throw new Error('AI RNG record mismatch at '+i);
    const r=apply(game,item.command);if(!r.ok||r.duplicate)throw new Error('Invalid replay command '+i+': '+(r.error?.code??'duplicate'));game=r.game;
  }
  return game;
}
export function serialize(game) {return stableStringify({namespace:SNAPSHOT_NAMESPACE,schema:2,checksum:hashState(game),game});}
export function deserialize(text) {
  if(typeof text!=='string'||text.length>16000000)throw new Error('Invalid snapshot text');
  const s=JSON.parse(text);if(s.namespace!==SNAPSHOT_NAMESPACE||s.schema!==2)throw new Error('Unsupported prototype snapshot namespace/schema');
  checkVersion(s.game);if(s.checksum!==hashState(s.game))throw new Error('Snapshot checksum mismatch');
  const rebuilt=replay(getReplay(s.game));if(stableStringify(rebuilt)!==stableStringify(s.game))throw new Error('Snapshot does not match its verified command history');
  return rebuilt;
}
/** A bounded, in-memory last-good snapshot store. It never accesses browser storage. */
export function createSnapshotBuffer(initial) {
  let lastGood=serialize(initial);
  return {save(game){try {const temp=serialize(game);deserialize(temp);lastGood=temp;return {ok:true};}catch(e){return fail('SNAPSHOT_SAVE_FAILED',e.message);}},load(){return deserialize(lastGood);},export(){return lastGood;},import(text){try{const g=deserialize(text);lastGood=serialize(g);return {ok:true,game:g};}catch(e){return fail('SNAPSHOT_IMPORT_FAILED',e.message);}}};
}
/** AI score input deliberately excludes the opponent hand and BOTH deck orders. */
export function aiView(game) {
  const player=game.active;
  return {player,config:clone(game.config),players:game.players.map((p,i)=>({classId:p.classId,hero:clone(p.hero),mana:p.mana,maxMana:p.maxMana,weapon:clone(p.weapon),board:clone(p.board),deckCount:p.deck.length,handCount:p.hand.length,...(i===player?{hand:clone(p.hand)}:{})}))};
}
function scoreAction(view,a) {
  const p=view.players[a.player],other=view.players[1-a.player],characters=view.players.flatMap((q,i)=>[{entity:q.hero,player:i},...q.board.map(entity=>({entity,player:i}))]),lookup=id=>characters.find(x=>x.entity.uid===id),t=lookup(a.target),me=lookup(a.source);
  if(a.type==='end')return -100;
  if(a.type==='attack') {
    const atk=me.entity.atk??me.entity.attack;
    if(t.entity.uid===other.hero.uid)return atk>=other.hero.hp+other.hero.armor?10000:20+atk;
    const retaliation=t.entity.atk??t.entity.attack,kill=atk>=t.entity.hp,survives=me.entity.hp>retaliation;
    return 25+(kill?20:0)+(survives?10:0)+t.entity.atk*2-retaliation;
  }
  if(a.type==='play') {
    const card=CARDS[p.hand.find(x=>x.uid===a.source).cardId];
    if(card.type==='minion')return 40+card.cost+card.attack;
    if(card.type==='weapon')return p.weapon?5:38+card.attack;
    if(card.effect.kind==='areaDamage') {
      const affected=areaEntities(view,a.player,card.effect.scope),n=effectiveSpellDamage(view,a.player,card);
      const lethal=hero=>affected.some(x=>x.entity===hero)&&n>=hero.hp+hero.armor;
      // Even a simultaneous draw is intentionally declined by this conservative AI.
      if(lethal(p.hero))return -1000;
      if(lethal(other.hero))return 10000;
      if(!affected.length)return -120;
      return affected.reduce((score,{entity,player})=>{
        const hero=entity===view.players[player].hero,damage=Math.min(n,entity.hp+(entity.armor??0));
        const value=hero?damage*4:damage*3+(n>=entity.hp?18+(entity.atk??0)*3:0);
        return score+(player===a.player?-value:value);
      },-card.cost);
    }
    if(card.effect.kind==='damage'&&t.player===a.player)return -1000;
    if(card.effect.kind==='heal'&&t.player!==a.player)return -80;
    if(card.effect.kind==='damage'){const n=effectiveSpellDamage(view,a.player,card);return t.entity.uid===other.hero.uid&&n>=other.hero.hp+other.hero.armor?10000:35+(t.entity.hp<=n?20:0);}
    if(card.effect.kind==='heal')return Math.min(card.effect.n,t.entity.maxHp-t.entity.hp)*6-5;
    if(card.effect.kind==='draw')return p.handCount>7?-10:26;
    if(card.effect.kind==='mana')return p.hand.some(h=>CARDS[h.cardId].cost===p.mana+1)?45:-20;
    return 28;
  }
  if(a.type==='power') {
    if(p.classId==='mage'){if(t.player===a.player)return -80;return t.entity.uid===other.hero.uid&&view.config.powers.mageDamage>=other.hero.hp+other.hero.armor?10000:12+(t.entity.hp<=view.config.powers.mageDamage?30:0);}
    if(p.classId==='warlock')return p.hero.hp<=view.config.powers.warlockDamage||p.handCount>=view.config.handLimit||p.deckCount===0?-120:10;
    return 12;
  }
  return -1000;
}
export function chooseAIAction(game) {
  const actions=legalActions(game);if(!actions.length)return null;
  const view=aiView(game),ranked=actions.map(action=>({action,score:scoreAction(view,action)})),best=Math.max(...ranked.map(x=>x.score)),ties=ranked.filter(x=>x.score===best),before=game.rng.aiState,after=nextRandom(before),choice=ties[Math.floor(after/4294967296*ties.length)].action;
  return {...choice,commandId:`ai:${game.active}:${game.revision}:${before}`,expectedRevision:game.revision,_ai:{algorithm:'greedy-v1',before,after}};
}
/** Counts committed actions in the current turn, so snapshot restore cannot reset the guard. */
export function actionsThisTurn(game,player=game.active) {
  if(player!==game.active)return 0;let count=0;
  for(let i=game.log.length-1;i>=0;i--){const c=game.log[i].command;if(c.player!==player||c.type==='end')break;count++;}
  return count;
}
/** Runs complete atomic actions; never ends after terminal/turn-change; end failure stops. */
export function runAITurn(initial,options={}) {
  const maxSteps=options.maxSteps??30;requireInt(maxSteps,1,30,'maxSteps');
  const actor=initial.active,commands=[],diagnostics=[];let game=initial,guarded=false;
  const choose=options.choose??chooseAIAction,submit=options.apply??apply;
  for(let i=actionsThisTurn(initial,actor);i<maxSteps;i++) {
    if(game.phase!=='main'||game.result||game.active!==actor)return {game,commands,diagnostics,guarded};
    const command=choose(game);if(!command){diagnostics.push({code:'AI_NO_COMMAND'});return {game,commands,diagnostics,guarded};}
    const r=submit(game,command);if(!r.ok||r.duplicate){diagnostics.push({code:r.error?.code??'AI_DUPLICATE',command});return {game,commands,diagnostics,guarded};}
    game=r.game;commands.push(command);
  }
  if(game.phase==='main'&&!game.result&&game.active===actor) {
    const before=game.rng.aiState;const command={player:actor,type:'end',commandId:`guard:${actor}:${game.revision}`,expectedRevision:game.revision,_ai:{algorithm:'greedy-v1',before,after:nextRandom(before)}};
    if(validate(game,command).ok){guarded=true;const r=submit(game,command);if(r.ok&&!r.duplicate){game=r.game;commands.push(command);}else diagnostics.push({code:r.error?.code??'AI_GUARD_DUPLICATE',command});}
    else diagnostics.push({code:'AI_GUARD_END_ILLEGAL'});
  }
  return {game,commands,diagnostics,guarded};
}
