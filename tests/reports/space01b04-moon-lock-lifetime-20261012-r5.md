# 星途01b04 r5：锁外层生命周期窄修（仅候选）

父SHA：9ff50e1b30c527377cedc1acd22ad95fead5d2a5。main：3a96a86a1c854bd681c0ff033de1e71ef724640e。

## 根因证据与最小修法

实际collectibles entry只在request回调内部finally撤销lease；回调等待lifetime时，原生steal可拒绝外层request而不结束回调waiting promise。472349b基础亦有潜在问题，不是r4新引入；违反本候选失锁拒绝合同。

本轮实际读取W3C Web Locks规范源码：https://raw.githubusercontent.com/w3c/web-locks/main/index.bs 。第230/231行区分回调waiting promise与request released promise；第608–612行steal从held set移除旧锁并以AbortError拒绝released promise。这里不是浏览器执行证据。用户给出的板砖Chromium/WebKit复现与7104收尾事实为外部证据；Slack附件F0C8PF3Q2RY、F0C8JBCAA05本轮未读取，不声称看过附件。

entry内外finally共用一次性cleanup。先owns=false令lease即时失效，再调用既有revoke关闭current、facade、abort与lifetime；随后invalidate星途并移除foreign listener。正常release/异常/steal重复到达只清理一次。无locks.query轮询、自动重取锁/续写、奖励重放或盘面回滚。交易核心、奖励、存档格式/白名单/源证据保护均不改；在途保留。

## 实际验证与边界

Node v24.19.0 / VM，模拟DOM、Storage、Web Locks语义；不是本作者真实浏览器或原生双页验收。

- `node --experimental-vm-modules --test --test-isolation=none tests/moon/*.test.mjs`：148/148通过，0跳过（原129＋失锁/缓存/旧版反例15＋fixture4）。
- 相同命令 `tests/space01a/*.test.mjs`：123/123通过；`tests/wearables8/*.test.mjs`：141/141通过。
- 失锁模型明确将request外层Promise拒绝，而已grant回调继续等待lifetime。root/rootpet共享formal锁名称，preview独立锁；ready/flying/arrived的普通persist及出航/领取旧回调0写，来源/在途/其它键不变。第三方写入的原文字节旧页不能覆盖。
- waiting拒绝后强行迟到回调、延迟classic加载后回调不得安装app/runtime/XingTu；正常release、重复撤销幂等，storage listener解除。已有141组的启动/display/app import拒绝与升级确认边界保持。
- 两个formal/preview负控执行tests/moon/fixtures/entry-r4-source.mjs.txt的精确r4源码：outer AbortError拒绝但callback还等待，ownsLock仍true，普通persist和出航实际写入。该.txt只被测试override装载，未加入生产import，不恢复旧产品或卡牌。
- 固定19入口逐项`node <path>`：r4/r5均12成功/7旧失败；另3聚合旧失败，详见tests/moon/r5-comparison.json。不推断CI或全仓绿。
- 7旧失败：test_economy.js、test_coin_safety.js、td/test_tdhost.js、td/test_td_bridge.js、td/test_td_protocol.js、preview/td/test_tdhost.js、preview/cards/tests/save.test.mjs。
- 3聚合旧失败：test_root_keys.js、pet/game/test_petgame.js、preview/pet/game/test_petgame.js。
- entry语法检查通过；父r4本地全1008 blob与远端tree逐一一致、无删除。三app、overlay/host/moon/domain、facade/coordinator、经济及pins字节一致。

真实两引擎原生双页steal、实际BFCache、页面离线控制仍由板砖对最终SHA增量验收。未启动受限浏览器、安装软件、绕路或发Slack；未合main/部署。

## Freeze术语与缓存

只修改space/MOON-ROUNDTRIP.md：app.freeze()与storage冲突已invalidate；不等于document浏览器freeze事件。没有新增freeze监听/恢复。Node persisted-pageshow模型不代表真实BFCache覆盖。

只改entry及必要祖先至space01b04-moon-lock-lifetime-20261012-r5：root/preview/rootpet version与HTML bootstrap URL→两bootstrap production entry URL。app、QA entry、overlay保持r4 URL；事务/原资源保持原token。entry不在既有dependency-pins覆盖表，所有已pin模块未改，pins保持原值且hash断言通过。新旧entry URL负控与完整literal/动态加载资源检查保持精确。

## 非生产离线fixture交付

tests/moon/OFFLINE-P2-QA.md给安全使用说明，generate-offline-fixtures.mjs可按真实Date.now重新生成四份formal/preview × offline/pending key/value bundle。预生成文件位于tests/moon/fixtures/offline-p2/。

用实际P1 coordinator→migration/codec→44域P2 validator/owner生成，不手改P2身份或不可变snapshot；pending经真实Economy.settleOffline+正常commit产生。source/original/snapshot字节保留。只在全新空存储隔离context安装，绝不清档或覆盖真实用户资料；formal可root/rootpet，preview仅preview，previewpet不迁移。

4例实际生产模块链：合法P2可启动、正常离线产生pending、pending拒绝月面、合法领取按真实amount入账一次、重复领取0额外金币，普通persist成功且不可变证据全不变。Node时钟只替Date.now，并保留真实Date构造器；不加入生产时钟/debug后门。浏览器保持原生真实时钟，不通过persist倒写lastSeen。7104轮已收尾，其离线仍PENDING；这些是增量复测材料，不声称旧轮在进行或已通过。

## 相对r4完整路径

- `collectibles/entry.mjs`
- `collection/bootstrap.mjs`
- `index.html`
- `pet/game/index.html`
- `pet/game/version.json`
- `preview/collection/bootstrap.mjs`
- `preview/index.html`
- `preview/td/test_td_bridge.js`
- `preview/version.json`
- `space/MOON-ROUNDTRIP.md`
- `tests/formal/carefree-bgm.test.mjs`
- `tests/formal/copy52-display.test.mjs`
- `tests/formal/tea-entry-cards-out.test.mjs`
- `tests/moon/OFFLINE-P2-QA.md`
- `tests/moon/fixtures/entry-r4-source.mjs.txt`
- `tests/moon/fixtures/offline-p2/formal-offline.json`
- `tests/moon/fixtures/offline-p2/formal-pending.json`
- `tests/moon/fixtures/offline-p2/preview-offline.json`
- `tests/moon/fixtures/offline-p2/preview-pending.json`
- `tests/moon/generate-offline-fixtures.mjs`
- `tests/moon/lock-lifetime.test.mjs`
- `tests/moon/offline-fixture.mjs`
- `tests/moon/offline-fixture.test.mjs`
- `tests/moon/r5-comparison.json`
- `tests/moon/resources.test.mjs`
- `tests/reports/space01b04-moon-lock-lifetime-20261012-r5.md`
- `tests/wearables8/evidence-lifecycle.test.mjs`
- `tests/wearables8/production-harness.mjs`
- `tests/wearables8/resource-chain.test.mjs`
- `version.json`
