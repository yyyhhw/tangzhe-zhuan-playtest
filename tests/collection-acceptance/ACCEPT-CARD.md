# 骨架落地验收口令卡

骨架一到，就在仓库根目录跑下面这段。脚本 `tests/collection-acceptance/accept.sh` 会自己起、自己关 8790 静态服务。

```bash
git fetch origin && git checkout <骨架分支>
git checkout origin/devin/1791617143-collection-acceptance -- tests/collection-acceptance   # 骨架分支上还没有测试目录时才需要
bash tests/collection-acceptance/accept.sh; echo "exit=$?"
```

路径或名字和默认不一样时，在命令前面加环境变量。字段名不一样就改脚本顶部的 ADAPT。

```bash
COLLECTION_IMPL=path/to/collection.mjs \
COLLECTION_URL='http://127.0.0.1:8790/<收集页>?collectionTest=1' \
NODE=/path/to/node \
bash tests/collection-acceptance/accept.sh
```

## 期望（4 行都 ✓，且 exit=0，才算达标）

| 行 | 脚本内部跑的命令 | 期望 rc | 期望汇总行 |
|---|---|---|---|
| rules | `node tests/collection-acceptance/rules.test.mjs` | 0 | `passed 130, failed 0` |
| ui | `python3 tests/collection-acceptance/ui_collection.py` | 0 | `passed 104, failed 0`（2 引擎 × 2 尺寸 × 26 条） |
| rules-control | `ACCEPT_CONTROL=1 node …rules.test.mjs` | 1 | `passed 120, failed 10` |
| ui-control | `ACCEPT_CONTROL=1 python3 …ui_collection.py` | 1 | `passed 100, failed 4` |

- 每行都会打印 ✓ 或 ✗。✗ 行会给出实际 rc 和汇总行；日志里出现「缺接口」时，也会附在这一行后面。完整日志在 `/tmp/collection-accept/*.log`。
- 判断是缺接口还是真失败，看 RERUN.md §C。如果 control 两行 rc=0，说明门禁失效，停下来报板砖。

## 对着熊大骨架 `card-collection-model-v1-review.zip`（SHA256 `39ab6d46…684b45`）

```bash
S=/path/to/card-collection-model-v1          # 解压目录
COLLECTION_IMPL=$S/src/model.mjs node tests/collection-acceptance/rules.test.mjs; echo rc=$?
# 等测试侧适配层 adapters/skeleton-v1.mjs 写好以后，改成：
COLLECTION_IMPL=tests/collection-acceptance/adapters/skeleton-v1.mjs bash tests/collection-acceptance/accept.sh
```

当前实测结果：`✗ 缺接口：validateConfig / initCollection / … / setOverflowReminder`，`passed 0, failed 0, 未跑`，rc=1。
这不是规则失败，而是接口形状不同。骨架只导出 `createFixtureModel(config)` / `createIntegrationModel`，返回一个 Model，流程是 `quote` 加 `reduce` 命令：BEGIN → DECIDE → SELECT → RECORD_DEBIT → COMMIT。金币不在 state 里，走外部钱包端口。

接上骨架需要在测试侧写一个适配层，不改骨架、也不改用例断言。适配层要做这几件事：
- `prepareDraw` 改成 BEGIN 加 SELECT(tickets)，seed 换算成 tickets
- `commitDraw` 改成 DECIDE 加模拟钱包 RECORD_DEBIT 再加 COMMIT
- `state.coins` 由测试侧模拟钱包持有，扣 5,000,000
- 用例里的配置换算成骨架的 Config（`rarities[]`、`goldenLegendaryWeight`、`probabilityScale`、`dustBalanceCap`）
- 测试卡池要换成骨架目录里真实的 cardId，因为骨架会拒绝不在目录里的 ID

UI 两行：骨架包里没有页面，仍按「缺接口，未跑」处理。
