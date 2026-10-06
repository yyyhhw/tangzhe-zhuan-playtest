// 宠物原型 p3 — 引擎单元测试（Node）：node preview/pet/test_engine.js
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
// p3 身体盒（独立于引擎实现，直接用 p3 逐帧量出的占位小狗外形，源帧像素 → 格）：鼻尖 / 尾巴尖 / 耳朵都算
const BODY_PX = { E: [46, 217], N: [92, 164], S: [88, 169] }, PXK = 1.8 / 256;
const BOX = { E: { l: (128 - 46) * PXK, r: (217 - 128) * PXK }, N: { l: (128 - 92) * PXK, r: (164 - 128) * PXK }, S: { l: (128 - 88) * PXK, r: (169 - 128) * PXK } };
BOX.W = { l: BOX.E.r, r: BOX.E.l };
const visDir = (w) => PA.IN_PLACE.includes(w.dog.anim.name) ? (w.dog.dir === 'W' ? 'W' : 'E') : w.dog.dir;
function boxOf(x, y, dir) { const b = BOX[dir]; return { x: x - b.l, y: y - C.R, w: b.l + b.r, h: 2 * C.R }; }
const ovl = (a, b, e) => a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e;
// 小狗身体盒压到哪件实体家具（自己的碗除外：吃饭时嘴要伸到碗上）
function bodyHit(w, dir) { const bx = boxOf(w.dog.x, w.dog.y, dir || visDir(w)); for (const p of w.items) if (PE.isSolid(w, p) && ovl(bx, PE.itemRect(w, p), 1e-6)) return p; return null; }
// 每帧都查：不压家具、不出房间、单帧位移 ≤ 跑速×dt（不瞬移）；p3 起还查身体盒（鼻尖 / 尾巴不进家具）
function run(w, sec, each) {
  const bad = { overlap: 0, teleport: 0, outside: 0, body: 0 }; let maxD = 0;
  for (let n = Math.round(sec / H); n-- > 0;) {
    const ox = w.dog.x, oy = w.dog.y;
    PE.update(w, H);
    const d = Math.hypot(w.dog.x - ox, w.dog.y - oy); maxD = Math.max(maxD, d);
    if (d > C.RUN * H + 1e-9) bad.teleport++;
    if (PE.minClearance(w) < C.R - 1e-6) bad.overlap++;
    if (bodyHit(w)) bad.body++;
    if (w.dog.x < C.R - 1e-6 || w.dog.y < C.R - 1e-6 || w.dog.x > w.cols - C.R + 1e-6 || w.dog.y > w.rows - C.R + 1e-6) bad.outside++;
    if (each && each(w) === false) break;
  }
  return { ...bad, maxD };
}
const clean = (r) => r.overlap === 0 && r.teleport === 0 && r.outside === 0 && r.body === 0;

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
  [(m) => { m.clips.eat.frames[0].cell = m.clips.eat.frames[1].cell; }, 'cell 重复'], [(m) => { delete m.body; }, '缺身体外形 body'], [(m) => { m.body = m.body || {}; m.body.E = [130, 217]; }, 'body 没包住原点'], [(m) => { m.placeholder = false; m.atlas.image = null; }, '真图缺 atlas.image'], [(m) => { m.directions.mirror.W = 'N'; }, '西不是东镜像'],
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
  // p3：小狗跑到 x≈3.6 时鼻尖在 x≈4.2，长凳不能再放 x=4（会压到鼻子），改放 x=5 横在前方
  run(w, 2); const mv2 = PE.moveItem(w, 'f0', 5, 2, 1); ok(mv2.ok, '跑动中把长凳竖着放到前方'); const res = run(w, 15);
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

