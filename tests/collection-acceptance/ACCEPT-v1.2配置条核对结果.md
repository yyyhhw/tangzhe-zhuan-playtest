# ACCEPT v1.2 配置条核对结果

被验的对象：熊大交的 `card-collection-model-v1.2-review.zip`。我核过 SHA256，是 `e4e1a3ed…f09d71`，和熊大贴的一致。按 `ACCEPT-试玩配置定向验收.md` 逐条核。
这是只读验收：不改断言，不改游戏代码，不动 v1、v1.1、v10a，不启用钱包，也不发布。老板这次是试行同意，`walletBridgeApproved` 仍是 false。

配置：`configs/trial-39-v1.2.json`。骨架：解包后的 `card-collection-model-v1.2/`（下面记作 `$S2`）。

| # | 条 | 实测 | 结果 |
|---|---|---|---|
| — | 包 SHA，骨架自测 | `SHA256.txt`、`RUNTIME-SHA256.txt` 全部 OK；`node --test` 114/114，0 失败，0 跳过 | 过 |
| 0 | 结构校验 | `validate_config.mjs` 用 `SKELETON_DIR=$S2` 跑，exit 0 | 过 |
| 0a | 版本名、用途 | `owner-trial-39-v1.2-20261010`、`owner-trial-39-rarity-v1-20261010`，名字里没有 `UNAPPROVED`；`purpose=integration` | 过 |
| 1 | 张数 39，含珍珠护套 | 卡池 39 张，没有重复，含 `bkVanEx1371` | 配置过。⚠ 珍珠护套能不能玩要看 v10a：本分支的 `catalog-data.mjs` 里它还标着 `unsupported`（缺圣盾机制）。v10a 那棵树我这边没有，**看不了**，记 pending |
| 2 | 分档 24/10/3/2 | 普通 24、稀有 10、史诗 3、传说 2；史诗是 `bkVanCs2032`、`bkVanCs2062`、`bkVanCs2155` | 张数过。逐卡对照**看不了**：缺熊大的 39 张逐卡稀有度表 |
| 3 | 两张传说 | `["bkVanCs2186","bkVanCs2201"]`，名字是压纸石像、夜巷巨角鹿 | 过 |
| 3a | 原机制不变 | v1.2 包里不带 `catalog-data.mjs`；包内 `frozen-v10a-check` 110 个文件都是 OK，其中有 `catalog-data.mjs`；本分支这两张卡都是无效果随从 | 过。依据是熊大的冻结核加上包内容；v10a 原文件我没有逐字段对 |
| 4 | 传说限 1，其他限 2 | 配置里传说 `ownershipCap=1`、`deckCap=1`，其他稀有度都是 2；自测 `trial-config-caps` 覆盖了收藏限 1、组牌限 1、第三张转粉尘 | 模型过。规则层用包里自带的 `skeleton-v1.2-regression` adapter 跑，130/0、120/10，但包里注明这一项是 cap2 回归，不能证明限 1。规则层 B 入口（预计 132/0）**看不了**：缺限 1 的 adapter |
| 4a | 旧存档已有 2 张传说 | `migration.test.mjs` 有专门的用例：保留并上报，不补粉尘，不裁卡；迁移前要明确同意 | 模型过。真实旧档迁移要等父页接线 |
| 5 | 概率 | `probabilityScale` 10000；6800、2200、700、300 | 过 |
| 5a | 金色、保底 | `goldenLegendaryWeight=1000`，算出来整体 300/10000 × 1000/10000 = 0.3%；`pityPolicy=none`；自测里有对应用例 | 过 |
| 6 | 重复粉尘 | 5、20、100、400；`goldDuplicatePolicy=upgrade-normal-and-dust` | 配置过。金传重复得 400 要用 `reveal_gold` 在 v1.2 上实跑，这次没跑 |
| 7 | 镀金 | 360、700、1200、1600 | 过 |
| 8 | 粉尘上限和溢出 | `dustBalanceCap=3200`；自测覆盖了溢出报价，以及取消后不保存「不再提醒」 | 配置过。溢出弹窗 UI **看不了**：收集页还没交 |
| 9 | 单抽价 | `drawPriceGold=5000000` | 配置过。扣经营公用金币**看不了**：父页桥接还没交 |
| 10 | 钱包门禁 | `approval-binding.reference.json` 里是 `walletBridgeApproved: false`；`config.mjs` 要求必须带这个字段 | 过 |

小结：
- **全过**：9 条，即 SHA 和自测、0、0a、3、3a、5、5a、7、10。
- **部分过**：7 条，即 1、2、4、4a、6、8、9。配置或模型这一层过了，剩下的部分看不了，缺的东西是：
  - 第 1 条：1371 在 v10a 上能不能玩；
  - 第 2 条：39 张逐卡稀有度表；
  - 第 4 条：限 1 的规则层 adapter；
  - 第 6 条：`reveal_gold` 在 v1.2 上实跑；
  - 第 4a、8、9 条：收集页和父页桥接，包括真实旧档迁移、溢出 UI、扣经营公用金币。
- **不过**：0 条。
