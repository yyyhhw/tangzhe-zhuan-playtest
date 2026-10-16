#!/usr/bin/env bash
# 测试-143 自检脚本的反例：在临时假仓库里跑 tests/selfcheck.sh，不碰真仓库。用法：tests/selfcheck-neg/run.sh
set -u
SRC="$(cd "$(dirname "$0")/.." && pwd)/selfcheck.sh"
fails=0
mk() { R="$(mktemp -d)"; mkdir -p "$R/tests"; cp "$SRC" "$R/tests/"; cd "$R"; }
ok() { echo "PASS $1"; }; ng() { echo "FAIL $1"; fails=$((fails+1)); }
chk() { if eval "$2"; then ok "$1"; else ng "$1"; fi; }
expect() { name="$1" want="$2"; shift 2; "$@" >out.txt 2>err.txt; got=$?
  echo "  命令: $* → 退出码 $got（期望 $want）"; sed 's/^/    | /' out.txt err.txt | head -6
  if [ "$want" = nz ]; then [ "$got" != 0 ] && ok "$name" || ng "$name"; else [ "$got" = "$want" ] && ok "$name" || ng "$name"; fi; }
h() { sha256sum "$@" 2>&1 | awk '{print $1}' | tr '\n' ' '; }
WRITER='const fs=require("fs");fs.mkdirSync("evidence",{recursive:true});fs.writeFileSync("evidence/shot.txt","被覆盖了");fs.writeFileSync("evidence/new.txt","新产物");try{fs.unlinkSync("evidence/del.txt")}catch{}'

echo "== 比较口径"
mk; echo 'process.exit(0)' >test_a.js; printf '0\ttest_a.js\n1\ttest_b.js\n' >base.txt
expect "基线测试缺失→非0" 1 tests/selfcheck.sh --against base.txt
echo 'process.exit(0)' >test_c.js
expect "改名顶替不算修好→非0" 1 tests/selfcheck.sh --against base.txt
mk; printf '0\ttest_a.js\n' >base.txt
expect "零测试→非0" 1 tests/selfcheck.sh --against base.txt
mk; echo 'process.exit(0)' >test_a.js; echo 'process.exit(0)' >test_b.js; printf '0\ttest_a.js\n1\ttest_b.js\n' >base.txt
expect "同集合失败变通过→0" 0 tests/selfcheck.sh --against base.txt
echo 'process.exit(1)' >test_a.js
expect "同集合新失败→非0" 1 tests/selfcheck.sh --against base.txt

echo "== P2 重复/畸形/空基线"
mk; echo 'process.exit(1)' >test_a.js; echo 'require("fs").writeFileSync("ran","1")' >test_m.js
printf '1\ttest_a.js\n0\ttest_a.js\n' >dup.txt
expect "重复基线记录→拒绝(2)" 2 tests/selfcheck.sh --against dup.txt
chk "重复基线时测试根本没跑" '[ ! -e ran ]'
printf 'abc\ttest_a.js\n' >bad.txt; expect "畸形基线→拒绝(2)" 2 tests/selfcheck.sh --against bad.txt
printf '# only comment\n' >empty.txt; expect "空基线→拒绝(2)" 2 tests/selfcheck.sh --against empty.txt

echo "== P1-① 隔离：已有 evidence 字节不变，新产物只在输出目录"
mk; mkdir evidence; echo 原始证据 >evidence/shot.txt; echo keep >evidence/del.txt; echo "$WRITER" >test_w.js
b="$(h evidence/shot.txt evidence/del.txt)"
expect "带 evidence 跑→0" 0 tests/selfcheck.sh
a="$(h evidence/shot.txt evidence/del.txt)"; echo "  sha before: $b"; echo "  sha after:  $a"
chk "原 evidence sha256 不变、仓库里没有 new.txt" '[ "$b" = "$a" ] && [ ! -e evidence/new.txt ]'
outd="$(sed -n 's/^selfcheck 输出目录：\([^（]*\).*/\1/p' err.txt)"
chk "新产物在 $outd/evidence、隔离拷贝已删" '[ "$(cat "$outd/evidence/new.txt")" = 新产物 ] && [ ! -e "$outd/repo" ]'

