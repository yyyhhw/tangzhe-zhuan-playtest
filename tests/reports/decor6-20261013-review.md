# 盲盒16六件店铺装饰候选（尚不可发布）

基线：`69e5c4183e888ebb77fd84d3cacf667222a29a3c`。开工与交接前均以 `git ls-remote origin refs/heads/main` 核对。仓库、父目录及 `/workspace/.agents` 未找到 AGENTS.md / skills。未改真实玩家存档。没有合入家宅、塔防、月面或18衣帽候选，没有更改5秒保存节律。

## 已实现

- `collectibles/decor6-catalog.mjs` 明确六件店铺装饰。44件旧目录对象保留，新增4普通、2隐藏；目录50，随机池48（44普通+4超级）。主题只是描述，沿用所有已开店默认摆出与 decorHidden 全店收起。
- root、preview、formal pet 的 Economy 只给 gachaRemaining 增加 hidden 排除条件。既有20万、超级10%、15保底、不重复、故事卡套装、雇科技员工后开放随机抽取的规则不变；隐藏领取不受CEO解锁或抽池门槛限制。
- 原始隐藏证据检查器只新增命名导出。照片依四店 open；护符依已知合法 zombie 记录 cleared>=10。使用既有 deriveGrantId(lineage,reward,1)，不新增历史时间戳、不随机补物。
- 隐藏领取是显式按钮动作，不在升级／启动时发奖。先 flush，独占提交器从已验证 current 构造单次草稿，私有 capability 只允许严格匹配的一件领取转移；普通保存不能改隐藏拥有或账本。两个最多两条的回执分别记录条件事实，不改币、draws、pity、last。已经拥有但尚无回执的支持情况只补回执，不重复插入。
- 迁移身份仍与初始原文完全比较，只对已知隐藏账本增加严格结构校验。未知字段仍完整保留；原文、snapshot、backup、外写检查、独占锁、readback、unknown/reconcile 均保留。69e5 snapshotCache 算法没有变化。
- production entry 在捕获 validator 域前统一注册，P1取消按6件→8衣帽反序撤销注册，继续36件旧版。已有44件P2可直接识别新增目录，不另造原文迁移。
- UI 区分随机池进度与隐藏领取；两隐藏不显示“盲盒里抽”。收藏页六件有实际显示/收起按钮；前4图使用 main 原图，后2只引用提供方指定 PNG 路径，未生成替代图。
- 真实 shop render 调用同一新绘制器，不是隔离画板。初次发现火箭、登记本会被来客遮住，已改真实布局中的位置；最新图片共存尚未验完，不能算视觉通过。
- 资源版本 `decor6-candidate-20261013-r1`；三入口 Economy URL 同步更新，防止旧 gachaRemaining 把隐藏放进池。闭包版本和 dependency pins 同步。

## 已完成测试

`node --experimental-vm-modules --test tests/wearables8/*.test.mjs tests/decor6/*.test.mjs`：169/169。

`node --test tests/formal/tea-entry-cards-out.test.mjs tests/formal/copy52-display.test.mjs tests/formal/carefree-bgm.test.mjs`：10/10。

包括：P1确认／取消、旧44持有不白送、未知嵌套字段和原文不变、隐藏不得抽出、4次正常付费抽新普通、重复领取／刷新、非领取通道伪造隐藏拥有失败、主档写前失败、已写主档但读回unknown后只读核对且不重放、热缓存证据改变拒写。

本地 Chromium 154.0.8037.57，正式 no-query 入口，全新隔离 context；没有线上／真手机／Safari验收。真实DOM按钮在320×844、390×844点击六件各收起再摆出，均60×44 CSS px且在视口内；旧P1升级、两隐藏领取、抽完随机池、50件持有和账本刷新保留，没有pageerror。四店截图使用实际场景、CEO、员工、旧装饰与来客；因缺后两图片，不能认定全部可见或64共存已通过。

可复现：`node tests/decor6/make-fixtures.mjs /tmp/decor6-evidence`，根目录起本地8765 HTTP；`python tests/decor6/browser.py`。可用 DECOR6_BASE_URL / DECOR6_EVIDENCE_DIR 改地址与证据目录。脚本只证明交互与持久化，截图必须人工检查，不等于视觉验收。

## 性能证据与限制

保留基线独立 worktree，与候选比较；Chromium移动视口390、DPR3、CDP CPU4倍，8次 warm persist。仅合成数据；大档约62.5k字符，32件已摆家具、200种仓库家具、500条不透明历史和200条 gacha 扩展记录。新档／小旧档保存中位数基线14.8/14.4ms，候选15.2/16.0ms；首轮有并行Node测试，作为探索数据。

另做无并行测试的大档独立对照：保存中位数候选143.9ms、基线156.0ms（范围134.3–170.6 / 134.2–189.7ms），自动保存间隔约5.1秒。另一轮独立保存中位数151.1 / 150.2ms。缓存修复仍生效，未出现新增随领取次数增长的账本扫描；账本最多2条、图片缓存最多6张。

暖态切页的同步 setTab 中位数（候选/基线，ms）：盲盒59.2/52.0、收藏61.3/52.4、家宅30.5/28.4、店铺41.6/40.0。第二rAF耗时受既有自动保存撞帧影响，不能把它全部算成渲染耗时。冷盲盒仍可超过400ms，大档自动保存仍可产生150–200ms长任务，不能承诺“大档完全不卡”。最终50件大量家具档的保存样本约140–212ms；两张PNG未落地，图片解码和最终全物品场景性能还需补测。

原始数值见 `decor6-20261013-evidence.json`；完整脚本、日志和未完成视觉截图当前在 `/workspace/scratch/decor6-*`。该目录是本执行环境，不假设其他环境可见。

## 实质阻碍与未验项

1. 指定 Library ZIP 已成功解析：libfile_0498a8e767908191b4b93a7ee3cc168b / file_00000000c8948209af1f36219dd295f2 / version0。但当前Library技能的resolved-reference助手，两次（含require_escalated）均返回 `library file transfer failed: download failed`；没有本地可读ZIP、没有验证ZIP哈希，也没有看到后两PNG像素。不是自动审批拒绝。请提供可拉取的仓库候选提交或可用材料传入路线；没有猜URL／执行包内脚本／重画占位图。
2. 待核PNG：d_charcoal_chime.png 25052B，SHA256 dda932ad24f13e65bb194758387490347dc98fb133c96026c7fe220fed990f84；d_spice_turntable.png 39252B，SHA256 b40a0e532d9e39a9f922ef0a23740698a7b1a80d61678d6c4d0afa007fa3c94c。期望落点 `art/collectibles/`。
3. 素材到位后必须补实际像素、四店最终遮挡、全部要求的共存组合、错误图片／缓存状态、最终性能；当前不能宣称64件共存通过。已明确本次是50件目录，不凭空加入其他物品。
4. 尚未独立复核、合main、部署或核线上资源。此提交仅用于继续开发与代码预审。

## 18候选只读设计核对

已fetch并检查 `bc70912c0adbb40a8b0eac1b079dd4752d02d2aa` 的catalog、adapter、生产显示差异。它没有正式准入，只在隔离候选层拼接8件视觉；生产变更只是可选flavor防空。没有cherry-pick。

后续可沿同一入口顺序36→首8衣帽44→16装饰50→18衣帽58，在validator创建前统一准入，取消时反序撤销；目标普通52/超级4/隐藏2，随机池56。已有P2不用再写一套原文迁移，18沿通用衣帽槽位验证。其adapter需更新到本候选资源版本并接受最终host真实场景验收。为不延后16，本批不接18。
