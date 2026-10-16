// 测试-142 — 星途-02 子游戏回执写 milestones 的 WebKit 补验（只测不改游戏代码），390×844。
// 第一部分（本提交）：打僵尸 firstZombie，只在 root（pet/game 副本没有打僵尸入口，记 N/A）。
//   ⑧a 新档：打开打僵尸菜单不算参与；锁着的无尽模式开局失败不记；关菜单不记；真点 #startBtn 开打 → 父页记
//       firstZombie（整数时间，≥ firstShop），此时 zombie.cleared 仍是 0（不需要赢）；输掉一局时间不变；
//       子页重复发 started 不覆盖；关掉打僵尸后保存再刷新，时间原样。照 tests/milestones/zombie-browser.py 的 Chromium 路径。
// 第二部分（下一轮）：塔防通关 firstTDWin。
// 没法在 macOS WebKit 验的：iOS 真机 Safari、后台冻结恢复。
//
// Usage: node scenarios-142.mjs   (WebKit)   |   BROWSER=chromium [CHROMIUM_PATH=...] node scenarios-142.mjs
import { webkit, chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';
import { SAVE_KEY, TAB_LOCK_KEY, ENTRY_POINTS, VIEWPORT, SEED_SENTINEL } from './save-recipe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = (process.env.BROWSER || 'webkit').toLowerCase();
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const READY = 'window.__tzz && window.XingTu';
const checks = [], errors = [], notCovered = [];
let shotN = 0;
const J = (v) => JSON.stringify(v);
const tagOf = (entry) => entry === '/' ? 'root' : 'pet';

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 500) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const isResourceNoise = (t) => /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon/i.test(t);
function wireErrors(page, label) {
  page.on('pageerror', (e) => { errors.push({ label, kind: 'pageerror', text: String(e) }); console.log(`PAGEERROR [${label}] ${e}`); });
  page.on('console', (m) => {
    if (m.type() !== 'error' || isResourceNoise(m.text())) return;
    errors.push({ label, kind: 'console.error', text: m.text() }); console.log(`CONSOLE.ERROR [${label}] ${m.text()}`);
  });
}
async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT, `141-${String(++shotN).padStart(2, '0')}-${ENGINE}-${name}.png`) }); } catch {}
}
function tzAt(hour) {
  let o = ((hour - new Date().getUTCHours()) % 24 + 24) % 24;
  if (o > 14) o -= 24;
  return o === 0 ? 'Etc/GMT' : `Etc/GMT${o > 0 ? '-' : '+'}${Math.abs(o)}`;
}
const ctxOpts = (timezoneId = 'Asia/Tokyo') => ({ viewport: VIEWPORT, isMobile: ENGINE !== 'firefox', hasTouch: true, timezoneId });
async function newCtx(browser, seed, tz) {
  const ctx = await browser.newContext(ctxOpts(tz));
  if (seed) await ctx.addInitScript(({ seed, sentinel }) => {
    try {
      if (localStorage.getItem(sentinel)) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem(sentinel, '1');
    } catch {}
  }, { seed, sentinel: SEED_SENTINEL });
  return ctx;
}
async function clearModals(page) {
  for (let i = 0; i < 6; i++) {
    const claim = page.locator('#claim'), ok = page.locator('#mOk');
    if (await claim.count() && await claim.first().isVisible()) { await claim.first().click(); await page.waitForTimeout(300); continue; }
    if (await ok.count() && await ok.first().isVisible()) { await ok.first().click(); await page.waitForTimeout(300); continue; }
    break;
  }
}
async function load(page, base, entry) {
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page);
}
// 显式 persist 后刷新：验的是「保存后刷新」
async function reload(page) {
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page);
}
const diskSave = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, SAVE_KEY);
function costFree(before, after) {
  const coinDiff = after.coins - before.coins;
  return { ok: coinDiff === 0 && after.draws === before.draws && after.pity === before.pity && after.daily === before.daily, coinDiff };
}
const gamePeriod = (page) => page.evaluate(async () => {
  const h = new Date().getHours();
  const inline = h >= 19 || h < 5 ? 'night' : h >= 17 ? 'dusk' : h < 10 ? 'morning' : 'day';
  let ambience = null;
  if (location.pathname === '/' || location.pathname === '/index.html') {
    try { ambience = (await import('/home/home-ambience.mjs')).homePeriodAt(Date.now()).id; } catch { ambience = 'import-failed'; }
  }
  return { hour: h, inline, ambience };
});

