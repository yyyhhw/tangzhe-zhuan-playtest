# 星途01b04 窄UI修订r2（仅候选）

父提交：4c51294a783b5d62cfb02297e3ed5086ffe5aa5d；main基线：3a96a86a1c854bd681c0ff033de1e71ef724640e。无合并、部署或浏览器执行。

实际根因：r1 render每次清空panel，关闭控件被计时刷新替换；没有焦点移入、圈定、还焦或背景隔离。

修订保留header/close；相同显示阶段只更新倒计时、progress及原SVG飞船transform。阶段或会话token改变仅重建内容；焦点控件消失时回到稳定close。保存打开来源焦点，双向Tab圈定可用控件；正常关闭仅向仍连接、启用、非隐藏/inert的来源还焦。背景原inert属性和值逐项恢复。freeze通过真实app blocked门禁阻止还焦；pagehide/BFCache显式撤销还焦，旧host回调仍被原generation门禁拒绝。

space/host.mjs、moon.mjs、domain.mjs、real-page-facade、card-coordinator和三正式app与r1字节一致。事务、奖励、门槛、存档/锁/dirty均未改；卡牌冻结。

缓存只改必要祖先：正式root/preview/rootpet version及HTMLbootstrap URL → 两bootstrap的production entry URL → entry的overlay URL，统一space01b04-moon-accessibility-20261012-r2。未改资源仍用原r1 token；overlay import的host/art/styles也仍为原r1。真实overlay bytes/hash pin已更新。资源断言精确区分两个token，新增旧overlay URL负控；无泛化放行或删除安全断言。

## 本轮实际测试

Node v24.19.0 / VM模块 / 模拟DOM、Storage、lease，不是真实浏览器。

- `node --experimental-vm-modules --test --test-isolation=none tests/moon/*.test.mjs`：106/106，通过；原94与新增12分开计数。
- 同命令 `tests/space01a/*.test.mjs`：123/123通过。
- 同命令 `tests/wearables8/*.test.mjs`：141/141通过。
- 新overlay DOM模块11例：移焦、稳定close、计时保焦、双向Tab、正常还焦、脱离/禁用/隐藏/inert来源、背景原状态、重复打开关闭、freeze/pagehide/BFCache旧回调0写、阶段切换。另1例严格缓存负控及pin。
- 同一11 DOM例导入r1实际overlay：3通过8失败；r2全通过。为Node格式/DOM模拟，不冒称两引擎。
- 固定19入口逐项 `node <file>`，r1/r2均12成功7失败；完整清单见tests/moon/r2-comparison.json。3聚合均仍失败。
- `node --check space/overlay.mjs`通过；保护模块字节比较、无删除检查通过。

首次单文件组未启用VM模块，报vm.SourceTextModule is not a constructor，已按r1报告显式启动参数纠正；不归因产品。版本改动引起的strict fixture期望已窄更新，保留断言。

7同基线失败：test_economy.js、test_coin_safety.js、td/test_tdhost.js、td/test_td_bridge.js、td/test_td_protocol.js、preview/td/test_tdhost.js、preview/cards/tests/save.test.mjs。既有缓存/保存fixture、握手/TD装载和旧未来版本断言类别不变。3聚合旧败：test_root_keys.js、pet/game/test_petgame.js、preview/pet/game/test_petgame.js。不声称全仓/CI绿。

真实Chromium/WebKit键盘、原生inert与读屏验收待独立复核方完成。本轮未重启受限浏览器、未安装软件、未访问受限公开路线、未发送Slack。

## 相对r1完整路径

- `collectibles/entry.mjs`
- `collection/bootstrap.mjs`
- `index.html`
- `pet/game/index.html`
- `pet/game/version.json`
- `preview/collection/bootstrap.mjs`
- `preview/index.html`
- `preview/td/test_td_bridge.js`
- `preview/version.json`
- `qa-protocol2/dependency-pins.json`
- `space/overlay.mjs`
- `tests/formal/carefree-bgm.test.mjs`
- `tests/formal/copy52-display.test.mjs`
- `tests/formal/tea-entry-cards-out.test.mjs`
- `tests/moon/overlay-dom.test.mjs`
- `tests/moon/r2-comparison.json`
- `tests/moon/resources.test.mjs`
- `tests/reports/space01b04-moon-accessibility-20261012-r2.md`
- `tests/wearables8/evidence-lifecycle.test.mjs`
- `tests/wearables8/resource-chain.test.mjs`
- `version.json`
