// node --test tests/classes/classes.test.mjs
// 四职业规则层验收骨架，用例 ID 对应 tests/classes/README.md。
// 前置不满足 → assert.fail('FAIL 未实现：…')；口径未定 → assert.fail('FAIL 待定口径：…')。不用 test.skip。
// rich/giveCard/placeMinion 直接改局面，改过的局不能 replay；重放只验纯引擎局（H0、C6、S2）。
// 卡牌 id 由熊大登记：CLASS_CARD_IDS=/path/ids.json 覆盖下面的 CARD 表。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../../preview/cards/cardcore.mjs?v=card-s1';

const CLASSES = ['priest', 'rogue', 'druid', 'shaman'];
const OPP = 'warrior';
const HS_HERO_NAMES = ['安度因', '瓦莉拉', '玛法里奥', '萨尔', 'Anduin', 'Valeera', 'Malfurion', 'Thrall'];

const CARD = {
  priest: {holyNova: null, northshire: null, divineSpirit: null, swPain: null, swDeath: null},
  rogue: {deadlyPoison: null, backstab: null, eviscerate: null, stealthMinion: null, aoe: null},
  druid: {innervate: null, wildGrowth: null, wrath: null},
  shaman: {lightningBolt: null, overload2: null, totems: null},
};
if (process.env.CLASS_CARD_IDS) {
  const extra = JSON.parse(readFileSync(process.env.CLASS_CARD_IDS, 'utf8'));
  for (const [cls, roles] of Object.entries(extra)) Object.assign(CARD[cls] ??= {}, roles);
}

const MISSING = (what) => assert.fail(`FAIL 未实现：${what}`);
const PENDING = (what) => assert.fail(`FAIL 待定口径：${what}（等熊大设计稿）`);
const keywords = () => new Set(Object.values(core.CARDS).flatMap((d) => d.keywords ?? []));
const hasEffectField = (field) => Object.values(core.CARDS).some((d) => d[field] !== undefined || d.effect?.[field] !== undefined);

function needClass(cls) {
  if (!Object.hasOwn(core.HEROES, cls)) MISSING(`${cls} 未注册（HEROES 只有 ${Object.keys(core.HEROES).join('/')}）`);
}
function needKeyword(k) {
  if (!keywords().has(k)) MISSING(`关键词 ${k}（现有 ${[...keywords()].join('/')}）`);
}
function needField(field, label) {
  if (!hasEffectField(field)) MISSING(`${label}：没有任何卡带 ${field} 字段`);
}
function needCard(cls, role) {
  needClass(cls);
  const id = CARD[cls]?.[role];
  if (!id) MISSING(`${cls}/${role} 卡 id 未登记`);
  if (!Object.hasOwn(core.CARDS, id)) MISSING(`${cls}/${role}=${id} 不在 CARDS`);
  return id;
}

function newGame(cls, {seed = 4242, opp = OPP, config = {}} = {}) {
  needClass(cls);
  return core.createGame({heroes: [cls, opp], rulesSeed: seed, aiSeed: 777, config: {shuffle: false, coin: false, ...config}});
}
function rich(g, mana = 10, player = g.active) {
  const p = g.players[player];
  p.mana = mana; p.maxMana = Math.max(p.maxMana, Math.min(mana, 10));
  return g;
}
let seq = 0;
const cmd = (g, x) => ({player: g.active, commandId: `t${++seq}`, expectedRevision: g.revision, ...x});
const run = (g, x) => core.apply(g, cmd(g, x));
function ok(r) { assert.ok(r.ok, `命令被拒：${JSON.stringify(r.error)}`); return r.game; }
function rejected(r, code) { assert.equal(r.ok, false, '应被拒绝'); assert.equal(r.error?.code, code); }
const endTurn = (g) => ok(run(g, {type: 'end'}));
const nextOwnTurn = (g) => endTurn(endTurn(g));
function giveCard(g, cardId, player = g.active) {
  const c = {uid: `tq${++seq}`, cardId};
  g.players[player].hand.push(c);
  return c.uid;
}
function placeMinion(g, cardId, player = g.active, patch = {}) {
  const c = core.CARDS[cardId];
  const m = {uid: `tm${++seq}`, cardId, baseAtk: c.attack, baseHp: c.health, atk: c.attack, hp: c.health, maxHp: c.health, damage: 0,
    keywords: structuredClone(c.keywords ?? []), enchantments: [], summoningSick: false, attacksLeft: 1, frozen: false,
    attackedThisTurn: false, silenced: false, playOrder: ++g.playCounter, ...patch};
  g.players[player].board.push(m);
  return m.uid;
}
const VANILLA = Object.keys(core.CARDS).find((k) => core.CARDS[k].type === 'minion' && !core.CARDS[k].keywords && !core.CARDS[k].effect);
const powerCmd = (cls) => (cls === 'priest' ? {type: 'power', target: 'h0'} : {type: 'power'});
const hero = (g, i) => g.players[i].hero;
const ev = (r, type) => r.events.filter((e) => e.type === type);

