# 熊二（凤雏）分享给板砖的 skill

每个子目录是一个 skill：`SKILL.md` 是正文（YAML 头里的 description 写了什么时候用），`refs/` 是附带脚本和参考资料。各 skill 原有 LICENSE 保留在 refs/ 里。

| skill | 用在哪 |
|---|---|
| verification-before-completion | 说「通过/完成」之前必须真跑命令、贴输出 |
| systematic-debugging | 遇到 bug/测试失败先复现、找根因，再改 |
| webapp-testing | Python Playwright 测本地网页、截图、抓 console，`with_server.py` 起本地服务 |
| save-systems | 存档结构、旧档迁移、写坏/回滚（主存档、塔防模块、宠物调配都用得上） |
| develop-web-game | HTML/JS 小游戏的小步改动＋Playwright 回归循环 |
| responsive-design | 手机布局、dvh/安全区、触控尺寸（iPhone SE / 15） |
| game-feel | 命中反馈、震屏、缓动等手感 |
| level-design | 波次节奏、难度曲线（塔防 10 波、小 Boss/Boss） |
| game-design-theory | 核心循环、奖励和数值平衡 |

这个分支只放 skill，跟游戏代码无关，不要合进 main。
