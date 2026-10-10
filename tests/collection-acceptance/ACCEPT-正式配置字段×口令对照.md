# 正式配置字段 × 验收口令对照

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，也不替杨总拍板。
对照来源：小喇叭的 `正式配置字段提纲.md`，以及 v1.1 骨架 `src/config.mjs` 里的 `validateConfig`（第 6–40 行）、本目录的 `validate_config.mjs`、`ACCEPT-可跑口令清单.md`、`PRE-拍板-DRYRUN.md`、`POST-拍板-ACCEPT-HOOKS.md` ③。
主口令是可跑口令清单第 7 条：`SKELETON_DIR=$S node tests/collection-acceptance/validate_config.mjs $CFG`。下表简称「#7」。

**骨架拦什么、不拦什么，是看了代码以后得出的结论**：`validateConfig` 只查类型、键名、和是否一致，**不查数值是不是拍板定的值**。`validate_config.mjs` 的输出里只打印版本名、purpose、卡池张数、各稀有度张数和粉尘上限。其他数值要板砖用 `jq` 人工比对。

| 字段组 | 骨架会拦 | 骨架不拦，要板砖人工查 | 用哪条口令 | 现在能不能跑 | 缺啥 |
|---|---|---|---|---|---|
| 顶层 12 个键（必须正好这 12 个） | 多一个或少一个就报 `CONFIG` 错 | — | #7 | 只拿夹具试过入口（DRYRUN #8，rc 0） | 正式配置 JSON |
| `configVersion`、`poolVersion` | 只查是不是合法标识符 | ⚠ **骨架不拦带 `UNAPPROVED-` 的名字**。板砖看 #7 输出的版本名，不能带 `UNAPPROVED-`，要和批准记录写的版本一致 | #7 的输出，人工核对 | 夹具输出里带 `UNAPPROVED-`，说明这条确实不拦 | 正式配置 JSON |
| `purpose` | 只要是 `test-fixture` 或 `integration` 都放行 | ⚠ 正式配置必须是 `integration`，`test-fixture` 也会被放过 | #7 的输出，人工核对 | 同上 | 正式配置 JSON |
| `schemaVersion`、`catalogVersion`、`goldDuplicatePolicy` | 都拦：要等于 1、骨架里的 `CATALOG_VERSION`、`upgrade-normal-and-dust` | — | #7 | 同上 | ④准 39 张：要等 v10a 发布后才能定卡牌目录版本；③ 改了金传重复粉尘：骨架里写死的规则要改，熊大改代码 |
| `drawPriceGold` | 只查是不是 ≥1 的整数 | ⚠ 拦不住不是 500 万的数，#7 也不打印。人工跑 `jq .drawPriceGold $CFG`，必须是 `5000000` | `jq`，人工 | 能跑，只差 JSON | 正式配置 JSON |
| `dustBalanceCap` | 只查是不是整数 | 要等于 3200（③）。#7 会打印出来，还会交叉检查它 ≥ 最高镀金价、≥ 单张最高重复粉尘 | #7（交叉检查不过时 rc 1） | 同上 | 正式配置 JSON |
| `probabilityScale`、`goldenLegendaryWeight`，加上 `rarities[].weight` | 查权重加起来等于 scale；金传权重 ≤ scale；有权重的稀有度卡池里必须有卡 | ⚠ 拦不住不是 68/22/7/3、金传不是 0.3% 的数。人工用 `jq` 看权重，或者用骨架的 `probabilities()` 读一遍 | `jq` 或 `probabilities()`，人工 | 草稿读出来是 0.3%（小喇叭实测），草稿不算 | 正式配置 JSON |
| `rarities[]`：每档 4 个键 `id`、`weight`、`duplicateDust`、`gildDustCost` | 必须正好 4 档、每档 4 个键，`id` 不能重复 | ⚠ 拦不住重复粉尘不是 5/20/100/400、镀金价不是 360/700/1200/1600 的数。人工跑 `jq '.rarities' $CFG` | `jq`，人工；镀金价也影响 D0-2、D0-3（`reveal_gold`） | 夹具的镀金价是 100/300/800/1600，`reveal_gold` 现在按夹具跑 | 正式配置 JSON |
| `pool[]`：每张卡 2 个键 `cardId`、`rarity` | 卡号必须可玩，不能重复，稀有度必须合法 | 张数和分档：#7 会打印，人工核对是 38 张、24/9/3/2（④准是 39 张、24/10/3/2） | #7 的输出，人工核对 | 夹具是 39 张、10/10/10/9，所以必须换 | 正式配置 JSON；④准还要 39 张逐卡稀有度表 |
| 传说上限 | v1.1 的配置里**没有这个字段**，是写死的 2 | 拍 B 以后可能会加字段，以熊大交的 B 版骨架为准 | 规则层 132/0（预计） | 不能 | B 版骨架 |
| 批准记录 4 个键（`admitIntegrationConfig`） | 骨架会拦：purpose、canonical、`walletBridgeApproved === true`、`evidenceRefs` | 不在 #7 里，`walletBridgeApproved` 现在仍是 false，走技术门槛 | 不在板砖的口令里 | 不能 | 技术门槛 |

## 要板砖人工查的 5 处（拿到 `$CFG` 以后，跑完 #7 再看）
```bash
jq '{configVersion,poolVersion,purpose,drawPriceGold,dustBalanceCap,probabilityScale,goldenLegendaryWeight,rarities}' "$CFG"
```
1. 两个版本名都不能带 `UNAPPROVED-`。
2. `purpose` 必须是 `integration`。
3. `drawPriceGold` 必须是 `5000000`。
4. 四档权重、金传权重和拍板的概率一致。
5. 四档的重复粉尘、镀金价和拍板一致。

这 5 处人工核对完、#7 也是 rc 0，第③项才算「配置过」。只看 #7 的 rc 0 不够。
