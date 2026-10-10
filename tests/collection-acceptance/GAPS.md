# 骨架对接缺口清单（card-collection-model-v1，SHA256 `39ab6d46…684b45`）

真跑结果：经测试侧适配层 `adapters/skeleton-v1.mjs` 跑规则层，`passed 116, failed 10`，rc=1。
反向对照 ACCEPT_CONTROL=1 跑出 `passed 111, failed 15`，rc=1，门禁有效。真失败为 0。
UI 两项：骨架包里没有页面，缺接口，未跑。

## A 缺函数（2 条失败，需要骨架补）

| 条目 | 失败行 | 期望接口签名 |
|---|---|---|
| N9-10 | `缺接口 probabilities(cfg)` | `model.probabilities() → { legendaryTotal, goldGivenLegendary, goldLegendaryOverall }`。三个值都由 `rarities[].weight`、`goldenLegendaryWeight`、`probabilityScale` 推出，第三个值等于前两个相乘 |
| N3-7 | `运行出错：缺接口：骨架无恢复提醒命令` | 新增命令 `{ type: 'SET_PREFERENCE', eventId, txId, expectedRevision, suppressOverflowWarning: false }`。只改 `preferences`，`revision` 加 1；不改 `collectionRevision`，不碰收藏和粉尘；有交易挂起时也要能执行，否则必须明确报错 |

## B 接口形状差（0 条失败，适配层已经补上；建议骨架自己提供，免得以后两份口径不一致）

| 项 | 现在骨架的样子 | 适配层怎么补的 | 建议 |
|---|---|---|---|
| 入口 | 只有 `createFixtureModel(config)`，返回 Model，按 quote/reduce 命令流走 | 把脚本要的 9 个函数映射成 BEGIN→DECIDE→SELECT→RECORD_DEBIT→COMMIT | 保持现状，验收以后固定走适配层；或者骨架直接导出 INTERFACE.md 里的 9 个函数，两种都可以 |
| 凭据里的 `poolVersion` | `CollectionReceipt` 里没有，只能从 `configCanonical` 里解析 | 读 `JSON.parse(configCanonical).poolVersion` | 在 `CollectionReceipt` 里加 `poolVersion`（N4-10 最小字段要求） |
| 凭据里的 `baseRevision` / `commitRevision` | 只有 `collectionRevision`，前后 revision 要靠 events 去推 | 取 BEGIN 的 `expectedRevision`，再取最后一条事件 +1 | 在 `CollectionReceipt` 里加 `baseRevision`（BEGIN 时的 revision）和 `commitRevision`（N4-10） |
| `maxDupGain` | 没有，quote 只给出这次的上界 | 直接从配置里取 `max(duplicateDust)` | 可以不补；如果补，签名是 `model.maxDuplicateDust() → number` |
| 镀金失败码 | 直接抛 `INSUFFICIENT_DUST`、`NO_NORMAL_COPY_TO_GILD`、`CARD_NOT_IN_CONFIGURED_POOL` | 统一归成 `CANNOT_GILD` | 保持现状，UI 侧按这 3 个码分别给出文案 |
| 命名 | `finish: 'golden'`、`holdings[id].golden`、`suppressOverflowWarning`、`dustEarned/Credited/Discarded` | 对应映射成 `foil: 'gold'`、`owned[id].gold`、`suppressOverflowWarn`、`dust.gained/credited/overflow` | 不用改，两边语义一致 |
| 金币 | 不在 state 里，走 `walletIntent` 和 `RECORD_DEBIT` 两步 | 测试侧模拟钱包 `state.coins`，扣 5,000,000 | 等熊大的 CardHost 钱包桥接接好后再真测；模拟钱包的结果不代表经营金币扣款已经通过 |
| cardId | 只接受目录里的真实 ID | 把用例里的假 ID 一一映射成真实 ID | 不用改 |

## C 用例侧口径（8 条失败，需要拍板，不是骨架 bug）

| 条目 | 失败行 | 原因 |
|---|---|---|
| N3-2 ×6（粉尘 601 和 1000 两档各 3 条） | `应有溢出风险`、`未确认不能提交`、`[反向对照] 未确认就提交` | v3.3 的口径是：剩余容量 < MAX_DUP_GAIN 就弹确认。骨架的 `drawQuote` 只按现有收藏判断，只有存在已满 2 张的卡、这一抽确实可能化尘时才弹。用例里是空收藏，所以骨架不弹 |
| N3-5 | `下次仍要确认` | 同上，空收藏不弹 |
| N3-6 | `勾选继续：偏好和抽卡同一次写档` | 同上；另外骨架在没有弹窗时，如果 `suppressFutureOverflowWarnings` 为 true，会抛 `NO_OVERFLOW_PROMPT_TO_SUPPRESS` |

实测已有 `l-x` 满 2 张、粉尘 601、900、1000 三档：骨架都判定有风险，没确认就提交时返回 `NEED_OVERFLOW_CONFIRM`。
二选一：
1. 按骨架的口径（推荐）。改 N3-1、N3-2、N3-5、N3-6 的前置条件，加上「有卡已满 2 张」，断言不变。预计规则层变成 128/130，只剩 A 里的 2 条。
2. 维持 v3.3。骨架的 `drawQuote` 改成不看收藏，`maximumDustEarned = max(duplicateDust)`。

复跑：`SKELETON_DIR=<解压目录> COLLECTION_IMPL=tests/collection-acceptance/adapters/skeleton-v1.mjs node tests/collection-acceptance/rules.test.mjs`

## 按熊大口径修前置样本后复跑

口径：溢出风险按「当前收藏 × 实际抽卡池确实可能产生的最大重复粉尘」判断。
改了 N3-1、N3-2、N3-5、N3-6、N3-7 的前置样本，都加上已满 2 张的传说 `l-x`（可能化尘的上界是 400）。断言没改，条数也没减。N3-7 的「恢复后再弹」原本也依赖旧口径，只是当时被缺接口挡住没暴露，这次一并改了。

| 运行 | 通过 | 失败 | 未执行 | 跳过 | rc |
|---|---|---|---|---|---|
| 骨架（经适配层） | 124 | 2（N9-10、N3-7，都是缺接口） | 4 | N3-11 批量（不计入 130） | 1 |
| 骨架 ACCEPT_CONTROL=1 | 115 | 11 | 4 | 同上 | 1 |
| 参考实现 | 130 | 0 | 0 | 同上 | 0 |
| 参考实现 ACCEPT_CONTROL=1 | 120 | 10 | 0 | 同上 | 1 |

未执行的 4 条，都是因为前面的缺接口提前退出：
- N9-10 的 3 条：总体概率等于两项相乘；2 万抽里金传占比；反向对照「条件概率当总体」
- N3-7 的 1 条：恢复提醒后再抽会再弹

124 + 2 + 4 = 130。熊大补上 `probabilities` 和 `SET_PREFERENCE` 后，预计 130/130。这是预计，还没跑过，暂不算全部通过。
