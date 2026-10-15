# 星途-02 候选自测（非放行）

基线 e48be1a，2026-10-15，本地隔离合成存档。源码设计与高风险待独验清单在 `milestones/README.md`。

## 复现

```bash
mapfile -t XT02_TEST_FILES < <(rg --files tests | rg '^tests/(milestones|moon|space01a|wearables8|space113|space114|xingtuv2|lockfix|takeover|lifecycle-save|autosave15|formal)/.*\.test\.mjs$' | rg -v 'carefree-bgm.test.mjs' | sort)
node --experimental-vm-modules --test --test-isolation=none "${XT02_TEST_FILES[@]}"
node tests/formal/carefree-bgm.test.mjs
python -m http.server 8765 --bind 127.0.0.1
# 另一个 shell：使用现有 Chromium，不下载浏览器
python tests/milestones/browser.py http://127.0.0.1:8765/ /tmp/xingtu02-browser
```

`carefree-bgm.test.mjs` 是自行读取 process.argv[2] 作为目录的脚本，须单独调用。它不能与 `--test-isolation=none` 的其它文件一起跑，否则会把其它测试文件参数误当目录。

## 已核实证据

最终扩大回归：727 项，719 通过、0 失败、8 项原有跳过（未新增 skip）；新增 milestones 测试 31 项全部通过。Chromium 实页 17 项通过。

- `node-tests.txt`：最终扩大回归原始输出；末尾含确切计数和原有 skip。
- `audio-standalone.json`：音频独立脚本退出 0 的行为报告。
- `browser/results.json`：安装版 Chromium 实页 17 项通过，0 page errors。
- `browser/recap-390.png`：390×844 旧档创业史，未知日期灰字、本地日期展开、四店 Lv35；使用合成数据。
- `legacy-baseline.json`：README 中三个旧脚本在候选和 detached e48be1a 分别运行，逐条失败列表相同。root keys 6 pass/8 fail、economy 538 pass/2 fail、coin safety 516 pass/6 fail。这些旧脚本仍含已过期的存档键/发布号/旧 commitSave 假设；本项未改动或掩盖它们，不把这三项报告为全绿。

没有 main 合入、部署、WebKit 下载或用户设备操作。尚需非作者独验；本自测不构成发布批准。
