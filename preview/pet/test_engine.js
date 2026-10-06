// 宠物原型 p1 — 引擎单元测试（Node）：node preview/pet/test_engine.js
'use strict';
const EC = require('../economy.js'), PE = require('./engine.js'), PA = require('./art.js'), PR = require('./room.js');
const M = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'art', 'manifest.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const section = (s) => console.log('== ' + s);
const H = 1 / 60, C = PE.CFG;
const clone = (o) => JSON.parse(JSON.stringify(o));
const world = (seed, room, start) => PE.createWorld({ catalog: EC.FURNITURE, room: room || PR.ROOM, interact: PR.INTERACT, manifest: M, seed: seed || 1, start });
const emptyRoom = (items) => ({ cols: 10, rows: 8, wallRows: 2, front: { x: 5, y: 7.5 }, bed: { x: 0.25, y: 0.3, w: 1.5, h: 1.05 }, bowl: { x: 9.0, y: 0.4, w: 0.62, h: 0.42 }, items: items || [], wall: [] });
// 每帧都查：不压家具、不出房间、单帧位移 ≤ 跑速×dt（不瞬移）
function run(w, sec, each) {
  const bad = { overlap: 0, teleport: 0, outside: 0 }; let maxD = 0;
  for (let n = Math.round(sec / H); n-- > 0;) {
    const ox = w.dog.x, oy = w.dog.y;
    PE.update(w, H);
    const d = Math.hypot(w.dog.x - ox, w.dog.y - oy); maxD = Math.max(maxD, d);
    if (d > C.RUN * H + 1e-9) bad.teleport++;
    if (PE.minClearance(w) < C.R - 1e-6) bad.overlap++;
    if (w.dog.x < C.R - 1e-6 || w.dog.y < C.R - 1e-6 || w.dog.x > w.cols - C.R + 1e-6 || w.dog.y > w.rows - C.R + 1e-6) bad.outside++;
    if (each && each(w) === false) break;
  }
  return { ...bad, maxD };
}
const clean = (r) => r.overlap === 0 && r.teleport === 0 && r.outside === 0;

section('1. 规格数值');
ok(C.WALK === 0.65 && C.RUN === 1.30 && C.R === 0.22, '走 0.65 / 跑 1.30 / 半径 0.22');
ok(C.ENERGY0 === 70 && C.TIRED === 35 && C.RESTED === 70, '精力起始 70，<35 休息，睡到 70');
ok(C.DRAIN.walk === 0.06 && C.DRAIN.run === 0.30 && C.DRAIN.play === 0.20 && C.SLEEP_GAIN === 0.80, '消耗 0.06/0.30/0.20，睡觉 +0.80');
ok(C.AFF0 === 40 && C.AFF_CD === 60, '亲密起始 40，冷却 60 秒');
ok(C.PERSONALITY.curious === 0.70 && C.PERSONALITY.affectionate === 0.75 && C.PERSONALITY.playful === 0.65, '个性 好奇0.70/亲人0.75/爱玩0.65');
ok(C.INCOME_BONUS === 0, '收益加成 0');

