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

---

# smoke_g7 跳过项 → 解锁对照（G7 冒烟，16 过 / 0 挂 / 10 跳过）

10 条跳过 = 下面 5 项 × WebKit、Chromium 两个引擎。每个引擎 13 条，两个引擎共 26 条，目标是 26/0/0、rc=0。

| # | 跳过项 | 缺口（函数/依赖） | 谁补 | 补上后期望 |
|---|---|---|---|---|
| 1 | S1b 只写主档根 key | `CollectionQA.walletMode === 'real'`，也就是 G4 的 CardHost 已经接上主档 | 熊大（G4） | localStorage 的根 key 都在 {`tangzhe-save`, `-bak`, `-tab-lock`} 里，没有新增 |
| 2 | S1e 带零头 | `exportState()` 返回 `coinFrac`（主档里的零头） | 熊大（G4） | 余额 500 万加零头 0.75，抽一次后金币是 0，零头还是 0.75 |
| 3 | S4b 同一 txId 重放 | `CollectionQA.replayTx(txId)` | 熊大 | 重放后金币和凭据都不变：不重新抽，也不再扣费 |
| 4 | S5b 普通经营写档并发 | `CollectionQA.economyWrite()` 和 G4 父页的锁 | 熊大（G4）；断言由板砖等桥接定稿后补 | B 标签做一次普通经营写档，不覆盖 A 标签的抽卡结果；扣款次数等于凭据数 |
| 5 | S5c 正式站与 preview 隔离 | 环境变量 `PROD_URL`（正式站页面） | 杨总批准发布 + G4 | 在 preview 导入存档并抽一次，正式站的 `tangzhe-save` / `-bak` 原文不变 |

复跑口令（补上一项就跑一次，跳过数应该减 2）：
```bash
python3 -m http.server 8790 &          # 仓库根目录
COLLECTION_URL='http://127.0.0.1:8790/preview/cards/collection/index.html?collectionTest=1' \
PROD_URL='<正式站页面，可选>' \
  python3 tests/collection-acceptance/smoke_g7.py; echo rc=$?
```

退出码：
- rc=1：有失败，按失败行里的期望和实际值修。
- rc=3：没有失败，但还有跳过，或者用的还是模拟钱包。这时不算 G7 通过。
- rc=0：26/0/0，钱包一栏显示「真实经营」。

规则：
- 跳过和模拟钱包都不算通过。
- 钩子补上之后，如果某条从「跳过」变成「失败」，那是真失败，不能退回去标跳过。
- iPhone Safari 实机仍然按 G6-G7.md 手工测，脚本盖不到。

## 已解锁：熊大 v1.1（SHA256 `faa83859…34e69ff`）

- 用包里的 `adapters/skeleton-v1.1.mjs` 跑：130/0、rc=0；ACCEPT_CONTROL=1 时 120/10、rc=1。
- 旧的 `skeleton-v1.mjs` 跑 v1.1 还是 124/2、rc=1，这是预期的对照组：旧适配层没有转发这两个新接口，挂的就是 N9-10 和 N3-7，报的都是「缺接口」。这不是骨架的问题，也不用另加 UNLOCK 条目。以后复跑 v1.1 及之后的版本，都用 v1.1 适配层。
