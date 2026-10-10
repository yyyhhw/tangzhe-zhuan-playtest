# 第③项「配置过」过门清单

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，也不替杨总拍板。**③还没拍，下面的期望值都是「全部按建议」时的值，pending。**
期望值出处：`CONFIRM-DIFF.md` 第 5–9、12、13 行；小喇叭的 `正式配置-熊大必填一页.md`（逐键的类型和约束）、`正式配置-拍板分支字段差.md`（哪些值随拍板变）。③ 六条里改了哪一条，就按批准记录改对应步骤的期望值，其他步骤不动。
为什么要人工查：v1.1 骨架的 `validateConfig` 只查格式，不查数值（见 `ACCEPT-正式配置字段×口令对照.md`）。

```bash
export PATH=~/.nvm/versions/node/v24.19.0/bin:$PATH
S=<熊大骨架目录>; CFG=<熊大交的正式配置 JSON>
```

## 过门步骤（全部 exit 0 才算过）

| 步 | 口令 | 期望 | 对照必填一页 / 字段差 |
|---|---|---|---|
| 0 | `SKELETON_DIR=$S node tests/collection-acceptance/validate_config.mjs $CFG` | exit 0；输出里卡池 38 张，`{"common":24,"rare":9,"epic":3,"legendary":2}`，`dustBalanceCap=3200` | 顶层 12 键、每档 4 键、每卡 2 键由这一步管。④准时改成 39 张、24/10/3/2 |
| 1 | `jq -e '(.configVersion\|test("UNAPPROVED")\|not) and (.poolVersion\|test("UNAPPROVED")\|not)' $CFG` | `true`，exit 0；两个名字还要和批准记录一致（人工看） | 版本名：拍前可定，**骨架不拦** |
| 2 | `jq -e '.purpose=="integration"' $CFG` | `true`，exit 0 | 用途：拍前可定，**骨架放行 `test-fixture`** |
| 3 | `jq -e '.drawPriceGold==5000000' $CFG` | `true`，exit 0 | 抽卡价：杨总之前定过（CONFIRM-DIFF #12），**骨架不查数值** |
| 4 | `jq -e '.probabilityScale==10000 and .goldenLegendaryWeight==1000 and ([.rarities[]\|{(.id):.weight}]\|add)=={"common":6800,"rare":2200,"epic":700,"legendary":300}' $CFG` | `true`，exit 0；也就是 68/22/7/3%，金传整体 0.3% | 概率：③可改，**骨架只查加起来等于 scale** |
| 5 | `jq -e '([.rarities[]\|{(.id):[.duplicateDust,.gildDustCost]}]\|add)=={"common":[5,360],"rare":[20,700],"epic":[100,1200],"legendary":[400,1600]} and .dustBalanceCap==3200' $CFG` | `true`，exit 0；顺序是 [重复粉尘, 镀金价] | 重复粉尘、镀金价、粉尘上限：③可改，**骨架不查数值** |

表里的 `\|` 是 md 表格转义，复制时换成 `|`。

## 已经拿夹具试过（2026-10-10，v1.1 的 `fixtureConfig()`）
夹具不是正式配置，只用来证明这几步能挡住它：

| 步 | 夹具结果 | 说明 |
|---|---|---|
| 0 | exit 0 | 格式没问题，所以光看这一步会放过夹具 |
| 1 | `false`，exit 1 | 名字带 `UNAPPROVED-` |
| 2 | `false`，exit 1 | 是 `test-fixture` |
| 3 | `true`，exit 0 | 夹具也是 500 万 |
| 4 | `true`，exit 0 | 夹具概率和建议一致 |
| 5 | `false`，exit 1 | 夹具镀金价是 100/300/800/1600 |

结论：只看第 0 步会把夹具当成正式配置放过去，加上 1–5 步才挡得住。

## 不在这张清单里的
- **传说上限**：v1.1 配置里没有这个字段，代码里写死 2（`model.mjs`，CONFIRM-DIFF #3）。拍 A 不用查；拍 B 要等 B 版骨架，跑规则层，预计 132/0。
- **批准记录**（`admitIntegrationConfig` 的 4 个键）：不在板砖的验收口令里。它要求 `walletBridgeApproved === true`，现在仍是 false，走技术门槛。
- **④准 39 张**：还要逐卡稀有度表，而且 v10a 发布之前判不了通过。
- **概率公示**：第 4 步过了以后，再用骨架的 `probabilities()` 读一遍，确认公示的是 0.3%（`ACCEPT-STATUS` ③ 那一行）。