// H0：骨架自检，用已有的战士/法师证明辅助函数可用；这一组应该过，过不了说明骨架本身坏了。
test('H0 骨架自检（现有职业）', () => {
  let g = rich(core.createGame({heroes: ['warrior', 'mage'], rulesSeed: 4242, aiSeed: 777, config: {shuffle: false, coin: false}}));
  const r = run(g, {type: 'power'}); g = ok(r);
  assert.equal(hero(g, 0).armor, 2); assert.equal(g.players[0].mana, 8);
  rejected(run(g, {type: 'power'}), 'POWER_USED');
  assert.ok(VANILLA, '找不到无效果随从');
  placeMinion(g, VANILLA, 1);
  g = nextOwnTurn(g); assert.equal(g.active, 0);
  let pure = core.createGame({heroes: ['warrior', 'mage'], rulesSeed: 4242, aiSeed: 777, config: {shuffle: false, coin: false}});
  pure = nextOwnTurn(pure); pure = ok(run(pure, {type: 'power'}));
  assert.equal(core.hashState(core.replay(core.getReplay(pure))), core.hashState(pure));
});

// 1. 通用
for (const cls of CLASSES) {
  test(`C1 [基础] ${cls} 注册`, () => {
    needClass(cls);
    const name = core.HEROES[cls];
    assert.ok(typeof name === 'string' && name.length > 0);
    for (const n of HS_HERO_NAMES) assert.ok(!name.includes(n), `英雄名用了炉石英雄名 ${n}`);
  });
  test(`C2 [基础] ${cls} 默认卡组 30 张`, () => {
    needClass(cls);
    const deck = core.defaultDeck(cls);
    assert.equal(deck.length, 30);
    assert.equal(core.validateDeck(deck, cls), true);
    const mage = core.defaultDeck('mage').find((id) => Object.values(core.CARD_METADATA).some((m) => m.class === 'mage' && m.id.replace(/-(\w)/g, (_, x) => x.toUpperCase()) === id));
    if (mage) assert.throws(() => core.validateDeck([...deck.slice(0, 29), mage], cls), /wrong class/);
  });
  test(`C3 [基础] ${cls} 技能 2 费、每回合一次`, () => {
    let g = rich(newGame(cls));
    g = ok(run(g, powerCmd(cls)));
    assert.equal(g.players[0].mana, 8);
    rejected(run(g, powerCmd(cls)), 'POWER_USED');
    const poor = rich(newGame(cls), 1);
    rejected(run(poor, powerCmd(cls)), 'NOT_ENOUGH_MANA');
    assert.equal(poor.players[0].mana, 1);
  });
  test(`C4 [基础] ${cls} 技能目标字段`, () => {
    const g = rich(newGame(cls));
    if (cls === 'priest') rejected(run(g, {type: 'power'}), 'INVALID_TARGET');
    else rejected(run(g, {type: 'power', target: 'h1'}), 'UNEXPECTED_TARGET');
  });
  test(`C5 [基础] ${cls} AI 20 回合不卡死`, () => {
    let g = newGame(cls, {config: {shuffle: true}});
    for (let i = 0; i < 400 && g.phase === 'main' && g.turn <= 40; i++) {
      const c = core.chooseAIAction(g);
      assert.ok(c, 'AI_NO_COMMAND');
      g = ok(core.apply(g, c));
    }
    assert.ok(g.turn > 40 || g.phase !== 'main');
  });
  test(`C6 [基础] ${cls} 存档与重放`, () => {
    let g = newGame(cls, {config: {shuffle: true}});
    for (let i = 0; i < 60 && g.phase === 'main'; i++) g = ok(core.apply(g, core.chooseAIAction(g)));
    const back = core.deserialize(core.serialize(g));
    assert.equal(core.hashState(back.game ?? back), core.hashState(g));
    assert.equal(core.hashState(core.replay(core.getReplay(g))), core.hashState(g));
  });
  test(`C7 UI ${cls} 手牌关键词写在卡面上`, () => { needClass(cls); MISSING('UI 用例走 Playwright（tests/classes 的 UI runner 未交）'); });
  test(`C8 UI ${cls} 技能按钮写明费用、效果、是否选目标`, () => { needClass(cls); MISSING('UI 用例走 Playwright（tests/classes 的 UI runner 未交）'); });
}

