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
- 提交前失败（tmp / bak / 主档写入、主档回读不一致但已回滚）：主档不变，页面暂停，「存档仍是第 R 步」。
- 主档已提交但 tmp 没删掉：算成功，记 `tmpLeftCount`，下次写入覆盖 / 删除。
- 回滚失败：「存档异常：主档状态不确定」；只有当场校验过 bak 才显示「已验证的备份可以恢复」。
- 没有 `navigator.locks`：不写任何键，提示本局不会存档。比代码新的 `dataVersion`：只读，不写、不隔离。
- 主档坏：锁内写 quarantine（失败也继续），bak 有效就恢复并提示；两份都坏要玩家点「新开一局」。

保存失败后：暂停，玩家和 AI 都不能动；「重试保存 / 回到最后成功档 / 下载快照」，重试成功后仍暂停，点继续才接着打。

## 入口与父页边界
- `preview/app.js`：书店（店 2）页底部「卡牌对战」按钮 → 全屏 iframe `cards/ui/index.html?embed=1&v=card-s1`。
- 父页只开关浮层、同步静音；端口消息：父→子 `hello{muted}` / `mute{muted}` / `requestClose`，子→父 `ready` / `close`。父页不读卡牌键、不显示进度、不碰钱包。
- 子页「返回书店」：先等进行中的保存完成；保存失败时弹窗，可「仍要退出」。关闭时 iframe 置 `about:blank`，端口关闭，代数 +1，计时器清掉。

## 缓存
iframe、`app.mjs`、`save.mjs`、`cardcore.mjs` 及其子模块、样式统一 `?v=card-s1`；父页 `app.js?v=15c-rc2-card-s1`。旧 v0.6 页面不读写 localStorage。

## 测试
- `node --test preview/cards/tests/save.test.mjs`（19 条：三类故障注入、quarantine、坏档 / 旧档 / 新档、无锁、CAS、去重、AI 连续性、哨兵键不变）
- `~/.pwvenv/bin/python preview/cards/tests/browser_cards.py [base]`（WebKit 模拟，58 条：4 种视口、刷新恢复、旋转、切后台、保存失败两路、坏档、放弃、两个标签页、入口 / 静音 / 父页隔离 / 重复开关）

## 未验证
真机 Safari（旋转、切后台、杀进程、Web Locks 与配额）、安全区实际避让、真机音频；v0.6 无动画，切后台动画检查待有动画后补。
