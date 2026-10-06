// 宠物 p4 — 游戏接入单元测试（Node）：node preview/pet/game/test_petgame.js
// 购买 / 重复购买 / 金币不够 / 搬家；旧档（没有 pet 字段）照常读、读完也不多出字段；pet 字段经 E.migrate 往返保留；
// 家宅布局 → 引擎；摆家具压到小狗 / 窝；布置模式暂停；升级房子；刷新恢复（短离开原地、长离开在窝里睡）；三档房子压力测试；静态检查存档键
// p4b：满屋（合法摆满）购买 / 读档 / 布置挡满 / 搬进满屋 / 升级房子——不崩、不扣了钱没狗、金币和宠物数守恒；坏档逐字段容错（NaN / 无穷 / 字符串 / 负数 / 超界 / 缺字段 / null）
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./economy.js'), PG = require('./petgame.js'), PE = require('../engine.js'), PA = require('../art.js');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'art', 'manifest.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const section = (s) => console.log('== ' + s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const T0 = 1790000000000;
const fresh = () => E.migrate(null, T0).st;
const reload = (st, t) => { const s = E.migrate(clone(st), t || T0).st; PG.norm(s, E); return s; };   // = 游戏 loadState 的两步
function place(st, id, fid, x, y, rot) { E.buyFurniture(Object.assign(st, { coins: st.coins + 1e7 }), fid); return E.placeItem(st, id, fid, x, y, rot || 0, 'floor'); }
let clock = T0; const rt = () => PG.createRuntime({ E, manifest: M, now: () => clock });
const tick = (r, st, sec, ctx) => { for (let n = Math.round(sec * 10); n-- > 0;) { clock += 100; r.frame(0.1, st, ctx); } };   // 页面开着：真实时间跟着走
const bodyOK = (w) => !PE.bodyOverlap(w);

section('1. 购买');
{
  const st = fresh(); st.coins = 2999;
  let r = PG.buy(st, E, 'c77', T0, M); ok(!r.ok && r.why === '金币不够' && !('pet' in st) && st.coins === 2999, '金币不够：买不了，不扣钱，不写 pet');
  st.coins = 10000;
  r = PG.buy(st, E, 'pearl', T0, M); ok(!r.ok && !('pet' in st) && st.coins === 10000, '没加入的 CEO 家：买不了');
  r = PG.buy(st, E, 'c77', T0, M); ok(r.ok && st.coins === 10000 - PG.PET.price && st.pet.owned === true && st.pet.home === 'c77' && st.pet.eng === null && st.pet.boughtAt === T0, '买到：扣 ' + PG.PET.price + '，住进 77 的家');
  const c1 = st.coins; r = PG.buy(st, E, 'c77', T0, M); ok(!r.ok && st.coins === c1, '只能养一只：再买被拒，不扣钱');
  ok(PG.PET.price === 3000 && PG.owned(st), '价格 3000 / owned');
  r = PG.move(st, E, 'pearl'); ok(!r.ok && st.pet.home === 'c77', '搬去没加入的家：拒');
  r = PG.move(st, E, 'c77'); ok(!r.ok && r.same, '搬去自己家：拒（same）');
  st.ceos.pearl.unlocked = true; r = PG.move(st, E, 'pearl'); ok(r.ok && st.pet.home === 'pearl' && st.coins === c1, '搬家：不花钱');
}

section('2. 旧档兼容（没有 pet 字段）');
{
  const st = fresh(); st.coins = 12345; st.taps = 77; place(st, 'c77', 'furn_sofa', 0, 0); st.coins = 12345;
  const raw = clone(st); delete raw.pet;
  const a = E.migrate(clone(raw), T0).st, b = reload(raw);
  ok(!('pet' in b), '读完不多出 pet 字段');
  ok(JSON.stringify(a) === JSON.stringify(b), '其余字段和不接小狗时完全一样');
  ok(b.coins === 12345 && b.taps === 77 && E.homeOf(b, 'c77').placed.length === 1, '金币 / 点击 / 家具都在');
  ok(!PG.owned(b) && PG.norm(b, E) === null, '当作没买');
  // 更老的存档（SAVE_VERSION 之前）照样走 E.migrate
  const old = clone(raw); old.v = 1; const c = reload(old); ok(!('pet' in c) && c.coins === 12345, '老版本号存档：照常迁移，没有 pet');
  ok(!('pet' in reload(null)), '全新存档：没有 pet');
}

section('3. pet 字段往返 / 坏字段');
{
  const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0, M);
  const r = rt(); r.sync(st); tick(r, st, 5); r.beforePersist(st);
  const back = reload(st);
  ok(JSON.stringify(back.pet) === JSON.stringify(st.pet), 'E.migrate + norm 往返：pet 原样保留');
  ok(back.pet.eng && back.pet.eng.home === 'c77' && !('items' in back.pet.eng) && back.pet.eng.v === PE.CFG.SAVE_V, 'eng 带 home、不带家具（家具以家宅为准）');
  ok(JSON.stringify(back.pet).length < 600, 'pet 字段很小（' + JSON.stringify(back.pet).length + ' 字节）');
  const bad = (pet) => { const s = clone(st); s.pet = pet; return reload(s); };
  ok(!('pet' in bad('x')) && !('pet' in bad([])) && !('pet' in bad(null)) && !('pet' in bad({ owned: false })), '坏 pet（字符串 / 数组 / null / 没 owned）：删掉 = 没买');
  const b2 = bad({ owned: true, home: 'rocket', eng: { v: 1, dog: {} } }); ok(b2.pet.home === 'c77' && b2.pet.eng && b2.pet.eng.dog.energy === PE.CFG.ENERGY0 && b2.pet.eng.dog.affinity === PE.CFG.AFF0, '家没开放：搬回第一个开放的家；eng 缺字段按默认补（p4b：不再整份清掉）');
  const b3 = bad({ owned: true, home: 'c77', eng: { v: 99, dog: {} } }); ok(b3.pet.eng === null && b3.pet.home === 'c77', 'eng 版本不对：清掉（小狗还在）');
  const b4 = bad({ owned: true, home: 'c77', boughtAt: 'zz' }); ok(b4.pet.boughtAt === 0 && b4.pet.eng === null, 'boughtAt / eng 缺失：补默认');
  ok(Object.keys(E.migrate(clone(st), T0).st).filter(k => k === 'pet').length === 1, 'E.migrate 本身就保留 pet（主线预览读到这份档也不会丢小狗）');
}

