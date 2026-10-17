# WebKit / iOS-Safari smoke (测试-130)

Closes the long-standing "no WebKit environment" gap by running the game in Playwright's
**WebKit** engine (the same engine as mobile Safari) on a GitHub **macOS** runner.

## What it checks

At a 390×844 mobile viewport (`isMobile` + `hasTouch`), on **both** entry points — `/` and
`/pet/game/` — it exercises the "买下地球 / buy Earth" ending, mirroring the existing
Chromium smoke (`tests/milestones/browser.py`):

- buy-earth button (`#xingtuBuyEarth`) shows the **10 万亿** wording;
- with **15 万亿** coins one click deducts **exactly once** — the balance drops by exactly
  `EARTH_PRICE` (10 万亿) — and sets `space.earth = true`;
- a page **refresh persists** `earth = true` and the deducted (~`5e12`) balance;
- with **9 万亿** coins (below `EARTH_PRICE = 1e13`) the button is **disabled/greyed** and
  nothing is deducted;
- a cheap home-scene sanity check (`#app` / `canvas#scene`) on a fresh load;
- **fails** on any uncaught `pageerror` or JS `console.error`.

Because the fixture opens every shop (Lv35), the game accrues a tiny amount of **idle
income** between save injection and each coin read, so coin balances are compared within
`COIN_DRIFT_TOL` (1e9 — ~1e4× smaller than `EARTH_PRICE`) rather than by exact equality.
The purchase itself is still asserted exactly: `coins_before − coins_after == EARTH_PRICE`
within that tolerance, which still catches a double deduction, a no-op, or a wrong price.

Screenshots + `report.json` / `report.txt` are written to `./output` (uploaded as a CI
artifact).

## The test save

The game writes a signed-free save under `tangzhe-formal-collection-v1-save`
(confirmed: `collection/host-save.mjs`). The fixture is built the same way the Chromium
smoke does it: launch a fresh game to get a **valid** save, then mutate only data fields
(`coins`, `space.ended=true`, shops → Lv35). See `save-recipe.mjs`. It is injected via
`page.addInitScript(...)`, guarded by a sentinel so a reload does not re-seed and clobber
the game's own persisted save.

## Run locally (needs a WebKit-capable machine)

```sh
cd tests/webkit-smoke
npm install
npx playwright install webkit
npm run smoke        # or: node webkit-smoke.mjs
```

A tiny Node static server (`static-server.mjs`) serves the repo root with correct MIME
types for `.mjs` modules and ignores the `?v=` cache-busting query strings.

## 测试-130 ①–④ scenarios (`scenarios-130.mjs`)

Same server/save recipe, WebKit by default (`BROWSER=chromium CHROMIUM_PATH=… node scenarios-130.mjs`
for a local Chromium dry run), 390×844, root + `/pet/game/`:

1. **老档迁移** — a save with no `space` field and a v1 save with 10 moon round-trips
   (76 pts / 3 cards / ledger claimed 10): loads writable, 星途 opens, data intact, refresh keeps it.
2. **科研固定价** — research-bench tier 1 = 9,000,090; four synchronous clicks deduct exactly once;
   tier 2 at research Lv1 is disabled and `perform` is refused; refresh keeps only `tech:1`.
3. **跨标签** — a second page in the same context is stopped by 「同一作用域只能一个页面经营」 and
   cannot open 星途; a buy in the first page lands on disk exactly once. The second page gets a
   write observer before any of its scripts (wraps `Storage.prototype.setItem/removeItem/clear`,
   native call kept, same-value writes counted): 0 writes to protected save keys during boot and
   during explicit `perform`/`persist` attempts. Before each phase switch (boot→try, and try→control
   after the ≥1500 ms wait) one synchronous `evaluate` reads the full log and throws unless every
   non-control protected write is 0 — so writes between evaluates or during the wait can't slip by.
   Protected keys = `collection/host-save.mjs` KEYS ∪ `collectibles/storage.mjs` formal layout
   (incl. `tangzhe-formal-collectibles-v2-original`), minus the tab lock; the script re-reads both
   key tables from source and fails if one is missing. Scope: protected save keys only — not every
   localStorage write, not IndexedDB.
   B is stopped at bootstrap (no `XingTu` / `__tzz`), so the refusal checks are reported as **N/A**
   (not counted as passes, not evidence of refusal).
   Positive controls: page A's buy is seen writing the main save and, separately, the backup; a
   same-value write-back in B is counted once with bytes unchanged; a write to the v2 snapshot key in
   B is counted (same-value if it exists, set+remove if absent).
