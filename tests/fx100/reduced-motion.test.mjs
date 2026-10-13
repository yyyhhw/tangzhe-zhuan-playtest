// 体验-100：「减少动态」时经营页暴击不震屏、不画集中线、不震动手机（只改表现，不动暴击结算）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const f of ['app.js', 'pet/game/app.js']) test(f + ': shake / focus lines / vibrate gated by prefers-reduced-motion', () => {
  const s = fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
  assert.match(s, /const FX_RM = \(\(\) => \{ try \{ return matchMedia\('\(prefers-reduced-motion: reduce\)'\); \} catch \(e\) \{ return null; \} \}\)\(\);/);
  assert.match(s, /const fxReduced = \(\) => !!\(FX_RM && FX_RM\.matches\);/);
  assert.match(s, /const fxRm = fxReduced\(\);\n  let sx = 0, sy = 0; if \(shake > 0 && !fxRm\)/);
  assert.match(s, /if \(focusT > 0 && !fxRm\) \{ g\.save\(\);/);
  assert.match(s, /if \(navigator\.vibrate && !fxReduced\(\)\) navigator\.vibrate\(\[0, 12, 22, 40\]\[r\.tier\]\)/);
  assert.equal((s.match(/navigator\.vibrate\(/g) || []).length, 1, 'no other ungated vibrate');
  assert.match(s, /earn\(r\.value\); state\.taps\+\+; if \(r\.crit\) state\.crits\+\+;/, 'crit payout untouched');
});
