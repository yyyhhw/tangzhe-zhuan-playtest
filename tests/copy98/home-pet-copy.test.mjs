// 文案-98：CEO 在家台词 + 宠物文案（文案-95 第 4–11 条）+ 买/换宠物弹窗房名统一（homeRoomName → 「77 的小屋」）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const GONE = ['珍珠姐也要午休', '躺平不等于躺不平账', '火星还远，先走到窗边', '地上的装备，穿上', '陪你们玩', '选择你的伙伴', '选择与管理', '兼容待命 · 旧同种记录', "' · 兼容待命'", '条未知物种记录已隔离', '原记录保留，暂停运行', "name)}的家 · 选择替换", "name)+'的家'", '当前：${petEsc(homeRoomName'];
for (const f of ['app.js', 'pet/game/app.js']) test(f + ': old lines gone, new copy present', () => {
  const s = read(f);
  for (const g of GONE) assert.ok(!s.includes(g), g);
  for (const n of ['珍珠姐也要歇会儿。', '躺一会儿，账明天再对。', '火星还远，先在屋里走一圈。', '装备检查完毕，穿上！', '坐一会儿，歇歇脚。', '挑一只陪你过日子', '住在 ${petEsc(homeRoomName(homeWho))}：${here.length}/2 只', '${petEsc(homeRoomName(home))} · 选择替换', "'住进 '+petEsc(homeRoomName(room))", 'class="pet-desc"']) assert.ok(s.includes(n), n);
});
test('home-autonomy.js: eat/use lines no longer name a time slot or a specific appliance', () => {
  const s = read('home/home-autonomy.js');
  for (const g of ['下午茶时间', '冰箱头有冰粉', '冰箱温度刚好四度', '封口机的手感', '电视开着当背景音', '游戏机，就玩一局']) assert.ok(!s.includes(g), g);
});
test('petgame.js: no internal words in descs or player-facing why', () => {
  const s = read('pet/game/petgame.js');
  for (const g of ['待接入', '不是兼容待命宠物', '未知物种记录已保留，暂停运行', '兼容待命区', '存档交易不可用']) assert.ok(!s.includes(g), g);
  assert.equal((s.match(/只陪玩，不加产量。/g) || []).length, 7);
});
test('index.html + pet/game/index.html load the bumped tokens', () => {
  for (const f of ['index.html', 'pet/game/index.html']) { const h = read(f); assert.match(h, /home-autonomy\.js\?v=home82-fix103-20261014-r1/); assert.match(h, /petgame\.js\?v=home82-fix103-20261014-r1/); }
});
