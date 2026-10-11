# 用户已选 BGM — Carefree 经营音乐更新
2026-10-11：经营音乐改为 Carefree（CC BY 4.0，须署名）；其余既有曲目与许可保持不变。游戏内入口：顶部「设置」→「关于／鸣谢」，以及「收藏」→「设置」→「查看鸣谢」。

- 经营及家宅宠物面板：“Carefree” Kevin MacLeod (incompetech.com)。Licensed under Creative Commons: By Attribution 4.0 License — https://creativecommons.org/licenses/by/4.0/ 。官方曲目 https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037 ，ISRC USUAN1400037。
  - 官方目录 https://incompetech.com/music/royalty-free/pieces.json 将该 ISRC 对应到 `Carefree.mp3`；下载 https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3 ，原样保存为 `carefree-kevin-macleod-8433b770.mp3`。
  - SHA256 `8433b770a630d9b1594fd484442c677907ece899a4d149954cd2e74fd733e311`；6,566,713 字节；256 kbps MP3 / 44.1 kHz / 双声道；解码时长约 205.14 秒。官方原件与选曲附件逐字节一致。
  - 文件未剪裁、未重新压缩或转码；运行时沿用播放器的首尾 100ms 线性交叉淡化与循环处理，属于本游戏播放处理，非原曲作者新增内容。
  - 官方署名说明 https://incompetech.com/music/royalty-free/faq.html 及免费署名许可 https://incompetech.com/music/royalty-free/licenses/ 。
  - Wallpaper 仅保留为备选，不接入本版本。旧 `hot-springs-town.mp3` 留作历史资源，当前经营入口不再引用；其原始出处为 Kistol / https://opengameart.org/content/hot-springs-town （CC0）。
- 打僵尸对局：Zombies' March — yd。https://opengameart.org/content/zombies-march 。原件 https://opengameart.org/sites/default/files/ZombiesAreComing.ogg 。原件保留验收包，Chromium解码到44.1kHz 16-bit PCM后系统AAC 160kbps转为 zombies-march.m4a 供兼容播放；不是新曲或重制旋律。
- 塔防对局：Tower Defense Theme — DST。https://opengameart.org/content/tower-defense-theme 。原件 https://opengameart.org/sites/default/files/DST-TowerDefenseTheme_1.mp3 → tower-defense-theme.mp3，字节原样。
- 卡牌 The Old Tower Inn 与 cards/ui/assets/audio/CREDITS.md 完全保持FC7。

录音曲目运行时仅在解码PCM首尾做100ms线性交叉淡化，单源循环；不更改文件原件。菜单仍静默，开始对局才播放。与现有模式AudioContext/静音总线共用，旧合成BGM不再启动；游戏短音效保留合成。