async function generateSeed(browser, base) {
  const ctx = await browser.newContext(ctxOpts());
  const page = await ctx.newPage(); wireErrors(page, 'seed');
  await page.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await page.getByRole('button', { name: '开摊！', exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  const seed = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await ctx.close();
  check('seed: fresh save generated', !!seed[SAVE_KEY]);
  return seed;
}
function mkSeed(seed, mutate) {
  const save = JSON.parse(seed[SAVE_KEY]);
  for (const shop of save.shops) Object.assign(shop, { open: true, lv: 35, emp: 1 });
  save.coins = 1e12;
  save.cur = 0;
  save.lastSeen = save.maxSeen = Date.now();
  if (mutate) mutate(save);
  const out = { ...seed, [SAVE_KEY]: JSON.stringify(save) };
  delete out[TAB_LOCK_KEY];
  return out;
}


const fz = (page) => page.evaluate(() => { const e = window.__tzz.state.milestones?.events ?? {}; return Object.hasOwn(e, 'firstZombie') ? e.firstZombie : undefined; });
async function child(page) {
  await page.evaluate(() => window.__tzz.openZombie());
  await page.waitForFunction(() => document.querySelector('#zbFrame')?.contentWindow?.__zb?.proto?.ready, null, { timeout: 20000 });
  return page.frames().find((f) => f.url().includes('/zombie/'));
}
// ⑧a 打僵尸开局 → firstZombie
async function scenarioZombie(browser, base, seed) {
  const tag = '⑧a xt02-zombie root';
  const ctx = await newCtx(browser, mkSeed(seed));
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, '/');
    const m0 = await page.evaluate(() => window.__tzz.state.milestones);
    check(`${tag}: fresh ledger has no firstZombie`, m0 && !Object.hasOwn(m0.events, 'firstZombie'), J(m0));
    let f = await child(page);
    check(`${tag}: opening the zombie menu is not participation`, (await fz(page)) === undefined);
    check(`${tag}: locked endless start fails`, (await f.evaluate(() => window.__zb.start('endless'))) === false);
    check(`${tag}: failed start records nothing`, (await fz(page)) === undefined);
    await page.evaluate(() => window.__tzz.closeZombie());
    check(`${tag}: closing the menu records nothing`, (await fz(page)) === undefined);
    f = await child(page);
    await f.locator('#startBtn').click();
    await f.waitForFunction(() => window.__zb.G && !window.__zb.G.pendStart && window.__zb.G.t > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => Number.isSafeInteger(window.__tzz.state.milestones?.events?.firstZombie), null, { timeout: 10000 });
    const at = await fz(page);
    const r1 = await page.evaluate(() => ({ cleared: window.__tzz.state.zombie?.cleared ?? 0, firstShop: window.__tzz.state.milestones.events.firstShop }));
    check(`${tag}: real start (#startBtn) records firstZombie before any win`, Number.isSafeInteger(at) && r1.cleared === 0 && at >= r1.firstShop, J({ at, ...r1 }));
    await shot(page, 'zombie-started-root');
    await f.evaluate(() => { const g = window.__zb.G, p = g.p; p.hp = 1; p.inv = 0; p.fireCd = 999; g.zs.push({ x: p.x, y: p.y, r: 15, hp: 100000, sp: 0, kx: 0, ky: 0, slow: 0, flash: 0, wob: 0, dmg: 999, type: 'normal' }); window.__zb.step(0.01); });
    await f.waitForFunction(() => window.__zb.G.over && window.__zb.G.win === false, null, { timeout: 10000 });
    check(`${tag}: defeat keeps the first participation time`, (await fz(page)) === at);
    await f.evaluate(() => window.__zb.send({ zb: 'started', runId: window.__zb.G.runId, ceo: window.__zb.G.ceo }));
    await page.waitForTimeout(200);
    check(`${tag}: repeated started message never overwrites`, (await fz(page)) === at);
    await page.evaluate(() => window.__tzz.closeZombie());
    await reload(page);
    const d = await diskSave(page);
    check(`${tag}: [刷新保留] (保存后刷新) firstZombie identical in memory + disk, writable`, (await fz(page)) === at && d?.milestones?.events?.firstZombie === at && (await page.evaluate(() => window.__tzz.saveBlocked)) === false, J({ disk: d?.milestones?.events?.firstZombie, at }));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

async function main() {
  const { server, url: base } = await startServer();
  const launcher = ENGINE === 'chromium' ? chromium : webkit;
  const browser = await launcher.launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
  try {
    const seed = await generateSeed(browser, base);
    await scenarioZombie(browser, base, seed);
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('pet/game 副本没有打僵尸入口：firstZombie 只验 root（N/A，不计 PASS）',
    'firstTDWin（塔防通关回执）：下一轮补', 'iOS 真机 Safari / 后台冻结后恢复', '[刷新保留] 只验「显式 persist 后刷新」');
  const failed = checks.filter((c) => !c.ok);
  const ok = failed.length === 0 && errors.length === 0;
  const report = { ok, engine: ENGINE, viewport: VIEWPORT, counts: { checks: checks.length, failed: failed.length, jsErrors: errors.length }, checks, errors, notCovered };
  fs.writeFileSync(path.join(OUT, `report-142-${ENGINE}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, `report-142-${ENGINE}.txt`), [`测试-142 星途-02 子游戏回执 (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}`, '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []), '', 'NOT COVERED: ' + notCovered.join('; ')].join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
  process.exit(ok ? 0 : 1);
}
main();
