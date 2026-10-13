# 真实退出尾段保存候选（独立于盲盒16）

基线：线上 `7ce857d2cccb06a9d4ab2b2531f4d5c1a4041cab`。候选分支 `candidate/lifecycle-save-20261013`，资源标识 `lifecycle-save-candidate-20261013-r1`。未合 main、未部署。保留52件目录、18衣帽、69e5原档证据缓存热修、15秒自动保存；没有混入16装饰或其他玩法。

## 已证实根因与修法

`collectibles/entry.mjs` 最早注册 pagehide；其回调排入撤锁微任务。浏览器原生事件分发在相邻监听器之间执行微任务，故后注册的 app onHide 开始前，facade 已使 saveBlocked=true 且 lease 已失效。三入口真实 reload/close 均复现。普通 JS dispatchEvent 的调用栈不会同样清空，所以原来的模拟事件验证不足。

三个 app 将原有 onHide 函数注册给生产 runtime。生产入口在单个 pagehide 回调内同步调用它，再 finally 撤锁；无 setTimeout、无异步续写、无延长锁生命周期。只有 app 完成挂接、facade 可经营且 lease 仍有效才调用。onHide 内 saveBlocked/frozen/petManual/pending 等原保护及 persist 全路径不变。预先只读或失锁不写；保存失败仍撤锁，不自动重试。其他非生产组合保留原事件注册回退。

实际业务修改只有入口的回调交接与三个 app 的监听注册。其余运行文件只更新缓存版本和派生 pins。`tests/autosave15/scope.test.mjs` 明确仅将新监听注册归一化后比对旧哈希，不修改旧基线哈希；新保护清单逐字验证经济、当前档验证、原证据缓存、迁移、CAS及未知提交处理不变（仅归一化资源版本）。

## 证据

- `baseline.json`：Chromium，三入口×真实 reload/close，升级合成P1后等下一次主档写，再实际等待9秒；6/6尾段未落盘，约220万自然经营收益。没有注入收益、修改时钟或伪造生命周期事件。
- `baseline-offline.json`：正式入口真实 reload/close 后再运行正常启动结算。短离线补偿后仍分别比退出前内存少1,072,410和1,045,499金币；因此未落盘不等于全部净损失，也不能视为全部补回。
- `candidate.json`：同样三入口×两动作；6/6尾段已保存，trace 显示首监听器中持锁、非只读时恰好一次主档写，然后撤锁；重新经营的 coins+pending 不低于退出前内存。
- `profile-reopen.json`：三入口关页后读原文，再关闭浏览器上下文，重新启动同一隔离磁盘 profile；3/3主档原文逐字一致。不是关闭前 storage_state 快照。
- `fault-close.json`：三入口×备份失败/主档读回不确定/已保护，9/9通过；备份失败主档不变，未知读回主档仅一次写入，已保护零写。
- `node-tests.txt`：202项通过，含新生命周期7项以及原档证据、外部改写、排队撤锁、确认失效、当前档非法、未知提交、衣帽、抽奖与15秒节奏回归。
- `formal-tests.txt`：10项正式入口/图鉴/音频回归通过。

浏览器测试只读写隔离合成档，fixture 已随测试提交。关闭后用同上下文新页面读取 localStorage；reload 由 add_init_script 在游戏脚本启动前截取磁盘原文。另有真实新持久上下文重开测试。

## 重现

在候选根目录运行 `python3 -m http.server 8870 --bind 127.0.0.1`，另在基线工作树运行8866服务。

```
EXPECT_SAVED=1 LIFECYCLE_OUT=/tmp/lifecycle-candidate.json python3 tests/lifecycle-save/browser.py
LIFECYCLE_BASE=http://127.0.0.1:8866 LIFECYCLE_OUT=/tmp/lifecycle-baseline.json python3 tests/lifecycle-save/browser.py
python3 tests/lifecycle-save/profile-reopen.py
python3 tests/lifecycle-save/fault-close.py
node --experimental-vm-modules --test tests/lifecycle-save/*.test.mjs tests/wearables8/*.test.mjs tests/blindbox18/*.test.mjs tests/autosave15/*.test.mjs
```

## 未验与边界

第二浏览器引擎未完成：环境无Firefox/WebKit；官方Playwright安装下载被网络返回403 Domain forbidden，未绕过。请独立QA补第二引擎与移动端真实生命周期。系统强杀/崩溃没有 pagehide/visibilitychange 时无法保证最后一段保存，15秒窗口仍存在；本候选不声称解决强杀或大档保存耗时。没有测试或触碰真实用户存档。尚待独立复核后才可合main部署。
