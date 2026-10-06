# 小狗美术接口（manifest 合同）— 宠物原型 p1

逻辑只认 `art/manifest.json`。真美术到位时：出图集 + 改这份 manifest，**引擎 / 页面代码不用改**。
校验在 `art.js` 的 `validateManifest()`，单元测试 `test_engine.js` 第 2 节会把不合格的 manifest 拦下来。

## 源帧
- 每帧 256×256 透明 PNG，**每帧不裁边**（`source.perFrameCrop: false`）。
- 固定落地原点 `(128,208)`：小狗脚底中心 / 影子中心，所有帧都对齐这个点。
- 影子单独一张（`source.shadow: "separate"`，图集里占一个 cell，见 `shadow.cell`）；跳起来时引擎只抬身体，影子贴地。
- 东 / 北 / 南真画；**西 = 东镜像**（`directions.mirror.W = "E"`）。
- 原地动作只画东向（`inPlace: true, dir: "E"`），引擎会先自然转到侧面（东或西）再播。

## 片段和帧数
| 片段 | 帧数 | 说明 |
|---|---|---|
| idle_E / idle_N / idle_S | 6 / 4 / 4 | 站着，循环 |
| walk_E / walk_N / walk_S | 8 / 8 / 8 | 走，循环 |
| run_E / run_N / run_S | 6 / 6 / 6 | 跑，循环 |
| attention | 4 | 扭头看你（呼唤 / 看到球） |
| sniff | 6 | 低头闻（抓球动作复用前 4 帧） |
| hop | 8 | 原地蹦（高度由引擎算，帧里不要画位移） |
| play | 8 | 趴下扑球 |
| sleep | 6 | 呼吸睡，循环 |
| eat | 6 | 吃饭（放球动作复用前 3 帧） |
| petted | 6 | 被摸眯眼 |
| liedown / getup | 4 / 4 | 趴下 / 起身过渡 |

合计 **108 帧 + 1 张影子 = 109 个 cell**。图集 2048×1024、每格 128（运行时缩一半）= 16×8 = 128 格，剩 19 格备用。
（规格里写的「128 帧」按上表加起来是 108；128 是图集容量。）

## 每帧字段
```json
{ "cell": 0, "ms": 220, "mouth": [196, 150] }
```
- `cell`：图集格号（行优先，`x = cell % 16 * 128`，`y = floor(cell / 16) * 128`），不能重复。
- `ms`：这一帧停多久。
- `mouth`：嘴巴锚点（**源帧 256 坐标**，东向；西向自动镜像）。叼球时球画在这里。

## 动作事件
```json
"actions": {
  "pick_ball": { "clip": "sniff", "frames": [0,1,2,3], "events": [{ "frame": 3, "name": "ball_pick" }] },
  "drop_ball": { "clip": "eat",   "frames": [0,1,2],   "events": [{ "frame": 2, "name": "ball_drop" }] }
}
```
抓球 / 放球由播放器在**进入该帧时**触发事件，不靠计时器；换真图时只要把事件挪到嘴碰到球的那一帧。

## 换真图步骤
1. 按上表出 108 帧 + 影子，缩到 128 拼成 2048×1024 图集（WebP/PNG 均可），放 `art/`。
2. manifest：`placeholder: false`，`atlas.image: "文件名"`，按实际改 `ms` / `mouth` / 事件帧。
3. `node tools/gen_manifest.js` 是占位版生成器，可以照着改成读真图的版本。
4. 跑 `node test_engine.js`（manifest 校验）+ `test_pet_e2e.py`（`?art=atlas` 走图集绘制路径）。
