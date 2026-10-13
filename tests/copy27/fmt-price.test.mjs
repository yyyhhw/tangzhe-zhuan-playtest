// 文案-27：fmtPrice（价格往上取整）/ fmtBal（余额往下取整）——按王大妈 2026-10-13 15:12/15:13 交付的规则与验收清单。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, ROOT), 'utf8');
const FILES = ['app.js', 'pet/game/app.js'];
const load = p => {
  const src = read(p);
  const block = src.match(/const FMT_TIERS[\s\S]*?\nfunction fmtPrice\(n\)[^\n]*\n/)[0];
  const ctx = vm.createContext({});
  vm.runInContext(block + ';globalThis.out={fmt,fmtBal,fmtPrice};', ctx);
  return { src, block, ...ctx.out };
};
const num = s => { const m = s.match(/^(-?[\d.,]+)(万亿|万|亿)?$/); return parseFloat(m[1].replace(/,/g, '')) * ({ 万: 1e4, 亿: 1e8, 万亿: 1e12 }[m[2]] || 1); };

for (const p of FILES) {
  const { src, fmt, fmtBal, fmtPrice } = load(p);
  test(`${p}: 示例表（main 现有格式）`, () => {
    const T = [[11500, '11,500', '11,500'], [11968, '11,968', '11,968'], [12000, '12,000', '12,000'], [19999, '19,999', '19,999'],
      [99999, '99,999', '99,999'], [119995, '11.99万', '12.00万'], [1234567, '123.4万', '123.5万'],
      [99999999, '9999.9万', '1.00亿'], [100000001, '1.00亿', '1.01亿']];
    for (const [n, b, pr] of T) { assert.equal(fmtBal(n), b, 'bal ' + n); assert.equal(fmtPrice(n), pr, 'price ' + n); assert.equal(fmt(n), b); }
  });
  test(`${p}: 进位换单位`, () => {
    assert.equal(fmtPrice(99999999), '1.00亿'); assert.ok(!/10000/.test(fmtPrice(99999999)));
    assert.equal(fmtBal(99999999), '9999.9万'); assert.notEqual(fmtBal(99999999), '10000.0万');
    assert.equal(fmtPrice(99999.5), '10.00万'); assert.equal(fmtPrice(99.95), '100');
  });
  test(`${p}: 整除的数两边一样`, () => { for (const n of [1e4, 2e5, 1e8]) assert.equal(fmtBal(n), fmtPrice(n)); });
  test(`${p}: 1 万对 余额<价格 显示不同且余额更小`, () => {
    let seed = 27; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let k = 0; k < 10000; k++) {
      const price = Math.floor(Math.exp(rnd() * Math.log(1e11))) + 1, bal = Math.floor(rnd() * price);
      const b = fmtBal(bal), pr = fmtPrice(price);
      assert.notEqual(b, pr, `${bal} vs ${price}`); assert.ok(num(b) < num(pr), `${bal}:${b} vs ${price}:${pr}`);
    }
  });
  test(`${p}: A 类价格口径调用点用 fmtPrice，B 类余额仍用 fmt`, () => {
    for (const s of ["'开张 ' + fmtPrice(E.SHOPS[i].open)", '<small>${fmtPrice(cost)}</small>', '单价 ${fmtPrice(CFG.GACHA_PRICE)}',
      '? fmtPrice(S.open) : LOCK_IC', '再开一个 · ${fmtPrice(E.gachaPrice(state))}', '<td>价格</td><td>${fmtPrice(f.price)}</td>',
      "'还差 ' + fmtPrice(f.price - bal)", '<td>价格</td><td>${fmtPrice(N.cost)}</td>', "'还差 ' + fmtPrice(N.cost - bal)",
      "'购买 · '+fmtPrice(P.price)+' 金币'", '价格：${fmtPrice(P.price)} 金币']) assert.ok(src.includes(s), s);
    assert.equal((src.match(/fmtPrice\(/g) || []).length, 12);
    for (const s of ['fmt(E.balance(state))', '当前余额</td><td>${fmt(bal)}', 'fmt(bal - N.cost)']) assert.ok(src.includes(s), s);
  });
}
test('root 与 pet 的格式函数逐字一致', () => assert.equal(load('app.js').block, load('pet/game/app.js').block));
test('preview 与 td/zombie 本次不动（仍无 fmtPrice）', () => {
  for (const p of ['preview/app.js', 'preview/pet/game/app.js', 'td/td.js', 'zombie/zombie.js']) assert.ok(!read(p).includes('fmtPrice'), p);
});
