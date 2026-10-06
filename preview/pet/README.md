# 宠物原型 p1（preview/pet/）

独立页面：一只暖棕白小狗在房间里自己过日子。和正式游戏完全隔离：
- 只用自己的存档键 `tangzhe-pet-proto`；不读不写 `tangzhe-save` / `tangzhe-preview-save`；不接经济，收益加成 0。
- 家具目录只读 `../economy.js` 的 `FURNITURE`（200 件，占地 w×h 照用），真图用 `../art/furn_*.webp`。

## 文件
- `engine.js` 行为引擎（纯逻辑）：网格 A*（0.25 格分辨率、碰撞半径 0.22 的间隙）+ 精确线段间隙拉直；需求 / 状态机；球的物理；搬家具；存档 / 离线。
- `room.js` 测试房间摆设 + 「站位 / 朝向 / 动作」互动配置（只有配了的家具才有专门互动：自己的窝、碗、3 个猫窝 / 猫吊床）。
- `art.js` 美术 manifest 校验 + 动画播放器；`art/manifest.json` 占位 manifest；`art/MANIFEST.md` 合同说明。
- `puppy.js` 占位小狗（程序绘制，按 manifest 原点和嘴巴锚点画）。
- `main.js` 页面：画布渲染、三个操作、搬家具、存档、测试钩子（`__pet`、`advanceTime`、`render_game_to_text`）。

## 测试
```
node preview/pet/test_engine.js
python3 -m http.server 49761 --bind 127.0.0.1   # 仓库根目录
/workspace/.pwvenv/bin/python preview/pet/test_pet_e2e.py http://127.0.0.1:49761/preview/pet/index.html
```
URL 参数：`?fresh=1` 不读存档；`?seed=N` 固定随机；`?debug=1` 画路径 + 显示精力；`?art=atlas` 把占位帧烘成图集再按 cell 画（自测换真图那条路）。

## 已知限制 / 下一步
- 美术是占位（程序画），等真图集；动作节奏按占位时长调的。
- 家具都按正面图画，房间里只用了不旋转的摆法；旋转后的占地已支持（测试覆盖），但没有侧面图。
- 碰撞半径 0.22 比小狗身体短，贴着家具侧面走时鼻子 / 尾巴会和家具图有一点视觉交叠（排序按落地点）。
- 只有一只狗、不跳上家具、没有饥饿 / 打卡提示（按规格）。
- 没接进正式游戏和房间系统，只是独立原型页。
