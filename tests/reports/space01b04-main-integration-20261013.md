# 星途01b/04 r5 → 最新 main 独立整合候选

仅候选分支 `codex/space01b04-r5-on-main-66abd4c-20261013-r1`；不合 main、不部署、不改变原 r5。

- 实际第一父基线：`66abd4c8388730a71fda4881a367f6856e719f76`。
- 原 r5（第二父）：`c98cd717c2615971feced1caca48583fe9635f86`。
- 共同祖先：`3a96a86a1c854bd681c0ff033de1e71ef724640e`。
- 开始及收尾 fetch/远端 heads 检查：main 仍为上述基线，无新星途01b/04整合候选。旧演示与03发射台分支不是本次整合。
- checkout、r5 tree 与父目录未发现 AGENTS.md 或 .agents/skills/SKILL.md；参考 README 测试说明、原 r5 报告、MOON-ROUNDTRIP 合同。

## 冲突处理与保留

30个文件产生文本冲突，多为发布 token。三方增量合并，不用旧 app/economy/存档模块整文件覆盖 main。

实质组合：collectibles entry 保留 main 同步 registerPageHide→onHide 保存→revoke，叠加 r5 request 外层 finally 与回调 finally 共用幂等 cleanup；失锁先撤 owns，终止 facade/overlay/listener，无续锁、重放或磁盘回滚。coordinator 同时保留 main 隐藏奖励 capability/ledger 与 r5 space/moon 独立 capability，main snapshot 缓存、gachaDaily、58件目录与 formal 自动升级保留。reconcile 成功才恢复星途视图。

app 的新增只涉及星途入口、上下文/音频接口与小游戏互斥，近期盲盒、自动保存15秒、家宅全CEO/全等级时段和房牌、文案、reduced-motion 保留。所有 economy、家宅逻辑/样式、previewpet、cards 与 preview/cards 文件字节保持 main；存档中的旧卡牌兼容字段/只读保护仍保留，没有解冻卡牌玩法。qa-protocol2/vendor/cards/card-coordinator.mjs 是现有共享存档协调器，改动为星途事务而非卡牌增量。

## 版本与资源闭包

统一候选 token `space01b04-r5-main-20261013-r1`；root/preview/rootpet version.json、HTML B、bootstrap、production entry、app 与 overlay/父事务模块闭包一致。保留无变化 legacy 资源 token 与对应精确 pin。dependency-pins 取 main 元数据并加入 r5 新 space 模块、重算真实 bytes/SHA256。测试遍历63条模块 literal imports，并实跑无QA参数动态入口/项目子路径。已有缓存负控保留并调整为拒绝旧 main/r5 URL。

旧断言中44件、正式手动确认、5秒保存与旧token已按 main 合同调整；preview 取消/确认路径仍实测。整合造成的12处保护指纹变动保留 preSpaceIntegrationSha256，并记录具体来源；不可变经济/保存函数/家宅/卡牌原指纹不放松。历史 r5/r4 reports、comparisons 与 archived r4 entry 保持历史材料，当前锁负控改为仅移除当前 entry 的 outer cleanup，以隔离缺陷而不混入过时目录链。

## 本轮实际验证

Node v24.19.0。完整命令：`node --experimental-vm-modules --test tests/*/*.test.mjs`。

- 基线 main：439项，433通过、0失败、6跳过。
- 整合候选：712项，706通过、0失败、6跳过（既有 formal 旧手动同意路径跳过，无新增跳过）。
- 其中 moon/space01a/wearables8 顺序模型回归：443项，437通过、0失败、6跳过；新增两项 main 交叉能力用例在最终712项中覆盖隐藏装饰领取→月球在途→另一隐藏奖励→月面领取→普通保存→同步pagehide→拒绝旧写者。
- 22个旧独立命令逐项与 main 比较：12成功、10失败，两版 exit code 全部一致，见 standalone-comparison.json。test_root_keys.js 两版均6通过/8旧失败，仅版本字符串不同；不宣称全仓所有历史测试全绿。
- 家宅额外命令：test_home_autonomy.js 11/11、test_home_actions57.js 8/8、test_home_window_weather.mjs 5/5、test_home_live_hint.js 16/16。
- git diff --check 与改动 JS/MJS 语法检查通过；冻结目录/经济/家宅字节保留检查见 preservation.json。

本轮真实 Chromium 154.0.8037.57（Linux headless），本地127.0.0.1:8877、独立合成数据：
- root、preview、rootpet 三入口：Lv49拒绝、Lv50测试门槛允许、出发→关闭→刷新在途ID不变→6秒后实际控件领取8点→重开不重复奖励；真实第二页面 Web Locks steal 后普通保存/星途意图拒绝，Storage字节不变，旧overlay关闭，3/3通过，无页面JS错误。
- freshly generated P2 offline/pending × 三入口，共6/6通过；使用真实浏览器 Date，先确认 pending 阻挡月面，通过实际 #claim 领取，再完成月面领取；原 original/snapshot 字节始终不变。报告余额是含正常经营收入的下界验证，不是精确暂停经济或双引擎验收。
- 浏览器脚本：tests/moon/browser-roundtrip-steal.py、browser-offline-pending.py；JSON与日志在同名报告目录。

WebKit启动实际失败：`Executable doesn't exist at /home/agent/.cache/ms-playwright/webkit-2336/pw_run.sh`。没有安装、绕过或把旧双引擎报告算入本轮。真实 BFCache 进入/恢复、像素视觉、真机iPhone/Safari、生产线上、全部原生存储故障点未验证；Node故障模型不等同原生磁盘故障或BFCache证据。

## 正式发布仍缺决策

候选仍为科技单店Lv50、6秒/8点测试配置；转述“四店Lv35”尚未核实，未实施。`space/PRODUCTION-PARAMETERS-PENDING.md`记录最小四店35修改/边界测试与建议10分钟/8点（理论6次/小时、48点/小时）。建议没有批准效力；尚无探索点消耗经济，不能宣称平衡已验。

须核准正式解锁门槛、航程/奖励、旧测试ruleset与在途/收据兼容处置、探索点用途与发布范围；补齐所需浏览器/真机验收后，另行授权合并与部署。本次只交付可审查候选。