section('4. 家宅布局 → 引擎');
{
  const st = fresh(); st.coins = 9000;
  place(st, 'c77', 'furn_sofa', 0, 0); place(st, 'c77', 'furn_rug', 2, 1); place(st, 'c77', 'furn_catbed', 4, 2);
  E.buyFurniture(st, 'furn_painting'); const wp = E.findFree(st, 'c77', 'furn_painting', 0); E.placeItem(st, 'c77', 'furn_painting', wp.x, wp.y, 0, wp.surf);
  st.coins = 9000; PG.buy(st, E, 'c77', T0, M);
  const L = PG.layoutOf(st, E, 'c77'), H = E.homeOf(st, 'c77');
  ok(L.cols === 6 && L.rows === 4 && L.items.length === 3, '小屋 6×4，挂画不进地板（3 件地上家具）');
  ok(L.items.every(p => H.placed.some(q => q.uid === p.uid && q.fid === p.fid && q.x === p.x && q.y === p.y)), 'uid / 位置原样');
  const r = rt(), w = r.sync(st);
  ok(w && w.cols === 6 && w.rows === 4 && w.bowl === null && w.items.length === 3, '引擎世界 = 家宅（无饭碗）');
  ok(PG.bedOK(w, w.bed) && !w.bed.blocked, '窝在空地上，睡觉站位放得下');
  ok(bodyOK(w), '小狗出生不压家具');
  ok(w.dog.label === '刚到家，东张西望' && r.lastEvent === 'arrived', '第一次进家：东张西望');
  const cat = w.items.find(p => p.fid === 'furn_catbed'); ok(cat && cat.uid === H.placed.find(p => p.fid === 'furn_catbed').uid, '猫窝 uid 沿用（互动目标按 uid 跟）');
  const sp = PE.interactSpot(w, 'furn_catbed', cat.uid); ok(sp && typeof sp.free === 'boolean', '猫窝互动站位可算');
}

section('5. 摆家具压到小狗 / 窝；布置模式暂停');
{
  const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0, M);
  const r = rt(); let w = r.sync(st); tick(r, st, 2);
  // 家宅的摆放规则不认识小狗：直接摆在它身上
  const dx = Math.floor(w.dog.x), dy = Math.floor(w.dog.y);
  const pr = place(st, 'c77', 'furn_plant', Math.min(5, dx), Math.min(3, dy)); ok(pr.ok, '游戏里能把盆栽摆到小狗脚下');
  r.frame(0.1, st); w = r.w;
  ok(bodyOK(w), '同步后小狗挪到空地，不压盆栽');
  ok(w.items.length === 1 && w.items[0].uid === pr.uid, '引擎里多了这件（uid 一致）');
  // 窝被压
  const bed0 = { ...w.bed }; const bx = Math.floor(bed0.x), by = Math.floor(bed0.y);
  const pr2 = place(st, 'c77', 'furn_lamp', bx, Math.min(3, by)); r.frame(0.1, st); w = r.w;
  ok(pr2.ok && PG.bedOK(w, w.bed) && (w.bed.x !== bed0.x || w.bed.y !== bed0.y), '窝被台灯压住：自动换个空地');
  // 布置模式
  r.frame(0.1, st, { decorHere: true }); ok(w.paused, '布置模式：小狗停下来等');
  const x0 = w.dog.x, y0 = w.dog.y; tick(r, st, 3, { decorHere: true });
  ok(Math.hypot(w.dog.x - x0, w.dog.y - y0) < 1e-9, '布置中不走动');
  ok(!r.call(st).ok && !r.throwBall(st).ok, '布置中呼唤 / 抛球不响应');
  r.frame(0.1, st, { decorHere: false }); ok(!w.paused, '切回生活：继续');
  ok(r.call(st).ok, '呼唤 ok'); tick(r, st, 8); ok(bodyOK(w) && w.dog.affinity >= PE.CFG.AFF0, '呼唤后走过来，不压家具');
  // 升级房子
  st.coins = 1e8; const up = E.upgradeHome(st, 'c77'); r.frame(0.1, st); w = r.w;
  ok(up.ok && w.cols === 8 && w.rows === 5 && Math.abs(w.front.y - 4.7) < 1e-9, '升级成公寓 8×5：引擎房间跟着变');
  tick(r, st, 20); ok(bodyOK(w), '升级后正常活动');
}

section('6. 刷新恢复');
{
  const st = fresh(); st.coins = 9000; place(st, 'c77', 'furn_sofa', 0, 0); st.coins = 9000; PG.buy(st, E, 'c77', T0 - 5e5, M);
  clock = T0; const r = rt(); let w = r.sync(st); tick(r, st, 24);
  PE.pet(w, 'button'); tick(r, st, 6); const aff = w.dog.affinity;
  ok(clock === T0 + 30000, '页面开了 30 秒'); r.beforePersist(st);
  ok(st.pet.eng.savedAt === T0 + 30000, 'savedAt = 最后模拟的时间'); const saved = clone(st.pet.eng);
  // 马上刷新（2 秒后）
  clock = T0 + 32000; const s2 = reload(st), r2 = rt(), w2 = r2.sync(s2);
  ok(Math.hypot(w2.dog.x - saved.dog.x, w2.dog.y - saved.dog.y) < 0.05, '短离开：原地回来');
  ok(w2.dog.affinity === aff && aff > PE.CFG.AFF0, '亲密保留（' + aff + '）');
  ok(Math.abs(w2.dog.energy - Math.min(100, saved.dog.energy + PE.CFG.SLEEP_GAIN * 2)) < 1e-6, '精力 = 存档 + 离开 2 秒的休息（' + saved.dog.energy + ' → ' + w2.dog.energy.toFixed(2) + '）');
  ok(r2.lastEvent === 'back' && bodyOK(w2), '「你回来了」，不压家具');
  // 一小时后再开
  clock = T0 + 30000 + 3600e3; const s3 = reload(st), r3 = rt(), w3 = r3.sync(s3);
  const bedSpot = PE.interactSpot(w3, 'pet_bed');
  ok(r3.lastEvent === 'slept' && Math.hypot(w3.dog.x - bedSpot.spot.x, w3.dog.y - bedSpot.spot.y) < 1e-6, '长离开：在窝里睡着');
  ok(w3.dog.energy > saved.dog.energy && w3.dog.affinity === aff, '离线只回精力，不扣亲密');
  ok(w3.ball.state === 'floor' && bodyOK(w3), '球在地上，只有一个');
  // 叼着球存档
  clock = T0; const s4 = reload(st), r4 = rt(), w4 = r4.sync(s4); w4.ball.state = 'carried'; r4.beforePersist(s4);
  const s5 = reload(s4), w5 = rt().sync(s5); ok(w5.ball.state === 'floor', '叼着球存档：回来球在地上');
  // resume（页面藏起来很久）
  const r6 = rt(); r6.sync(s4); clock = T0 + 3600e3; ok(r6.resume(s4) === 'slept', 'resume：先存再按存档重建（离线 = 睡觉）');
  clock = T0;
}

section('7. 搬家');
{
  const st = fresh(); st.coins = 9000; st.ceos.pearl.unlocked = true; PG.buy(st, E, 'c77', T0, M);
  const r = rt(); let w = r.sync(st); PE.pet(w, 'button'); tick(r, st, 6); const aff = w.dog.affinity;
  r.beforePersist(st); PG.move(st, E, 'pearl'); w = r.sync(st);
  ok(r.homeId === 'pearl' && r.lastEvent === 'moved' && w.dog.affinity === aff, '搬到珍珠姐家：重建世界，亲密带过去');
  ok(w.dog.y > w.rows - 2 && bodyOK(w), '从前沿进门');
  r.beforePersist(st); ok(st.pet.eng.home === 'pearl', '之后的存档记在新家');
}