section('14b. 回归：叼球中抚摸 / 0 精力读档（熊大 p1 复核）');
for (const how of ['tap', 'button']) for (const seed of [5, 21, 33]) {
  const w = world(seed); PE.throwBall(w);
  let n = 0; while (w.ball.state !== 'carried' && n++ < 60 * 30) PE.update(w, H);
  ok(w.ball.state === 'carried', `[${how}/${seed}] 先叼起球`);
  run(w, 0.4); const r = PE.pet(w, how); ok(r.ok && !r.absorbed, `[${how}/${seed}] 叼球中抚摸被接受`);
  let droppedAt = null, pettedAfter = false;
  const rr2 = run(w, 30, (w) => { if (droppedAt == null && w.ball.state !== 'carried') droppedAt = w.t; if (droppedAt != null && w.dog.anim.name === 'petted') pettedAfter = true; });
  ok(droppedAt != null, `[${how}/${seed}] 抚摸前自动放球（不留永远叼着）`);
  ok(pettedAfter, `[${how}/${seed}] 放球后照样被摸`);
  ok(clean(rr2), `[${how}/${seed}] 放球 / 抚摸过程不穿家具不瞬移`);
  run(w, 150);
  ok(w.ball.state !== 'carried' && !w.dog.carrying, `[${how}/${seed}] 180 秒后球不在嘴里`);
  ok(PE.circleFree(w, w.ball.x, w.ball.y, C.BALL_R), `[${how}/${seed}] 球放在空地上（不在家具里）`);
  const t2 = PE.throwBall(w); ok(t2.ok, `[${how}/${seed}] 不用呼唤就能再抛 ${JSON.stringify(t2)}`);
  let again = 0; run(w, 40, (w) => { if (w.ball.state === 'carried') again = 1; return !again; });
  ok(again === 1, `[${how}/${seed}] 再抛后还能追到并叼起`);
}
{ // 兜底：任何打断（如过不去）后还叼着球，下一个自主计划先放球
  const w = world(7); PE.throwBall(w); let n = 0; while (w.ball.state !== 'carried' && n++ < 60 * 30) PE.update(w, H);
  w.dog.plan = []; w.dog.step = null; run(w, 6);
  ok(w.ball.state !== 'carried', '计划被清空时叼着的球也会被自动放下'); }
for (const [elapsedMs, asleep] of [[0, false], [0, true], [500, false]]) {
  const w = world(23); run(w, 5); const s = PE.serialize(w, 1000); s.dog.energy = 0; s.dog.asleep = asleep; s.dog.tired = false;
  const w2 = world(23); const r = PE.restore(w2, s, 1000 + elapsedMs);
  const want = Math.min(100, C.SLEEP_GAIN * elapsedMs / 1000);
  ok(Math.abs(w2.dog.energy - want) < 1e-9, `0 精力即时读档（离线 ${elapsedMs}ms，睡着=${asleep}）保留 0 + 离线休息 → ${w2.dog.energy}（不是 70）`);
  ok(w2.dog.tired === true, '0 精力读档后是累的');
  run(w2, 8); ok(w2.dog.activity === 'rest', `0 精力读档后会去休息（现在 ${w2.dog.activity}）`);
}
{ const w = world(23); const s = PE.serialize(w, 1000); s.dog.energy = 0;
  const w2 = world(23); PE.restore(w2, s, 61_000); ok(Math.abs(w2.dog.energy - 48) < 1e-6, `0 精力离线 60 秒 → 0 + 0.8×60 = 48（${w2.dog.energy}）`); }
for (const [bad, why] of [[undefined, '缺失'], [null, 'null'], ['abc', '字符串'], [NaN, 'NaN'], [Infinity, '无穷']]) {
  const w = world(24); const s = PE.serialize(w, 1000); s.dog.energy = bad; const w2 = world(24); PE.restore(w2, s, 1000);
  ok(w2.dog.energy === C.ENERGY0, `精力${why} → 默认 70（${w2.dog.energy}）`); }
{ const w = world(24); const s = PE.serialize(w, 1000); s.dog.energy = 150; const w2 = world(24); PE.restore(w2, s, 1000); ok(w2.dog.energy === 100, '精力超范围夹到 100');
  s.dog.energy = -5; const w3 = world(24); PE.restore(w3, s, 1000); ok(w3.dog.energy === 0, '负精力夹到 0'); }
{ const w = world(25); run(w, 3); w.dog.energy = 0; const s = JSON.parse(JSON.stringify(PE.serialize(w, 5000)));
  const w2 = world(25); PE.restore(w2, s, 5000); ok(w2.dog.energy === 0, '真实 serialize → JSON → restore 链路：0 精力保持 0'); }

