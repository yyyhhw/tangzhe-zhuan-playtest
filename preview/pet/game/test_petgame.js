// 宠物 p4 — 游戏接入单元测试（Node）：node preview/pet/game/test_petgame.js
// 购买 / 重复购买 / 金币不够 / 搬家；旧档（没有 pet 字段）照常读、读完也不多出字段；pet 字段经 E.migrate 往返保留；
// 家宅布局 → 引擎；摆家具压到小狗 / 窝；布置模式暂停；升级房子；刷新恢复（短离开原地、长离开在窝里睡）；三档房子压力测试；静态检查存档键
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
  let r = PG.buy(st, E, 'c77', T0); ok(!r.ok && r.why === '金币不够' && !('pet' in st) && st.coins === 2999, '金币不够：买不了，不扣钱，不写 pet');
  st.coins = 10000;
  r = PG.buy(st, E, 'pearl', T0); ok(!r.ok && !('pet' in st) && st.coins === 10000, '没加入的 CEO 家：买不了');
  r = PG.buy(st, E, 'c77', T0); ok(r.ok && st.coins === 10000 - PG.PET.price && st.pet.owned === true && st.pet.home === 'c77' && st.pet.eng === null && st.pet.boughtAt === T0, '买到：扣 ' + PG.PET.price + '，住进 77 的家');
  const c1 = st.coins; r = PG.buy(st, E, 'c77', T0); ok(!r.ok && st.coins === c1, '只能养一只：再买被拒，不扣钱');
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
  const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0);
  const r = rt(); r.sync(st); tick(r, st, 5); r.beforePersist(st);
  const back = reload(st);
  ok(JSON.stringify(back.pet) === JSON.stringify(st.pet), 'E.migrate + norm 往返：pet 原样保留');
  ok(back.pet.eng && back.pet.eng.home === 'c77' && !('items' in back.pet.eng) && back.pet.eng.v === PE.CFG.SAVE_V, 'eng 带 home、不带家具（家具以家宅为准）');
  ok(JSON.stringify(back.pet).length < 600, 'pet 字段很小（' + JSON.stringify(back.pet).length + ' 字节）');
  const bad = (pet) => { const s = clone(st); s.pet = pet; return reload(s); };
  ok(!('pet' in bad('x')) && !('pet' in bad([])) && !('pet' in bad(null)) && !('pet' in bad({ owned: false })), '坏 pet（字符串 / 数组 / null / 没 owned）：删掉 = 没买');
  const b2 = bad({ owned: true, home: 'rocket', eng: { v: 1, dog: {} } }); ok(b2.pet.home === 'c77' && b2.pet.eng === null, '家没开放：搬回第一个开放的家，eng 清掉');
  const b3 = bad({ owned: true, home: 'c77', eng: { v: 99, dog: {} } }); ok(b3.pet.eng === null && b3.pet.home === 'c77', 'eng 版本不对：清掉（小狗还在）');
  const b4 = bad({ owned: true, home: 'c77', boughtAt: 'zz' }); ok(b4.pet.boughtAt === 0 && b4.pet.eng === null, 'boughtAt / eng 缺失：补默认');
  ok(Object.keys(E.migrate(clone(st), T0).st).filter(k => k === 'pet').length === 1, 'E.migrate 本身就保留 pet（主线预览读到这份档也不会丢小狗）');
}

section('4. 家宅布局 → 引擎');
{
  const st = fresh(); st.coins = 9000;
  place(st, 'c77', 'furn_sofa', 0, 0); place(st, 'c77', 'furn_rug', 2, 1); place(st, 'c77', 'furn_catbed', 4, 2);
  E.buyFurniture(st, 'furn_painting'); const wp = E.findFree(st, 'c77', 'furn_painting', 0); E.placeItem(st, 'c77', 'furn_painting', wp.x, wp.y, 0, wp.surf);
  st.coins = 9000; PG.buy(st, E, 'c77', T0);
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
  const st = fresh(); st.coins = 9000; PG.buy(st, E, 'c77', T0);
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
  const st = fresh(); st.coins = 9000; place(st, 'c77', 'furn_sofa', 0, 0); st.coins = 9000; PG.buy(st, E, 'c77', T0 - 5e5);
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
  const st = fresh(); st.coins = 9000; st.ceos.pearl.unlocked = true; PG.buy(st, E, 'c77', T0);
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
      st.coins = 1e6; PG.buy(st, E, 'c77', T0 + seed);
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

section('9. 静态检查：存档键 / 主线不受影响');
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

console.log(`\n宠物 p4 游戏接入：${pass} 过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
