// 星途小文案修复（10-15 09:07）：到达页按航线名写「X往返已完成」；领取按钮按实际点数，不再写死 8。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const ov=fs.readFileSync(new URL('../../space/overlay.mjs',import.meta.url),'utf8');
test('到达页不写死月面、按钮不写死 8 点',()=>{
  assert(!ov.includes("'月面往返已完成"));assert(!ov.includes('领取8探索点'));
  assert(ov.includes('`${RN(view)}往返已完成，返航报告待确认。`'));
  assert(ov.includes('`确认返航报告 · 领取${arrPts}探索点`'));
  assert(ov.includes('view.event?.reward?.pts'));
});