echo "== P1-① 内部软链接/硬链接：拒绝，外部目标 hash 不变"
mk; EXT="$(mktemp -d)"; echo 外部旧证据 >"$EXT/old.txt"; e0="$(h "$EXT/old.txt")"
mkdir evidence; ln -s "$EXT/old.txt" evidence/shot.txt; echo "$WRITER" >test_w.js
expect "evidence 内软链接→拒绝(2)" 2 tests/selfcheck.sh
chk "软链接外部目标 hash 不变 ($e0)" '[ "$e0" = "$(h "$EXT/old.txt")" ]'
rm evidence/shot.txt; ln "$EXT/old.txt" evidence/shot.txt 2>/dev/null || cp "$EXT/old.txt" evidence/shot.txt
expect "evidence 内硬链接→拒绝(2)" 2 tests/selfcheck.sh
chk "硬链接外部目标 hash 不变" '[ "$e0" = "$(h "$EXT/old.txt")" ]'

echo "== P1-② 中断/提前退出：原 evidence 保全"
mk; mkdir evidence; echo 原始证据 >evidence/shot.txt; b="$(h evidence/shot.txt)"
printf '%s\nsetTimeout(()=>{},30000)\n' "$WRITER" >test_slow.js
tests/selfcheck.sh >out.txt 2>err.txt & P=$!; sleep 3; kill -TERM $P; wait $P; got=$?
echo "  命令: tests/selfcheck.sh & ; 3s 后 kill -TERM → 退出码 $got"; sed 's/^/    | /' err.txt | head -3
chk "TERM 中断→非0 且原 evidence 不变、无 new.txt" '[ "$got" != 0 ] && [ "$b" = "$(h evidence/shot.txt)" ] && [ ! -e evidence/new.txt ]'
chk "中断后隔离拷贝已清理" '! ls -d "${TMPDIR:-/tmp}"/selfcheck.*/repo/test_slow.js 2>/dev/null | grep -q .'
mkdir logs; echo x >logs/test_slow.js.log
expect "提前退出（日志目录非空）→2" 2 env SELFCHECK_LOG=logs tests/selfcheck.sh
chk "提前退出后原 evidence 不变、旧日志不变" '[ "$b" = "$(h evidence/shot.txt)" ] && [ "$(cat logs/test_slow.js.log)" = x ]'

echo "== P1-③ 拷贝失败：不跑测试、不删原证据"
mk; mkdir evidence; echo 原始证据 >evidence/shot.txt; b="$(h evidence/shot.txt)"
echo 'require("fs").writeFileSync("'"$R"'/ran","1")' >test_m.js; mkdir secret; echo s >secret/x; chmod 000 secret
expect "拷贝失败→2" 2 tests/selfcheck.sh
chmod 755 secret
chk "测试没跑、原 evidence 不变" '[ ! -e ran ] && [ "$b" = "$(h evidence/shot.txt)" ]'

echo "== P1-④ 并发：运行期间别的进程对原 evidence 的新增/更新被保留"
mk; mkdir evidence; echo v1 >evidence/shot.txt; printf '%s\nsetTimeout(()=>{},3000)\n' "$WRITER" >test_slow.js
tests/selfcheck.sh >out.txt 2>err.txt & P=$!; sleep 1.5; echo v2 >evidence/shot.txt; echo 并发 >evidence/conc.txt; wait $P; got=$?
echo "  并发写后 selfcheck 退出码 $got"
chk "并发更新(v2)和新增(conc.txt)都保留" '[ "$(cat evidence/shot.txt)" = v2 ] && [ "$(cat evidence/conc.txt)" = 并发 ] && [ ! -e evidence/new.txt ]'

echo "== --write"
mk; echo 'process.exit(0)' >test_a.js; echo old >exist.txt; h0="$(h exist.txt)"
expect "--write 已存在→2" 2 tests/selfcheck.sh --write exist.txt
ln -s exist.txt sym.txt; expect "--write 符号链接→2" 2 tests/selfcheck.sh --write sym.txt
mkdir hl; ln exist.txt hl/hard.txt; expect "--write 硬链接→2" 2 tests/selfcheck.sh --write hl/hard.txt
rm -rf hl; mkdir wdir; expect "P2 --write 目标是目录→2" 2 tests/selfcheck.sh --write wdir
chk "目录里没被写进东西" '[ -z "$(ls -A wdir)" ]'
chk "exist.txt sha256 不变" '[ "$h0" = "$(h exist.txt)" ]'
rm -rf wdir sym.txt; expect "--write 新文件→0" 0 tests/selfcheck.sh --write fresh.txt
chk "fresh.txt 是普通文件、内容含 test_a.js" '[ -f fresh.txt ] && [ ! -L fresh.txt ] && grep -q "0	test_a.js" fresh.txt'

