# 卡牌收集 验收脚本（负向提纲 v3.3）

只是测试，没有产品代码。收集系统还没实现时，两个脚本都会打印「缺接口」，并以 exit 1 退出，不会空过。

## 怎么跑

```bash
# 规则层（Node ≥ 18）
node tests/collection-acceptance/rules.test.mjs
COLLECTION_IMPL=path/to/collection.mjs node tests/collection-acceptance/rules.test.mjs   # 指向别的模块

# UI 层（Python Playwright，依次跑 WebKit 和 Chromium，每个引擎 844×390 和 568×320 两档）
python3 -m http.server 8790 &          # 在仓库根目录起静态服务
python3 tests/collection-acceptance/ui_collection.py                      # 默认 URL 见下
python3 tests/collection-acceptance/ui_collection.py "http://127.0.0.1:8790/<收集页>?collectionTest=1"

# 反向对照（G5）：每组故意写错 1 条期望，必须非零退出
ACCEPT_CONTROL=1 node tests/collection-acceptance/rules.test.mjs ; echo $?   # 应为 1
ACCEPT_CONTROL=1 python3 tests/collection-acceptance/ui_collection.py ... ; echo $?   # 应为 1
```

退出码：0 = 全部通过；1 = 有断言失败，或缺接口、未跑。失败时会打印 `✗ 编号 原因`，最后汇总「失败编号」。
批量抽首版不做，N3-11 打印「跳过」，不计入通过数。

## 接口约定（实现名字不同，只改脚本顶部的 ADAPT）

**规则层**：默认模块 `preview/cards/collection/collection.mjs`，导出的都是纯函数，提交时通过 `opts.save(newState)` 写档。

| 函数 | 约定 |
|---|---|
| `validateConfig(cfg)` | 返回 `{ok, errors}`。非传说也直接出金时，要拒绝配置，或者保证这些稀有度只出普通（N9-11） |
| `initCollection({dust, owned, prefs})` | 返回 `state.collection`（含 revision、dust、owned[cardId] = {normal, gold}、prefs.suppressOverflowWarn、ledger） |
| `prepareDraw(state, cfg, {txId, seed})` | 只算结果，不改状态，返回 `{txId, seed, baseRevision, result:{cardId, rarity, foil}}` |
| `commitDraw(state, cfg, draft, {save, confirmOverflow, suppressOverflowWarn})` | 返回 `{ok, state, receipt}` 或 `{ok:false, code}`，code 取 CONFLICT、INSUFFICIENT_COINS、NEED_OVERFLOW_CONFIRM、SAVE_FAILED 之一。失败时不改原 state。同一 txId 只入账一次 |
| `recover(state, txId)` | 返回 `{status:'committed', receipt}` 或 `{status:'absent'}` |
| `gild(state, cfg, cardId, {save})` / `setOverflowReminder(state, on, {save})` | 镀金 / 恢复提醒 |
| `maxDupGain(cfg)` / `overflowRisk(state, cfg)` | 溢出风险的判定条件：DUST_MAX − 当前粉尘 < MAX_DUP_GAIN |
| `probabilities(cfg)`（N9-10） | 返回 `{legendaryTotal, goldGivenLegendary, goldLegendaryOverall}` |

- 金币就是经营主存档里的 `state.coins` / `coinFrac`（`preview/economy.js`）。单抽固定扣 5,000,000，零头不动，不另造货币。
- 凭据（receipt）字段：`txId, rulesVersion, poolVersion, baseRevision, commitRevision, cardId, rarity, foil, coinCost, change(new|add|upgrade|dust), dust:{gained, credited, overflow}, committed`。
- 测试配置里，除单抽 500 万外，其他数值都是占位，不代表推荐或批准。

**UI 层**：页面加 `?collectionTest=1` 进入测试模式，并暴露 `window.CollectionQA.importFixture(fixture)` 和 `exportState()`（返回 `{coins, dust, owned, prefs, ledger, revision}`）。fixture 里带 `config`，要求每次都抽到传说 `l-x` 的普通版，粉尘上限 1000，重复粉尘 400。
控件用 `data-testid` 定位：`draw`、`overflow-dialog`、`overflow-text`、`overflow-continue`、`overflow-cancel`、`overflow-suppress`、`reveal`（带 `data-card-id`）、`dust-gained`、`dust-credited`、`dust-overflow`、`restore-overflow-reminder`。
点击只用普通 `locator.click`，不用 force，也不绕触摸。Storage 的 setItem、removeItem、clear 只记录、不拦截。锁一类的键用 `LOCK_KEYS=a,b` 排除，不计入「零写入」。

## 与 v3.3 编号对照

| v3.3 | 规则层 | UI 层 |
|---|---|---|
| G7 粉尘 g/a/o 总账 | 所有化尘用例都核：g、a = min(g, 上限−当前)、o = g−a、抽后 = 抽前 + a | N3-9 结果页 400/100/300 |
| N1-1 同名不同 cardId / N1-2 | ✓ | |
| N1-3a 第 2 张不化尘 / N1-3b 第 3 张化尘（容量充足、已满各验一次）/ N1-3c 1普1金已满 | ✓ | |
| N1-5 镀金不重置计数 | ✓ | |
| N2-2 镀金只改外观 / N2-3~5 不可镀金零写入 | ✓ | |
| N3-1 边界不弹，MAX_DUP_GAIN 含金传 | ✓ | |
| N3-2 弹窗：文案、默认不勾、不遮挡、零写入 | ✓ | ✓（844 和 568 两档） |
| N3-3 取消 / N3-4 勾选后取消，偏好不持久化 | ✓ | ✓ |
| N3-5 继续不勾选，下次还弹 / N3-6 勾选继续，刷新后仍生效，写档失败不留偏好 / N3-7 恢复提醒 | ✓ | ✓ |
| N3-8 Esc 按取消处理 | | ✓ |
| N3-9 部分溢出 / N3-10 已满时新卡照常到账 | ✓ | ✓（N3-9） |
| N3-11 批量 | 首版不做，跳过 | |
| N3-12 / N4-6 旧 revision 冲突，零写入 | ✓ | |
| N3-13 / N4-4 同一 txId 重放只入账 1 次（含 revision 对得上的情况） | ✓ | ✓ 双击 |
| N3-14 / N4-2 写档失败后重试：同一 txId、同一结果 | ✓ | |
| N4-1 差 1 金币，零写入 | ✓ | ✓ |
| N4-3 / N4-8 刷新、重开后按 txId 恢复，不重复扣费 | ✓ | ✓ |
| N4-5 两标签：扣费次数 = 凭据数 | ✓ | ✓ |
| N4-10 凭据字段齐全 | ✓ | |
| N5-1 揭晓时切后台、离页再返回 / N5-3 卡面 = 凭据 | | ✓ |
| N7-3 抽到的卡进收藏 | ✓ | |
| N9-1 满2普抽金传：升级 + 粉尘 / N9-2 / N9-3 1普1金抽金传：升级 + 粉尘 / N9-4 2金只给粉尘、不降级 / N9-5 | ✓（容量充足、已满各验一次） | |
| N9-10 概率三项，总体 = 积 / N9-11 只有传说直接出金 / N9-12 不静默零粉尘 | ✓ | |
| 公用金币 500 万（COIN） | ✓ 扣 5,000,000、零头不动、不另造货币 | ✓ 扣 500 万 |

还没写成脚本的条目：N5-2 跳过动画、N6 奖励领取（rewardId）、N7 旧档、N8 标记灰度、N9-6/7/8 金传演出。这些要等界面和动画定下来再补，所以现在仍按 v3.3 手工验。