section('8. 三档房子压力测试（随机摆满 + 边玩边换家具）');
{
  const fids = E.FURNITURE.filter(f => !f.wall).map(f => f.id);
  for (const lv of [1, 2, 3]) {
    let bad = 0, steps = 0, acts = 0, relayout = 0, nanN = 0, outside = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = seed * 9301 + lv; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      const st = fresh(); st.coins = 1e12; while (E.homeOf(st, 'c77').lv < lv) E.upgradeHome(st, 'c77');
      const want = [4, 7, 10][lv - 1];
      for (let i = 0; i < 40 && E.homeOf(st, 'c77').placed.length < want; i++) { const fid = fids[Math.floor(rnd() * fids.length)]; const at = E.findFree(st, 'c77', fid, 0); if (at && E.FURN_BY_ID[fid].w * E.FURN_BY_ID[fid].h <= 4) { E.buyFurniture(st, fid); E.placeItem(st, 'c77', fid, at.x, at.y, 0, at.surf); } }
      st.coins = 1e6; PG.buy(st, E, 'c77', T0 + seed, M);
      const r = rt(); let w = r.sync(st);
      for (let t = 0; t < 240 * 10; t++) {
        if (t % 300 === 150) { const H = E.homeOf(st, 'c77'), p = H.placed[Math.floor(rnd() * H.placed.length)]; if (p) { const T = E.homeTier(H.lv); const r2 = E.moveItem ? E.moveItem(st, 'c77', p.uid, Math.floor(rnd() * T.cols), Math.floor(rnd() * T.rows), p.rot) : null; if (r2 && r2.ok) relayout++; } }
        if (t % 97 === 40) { const k = Math.floor(rnd() * 3); const res = k === 0 ? r.call(st) : k === 1 ? r.pet(st) : r.throwBall(st); if (res.ok) acts++; }
        if (t % 700 === 650) { r.beforePersist(st); clock += 4000; r.reset(); }
        clock += 100; r.frame(0.1, st); w = r.w; steps++;
        if (!bodyOK(w)) bad++;
        if (!Number.isFinite(w.dog.x + w.dog.y + w.dog.energy)) nanN++;
        if (w.dog.x < 0 || w.dog.y < 0 || w.dog.x > w.cols || w.dog.y > w.rows) outside++;
      }
    }
    const T = E.homeTier(lv);
    ok(bad === 0 && nanN === 0 && outside === 0, `${T.name} ${T.cols}×${T.rows}：${steps} 帧 身体盒压家具 ${bad} / NaN ${nanN} / 出界 ${outside}（互动 ${acts}，换家具 ${relayout}）`);
    ok(acts > 30, `${T.name}：互动确实发生（${acts}）`);
  }
}