section('16. 回归 (a)：互动目标绑定家具，搬走后不在旧位置闻（熊大 p2 复核）');
// 旧代码没有 PE.visit：按旧的 visit 计划结构手动排（去站位 → 朝东 → 闻 → 再闻 → 守着）
function startVisit(w, uid) {
  if (PE.visit) return PE.visit(w, uid);
  const p = w.items.find(q => q.uid === uid), s = PE.interactSpot(w, p.fid);
  w.dog.plan = [{ k: 'goto', to: s.spot, speed: 'walk' }, { k: 'face', dir: 'E' }, { k: 'anim', clip: 'sniff' }, { k: 'anim', clip: 'sniff' }, { k: 'wait', dur: 3 }]; w.dog.step = null; w.dog.activity = 'visit';
  return { ok: true, spot: s.spot };
}
const spotOf = (w, uid) => { const p = w.items.find(q => q.uid === uid); const s = p && PE.interactSpot(w, p.fid, uid); return s && s.spot; };
// 搬完之后：旧站位 0.3 格内一帧都不许闻；要么跟到新站位闻，要么取消
function afterMove(w, oldSpot, sec) {
  const r = { oldSniff: 0, newSniff: 0, cancel: false, body: 0, overlap: 0, teleport: 0, outside: 0 };
  const rr2 = run(w, sec, (w) => {
    const sn = w.dog.anim.name === 'sniff';
    if (sn && Math.hypot(w.dog.x - oldSpot.x, w.dog.y - oldSpot.y) < 0.3) r.oldSniff++;
    const ns = spotOf(w, CAT);
    if (sn && ns && Math.hypot(w.dog.x - ns.x, w.dog.y - ns.y) < 0.05) r.newSniff++;
    if (w.dog.activity !== 'visit') { r.cancel = true; }
  });
  return { ...r, ...rr2 };
}
const CAT = 'f8';   // 测试房间的猫窝 furn_catbed (9,4)
for (const phase of ['sniffing', 'walking']) for (const seed of [3, 11]) {
  const w = world(seed, null, { x: 2.0, y: 2.6 }); run(w, 0.2);
  const v = startVisit(w, CAT); ok(v.ok, `[${phase}/${seed}] 让它去猫窝`);
  const old = { ...spotOf(w, CAT) };
  if (phase === 'sniffing') run(w, 20, (w) => !(w.dog.anim.name === 'sniff' && w.dog.activity === 'visit'));
  else run(w, 1.2);
  ok(phase === 'walking' ? w.dog.step && w.dog.step.k === 'goto' : w.dog.anim.name === 'sniff', `[${phase}/${seed}] 搬之前它正在${phase === 'walking' ? '走过去' : '闻'}`);
  PE.setRearrange(w, true); const mv = PE.moveItem(w, CAT, 5, 5); PE.setRearrange(w, false);
  ok(mv.ok, `[${phase}/${seed}] 把猫窝从 (9,4) 搬到 (5,5)`);
  const r = afterMove(w, old, 40);
  ok(r.oldSniff === 0, `[${phase}/${seed}] 搬走后不在旧位置闻（旧位置闻了 ${r.oldSniff} 帧）`);
  ok(r.newSniff > 0, `[${phase}/${seed}] 跟到新位置闻（新位置闻了 ${r.newSniff} 帧）`);
  ok(clean(r), `[${phase}/${seed}] 过程中不压家具 / 鼻尖不进家具 / 不瞬移`);
}
{ // 目标被拿掉 → 立刻取消
  const w = world(5, null, { x: 2.0, y: 2.6 }); run(w, 0.2); startVisit(w, CAT); const old = { ...spotOf(w, CAT) }; run(w, 1.0);
  const i = w.items.findIndex(p => p.uid === CAT); w.items.splice(i, 1); w.obsVer++;
  const r = afterMove(w, old, 12);
  ok(r.oldSniff === 0 && r.cancel, `猫窝被拿走：取消计划，不去空地闻（旧位置闻了 ${r.oldSniff} 帧）`); }
{ // 搬到走不到 / 站不下的地方 → 取消
  const w = world(6, null, { x: 2.0, y: 2.6 }); run(w, 0.2); startVisit(w, CAT); const old = { ...spotOf(w, CAT) }; run(w, 1.0);
  const mv = PE.moveItem(w, CAT, 9, 6); ok(mv.ok, '把猫窝塞到着陆舱猫窝上面那格 (9,6)');
  const ns = PE.interactSpot(w, 'furn_catbed', CAT);
  const r = afterMove(w, old, 12);
  ok(r.oldSniff === 0 && r.cancel && r.newSniff === 0, `新站位站不下（${ns && ns.free ? '能站' : '站不下'}）→ 取消计划，哪儿都不闻（旧 ${r.oldSniff} / 新 ${r.newSniff}）`);
  ok(clean(r), '取消过程不压家具不瞬移'); }
{ // 别的家具动了、站位没变：计划照常；同款两件按 uid 认，不会认错
  const room = emptyRoom([{ fid: 'furn_catbed', x: 3, y: 2 }, { fid: 'furn_catbed', x: 7, y: 5 }, { fid: 'furn_plant', x: 0, y: 7 }]);
  const w = world(7, room, { x: 2, y: 6 }); run(w, 0.2);
  const v = startVisit(w, 'f1'); ok(v.ok, '同款两个猫窝，指定去第二个');
  run(w, 0.8); PE.moveItem(w, 'f2', 1, 7); const sp = spotOf(w, 'f1');
  let at2 = 0, at1 = 0; const sp1 = spotOf(w, 'f0');
  run(w, 20, (w) => { if (w.dog.anim.name === 'sniff') { if (Math.hypot(w.dog.x - sp.x, w.dog.y - sp.y) < 0.05) at2++; if (Math.hypot(w.dog.x - sp1.x, w.dog.y - sp1.y) < 0.3) at1++; } });
  ok(at2 > 0 && at1 === 0, `别的家具搬动不打断；按 uid 去的是第二个猫窝（第二个 ${at2} 帧 / 第一个 ${at1} 帧）`); }

