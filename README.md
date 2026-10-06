# 躺着也能赚（v13 正式版）

iPhone 竖屏 Safari 漫画风挂机小游戏。**v13 正式版**（由预览 12e2 合入）：商城里能买小狗（3000 金币，只能养一只，住在 CEO 家里）、经营页「打僵尸」入口（全屏小游戏，训练等级 / 结算存在同一份存档里）；金币安全加固（整数金币 + 零头、统一交易入口，存不上整笔回滚）；四家 CEO 的公寓 / 豪宅真底图。存档键仍为 `tangzhe-save` / `tangzhe-save-bak` / `tangzhe-tab-lock`（预览专用键 `tangzhe-preview-*` 不进根目录，`test_root_keys.js` 守门）；v12 老档原样保留（`test_v12_save_e2e.py` 用 350eab7 代码真玩出老档逐项比对；挂在新底图窗户位置的画会挪到最近空墙，件数不变）。预览站在 `/preview/`，使用独立存档键。

v12 → v13 的根目录做法同 350eab7：`preview/` 的 app.js / index.html / economy.js / style.css / art、宠物（`pet/`：引擎、图集、原型页、`pet/game/petgame.js|css`）、打僵尸（`zombie/`）整份拷到根目录；只换存档键、标题、缓存号（13）。宠物 12d3 快照页（`preview/pet/game/index.html`）不进正式站（旧代码不能写正式档）。回退：根目录换回 v12（350eab7）即可，v12 代码读 v13 写过的档不丢金币 / 等级 / 家具，pet / zombie 字段原样留着。

已知视觉限制（仍在修）：面板灯等比缩小后偏细；沙发竖向摆放仍使用正面图。

正式：https://yyyhhw.github.io/tangzhe-zhuan-playtest/

- 四家店：77烧烤摊 / 奶茶店 / 漫画书店 / 摸鱼科技公司
- 每家店 1 位 CEO + 1 位员工；店铺、员工、CEO 三样分开升级；里程碑 Lv10/25/50 → ×2/×4/×8
- CEO：77、珍珠姐、阿宅店长、火箭老板（`ROCKET_NAME` 一处配置）；专长 ×1.5 / 跨行 ×1.2；调任预览 + 交换任职
- **营业小舞台**：每店可见普通客人来往（冒的金币=自动收入可视化，不另加）；大客户改为可见团单（进度条→结账「团单收入 +X」，X=旧 30 秒 ×5 多出来的部分，总收益不变、不双算）；点团单可加速；特殊客户每店 1 个占位（两格漫画+小奖励）
- 布局：店景只在「经营」页；CEO / 盲盒 / 收藏用紧凑页头
- 盲盒 v2：32 普通 + 4 超级装饰，20 万一个，10% 超级 + 15 抽保底
- 离线 50%、最多 8 小时（麻辣服务器 +2）；团单只算在线；每日双倍 MYT 05:00 重置
- 存档 v3；同一时间只能一个标签页玩

开发（仓库根目录起静态服务）：
- Node：`node test_root_keys.js`、`node test_economy.js`、`node test_coin_safety.js`、`node pet/test_engine.js`、`node pet/game/test_petgame.js`
- WebKit/iPhone：`test_coin_e2e.py URL`、`test_playtest.py URL`、`pet/test_pet_e2e.py URL/pet/index.html`、`pet/game/test_petgame_e2e.py URL/`、`zombie/test_zombie_embed.py URL`、`zombie/test_zombie_e2e.py URL/zombie/`、`test_joint_12e.py URL`、`test_v12_save_e2e.py URL [v12 URL]`（v12 URL = `git archive 350eab7` 起的服务）