section('2. 美术 manifest 合同');
const v = PA.validateManifest(M);
ok(v.ok, '占位 manifest 合格 ' + v.errors.join('；'));
ok(v.frameCount === 108 && v.capacity === 128 && v.cellsUsed === 109, `帧数 ${v.frameCount}（+1 影子）/ 图集容量 ${v.capacity}`);
ok(M.source.origin[0] === 128 && M.source.origin[1] === 208 && M.atlas.size[0] === 2048 && M.atlas.size[1] === 1024, '原点 (128,208)、图集 2048×1024');
for (const [mut, why] of [
  [(m) => { m.source.origin = [128, 200]; }, '原点改了'], [(m) => { delete m.clips.sniff; }, '缺片段'], [(m) => { m.clips.walk_N.frames.pop(); }, '帧数不对'],
  [(m) => { m.source.perFrameCrop = true; }, '每帧裁边'], [(m) => { m.actions.pick_ball.events = []; }, '缺抓球事件'], [(m) => { m.clips.sleep.dir = 'S'; }, '原地动作不是东向'],
  [(m) => { m.clips.eat.frames[0].cell = m.clips.eat.frames[1].cell; }, 'cell 重复'], [(m) => { m.placeholder = false; m.atlas.image = null; }, '真图缺 atlas.image'], [(m) => { m.directions.mirror.W = 'N'; }, '西不是东镜像'],
]) { const m = clone(M); mut(m); ok(!PA.validateManifest(m).ok, '坏 manifest 会被拦：' + why); }
{ const m = clone(M); m.placeholder = false; m.atlas.image = 'puppy_atlas.webp'; ok(PA.validateManifest(m).ok, '换真图集只改 placeholder/atlas.image 就合格'); }
{ const a = new PA.Animator(M); a.play('sniff', { frames: M.actions.pick_ball.frames, events: M.actions.pick_ball.events, loop: false });
  const fired = []; let t = 0; while (!a.done && t < 5) { fired.push(...a.tick(H)); t += H; }
  const want = M.actions.pick_ball.frames.reduce((s, i) => s + M.clips.sniff.frames[i].ms, 0) / 1000;
  ok(fired.length === 1 && fired[0] === 'ball_pick', '抓球事件按帧触发一次');
  ok(Math.abs(t - want) < 2 * H, `动作时长按 manifest（${want.toFixed(2)}s）`);
  a.play('idle_E'); let loops = 0; for (let i = 0; i < 200; i++) a.tick(H); ok(a.loops >= 2 && !a.done, '循环片段会循环'); }
ok(PA.resolveClip(M, 'walk', 'W').name === 'walk_E' && PA.resolveClip(M, 'walk', 'W').mirror && PA.resolveClip(M, 'sniff', 'W').mirror && PA.resolveClip(M, 'idle', 'N').name === 'idle_N', '西 = 东镜像；原地动作统一东向');

section('3. 全部 200 件家具当障碍');
ok(EC.FURNITURE.length === 200, '目录 200 件');
{ let solidOk = 0, rugOk = 0, wallOk = 0, rotOk = 0, n = 0;
  for (const f of EC.FURNITURE) {
    n++;
    const w = world(3, emptyRoom([{ fid: f.id, x: 3, y: 3 }]), { x: 1, y: 6.5 });
    if (f.wall) { if (w.items.length === 0) wallOk++; continue; }
    const r = { x: 3, y: 3, w: f.w, h: f.h }, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (f.layer === 'rug') { if (PE.circleFree(w, cx, cy, C.R) && PE.obstacles(w).length === 1) rugOk++; continue; }
    // 实体：占地里每个网格点都不能站；往中心走只会停在外面
    const g = PE.grid(w); let inside = 0;
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) { const x = (i + .5) * g.R, y = (j + .5) * g.R; if (g.free[j * g.nx + i] && x > r.x - C.R && x < r.x + r.w + C.R && y > r.y - C.R && y < r.y + r.h + C.R && PE.rectDist(x, y, r) < C.R) inside++; }
    const path = PE.planPath(w, w.dog, { x: cx, y: cy }, Math.max(r.w, r.h) / 2 + 0.6);
    const end = path && path[path.length - 1];
    if (inside === 0 && !PE.circleFree(w, cx, cy, C.R) && end && PE.rectDist(end.x, end.y, r) >= C.R - 1e-9) solidOk++;
    if (f.w !== f.h) { const w2 = world(3, emptyRoom([{ fid: f.id, x: 3, y: 3, rot: 1 }]), { x: 1, y: 6.5 }); const o = PE.obstacles(w2)[0]; if (o.w === f.h && o.h === f.w) rotOk++; } else rotOk++;
  }
  const S = EC.FURNITURE.filter(f => !f.wall && f.layer !== 'rug').length, RG = EC.FURNITURE.filter(f => f.layer === 'rug').length, WL = EC.FURNITURE.filter(f => f.wall).length;
  ok(solidOk === S, `实体家具 ${solidOk}/${S} 件：占地格全挡、走不进去`);
  ok(rotOk === S, `旋转后占地宽高互换 ${rotOk}/${S}`);
  ok(rugOk === RG, `地毯 ${rugOk}/${RG} 件：能踩（不挡路）`);
  ok(wallOk === WL, `墙饰 ${wallOk}/${WL} 件：挂墙，不占地板`);
  ok(S + RG + WL === 200, '三类合计 200'); }

