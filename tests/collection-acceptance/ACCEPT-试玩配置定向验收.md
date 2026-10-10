# ACCEPT 试玩配置定向验收

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，不重跑冒烟，也不启用钱包。
依据：熊大转达的老板私聊试行同意（「可以先试一下 等我出来以后我再测试」，17:57 那套方案按**试行**锁定）、凤雏回执、`CONFIRM-DIFF.md`、`preview/cards/catalog-data.mjs`。
**试行同意不等于技术门禁通过**：`walletBridgeApproved` 仍是 false。测试桥接不能当真实钱包启用，真实扣款要等 G4。

被验的对象：熊大约 21:00 交的独立 v1.2 候选（配置 JSON 记作 `$CFG`，骨架目录记作 `$S2`）。还没交的话，整页都是 pending。

| # | 验收条 | 看哪 | 期望 | 失败归谁 | ☐ |
|---|---|---|---|---|---|
| 0 | 结构校验 | `SKELETON_DIR=$S2 node validate_config.mjs $CFG` | exit 0 | 熊大（配置或骨架） | ☐ |
| 0a | 版本名、用途 | `jq -e '(.configVersion+.poolVersion\|test("UNAPPROVED")\|not) and .purpose=="integration"' $CFG` | `true`。这一项骨架不拦，靠人工查 | 熊大 | ☐ |
| 1 | 张数 39，含珍珠护套 | `jq -e '(.pool\|length)==39 and any(.pool[];.cardId=="bkVanEx1371")' $CFG` | `true` | 熊大。珍珠护套要依赖 v10a 发布，v10a 没发布就记 pending，不算过 | ☐ |
| 2 | 分档 24/10/3/2 | `jq -c '[.pool[].rarity]\|group_by(.)\|map({(.[0]):length})\|add' $CFG` | 普通 24、稀有 10、史诗 3、传说 2；逐卡稀有度和熊大交的 39 张表一致 | 熊大 | ☐ |
| 3 | 两张传说 | `jq -c '[.pool[]\|select(.rarity=="legendary").cardId]\|sort' $CFG` | `["bkVanCs2186","bkVanCs2201"]`，也就是压纸石像和夜巷巨角鹿 | 熊大 | ☐ |
| 3a | 两张传说原机制不变 | `git diff <基线>..<候选> -- preview/cards/catalog-data.mjs`，看这两张卡的 `runtimeDefinition` | 一个字段都没改。两张都是无效果随从（`vanilla_minion`），参考身材 9/5 和 7/7，都是 7 费 | 熊大 | ☐ |
| 4 | 限 1 / 限 2：传说收藏和组牌都限 1，其他限 2 | v1.2 的骨架自测，再加规则层的 B 版入口（`LEGEND-B`、`COUNTS-B`） | 传说第 2 张不进收藏，组牌里放不进第 2 张；其他稀有度到 2 张为止。规则层预计 132/0，反向对照预计 122/10，以实测为准；`reveal_gold` 的 R2-B 从跳过改为实跑 | 熊大（骨架）；R2-B 这条脚本由板砖写 | ☐ |
| 4a | 旧存档里已经有 2 张传说 | 熊大给的迁移说明，加一份带 2 张传说的测试档 | 不静默删卡；先保护，并报「需迁移」 | 熊大 | ☐ |
| 5 | 概率 68/22/7/3 | `jq -c '[.probabilityScale,(.rarities\|map({(.id):.weight})\|add)]' $CFG` | 10000；6800 / 2200 / 700 / 300 | 熊大 | ☐ |
| 5a | 金色：传说里 10%，整体 0.3%；首版不保底 | `jq .goldenLegendaryWeight $CFG`，再看 `probabilities()` | 1000；`goldLegendaryOverall` = 0.003；配置和骨架里都没有保底字段 | 熊大 | ☐ |
| 6 | 重复粉尘 5/20/100/400，金传重复也是 400 | `jq -c '.rarities\|map({(.id):.duplicateDust})\|add' $CFG`；金传重复看 `reveal_gold` | 5 / 20 / 100 / 400；金传重复得 400 | 熊大 | ☐ |
| 7 | 镀金 360/700/1200/1600 | `jq -c '.rarities\|map({(.id):.gildDustCost})\|add' $CFG` | 360 / 700 / 1200 / 1600 | 熊大 | ☐ |
| 8 | 粉尘上限 3200，溢出要确认，可以选「不再提醒」 | `jq .dustBalanceCap $CFG`；溢出弹窗走收集页 UI 验收（`overflow-dialog`、`overflow-suppress`、`restore-overflow-reminder`） | 3200；溢出时先弹确认；勾了「不再提醒」以后不再弹，也能恢复 | 熊大（配置、页面）；UI 用例由板砖跑 | ☐ |
| 9 | 单抽价 | `jq .drawPriceGold $CFG` | 5000000，扣经营公用金币（`state.coins`），零头不动 | 熊大 | ☐ |
| 10 | 钱包门禁 | 熊大交的候选和配置 | `walletBridgeApproved` 是 false，没有任何地方把测试桥接当真实钱包启用 | 熊大；发现启用了就立刻报熊二 | ☐ |

过了以后：
- 第 0–3、5–9 条（不含 3a 和 8 的 UI 部分）都是 jq 或者 node 一条命令，熊大一交就能跑。
- 第 3a、4、4a 要等 v1.2 骨架和迁移说明。
- 第 8 的 UI 部分要等收集页，按 `ACCEPT-收集页熊大交件后首跑.md` 走。
- 全部勾上，只说明试玩配置对上了老板的试行方案，不等于钱包门禁通过。
