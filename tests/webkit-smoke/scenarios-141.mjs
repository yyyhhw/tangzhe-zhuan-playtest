// 测试-141 — 养成-38 剩余 WebKit 补验（只测不改游戏代码），root + pet，390×844。接测试-139「没验」清单：
//   ⑦a 收下夜游食神：老档（四店有员工、没有 k_3）在烧烤摊等特殊客人「夜游食神」→ 点客人（走 __tzz.hitBig，同画布点击的处理函数）
//       → 漫画弹窗点「收下」→ k_3（熊猫监工）入库。收下这一下：同一次同步 evaluate 读前值→点收下→读后值，
//       金币/抽数/保底/每日次数严格相等；扣 1 币负对照必须被同一判定判失败。保存后刷新 k_3 还在、不重复。
//       （点客人本身给的小奖励在点「收下」之前就入账，不在「不扣币」窗口里。）
//   ⑦b 家里动画：k_3 在 77 的家 → 熊猫（[data-story=panda]）在且在动；夜里 + k_4 → 月亮；火箭老板已加入 + k_7 →
//       第一次进他家放气球 + 两句倒计时台词。只看 DOM 元素和 computed animation，不判画面好不好看。
// [刷新保留] 一律是「显式 persist 后刷新」。时段断言游戏实际 night（同 139 的取法）。
// 没法在 macOS WebKit 验的：iOS 真机 Safari、后台冻结恢复。
//
// Usage: node scenarios-141.mjs   (WebKit)   |   BROWSER=chromium [CHROMIUM_PATH=...] node scenarios-141.mjs
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

// ⑦a 夜游食神 → 收下 → k_3
async function scenarioGuest(browser, base, entry, seed) {
  const tag = `⑦a yc38-guest ${tagOf(entry)}`;
  const ctx = await newCtx(browser, mkSeed(seed, (s) => { s.gacha.owned = ['c_apron']; s.gacha.draws = 1; s.gacha.pity = 1; }));
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const r0 = await page.evaluate(() => ({ owned: window.__tzz.state.gacha.owned.slice(), cur: window.__tzz.state.cur, blocked: window.__tzz.saveBlocked }));
    check(`${tag}: [旧档进入] writable, k_3 not owned, on 烧烤摊`, r0.blocked === false && !r0.owned.includes('k_3') && r0.cur === 0, J(r0));
    await page.evaluate(() => { window.__tzz.setTab('shop'); window.__tzz.forceSpecial(); });
    await page.waitForFunction(() => { const s = window.__tzz.special; return s && s.shop === 0 && s.r != null && s.x > 0; }, null, { timeout: 15000 });
    const meta = await page.evaluate(() => ({ name: window.__tzz.special.meta.name, shop: window.__tzz.special.shop }));
    check(`${tag}: special guest at 烧烤摊 is 夜游食神`, meta.name === '夜游食神' && meta.shop === 0, J(meta));
    const hit = await page.evaluate(() => { const s = window.__tzz.special; return window.__tzz.hitBig(s.x, s.y); });
    await page.locator('#mOk').waitFor({ state: 'visible', timeout: 5000 });
    const comic = await page.locator('.mtitle').first().innerText().catch(() => '');
    check(`${tag}: tapping the guest opens the comic with 收下`, hit === true && comic.includes('夜游食神'), J({ hit, comic }));
    await shot(page, `guest-comic-${tagOf(entry)}`);
    // 同一次同步 evaluate：读前值 → 点「收下」（closeModal + storyGrant 同步）→ 读后值；tamper=1 时为负对照
    const CLICK = ({ tamper }) => {
      const t = window.__tzz, s = () => t.state;
      const snap = () => ({ coins: s().coins, draws: s().gacha.draws, pity: s().gacha.pity, daily: JSON.stringify(s().gachaDaily ?? null), owned: s().gacha.owned.slice() });
      const before = snap();
      document.getElementById('mOk').click();
      if (tamper) s().coins -= tamper;
      const after = snap();
      if (tamper) s().coins += tamper;
      return { before, after };
    };
    const g = await page.evaluate(CLICK, { tamper: 0 });
    check(`${tag}: 收下 → k_3 (熊猫监工) granted once`, g.after.owned.filter((x) => x === 'k_3').length === 1 && !g.before.owned.includes('k_3'), J(g.after.owned));
    const v = costFree(g.before, g.after);
    check(`${tag}: 收下 costs nothing (same sync tick: coins/draws/pity/daily strictly equal)`, v.ok, J({ ...v, before: { ...g.before, owned: undefined }, after: { ...g.after, owned: undefined } }));
    // 负对照：再造一次客人弹窗，同样读法 + 人为扣 1 币，同一判定必须判失败（k_3 已有，不会再发）
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__tzz.forceSpecial());
    await page.waitForFunction(() => { const s = window.__tzz.special; return s && s.shop === 0 && s.r != null && s.x > 0; }, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.__tzz.special; return window.__tzz.hitBig(s.x, s.y); });
    await page.locator('#mOk').waitFor({ state: 'visible', timeout: 5000 });
    const n = await page.evaluate(CLICK, { tamper: 1 });
    const nv = costFree(n.before, n.after);
    check(`${tag}: negative control — artificial −1 coin is detected by the same check`, !nv.ok && nv.coinDiff === -1 && n.after.owned.filter((x) => x === 'k_3').length === 1, J({ nv, k3: n.after.owned.filter((x) => x === 'k_3').length }));
    await reload(page);
    const own2 = await page.evaluate(() => window.__tzz.state.gacha.owned.slice()), d = await diskSave(page);
    check(`${tag}: [刷新保留] (保存后刷新) k_3 kept once, disk matches, writable`, own2.filter((x) => x === 'k_3').length === 1 && J(d?.gacha?.owned) === J(own2) && (await page.evaluate(() => window.__tzz.saveBlocked)) === false, J(own2));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑦b 家里动画：熊猫 / 月亮 / 发射倒计时
