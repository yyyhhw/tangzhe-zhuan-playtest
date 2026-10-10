# 缺函数解锁复跑口令（124/2/4 → 130/0/0）

熊大补上 `probabilities` 和 `SET_PREFERENCE` 后，按下面的步骤复跑。只用于测试，不改产品代码，不碰 v10a。

## 0. 现在的基线（骨架 v1 经适配层）

| 状态 | 条数 | 编号 |
|---|---|---|
| 通过 | 124 | 其余全部 |
| 失败 | 2 | N9-10（缺 `probabilities`）、N3-7（缺恢复提醒命令） |
| 未执行 | 4 | N9-10 其余 3 条、N3-7「恢复后再弹」1 条，都被上面两条缺接口提前退出 |
| 跳过 | 不计入 130 | N3-11 批量抽（首版不做） |

## 1. 适配层要接的两处（测试侧，熊大的包到了我来改）

- `adapters/skeleton-v1.mjs` 导出 `probabilities(cfg)`，调用 `model.probabilities()`，返回 `{ legendaryTotal, goldGivenLegendary, goldLegendaryOverall }`。
- `setOverflowReminder(state, on, opts)` 改成发 `SET_PREFERENCE` 命令：`{ type, eventId, txId, expectedRevision, suppressOverflowWarning: !on }`。只改偏好和 `revision`，`collectionRevision`、收藏、粉尘都不能变。
- 如果熊大补的函数名或命令名不一样，只改适配层，不改用例断言。

## 2. 命令

```bash
S=/path/to/card-collection-model-v1.1      # 熊大新包解压目录，先核对 SHA256
(cd $S && node --test test/*.test.mjs)    # 骨架自带测试应全过
SKELETON_DIR=$S COLLECTION_IMPL=tests/collection-acceptance/adapters/skeleton-v1.mjs \
  node tests/collection-acceptance/rules.test.mjs;  echo rc=$?
SKELETON_DIR=$S COLLECTION_IMPL=tests/collection-acceptance/adapters/skeleton-v1.mjs ACCEPT_CONTROL=1 \
  node tests/collection-acceptance/rules.test.mjs;  echo rc=$?
```

## 3. 期望

| 运行 | 期望 | 不达标怎么判 |
|---|---|---|
| 骨架自带测试 | 全部通过 | 骨架问题，退给熊大 |
| 规则层 | `passed 130, failed 0`，rc=0 | 还有「缺接口」字样：适配层没接上；失败行里有期望值和实际值：真失败 |
| 规则层 ACCEPT_CONTROL=1 | `passed 120, failed 10`，rc=1 | rc=0 说明门禁失效 |

## 4. 跳过和未执行的规则

- N3-11 批量抽首版不做，打印「跳过」，不计入 130，也不算通过。
- 通过数 + 失败数必须等于 130。小于 130，就是有断言没执行（被前面的缺接口或报错提前退出），要列出编号，不能算全部通过。
- 规则层 130/130 只说明 G3 过了。用的是模拟钱包，不代表经营扣款验收通过，经营扣款要看 G4。