section('10. p4b：满屋（合法摆满）= 正常状态，不崩、不扣了钱没狗（熊大 14:14）');
{
  const guard = (name, fn) => { try { fn(); } catch (e) { ok(false, name + ' 整段报错：' + (e.message || e)); } };
  const T = (lv) => E.homeTier(lv);
  const tryDo = (fn) => { try { return { v: fn() }; } catch (e) { return { err: e.message || String(e) }; } };
  // 合法摆满：每格一个盆栽（走游戏自己的 buyFurniture / placeItem，全部 ok 才算合法）
  function fill(st, id, skip) {
    const H = E.homeOf(st, id), t = E.homeTier(H.lv), c0 = st.coins; let n = 0, bad = 0;
    for (let y = 0; y < t.rows; y++) for (let x = 0; x < t.cols; x++) {
      if (skip && skip.some(([a, b]) => a === x && b === y)) continue;
      st.coins = 1e9; E.buyFurniture(st, 'furn_plant'); const r = E.placeItem(st, id, 'furn_plant', x, y, 0, 'floor'); if (r.ok) n++; else bad++;
    }
    st.coins = c0; return { n, bad };
  }
  const petCount = (st) => (PG.owned(st) ? 1 : 0);
  const hasRoomF = (...a) => (PG.hasRoom ? PG.hasRoom(...a) : 'missing');
  const finAll = (o) => { let okk = true; (function walk(v) { if (typeof v === 'number' && !Number.isFinite(v)) okk = false; else if (v && typeof v === 'object') for (const k in v) walk(v[k]); })(o); return okk; };
  // 10a：三档合法满屋购买
  for (const lv of [1, 2, 3]) guard('10a ' + lv, () => {
    const st = fresh(); st.coins = 1e12; while (E.homeOf(st, 'c77').lv < lv) E.upgradeHome(st, 'c77');
    const f = fill(st, 'c77'); st.coins = 5000;
    ok(f.n === T(lv).cols * T(lv).rows && f.bad === 0, `${T(lv).name} ${T(lv).cols}×${T(lv).rows}：合法摆满 ${f.n} 个盆栽`);
    ok(hasRoomF(st, E, 'c77', M) === false, `${T(lv).name} 满屋：hasRoom = false`);
    const r = tryDo(() => PG.buy(st, E, 'c77', T0, M));
    ok(!r.err && r.v && !r.v.ok && r.v.noRoom && /暂时无法入宅/.test(r.v.why), `${T(lv).name} 满屋购买：提示「暂时无法入宅」（${r.err || (r.v && r.v.why)}）`);
    ok(st.coins === 5000 && petCount(st) === 0 && !('pet' in st), `${T(lv).name} 满屋购买：金币 5000 → ${st.coins}、宠物 0 → ${petCount(st)}（不扣钱、不写 pet）`);
    const rt0 = rt(); const s0 = tryDo(() => rt0.sync(st)); ok(!s0.err && s0.v === null, `${T(lv).name} 满屋没买：运行时不建世界、不报错`);
    // 收起一盆 → 有 1 格空地 → 能买，小狗站在那格里不压家具
    const H = E.homeOf(st, 'c77'); E.storeItem(st, 'c77', H.placed[H.placed.length - 1].uid);
    ok(hasRoomF(st, E, 'c77', M) === true, `${T(lv).name} 收起一盆：有地方了`);
    const r2 = tryDo(() => PG.buy(st, E, 'c77', T0, M)); ok(!r2.err && r2.v.ok && st.coins === 2000 && petCount(st) === 1, `${T(lv).name} 留 1 格后购买：扣 3000（5000 → ${st.coins}），宠物 1`);
    const rt1 = rt(); const s1 = tryDo(() => { const w = rt1.sync(st); tick(rt1, st, 20); return w; });
    ok(!s1.err && s1.v && !rt1.waiting && bodyOK(rt1.w), `${T(lv).name} 1 格里的小狗：站得下、20 秒不压家具（${s1.err || ''}）`);
  });
  // 10b：已有宠物，读档时满屋（主线预览共用这份档，摆家具时不认识小狗）——三档
  for (const lv of [1, 2, 3]) guard('10b ' + lv, () => {
    clock = T0;
    const st = fresh(); st.coins = 1e12; while (E.homeOf(st, 'c77').lv < lv) E.upgradeHome(st, 'c77'); st.coins = 9000;
    PG.buy(st, E, 'c77', T0, M); const r = rt(); r.sync(st); tick(r, st, 5); r.w.dog.affinity = 47; r.beforePersist(st);
    fill(st, 'c77'); const coins = st.coins;
    clock += 60000; const s2 = reload(st), r2 = rt();
    const x = tryDo(() => { r2.sync(s2); tick(r2, s2, 10); return true; });
    ok(!x.err && r2.waiting && r2.lastEvent === 'waiting', `${T(lv).name} 满屋读档：不崩，进「等待安置」（${x.err || r2.lastEvent}）`);
    ok(PG.owned(s2) && petCount(s2) === 1 && s2.coins === coins && s2.pet.home === 'c77', `${T(lv).name} 满屋读档：所有权保留、宠物 1、金币不变`);
    const acts = ['call', 'pet', 'throwBall'].map(k => tryDo(() => r2[k](s2)));
    ok(acts.every(a => !a.err && !a.v.ok && a.v.why === 'waiting'), `${T(lv).name} 等待安置：呼唤 / 摸摸 / 抛球不响应、不报错`);
    const y = tryDo(() => { r2.beforePersist(s2); return reload(s2); });
    ok(!y.err && PG.owned(y.v) && finAll(y.v.pet) && y.v.pet.eng.dog.affinity === 47, `${T(lv).name} 等待中存档 → 读档：无 NaN、亲密 47 保留（${y.err || ''}）`);
    const H = E.homeOf(s2, 'c77'); E.storeItem(s2, 'c77', H.placed[7].uid); tick(r2, s2, 2);
    ok(!r2.waiting && bodyOK(r2.w) && r2.w.dog.affinity === 47 && r2.w.stats.placed >= 1, `${T(lv).name} 收起一盆：小狗自动出来，不压家具，亲密还是 47`);
    ok(s2.coins === coins && petCount(s2) === 1, `${T(lv).name} 全程金币 / 宠物数守恒`);
  });
  // 10c：布置把最后的空地挡满（游戏的摆放规则不认识小狗）→ 等待安置；收起 → 自动出来
  guard('10c', () => {
    clock = T0;
    const st = fresh(); fill(st, 'c77', [[2, 3], [4, 1]]); st.coins = 9000;
    ok(PG.buy(st, E, 'c77', T0, M).ok, '小屋只留 2 格：能买'); const coins = st.coins;
    const r = rt(); r.sync(st); tick(r, st, 5); ok(bodyOK(r.w), '小狗在某个空格里');
    const cx = Math.floor(r.w.dog.x), cy = Math.floor(r.w.dog.y), other = cx === 2 && cy === 3 ? [4, 1] : [2, 3];
    // 挪一盆到小狗脚下（同时空出原来那格）：小狗挪到空出来的格子
    const H = E.homeOf(st, 'c77'), mover = H.placed.find(p => p.x === 0 && p.y === 0);
    let mv = E.moveItem(st, 'c77', mover.uid, cx, cy); const a = tryDo(() => { tick(r, st, 3); return true; });
    ok(mv.ok && !a.err && !r.waiting && bodyOK(r.w) && [[0, 0], other].some(([a, b]) => Math.floor(r.w.dog.x) === a && Math.floor(r.w.dog.y) === b), '把盆栽挪到小狗脚下：小狗挪到剩下的空格（空出来的 (0,0) 或另一格），不压家具（' + (a.err || [r.w.dog.x.toFixed(2), r.w.dog.y.toFixed(2)]) + '）');
    // 摆上最后两格 → 一格不剩
    const free = []; const t = E.homeTier(1); for (let y = 0; y < t.rows; y++) for (let x = 0; x < t.cols; x++) if (E.canPlace(st, 'c77', 'furn_plant', x, y, 0, null, 'floor').ok) free.push([x, y]);
    st.coins = 1e9; for (const [x, y] of free) { E.buyFurniture(st, 'furn_plant'); E.placeItem(st, 'c77', 'furn_plant', x, y, 0, 'floor'); } st.coins = coins;
    const b = tryDo(() => { tick(r, st, 3); return true; });
    ok(free.length === 2 && !b.err && r.waiting && PG.owned(st), `布置挡满最后 ${free.length} 格：不崩，等待安置（${b.err || ''}）`);
    ok(r.w.stats.noRoom >= 1 && r.w.dog.activity === 'waiting', '引擎记一次 noRoom');
    E.storeItem(st, 'c77', H.placed[H.placed.length - 1].uid); tick(r, st, 2);
    ok(!r.waiting && bodyOK(r.w), '收起刚摆的那盆：自动出来');
    ok(st.coins === coins && petCount(st) === 1, '布置挡满全程：金币 / 宠物数守恒');
  });
  // 10d：搬家进满屋 → 等待安置；升级房子（满屋变大）→ 自动出来；金币只扣升级费
  guard('10d', () => {
    clock = T0;
    const st = fresh(); st.ceos.pearl.unlocked = true; st.coins = 9000; PG.buy(st, E, 'c77', T0, M);
    const r = rt(); r.sync(st); PE.pet(r.w, 'button'); tick(r, st, 6); const aff = r.w.dog.affinity; r.beforePersist(st);
    fill(st, 'pearl'); const coins = st.coins;
    const mv = PG.move(st, E, 'pearl'); const a = tryDo(() => { r.sync(st); tick(r, st, 3); return true; });
    ok(mv.ok && !a.err && r.homeId === 'pearl' && r.waiting && r.lastEvent === 'waiting', `搬进满屋（珍珠姐家 6×4 摆满）：不崩，等待安置（${a.err || r.lastEvent}）`);
    ok(st.pet.home === 'pearl' && petCount(st) === 1 && st.coins === coins && r.w.dog.affinity === aff, '搬家：所有权 / 亲密保留，不花钱');
    r.beforePersist(st); const s2 = reload(st), r2 = rt(); const b = tryDo(() => { r2.sync(s2); tick(r2, s2, 2); return true; });
    ok(!b.err && r2.waiting && finAll(s2.pet), '搬进满屋后刷新：还在等待安置，无 NaN');
    s2.coins = coins + 80000; const up = E.upgradeHome(s2, 'pearl'); tick(r2, s2, 3);
    ok(up.ok && s2.coins === coins && !r2.waiting && r2.w.cols === 8 && bodyOK(r2.w), '升级成公寓（满屋变大）：小狗自动出来，不压家具；金币只扣升级费');
    ok(petCount(s2) === 1 && r2.w.dog.affinity === aff, '升级后：宠物 1、亲密保留');
  });
  // 10e：已有宠物、满屋时直接升级（读档就满 → 升级）
  guard('10e', () => {
    clock = T0;
    const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0, M); const r = rt(); r.sync(st); r.beforePersist(st);
    fill(st, 'c77'); const s2 = reload(st), r2 = rt(); r2.sync(s2); ok(r2.waiting, '小屋满屋读档：等待安置');
    s2.coins = 1e7; const up = E.upgradeHome(s2, 'c77'); tick(r2, s2, 2);
    ok(up.ok && !r2.waiting && bodyOK(r2.w) && s2.coins === 1e7 - 80000 && petCount(s2) === 1, '升级房子：自动出来；金币只扣 80000');
  });
}