4. **外星倍率** — 0 / 1 (mars #3) / 7 (six #3 + 回信) alien cards → ×1 / ×1.25 / ×2.75 online rate
   and 2 h offline amount; the legacy `alienCards` field alone does not count; mars at 2 cards = ×1.

Deductions are measured inside one synchronous JS turn (read → click → read), so they are exact;
balances re-read later are reported as `DRIFT` (idle income) in `report-130-<engine>.txt`.
Not covered: iOS frozen background-tab recovery (lockfix takeover) — macOS WebKit can't reproduce it;
losing the lock in an already-running page.

## 测试-139 养成-38 + 星途-02 (`scenarios-139.mjs`)

Same server / save recipe / engines, 390×844, root + `/pet/game/`. CI runs it right after
`scenarios-130.mjs` (that script spawns it; either failing → exit 1; `SKIP_139=1` runs 130 alone), so the
workflow file is unchanged. Report: `report-139-<engine>.txt|json`, screenshots `139-*.png`.

- **⑤a 养成-38 老档** (k_3 already drawn, four shops staffed, no `milestones`), page timezone picked so local
  time is 22:00: loads writable; k_3/k_1 kept; k_3/k_4/k_8 are `STORY_COND_IDS` and not in the box pool; 图鉴
  shows 「提示：」 for the 2 missing ones; 盲盒 page has `#storyCondNote`; the game's actual period is asserted
  `night`; entering 家 grants k_4 + k_8 — read-before → `setTab('home')` → read-after run in ONE synchronous
  `evaluate` (no game tick in between), and coins / draws / pity / daily must be **strictly equal**. A negative
  control repeats that read with an artificial −1 coin after `setTab` (put back right away) and the same
  `costFree()` check must fail with diff −1, else the run fails. Coin drift over a 700 ms idle wait is only
  logged (`COIN DRIFT (not judged)`), never part of the verdict. Refresh keeps all, no duplicates, disk matches.
- **⑤b 养成-38 default** — 养成-38 adds no save field (uses `gacha.owned`), so this checks "not granted by
  default": a fresh save entering 家 at local 13:00 (game period asserted `day`) gets no condition card, also
  after refresh.
- **Boundaries** — every [刷新保留] check calls `persist()` first, so it proves "refresh after save", not "closed
  / killed without saving". Period = same rule as `app.js` `storyPeriod` (root: `home/home-ambience.mjs`
  `homePeriodAt`; pet copy has no such module → inline hour rule; both computed). Not covered: iOS real
  device / background-freeze resume, 夜游食神 real claim (k_3 special-guest popup) and home animations (测试-141),
  firstZombie / firstTDWin sub-game receipts (测试-142).
- **⑥a 星途-02 new game** — `milestones` is `{schemaVersion:1, events:{firstShop: created}}`; a real 雇佣 click
  records `firstEmployee`; refresh and root↔pet keep the ledger byte-identical (memory + disk).
- **⑥b 星途-02 old save** (no `milestones`, `space.ended`) — loads writable with no numeric timestamp; real
  「买下地球」 click commits `earth` time, `firstShop` = null, no `firstZombie` row, 「记录开始之前」/「从有记录起」,
  no horizontal overflow at 390; refresh keeps everything identical.
- **⑥c 星途-02 bad field** — `schemaVersion: 2` → protection notice / blocked, original save bytes untouched.

Not covered: iOS real-device Safari and background-freeze resume; 养成-38 special-guest (k_3) path and the
home animations; 星途-02 sub-game receipts (firstZombie / firstTDWin).

## 测试-141 养成-38 夜游食神 + 家里动画 (`scenarios-141.mjs`)

Same server / save recipe / engines, 390×844, root + `/pet/game/`. Spawned by `scenarios-130.mjs` after 139
(`SKIP_141=1` skips it); workflow file unchanged. Report: `report-141-<engine>.txt|json`, screenshots `141-*.png`.

