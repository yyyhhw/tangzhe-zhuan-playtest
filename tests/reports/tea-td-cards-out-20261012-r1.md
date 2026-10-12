# 奶茶塔防入口 / 卡牌战斗移出本体候选

基线：`c9a6cda4d92e76207cc469d9d2eaa147489c31ed`。只候选，未合 main / 未部署。不包含 54、64、67。

## 实现与数据边界

- root 和 preview 的 shopGameCard、openTD、TDHost.blocked 同时从 shop 3 移到 shop 1，只要求既有奶茶店开张；不更改开店经济条件。
- root 保留协议3、tdCampaign、td50、tdUpgradeReceipts；preview 保留自身旧协议/state.td。TD 引擎、画法、难度、经济、历史规则逐字节不变；未处理塔防6卡顿。
- root/preview 移除复数 cards 动作、战斗卡片、iframe、MessageChannel/消息处理、关闭计时器及战斗音频互斥；保留单数 card 故事收藏/集齐奖励。
- 正式 pet 无战斗入口，仅修订共享 bootstrap 的 app 缓存与失配恢复 token；preview pet app/economy/storage 键未改。
- 删除 root/preview 战斗 app.mjs 两份及 118 个专用 CSS/图像/音频发布资源；保留纯源码格式/保存工具与既有安全断言以核验旧档兼容。没有任何经营启动路径加载这些保留工具。
- root/preview 的 cards/index.html、cards/ui/index.html（覆盖目录默认页）及 art-preview.html 均为静态同渠道返回页，无脚本/iframe/storage；target=_top 退出旧 iframe。
- collection/bootstrap、host-save、host-wallet、model 的共享协调器、锁、storage 白名单、鉴权及钱包开关均保留；bootstrap 只修改 app URL token。没有清档、删除迁移或 save schema 变更。
- 精确远端备份 codex/cards64-owned-retry-on-9ad9000-20261012-r1@236c170c2bb224cd1be931b1c7c1aecc7e1947a8 已读 ref 与完整未截断树，包含所有删除路径；除 app.mjs 与 battlefield.css 为64授权修订外，其余删除对象与 c9 字节相同。c9 原版全部源码另可从本候选父 commit 恢复。未修改任何卡牌独立分支。

## 缓存闭环

组合 token：`tea-td-cards-out-20261012-r1`。四入口 version/B 分别为 formal-/preview- + token。

root index → collection/bootstrap?v=token → root app?v=token；正式 pet index → 同 bootstrap → pet/game/app?v=token。preview index → preview bootstrap?v=token → preview app?collectionHost=1c&v=token；preview pet 无变动脚本沿用原资源 token，仅 version/B 发布祖先更新。root/preview index 的 TDHost URL 用新 token。两个父页 TD iframe URL 用新 token；TD index 内未修改的 CSS、菌体 JS、协议依赖继续保留 c9 精确缓存 token。未平铺 preview。52 显示测试只更新版本期望和未修改 preview pet app 的精确 token，未削弱显示断言。

旧已打开/离线全缓存页面不受服务端即时控制；重新请求退役页无战斗加载，重新请求已删除 battle app 返回缺失。未要求清除用户缓存或数据。

## 可复现验证（仅 Node/VM / 静态 / 隔离内存）

在仓库根对每个以下路径执行 `node PATH`；各文件单独进程，记录原始非零退出。固定 c9 基线与候选同命令，未映射 preview 为 formal。不是67全清单。

| 路径 | c9 exit | 候选 exit |
|---|---:|---:|
| `tests/formal/protocol.mjs` | 0 | 0 |
| `tests/formal/economy-v2.test.mjs` | 0 | 0 |
| `tests/formal/td-receipts.test.mjs` | 0 | 0 |
| `tests/formal/td-fc2.test.mjs` | 0 | 0 |
| `tests/formal/fc2-archive.test.mjs` | 0 | 0 |
| `tests/formal/copy52-display.test.mjs` | 0 | 0 |
| `tests/formal/carefree-bgm.test.mjs` | 0 | 0 |
| `test_economy.js` | 1 | 1 |
| `test_coin_safety.js` | 1 | 1 |
| `td/test_tdhost.js` | 1 | 1 |
| `td/test_td_bridge.js` | 1 | 1 |
| `td/test_td_protocol.js` | 1 | 1 |
| `preview/td/test_tdhost.js` | 1 | 1 |
| `preview/td/test_td_bridge.js` | 1 | 0 |
| `cards/tests/save.test.mjs` | 0 | 0 |
| `cards/tests/saved-decks.test.mjs` | 0 | 0 |
| `preview/cards/tests/save.test.mjs` | 1 | 1 |
| `preview/cards/tests/saved-decks.test.mjs` | 0 | 0 |

