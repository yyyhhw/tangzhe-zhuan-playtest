#!/usr/bin/env bash
# 测试-136 负例 + 正控（r2：熊大 18:33 三组；r3：熊大 19:18 三类阻断；r4：熊大 20:31 退出退步/序号/基线 schema）。node --test 部分用真实 node --test 生成的完整 TAP 回放，
# 普通脚本部分用 --replay-root-dir 回放，不跑仓库真测试，约十几秒跑完。
# 用法：bash scripts/run-all-tests-neg.sh   全过退出 0
set -u
HERE=$(cd "$(dirname "$0")" && pwd); RUN="node $HERE/run-all-tests.mjs"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
pass=0; fail=0
expect() { # 名称 期望退出码 实际退出码
  if [ "$2" = "$3" ]; then echo "PASS  $1（退出 $3）"; pass=$((pass+1)); else echo "FAIL  $1（期望 $2，实际 $3）"; fail=$((fail+1)); fi; }
sha() { sha256sum "$1" | cut -c1-16; }
# realtap 名字 'JS 测试源'：用真实 node --test 生成完整 TAP（含计划、汇总、YAML 诊断）
realtap() { mkdir -p "$W/src/$1"; printf '%s\n' "import {test, describe, it} from 'node:test';" "$2" > "$W/src/$1/t.test.mjs"
  (cd "$W/src/$1" && node --test --test-reporter=tap t.test.mjs > "$W/$1.tap" 2>/dev/null); }
B() { $RUN --only node --replay-node-log "$W/$1.tap" --out "$W/b-$1" >/dev/null 2>&1; }   # 生成基线
C() { local base=$1 cur=$2; shift 2; $RUN --only node --replay-node-log "$W/$cur.tap" --out "$W/c-$base-$cur-$RANDOM" --compare "$W/b-$base/summary.json" "$@" >"$W/last.txt" 2>&1; }

realtap closed "test('P', async t => { await t.test('C', () => {}); });"
realtap base   "test('A', () => { throw new Error('x'); }); test('B', () => {});"
realtap swap   "test('B', () => {}); test('C', () => {});"
realtap fixed  "test('A', () => {}); test('B', () => {});"
realtap worse  "test('A', () => { throw new Error('x'); }); test('B', () => { throw new Error('y'); });"
realtap proto0 "test('__proto__', () => { throw new Error('x'); }); test('B', () => {});"
realtap proto1 "test('B', () => {});"
realtap sep0   "test('P > C', () => { throw new Error('x'); });"
realtap sep1   "describe('P', () => { it('C', () => {}); });"
realtap dup0   "test('A', () => {}); test('A', () => { throw new Error('x'); });"
realtap dup1   "test('A', () => {}); test('A #2', () => {});"
realtap yaml   "test('A', () => { throw new Error('boom\nok 7 - ghost\n# Subtest: ghost2\n1..9'); }); test('B', () => {});"
grep -q '^1\.\.' "$W/closed.tap" && grep -q '^# tests' "$W/closed.tap"; expect "0 正控本身是完整真实 TAP（有顶层计划和汇总）" 0 $?

# ① 未收口 child：父级 ok 冲不掉（手写，但带完整计划/汇总）
printf '%s\n' "TAP version 13" "# Subtest: P" "    # Subtest: C" "    1..0" "ok 1 - P" "1..1" "# tests 1" "# pass 1" "# fail 0" > "$W/open.tap"
$RUN --only node --replay-node-log "$W/open.tap" --out "$W/o1" >"$W/o1.txt" 2>&1; expect "① 父 ok 吞未收口 child → 拒绝" 1 $?
grep -q "未收口子测试 P › C" "$W/o1.txt"; expect "① 报出未收口的是 P › C" 0 $?
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o1b" >/dev/null 2>&1; expect "① 正控：真实 TAP child 正常收口 → 通过" 0 $?