- **⑦a 收下夜游食神** — old save (four shops staffed, no k_3, on 烧烤摊): `forceSpecial()` → special guest is
  夜游食神 at shop 0 → tap it via `__tzz.hitBig(x, y)` (the canvas tap handler) → comic with 「收下」. Read-before →
  click 「收下」 → read-after in ONE synchronous `evaluate`: k_3 granted once, coins / draws / pity / daily strictly
  equal (the guest's own small reward is paid at the tap, before this window). Negative control: same read with
  an artificial −1 coin must fail `costFree()`. Save-then-refresh keeps k_3 once, disk matches.
- **⑦b 家里动画** (退修 after 熊大 14:22) — local 22:00 (game period asserted `night`), owned k_3 + k_4 + k_7,
  火箭老板 joined. Panda: whole-body walk animation (`storyPandaWalk` / `storyPandaBamboo`) must be `running`, not
  `.still`, and its Web-Animations progress must advance between two samples 1.5 s apart; moon present. First visit
  to 火箭老板's home is observed by sampling for ~7.6 s from the moment of entry (a ~150 ms loop wait, max sampling gap
  not guaranteed — reported as `maxGapMs`; this is a sampled observation, not proof of zero events over the continuous
  window): the non-empty lines must be exactly 「三、二、一——」 then 「……今天先放气球。」 (line 1 immediately, line 2 at
  ~3.6 s); balloons visible with real size, `storyFloat` running, progress / position changing and entering the room;
  at the last sample the balloons are either gone or finished and outside the room (the element may linger in the DOM
  until the next redraw — exact removal at 6.2 s is not asserted). Panda displacement is recorded only; the assertion is
  on animation progress. Leaving and coming back is sampled the same way: no balloons and neither line at any sample.
- **⑦c 火箭老板未加入** — k_7 owned but `homeOpen(rocket) === false`: entering his home is sampled for the full
  ~7.6 s with the same sampling observer (⑦b is its positive control): no balloons and neither countdown line at any
  sample (sampled, not continuous).
- Not covered: iOS real device / background freeze; real touch-coordinate mapping for the guest tap; visual
  quality of animations (only running state + progress/position over time) and the reduced-motion still version; firstZombie / firstTDWin (测试-142).

## 测试-142 星途-02 子游戏回执 (`scenarios-142.mjs`)

Spawned by `scenarios-130.mjs` after 141 (`SKIP_142=1` skips). Part 1 = 打僵尸 `firstZombie`, root only (the pet copy
has no zombie entry → N/A): menu open / locked endless start / menu close record nothing; real `#startBtn` start
records an integer `firstZombie` ≥ `firstShop` with `zombie.cleared` still 0; a defeat and a repeated `started`
message keep the same time; save-then-refresh keeps it in memory + disk. Same path as
`tests/milestones/zombie-browser.py` (Chromium).
r2 negatives (both start from an empty `firstZombie`, each with a positive control on the same memory + disk
observation chain): ⑧c a second tab of the same context waits for the write lock (no `__tzz`) and a standalone
`/zombie/` tab start record nothing, then the lock-owning tab's real start does record; ⑧d the child's `started`
is held back, the run is lost and settled by the parent, then the held `started` is replayed → nothing recorded;
un-holding and starting again records and survives save-then-refresh. Mutation check: removing the parent's
settled/live guards makes ⑧d fail.
r3 (⑧c): the standalone tab C's click is no longer wrapped in an empty catch — C must be shown to really start
(`__zb.EMBED=false`, `G` exists, `!pendStart`, `t>0`) before A is checked; negative control C2 has `#startBtn`
removed and the same start helper must throw.
Part 2 = 塔防 `firstTDWin`, root only (the pet copy has no TD entry → N/A): opening the TD menu, a real `#startBtn`
start alone, a saved defeat (`end(false)`) and closing TD record nothing; a real start + synthetic victory fixture
(`wave=W`, enemies cleared, `end(true)` — same as `td/test_speed_parent.mjs`, NOT natural-balance evidence) whose
result the parent saves (`saveOk`) records an integer `firstTDWin` ≥ `firstShop` with `tdCampaign.highestCleared=1`;
a stage-2 win keeps the same time; save-then-refresh keeps it in memory + disk.

