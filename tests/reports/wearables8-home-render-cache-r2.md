# 首8窄缓存修订：共享家居渲染器

父：0a9ca336d0a725535075e966fb60982b43d675da。main保持已发布091be78e08eae0ef8a12244923585c60af643a3b。本轮仅候选修订，不合main、不部署。

## 确認与最小改动

home-interaction.js已在父候选改为candidateVisual/352画布/衣帽裁剪，但两个实际HTTP入口仍指旧v=15c。旧HTML资源断言只验证存在性，未约束该已改资源的token。

- index.html:114：home-interaction.js?v=wearables8-on-tea-cards-out-20261012-r1
- pet/game/index.html:110：../../home-interaction.js?v=wearables8-on-tea-cards-out-20261012-r1

完整实际引用审计只有这两个HTML script引用；pet/game/petgame.js的Node require('../../home-interaction.js')是本地文件加载，没有HTTP缓存token。没有新增preview引用或改previewpet。

两HTML逐字节比较只发生上述URL替换。home-interaction.js本身未改，blob仍2bfe6f16f9640a3849424ee4f323568bce8e1549；其它资源、版本、开关、协议和存档代码不变。该组合尚未部署，沿用候选现有组合token，不改其它资源URL。

## 回归与证据归属

命令（仓库根）：

```sh
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
```

原139项仍保留，新增2项，合计141通过、0失败、0跳过，7个测试文件。新增正向断言要求所有实际HTML引用恰为root和正式pet、每个入口恰一次引用、解析到项目根共享文件并使用精确production组合token；负控将两个URL分别退回v=15c，必须各自抛ERR_ASSERTION。故此次漏项不能再仅靠存在性转绿。

相同19入口逐文件重跑：相对0a9ca336和091仍12成功/7失败，失败身份核对一致。命令清单仍见原wearables8-on-091be78e-20261012-r1报告，不映射preview为formal，不冒称全仓绿，不跑67全套。原存档/协议安全断言均保留。

7个同身份旧失败：test_economy.js、test_coin_safety.js、td/test_tdhost.js、td/test_td_bridge.js、td/test_td_protocol.js、preview/td/test_tdhost.js、preview/cards/tests/save.test.mjs。

node --check tests/wearables8/resource-chain.test.mjs成功。测试归Node/VM/静态文件与隔离内存，未执行本轮真实浏览器或公开站点HTTP验收；受限路线未重试/绕过。卡牌仍脱离、冻结。

## 相对父的完整差异路径

1. index.html（仅共享渲染器资源token）
2. pet/game/index.html（仅同一共享资源token）
3. tests/wearables8/resource-chain.test.mjs（2项新增缓存断言及旧token负控）
4. tests/reports/wearables8-home-render-cache-r2.md（本修订证据）