section('4. 测试房间 / 互动点');
{ const w = world(1);
  ok(w.items.length === PR.ROOM.items.length && w.wall.length === PR.ROOM.wall.length, `房间摆了 ${w.items.length} 件地上家具 + ${w.wall.length} 件墙饰（都来自正式目录）`);
  for (const k of Object.keys(PR.INTERACT)) { const s = PE.interactSpot(w, k); ok(s && s.free && PE.reachable(w, w.dog, s.spot, 0.05), '互动点可站且走得到：' + k); }
  ok(Object.keys(PR.INTERACT).filter(k => k.startsWith('furn_')).every(k => /cat/.test(k)), '专门互动只配给猫窝 / 猫吊床（+ 自己的窝和碗）'); }

section('5. 放着不管 2 分钟（多个种子）');
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const w = world(seed); const r = run(w, 120);
  const kinds = new Set(w.log.map(l => l.kind));
  ok(kinds.size >= 4, `种子${seed}：做了 ${kinds.size} 种不同的事（${[...kinds].join('/')}）`);
  ok(clean(r), `种子${seed}：不压家具 / 不出界 / 不瞬移（单帧最大 ${r.maxD.toFixed(4)} 格）`);
  ok(w.stats.replans === 0, `种子${seed}：没改障碍就不重算路径`);
  ok(w.dog.affinity === 40, `种子${seed}：冷落 2 分钟亲密不掉`);
}
{ // 原地动作播放时一定是侧面（东 / 西）
  const w = world(9); let wrong = 0; run(w, 300, (w) => { if (PA.IN_PLACE.includes(w.dog.anim.name) && !(w.dog.dir === 'E' || w.dog.dir === 'W')) wrong++; });
  ok(wrong === 0, '原地动作都先转到侧面再播（5 分钟 0 次正背面播）');
}

section('6. 呼唤：先扭头，再绕障碍过来');
{ const w = world(2, null, { x: 8.6, y: 2.0 }); PE.step(w, 0.1);
  const r = PE.call(w); ok(r.ok, '呼唤成功');
  const seq = []; let firstMoveIdx = -1, attIdx = -1; const p0 = { x: w.dog.x, y: w.dog.y };
  const res = run(w, 15, (w) => { const c = w.dog.anim.name; if (seq[seq.length - 1] !== c) seq.push(c); if (c === 'attention' && attIdx < 0) attIdx = seq.length - 1; if (firstMoveIdx < 0 && Math.hypot(w.dog.x - p0.x, w.dog.y - p0.y) > 0.02) firstMoveIdx = seq.length - 1; if (w.dog.activity !== 'called') return false; });
  ok(attIdx >= 0 && firstMoveIdx > attIdx, '先播 attention（扭头看你），之后才开始走 ' + seq.slice(0, 5).join('>'));
  const cs = PE.callSpot(w); ok(Math.hypot(w.dog.x - cs.x, w.dog.y - cs.y) < 0.05 && w.dog.dir === 'S', '走到你面前、面朝你');
  ok(clean(res), '一路不压家具不瞬移');
  ok(w.dog.affinity === 41, '呼唤成功 亲密 +1');
  // 冷却内再叫一次不再加
  PE.call(w); run(w, 10, (w) => w.dog.activity === 'called'); ok(w.dog.affinity === 41, '60 秒冷却内不重复加亲密');
  const w2 = world(2, null, { x: 8.6, y: 2.0 }); PE.call(w2); PE.step(w2, 0.5); const st = w2.dog.anim.starts; PE.call(w2); PE.call(w2);
  ok(w2.stats.callDup === 2 && w2.dog.anim.starts === st, '正在过来时连按呼唤不重来'); }
{ // 睡着时被叫：先起身再扭头
  const w = world(3); w.dog.energy = 20; run(w, 40, (w) => !(w.dog.step && w.dog.step.k === 'sleep'));
  ok(w.dog.step && w.dog.step.k === 'sleep', '（先让它睡着）');
  PE.call(w); const seq = []; run(w, 20, (w) => { const c = w.dog.anim.name; if (seq[seq.length - 1] !== c) seq.push(c); if (w.dog.activity !== 'called') return false; });
  ok(seq[0] === 'getup' && seq.indexOf('attention') > 0, '睡着被叫：起身 → 扭头 → 过来 ' + seq.slice(0, 4).join('>')); }

