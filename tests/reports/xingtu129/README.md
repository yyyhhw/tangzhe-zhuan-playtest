# 星途-129 候选复核记录（2026-10-15）

基线：`aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5`（含熊二科技公司入口改动）。候选分支：`xiongda/research-display-fix`。仅候选交付，未合 main、未部署、未改 token/pin。

原报告：https://app.slack.com/archives/C0C6SGSM08L/p1792023688321869
金额规则：https://app.slack.com/archives/C0C6SGSM08L/p1791871962505939
已读原帖及认领回复。仓库未找到 AGENTS.md；读取根 README、space/README 及相关测试约定。

## 可拆分提交与行为

1. `0cf526acbfe1792b98bf3f10e596dd5e409952da`：研究台金额/标题。余额向下，单价与总价向上；万/亿/万亿最多一位小数、去尾零、进位换单位。原始价格 `9000090` 显示 `900.1 万`，实际扣款仍为 `9000090`。四岗 CEO 与“的研究台”之间不留空格。
2. 后续独立提交：返航报告明确标“上趟…返航报告已收下”；单列“下次出航：月面基地 · 其他目的地请到星图选择”，次数标“月面基地累计往返次数”。不改变默认按钮的 moon 意图，也不改变奖励、到达判断、次数或回执。此项是用户后续追加授权。

主游戏 `app.js`/`pet/game/app.js` 的 fmtRound 有不同历史精度，未改/未直接复用；研究台使用局部显示格式器，整数步长先做 floor/ceil，避免 `(n / unit) * 10` 的整除浮点偏差。未加 epsilon，以免 `1e12 + 1` 被误当整除。

money 原来还用于地球页；其原表达式隔离为 earthMoney，地球页输出保持原样，有回归用例。输入调用链保证研究台数值来自有限非负金币和 TIER_PRICE；负数、NaN/Infinity 不属于本次支持范围。

## 调用与同步

正式 root 和 pet/game/index.html → 根 collection/bootstrap.mjs；preview/index.html → preview/collection/bootstrap.mjs；两者均进入共享 collectibles/entry.mjs → space/overlay.mjs → space/xingtu-views.mjs。研究价格来自 space/moon.mjs:TIER_PRICE，按钮仍比较原始 coins >= price，回调仍传 sys/tier；host.perform → coordinator 完成实际事务，未改其代码。money 无其他导入调用者。

不需复制三份模块。旧 preview/pet/game/index.html 没有 bootstrap/overlay 接线（app 中虽有防御性 XingTu 音频/离线检查，并非安装入口）。

## 实测（Node v24.19.0）

| 测试组 | main 基线 | 研究台提交 | 含航线最终候选 |
| --- | --- | --- | --- |
| 既有相关组 xingtuv2 + xingtu-entry + copy27 + formal/copy52-display | 58 通过 | 加新增 6 项后 64 通过 | 加航线 9 项后 73 通过 |
| 新研究台回归单独移植基线 | 3 通过 / 3 失败 | 6 通过 | 6 通过（在 73 中） |
| 新航线回归（修复前在研究台提交运行） | 不适用 | 0 通过 / 9 失败 | 9 通过（在 73 中） |
| moon + space01a | 299 通过 / 0 失败 / 2 跳过 | 同基线 | 297 通过 / 2 失败 / 2 跳过 |
| README 五个 Node 脚本（按文件计） | 1 通过 / 4 失败 | 未单跑 | 同基线，失败信息和内部断言统计逐项一致 |

研究台测试包含全部实际档位、总价、万/亿/万亿边界、精确整除及 ±1、1e15 上限、四岗标题、null 余额、差 1 元/恰好可买、等级/已买禁用、回调及输入不变。用 BigInt 解析显示结果校验方向，避免测试本身浮点回乘误差。

航线测试用真实 planMoon 创建已领取存档，真实生产 VM 装配（root、pet、preview）分别验证 station/mars/moon；反复 render/close/open 无写入、state 不变，点击原按钮仍发往 moon，原回执、次数、探索点不变。这是 Node/VM + 合成 DOM/Storage，不是浏览器截图或真机证明。

**最终候选新增的两项失败不能标绿：**
- tests/moon/overlay-dom.test.mjs：changed overlay exact import token and pin reject stale pre-xingtu URL
- tests/moon/resources.test.mjs：complete changed ancestor→bootstrap→entry→app→overlay→intent chain uses one candidate token and real pins

原因均为 overlay.mjs 文案变更后 SHA256 与发布 pin 不同。用户明确禁止此任务更改发布 token/pin，因此原校验和 pin 原封不动；独立复核通过后，发布负责人需在发布阶段更新并重验。不是功能测试通过的替代，也不是当前可发布声明。仅挑第一提交则无此新增 pin 失败。

既有 README 失败：coin safety 516 通过/6 失败；economy 538/2；root key guard 6/8；pet/game 脚本在 st.pet.owned 处 TypeError；pet/test_engine 通过。基线与最终逐项同样。moon 的两个跳过为 formal/preview archived r4 callback 重现用例，原测试自行 skip。

## 复现命令

```sh
node --experimental-vm-modules --test tests/xingtuv2/*.test.mjs tests/xingtu-entry/*.test.mjs tests/copy27/*.test.mjs tests/formal/copy52-display.test.mjs
node --experimental-vm-modules --test tests/moon/*.test.mjs tests/space01a/*.test.mjs
node --test test_root_keys.js test_economy.js test_coin_safety.js pet/test_engine.js pet/game/test_petgame.js
node --test tests/xingtuv2/research-display.test.mjs
node --experimental-vm-modules --test tests/xingtuv2/returned-route-display.test.mjs
git diff --check
```

原始输出保存在本执行环境 `/tmp/research-display-evidence/`，包含 baseline/candidate/final-related、targeted-baseline/targeted、route-before/route-after、safety-baseline/safety-candidate/safety-final、core-baseline/core-final 的 .tap 文件（Node 默认文本 reporter，扩展名仅为文件名）。

未覆盖：Chromium/WebKit 实际布局、真机冻结恢复、线上缓存/部署验证、全仓库测试。没有下载或重试 WebKit，没有访问账号设置。候选尚待独立复核。
