# 今天就能跑的验收口令清单

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，也不替杨总拍板。
来源：`ACCEPT-STATUS-四项汇总.md` 里标「能跑」的那几行。「存在」这一列是 2026-10-10 在分支 `devin/1791617143-collection-acceptance` 上用 `ls` 逐个核对的。「今天结果」取自 `PRE-拍板-DRYRUN.md` 的实跑。
**四项都还没拍，跑过也只是空跑，不算验收。**

```bash
S=<熊大骨架解压目录>   # 现在是 v1.1：/home/ubuntu/qa/collection/skel11/card-collection-model-v1.1
A=$S/acceptance/tests/collection-acceptance/adapters/skeleton-v1.1.mjs
```

## 拍完马上能跑的

| # | 对应行 | 口令 | 脚本和依赖文件 | 存在 | 今天结果 |
|---|---|---|---|---|---|
| 1 | ①A 规则层 | `SKELETON_DIR=$S COLLECTION_IMPL=$A node tests/collection-acceptance/rules.test.mjs` | `rules.test.mjs`、`$A` | 存在 | 130/0，rc 0 |
| 2 | ①A 反向对照 | 第 1 条前面加 `ACCEPT_CONTROL=1` | 同上 | 存在 | 120/10，rc 1（反向对照就应该是 1） |
| 3 | ①A 揭晓脚本；② D0 规则层（D0-1a–e、D0-2、D0-3 在这个脚本里） | `SKEL=$S node tests/collection-acceptance/reveal_gold.test.mjs` | `reveal_gold.test.mjs` | 存在 | 15/0/12，rc 3：跳过不算通过；拍 A 以后去掉 R2-B，剩 11 条跳过 |
| 4 | REGRESSION 第 2 步：骨架自带测试 | `(cd $S && sha256sum -c SHA256.txt && node --test test/*.test.mjs)` | `$S/SHA256.txt`、`$S/test/` | 存在 | SHA 一致；86/86，rc 0 |
| 5 | REGRESSION 第 3 步：规则层 | 和第 1 条一样 | 同上 | 存在 | 130/0，rc 0 |
| 6 | ①A 一键总跑 | `SKELETON_DIR=$S COLLECTION_IMPL=$A bash tests/collection-acceptance/accept.sh` | `accept.sh`、`rules.test.mjs`、`ui_collection.py` | 脚本存在；**收集页缺失**（仓库里没有 `preview/cards/collection/`） | rc 1：规则层两项过，UI 两项「缺接口」，没跑起来 |

## 脚本在，但输入还没交的（不算「能跑」，列出来对照）

| # | 对应行 | 口令 | 存在 | 缺什么 |
|---|---|---|---|---|
| 7 | ③ REGRESSION 第 1 步 | `SKELETON_DIR=$S node tests/collection-acceptance/validate_config.mjs $CFG` | 脚本存在；**`$CFG` 缺失** | 正式配置 JSON。拿夹具试过，入口能用 |
| 8 | 共用 G7 | `python3 tests/collection-acceptance/smoke_g7.py <页面URL>` | 脚本存在 | G4 真实钱包；参考页跑出来是 16/0/10，rc 3 |
| 9 | ①B 规则层 132/0、122/10 | 和第 1、2 条一样，只换 `$S` | 脚本存在；**B 版骨架缺失** | B 版骨架 |
| 10 | ② 甲 DA、乙 DB、D0-4..6 | 断言写在 `DUST-GAP.md` 里 | **还没写成脚本**：要等收集页，脚本里先硬标跳过 | 收集页 UI；拍完以后板砖再补进 `ui_collection.py` |

## 结论
- 今天能跑的口令：脚本 5 个（`rules.test.mjs`、`reveal_gold.test.mjs`、骨架自带测试、`validate_config.mjs`、`accept.sh`）全部存在，都在 `tests/collection-acceptance/` 下或者骨架包里。
- 缺的不是脚本，是输入：收集页、正式配置、B 版骨架、G4 钱包。
- 注意环境变量名不一样：`reveal_gold` 读 `SKEL`，另外两个读 `SKELETON_DIR`。
