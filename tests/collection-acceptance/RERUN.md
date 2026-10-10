# 骨架对接检查表 + 落地后复跑对照清单

接口细节见 INTERFACE.md。基线：origin/main `7ce07aa`，规则层和 UI 层都报「缺接口」，退出码 1。

## A. 从「缺接口」到能跑：最少要落地这些（按顺序）

| 步 | 要落地的 | 落地后规则层 / UI 层的表现 |
|---|---|---|
| 1 | 文件 `preview/cards/collection/collection.mjs`（ESM）。路径不一样就设 `COLLECTION_IMPL` | 缺接口的提示从「找不到收集规则模块」变成「缺接口：<函数名>」 |
| 2 | 导出 9 个函数：`validateConfig initCollection maxDupGain overflowRisk prepareDraw commitDraw recover gild setOverflowReminder` | 少一个就仍报缺接口、exit 1。9 个都有，规则层才真正开跑 |
| 3 | 导出 `probabilities` | 没导出时只有 N9-10 失败，其余照跑 |
| 4 | 页面 `preview/cards/collection/index.html`，路径不一样就设 `COLLECTION_URL`。`?collectionTest=1` 时要暴露 `window.CollectionQA.importFixture` 和 `exportState` | UI 不再报「缺接口：window.CollectionQA」，开始点击 |
| 5 | 11 个 data-testid：`draw overflow-dialog overflow-text overflow-continue overflow-cancel overflow-suppress reveal(data-card-id) dust-gained dust-credited dust-overflow restore-overflow-reminder` | 少了哪个，对应条目判失败；少的是 `draw` / `overflow-*`，可能报 Playwright TimeoutError 并 exit 1，这也算缺接口 |
| 6 | 状态和凭据字段按 INTERFACE.md §2 | 字段名不一样就改 ADAPT（`coins dust owned suppress ledger revision rc RECEIPT_FIELDS CODES`），用例不用改 |

## B. 复跑命令和期望

```bash
git fetch && git checkout <骨架分支>    # 合入或 cherry-pick tests/collection-acceptance
node tests/collection-acceptance/rules.test.mjs ; echo rc=$?
python3 -m http.server 8790 &   # 仓库根目录
python3 tests/collection-acceptance/ui_collection.py ; echo rc=$?
# 自证门禁没失效：下面两条都应 rc=1
ACCEPT_CONTROL=1 node tests/collection-acceptance/rules.test.mjs ; echo rc=$?
ACCEPT_CONTROL=1 python3 tests/collection-acceptance/ui_collection.py ; echo rc=$?
```

| 运行 | 现在（基线） | 骨架全部对上后的期望（以参考实现为准） |
|---|---|---|
| 规则层 | `✗ 缺接口：找不到收集规则模块`，`passed 0, failed 0, 未跑`，rc=1 | `passed 130, failed 0`，rc=0。N3-11 打印「跳过」，不计数 |
| 规则层 ACCEPT_CONTROL=1 | 同上 | 失败 10 条（都是 `[反向对照]`），rc=1 |
| UI 层 | `✗ 缺接口：window.CollectionQA…`，rc=1 | 每个引擎每个尺寸 26 条，共 4 档：`passed 104, failed 0`，rc=0 |
| UI 层 ACCEPT_CONTROL=1 | 同上 | 失败 4 条（每档 1 条 N3-2[反向对照]），rc=1 |

骨架的字段或流程如果和 INTERFACE.md 有出入，通过数可以少于 130 / 104，但必须是每条失败都对得上原因。不能用改断言的办法凑数。

## C. 怎么分：仍缺接口，还是真失败

| 看到的 | 归类 | 处理 |
|---|---|---|
| `✗ 缺接口：…`，加 `passed 0, failed 0, 未跑` | 缺接口，没开跑 | 骨架补文件或导出，或者改 ADAPT、COLLECTION_IMPL、COLLECTION_URL |
| `✗ N9-10 缺接口 probabilities(cfg)` | 缺接口，只影响这一条 | 补导出 |
| `✗ <编号> 运行出错：Cannot read … / is not a function` | 多半是接口形状没对上，比如字段名不同、返回结构不同 | 先对 INTERFACE.md，再改 ADAPT。改完还错，才算真失败 |
| UI 报 Playwright `TimeoutError … data-testid=…` | 缺 testid | 补 testid |
| `✗ <编号> <中文期望>`，带实际值，例如 `g/a/o=400/0/400，应 400/100/300` | **真失败**，实现的规则和 v3.3 不一致 | 修实现，不改断言 |
| `✗ <编号>[反向对照] …`，且没开 ACCEPT_CONTROL | **真失败**，实现正好命中了那个故意写错的情形 | 修实现 |
| 开了 ACCEPT_CONTROL=1 却 rc=0 | 门禁失效 | 停下，报板砖 |

最后输出的「失败编号」行，就是要对照 v3.3 编号的清单。
