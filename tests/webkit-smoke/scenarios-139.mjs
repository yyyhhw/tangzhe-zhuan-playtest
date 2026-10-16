// 测试-139 — 养成-38（d5171c7）与星途-02（1f50543）的 WebKit（默认）/ Chromium 补验，root + pet，390×844。
// 只测不改游戏代码。每项按「旧档进入不报错 / 刷新保留 / 新字段默认值」三类记 PASS/FAIL。
//
// 养成-38 故事卡获得路径（k_3/k_4/k_8 改条件卡，不进盲盒池；条件达成直接入库，不扣币、不计抽数、不动保底）：
//   ⑤a 老档（已从盲盒抽到 k_3，四店都有员工，无 milestones）夜里进入：可写、不进保护；k_3 保留；三张条件卡都不在盲盒池；
//       图鉴对未拥有的 2 张条件卡显示「提示：」；盲盒页有条件卡说明；夜里进家 → 入库 k_4（收摊月亮）+ k_8（一条街的灯），
//       抽数 / 保底 / 每日次数不变、金币不减；刷新后三张都在且不重复、磁盘一致、仍可写。
//   ⑤b 新字段默认值：养成-38 没有新增存档字段（只用 gacha.owned，源码 economy.js / app.js 已核），这里验「默认不给」：
//       新档白天进家不发任何条件卡、刷新后仍没有。
// 星途-02 milestones（可选顶层字段 {schemaVersion:1, events:{ID: ms|null}}）：
//   ⑥a 新字段默认值：新档开摊 → milestones 只有 firstShop = created；真点「雇佣」→ firstEmployee 记时间；刷新与 root↔pet 跨入口原样保留。
//   ⑥b 老档（无 milestones，space.ended）进入：可写，读档不写时间（没有任何数字时间）；真点「买下地球」→ earth 记时间、
//       firstShop 记 null（不编日期）、没证据的打僵尸不出现、「记录开始之前」「从有记录起」文案、390 不横向溢出；刷新后完全一致。
//   ⑥c 坏字段：milestones.schemaVersion = 2 → 进保护（saveBlocked 或保护提示），原档字节不被改写。
// 时段：页面时区按「现在」挑一个本地 22 点（夜）/ 13 点（白天）的 Etc/GMT±N，不装假时钟，游戏循环照常跑。
// 没法在 macOS WebKit 验的：iOS 真机 Safari、后台冻结恢复（单列未验）。
//
// Usage: node scenarios-139.mjs                 (WebKit)
//        BROWSER=chromium [CHROMIUM_PATH=...] node scenarios-139.mjs
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
const COND = ['k_3', 'k_4', 'k_8'];
const checks = [], errors = [], notCovered = [];
let shotN = 0;

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 500) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const isResourceNoise = (t) => /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon/i.test(t);
function wireErrors(page, label, { expectProtect = false } = {}) {
  page.on('pageerror', (e) => { errors.push({ label, kind: 'pageerror', text: String(e) }); console.log(`PAGEERROR [${label}] ${e}`); });
  page.on('console', (m) => {
    if (m.type() !== 'error' || isResourceNoise(m.text())) return;
    // ⑥c 故意喂坏字段：保护路径打的 console.error 是预期内的，只记不算错
    if (expectProtect) { console.log(`(expected) CONSOLE.ERROR [${label}] ${m.text()}`); return; }
    errors.push({ label, kind: 'console.error', text: m.text() }); console.log(`CONSOLE.ERROR [${label}] ${m.text()}`);
  });
}
async function shot(page, name) {
  const file = path.join(OUT, `139-${String(++shotN).padStart(2, '0')}-${ENGINE}-${name}.png`);
  try { await page.screenshot({ path: file, fullPage: false }); } catch {}
}
const tagOf = (entry) => entry === '/' ? 'root' : 'pet';
// 选一个本地时间为 hour 点的固定偏移时区（Etc/GMT-N = UTC+N）。
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
async function reload(page) {
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  // 等素材请求落定再刷新：WebKit 会把刷新中断的 fetch 报成 pageerror（测试-130 run 3），那是时序不是游戏错误。
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page);
}
const blocked = (page) => page.evaluate(() => ({ saveBlocked: window.__tzz.saveBlocked, src: window.__tzz.loadInfo?.source, bad: window.__tzz.loadInfo?.bad }));
const protectText = (page) => page.evaluate(() => /只读|保护|未读取或写入存档/.test(document.body.innerText));
const diskSave = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, SAVE_KEY);
const J = (v) => JSON.stringify(v);

