# 打僵尸无尽 TOP10：正式版移植（正式版 15c）

来源：预览 13k-zbtop1 已验收的 preview/zombie（c1da722 + 预览整合时补的 #protoSaveNote）。根目录 zombie/ 在 f597999 与 c1da722 之前的预览逐字相同，所以 zbcore.js / zombie.js / zombie.css / index.html 直接取预览现版本，只改缓存号。

## 缓存号（父页 / iframe / 核心一起换为 15c）
- 根 index.html：`zombie/zbcore.js?v=15c`、`app.js?v=15c`、自刷新 `B='15c'`
- version.json：15c
- app.js：`zombie/?embed=1&v=15c`
- zombie/index.html：zbcore / zombie.js / zombie.css = 15c，zbsfx.js 未改仍 z10
- 塔防（td/*、`td/index.html?embed=1&v=15c`）、economy.js、pet/game 均未改

父页必须同时换 zbcore：父页每次 zbReply 都用 ZB.norm 规整 state.zombie，旧 norm 会丢掉 endTop。

## 存档
- 嵌入经营页：只在 tangzhe-save（及 -bak）的 state.zombie 里多 endTop（≤10 条 {t,kills,id,at}，id = 开局 runId）；endBest 不变；不新增正式 localStorage 键。老档没有榜单时只用 endBest 补 1 条 legacy。
- 单独打开 /zombie/（原型模拟档，不涉及正式金币）：tangzhe-zombie-proto（训练/原型金币/endBest，旧页也读写）+ 新键 tangzhe-zombie-proto-top（榜单）+ Web Locks 锁名 tangzhe-zombie-proto-save。根 /zombie/ 与 /preview/zombie/ 同源，原型键同名、共用。

## 无锁降级（只影响单独打开的原型页）
- 浏览器没有 navigator.locks（iOS Safari < 15.4 等）：保存直接判失败，两个原型键都不写。结算标题「无尽结算（没存上）」，不显示名次，本局那行标「没存上」，提示「当前浏览器无法安全保存」，可点「重试保存」；训练页顶部显示 #protoSaveNote。训练升级和原型金币同样不存（同一个原型存档）。
- 锁等待超过 3 秒：按保存失败处理，可重试。
- 嵌入经营页不走这条路，仍用经营页原有的保存事务。

## 测试
- node zombie/test_zbtop.js（规则）
- 仓库根起 http.server 后：PLAYWRIGHT_MODULE=… ZB_TEST_BASE=http://127.0.0.1:端口 node zombie/test_zbtop_browser.mjs（旧页 = git show f597999:zombie/，挂在 /zombie-old/；ZB_OLD_REV 可改）
- 同上 + ZB_TEST_OUTPUT=目录 node zombie/test_zbtop_layout.mjs（320/375/393，原型页 + 根经营页嵌入）
- python3 zombie/test_zombie_e2e.py http://127.0.0.1:端口/zombie/；python3 zombie/test_zombie_embed.py http://127.0.0.1:端口/index.html

正式经营页的榜单兼容副本为 state.zombieEndTopV1，与主存档同次提交；旧经营页清洗 zombie 后，新页可恢复这些记录。不会恢复金币或整份旧档；建立副本前已全部丢失的记录无法重建。独立原型的正式/预览页面仍共享原型键。