section('7. 抛球：追 → 叼起 → 真叼回来 → 放下');
{ const w = world(4); PE.step(w, 0.2);
  const r = PE.throwBall(w, { x: 1.2, y: 1.0 + 1.6 }); ok(r.ok, '抛球成功');
  ok(!PE.throwBall(w).ok, '球在飞时不能再抛（不会冒出第二个球）');
  const seq = []; let carriedFrames = 0, maxGap = 0, carryStart = null, carryDist = 0, ran = false;
  const res = run(w, 40, (w) => {
    const c = w.dog.anim.name; if (seq[seq.length - 1] !== c) seq.push(c);
    if (/^run/.test(c)) ran = true;
    if (w.ball.state === 'carried') { carriedFrames++; if (!carryStart) carryStart = { x: w.dog.x, y: w.dog.y }; carryDist = Math.max(carryDist, Math.hypot(w.dog.x - carryStart.x, w.dog.y - carryStart.y)); maxGap = Math.max(maxGap, Math.hypot(w.ball.x - w.dog.x, w.ball.y - w.dog.y)); }
    if (w.dog.activity !== 'fetch') return false;
  });
  ok(seq.indexOf('attention') >= 0 && seq.indexOf('attention') < seq.findIndex(c => /^run/.test(c)), '先看到球（attention），再跑 ' + seq.slice(0, 5).join('>'));
  ok(ran, '跑过去追（run）');
  ok(seq.includes('sniff') && seq.includes('eat'), '叼起（pick_ball 事件）/ 放下（drop_ball 事件）都播了');
  ok(carriedFrames > 60 && carryDist > 2, `球真在嘴里被带回来（叼着走了 ${carryDist.toFixed(1)} 格）`);
  ok(maxGap < 0.35, '叼着时球一直跟着嘴');
  ok(w.ball.state !== 'carried' && Math.hypot(w.ball.x - PE.callSpot(w).x, w.ball.y - PE.callSpot(w).y) < 1.2, '球放在你面前');
  ok(w.stats.fetches === 1 && w.dog.affinity === 41, '叼回来算一次有效互动 亲密 +1');
  ok(clean(res), '全程不压家具 / 不瞬移');
  ok(!PE.throwBall(w, null).ok === false, '球落地后可以再抛'); }
{ // 叼着球时不能抛（只有一个球）
  const w = world(5); PE.throwBall(w, { x: 2, y: 2.6 }); run(w, 30, (w) => w.ball.state !== 'carried');
  ok(w.ball.state === 'carried' && PE.throwBall(w).why === 'carried', '球在嘴里时抛球被拒（不复制球）'); }

