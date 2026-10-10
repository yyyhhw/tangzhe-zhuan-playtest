#!/usr/bin/env bash
# 骨架落地验收口令：bash tests/collection-acceptance/accept.sh
# 可选环境变量：COLLECTION_IMPL（规则模块）、COLLECTION_URL（收集页）、SERVE_DIR（静态服务根，默认仓库根）、PORT（默认 8790）
cd "$(dirname "$0")/../.." || exit 2
T=tests/collection-acceptance; PORT=${PORT:-8790}; SERVE_DIR=${SERVE_DIR:-.}
export COLLECTION_URL=${COLLECTION_URL:-http://127.0.0.1:$PORT/preview/cards/collection/index.html?collectionTest=1}
LOG=${LOG_DIR:-/tmp/collection-accept}; mkdir -p "$LOG"
python3 -m http.server "$PORT" -d "$SERVE_DIR" >/dev/null 2>&1 & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT; sleep 1
NODE=${NODE:-node}; command -v "$NODE" >/dev/null || { echo "✗ 找不到 node（设 NODE=/path/to/node）"; exit 2; }
BAD=0
check() { # 名 期望rc 期望summary 命令...
  local name=$1 erc=$2 esum=$3; shift 3
  "$@" >"$LOG/$name.log" 2>&1; local rc=$?
  local sum; sum=$(grep -E '^passed [0-9]+, failed [0-9]+' "$LOG/$name.log" | tail -1)
  local miss; miss=$(grep -m1 '缺接口' "$LOG/$name.log")
  if [[ $rc == "$erc" && "$sum" == "$esum"* ]]; then echo "✓ $name  rc=$rc  $sum"
  else BAD=1; echo "✗ $name  rc=$rc（期望 $erc）  ${sum:-无汇总行}（期望 $esum）${miss:+  ← $miss}"; fi
}
check rules          0 'passed 130, failed 0' "$NODE" "$T/rules.test.mjs"
check ui             0 'passed 104, failed 0' python3 "$T/ui_collection.py"
check rules-control  1 'passed 120, failed 10' env ACCEPT_CONTROL=1 "$NODE" "$T/rules.test.mjs"
check ui-control     1 'passed 100, failed 4'  env ACCEPT_CONTROL=1 python3 "$T/ui_collection.py"
echo "日志：$LOG"; [[ $BAD == 0 ]] && echo "达标：4/4" || echo "未达标（见上方 ✗ 行；分类见 RERUN.md §C）"
exit $BAD
