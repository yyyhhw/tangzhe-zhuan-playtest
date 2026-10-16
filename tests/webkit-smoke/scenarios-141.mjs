// 测试-141 — 养成-38 剩余 WebKit 补验（只测不改游戏代码），root + pet，390×844。接测试-139「没验」清单：
//   ⑦a 收下夜游食神：老档（四店有员工、没有 k_3）在烧烤摊等特殊客人「夜游食神」→ 点客人（走 __tzz.hitBig，同画布点击的处理函数）
//       → 漫画弹窗点「收下」→ k_3（熊猫监工）入库。收下这一下：同一次同步 evaluate 读前值→点收下→读后值，
//       金币/抽数/保底/每日次数严格相等；扣 1 币负对照必须被同一判定判失败。保存后刷新 k_3 还在、不重复。
//       （点客人本身给的小奖励在点「收下」之前就入账，不在「不扣币」窗口里。）
//   ⑦b 家里动画：k_3 在 77 的家 → 熊猫整体行走动画 running，隔 1.5s 采样进度前进；夜里 + k_4 → 月亮；火箭老板已加入 + k_7 →
//       第一次进他家：从进入起采满 7.6s，台词精确依次「三、二、一——」→「……今天先放气球。」，气球可见、有尺寸、storyFloat running、
//       进度/位置随时间变化、末次采样已播完且在房间外（DOM 可残留到下次重画）；换走再回来同样抽样 7.6s，两句和气球都不得出现。
//       「采满 7.6s」是约 150ms 循环等待的抽样观察（报告附最大采样间隙），不是连续全窗零事件证明。不判画面好不好看。
//   ⑦c 负向：k_7 已拥有但火箭老板未加入（homeOpen=false）→ 进他的家采满 7.6s，无气球、无两句倒数（⑦b 同一观察器作正控）。
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

