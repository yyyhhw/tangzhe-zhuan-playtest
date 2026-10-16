// 测试-142 — 星途-02 子游戏回执写 milestones 的 WebKit 补验（只测不改游戏代码），390×844。
// 第一部分（本提交）：打僵尸 firstZombie，只在 root（pet/game 副本没有打僵尸入口，记 N/A）。
//   ⑧a 新档：打开打僵尸菜单不算参与；锁着的无尽模式开局失败不记；关菜单不记；真点 #startBtn 开打 → 父页记
//       firstZombie（整数时间，≥ firstShop），此时 zombie.cleared 仍是 0（不需要赢）；输掉一局时间不变；
//       子页重复发 started 不覆盖；关掉打僵尸后保存再刷新，时间原样。照 tests/milestones/zombie-browser.py 的 Chromium 路径。
//   ⑧c 负例（r2，熊大 18:29）：firstZombie 为空时开第二个标签页 B（等不到写锁、无 __tzz）+ 打僵尸子页独立标签 C 点开打，都不记；
//       r3（熊大 19:17）：C 点击不吞异常，先断言 C 真开局（EMBED=false、G、!pendStart、t>0）再查 A；负控 C2 拿掉 #startBtn → 开局助手必须抛错。
//       正控：A 真点开打能记，A 内存 + 磁盘可见，B 关后磁盘仍是 A 的那一个时间。
//   ⑧d 负例（r2）：firstZombie 为空时，子页拦下本局 started，这局输掉并由父页结算后再原样补发 → 不记；正控：解除拦截重开一局能记，保存刷新保留。
//       负控证据：去掉父页三处 settled/live 守卫（started 守卫、live 检查、zombieStartReady）后本条 FAIL（27/28）。
// 第二部分：塔防通关 firstTDWin，只在 root（pet/game 副本没有塔防入口，记 N/A）。
//   ⑧b 新档：打开塔防菜单不记；真点 #startBtn 开第 1 关后输掉（end(false)）并保存成功也不记；关塔防不记；
//       再真点开局 → 合成胜利夹具（wave=W、清空敌人后 end(true)，同 td/test_speed_parent.mjs 的做法，不是自然平衡证据）
//       → 子页保存确认 saveOk 后父页记 firstTDWin（整数时间，≥ firstShop，tdCampaign.highestCleared=1）；
//       接着第 2 关再赢一次时间不变；关掉塔防后保存再刷新，内存和磁盘原样。
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
  try { await page.screenshot({ path: path.join(OUT, `142-${String(++shotN).padStart(2, '0')}-${ENGINE}-${name}.png`) }); } catch {}
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

// 独立打僵尸页（没有父页）真点开打：点击或等待失败都直接抛错，不吞；返回开局状态给调用方断言。
async function startStandaloneC(c, timeout = 10000) {
  await c.locator('#startBtn').click({ timeout });
  await c.waitForFunction(() => window.__zb && window.__zb.EMBED === false && window.__zb.G && !window.__zb.G.pendStart && window.__zb.G.t > 0, null, { timeout });
  return c.evaluate(() => ({ embed: window.__zb.EMBED, g: !!window.__zb.G, pend: !!window.__zb.G.pendStart, t: window.__zb.G.t }));
}

