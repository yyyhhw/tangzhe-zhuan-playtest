# 交接说明（13i，熊二 → 熊大，2026-10-07）

杨总 11:47 安排：熊大接手后续开发，熊二用剩余额度做独立复核。13i 是交接点，之后熊二不再改 preview 源码。

## 仓库和发布
- 仓库 `yyyhhw/tangzhe-zhuan-playtest`，`main` 推上去由 GitHub Pages 自动部署（约 1 分钟）。
- 正式站 = 根目录（现在是 v13，存档键 `tangzhe-save`）；预览站 = `preview/`（存档键 `tangzhe-preview-save`、备份 `-bak`、多开锁 `tangzhe-preview-tab-lock`）。
- 预览专用的键不能进根目录 `app.js`；`test_root_keys.js` 会把根 `app.js` 和预览 `app.js` 逐字对比（只允许换键、`ART_V/ART_ONE`、iframe 缓存号）。
- 板砖塔防样品的 `tangzhe-td-proto` 只给 `preview/td/` 单独试玩用，不进父页、不进根目录。

## 缓存号规矩
- 每发一版预览：`preview/index.html` 里所有 `?v=`、`preview/version.json`、`app.js` 里打僵尸 iframe `zombie/?embed=1&v=` 一起改成新版本号；打僵尸子页自己的缓存号（现在 z10）只在子页改动时才动。
- 图片：整体 `ART_V`（预览仍是 12b2）；只换一张图时在 `ART_ONE` 里给那张单独记缓存号（13i：`face_c77:'12d2'`、`ceo_c77:'13i'`、`furn_otaku_panel_lamp:'13i'`），不动整体号。家具正面 / 侧面图 URL 都走 `artV()`。
- `preview/pet/game/app.js` 是宠物页用的同源副本（路径前缀 `../../art/`），`ART_ONE` / `FURN_SIDE` / 家具 URL 要和主 `app.js` 同步，`preview/pet/game/test_petgame.js` 会查。

## 父页协议
- 所有扣金币 + 改状态 + 落盘统一走 `E.transact(state, { price, apply, save, blocked })`（`preview/economy.js`）：`persist()` 失败整档回滚；只读 / 多开冻结时一律拒绝。
- 打僵尸：子页开局发 `zb:'start'`（带 runId），父页按当时在任 CEO 登记 `zbRun = { runId, ceoId, startedAt, settled }`，`zbUsedRuns` 记住用过的 runId（重发返回原记录，已用过的拒绝）；结算只认这份 `zbRun`，runId / ceo 对上、一局只结一次，中途调岗不误伤；失败回执也带 runId，子页只认精确匹配。静音状态随 `zbReply` 下发（`muted`）。
- 塔防按熊大 11:49 方案：升级数据放主存档的独立模块，和扣金币同一次 `E.transact` 保存。

## 测试（本机 `/workspace/tzz-pet`，Python venv `/workspace/.pwvenv`，静态服务 49951 / 49941 都指向仓库根）
- `cd preview && node test_economy.js`（13i：541）
- `cd preview && node test_coin_safety.js`（522）
- `cd preview/pet/game && node test_petgame.js`（216）；`cd preview/pet && node test_engine.js`（401）
- `python preview/test_playtest.py http://127.0.0.1:49951/preview/index.html`（大套端到端，含 12c2/13i 家具图；13i：572）
- `python preview/zombie/test_zombie_embed.py http://127.0.0.1:49951/preview/index.html`（135）
- `python preview/zombie/test_zombie_e2e.py http://127.0.0.1:49951/preview/zombie/`（93）
- 音效 `preview/zombie/test_zombie_sfx.py` 的 BASE 写死 8765，要复制一份把端口改成 49951 再跑（57）
- `python preview/test_shop_entry_13a.py <预览> <根> http://127.0.0.1:49942/index.html`（115，第三个参数是 v12 站）
- `python preview/test_joint_12e.py http://127.0.0.1:49941/preview/index.html`（20）
- `python preview/test_shop_game_bottom_13h.py`（20）
- 根目录守卫 `node test_root_keys.js`（14），正式站存档键 / 缓存号不被预览串改。
- 全部是 WebKit 模拟 iPhone，不是真机。

## 待办（交给熊大）
- 宠物：猫首样（熊大 11:41 动作规格）+ 每房最多 2 只、两个宠物位 + 拥有列表（11:44 规格）；之后羊驼 / 机器人 / 小熊猫，幼年大熊猫保留在后续清单。
- 塔防：板砖 `devin/td-sample`（04e717b）父页接入，熊大负责。
- 沙发侧面图：三张图比例 1.74–2.40，按 12c2 规格「1 格宽、贴底」显示时盖住竖放 3 格里的下面约 2 格；要占满 3 格需要高宽比 ≥3 的图。
- 正式站仍是 v13；预览里的四位 CEO、打僵尸、音效、13i 补项都还没上正式站。真 iPhone 音效实听等杨总。
