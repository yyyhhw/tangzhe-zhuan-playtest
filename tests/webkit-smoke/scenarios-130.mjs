// 测试-130 ①–④ — WebKit (default) / Chromium 补验场景，root + pet，390×844。
//
// ① 老档迁移：没有 space 字段的旧档、月面已往返 10 次的 v1 旧档（76 探索点 / 3 张卡 / 回执），
//    打开后不进只读/保护、星途能开、数据原样，刷新后还在。
// ② 科研固定价：研究台 tech 1 级成果 = TIER_PRICE[0] = 9,000,090；同一按钮同步连点 3 下只扣一次；
//    2 级（科研只有 1 级）按钮禁用、直接 perform 也被拒、不扣钱；刷新后 items 保留。
// ③ 跨标签：同一浏览器上下文开两个页面，第二个被「同一作用域只能一个页面经营」拦下、星途打不开；
//    在第一个页面买 tech:1，落盘只扣一次。B 页在任何脚本之前装写调用观测器（包 Storage setItem/removeItem/clear，
//    保留原生调用），分「启动」「显式 perform/persist 尝试」两段断言对受保护存档键写 0 次；接口存在时核对拒绝结果；
//    正控：A 买东西的写盘能被看到、B 同值写回主档被记 1 次且字节不变。
// ④ 外星倍率：册子 0 / 1（火星第 3 张）/ 7 张（6 航线第 3 张 + 回信）→ 产速 ×1 / ×1.25 / ×2.75；
//    旧字段 alienCards 再大也不算数；离线待领按同一倍率（computeOffline 比值）。
// 只测不改游戏代码。iOS 后台冻结标签恢复（lockfix 接管）macOS WebKit 测不到，单列未验。
//
// 金币断言：扣费在页面里同一段同步 JS 内读前值 → 点击 → 读后值，中间不会跑收入 tick，
// 所以扣费按精确相等比；另外每个场景把「事后再读一次」的余额相对期望值的漂移打印进报告。
//
// Usage: node scenarios-130.mjs                 (WebKit)
//        BROWSER=chromium [CHROMIUM_PATH=...] node scenarios-130.mjs
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

// 受保护存档键（collection/host-save.mjs:6 KEYS，除 tab 锁外全部）：主档、备份、原档存证、源档及其备份、v15 原档。
const PROTECTED_KEYS = ['tangzhe-formal-collection-v1-save', 'tangzhe-formal-collection-v1-save-bak', 'tangzhe-formal-collection-v1-original',
  'tangzhe-save', 'tangzhe-save-bak', 'tangzhe-upgrade-v15-original'];
const TIER1 = 9000090;                 // TIER_PRICE[0] = round(1e11 * 1 / 11111)
const RICH = 1e12;
const READY = 'window.__tzz && window.XingTu';
const checks = [], errors = [], drifts = [];
let shotN = 0;

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 500) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function drift(name, expected, actual) {
  const d = actual - expected;
  drifts.push({ name, expected, actual, drift: d });
  console.log(`DRIFT ${name}: expected=${expected} actual=${actual} drift=${d}`);
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
  const file = path.join(OUT, `130-${String(++shotN).padStart(2, '0')}-${ENGINE}-${name}.png`);
  try { await page.screenshot({ path: file, fullPage: false }); } catch {}
}
const tagOf = (entry) => entry === '/' ? 'root' : 'pet';
const ctxOpts = { viewport: VIEWPORT, isMobile: ENGINE !== 'firefox', hasTouch: true, timezoneId: 'Asia/Tokyo' };

