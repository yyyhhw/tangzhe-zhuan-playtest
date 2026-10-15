# 星途-02 独立候选（待非作者独验）

基线：`e48be1a`。候选分支：`xiongda/xingtu02-milestones`。不合 main、不部署；实现与自测不等于放行。

## 最小结构与提交边界

可选顶层字段：`milestones: {schemaVersion: 1, events: {事件ID: 毫秒时间戳 | null}}`。

- 复用 `created`、`lastSeen`、星途航程的 Unix 毫秒习惯；没有新增时区、开局时钟或第二份 Storage。新局首店与建档同次写入。
- 不修改 `Economy.newState` 的必需形状，不提高存档版本，不给旧档补默认日期。正式/预览 P1 parser 和公共 P2 validator 都严格验证可选字段；未知版本、未知 ID、负数/越界时间等进入保护。
- `events` 仅允许本模块列出的 17 个 ID。值为 `null` 表示确证发生但日期未知；缺少 ID 表示尚无记录。已有数字和 null 都永久保留。
- 公共协调器在全部业务、身份、opaque、回执等既有检查通过后，比较提交前后状态，生成新候选的首次事件。该调用是成功事件钩子；它不另行写档，也不在 UI 回调成功后再补一笔。
- 里程碑仍是调用者不可修改的 opaque 顶层字段，**未加入 `mutableFields`**，也未扩大 `opaqueUnchanged` 白名单。新值仅由内部提交生成；P1 原协调器同样拒绝调用者改动已有字段。初始化空 `space` 的私有事务保持原来的 space+rev 边界，不顺带迁移里程碑。
- 备份失败/主档未写入：业务和事件都不落盘。写后读回不确定：沿用原 before/intended 回读保护，冻结后只核对，不重放事件；确认 intended 时才采用那份已写的时间。
- 普通成功保存会把已证实的旧事件记为 null；读档和 renderRecap 本身不写。无权限、只读、失锁、陈旧 rev、双标签外来写入均由原协调器拦截。
- 不修改经济、价格、门槛、家宅-38、地球-131、称号或结局一次弹出。书店打牌不在名单。未接入/改写 127 分支。

## 17 类证据

| ID | 首次成功提交中的证据 |
| --- | --- |
| firstShop | 新局建立首店；旧档 `shops[0].open` 仅证明已开店 |
| firstEmployee | 任意店员工数从无到有 |
| firstBox | `gacha.draws` 从 0 到正数；不把赠品当抽盒 |
| teaShop / bookShop / techShop | 对应店铺 `open` 从 false 到 true |
| firstZombie | `zombie.cleared` 首次为正：保守采用首次成功通关结算，不把败局、取消、训练或仅打开 iframe 当成功 |
| rocketJoined | `ceos.rocket.unlocked` 首次成立 |
| firstTDWin | `td.cleared` / `td50.cleared` / `tdCampaign.highestCleared` 任一首次为正 |
| shopsReady | 四店都 open 且满足传入的现行 `MOON_RULES.minShopLevel`（目前 35）；不复制旧稿 50 |
| firstVoyage | 成功写入首个航程；旧档有 voyage、sequence 或 visits 只能证明过去出航 |
| firstStory / firstAlien | space.cards 有正进度 / alienCards 为正 |
| firstHidden / firstResearch | space.hidden 有 true / space.items 有正数 |
| reply / earth | space.ended / space.earth 首次成立 |

时间取拥有者提交时的 `spaceClock()`（默认 Date.now），而非子游戏自报时间。时钟无效或早于 created 时只记未知日期，不生成假日期。已记录时间不会因回拨、重复操作、刷新或跨入口变化。

说明：首次打僵尸采用上表的“成功通关”口径，以满足本项“失败/取消不记”。若产品要求包含成功保存的败局参与，需要独立明确该口径，不能把 `best` 杀敌数或打开游戏当作已完成事件。

## 创业史

`renderRecap` 读取父状态和同一份 `MOON_RULES`，按 17 类节点顺序展示有记录/有证据的格子；没有证据的不出现。已发生无日期的格子以灰字显示“记录开始之前”。有日期的格子显示“开局 N 小时”或“开局第 N 天”；原生 details/summary 可用触控或键盘展开本地日期时间（中文格式，保留浏览器本地时区）。浮层焦点范围包含 summary。

总用时为最早有数字时间的事件到买地球的记录时间，明确写“从有记录起”。如果买地球本身是未知日期，不拿当前时间当完成时间，显示“总用时暂无完整时间记录”。

## 测试与原保护指纹

- 独立纯模块测试：17 事件、35 门槛、首次保持、旧档无日期、失败/取消、时钟回拨、非法数据、小时/天/总用时。
- 实际 bootstrap/协调器 VM：雇佣同事务；备份/主档失败；写后未知回读；原档证据保持；刷新/root→pet；伪造/删除/覆盖时间拒绝；外来写入冻结；出航/剧情卡/科研/外星/隐藏物/回信/地球；缺钱买地球不记；坏版本只读零写。
- 已安装 `/usr/bin/chromium`，390×844、Asia/Shanghai 独立测试上下文：真实雇佣按钮、刷新、root→pet、双标签、旧档、真实地球购买→recap、本地日期展开、横向溢出和 JS 错误。存档均为合成测试数据，未操作用户设备，未下载 WebKit。
- 原 autosave15/lifecycle 保护哈希清单**不改**。测试 helper 只反向剥离逐字匹配的三个候选增量，再验证原指纹；任何额外保护修改仍改变哈希；缺少/修改候选调用也失败。负控证实删掉 lease guard 不会被归一化掩盖。
- 原 moon 全状态相等断言只增加预期 milestones，其余字段仍整体相等；新增独立固定期望测试覆盖 ledger 行为。依赖实际字节指纹更新，导入数量从 81 变为 84，检查范围包括新模块。

资源发布号维持基线；新文件沿用现有闭包 token，候选用本地新上下文验证。正式发布前由集成方在非作者验收后统一刷新资源链，不能直接把候选当发布包。

## 高风险待非作者独验清单

1. 逐项核对 17 类成功证据，特别是首次打僵尸“成功通关”口径、塔防三个历史域、旧档隐藏物仅指星途隐藏物。
2. 检查 P1→P2、formal/preview、root→pet 的旧字段原样保留；未知 schema/ID 不被清洗；未修改源档/原始快照证据。
3. 复核候选生成点位于全部原 guard 之后，同一个 before/intended 事务；伪造首次日期、改旧日期、删 ledger、双标签失锁均不能写。
4. 故障注入备份失败、主档失败、写后读回未知、写后失锁，确认不会单独出现事件或重复结算。
5. 核对时间回拨/旧档无 created 可用日期/没有任何数字时间/旧地球已拥有时，创业史不虚构日期或总耗时。
6. 浏览器键盘与 390 宽展示；WebKit/iOS 原生生命周期未在本项覆盖，不能把 Chromium 和 VM 当作该证据。
7. 集成 127/38/131 时独立处理共享文件冲突、资源 token 和真实 pins；价格/门槛以各自获准版本为准。本候选不预先合并它们。

证据：`tests/reports/xingtu02/`。复现命令和本轮汇总见该目录 `README.md`。
