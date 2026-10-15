# 星途-02 r3：失效开局确认重放修复（候选，非放行）

基于精确 r2 `d31d10ff5de3abf7119e2db6789bc49a6cc2f3e2`；其中已包含 main `0b7218da481fab5ee90d2ba4a4aada0d7858076f`。r3 独立分支 `xiongda/xingtu02-milestones-r3`，不改 r2 分支，不合 main，不部署。127/128/129 的源码及行为保留。

## 阻断与修复范围

在独立 detached r2 工作树上，新测试的正式页和 preview 均在 `timeout old confirmation rejected` 断言失败（见两个 `r2-*-negative.txt`）。子页 G 已为空，但原 MessagePort 的匹配 started 仍被接受。这里复现的是受信子页消息故障注入，不是跨源攻击证明。

r3 修改四个运行文件：app.js、preview/app.js、zombie/zombie.js、preview/zombie/zombie.js。

- 父端消息处理绑定当前端口及具体子文档；iframe load 关闭旧端口、废止旧登记、建立新握手。
- 子页提供只读且不可重定义的 live 查询，检查当前 G、待确认/结束状态、runId/CEO、文档活动状态及 4 秒单调时钟期限。
- 父页在原锁/只读/可见性检查后查询该状态，并核对自己的 4 秒期限；拒绝失效确认，不借用子页自报时间。过期确认保守拒绝，须新开局。
- 接受一次后先标记 started，再调用原记录入口；重复确认不会再调用保存。
- 超时/取消/替换局/pagehide 发失效通知；失效通知丢失也会被 live 查询或期限挡住。关闭沿用原清空登记/关闭端口。真实成功参与后的败局/关闭不撤销日期。

本轮 facade、owner、validator、save parser、mutableFields/opaque 白名单、持久化格式、失败保护、backup/readback/reconcile **逐字未改**。没有经济价格、解锁门槛、38/131 变化。依赖 pins 中的对象本轮未变，因此 pins 无需更新。

## 回归证据

- `node-tests.txt`：731 项，723 pass、0 fail、8 原有 skip；原 720 项保留，新增 3 个 live 状态/保护负控测试。
- `milestone-tests.txt`：35/35（原 32 项 + 新 3 项）。
- `lifecycle-results.json`：已安装 Chromium，42/42；formal/preview 各 7 场景 × 3 断言（旧确认不改内存、不伪造磁盘日期、后续真实开局成功且重复确认不再写）。场景为超时、丢失失效通知的超时、取消、导航、关闭重开、pagehide、确认超期。
- `zombie-results.json`：原真实握手 28/28，包括真实败局、私有写入失败、不确定回读、只读协调不重放。
- `browser-results.json`：原创业史实页 17/17。
- `browser127-results.json`、`browser129-results.json`：8/8、9/9，已逐条确认 JSON 为 PASS。
- `audio-standalone.json`：原音频脚本退出 0。
- `main-preservation.json`：18 个保留检查。对 app/zombie 仅逆向剥离逐字匹配的 r3 生命周期增量和 r2 已声明增量，再比对 main；其余原保护及经济/家宅/航程等字节保持。新增负控确保删除 one-shot/live guard 不会被剥离逻辑掩盖。

新增浏览器测试首次运行曾遇到 onboarding 按钮在自动迁移中禁用/移除的测试驱动超时；改为仅点击可用按钮、短等待后继续等待真实 __tzz 完成启动。未跳过用例、未改产品保护或放宽事件断言。最终完整运行结果见 JSON。

旧 README 三个遗留脚本的已有失败仍见上一层 `legacy-baseline.json`，本轮相关文件未改，不宣称这些遗留脚本全绿。WebKit/iOS 未测、未下载。

## 复现

沿用上一层 README 的全量 Node、原 browser.py/zombie-browser.py 和 127/129 命令，新增：

```bash
python tests/milestones/zombie-lifecycle-browser.py http://127.0.0.1:8766/ /tmp/r3-lifecycle
node tests/milestones/verify-main.mjs
# 对 detached d31d10 服务运行同一 lifecycle 脚本；可加第四参数 formal 或 preview，期望复现旧阻断。
```

## 高风险待非作者独验

1. 从原端口重放：超时/取消/G=null，且丢弃失效通知；确认内存及磁盘均无日期。
2. 导航前后、关闭重开、pagehide 后旧端口/旧文档不复活；有效新局仍只记录一次。
3. 真实开始、败局、重复消息、保存失败、未知回读及双标签失锁组合；保留原 before/intended 协调语义。
4. 本轮 4 秒双端期限的边界与浏览器调度延迟；延迟超期不补写日期，重新开局可记录。
5. 127/128/129 保留，资源版本仍由获准集成方在验收后统一更新；候选不能直接视作发布包。

作者自测不等于放行；仍须非作者对精确 r3 SHA 独验。
