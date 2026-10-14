# 星途-11 插画交付

基线：f11c8485168c3c63c58c510986c57c405d18d2c9（已 fetch origin/main 核对）。分支：xiongda/xt11-card-art；不合并、不部署。

首批提交：659341dbbbb4ed49ae5f5784ede5cafd504daaa4，已单独推送交付。

首批三张月面插画位于 art/spacecards/moon_1.webp 至 moon_3.webp，对应月面第一串、月球车代驾、地球升起。均为真实生成后编码的 1024×768 WebP，逐张查看原始输出；以 story_k_1–8 实图与 album.mjs 全部 25 张文本为依据，保持四位成年角色外貌与温暖精细日系叙事画风。

最终交付覆盖全部 25 张：moon/station/mars/venus/belt/pirate/europa/saturn 各 3 张，signal 1 张。文件名为 art/spacecards/{route}_{1-based-index}.webp；art-files.json 记录卡名、尺寸、字节数和 SHA-256。generation-sources.json 记录实际生成的本地原始 PNG 来源（原图在工作区 generated_images 保留，不作为运行时依赖）。

overlay 接入返航奖励卡面、已获卡缩略图及详情。资源以 import.meta.url 相对解析；未获卡不创建图片元素，未开放航线不创建卡片。图片加载失败隐藏图片，文本仍可读。未修改 album、存档、奖励、航线开放规则或文案-122。

验证：Node 解析及 diff --check；space113/space114 31 项既有测试通过，新增 xt11 三入口及 GitHub Pages 子目录展示/不泄露/零写档测试 4 项通过（合计 35 项）。browser-check.py 用系统 Chromium 渲染实际 overlay 与样式，使用只读模拟 coordinator，不访问玩家存档；root、pet/game、preview 全部验证（另向模拟视图注入未开放 station 的已获计数，仍不创建其图片）三图加载、未获卡零图、未开放航线隐藏、390px 无横向溢出。手机截图和 browser-results.json 随附。不是完整游戏端到端上线验收。

发布注意：qa-protocol2/dependency-pins.json 现有记录包含 space/overlay.mjs 和 space/styles.mjs；遵守禁止触碰受保护指纹文件的要求，未更新其指纹。熊二上线时需在自己的发布工作中协调指纹及资源缓存版本，不能把本分支的旧 pins 当作已同步。不改其他发布入口或版本文件。

复现命令：

```sh
node --check space/overlay.mjs
node --check space/styles.mjs
node --experimental-vm-modules --test tests/space113/*.test.mjs tests/space114/*.test.mjs tests/xt11/art-ui.test.mjs
python tests/xt11/check-art.py
python tests/xt11/browser-check.py
```