async function generateSeed(browser, base) {
  const ctx = await browser.newContext(ctxOpts());
  const page = await ctx.newPage(); wireErrors(page, 'seed');
  await page.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await page.getByRole('button', { name: '开摊！', exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  const seed = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const def = await page.evaluate(async () => (await import('/space/domain.mjs')).defaultSpace());
  await ctx.close();
  check('seed: fresh save generated', !!seed[SAVE_KEY]);
  return { seed, def };
}
// 老档：删 milestones（星途-02 之前没有），四店开满有员工；mutate 再改别的字段。
function mkSeed(seed, { space, coins = 1e12, mutate } = {}) {
  const save = JSON.parse(seed[SAVE_KEY]);
  delete save.milestones;
  for (const shop of save.shops) Object.assign(shop, { open: true, lv: 35, emp: 1 });
  save.space = JSON.parse(JSON.stringify(space));
  save.coins = coins;
  save.lastSeen = save.maxSeen = Date.now();
  if (mutate) mutate(save);
  const out = { ...seed, [SAVE_KEY]: JSON.stringify(save) };
  delete out[TAB_LOCK_KEY];
  return out;
}
// 新档原样（只有首店，没员工），只去掉 tab 锁。
function freshSeed(seed) { const out = { ...seed }; delete out[TAB_LOCK_KEY]; return out; }

// ⑤a 养成-38 老档 + 夜里进家
async function scenarioStoryOld(browser, base, entry, seed, def) {
  const tag = `⑤a yc38-old ${tagOf(entry)}`;
  const tz = tzAt(22);
  const ctx = await newCtx(browser, mkSeed(seed, { space: def, mutate: (s) => {
    s.gacha.owned = ['c_apron', 'k_3', 'k_1']; s.gacha.draws = 3; s.gacha.pity = 2;
  } }), tz);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const b = await blocked(page);
    check(`${tag}: [旧档进入] writable, no protection, local hour ${await page.evaluate(() => new Date().getHours())} (${tz})`, b.saveBlocked === false && !(await protectText(page)), J(b));
    const r0 = await page.evaluate((COND) => ({ owned: window.__tzz.state.gacha.owned.slice(), pool: window.__tzz.E.gachaRemaining(window.__tzz.state).map((x) => x.id), ids: window.__tzz.E.STORY_COND_IDS }), COND);
    check(`${tag}: [旧档进入] drawn k_3 / k_1 kept`, r0.owned.includes('k_3') && r0.owned.includes('k_1'), J(r0.owned));
    check(`${tag}: [旧档进入] k_3/k_4/k_8 are condition cards, none in box pool`, J(r0.ids) === J(COND) && !COND.some((k) => r0.pool.includes(k)), J({ ids: r0.ids, pool: r0.pool.filter((x) => /^k_/.test(x)) }));
    await page.evaluate(() => window.__tzz.setTab('col')); await page.waitForTimeout(400);
    const hints = await page.evaluate(() => [...document.querySelectorAll('.story.no.cond p')].map((e) => e.textContent));
    check(`${tag}: 图鉴 2 hints for the 2 missing condition cards`, hints.length === 2 && hints.every((h) => h.startsWith('提示：')), J(hints));
    await shot(page, `yc38-col-${tagOf(entry)}`);
    await page.evaluate(() => window.__tzz.setTab('gacha')); await page.waitForTimeout(300);
    check(`${tag}: 盲盒页 has condition-card note`, await page.evaluate(() => !!document.getElementById('storyCondNote')));
    await page.evaluate(() => window.__tzz.setTab('shop')); await page.waitForTimeout(300);
    const before = await page.evaluate(() => { const s = window.__tzz.state; return { coins: s.coins, draws: s.gacha.draws, pity: s.gacha.pity, daily: JSON.stringify(s.gachaDaily ?? null) }; });
    await page.evaluate(() => window.__tzz.setTab('home')); await page.waitForTimeout(700);
    const after = await page.evaluate(() => { const s = window.__tzz.state; return { coins: s.coins, draws: s.gacha.draws, pity: s.gacha.pity, daily: JSON.stringify(s.gachaDaily ?? null), owned: s.gacha.owned.slice() }; });
    check(`${tag}: night home → k_4 + k_8 granted (k_3 already owned)`, after.owned.includes('k_4') && after.owned.includes('k_8') && after.owned.filter((x) => x === 'k_3').length === 1, J(after.owned));
    check(`${tag}: grant costs nothing (draws/pity/daily same, coins not lower)`, after.draws === before.draws && after.pity === before.pity && after.daily === before.daily && after.coins >= before.coins,
      J({ before, after: { ...after, owned: undefined } }));
    await shot(page, `yc38-home-night-${tagOf(entry)}`);
    await reload(page);
    const own2 = await page.evaluate(() => window.__tzz.state.gacha.owned.slice());
    const b2 = await blocked(page), d = await diskSave(page);
    check(`${tag}: [刷新保留] k_1/k_3/k_4/k_8 kept, no duplicates, still writable`, ['k_1', ...COND].every((k) => own2.includes(k)) && new Set(own2).size === own2.length && b2.saveBlocked === false, J({ own2, b2 }));
    check(`${tag}: [刷新保留] disk save has the same owned list`, d && J(d.gacha?.owned) === J(own2), J(d?.gacha?.owned));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑤b 养成-38 默认不给：新档白天进家
async function scenarioStoryFresh(browser, base, entry, seed) {
  const tag = `⑤b yc38-fresh-day ${tagOf(entry)}`;
  const tz = tzAt(13);
  const ctx = await newCtx(browser, freshSeed(seed), tz);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const b = await blocked(page);
    await page.evaluate(() => window.__tzz.setTab('home')); await page.waitForTimeout(700);
    const own = await page.evaluate(() => window.__tzz.state.gacha.owned.slice());
    check(`${tag}: [新字段默认值] fresh save, day home (${tz}) → no condition card`, b.saveBlocked === false && !COND.some((k) => own.includes(k)), J({ b, own }));
    await reload(page);
    const own2 = await page.evaluate(() => window.__tzz.state.gacha.owned.slice());
    check(`${tag}: [刷新保留] still none after refresh`, !COND.some((k) => own2.includes(k)), J(own2));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑥a 星途-02 新档默认值 + 真点雇佣 + 刷新 + 跨入口
async function scenarioMilestonesNew(browser, base, entry) {
  const tag = `⑥a xt02-new ${tagOf(entry)}`;
  const ctx = await newCtx(browser, null);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
    await page.waitForFunction(READY, null, { timeout: 30000 });
    await page.getByRole('button', { name: '开摊！', exact: true }).click();
    await page.waitForTimeout(300);
    const m0 = await page.evaluate(() => ({ m: window.__tzz.state.milestones, created: window.__tzz.state.created }));
    check(`${tag}: [新字段默认值] new game → {schemaVersion:1, events:{firstShop: created}} only`,
      m0.m && m0.m.schemaVersion === 1 && J(Object.keys(m0.m.events)) === J(['firstShop']) && m0.m.events.firstShop === m0.created, J(m0));
    // 资金是显式测试夹具；雇人本身走真按钮/真事务（同 tests/milestones/browser.py）
    await page.evaluate(() => { window.__tzz.state.coins = 1000000; window.__tzz.persist(); window.__tzz.renderTab(); });
    await page.locator('button[data-act="hire"][data-arg="0"]').first().click();
    await page.waitForFunction(() => window.__tzz.state.milestones.events.firstEmployee !== undefined, null, { timeout: 5000 });
    const m1 = await page.evaluate(() => window.__tzz.state.milestones);
    check(`${tag}: real hire click records firstEmployee ≥ firstShop`, Number.isSafeInteger(m1.events.firstEmployee) && m1.events.firstEmployee >= m1.events.firstShop, J(m1));
    await reload(page);
    const m2 = await page.evaluate(() => window.__tzz.state.milestones), d = await diskSave(page);
    check(`${tag}: [刷新保留] milestones identical in memory and on disk`, J(m2) === J(m1) && J(d?.milestones) === J(m1), J({ m2, disk: d?.milestones }));
    const other = entry === '/' ? '/pet/game/' : '/';
    try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
    await load(page, base, other);
    const m3 = await page.evaluate(() => window.__tzz.state.milestones);
    check(`${tag}: [刷新保留] ${tagOf(entry)}→${tagOf(other)} same ledger`, J(m3) === J(m1), J(m3));
    await shot(page, `xt02-new-${tagOf(entry)}`);
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑥b 星途-02 老档（无 milestones）进入 + 真点买下地球 + 刷新
async function scenarioMilestonesOld(browser, base, entry, seed, def) {
  const tag = `⑥b xt02-old ${tagOf(entry)}`;
  const ctx = await newCtx(browser, mkSeed(seed, { space: { ...JSON.parse(JSON.stringify(def)), ended: true, earth: false }, coins: 15e12 }));
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const b = await blocked(page);
    const m0 = await page.evaluate(() => window.__tzz.state.milestones ?? null);
    const nums0 = m0 ? Object.values(m0.events || {}).filter((v) => v !== null) : [];
    check(`${tag}: [旧档进入] writable, no protection, no fabricated timestamps on load`, b.saveBlocked === false && !(await protectText(page)) && nums0.length === 0, J({ b, m0 }));
    const opened = await page.evaluate(() => window.XingTu.open());
    check(`${tag}: [旧档进入] XingTu.open() ok`, opened && opened.ok, J(opened));
    await page.locator('#xingtuBuyEarth').click();
    await page.locator('#xingtuRecapView').waitFor({ timeout: 10000 });
    const m1 = await page.evaluate(() => ({ earth: window.__tzz.state.space.earth, m: window.__tzz.state.milestones }));
    check(`${tag}: buy Earth → earth timestamp committed with purchase`, m1.earth === true && Number.isSafeInteger(m1.m?.events?.earth), J(m1));
    check(`${tag}: [新字段默认值] legacy firstShop = null (no invented date)`, m1.m?.events?.firstShop === null, J(m1.m?.events));
    check(`${tag}: unproven firstZombie row absent`, (await page.locator('#milestone-firstZombie').count()) === 0);
    const shopRow = await page.locator('#milestone-firstShop').innerText().catch(() => '');
    const recapTxt = await page.locator('#xingtuRecapView').innerText().catch(() => '');
    check(`${tag}: recap wording 记录开始之前 / 从有记录起`, shopRow.includes('记录开始之前') && recapTxt.includes('从有记录起'), J({ shopRow: shopRow.slice(0, 80) }));
    check(`${tag}: 390 no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= 390), String(await page.evaluate(() => document.documentElement.scrollWidth)));
    await shot(page, `xt02-recap-${tagOf(entry)}`);
    const done = page.locator('#xingtuRecapDone');
    if (await done.count() && await done.first().isVisible()) await done.first().click();
    const stored = await page.evaluate(() => window.__tzz.state.milestones);
    await reload(page);
    const m2 = await page.evaluate(() => ({ m: window.__tzz.state.milestones, earth: window.__tzz.state.space.earth })), d = await diskSave(page), b2 = await blocked(page);
    check(`${tag}: [刷新保留] milestones + earth identical after refresh (memory + disk), writable`, J(m2.m) === J(stored) && m2.earth === true && J(d?.milestones) === J(stored) && b2.saveBlocked === false, J({ m2, b2 }));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑥c 星途-02 坏字段进保护、不改原档
async function scenarioMilestonesBad(browser, base, entry, seed, def) {
  const tag = `⑥c xt02-bad ${tagOf(entry)}`;
  const s = mkSeed(seed, { space: def, mutate: (x) => { x.milestones = { schemaVersion: 2, events: { firstShop: 1 } }; } });
  const ctx = await newCtx(browser, s);
  const page = await ctx.newPage(); wireErrors(page, tag, { expectProtect: true });
  try {
    await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const st = await page.evaluate(() => ({ hasTzz: !!window.__tzz, saveBlocked: window.__tzz ? window.__tzz.saveBlocked : null, src: window.__tzz?.loadInfo?.source }));
    const prot = await protectText(page);
    const raw = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
    check(`${tag}: unknown schemaVersion → protected (blocked or protection notice)`, st.saveBlocked === true || prot, J({ st, prot }));
    check(`${tag}: original save bytes untouched`, raw === s[SAVE_KEY], `len ${raw?.length} vs ${s[SAVE_KEY].length}`);
    await shot(page, `xt02-bad-${tagOf(entry)}`);
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

async function main() {
  const { server, url: base } = await startServer();
  const launcher = ENGINE === 'chromium' ? chromium : webkit;
  const browser = await launcher.launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
  try {
    const { seed, def } = await generateSeed(browser, base);
    for (const entry of ENTRY_POINTS) {
      await scenarioStoryOld(browser, base, entry, seed, def);
      await scenarioStoryFresh(browser, base, entry, seed);
      await scenarioMilestonesNew(browser, base, entry);
      await scenarioMilestonesOld(browser, base, entry, seed, def);
      await scenarioMilestonesBad(browser, base, entry, seed, def);
    }
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('iOS 真机 Safari / 后台冻结后恢复：macOS WebKit 模拟不了，单列未验',
    '养成-38 收下夜游食神（k_3 特殊客人路径）与 8 种家里动画（熊猫走、气球、倒计时）：不在 139 范围，WebKit 未验',
    '星途-02 打僵尸 / 塔防等子游戏回执写 firstZombie / firstTDWin：未验');
  const failed = checks.filter((c) => !c.ok);
  const ok = failed.length === 0 && errors.length === 0;
  const report = { ok, engine: ENGINE, viewport: VIEWPORT, entryPoints: ENTRY_POINTS, counts: { checks: checks.length, failed: failed.length, jsErrors: errors.length }, checks, errors, notCovered };
  fs.writeFileSync(path.join(OUT, `report-139-${ENGINE}.json`), JSON.stringify(report, null, 2));
  const lines = [`测试-139 养成-38 + 星途-02 (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}`, '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []), '', 'NOT COVERED: ' + notCovered.join('; ')];
  fs.writeFileSync(path.join(OUT, `report-139-${ENGINE}.txt`), lines.join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
  process.exit(ok ? 0 : 1);
}
main();
