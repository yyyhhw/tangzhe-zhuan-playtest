# 旧存档全局卡顿：诊断与最小修复

基线：`3a96a86a1c854bd681c0ff033de1e71ef724640e`，2026-10-13 UTC 实测远端 main 与本地一致。家宅/月面未合入候选不在本次测试中。仓库及父目录未发现 AGENTS.md 或 .agents/skills。执行环境访问 GitHub Pages 被代理 CONNECT 403 拒绝，浏览器同样 ERR_TUNNEL_CONNECTION_FAILED，故没有声称完成线上字节核对。WebKit 下载安装被域名策略 403 阻断。

## 实测环境及方法

Linux Chromium 154.0.8037.57，Playwright 全新非持久化 context，390×844、DPR=3、isMobile/hasTouch，CDP CPU 4 倍降速。本地 HTTP 服务原样 main 的正式入口，无 QA 查询参数。仅新建存档及 tests/wearables8/fixture.mjs 生成的合法 P1 旧档，经真实生产入口明确升级为 P2；没有读取任何玩家存档。没有使用真 iPhone/Safari；CPU 降速不是具体手机的性能等价模型。

先对原代码进行两次约 32 秒 CDP CPU profile、Long Task 与 rAF 间隔采样；随后串行新 context 做 17–22 秒自动保存分段采样和对照。轻量探针仅记录保存链具名函数与 Storage 调用，未包装每次 canvas 绘制。初版重探针额外包装 JSON 原语，其计时增加明显（保存 146–217 ms 对轻探针 105–136 ms），所以不用于最终延迟估计；其 stringify 约 11586 次/保存包含 canonical 对键与原语的序列化，不代表整档 stringify 次数。函数时间为包含子调用的 inclusive 时间，不能相加。PerformanceObserver 末尾异步回调可能尚未送达；保存计时是完整的。

## 结果

| 数据/对照 | 保存次数 | 单次 persist ms | 保存开始间隔 ms | 历史链占保存时间 |
|---|---:|---:|---:|---:|
| 新建 P2，基线 | 4 | 104.5–135.5 | 5033–5048 | 82.5% |
| 合法旧 P1→P2，基线 | 4 | 177.6–192.5 | 5142–5154 | 86.4% |
| 新建档，仅缓存不变历史的探针 | 4 | 14.0–23.3 | 5016–5019 | <1% |
| 旧档，同样缓存探针 | 4 | 18.8–28.4 | 5009–5041 | <1% |
| 合成大旧档，基线 | 3 | 791.2–905.3 | 5735–5888 | 94.1% |
| 合成大旧档，同样缓存探针 | 4 | 37.3–55.7 | 5021–5046 | <1% |
| 新档，临时不绘制 host canvas | 4 | 129.7–201.1 | 5061–5099 | 86.2% |

临时跳过 5 秒自动保存：22 秒窗口没有保存事件、没有 5 秒周期长任务；仍有两个非周期长任务 121/74 ms。旧档缓存后仍出现 52–58 ms 的渲染长任务，未声称所有掉帧被消除。不绘制 host canvas 后周期保存长任务仍存在，不能把此次周期卡顿归为塔防/host canvas 单一原因。

新档主档约 5300 字符、快照 6250 字符、original 228 字符。普通旧档快照 14707 字符、original 5420 字符。大档是刻意增加合法 opaque 历史扩展的压力样本，主档 34645、快照 118438、original 69766 字符；这些不是用户存档大小。旧档嵌套原档/备份的反复解析、规范化、同步 SHA256 随历史体积放大，符合“新游戏不卡、旧档卡”的症状；新档在4倍降速下也可超50ms，并非宣称所有新档都不卡。

## 根因、调用栈与耗时

`app.js frame → 每帧 dt 累加 >5 → persist → E.validState/petBeforePersist/preserveFormalTop → real-page-facade.commit → card-coordinator.commit → getCurrent/validated → validator.validate → snapshotChain → codec.decode/encode + planner.inspect/buildCandidate/verifyPrepared → legacy.parse/validState/checkSave + canonical + 同步 SHA256`。

每次成功保存依次验证旧主档、候选主档和写后读回主档，共 3 次 validate。每次 snapshotChain 中显式 inspect、buildCandidate 内 inspect、verifyPrepared 内 inspect 及其 buildCandidate 内 inspect，共 4 次；所以每次保存重复 12 次历史迁移 inspect。普通旧档轻探针，4 次保存平均 inclusive ms：persist 184.35；commit 181.83；validate 合计 174.55；snapshotChain 合计 159.33；planner.inspect 合计 119.85；legacy.parse 合计 33.25。每次 Storage getItem 13 次、setItem 2 次，读写合计平均约 1.65 ms；磁盘同步写不是本环境主耗时。

