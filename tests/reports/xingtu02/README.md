# 星途-02 候选自测（非放行）

后续 r3 的失效握手修复、r2 失败复现与完整回归见 [r3/README.md](r3/README.md)。下文保留 r2 原始证据。

r2 基线 0b7218d，2026-10-15，本地隔离合成存档。源码设计与高风险待独验清单在 `milestones/README.md`。

## 复现

```bash
mapfile -t XT02_TEST_FILES < <(rg --files tests | rg '^tests/(milestones|moon|space01a|wearables8|space113|space114|xingtuv2|lockfix|takeover|lifecycle-save|autosave15|formal)/.*\.test\.mjs$' | rg -v 'carefree-bgm.test.mjs' | sort)
node --experimental-vm-modules --test --test-isolation=none "${XT02_TEST_FILES[@]}"
node tests/formal/carefree-bgm.test.mjs
python -m http.server 8765 --bind 127.0.0.1
# 另一个 shell：使用现有 Chromium，不下载浏览器
python tests/milestones/browser.py http://127.0.0.1:8765/ /tmp/xingtu02-browser
python tests/milestones/zombie-browser.py http://127.0.0.1:8765/ /tmp/xingtu02-zombie
node tests/milestones/verify-main.mjs
```

`carefree-bgm.test.mjs` 是自行读取 process.argv[2] 作为目录的脚本，须单独调用。它不能与 `--test-isolation=none` 的其它文件一起跑，否则会把其它测试文件参数误当目录。

八处冲突逐项处理及受保护字段变化见 `integration-r2.md`；`main-preservation.json` 是与最新 main 的实际逐字保留证据。

## 已核实证据

最终扩大回归：728 项，720 通过、0 失败、8 项原有跳过（未新增 skip）；新增 milestones 测试 32 项全部通过。Chromium 原实页 17 项通过；修订后的真实僵尸启动握手专项 28 项通过。

- `browser127-results.json` / `browser129-results.json`：最新 main 原脚本在 r2 上的 8 / 9 个场景全部 PASS，127 宠物名称、129 航程/研究台未回退。
- `node-tests.txt`：最终扩大回归原始输出；末尾含确切计数和原有 skip。
- `audio-standalone.json`：音频独立脚本退出 0 的行为报告。
- `zombie/results.json`：实际父子握手专项 28 项通过，含菜单/取消/启动失败/回执丢失超时不记、真开战即记、败局保持、重复/刷新保持、私有写入失败与不确定回读。
- `browser/results.json`：安装版 Chromium 实页 17 项通过，0 page errors。
- `browser/recap-390.png`：390×844 旧档创业史，未知日期灰字、本地日期展开、四店 Lv35；使用合成数据。
- `legacy-baseline.json`：README 中三个旧脚本在候选和 detached 0b7218d 分别运行，逐条失败列表相同。root keys 6 pass/8 fail、economy 538 pass/2 fail、coin safety 516 pass/6 fail。这些旧脚本仍含已过期的存档键/发布号/旧 commitSave 假设；本项未改动或掩盖它们，不把这三项报告为全绿。

没有 main 合入、部署、WebKit 下载或用户设备操作。尚需非作者独验；本自测不构成发布批准。
