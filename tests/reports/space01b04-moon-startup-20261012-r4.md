# 星途01b04 r4：重复descriptor启动阻断窄修（仅候选）

父SHA：5fa680402c59a62fd393f59ac89e920bbd51e2f6。main：3a96a86a1c854bd681c0ff033de1e71ef724640e。

## 根因及最小diff

root app TD组原先先定义zbOpen，默认configurable:false；后方僵尸组再次定义zbOpen，实际必抛Cannot redefine property: zbOpen。preview同样。root是async IIFE，preview是sync IIFE；完整源码测试分别观察外层promise/同步错误，没有抽取单个函数或删除启动代码。

仅删除两个TD组中的提前zbOpen descriptor。保留后方唯一getter、默认nonconfigurable、TD/僵尸/星途互斥。root另一处改动仅旧HTML保护版本token。没有修改host、事务、奖励、门槛、经营时钟、存档/锁。

r3实际完整源码对照（root、preview、pet各P1/P2）：四个root/preview用例均失败Cannot redefine property: zbOpen，pet两例通过。新回归再插回旧descriptor的负控复现openZombie/closeZombie已注册，而zbCeo/zbLastCeo/zbRun/openAssignTo/zbReply及末尾钩子未注册。

## 本轮验证归属

Node v24.19.0，实际完整app源码在VM执行；DOM、canvas与不运行的scheduler模拟；存档/coordinator/隔离P1/P2由实际生产bootstrap模块装配。观察外层IIFE返回值，不移除或抽取app业务代码。经典TD依赖为实际源码。此证据不是真实父页浏览器、视觉/绘制或持续帧调度验收。

- `node --experimental-vm-modules --test --test-isolation=none tests/moon/*.test.mjs`：129通过/0失败/0跳过（原112＋新增9完整启动/缓存＋新增8焦点fallback）。
- 相同命令 `tests/space01a/*.test.mjs`：123通过；`tests/wearables8/*.test.mjs`：141通过。
- 新增9：root/preview P1/P2完整启动4例、pet P1/P2完整启动2例、重复descriptor负控2例、真实app缓存引用负控1例。
- 四正式root/preview完整启动均断言openTD/closeTD/tdOpen、openZombie/closeZombie/zbOpen/zbCeo/zbLastCeo/zbRun/openAssignTo/zbReply、xingtuContext/共享保存钩子、末尾render_game_to_text/advanceTime、pet Esc与storyReplay Esc注册；唯一zbOpen不可配置，实际开关getter与阻止同时TD打开有效。完整启动后安装实际overlay并确认XingTu及持锁；pet合同不抛。
- 追加焦点修复后再次完整重跑三组及固定19入口/3聚合，原基线失败身份保持。原19项缓存定向复核也通过。
- 固定19入口逐项`node <path>`：r3/r4均12成功/7同基线失败；另3聚合旧失败。详见tests/moon/r4-comparison.json。不是全仓/CI全绿。
- 7旧失败：test_economy.js、test_coin_safety.js、td/test_tdhost.js、td/test_td_bridge.js、td/test_td_protocol.js、preview/td/test_tdhost.js、preview/cards/tests/save.test.mjs。类别仍为旧缓存/保存fixture、握手/TD依赖、未来版本旧断言。
- 3聚合旧失败：test_root_keys.js、pet/game/test_petgame.js、preview/pet/game/test_petgame.js。
- root/preview语法检查通过。r3本地全1005 blob与远端父tree逐一一致，无删除；host/moon/domain/facade/coordinator/pet app/经济字节不变。

早期DOM/canvas模型缺query节点及getImageData，已补模拟接口以执行完整代码；不当产品FAIL。strict缓存期望针对root新token与pet旧token分别更新，不删安全断言。

真实Chromium/WebKit最终SHA由独立板砖验收。本作者未启动受限浏览器、未安装软件、未访问受限公开路线、未发Slack；未合main/部署。

## 缓存与pins

新变更链token：space01b04-moon-startup-20261012-r4。root/preview/rootpet version与HTML bootstrap URL→两bootstrap production/QA entry URL→root/preview app import URL。bootstrap正常/QA legacy分支的root/preview app URL亦精确升级；qa-protocol2 entry现有root app URL同步升级，未增加入口或玩法。

rootpet共用已改bootstrap因此升级祖先，但pet app内容/URL维持原r1。变更overlay升级r4 URL，host/art/styles及事务模块仍r1；发行COLLECTIBLES_RELEASE和未改资源不变。dependency-pins仅更新overlay实际bytes/hash，其余pin保持原值且实际hash断言仍通过。新增旧app URL负控捕获混载，literal import与实际动态加载检查继续严格执行。

## 同轮追加的最小焦点修复

出航后的经营重画可能替换原发射台按钮。closeView先恢复背景原inert，再优先向仍可用原source还焦；仅当原source已脱DOM且匹配button[data-act="xingtu"]，找当前唯一匹配且usable的入口。非隐藏/非撤销/非blocked/非readOnly及现有host只读view的SPACE_SESSION_REVOKED保护均满足才执行。没有导航、切店或新入口，不改host实现或交易/hooks。

新增8例：替换入口正常还焦、invalidate、readOnly、无匹配、多匹配、隐藏、禁用、普通非星途source拒绝fallback。overlay DOM文件共26项通过；真实浏览器焦点仍交板砖验最终SHA。

## 相对r3完整文件清单

- `app.js`
- `collectibles/entry.mjs`
- `collection/bootstrap.mjs`
- `index.html`
- `pet/game/index.html`
- `pet/game/version.json`
- `preview/app.js`
- `preview/collection/bootstrap.mjs`
- `preview/index.html`
- `preview/td/test_td_bridge.js`
- `preview/version.json`
- `qa-protocol2/dependency-pins.json`
- `qa-protocol2/entry.mjs`
- `space/overlay.mjs`
- `tests/formal/carefree-bgm.test.mjs`
- `tests/formal/copy52-display.test.mjs`
- `tests/formal/tea-entry-cards-out.test.mjs`
- `tests/moon/full-app-startup.test.mjs`
- `tests/moon/overlay-dom.test.mjs`
- `tests/moon/r4-comparison.json`
- `tests/moon/resources.test.mjs`
- `tests/reports/space01b04-moon-startup-20261012-r4.md`
- `tests/wearables8/evidence-lifecycle.test.mjs`
- `tests/wearables8/production-entry.test.mjs`
- `tests/wearables8/production-harness.mjs`
- `tests/wearables8/resource-chain.test.mjs`
- `version.json`
