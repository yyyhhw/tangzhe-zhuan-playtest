// node --test tests/expansion/expansion.test.mjs
// 扩卡验收骨架：按 tests/expansion/expansion-cards.json（由小喇叭《扩卡清单-v1.md》逐行转出，100 张）每张 3 条：定义 / 卡图 / 目标。
// 前置不满足 → assert.fail('FAIL 未实现：…')；口径未定 → assert.fail('FAIL 待定口径：…')。不用 test.skip，不改产品代码。
// 卡 id 由熊大登记：EXPANSION_CARD_IDS=/path/ids.json，格式 {"neutral-01":"cardId"} 或 {"neutral-01":{"id":"cardId","cost":1,"attack":1,"health":1}}；
// 写了 cost/attack/health 就以设计稿为准，没写就按清单（炉石参考）数值验。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as core from '../../preview/cards/cardcore.mjs?v=card-s1';
import {ART_BY_SOURCE_ID} from '../../preview/cards/ui/presentation.mjs';

const LIST = JSON.parse(readFileSync(new URL('./expansion-cards.json', import.meta.url), 'utf8'));
const UI_DIR = fileURLToPath(new URL('../../preview/cards/ui/', import.meta.url));
const IDS = process.env.EXPANSION_CARD_IDS ? JSON.parse(readFileSync(process.env.EXPANSION_CARD_IDS, 'utf8')) : {};
const CLASS_LABEL = {neutral: '公共', warrior: '战士·77', mage: '法师·阿宅', paladin: '圣骑士·珍珠姐', warlock: '术士·火箭', priest: '牧师', rogue: '潜行者', druid: '德鲁伊', shaman: '萨满'};
const CLASSES = Object.keys(CLASS_LABEL).filter((c) => c !== 'neutral');
// 卡面必须直接写出的关键词（杨总：冲锋、嘲讽等在手牌里要写清楚）。光环类没有固定关键词字样，不查字面。
const FACE_KEYWORDS = new Set(['战吼', '过载', '嘲讽', '抉择', '圣盾', '潜行', '沉默', '亡语', '连击', '冻结', '激怒', '风怒', '冲锋', '奥秘', '发现', '法术伤害']);

const MISSING = (what) => assert.fail(`FAIL 未实现：${what}`);
const PENDING = (what) => assert.fail(`FAIL 待定口径：${what}（等熊大设计稿）`);
const camel = (s) => s.replace(/-(\w)/g, (_, x) => x.toUpperCase());
const metaOf = (id) => Object.values(core.CARD_METADATA).find((m) => camel(m.id) === id || m.id === id);

function needClass(cls) {
  if (cls !== 'neutral' && !Object.hasOwn(core.HEROES, cls)) MISSING(`${cls} 职业未注册（HEROES 只有 ${Object.keys(core.HEROES).join('/')}）`);
}
function needCard(row) {
  needClass(row.class);
  const reg = IDS[row.key];
  const id = typeof reg === 'string' ? reg : reg?.id;
  if (!id) MISSING(`${row.key}（参考 ${row.hsName}）卡 id 未登记到 EXPANSION_CARD_IDS`);
  if (!Object.hasOwn(core.CARDS, id)) MISSING(`${row.key}=${id} 不在 CARDS`);
  const want = {cost: row.cost, attack: row.attack, health: row.health, ...(typeof reg === 'object' ? reg : {})};
  return {id, card: core.CARDS[id], meta: metaOf(id), want};
}

let seq = 0;
const VANILLA = Object.keys(core.CARDS).find((k) => core.CARDS[k].type === 'minion' && !core.CARDS[k].keywords && !core.CARDS[k].effect && core.CARDS[k].health >= 2);
function placeMinion(g, cardId, player, patch = {}) {
  const c = core.CARDS[cardId];
  const m = {uid: `xm${++seq}`, cardId, baseAtk: c.attack, baseHp: c.health, atk: c.attack, hp: c.health, maxHp: c.health, damage: 0,
    keywords: structuredClone(c.keywords ?? []), enchantments: [], summoningSick: false, attacksLeft: 1, frozen: false,
    attackedThisTurn: false, silenced: false, playOrder: ++g.playCounter, ...patch};
  g.players[player].board.push(m);
  return m.uid;
}
const damaged = () => {
  const c = core.CARDS[VANILLA];
  return {hp: c.health - 1, damage: 1};
};

