# 熊大隔离桥接候选包：独立复验结论

这是测试侧的复验记录。没发布，没改游戏代码，v1、v1.1、v10a 都没动。
- 包：`card-wallet-bridge-test-v1-review.zip`（Slack F0C86Q0DTV4）
- 环境：Node v24.19.0，干净解包到 `/home/ubuntu/qa/bridge-cand`

## 结论：过 13 / 挂 0 / 跳 1（不是全项通过：v10a 逐字节那一项跳过了，单列在下面）。熊大宣称的各项和实测一致

| # | 项目 | 熊大宣称 | 实测（原始结果） | 判定 |
|---|---|---|---|---|
| 1 | zip 的 SHA256 | `16c4b658…91f48` | `16c4b658caeadfee810ca437a363c39116b6ce8cae6d6ac93619662c47591f48` | 过 |
| 2 | 包内 `SHA256.txt` | — | `sha256sum -c`：0 个不符 | 过 |
| 3 | 原断言（分支上 `tests/wallet-bridge/bridge.test.mjs`）跑包内实现 | 23/23 | 用 `accept_candidate.sh` 一键跑：passed 23, failed 0，rc=0。包里的 `bridge.original.test.mjs` 和分支上那份只差文件末尾一个空行 | 过 |
| 4 | 本地套件 | 32/32 | `node --test test/*.test.mjs`：tests 32, pass 32, fail 0, skipped 0，rc=0 | 过 |
| 5 | 独立复核 | 15/15 | `evidence/independent/review.mjs`：`{"tests":15,"fails":0}`，rc=0 | 过 |
| 6 | 两项负控负控 | 都能检出 | `check-negative-controls.mjs` 分两次跑，结果见下表「负控分列」；两次都 exit 1，都被检出 | 过 |
| 7 | 默认关闭 | 不传 `enabled` 就关闭 | 我自己写的探针：不传 `enabled` 时 commit 返回 `BRIDGE_DISABLED`，存档原文不变；`LIVE_WALLET_BRIDGE_ENABLED = false` | 过 |
| 8 | 只允许 TEST 键 | 正式键和 preview 键都拒绝 | 探针：`tangzhe-save`、`-bak`、`tangzhe-preview-save`、`tangzhe-tab-lock`、`tangzhe-cards`、`tangzhe-save-preview` 这 6 个键，commit 全部返回 `INVALID_TEST_KEY`，存档不变；`qa-wallet-bridge-test` 可以成交 | 过（差异见下文） |
| 9 | apply 不能改金币、revision、账本 | 违规就拒绝 | 探针：apply 改 coins、改 rev、改 coinFrac，都返回 `APPLY_AUTHORITY_VIOLATION`；改 ledger 返回 `INVALID_RECEIPT`；这 4 种存档都不变。只改 owned 和 dust 能成交：扣 5,000,000，零头 0.25 保留 | 过 |
| 10 | 单键原子写 | 一个键写一个字符串 | 探针跑完，存储里始终只有 1 个键 | 过 |
| 11 | 源码不碰浏览器 | 只用注入的 storage 和锁 | `src/` 里没有 `localStorage`、`window.`、`document.`、`fetch(` | 过 |
| 12 | `walletBridgeApproved` | 仍是 false | `evidence/TEST-SUMMARY.json:53` 里是 `false` | 过 |
| 13 | 没动 v1 / v1.1 | 冻结哈希 | 包里记录的冻结哈希：v1 是 `39ab6d46…`，v1.1 是 `faa83859…`，和我之前独立核对的一致；包内文件都在 `card-wallet-bridge-test-v1/` 目录下，没有越界文件 | 过 |

## 负控分列（两次分别是外部 23 条断言的结果）
| 负控 | passed | failed | 挂的编号 | 退出码 |
|---|---|---|---|---|
| disabled-gate-bypass（绕过开关） | 20 | 3 | W6 | 1 |
| dedup-bypass（绕过去重） | 19 | 4 | W1 W3 | 1 |

## 跳过项（单列）
| # | 项 | 情况 | 解阻 |
|---|---|---|---|
| 14 | v10a 逐字节没动 | 这个包是 zip，没推到仓库，包里也没有 v10a 的文件。我只看了熊大的 `evidence/frozen-v10a-check.txt`，没有在正式仓库里逐字节复核 | 拿正式仓库 v10a 的文件，和 `frozen-v10a-check.txt` 里的哈希逐个比对。比对之前，这一项一直记为跳过，不算通过 |

## 和宣称的差异
- **保留键在构造时不拒绝，到 commit 时才拒绝**：用 `tangzhe-save` 这类键调用 `createWalletBridge(...)` 不会抛错，第一次 commit 或 status 才返回 `INVALID_TEST_KEY`。README 里写了「构造时只检查依赖的形状」，所以安全上没有缺口，因为什么都没写进去。熊大回复说这符合 README 的约定：构造时只检查依赖的形状，commit 和 status 在做任何存储或加锁操作之前就拒绝生产键。按这个约定判通过，包不用改。这里只把行为记成两层：构造时不拒绝，调用时拒绝。

## 边界（没有验，也不代表通过）
- 真实父页、浏览器 storage、iframe、刷新和切后台、主档 `E.transact`、G4、G6、G7 都没有接。
- 这次 23/32/15 全部通过，只说明隔离桥接的逻辑是对的。`walletBridgeApproved` 仍然由技术复核来定，不因为这次复验改成 true。
- 卡牌上限和经济配置都不在这个包里（README 写明了：没有稀有度、上限、粉尘、概率这些策略）。