async function newCtx(browser, seed) {
  const ctx = await browser.newContext(ctxOpts);
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
// 写调用观测器：在页面任何脚本之前包住 Storage.prototype.setItem/removeItem/clear，保留原生调用（只记录不拦截）。
// 每次调用都记 {op, key, phase, same}——同值写入也算一次，所以「写了但值没变」漏不掉。phase 由测试切换。
async function installWriteObserver(page) {
  await page.addInitScript(() => {
    if (window.__wlog) return;
    const log = []; window.__wlog = log; window.__wphase = 'boot';
    const P = Storage.prototype, set = P.setItem, rem = P.removeItem, clr = P.clear;
    P.setItem = function (k, v) { let same = false; try { same = this.getItem(k) === String(v); } catch {} log.push({ op: 'setItem', key: String(k), phase: window.__wphase, same }); return set.call(this, k, v); };
    P.removeItem = function (k) { log.push({ op: 'removeItem', key: String(k), phase: window.__wphase }); return rem.call(this, k); };
    P.clear = function () { log.push({ op: 'clear', key: '*', phase: window.__wphase }); return clr.call(this); };
  });
}
const writesOf = (page) => page.evaluate(() => window.__wlog ? window.__wlog.slice() : null);
const protectedWrites = (log, phase) => (log || []).filter((w) => (w.key === '*' || PROTECTED_KEYS.includes(w.key)) && (!phase || w.phase === phase));

async function load(page, base, entry, { wait = true } = {}) {
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  if (!wait) return;
  await page.waitForFunction(READY, null, { timeout: 30000 });
  const claim = page.locator('#claim');
  if (await claim.count() && await claim.first().isVisible()) await claim.first().click();
}
const blocked = (page) => page.evaluate(() => ({ saveBlocked: window.__tzz.saveBlocked, src: window.__tzz.loadInfo?.source, bad: window.__tzz.loadInfo?.bad }));
const protectText = (page) => page.evaluate(() => /只读|保护|未读取或写入存档/.test(document.body.innerText));
const diskSave = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, SAVE_KEY);