section('11. p4b：坏档逐字段容错（NaN / 无穷 / 字符串 / 负数 / 超界 / 缺字段 / null）（熊大 14:17）');
{ try {
  const finAll = (o) => { let okk = true; (function walk(v) { if (typeof v === 'number' && !Number.isFinite(v)) okk = false; else if (v && typeof v === 'object') for (const k in v) walk(v[k]); })(o); return okk; };
  const tryDo = (fn) => { try { return { v: fn() }; } catch (e) { return { err: e.message || String(e) }; } };
  clock = T0;
  const base = fresh(); base.coins = 9000; place(base, 'c77', 'furn_sofa', 0, 0); base.coins = 9000; PG.buy(base, E, 'c77', T0 - 1000, M);
  { const r = rt(); r.sync(base); tick(r, base, 5); r.w.dog.affinity = 52; r.w.dog.energy = 33; r.beforePersist(base); }
  const coins = base.coins;
  const set = (o, path, v) => { const ks = path.split('.'); let c = o; for (let i = 0; i < ks.length - 1; i++) c = c[ks[i]]; if (v === undefined) delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = v; };
  // 读档 = E.migrate + norm；坏值在 JSON 之后塞进去（NaN / Infinity 这种 JSON 带不了的也测）
  const corrupt = (path, v) => { const s = E.migrate(clone(base), T0 + 2000).st; set(s, 'pet.' + path, v); PG.norm(s, E); return s; };
  const fields = ['savedAt', 't', 'rs', 'dog.x', 'dog.y', 'dog.dir', 'dog.energy', 'dog.affinity', 'dog.lastGain', 'dog.lastEat', 'dog.tired', 'dog.asleep', 'ball.x', 'ball.y', 'ball.carried', 'home'];
  const bads = [['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity], ['字符串', 'abc'], ['数字字符串', '12'], ['负数', -5], ['超界', 1e300], ['缺字段', undefined], ['null', null], ['对象', {}], ['数组', [1]]];
  let cases = 0, crash = 0, nanN = 0, lost = 0, nanSave = 0, coinBad = 0; const why = [];
  for (const f of fields) for (const [bn, bv] of bads) {
    cases++;
    const r = tryDo(() => {
      clock = T0 + 2000; const s = corrupt('eng.' + f, bv);
      if (!PG.owned(s) || s.coins !== coins) { lost++; why.push(f + '/' + bn + ' 丢所有权'); }
      const r1 = rt(); const w = r1.sync(s); tick(r1, s, 3);
      const d = w.dog; if (![d.x, d.y, d.energy, d.affinity, d.lastGain, w.t, w.ball.x, w.ball.y].every(Number.isFinite)) { nanN++; why.push(f + '/' + bn + ' 运行中 NaN'); }
      if (!r1.waiting && !bodyOK(w)) { nanN++; why.push(f + '/' + bn + ' 压家具'); }
      r1.beforePersist(s); const js = JSON.stringify(s);
      const back = reload(JSON.parse(js));
      if (!finAll(s.pet) || /NaN|Infinity/.test(js) || !finAll(back.pet) || back.pet.eng.savedAt === null || back.pet.eng.t === null) { nanSave++; why.push(f + '/' + bn + ' 存档非法'); }
      if (!PG.owned(back) || back.coins !== coins) { lost++; why.push(f + '/' + bn + ' 往返丢'); }
      if (s.coins !== coins) coinBad++;
    });
    if (r.err) { crash++; why.push(f + '/' + bn + ' 报错 ' + r.err); }
  }
  ok(crash === 0, `pet.eng ${fields.length} 个字段 × ${bads.length} 种坏值 = ${cases} 例：读档 / 运行 / 保存都不报错（报错 ${crash}）` + (crash ? ' ' + why.filter(x => /报错/.test(x)).slice(0, 4).join('；') : ''));
  ok(nanN === 0, `运行中无 NaN / 不压家具（${nanN}）` + (nanN ? ' ' + why.filter(x => /NaN|压/.test(x)).slice(0, 4).join('；') : ''));
  ok(nanSave === 0, `保存 → 读档往返：存档里没有 NaN / Infinity / null 时间戳（${nanSave}）` + (nanSave ? ' ' + why.filter(x => /存档/.test(x)).slice(0, 4).join('；') : ''));
  ok(lost === 0 && coinBad === 0, `所有权 / 金币一个都没丢（${lost} / ${coinBad}）`);
  // 外层字段坏了也不清所有权
  const outer = (p) => tryDo(() => { const s = E.migrate(clone(base), T0).st; p(s.pet); PG.norm(s, E); const r1 = rt(); r1.sync(s); tick(r1, s, 1); r1.beforePersist(s); return s; });
  for (const [nm, fn] of [['eng = NaN', p => { p.eng = NaN; }], ['eng = 字符串', p => { p.eng = 'x'; }], ['eng = null', p => { p.eng = null; }], ['eng 缺 dog', p => { delete p.eng.dog; }], ['eng.dog = null', p => { p.eng.dog = null; }], ['eng.ball = 数组', p => { p.eng.ball = [1, 2]; }],
                          ['boughtAt = NaN', p => { p.boughtAt = NaN; }], ['boughtAt = -1', p => { p.boughtAt = -1; }], ['boughtAt = "x"', p => { p.boughtAt = 'x'; }], ['home = 123', p => { p.home = 123; }], ['home = null', p => { delete p.home; }],
                          ['owned = "true"', p => { p.owned = 'true'; }], ['owned 缺', p => { delete p.owned; }], ['v = 99', p => { p.v = 99; }]]) {
    const r = outer(fn);
    ok(!r.err && PG.owned(r.v) && r.v.coins === coins && finAll(r.v.pet) && typeof r.v.pet.home === 'string' && Number.isFinite(r.v.pet.boughtAt), `pet.${nm}：不报错、所有权保留、无 NaN（${r.err || ''}）`);
  }
  // 合法的 0 保留 / 范围夹紧 / 默认值
  const one = (path, v, now) => { clock = now || T0 + 2000; const s = corrupt(path, v); const r1 = rt(); r1.sync(s); return { s, w: r1.w, r: r1 }; };
  let o = one('eng.dog.energy', 0); ok(o.w.dog.energy >= 0 && o.w.dog.energy < 5, '精力 0：保留 0（+ 离开 1 秒的休息），不当缺失');
  o = one('eng.t', 0); ok(o.s.pet.eng.t === 0 && o.w.t >= 0 && o.w.t < 5, 't = 0：保留');
  o = one('eng.dog.lastGain', 0); ok(o.s.pet.eng.dog.lastGain === 0, 'lastGain = 0：保留');
  o = one('boughtAt', 0); ok(o.s.pet.boughtAt === 0 && PG.owned(o.s), 'boughtAt = 0：保留');
  o = one('eng.dog.x', 0); ok(Number.isFinite(o.w.dog.x) && bodyOK(o.w), 'x = 0（贴墙，站不下）：挪到最近安全站位');
  o = one('eng.dog.affinity', 0); ok(o.w.dog.affinity === PE.CFG.AFF0, '亲密 0（低于起始）：夹到 40');
  o = one('eng.dog.affinity', 1e300); ok(o.w.dog.affinity === PE.CFG.AFF_MAX, '亲密超界：夹到上限 ' + PE.CFG.AFF_MAX);
  o = one('eng.dog.affinity', 61.7); ok(o.w.dog.affinity === 61, '亲密小数：取整 61');
  o = one('eng.dog.energy', 150); ok(o.w.dog.energy === 100, '精力 150：夹到 100');
  o = one('eng.dog.energy', -5); ok(o.w.dog.energy < 5, '精力 -5：夹到 0');
  o = one('eng.dog.lastGain', 1e12); ok(o.s.pet.eng.dog.lastGain <= o.s.pet.eng.t, 'lastGain 远超 t：夹到 ≤ t（冷却不会永远不结束）');
  { const s = E.migrate(clone(base), T0).st; s.pet.eng.dog.lastGain = 1e12; PG.norm(s, E); clock = T0 + 2000; const r1 = rt(); const w = r1.sync(s); w.dog.affinity = 50; tick(r1, s, 61); const a0 = w.dog.affinity; PE.pet(w, 'button'); tick(r1, s, 10); ok(w.dog.affinity === a0 + 1, '…读档后照样能加亲密'); }
  o = one('eng.savedAt', 0); ok(o.r.lastEvent === 'slept' && o.w.dog.energy === 100, 'savedAt = 0（合法，很久以前）：离线最多按 30 天算，在窝里睡、精力 100');
  o = one('eng.savedAt', T0 + 1e9); ok(o.r.restored.elapsed === 0, 'savedAt 在未来：离线算 0');
  o = one('eng.savedAt', undefined); ok(o.r.restored.elapsed === 0 && o.s.pet.eng.savedAt === null, 'savedAt 缺：离线算 0，不出 NaN');
  { clock = T0 + 48 * 3600e3; const s = reload(base); const r1 = rt(); const w = r1.sync(s); ok(r1.lastEvent === 'slept' && w.dog.energy === 100 && w.dog.affinity === 52 && Number.isFinite(w.t), '48 小时离线：在窝里睡、精力 100、亲密 52、无 NaN'); clock = T0; }
  o = one('eng.dog.dir', 'toString'); ok(o.w.dog.dir === 'S', 'dir = "toString"：不认原型链，回默认 S');
  // 引擎层直接喂坏档（原型也走这条）
  const W0 = PE.createWorld({ catalog: E.FURNITURE, room: { cols: 6, rows: 4, wallRows: 2, front: { x: 3, y: 3.7 }, bed: { x: 0, y: 3.1, w: 1.3, h: 0.9 }, bowl: null, items: [] }, interact: PG.INTERACT, manifest: M, seed: 3 });
  const rr = tryDo(() => PE.restore(W0, { v: 1, savedAt: 'x', t: 'abc', rs: NaN, dog: { x: 'a', y: null, energy: NaN, affinity: 'b', lastGain: Infinity }, ball: null }, T0));
  const ser = tryDo(() => PE.serialize(W0, T0));
  ok(!rr.err && rr.v.ok && !ser.err && finAll(ser.v) && [W0.dog.x, W0.dog.y, W0.dog.energy, W0.t].every(Number.isFinite), '引擎 restore 一堆坏字段：不报错，serialize 全是有限数值（' + (rr.err || ser.err || '') + '）');
} catch (e) { ok(false, '11 整段报错：' + (e.message || e)); } }

section('11b. p4c：合法读档边界（熊大 15:20 p4b 复核）——满屋存档读进只空 1 格不穿家具；满屋读档保留疲倦');
{
  const guard = (name, fn) => { try { fn(); } catch (e) { ok(false, name + ' 整段报错：' + (e.message || e)); } };
  function fill(st, id) { const t = E.homeTier(E.homeOf(st, id).lv), c0 = st.coins; for (let y = 0; y < t.rows; y++) for (let x = 0; x < t.cols; x++) { st.coins = 1e9; E.buyFurniture(st, 'furn_plant'); E.placeItem(st, id, 'furn_plant', x, y, 0, 'floor'); } st.coins = c0; }
  const visD = (w) => PA.IN_PLACE.includes(w.dog.anim.name) ? (w.dog.dir === 'W' ? 'W' : 'E') : w.dog.dir;
  for (const dir of ['E', 'W', 'N', 'S']) guard('11b-1 ' + dir, () => {
    clock = T0; const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0, M);
    const r = rt(); r.sync(st); tick(r, st, 3); fill(st, 'c77'); tick(r, st, 1);
    r.w.dog.dir = dir; r.beforePersist(st); const coins = st.coins, aff = r.w.dog.affinity;
    const s2 = reload(st); const H = E.homeOf(s2, 'c77'); E.storeItem(s2, 'c77', H.placed.find(p => p.x === 2 && p.y === 1).uid);
    clock += 1000; const r2 = rt(); r2.sync(s2);
    const f0 = r2.w && !r2.waiting && bodyOK(r2.w), v0 = r2.w && visD(r2.w);
    let bad = 0; for (let n = 0; n < 5; n++) { tick(r2, s2, 0.1); if (!bodyOK(r2.w)) bad++; }
    let bad2 = 0; for (let n = 0; n < 30; n++) { tick(r2, s2, 0.1); if (!bodyOK(r2.w)) bad2++; }
    ok(f0 && bad === 0 && bad2 === 0 && Math.floor(r2.w.dog.x) === 2 && Math.floor(r2.w.dog.y) === 1, `小屋满屋存档（朝 ${dir}）读进只空 (2,1)：首帧（${v0}）/ 0.5 秒 / 3.5 秒都不穿家具（${bad}/${bad2}）`);
    ok(s2.coins === coins && PG.owned(s2) && r2.w.dog.affinity === aff, `朝 ${dir}：金币 / 所有权 / 亲密不变`);
  });
  guard('11b-2', () => {
    clock = T0; const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0, M);
    const r = rt(); r.sync(st); tick(r, st, 3); r.w.dog.energy = 50; r.w.dog.tired = true;
    fill(st, 'c77'); tick(r, st, 0.5); ok(r.waiting, '精力 50 / 疲倦时摆满：等待安置');
    r.beforePersist(st); const s2 = reload(st); clock += 1000; const r2 = rt(); r2.sync(s2); tick(r2, s2, 0.5);
    ok(r2.waiting && r2.w.dog.tired === true, '满屋读档：疲倦保留（精力 ' + r2.w.dog.energy.toFixed(1) + '）');
    const H = E.homeOf(s2, 'c77'); for (const p of H.placed.filter(p => p.y >= 1 && p.y <= 2 && p.x >= 1 && p.x <= 4)) E.storeItem(s2, 'c77', p.uid);
    let rest = false, explore = false; for (let n = 0; n < 40; n++) { tick(r2, s2, 0.1); if (r2.w.dog.activity === 'rest') rest = true; if (r2.w.dog.activity === 'explore') explore = true; }
    ok(!r2.waiting && rest && !explore && bodyOK(r2.w), '腾出空地出来后继续休息，不去探索（' + r2.w.dog.activity + '）');
    r.w.dog.energy = 50; r.w.dog.tired = true; r.beforePersist(st); const s3 = reload(st); clock += 40000; const r3 = rt(); r3.sync(s3);   // 离线 41 秒：精力回到 70 以上
    ok(r3.waiting && r3.w.dog.energy >= 70 && r3.w.dog.tired === false, '离线后精力已回到 70 以上：满屋读档不延续疲倦（精力 ' + r3.w.dog.energy.toFixed(1) + '）');
  });
}

