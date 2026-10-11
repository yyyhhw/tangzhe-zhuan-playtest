# 容量保护独立候选（capacity-guard-candidate，基于 d976d067）

熊二代熊大开发，未发版、未合 main，等熊大复核。

## 改了哪些文件
- `collection/host-wallet.mjs`
  - 新增 `reserveFor()`：quote（BEGIN 之前）在克隆上把整笔交易按最坏情况空跑一遍（BEGIN→DECIDE→SELECT→RECORD_DEBIT→COMMIT 回执→request 绑定→ack），所有稀有度 × 金/非金票据取最大值，再加 8 KiB 余量；超过 maxBytes 就返回 `CAPACITY_LIMIT_REACHED`，不写收藏、不抽随机数、不扣费。空跑失败时退回固定 32 KiB 预留（更保守）。
  - `transactPrepared` 把真实保存失败码（如 `CAPACITY_READ_ONLY`）透传出来，原来一律报 `WRITE_FAILED`。扣费回滚仍由 `E.transact` 原地完成。
  - 新增 `recoverPending()`（父页面方法，不是 iframe 命令）：先 reconcile COMMIT_UNCERTAIN；selected/debited 的悬挂交易按已锁定结果走原 resume 路径（先查 committed 再扣费，只扣一次、不重抽）；awaiting-decision 不替玩家做决定。恢复、resume、ack 都**不受**新交易预留门槛限制。
  - 新增 `capacity()` 只读探针。
- `collection/host-save.mjs`：只加一个只读 getter `maxBytes`。
- `collection/batch-draw.mjs`（新）：十连接口设计 `planBatchDraw()`，固定 `BATCH_DRAW_ENABLED=false`，没被任何页面引用；handle() 不接受 batch 命令。
- `tests/formal/capacity-guard.test.mjs`（新）：9 个单测。

没动：经济数值、存档 schema、历史交易/事件/回执、iframe 协议命令白名单、preview/、v10a、版本号。

## 测试结果
- 新单测 capacity-guard 9/9；tests/formal 下全部 *.test.mjs 通过（bgm-pcm 20、bgm 11、economy-v2 16、fc2-archive 12、target-preview 8、td-fc2 1、td-receipts 13）；protocol.mjs 19/19；cards save.test 27/27；zbtop-preserve 10/10。
- 浏览器：transaction-browser（Chromium，本地起服务）通过。
- 已有失败，d976d067 基线上一模一样，跟本次改动无关：test_economy 2 个、test_coin_safety 6 个、test_root_keys 8 个（版本号/缓存号/键名守门是旧版本写死的）；final-browser.mjs 卡在已隐藏的 `#pause`（FC6 时期脚本）。

## 剩余风险 / 疑问
1. 余量 8 KiB 是拍的：要覆盖 quote 之后到 COMMIT 之间经营存档的增长（收入、宠物、自动存档）。请熊大确认要不要改成按比例。
2. maxBytes 按 JSON 字符数算（和现有 commit 一致），不是 localStorage 真实配额；主档和 -bak 各占一份，浏览器配额先满的话仍会走 QuotaExceeded→回滚→悬挂→恢复这条路（已测，不吞扣费）。
3. 交易历史只增不减，不删历史就意味着终究会到门槛；到了以后只能经营，不能抽卡/合成。长期怎么办（归档/压缩）需要杨总或熊大另行决定，本候选没做。
4. `restore-reminders`（设置事件）没加门槛，满了会以 CAPACITY_READ_ONLY 安全失败。
5. `recoverPending()` 还没接到 bootstrap/UI；现在 UI 的 resume 按钮照常可用。要不要启动时自动调用，等复核后再定（按保守原则没接）。
