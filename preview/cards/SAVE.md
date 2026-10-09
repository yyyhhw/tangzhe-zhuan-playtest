# 书店卡牌 preview：入口 / 独立存档 / 退出继续（card-s1）

依据：bookcard-entry-save-plan-v3（熊大复核）。只在 preview，不改正式版，不接奖励、钱包、联网。

## 存档
| 用途 | 名称 |
|---|---|
| 主档（唯一存档位） | localStorage `tangzhe-preview-card-save` |
| 临时写入 | `tangzhe-preview-card-save-tmp` |
| 上一份成功档 | `tangzhe-preview-card-save-bak` |
| 坏档原文 | `tangzhe-preview-card-save-quarantine`（已占用不覆盖） |
| 写锁（Web Lock，不是存储键） | `tangzhe-preview-card-save:write` |
| 正式版预留，preview 不读不写 | `tangzhe-card-save` / `tangzhe-card-save:write` |

信封：`{ns:'tangzhe-card-save', dataVersion:1, slotRev, savedAt, rulesVersion, cardPoolVersion, deckRulesVersion, cardDefinitionSchemaVersion, game:<cardcore.serialize>, meta:{revision,turn,heroes}}`。读档用 `cardcore.deserialize`（checksum + 命令历史重放）。

写入（`ui/save.mjs`，锁内）：主档原文比对（CAS）→ 写 tmp → 回读 + 重放校验 → 旧主档（有效时）写 bak 并回读 → 写主档并回读 → 删 tmp。
- 提交前失败（tmp / bak 写入失败；主档写入或回读异常后，当场证明旧主档原样在位）：页面暂停，「存档仍是第 R 步」。
- 主档写入后回读抛异常或无法证明旧主档在位：一律按回滚失败处理（主档可能已是新档）。
- 主档已提交但 tmp 没删掉：算成功，记 `tmpLeftCount`，下次写入覆盖 / 删除。
- 回滚失败：「存档异常：主档状态不确定」；只有当场校验过 bak 才显示「已验证的备份可以恢复」。不给重试，只给「从备份恢复」：`restoreBackup()` 在同一把写锁里选备份并写回主档：锁内重读 bak 和主档，与回滚失败时观察到的版本比对，任一变了（别的标签页保存过）就报冲突、什么都不写。回滚失败时若主档读不出来，不靠备份比对放行：恢复时主档仍读不出就保持暂停、不写；读得出来就重取快照，主档有效则只提示重新读取（不覆盖），主档或备份是更高 dataVersion 的 future 档则本页转只读、提示版本不兼容、不进入覆盖确认；主档已损坏才让玩家再确认一次，再在锁内比对快照后提交；不会把不确定的主档复制进 bak。
- 没有 `navigator.locks`：不写任何键，提示本局不会存档。比代码新的 `dataVersion`：只读，不写、不隔离。
- 主档坏：锁内写 quarantine（失败也继续），bak 有效就恢复并提示；两份都坏要玩家点「新开一局」。

保存失败后：暂停，玩家和 AI 都不能动；「重试保存 / 回到最后成功档 / 下载快照」，重试成功后仍暂停，点继续才接着打。

## 入口与父页边界
- `preview/app.js`：书店（店 2）页底部「卡牌对战」按钮 → 全屏 iframe `cards/ui/index.html?embed=1&v=card-s1`。
- 父页只开关浮层、同步静音；端口消息：父→子 `hello{muted}` / `mute{muted}` / `requestClose`，子→父 `ready` / `close` / `stay`（退出时保存失败、玩家选恢复留下，父页清掉关闭计时器）。父页不读卡牌键、不显示进度、不碰钱包。
- 子页「返回书店」：先等进行中的保存完成；保存失败时弹窗，可「仍要退出」。关闭时 iframe 置 `about:blank`，端口关闭，代数 +1，计时器清掉。

## 缓存
iframe、`app.mjs`、`save.mjs`、`cardcore.mjs` 及其子模块、样式统一 `?v=card-s1`；父页 `app.js?v=15c-rc2-card-s1`。旧 v0.6 页面不读写 localStorage。

## 测试
- `node --test preview/cards/tests/save.test.mjs`（27 条：三类故障注入、quarantine、坏档 / 旧档 / 新档、无锁、CAS、去重、AI 连续性、哨兵键不变）
- `~/.pwvenv/bin/python preview/cards/tests/browser_cards.py [base]`（WebKit 模拟，77 条：4 种视口、刷新恢复、旋转、切后台、保存失败两路、坏档、放弃、两个标签页、入口 / 静音 / 父页隔离 / 重复开关、回读异常→从备份恢复、退出失败→恢复→继续、书店为当前店时刷新、A 选备份→B 保存→A 提交报冲突、A 写失败且读失败→B 存新档（备份原文不变）→A 恢复不覆盖、恢复时遇到 future 主档只读）

## 未验证
真机 Safari（旋转、切后台、杀进程、Web Locks 与配额）、安全区实际避让、真机音频；v0.6 无动画，切后台动画检查待有动画后补。
