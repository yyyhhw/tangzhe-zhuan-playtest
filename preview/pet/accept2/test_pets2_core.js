// 每房两只宠物 — 规则验收（Node，纯逻辑）：node preview/pet/accept2/test_pets2_core.js
// 规格：熊大 11:44（每房最多 2 只；实例不能同时在两间房；替换保留成长；保存失败整次回滚；旧档超额转待命不删）。
// 用例编号对应 ACCEPT.md 的 R1–R16。接口名 / 存档格式只在下面 ADAPT 一处，实现方换了名字只改这里。
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const E = require(path.join(ROOT, 'economy.js'));
const PG = require(path.join(ROOT, 'pet', 'game', 'petgame.js'));

const ADAPT = {
  max: () => PG.MAX_PER_ROOM,
  norm: (st) => PG.norm(st, E),
  // 返回 { rooms: { ceoId: [uid, ...] }, standby: [uid, ...], pets: { uid: { species, eng } } }
  view: (st) => PG.view(st, E),
  // room = CEO id，或 null = 放回待命；o = { replace: uid|null, save: fn, blocked: bool }
  assign: (st, uid, room, o) => PG.assign(st, E, uid, room, o),
  // 建议的新存档格式（实现改了格式就改这里）：state.pets = { v:2, list:[{ uid, species, room|null, boughtAt, eng }] }
  mkPets: (st, list) => { st.pets = { v: 2, list: list.map(p => Object.assign({ boughtAt: 1, eng: null }, p)) }; }
};
const need = ['MAX_PER_ROOM', 'view', 'assign', 'norm'].filter(k => !(k in PG));
if (need.length) { console.log('✗ 缺接口：PetGame.' + need.join(' / PetGame.') + '（见 ACCEPT.md「接口约定」）'); console.log('passed 0, failed 16 (未实现)'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, id, msg) => { if (c) pass++; else { fail++; console.log(`  ✗ ${id} ${msg}`); } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const T0 = 1790000000000;
const IDS = E.CEOS.map(c => c.id);
function fresh(nOpen) {
  const st = E.migrate(null, T0).st;
  IDS.slice(0, nOpen || IDS.length).forEach(id => { st.ceos[id].unlocked = true; st.ceos[id].lv = Math.max(1, st.ceos[id].lv || 1); });
  st.coins = 1e6; return E.migrate(clone(st), T0).st;
}
const eng = (n) => ({ v: 1, home: null, dog: { x: 1, y: 1, affinity: 40 + n, energy: 50 + n }, savedAt: T0 });   // 亲密度下限 40（engine CFG.AFF0），用合法值
const where = (v, uid) => { const r = Object.keys(v.rooms).filter(k => v.rooms[k].includes(uid)); return r.concat(v.standby.includes(uid) ? ['standby'] : []); };
function inv(st, uids, engs, id) {   // 每次操作后都要成立的不变量
  const v = ADAPT.view(st), all = Object.values(v.rooms).flat().concat(v.standby);
  ok(Object.values(v.rooms).every(a => a.length <= ADAPT.max()), id, '每房 ≤ 2 只 ' + JSON.stringify(v.rooms));
  ok(all.length === new Set(all).size, id, '同一只不会同时出现两处 ' + JSON.stringify(v));
  ok(uids.every(u => where(v, u).length === 1) && all.length === uids.length, id, '一只不少、一只不多');
  ok(uids.every(u => v.pets[u] && JSON.stringify(v.pets[u].eng && v.pets[u].eng.dog && v.pets[u].eng.dog.affinity) === JSON.stringify(engs[u])), id, '成长（亲密度）不变');
  return v;
}
const SAVE_OK = () => true;

console.log('== 读档');
{ // R1 没有宠物字段的旧档：读完不多出字段
  const st = fresh(); delete st.pet; delete st.pets; const before = clone(st); ADAPT.norm(st);
  ok(JSON.stringify(st) === JSON.stringify(before), 'R1', '没买过宠物的旧档读档后原样');
}
{ // R2 v13 单只小狗（state.pet）读档 → 还在原来的房间，亲密度保留
  const st = fresh(); st.pet = { v: 1, owned: true, home: IDS[1], boughtAt: T0, eng: Object.assign(eng(37), { home: IDS[1] }) };
  ADAPT.norm(st); const v = ADAPT.view(st), u = Object.keys(v.pets);
  ok(u.length === 1 && (v.rooms[IDS[1]] || []).includes(u[0]) && v.pets[u[0]].eng.dog.affinity === 77, 'R2', '单只小狗旧档：留在 ' + IDS[1] + ' 的家，亲密 77 保留 ' + JSON.stringify(v));
}
{ // R3 旧档一间房 5 只 → 2 只留房，3 只转待命，全部保留
  const st = fresh(), L = ['a', 'b', 'c', 'd', 'e'].map((u, i) => ({ uid: u, species: 'cat', room: IDS[0], boughtAt: T0 + i, eng: eng(i * 10) }));
  ADAPT.mkPets(st, L); ADAPT.norm(st); const v = ADAPT.view(st);
  ok((v.rooms[IDS[0]] || []).length === 2 && v.standby.length === 3, 'R3', '超额 5 只：房里 2、待命 3 ' + JSON.stringify(v));
  inv(st, L.map(p => p.uid), Object.fromEntries(L.map(p => [p.uid, p.eng.dog.affinity])), 'R3');
}
{ // R4 坏档：同一只写在两间房 → 只留一处
  const st = fresh(); ADAPT.mkPets(st, [{ uid: 'a', species: 'cat', room: IDS[0], eng: eng(1) }, { uid: 'a', species: 'cat', room: IDS[1], eng: eng(1) }]);
  ADAPT.norm(st); const v = ADAPT.view(st);
  ok(Object.keys(v.pets).length === 1 && where(v, 'a').length === 1, 'R4', '重复 uid 只保留一只、一处 ' + JSON.stringify(v));
}
{ // R5 坏档：房间是没加入的 CEO / 不存在的 id → 转待命，不删
  const st = fresh(1); ADAPT.mkPets(st, [{ uid: 'a', species: 'cat', room: IDS[2], eng: eng(5) }, { uid: 'b', species: 'cat', room: 'nobody', eng: eng(6) }]);
  ADAPT.norm(st); const v = ADAPT.view(st);
  ok(v.standby.includes('a') && v.standby.includes('b'), 'R5', '房间失效的转待命 ' + JSON.stringify(v));
}

console.log('== 调配');
const base = () => { const st = fresh(); ADAPT.mkPets(st, [{ uid: 'a', species: 'cat', room: null, eng: eng(11) }, { uid: 'b', species: 'dog', room: null, eng: eng(22) }, { uid: 'c', species: 'cat', room: null, eng: eng(33) }]); ADAPT.norm(st); return st; };
const ENG = { a: 51, b: 62, c: 73 }, U = ['a', 'b', 'c'];
{
  const st = base(), c0 = st.coins;
  let r = ADAPT.assign(st, 'a', IDS[0], { save: SAVE_OK }); ok(r && r.ok, 'R6', '待命 → 空房 ' + JSON.stringify(r));
  r = ADAPT.assign(st, 'b', IDS[0], { save: SAVE_OK }); ok(r && r.ok, 'R6', '有 1 只的房再放 1 只 ' + JSON.stringify(r));
  let v = inv(st, U, ENG, 'R6'); ok(v.rooms[IDS[0]].length === 2, 'R6', '房里 2 只');
  // R7 满房不指定替换：拒，整档不变，并告诉界面要选替换对象
  let snap = JSON.stringify(st); r = ADAPT.assign(st, 'c', IDS[0], { save: SAVE_OK });
  ok(r && !r.ok && r.needReplace && JSON.stringify(st) === snap, 'R7', '满房不选替换：拒、整档不变、needReplace ' + JSON.stringify(r));
  // R8 指定替换 b：c 进房，b 回待命，成长都不变
  r = ADAPT.assign(st, 'c', IDS[0], { replace: 'b', save: SAVE_OK }); v = inv(st, U, ENG, 'R8');
  ok(r && r.ok && v.rooms[IDS[0]].includes('c') && v.rooms[IDS[0]].includes('a') && v.standby.includes('b'), 'R8', '替换：c 进房、b 回待命 ' + JSON.stringify(v));
  // R9 替换对象不在这间房：拒，不变
  snap = JSON.stringify(st); r = ADAPT.assign(st, 'b', IDS[0], { replace: 'zz', save: SAVE_OK });
  ok(r && !r.ok && JSON.stringify(st) === snap, 'R9', '替换一只不在房里的：拒、不变');
  // R10 从 A 房搬去 B 房：A 房里不再有它
  r = ADAPT.assign(st, 'a', IDS[1], { save: SAVE_OK }); v = inv(st, U, ENG, 'R10');
  ok(r && r.ok && where(v, 'a')[0] === IDS[1] && !v.rooms[IDS[0]].includes('a'), 'R10', '跨房搬：只在新房 ' + JSON.stringify(v));
  // R11 放回待命
  r = ADAPT.assign(st, 'a', null, { save: SAVE_OK }); v = inv(st, U, ENG, 'R11'); ok(r && r.ok && v.standby.includes('a'), 'R11', '放回待命');
  ok(st.coins === c0, 'R12', '调配不花钱（金币 ' + c0 + ' → ' + st.coins + '）');
}
{ // R13 保存失败 / 抛异常 / 只读：整次回滚（含金币、rev、宠物位置）
  for (const [nm, o] of [['save 返回 false', { save: () => false }], ['save 抛异常', { save: () => { throw new Error('quota'); } }], ['只读', { save: SAVE_OK, blocked: true }]]) {
    const st = base(); ADAPT.assign(st, 'a', IDS[0], { save: SAVE_OK }); ADAPT.assign(st, 'b', IDS[0], { save: SAVE_OK });
    const snap = JSON.stringify(st); let r; try { r = ADAPT.assign(st, 'c', IDS[0], Object.assign({ replace: 'a' }, o)); } catch (e) { r = { threw: e.message }; }
    ok(r && !r.ok && !r.threw && JSON.stringify(st) === snap, 'R13', nm + '：替换失败整档原样 ' + JSON.stringify(r));
  }
}
{ // R14 非法输入：没加入的房 / 不存在的宠物 / 不存在的房
  const st = fresh(1); ADAPT.mkPets(st, [{ uid: 'a', species: 'cat', room: null, eng: eng(1) }]); ADAPT.norm(st); const snap = JSON.stringify(st);
  const rs = [ADAPT.assign(st, 'a', IDS[2], { save: SAVE_OK }), ADAPT.assign(st, 'zz', IDS[0], { save: SAVE_OK }), ADAPT.assign(st, 'a', 'nobody', { save: SAVE_OK })];
  ok(rs.every(r => r && !r.ok) && JSON.stringify(st) === snap, 'R14', '非法调配全拒、不变 ' + JSON.stringify(rs));
}
{ // R15 随机 400 次调配（含失败保存）后不变量都成立；失败的那次一定不改档
  const st = fresh(); const L = 'abcdefg'.split('').map((u, i) => ({ uid: u, species: i % 2 ? 'dog' : 'cat', room: null, eng: eng(i) }));
  ADAPT.mkPets(st, L); ADAPT.norm(st); const engs = Object.fromEntries(L.map(p => [p.uid, p.eng.dog.affinity])), uids = L.map(p => p.uid);
  let seed = 7; const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n; let bad = 0, okN = 0;
  for (let i = 0; i < 400; i++) {
    const v = ADAPT.view(st), room = rnd(5) === 0 ? null : IDS[rnd(IDS.length)], uid = uids[rnd(uids.length)], occ = room ? (v.rooms[room] || []) : [];
    const o = { save: rnd(6) === 0 ? () => false : SAVE_OK, replace: occ.length && rnd(2) ? occ[rnd(occ.length)] : null };
    const snap = JSON.stringify(st), r = ADAPT.assign(st, uid, room, o);
    if (!r || (!r.ok && JSON.stringify(st) !== snap)) bad++; if (r && r.ok) okN++;
    const w = ADAPT.view(st), all = Object.values(w.rooms).flat().concat(w.standby);
    if (Object.values(w.rooms).some(a => a.length > 2) || all.length !== uids.length || new Set(all).size !== all.length || uids.some(u => !w.pets[u] || w.pets[u].eng.dog.affinity !== engs[u])) bad++;
  }
  ok(bad === 0 && okN > 20, 'R15', `随机 400 次：违规 ${bad}，成功 ${okN}`);
}
{ // R16 刷新往返：E.migrate + norm 后位置、成长不变
  const st = base(); ADAPT.assign(st, 'a', IDS[0], { save: SAVE_OK }); ADAPT.assign(st, 'b', IDS[1], { save: SAVE_OK });
  const v0 = ADAPT.view(st), s2 = E.migrate(clone(st), T0 + 9e5).st; ADAPT.norm(s2); const v1 = ADAPT.view(s2);
  ok(JSON.stringify(v0.rooms) === JSON.stringify(v1.rooms) && JSON.stringify(v0.standby) === JSON.stringify(v1.standby), 'R16', '刷新后房间 / 待命不变 ' + JSON.stringify([v0, v1]));
}
console.log(`passed ${pass}, failed ${fail}`); process.exit(fail ? 1 : 0);
