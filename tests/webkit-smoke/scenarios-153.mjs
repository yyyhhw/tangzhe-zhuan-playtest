// 测试-153 — 家宅-148/149/150/151 + 体验-152 的 WebKit 补验（只测不改游戏代码），root + pet，390×844（④ 另加 320/420/421/430）。
//   ① 夜晚 + k_4：四位 CEO × Lv1–3，有窗房型月亮在窗框内（窗 overflow:hidden 裁切）、没窗房型不画月亮；77 的家 k_3 熊猫是静止小摆件（隔 1.5s 不动、无动画）
//   ② 黄昏 + k_8（家宅-150）：同 12 间房，有窗房型四盏灯都在最左窗框内、窗 overflow:hidden、灯有尺寸（不被压成一条线）；没窗房型不画
//   ③ 夜晚 + k_4（家宅-151）：有底图的房间，右上/左上房名牌 .rw-name 不与 HomeStory.windowsFor 的任何窗重叠、文字不截断
//   ④ 顶部金币卡（体验-149/152）：320/390/420/421/430 × 团单开/关 × 拟声字「叮」/「超超超级暴击！！」，余额 1000.00万亿：
//      金额不截断、「每秒 +X」数字完整、团单标签/拟声字不压金额和收入、无横向滚动。同一次同步 evaluate 里写入并测量（游戏每帧会重写）。
// 窗位 = HomeStory.windowsFor(`${id}_${lv}`)（占底图百分比），换算到 .story-moonwin / .story-streetwin 的 offsetParent（底图框）。
// 时段用 Etc/GMT±N 时区把本地小时拨到 22 点（夜）/ 18 点（黄昏），并断言游戏实际时段。
// 没法在 macOS WebKit 验的：iOS 真机 Safari。
//
// Usage: node scenarios-153.mjs   (WebKit)   |   BROWSER=chromium [CHROMIUM_PATH=...] node scenarios-153.mjs
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
const CEOS = ['c77', 'pearl', 'otaku', 'rocket'];
const LVS = [1, 2, 3];
const checks = [], errors = [], notCovered = [];
let shotN = 0;
const J = (v) => JSON.stringify(v);
const tagOf = (entry) => entry === '/' ? 'root' : 'pet';

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 600) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 300) : ''}`);
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
  try { await page.screenshot({ path: path.join(OUT, `153-${String(++shotN).padStart(2, '0')}-${ENGINE}-${name}.png`) }); } catch {}
}
function tzAt(hour) {
  let o = ((hour - new Date().getUTCHours()) % 24 + 24) % 24;
  if (o > 14) o -= 24;
  return o === 0 ? 'Etc/GMT' : `Etc/GMT${o > 0 ? '-' : '+'}${Math.abs(o)}`;
}
const ctxOpts = (timezoneId = 'Asia/Tokyo', viewport = VIEWPORT) => ({ viewport, isMobile: ENGINE !== 'firefox', hasTouch: true, timezoneId });
async function newCtx(browser, seed, tz, viewport) {
  const ctx = await browser.newContext(ctxOpts(tz, viewport));
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
const gamePeriod = (page) => page.evaluate(() => {
  const h = new Date().getHours();
  return { hour: h, inline: h >= 19 || h < 5 ? 'night' : h >= 17 ? 'dusk' : h < 10 ? 'morning' : 'day' };
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
function mkSeed(seed, owned) {
  const save = JSON.parse(seed[SAVE_KEY]);
  for (const shop of save.shops) Object.assign(shop, { open: true, lv: 35, emp: 1 });
  save.coins = 1e12;
  save.cur = 0;
  save.lastSeen = save.maxSeen = Date.now();
  save.gacha.owned = owned;
  for (const id of CEOS) if (save.ceos && save.ceos[id]) Object.assign(save.ceos[id], { unlocked: true, at: save.ceos[id].at < 0 ? 0 : save.ceos[id].at });
  const out = { ...seed, [SAVE_KEY]: JSON.stringify(save) };
  delete out[TAB_LOCK_KEY];
  return out;
}
// 进某位 CEO 的家、设房间等级（只改内存态做显示，不 persist）、等底图
async function enterRoom(page, who, lv) {
  await page.evaluate(({ who, lv }) => {
    const t = window.__tzz; t.setTab('home'); t.homeMode = 'live';
    t.E.homeOf(t.state, who).lv = lv;
    t.act('homeWho', who); t.renderTab();
  }, { who, lv });
  await page.waitForFunction(() => { const r = document.querySelector('.room'); const img = r && r.querySelector('img'); return r && (r.classList.contains('has-art') || !img || img.complete); }, null, { timeout: 8000 }).catch(() => {});
  // 切到家宅页/换房间时房间有进场动画：等 .room 和其中故事窗的位置尺寸连续两次采样不变（最多 3s）再量
  let prev = '';
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const cur = await page.evaluate(() => [...document.querySelectorAll('.room, .story-moonwin, .story-streetwin, .rw-name')].map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => v.toFixed(1)).join(','); }).join('|'));
    if (cur === prev) break;
    prev = cur;
  }
}
// 页内：本房间窗位换算成屏幕矩形（以 story 窗或 .room-art/.room 为底图框）
const ROOM_PROBE = ({ who, lv, kind }) => {
  const room = document.querySelector('.room'); if (!room) return { room: false };
  const HS = window.HomeStory, wins = HS && HS.windowsFor ? HS.windowsFor(`${who}_${lv}`) : [];
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const sel = kind === 'street' ? '.story-streetwin' : '.story-moonwin';
  const win = room.querySelector(sel);
  const frameEl = win ? win.offsetParent : null;
  const frame = frameEl ? r(frameEl) : null;
  const winRects = frame ? wins.map((w) => ({ l: frame.l + frame.w * w[0] / 100, t: frame.t + frame.h * w[1] / 100, r: frame.l + frame.w * (w[0] + w[2]) / 100, b: frame.t + frame.h * (w[1] + w[3]) / 100 })) : [];
  const inside = (a, b) => a.l >= b.l - 0.5 && a.r <= b.r + 0.5 && a.t >= b.t - 0.5 && a.b <= b.b + 0.5;
  const ov = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const out = { room: true, hasArt: room.classList.contains('has-art'), nWins: wins.length, hasWinEl: !!win };
  if (kind === 'moon') {
    const m = room.querySelector('[data-story="moon"]');
    out.moon = m ? { ...r(m), vis: getComputedStyle(m).display !== 'none' && getComputedStyle(m).visibility !== 'hidden', inWin: win ? inside(r(m), r(win)) : false, clip: win ? getComputedStyle(win).overflow : null } : null;
    out.moonVisible = !!(m && win && getComputedStyle(win).display !== 'none' && r(m).w > 0);
    const name = room.querySelector('.rw-name');
    if (name) {
      const nr = r(name);
      out.name = { text: name.textContent, full: name.scrollWidth <= name.clientWidth + 1, overlaps: winRects.map((w, i) => ov(nr, w) ? i : -1).filter((i) => i >= 0), rect: nr, winRects };
    }
  } else {
    const st = room.querySelector('[data-story="street"]');
    const lamps = st ? [...st.querySelectorAll('i')].map(r) : [];
    out.street = st ? { clip: win ? getComputedStyle(win).overflow : null, winDisplay: win ? getComputedStyle(win).display : null, lamps: lamps.map((x) => [Math.round(x.w * 10) / 10, Math.round(x.h * 10) / 10]),
      allIn: !!win && lamps.length === 4 && lamps.every((x) => inside(x, r(win))), sized: lamps.length === 4 && lamps.every((x) => x.w >= 2 && x.h >= 3),
      inFirstWin: !!win && winRects.length > 0 && inside(r(win), { l: winRects[0].l - 1, t: winRects[0].t - 1, r: winRects[0].r + 1, b: winRects[0].b + 1 }) } : null;
    out.streetVisible = !!(st && win && getComputedStyle(win).display !== 'none' && r(st).w > 0);
  }
  return out;
};

// ①+③ 夜晚 + k_4：月亮进窗、房名牌不压窗；77 家 k_3 熊猫静止
async function scenarioNight(browser, base, entry, seed) {
  const tag = `①③ home-night ${tagOf(entry)}`;
  const tz = tzAt(22);
  const ctx = await newCtx(browser, mkSeed(seed, ['c_apron', 'k_3', 'k_4']), tz);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const per = await gamePeriod(page);
    check(`${tag}: [时段] game period is night (${tz})`, per.inline === 'night', J(per));
    const open = await page.evaluate((ids) => ids.map((i) => [i, window.__tzz.E.homeOpen(window.__tzz.state, i)]), CEOS);
    check(`${tag}: all four CEO homes open`, open.every((x) => x[1]), J(open));
    for (const who of CEOS) for (const lv of LVS) {
      await enterRoom(page, who, lv);
      const p = await page.evaluate(ROOM_PROBE, { who, lv, kind: 'moon' });
      const k = `${tag} ${who} Lv${lv}`;
      if (p.nWins > 0 && p.hasArt) {
        check(`${k}: ① moon inside its window, window clips (overflow:hidden)`, p.moon && p.moon.vis && p.moon.w > 0 && p.moon.inWin && p.moon.clip === 'hidden', J(p.moon));
        check(`${k}: ③ room name does not overlap any window, text not truncated`, p.name && p.name.overlaps.length === 0 && p.name.full, J(p.name && { text: p.name.text, full: p.name.full, overlaps: p.name.overlaps }));
      } else {
        check(`${k}: ① no outdoor window (nWins=${p.nWins}, hasArt=${p.hasArt}) → no moon drawn`, !p.moonVisible, J({ nWins: p.nWins, hasArt: p.hasArt, hasWinEl: p.hasWinEl }));
      }
      if (who === 'c77' && lv === 3) await shot(page, `night-c77-lv3-${tagOf(entry)}`);
    }
    await enterRoom(page, 'c77', 1);
    const P = () => { const el = document.querySelector('[data-story="panda"]'); if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), anim: cs.animationName, fig: el.classList.contains('figurine') }; };
    const a0 = await page.evaluate(P); await page.waitForTimeout(1500); const a1 = await page.evaluate(P);
    check(`${tag}: ① 77 home k_3 panda — static figurine, no animation, no movement over 1.5s`,
      a0 && a1 && a0.fig && a0.w > 0 && a0.anim === 'none' && a1.anim === 'none' && a0.x === a1.x && a0.y === a1.y, J({ a0, a1 }));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ② 黄昏 + k_8：一条街的灯在最左窗内
async function scenarioDusk(browser, base, entry, seed) {
  const tag = `② home-dusk ${tagOf(entry)}`;
  const tz = tzAt(18);
  const ctx = await newCtx(browser, mkSeed(seed, ['c_apron', 'k_8']), tz);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const per = await gamePeriod(page);
    check(`${tag}: [时段] game period is dusk (${tz})`, per.inline === 'dusk', J(per));
    for (const who of CEOS) for (const lv of LVS) {
      await enterRoom(page, who, lv);
      const p = await page.evaluate(ROOM_PROBE, { who, lv, kind: 'street' });
      const k = `${tag} ${who} Lv${lv}`;
      if (p.nWins > 0 && p.hasArt) {
        check(`${k}: ② 4 lamps inside the leftmost window, window clips, lamps have real size`,
          p.street && p.street.allIn && p.street.inFirstWin && p.street.clip === 'hidden' && p.street.sized, J(p.street));
      } else {
        check(`${k}: ② no outdoor window (nWins=${p.nWins}, hasArt=${p.hasArt}) → no street lamps drawn`, !p.streetVisible, J({ nWins: p.nWins, hasArt: p.hasArt, hasWinEl: p.hasWinEl }));
      }
      if (who === 'pearl' && lv === 3) await shot(page, `dusk-pearl-lv3-${tagOf(entry)}`);
    }
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ④ 顶部金币卡
const MONEY = ({ boost, sfx }) => {
  const $ = (s) => document.querySelector(s);
  $('#coins').textContent = '1000.00万亿';
  $('#cps').innerHTML = '<span class="cps-num">每秒 +987.65万亿</span>' + (boost ? '<span class="cps-busy">（团单服务中）</span>' : '');
  $('#boostTag').classList.toggle('hidden', !boost); $('#boostSec').textContent = '25';
  $('#sfxWord').textContent = sfx;
  const r = (e) => e.getBoundingClientRect();
  const ov = (a, b) => a.width && b.width && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const c = $('#coins'), cp = $('#cps'), num = cp.querySelector('.cps-num'), t = $('#boostTag'), w = $('#sfxWord');
  return { coinsFull: c.scrollWidth <= c.clientWidth + 1, numFull: r(num).right <= r(cp).right + 0.5,
    tagNoOverlap: !boost || (!ov(r(t), r(c)) && !ov(r(t), r(cp))),
    sfxNoOverlap: getComputedStyle(w).display === 'none' || (!ov(r(w), r(c)) && !ov(r(w), r(cp))),
    noHScroll: document.documentElement.scrollWidth <= innerWidth };
};
async function scenarioMoney(browser, base, entry, seed) {
  const tag = `④ money-card ${tagOf(entry)}`;
  const widths = [320, 390, 420, 421, 430];
  const combos = [];
  for (const boost of [false, true]) for (const sfx of ['叮', '超超超级暴击！！']) combos.push({ boost, sfx });
  for (const width of widths) {
    const ctx = await newCtx(browser, mkSeed(seed, ['c_apron']), 'Asia/Tokyo', { width, height: 844 });
    const page = await ctx.newPage(); wireErrors(page, `${tag} ${width}`);
    try {
      await load(page, base, entry);
      await page.waitForTimeout(300);
      for (const combo of combos) {
        const res = await page.evaluate(MONEY, combo);
        check(`${tag} ${width}px boost=${combo.boost} sfx=${combo.sfx}: amount/income complete, no overlap, no h-scroll`, Object.values(res).every(Boolean), J(res));
      }
      if (width === 430) {
        await page.evaluate(() => { window.requestAnimationFrame = () => 0; for (let i = 1; i < 20000; i++) { clearInterval(i); clearTimeout(i); } });
        await page.evaluate(MONEY, { boost: true, sfx: '超超超级暴击！！' });
        try { await page.locator('.money').screenshot({ path: path.join(OUT, `153-${String(++shotN).padStart(2, '0')}-${ENGINE}-money-430-${tagOf(entry)}.png`) }); } catch {}
      }
    } catch (e) { check(`${tag} ${width}: ran`, false, e.stack || e); } finally { await ctx.close(); }
  }
}

async function main() {
  const { server, url: base } = await startServer();
  const launcher = ENGINE === 'chromium' ? chromium : webkit;
  const browser = await launcher.launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
  try {
    const seed = await generateSeed(browser, base);
    for (const entry of ENTRY_POINTS) {
      await scenarioNight(browser, base, entry, seed);
      await scenarioDusk(browser, base, entry, seed);
      await scenarioMoney(browser, base, entry, seed);
    }
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('iOS 真机 Safari：macOS WebKit 模拟不了',
    '房间等级只改内存态做显示（不 persist、不验刷新保留——148–152 都不动存档）',
    '黄昏↔夜晚实时切换、prefers-reduced-motion、底图加载失败：未验',
    '420↔421 视口切换只在 Chromium 作者自测里验过，本脚本按宽度分别开页',
    '不判画面好不好看，只判几何位置/裁切/截断');
  const failed = checks.filter((c) => !c.ok);
  const ok = failed.length === 0 && errors.length === 0;
  const report = { ok, engine: ENGINE, viewport: VIEWPORT, entryPoints: ENTRY_POINTS, counts: { checks: checks.length, failed: failed.length, jsErrors: errors.length }, checks, errors, notCovered };
  fs.writeFileSync(path.join(OUT, `report-153-${ENGINE}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, `report-153-${ENGINE}.txt`), [`测试-153 家宅-148/150/151 + 体验-149/152 (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}`, '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []), '', 'NOT COVERED: ' + notCovered.join('; ')].join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
  process.exit(ok ? 0 : 1);
}
main();
