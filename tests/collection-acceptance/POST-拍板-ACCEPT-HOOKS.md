# 拍板后验收入口（POST-拍板-ACCEPT-HOOKS）

只写测试侧的 md。不替杨总拍板，不改游戏代码，不碰 v1、v1.1、v10a。
对照的两份：小喇叭的 `拍后落地检查.md`（谁改什么），本目录的 `ACCEPT-INDEX.md`（断言和切换表）。这页只回答一件事：每项拍定以后，用哪条命令马上能验，拿什么当通过。

**状态**：四项都没拍，下面每一行都是 **pending**。拍定后把对应行的 pending 改成「已拍 X」；没拍的分支删掉。

## 通用准备
```bash
S=<熊大最新骨架解压目录>     # 现在是 v1.1 faa83859…e69ff；先 sha256sum 核 zip，再 (cd $S && sha256sum -c SHA256.txt)
CFG=<拍板后的正式配置 JSON>
NODE=${NODE:-node}           # 非登录 shell 找不到 node 时设成绝对路径
```
`reveal_gold.test.mjs` 读的环境变量是 `SKEL`，`validate_config.mjs` 和 `rules.test.mjs` 读的是 `SKELETON_DIR`，两边都设成 `$S`。

退出码：0 = 全过；1 = 有失败；3 = 没有失败但有跳过（跳过不算通过）。

## 拍后马上能跑 vs 还要等

「马上能跑」：拍定就能跑，不用等任何人。「等熊大」「等 UI」：拍完还要等对应的交付，在那之前一律 pending，不能拿旧结果顶。

## ① 组牌传说上限

| 分支 | 状态 | 入口 | 通过标准 | 马上能跑？ |
|---|---|---|---|---|
| A：仍 2 张 | pending | `bash tests/collection-acceptance/accept.sh` | 4/4：规则 130/0（rc 0），反向对照 120/10（rc 1），UI 104/0，UI 反向对照 100/4 | 规则层马上能跑；UI 两项要有收集页 |
| A | pending | `SKEL=$S $NODE tests/collection-acceptance/reveal_gold.test.mjs` | 15 过、0 挂；R2-B 从跳过里删掉，跳过从 12 变成 11（rc 3） | 马上能跑 |
| A | pending | 文档 | `LEGEND-B.md`、`COUNTS-B.md` 标作废 | 马上能做 |
| B：限 1 张 | pending | 先跑 `(cd $S && $NODE --test test/*.test.mjs)`，再跑 `accept.sh`（期望数先按 `COUNTS-B.md` 改） | 骨架自带测试失败为 0；规则 132/0（rc 0），反向对照 122/10（rc 1）；UI 不变。期望数以复跑实测为准 | **等熊大**：要 B 版骨架（`TWO_COPY_LIMIT`、`inspectDeck` 按稀有度取上限，收藏和组牌读同一个字段） |
| B | pending | `reveal_gold.test.mjs`，前置改成 1 张（见 `ACCEPT-INDEX.md` 第 4 节） | R2-1/R2-2 变成「1 普 + 金传 → 1 金」，并且不能写「仍有普通」；R3 前置是 1 金；R2-B 从跳过变成执行，执行后挂了就是真挂 | **等熊大**：同上 |
| B | pending | 单条复核：`LEGEND-B.md` 的 N10-4 | 4 种稀有度 × 2 = 8 条：带满判 `valid`，多带 1 张报 `copy-limit` | **等熊大**：同上 |

## ② 粉尘差额写不写（含 ②′ 后半句）

