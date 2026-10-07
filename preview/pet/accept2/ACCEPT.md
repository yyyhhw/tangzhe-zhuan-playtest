# 每房两只宠物 + 换宠界面 + 猫首样 — 验收清单（板砖，按熊大 11:44 规格）

实现方：熊大。复核：熊二。用例先于实现写好，实现推上来后直接跑：

```
node preview/pet/accept2/test_pets2_core.js                       # 规则 R1–R16（纯逻辑，40 个断言）
python3 -m http.server 49761 --bind 127.0.0.1                     # 仓库根目录
python3 preview/pet/accept2/test_pets2_e2e.py http://127.0.0.1:49761/preview/index.html   # 界面 U1–U10 + 猫 C1–C8，iPhone SE / 15 各一遍
```

接口名、选择器、动作名和存档格式都只在两份脚本顶部的 `ADAPT` 里写一次。实现时改了名字，只改 `ADAPT`，不改用例。
没有实现时脚本输出「缺接口」，退出码 1。

## 规则（test_pets2_core.js）
| 编号 | 验收点 |
|---|---|
| R1 | 没买过宠物的旧档，读档后整份原样，不多出字段 |
| R2 | v13 单只小狗（`state.pet`）读档后还在原来的家，亲密度保留 |
| R3 | 旧档一间房 5 只：2 只留在房里，3 只转待命，一只不删，成长不变 |
| R4 | 坏档里同一只写在两间房：只保留一只、一处 |
| R5 | 坏档里的房间是没加入的 CEO 或不存在的 id：转待命，不删 |
| R6 | 待命 → 空房、再放第二只：成功 |
| R7 | 满房、没选替换对象：拒绝，整份存档不变，返回 `needReplace` 给界面弹选单 |
| R8 | 满房、选了替换对象：新的进房，被换下的回待命，两只成长都不变 |
| R9 | 替换对象不在这间房：拒绝，不变 |
| R10 | A 房搬到 B 房：只在 B 房 |
| R11 | 放回待命 |
| R12 | 调配不花金币 |
| R13 | 写档返回 false、写档抛异常、只读模式：整次调配回滚（宠物位置、金币、rev 都还原） |
| R14 | 没加入的房 / 不存在的宠物 / 不存在的房：全部拒绝，不变 |
| R15 | 随机 400 次调配（约 1/6 写档失败）：每次后都满足每房 ≤ 2、不重复、不丢、成长不变；失败的那次不改档 |
| R16 | 刷新（`E.migrate` + `norm`）后房间、待命不变 |

每条调配之后还会检查三项不变量：每房 ≤ 2，同一只不在两处，总数不变。

用例本身已用一份参考实现跑过：正确实现 40/40。分别注入 4 种错误实现，都会被抓到：超额不处理、超额直接删、满房还能放第三只、写档失败不回滚。

## 界面（test_pets2_e2e.py，SE / iPhone 15 各跑一遍）
| 编号 | 验收点 |
|---|---|
| U1 | 房间管理界面有两个宠物位，都在屏内，高度 ≥ 40px，各显示房里的一只 |
| U2 | 已拥有列表列出全部宠物，每只标明所在房间（CEO 名字）或「待命」 |
| U3 | 满房再放一只：先弹替换选单，只列房里的两只，选单不出屏 |
| U4 | 选单点取消：存档和房间都不变 |
| U5 | 选定替换：新的进房，被换下的回待命；刷新后保持；成长数据不变 |
| U6 | 写档失败（setItem 抛 Quota）：内存、宠物位、存档整次回滚 |
| U7 | 房里两只都画出来；点其中一只，只有这一只有反应 |
| U8 | 旧档一间房 4 只：读档后 2 只在房、2 只待命，列表里 4 只都在 |
| U9 | v13 单只小狗旧档：读档后还在原来的家 |
| U10 | 不新增存档键，没有横向滚动，没有页面报错 |

## 猫首样（同一脚本）
| 编号 | 验收点 |
|---|---|
| C1 | 猫有自己的整套动作和图集，不复用狗的图集 |
| C2 / C3 | 玩具放在左边、右边，都能按顺序播完：待机 → 低身靠近 → 蹲伏蓄力 → 扑抓 → 落地 → 拍打 → 舔爪 → 回待机 |
| C4 / C5 | 左右两边的落地点都在玩具上（≤ 0.45 格），脚底和玩具对得上 |
| C6 | 扑抓中连点 10 下：先播完落地再响应，不会从半空直接切到拱背 |
| C7 | 摸猫：拱背 → 蹭手 |
| C8 | 贴左墙、右墙时，猫的图不被房间边缘裁切 |

## 接口约定（实现方可以改名，改了同步改 ADAPT）
- `PetGame.MAX_PER_ROOM = 2`
- `PetGame.norm(st, E)`：读档整理，负责 v13 单只小狗迁移、超额转待命、去重
- `PetGame.view(st, E)` → `{ rooms: { ceoId: [uid…] }, standby: [uid…], pets: { uid: { species, eng } } }`
- `PetGame.assign(st, E, uid, room|null, { replace, save, blocked })` → `{ ok, why?, needReplace? }`，内部走 `E.transact`（价格 0）
- 建议存档格式：`state.pets = { v:2, list:[{ uid, species, room|null, boughtAt, eng }] }`。只占主存档的一个字段，不新增 localStorage 键
- 页面钩子 `__tzz.pets`：`view()`、`world(uid)`（返回 `{ pet:{ x, y, dir, anim:{ name } }, cols, manifest }`）、`step(uid, 秒)`、`toy(uid, x, y)`、`px(uid)`（屏幕坐标）
- DOM：`#petSlots [data-pet-slot]`（有宠物的位带 `data-uid`）、`#petList [data-pet-uid][data-where]`、`[data-act="petPlace"][data-arg=uid]`、`#petReplace [data-replace-uid]` 和 `[data-act="petReplaceCancel"]`、`#roomFloor .pet-sprite[data-uid]`
- 猫动作名：`idle / stalk / crouch / pounce / land / paw / groom / arch / rub`

## 不在这份里
- 羊驼、机器人、小熊猫、幼年大熊猫的动作：等猫首样通过后，按同样格式各补一组 C 用例。
- 真 iPhone 手感：WebKit 模拟不算真机。
