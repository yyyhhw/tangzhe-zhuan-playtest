# 用户已选 BGM — FC8 候选
2026-10-11 独立打开下列作品页，均标 CC0；核对 CC0 1.0 https://creativecommons.org/publicdomain/zero/1.0/ 。不购买、不切账号。署名自愿保留。

- 经营及家宅宠物面板：Hot Springs Town — Kistol。https://opengameart.org/content/hot-springs-town 。原件 https://opengameart.org/sites/default/files/hot_spring_town.mp3 → hot-springs-town.mp3，字节原样。
- 打僵尸对局：Zombies' March — yd。https://opengameart.org/content/zombies-march 。原件 https://opengameart.org/sites/default/files/ZombiesAreComing.ogg 。原件保留验收包，Chromium解码到44.1kHz 16-bit PCM后系统AAC 160kbps转为 zombies-march.m4a 供兼容播放；不是新曲或重制旋律。
- 塔防对局：Tower Defense Theme — DST。https://opengameart.org/content/tower-defense-theme 。原件 https://opengameart.org/sites/default/files/DST-TowerDefenseTheme_1.mp3 → tower-defense-theme.mp3，字节原样。
- 卡牌 The Old Tower Inn 与 cards/ui/assets/audio/CREDITS.md 完全保持FC7。

新三曲运行时仅在解码PCM首尾做100ms线性交叉淡化，单源循环；不更改文件原件。菜单仍静默，开始对局才播放。与现有模式AudioContext/静音总线共用，旧合成BGM不再启动；游戏短音效保留合成。
