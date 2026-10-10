# ACCEPT 试玩存档边界门禁

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，不重跑冒烟，也不启用钱包。
依据：熊大划的试玩边界（凤雏回执里有记录）、`test_root_keys.js`、`tests/wallet-bridge/bridge.test.mjs`，以及 `preview/cards/ui/save.mjs` 里现有的键名。
被验的对象是熊大交的试玩接入候选，包括父页桥接、v1.2 和收集页。候选还没交，所以整页 pending。每条都要勾上才放行；有一条没勾上，就不发试玩链接。

现有键名（从仓库里 grep 出来的）：
- 正式档：`tangzhe-save`、`tangzhe-save-bak`、`tangzhe-tab-lock`
- 预览经营档：`tangzhe-preview-save`、`tangzhe-preview-save-bak`
- 独立卡牌页：`tangzhe-card-save`、`tangzhe-preview-card-save`

| # | 门禁条 | 看哪 | 期望 | 失败归谁 | ☐ |
|---|---|---|---|---|---|
| 1 | 入口只有 `/preview/` 经营父页 | 浏览器里点一遍，再 `grep -rn "drawPriceGold\|debit" preview/cards/` | 抽卡、扣金币只能从 `/preview/` 经营父页进去；嵌入页单独打开时，抽卡是禁用的，或者提示「请从经营入口进入」 | 熊大 | ☐ |
| 2 | 键只用 `tangzhe-preview-save` | `bridge.test.mjs`，`WALLET_BRIDGE_IMPL` 指向候选的桥接模块；再看页面 Storage 写入记录 | 金币只读写 `tangzhe-preview-save`（以及它的 `-bak`）；`bridge.test.mjs` 是 `failed 0` | 熊大 | ☐ |
| 3 | 正式根档隔离 | `node test_root_keys.js`；`grep -rn "'tangzhe-save'" preview/` | exit 0；`preview/` 下面不出现正式键（读也不行） | 熊大 | ☐ |
| 4 | 预览金币扣减不等于正式余额扣减 | 页面文案；抽卡前后 `localStorage.getItem('tangzhe-save')` | 只扣预览经营金币；文案里不出现「已扣正式余额」这类说法；正式档前后逐字节一致 | 熊大（代码、文案）；对外说法归熊二 | ☐ |
| 5 | 不静默复制、不改正式档 | Storage 写入记录（`setItem`、`removeItem`、`clear` 只记录、不拦截），对 `tangzhe-save`、`tangzhe-save-bak`、`tangzhe-tab-lock` 三个键 | 零写入；没有「从正式档导入」之类的自动复制；要迁移就必须先提示、再由用户确认 | 熊大 | ☐ |
| 6 | 技术门禁过之前，不发经营入口试玩链接 | thread 记录，以及 `walletBridgeApproved` 当前的值 | `walletBridgeApproved=false` 时，thread 里没有指向经营入口的试玩链接；过了门禁才由熊大发 | 熊二（排工）；链接发早了归发链接的人 | ☐ |
| 7 | 不准用独立卡牌页绕开钱包 | 打开独立卡牌页，检查 `tangzhe-card-save`、`tangzhe-preview-card-save`；`grep -n "coins" preview/cards/ui/save.mjs` | 独立卡牌页不能抽卡扣金币，也不存金币余额；它的存档里没有 `coins` 字段 | 熊大 | ☐ |
| 8 | 钱包启用状态 | 候选代码和配置 | `walletBridgeApproved` 仍是 false；测试桥接没有被当成真实钱包启用；真实扣款要等 G4 | 熊大；发现启用了就立刻报熊二 | ☐ |

- 第 3 条和第 2 条里的 `bridge.test.mjs` 都是 node 一条命令，熊大一交就能跑。
- 第 1、4、5、7 条要用浏览器验，候选交了，我按 `ACCEPT-收集页熊大交件后首跑.md` 一起跑。
- 第 6 条是流程上的检查，不用跑脚本。
- 全部勾上，只说明存档边界守住了，不等于钱包门禁通过。