// 2. 牧师
const priestHeal = (hp, target = 'h0', setup) => {
  let g = rich(newGame('priest'));
  hero(g, target === 'h0' ? 0 : 1).hp = hp;
  setup?.(g);
  const r = run(g, {type: 'power', target});
  return {r, g: ok(r)};
};
test('P1 [基础] 牧师技能：27 → 29', () => {
  const {r, g} = priestHeal(27);
  assert.equal(hero(g, 0).hp, 29);
  assert.ok(ev(r, 'heal').some((e) => e.amount === 2));
});
test('P2 [基础] 治疗不超过上限：29 → 30', () => {
  const {g} = priestHeal(29);
  assert.equal(hero(g, 0).hp, 30);
  assert.ok(hero(g, 0).hp <= hero(g, 0).maxHp);
});
test('P3 [基础] 满血也能用技能', () => {
  const {g} = priestHeal(30);
  assert.equal(hero(g, 0).hp, 30); assert.equal(g.players[0].mana, 8);
});
test('P4 [基础] 技能可指敌方：25 → 27', () => {
  const {g} = priestHeal(25, 'h1');
  assert.equal(hero(g, 1).hp, 27);
});
test('P5 [基础] 神圣新星：先伤害后治疗', () => {
  const id = needCard('priest', 'holyNova');
  const g = rich(newGame('priest'));
  hero(g, 0).hp = 25;
  const src = giveCard(g, id);
  const r = run(g, {type: 'play', source: src});
  const after = ok(r);
  assert.equal(hero(after, 1).hp, 28); assert.equal(hero(after, 0).hp, 27);
  const i = r.events.findIndex((e) => e.type === 'damage'), j = r.events.findIndex((e) => e.type === 'heal');
  assert.ok(i >= 0 && j > i, '伤害要在治疗之前');
});
test('P6 [基础][未核对] 北郡牧师：满血随从被治疗', () => { needClass('priest'); needCard('priest', 'northshire'); PENDING('P6 满血时被治疗算不算'); });
test('P7 [基础] 神圣之灵：当前生命和上限都翻倍', () => {
  const id = needCard('priest', 'divineSpirit');
  const g = rich(newGame('priest'));
  const m = placeMinion(g, VANILLA, 0, {hp: 2, maxHp: 3});
  const after = ok(run(g, {type: 'play', source: giveCard(g, id), target: m}));
  const x = after.players[0].board.find((b) => b.uid === m);
  assert.equal(x.hp, 4); assert.ok(x.hp <= x.maxHp);
});
test('P8 [基础] 暗言术：攻击 3/4/5 的边界', () => {
  const pain = needCard('priest', 'swPain'), death = needCard('priest', 'swDeath');
  const g = rich(newGame('priest'));
  const a3 = placeMinion(g, VANILLA, 1, {atk: 3}), a4 = placeMinion(g, VANILLA, 1, {atk: 4}), a5 = placeMinion(g, VANILLA, 1, {atk: 5});
  rejected(run(g, {type: 'play', source: giveCard(g, pain), target: a4}), 'INVALID_TARGET');
  rejected(run(g, {type: 'play', source: giveCard(g, death), target: a4}), 'INVALID_TARGET');
  ok(run(g, {type: 'play', source: giveCard(g, pain), target: a3}));
  ok(run(g, {type: 'play', source: giveCard(g, death), target: a5}));
});

