// 锁修复 20261014：冻结/未卸载页面留下的陈旧 Web Lock 不得让新页永远卡在「正在打开存档」。
// 浏览器端完整回归：python3 tests/lockfix_browser.py（Chromium+WebKit 390）。
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../collectibles/entry.mjs',import.meta.url),'utf8');
test('waiting page pings holder and steals stale lock instead of waiting forever',()=>{
  assert.match(src,/steal:true/);assert.match(src,/type:'ping'/);assert.match(src,/if\(!alive\)return steal\(\)/);
  assert.match(src,/collectibleTakeOver','在本页继续'/);
});
test('only a visible owning page answers alive',()=>{assert.match(src,/m\.type==='ping'&&lease\.owns\(\)&&!document\.hidden/);});
test('taken-over page revokes on broadcast and never writes lock state to storage',()=>{
  assert.match(src,/m\.type==='taken'&&m\.from!==myEpoch\)onTaken\(\)/);assert.match(src,/function onTaken\(\)\{if\(!acquired\|\|takenOver\)return;takenOver=true;revoke\('WRITER_TAKEN_OVER'\)/);
  assert.doesNotMatch(src,/localStorage\.setItem/);
});