// ⑦b 家里动画：熊猫 / 月亮 / 发射倒计时（熊大 14:22 退修：跨时间采样，精确两句，重进与未加入都覆盖完整延迟窗口）
const K7 = ['三、二、一——', '……今天先放气球。'];
const WINDOW_MS = 7600;   // 气球窗口 6.2s（app.js storySceneHTML b<6.2）、第二句 3.6s 起显示 3.2s → 约 6.8s；多采到 7.6s
// 页内一次采样：当前台词、气球、熊猫的 computed animation + Web Animations 进度 + 位置
const PROBE = () => {
  const room = document.querySelector('.room'), rr = room ? room.getBoundingClientRect() : null;
  const info = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const a = (el.getAnimations ? el.getAnimations() : []).find((x) => x.animationName === cs.animationName) || null;
    const tm = a ? a.effect.getComputedTiming() : null;
    return { name: cs.animationName, state: cs.animationPlayState, aState: a ? a.playState : null, prog: tm && tm.progress != null ? +tm.progress.toFixed(4) : null,
      vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top),
      inRoom: rr ? (r.width > 0 && r.height > 0 && r.right > rr.left && r.left < rr.right && r.bottom > rr.top && r.top < rr.bottom) : null,
      still: el.classList.contains('still'), kids: el.children.length };
  };
  return { t: Math.round(performance.now()), who: window.__tzz.homeWho, line: document.querySelector('#homeActor .ha-line')?.textContent || '',
    balloons: info(document.querySelector('[data-story="balloons"]')), panda: info(document.querySelector('[data-story="panda"]')) };
};
async function observe(page, ms, step = 150) {
  const out = [], t0 = Date.now();
  while (Date.now() - t0 < ms) { out.push(await page.evaluate(PROBE)); await page.waitForTimeout(step); }
  out.push(await page.evaluate(PROBE));
  return out;
}
const span = (ss) => ss.length ? ss[ss.length - 1].t - ss[0].t : 0;
// 相邻两次采样的最大间隙（150ms 只是循环等待，不保证间隙上限；报告里如实写出）
const maxGap = (ss) => ss.reduce((m, x, i) => i ? Math.max(m, x.t - ss[i - 1].t) : m, 0);
// 非空台词按出现顺序去重（连续相同只算一次）
const lineSeq = (ss) => ss.map((x) => x.line).filter(Boolean).filter((v, i, a) => i === 0 || a[i - 1] !== v);
const k7Hits = (ss) => ss.filter((x) => K7.includes(x.line)).length;
async function enterHome(page, who) {
  await page.evaluate(() => { window.__tzz.setTab('home'); window.__tzz.homeMode = 'live'; });
  if ((await page.evaluate(() => window.__tzz.homeWho)) !== who) await page.evaluate((w) => window.__tzz.act('homeWho', w), who);
}

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
    const hs = await page.evaluate(() => ({ hs: !!window.HomeStory, k7: window.HomeStory && window.HomeStory.LINES.k7, rocket: window.__tzz.E.homeOpen(window.__tzz.state, 'rocket'), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    check(`${tag}: story-home.js loaded, rocket joined, k7 lines are exactly the two expected`, hs.hs && hs.rocket === true && J(hs.k7) === J(K7) && hs.reduced === false, J(hs));
    await enterHome(page, 'c77');
    await page.waitForTimeout(800);
    // 熊猫：整体行走动画（storyPandaWalk，或停在竹家具旁时 storyPandaBamboo）必须 running，且隔 1.5s 两次采样进度确实前进
    const p0 = await page.evaluate(PROBE); await page.waitForTimeout(1500); const p1 = await page.evaluate(PROBE);
    const a0 = p0.panda, a1 = p1.panda;
    const WALK = ['storyPandaWalk', 'storyPandaBamboo'];
    const dProg = a0 && a1 && a0.prog != null && a1.prog != null ? Math.abs((((a1.prog - a0.prog) % 1) + 1) % 1) : null;
    check(`${tag}: 77 home — panda whole-body walk animation is running (not .still)`,
      a0 && a1 && a0.vis && a0.w > 0 && a0.h > 0 && WALK.includes(a0.name) && a0.state === 'running' && a0.aState === 'running' && !a0.still && WALK.includes(a1.name) && a1.state === 'running',
      J({ a0, a1 }));
    check(`${tag}: 77 home — panda walk progress advances across 1.5s samples`, dProg != null && dProg > 0.01 && dProg < 0.5,
      J({ prog0: a0 && a0.prog, prog1: a1 && a1.prog, dProg, dxInfoOnly: a0 && a1 ? a1.x - a0.x : null }));
    const moon = await page.evaluate(() => { const el = document.querySelector('[data-story="moon"]'); if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return { vis: cs.visibility !== 'hidden' && cs.display !== 'none', w: Math.round(r.width), h: Math.round(r.height) }; });
    check(`${tag}: night + k_4 — moon present`, moon && moon.vis && moon.w > 0 && moon.h > 0, J(moon));
    await shot(page, `home-77-night-${tagOf(entry)}`);
    // 第一次进火箭老板家：从进入那一刻起采满整个窗口
    await page.evaluate(() => window.__tzz.act('homeWho', 'rocket'));
    const first = await observe(page, WINDOW_MS);
    const seq = lineSeq(first), firstLineAt = first.findIndex((x) => x.line);
    check(`${tag}: rocket first visit — exactly 「${K7[0]}」→「${K7[1]}」 in order, first line shown immediately`,
      J(seq) === J(K7) && firstLineAt >= 0 && first[firstLineAt].t - first[0].t < 600 && span(first) >= WINDOW_MS - 300,
      J({ seq, firstLineAfterMs: firstLineAt >= 0 ? first[firstLineAt].t - first[0].t : null, samples: first.length, spanMs: span(first), maxGapMs: maxGap(first) }));
    const t2 = first.find((x) => x.line === K7[1]);
    check(`${tag}: 2nd line appears ~3.6s after entering`, t2 && t2.t - first[0].t >= 3300 && t2.t - first[0].t <= 4600, J({ at: t2 ? t2.t - first[0].t : null }));
    const bs = first.filter((x) => x.balloons).map((x) => ({ dt: x.t - first[0].t, ...x.balloons }));
    const progs = bs.map((b) => b.prog).filter((v) => v != null);
    check(`${tag}: balloons — present immediately, visible with real size, storyFloat running`,
      bs.length > 0 && bs[0].dt < 600 && bs.every((b) => b.vis && b.w > 0 && b.h > 0 && b.kids === 3 && b.name === 'storyFloat' && b.state === 'running'),
      J({ n: bs.length, firstAt: bs[0] && bs[0].dt, sample: bs[0] }));
    check(`${tag}: balloons — float progress/position change over time and enter the room`,
      progs.length >= 2 && Math.max(...progs) - Math.min(...progs) > 0.3 && bs.some((b) => b.inRoom) && new Set(bs.map((b) => b.y)).size > 3,
      J({ progMin: Math.min(...progs), progMax: Math.max(...progs), yFirst: bs[0] && bs[0].y, yLast: bs.length && bs[bs.length - 1].y, inRoom: bs.filter((b) => b.inRoom).length }));
    // 6.2s 后：下一次重画时元素被去掉；没重画前元素可能还在 DOM，但动画必须已播完（progress=1）且停在房间外
    const endB = first[first.length - 1].balloons;
    check(`${tag}: balloons at the last sample (~7.6s): removed, or animation finished and outside the room (DOM may linger until next redraw; exact 6.2s removal not asserted)`,
      !endB || (endB.prog === 1 && endB.inRoom === false), J({ end: endB, lastInRoomAt: (bs.filter((b) => b.inRoom).pop() || {}).dt }));
    await shot(page, `home-rocket-after-window-${tagOf(entry)}`);
    // 同一页第二次进：换走再回来，从回来那一刻起采满整个窗口 —— 两句和气球都不得重放
    await page.evaluate(() => window.__tzz.act('homeWho', 'c77')); await page.waitForTimeout(300);
    await page.evaluate(() => window.__tzz.act('homeWho', 'rocket'));
    const again = await observe(page, WINDOW_MS);
    check(`${tag}: re-entry (same page) — no balloons and neither k7 line, at every sample over ~7.6s (sampled, not continuous)`,
      again.every((x) => !x.balloons) && k7Hits(again) === 0 && again[0].who === 'rocket' && span(again) >= WINDOW_MS - 300,
      J({ samples: again.length, spanMs: span(again), maxGapMs: maxGap(again), balloons: again.filter((x) => x.balloons).length, k7: k7Hits(again), lines: lineSeq(again) }));
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ⑦c 负向：k_7 已拥有但火箭老板未加入 → homeOpen=false，进他的家整个窗口里不得有气球或两句倒数
async function scenarioRocketNotJoined(browser, base, entry, seed) {
  const tag = `⑦c yc38-rocket-not-joined ${tagOf(entry)}`;
  const tz = tzAt(22);
  const ctx = await newCtx(browser, mkSeed(seed, (s) => {
    s.gacha.owned = ['c_apron', 'k_3', 'k_4', 'k_7'];
    if (s.ceos && s.ceos.rocket) s.ceos.rocket.unlocked = false;
  }), tz);
  const page = await ctx.newPage(); wireErrors(page, tag);
  try {
    await load(page, base, entry);
    const pre = await page.evaluate(() => ({ k7: window.__tzz.state.gacha.owned.includes('k_7'), homeOpen: window.__tzz.E.homeOpen(window.__tzz.state, 'rocket'), hs: !!window.HomeStory, blocked: window.__tzz.saveBlocked }));
    check(`${tag}: k_7 owned, rocket homeOpen=false, writable`, pre.k7 && pre.homeOpen === false && pre.hs && pre.blocked === false, J(pre));
    const per = await gamePeriod(page);
    check(`${tag}: [时段] game period is night (${tz})`, per.inline === 'night', J(per));
    await enterHome(page, 'c77');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__tzz.act('homeWho', 'rocket'));
    const obs = await observe(page, WINDOW_MS);
    check(`${tag}: entering rocket home — no balloons and neither k7 line, at every sample over ~7.6s (sampled, not continuous; same observer as ⑦b positive control)`,
      obs.every((x) => !x.balloons) && k7Hits(obs) === 0 && obs[0].who === 'rocket' && span(obs) >= WINDOW_MS - 300,
      J({ samples: obs.length, spanMs: span(obs), maxGapMs: maxGap(obs), balloons: obs.filter((x) => x.balloons).length, k7: k7Hits(obs), lines: lineSeq(obs) }));
    const post = await page.evaluate(() => window.__tzz.E.homeOpen(window.__tzz.state, 'rocket'));
    check(`${tag}: still homeOpen=false after the window`, post === false, J({ post }));
    await shot(page, `home-rocket-not-joined-${tagOf(entry)}`);
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
      await scenarioRocketNotJoined(browser, base, entry, seed);
    }
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('iOS 真机 Safari / 后台冻结后恢复：macOS WebKit 模拟不了',
    '点客人走 __tzz.hitBig（画布点击的同一处理函数），没模拟真实触摸坐标换算',
    '动画验 computed animation running + Web Animations 进度跨时间变化（熊猫位移只记录不断言），不判画面好不好看；prefers-reduced-motion 下的静止版未验', '「无气球/无两句」是约 7.6s 内按 ~150ms 循环抽样观察（报告附最大采样间隙），不是连续全窗零事件证明', '气球窗口结束：只核末次采样已播完且在房间外，DOM 可残留到下次重画，不证明精确 6.2s 移除',
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