async function generateSeed(browser, base) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage(); wireErrors(page, 'seed');
  await load(page, base, '/');
  await page.getByRole('button', { name: '开摊！', exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  const seed = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const def = await page.evaluate(async () => (await import('/space/domain.mjs')).defaultSpace());
  await ctx.close();
  check('seed: fresh save generated', !!seed[SAVE_KEY]);
  return { seed, def };
}
// space: undefined → delete the field (pre-星途 save); object → use as is.
function mkSeed(seed, { space, coins = RICH, mutate } = {}) {
  const save = JSON.parse(seed[SAVE_KEY]);
  delete save.milestones;
  for (const shop of save.shops) Object.assign(shop, { open: true, lv: 35, emp: 1 });
  if (space === undefined) delete save.space; else save.space = JSON.parse(JSON.stringify(space));
  save.coins = coins;
  save.lastSeen = save.maxSeen = Date.now();
  if (mutate) mutate(save);
  const out = { ...seed, [SAVE_KEY]: JSON.stringify(save) };
  delete out[TAB_LOCK_KEY];
  return out;
}
function moon10Space(def) {
  const now = Date.now(), start = now - 2 * 3600e3, arrival = start + 600000, claimedAt = arrival + 1000;
  const voyageId = 'moon:formal:10:0a1b2c3d-4e5f-4a6b-8c7d-0123456789ab';
  const ruleset = 'xingtu-moon-10min-8pts-v1';
  return { ...JSON.parse(JSON.stringify(def)), pts: 76, cards: { moon: 3 }, visits: { moon: 10 },
    voyage: { route: 'moon', start, dur: 600000, ev: null, voyageId, sequence: 10, ruleset, completed: true },
    moonLoop: { schemaVersion: 1, sequence: 10, claimed: 10,
      lastReceipt: { voyageId, sequence: 10, route: 'moon', ruleset, start, arrival, claimedAt, points: 8 } } };
}

// ① 老档迁移
async function scenarioMigration(browser, base, entry, seed, def) {
  for (const kind of ['nospace', 'moon10']) {
    const tag = `①migrate-${kind} ${tagOf(entry)}`;
    const ctx = await newCtx(browser, mkSeed(seed, { space: kind === 'nospace' ? undefined : moon10Space(def) }));
    const page = await ctx.newPage(); wireErrors(page, tag);
    try {
      await load(page, base, entry);
      const b = await blocked(page);
      check(`${tag}: not read-only/protected on load`, b.saveBlocked === false && !(await protectText(page)), JSON.stringify(b));
      const opened = await page.evaluate(() => window.XingTu.open());
      check(`${tag}: XingTu.open() ok`, opened && opened.ok, JSON.stringify(opened));
      const v = await page.evaluate(() => { const v = window.XingTu.view(); return { ok: v.ok, code: v.code, phase: v.phase, sp: v.space, ledger: v.ledger }; });
      if (kind === 'nospace') {
        check(`${tag}: view ok, defaults (pts 0, no voyage)`, v.ok && v.sp && v.sp.pts === 0 && v.sp.voyage === null && v.phase === 'ready', JSON.stringify({ ok: v.ok, code: v.code, phase: v.phase }));
      } else {
        check(`${tag}: view ok, 76 pts / moon visits 10 / 3 cards / ledger claimed 10`,
          v.ok && v.sp.pts === 76 && v.sp.visits.moon === 10 && v.sp.cards.moon === 3 && v.ledger?.claimed === 10 && v.phase === 'report',
          JSON.stringify({ ok: v.ok, code: v.code, phase: v.phase, pts: v.sp?.pts, visits: v.sp?.visits, cards: v.sp?.cards, claimed: v.ledger?.claimed }));
      }
      await shot(page, `migrate-${kind}-${tagOf(entry)}`);
      await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
      // 等宠物素材 manifest 等请求落定再刷新：WebKit 会把刷新时被中断的 fetch 报成 pageerror（CI run 3 见 11 条），那是测试时序不是游戏错误。
      try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(READY, null, { timeout: 30000 });
      const b2 = await blocked(page);
      const d = await diskSave(page);
      const v2 = await page.evaluate(() => { const v = window.XingTu.view(); return { ok: v.ok, sp: v.space, claimed: v.ledger?.claimed }; });
      const same = kind === 'nospace' ? v2.ok && v2.sp.pts === 0 : v2.ok && v2.sp.pts === 76 && v2.sp.visits.moon === 10 && v2.sp.cards.moon === 3 && v2.claimed === 10;
      check(`${tag}: refresh keeps data, still writable`, same && b2.saveBlocked === false, JSON.stringify({ blocked: b2, pts: v2.sp?.pts, claimed: v2.claimed }));
      const dsp = d && d.space;
      check(`${tag}: disk save consistent after refresh`, kind === 'nospace' ? (!dsp || dsp.pts === 0) : (dsp && dsp.pts === 76 && dsp.moonLoop?.claimed === 10 && dsp.visits?.moon === 10),
        JSON.stringify({ hasSpace: !!dsp, pts: dsp?.pts }));
    } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
  }
}

// ② 科研固定价连点只扣一次
async function scenarioResearch(browser, base, entry, seed, def) {
  const tag = `②research ${tagOf(entry)}`;
  const ctx = await newCtx(browser, mkSeed(seed, { space: def }));
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const opened = await page.evaluate(() => window.XingTu.open());
    check(`${tag}: XingTu.open() ok`, opened && opened.ok, JSON.stringify(opened));
    await page.locator('#xingtuTabShip').click();
    await page.waitForSelector('#xingtuBuy-tech-1', { timeout: 15000 });
    const label = (await page.locator('#xingtuBuy-tech-1').innerText()).trim();
    check(`${tag}: tier-1 button shows fixed price 900.01 万-ish`, /900/.test(label), label);
    check(`${tag}: tier-2 disabled at research Lv1`, await page.locator('#xingtuBuy-tech-2').isDisabled());
    await shot(page, `research-before-${tagOf(entry)}`);
    const r = await page.evaluate(() => {
      const el = document.getElementById('xingtuBuy-tech-1');
      const before = window.__tzz.state.coins;
      el.click(); el.click(); el.click();            // 同步连点 3 下（第 1 下后按钮重绘，旧节点仍挂着回调）
      const again = document.getElementById('xingtuBuy-tech-1'); if (again && again !== el) again.click();
      const after = window.__tzz.state.coins;
      return { before, after, item: window.__tzz.state.space.items['tech:1'] };
    });
    check(`${tag}: 4 rapid clicks deduct exactly once (Δ == 9,000,090)`, r.before - r.after === TIER1 && r.item === 1,
      `before=${r.before} after=${r.after} delta=${r.before - r.after}`);
    const lv = await page.evaluate(() => {
      const before = window.__tzz.state.coins;
      const res = window.XingTu.perform({ type: 'research', sys: 'tech', tier: 2 });
      return { res, delta: before - window.__tzz.state.coins, item: window.__tzz.state.space.items['tech:2'] };
    });
    check(`${tag}: tier-2 perform refused (LV_REQUIRED), nothing deducted`, !lv.res.ok && /LV_REQUIRED/.test(lv.res.code) && lv.delta === 0 && !lv.item, JSON.stringify(lv));
    await shot(page, `research-after-${tagOf(entry)}`);
    try { await page.waitForLoadState("networkidle", { timeout: 10000 }); } catch {}
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(READY, null, { timeout: 30000 });
    const p = await page.evaluate(() => ({ coins: window.__tzz.state.coins, items: window.__tzz.state.space.items }));
    check(`${tag}: refresh keeps tech:1 only`, JSON.stringify(p.items) === '{"tech:1":1}', JSON.stringify(p.items));
    // 期望 = RICH − 1 次价格 + 这几秒的挂机收入（≥0，远小于半个价格）；扣两次会低于期望整整一个价格。
    const dr = p.coins - (RICH - TIER1);
    check(`${tag}: refresh balance = RICH − 1×price + idle income (0 ≤ drift < 0.5×price)`, dr >= 0 && dr < 0.5 * TIER1, `coins=${p.coins} drift=${dr}`);
    drift(`${tag} balance after refresh vs RICH−price`, RICH - TIER1, p.coins);
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ③ 跨标签
async function scenarioCrossTab(browser, base, entry, seed, def) {
  const tag = `③crosstab ${tagOf(entry)}`;
  const ctx = await newCtx(browser, mkSeed(seed, { space: def }));
  const a = await ctx.newPage(); wireErrors(a, tag + ' A');
  const b = await ctx.newPage(); wireErrors(b, tag + ' B');
  await installWriteObserver(a);
  await installWriteObserver(b);           // B 的观测器在 B 任何脚本之前装好，B 启动期的写调用全部记录
  try {
    await load(a, base, entry);
    await load(b, base, entry, { wait: false });
    await b.waitForTimeout(2500);
    const bText = await b.evaluate(() => document.body.innerText);
    const bState = await b.evaluate(() => ({ hasTzz: !!window.__tzz, blocked: window.__tzz ? window.__tzz.saveBlocked : null, hasXingTu: !!window.XingTu, hasPersist: !!(window.__tzz && window.__tzz.persist) }));
    check(`${tag}: 2nd tab blocked ("同一作用域只能一个页面经营")`, /同一作用域只能一个页面经营/.test(bText) || bState.blocked === true, JSON.stringify({ ...bState, text: bText.slice(0, 120) }));
    // 阶段 1：B 启动（goto → 被拦 → 静置 2.5s）期间，对受保护键的写调用必须为 0。
    const bootLog = await writesOf(b);
    check(`${tag}: B write observer installed`, Array.isArray(bootLog), JSON.stringify(bootLog));
    const bootW = protectedWrites(bootLog, 'boot');
    check(`${tag}: B boot phase — 0 writes to protected save keys`, Array.isArray(bootLog) && bootW.length === 0, JSON.stringify({ protectedWrites: bootW, allWrites: bootLog }));
    const bOpen = await b.evaluate(() => window.XingTu ? window.XingTu.open() : { ok: false, code: 'NO_XINGTU' });
    check(`${tag}: 2nd tab cannot open 星途`, !bOpen.ok, JSON.stringify(bOpen));
    await shot(b, `crosstab-B-${tagOf(entry)}`);
    const diskBefore = await diskSave(a);
    const rawBefore = await a.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
    const opened = await a.evaluate(() => window.XingTu.open());
    check(`${tag}: 1st tab opens 星途`, opened && opened.ok, JSON.stringify(opened));
    await a.locator('#xingtuTabShip').click();
    await a.waitForSelector('#xingtuBuy-tech-1', { timeout: 15000 });
    await a.evaluate(() => { window.__wphase = 'buy'; });
    const r = await a.evaluate(() => {
      const el = document.getElementById('xingtuBuy-tech-1'); const before = window.__tzz.state.coins;
      el.click(); el.click(); return { before, after: window.__tzz.state.coins };
    });
    check(`${tag}: 1st tab buy deducts once`, r.before - r.after === TIER1, `delta=${r.before - r.after}`);
    // 正控 1：A 买东西的落盘能被观测器看到（主档至少写一次），证明观测器对真实写盘有效。
    const aBuyW = protectedWrites(await writesOf(a), 'buy');
    check(`${tag}: positive control — A's buy is observed writing the main save`, aBuyW.some((w) => w.op === 'setItem' && w.key === SAVE_KEY), JSON.stringify(aBuyW));
    // 阶段 2：B 显式尝试 perform / persist（接口存在才调），写调用必须为 0；接口存在时核对拒绝结果。
    await b.evaluate(() => { window.__wphase = 'try'; });
    const bTry = await b.evaluate(() => { const out = { hasXingTu: !!window.XingTu, hasPersist: !!(window.__tzz && window.__tzz.persist) };
      try { out.perform = window.XingTu ? window.XingTu.perform({ type: 'research', sys: 'war', tier: 1 }) : null; } catch (e) { out.err = String(e); }
      try { out.persist = out.hasPersist ? window.__tzz.persist() : null; } catch (e) { out.perr = String(e); } return out; });
    await b.waitForTimeout(500);
    const tryW = protectedWrites(await writesOf(b), 'try');
    check(`${tag}: B explicit perform/persist phase — 0 writes to protected save keys`, tryW.length === 0, JSON.stringify({ protectedWrites: tryW, bTry }));
    check(`${tag}: B perform refused when XingTu exists`, !bTry.hasXingTu || (bTry.perform && bTry.perform.ok === false), JSON.stringify(bTry.perform ?? 'XingTu absent on B (not applicable)'));
    check(`${tag}: B persist() returns false when exposed`, !bTry.hasPersist || bTry.persist === false, JSON.stringify(bTry.hasPersist ? bTry.persist : '__tzz.persist absent on B (not applicable)'));
    await a.waitForTimeout(1500);
    const d = await diskSave(a);
    check(`${tag}: disk has tech:1, not war:1 (B never wrote)`, d?.space?.items?.['tech:1'] === 1 && !d?.space?.items?.['war:1'], JSON.stringify({ items: d?.space?.items, bTry }));
    // 落盘余额 = 买前落盘 − 1 次价格 + 两次落盘之间的挂机收入（≥0，远小于半个价格）。
    const dd = (d?.coins ?? NaN) - ((diskBefore?.coins ?? NaN) - TIER1);
    check(`${tag}: disk deducted exactly once (0 ≤ drift < 0.5×price)`, dd >= 0 && dd < 0.5 * TIER1,
      `before=${diskBefore?.coins} after=${d?.coins} drift=${dd}`);
    drift(`${tag} disk balance vs (diskBefore − price)`, (diskBefore?.coins ?? 0) - TIER1, d?.coins ?? 0);
    // 正控 2：在 B 里对主档做一次「同值写入」（读出来原样写回，盘上内容不变），观测器必须记到 1 次 same=true，
    // 证明「写了但值没变」不会漏；做完核对盘上主档字节未变。放在所有断言之后，不影响上面的结论。
    await b.evaluate(() => { window.__wphase = 'control'; });
    const rawMid = await a.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
    await b.evaluate((k) => { localStorage.setItem(k, localStorage.getItem(k)); }, SAVE_KEY);
    const ctlW = protectedWrites(await writesOf(b), 'control');
    const rawAfterCtl = await a.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
    check(`${tag}: positive control — same-value write in B is counted (1 write, same=true, bytes unchanged)`,
      ctlW.length === 1 && ctlW[0].key === SAVE_KEY && ctlW[0].same === true && rawAfterCtl === rawMid, JSON.stringify({ ctlW, bytesUnchanged: rawAfterCtl === rawMid }));
    check(`${tag}: main save bytes changed by A's buy (sanity)`, rawBefore !== rawMid);
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ④ 外星倍率
async function scenarioAlien(browser, base, entry, seed, def) {
  const tag = `④alien ${tagOf(entry)}`;
  const all7 = { mars: 3, venus: 3, belt: 3, pirate: 3, europa: 3, saturn: 3, signal: 1 };
  const cases = [
    { name: '0', cards: {}, alienCards: 0, mult: 1 },
    { name: 'legacy-alienCards-5-only', cards: {}, alienCards: 5, mult: 1 },
    { name: '1-mars3', cards: { mars: 3 }, alienCards: 1, mult: 1.25 },
    { name: 'mars2-not-yet', cards: { mars: 2 }, alienCards: 0, mult: 1 },
    { name: '7-all', cards: all7, alienCards: 7, mult: 2.75 },
  ];
  let base0 = null, off0 = null;
  for (const c of cases) {
    const t = `${tag} [${c.name}]`;
    const space = { ...JSON.parse(JSON.stringify(def)), cards: c.cards, alienCards: c.alienCards };
    const ctx = await newCtx(browser, mkSeed(seed, { space }));
    const page = await ctx.newPage(); wireErrors(page, t);
    try {
      await load(page, base, entry);
      const r = await page.evaluate(() => {
        const st = window.__tzz.state, E = window.__tzz.E, now = Date.now();
        const off = E.computeOffline ? E.computeOffline({ ...E.cloneState(st), lastSeen: now - 7200e3, maxSeen: now - 7200e3, pending: null }, now) : null;
        return { mult: E.alienMult(st), count: E.alienCount(st), rate: E.baseRate(st), off: off && off.amount, blocked: window.__tzz.saveBlocked, view: window.XingTu.view().ok };
      });
      if (c.name === '0') { base0 = r.rate; off0 = r.off; }
      const ratio = base0 ? r.rate / base0 : NaN;
      check(`${t}: alienMult == ×${c.mult}`, Math.abs(r.mult - c.mult) < 1e-12 && r.view && r.blocked === false, JSON.stringify(r));
      check(`${t}: online rate ratio == ×${c.mult}`, Math.abs(ratio - c.mult) < 1e-9, `rate=${r.rate} base=${base0} ratio=${ratio}`);
      if (r.off !== null && off0) {
        const oratio = r.off / off0;
        check(`${t}: offline (2h) ratio == ×${c.mult}`, Math.abs(oratio - c.mult) < 1e-9, `off=${r.off} base=${off0} ratio=${oratio}`);
      } else check(`${t}: offline calc available`, false, 'E.computeOffline missing');
      if (c.name === '7-all') await shot(page, `alien7-${tagOf(entry)}`);
    } catch (e) { check(`${t}: ran`, false, e.stack || e); } finally { await ctx.close(); }
  }
}

async function main() {
  const { server, url: base } = await startServer();
  const launcher = ENGINE === 'chromium' ? chromium : webkit;
  const browser = await launcher.launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
  try {
    const { seed, def } = await generateSeed(browser, base);
    for (const entry of ENTRY_POINTS) {
      await scenarioMigration(browser, base, entry, seed, def);
      await scenarioResearch(browser, base, entry, seed, def);
      await scenarioCrossTab(browser, base, entry, seed, def);
      await scenarioAlien(browser, base, entry, seed, def);
    }
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  const failed = checks.filter((c) => !c.ok);
  const ok = failed.length === 0 && errors.length === 0;
  const report = { ok, engine: ENGINE, viewport: VIEWPORT, entryPoints: ENTRY_POINTS, counts: { checks: checks.length, failed: failed.length, jsErrors: errors.length }, checks, drifts, errors,
    notCovered: ['iOS 后台冻结标签恢复（lockfix 接管）：macOS WebKit 无法模拟，单列未验'] };
  fs.writeFileSync(path.join(OUT, `report-130-${ENGINE}.json`), JSON.stringify(report, null, 2));
  const lines = [`测试-130 ①–④ (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}`, '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`), '', 'DRIFT:',
    ...drifts.map((d) => `  ${d.name}: expected=${d.expected} actual=${d.actual} drift=${d.drift}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []), '', 'NOT COVERED: ' + report.notCovered.join('; ')];
  fs.writeFileSync(path.join(OUT, `report-130-${ENGINE}.txt`), lines.join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
  process.exit(ok ? 0 : 1);
}
main();