| 分支 | 状态 | 入口 | 通过标准 | 马上能跑？ |
|---|---|---|---|---|
| 两版都要 | pending | `SKEL=$S $NODE tests/collection-acceptance/reveal_gold.test.mjs` | D0-1a–e、D0-2、D0-3 都过 | 马上能跑（现在就是过的） |
| 甲：写差额 | pending | `DUST-GAP.md` 的 DA-1..6，补进 `ui_collection.py` 后跑 `python3 tests/collection-acceptance/ui_collection.py` | 1599 对 1600 显示「还差 1」；差额实时刷新，粉尘够了就消失；横屏 667×375 小字不换行；其他拒绝原因里不出现「还差」 | **等 UI**：要收集页，并带 `data-gild-reason`、`data-dust-short`、`data-gild-need`、`data-gild-have`；断言由板砖补进脚本 |
| 甲 | pending | `reveal_gold.test.mjs` 的 G-1 | 拒绝时带回 `{cost, have, short}`，或者有 `gildPreview`；脚本自动识别 | **等熊大**：G-1（甲版建议必补） |
| 乙：不写 | pending | `DUST-GAP.md` 的 DB-1..3，同样进 `ui_collection.py` | 只显示「粉尘不足」；不出现「你有」「还差」，也不出现差额数字 | **等 UI**：要 `data-gild-reason` |
| ②′ 加 / 不加后半句 | pending | `DUST-GAP.md` 的 D0-6 | 「重复抽到的卡会变成粉尘。」两版一致：拍「加」就必须有，拍「不加」就必须没有 | **等 UI** |
| 两版都要 | pending | `reveal_gold.test.mjs` 的 G-2 | `NOT_OWNED` 和 `ALREADY_ALL_GOLDEN` 分开报码；拆码后 D0-1b、D0-1c 的正则由板砖跟着改 | **等熊大**：G-2（选做） |

## ③ 收敛版 6 条

| 分支 | 状态 | 入口 | 通过标准 | 马上能跑？ |
|---|---|---|---|---|
| 全部按建议 | pending | `SKELETON_DIR=$S $NODE tests/collection-acceptance/validate_config.mjs $CFG` | `✓ validateConfig 通过`，rc 0；打印出来的值和拍板一致：pool=38，`{"common":24,"rare":9,"epic":3,"legendary":2}`，dustBalanceCap=3200；configVersion、poolVersion 已经去掉 `UNAPPROVED-` | 拿到 `$CFG` 就能跑 |
| 全部按建议 | pending | `REGRESSION.md` 第 1→4 步 | 第 2、3 步不受数值影响（夹具），仍是 fail 0 和 130/0（拍 B 就是 132/0） | 第 1–3 步马上能跑；第 4 步要收集页 |
| 全部按建议 | pending | 人工核对 | 公示概率用 `probabilities()` 读出来是 68/22/7/3，金色传说整体 0.3%（1000/10000） | 马上能做 |
| 改了镀金价 | pending | `reveal_gold.test.mjs` 的 D0-2、D0-3 | 边界改成从配置里读（脚本现在用夹具里的 1600），改完复跑 | 板砖改一行脚本后能跑 |
| 改了粉尘上限 | pending | `validate_config.mjs` | 低于最高镀金价时，脚本的交叉检查会报 ✗，rc 1（`validateConfig` 本身不拦） | 马上能跑 |
| 改了金传重复粉尘 | pending | — | 骨架只认 `upgrade-normal-and-dust`，要熊大改代码，然后重跑 R2、R3 | **等熊大** |

## ④ 熊大私聊一次确认包

| 分支 | 状态 | 入口 | 通过标准 | 马上能跑？ |
|---|---|---|---|---|
| 准（39 张） | pending | ① B 的全部入口，再加 `validate_config.mjs $CFG` | pool=39，稀有度 24/10/3/2，含 `bkVanEx1371` | **等 v10a**：珍珠护套属于 v10a，v10a 冻结没发布，这一行在 v10a 发布前不能判过 |
| 准，但卡池先 38 张 | pending | ① B 的全部入口，再加 ③「全部按建议」的入口 | 同 ① B 和 ③ | **等熊大**：要 B 版骨架 |
| 不准 | pending | 不用跑 | `CONFIRM-DIFF.md` 标「未采用」 | 马上能做 |

## 不管拍哪边都要跑
| 入口 | 通过标准 |
|---|---|
| `REGRESSION.md` 1→4 全量复跑 | 期望数一律填复跑实测值；前一步不过，后面不用跑 |
| `python3 tests/collection-acceptance/smoke_g7.py <收集页 URL>` | 完整通过是 26/0/0（rc 0），要接 G4 真实钱包；现在参考页只能 16/0/10（rc 3），不算 G7 通过 |
| 批准记录 | `walletBridgeApproved` 是钱包桥的技术门槛，单独过，不跟着拍板变；现在仍是 false（见 `tests/wallet-bridge/BRIDGE-RECHECK.md`） |

跳过的条目解阻以后如果挂了，算真挂，不能退回跳过。每条跳过的依赖方和最小复跑命令见 `SKIP-OWNERS.md`。