section('8. 没路：停下换目标，不穿家具、不瞬移');
{ const box = [[7, 5], [8, 5], [9, 5], [7, 6], [9, 6], [7, 7], [9, 7]].map(([x, y]) => ({ fid: 'furn_otaku_beanbag', x, y }));
  const w = world(6, emptyRoom(box), { x: 2, y: 4 });
  const r = PE.throwBall(w, { x: 8.5, y: 7.2 }); ok(r.ok, '球扔进封死的角落');
  const res = run(w, 30);
  ok(w.stats.noPath >= 1, `找不到路被识别（noPath=${w.stats.noPath}）`);
  ok(w.log.some(l => l.kind === 'confused') && new Set(w.log.slice(-6).map(l => l.kind)).size >= 2, '停下来（困惑一下）然后去做别的');
  ok(w.ball.state === 'floor' || w.ball.state === 'roll', '球留在原地没被瞬移叼走');
  ok(clean(res), '没穿家具、没瞬移'); }

section('9. 路被挡：搬家具时停下，放好后绕路');
{ const w = world(7, emptyRoom([{ fid: 'furn_s77_heart_bench', x: 0, y: 7 }]), { x: 1, y: 4 });
  w.dog.plan = []; w.dog.step = null;
  const goal = { x: 9, y: 4 };
  w.dog.plan = [{ k: 'goto', to: goal, speed: 'walk', label: 'test' }, { k: 'wait', dur: 30 }]; w.dog.activity = 'test';
  PE.step(w, 0.05);
  const p1 = w.dog.step.path.map(p => ({ ...p }));
  ok(p1.length === 1, '一开始直走（1 段）');
  run(w, 3.5); const xMid = w.dog.x;
  PE.setRearrange(w, true);
  const held = { x: w.dog.x, y: w.dog.y }; run(w, 3);
  ok(Math.hypot(w.dog.x - held.x, w.dog.y - held.y) < 1e-9, '搬家具时小狗停下来等');
  ok(!PE.call(w).ok && !PE.pet(w, 'tap').ok && !PE.throwBall(w).ok, '搬家具时三个操作都暂停');
  const mv = PE.moveItem(w, 'f0', 5, 2, 1);   // 3×1 长凳竖过来横在路中间（x5–6, y2–5）
  ok(mv.ok, '把长凳竖着挡在路上');
  ok(!PE.moveItem(w, 'f0', Math.floor(w.dog.x), Math.floor(w.dog.y) - 1, 1).ok, '不能把家具压在小狗身上');
  const plans0 = w.stats.plans;
  PE.setRearrange(w, false);
  let minY = 9, maxY = -1; const res = run(w, 20, (w) => { minY = Math.min(minY, w.dog.y); maxY = Math.max(maxY, w.dog.y); if (Math.hypot(w.dog.x - goal.x, w.dog.y - goal.y) < 0.01) return false; });
  ok(w.stats.plans === plans0 + 1, '放好后只重算一次路径');
  ok(maxY > 5.2 || minY < 1.8, `绕开长凳走（y 范围 ${minY.toFixed(2)}–${maxY.toFixed(2)}）`);
  ok(Math.hypot(w.dog.x - goal.x, w.dog.y - goal.y) < 0.01, '最后还是走到了');
  ok(clean(res), '绕路时不压家具、不瞬移');
  ok(xMid > 1.5 && xMid < 4.5, '挡路时它正走在半路'); }
{ // 走的时候障碍突然变化（不经过暂停）也不会穿过去
  const w = world(8, emptyRoom([{ fid: 'furn_s77_heart_bench', x: 0, y: 7 }]), { x: 1, y: 4 });
  w.dog.plan = [{ k: 'goto', to: { x: 9, y: 4 }, speed: 'run' }, { k: 'wait', dur: 30 }];
  run(w, 2); PE.moveItem(w, 'f0', 4, 2, 1); const res = run(w, 15);
  ok(clean(res) && Math.hypot(w.dog.x - 9, w.dog.y - 4) < 0.01 && w.stats.replans >= 1, '障碍中途变化：重算并绕过去'); }