section('17. 回归 (b)：合法交换 / 轮换后读档不被打回默认（熊大 p2 复核）');
const posOf = (w, uid) => { const p = w.items.find(q => q.uid === uid); return [p.x, p.y]; };
function swapWorld() {   // 摇椅 f10 (2,5) ↔ 绿植 f12 (0,6)，都是 1×1，经过一个临时空位合法交换
  const w = world(31, null, { x: 6, y: 2.6 });
  ok(PE.moveItem(w, 'f12', 1, 7).ok && PE.moveItem(w, 'f10', 0, 6).ok && PE.moveItem(w, 'f12', 2, 5).ok, '（摇椅 ↔ 绿植合法交换）');
  return w;
}
for (const order of ['原顺序', '倒序', '打乱']) {
  const w = swapWorld(); const s = JSON.parse(JSON.stringify(PE.serialize(w, 1000)));
  if (order === '倒序') s.items.reverse(); if (order === '打乱') s.items.sort((a, b) => (a.uid.length * 7 + a.uid.charCodeAt(a.uid.length - 1)) % 5 - (b.uid.length * 7 + b.uid.charCodeAt(b.uid.length - 1)) % 5);
  const w2 = world(31); PE.restore(w2, s, 2000);
  ok(posOf(w2, 'f10').join() === '0,6' && posOf(w2, 'f12').join() === '2,5', `交换后读档保留（存档${order}）：摇椅 ${posOf(w2, 'f10')}、绿植 ${posOf(w2, 'f12')}`);
}
{ // 三件轮换：猫窝 f8 (9,4) → 光盘塔位 (9,2)，光盘塔 f5 → 着陆舱位 (9,7)，着陆舱 f13 → 猫窝位 (9,4)
  const w = world(32, null, { x: 5, y: 2.6 });
  ok(PE.moveItem(w, 'f8', 8, 3).ok && PE.moveItem(w, 'f5', 8, 6).ok && PE.moveItem(w, 'f13', 9, 4).ok && PE.moveItem(w, 'f8', 9, 2).ok && PE.moveItem(w, 'f5', 9, 7).ok, '（三件合法轮换）');
  const s = PE.serialize(w, 0); s.items.reverse();
  const w2 = world(32); PE.restore(w2, s, 1000);
  ok(posOf(w2, 'f8').join() === '9,2' && posOf(w2, 'f5').join() === '9,7' && posOf(w2, 'f13').join() === '9,4', '三件轮换读档全保留（与记录顺序无关）'); }
for (const rev of [false, true]) { // 真异常的只回退那一件：台灯 f1 被改到绿植新位置上（坏档）
  const w = swapWorld(); const s = PE.serialize(w, 0); s.items.find(i => i.uid === 'f1').x = 2; s.items.find(i => i.uid === 'f1').y = 5;
  s.items.find(i => i.uid === 'f11').x = 12;   // 豆袋出界（坏档）
  if (rev) s.items.reverse();
  const w2 = world(31); const r = PE.restore(w2, s, 1000);
  ok(posOf(w2, 'f1').join() === '3,0' && posOf(w2, 'f11').join() === '3,6', `坏档：重叠的台灯 / 出界的豆袋回默认位（${rev ? '倒序' : '原顺序'}）`);
  ok(posOf(w2, 'f10').join() === '0,6' && posOf(w2, 'f12').join() === '2,5', `坏档里合法交换的两件照样保留（${rev ? '倒序' : '原顺序'}）`);
  const sol = w2.items.filter(p => PE.isSolid(w2, p)); let ovn = 0; for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) if (ovl(PE.itemRect(w2, sol[i]), PE.itemRect(w2, sol[j]), 0)) ovn++;
  ok(ovn === 0 && PE.circleFree(w2, w2.dog.x, w2.dog.y, C.R) && !bodyHit(w2, 'E') && !bodyHit(w2, 'W'), '读档后没有重叠的家具，小狗站在空地（左右转身都不碰家具）'); }