# r3-① 身份
B base; B proto0; B sep0; B dup0; B yaml
C base swap;  expect "身份 删失败A+加通过C（总数同 2）→ 不可比较" 1 $?
grep -q "不可比较：少了 A；多了 C" "$W/last.txt"; expect "身份 报出少了 A、多了 C" 0 $?
C base fixed; expect "身份 正控：同集合 A 失败→通过 → 可过" 0 $?
grep -q "不再失败：A" "$W/last.txt"; expect "身份 正控记「不再失败：A」" 0 $?
C base worse; expect "身份 同集合 B 通过→失败 → 新增失败" 1 $?
C proto0 proto1; expect "身份 原型键：旧 __proto__ 失败+B，新只剩 B → 不可比较" 1 $?
grep -q "少了 __proto__" "$W/last.txt"; expect "身份 报出少了 __proto__" 0 $?
C sep0 sep1; expect "身份 分隔符：顶层「P > C」失败 vs 套件 P 下 C 通过 → 不可比较" 1 $?
C dup0 dup1; expect "身份 重名：两个 A（第2个失败）vs A + 「A #2」→ 不可比较" 1 $?
C dup0 dup0; expect "身份 重名正控：同一份重名 TAP 自比 → 逐项一致" 0 $?

# r3-② 完整性：截断/超时/信号/YAML
head -n 4 "$W/fixed.tap" > "$W/trunc.tap"   # ok 之后被杀：没有计划和汇总
C base trunc; expect "完整性 A 输出 ok 后被截断（无计划/汇总）→ 不可比较，旧失败不豁免" 1 $?
grep -q "缺顶层计划" "$W/last.txt"; expect "完整性 报出缺顶层计划" 0 $?
C base fixed --replay-node-exit timeout; expect "完整性 完整 TAP 但进程超时 → 不可比较" 1 $?
C base fixed --replay-node-exit SIGKILL; expect "完整性 完整 TAP 但被 SIGKILL → 不可比较" 1 $?
C base fixed --replay-node-exit 0; expect "完整性 正控：完整 TAP + 退出 0 → 可过" 0 $?
grep -q "ghost" "$W/yaml.tap"; expect "YAML 前提：真实 TAP 的诊断块里确有 ok/Subtest 样文字" 0 $?
C yaml yaml; expect "YAML 诊断块里的 ok/Subtest 不算用例 → 自比逐项一致" 0 $?
! grep -q ghost "$W/b-yaml/summary.json"; expect "YAML summary 里没有 ghost 身份" 0 $?

# r3-③ 基线：先读校验冻结；同路径/同实体/缺失/畸形/旧格式 → 2，且什么都不跑不写
mkdir -p "$W/o9"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o9" --compare "$W/o9/summary.json" >"$W/last.txt" 2>&1; expect "基线 指向本次 out/summary.json（起初不存在）→ 拒绝" 2 $?
[ -z "$(ls -A "$W/o9")" ]; expect "基线 自比较被拒时 out 里一个文件都没写" 0 $?
mkdir -p "$W/o10"; cp "$W/b-base/summary.json" "$W/o10/base.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o10" --compare "$W/o10/base.json" >/dev/null 2>&1; expect "基线 落在 out 目录里 → 拒绝" 2 $?
mkdir -p "$W/o11"; ln -s "$W/o11/summary.json" "$W/lnk.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o11" --compare "$W/lnk.json" >/dev/null 2>&1; expect "基线 是指向本次 out/summary.json 的 symlink → 拒绝" 2 $?
[ ! -e "$W/o11/summary.json" ]; expect "基线 symlink 情况没写出 summary" 0 $?
echo '{"rows":[{"script":"node --test","exit":0,"cases":{}}]}' > "$W/r2fmt.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o12" --compare "$W/r2fmt.json" >/dev/null 2>&1; expect "基线 旧版（无 format 3）→ 拒绝重跑基线" 2 $?
echo '{bad' > "$W/bad.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o13" --compare "$W/bad.json" >/dev/null 2>&1; expect "基线 畸形 JSON → 拒绝" 2 $?
[ ! -e "$W/o12/summary.json" ] && [ ! -e "$W/o13/logs/node--test.log" ]; expect "基线 拒绝时 node 日志和 summary 都没写" 0 $?