section('10. 累了：回窝 → 趴下 → 呼吸睡 → 起身');
{ const w = world(9); w.dog.energy = 36.5;
  let throws = 0; const seq = []; let atBedBeforeLie = false, energyAtGetup = null, sleptAt = null;
  const res = run(w, 200, (w) => {
    const c = w.dog.anim.name; if (seq[seq.length - 1] !== c) { seq.push(c); if (c === 'liedown') atBedBeforeLie = Math.hypot(w.dog.x - PE.interactSpot(w, 'pet_bed').spot.x, w.dog.y - PE.interactSpot(w, 'pet_bed').spot.y) < 0.05; if (c === 'getup' && energyAtGetup == null && sleptAt != null) energyAtGetup = w.dog.energy; if (c === 'sleep' && sleptAt == null) sleptAt = w.t; }
    if (!w.dog.tired && w.ball.state === 'floor' && w.dog.activity !== 'fetch' && throws < 12) { if (PE.throwBall(w).ok) throws++; }
    if (energyAtGetup != null && w.dog.anim.name !== 'getup') return false;
  });
  const li = seq.indexOf('liedown'), si = seq.indexOf('sleep');
  ok(w.log.some(l => l.kind === 'rest'), '精力 <35 后切到休息');
  ok(li >= 0 && si === li + 1, '睡之前先有趴下过渡（liedown → sleep）');
  ok(atBedBeforeLie, '先走回自己的窝再趴下');
  ok(seq[seq.indexOf('getup') - 1] === 'sleep', '睡醒有起身过渡（sleep → getup）');
  ok(energyAtGetup >= 70, `睡到 70 才起来（起身时 ${energyAtGetup && energyAtGetup.toFixed(1)}）`);
  ok(clean(res), '全程不压家具不瞬移'); }
{ // 累的时候扔球：看一眼，不去追
  const w = world(10); w.dog.energy = 30; PE.step(w, 0.1); const r = PE.throwBall(w);
  ok(r.ok && r.ignored === 'tired' && w.dog.activity === 'rest', '累了扔球：看一眼继续回窝'); }

section('11. 精力 / 亲密');
{ const w = world(11, emptyRoom([]), { x: 1, y: 4 });
  w.dog.plan = [{ k: 'goto', to: { x: 9, y: 4 }, speed: 'walk' }]; const e0 = w.dog.energy; PE.step(w, 5);
  ok(Math.abs((e0 - w.dog.energy) - 0.06 * 5) < 0.01, `走路每秒 −0.06（5 秒 −${(e0 - w.dog.energy).toFixed(3)}）`);
  w.dog.plan = [{ k: 'goto', to: { x: 9.5, y: 6 }, speed: 'run' }]; w.dog.step = null; const e1 = w.dog.energy; PE.step(w, 4);
  ok(Math.abs((e1 - w.dog.energy) - 0.30 * 4) < 0.02, `跑每秒 −0.30（4 秒 −${(e1 - w.dog.energy).toFixed(3)}）`);
  w.dog.plan = [{ k: 'anim', clip: 'play' }]; w.dog.step = null; w.dog.dir = 'E'; const e2 = w.dog.energy; PE.step(w, 0.5);
  ok(Math.abs((e2 - w.dog.energy) - 0.20 * 0.5) < 0.02, '玩每秒 −0.20');
  w.dog.energy = 10; w.dog.plan = [{ k: 'sleep' }]; w.dog.step = null; PE.step(w, 10);
  ok(Math.abs(w.dog.energy - 18) < 0.05, `睡觉每秒 +0.80（10 秒到 ${w.dog.energy.toFixed(2)}）`); }

