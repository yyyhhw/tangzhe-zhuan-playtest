# 家宅-128 候选验收

基线：`aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5`。分支：`xiongda/home128-click-actions`。

## 修改范围 / 并行开发冲突位置

生产代码只修改 `app.js`、`pet/game/app.js` 的 `homeLiveTap` 和 `homeAutoTick`；两入口这两个函数完全一致。

- `homeLiveTap`：增加墙面家具命中；57 白名单优先于坐姿能力（桌子/暖桌执行吃）；调用原候选筛选、站位、移动函数。未匹配家具保持旧行为。
- `homeAutoTick`：只让内存中 `player:true` 的点击动作越过玩家输入后的自主暂停，沿用原到达/停留/图标/灯光/清理流程；玩家到达必说同组原台词。自主动作仍走原概率和冷却。
- 没有修改 `homeAutoStart`、自主决策模块、经济、存档、宠物交易、养成-38 卡片获得/触发、space、发布指纹。
- 熊二若同改 app.js，可按上述两个函数审查/择取，勿整文件覆盖。

## 入口真实差异

- root 有家宅-57 和家宅-22 时段：五类都能用，灯仅黄昏/夜晚。
- pet/game 有家宅-57，但原 `homeAutoPeriod` 固定 `null`、没有家宅-22：四类可用，灯沿用“无时段不选”规则，没有补造时段。
- preview/app.js 和 preview/pet/game/app.js 没有 57 自主动作模块，仍是旧快照；本次未改。
- 仓库未发现 AGENTS.md；已阅读根 README 及入口相关文档，并以实际代码验证快照差异。

## 验证

- `node test_home_click128.js`：20/20 组通过。逐入口逐件覆盖 84 个白名单 ID、到达才显示图标、同组台词、重复点击、结束收尾、不改存档对象；灯时段限制、墙下堵满、原坐/躺/地毯/读书/换装、未匹配家具、移动/停留被中断、自主台词路径。
- 在原始基线运行新回归，首例 `furn_table` 如预期失败，证明测试能检出旧问题。
- `node test_home_actions57.js` 8/8；`node test_home_autonomy.js` 11/11；`node test_home_autonomy_mover.js` 10/10；`node test_home_live_hint.js` 16/16。
- `node --test tests/autosave15/scope.test.mjs`：1/1，经济/存档/交易/生命周期受保护函数指纹通过。
- 两个 app 的 `node --check`、`git diff --check` 通过。
- `node test_root_keys.js`：6 通过、8 失败；独立基线 worktree 的输出完全相同。旧守门仍要求历史存档键/版本/资源缓存号和无 pet 快照，未为此更改发布资产。

## Chromium 390 实际点击

启动静态服务后运行：

```sh
python -m http.server 8732 --bind 127.0.0.1
python tests/home128/browser.py http://127.0.0.1:8732/ _shots/home128
```

用环境已有 `/usr/bin/chromium`，390×844，真实 `locator.click()`（未强制跳过命中检测），仅测试时钟固定为本地夜晚 20:00；77 的 Lv1 小屋每次放一件合法家具。

- root 灯/绿植/冰箱/挂画/桌子 5/5：走到原合法站位，原台词/同款图标实际渲染；灯有光晕。
- pet 四类 4/4；灯确认无时段不动作。
- 每次成功互动后切布置再点家具，未触发生活动作、图标/亮灯撤销；两入口沙发坐/床躺 4/4；猫窝无匹配动作保持旧提示。
- 两入口均 **0 pageerror**。截图和逐动作状态保存在 `evidence/`；`results.json` 记录位置、动作、台词、图标和时钟。

## 剩余复核

未运行 WebKit/iOS 真机，未下载 WebKit；未做全仓测试。候选待非作者复核；未合并 main、未部署。浏览器自动化使用合法测试家具夹具与固定夜晚时钟，未声称线上生产验收。

## 独立 QA 退回后的修正（r2）

原候选 `a507a703a6e88e215bd0bf86ffe91fa6d0501758` 被独立 QA 判 FAIL：玩家动作收尾误写 `autoLast`，并提前生成自主 idle，违反“不改自主行为”。此处更正原候选报告的覆盖不足，原 16+45+pin 通过不能证明这两项语义正确。

本次生产代码仅在两入口 `homeAutoTick` 的共同图标/灯光清理之后加点击分支早退：清空临时动作，不执行自主 `autoLast` 更新、不创建 idle、不抽取 idle 随机数。暂停仍由原 `homeAutoHold` 计时；暂停到期后的首次 tick 才按基线创建 idle。

新增两类回归均直接抽取 `aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5` 与当前 root/pet 的实际函数，以相同输入、固定随机数 0.5 对照：

1. 单绿植房间，先前 `autoLast` 为未定义/本件/别件三种情况，点击完成不覆盖原值；下一次自主选择分别仍是浇水/踱步/浇水，与基线一致。
2. 点击时 clock=10、hold 截止 70：动作完成及 clock=69.999 时均无 idle；clock=70 才创建 idle 到 77.5；77.499 仍闲站，77.5 才执行自主活动。原候选对两类测试分别出现 `target != undefined` 和提前 idle 对象的失败。

测试脚本需要本地 git 历史包含上述基线提交（仅读取，不联网）。可用 `TEST_FILTER='manual completion'` 或 `TEST_FILTER='idle countdown'` 单独复跑。

r2 复跑：新回归 20/20、原家宅 45/45、存档保护指纹 1/1、两个 app 语法和 diff 检查通过。Chromium390 的两入口代表点击、坐躺、布置隔离和无匹配动作也重新通过，0 pageerror；`evidence/` 已刷新为修正版本。本轮没有新增 WebKit/iOS 验证，仍待非作者复核，未合并/部署。