# r3-① 普通脚本（--replay-root-dir）：仅失败名 / 完整身份 / 不完整
mk() { mkdir -p "$W/$1"; printf '%b' "$3" > "$W/$1/$2.log"; echo "$4" > "$W/$1/$2.exit"; }
RB() { $RUN --only root --replay-root-dir "$W/$1" --out "$W/rb-$1" >/dev/null 2>&1; }
RC() { $RUN --only root --replay-root-dir "$W/$2" --out "$W/rc-$1-$2-$RANDOM" --compare "$W/rb-$1/summary.json" >"$W/last.txt" 2>&1; }
mk pf0 test_x.js '  ✗ A\nsuite: 1 passed, 1 failed\n' 1
mk pf1 test_x.js 'suite: 2 passed, 0 failed\n' 0
mk pf2 test_x.js '  ✗ C\nsuite: 1 passed, 1 failed\n' 1
mk pa0 test_y.js 'PASS A\nFAIL B\n1/2 PASS\n' 1
mk pa1 test_y.js 'PASS A\nPASS B\n2/2 PASS\n' 0
mk pa2 test_y.js 'PASS A\nPASS C\n2/2 PASS\n' 0
mk pa3 test_y.js 'PASS A\nPASS B\n2/2 PASS\n' timeout
RB pf0; RB pa0
RC pf0 pf1; expect "普通 仅失败名：旧 ✗A 退出1 → 新 0 失败退出0（总数同 2）→ 不可比较，不记修好" 1 $?
! grep -q "不再失败" "$W/last.txt"; expect "普通 仅失败名不出现「不再失败」" 0 $?
RC pf0 pf2; expect "普通 仅失败名：失败名 A→C 计数同 → 不可比较" 1 $?
RC pf0 pf0; expect "普通 仅失败名正控：完全相同 → 逐项一致" 0 $?
RC pa0 pa1; expect "普通 完整身份正控：同集合 B 失败→通过 → 可过" 0 $?
RC pa0 pa2; expect "普通 完整身份：B 换成 C → 不可比较" 1 $?
RC pa0 pa3; expect "普通 超时 → 不完整、不可比较" 1 $?

# r2-③ 输出经 symlink / hardlink 指向基线：写之前拒绝，基线字节不变
BS="$W/b-base/summary.json"; before=$(sha "$BS")
mkdir -p "$W/o3/logs"; ln -s "$BS" "$W/o3/logs/node--test.log"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o3" >/dev/null 2>&1; expect "输出 日志 symlink 指向基线 → 拒绝" 2 $?
mkdir -p "$W/o4/logs"; ln "$BS" "$W/o4/logs/node--test.log"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o4" >/dev/null 2>&1; expect "输出 日志 hardlink 指向基线 → 拒绝" 2 $?
mkdir -p "$W/o5"; ln -s "$BS" "$W/o5/summary.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o5" >/dev/null 2>&1; expect "输出 summary.json symlink 指向基线 → 拒绝" 2 $?
mkdir -p "$W/o6"; ln "$BS" "$W/o6/summary.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o6" >/dev/null 2>&1; expect "输出 summary.json hardlink 指向基线 → 拒绝" 2 $?
ln -s "$W/b-base" "$W/o7"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o7" >/dev/null 2>&1; expect "输出 --out 本身是指向基线目录的 symlink → 拒绝" 2 $?
[ ! -e "$W/o3/summary.json" ] && [ ! -e "$W/o5/logs/node--test.log" ]; expect "输出 拒绝时一个文件都没写" 0 $?
[ "$(sha "$BS")" = "$before" ]; expect "输出 基线 sha256 前后一致（$before）" 0 $?
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o8" >/dev/null 2>&1; expect "输出 正控：空目录正常写出" 0 $?

# r4-① 进程退出退步：所有身份分支（含 full）都查，旧 exit 1 基线不豁免
$RUN --only node --replay-node-log "$W/fixed.tap" --replay-node-exit 1 --out "$W/b-fixed1" >/dev/null 2>&1
B fixed
C fixed fixed --replay-node-exit 1; expect "r4-① full：同为全 PASS，基线 exit 0 → 本轮 exit 1 → 不一致" 1 $?
grep -q "退出码 0→1，退出退步" "$W/last.txt"; expect "r4-① 报出退出退步" 0 $?
$RUN --only node --replay-node-log "$W/fixed.tap" --replay-node-exit 1 --out "$W/c4-$RANDOM" --compare "$W/b-fixed1/summary.json" >"$W/last.txt" 2>&1; expect "r4-① full：两轮都全 PASS 且都 exit 1 → 不一致（旧 exit 1 不豁免）" 1 $?
grep -q "用例全部通过但进程退出 1" "$W/last.txt"; expect "r4-① 报出全过却 exit 1" 0 $?
C base base --replay-node-exit 1; expect "r4-① 正控：确有失败用例、两轮都正常 exit 1、日志完整 → 逐项一致" 0 $?
C base base --replay-node-exit timeout; expect "r4-① 正控旁证：确有失败但超时仍不豁免" 1 $?
mk pa4 test_y.js 'PASS A\nPASS B\n2/2 PASS\n' 1
RB pa1; RC pa1 pa4; expect "r4-① 普通 full：全 PASS，exit 0 → 1 → 不一致" 1 $?

