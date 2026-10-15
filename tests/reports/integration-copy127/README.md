# 文案127独立集成候选（未发布）

基线：`e48be1a52228fc1ec648e355183b6d27b5c589e9`，准备及最终核查时远端 main 均为此提交。候选分支：`integration/copy127-on-home128-xingtu129-20261015`。仅移植127的 `f1079ea` 和修订 `a1619eb6be13df160dbd6920b829580cd0f556cb`，无冲突；四份 app 各两行可见名称/隔离列表文案修改，未覆盖128/129或引入养成38、地球降价。

源修订功能PASS归属上一轮非作者复核；下列结果属于本次集成者复跑，不替代本集成SHA的独立复核。

## 发布资源维护范围

统一 token `copy127-20261015-r1`；root/pet版本 `formal-copy127-20261015-r1`，preview/previewpet版本 `preview-copy127-20261015-r1`。

`maintenance.json` 完整列出55个原统一资源链文件、额外2个legacy previewpet资源文件、3个额外当前版本预期位置、6个dependency pin及5处当前文件指纹旧/新值。全部测试断言保留，仅当前版本常量同步；历史报告和不在清单内的所有保护基线保持原字节。没有修改游戏逻辑、UID、存档字段、交易或奖励。

原三处已审文案造成的当前文件指纹按实际计算：

1. `tests/autosave15/baseline-integrity.json` 的 preview/pet/game/app.js：原始文件字节 SHA256。
2. `tests/moon/protected-blobs.json` 同 app 条目：同一原始SHA256。
3. `tests/bb70/integration-integrity.json` 的 preview/app.js：把当前 `copy127-20261015-r1` 全部替换为测试要求的 `decor6-preserve-order-20261013-r1` 后，再计算SHA256，绝非原始hash。

额外的必要缓存维护：preview/pet/game/index.html 原 app URL仍为 `home35-td46-home22-copy52-20261012-r1`，只刷新前三处pin不能保证这个第四入口获取127新代码。本候选同步它的app URL、页面B版本及version.json；因此 moon保护清单中该HTML和version.json的两个当前文件指纹也按最终字节同步。此两项超出初始“三处app指纹”统计，明确提交独立审查，不隐瞒扩大范围。其余资源URL保持原样，不让legacy previewpet接入新版collection/星途运行时。

6个dependency派生pin仅因统一token变化更新bytes/sha256；其他条目/元数据保持不变。`verify-maintenance.py` 仅读取Git历史和当前文件，可验证上述精确范围、所有其他保护值/历史报告不变、128两函数与129模块保持原已审逻辑。原始e48和127候选证据均保留在Git历史，未修改旧报告中的基线/结果。

## 实际结果与基线差异

- 同组完整发布/资源链/相关回归：baseline 850过/0失败/8跳过；最终集成850过/0失败/8跳过，共80文件858项。8跳过不计通过。对应21测试组及命令见下方。
- 初轮为848过/2失败/8跳过：缺previewpet version.json派生指纹及resource-chain内该入口当前版本预期；按相同维护规则补齐后重跑全部858项到850过/0失败/8跳过。未删除、放宽或跳过断言。
- 128新回归20/20，既有家宅45/45、天气5/5、pet引擎通过；128行为没有回退。
- 4个既有旧脚本失败：root_keys 6过8失败，economy 538/2，coin_safety 516/6，petgame旧脚本st.pet.owned TypeError。与e48原文排除源码路径及发布token后完全相同，详见known-failures.json，不为消红改断言。
- Chromium390：127四入口×单只/重复记录，共8场景通过；替换按钮可见名称无内部UID，重复狗显示第1只；隔离未知记录显示第1条；data-replace-uid仍保留真实UID，打开/取消界面前后整个pets对象（含未知字段、成长记录）逐字一致，无pageerror。
- Chromium390：128两家宅代表点击、坐躺/布置隔离通过；129三入口×三路线9组通过，四页签已领/再次出航状态、金额差1禁用和原价9000090实际扣款通过。

结构化结果随报告提供。原始TAP、日志、截图在云端 `/workspace/integration-copy127-evidence/`，本分支不追加新截图。浏览器仅loopback临时服务及context，测试夹具不是真实玩家档，未碰线上存档。

## 复跑（仓库根）

```sh
python tests/reports/integration-copy127/verify-maintenance.py
node --experimental-vm-modules --test --test-concurrency=4 --test-reporter=tap tests/{moon,space01a,wearables8,xingtuv2,xingtu-entry,xt11,copy27,copy98,formal,autosave15,lifecycle-save,bb70,cachefix,decor6,blindbox18,box83,gacha-daily5,lockfix,takeover,space113,space114}/*.test.mjs
node test_home_click128.js
node test_home_actions57.js
node test_home_autonomy.js
node test_home_autonomy_mover.js
node test_home_live_hint.js
node test_home_window_weather.mjs
python tests/reports/integration-copy127/browser127.py /tmp/copy127-browser-rerun
python tests/reports/integration-copy127/browser129.py /tmp/copy127-space-rerun
# 独立终端提供loopback静态服务后跑128
python -m http.server 8732 --bind 127.0.0.1
python tests/home128/browser.py http://127.0.0.1:8732/ /tmp/copy127-home-rerun
```

基线对照需独立checkout e48be1a，已有测试依赖git旧提交，不用缺历史ZIP。4个旧失败脚本及pet引擎可用node分别复跑，详见baseline-summary.json。

## 交付状态

只推独立候选，等待非作者对最终SHA（含额外previewpet缓存维护）审查和父的统一发布协调/批准。本任务不推main、不部署、不发Slack。未覆盖WebKit/真机、其他宽度、全仓所有测试、线上缓存升级、真实历史档和实际宠物迁移事务；名称展示与取消是只读场景，不能声称完成购买/迁移全流程验收。