section('12. 静态检查：存档键 / 主线不受影响');
{
  const pg = fs.readFileSync(path.join(__dirname, 'petgame.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const prev = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
  const root = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.js'), 'utf8');
  ok(!/(localStorage|sessionStorage)\s*[.[]/.test(pg), 'petgame.js 不碰 localStorage');
  const keysOf = (s) => (s.match(/'tangzhe-[a-z0-9-]+'/g) || []).sort().join(',');
  ok(keysOf(app) === keysOf(prev), '游戏副本的存档键和预览完全一样：' + keysOf(app));
  ok(!/tangzhe-pet-proto/.test(app + pg), '游戏不写原型的 tangzhe-pet-proto');
  ok(!/tangzhe-preview-save/.test(root), '根 app.js 没有 tangzhe-preview-save*');
  ok((app.match(/localStorage\.setItem\(/g) || []).length === (prev.match(/localStorage\.setItem\(/g) || []).length, '游戏副本的 localStorage 写入点数量 = 预览（没新增写入）');
  ok(/PetGame\.norm\(m\.st, E\)/.test(app) && /petBeforePersist\(\);/.test(app), '读档 norm / 存档 beforePersist 两个钩子在');
}

section('13. p5：买狗走预览统一钱包（12d addCoins / spendCoins；12d1 异常钱包一律拒绝）');
{
  const pets = (st) => ('pet' in st ? 1 : 0);
  let st = fresh(); st.coins = 3000; st.coinFrac = 0.5;
  let r = PG.buy(st, E, 'c77', T0, M); ok(r.ok && r.cost === 3000 && st.coins === 0 && st.coinFrac === 0.5 && pets(st) === 1, '余额正好 3000（+0.5 零头）：买到，整数余额精确 −3000、零头不动');
  st = fresh(); st.coins = 2999; st.coinFrac = 0.99; r = PG.buy(st, E, 'c77', T0, M); ok(!r.ok && r.why === '金币不够' && st.coins === 2999 && st.coinFrac === 0.99 && !pets(st), '2999 + 0.99 零头：不够（整数比较，零头不帮凑），不扣、不写 pet');
  for (const v of [NaN, Infinity, -1, 'abc', null, undefined, 1e20, Number.MAX_SAFE_INTEGER + 1, 2 ** 60]) {
    st = fresh(); st.coins = v; const before = JSON.stringify({ c: st.coins, p: 'pet' in st });
    r = PG.buy(st, E, 'c77', T0, M);
    ok(!r.ok && r.why === '金币数据异常' && JSON.stringify({ c: st.coins, p: 'pet' in st }) === before && Object.is(st.coins, v), `钱包异常（coins = ${String(v)}）：买狗被拒、余额原样、不写 pet`);
  }
  st = fresh(); st.coins = 5e15 + 1; r = PG.buy(st, E, 'c77', T0, M); ok(r.ok && st.coins === 5e15 + 1 - 3000 && pets(st) === 1, '旧档中间段余额 5e15+1：能买，精确 −3000');
  st = fresh(); st.coins = Number.MAX_SAFE_INTEGER; r = PG.buy(st, E, 'c77', T0, M); ok(r.ok && st.coins === Number.MAX_SAFE_INTEGER - 3000, '余额 = MAX_SAFE_INTEGER：能买，精确 −3000（扣款断言过）');
  // 12d1：读档发现主档余额超安全整数 → loadSave 异常模式（blocked），这份状态买狗必须被拒
  const raw = fresh(); raw.coins = 1e20; raw.rev = 5; const L = E.loadSave(JSON.stringify(raw), null, T0); PG.norm(L.st, E);
  r = PG.buy(L.st, E, 'c77', T0, M); ok(L.blocked && L.unsafe && !r.ok && r.why === '金币数据异常' && L.st.coins === 1e20 && !pets(L.st), '12d1 异常钱包模式（主档余额 1e20，loadSave blocked）：买狗被拒，余额 / 宠物都不变');
  const raw2 = fresh(); raw2.coins = null; const L2 = E.loadSave(JSON.stringify(raw2), null, T0); PG.norm(L2.st, E);
  r = PG.buy(L2.st, E, 'c77', T0, M); ok(L2.blocked && !r.ok && !pets(L2.st), '12d 坏档不保存模式（coins = null 没备份）：买狗被拒（读档后 coins 归 0 的内存态也买不起）');
  // 买完写档前的校验：validState / checkSave 都过（pet 字段不影响金币校验）；loadSave 往返 pet 保留
  st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0, M); const back = E.loadSave(JSON.stringify(st), null, T0 + 1);
  ok(E.validState(st).length === 0 && E.checkSave(JSON.parse(JSON.stringify(st))).length === 0 && back.source === 'main' && back.st.pet && back.st.pet.home === 'c77' && back.st.coins === 6000, '买完：validState / checkSave 通过；loadSave 往返小狗和余额都在');
  const pg = fs.readFileSync(path.join(__dirname, 'petgame.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  ok(!/\.coins\s*-=/.test(pg) && /E\.transact\(st, \{ price: PET\.price/.test(pg) && !/E\.spendCoins\(/.test(pg) && /E\.walletOk\(st\)/.test(pg), 'p6：petgame.js 不直接改 coins、不再自己 spendCoins：扣钱 + 写 pet + 落盘只走 12d3 统一入口 E.transact，先查 E.walletOk');
  ok(/E\.loadSave\(/.test(app) && /if \(m\.blocked\) saveBlocked = true;\n  if \(window\.PetGame\) PetGame\.norm\(m\.st, E\);/.test(app) && /E\.validState\(state\)/.test(app), 'game/app.js 基于 12d2：读档 E.loadSave（异常 / 不保存模式照旧）后才 norm 小狗，写档前 validState + 备份轮换');
  ok(/const ART_ONE = \{ face_c77:'12d2' \};/.test(app) && /`\.\.\/\.\.\/art\/face_\$\{id\}\.webp\?v=\$\{artV\('face_' \+ id\)\}`/.test(app) && !/face_\$\{id\}\.webp\?v=\$\{ART_V\}/.test(app), '熊大 22:08：game/app.js 基于 12d2 带上 ART_ONE，77 头像地址 = ../../art/face_c77.webp?v=12d2（不再 ?v=11）');
  ok(/E\.walletOk\(state\)/.test(app) && /E\.canAfford\(state, P\.price\)/.test(app), '购买弹窗：余额 / 能不能买走 E.balance / E.canAfford，钱包异常不弹购买窗');
}

section('14. p6：买狗走 12d3 统一交易入口 E.transact（保存失败整体回滚 / 异常钱包拒买）；宠物 persist 守 12d3 规则');
{
  const roomy = () => { const s = fresh(); s.coins = 5000; return s; };
  // ① 保存成功：扣 3000、写 pet、save 只调一次、看到的是已改好的整档
  { const s = roomy(); let calls = 0, seen = null; const r = PG.buy(s, E, 'c77', T0, M, (x) => { calls++; seen = { coins: x.coins, pet: !!x.pet }; return true; });
    ok(r.ok && r.cost === 3000 && s.coins === 2000 && s.pet && s.pet.home === 'c77' && calls === 1 && seen.coins === 2000 && seen.pet, `保存成功：扣 3000、写 pet、save 调 1 次且看到改好的整档（${JSON.stringify(seen)}）`); }
  // ② 保存失败（返回 false / {ok:false} / 抛错）：整档原地回滚，钱 / pet / rev / 其余字段一个字节都不变，对象引用不变
  for (const [nm, sv] of [['返回 false', () => false], ['返回 {ok:false}', () => ({ ok: false, why: 'x' })], ['抛错（setItem 爆）', () => { throw new Error('QuotaExceeded'); }], ['返回 undefined', () => undefined]]) {
    const s = roomy(); s.rev = 41; const before = JSON.stringify(s), ref = s.shops; const r = PG.buy(s, E, 'c77', T0, M, sv);
    ok(!r.ok && r.stage === 'save' && JSON.stringify(s) === before && !('pet' in s) && s.coins === 5000 && s.rev === 41, `保存失败（${nm}）：买狗整体回滚，金币 5000 / 无 pet / rev 41 / 整档逐字节原样（stage ${r.stage}）`);
  }
  // ③ 保存失败后再保存成功：能正常买（回滚没留下半截状态）
  { const s = roomy(); PG.buy(s, E, 'c77', T0, M, () => false); const r = PG.buy(s, E, 'c77', T0, M, () => true); ok(r.ok && s.coins === 2000 && PG.owned(s), '保存失败回滚后再买一次：正常扣 3000、有狗（没留半截状态）'); }
  // ④ 异常钱包 / 只读：save 一次都不调
  for (const [nm, mk] of [['余额 1e20', (s) => { s.coins = 1e20; }], ['余额 NaN', (s) => { s.coins = NaN; }], ['余额 MAX_SAFE+1', (s) => { s.coins = Number.MAX_SAFE_INTEGER + 1; }]]) {
    const s = roomy(); mk(s); let calls = 0; const before = JSON.stringify(s); const r = PG.buy(s, E, 'c77', T0, M, () => { calls++; return true; });
    ok(!r.ok && calls === 0 && !('pet' in s) && JSON.stringify(s) === before, `异常钱包（${nm}）：拒买、save 0 次、存档原样（${r.why}）`);
  }
  { const s = roomy(); let calls = 0; const r = PG.buy(s, E, 'c77', T0, M, () => { calls++; return true; }, true);
    ok(!r.ok && r.stage === 'blocked' && calls === 0 && s.coins === 5000 && !('pet' in s), `调用方已知只读（blocked=true，如多标签冻结）：拒买、save 0 次（${r.why}）`); }
  { const bad = fresh(); bad.coins = 1e20; const L = E.loadSave(JSON.stringify(bad), null, T0); PG.norm(L.st, E); let calls = 0;
    const r = PG.buy(L.st, E, 'c77', T0, M, () => { calls++; return true; }, L.blocked);
    ok(L.blocked && !r.ok && calls === 0 && !PG.owned(L.st), `12d3 loadSave 只读档（主档 1e20）：拒买、save 0 次（${r.why}）`); }
  // ⑤ 跨页写档（E.commitSave）：备份写失败 → 整次放弃、主档不动、买狗回滚
  { const mem = {}, store = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { if (store.failBak && /-bak$/.test(k)) throw new Error('bak'); mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    const s0 = roomy(); s0.rev = 7; mem['tangzhe-preview-save'] = JSON.stringify(s0); const s = E.loadSave(mem['tangzhe-preview-save'], null, T0).st; PG.norm(s, E);
    store.failBak = true; const main0 = mem['tangzhe-preview-save'];
    const r1 = PG.buy(s, E, 'c77', T0, M, (x) => E.commitSave(store, 'tangzhe-preview-save', 'tangzhe-preview-save-bak', x));
    ok(!r1.ok && mem['tangzhe-preview-save'] === main0 && !('tangzhe-preview-save-bak' in mem) && !PG.owned(s) && s.coins === 5000, `跨页 commitSave 备份写失败：整次放弃，主档逐字节不动、内存买狗回滚（${r1.why}）`);
    store.failBak = false; const r2 = PG.buy(s, E, 'c77', T0, M, (x) => E.commitSave(store, 'tangzhe-preview-save', 'tangzhe-preview-save-bak', x));
    const disk = JSON.parse(mem['tangzhe-preview-save']);
    ok(r2.ok && disk.pet && disk.pet.home === 'c77' && disk.coins === 2000 && disk.rev === 8 && mem['tangzhe-preview-save-bak'] === main0 && !E.checkSave(disk).length, `跨页 commitSave 正常：主档有狗、2000 金币、rev 7→8，-bak = 买前主档，checkSave 干净`); }
  // ⑥ 宠物页 persist 与预览 12d3 逐字一致（封禁返回 false、备份写失败整次放弃）；setItem 次数一致
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'), pre = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
  const fn = (src) => { const i = src.indexOf('function persist() {'), j = src.indexOf('\n}\n', i); return i < 0 ? '' : src.slice(i, j + 3).replace(/\n  petBeforePersist\(\);[^\n]*/, ''); };
  ok(fn(app) && fn(app) === fn(pre), '宠物页 persist() = 预览 12d3 persist()（除小狗状态写回一行）：只读返回 false、写前 validState、备份写失败整次放弃主档不动');
  ok(/if \(saveBlocked\) return false;/.test(fn(app)) && /备份写不进去，这次没有保存/.test(fn(app)), '宠物页 persist：封禁返回 false；备份写失败提示并放弃');
  const cnt = (src) => (src.match(/localStorage\.setItem\(/g) || []).length;
  ok(cnt(app) === cnt(pre), `宠物页 localStorage.setItem 次数 = 预览（${cnt(app)} = ${cnt(pre)}）`);
  ok(/PG\.buy\(state, E, home, now\(\), petM, \(\) => persist\(\), saveBlocked \|\| frozen\)/.test(app) && !/atomic\(\(\) => PG\.buy/.test(app), '购买确认：PG.buy 带 () => persist() 和只读标记走 E.transact（不再套 atomic 二次事务）');
  ok(/const r = E\.transact\(state, \{ price:price \|\| 0, apply, save:\(\) => persist\(\), blocked:saveBlocked \}\);/.test(app), 'game/app.js 基于 12d3（带 txn / E.transact）');
}

section('15. 12e：熊大 23:26 第 3 项——完整游戏画布左右留余量，叼着的球不被裁（朝东截右、朝西镜像截左）');
{
  ok(typeof PG.padXOf === 'function', 'petgame.js 导出 padXOf（画布横向余量）');
  const pad = typeof PG.padXOf === 'function' ? PG.padXOf(M) : 0, br = PE.CFG.BALL_R * 256 / M.runtime.displayTiles, lw = Math.max(1.5, br * 0.22);
  const over = [];
  for (const [name, c] of Object.entries(M.clips)) c.frames.forEach((f, i) => { if (!f.mouth) return;
    const lo = f.mouth[0] - br - lw, hi = f.mouth[0] + br + lw;                       // 朝东：球在 [lo, hi]
    const mlo = 256 - hi, mhi = 256 - lo;                                             // 朝西镜像：x → 256 − x
    if (lo < -pad || hi > 256 + pad || mlo < -pad || mhi > 256 + pad) over.push(`${name}#${i}`); });
  ok(pad > 0 && !over.length, `所有叼球帧（含镜像）的球都在画布 [−${pad}, 256+${pad}] 概念坐标内（超出：${over.slice(0, 6).join('、') || '无'}）`);
  for (const [name, i] of [['idle_E', 0], ['run_E', 0], ['sniff', 0]]) { const m = M.clips[name].frames[i].mouth; ok(m && m[0] + br + lw > 256 && m[0] + br + lw <= 256 + pad, `${name}#${i}：球右沿 ${(m[0] + br + lw).toFixed(1)} 伸出 256（旧画布会裁），在余量 256+${pad} 以内`); }
  const src = fs.readFileSync(path.join(__dirname, 'petgame.js'), 'utf8');
  ok(/CW = S \+ 2 \* padX/.test(src) && /gx = CW \/ 2 \* dpr/.test(src) && /width:\$\{CW\}px/.test(src), '画布宽 = S + 2·padX，落地点仍在画布正中（gx = CW/2），dog 元素同宽、translate(-50%) 定位不变');
}

console.log(`\n宠物 p4/p4b/p4c/p5/p6 游戏接入：${pass} 过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