section('18. 回归 (c)：碰撞按小狗身体外形，鼻尖 / 尾巴不进家具（各朝向）');
if (M.body) ok(['E', 'N', 'S'].every(d => M.body[d][0] <= BODY_PX[d][0] && M.body[d][1] >= BODY_PX[d][1]), 'manifest.body 包住逐帧量出的外形（E/N/S）');
else ok(false, 'manifest 没有身体外形 body');
{ // 贴着每件实体家具的四面走过去：每个朝向都不进家具
  const w0 = world(40); const dirsSeen = { E: 0, W: 0, N: 0, S: 0 }, hit = { E: 0, W: 0, N: 0, S: 0 }; let tries = 0, closeE = Infinity;
  for (const p of w0.items.filter(q => PE.isSolid(w0, q))) {
    const r = PE.itemRect(w0, p);
    for (const [tx, ty] of [[r.x - 0.25, r.y + r.h / 2], [r.x + r.w + 0.25, r.y + r.h / 2], [r.x + r.w / 2, r.y - 0.25], [r.x + r.w / 2, r.y + r.h + 0.25]]) {
      if (tx < 0.2 || ty < 0.2 || tx > 9.8 || ty > 7.8) continue;
      const w = world(40); w.dog.plan = [{ k: 'goto', to: { x: tx, y: ty }, speed: 'walk', near: 0.9 }, { k: 'face', dir: null, toward: { x: r.x + r.w / 2, y: 0 } }, { k: 'anim', clip: 'sniff' }, { k: 'wait', dur: 0.5 }]; w.dog.step = null; w.dog.activity = 'test'; tries++;
      run(w, 25, (w) => { const d = visDir(w); dirsSeen[d]++; if (bodyHit(w, d)) hit[d]++; if (!w.dog.plan.length && w.dog.step && w.dog.step.k === 'wait') return false; });
      if (visDir(w) === 'E' && w.dog.y > r.y && w.dog.y < r.y + r.h && w.dog.x < r.x) closeE = Math.min(closeE, r.x - (w.dog.x + BOX.E.r));
    }
  }
  for (const d of ['E', 'W', 'N', 'S']) ok(dirsSeen[d] > 0 && hit[d] === 0, `朝${d}：${dirsSeen[d]} 帧，鼻尖 / 尾巴进家具 ${hit[d]} 帧`);
  ok(tries >= 30, `贴着 ${tries} 个家具侧面走过去测`); }
{ // 互动站位：站好朝向后鼻尖不进家具，也不离太远（贴边 ≤ 0.1 格）
  const w = world(41);
  for (const k of Object.keys(PR.INTERACT).filter(k => k.startsWith('furn_'))) {
    const s = PE.interactSpot(w, k); const p = w.items.find(q => q.fid === k), r = PE.itemRect(w, p);
    const bx = boxOf(s.spot.x, s.spot.y, PR.INTERACT[k].face || 'E');
    const hitAny = w.items.some(q => PE.isSolid(w, q) && ovl(bx, PE.itemRect(w, q), 1e-6));
    const gap = Math.max(r.x - (bx.x + bx.w), 0) + Math.max(r.y - (bx.y + bx.h), 0, bx.y - (r.y + r.h));
    ok(!hitAny && gap <= 0.1 + 1e-9, `${k} 站位朝东：鼻尖不进家具、离边 ${gap.toFixed(2)} 格`);
  } }
{ // 原地动作 / 东张西望转身也不进家具：放着不管 + 扔球 + 摸，各 3 分钟
  for (const seed of [42, 43, 44]) {
    const w = world(seed); const r = run(w, 180, (w) => { if (Math.round(w.t * 60) % (25 * 60) === 0 && w.ball.state === 'floor') PE.throwBall(w); if (Math.round(w.t * 60) % (37 * 60) === 0) PE.pet(w, 'button'); });
    ok(clean(r), `种子${seed}：3 分钟自由活动 + 扔球 + 摸，身体盒压家具 ${r.body} 帧、圆 ${r.overlap} 帧`);
  } }
{ // 搬家具不能压到小狗鼻子 / 尾巴
  const w = world(45, emptyRoom([{ fid: 'furn_plant', x: 0, y: 7 }]), { x: 4.5, y: 4.5 }); w.dog.dir = 'E'; w.dog.plan = [{ k: 'wait', dur: 30 }]; w.dog.step = null; run(w, 0.1);
  ok(!PE.moveItem(w, 'f0', 5, 4).ok, '朝东站着：家具不能放到鼻子上（x=5 那格）');
  w.dog.dir = 'W'; ok(!PE.moveItem(w, 'f0', 3, 4).ok, '朝西站着：家具不能放到鼻子上（x=3 那格）'); }