rAF dt 被截在 0.1 秒，长阻塞丢失部分累计时间，所以实际墙钟周期会超过5秒，严重样本约5.7–5.9秒。没有发现重复创建的5秒定时器；周期来自同一个全局 frame，与当前换衣、抽盒或经营页面无关。

换衣 `act('equip') → atomic → txn → E.transact → persist`；盲盒 `doGacha → atomic → persist`，结果动画定时800ms后 `showReveal → atomic(last.seen=true) → persist`，一次开盒有两次同步保存。真实 locator.click（合成旧档）测得穿/脱衣 act 266.7/219.1 ms，其中 persist 255.8/216.2 ms，随后 renderTab 50.1/42.2 ms；开盒 act 204.0 ms，其中 persist195.7ms，约1059ms后 seen 保存162.3ms。点击至第二次rAF分别351.8/301.1/283.9ms；该指标不是硬件实际呈现时间或INP。缓存探针对应第二次rAF77.7/71.2/136.2ms；随机抽取物品不同，图像解码不可作完全同图对照。

次要因素：host canvas 在全局 frame 持续绘制（首轮降速 profile 32秒中 render 约2.9秒累计），refreshDynamic 约0.25秒执行部分DOM更新、约0.9秒重建店铺tabs；换衣重建收藏DOM/头像有额外成本。宠物首次注册像素校验 getImageData 在启动阶段有约200ms累计开销；这些不是已证明的5秒周期来源。切到盲盒页首次 renderTab 曾达683ms，需后续单独做图片/布局冷缓存诊断，不能归给存档或承诺本修复消除。

## 修复与保护

仅 validator 业务逻辑新增一个实例内单条缓存，以精确 snapshotRaw/originalRaw 字符串对命中；任一原文变化即丢弃旧条目并完整复核，仅完整历史链成功后缓存。缓存链递归冻结且不作为公开可变对象返回。不同实例、formal/preview、刷新都独立。仍逐次验证当前 raw，保留当前状态/身份/不透明字段校验、外部写检测、锁、备份写入、写后读回及完整验证、uncertain/reconcile。未延长自动保存周期、未删校验、未改交易或存档结构。所有受影响资源版本链与依赖 pins 同步。

原文缓存使用内存换取CPU时间；单条有界但其大小随既有合法历史档增长。首轮会完整校验；极大当前档仍可能有代价。不能将诊断性跳过自动保存/绘制作为生产修复。上线回退应前向恢复旧算法并使用新资源版本，不可回退到不识别已升级存档的更老版本。

验证：`node --experimental-vm-modules --test tests/wearables8/*.test.mjs` 152/152；`node --test tests/formal/tea-entry-cards-out.test.mjs tests/formal/copy52-display.test.mjs tests/formal/carefree-bgm.test.mjs` 10/10。覆盖成功缓存、失败不缓存、单条替换、精确原文变化、返回值污染、当前主档非法、实例/作用域隔离、热缓存外部写和锁释放，以及既有新档/P1/P2迁移、开盒、失败恢复、重读和资源链。首次新增锁测试在 pagehide 微任务释放前误断言，已按实际生命周期等待释放，未修改生产锁语义。

原始探针、CPU profiles、JSON分段结果与日志保存在 `/workspace/scratch/perf/`；生产仓库只包含本最小修复、资源版本更新、回归测试及本报告。

## 最终实际实现复测（不是缓存替身）

同一合成旧档，4次自动保存 20.0–37.9ms（总115.4ms），snapshotChain累计0.1ms；换衣/脱衣/开盒函数24.0/25.4/36.3ms。此次环境仍观测到大量非保存长任务（最高257ms），因此只确认保存热点显著消除，不能宣称全局帧率已完美或所有渲染卡顿已修复。

真实按钮点击至第二次rAF：100.6ms, 91.2ms, 227.2ms；完成开盒后 seen=true，刷新保留完全相同的 gacha.last 和全部穿搭，protocol=2、saveBlocked=false。刷新后人为修改合成快照原文，保存返回false、主档字节不变、错误EVIDENCE_CHANGED_READ_ONLY。