// ⑧c 负例 1（熊大 18:29）：第二个标签页不能首次记账。前置：firstZombie 为空。
//   同一浏览器上下文先开 A（拿到写锁），再开 B：B 等不到锁、不暴露 __tzz、不写盘；另开打僵尸子页 C 独立标签点开打（没有父页）也不记。
//   正控：随后在 A 真点开打，同一条观察链（A 内存 + 磁盘）能看到合法记账；B 关掉后磁盘仍只有 A 记的那一个时间。
async function scenarioZombieSecondTab(browser, base, seed) {
  const tag = '⑧c xt02-zombie 2nd-tab root';
  const ctx = await newCtx(browser, mkSeed(seed));
  const a = await ctx.newPage(); wireErrors(a, tag + ' A');
  try {
    await load(a, base, '/');
    const pre = await diskSave(a);
    check(`${tag}: precondition — firstZombie empty in A memory + disk`, (await fz(a)) === undefined && pre && !Object.hasOwn(pre.milestones?.events ?? {}, 'firstZombie'), J(pre?.milestones));
    const b = await ctx.newPage(); wireErrors(b, tag + ' B');
    await b.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'load' });
    await b.waitForTimeout(3000);
    const bState = await b.evaluate(() => ({ tzz: !!window.__tzz, owns: !!window.FormalCollectionRuntime?.ownsLock?.() }));
    check(`${tag}: 2nd tab B waits for the write lock (no __tzz, does not own lock)`, bState.tzz === false && bState.owns === false, J(bState));
    const c = await ctx.newPage(); wireErrors(c, tag + ' C');
    await c.goto(base.replace(/\/$/, '') + '/zombie/', { waitUntil: 'load' });
    // r3（熊大 19:17）：点击异常不吞，直接让本场景失败；先证明 C 真的以独立页开局，再查 A。
    const cs = await startStandaloneC(c);
    check(`${tag}: C really started standalone (__zb.EMBED=false, G exists, !pendStart, t>0)`, cs.embed === false && cs.g === true && !cs.pend && cs.t > 0, J(cs));
    await c.waitForTimeout(800);
    const d1 = await diskSave(a);
    check(`${tag}: B open + standalone zombie tab C start record nothing (A memory + disk)`, (await fz(a)) === undefined && !Object.hasOwn(d1?.milestones?.events ?? {}, 'firstZombie'), J(d1?.milestones?.events));
    await c.close();
    // 负控：故意让独立页 C2 起不来（拿掉 #startBtn）→ 同一个开局助手必须报错，不能因为 A 没被写就算过。
    const c2 = await ctx.newPage(); wireErrors(c2, tag + ' C2');
    await c2.goto(base.replace(/\/$/, '') + '/zombie/', { waitUntil: 'load' });
    await c2.evaluate(() => document.querySelector('#startBtn')?.remove());
    let c2err = null;
    try { await startStandaloneC(c2, 3000); } catch (e) { c2err = String(e && e.message || e).split('\n')[0]; }
    const c2st = await c2.evaluate(() => ({ g: !!window.__zb?.G }));
    check(`${tag}: negative control — C2 deliberately unable to start makes the start helper throw (not a silent pass)`, !!c2err && c2st.g === false, J({ c2err, ...c2st }));
    await c2.close();
    // 正控：A 真点开打 → 记账；同一观察链能看到
    const f = await child(a);
    await f.locator('#startBtn').click();
    await f.waitForFunction(() => window.__zb.G && !window.__zb.G.pendStart && window.__zb.G.t > 0, null, { timeout: 15000 });
    await a.waitForFunction(() => Number.isSafeInteger(window.__tzz.state.milestones?.events?.firstZombie), null, { timeout: 10000 });
    const at = await fz(a);
    await a.evaluate(() => window.__tzz.closeZombie());
    await a.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
    await a.waitForTimeout(300);
    const d2 = await diskSave(a);
    check(`${tag}: positive control — A real start records firstZombie, visible in A memory + disk`, Number.isSafeInteger(at) && d2?.milestones?.events?.firstZombie === at, J({ at, disk: d2?.milestones?.events?.firstZombie }));
    const bAfter = await b.evaluate(() => !!window.__tzz);
    await b.close();
    await a.waitForTimeout(300);
    const d3 = await diskSave(a);
    check(`${tag}: B never got the lock while A alive; disk keeps A's single time after B closes`, bAfter === false && d3?.milestones?.events?.firstZombie === at && (await fz(a)) === at, J({ bAfter, disk: d3?.milestones?.events?.firstZombie, at }));
    await shot(a, 'zombie-2nd-tab-root');
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑧d 负例 2（熊大 18:29）：firstZombie 为空时，已结束局收到迟到的 started 不能首次记账。
//   子页 MessagePort 上拦下本局 started（父页没收到 → 没记账），让这局输掉并由父页结算；之后把拦下的原消息原样补发 → 仍不记。
//   正控：拦截解除后重开一局，正常 started 记账，同一观察链（内存 + 磁盘）可见。
async function scenarioZombieLateStarted(browser, base, seed) {
  const tag = '⑧d xt02-zombie late-started root';
  const ctx = await newCtx(browser, mkSeed(seed));
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, '/');
    check(`${tag}: precondition — firstZombie empty`, (await fz(page)) === undefined);
    let f = await child(page);
    await f.evaluate(() => {
      const orig = MessagePort.prototype.postMessage;
      window.__origPost = orig; window.__held = null;
      MessagePort.prototype.postMessage = function (m, ...r) {
        if (m && m.zb === 'started' && !window.__held) { window.__held = { port: this, m: JSON.parse(JSON.stringify(m)) }; return; }
        return orig.call(this, m, ...r);
      };
    });
    await f.locator('#startBtn').click();
    await f.waitForFunction(() => window.__zb.G && !window.__zb.G.pendStart && !!window.__held, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const held = await f.evaluate(() => window.__held && window.__held.m);
    check(`${tag}: started intercepted in child → parent has not recorded`, held && held.zb === 'started' && (await fz(page)) === undefined, J(held));
    await f.evaluate(() => { const g = window.__zb.G, p = g.p; p.hp = 1; p.inv = 0; p.fireCd = 999; g.zs.push({ x: p.x, y: p.y, r: 15, hp: 100000, sp: 0, kx: 0, ky: 0, slow: 0, flash: 0, wob: 0, dmg: 999, type: 'normal' }); window.__zb.step(0.01); });
    await f.waitForFunction(() => window.__zb.G.over && window.__zb.G.win === false && !window.__zb.G.wait, null, { timeout: 10000 });
    const run = await page.evaluate(() => { const r = window.__tzz.zbRun; return r && { settled: r.settled, started: !!r.started }; });
    check(`${tag}: run ended and parent settled it, still no firstZombie`, run && run.settled === true && run.started === false && (await fz(page)) === undefined, J(run));
    await f.evaluate(() => window.__origPost.call(window.__held.port, window.__held.m));
    await page.waitForTimeout(400);
    const d1 = await diskSave(page);
    check(`${tag}: late started after the run ended records nothing (memory + disk)`, (await fz(page)) === undefined && !Object.hasOwn(d1?.milestones?.events ?? {}, 'firstZombie'), J({ mem: await fz(page), disk: d1?.milestones?.events }));
    // 正控
    await f.evaluate(() => { MessagePort.prototype.postMessage = window.__origPost; });
    await page.evaluate(() => window.__tzz.closeZombie());
    f = await child(page);
    await f.locator('#startBtn').click();
    await f.waitForFunction(() => window.__zb.G && !window.__zb.G.pendStart && window.__zb.G.t > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => Number.isSafeInteger(window.__tzz.state.milestones?.events?.firstZombie), null, { timeout: 10000 });
    const at = await fz(page);
    await page.evaluate(() => window.__tzz.closeZombie());
    await reload(page);
    const d2 = await diskSave(page);
    check(`${tag}: positive control — a normal start then records firstZombie, kept after save+refresh`, Number.isSafeInteger(at) && (await fz(page)) === at && d2?.milestones?.events?.firstZombie === at, J({ at, disk: d2?.milestones?.events?.firstZombie }));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

const ftd = (page) => page.evaluate(() => { const e = window.__tzz.state.milestones?.events ?? {}; return Object.hasOwn(e, 'firstTDWin') ? e.firstTDWin : undefined; });
async function tdChild(page) {
  await page.evaluate(() => window.__tzz.openTD());
  await page.waitForFunction(() => document.querySelector('#tdFrame')?.contentWindow?.__td?.proto?.ready, null, { timeout: 20000 });
  return page.frames().find((f) => f.url().includes('/td/'));
}
// 合成结局夹具：把当前关打到最后一波、清空敌人，再按游戏自己的 end() 结算；等子页拿到父页保存确认
async function tdFinish(f, win) {
  await f.evaluate((win) => { const G = window.__td.G; G.wave = G.W; G.completedWave = win ? G.W : Math.max(0, G.W - 1); G.es = []; G.q = []; window.__td.end(win); }, win);
  await f.waitForFunction(() => window.__td.G.over && !window.__td.G.wait, null, { timeout: 10000 });
  return f.evaluate(() => ({ saveOk: window.__td.G.saveOk, why: window.__td.G.why || '', n: window.__td.G.n, win: window.__td.G.win }));
}
async function tdStart(f) {
  await f.locator('#startBtn').click();
  await f.waitForFunction(() => window.__td.G && !window.__td.G.pendStart, null, { timeout: 15000 });
}
// ⑧b 塔防第一次通关 → firstTDWin
async function scenarioTD(browser, base, seed) {
  const tag = '⑧b xt02-td root';
  const ctx = await newCtx(browser, mkSeed(seed));
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, '/');
    const m0 = await page.evaluate(() => ({ ev: window.__tzz.state.milestones?.events, hc: window.__tzz.state.tdCampaign?.highestCleared ?? 0, td: window.__tzz.state.td?.cleared ?? 0 }));
    check(`${tag}: fresh ledger has no firstTDWin, nothing cleared`, m0.ev && !Object.hasOwn(m0.ev, 'firstTDWin') && m0.hc === 0 && m0.td === 0, J(m0));
    let f = await tdChild(page);
    check(`${tag}: opening the TD menu records nothing`, (await ftd(page)) === undefined);
    await tdStart(f);
    check(`${tag}: real start (#startBtn) alone records nothing`, (await ftd(page)) === undefined);
    const lose = await tdFinish(f, false);
    check(`${tag}: a saved defeat records nothing`, lose.saveOk === true && lose.win === false && (await ftd(page)) === undefined, J(lose));
    await page.evaluate(() => window.__tzz.closeTD());
    check(`${tag}: closing TD records nothing`, (await ftd(page)) === undefined);
    f = await tdChild(page);
    await tdStart(f);
    const win = await tdFinish(f, true);
    await page.waitForFunction(() => Number.isSafeInteger(window.__tzz.state.milestones?.events?.firstTDWin), null, { timeout: 10000 }).catch(() => {});
    const at = await ftd(page);
    const r1 = await page.evaluate(() => ({ hc: window.__tzz.state.tdCampaign?.highestCleared, firstShop: window.__tzz.state.milestones.events.firstShop }));
    check(`${tag}: first saved win (synthetic victory fixture via end(true)) records firstTDWin`, win.saveOk === true && win.n === 1 && Number.isSafeInteger(at) && at >= r1.firstShop && r1.hc === 1, J({ win, at, ...r1 }));
    await shot(page, 'td-first-win-root');
    // 第 2 关再赢一次：时间不变
    await f.locator('#againBtn').click();
    await f.waitForFunction(() => window.__td.G && !window.__td.G.pendStart && window.__td.G.n === 2, null, { timeout: 15000 });
    const win2 = await tdFinish(f, true);
    const hc2 = await page.evaluate(() => window.__tzz.state.tdCampaign?.highestCleared);
    check(`${tag}: a later win (stage 2) never overwrites firstTDWin`, win2.saveOk === true && win2.n === 2 && hc2 === 2 && (await ftd(page)) === at, J({ win2, hc2, at }));
    await page.evaluate(() => window.__tzz.closeTD());
    await reload(page);
    const d = await diskSave(page);
    check(`${tag}: [刷新保留] (保存后刷新) firstTDWin identical in memory + disk, writable`, (await ftd(page)) === at && d?.milestones?.events?.firstTDWin === at && (await page.evaluate(() => window.__tzz.saveBlocked)) === false, J({ disk: d?.milestones?.events?.firstTDWin, at }));
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
    await scenarioZombieSecondTab(browser, base, seed);
    await scenarioZombieLateStarted(browser, base, seed);
    await scenarioTD(browser, base, seed);
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('pet/game 副本没有打僵尸入口：firstZombie 只验 root（N/A，不计 PASS）',
    'pet/game 副本没有塔防入口：firstTDWin 只验 root（N/A，不计 PASS）', '塔防胜负用合成结局夹具（end(true/false)，同 td/test_speed_parent.mjs），不是自然打通关；开局、子页→父页保存回执、milestones 记账都是真实路径', 'iOS 真机 Safari / 后台冻结后恢复', '[刷新保留] 只验「显式 persist 后刷新」');
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
