# 容量保护独立候选（capacity-guard-candidate，基于 d976d067）

熊二代熊大开发。未发版、未合 main，正在熊大深审中。

## 行为
1. **新交易预留（quote 阶段，BEGIN 之前）**：`reserveFor()` 在克隆上把整笔交易空跑一遍：BEGIN→DECIDE→SELECT→RECORD_DEBIT→COMMIT（回执）→request 绑定→ack。抽卡取 4 种稀有度 × 金/非金票据里最长的那种；`walletRevision` 按 MAX_SAFE_INTEGER（16 位）算。然后要求 `最终 JSON 长度 + 8192 ≤ maxBytes`，不满足就返回 `CAPACITY_LIMIT_REACHED`：不写收藏、不抽随机数、不扣费。
2. **confirm 时再检查一次**（这次新加）：quote 之后玩家可能还在经营，存档会变大。所以 confirm 选 continue 时，在 flush 之后、生成随机票之前，按当前真实存档再预留一次；不够就返回 `CAPACITY_LIMIT_REACHED`（canCancel:true）。交易停在 awaiting-decision，玩家还能取消。
3. **写档失败分三类**（按 host-save.commit 的真实返回）：
   - 写前失败（`CAPACITY_READ_ONLY` 超长、`BACKUP_WRITE_FAILED`、`REVISION_CONFLICT` 等）：主档没写。`E.transact` 在内存里原地回滚，存档里的金币不变。可以断言"没扣费"。
   - 写了、读回仍是旧值（`WRITE_FAILED`）：主档仍是旧值，可以断言"没扣费"。
   - 未知提交（`COMMIT_UNCERTAIN`，读回既不是旧值也不是新值，或者读失败）：**不能断言已回滚**。coordinator 进入 fault，必须先 `reconcile()` 读回真实主档才能继续；内存回滚不代表存档回滚。`snapshot`、`resume`、`recoverPending` 都会先 reconcile。
   - 外部写入（`FOREIGN_WRITE_READ_ONLY`）：只读保护，不覆盖。
4. **悬挂交易恢复 `recoverPending()`**（按真实状态）：
   - `selected`：走原来的 transactPrepared，先查 committed 再扣费，按锁定票据提交，只扣一次、不重抽。
   - `debited`：RECORD_DEBIT 和扣费是在同一次保存里写进去的（walletRevision = 那次保存的 rev），所以金币已经扣过。恢复时只追加 COMMIT（price 0），不再扣费、不抽随机数。如果钱包证据（debitId / walletRevision ≤ 当前 rev）证明不了扣费已经在当前存档里，就返回 `DEBIT_EVIDENCE_UNPROVEN_PROTECTED`，不写档。实际上被篡改的 receipt 在模型回放校验那一步就会被 `STATE_REPLAY_MISMATCH_KEEP_ORIGINAL` 拒掉。`resume` 命令同样支持 debited，不会再报 INVALID_PREPARED_STATE。
   - `awaiting-decision`：不替玩家做决定，返回 needsDecision。
   - `confirmed` 等其他阶段：返回 `RECOVERY_STAGE_UNSUPPORTED_PROTECTED`，不处理。
   - 物理空间不足（恢复所需的提交超过 maxBytes）：返回原错误码（如 `CAPACITY_READ_ONLY`）并带 `protected:true`。交易保持锁定结果，金币不变，**不删历史、不重抽、不承诺可恢复**；需要人工处理或者等扩容方案。
   - 恢复不受新交易预留门槛限制，但仍受 maxBytes 物理上限约束。
5. **重要：`recoverPending()` 还没接到启动流程或 UI**。在接入并完成浏览器验收之前，**不能算"玩家可恢复"**。目前玩家能用的只有原来 UI 上的 resume（现在也支持 debited）。

## 8 KiB 余量的论证（按实际字符长度上界）
- 余量要覆盖的是"预留估算值"和"真实提交长度"之间的差。估算本身已经是上界：
  - 交易体：txId、requestId 用真实值；票据取所有稀有度 × 金/非金里最长的；walletRevision 用 16 位最大值；DECIDE 用 allowDustOverflow:true / suppress:false（真实决定只会一样长或更短，"true" 比 "false" 少 1 个字符）。
  - 实测（/tmp 脚本，txId 用最长 140 字符，requestId 160 字符，6 种票据 × 20 张卡）：真实长度 − 估算值（不加余量）**最大为 0**，也就是估算从没低估过。单笔交易最坏增量是 12,435 字符。
- confirm 时的再检查发生在 flush 之后。从这一刻到 COMMIT 之间是同步执行，没有经营写入，所以经营增长 = 0。唯一变化的是金币数字（扣费后位数只会变少或不变）和 rev（≤ 16 位，已经按上界算了）。
- 所以理论上需要的余量是 0。8 KiB 是额外的保险，用来兜住序列化细节（比如浮点零头 coinFrac 最长约 24 字符、键名差异），比已知的最大偏差高出两个数量级。暂不改成按比例。
- quote 和 confirm 之间的经营增长不靠余量，靠 confirm 时的再检查。

## 实测发现（风险）
- 一次抽卡交易（含 events、receipt、ack）实测约 9 KB。**大约 220 次抽卡就会到 2 MB 上限**（实测 220 笔 ≈ 1,980,968 字符）。到了以后只能经营，不能再抽卡或合成。历史只增不删，所以这是迟早会碰到的产品问题，需要杨总/熊大决定（归档、压缩或调整上限），本候选不处理。
- `reserveFor` 每次要对完整历史做 5 步 × 8 个变体的 `model.reduce`，每一步都会全量回放校验。历史 220 笔时单次大约 1.5 秒；quote 和 confirm 各算一次，会阻塞主线程约 3 秒。性能需要优化（比如只空跑一个最长变体，或者跳过全量 restore），等熊大的耗时测试结果再定。

## 改了哪些文件
- `collection/host-wallet.mjs`：reserveFor（加 existing 模式）、quote 和 confirm 两次检查、透传保存失败码、debited 恢复（commitDebited）、recoverPending 按阶段处理、capacity() 只读探针。
- `collection/host-save.mjs`：只加了只读 getter `maxBytes`。
- `collection/BATCH_DRAW_DESIGN.md`：原子十连设计文档。旧的 batch-draw.mjs 已删除。
- `tests/formal/capacity-guard.test.mjs`：单测。

没动：经济数值、存档 schema、历史交易/事件/回执、iframe 命令白名单、preview/、v10a、版本号。
