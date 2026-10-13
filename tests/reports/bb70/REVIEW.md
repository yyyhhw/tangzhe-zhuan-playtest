# 盲盒-70 候选 r2（按熊大阻断审改）

基线：线上 main `d16904e8a89f3a18bc40934ff723e4dc81def418`（退出保存/pagehide 修复）。分支 `xiong2/bb70-launch-notice-on-d16904e`，资源标识 `bb70-launch-notice-20261013-r2`。未合 main、未部署、未碰 v10a。旧候选 da5b8b4（基 7ce857d）作废。

## 三项阻断
1. 基线：从 d16904e 新开分支，只移植 70 的功能块（app.js / pet/game/app.js / style.css ×2 / tests/bb70），缓存号统一换新、pins 重算。`registerPageHide(onHide)`、entry.mjs 同步 pagehide 保存全部保留；lifecycle-save / autosave15 完整性测试全过。
2. 「去开盲盒」：只有真实保存确认成功（atomic→txn→persist→coordinator.commit ok）才关框、跳盲盒页、写 seen/visit。失败/未知：结算框留着、三个领取按钮锁住、横条改为「这次领取没有确认到账，先不去盲盒页。请按存档提示核对，不要重复领取。」+「知道了」（只关框）；不写标记、不自动重领。同一结算框只发起一次领取（双击/两按钮连点不重领）。普通「直接领取 / 双倍」行为不变（仅加同框只领一次）。
3. 弹窗队列：上新弹窗轮到时若已看过/不该弹，会把队列推给下一个（bb70SkipQueued），开盒揭晓不再卡住。

## 证据
- `bb70-tests.txt`：45 项。`claim-protocol.test.mjs` 24 项=（app.js、pet/game/app.js）×（P1 保留、P1→P2 升级、已是 P2）×（成功+刷新、备份写失败+刷新、主档读回未知+刷新、双击）。使用生产 entry/coordinator 与从发布文件抽取的真实 atomic/txn/persist；DOM/锁/存储为合成模型（非浏览器证据）。`launch-notice.test.mjs` 21 项含真实 queueModal/closeModal/boot 排队行的完整顺序：离线领取→已看上新跳过→未看揭晓。
- 反向对照：把 70 块换回 da5b8b4 旧代码 → claim-protocol 9/12 失败（失败/未知/双击）；去掉跳过修复 → 队列顺序 2 项失败。
- `node-tests.txt` 247/247（lifecycle-save、wearables8、blindbox18、autosave15、bb70）；`formal-tests.txt` 91/91。
- `chromium390-success.json`：Chromium 390，正式页与 pet/game 页，P1 fixture 升级后离线结算出现横条→点「直接领取，去开盲盒」→到盲盒页、两个标记写入、pending 清空、无页面错误。
- `chromium390-backup-fail.json`：同上，页面内注入备份键写失败后点「去开盲盒」→结算框保留、按钮锁、无标记、仍在经营页、存档保护面板出现、主档原文不变。

## 未做 / 边界
- 预览（preview/app.js）没有实现 70，只换了缓存号；本候选不声称预览完成。
- 根目录旧守卫 `test_root_keys.js` 在 main 上已有 8 项失败；本候选同为 8 项，但「谁写 localStorage」一行的列表多了 app.js、pet/game/app.js（70 的两个本机标记，按设计不进存档）。
- 只测 Chromium；无 WebKit/Firefox、无真机。王大妈三条非阻断建议（首玩不弹/句号/双倍按钮防误点）未实现；失败提示新文案请王大妈过目。
