// 家宅-56：home/home-autonomy.js 决策层单测（node test_home_autonomy.js）
const assert = require('assert');
const HA = require('./home/home-autonomy.js');
const HI = require('./home-interaction.js');
const E = require('./economy.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };
const deps = { capability:HI.capability, liveAct:E.furnLiveAct, itemSurf:E.itemSurf };
const all = E.FURNITURE.map((f, i) => ({ uid:'u' + i, fid:f.id, x:0, y:0, rot:0 }));

ok('白名单严格复用：能躺 21 + 能坐 26（含唯一地毯）+ 书架 + 衣柜 = 49，其它一律不选', () => {
  const list = HA.candidates(all, deps), by = k => list.filter(c => c.kind === k).length;
  assert.strictEqual(by('lie'), 21); assert.strictEqual(by('sit'), 25); assert.strictEqual(by('rug'), 1);
  assert.strictEqual(by('read'), 1); assert.strictEqual(by('dress'), 1); assert.strictEqual(list.length, 49);
  assert.deepStrictEqual(list.filter(c => c.kind === 'rug').map(c => c.fid), ['furn_s77_quilt_island_rug']);
  for (const fid of ['furn_rug', 'furn_plant', 'furn_lamp', 'furn_fridge', 'furn_painting', 'furn_otaku_bunk_manga']) assert(!list.some(c => c.fid === fid), fid);
});
ok('墙面挂件即使 id 命中也不选', () => {
  assert.strictEqual(HA.candidates([{ uid:'w', fid:'furn_bed', surf:'wall' }], deps).length, 0);
});
ok('空房只踱步；只有一件时和空地交替', () => {
  assert.deepStrictEqual(HA.pick([], { last:null, ceo:'c77', rng:Math.random }), { pace:true });
  const one = [{ uid:'b', kind:'lie' }];
  assert.strictEqual(HA.pick(one, { last:null, ceo:'c77', rng:Math.random }).uid, 'b');
  assert.deepStrictEqual(HA.pick(one, { last:'b', ceo:'c77', rng:Math.random }), { pace:true });
});
ok('两件以上：排除上一件，不连续去同一件（1000 次）', () => {
  const list = [{ uid:'a', kind:'lie' }, { uid:'b', kind:'sit' }, { uid:'c', kind:'read' }];
  let last = null;
  for (let i = 0; i < 1000; i++) { const c = HA.pick(list, { last, ceo:'otaku', period:'night', rng:Math.random }); assert(!c.pace); assert.notStrictEqual(c.uid, last); last = c.uid; }
});
ok('权重：时段系数 + CEO 偏好 ×1.5；拿不到时段就不乘', () => {
  const list = [{ uid:'bed', kind:'lie' }, { uid:'sofa', kind:'sit' }];
  // 夜晚 lie×3 vs sit×1 → rng=0.74 落在 lie（3/4=0.75 以内）
  assert.strictEqual(HA.pick(list, { last:null, ceo:'c77', period:'night', rng:() => .74 }).uid, 'bed');
  assert.strictEqual(HA.pick(list, { last:null, ceo:'c77', period:null, rng:() => .74 }).uid, 'sofa');
  // 珍珠姐偏好坐具：sit 1.5 vs lie 1，rng=0.5 → 0.5*2.5=1.25 > 1 → sofa
  assert.strictEqual(HA.pick(list, { last:null, ceo:'pearl', period:null, rng:() => .5 }).uid, 'sofa');
});
ok('停留时长按动作区间', () => {
  for (const [k, [a, b]] of Object.entries({ lie:[25, 60], sit:[10, 25], rug:[12, 30], read:[15, 35], dress:[4, 8] })) {
    assert.strictEqual(HA.stayFor(k, () => 0), a); assert(HA.stayFor(k, () => .999) < b + 1e-9);
  }
  assert.strictEqual(HA.idleFor(() => 0), 0); assert(HA.idleFor(() => .999) < 15);
});
ok('家具之间单程超过 3 秒、或减少动态效果时淡入', () => {
  assert.strictEqual(HA.needsFade(8, false), false); assert.strictEqual(HA.needsFade(9, false), true); assert.strictEqual(HA.needsFade(1, true), true);
});
ok('台词：50% 概率、10 分钟内同一句不重复、没有可用句就静默', () => {
  const said = {}, pool = ['甲', '乙'];
  assert.strictEqual(HA.chooseLine(pool, said, { now:0, rng:() => .6 }), null);   // 没抽中 50%
  const a = HA.chooseLine(pool, said, { now:0, rng:seq([.1, 0]) }), b = HA.chooseLine(pool, said, { now:10, rng:seq([.1, 0]) });
  assert.notStrictEqual(a, b);
  assert.strictEqual(HA.chooseLine(pool, said, { now:20, rng:() => .1 }), null);   // 两句都在冷却 → 静默
  assert(HA.chooseLine(pool, said, { now:601, rng:seq([.1, 0]) }));                // 10 分钟后可再说
  assert.strictEqual(HA.chooseLine(['丙'], {}, { now:0, rng:() => .3, emptyRoom:true }), null);   // 空房 25%
});
console.log(n + '/' + n + ' PASS');