# r4-② 序号只剥明确格式，名字开头的数字保留
mk pn0 test_z.js 'FAIL 3000金币购买\nPASS B\n1/2 PASS\n' 1
mk pn1 test_z.js 'PASS 5000金币购买\nPASS B\n2/2 PASS\n' 0
mk pn2 test_z.js 'PASS 3000金币购买\nPASS B\n2/2 PASS\n' 0
mk ps0 test_s.js 'not ok 1 - A\nok 2 - B\n1/2 PASS\n' 1
mk ps1 test_s.js 'ok 1 - A\nok 2 - B\n2/2 PASS\n' 0
RB pn0; RB ps0
RC pn0 pn1; expect "r4-② FAIL「3000金币购买」→ PASS「5000金币购买」→ 不可比较，不算修好" 1 $?
! grep -q "不再失败" "$W/last.txt"; expect "r4-② 改名不出现「不再失败」" 0 $?
grep -q '"name": "3000金币购买"' "$W/rb-pn0/summary.json"; expect "r4-② 基线身份保留原名 3000金币购买" 0 $?
RC pn0 pn2; expect "r4-② 正控：同名 3000金币购买 fail→pass → 可过" 0 $?
grep -q "不再失败：3000金币购买" "$W/last.txt"; expect "r4-② 正控记「不再失败：3000金币购买」" 0 $?
RC ps0 ps1; expect "r4-② 正控：明确序号「ok N - 」仍剥掉，A fail→pass 可过" 0 $?
grep -q "不再失败：A" "$W/last.txt"; expect "r4-② 正控记「不再失败：A」（序号已剥）" 0 $?

# r4-③ 基线行 schema：full 缺 ids/cases 或类型不对 → 起服务、跑测试、写文件之前退出 2
s3() { local name=$1 json=$2 mode=$3; echo "$json" > "$W/$name.json"; local h=$(sha "$W/$name.json")
  $RUN --only $mode $( [ $mode = node ] && echo --replay-node-log "$W/closed.tap" || echo --replay-root-dir "$W/pa1") --out "$W/o-$name" --compare "$W/$name.json" >"$W/last.txt" 2>&1; local rc=$?
  expect "r4-③ $4 → 退出 2" 2 $rc
  [ ! -e "$W/o-$name" ] && [ "$(sha "$W/$name.json")" = "$h" ]; expect "r4-③ $4：out 没建、基线字节不变" 0 $?
  grep -q "拒绝：基线" "$W/last.txt" && ! grep -qE "静态服务|^仓库 |▶|端口" "$W/last.txt"; expect "r4-③ $4：报基线拒绝，未起服务/未跑测试" 0 $?; }
s3 nocases '{"format":3,"rows":[{"script":"node --test","exit":0,"idMode":"full","incomplete":[]}]}' node "node 行 full 缺 cases"
s3 badcases '{"format":3,"rows":[{"script":"node --test","exit":0,"idMode":"full","cases":[{"path":"A","n":1,"status":"pass"}],"incomplete":[]}]}' node "node 行 cases.path 不是数组"
s3 noids '{"format":3,"rows":[{"script":"test_y.js","exit":0,"idMode":"full","incomplete":[]}]}' root "普通行 full 缺 ids"
s3 badids '{"format":3,"rows":[{"script":"test_y.js","exit":0,"idMode":"full","ids":"A,B","incomplete":[]}]}' root "普通行 ids 不是数组"

