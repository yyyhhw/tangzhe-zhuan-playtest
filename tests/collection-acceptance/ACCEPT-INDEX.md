# 验收口令总索引 · 现在就能跑的断言 · 拍板后要切换的地方

这页只写测试侧的 md，再加一个可跑的脚本骨架。不改游戏代码，不碰 v10a，也不替杨总拍板。
目录：`tests/collection-acceptance/`

## 1. 文件索引
| 文件 | 管什么 | 现在的状态 |
|---|---|---|
| `LEGEND-B.md` | 拍 B（组牌传说限 1）时，哪些断言要改 | 预备；拍 A 就作废 |
| `COUNTS-B.md` | 拍 B 后，accept.sh 和 REGRESSION 里的期望数要怎么同步 | 预备：规则 130→132，反向对照 120/10→122/10 |
| `CONFIRM-DIFF.md` | 一次确认包和 v1.1 骨架的差异 | 全部待拍；差 4 项 |
| `REVEAL-GOLD.md` | 提交后才揭晓、金色升级仍有普通、两金只化尘 | 预备 → **已落成骨架** `reveal_gold.test.mjs` |
| `DUST-GAP.md` | 粉尘差额写不写（甲版 / 乙版） | 预备；D0 规则这部分已落成骨架 |
| `reveal_gold.test.mjs` | R1/R2/R3/D0/G 的规则层断言 | **现在 15 过 / 0 失败 / 12 跳过，rc=3** |

跑法：`SKEL=<骨架包根> node tests/collection-acceptance/reveal_gold.test.mjs`
退出码：0 = 全过且没有跳过；1 = 有失败；3 = 没有失败但有跳过（不算通过）。

脚本自证结果：
- 去掉揭晓门 → 3 条失败，rc=1
- 升级时吞掉普通卡 → R2-1a 失败，rc=1
- 镀金价边界写成 `<=` → rc=1
- 没有骨架 → 报「缺实现」，rc=1

## 2. 不依赖待拍四项、也不依赖 G-1/G-2 缺口，现在就能跑（已脚本化）
| ID | 断言 | 来源 |
|---|---|---|
| R1-1a/b/c | 交易在 confirmed、selected、debited 三个阶段，`publicResult` 都抛 `NO_COMMITTED_REVEAL` | REVEAL-GOLD |
| R1-3 | restore 之后，同一个 txId 揭晓出来的结果逐字一致 | REVEAL-GOLD |
| R2-1a / R2-2a | 2 普 + 金传 → 1 普 1 金；1 普 1 金 + 金传 → 2 金。两种的 action 都是 `upgraded-and-dusted`，粉尘 400（按 A 方案的现行规则） | REVEAL-GOLD |
| R3-1 / R3-2 | 2 金再抽到金或普 → `dusted`，不降级，粉尘 400 | REVEAL-GOLD |
| D0-1a–e | 4 种拒绝原因，再加「有未完成的交易」，都报错，并且状态一字不变 | DUST-GAP |
| D0-2 / D0-3 | 粉尘等于镀金价可以镀，镀后为 0；少 1 就拒绝 | DUST-GAP |

注：R2/R3 是按现行「传说收 2 张」写的。拍 B 的话，按第 4 节改前置条件。

## 3. 必须跳过的（12 条），依赖什么
| ID | 依赖 |
|---|---|
| R2-1b / R2-2b 剩余普通数 | 熊大补 `publicResult.after` 或 `remainingNormal` |
| G-1 拒绝时带回差额 | 熊大补 `gildQuote`：返回 `{cost, have, short}` |
| G-2 没抽到 / 已全金分开报码 | 熊大补 `gildQuote`：拆码 |
| R1-2 写档失败后不揭晓 | G4 CardHost / 真实存档 |
| R1-4 回执落盘先于卡面 | 收集页 UI 和 smoke_g7 |
| R2-B | 待拍 ① |
| D0-4 / D0-5 | 收集页 UI |
| D0-6 / DA / DB | 收集页 UI，加待拍 ② |

跳过的条目一旦接口补上，就变成可执行；这时候再失败就算真失败，不能再退回跳过。

## 4. 拍板后要切换的地方
| 待拍项 | 拍成 | 要改的 | 能直接用的 |
|---|---|---|---|
| ① 组牌传说上限 | A：仍 2 | LEGEND-B 和 COUNTS-B 作废；R2-B 删掉 | R1、R2、R3、D0 全部；accept.sh 维持 130/120 |
| | B：限 1 | 按 LEGEND-B 改规则层，按 COUNTS-B 同步到 132/122；R2-1/R2-2 改成「1 普 + 金传 → 1 金」，并且不能写「仍有普通」；R3 前置改成 1 金；脚本里 `init({[L]:{normal:2}})` 这类前置改成 1 | R1、D0、G |
| ② 粉尘差额 | 写（甲版） | 跑 DA-1..6，删掉 DB；G-1 建议提到「必补」 | D0 |
| | 不写（乙版） | 跑 DB-1..3，删掉 DA；G-1 变成可选 | D0 |
| ②′ 后半句 | 加 / 不加 | D0-6 按拍定的结果改成「必须有」或「必须没有」 | — |
| ③ 收敛版 6 条 / ④ 熊大私聊包 | 按建议值 | CONFIRM-DIFF 那 4 项差异：稀有度表、镀金价、版本名由熊大改配置；传说上限跟着 ① 走；然后跑 `validate_config.mjs` 和 REGRESSION 第 1 步 | R1、R2、R3、D0 用的是测试夹具，不受数值影响 |
| | 镀金价改了 | D0-2/D0-3 的边界改成从配置里读（脚本现在用的是夹具里的 1600） | 其他条目 |

拍完以后，先跑 `validate_config`，再跑规则层（accept.sh），然后跑 `reveal_gold.test.mjs`，最后跑 smoke_g7。
