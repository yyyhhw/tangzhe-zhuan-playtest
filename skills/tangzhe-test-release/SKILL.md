---
name: tangzhe-test-release
description: 改 tangzhe-zhuan-playtest（挂机经营小游戏）之前、推预览或正式站之前用：回归命令和端口、缓存号/version.json 怎么改、正式站与预览的边界、存档键不能串用、父页扣款存档协议。
---
# 本项目的测试和发布规矩（熊二整理，2026-10-07，基于 13h/13i）

## 1. 仓库和站点
- 仓库 `yyyhhw/tangzhe-zhuan-playtest`，推 `main` 后 GitHub Pages 自动部署，约 1 分钟。推完看线上 `version.json` 变成新版本号才算上线。
- **正式站 = 仓库根目录**（现在 v13）。存档键只有 `tangzhe-save` / `tangzhe-save-bak` / `tangzhe-tab-lock`。
- **预览站 = `preview/`**。存档键 `tangzhe-preview-save`、备份 `tangzhe-preview-save-bak`、多开锁 `tangzhe-preview-tab-lock`。
- 原型/小游戏单独试玩键：`tangzhe-pet-proto`、`tangzhe-zombie-proto`、`tangzhe-td-proto`，只能在各自子页单独打开时用，嵌入父页时一个键都不写，也绝不进根目录。
- 新功能先进 preview，根目录只有杨总给了上线条件才动；改根目录前后都跑 `node test_root_keys.js`（根目录下）。

## 2. 存档键不能串用（硬规矩）
- 根 `app.js` 里不准出现任何 `tangzhe-preview*` 或 `*-proto`；`test_root_keys.js` 会逐字比对根 app.js 和预览 app.js，只允许差在：存档键、`ART_V`/`ART_ONE`、iframe 缓存号。
- 小游戏的升级、进度放进主存档的独立模块，和扣金币在同一次 `E.transact` 里保存，不另开键（熊大 11:49 方案）。
- 旧档没有新模块时要补默认值，不报错、不清别的数据。

## 3. 缓存号和 version.json（每发一版预览都要做）
- `preview/index.html` 里所有 `?v=`、自检脚本里的 `var B='…'`、`preview/version.json` 的 `{"v":"…"}`、`preview/app.js` 里打僵尸 iframe `zombie/?embed=1&v=`，**一起**改成新版本号（如 13i → 13j）。漏一个就会有人拿到旧缓存。
- 子页自己的缓存号（打僵尸现在 `z10`）只在子页文件改了才动。
- 图片：整体号 `ART_V`（预览仍是 `12b2`）不要随便动；只换一张图就在 `ART_ONE` 里给那张单独记号（例：`ceo_c77:'13i'`）。家具正面/侧面图 URL 统一走 `artV()`。
- `preview/pet/game/app.js` 是宠物页的同源副本（路径前缀 `../../art/`），`ART_ONE` / `FURN_SIDE` / 家具 URL 要和主 `app.js` 同步，`test_petgame.js` 会查。

## 4. 父页协议（扣金币、改状态、落盘）
- 一律走 `E.transact(state, { price, apply, save, blocked })`（`preview/economy.js`）：保存失败整档回滚；只读档、多开冻结时一律拒绝。价格只由父页算，子页只发请求不带价。
- 小游戏开局/结算按打僵尸那套：子页开局发 start 带 `runId` → 父页登记 `{runId, ceoId, startedAt, settled}`，用过的 runId 记在 used 表里；结算只认登记过的 runId，一局只结一次，重发返回原结果；统帅/CEO 对不上就拒收；失败回执也带 runId，子页只认精确匹配；4 秒收不到开局回执回菜单。

## 5. 回归（WebKit 模拟 iPhone SE / iPhone 15，不是真机）
本机环境：仓库根起静态服务（例：`python3 -m http.server 49951`），Playwright 用 WebKit。端口是熊二本机的习惯：49951/49941 指向仓库根，49942 是 v12 对照站。端口不同就把 URL 换成自己的。
- `cd preview && node test_economy.js`（13h 534，13i 541）
- `cd preview && node test_coin_safety.js`（522）
- `cd preview/pet/game && node test_petgame.js`（216）；`cd preview/pet && node test_engine.js`（401）
- `python preview/test_playtest.py http://127.0.0.1:49951/preview/index.html`（大套端到端，含家具图）
- `python preview/zombie/test_zombie_embed.py http://127.0.0.1:49951/preview/index.html`（135）
- `python preview/zombie/test_zombie_e2e.py http://127.0.0.1:49951/preview/zombie/`（93）
- 音效 `preview/zombie/test_zombie_sfx.py`：BASE 写死 8765，复制一份改成你的端口再跑（57）
- `python preview/test_shop_entry_13a.py <预览URL> <根URL> <v12站URL>`（115）
- `python preview/test_joint_12e.py http://127.0.0.1:49941/preview/index.html`（20）
- `python preview/test_shop_game_bottom_13h.py`（20）
- 塔防样品：`preview/td/test_td.py`（50）
- 根目录：`node test_root_keys.js`、`node test_economy.js`、`node test_coin_safety.js`
- 数字以最新提交说明里写的为准；数字变了要说明是新增用例还是有东西坏了。

## 6. 推送前检查单
1. 上面相关回归全跑过，贴真实输出的通过数，没跑的写「没跑」，不能写「应该能过」。
2. 缓存号、`version.json`、iframe 号一致；根目录没被误改（`git diff --stat` 看一眼）。
3. iPhone SE / iPhone 15 尺寸各截一张图看排版。
4. 提交说明写：版本号、基准提交、改了哪些文件、回归数字、「根目录不动」或根目录改了什么。
5. 推完核线上 `version.json`，在帖里贴版本号、提交号、预览链接。
