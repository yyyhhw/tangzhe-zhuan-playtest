# 128 + 129 统一集成候选（尚未合 main / 部署）

基线为开始集成时远端 main `aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5`。分支 `integration/home128-xingtu129-20261015`；正式及rootpet版本 `formal-xtearth-20261015-r2`，preview版本 `preview-xtearth-20261015-r2`。资源共用 token `xtearth-20261015-r2`。

输入仅含家宅128 `a507a703a6e88e215bd0bf86ffe91fa6d0501758`、`12aa45f467e7a866de8efc7e28bf541316d3f9dd`，星途129 `0cf526acbfe1792b98bf3f10e596dd5e409952da`、`402d8a68a8c8b3300b770a73048891788b28df5d`、`c1000e5b7d065267ecafbecf44b01c5b9054e8d2`、`eca6f11c21e76679d49da8a0b24c717f6fa509ad`，按顺序 cherry-pick，全程无冲突。127、养成38未引入。保留候选原测试与历史报告，其旧版数值不代表本集成结果。

128两入口实际产品改动保持原批准候选字节；129两模块同样保持原批准候选字节；随后只做统一token替换。维护前祖先 `cd62341` 和原提交在本分支历史中均可审计。没有新增游戏逻辑、存档字段、经济/交易/奖励或自主行为改动。

## 完整资源链清单

`resource-chain.json` 枚举全部55个token-only文件、替换次数以及6个派生pin的旧/新hash和字节数，属于完整清单而非示例。

- root / pet/game / preview 的 version.json、index.html 与 app.js；预览只是发布URL同步，128没有移植到preview。
- root及preview collection/bootstrap.mjs、host-save.mjs → collectibles/release.mjs、entry.mjs及相关注册/显示模块 → qa-protocol2入口、facade、guards与vendor依赖。
- space/moon.mjs、overlay.mjs、voyage-ev.mjs、xingtu-views.mjs及其相对import URL统一版本；没有单独换overlay token破坏资源链。
- 相应测试与VM harness只替换当前版本预期/归一化源token，保留全部校验、旧URL负例、历史基线hash。
- dependency-pins.json 仅6个实际因token变化的既有条目更新sha256/bytes：vendor/planner/migration、vendor/codec/snapshot-codec、vendor/runtime/validator、vendor/cards/card-coordinator、space/moon、space/overlay。其他条目与元数据保持不变。没有新增、删除或宽松化pin。
- `verify-maintenance.py` 实测通过：55个文件仅token差异，全部pins按真实字节推导，10份历史保护JSON保持与main逐字相同，4个产品源文件在维护前与两个候选完全相同。

## 集成者实测（不冒充非作者集成复核）

| 检查 | 固定main | 集成候选 |
|---|---|---|
| 21组Node发布/保护/功能测试 | 78文件，835过/0失败/8跳过 | 80文件，850过/0失败/8跳过 |
| 家宅128新回归 | main不存在该脚本 | 20/20通过 |
| 既有家宅57/自主/移动/提示 | 45/45通过 | 45/45通过 |
| 家宅天气 | 5/5通过 | 5/5通过 |
| pet/test_engine.js | 通过 | 通过 |
| root_keys / economy / coin_safety / petgame旧脚本 | 4文件失败 | 同4文件失败，排除源码路径/发布token后输出完全一致 |

21组为 moon、space01a、wearables8、xingtuv2、xingtu-entry、xt11、copy27、copy98、formal、autosave15、lifecycle-save、bb70、cachefix、decor6、blindbox18、box83、gacha-daily5、lockfix、takeover、space113、space114。包含129原两项pin失败及整个资源链，本次全部通过。8个skip未计通过。完整计数见 suite-counts.json；旧失败逐条原文与对照见 known-failures.json：root 6/8，economy 538/2，coin 516/6；petgame为既有st.pet.owned TypeError。没有为消除这些旧失败修改断言或历史预期。

Chromium使用现有 /usr/bin/chromium、390×844、本地临时静态服务和临时context：

- 128作者浏览器脚本重新运行：root五类/pet四类代表点击动作、pet灯沿用无时段不动作；坐/躺、布置隔离、无匹配家具行为通过，两个入口pageerror均0。详见browser128-results.json。
- 129独立QA脚本重跑：root/pet/preview真实科技公司入口×station/mars/moon共9组通过；已领取四页签36状态一致，出航后四页签36状态正确；切页不改space，差1禁用/足额可买，实扣9000090，往返次数/探索点保持，无pageerror或横向溢出。详见browser129-results.json；脚本browser129.py可复跑。

本地原始TAP/日志/截图保留于 `/workspace/integration-128-129-evidence/`；本报告目录只附小型结构化结果与复跑脚本，未复制新截图。输入128候选自带截图保持原样，不冒充本轮截图。

## 复跑

从仓库根运行（需要现有Node/Python Playwright及Chromium；不要下载WebKit）：

```sh
python tests/reports/integration-home128-xingtu129/verify-maintenance.py
node --experimental-vm-modules --test --test-concurrency=4 --test-reporter=tap tests/{moon,space01a,wearables8,xingtuv2,xingtu-entry,xt11,copy27,copy98,formal,autosave15,lifecycle-save,bb70,cachefix,decor6,blindbox18,box83,gacha-daily5,lockfix,takeover,space113,space114}/*.test.mjs
node test_home_click128.js
node test_home_actions57.js
node test_home_autonomy.js
node test_home_autonomy_mover.js
node test_home_live_hint.js
node test_home_window_weather.mjs
python tests/reports/integration-home128-xingtu129/browser129.py /tmp/integration-129-rerun
# 另一个终端启动临时本地服务，再运行128：
python -m http.server 8732 --bind 127.0.0.1
python tests/home128/browser.py http://127.0.0.1:8732/ /tmp/integration-128-rerun
```

旧脚本对照命令：`node test_root_keys.js`、`node test_economy.js`、`node test_coin_safety.js`、`node pet/test_engine.js`、`node pet/game/test_petgame.js`。在固定main独立checkout运行同样命令；相关测试须有git历史供fixtures读取，不能用缺历史的ZIP。失败不得记为通过。

## 尚未完成的发布条件

这里只交付集成候选。需另一人独立复核本维护diff与最终SHA，并核对父协调中的熊二并发回应及129上一pin维护的独立复核；本工作不替代这些确认。不推main、不部署Pages，不使用force push。

未覆盖WebKit/iOS真机、其他宽度、实际线上缓存升级/Pages部署、全仓所有测试、真实玩家历史档。当前功能和资源门禁通过不能被称为已上线。若main随后更新，应复查差异并重新验证必要范围，不能覆盖他人提交。