section('12. 抚摸：连点不无限重播');
{ const w = world(12); PE.step(w, 0.3);
  const starts0 = w.stats.petStarts; let frames = []; let k = 0;
  for (let i = 0; i < 30; i++) { PE.pet(w, 'tap'); PE.step(w, 0.05); if (w.dog.anim.name === 'petted') frames.push(w.dog.anim.k); }
  PE.step(w, 3);
  ok(w.stats.petStarts - starts0 === 1, `连点 30 下只播 1 次（starts=${w.stats.petStarts - starts0}，吞掉 ${w.stats.petAbsorbed}）`);
  ok(frames.every((f, i) => i === 0 || f >= frames[i - 1]), '播放中帧号不倒退（没被重启）');
  ok(w.dog.affinity === 41, '摸一次 亲密 +1');
  PE.step(w, 2); PE.pet(w, 'tap'); PE.step(w, 1.5);
  ok(w.stats.petStarts - starts0 === 2 && w.dog.affinity === 41, '冷却过后再摸能再播一次；60 秒内亲密不再加');
  PE.step(w, 61); PE.pet(w, 'tap'); PE.step(w, 1.5); ok(w.dog.affinity === 42, '过了 60 秒再摸 +1'); }
{ const w = world(13); w.dog.energy = 20; run(w, 60, (w) => !(w.dog.step && w.dog.step.k === 'sleep'));
  const st = w.dog.anim.starts; for (let i = 0; i < 10; i++) { PE.pet(w, 'tap'); PE.step(w, 0.1); }
  ok(w.dog.step && w.dog.step.k === 'sleep' && w.dog.anim.starts === st, '睡着时摸：不吵醒、不重播'); }

section('13. 前后遮挡 / 跳起');
{ const w = world(14, emptyRoom([{ fid: 'furn_otaku_kotatsu', x: 4, y: 3 }]), { x: 5, y: 2.6 });
  let o = PE.drawOrder(w).map(x => x.kind); ok(o.indexOf('dog') < o.indexOf('item'), '小狗在桌子后面 → 先画（被挡）');
  w.dog.y = 4.4; o = PE.drawOrder(w).map(x => x.kind); ok(o.indexOf('dog') > o.indexOf('item'), '小狗在桌子前面 → 后画（挡住桌子）');
  const w2 = world(15, emptyRoom([]), { x: 5, y: 4 }); w2.dog.dir = 'E'; w2.dog.plan = [{ k: 'anim', clip: 'hop' }, { k: 'wait', dur: 5 }]; let maxZ = 0, y0 = w2.dog.y, ymove = 0;
  run(w2, 0.7, (w) => { maxZ = Math.max(maxZ, w.dog.z); ymove = Math.max(ymove, Math.abs(w.dog.y - y0)); });
  ok(maxZ > 0.2 && ymove === 0 && w2.dog.z === 0, `跳高单独算（最高 ${maxZ.toFixed(2)} 格），落地点 / 影子不动`); }

