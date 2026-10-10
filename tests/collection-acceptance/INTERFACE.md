# 验收接口对接清单（给熊大骨架对齐用）

对应 `rules.test.mjs` 和 `ui_collection.py` 的 ADAPT 区。骨架的名字和这里不一样时，只改 ADAPT，不用改用例。
接口缺失时，两层都会打印「✗ 缺接口：…」并 exit 1。除单抽 500 万外，测试配置里的数值都是占位。

## 1. 规则层模块
默认路径：`preview/cards/collection/collection.mjs`，可以用 `COLLECTION_IMPL` 改指向。ESM 导出，都是纯函数。

| 名 | 入参 | 返回（成功） | 失败口径 |
|---|---|---|---|
| `validateConfig(cfg)` | 配置，见 §3 | `{ok:true, errors:[]}` | `{ok:false, errors:[…]}`。`directGoldRarities` 里出现非 legendary 时，要拒绝配置，或者保证这些稀有度只出 normal（N9-11） |
| `initCollection(f)` | `{dust, owned:{[cardId]:{normal?,gold?}}, prefs:{suppressOverflowWarn?}}` | 一个 `state.collection` 对象，见 §2；缺的计数补 0 | 不应出错 |
| `maxDupGain(cfg)` | cfg | 各稀有度 `dupDust` 的最大值，包括金传那档（测试里是 400） | — |
| `overflowRisk(state, cfg)` | 整个经营 state | `cfg.dustMax − dust < maxDupGain(cfg)` 时返回 true，剩余正好等于时返回 false（N3-1） | — |
| `prepareDraw(state, cfg, {txId, seed})` | 同一个 seed 必须得到同一个结果 | `{txId, seed, baseRevision, result:{cardId, rarity, foil:'normal'\|'gold'}}` | 不改 state，不写档（N3-2/3） |
| `commitDraw(state, cfg, draft, opts)` | opts 包括 `{save(newState)→true/false/throw, confirmOverflow?, suppressOverflowWarn?}` | `{ok:true, state:新state, receipt}`。原 state 不改，偏好和抽卡在同一次 save 里写 | `{ok:false, code}`：`CONFLICT`（baseRevision 不等于当前，N3-12/N4-5）、`INSUFFICIENT_COINS`（coins < 5,000,000，N4-1）、`NEED_OVERFLOW_CONFIRM`（有溢出风险、未确认、也没设不提醒，N3-2）、`SAVE_FAILED`（save 返回 false 或抛错，N4-2）。失败时 save 次数为 0、原 state 一个字不变。同一 txId 已入账时，返回 `{ok:true, duplicate:true, receipt:原凭据}`，或任意 `ok:false`，但不能再扣费（N4-4，即使 revision 对得上也一样） |
| `recover(state, txId)` | 重开后读出的 state | `{status:'committed', receipt}` | `{status:'absent'}`（N4-8） |
| `gild(state, cfg, cardId, {save})` | — | `{ok:true, state}`：一张 normal 变成 gold，扣 `gildCost[r]`，总数不变（N2-2） | `{ok:false}`，零写入。三种情况：粉尘不够、没有 normal、没有这张卡（N2-3/4/5） |
| `setOverflowReminder(state, on, {save})` | `on=true` 表示恢复提醒 | `{ok:true, state}`，不动金币和粉尘（N3-7） | — |
| `probabilities(cfg)` | — | `{legendaryTotal, goldGivenLegendary, goldLegendaryOverall}`，其中 overall = 前两项相乘（N9-10） | 缺这个函数时，只有 N9-10 判失败 |
| `commitBatch`（可选） | — | — | 不导出时，N3-11 打印「跳过」 |

## 2. 状态字段
| 字段 | 说明 |
|---|---|
| `state.coins` / `state.coinFrac` | 经营公用金币（`preview/economy.js`）。单抽 `coins −= 5,000,000`，`coinFrac` 不动，不另设卡牌钱包（COIN） |
| `state.collection.revision` | 每次提交、镀金或改偏好都加 1，用来检测冲突 |
| `state.collection.dust` | 0 到 `dustMax` |
| `state.collection.owned[cardId]` | `{normal, gold}`，合计不超过 2。只按 cardId 判重复，不看名字（N1-1） |
| `state.collection.prefs.suppressOverflowWarn` | 「以后不再提醒」，默认 false |
| `state.collection.ledger[txId]` | 已提交的凭据 |

**凭据 receipt（N4-10）**：`txId, rulesVersion, poolVersion, baseRevision, commitRevision, cardId, rarity, foil, coinCost, change('new'|'add'|'upgrade'|'dust'), dust:{gained:g, credited:a, overflow:o}, committed:true`

- G7 粉尘口径：g = `dupDust[r]`（第 3 张起），a = min(g, dustMax − 抽前粉尘)，o = g − a，抽后粉尘 = 抽前 + a。
- 金传：满 2 普抽到金传，或 1 普 1 金抽到金传时，`change='upgrade'`，一张 normal 变成 gold，同时给 g。已有 2 金时，`change='dust'`，不降级。

## 3. 测试配置 cfg
`{cost:5000000, dustMax, rulesVersion, poolVersion, pool:[{cardId,name,rarity}], weights:{rarity:权重}, goldRate, directGoldRarities:['legendary'], dupDust:{rarity:n}, gildCost:{rarity:n}}`

## 4. UI 层
| 名 | 约定 | 失败口径 |
|---|---|---|
| URL | `$COLLECTION_URL`，默认 `/preview/cards/collection/index.html?collectionTest=1` | — |
| `window.CollectionQA.importFixture(f)` | 只在测试模式下暴露。f = `{coins, dust, owned, prefs, seed, config}`，config 让每抽都是 `l-x` 普通传说，dustMax 1000，dupDust 400。导入后脚本会重载页面 | 缺了就打印「缺接口」，exit 1 |
| `window.CollectionQA.exportState()` | `{coins, dust, owned, prefs, ledger, revision}` | 同上 |
| data-testid | `draw`、`overflow-dialog`、`overflow-text`（逐字「超出上限的粉尘会消失，是否继续抽卡？」）、`overflow-continue`、`overflow-cancel`、`overflow-suppress`（默认不勾）、`reveal`（带 `data-card-id`）、`dust-gained`、`dust-credited`、`dust-overflow`、`restore-overflow-reminder` | 找不到控件时，对应条目判失败 |
| 行为 | 弹窗打开和取消时零写入；按 Esc 等同取消；揭晓卡面的 cardId 和凭据一致；双击只扣一次；切后台、离页、刷新后，扣费次数等于凭据数 | 锁一类的键用 `LOCK_KEYS` 排除，不计入「零写入」 |
