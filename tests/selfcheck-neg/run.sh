#!/usr/bin/env bash
# 测试-143 自检脚本的反例：在临时假仓库里跑 tests/selfcheck.sh，不碰真仓库。用法：tests/selfcheck-neg/run.sh
set -u
SRC="$(cd "$(dirname "$0")/.." && pwd)/selfcheck.sh"
fails=0
mk() { R="$(mktemp -d)"; mkdir -p "$R/tests"; cp "$SRC" "$R/tests/"; cd "$R"; }
ok() { echo "PASS $1"; }; ng() { echo "FAIL $1"; fails=$((fails+1)); }
expect() { name="$1" want="$2"; shift 2; "$@" >out.txt 2>err.txt; got=$?
  echo "  命令: $* → 退出码 $got（期望 $want）"; sed 's/^/    | /' out.txt err.txt | head -8
  if [ "$want" = nz ]; then [ "$got" != 0 ] && ok "$name" || ng "$name"; else [ "$got" = "$want" ] && ok "$name" || ng "$name"; fi; }
# 1 缺失：基线有 test_b.js，这次没有 → 失败
mk; echo 'process.exit(0)' >test_a.js
printf '0\ttest_a.js\n1\ttest_b.js\n' >base.txt
expect "基线测试缺失→非0" nz tests/selfcheck.sh --against base.txt
# 2 改名顶替：失败的 test_b.js 改名为 test_c.js 且通过 → 仍失败
echo 'process.exit(0)' >test_c.js
expect "改名不算修好→非0" nz tests/selfcheck.sh --against base.txt
# 3 空跑：没有任何测试 → 失败
mk; printf '0\ttest_a.js\n' >base.txt
expect "零测试→非0" nz tests/selfcheck.sh --against base.txt
# 4 同集合真修好：test_b.js 1→0 → 通过
mk; echo 'process.exit(0)' >test_a.js; echo 'process.exit(0)' >test_b.js
printf '0\ttest_a.js\n1\ttest_b.js\n' >base.txt
expect "同集合失败变通过→0" 0 tests/selfcheck.sh --against base.txt
# 5 同集合新失败 → 失败
echo 'process.exit(1)' >test_a.js
expect "同集合新失败→非0" nz tests/selfcheck.sh --against base.txt
# 6 已有 evidence 同名文件不被覆盖（测试故意改写、新增、删除）
mk; mkdir evidence; echo 原始证据 >evidence/shot.txt; echo keep >evidence/del.txt
cat >test_w.js <<'J'
const fs=require("fs");fs.writeFileSync("evidence/shot.txt","被覆盖了");fs.writeFileSync("evidence/new.txt","新产物");fs.unlinkSync("evidence/del.txt");
J
before="$(cd evidence && sha256sum shot.txt del.txt)"
expect "带 evidence 跑→0" 0 tests/selfcheck.sh
after="$(cd evidence && sha256sum shot.txt del.txt 2>&1)"
echo "  before: $before" | tr '\n' ' '; echo; echo "  after:  $after" | tr '\n' ' '; echo
[ "$before" = "$after" ] && [ ! -e evidence/new.txt ] && ok "已有 evidence 字节不变、新产物不留在仓库" || ng "evidence 被改"
outd="$(sed -n 's/^selfcheck 输出目录：\([^（]*\).*/\1/p' err.txt)"
[ "$(cat "$outd/evidence/new.txt" 2>/dev/null)" = 新产物 ] && ok "新产物进了临时输出目录 $outd" || ng "新产物没进临时目录"
# 7 写基线：已存在/符号链接/硬链接都拒绝，原文件字节不变
echo 'process.exit(0)' >test_a.js; echo old >exist.txt; h0="$(sha256sum exist.txt)"
expect "--write 已存在→拒绝" nz tests/selfcheck.sh --write exist.txt
ln -s exist.txt sym.txt; expect "--write 符号链接→拒绝" nz tests/selfcheck.sh --write sym.txt
ln exist.txt hard.txt; expect "--write 硬链接→拒绝" nz tests/selfcheck.sh --write hard.txt
[ "$h0" = "$(sha256sum exist.txt)" ] && ok "exist.txt sha256 不变" || ng "exist.txt 被改"
expect "--write 新文件→0" 0 tests/selfcheck.sh --write fresh.txt
# 8 SELFCHECK_LOG 非空目录拒绝覆盖
mkdir logs; echo x >logs/test_a.js.log
SELFCHECK_LOG=logs expect "SELFCHECK_LOG 非空→拒绝" nz env SELFCHECK_LOG=logs tests/selfcheck.sh
[ "$(cat logs/test_a.js.log)" = x ] && ok "旧日志没被覆盖" || ng "旧日志被覆盖"
echo "== 反例合计失败 $fails"; exit $fails
