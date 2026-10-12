// 家宅-56 r4：直接跑 app.js / pet/game/app.js 里的原函数 homeAutoMove + homeAdvanceActor（源码原样抽出，不是重写的模拟）
// node test_home_autonomy_mover.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const HA = require('./home/home-autonomy.js');
function extract(src, name) {
  const i = src.indexOf('function ' + name + '('); assert(i >= 0, name);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1); }
  throw new Error('unterminated ' + name);
}
function harness(file) {
  const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const code = extract(src, 'homeAutoMove') + '\n' + extract(src, 'homeAdvanceActor') + '\nreturn { homeAutoMove, homeAdvanceActor, env };';
  // 只给原函数需要的外部名字；空间判断（落点 / 实体家具）按用例注入
  return opts => new Function('HA', 'opts', `
    const env = { clock:0, dirty:false, hidden:false, ticks:0 };
    let tab='home', homeSub='room', homeMode='live', homeWho='c77', dirty=false;
    const document = { get hidden(){ return env.hidden; } };
    const actor = opts.actor;
    const homeActorOf = () => actor, homeDrawActor = () => {}, $ = () => null;
    const homeAutoTick = () => { env.ticks++; };
    const homeFreePoint = (id, x, y) => opts.free(x, y);
    const homeAutoSolids = () => opts.solids || [];
    const homeAutoReduced = () => !!opts.reduced;
    Object.defineProperty(env, 'clockRef', { get(){ return clock; } });
    let clock = 0; env.setClock = v => { clock = v; };
    ${code}`)(HA, opts);
}
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
// 熊大反例：合法 6×4，只留 (0,3)/(1,3) 空地，其余 22 格放 1×1 绿植
const plants = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if (!(y === 3 && x < 2)) plants.push({ x, y, w:1, h:1 });
const freeOnly = cells => (x, y) => cells.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
const two = freeOnly([{ x:0, y:3 }, { x:1, y:3 }]);
const open64 = (() => { const c = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) c.push({ x, y }); return freeOnly(c); })();
// 逐帧：dt 固定（确定性），返回走完用了多少有效时间
function run(h, hz, maxSec = 20) {
  const dt = 1 / hz; let t = 0, frames = 0;
  while (h.opts.actor.tx != null && t < maxSec) { h.f.homeAdvanceActor(dt); t += dt; frames++; }
  return { t, frames };
}
const make = (file, opts) => { const f = harness(file)(opts); return { f, opts }; };
for (const file of ['app.js', 'pet/game/app.js']) {
  ok(file + '：绿植反例 1 格短距离，sec=2 / 2.003 / 5，60Hz 与 120Hz 都不提前到达，最多晚一帧', () => {
    for (const hz of [60, 120]) for (const sec of [2, 2.003, 5]) {
      const actor = { x:1, y:3, tx:null, ty:null, pendingPose:null };
      const h = make(file, { actor, free:two, solids:plants });
      assert.strictEqual(h.f.homeAutoMove('c77', actor, 0, 3, { sec }), true);
      assert(actor.autoPace && !actor.autoLastMove.fade, 'not fade');
      const { t } = run(h, hz);
      assert(t >= sec - 1e-9 && t < sec + 1 / hz + 1e-9, `${hz}Hz sec=${sec} walked ${t}`);
      assert.deepStrictEqual([actor.x, actor.y, actor.tx, actor.autoPace], [0, 3, null, null]);
    }
  });
  ok(file + '：中途位置按 elapsed/sec 线性插值（2 秒段 1 秒时正好半程）', () => {
    const actor = { x:1, y:3, tx:null, ty:null, pendingPose:null };
    const h = make(file, { actor, free:two, solids:plants });
    h.f.homeAutoMove('c77', actor, 0, 3, { sec:2 });
    for (let i = 0; i < 60; i++) h.f.homeAdvanceActor(1 / 60);
    assert(Math.abs(actor.x - .5) < 1e-9 && actor.tx === 0, String(actor.x));
  });
  ok(file + '：长距离 5 秒段（空 6×4 从 (0,0) 到 (5,3)）60/120Hz 同样按时到达', () => {
    for (const hz of [60, 120]) for (const sec of [2, 5]) {
      const actor = { x:0, y:0, tx:null, ty:null, pendingPose:null };
      const h = make(file, { actor, free:open64 });
      h.f.homeAutoMove('c77', actor, 5, 3, { sec });
      const { t } = run(h, hz);
      assert(t >= sec - 1e-9 && t < sec + 1 / hz + 1e-9, `${hz}Hz sec=${sec} walked ${t}`);
    }
  });
  ok(file + '：不变的路径——手动/去家具仍 2.8 格/秒 + d<.05；淡入瞬移；无合法异点不走', () => {
    // 手动：没有 autoPace，照旧
    const a1 = { x:0, y:0, tx:5, ty:0, pendingPose:null };
    const h1 = make(file, { actor:a1, free:open64 }); const r1 = run(h1, 60);
    assert(Math.abs(r1.t - (5 - .05) / 2.8) < 2 / 60, 'manual ' + r1.t);
    // 去家具（非 pace）：homeAutoMove 不建 autoPace，走 2.8
    const a2 = { x:0, y:3, tx:null, ty:null, pendingPose:null };
    const h2 = make(file, { actor:a2, free:open64 });
    h2.f.homeAutoMove('c77', a2, 3, 3); assert.strictEqual(a2.autoPace, null);
    const r2 = run(h2, 60); assert(Math.abs(r2.t - (3 - .05) / 2.8) < 2 / 60, 'furniture ' + r2.t);
    // 被挡：淡入瞬移，不建 autoPace
    const a3 = { x:0, y:1, tx:null, ty:null, pendingPose:null };
    const h3 = make(file, { actor:a3, free:open64, solids:[{ x:2, y:0, w:2, h:3 }, { x:2, y:3, w:2, h:1 }] });
    h3.f.homeAutoMove('c77', a3, 5, 1, { sec:3 }); assert(a3.autoLastMove.fade && a3.autoPace === null && a3.x === 5);
    // reduce-motion：淡入
    const a4 = { x:1, y:3, tx:null, ty:null, pendingPose:null };
    const h4 = make(file, { actor:a4, free:two, solids:plants, reduced:true });
    h4.f.homeAutoMove('c77', a4, 0, 3, { sec:3 }); assert(a4.autoLastMove.fade && a4.autoPace === null && a4.x === 0);
    // 落点被挪回脚下：不走
    const a5 = { x:0, y:3, tx:null, ty:null, pendingPose:null };
    const h5 = make(file, { actor:a5, free:freeOnly([{ x:0, y:3 }]) });
    assert.strictEqual(h5.f.homeAutoMove('c77', a5, 5, 3, { sec:3 }), false); assert.strictEqual(a5.tx, null);
  });
  ok(file + '：hidden 时原函数不推进，elapsed 也不累加', () => {
    const actor = { x:1, y:3, tx:null, ty:null, pendingPose:null };
    const h = make(file, { actor, free:two, solids:plants });
    h.f.homeAutoMove('c77', actor, 0, 3, { sec:2 });
    h.f.env.hidden = true; for (let i = 0; i < 300; i++) h.f.homeAdvanceActor(1 / 60);
    assert.deepStrictEqual([actor.x, actor.autoPace.el], [1, 0]);
    h.f.env.hidden = false; const { t } = run(h, 60); assert(t >= 2 - 1e-9 && t < 2 + 1 / 60 + 1e-9);
  });
}
console.log(n + '/' + n + ' PASS');
