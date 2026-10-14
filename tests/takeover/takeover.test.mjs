// 熊二接手（杨总 2026-10-14 09:26）：盲盒-92 未来日期提示/跨午夜、升级豪宅豪华度文案、宠物保存失败提示、经营-55 东京 06:00 口径、文案-94
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ROOT = new URL('../../', import.meta.url), req = createRequire(import.meta.url);
const read = f => fs.readFileSync(new URL(f, ROOT), 'utf8');
function helpers(file, E, state) {
  const s = read(file), pick = n => s.split('\n').find(l => l.startsWith('function ' + n + '('));
  return new Function('E', 'state', ['fmtClockLocal', 'gachaResumeText', 'gachaFutureNote', 'gachaDayStamp'].map(pick).join('\n') + '\nreturn {gachaResumeText, gachaFutureNote, gachaDayStamp};')(E, state);
}
const withTZ = (tz, fn) => { const old = process.env.TZ; process.env.TZ = tz; try { return fn(); } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; } };
for (const [app, eco] of [['app.js', 'economy.js'], ['pet/game/app.js', 'pet/game/economy.js']]) {
  const E = req('../../' + eco);
  test(app + ': 盲盒-92 future-dated save shows notice and the real resume day, not 明天', () => withTZ('Asia/Tokyo', () => {
    const t = Date.parse('2026-10-14T09:30:00+09:00'), st = { gachaDaily: { day: '2026-10-17', n: 5 } };
    const h = helpers(app, E, st);
    assert.equal(E.gachaDailyLeft(st, t), 0);
    assert.equal(h.gachaResumeText(t), '10月18日 06:00 恢复');
    assert.match(h.gachaFutureNote(t), /存档里的开盒日期（2026-10-17）比本机今天晚.*10月18日 06:00 恢复/);
    const ok = helpers(app, E, { gachaDaily: { day: E.dayKey(t), n: 5 } });
    assert.equal(ok.gachaFutureNote(t), '');
    assert.equal(ok.gachaResumeText(t), '明天 06:00 恢复');
    const ny = helpers(app, E, { gachaDaily: { day: '2027-01-02', n: 1 } });
    assert.equal(ny.gachaResumeText(Date.parse('2026-12-31T10:00:00+09:00')), '2027年1月2日 06:00 恢复');
  }));
  test(app + ': 盲盒-103 future-dated save: n<5 recovers at 06:00 OF the saved day, n=5 the day after', () => withTZ('Asia/Tokyo', () => {
    const t = Date.parse('2026-10-14T09:30:00+09:00');
    const two = helpers(app, E, { gachaDaily: { day: '2026-10-17', n: 2 } }), five = helpers(app, E, { gachaDaily: { day: '2026-10-17', n: 5 } });
    assert.equal(two.gachaResumeText(t), '10月17日 06:00 恢复'); assert.match(two.gachaFutureNote(t), /10月17日 06:00 恢复/);
    assert.equal(five.gachaResumeText(t), '10月18日 06:00 恢复'); assert.match(five.gachaFutureNote(t), /10月18日 06:00 恢复/);
    const pre = Date.parse('2026-10-17T05:59:50+09:00');
    assert.equal(two.gachaResumeText(pre), '明天 06:00 恢复'.replace('明天', '今天'));
    const st = { gachaDaily: { day: '2026-10-17', n: 2 } };
    assert.equal(E.gachaDailyLeft(st, Date.parse('2026-10-17T06:00:00+09:00')), 3, 'counter agrees: 17日 06:00 already 3/5');
    assert.equal(helpers(app, E, { gachaDaily: { day: '2026-10-22', n: 1 } }).gachaResumeText(t), '10月22日 06:00 恢复');
  }));
  test(app + ': 盲盒-92 crossing local midnight re-renders (明天 06:00 → 今天 06:00)', () => withTZ('Asia/Tokyo', () => {
    const h = helpers(app, E, null), a = Date.parse('2026-10-14T23:59:00+09:00'), b = Date.parse('2026-10-15T00:01:00+09:00');
    assert.equal(E.dayKey(a), E.dayKey(b), 'same game day');
    assert.notEqual(h.gachaDayStamp(a), h.gachaDayStamp(b), 'stamp changes at local midnight');
    assert.equal(h.gachaResumeText(a), '明天 06:00 恢复'); assert.equal(h.gachaResumeText(b), '今天 06:00 恢复');
    const s = read(app);
    assert.match(s, /\$\{rem \? gachaFutureNote\(now\(\)\) : ''\}/);
  }));
  test(app + ': 升级豪宅 gain copy = 房间自带豪华度 +30（现在 +10）, from HOME_TIERS', () => {
    const s = read(app);
    assert.match(s, /房间自带豪华度 \+\$\{next\.bonus\}（现在 \+\$\{T\.bonus\}）/);
    assert.equal(E.HOME_TIERS[2].bonus, 30); assert.equal(E.HOME_TIERS[1].bonus, 10);
  });
  test(app + ': pet save failure no longer promises 「位置与金币均未改变」', () => {
    const s = read(app);
    assert.doesNotMatch(s, /位置与金币均未改变/);
    assert.match(s, /function petAfterResult[\s\S]*?r\.uncertain \|\| persist\.pending \|\| COLLECTION\.coordinator\.failed \? '保存结果还没确认/);
  });
  test(eco + ': 经营-55 Tokyo 06:00 is the same instant as old UTC+8 05:00 (dayKey unchanged); 文案-94 copy', () => {
    assert.equal(E.CFG.TZ_OFFSET_MIN, 540); assert.equal(E.CFG.DAY_RESET_HOUR, 6);
    for (const iso of ['2026-10-14T05:59:59+09:00', '2026-10-14T06:00:00+09:00', '2026-10-13T23:30:00Z']) {
      const ts = Date.parse(iso), d = new Date(ts + (480 - 300) * 60000);
      assert.equal(E.dayKey(ts), d.toISOString().slice(0, 10), iso);
    }
    assert.equal(E.nextResetTs(Date.parse('2026-10-14T09:00:00+09:00')), Date.parse('2026-10-15T06:00:00+09:00'));
    const s = read(eco);
    assert.match(s, /why:'科技公司雇到员工后开放'/); assert.match(s, /text:'给漫画书店雇员工阿页'/); assert.match(s, /送漫画书店 90 秒产量的大订单/);
    assert.doesNotMatch(s, /明天再来|摸鱼科技公司雇到/);
    assert.match(read(app), /' 次已开完，' \+ gachaResumeText\(now\(\)\)\); \}/);
  });
}
