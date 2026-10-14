# 星途-11 插画交付

基线：f11c8485168c3c63c58c510986c57c405d18d2c9（已 fetch origin/main 核对）。分支：xiongda/xt11-card-art；不合并、不部署。

首批三张月面插画位于 art/spacecards/moon_1.webp 至 moon_3.webp，对应月面第一串、月球车代驾、地球升起。均为真实生成后编码的 1024×768 WebP，逐张查看原始输出；以 story_k_1–8 实图与 album.mjs 全部 25 张文本为依据，保持四位成年角色外貌与温暖精细日系叙事画风。

overlay 接入返航奖励卡面、已获卡缩略图及详情。资源以 import.meta.url 相对解析；未获卡不创建图片元素，未开放航线不创建卡片。图片加载失败隐藏图片，文本仍可读。未修改 album、存档、奖励、航线开放规则或文案-122。

验证：Node 解析及 diff --check；space113/space114 31 项既有测试通过，新增 xt11 三入口展示/不泄露/零写档测试 3 项通过。browser-check.py 用系统 Chromium 渲染实际 overlay 与样式，使用只读模拟 coordinator，不访问玩家存档；root、pet/game、preview 全部验证三图加载、未获卡零图、未开放航线隐藏、390px 无横向溢出。手机截图和 browser-results.json 随附。不是完整游戏端到端上线验收。

发布注意：qa-protocol2/dependency-pins.json 现有记录包含 space/overlay.mjs 和 space/styles.mjs；遵守禁止触碰受保护指纹文件的要求，未更新其指纹。熊二上线时需在自己的发布工作中协调指纹及资源缓存版本，不能把本分支的旧 pins 当作已同步。不改其他发布入口或版本文件。
