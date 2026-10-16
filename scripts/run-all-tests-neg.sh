#!/usr/bin/env bash
# 测试-136 r2 负例（熊大 18:33 三组反例）+ 正控。只用 --replay-node-log --only node，不跑真测试，几秒跑完。
# 用法：bash scripts/run-all-tests-neg.sh   全过退出 0
set -u
HERE=$(cd "$(dirname "$0")" && pwd); RUN="node $HERE/run-all-tests.mjs"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
pass=0; fail=0
expect() { # 名称 期望退出码 实际退出码
  if [ "$2" = "$3" ]; then echo "PASS  $1（退出 $3）"; pass=$((pass+1)); else echo "FAIL  $1（期望 $2，实际 $3）"; fail=$((fail+1)); fi; }
tap() { printf '%s\n' "TAP version 13" "$@"; }
sha() { sha256sum "$1" | cut -c1-16; }

# ① 未收口 child：父级 ok + 子计划 1..0 不能冲掉
tap "# Subtest: P" "    # Subtest: C" "    1..0" "ok 1 - P" "1..1" "# tests 1" "# pass 1" "# fail 0" > "$W/open.tap"
$RUN --only node --replay-node-log "$W/open.tap" --out "$W/o1" >"$W/o1.txt" 2>&1; expect "① 父 ok 吞未收口 child → 拒绝" 1 $?
grep -q "未收口子测试 1 个：P > C" "$W/o1.txt"; expect "① 报出未收口的是 P > C" 0 $?
tap "# Subtest: P" "    # Subtest: C" "    ok 1 - C" "    1..1" "ok 1 - P" "1..1" "# tests 1" "# pass 1" "# fail 0" > "$W/closed.tap"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o1b" >/dev/null 2>&1; expect "① 正控：child 正常收口 → 通过" 0 $?

# ② 身份集合：基线 失败A+通过B；本轮 删A、留B、加通过C（总数都是 2）→ 不可比较
tap "# Subtest: A" "not ok 1 - A" "# Subtest: B" "ok 2 - B" "1..2" > "$W/base.tap"
tap "# Subtest: B" "ok 1 - B" "# Subtest: C" "ok 2 - C" "1..2" > "$W/swap.tap"
tap "# Subtest: A" "ok 1 - A" "# Subtest: B" "ok 2 - B" "1..2" > "$W/fixed.tap"
tap "# Subtest: A" "not ok 1 - A" "# Subtest: B" "not ok 2 - B" "1..2" > "$W/worse.tap"
$RUN --only node --replay-node-log "$W/base.tap" --out "$W/b" >/dev/null 2>&1
$RUN --only node --replay-node-log "$W/swap.tap" --out "$W/o2" --compare "$W/b/summary.json" >"$W/o2.txt" 2>&1; expect "② 删失败A+加通过C → 不可比较" 1 $?
grep -q "不可比较：少了 A；多了 C" "$W/o2.txt"; expect "② 报出少了 A、多了 C" 0 $?
$RUN --only node --replay-node-log "$W/fixed.tap" --out "$W/o2b" --compare "$W/b/summary.json" >"$W/o2b.txt" 2>&1; expect "② 正控：同集合 A 失败→通过 → 可过" 0 $?
grep -q "不再失败：A" "$W/o2b.txt"; expect "② 正控记「不再失败：A」" 0 $?
$RUN --only node --replay-node-log "$W/worse.tap" --out "$W/o2c" --compare "$W/b/summary.json" >/dev/null 2>&1; expect "② 同集合 B 通过→失败 → 新增失败" 1 $?

# ③ 输出经 symlink / hardlink 指向基线：写之前拒绝，基线字节不变
B="$W/b/summary.json"; before=$(sha "$B")
mkdir -p "$W/o3/logs"; ln -s "$B" "$W/o3/logs/node--test.log"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o3" >/dev/null 2>&1; expect "③ 日志 symlink 指向基线 → 拒绝" 2 $?
mkdir -p "$W/o4/logs"; ln "$B" "$W/o4/logs/node--test.log"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o4" >/dev/null 2>&1; expect "③ 日志 hardlink 指向基线 → 拒绝" 2 $?
mkdir -p "$W/o5"; ln -s "$B" "$W/o5/summary.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o5" >/dev/null 2>&1; expect "③ summary.json symlink 指向基线 → 拒绝" 2 $?
mkdir -p "$W/o6"; ln "$B" "$W/o6/summary.json"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o6" >/dev/null 2>&1; expect "③ summary.json hardlink 指向基线 → 拒绝" 2 $?
ln -s "$W/b" "$W/o7"
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o7" >/dev/null 2>&1; expect "③ --out 本身是指向基线目录的 symlink → 拒绝" 2 $?
[ ! -e "$W/o3/summary.json" ] && [ ! -e "$W/o5/logs/node--test.log" ]; expect "③ 拒绝时一个文件都没写" 0 $?
[ "$(sha "$B")" = "$before" ]; expect "③ 基线 sha256 前后一致（$before）" 0 $?
$RUN --only node --replay-node-log "$W/closed.tap" --out "$W/o8" >/dev/null 2>&1; expect "③ 正控：空目录正常写出" 0 $?

echo; echo "负例 $pass 过 / $fail 败"; [ $fail = 0 ]
