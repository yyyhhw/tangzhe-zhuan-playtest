# 容量保护独立候选（capacity-guard-candidate，基于 d976d067）

熊二代熊大开发。未发版、未合 main，正在熊大深审中。

## 行为
1. **新交易预留（quote 阶段，BEGIN 之前）**：`reserveFor()` 在克隆上把整笔交易空跑一遍：BEGIN→DECIDE→SELECT→RECORD_DEBIT→COMMIT（回执）→request 绑定→ack。抽卡取 4 种稀有度 × 金/非金票据里最长的那种；`walletRevision` 按 MAX_SAFE_INTEGER（16 位）算。然后要求 `最终 JSON 长度 + 8192 字符 ≤ maxBytes`（c 版改为上界算法，见下文），不满足就返回 `CAPACITY_LIMIT_REACHED`：不写收藏、不抽随机数、不扣费。
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

## 单位
maxBytes、余量、预留都按 `JSON.stringify(...).length` 计，单位是 **UTF-16 code unit（字符）**，不是字节，也不是 localStorage 的真实配额。下文的「8192」指 8192 个字符。主档、-bak、原始归档和其他同源键要分别实测，本候选没有做。

## 预留上界（R22 优化后，c 版）
`reserveFor()` 不再对真实存档重播历史，改成：
1. `base` = 当前父档 JSON 长度（只 stringify 一次）。
2. 用 `model.createState({holdings, dust, preferences})` 建一个**可信、无历史**的代理收藏档。BEGIN 和 DECIDE 只跑一次，再枚举抽卡结果：每种稀有度里，按「cardId 长度 + 当前持有数」分等价类，每类取一张代表 × 金/非金两种。同一类的卡结果文本长度完全一样（只是 id 字符不同），所以这是**完整枚举，不是抽样**。
3. 新增文本里每个数字 token 都按「最多 16 位」补足（MAX_SAFE_INTEGER 是 16 位）。这覆盖了真实存档里 revision、collectionRevision、expectedRevision、walletRevision、票据、尘等计数位数比代理大的情况。另外再加：父档 rev、revision、collectionRevision、dust 四个计数各 16 位，结构 slack 64，request/ack 条目的真实长度，**其他待 ack 回执的预留**，以及 8192 余量。
4. confirm（existing 模式）减去真实存档里已有的这笔 tx 和它的 BEGIN 事件长度。上界本来就覆盖了最终 tx 和全部事件，所以减掉也不会低估。
5. 变体会抛错的，是真实交易同样提交不了（会在扣费前失败）的结果，所以不需要为它们留空间。全部变体都失败时，返回 `CAPACITY_ESTIMATE_UNAVAILABLE` 并拒绝。原来的 32K「回退」已经删掉。
- 随机测试 60 组（历史长度、尘、revision 用 0/9/99999/MAX−10，coins，txId 和 requestId 长度，票据都随机），margin 取 0 时**真实长度全部 ≤ 估算值**，最小富余 4436 字符。
- 代价：上界大约是 23.5K 字符，实际单笔是 9–12K 字符，多出来的主要是数字补位。所以到上限会比实际提前大约 11K 字符拒绝。这是有意偏保守。

### 性能（Node，云端，不是手机实测）
| 历史笔数 | 存档字符 | 旧·进程内可信 | 新·进程内可信 | 旧·JSON 重载 | 新·JSON 重载 |
|---|---|---|---|---|---|
| 10 | 100,985 | 73ms | 9ms | 425ms | 9ms |
| 40 | 393,511 | 279ms | 10ms | 5,141ms | 9ms |
| 80 | 783,711 | 503ms | 10ms | 19,797ms | 11ms |
| 220 | 2,150,162 | 1,436ms | 16ms | 未测（预计超过 3 分钟） | 16ms |
熊大的 sample-80.json（JSON 重载）：原来 24,051ms，现在 15–20ms。
- 热点是什么：旧实现每个变体都从未受信的 state.collection 做 BEGIN，`model.reduce` 每一步都会对整段历史跑一遍 `restore`，主要耗时在 canonical 校验，变体越多、历史越长就越慢。新实现完全不碰真实历史，耗时基本只剩一次 stringify。
- **还剩的热点（本候选没处理）**：每个请求 `coordinator.current()` 读档时仍会对整段历史做一次 `model.restore` 校验（80 笔大约 3.3 秒）。这是现有读档路径的成本，不属于 reserveFor。下一步建议在 coordinator 里按 raw 缓存「已校验的可信状态」，需要熊大评审。

## 等 ack 期间的空间保护（R22）
- `host-save.commit` 处理普通经营保存（allowCollectionChange=false）时，如果「新档长度 + 所有已提交但还没 ack 的回执的 ack 长度」超过 maxBytes，返回 `CAPACITY_ACK_RESERVED`，不写档。也就是说，经营保存不能占用 ack 的空间。
- 新交易的预留也包括其他待 ack 回执的空间。
- 代价：存档逼近上限、又有回执没查看时，经营保存会被拒绝，直到玩家查看回执。这是行为变化，请熊大确认能不能接受。
- 已有的临界档（ack 本身就超出物理上限）仍然返回 CAPACITY_READ_ONLY，**不承诺 ack 能成功**。