// 3. 潜行者
const dagger = (g) => ok(run(g, {type: 'power'}));
const wDur = (w) => w?.dur ?? w?.durability;
test('R1 [基础] 技能装备 1/2 匕首', () => {
  const g = dagger(rich(newGame('rogue')));
  assert.equal(g.players[0].weapon?.atk, 1); assert.equal(wDur(g.players[0].weapon), 2);
  assert.equal(hero(g, 0).attack, 1);
});
test('R2 [基础] 匕首耐久 2→1→0 后消失', () => {
  let g = dagger(rich(newGame('rogue')));
  g = ok(run(g, {type: 'attack', source: 'h0', target: 'h1'}));
  assert.equal(wDur(g.players[0].weapon), 1);
  g = rich(nextOwnTurn(g));
  const r = run(g, {type: 'attack', source: 'h0', target: 'h1'}); g = ok(r);
  assert.equal(g.players[0].weapon, null);
  assert.equal(ev(r, 'weaponBreak').length, 1);
});
test('R3 [基础] 有武器时再用技能会替换', () => {
  let g = dagger(rich(newGame('rogue')));
  g.players[0].weapon.atk = 3;
  g = rich(nextOwnTurn(g));
  const r = run(g, {type: 'power'}); g = ok(r);
  assert.equal(g.players[0].weapon.atk, 1); assert.equal(wDur(g.players[0].weapon), 2);
  assert.ok(ev(r, 'weaponBreak').some((e) => e.reason === 'replaced'));
});
test('R4 [基础] 致命药膏：没武器不能打', () => {
  const id = needCard('rogue', 'deadlyPoison');
  const g = rich(newGame('rogue'));
  const r = run(g, {type: 'play', source: giveCard(g, id)});
  assert.equal(r.ok, false); assert.equal(g.players[0].mana, 10);
  const armed = dagger(rich(newGame('rogue')));
  const after = ok(run(armed, {type: 'play', source: giveCard(armed, id)}));
  assert.equal(after.players[0].weapon.atk, 3);
});
test('R5 [基础] 背刺只能指未受伤随从', () => {
  const id = needCard('rogue', 'backstab');
  const g = rich(newGame('rogue'));
  const hurtM = placeMinion(g, VANILLA, 1, {damage: 1, hp: Math.max(1, core.CARDS[VANILLA].health - 1)});
  rejected(run(g, {type: 'play', source: giveCard(g, id), target: hurtM}), 'INVALID_TARGET');
});
const comboSetup = () => { needClass('rogue'); needKeyword('combo'); return needCard('rogue', 'eviscerate'); };
test('R6 [经典] 连击：本回合第一张牌只出基础效果', () => {
  const id = comboSetup();
  const g = rich(newGame('rogue'));
  const after = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  assert.equal(hero(after, 1).hp, 28);
});
test('R7 [经典] 连击：本回合第二张牌触发', () => {
  const id = comboSetup();
  let g = rich(newGame('rogue'));
  g = ok(run(g, {type: 'play', source: giveCard(g, VANILLA), position: 0}));
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  assert.equal(hero(g, 1).hp, 26);
});
test('R8 [经典] 连击计数跨回合重置', () => {
  const id = comboSetup();
  let g = rich(newGame('rogue'));
  g = ok(run(g, {type: 'play', source: giveCard(g, VANILLA), position: 0}));
  g = rich(nextOwnTurn(g));
  const hp = hero(g, 1).hp;
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  assert.equal(hero(g, 1).hp, hp - 2);
});
test('R9 [经典][未核对] 先用技能再出连击牌', () => { comboSetup(); PENDING('R9 用技能算不算打出过牌'); });
const stealthSetup = () => { needClass('rogue'); needKeyword('stealth'); return needCard('rogue', 'stealthMinion'); };
test('R10 [经典] 潜行挡住指定目标', () => {
  const id = stealthSetup();
  let g = rich(newGame('rogue'));
  const s = placeMinion(g, id, 0);
  g = endTurn(g);
  g.players[1].hero.attack = 0;
  const att = placeMinion(g, VANILLA, 1);
  rejected(run(g, {type: 'attack', source: att, target: s}), 'INVALID_TARGET');
  assert.ok(!core.legalActions(g).some((a) => a.target === s), '非法动作不能列出潜行随从');
});
test('R11 [经典] 群伤能打到潜行随从', () => {
  const id = stealthSetup(), aoe = needCard('rogue', 'aoe');
  const g = rich(newGame('rogue'));
  const s = placeMinion(g, id, 1);
  const after = ok(run(g, {type: 'play', source: giveCard(g, aoe)}));
  const x = after.players[1].board.find((b) => b.uid === s);
  assert.ok(!x || x.hp < core.CARDS[id].health);
});
test('R12 [经典] 潜行随从攻击后失去潜行', () => {
  const id = stealthSetup();
  const g = rich(newGame('rogue'));
  const s = placeMinion(g, id, 0);
  const after = ok(run(g, {type: 'attack', source: s, target: 'h1'}));
  assert.ok(!after.players[0].board.find((b) => b.uid === s)?.keywords.includes('stealth'));
});
test('R13 [经典][未核对] 潜行加嘲讽', () => { stealthSetup(); PENDING('R13 stealth-taunt-targeting'); });

