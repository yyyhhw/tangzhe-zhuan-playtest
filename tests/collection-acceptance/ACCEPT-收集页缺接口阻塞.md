# ACCEPT 收集页缺接口阻塞

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a。冒烟没有重跑，结果��用 `ACCEPT-冒烟pass-fail.md` 第 6 条（`7c1bea8`）。**四项还没拍，这页不算验收。**

## 现在的状态
| 项 | 口令 | 期望 | 现在 | 跳过 / 失败 |
|---|---|---|---|---|
| `ui` | `python3 ui_collection.py` | exit 0，104 条通过，0 条失败 | exit 1，打印「缺接口」，0 条通过，0 条失败，没跑起来 | 104 条全部没跑。没有一条断言失败，也不算跳过：脚本一开头就因为缺接口退出 |
| `ui-control` | `ACCEPT_CONTROL=1 python3 ui_collection.py` | exit 1，100 条通过，4 条失败（这 4 条是故意改坏的） | exit 1，打印「缺接口」，0 条通过，0 条失败，没跑起来 | 104 条全部没跑。exit 1 是缺接口造成的，不是反向对照抓到的，不算通过 |

所以 `accept.sh` 总的退出码是 1。规则层和规则层反向对照这两项都过了。

## 熊大要交什么（依据 README「接口约定」第 44–46 行）
| # | 缺件 | 要求 |
|---|---|---|
| 1 | 收集页 | `preview/cards/collection/index.html`，现在分支上没有这个目录。也可以放在别的路径，用 `COLLECTION_URL` 指过去 |
| 2 | 测试模式 | URL 带 `?collectionTest=1` 时进入测试模式 |
| 3 | `window.CollectionQA.importFixture(fixture)` | 导入夹具。夹具里的 `config` 要保证每次都抽到传说 `l-x` 的普通版，粉尘上限 1000，重复粉尘 400。这个夹具我在脚本里已经写好了（`ui_collection.py` 第 15 行），熊大不用另交 |
| 4 | `window.CollectionQA.exportState()` | 返回 `{coins, dust, owned, prefs, ledger, revision}` |
| 5 | 11 个 `data-testid` | `draw`、`overflow-dialog`、`overflow-text`、`overflow-continue`、`overflow-cancel`、`overflow-suppress`、`reveal`（要带 `data-card-id`）、`dust-gained`、`dust-credited`、`dust-overflow`、`restore-overflow-reminder` |
| 6 | 溢出提示文案 | 「超出上限的粉尘会消失，是否继续抽卡？」。②的甲 / 乙文案还没拍，拍了以后按拍定的那版改 `ui_collection.py` 第 13 行的 `TEXT` |
| 7 | 锁的键名（可选） | 有锁这一类的键就告诉我，复验时用 `LOCK_KEYS=a,b` 排除，不计入「零写入」 |

单抽扣 5,000,000，是杨总定的，写在第 13 行 `COST`。金币用经营主存档的 `state.coins`。真实扣款要等 G4，`walletBridgeApproved` 仍是 false。

## 熊大交齐以后怎么复验
1. 沿用冒烟第 6 条：`bash tests/collection-acceptance/accept.sh`（收集页路径不一样的话，加 `COLLECTION_URL=<路径>?collectionTest=1`）。
2. 期望：`ui` 104 条通过、0 条失败，exit 0；`ui-control` 100 条通过、4 条失败，exit 1；规则层两项不变（130/0，120/10）；`accept.sh` 总的 exit 0。
3. 还是打印「缺接口」，就对照上表看缺的是哪一件，退回熊大。断言挂了，就记成真挂，不改断言。
4. DA、DB、D0-4..6 还没写成脚本，要等②拍完、收集页也交了才能写，不在这次复验里。
