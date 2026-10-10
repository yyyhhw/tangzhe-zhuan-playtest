# ACCEPT 收集页交件核对表

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，不重跑冒烟。依据：`ACCEPT-收集页缺接口阻塞.md`、README「接口约定」第 44–46 行、`ui_collection.py`。
用法：熊大交收集页时逐项打勾。**任何一项没勾，整份退回熊大，不跑 `accept.sh`。** 全部勾上以后，再按阻塞页的「复验」节跑。

先设两个变量：
```bash
U=${COLLECTION_URL:-http://127.0.0.1:8790/preview/cards/collection/index.html?collectionTest=1}
F=<收集页的 html 文件和 js 文件>
```

| # | 项 | 怎么核 | 通过条件 | ☐ | 没通过 |
|---|---|---|---|---|---|
| 1 | 路径 | `ls preview/cards/collection/index.html`；放在别处的话，熊大要给出 `COLLECTION_URL` | 文件存在，或者给了 URL | ☐ | 退回：缺收集页或缺 URL |
| 2 | 测试模式 | 打开 `$U`，在控制台跑 `typeof window.CollectionQA` | `object`（`?collectionTest=1` 生效） | ☐ | 退回：缺测试模式 |
| 3 | `importFixture` | 控制台跑 `typeof CollectionQA.importFixture` | `function` | ☐ | 退回：缺接口 |
| 4 | `exportState` | `Object.keys(CollectionQA.exportState()).sort()` | 正好 6 个键：`coins, dust, ledger, owned, prefs, revision` | ☐ | 退回：缺接口或缺字段 |
| 5 | 11 个 `data-testid` | `for t in draw overflow-dialog overflow-text overflow-continue overflow-cancel overflow-suppress reveal dust-gained dust-credited dust-overflow restore-overflow-reminder; do grep -q "data-testid=[\"']$t[\"']" $F \|\| echo 缺 $t; done` | 一条「缺」都没打印。弹窗一类动态生成的控件 grep 不到的话，在页面里点出来再查 | ☐ | 退回：缺哪几个 testid |
| 5a | `reveal` 上的卡号 | 抽一次，看 `[data-testid=reveal]` 上有没有 `data-card-id` | 有，值是 `l-x` | ☐ | 退回：缺 `data-card-id` |
| 6 | 溢出文案 | `overflow-text` 的文字 | 和 `ui_collection.py` 第 13 行 `TEXT` 一字不差：「超出上限的粉尘会消失，是否继续抽卡？」。②的甲 / 乙文案还没拍，拍了以后先改 `TEXT`，再按拍定的那版核 | ☐ | 退回：文案不一致 |
| 7 | 锁的键名（可选） | 问熊大有没有 | 有的话，复验时带上 `LOCK_KEYS=a,b`；没有就跳过这一项 | ☐ | 不退回 |

不用熊大交的：夹具，已经写在 `ui_collection.py` 第 15 行。单抽 5,000,000 是杨总定的，写在第 13 行 `COST`。
勾完以后，`accept.sh` 要是还打印「缺接口」，说明表上有一项核错了，回到这张表重核。断言没过就记成失败，不改断言。`walletBridgeApproved` 仍是 false，真实扣款要等 G4。