// 4. 德鲁伊
test('D1 [基础] 技能：攻击 +1、护甲 +1', () => {
  const g = ok(run(rich(newGame('druid')), {type: 'power'}));
  assert.equal(hero(g, 0).attack, 1); assert.equal(hero(g, 0).armor, 1);
});
test('D2 [基础] 回合结束：攻击回落，护甲保留', () => {
  let g = ok(run(rich(newGame('druid')), {type: 'power'}));
  g = endTurn(g);
  assert.equal(hero(g, 0).attack, g.players[0].weapon?.atk ?? 0); assert.equal(hero(g, 0).armor, 1);
});
test('D3 [基础] 护甲先抵伤', () => {
  let g = ok(run(rich(newGame('druid')), {type: 'power'}));
  g = endTurn(g);
  g.players[1].hero.attack = 3;
  const r = run(g, {type: 'attack', source: 'h1', target: 'h0'}); g = ok(r);
  assert.equal(hero(g, 0).armor, 0); assert.equal(hero(g, 0).hp, 28);
  assert.ok(ev(r, 'damage').some((e) => e.target === 'h0' && e.absorbed === 1));
});
test('D4 [基础] 激活：本回合多 2 点，maxMana 不变', () => {
  const id = needCard('druid', 'innervate');
  let g = rich(newGame('druid'), 5);
  const max = g.players[0].maxMana;
  g = ok(run(g, {type: 'play', source: giveCard(g, id)}));
  assert.equal(g.players[0].mana, 5 - core.CARDS[id].cost + 2); assert.equal(g.players[0].maxMana, max);
  g = nextOwnTurn(g);
  assert.equal(g.players[0].mana, g.players[0].maxMana);
});
test('D5 [基础][未核对] 激活后法力超过 10', () => { needClass('druid'); needCard('druid', 'innervate'); PENDING('D5 封顶 10 还是可临时超过'); });
test('D6 [基础] 野性成长：空水晶', () => {
  const id = needCard('druid', 'wildGrowth');
  let g = rich(newGame('druid'), 5);
  g.players[0].maxMana = 5;
  g = ok(run(g, {type: 'play', source: giveCard(g, id)}));
  assert.equal(g.players[0].maxMana, 6); assert.equal(g.players[0].mana, 5 - core.CARDS[id].cost);
});
test('D7 [基础][未核对] 10 个水晶时野性成长', () => { needClass('druid'); needCard('druid', 'wildGrowth'); PENDING('D7 满水晶时是否给替代牌'); });
const chooseSetup = () => { needClass('druid'); needField('chooseOne', '抉择'); return needCard('druid', 'wrath'); };
test('D8 [经典] 抉择：不带选项或选项不存在都报错', () => {
  const id = chooseSetup();
  const g = rich(newGame('druid'));
  const src = giveCard(g, id);
  for (const extra of [{}, {choice: 99}]) {
    const r = run(g, {type: 'play', source: src, target: 'h1', ...extra});
    assert.equal(r.ok, false);
  }
  assert.ok(g.players[0].hand.some((c) => c.uid === src)); assert.equal(g.players[0].mana, 10);
});
test('D9 [经典] 抉择只结算选中的效果', () => {
  const id = chooseSetup();
  const g = rich(newGame('druid'));
  const r = run(g, {type: 'play', source: giveCard(g, id), target: 'h1', choice: 0});
  ok(r);
  assert.equal(ev(r, 'draw').length, 0);
});
test('D10 [经典] 抉择取消时牌和法力都不变', () => { chooseSetup(); MISSING('D10 取消流程在 UI 层，走 Playwright'); });
test('D11 [经典] 抉择字段进白名单，UNKNOWN_FIELD 回归仍在', () => {
  chooseSetup();
  const g = rich(newGame('druid'));
  rejected(run(g, {type: 'end', bogusField: 1}), 'UNKNOWN_FIELD');
});

