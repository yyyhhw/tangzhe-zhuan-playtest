# 养成-38 独立测试包（只含测试）

固定基线 `f628b2eb6416e660083e5d4a0f7f422145abaaa8`。候选 `yangcheng/38-r1` 尚未在远端检得，没有正式交付 SHA，未进行候选验收。所有新规则以 `scenarios.json` 为准；`ACCEPTANCE.md` 保留首轮基线记录，其中“待三卡条件/八变化”已被本次确认规则取代。三卡图鉴提示与获得toast全文已在 `expected-copy.json` 固定；仍缺八动作两句全文、动作冲突优先级、无桌且无坐具/空房兜底、家宅31上线标志的真实入口。

## 复跑

解压后进入 tests/independent-yangcheng38。仅测试补丁也可在仓库用 `git apply yangcheng38-tests.patch`，只创建 tests/independent-yangcheng38 文件，不包含实现代码。

```sh
# 首次生成隔离固定 main；也可以传入现有本地仓库路径避免网络
bash prepare-baseline.sh /path/to/tangzhe-zhuan-playtest
python run-baseline.py "$PWD/main" "$PWD/rerun/existing"
node invariants.cjs "$PWD/main"
python browser-smoke.py "$PWD/main" "$PWD/rerun/browser"
QA_SOURCE="$PWD/main" node --test --test-reporter=tap conditions.test.cjs
node --test --test-reporter=tap pending.test.cjs
```

`run-baseline.py` 和 `conditions.test.cjs` 在本基线退出 1 是记录到的红灯，不要改实现/断言来刷绿。没有一键“全绿”脚本。候选正式交付后将命令中的源码路径换成其固定 SHA 的独立 checkout，且保留 main/ 作为 schema 对照。候选 checkout 要包含历史对象（已有 harness 用 git show），不要仅下载 ZIP。源码可只读；日志保存在单独输出目录。不要把测试包所在的新增文件算作候选实现改动。

## 文件与真实结果

- `run-baseline.py`：43 个既有文件，40 通过、3 失败；`reports/existing-tests.json` 和逐文件日志详述。没有运行全仓所有测试。
- `invariants.cjs`：两版本各256种合成旧卡组合 migrate/JSON/load 保留；新档字段树与固定main对照。不是实际历史玩家档/完整生产写入覆盖。
- `browser-smoke.py`：系统 `/usr/bin/chromium`；正式/preview × 320/375/390/430/768，共10过；本地临时context内生产 atomic 写八卡、刷新保留、收藏页横向溢出、pageerror。两版同意建档/升级仅操作合成临时存档。证据在 `reports/browser-final/`。
- `conditions.test.cjs`：两版本共12断言，6过6失败，日志 `reports/conditions-main.tap`。失败为每版三项：3/5分池、随机分桶排除条件卡、抽尽不含条件卡。是新需求对旧main的预期差异，不是候选失败。基础池测试不能替代生产动态注册目录，后者明确列为待候选。
- `scenarios.json`：40项明确待候选断言，每项含前置、触发、期望和阻塞原因，两版本都要验。
- `pending.test.cjs`：把40项显示为 TODO；0项执行通过，不因进程退出0声称需求通过。不要直接清除TODO，必须先接实际候选事件/DOM/保存路径并产生证据。
- `build-scenarios.py`：已确认规则的可追溯源，重生成JSON；不模拟游戏、不能当参考实现。
- `prepare-baseline.sh`：只在测试目录建隔离checkout，不切原工作分支，不推送。

三卡准确映射：熊猫监工 k_3（sp0收下，禁历史specialCustomers补发）；收摊月亮 k_4（本地19:00–04:59入家）；一条街的灯 k_8（四店开且各>=1员工，入家或雇第四店员工，满足旧档首次入家补）。其余 k_1/k_2/k_5/k_6/k_7 保留盲盒。旧卡保留，不新增任何持久字段。

八变化逐项与边界见 JSON，尤其 k_8 展示只需有卡且黄昏，不要求八卡齐；火箭倒数是页面首次、刷新可重触发、无每日标记；同句10分钟不重复、两句轮换；第1风格版深夜小馆须等家宅31上线。

## 未覆盖与运行边界

候选事件发卡/雇人/双标签领取保护、生产动态池、八种动作及精确文案、全路径存档schema、真实历史档、金牌奖励实际穿戴均未执行；相关基线既有测试不能自动抵充这些新验收。WebKit默认可执行文件不存在，未下载或尝试镜像。截图只证明已截图，未声称完整人工视觉验收。

首次浏览器准备脚本漏处理preview建档/升级同意页发生超时，已修正后10/10通过；早期截图不当最终结果。源码工作区保持干净，没有改游戏实现/线上存档、合并、部署或推送。最终候选验收报告应<=10行，明确未覆盖。

## 本次测试分支交付

分支 `xiongda/yangcheng38-independent-tests` 从当前 main `aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5` 建立，只新增本测试目录。实测基线仍为 `f628b2eb6416e660083e5d4a0f7f422145abaaa8`，没有把最新 main 或未交付候选的结果冒充基线；main 后续更新不构成候选失败。

**40 项 TODO 全部未验证。合成旧档不等于真实历史档。** 不得为了让当前 main 通过而改三卡分池等需求断言。三卡图鉴提示和获得 toast 只是固定预期文本，尚未与候选 DOM 比对；原 40 项的 C3/C4/C8 领取及显示检查同时逐字引用 `expected-copy.json`。八动作的两句台词与重复间隔检查仍等待全文。

本分支不附 reports 日志或截图，README 中 reports 路径描述先前隔离基线证据；运行命令可重新生成报告。先前完整证据包由独立复核者保留。分支不含游戏实现，不合并 main。
