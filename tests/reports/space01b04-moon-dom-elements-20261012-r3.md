# 星途01b04 r3：实际DOM元素类型窄修（仅候选）

父SHA：6177f51a40d6a92b72aba6687e7ef310b12eeb7b。main：3a96a86a1c854bd681c0ff033de1e71ef724640e。

## 实际根因及修订

r2 usable()沿parentNode经过html后到Document，未区分nodeType，继续调用getComputedStyle(Document)。严格Element签名+html→Document模型实际复现TypeError: getComputedStyle requires Element。

r3遇非元素节点即终止祖先检查，不向Document调用样式或属性API；原简化测试节点缺nodeType的兼容分支只服务旧模型，真实DOM均有nodeType。另overlay渲染异常只通过既有host.close()清理已开状态/计时/背景inert，清理期间禁还焦防止重复错误，然后重新抛出原错误。不吞事务错误、不改host、不开新设计。

space/host、moon、domain、real-page-facade、card-coordinator及root/preview/rootpet app与r2字节完全一致。奖励、门槛、锁、存档、dirty和卡牌冻结保持。

## 缓存精确分流

只将r2可访问性token替换为space01b04-moon-accessibility-20261012-r3：root/preview/rootpet version与HTMLbootstrap URL→两bootstrap production entry URL→entry overlay URL。overlay真实bytes/SHA256 pin更新；host/art/styles及其它未改资源保留原r1地址。strict fixtures仅更新这些精确期望，新增旧r2 overlay URL负控。没有修改生产main或发行。

## 本轮验证

全部Node v24.19.0 / VM / 模拟DOM、Storage、lease；不是真实浏览器。

- `node --experimental-vm-modules --test --test-isolation=none tests/moon/*.test.mjs`：112通过/0失败/0跳过（r2原106＋新增6）。其中实际overlay测试18项（原12＋新增6），同命令组内执行。
- 相同命令 `tests/space01a/*.test.mjs`：123通过/0失败。
- 相同命令 `tests/wearables8/*.test.mjs`：141通过/0失败。
- 新增6：严格Document祖先完整open/focus/Tab/还焦链；异常清理及重开；反射inert非空原值/重复开关；祖先display/visibility/hidden/inert；body来源焦点；阶段按钮消失焦点回稳定close。原稳定节点、计时、freeze/pagehide/BFCache保护不退。
- 严格2例导入r2实际overlay：0通过/2失败，错误含上述TypeError。Node probe，不冒称浏览器。
- 固定19入口逐项`node <path>`：r2与r3均12成功/7旧失败；另3聚合旧失败。完整命令、准确逐文件退出码见tests/moon/r3-comparison.json。
- 7旧失败：test_economy.js、test_coin_safety.js、td/test_tdhost.js、td/test_td_bridge.js、td/test_td_protocol.js、preview/td/test_tdhost.js、preview/cards/tests/save.test.mjs；既有缓存/保存fixture、握手/TD依赖和未来版本旧断言范围不变。
- 3聚合旧失败：test_root_keys.js、pet/game/test_petgame.js、preview/pet/game/test_petgame.js。
- `node --check space/overlay.mjs`通过；r2本地1003 blob与远端tree逐一一致，保护模块字节一致、无删除。

真实Chromium/WebKit尚未执行，待独立QA核最终r3。未安装软件、未重试受限浏览器或公开路线，未发Slack；不把Node/DOM模拟当真实浏览器或全仓CI绿。

## 相对r2完整路径

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
- `tests/moon/r3-comparison.json`
- `tests/moon/resources.test.mjs`
- `tests/reports/space01b04-moon-dom-elements-20261012-r3.md`
- `tests/wearables8/evidence-lifecycle.test.mjs`
- `tests/wearables8/resource-chain.test.mjs`
- `version.json`
