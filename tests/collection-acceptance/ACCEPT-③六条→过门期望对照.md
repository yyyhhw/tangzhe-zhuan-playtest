# ③ 收敛版 6 条 → 过门期望对照

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，也不替杨总拍板。**③还没拍，全部 pending。**
6 条的编号和建议值取自小喇叭的 `全部按建议时正式配置键值落地清单.md`，以及 `待拍②③④素材补丁.md` 第③节、`CONFIRM-DIFF.md`。「第几步」指 `ACCEPT-第③项配置过门清单.md` 的步骤 0–5。
用法：杨总改了哪一条，只改那一行的期望值，其他行照旧。改某一条的具体影响，以小喇叭的 `若杨总改任一条影响一页.md` 为准，这里只写验收这边要跟着变什么。

| # | 拍板项 | 过门第几步 | 全按建议的期望 | 改了这一条，期望怎么变 | 连带要重跑的 |
|---|---|---|---|---|---|
| 1 | 镀金价 `rarities[].gildDustCost` | 第 5 步；第 0 步的交叉检查（粉尘上限 ≥ 最高镀金价） | 360 / 700 / 1200 / 1600 | 第 5 步的 `[重复粉尘, 镀金价]` 里换成新的镀金价。传说那档要是超过 3200，第 0 步会 rc 1，要连粉尘上限一起改 | `reveal_gold` 的 D0-2、D0-3（「正好够」和「差 1」的边界）跟着配置走；DA 版提示文案里的「镀金需要 {待定}」 |
| 2 | 重复粉尘 `rarities[].duplicateDust`，加上金传重复规则 `goldDuplicatePolicy` | 第 5 步；第 0 步的交叉检查（粉尘上限 ≥ 单张最高重复粉尘）；`goldDuplicatePolicy` 由骨架拦，只认 `upgrade-normal-and-dust` | 5 / 20 / 100 / 400；`upgrade-normal-and-dust` | 第 5 步换成新的重复粉尘。⚠ **金传重复粉尘改成不是 400**：熊大要改骨架代码，骨架 SHA 会变；规则层和 `reveal_gold` 里断言「升级加粉尘 400」的几条（R2、R3）要同步改期望数 | 换骨架以后，`ACCEPT-现跑基线.md` 第 1–5 条全部重跑 |
| 3 | 粉尘上限 `dustBalanceCap` | 第 0 步（会打印出来，并做交叉检查）；第 5 步 | 3200 | 第 0 步打印的值和第 5 步的 `.dustBalanceCap==` 一起换。新值要 ≥ 最高镀金价，也要 ≥ 单张最高重复粉尘，不然第 0 步就 rc 1 | `DUST-GAP.md` 里粉尘溢出那几条的边界（`a = min(g, 上限 − 当前粉尘)`）跟着配置走 |
| 4 | 首版卡池 `pool`、`catalogVersion` | 第 0 步（张数会打印；`catalogVersion` 由骨架拦，要等于骨架里的版本） | 38 张，不含 `bkVanEx1371` | 改成 39 张（④准）：第 0 步期望变成 39 张；而且要等 v10a 发布才能判过，因为 `bkVanEx1371` 在 v10a 里 | 补一条人工检查（不在 5 步里）：`jq -e '[.pool[].cardId]\|index("bkVanEx1371")==null' $CFG`，38 张时应为 `true` |
| 5 | 稀有度 `pool[].rarity` | 第 0 步（各稀有度张数会打印） | 24 / 9 / 3 / 2；传说是 `bkVanCs2201`、`bkVanCs2186`，史诗是 `bkVanCs2032`、`bkVanCs2062`、`bkVanCs2155` | 第 0 步期望的张数换成新的分档；逐卡是哪档，以熊大的 CSV 为准（④准是 24/10/3/2） | 补一条人工检查：`jq -c '[.pool[]\|select(.rarity=="legendary" or .rarity=="epic")]' $CFG`，和上面 5 个卡号对一遍 |
| 6 | 概率：`rarities[].weight`、`probabilityScale`、`goldenLegendaryWeight` | 第 4 步；骨架只查权重加起来等于 scale | 6800 / 2200 / 700 / 300，scale 10000，金传 1000；公示金传整体 0.3% | 第 4 步的权重换成新值，再用 `probabilities()` 读一遍公示概率，结果要和批准记录一致 | 规则层 N9-10「整体 = 传说 × 条件」用的是夹具，不受影响 |

表里的 `\|` 是 md 表格转义，复制时换成 `|`。

## 6 条以外，不管 ③ 怎么拍都要过的
- 第 1 步：版本名不能带 `UNAPPROVED-`（草稿现在是 `UNAPPROVED-default-proposal-v1`、`UNAPPROVED-base38-v1`，一定要换）。
- 第 2 步：`purpose` 是 `integration`（草稿已经是了）。
- 第 3 步：`drawPriceGold` 是 `5000000`（已定，不在 6 条里）。

## 不在这张对照里的
- **传说上限**：v1.1 配置里没有这个字段，代码里写死 2（`model.mjs`）。③怎么拍都管不到它；①拍 B 要等 B 版骨架，规则层预计 132/0。
- **批准记录**（`admitIntegrationConfig` 的 4 个键，`approvedConfigCanonical` 要和最终配置一字不差）：不在板砖的验收口令里。`walletBridgeApproved` 仍是 false，走技术门槛。③改了任何一条，配置的 canonical 文本都会变，批准记录要重做。