准确分母：共同18个入口，c9=10成功/8失败，候选=11成功/7失败。preview bridge 必要奶茶 fixture/代码块定位/精确当前缓存期望更新后6项成功；其余7失败身份与基线相同，未删除断言。

新增 `node tests/formal/tea-entry-cards-out.test.mjs`：1入口、8用例成功。合计候选19入口=12成功/7失败。新用例涵盖实际 parent openTD/shopGameCard 函数 VM、错误 origin 不授端口、奶茶未开/已开而科技未开、正式真实 TDHost handshake/只读/close reset、preview旧协议、全部旧深链静态退役、四入口实际引用、真实 coordinator 内存盲盒交易与旧档/历史保留。

隔离内存逐字节 sentinel 包括 tangzhe-{formal|preview}-card-save、-tmp/-bak/-quarantine 与 tangzhe-{formal|preview}-card-decks-v1。仅合成数据，无真实用户存档。协议19用例成功覆盖写入失败/不确定读回/锁丢失/未来档/原档保护，以及真实钱包 PREPARED→失败→重载恢复、防重复扣款和禁用交易负控。TD receipts/fc2 覆盖实际保存重试幂等及50关历史；不是 stub persist=true。

语法：`node --check` app.js、preview/app.js、pet/game/app.js、td/tdhost.js、preview/td/tdhost.js 全成功。

`node --test tests/formal/tea-entry-cards-out.test.mjs` 在此环境子进程模式失败，仅返回 test failed；直接 node 同文件执行8用例成功。未以 test-runner 子进程成功冒称，未绕过限制。

### 剩余失败

- test_economy.js：536成功/2旧缓存断言失败（ART_V=14、落地灯单图缓存）。
- test_coin_safety.js：516成功/6旧 commitSave fixture 失败；当前真实 coordinator 安全用例由 protocol/新用例单独验证。
- td/test_tdhost.js、preview/td/test_tdhost.js：各旧fixture第18行 expect start ok，现有依赖/握手 fixture 不匹配，基线也失败。未放松产品握手。
- td/test_td_bridge.js：旧源码块锚点缺失，openTD not a function，第16行；同基线。
- td/test_td_protocol.js：tdcore.js 读取 undefined Campaign.STAGE_COUNT；同基线，没有混入67基础设施修复。
- preview/cards/tests/save.test.mjs：A2j第154行、A7第252行 future dataVersion 的两项旧失败，同基线；不修改冻结卡牌功能。

### 未运行 / 交接

真实 Chromium/其他浏览器、真实父页端到端网络加载与公开站点均未执行；已知 socket/setsockopt 和公开站点阻断路线未重试/绕过。Node/VM 不当浏览器证据。需熊二审 diff，板砖核奶茶开张前后入口、目录深链返回、已有存档继续、经营盲盒钱包、TD历史与前后台运行；复核前不合 main / 不部署。

## 完整差异路径（含本报告）

