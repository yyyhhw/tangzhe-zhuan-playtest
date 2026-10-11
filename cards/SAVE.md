# 正式卡牌候选 FC4

卡牌对局主键为 `tangzhe-formal-card-save`，与 preview 完全隔离；备份、锁、隔离快照使用同一正式前缀。对局通过窄 MessageChannel 与正式父页连接。收藏与钱包协议见 [正式接入说明](../collection/README.md)。

失败时暂停对局，保留最后成功存档与可下载快照；更高版本只读。正式经营主档不可通过重开对局或清空卡牌重置。卡牌回执永久去重，不随对局清除。

版本入口为 `formal-cards-candidate-7`。旧正式 HTML 遇到新版 app 时会重新进入版本化入口；该行为需与部署端缓存策略一起验证。

运行 `node --test cards/tests/save.test.mjs` 验证对局存档；`tests/formal/` 包含迁移、交易、音频、正式旧标签共存及两种浏览器接入验证。测试只使用合成数据和新浏览器上下文。

尚未覆盖真机 Safari 的后台回收、杀进程和存储配额；音频仍需人工听审。
