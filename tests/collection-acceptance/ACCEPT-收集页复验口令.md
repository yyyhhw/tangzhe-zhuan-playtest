# ACCEPT 收集页复验口令

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，不重跑冒烟。依据：`ACCEPT-收集页交件核对表.md`、`ACCEPT-收集页缺接口阻塞.md`、`ACCEPT-冒烟pass-fail.md` 第 6 条、`accept.sh`。
**前提：核对表第 1–6 项（含 5a）全部打勾。** 有一项没勾就不跑，整份退回熊大。四项没拍之前，跑出来的结果也只算冒烟。

## 按顺序复制跑
```bash
cd /home/ubuntu/qa/wt-coll
export PATH=~/.nvm/versions/node/v24.19.0/bin:$PATH
S=/home/ubuntu/qa/collection/skel11/card-collection-model-v1.1
A=$S/acceptance/tests/collection-acceptance/adapters/skeleton-v1.1.mjs
T=tests/collection-acceptance
# 收集页不在默认路径时，再加一行：export COLLECTION_URL='<地址>?collectionTest=1'
```

| 步 | 口令 | 期望 exit | 期望输出（一句） |
|---|---|---|---|
| 1 | `SKELETON_DIR=$S COLLECTION_IMPL=$A bash $T/accept.sh; echo rc=$?` | 0 | 4 行都是 ✓：`rules 130/0`、`ui 104/0`、`rules-control 120/10`、`ui-control 100/4`，最后一行「达标：4/4」 |
| 2（第 1 步没过才跑） | `python3 $T/ui_collection.py` | 0 | 末行 `passed 104, failed 0`。逐条看是哪一条挂了 |
| 3（第 1 步没过才跑） | `ACCEPT_CONTROL=1 python3 $T/ui_collection.py` | 1 | 末行 `passed 100, failed 4`，就是故意改坏的那 4 条 |

`accept.sh` 会自己在 8790 端口起静态服务，跑完自己关；端口被占了，就加 `PORT=<别的端口>`。日志在 `/tmp/collection-accept/<项>.log`。

## 失败了怎么读
| 现象 | 算什么 | 处理 |
|---|---|---|
| 打印「缺接口」，`passed 0, failed 0, 未跑` | 退回 | 核对表有一项核错了，回到核对表重核，再退回熊大。不算断言失败 |
| 打不开页面，或者 `pageerror` | 退回 | 退回熊大，附上日志 |
| `ui` 有 `failed N`（N > 0），对应的是真断言 | **断言失败** | 记成真挂，把编号（比如 N3-9）和那一行原文贴给熊大。不改断言 |
| `ui-control` 不是 `100/4` | 反向对照没生效 | 少于 4 条失败：断言太松，回报熊二，我来查脚本，断言口径不改；多于 4 条：先看 `ui` 有没有挂 |
| `rules` 或 `rules-control` 不是 130/0、120/10 | 退步 | 规则层不该受收集页影响，查是不是有人动了骨架或者 adapter。按 `RERUN.md` §C 分类 |
| 溢出文案对不上 | 退回，或者等② | ②拍了就先改 `TEXT` 再跑；没拍就按现在的文案核 |

全部过了，只说明收集页的接口和 UI 断言过了。DA、DB、D0-4..6 要等②拍完再写脚本；真实扣款要等 G4；`walletBridgeApproved` 仍是 false。