// 5. 萨满
const totemIds = () => {
  const ids = CARD.shaman.totems;
  if (!Array.isArray(ids) || ids.length !== 4) MISSING('shaman/totems 4 个基础图腾 id 未登记');
  return ids;
};
test('S1 [基础] 技能召唤 4 种基础图腾之一', () => {
  needClass('shaman'); const ids = totemIds();
  const r = run(rich(newGame('shaman')), {type: 'power'}); ok(r);
  const s = ev(r, 'summon'); assert.equal(s.length, 1); assert.ok(ids.includes(s[0].cardId));
});
test('S2 [基础] 图腾随机可重放', () => {
  needClass('shaman'); totemIds();
  const seqOf = () => { let g = newGame('shaman', {seed: 99}); const out = [];
    for (let i = 0; i < 4; i++) { while (g.players[0].mana < 2) g = nextOwnTurn(g); const r = run(g, {type: 'power'}); g = ok(r); out.push(ev(r, 'summon')[0]?.cardId); g = nextOwnTurn(g); }
    return {out, g}; };
  const a = seqOf(), b = seqOf();
  assert.deepEqual(a.out, b.out);
  assert.equal(core.hashState(core.replay(core.getReplay(a.g))), core.hashState(a.g));
});
test('S3 [基础] 场上满 7 个不能用技能', () => {
  const g = rich(newGame('shaman'));
  for (let i = 0; i < 7; i++) placeMinion(g, VANILLA, 0);
  rejected(run(g, {type: 'power'}), 'BOARD_FULL'); assert.equal(g.players[0].mana, 10);
});
test('S4 [基础][未核对] 不重复召唤场上已有图腾', () => { needClass('shaman'); totemIds(); PENDING('S4 图腾是否不重复'); });
test('S5 [基础] 治疗图腾：回合结束友方随从 +1', () => {
  needClass('shaman'); const [, , , heal] = totemIds();
  let g = rich(newGame('shaman'));
  placeMinion(g, heal, 0); const m = placeMinion(g, VANILLA, 0, {hp: 1, damage: 1});
  g = endTurn(g);
  assert.equal(g.players[0].board.find((b) => b.uid === m).hp, 2);
});
test('S6 [基础] 空气之怒图腾：法伤 +1', () => {
  needClass('shaman'); const [, , air] = totemIds();
  const g = rich(newGame('shaman'));
  const before = core.spellDamageBonus(g, 0);
  placeMinion(g, air, 0);
  assert.equal(core.spellDamageBonus(g, 0), before + 1);
});
test('S7 [基础] 石爪图腾：嘲讽', () => {
  needClass('shaman'); const [, stone] = totemIds();
  let g = rich(newGame('shaman'));
  placeMinion(g, stone, 0);
  g = endTurn(g);
  const att = placeMinion(g, VANILLA, 1);
  rejected(run(g, {type: 'attack', source: att, target: 'h0'}), 'TAUNT_BLOCKS_TARGET');
});
const overloadSetup = () => { needClass('shaman'); needField('overload', '过载'); return needCard('shaman', 'lightningBolt'); };
test('S8 [经典] 过载：本回合只扣牌费', () => {
  const id = overloadSetup();
  const x = rich(newGame('shaman'));
  const g = ok(run(x, {type: 'play', source: giveCard(x, id), target: 'h1'}));
  assert.equal(g.players[0].mana, 10 - core.CARDS[id].cost);
});
test('S9 [经典] 过载扣下回合水晶', () => {
  const id = overloadSetup();
  let g = rich(newGame('shaman'));
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  g = nextOwnTurn(g);
  assert.equal(g.players[0].mana, g.players[0].maxMana - 1);
});
test('S10 [经典] 过载只锁一个回合', () => {
  const id = overloadSetup();
  let g = rich(newGame('shaman'));
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  g = nextOwnTurn(nextOwnTurn(g));
  assert.equal(g.players[0].mana, g.players[0].maxMana);
});
test('S11 [经典] 过载叠加：1 + 2 = 3', () => {
  const id = overloadSetup(), id2 = needCard('shaman', 'overload2');
  let g = rich(newGame('shaman'));
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  g = ok(run(g, {type: 'play', source: giveCard(g, id2), target: 'h1'}));
  g = nextOwnTurn(g);
  assert.equal(g.players[0].mana, g.players[0].maxMana - 3);
});
test('S12 [经典] 过载超过水晶数时法力最少为 0', () => {
  const id = overloadSetup(), id2 = needCard('shaman', 'overload2');
  let g = rich(newGame('shaman'));
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  g = ok(run(g, {type: 'play', source: giveCard(g, id2), target: 'h1'}));
  g = endTurn(g); g.players[0].maxMana = 1; g = endTurn(g);
  assert.ok(g.players[0].mana >= 0);
});
test('S13 [经典] 对手回合不受我方过载影响', () => {
  const id = overloadSetup();
  let g = rich(newGame('shaman'));
  g = ok(run(g, {type: 'play', source: giveCard(g, id), target: 'h1'}));
  g = endTurn(g);
  assert.equal(g.players[1].mana, g.players[1].maxMana);
});
