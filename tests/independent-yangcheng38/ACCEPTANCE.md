# 养成-38 首轮独立验收准备（历史基线记录）

后续确定规则、待候选断言和最新结果见 README.md 与 scenarios.json；下文原先的需求缺口不代表仍缺三卡及八变化主规则。

状态：用例准备及 main 基线；不是候选验收通过。熊二负责实现，本目录不含实现修改。交付预期仅记录用户声明：日本时间 2026-10-15 12:30；不据此判定实现状态。

## 固定对象与隔离

- 2026-10-15T00:19:47Z 远端查询 main=f628b2eb6416e660083e5d4a0f7f422145abaaa8；yangcheng/38-r1 无匹配引用。未检得远端分支不代表未本地开工。
- 原工作区分支 work，HEAD=67007683245e4d315aca101f05773c96c1784cd8；未切换、未改游戏文件。只 fetch main 更新远端跟踪引用。
- main/ 为固定 main 导出并补齐本地 Git 历史的隔离副本（现有 VM 测试需要 git show 历史提交）。脚本与报告全部在仓库外 /workspace/qa-yangcheng38。
- /workspace 与仓库未找到 AGENTS.md；检查 README.md：原生 Node 脚本、node:test/VM 与 Python Playwright；没有 package.json 统一入口。README 中 v13/WebKit 信息不能替代实际当前发布信息。
- 浏览器仅绑定 127.0.0.1 临时端口，每例新临时 context；拦截非本地请求，不用持久用户配置，不读线上站点及用户存档。没有安装浏览器、推送、合并或部署。

## 定位（main/ 下，行号以固定提交为准）

- economy.js：ITEMS 的 k_1..k_8 / CARD_COUNT；REGULAR_ITEMS、gachaRemaining/gachaComplete/gachaOdds/gachaDraw；newState/migrate/checkSave/loadSave/commitSave。
- app.js：renderTab/收藏故事卡、showReveal、storyArt/showCard，state.gacha.owned；persist/atomic 与 COLLECTION.coordinator。
- collection/bootstrap.mjs、collection/host-save.mjs、collectibles/entry.mjs、qa-protocol2：实际存档协调、协议升级、动态目录注册。不能仅看基础 economy 的随机池推断实际生产池。
- home/home-ambience.mjs、home/home-status.mjs：时段/天气与 DOM 适配；home/home-autonomy.js、home-interaction.js、app.js 的 LIVE_LINES/homeLiveHint/renderRoom：活动及家里展示。上述定位不是把任何既有变化认定为养成-125 的八种变化。
- preview/ 对应副本、共享 collectibles；正式运行实际主键 tangzhe-formal-collection-v1-save，preview 有独立键及首次建档同意流程。

## 可复现命令

从任何目录执行；依赖现有 Node、Python Playwright、/usr/bin/chromium；不安装依赖。

```sh
python /workspace/qa-yangcheng38/run-baseline.py
node /workspace/qa-yangcheng38/invariants.cjs
python /workspace/qa-yangcheng38/browser-smoke.py
```

前后两脚本可传 `隔离源码绝对路径 报告输出目录`；invariants 可传 `隔离源码绝对路径`，固定 main/ 为 schema 对照。重新测试请用新报告目录保留原证据。候选正式交付后先核对不可变提交 SHA、交付说明及精确原稿，再在另一个隔离副本运行；不得直接把一个出现的分支视作验收对象。候选仓库须含旧提交历史供已有测试使用。完整 Node 输出保存于 reports/，退出码非零不能算通过。

## 已执行与限制

