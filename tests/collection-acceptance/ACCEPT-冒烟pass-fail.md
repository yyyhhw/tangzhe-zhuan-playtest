# ACCEPT 冒烟：pass/fail 清单

只写 md，不改断言口径，不改游戏代码，不动 v1、v1.1、v10a。**四项还没拍，这次跑只是冒烟，不算验收。**
跑在分支 `devin/1791617143-collection-acceptance` 的 `5036270` 上，骨架用 v1.1。上次实跑（`ACCEPT-现跑结果.md`）以后，只加过 md，没改过脚本。

| # | 口令 | exit | 结果 | 一句话 |
|---|---|---|---|---|
| 1 | `(cd $S && sha256sum -c SHA256.txt)` | 0 | pass | 包内文件和 SHA256.txt 一致 |
| 2 | `(cd $S && node --test test/*.test.mjs)` | 0 | pass | 86 条测试，86 条通过，0 失败，0 跳过 |
| 3 | `rules.test.mjs`（①A 规则层） | 0 | pass | 130 条通过，0 失败 |
| 4 | `ACCEPT_CONTROL=1 rules.test.mjs`（反向对照） | 1 | pass | 120 条通过，10 条失败；10 条故意改坏的都被抓到，反向对照退出码本来就应该是 1 |
| 5 | `SKEL=$S reveal_gold.test.mjs` | 3 | pass（带跳过） | 15 条通过，0 失败，12 条跳过；跳过的不算通过，用的是模拟夹具，不等于 G4 或 G7 通过 |
| 6 | `accept.sh`（一键总跑） | 1 | **fail** | 规则层和反向对照都过了；`ui`、`ui-control` 两项没跑起来，因为收集页还没交，缺 `window.CollectionQA.importFixture / exportState` 这两个接口（依赖方：熊大） |

和基线比：6 条的结果都和上次一致，没有退步。第 6 条的 fail 不是退步，是收集页还没交。
这次没跑的：`validate_config` 缺正式配置，`smoke_g7` 缺 G4 真实钱包，①B 的两条缺 B 版骨架。v10a 逐字节核验单独算跳过。`walletBridgeApproved` 仍是 false。
