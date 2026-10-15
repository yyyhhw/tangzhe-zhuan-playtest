# r2 最新 main 隔离整合记录

旧共享候选 `xiongda/xingtu02-milestones` 保留在 `02e90e4`，未 force push。
新候选 `xiongda/xingtu02-milestones-r2`：先作 firstZombie 最小修订提交 `97c8837`（720 pass / 0 fail / 8 原有 skip；实际启动握手 28 项），再以无快进合并方式整合最新 main `0b7218d`。不合 main、不部署，不引入 38/131 独立候选。

## 八处冲突逐项处理

| 文件 | 处理与保留内容 |
| --- | --- |
| collection/host-save.mjs | 保留 main 的 copy127 导入版本；加入 milestones 可选校验、新局首店和历史不可修改检查。旧档完整性及原档证据逻辑原样保留。 |
| preview/collection/host-save.mjs | 同上，保持 preview 原有独立键和初始化路径。 |
| qa-protocol2/dependency-pins.json | 以 main 的条目与原 reviewed/source 元数据为基础，补上新模块/recap 条目，按最终文件真实字节重算 bytes/hash；标注待独验，未伪称业务无变化。 |
| qa-protocol2/vendor/cards/card-coordinator.mjs | main 的 copy127 import 链 + 本项提交末端 recordTransition 和独立 confirmed-zombie-start capability；其余完整保护实现经逐字逆增量验证与 0b7218d 完全相等。 |
| qa-protocol2/vendor/runtime/validator.mjs | main 的 copy127 import 链 + 可选 milestones 严格校验；未扩大 mutableFields/opaque 白名单。其余完整文件经逆增量验证与 0b7218d 完全相等。 |
| space/overlay.mjs | 使用 main 的 copy127 全资源链，保留已有 129 航程显示；仅新增 recap 父状态/规则传参、MOON_RULES 导入、summary 焦点支持。 |
| tests/autosave15/scope.test.mjs | 保留 main 的 copy127 归一化口径，再精确剥离本项已声明增量验证原保护哈希；未改 baseline-integrity 清单。 |
| tests/lifecycle-save/lifecycle.test.mjs | 同上，保留原 protection-integrity 清单与所有故障/失锁测试。 |

自动合并后额外检查：新 recap import 及新增保护测试 helper 改为 copy127 token；app.js / preview/app.js 除 zombie started 钩子外与 main 逐字一致，因此 127 宠物名称及其它已有改动没有被旧分支覆盖。资源 import 数量仍准确断言 84，不跳过依赖检查。

## 受保护字段与能力变化

- 持久字段仍只有可选 `milestones`；它在普通调用者提交中仍是不可变 opaque 字段。未新增货币、价格、门槛、战斗进度或称号字段。
- `zbRun.started` 是父页当前局内存标志，不入档。只有原 MessagePort 收到和当前登记 runId/CEO 匹配、未结算、前台且可写的 started，才置位。
- `recordZombieStarted()` 不接收客户端日期/状态；facade 检查该内存事实，正常保存脏业务后再次确认 app/disk 完全一致；owner 私有 capability 限制候选与当前状态完全一致，再内部补首次参与时间。
- 旧 lock、lease、generation、readOnly、backup、original/snapshot evidence、raw/rev、before/intended readback 和 reconcile 均保持；不得用这份实现或作者自测代替非作者验收。
- 时间合法范围内的未来日期允许读取；没有声称拒绝所有未来时间。首次已有时间不被本次口径修订改写。

## 保留 main 的可执行证据

`node tests/milestones/verify-main.mjs` → `main-preservation.json`：协调器/validator/facade 反向剥离精确候选增量后与 0b7218d 完全相等；root/preview app 除 start 观察钩子外完全相等；两个 zombie 子页除接受回执后单条通知外完全相等。

经济、家宅交互、pet/game、preview/pet/game、space/moon、space/host、space/domain 以及三个原保护哈希清单与 0b7218d 逐字一致。故 128 家宅逻辑、129 航程规则/文案以及 127 宠物文案未回退。

整合后重跑扩大 Node 回归、原创业史 17 项 Chromium、僵尸握手 28 项 Chromium；另运行最新 main 自带 browser127.py / browser129.py。确切结果见本目录原始输出和独立 JSON，未测试 WebKit/iOS，未下载浏览器。
