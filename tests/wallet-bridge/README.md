# 钱包桥接验收（测试侧，六项负向）

对照熊大桥接草案 `card-wallet-bridge-review-v1.zip`（SHA256 前缀 `7cc395d3…`）。**只写测试，不改产品代码，不碰 v10a。** 不开浏览器，也不读写 preview 和正式存档：用内存 Storage、Web Locks 替身和隔离测试 key `qa-wallet-bridge-test`。

## 跑法
```bash
WALLET_BRIDGE_IMPL=<实现模块.mjs> node tests/wallet-bridge/bridge.test.mjs
```
默认路径是 `preview/cards/collection/wallet-bridge.mjs`。找不到模块，或者模块没导出 `createWalletBridge`，都打印 `✗ 缺实现`，退出码 1。有任何一条失败，退出码也是 1。全部通过才是 0。

## 接口约定（熊大实现时对齐，可提修改）
- `createWalletBridge({ storage, locks, key, enabled })`
  - `storage` 是 localStorage 形状：`getItem`、`setItem`、`removeItem`。
  - `locks` 是 `navigator.locks` 形状：`request(name, cb)`。
  - `enabled` 不传时，默认按关闭处理。
- `commit(txId, plan)` 返回 `Promise<{ ok, replay?, receipt?, code? }>`。
  - `plan` 是 `{ cost, expectedRev, apply(state) }`。
  - `apply` 在同一份 state 上改 `state.collection`，返回回执要用的字段。
- `status(txId)` 返回 `'committed'` 或 `'none'`，也可以是带 `status` 字段的对象。
- 存档形状：`{ rev, coins, coinFrac, collection: { owned, dust, ledger: { [txId]: receipt } } }`。
- 失败码：`CONFLICT`、`INSUFFICIENT_COINS`、`BRIDGE_DISABLED`。写档失败用什么码不限，但 `ok` 必须是 false。

## 六项
| # | 断言 | 主要拦什么 |
|---|---|---|
| W1 | 同一个 txId 先后提交、并发提交，都只扣一次；重放时 `replay=true`，回执和第一次一样；所有写入都在锁内 | 先扣钱、在 apply 里才判重 |
| W2 | 两个标签页基于同一个 rev 并发提交，只成功 1 笔，另一笔报 `CONFLICT`；所有写入都在锁内 | 不校验 rev、不加锁 |
| W3 | 写前失败：不成交，主档原文不变，重试正好扣 1 次。写成功后崩溃：新实例 `status=committed`，再提交返回 replay，不重复扣、不丢卡，零头 0.25 保留 | 崩溃后重抽、重扣，零头被清掉 |
| W4 | 余额 4,999,999.99 时拒绝，报 `INSUFFICIENT_COINS`，零写入；余额正好 500 万时能成交，抽完余 0 | 拒绝时还写档 |
| W5 | `tangzhe-save` 和 preview 存档的原文不变；只写隔离 key，或者隔离 key 加 `-bak` | 写串存档 |
| W6 | `enabled:false` 和不传 `enabled` 两种情况，都拒绝 `BRIDGE_DISABLED`，或者至少零写入 | 开关关了还扣费 |

## 边界
- 这里的通过只证明桥接逻辑本身，不等于 G4 通过。真实父页 `E.transact`、跨经营/小游戏写入者共用锁、iframe 消息、真浏览器刷新，仍由 G7 `smoke_g7.py` 和 G6 手工验收覆盖。
- `walletBridgeApproved` 由独立技术复核给结论，本脚本通过不会自动把它变成 true。
