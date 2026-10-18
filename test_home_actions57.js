// 家宅-57：新动作 / 台词 / 图标决策层单测（node test_home_actions57.js）
const assert = require('assert');
const HA = require('./home/home-autonomy.js');
const HI = require('./home-interaction.js');
const E = require('./economy.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
const deps = { capability:HI.capability, liveAct:E.furnLiveAct, itemSurf:E.itemSurf };
const all = E.FURNITURE.map((f, i) => ({ uid:'u' + i, fid:f.id, x:0, y:0, rot:0 }));
const CEOS = ['c77', 'pearl', 'otaku', 'rocket'];

ok('五类新动作逐件 96 个 ID（家宅-43 加烟火小馆 12 件），全在目录里、面向正确，不在清单的不自动加入', () => {
  const cnt = { eat:4, water:15, lamp:28, use:27, wall:22 };
  for (const k in cnt) assert.strictEqual(HA.IDS[k].length, cnt[k], k);
  const ids = Object.values(HA.IDS).flat(); assert.strictEqual(ids.length, 96); assert.strictEqual(new Set(ids).size, 96);
  for (const k in HA.IDS) for (const id of HA.IDS[k]) { const f = E.FURN_BY_ID[id]; assert(f, id); assert.strictEqual(!!f.wall, k === 'wall', id); }
  const list = HA.candidates(all, { ...deps, period:'night' }), by = k => list.filter(c => c.kind === k).length;
  for (const k in cnt) assert.strictEqual(by(k), cnt[k], k);
  // cat:plant 里不浇水的 7 件
  for (const fid of ['furn_catbed', 'furn_rocket_rocket_model', 'furn_rocket_meteor_stand', 'furn_s77_knitting_basket', 'furn_otaku_manga_book_stack', 'furn_otaku_aquatic_pixel_tank', 'furn_pearl_ceramic_cup_stack']) assert(!list.some(c => c.fid === fid), fid);
  // 其余地毯照旧不开
  assert.strictEqual(list.filter(c => E.FURN_BY_ID[c.fid].layer === 'rug').length, 1);
});
ok('开灯只在黄昏、夜晚可选；拿不到时段不选', () => {
  const lamp = [{ uid:'l', fid:'furn_lamp' }];
  for (const [p, want] of [[null, 0], [undefined, 0], ['morning', 0], ['day', 0], ['dusk', 1], ['night', 1]]) assert.strictEqual(HA.candidates(lamp, { ...deps, period:p }).length, want, String(p));
});
ok('墙饰只走「看墙」，站不到的不选；墙面上的地面家具 id 仍不选', () => {
  const w = [{ uid:'w', fid:'furn_painting' }];
  assert.deepStrictEqual(HA.candidates(w, deps).map(c => c.kind), ['wall']);
  assert.strictEqual(HA.candidates(w, { ...deps, reachable:() => false }).length, 0);
  assert.strictEqual(HA.candidates([{ uid:'b', fid:'furn_bed', surf:'wall' }], deps).length, 0);
});
ok('逗宠物：宠物在家才有，不绑家具', () => {
  assert.strictEqual(HA.candidates([], deps).length, 0);
  assert.deepStrictEqual(HA.candidates([], { ...deps, pets:[{ uid:'p1' }] }), [{ uid:'pet:p1', pet:'p1', kind:'pet' }]);
});
ok('停留区间按总表', () => {
  for (const [k, [a, b]] of Object.entries({ eat:[8, 18], use:[6, 15], water:[5, 10], lamp:[4, 8], wall:[5, 12], pet:[6, 15] })) {
    assert.strictEqual(HA.stayFor(k, () => 0), a, k); assert.strictEqual(HA.stayFor(k, () => 1), b, k);
  }
});
ok('台词：60 句可触发（每位 CEO 坐/地毯/吃/家电/浇水/开灯/逗宠物各 2 句，看墙 1 句），窗外 4 句只留资产', () => {
  let total = 0;
  for (const c of CEOS) { for (const k of ['sit', 'rug', 'eat', 'use', 'water', 'lamp', 'pet']) { assert.strictEqual(HA.linesFor(k, c).length, 2, c + k); total += 2; } assert.strictEqual(HA.linesFor('wall', c).length, 1); total += 1; }
  assert.strictEqual(total, 60);
  for (const c of CEOS) { const w = HA.WINDOW_LINES[c]; assert(w); for (const k in HA.LINES[c]) assert(!HA.LINES[c][k].includes(w), c + k); }
  assert(!HA.LINES.c77.sit.includes('坐一会儿，陪你们玩。'));
  for (const k of ['lie', 'read', 'dress', null]) assert.strictEqual(HA.linesFor(k, 'c77'), null);   // 躺/读书/换衣服/踱步沿用 LIVE_LINES
});
ok('图标：吃按 CEO 分串串/茶杯，其余按动作；躺/坐/地毯/换衣服不冒新图标', () => {
  assert.strictEqual(HA.iconFor('eat', 'c77'), 'skewer'); assert.strictEqual(HA.iconFor('eat', 'otaku'), 'skewer');
  assert.strictEqual(HA.iconFor('eat', 'pearl'), 'cup'); assert.strictEqual(HA.iconFor('eat', 'rocket'), 'cup');
  assert.deepStrictEqual(['read', 'use', 'water', 'lamp', 'wall', 'pet'].map(k => HA.iconFor(k, 'c77')), ['book', 'pad', 'can', 'bulb', 'scope', 'yarn']);
  for (const k of ['lie', 'sit', 'rug', 'dress']) assert.strictEqual(HA.iconFor(k, 'c77'), null);
});
ok('偏好 ×1.5 按 CEO（77 吃/家电，火箭 灯/家电/墙）', () => {
  const list = [{ uid:'a', kind:'water' }, { uid:'b', kind:'eat' }];
  assert.strictEqual(HA.pick(list, { last:null, ceo:'c77', rng:() => .45 }).uid, 'b');     // 0.45*2.5=1.125 > 1
  assert.strictEqual(HA.pick(list, { last:null, ceo:'pearl', rng:() => .45 }).uid, 'a');   // 珍珠姐偏绿植
  assert.strictEqual(HA.pick(list, { last:null, ceo:'c77', rng:() => .45, period:'morning' }).uid, 'a');   // 早晨浇水 ×3
});
console.log(n + '/' + n + ' PASS');