async function scenarioHomeAnim(browser, base, entry, seed) {
  const tag = `⑦b yc38-home-anim ${tagOf(entry)}`;
  const tz = tzAt(22);
  const ctx = await newCtx(browser, mkSeed(seed, (s) => {
    s.gacha.owned = ['c_apron', 'k_3', 'k_4', 'k_7'];
    if (s.ceos && s.ceos.rocket) s.ceos.rocket.unlocked = true;
  }), tz);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const per = await gamePeriod(page);
    check(`${tag}: [时段] game period is night (${tz})`, per.inline === 'night' && (per.ambience === null || per.ambience === 'night'), J(per));
    const hs = await page.evaluate(() => ({ hs: !!window.HomeStory, rocket: window.__tzz.E.homeOpen(window.__tzz.state, 'rocket'), who: window.__tzz.homeWho, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    check(`${tag}: story-home.js loaded, rocket joined`, hs.hs && hs.rocket, J(hs));
    await page.evaluate(() => { window.__tzz.setTab('home'); window.__tzz.homeMode = 'live'; });
    if (hs.who !== 'c77') await page.evaluate(() => window.__tzz.act('homeWho', 'c77'));
    await page.waitForTimeout(800);
    const anim = (sel) => page.evaluate((sel) => {
      const el = document.querySelector(sel); if (!el) return null;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return { name: cs.animationName, state: cs.animationPlayState, w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility !== 'hidden' && cs.display !== 'none' };
    }, sel);
    const panda = await anim('[data-story="panda"]');
    const pandaFoot = await anim('[data-story="panda"] .pf1');
    check(`${tag}: 77 home — panda present and animated`, panda && panda.vis && panda.w > 0 && (panda.name !== 'none' || (pandaFoot && pandaFoot.name !== 'none')), J({ panda, pandaFoot }));
    const moon = await anim('[data-story="moon"]');
    check(`${tag}: night + k_4 — moon present`, moon && moon.vis && moon.w > 0, J(moon));
    await shot(page, `home-77-night-${tagOf(entry)}`);
    await page.evaluate(() => window.__tzz.act('homeWho', 'rocket'));
    await page.waitForTimeout(500);
    const balloons = await anim('[data-story="balloons"]');
    const line1 = await page.evaluate(() => ({ txt: document.querySelector('.ha-line')?.textContent || '' }));
    check(`${tag}: rocket first visit — balloons + 1st countdown line`, balloons && balloons.name !== 'none' && line1.txt.length > 0, J({ balloons, line1 }));
    await shot(page, `home-rocket-countdown-${tagOf(entry)}`);
    await page.waitForTimeout(3600);
    const line2 = await page.evaluate(() => document.querySelector('.ha-line')?.textContent || '');
    check(`${tag}: countdown 2nd line after ~3.6s`, line2.length > 0 && line2 !== line1.txt, J({ first: line1.txt, second: line2 }));
    // 同一页第二次进火箭老板家不再重放：先等过第一次气球的 6.2s 窗口，再换人回来
    await page.waitForTimeout(2600);
    await page.evaluate(() => window.__tzz.act('homeWho', 'c77')); await page.waitForTimeout(300);
    await page.evaluate(() => window.__tzz.act('homeWho', 'rocket')); await page.waitForTimeout(400);
    check(`${tag}: countdown plays once per page (no balloons on 2nd visit)`, (await page.locator('[data-story="balloons"]').count()) === 0);
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

async function main() {
  const { server, url: base } = await startServer();
  const launcher = ENGINE === 'chromium' ? chromium : webkit;
  const browser = await launcher.launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
  try {
    const seed = await generateSeed(browser, base);
    for (const entry of ENTRY_POINTS) {
      await scenarioGuest(browser, base, entry, seed);
      await scenarioHomeAnim(browser, base, entry, seed);
    }
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('iOS 真机 Safari / 后台冻结后恢复：macOS WebKit 模拟不了',
    '点客人走 __tzz.hitBig（画布点击的同一处理函数），没模拟真实触摸坐标换算',
    '动画只验元素在 + computed animation 不为 none，不判画面效果；prefers-reduced-motion 下的静止版未验',
    '[刷新保留] 只验「显式 persist 后刷新」',
    '星途-02 firstZombie / firstTDWin 子游戏回执：测试-142');
  const failed = checks.filter((c) => !c.ok);
  const ok = failed.length === 0 && errors.length === 0;
  const report = { ok, engine: ENGINE, viewport: VIEWPORT, entryPoints: ENTRY_POINTS, counts: { checks: checks.length, failed: failed.length, jsErrors: errors.length }, checks, errors, notCovered };
  fs.writeFileSync(path.join(OUT, `report-141-${ENGINE}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, `report-141-${ENGINE}.txt`), [`测试-141 养成-38 夜游食神 + 家里动画 (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}`, '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []), '', 'NOT COVERED: ' + notCovered.join('; ')].join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
  process.exit(ok ? 0 : 1);
}
main();
