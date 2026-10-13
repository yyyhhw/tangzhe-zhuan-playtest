# 盲盒18独立候选复核

基线 `69e5c4183e888ebb77fd84d3cacf667222a29a3c`；分支 `candidate/blindbox18-second-eight`。

- Node：161/161 通过，0 fail/skip。包括旧档证据缓存、存储边界、生产入口、目录、游戏链路、可选 flavor 与新增绘制模块单测。完整输出 `node-tests.txt`。
- Chromium：313 项断言通过；64 组首八跨 CEO/姿态像素一致；32 组脸/下方发型区域一致；192 次新衣帽单件及全组合坐卧不触碰 sprite 边缘。
- 8 张 512×512 透明 PNG 从 runtime 画法生成，图鉴映射全部加载成功。窗口无 pageerror；测试禁止 Storage 写入/删除/清空。
- 衣描边均在 x±28、y[-80,-28] 内；帽局部描边均在 x±23、y[-58,-17] 内；原 PERSON_BOUNDS 与 fitPerson 未改。
- 1000 次重画耗时见 `results.json`，只为本机 isolated Canvas 抽样，不是手机整页性能承诺。新增模块不创建图像/Canvas，不序列化存档；PNG 生成仅在离线复核脚本执行。
- `git diff --exit-code <baseline> -- app.js preview/app.js home-interaction.js economy.js preview/economy.js qa-protocol2/eight-catalog.mjs qa-protocol2/vendor/runtime/validator.mjs qa-protocol2/wearables8 collectibles/entry.mjs qa-protocol2/entry.mjs` 通过，以上实现及首八资产字节不变。旧档卡顿修复保留。

视觉证据：`catalog-512-thumbnails.png`（512源图缩放显示并附12/24/32缩略）、`four-ceo-wardrobe.png`（四CEO逐件挥手）、`home-poses-{390,667}-pair{1..4}.png`、`shop-anchors-{390,667}-pair{1..4}.png`。逐图 SHA-256 在 `artifact-manifest.json`。

人工查看图鉴、衣柜、家宅 pair3 和店铺 pair4：八件独立轮廓可辨；椒粒叠片有实体阶梯下缘，分尾为弯月，玉米夹克六条竖肋，帽不盖脸。12px 缩略只能用于轮廓辨认，不期待看清刻槽/椒粒细节。

限制：只用当前 app.js 和 HomeInteraction 真实函数在合成挂点画板渲染；**没有完整正式/预览页面新增目录抽取、保存、重启验收**。候选 adapter 尚未接入生产；不能据此声称安全上线。统一目录准入、validator 创建顺序、版本缓存链及迁移策略由主作者在盲盒16之后整合。没有合入 main，没有夹带家宅、星途或塔防候选。