// G：清单本身和全局前置。G1/G2 应该过，过不了说明清单转换坏了。
test('G1 清单完整：100 张 = 公共 20 + 8 职业 × 10', () => {
  assert.equal(LIST.cards.length, 100);
  assert.equal(LIST.cards.filter((c) => c.class === 'neutral').length, 20);
  for (const cls of CLASSES) assert.equal(LIST.cards.filter((c) => c.class === cls).length, 10, cls);
  assert.equal(new Set(LIST.cards.map((c) => c.key)).size, 100);
});
test('G2 清单：职业卡随从 5 + 法术 5；公共卡全随从；美术描述 1–40 字', () => {
  for (const cls of CLASSES) {
    const rows = LIST.cards.filter((c) => c.class === cls);
    assert.equal(rows.filter((c) => c.type === 'minion').length, 5, cls);
    assert.equal(rows.filter((c) => c.type === 'spell').length, 5, cls);
  }
  assert.ok(LIST.cards.filter((c) => c.class === 'neutral').every((c) => c.type === 'minion'));
  for (const c of LIST.cards) assert.ok([...c.artBrief].length >= 1 && [...c.artBrief].length <= 40, `${c.key} 美术描述 ${[...c.artBrief].length} 字`);
});
for (const cls of CLASSES) {
  test(`G3 ${CLASS_LABEL[cls]} 职业注册，默认卡组 30 张合规`, () => {
    needClass(cls);
    const deck = core.defaultDeck(cls);
    assert.equal(deck.length, 30);
    assert.equal(core.validateDeck(deck, cls), true);
  });
}
const MECHS = [...new Set(LIST.cards.flatMap((c) => c.mechanics))];
for (const mech of MECHS) {
  const rows = LIST.cards.filter((c) => c.mechanics.includes(mech));
  test(`M ${mech}（清单 ${rows.length} 张）：至少一张已登记、卡面写出关键词`, () => {
    const done = rows.filter((r) => { const reg = IDS[r.key]; const id = typeof reg === 'string' ? reg : reg?.id; return id && Object.hasOwn(core.CARDS, id); });
    if (!done.length) MISSING(`机制「${mech}」没有任何已登记卡（${rows.map((r) => r.key).join(', ')}）`);
    if (FACE_KEYWORDS.has(mech)) for (const r of done) assert.ok(core.CARDS[typeof IDS[r.key] === 'string' ? IDS[r.key] : IDS[r.key].id].text?.includes(mech), `${r.key} 卡面没写「${mech}」`);
    PENDING(`机制「${mech}」的行为断言（触发时机、叠加、沉默后是否失效）`);
  });
}

// X：每张卡 3 条。
const ROLE = {'any-character': ['h0', 'h1', 'fa', 'fd', 'ea', 'ed'], 'any-minion': ['fa', 'fd', 'ea', 'ed'], 'friendly-minion': ['fa', 'fd'],
  'enemy-minion': ['ea', 'ed'], 'enemy-hero': ['h1'], 'damaged-minion': ['fd', 'ed'], none: []};
for (const row of LIST.cards) {
  const tag = `X ${row.key} ${CLASS_LABEL[row.class]} 参考「${row.hsName}」`;
  test(`${tag} 定义：类型/费用/身材/卡面关键词/职业归属`, () => {
    const {id, card, meta, want} = needCard(row);
    assert.equal(card.type, row.type, '类型');
    assert.equal(card.cost, want.cost, '费用');
    if (row.type === 'minion') { assert.equal(card.attack, want.attack, '攻击'); assert.equal(card.health, want.health, '生命'); }
    assert.ok(card.name && card.name !== row.hsName && !card.name.includes(row.hsNameEn), `卡名须原创，不能用炉石名：${card.name}`);
    assert.ok(card.text?.length > 0, '卡面效果文字为空');
    for (const k of row.mechanics) if (FACE_KEYWORDS.has(k)) assert.ok(card.text.includes(k), `卡面没写关键词「${k}」：${card.text}`);
    if (!meta) MISSING(`${id} 没有 CARD_METADATA`);
    assert.equal(meta.class, row.class, '职业归属');
    const own = row.class === 'neutral' ? 'warrior' : row.class;
    const deck = core.defaultDeck(own);
    assert.equal(core.validateDeck([...deck.slice(0, 29), id], own), true, '放进本职业卡组应合规');
    if (row.class !== 'neutral') {
      const other = CLASSES.find((c) => c !== row.class && Object.hasOwn(core.HEROES, c));
      assert.throws(() => core.validateDeck([...core.defaultDeck(other).slice(0, 29), id], other), /wrong class/, '别的职业不能带');
    }
  });
  test(`${tag} 卡图：已登记、文件存在、名称一致、有美术描述`, () => {
    const {card, meta} = needCard(row);
    if (!meta) MISSING('没有 CARD_METADATA，查不到 sourceId');
    const art = ART_BY_SOURCE_ID[meta.sourceId];
    if (!art) MISSING(`${meta.sourceId} 不在 ART_BY_SOURCE_ID（卡图未接）`);
    assert.ok(existsSync(UI_DIR + art.src.replace(/^\.\//, '')), `卡图文件不存在：${art.src}`);
    assert.equal(art.name, card.name, '卡图登记名和卡名不一致');
    assert.ok(meta.artBrief, '没有美术描述（artBrief）');
  });
  test(`${tag} 目标：${row.targetText}`, () => {
    const {id} = needCard(row);
    if (row.target === 'choose-one') PENDING('抉择卡的选项与目标接口（先选项后目标？取消回退？）');
    const own = row.class === 'neutral' ? 'warrior' : row.class;
    const g = core.createGame({heroes: [own, own === 'mage' ? 'warrior' : 'mage'], rulesSeed: 4242, aiSeed: 777, config: {shuffle: false, coin: false}});
    const p = g.players[0]; p.mana = 10; p.maxMana = 10;
    const uids = {h0: 'h0', h1: 'h1', fa: placeMinion(g, VANILLA, 0), fd: placeMinion(g, VANILLA, 0, damaged()),
      ea: placeMinion(g, VANILLA, 1), ed: placeMinion(g, VANILLA, 1, damaged())};
    const uid = `xq${++seq}`; p.hand.push({uid, cardId: id});
    const plays = core.legalActions(g).filter((a) => a.type === 'play' && a.source === uid);
    assert.ok(plays.length > 0, '10 费满手、有目标时不能出这张牌');
    const got = plays.map((a) => a.target ?? null);
    const want = ROLE[row.target].map((r) => uids[r]);
    if (row.target === 'none') assert.deepEqual(got, [null], '不应要求选目标');
    else assert.deepEqual([...got].sort(), [...want].sort(), `合法目标不对（h0/h1=双方英雄，${uids.fa}/${uids.fd}=友方满血/受伤，${uids.ea}/${uids.ed}=敌方满血/受伤）`);
  });
}