- `M app.js`
- `M cards/index.html`
- `D cards/ui/action-hints.css`
- `D cards/ui/app.mjs`
- `M cards/ui/art-preview.html`
- `D cards/ui/assets/audio/CREDITS.md`
- `D cards/ui/assets/audio/the-old-tower-inn-loop.m4a`
- `D cards/ui/assets/original/TZZ_ORIGINAL_CARD_000001_original_v1.webp`
- `D cards/ui/assets/original/TZZ_ORIGINAL_CARD_000002_original_v1.webp`
- `D cards/ui/assets/original/TZZ_ORIGINAL_CARD_000003_original_v1.webp`
- `D cards/ui/assets/original/TZZ_ORIGINAL_CARD_000004_original_v1.webp`
- `D cards/ui/assets/original/TZZ_ORIGINAL_CARD_000005_original_v1.webp`
- `D cards/ui/assets/original/TZZ_ORIGINAL_CARD_000006_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS1_042_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_023_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_025_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_029_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_032_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_062_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_062_whole_bookstore_ink_burst_v1.png`
- `D cards/ui/assets/original/VAN_CS2_065_ink_contract_doorkeeper_v1.png`
- `D cards/ui/assets/original/VAN_CS2_065_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_089_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_091_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_093_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_106_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_106_redwood_charcoal_tongs_v1.png`
- `D cards/ui/assets/original/VAN_CS2_112_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_118_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_119_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_120_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_121_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_124_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_125_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_127_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_131_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_142_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_155_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_162_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_168_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_171_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_172_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_173_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_179_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_182_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_186_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_187_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_197_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_200_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_201_original_v1.webp`
- `D cards/ui/assets/original/VAN_CS2_213_original_v1.webp`
- `D cards/ui/assets/original/VAN_EX1_371_original_v1.png`
- `D cards/ui/assets/original/VAN_EX1_400_original_v1.webp`
- `D cards/ui/assets/original/VAN_EX1_582_original_v1.webp`
- `D cards/ui/assets/original/VAN_NEW1_011_original_v1.webp`
- `D cards/ui/assets/original/VAN_NEW1_011_street_corner_courier_v1.png`
- `D cards/ui/assets/original/paperHelper_original_v1.webp`
- `D cards/ui/assets/original/spareMinute_original_v1.webp`
- `D cards/ui/battlefield.css`
- `D cards/ui/bookspine.css`
- `D cards/ui/collection.css`
- `D cards/ui/hand-flow.css`
- `M cards/ui/index.html`
- `D cards/ui/readable-effects.css`
- `D cards/ui/spell-feedback.css`
- `D cards/ui/styles.css`
- `D cards/ui/weapon-hud.css`
- `M collection/bootstrap.mjs`
- `M index.html`
- `M pet/game/app.js`
- `M pet/game/index.html`
- `M pet/game/version.json`
- `M preview/app.js`
- `M preview/cards/index.html`
- `D preview/cards/ui/app.mjs`
- `M preview/cards/ui/art-preview.html`
- `D preview/cards/ui/assets/original/TZZ_ORIGINAL_CARD_000001_original_v1.webp`
- `D preview/cards/ui/assets/original/TZZ_ORIGINAL_CARD_000002_original_v1.webp`
- `D preview/cards/ui/assets/original/TZZ_ORIGINAL_CARD_000003_original_v1.webp`
- `D preview/cards/ui/assets/original/TZZ_ORIGINAL_CARD_000004_original_v1.webp`
- `D preview/cards/ui/assets/original/TZZ_ORIGINAL_CARD_000005_original_v1.webp`
- `D preview/cards/ui/assets/original/TZZ_ORIGINAL_CARD_000006_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS1_042_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_023_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_025_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_029_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_032_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_062_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_062_whole_bookstore_ink_burst_v1.png`
- `D preview/cards/ui/assets/original/VAN_CS2_065_ink_contract_doorkeeper_v1.png`
- `D preview/cards/ui/assets/original/VAN_CS2_065_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_089_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_091_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_093_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_106_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_106_redwood_charcoal_tongs_v1.png`
- `D preview/cards/ui/assets/original/VAN_CS2_112_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_118_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_119_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_120_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_121_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_124_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_125_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_127_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_131_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_142_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_155_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_162_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_168_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_171_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_172_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_173_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_179_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_182_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_186_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_187_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_197_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_200_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_201_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_CS2_213_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_EX1_371_original_v1.png`
- `D preview/cards/ui/assets/original/VAN_EX1_400_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_EX1_582_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_NEW1_011_original_v1.webp`
- `D preview/cards/ui/assets/original/VAN_NEW1_011_street_corner_courier_v1.png`
- `D preview/cards/ui/assets/original/paperHelper_original_v1.webp`
- `D preview/cards/ui/assets/original/spareMinute_original_v1.webp`
- `D preview/cards/ui/battlefield.css`
- `D preview/cards/ui/bookspine.css`
- `D preview/cards/ui/collection.css`
- `M preview/cards/ui/index.html`
- `D preview/cards/ui/spell-feedback.css`
- `D preview/cards/ui/styles.css`
- `M preview/collection/bootstrap.mjs`
- `M preview/index.html`
- `M preview/pet/game/index.html`
- `M preview/pet/game/version.json`
- `M preview/td/tdhost.js`
- `M preview/td/test_td_bridge.js`
- `M preview/version.json`
- `M td/tdhost.js`
- `M tests/formal/carefree-bgm.test.mjs`
- `M tests/formal/copy52-display.test.mjs`
- `M tests/formal/td-fc2.test.mjs`
- `M tests/formal/td-receipts.test.mjs`
- `A tests/formal/tea-entry-cards-out.test.mjs`
- `A tests/reports/tea-td-cards-out-20261012-r1.md`
- `M version.json`