echo "== P2 SELFCHECK_LOG 路径可定位"
mk; echo 'console.log("hello-log")' >test_a.js; mkdir evidence
expect "SELFCHECK_LOG=evidence/logs →0" 0 env SELFCHECK_LOG=evidence/logs tests/selfcheck.sh
rep="$(sed -n 's/.*（日志：\([^；]*\)；.*/\1/p' err.txt)"; echo "  报告的日志路径: $rep"
chk "报告路径下确有日志且内容正确" '[ "$(cat "$rep/test_a.js.log")" = hello-log ] && [ "$rep" = "$(pwd -P)/evidence/logs" ]'

echo "== 19:06 P1 拷贝后再扫：拷贝里混进链接 / 扫描失败 → 测试不启动"
mk; EXT="$(mktemp -d)"; echo 外部旧证据 >"$EXT/old.txt"; e0="$(h "$EXT/old.txt")"
mkdir evidence; echo "$WRITER" >test_w.js; echo 'require("fs").writeFileSync("'"$R"'/ran","1")' >test_m.js
expect "拷贝里出现软链接→2" 2 env SELFCHECK_TEST_HOOK_AFTER_COPY='ln -s '"$EXT"'/old.txt "$1/evidence/shot.txt"' tests/selfcheck.sh
chk "测试没启动、外部目标 hash 不变" '[ ! -e ran ] && [ "$e0" = "$(h "$EXT/old.txt")" ]'
expect "拷贝里出现硬链接→2" 2 env SELFCHECK_TEST_HOOK_AFTER_COPY='ln '"$EXT"'/old.txt "$1/evidence/shot.txt" 2>/dev/null || ln "$1/test_w.js" "$1/evidence/hl.js"' tests/selfcheck.sh
chk "测试没启动、外部目标 hash 不变" '[ ! -e ran ] && [ "$e0" = "$(h "$EXT/old.txt")" ]'
expect "扫描拷贝失败→2" 2 env SELFCHECK_TEST_HOOK_AFTER_COPY='mkdir "$1/locked"; chmod 000 "$1/locked"' tests/selfcheck.sh
chk "扫描失败时测试没启动" '[ ! -e ran ]'

echo "== 19:06 P2 基线快照：校验后改写原基线不影响比较"
mk; B="$R/base.txt"; printf '0\ttest_a.js\n' >"$B"
echo 'require("fs").writeFileSync("'"$B"'","1\ttest_a.js\n");process.exit(1)' >test_a.js
expect "测试中改写原基线 0→1，仍按快照判新失败→1" 1 tests/selfcheck.sh --against base.txt
chk "输出是「新失败 0→1」" 'grep -q "新失败	0→1	test_a.js" out.txt'
printf '0\ttest_a.js\n' >"$B"; echo "process.exit(1)" >test_a.js
expect "钩子在校验后改写原基线（0→1），仍按快照→1" 1 env SELFCHECK_TEST_HOOK_AFTER_COPY='printf "1\ttest_a.js\n" >'"$B" tests/selfcheck.sh --against base.txt

echo "== 19:06 P2 TMPDIR 在仓库里 → 拒绝、不递归"
mk; echo 'require("fs").writeFileSync("'"$R"'/ran","1")' >test_m.js; mkdir tmpin
expect "TMPDIR=仓库内→2" 2 env TMPDIR="$R/tmpin" tests/selfcheck.sh
chk "没跑测试、tmpin 里没生成任何东西" '[ ! -e ran ] && [ -z "$(ls -A tmpin)" ]'
expect "TMPDIR=仓库根→2" 2 env TMPDIR="$R" tests/selfcheck.sh
chk "仓库根下没有 selfcheck.* 目录" '! ls -d selfcheck.* 2>/dev/null | grep -q .'

echo "== 反例合计失败 $fails"; exit $fails