- 43 个既有测试文件：40 通过、3 失败（reports/existing-tests.json），不是全仓库所有测试。具体用例计数见逐文件日志。
- test_economy.js：538 过、2 失败；旧 ART_V/落地灯缓存断言。
- test_coin_safety.js：516 过、6 失败；旧 commitSave 测试未安装当前安全协调器（当前入口明确返回“安全写入协议未就绪”）。
- test_root_keys.js：6 过、8 失败；旧存档键、资源版本、localStorage 写入名单及宠物快照页断言。
- 新 invariants.cjs：formal/preview 各 256 种合成旧藏卡子集，经 migrate/JSON/load 保留；8 个目录 ID 与新档字段树对照通过。并非真实历史玩家档，也不是生产 commit 测试。
- 新脚本开发时直接调用无协调器 commitSave 被拒；已修正为明确限定的 JSON/load 测试，生产提交由浏览器 smoke 与既有协调器测试覆盖，不绕过写入协议。
- Chromium 首次脚本在 preview 建档/收藏升级同意页超时；是准备脚本缺少首次建档步骤，已修正并重跑。最终浏览器证据见 reports/browser-final/results.json；早期 screenshots 不作为最终结果。
- Chromium 最终 10/10 组合通过：formal/preview × 320/375/390/430/768，生产 atomic 写入合成八卡、刷新保留、收藏页无横向溢出、无 pageerror；截图已保存。这不是条件获得和八种家里变化的验证。临时 HTTP 服务曾在浏览器取消请求时出现 BrokenPipe，不是页面异常。
- WebKit 默认 executable 不存在；只探测已有路径，不下载、不换镜像。Chromium 不能替代 Safari/WebKit 验收。

## 待执行的候选验收矩阵（全部为准备，未宣称通过）

| 编号 | 独立检查及证据 | 状态/依赖 |
|---|---|---|
| C01 | 原稿确定的三张 ID 各在未满足、边界前、边界恰好、超过边界检验；复合条件逐项缺失；记录真实生产入口与获得时机 | 等三卡原稿 |
| C02 | 实际已激活随机池恰好保留其余五卡；三卡随机获得路径不存在；验证每个 RNG 分桶而非只靠抽样；保底/每日限额/费用遵守原规则 | 等 ID 与概率调整约定 |
| C03 | 条件满足的旧档首次载入、游戏内达成、刷新、重复点击、切页、二次达成；领取/自动获得方式、幂等、提示次数逐项比原稿 | 等发放语义 |
| C04 | 所有 256 旧藏卡子集仍保留，已拥有的条件卡不追回；原金币、家具、CEO、宠物、其他收藏及未知前向字段保持；协议1/2、旧主档/备份、损坏主档回退 | 部分合成基础覆盖，候选和实际历史档未测 |
| C05 | 缺配额/写失败/读回失败/锁冲突时卡、金钱、领取状态一致，无重复补发；重开恢复 | 候选待测 |
| S01 | 以 main 同输入同操作规范化后，逐路径比较新增字段（顶层及嵌套），覆盖三条件、八变化、迁移、保存、备份；记录既有动态值白名单，不得仅比较 Object.keys 顶层 | 当前仅新档字段树已测 |
| H01-H08 | 每一种变化单独做触发前/触发后/反向条件/切家/切模式/刷新；逐字文稿、标点、出现位置、优先级/并存、持久化与临时显示行为 | 等养成-125 八条全文与映射 |
| P01 | formal/preview 同夹具同操作语义一致，键隔离；共享目录与预览副本均检查 | 基础卡保留已准备，不代表需求一致性验收 |
| B01 | Chromium/WebKit，320/375/390/430/768 宽，收藏/盲盒/家里/故事弹窗；按钮可点、无截断/横向溢出/遮挡、加载失败退路 | 当前 smoke 仅收藏页溢出与截图；其他页面视觉未测 |
| R01 | 刷新/关页重开/后台返回；条件获得后的真实生产保存；旧卡重看焦点回收、八变化无额外字段 | 基础刷新已准备，候选待测 |

## 待补需求

1. 三张卡准确 ID/名称、条件逻辑与阈值、历史进度认定、自动发放还是手动领取、触发/补发时机、提示全文；未满足的展示和已拥有时重复达成行为。
2. 剩余五卡及盲盒概率/保底/完成度/集齐奖励口径是否保持现状，剔除三卡后的分母口径。
3. 养成-125 八条完整文稿、各自适用 CEO/房级/家具/时间/状态、位置及冲突优先级；不得从现有天气/生活提示猜测。
4. 正式交付 SHA、实现者自测和变更文件说明；“不新增字段”比较范围（默认所有持久化 JSON 层级，允许既有字段值依规则变化）。关键宽度目前预选 320/375/390/430/768，原稿如有指定以原稿为准。

最终候选报告不超过十行；分别报告用例准备、实际通过、既有失败、新失败、未覆盖。以上文档是准备材料，不是候选最终验收结论。
