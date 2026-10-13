# 盲盒18 第二批八件 · 渲染候选

基线：`69e5c4183e888ebb77fd84d3cacf667222a29a3c`。只在候选分支交付，未接入正式入口或抽奖池，未改迁移、validator、事务、家宅/星途/塔防实现。

## 可复核交付

- `render.mjs`：四衣四帽的独立纯 Canvas 几何；无 DOM、位图、存档、计时器、随机数、每帧序列化。
- `catalog.mjs`：用户提供的八件 ID/name/hint/desc；全部烧烤普通衣帽，无隐藏资格、无店主限制，无虚构 flavor。
- `art/*.png`：由同一 `drawCatalog` 生成的 512×512 透明图鉴。
- `display.mjs`：显式候选适配器，保留首批八件行为，新增注册类型及所有权检查、穿戴、图鉴与文案映射。**导入不会注册物品或写入存档。**
- `review.html` / `review.mjs`：内存合成拥有状态；提取并执行当前 `app.js` 的原人物函数，调用原 `HomeInteraction.drawPose`；不启动游戏，不读取/改写用户档。用本地 HTTP 服务打开。
- 正式文件唯一修改：`qa-protocol2/wearables8-display.mjs` 缺失/空 flavor 时连 `<br>` 一起省略，已有短句输出保持一致。

Canvas 挂点不变：脚 y=0；衣在手臂、头之前；帽在头之后；人物框 `[-56,-153,56,2]`。新衣描边限制在 `[-28,-80,28,-28]`，帽局部限制在 `[-23,-58,23,-17]`。四位 CEO 保留脸、发、眼镜、肤色、手臂及裤鞋；原 drawHead 在戴帽时隐藏蝴蝶结/发夹的逻辑保持原样。

## 独立复核

在仓库根目录运行：

```sh
node --experimental-vm-modules --test tests/wearables8/*.test.mjs tests/blindbox18/*.test.mjs
python -m http.server 8765 --bind 127.0.0.1
# 另一个终端：需要 Python Playwright 与 /usr/bin/chromium
python tests/blindbox18/browser_evidence.py
```

浏览 `http://127.0.0.1:8765/candidates/blindbox18/review.html`。脚本会从实际画法重新生成八张 PNG 和 `tests/reports/blindbox18/` 的视觉证据/JSON；证据浏览器全新上下文且 Storage 写/删/清空均抛错。

## 后续主线整合限制

1. `eight-catalog.mjs` 是精确 36→44 安装器，不能直接重复使用或只增加显示 IDS。主作者需统一盲盒16/18目录注册与关闭/恢复策略。
2. `createProtocol2Validator` 构建时捕获 `E.ITEMS`/衣帽集合；新增目录必须在正确生命周期纳入统一准入。候选不绕过此校验。
3. 待目录准入完成后，主线才可显式选择候选 adapter、统一资源版本/缓存链，验证抽奖、拥有/末次奖品/穿戴的持久化及重启，复核正式/预览两个域与旧档。
4. 本证据是实际绘制函数的**隔离挂点画板**：有四位 CEO 衣柜、店铺人物工作姿态、家宅坐卧及 390/667 宽度截图；不是完整正式店铺/家宅页面验收。未宣称已安全上线。
5. 没有新增逐帧图像创建、图鉴导出或序列化。浏览器记录的 1000 次人物重画仅为本机抽样，不能等同低端手机整页性能保证。

来源：委派消息提供的 Slack `F0C8MAQCF8S` 画法文本、Canvas `F0C84PADP9V` 第二节和“73”文案 `1791844127.374959`；按消息全文实现，未声称独立访问或验证这些来源。