## 容量提示（UI 文案）
cards/ui/collection.mjs 的 errorText 新增：
- `CAPACITY_LIMIT_REACHED`：收藏存档空间不够完成这次操作：这次没有开始，没有扣金币。已经抽到的结果仍可继续查看。
- `CAPACITY_ESTIMATE_UNAVAILABLE`：暂时无法确认存档空间，这次没有开始，没有扣金币。
- `CAPACITY_ACK_RESERVED`：存档空间已留给待查看的抽卡结果，请先查看结果；这次保存没有写入。
经营页（app.js）收到 CAPACITY_ACK_RESERVED 时，走现有的「保存失败」提示，没有单独文案。

## 2MB 上限，约 220 抽封顶：方案对比（交熊大决定）
现状：单笔抽卡在存档里大约 9K 字符（tx + 5 条事件 + 回执 + ack），maxBytes=2,097,152 字符。大约 220 抽之后只能经营，不能再抽卡或合成。

### 方案 A：归档旧历史（存档里只保留摘要）
- 做法：已提交且已 ack 的交易，把 tx 和事件压成「检查点」：genesis 换成当前 holdings、dust、revision 的快照，旧明细移到单独的只读归档键（或导出），主档只留检查点 + 最近 N 笔。
- 风险：
  - 现在 model.restore 的信任模型是「从 genesis 重播全部 events」。改成检查点，等于改了信任根，必须新增 schema 版本、迁移和回放校验。
  - 「不删除历史」这条红线要重新定义：明细移走还算不算删？要杨总拍板。
  - 迁移出错会直接损坏玩家收藏，必须有原档备份和可回滚的验证。
  - 归档键本身也占 localStorage 配额，不能凭空省出空间。
- 工作量：大。model（检查点 + 回放）、host-save（迁移、双键一致性）、测试（旧档迁移、回滚、篡改），预计 3–5 人日，另外要熊大评审。
- 好处：存档大小基本有上界，同时顺带解决 restore 越来越慢的问题。

### 方案 B1：提高 maxBytes（仍用 localStorage）
- 做法：把 2MB 调大，比如 4MB。
- 风险：主档和 -bak 各存一份，加上原始归档，真实占用大约是 2 倍多。浏览器 localStorage 通常每个源大约 5MB（Safari/iOS 也差不多），调到 4MB 时 commit 会先撞上 QuotaExceeded，走写失败路径。不扣费，但交易会悬挂，体验更差。restore 时间也跟着历史线性增长（80 笔就要 3.3 秒）。
- 工作量：小（改常量 + 测试），但只能推迟问题，而且很可能拿不到 2 倍空间。

### 方案 B2：收藏存档改用 IndexedDB
- 做法：收藏主档和备份搬到 IndexedDB（配额通常是数百 MB 级），经营主档 tangzhe-save 保持不动。
- 风险：
  - IndexedDB 是异步的，现在的 host-save 是「同步写、立刻读回校验」的协议（COMMIT_UNCERTAIN、reconcile 都靠这一点），要整体重写成异步事务，并重新证明不吞扣费、不重复扣费。
  - 跨标签页加锁、iOS Safari 的 IndexedDB 稳定性和被清除的问题都要实测。
  - 旧档迁移要从 localStorage 一次性搬过去。
  - 金币在 localStorage、收藏在 IndexedDB，跨存储的原子性要重新设计。
- 工作量：最大，预计 5–8 人日，加上浏览器实测。
- 好处：空间问题基本消失。但 restore 变慢的问题还在，最终还是需要 A 的检查点。

### 建议（供参考）
短期不动上限，靠本候选的安全拒绝和提示兜底。中期先做 A（检查点），因为它同时解决空间和性能两个问题；B2 等 A 做完后再评估。B1 不建议做。是否允许「把历史明细移出主档」需要杨总决定。

## 改了哪些文件
- `collection/host-wallet.mjs`：reserveFor（加 existing 模式）、quote 和 confirm 两次检查、透传保存失败码、debited 恢复（commitDebited）、recoverPending 按阶段处理、capacity() 只读探针。
- `collection/host-save.mjs`：只读 getter `maxBytes`、`pendingAckChars()`，经营保存不能占用 ack 预留（CAPACITY_ACK_RESERVED）。
- `cards/ui/collection.mjs`：新增 3 条容量错误码的文案。
- `collection/BATCH_DRAW_DESIGN.md`：原子十连设计文档。旧的 batch-draw.mjs 已删除。
- `tests/formal/capacity-guard.test.mjs`：单测。

没动：经济数值、存档 schema、历史交易/事件/回执、iframe 命令白名单、preview/、v10a、版本号。
