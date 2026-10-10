# 拍板前空跑（PRE-拍板-DRYRUN）

只写 md，只跑已有脚本。不改游戏代码，不动 v1、v1.1、v10a，挂了只记不修。
对照 `POST-拍板-ACCEPT-HOOKS.md` 里「拍 A 马上能跑」的条目，加上「不管拍哪边都要跑」的条目，在拍板之前先空跑一遍，看入口通不通。
**这不是验收。** 四项都没拍；跑的是 v1.1 骨架和测试夹具配置，不是正式配置。

环境：骨架 `S=/home/ubuntu/qa/collection/skel11/card-collection-model-v1.1`，node v24.19.0，分支 `devin/1791617143-collection-acceptance`。

## 结果：9 条，能跑通 7 条，挂 1 条（缺收集页，预期之内），没法跑 1 条（缺正式配置）

| # | 命令 | 退出码 | 一行摘要 | 判定 |
|---|---|---|---|---|
| 1 | `sha256sum card-collection-model-v1.1-review.zip` | — | `faa83859…34e69ff`，和公布的一致 | 通 |
| 2 | `(cd $S && sha256sum -c SHA256.txt --quiet)` | 0 | 包内文件没有不符的 | 通 |
| 3 | `(cd $S && node --test test/*.test.mjs)` | 0 | 86 个测试，86 过、0 挂、0 跳 | 通 |
| 4 | `SKELETON_DIR=$S COLLECTION_IMPL=$S/acceptance/tests/collection-acceptance/adapters/skeleton-v1.1.mjs node tests/collection-acceptance/rules.test.mjs` | 0 | `passed 130, failed 0`（拍 A 期望值） | 通 |
| 5 | 同上，前面加 `ACCEPT_CONTROL=1` | 1 | `passed 120, failed 10`，10 条故意改坏的都被抓到 | 通（反向对照就应该 rc 1） |
| 6 | `SKEL=$S node tests/collection-acceptance/reveal_gold.test.mjs` | 3 | 15 过、0 挂、12 跳（拍 A 后去掉 R2-B，变成 11 跳） | 通（rc 3 = 有跳过，不算通过） |
| 7 | `COLLECTION_IMPL=… SKELETON_DIR=$S bash tests/collection-acceptance/accept.sh` | 1 | 规则层 ✓ 130/0，规则反向对照 ✓ 120/10；ui 和 ui-control 都报 `✗ 缺接口：window.CollectionQA.importFixture / exportState`，没跑起来 | **挂**：缺收集页（仓库里没有 `preview/cards/collection/`），预期之内，没修 |
| 8 | `SKELETON_DIR=$S node tests/collection-acceptance/validate_config.mjs <config.json>` | 0（夹具） | 正式配置还没有，拿骨架夹具 `fixtureConfig()` 试跑入口：`✓ validateConfig 通过`，pool=39，`{"common":10,"rare":10,"epic":10,"legendary":9}`，dustBalanceCap=3200，版本名还带 `UNAPPROVED-` | **跑不了真的**：要等熊大交 `$CFG`。这一行只证明入口能用 |
| 9 | `python3 tests/collection-acceptance/smoke_g7.py http://127.0.0.1:8791/index.html`（参考页，模拟钱包） | 3 | `passed 16, failed 0, skipped 10`，WebKit 和 Chromium 各跑一遍；钱包是模拟的 | 通（只是走通步骤，模拟≠真实经营，不算 G7） |

## 要说明的
- 第 7 条挂在 UI，规则层两项是过的。UI 两项要等熊大交收集页，并且实现 `CollectionQA.importFixture` / `exportState`，之后期望 104/0 和 100/4。
- 第 8 条拿到正式配置以后要重跑，按 `POST-拍板-ACCEPT-HOOKS.md` ③ 的标准判：pool=38，24/9/3/2，3200，版本名去掉 `UNAPPROVED-`。
- 第 9 条要接上 G4 真实钱包，跑出 26/0/0、rc 0，才算 G7 通过。
- 拍 B 的入口都没跑，要等 B 版骨架。
- 日志：`/tmp/collection-accept/`（accept.sh）、`/home/ubuntu/qa/dryrun/smoke_g7.log`。
