# 现在就能跑的口令 · 实跑结果

只写 md，只跑已有脚本。不改断言，不改游戏代码，不动 v1、v1.1、v10a。
范围：`ACCEPT-可跑口令清单.md` 里不卡拍板、也不卡交付的 5 条。2026-10-10T10:10Z 在分支 `devin/1791617143-collection-acceptance`（23d47b6）上重新跑了一遍，node v24.19.0。
**四项都没拍，这是空跑，不算验收。** 用的是 v1.1 骨架和测试夹具，不是正式配置。

```bash
S=/home/ubuntu/qa/collection/skel11/card-collection-model-v1.1
A=$S/acceptance/tests/collection-acceptance/adapters/skeleton-v1.1.mjs
```

| # | 口令 | exit | 通/挂 | 半句摘要 |
|---|---|---|---|---|
| 1 | `(cd $S && sha256sum -c SHA256.txt --quiet)`；外加 `sha256sum card-collection-model-v1.1-review.zip` | 0 | 通 | 包内文件没有不符的；zip 是 `faa83859…`，和公布的一致 |
| 2 | `(cd $S && node --test test/*.test.mjs)` | 0 | 通 | 86 个测试，86 过、0 挂、0 跳 |
| 3 | `SKELETON_DIR=$S COLLECTION_IMPL=$A node tests/collection-acceptance/rules.test.mjs` | 0 | 通 | `passed 130, failed 0`（①A 规则层，也是 REGRESSION 第 3 步） |
| 4 | 第 3 条前面加 `ACCEPT_CONTROL=1` | 1 | 通（反向对照就应该 rc 1） | `passed 120, failed 10`；10 条故意改坏的都被抓到了，失败编号那一行列了 N9-10、N1-3b、N9-1、N3-2、N3-9、N3-12、COIN、N4-4 |
| 5 | `SKEL=$S node tests/collection-acceptance/reveal_gold.test.mjs` | 3 | 通，但有跳过 | `passed 15, failed 0, skipped 12`；rc 3 表示有跳过，跳过不算通过；模拟夹具不等于 G4、G7 通过 |

## 结论
- 5 条都和 `PRE-拍板-DRYRUN.md` 的结果一样，没有退步。
- 不在这次范围里的（要等交付）：`accept.sh` 的 UI 两项缺收集页；`validate_config` 缺正式配置；`smoke_g7` 缺 G4 真实钱包；拍 B 的入口缺 B 版骨架。详见 `ACCEPT-缺件阻塞表.md`。
- 环境提醒：这台机器上的 node 不在 PATH 里，要先 `export PATH=~/.nvm/versions/node/v24.19.0/bin:$PATH`，不然第 2–5 条会报 rc 127（找不到命令）。