## 测试-153 家宅夜景/黄昏/房名牌 + 顶部金币卡 (`scenarios-153.mjs`)

只测不改游戏代码；`scenarios-130.mjs` 跑完后接着跑（`SKIP_153=1` 可跳过）。root + `/pet/game/`：

1. **夜晚 + k_4**（家宅-148）：四位 CEO × Lv1–3，有窗房型月亮在窗框内、窗 `overflow:hidden`；没窗房型不画；77 的家 k_3 熊猫是静止小摆件（隔 1.5s 不动、无动画）。
2. **黄昏 + k_8**（家宅-150）：同 12 间房，四盏灯在最左那扇窗内、窗裁切、灯有尺寸；没窗房型不画。
3. **房名牌**（家宅-151）：有底图房间 `.rw-name` 不与 `HomeStory.windowsFor` 的任何窗重叠、文字不截断。
4. **顶部金币卡**（体验-149/152）：320/390/420/421/430 × 团单开/关 × 拟声字「叮」/「超超超级暴击！！」，余额 1000.00万亿：金额与「每秒 +X」完整、标签/拟声字不压、无横向滚动（同一次同步 evaluate 写入并测量）。

时段用 `Etc/GMT±N` 把本地时间拨到 22 点 / 18 点并断言；房间等级只改内存态做显示。iOS 真机不在范围内。
本地干跑：`BROWSER=chromium CHROMIUM_PATH=… node scenarios-153.mjs`（8075633 上 111/111；main 6754963 上 74/111，②③④ 能抓到旧问题）。


## 测试-154 家宅-150 合后补验：底图失败 / 黄昏↔夜实时切换 / 减少动态 (`scenarios-154.mjs`)

只测不改游戏代码；`scenarios-130.mjs` 跑完 153 后接着跑（`SKIP_154=1` 可跳过）。root + `/pet/game/`，390×844：

1. **底图加载失败**：`context.route` 拦掉 `art/home_*.webp`，夜晚+k_4、黄昏+k_8 各走四位 CEO × Lv1–3：月亮/街灯都不画、房间照常渲染、0 JS 错误；另判 `.room` 是否退回无底图样子（去掉 `has-art`）。
2. **黄昏↔夜晚实时切换**：同页不刷新，`page.clock.setSystemTime` 把本地时间 18:59:40 → 19:00:05，6s 内街灯换成月亮、旧的街灯窗不残留（c77 Lv3、珍珠 Lv3）。倒拨回 18:59 只记录。
3. **prefers-reduced-motion: reduce**：夜晚+k_3+k_4、黄昏+k_8，12 间房：有窗房型月亮/街灯照常显示、故事层没有 >10ms 的动画、熊猫 1.5s 不动；街灯逐盏亮起的 delay 只记录。

本地干跑：`BROWSER=chromium CHROMIUM_PATH=… node scenarios-154.mjs`（8075633 上 ②③ 全过；① 抓到底图失败时 `has-art` 不掉、有窗房型照样画月亮/街灯——见报告）。

**r2（熊大 10/17 16:53 意见）**：153 每间房先等「本房间那张底图」`complete && naturalWidth>0`（src 含 `home_<who>_<lv>.webp`，证据取加载成功那一刻；家宅 live 模式会定时重绘房间），超时不再吞掉；每间房的室外窗数钉死为 main 2af9076 的 `EXPECTED_WINS`（7 间有窗），缺底图或窗表变动都会红，不会被当「没窗」放过（153 共 159 项）。154 ① 每间房记录该房 `home_<who>_<lv>.webp` 被 route 拦截、`requestfailed`、回退后 `img.room-art` 已撤，再判月亮/街灯与 has-art，不再量到换房前的旧状态（154 共 217 项）。
错误统计口径：`pageerror` 全收；`console.error` 过滤掉资源加载噪声（`Failed to load resource|net::|4xx/5xx|favicon`，① 故意拦图会产生这类）。③ 减少动态是两次采样（隔 1.5s）+ `getAnimations` 快照，不是连续录像。

