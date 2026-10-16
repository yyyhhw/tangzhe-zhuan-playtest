#!/usr/bin/env bash
# 测试-143：自检失败清单（固定命令、固定顺序、固定超时），给「改前改后失败清单一致」用。
# 只跑：根目录 test_*.mjs / test_*.js、pet/game/test_petgame.js、tests/formal/*.mjs（不跑 .py、node --test、WebKit）。
# 每个文件：cd 仓库根目录；NODE_OPTIONS=--experimental-vm-modules timeout 120 node <文件>，串行跑。
# 跑之前起 8931、8781–8784 静态服务、自动填 PLAYWRIGHT_MODULE（和 scripts/run-all-tests.mjs 一样），跑完关掉。
#
# 用法：
#   tests/selfcheck.sh                 打印「退出码<TAB>文件」，按文件名排序，每个文件一行（超时记 124）
#   tests/selfcheck.sh --fail          只打印退出码非 0 的行
#   tests/selfcheck.sh --against tests/selfcheck-baseline.txt
#                                      跑完和基线比：列出「新失败」（基线里是 0 现在非 0，或稳定失败的退出码变了）
#                                      和「新通过」；有新失败返回 1，否则 0。时好时坏的文件只提示不算。
# 环境变量：SELFCHECK_TIMEOUT（默认 120 秒）、SELFCHECK_LOG（每个文件的输出存到这个目录，默认不存）
set -u
cd "$(dirname "$0")/.." || exit 2
T="${SELFCHECK_TIMEOUT:-120}"
MODE=all; BASE=""
case "${1:-}" in
  --fail) MODE=fail ;;
  --against) MODE=against; BASE="${2:-}"; [ -f "$BASE" ] || { echo "找不到基线文件：$BASE" >&2; exit 2; } ;;
  "") ;;
  *) echo "不认识的参数：$1" >&2; exit 2 ;;
esac

files() {
  LC_ALL=C ls -1 test_*.mjs test_*.js 2>/dev/null
  [ -f pet/game/test_petgame.js ] && echo pet/game/test_petgame.js
  LC_ALL=C ls -1 tests/formal/*.mjs 2>/dev/null
}

# Playwright：和 scripts/run-all-tests.mjs 一样，优先用已设的 PLAYWRIGHT_MODULE，否则找仓库或全局装的 playwright/index.mjs。
# 找不到时浏览器脚本会以退出码 1 失败——这类失败跟环境有关，基线头部会写明当时有没有 playwright。
if [ -z "${PLAYWRIGHT_MODULE:-}" ]; then
  for d in node_modules "$(npm root -g 2>/dev/null)"; do
    for n in playwright @playwright/test; do
      [ -f "$d/$n/index.mjs" ] && { PLAYWRIGHT_MODULE="$(cd "$d/$n" && pwd)/index.mjs"; break 2; }
    done
  done
fi
export PLAYWRIGHT_MODULE="${PLAYWRIGHT_MODULE:-}"

# 静态服务：根目录浏览器脚本默认连 8931、8781–8784（同 run-all-tests.mjs），起一个只读服务，跑完关掉。
SRV_PID=""
node -e '
const http=require("http"),fs=require("fs"),path=require("path");const R=process.cwd();
const M={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg",".gif":"image/gif",".mp3":"audio/mpeg",".ogg":"audio/ogg",".wav":"audio/wav",".m4a":"audio/mp4",".woff2":"font/woff2",".txt":"text/plain; charset=utf-8",".webmanifest":"application/manifest+json"};
for(const p of [8931,8781,8782,8783,8784])http.createServer((q,s)=>{let f;try{f=path.join(R,decodeURIComponent(new URL(q.url,"http://x").pathname))}catch{s.writeHead(400);return s.end()}
if(!f.startsWith(R)){s.writeHead(403);return s.end()}try{if(fs.statSync(f).isDirectory())f=path.join(f,"index.html")}catch{}
fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end("not found")}s.writeHead(200,{"Content-Type":M[path.extname(f).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});s.end(b)})})
.on("error",e=>{console.error("端口 "+p+" 起不来（"+e.code+"），先关掉占用它的进程");process.exit(3)}).listen(p,"127.0.0.1");
' &
SRV_PID=$!
sleep 1
kill -0 "$SRV_PID" 2>/dev/null || { echo "静态服务没起来（端口被占？）" >&2; exit 2; }

# tests/formal 的浏览器脚本会往当前目录写 evidence/；跑之前没有就在跑完删掉，免得留垃圾、影响下一次。
EVID_NEW=0; [ -e evidence ] || EVID_NEW=1
RES="$(mktemp)"
trap 'rm -f "$RES"; [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null; [ "$EVID_NEW" = 1 ] && rm -rf evidence' EXIT
while IFS= read -r f; do
  if [ -n "${SELFCHECK_LOG:-}" ]; then
    mkdir -p "$SELFCHECK_LOG"; log="$SELFCHECK_LOG/$(echo "$f" | tr '/' '_').log"
  else log=/dev/null; fi
  NODE_OPTIONS=--experimental-vm-modules timeout -k 5 "$T" node "$f" </dev/null >"$log" 2>&1
  code=$?
  [ "$code" = 137 ] && code=124   # 超时后被 -k 强杀，也记成超时
  printf '%s\t%s\n' "$code" "$f" >>"$RES"
done < <(files)
LC_ALL=C sort -t$'\t' -k2,2 "$RES" -o "$RES"

case "$MODE" in
  all) cat "$RES" ;;
  fail) awk -F'\t' '$1!=0' "$RES" ;;
  against)
    # 基线格式：「退出码<TAB>文件」= 稳定结果；「~<TAB>文件」= 时好时坏；# 开头是注释
    awk -F'\t' -v base="$BASE" '
      BEGIN { while ((getline l < base) > 0) { if (l ~ /^#/ || l == "") continue; split(l, a, "\t"); b[a[2]] = a[1] } }
      { f = $2; c = $1
        if (!(f in b)) { if (c != 0) { print "新失败（基线里没有这个文件）\t" c "\t" f; bad = 1 } else print "新文件通过\t" c "\t" f; next }
        if (b[f] == "~") { if (c != 0) print "时好时坏（不算）\t" c "\t" f; next }
        if (c != b[f]) { if (c != 0) { print "新失败\t" b[f] "→" c "\t" f; bad = 1 } else print "新通过\t" b[f] "→0\t" f } }
      END { if (!bad) print "没有新失败"; exit bad }' "$RES" ;;
esac
