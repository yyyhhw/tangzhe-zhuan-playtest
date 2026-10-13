// 盲盒-92：5 次用完后按本机时区写「明天 HH:MM 恢复」；停在盲盒页跨过切换点自动重画（只改显示，不动计数/存档）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ROOT = new URL('../../', import.meta.url);
const E = createRequire(import.meta.url)('../../economy.js');
function helper(file) {
  const s = fs.readFileSync(new URL(file, ROOT), 'utf8');
  const fc = s.match(/^function fmtClockLocal\(ts\) \{.*\}$/m)[0], gr = s.match(/^function gachaResumeText\(t\) \{.*\}$/m)[0];
  return new Function('E', fc + '\n' + gr + '\nreturn gachaResumeText;')(E);
}
for (const file of ['app.js', 'pet/game/app.js']) {
  test(file + ': 今日剩余 line carries resume text (盲盒-96); daily-limit counter/save untouched', () => {
    const s = fs.readFileSync(new URL(file, ROOT), 'utf8');
    assert.match(s, /id="gachaDailyDone" disabled>\$\{E\.CFG\.GACHA_DAILY_LIMIT\} 次已开完</);
    assert.doesNotMatch(s, /gachaDailyDone" disabled>[^<]*明天再来/);
    assert.match(s, /今日剩余 \$\{dailyLeft\}\/\$\{E\.CFG\.GACHA_DAILY_LIMIT\}\$\{dailyLeft > 0 \? '' : ' · ' \+ gachaResumeText\(now\(\)\)\}</);   // 盲盒-96：恢复时间挪到「今日剩余」行，390 不折行
    assert.match(s, /gachaShownDay = E\.dayKey\(now\(\)\);/);
    assert.match(s, /if \(tab === 'gacha' && gachaShownDay && E\.dayKey\(t\) !== gachaShownDay\) \{ renderTab\(\); return; \}/);
    assert.doesNotMatch(s.slice(s.indexOf('function gachaResumeText')).split('\n')[0], /gachaDaily\s*=/, 'helper never writes the counter');
  });
  test(file + ': resume text follows device timezone (今天/明天 + local HH:MM)', () => {
    const cases = [
      ['Asia/Tokyo', '2026-10-13T22:00:00+09:00', '明天 06:00 恢复'],
      ['Asia/Tokyo', '2026-10-14T03:00:00+09:00', '今天 06:00 恢复'],
      ['Asia/Kuala_Lumpur', '2026-10-13T12:00:00+08:00', '明天 05:00 恢复'],
      ['Europe/London', '2026-10-13T18:00:00+01:00', '今天 22:00 恢复'],
      ['America/Los_Angeles', '2026-10-13T20:00:00-07:00', '明天 14:00 恢复'],
    ];
    const old = process.env.TZ;
    try { for (const [tz, iso, want] of cases) { process.env.TZ = tz; assert.equal(helper(file)(Date.parse(iso)), want, tz + ' ' + iso); } }
    finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  });
}
for (const file of ['app.js', 'pet/game/app.js']) test(file + ': 盲盒-96 no duplicate 「77 收藏盲盒」 title on the gacha page', () => {
  const s = fs.readFileSync(new URL(file, ROOT), 'utf8'), body = s.slice(s.indexOf('function renderGacha() {'), s.indexOf('\n}\n', s.indexOf('function renderGacha() {')));
  assert.doesNotMatch(body, /77 收藏盲盒/, 'renderGacha body no longer has its own title');
  assert.match(s, /<div class="ch-title">77 收藏盲盒<\/div>/, 'header card keeps the one title');
});
