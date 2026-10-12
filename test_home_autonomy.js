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
ok('r2 被挡就淡入：床(2,0) 2×3 + 书架(2,3) 2×1 隔断，从 (0,1) 去 (5,1) 必须淡入', () => {
  const R = [{ x:2, y:0, w:2, h:3 }, { x:2, y:3, w:2, h:1 }], c = q => ({ x:q.x + .5, y:q.y + .5 });
  assert.strictEqual(HA.segmentBlocked(c({ x:0, y:1 }), c({ x:5, y:1 }), R), true);
  // 距离 5 格 ≈1.8 秒，按旧口径不淡入；r2 因为被挡而淡入
  assert.strictEqual(HA.needsFade(5, false), false); assert.strictEqual(HA.needsFade(5, false, { blocked:true }), true);
  // 隔断两侧任意两格都判被挡（这面「墙」从上到下封死）
  for (let y1 = 0; y1 < 4; y1++) for (let y2 = 0; y2 < 4; y2++) for (const x1 of [0, 1]) for (const x2 of [4, 5]) assert(HA.segmentBlocked(c({ x:x1, y:y1 }), c({ x:x2, y:y2 }), R), [x1, y1, x2, y2].join());
  // 同侧、贴边走不算挡
  assert.strictEqual(HA.segmentBlocked(c({ x:0, y:0 }), c({ x:1, y:3 }), R), false);
  assert.strictEqual(HA.segmentBlocked(c({ x:4, y:0 }), c({ x:4, y:3 }), R), false);
  assert.strictEqual(HA.segmentBlocked({ x:0, y:2 }, { x:2, y:2 }, [{ x:2, y:0, w:2, h:2 }]), false);   // 只碰到角
  // 原地不动不算挡
  assert.strictEqual(HA.segmentBlocked(c({ x:1, y:1 }), c({ x:1, y:1 }), R), false);
});
ok('r2 踱步：用 PACE.walk 2–5 秒定距离，永不原地；踱步上限按 5 秒算', () => {
  const cells = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) cells.push({ x, y });
  // 熊大复现：6×4，人在 (3,3)，rng=.5 —— 旧版会挑到脚下这格（0 秒移动）
  const t = HA.paceTarget(cells, { x:3, y:3 }, () => .5);
  assert(t && t.dist >= 1, JSON.stringify(t)); assert(t.want >= 2 * 2.8 && t.want <= 5 * 2.8);
  for (let i = 0; i < 2000; i++) { const from = cells[i % cells.length], q = HA.paceTarget(cells, from, Math.random); assert(q.dist >= 1); }
  // 小屋走不到想走的距离：一律取房间里能走到的最远那格（6×4 从角落是 (5,3)，≈2.1 秒；从 (3,3) 是 (0,0)/≈1.5 秒，已是极限）
  for (let i = 0; i < 200; i++) for (const from of cells) {
    const q = HA.paceTarget(cells, from, Math.random), maxD = Math.max(...cells.map(c => Math.hypot(c.x - from.x, c.y - from.y)));
    if (q.want >= maxD) assert(q.dist >= maxD - .01); else assert(Math.abs(q.dist - q.want) <= .75 || q.dist >= 1);
  }
  assert.deepStrictEqual((({ x, y }) => ({ x, y }))(HA.paceTarget(cells, { x:0, y:0 }, () => .99)), { x:5, y:3 });
  // 大房间（villa 10×6）想走多远基本能走多远，单程不超过 5 秒就不淡入
  const big = []; for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) big.push({ x, y });
  const b = HA.paceTarget(big, { x:0, y:0 }, () => .5); assert(Math.abs(b.dist - b.want) <= .75, JSON.stringify(b));
  assert.strictEqual(HA.needsFade(b.dist, false, { pace:true }), b.dist / 2.8 > 5);
  assert.strictEqual(HA.needsFade(11, false, { pace:true }), false); assert.strictEqual(HA.needsFade(11, false), true);
  // 只剩脚下一格 / 没有空地：返回 null，调用方原地等
  assert.strictEqual(HA.paceTarget([{ x:3, y:3 }], { x:3, y:3 }, Math.random), null);
  assert.strictEqual(HA.paceTarget([], { x:3, y:3 }, Math.random), null);
});
ok('r3 踱步实际时长 2–5 秒：按本段时长反推速度，逐帧模拟走完所用时间（含熊大三个反例）', () => {
  const grid = (cols, rows, low) => { const a = []; for (let y = low ? Math.floor(rows / 2) : 0; y < rows; y++) for (let x = 0; x < cols; x++) a.push({ x, y }); return a; };
  // 照 app.js homeAdvanceActor 的推进：step=min(speed*dt,d)，d<.05 视为到达；dt=1/60
  const walk = (from, t) => { let x = from.x, y = from.y, time = 0; const dt = 1 / 60;
    for (;;) { const d = Math.hypot(t.x - x, t.y - y); if (d < .05) return time; const st = Math.min(t.speed * dt, d); x += (t.x - x) / d * st; y += (t.y - y) / d * st; time += dt; } };
  const cases = [['小屋 6×4 (3,3) rng=.5', 6, 4, { x:3, y:3 }, () => .5], ['公寓 8×5', 8, 5, { x:4, y:4 }, () => .5], ['别墅 10×6', 10, 6, { x:5, y:5 }, () => .5]];
  for (const [name, c, r, from, rng] of cases) {
    const t = HA.paceTarget(grid(c, r, true), from, rng), sec = walk(from, t);
    assert(t.dist >= 1 && sec >= 2 - 1 / 60 && sec <= 5 + 1 / 60, name + ' ' + JSON.stringify({ ...t, sec }));
  }
  for (const [c, r] of [[6, 4], [8, 5], [10, 6]]) { const cells = grid(c, r, true);
    for (let i = 0; i < 3000; i++) { const from = cells[i % cells.length], t = HA.paceTarget(cells, from, Math.random);
      assert(t.sec >= 2 && t.sec <= 5, JSON.stringify(t)); assert(Math.abs(t.speed * t.sec - t.dist) < 1e-9);
      if (i % 50 === 0) { const s = walk(from, t); assert(s >= 2 - 1 / 60 && s <= 5 + 1 / 60, c + 'x' + r + ' ' + s); } } }
  // 时长自带 → 只看被挡 / 减少动态效果，不按距离判
  assert.strictEqual(HA.needsFade(1, false, { pace:true, sec:5 }), false); assert.strictEqual(HA.needsFade(1, false, { pace:true, sec:5, blocked:true }), true);
  assert.strictEqual(HA.needsFade(1, true, { pace:true, sec:3 }), true);
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