# 测试-144：JSON 计数只认带明确汇总的测试结果对象；业务 JSON 的 ok/status 不当断言
row() { node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).rows[0];console.log(`${r.pass}/${r.fail}/${r.exit}`)' "$W/rb-$1/summary.json"; }
j144() { local name=$1 log=$2 code=$3 want_rc=$4 want_row=$5 what=$6
  mk "$name" test_j.mjs "$log" "$code"; RB "$name"; local rc=$?
  expect "144 $what：整体退出" "$want_rc" $rc
  local got=$(row "$name"); [ "$got" = "$want_row" ]; expect "144 $what：计数 $want_row（实际 $got）" 0 $?; }
j144 jb0 '[{"key":"a","ok":false,"same":true},{"key":"b","ok":false,"same":true}]\n' 0 0 'null/null/0' "业务记录数组 ok:false×2 + exit 0 → 记—/—，不算 2 败"
j144 jb1 '[{"key":"a","ok":true}]\n' 1 1 'null/null/1' "业务 ok:true 但进程 exit 1 → 不凭 ok 记过、不判绿"
j144 jb2 '{"ok":false,"status":"fail","detail":"预期保存失败"}\n' 0 0 'null/null/0' "业务对象无汇总（ok/status 字段）→ 记—/—"
j144 jq0 '{\n  "passed": 2,\n  "failed": 0,\n  "rows": [{"name":"A","ok":true},{"name":"B","ok":true}]\n}\n' 0 0 '2/0/0' "正控 queue 式 passed/failed 汇总 → 2/0"
j144 jq1 '{\n  "passed": 1,\n  "failed": 1,\n  "rows": [{"name":"A","ok":true},{"name":"B","ok":false}]\n}\n' 1 1 '1/1/1' "真实断言失败（汇总 failed 1）→ 1 败、整体退出 1"
j144 jq2 '{\n  "passed": 2,\n  "failed": 0,\n  "rows": [{"name":"A","ok":true},{"name":"B","ok":false}]\n}\n' 0 0 '2/1/0' "汇总写 0 败但逐条有 ok:false → 按逐条记 1 败，不被汇总盖掉"
j144 jr0 '{\n  "results": [{"name":"A","status":"pass"},{"name":"B","status":"pass"},{"name":"C","status":"pending-policy"}],\n  "counts": {"pass": 2, "fail": 0, "pending-policy": 1}\n}\n' 0 0 '2/0/0' "正控 regression 式 counts.pass/fail → 2/0"
j144 jl0 '{\n  "rows": [{"entry":"x","status":"pass","detail":{"status":"INVALID_JSON_READ_ONLY"}}],\n  "pass": 1,\n  "fail": 0\n}\n' 0 0 '1/0/0' "正控 lifecycle 式顶层 pass/fail，嵌套业务 status 不干扰 → 1/0"
j144 jw0 '(node:123) ExperimentalWarning: VM Modules is an experimental feature\n(Use `node --trace-warnings ...` to show where the warning was created)\n{\n  "passed": 3,\n  "failed": 0\n}\n' 0 0 '3/0/0' "正控 JSON 前只夹 Node 明确警告行 → 剥掉后认汇总 3/0"
# 144 r2 P1-①：只剥 Node 明确警告；前置失败 JSON + 后接成功 JSON 不能被吞
j144 jp0 '{"passed":0,"failed":1,"rows":[{"name":"A","ok":false}]}\n{"passed":1,"failed":0,"rows":[{"name":"A","ok":true}]}\n' 0 1 'null/null/incomplete' "r2 前置失败 JSON + 后接成功 JSON → 不完整，不吞失败"
RC jq0 jp0; expect "144 r2 前置失败+后接成功 JSON → compare 不得返回 0" 1 $?
grep -q "不是单个可解析 JSON" "$W/last.txt"; expect "144 r2 报出「不是单个可解析 JSON」" 0 $?
j144 jw1 'warn: something\n{"passed":0,"failed":1,"rows":[{"name":"A","ok":false}]}\n' 0 1 'null/null/incomplete' "r2 非 Node 警告前缀 + 失败 JSON → 不剥、不完整"
# 144 r2 P1-②：多套汇总冲突 → 不完整、不可比较；一致才用
j144 jx1 '{"pass":1,"fail":0,"counts":{"pass":1,"fail":0},"rows":[{"name":"A","status":"pass"}]}\n' 0 0 '1/0/0' "r2 正控：pass/fail 与 counts 一致 → 1/0"
j144 jx0 '{"pass":1,"fail":0,"counts":{"pass":0,"fail":1},"rows":[{"name":"A","status":"pass"}]}\n' 0 1 'null/null/incomplete' "r2 顶层 1过0败、counts 0过1败 → 冲突、不完整"
RC jx1 jx0; expect "144 r2 汇总冲突 → compare 不可比较" 1 $?
grep -q "多套汇总互相冲突" "$W/last.txt"; expect "144 r2 报出「多套汇总互相冲突」" 0 $?
j144 jx2 '{"passed":2,"failed":0,"pass":1,"fail":1}\n' 0 1 'null/null/incomplete' "r2 passed/failed 与 pass/fail 冲突 → 不完整"
mk jx3 test_j.mjs '{"pass":1,"fail":0,"counts":{"pass":1,"fail":0},"rows":[{"name":"A","status":"pass"}]}\n' 0
RC jx1 jx3; expect "144 r2 正控：两轮一致汇总 → 逐项一致" 0 $?
mk jt0 test_j.mjs '{"passed": 1, "failed": 0}\n  ✗ A\n' 1; RB jt0
# 144 r3：带汇总字段又不是单个 JSON → 记不完整（比原来接受的 —/1、0/1 更保守）
# （先取值再判断：原写法把 $(row …) 放在 expect 参数里，会把 $? 冲成 0，断言恒过）
got_jt0=$(row jt0); [ "$got_jt0" = "null/null/incomplete" ]; expect "144 JSON 后面还跟逐行 ✗ → 不当纯 JSON 汇总，记不完整（实际 $got_jt0）" 0 $?
# 144 r3（熊大 22:55）：不含 rows/ok/status、只有汇总字段的多段报告也不能吞失败
mk jm0 test_j.mjs '{"passed":1,"failed":0}\n{"passed":1,"failed":0}\n' 0; RB jm0
j144 jm1 '{"passed":0,"failed":1}\n{"passed":1,"failed":0}\n' 0 1 'null/null/incomplete' "r3 两段只含 passed/failed、首段失败 → 不完整"
RC jm0 jm1; expect "144 r3 熊大反例：两段汇总首段变失败 → compare 不得返回 0" 1 $?
grep -q '"passed" 等结果/汇总字段但不是单个可解析 JSON' "$W/last.txt"; expect "144 r3 报出汇总字段多段" 0 $?
j144 jm2 '{"pass":1,"fail":0}\n{"pass":1,"fail":0}\n' 0 1 'null/null/incomplete' "r3 两段只含 pass/fail → 不完整"
j144 jm3 '{"counts":{"pass":1,"fail":0}}\n{"counts":{"pass":1,"fail":0}}\n' 0 1 'null/null/incomplete' "r3 两段只含 counts → 不完整"
j144 jm4 '{"failed":1,"passed":0}\n{"passed":2,"failed":0}\n' 0 1 'null/null/incomplete' "r3 两段汇总、字段顺序反 → 不完整"
j144 js0 '{"passed":1,"failed":0}\n' 0 0 '1/0/0' "r3 正控：单段只含 passed/failed → 1/0"
j144 js1 '{"pass":2,"fail":0}\n' 0 0 '2/0/0' "r3 正控：单段只含 pass/fail → 2/0"
j144 js2 '{"counts":{"pass":3,"fail":0}}\n' 0 0 '3/0/0' "r3 正控：单段只含 counts → 3/0"
mk js3 test_j.mjs '{"passed":1,"failed":0}\n' 0
RC js0 js3; expect "144 r3 正控：两轮单段汇总一致 → 逐项一致" 0 $?
# compare：业务 JSON 行内容变了但都 exit 0 → 逐项一致；exit 0→1 仍拒绝
mk jc1 test_j.mjs '[{"key":"a","ok":true}]\n' 0; mk jc2 test_j.mjs '[{"key":"a","ok":false}]\n' 1
RC jb0 jc1; expect "144 compare 正控：业务 JSON ok 值变、两轮都 exit 0 → 逐项一致" 0 $?
RC jb0 jc2; expect "144 compare：业务 JSON 行 exit 0→1 → 不一致" 1 $?
grep -q "退出码 0→1，退出退步" "$W/last.txt"; expect "144 compare 报出退出退步" 0 $?

echo; echo "负例 $pass 过 / $fail 败"; [ $fail = 0 ]
