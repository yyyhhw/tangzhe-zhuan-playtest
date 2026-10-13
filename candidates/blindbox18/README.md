# 盲盒18第二批八件 · 独立生产候选

基线为 `69e5c4183e888ebb77fd84d3cacf667222a29a3c`。本分支接入正式/预览的普通池，44→52（48普通、4超级），未合并部署，不包含盲盒16、家宅、星途或塔防候选。

八件 catalog、render 和 PNG 来源于已复核的 `bc70912c0adbb40a8b0eac1b079dd4752d02d2aa`。PNG 原始字节保留。`render.mjs` 是独立纯 Canvas 几何；`display.mjs` 适配既有衣帽显示。正式入口在 validator 构建前通过 `collectibles/wearables18-catalog.mjs` 完成44→52注册；P1取消时逆序恢复36。既有P2玩家直接采用52目录，无新迁移，不赠奖。

人物挂点不变：脚 y=0，衣在手臂/头之前，帽在头之后。四位CEO面部、发型、肤色、手臂及裤鞋仍使用原实现。空 flavor 连同换行省略，不虚构文案。

复核命令：

```sh
node --experimental-vm-modules --test tests/wearables8/*.test.mjs tests/blindbox18/*.test.mjs
node --experimental-vm-modules tests/blindbox18/make-production-fixtures.mjs
python -m http.server 8765 --bind 127.0.0.1
# 另一个终端，Python Playwright + /usr/bin/chromium
python tests/blindbox18/production-browser.py
```

生产页脚本只用隔离合成档，生成截图/JSON，不修改图片。`review.html` 是原作者的隔离画板；`browser_evidence.py` 会重新生成PNG，本次生产验收不运行它。正式页面证据和限制见 `tests/reports/blindbox18-standalone/REVIEW.md`。
