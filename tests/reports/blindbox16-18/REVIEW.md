# 16+18上层候选：准入与真实入口验证（仍不可发布）

基于16独立分支 `a12ea393b5bb72a9748aee676887b0497187ab44`，它基于正式 `69e5c4183e888ebb77fd84d3cacf667222a29a3c`。本分支可以暂缓，不让16发布依赖18。没有合并 main 或部署。

18来源是已获父任务独立渲染复核的 `bc70912c0adbb40a8b0eac1b079dd4752d02d2aa`。8张PNG逐一验证与来源Git blob完全相同，没有重绘／重编码；render几何不改。adapter仅更新资源闭包与说明。首8衣帽可选flavor防空沿作者修复。

## 准入与保护

同一production composition在validator创建前按36→首8衣帽44→装饰50→18衣帽58注册。P1取消按相反次序撤销，回到36；44件或50件P2直接使用同一身份与原文链，不再建立迁移。总目录58、普通52、超级4、隐藏2；随机池56。单价20万、超级10%、15保底、不重复未变。衣帽验证集合由完整准入后的E.ITEMS捕获，所有旧持有／穿戴和隐藏回执保护继承16。

`collectibles/wearables18-catalog.mjs` 仅扩已明确普通衣帽；`collectibles/entry.mjs` 选择新adapter，其余业务／保存逻辑仍是16。发布资源版本为 `blindbox16-18-candidate-20261013-r1`，三入口Economy、production entry、共享模块闭包和pins同版本。未修改保存节律／snapshotCache算法／其他家宅或塔防候选。

## 自动验证

- `node --experimental-vm-modules --test tests/wearables8/*.test.mjs tests/decor6/*.test.mjs tests/blindbox18/*.test.mjs`：182/182。
- 三项关联formal测试：10/10。
- 新准入测试覆盖58/56/52边界、原50件八次付费抽完、不重抽隐藏、每件衣帽槽位、反序回到36；正式／预览实际生产保存协调器跑完20件新普通、逐件穿戴、重启和不透明字段／原文不变。
- 生产display加载失败／页面隐藏期间promise晚到的负测试已改为实际新adapter目标，没有跳过生命期保护测试。

## 真实页面证据

Chromium154，本地HTTP、390×844、DPR2、全新隔离context，正式和preview各自合法合成P1→P2入口；不使用QA隔离画板作为验收。

正式与preview各32次真正衣橱按钮点击（4套×4CEO×衣帽2槽），共64次；全部8新衣帽先走现有 Economy.gachaDraw→atomic→persist 获取。普通抽完56件后两隐藏按钮领取成为58件。八张原PNG通过实际已持有图鉴icon加载为512×512。刷新后的gacha、wear、隐藏账本完全保留；pageerror为空、saveBlocked=false。

正式页还真实点击沙发／床并等待角色到达，4套×坐卧2种=8个实际姿态；人工查看了实际衣橱、店铺、坐姿与卧姿截图，未发现18造型遮脸或服装裁切。预览的基线房间没有坐卧绘制器，本批没有移植家宅实现；预览的穿戴、店铺与存档检查已做，但不声称preview坐卧通过。

早期刷新断言遇到最后一抽尚未seen，刷新自动弹出结果后合法更新seen；测试已改为通过真正“收下”按钮确认结果后再比较，没有修改产品逻辑或弱化拥有／穿搭断言。

`production-browser.json` 包含实际输出。`formal-wardrobe.png`、`formal-shop.png`、`preview-shop.png`、`formal-sit.png`、`formal-lie.png` 为合成档真实页面截图；16后两张PNG缺失，不能把这些截图作为完整装饰共存验收。

复现：`node tests/blindbox18/make-production-fixtures.mjs`，repo根目录开8765 HTTP；`python tests/blindbox18/production-browser.py`。可用 BLINDBOX_BASE_URL / BLINDBOX_EVIDENCE_DIR 设地址与文件夹。脚本不运行作者生成图片的browser_evidence.py，不会重写原PNG。

## 性能与未验项

58件＋32件已摆家具（不含大型不透明历史）的4倍CPU warm保存，正式18.5–25.1ms，preview17.5–25.3ms，每个8次、均成功。16基础的62.5k大历史对照和保护热点见上一层报告；大档仍有150–200ms级成本，不能保证任何大小都不卡。另做58件＋200种仓库家具＋32件已摆家具＋62.5k历史扩展的320/390真实页测试，六件显示/收起仍为60×44px且可点击，刷新保留58件；4倍CPU保存151.2–190.2ms（16次），无pageerror或saveBlocked，见large58-browser.json。全部图片落地后的最终合并场景性能尚须补测。

实质阻碍仍是16两个原PNG：Library解析成功，但当前执行环境按技能助手下载，经安全脱敏网络诊断确认 `URLError / OSError: Tunnel connection failed: 403 Forbidden`。不是自动审批拒绝，尚未获得本地可读原图，未看过其像素，未验证指定PNG SHA。需要可拉取的素材仓库提交或可访问的授权材料路线。

两图到位后必须补像素、四店最终遮挡／要求的共存组合、最终缓存与性能、线上资源；目前只到代码候选与部分验收，不是发布批准。最终 main 合并仍待父任务独立复核。
