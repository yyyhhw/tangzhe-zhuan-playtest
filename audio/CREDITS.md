# 用户已选 BGM — Carefree 经营音乐更新
2026-10-11：经营音乐改为 Carefree（CC BY 4.0，须署名）；其余既有曲目与许可保持不变。游戏内入口：顶部「设置」→「关于／鸣谢」，以及「收藏」→「设置」→「查看鸣谢」。

- 根入口经营及其家宅宠物面板（`app.js`，以及 `preview/app.js`）：“Carefree” Kevin MacLeod (incompetech.com)。Licensed under Creative Commons: By Attribution 4.0 License — https://creativecommons.org/licenses/by/4.0/ 。官方曲目 https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037 ，ISRC USUAN1400037。
  - 官方目录 https://incompetech.com/music/royalty-free/pieces.json 将该 ISRC 对应到 `Carefree.mp3`；下载 https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3 ，原样保存为 `carefree-kevin-macleod-8433b770.mp3`。
  - SHA256 `8433b770a630d9b1594fd484442c677907ece899a4d149954cd2e74fd733e311`；6,566,713 字节；256 kbps MP3 / 44.1 kHz / 双声道；解码时长约 205.14 秒。官方原件与选曲附件逐字节一致。
  - 文件未剪裁、未重新压缩或转码；运行时沿用播放器的首尾 100ms 线性交叉淡化与循环处理，属于本游戏播放处理，非原曲作者新增内容。
  - 官方署名说明 https://incompetech.com/music/royalty-free/faq.html 及免费署名许可 https://incompetech.com/music/royalty-free/licenses/ 。
  - Wallpaper 仅保留为备选，不接入本版本。旧 `hot-springs-town.mp3` 留作历史资源，当前经营入口不再引用；其原始出处为 Kistol / https://opengameart.org/content/hot-springs-town （CC0）。
- 打僵尸对局：Zombies' March — yd，CC0（https://creativecommons.org/publicdomain/zero/1.0/）。https://opengameart.org/content/zombies-march 。原件 https://opengameart.org/sites/default/files/ZombiesAreComing.ogg 。原件保留验收包，Chromium解码到44.1kHz 16-bit PCM后系统AAC 160kbps转为 zombies-march.m4a 供兼容播放；不是新曲或重制旋律。
- 塔防对局：Tower Defense Theme — DST。https://opengameart.org/content/tower-defense-theme 。原件 https://opengameart.org/sites/default/files/DST-TowerDefenseTheme_1.mp3 → tower-defense-theme.mp3，字节原样。
- 历史卡牌音乐 The Old Tower Inn：旧路径 `cards/ui/assets/audio/the-old-tower-inn-loop.m4a` 及 `cards/ui/assets/audio/CREDITS.md` 在当前基线已不存在（历史移除提交 `091be78`）。旧测试仍可能引用；不能将其描述为当前可用资源。本次不恢复卡牌、不删除音频，历史许可细节未重新核实。

录音曲目运行时仅在解码PCM首尾做100ms线性交叉淡化，单源循环；不更改文件原件。菜单仍静默，开始对局才播放。与现有模式AudioContext/静音总线共用，旧合成BGM不再启动；游戏短音效保留合成。

## 音效18来源复核（2026-10-18；基线349c0e6）

- Tower Defense Theme：作者 DST，原页许可 CC0（https://creativecommons.org/publicdomain/zero/1.0/）。页面文件显示名是 `DST-TowerDefenseTheme.mp3`，实际下载链接为上文的 `DST-TowerDefenseTheme_1.mp3`；二者是同一页面链接的标签与目标，并非凭相似文件名推定。
  - 原件与本地 `audio/tower-defense-theme.mp3` 均为 7,979,070 字节，SHA256 `07cc9cd797c8ea6738b1bd740526f2610fd2ec0115774294ebda3a5ed8e62a30`，逐字节一致；本地未转码。当前正式塔防由 `td/tdsfx.js` 引用。
- Zombies' March：原页作者 yd、许可 CC0；评论者 bart 的欣赏语不能解释为作者的额外署名要求。上文转码流程是历史制作记录，本次未重新执行或证明 OGG→M4A 的转换链。本地 M4A SHA256 `058f1362d8850550b3170951806dd49692a2a387b1033f9760010b55feae969f`，用于识别现有产物，不宣称与 OGG 字节相同。
- 独立 `pet/game/app.js`、`preview/pet/game/app.js` 未引用 Carefree，仍使用 WebAudio 合成；不要与根入口内打开的家宅宠物面板混同。Carefree 的现有 CC BY 4.0 作者署名、原件、许可链接及处理说明全部保留。
- 源码中音效111/112的短音效实现以 `app.js` 的 `tone()` / `sfx()` 及 WebAudio 振荡器为依据；未发现已跟踪的 Kenney 文件，不新增 Kenney 来源或许可声明。117的任务编号与完整原始需求本次未核实，不据现有合成器反推其全部要求已完成。
- 复现：`node --test tests/audio18/*.test.mjs` 校验本地文件；`node tests/audio18/verify-source.mjs` 从上列官方原件 URL 读取字节并核对本地映射（需要网络）。负控覆盖改一字节、截断、错误本地路径、错误下载 URL。测试不替代许可页面核实。
