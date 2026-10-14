// 杨总 bug：开业合影已拥有但在经营页看不到——旧位置压在雨棚花边上。这里锁定：挂在空墙上、不压雨棚/招牌、在画布内、带相框，且真的会画出来。
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.Image = class { constructor(){ this.complete = true; this.naturalWidth = 512; } };
const D = (await import('../../collectibles/decor6-display.mjs')).default;
const sizes = [[390, 285], [320, 240], [430, 300], [768, 420]];
for (const [W, H] of sizes) test(`开业合影 ${W}×${H} 在雨棚与招牌之外、画布之内`, () => {
  const U = H / 260, l = { ground:H*.87, signY:H*.035, signH:H*.15, awnY:H*.2, awnH:H*.1, counterY:H*.6 };
  const p = D.placements(W, l, U).find(x => x.id === 'd_opening_photo');
  assert.ok(p.frame, '要有相框');
  const m = p.size * .09 + 1.6 * U, left = p.x - p.size/2 - m, right = p.x + p.size/2 + m, top = p.y - p.size/2 - m, bottom = p.y + p.size/2 + m;
  assert.ok(left >= 0 && top >= 0 && right <= W, '在画布内');
  assert.ok(bottom <= l.awnY, '不压雨棚');
  assert.ok(right <= W * .15 + 6 * U, '基本不挡招牌（招牌从 15% 宽开始）');
  assert.ok(p.size >= 30 * U || p.size >= W * .12, '够大，看得清');
});
test('拥有且未收起时开业合影真的画出来', () => {
  const calls = []; const c = new Proxy({}, { get:(t,k)=>k==='drawImage'?(...a)=>calls.push(a):(()=>{}), set:()=>true });
  const state = { cur:0, shops:[{open:true}], gacha:{owned:['d_opening_photo']}, decorHidden:[] };
  const W = 390, H = 285, U = H/260, l = { signY:H*.035, signH:H*.15, awnY:H*.2, awnH:H*.1, counterY:H*.6 };
  D.draw(c, state, W, l, U); assert.equal(calls.length, 1);
  calls.length = 0; state.decorHidden = ['d_opening_photo']; D.draw(c, state, W, l, U); assert.equal(calls.length, 0);
});
