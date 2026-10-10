# 拍板后最小回归清单（只测侧）

杨总拍板、熊大把正式配置写成 JSON 以后，按下面 1→4 的顺序跑。前一步不过，后面不用跑。不改产品代码，不碰 v10a。

准备：
- `S=<熊大最新骨架解压目录>`，目前是 v1.1 `faa83859…34e69ff`。先跑 `sha256sum` 核对 zip，再跑 `sha256sum -c $S/SHA256.txt`。
- `CFG=<拍板后的配置 JSON>`

| # | 步骤 | 命令 | 期望 | 现在能跑吗 |
|---|---|---|---|---|
| 1 | 配置自检 | `SKELETON_DIR=$S node tests/collection-acceptance/validate_config.mjs $CFG` | `✓ validateConfig 通过`，rc=0；打印的 pool 张数、各稀有度张数、dustBalanceCap 和拍板一致；configVersion / poolVersion 已经改成新名字 | 能跑（拿到 CFG 就行） |
| 2 | 骨架自带测试 | `(cd $S && node --test test/*.test.mjs)` | fail 0（v1.1 是 86/86） | 能跑 |
| 3 | 规则层 130 | `SKELETON_DIR=$S COLLECTION_IMPL=$S/acceptance/tests/collection-acceptance/adapters/skeleton-v1.1.mjs node tests/collection-acceptance/rules.test.mjs` | `passed 130, failed 0`，rc=0；N3-11 跳过，不计入 | 能跑 |
| 3b | 规则层反向对照 | 同上，前面加 `ACCEPT_CONTROL=1` | `passed 120, failed 10`，rc=1；rc=0 说明门禁失效 | 能跑 |
| 4 | smoke_g7 | `python3 tests/collection-acceptance/smoke_g7.py <收集页 URL>` | 当前可跑的 8 项 ×2 引擎 = 16 过、0 挂，rc=3 | **不能跑**：还没有真实收集页，现在只能拿参考页跑步骤框架 |

## 每一步查什么

1. `validate_config.mjs` 只调用骨架的 `validateConfig`，再补两条骨架不拦的交叉检查：粉尘上限 ≥ 最高镀金价，粉尘上限 ≥ 单张最高重复粉尘。不满足时 rc=1。它不写存档，也不生成批准记录。正式准入（`admitIntegrationConfig` 加批准记录）归「拍板后接线检查清单」。
2. 规则层 130 条用的是测试夹具配置，证明的是规则逻辑，不是拍板后的数值。拍板数值只由第 1 步检查。
3. 只有一种情况要改断言、重跑全部 130 条：杨总把「金色传说重复」改成不是 400。这时 `goldDuplicatePolicy` 要换规则，N9-1~N9-5 的期望也要跟着改。其他改动都只改配置，第 3 步结果不变。

## smoke_g7 现在能跑的项和还在等 UNLOCK 的项

| 现在能跑（参考页 + 模拟钱包） | 还要等 UNLOCK.md 里的缺口 |
|---|---|
| S1 单抽扣款、S1c 余额正好 500 万、S1d 余额差 1 | S1b 根 key（G4 CardHost） |
| S2 溢出弹窗、S2b 空收藏不弹 | S1e 带零头（`exportState().coinFrac`） |
| S3 写档失败不写入 | S4b 同 txId 重放（`replayTx`） |
| S4 刷新不重复扣 | S5b 普通经营写档并发（`economyWrite` + 父页锁） |
| S5 跨标签冲突 | S5c 正式站隔离（`PROD_URL` + 发布审批） |

- 模拟钱包跑出来的结果写「模拟≠真实经营」，rc=3，不算 G7 通过。
- G7 通过要同时满足：26/0/0、rc=0、钱包显示「真实经营」。
- iPhone Safari 实机仍然按 G6-G7.md 手工测。

## 判定

- 1、2、3、3b 四步全部达标：拍板后的配置和骨架规则层回归通过（G3）。
- G4 真实扣款、G7 浏览器冒烟、G6 手工验收不在这张清单里，状态还是未通过。