section('14. 离线 / 存档');
{ const w = world(16); run(w, 20); const aff = w.dog.affinity = 47; w.dog.energy = 30;
  const s = PE.serialize(w, 1_000_000);
  ok(JSON.stringify(s).indexOf('coins') < 0 && !('pets' in s), '存档里没有金币、只有一只狗');
  const w2 = world(16); const r = PE.restore(w2, JSON.parse(JSON.stringify(s)), 1_000_000 + 10 * 60 * 1000);
  ok(r.ok && r.inBed && Math.abs(r.elapsed - 600) < 1e-6, '离开 10 分钟：当作自己在窝里休息');
  ok(w2.dog.energy === 100, `精力按睡觉回（30 → ${w2.dog.energy}）`);
  ok(w2.dog.affinity === aff, '离线不扣亲密');
  ok(PE.circleFree(w2, w2.dog.x, w2.dog.y, C.R) && PE.circleFree(w2, w2.ball.x, w2.ball.y, C.BALL_R), '回来时小狗 / 球都在安全位置');
  ok(w2.dog.anim.name === 'sleep', '恢复后第一帧就是在窝里睡的姿势');
  const seq = []; run(w2, 10, (w) => { const c = w.dog.anim.name; if (seq[seq.length - 1] !== c) seq.push(c); });
  ok(seq[0] === 'sleep' && seq[1] === 'getup', '回来看到它在窝里睡，然后伸懒腰起来'); }
{ const w = world(17); PE.throwBall(w, { x: 2, y: 2.6 }); run(w, 30, (w) => w.ball.state !== 'carried');
  ok(w.ball.state === 'carried', '（叼着球时存档）');
  const s = PE.serialize(w, 5000); const w2 = world(17); PE.restore(w2, s, 7000);
  ok(w2.ball.state === 'floor' && !w2.dog.carrying, '叼着球存档 → 回来球在地上（只有一个球）');
  PE.restore(w2, s, 9000); ok(w2.ball.state === 'floor' && PE.snapshot(w2).dog && w2.items.length === PR.ROOM.items.length, '重复恢复也不复制狗 / 球 / 家具'); }
{ const w = world(18); const s = PE.serialize(w, 0); s.dog.x = 4.9; s.dog.y = 3.5;   // 存档里的位置在被炉里面（坏档）
  const w2 = world(18); PE.restore(w2, s, 2000);
  ok(PE.circleFree(w2, w2.dog.x, w2.dog.y, C.R), '坏档位置压在家具里 → 挪到最近的空地'); }
{ const w = world(19); PE.moveItem(w, 'f13', 8, 6); const s = PE.serialize(w, 0); s.dog.affinity = 12;
  const w2 = world(19); PE.restore(w2, s, 1000);
  ok(w2.items.find(p => p.uid === 'f13').x === 8 && w2.items.find(p => p.uid === 'f13').y === 6, '搬过的家具位置存档恢复');
  ok(w2.dog.affinity === 40, '亲密不会低于起始 40'); }

section('15. 压力：40 个种子 × 4 分钟，随机搬家具 + 扔球');
{ let stuckWorlds = 0, worst = 0, bad = 0, guard = 0; let lcg = 987654321; const R = () => ((lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let seed = 1; seed <= 40; seed++) {
    const w = world(seed); let lastProg = 0, lp = { x: w.dog.x, y: w.dog.y }, maxStill = 0;
    for (let f = 0; f < 240 * 60; f++) {
      if (f % (20 * 60) === 0 && f > 0) { const it = w.items[Math.floor(R() * w.items.length)]; PE.setRearrange(w, true); for (let k = 0; k < 30; k++) if (PE.moveItem(w, it.uid, Math.floor(R() * 10), Math.floor(R() * 8)).ok) break; PE.setRearrange(w, false); }
      if (f % (9 * 60) === 0 && w.ball.state === 'floor') PE.throwBall(w);
      const ox = w.dog.x, oy = w.dog.y; PE.update(w, H);
      if (Math.hypot(w.dog.x - ox, w.dog.y - oy) > C.RUN * H + 1e-9 || PE.minClearance(w) < C.R - 1e-6) bad++;
      const moving = w.dog.step && (w.dog.step.k === 'goto' || w.dog.step.k === 'chase') && w.ball.state !== 'air';
      if (!moving || Math.hypot(w.dog.x - lp.x, w.dog.y - lp.y) > 0.05) { lp = { x: w.dog.x, y: w.dog.y }; lastProg = w.t; }
      maxStill = Math.max(maxStill, w.t - lastProg);
    }
    if (maxStill > 3) stuckWorlds++; worst = Math.max(worst, maxStill); guard += w.stats.stuck;
  }
  ok(stuckWorlds === 0, `没有原地踏步卡住的（最长 ${worst.toFixed(1)} 秒没前进）`);
  ok(bad === 0, '160 分钟模拟：0 帧压家具 / 0 帧瞬移');
  console.log(`  （保险机制触发 ${guard} 次）`); }

console.log(`\n引擎测试：${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