section('15. 压力：40 个种子 × 4 分钟，随机搬家具 + 扔球');
{ let stuckWorlds = 0, worst = 0, bad = 0, guard = 0; let lcg = 987654321; const R = () => ((lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let seed = 1; seed <= 40; seed++) {
    const w = world(seed); let lastProg = 0, lp = { x: w.dog.x, y: w.dog.y }, maxStill = 0;
    for (let f = 0; f < 240 * 60; f++) {
      if (f % (20 * 60) === 0 && f > 0) { const it = w.items[Math.floor(R() * w.items.length)]; PE.setRearrange(w, true); for (let k = 0; k < 30; k++) if (PE.moveItem(w, it.uid, Math.floor(R() * 10), Math.floor(R() * 8)).ok) break; PE.setRearrange(w, false); }
      if (f % (9 * 60) === 0 && w.ball.state === 'floor') PE.throwBall(w);
      const ox = w.dog.x, oy = w.dog.y; PE.update(w, H);
      if (Math.hypot(w.dog.x - ox, w.dog.y - oy) > C.RUN * H + 1e-9 || PE.minClearance(w) < C.R - 1e-6 || bodyHit(w)) bad++;
      const moving = w.dog.step && (w.dog.step.k === 'goto' || w.dog.step.k === 'chase') && w.ball.state !== 'air';
      if (!moving || Math.hypot(w.dog.x - lp.x, w.dog.y - lp.y) > 0.05) { lp = { x: w.dog.x, y: w.dog.y }; lastProg = w.t; }
      maxStill = Math.max(maxStill, w.t - lastProg);
    }
    if (maxStill > 3) stuckWorlds++; worst = Math.max(worst, maxStill); guard += w.stats.stuck;
  }
  ok(stuckWorlds === 0, `没有原地踏步卡住的（最长 ${worst.toFixed(1)} 秒没前进）`);
  ok(bad === 0, '160 分钟模拟：0 帧压家具（含鼻尖 / 尾巴）/ 0 帧瞬移');
  console.log(`  （保险机制触发 ${guard} 次）`); }


section('19. p4：没有饭碗 / 外部整组换布局（家宅同步）');
{
  const room = { cols: 6, rows: 4, wallRows: 2, front: { x: 3, y: 3.7 }, bed: { x: 0, y: 3.1, w: 1.3, h: 0.9 }, bowl: null, items: [{ uid: 'u7', fid: 'furn_sofa', x: 0, y: 0 }, { uid: 'u9', fid: 'furn_catbed', x: 4, y: 1 }] };
  const w = world(19, room);
  ok(w.bowl === null && !PE.obstacles(w).some(o => o.uid === 'pet_bowl'), '没有饭碗：不算障碍');
  ok(w.items.map(p => p.uid).join() === 'u7,u9', '外部 uid 原样（家宅 uid）');
  w.dog.energy = 5; const r1 = run(w, 240); ok(clean(r1), '没碗 + 很饿很困也正常过日子（' + JSON.stringify(r1) + '）');
  const lay = { cols: 6, rows: 4, items: [{ uid: 'u7', fid: 'furn_sofa', x: 0, y: 0 }, { uid: 'u9', fid: 'furn_catbed', x: 4, y: 1 }, { uid: 'u12', fid: 'furn_plant', x: Math.min(5, Math.floor(w.dog.x)), y: Math.min(3, Math.floor(w.dog.y)) }] };
  const v0 = w.obsVer, res = PE.setLayout(w, lay);
  ok(w.obsVer > v0 && w.items.length === 3 && !PE.bodyOverlap(w), '盆栽摆到小狗脚下：整组换上，小狗挪到空地（moved=' + res.dogMoved + '）');
  const r2 = run(w, 60); ok(clean(r2), '换布局后正常活动');
  PE.setLayout(w, { cols: 8, rows: 5, front: { x: 4, y: 4.7 }, items: lay.items });
  ok(w.cols === 8 && w.rows === 5 && w.front.y === 4.7, '升级房子：尺寸 / 「你」的位置跟着换');
  PE.call(w); const r3 = run(w, 20, (w) => !(w.dog.step && w.dog.step.k === 'wait' && w.dog.activity === 'called')); ok(clean(r3) && Math.hypot(w.dog.x - 4, w.dog.y - 4.15) < 0.05, '升级后呼唤：跑到新的前沿');
}

section('20. p4a：转不开身不播侧身动作（1 格竖走廊 / 横走廊 / 死胡同 / 边界格）');
{
  const F1 = 'furn_plant';   // 1×1 实心
  const col = (x, y0, y1, tag) => { const a = []; for (let y = y0; y < y1; y++) a.push({ uid: tag + x + '_' + y, fid: F1, x, y }); return a; };
  const row = (y, x0, x1, tag) => { const a = []; for (let x = x0; x < x1; x++) a.push({ uid: tag + x + '_' + y, fid: F1, x, y }); return a; };
  const mk = (cols, rows, items, front) => ({ cols, rows, wallRows: 2, front: front || { x: cols / 2, y: rows - 0.3 }, bed: { x: 0, y: rows - 0.9, w: 1.3, h: 0.9 }, bowl: null, items });
  const place = (w, x, y, dir) => { w.dog.x = x; w.dog.y = y; w.dog.dir = dir || 'S'; w.dog.plan = []; w.dog.step = null; w.dog.activity = 'idle'; };
  const clips = (w, sec, each) => { const seen = {}; const r = run(w, sec, (w) => { seen[w.dog.anim.name] = 1; return each ? each(w) : undefined; }); return { r, seen }; };
  // 竖走廊：x∈[3,4]，两侧 x=2 / x=4 一整列实心（y 0..6），只有前面 y=7 一行开口；狗在走廊中段，离开口 > 1.8 格
  const vroom = () => mk(7, 8, [...col(2, 0, 7, 'L'), ...col(4, 0, 7, 'R')], { x: 3.5, y: 7.7 });
  {
    const w = world(201, vroom()); place(w, 3.5, 2.5, 'S');
    ok(PE.bodyFree(w, 3.5, 2.5, 'V') && !PE.bodyFree(w, 3.5, 2.5, 'E') && !PE.bodyFree(w, 3.5, 2.5, 'W'), '竖走廊：站得下（南北），左右都转不开');
    const a0 = w.dog.affinity; w.dog.lastGain = -1e9;
    PE.pet(w, 'tap'); let c = clips(w, 2.5, (w) => w.dog.activity === 'petted');
    ok(clean(c.r) && !c.seen.petted, '竖走廊点小狗：不播侧身抚摸，身体盒不穿墙（' + JSON.stringify(c.r) + '）');
    ok(w.dog.affinity === a0 + 1 && (w.stats.sideBlocked || 0) >= 1 && Math.abs(w.dog.y - 2.5) < 1e-9, '…改成站着摇尾巴：照样加亲密、原地不走');
    place(w, 3.5, 2.5, 'N'); PE.throwBall(w); c = clips(w, 12); ok(clean(c.r), '竖走廊抛球：张望 / 追球 / 叼放球全程不穿墙（' + JSON.stringify(c.r) + '）');
    place(w, 3.5, 2.5, 'S'); PE.call(w); c = clips(w, 8); ok(clean(c.r), '竖走廊呼唤：不穿墙');
    place(w, 3.5, 2.5, 'S'); PE.pet(w, 'button'); c = clips(w, 10); ok(clean(c.r), '竖走廊按「摸摸」：走出来再摸，不穿墙');
    place(w, 3.5, 1.5, 'N'); w.dog.energy = 10; w.dog.tired = true; c = clips(w, 40); ok(clean(c.r), '竖走廊里困了：先挪到能转身处再趴（' + JSON.stringify(c.r) + '）');
    place(w, 3.5, 1.5, 'N'); let sp = null; w.dog.plan = [{ k: 'face', dir: null }, { k: 'anim', clip: 'sniff', label: '低头闻闻地板' }];
    c = clips(w, 15, (w) => { if (w.dog.anim.name === 'sniff' && !sp) sp = { x: w.dog.x, y: w.dog.y }; return !sp; });
    ok(clean(c.r) && (w.stats.sideDefer || 0) >= 1 && sp && PE.bodyFree(w, sp.x, sp.y, 'E') && PE.bodyFree(w, sp.x, sp.y, 'W'), '竖走廊中段要闻地板（1.8 格内没宽敞处）：延后到走廊外能转身处再闻（sideDefer=' + (w.stats.sideDefer || 0) + '）');
    for (const seed of [1, 2, 3]) { const w2 = world(210 + seed, vroom()); place(w2, 3.5, 1.2 + seed, 'S'); const c2 = clips(w2, 180); ok(clean(c2.r), '竖走廊自主活动 3 分钟（seed ' + seed + '）不穿墙（' + JSON.stringify(c2.r) + '）'); }
  }
  // 横走廊：y∈[3,4]，上下 y=2 / y=4 一整行实心（x 0..8），右边 x=9 一列开口：侧身本来就放得下 → 正常播
  {
    const w = world(202, mk(10, 7, [...row(2, 0, 9, 'T'), ...row(4, 0, 9, 'B')], { x: 9.5, y: 6.7 })); place(w, 4.5, 3.5, 'E');
    ok(PE.bodyFree(w, 4.5, 3.5, 'E') && PE.bodyFree(w, 4.5, 3.5, 'W'), '横走廊：左右侧身放得下');
    PE.pet(w, 'tap'); const c = clips(w, 2.5); ok(clean(c.r) && c.seen.petted && !(w.stats.sideBlocked > 0), '横走廊点小狗：正常播侧身抚摸，不被误拦');
    place(w, 4.5, 3.5, 'W'); const c2 = clips(w, 120); ok(clean(c2.r), '横走廊自主活动 2 分钟不穿墙（' + JSON.stringify(c2.r) + '）');
  }
  // 死胡同：竖口袋 x∈[3,4] y∈[0,3]，三面实心，底下 y=3 一格也堵上 → 整个口袋里没有能转身的地方、也走不出去
  {
    const items = [...col(2, 0, 4, 'L'), ...col(4, 0, 4, 'R'), { uid: 'cap', fid: F1, x: 3, y: 3 }];
    const w = world(203, mk(8, 7, items)); place(w, 3.5, 1.5, 'S');
    ok(!PE.reachable(w, w.dog, { x: 6, y: 5 }, 0) && !PE.bodyFree(w, 3.5, 1.5, 'E'), '死胡同：出不去、转不开');
    w.dog.lastGain = -1e9; PE.pet(w, 'tap'); let c = clips(w, 2.5); ok(clean(c.r) && !c.seen.petted, '死胡同点小狗：不穿墙（站着摇尾巴）');
    PE.call(w); c = clips(w, 6); ok(clean(c.r), '死胡同呼唤（走不到）：愣一下也不穿墙');
    PE.throwBall(w); c = clips(w, 8); ok(clean(c.r), '死胡同抛球：不穿墙');
    place(w, 3.5, 1.5, 'N'); w.dog.energy = 8; w.dog.tired = true; const e0 = w.dog.energy; c = clips(w, 30);
    ok(clean(c.r) && !c.seen.liedown && !c.seen.sleep && w.dog.energy > e0 + 10, '死胡同困了：不趴（侧身），站着打盹照样回精力（' + e0 + ' → ' + w.dog.energy.toFixed(1) + '）');
    const c2 = clips(w, 180); ok(clean(c2.r), '死胡同自主活动 3 分钟不穿墙（' + JSON.stringify(c2.r) + '）');
    ok(Object.keys(c2.seen).every(k => !PA.IN_PLACE.includes(k)), '死胡同里一个侧身动作都没播（' + Object.keys(c2.seen).join(',') + '）');
  }
  // 边界格：空房间贴左墙（x=0.5 时左右侧身都出界）、贴墙 1 格宽的竖条（墙 + 一列家具）
  {
    const w = world(204, mk(8, 6, [])); place(w, 0.5, 2.5, 'N');
    ok(!PE.bodyFree(w, 0.5, 2.5, 'E') && !PE.bodyFree(w, 0.5, 2.5, 'W') && PE.bodyFree(w, 0.5, 2.5, 'V'), '边界格 x=0.5：竖着站得下，侧身两边都出界');
    w.dog.lastGain = -1e9; PE.pet(w, 'tap'); let c = clips(w, 2.5, (w) => w.dog.activity === 'petted'); ok(clean(c.r) && (!c.seen.petted || w.dog.x > 0.6), '边界格点小狗：不出界（旁边 1.8 格内有宽敞处就挪一小步再摸，' + Object.keys(c.seen).join(',') + '）');
    place(w, 0.5, 2.5, 'N'); let sx = null; w.dog.plan = [{ k: 'face', dir: 'E' }, { k: 'anim', clip: 'sniff', label: '闻闻' }]; c = clips(w, 6, (w) => { if (w.dog.anim.name === 'sniff' && sx == null) sx = w.dog.x; return sx == null; });
    ok(clean(c.r) && c.seen.sniff && ((w.stats.sideDefer || 0) + (w.stats.reloc || 0)) >= 1 && sx > 0.6 && sx < 1.2, '边界格要闻地板：先挪离墙一点再闻（闻时 x=' + (sx == null ? '-' : sx.toFixed(2)) + '）');
    const w2 = world(205, mk(6, 6, col(1, 0, 6, 'C'), { x: 4, y: 5.7 })); place(w2, 0.5, 2.5, 'S');
    w2.dog.lastGain = -1e9; PE.pet(w2, 'tap'); c = clips(w2, 2.5); ok(clean(c.r) && !c.seen.petted, '贴墙 1 格竖条（被一列家具封死）：点小狗不穿墙');
    const c2 = clips(w2, 120); ok(clean(c2.r), '贴墙竖条自主活动 2 分钟不穿墙（' + JSON.stringify(c2.r) + '）');
  }
}
console.log(`\n引擎测试：${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);
