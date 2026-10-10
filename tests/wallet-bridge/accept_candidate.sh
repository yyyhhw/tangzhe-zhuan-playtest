#!/usr/bin/env bash
# 钱包桥接候选包一键验收：解压 → 核 SHA → 包内清单 → 跑 bridge.test.mjs → 退出码判定。
# 用法：bash tests/wallet-bridge/accept_candidate.sh <候选包.zip> <贴帖SHA256> [包内实现相对路径]
set -u
ZIP=${1:-}; WANT=${2:-}; REL=${3:-}
NODE=${NODE:-node}; command -v "$NODE" >/dev/null || { echo "✗ 找不到 node（设 NODE=/path/to/node）"; exit 2; }
[ -f "$ZIP" ] && [ -n "$WANT" ] || { echo "✗ 用法：accept_candidate.sh <zip> <sha256> [实现相对路径]"; exit 2; }
HERE=$(cd "$(dirname "$0")" && pwd)
GOT=$(sha256sum "$ZIP" | cut -d' ' -f1)
echo "1) SHA256 实际=$GOT"
[ "$GOT" = "$WANT" ] || { echo "✗ SHA256 与贴帖不符，停止（不解压、不跑）"; exit 4; }
echo "   ✓ 与贴帖一致"
OUT=$(mktemp -d /tmp/wb-cand.XXXX); unzip -q "$ZIP" -d "$OUT" || { echo "✗ 解压失败"; exit 4; }
echo "2) 解压到 $OUT"
M=$(find "$OUT" -name SHA256.txt | head -1)
if [ -n "$M" ]; then (cd "$(dirname "$M")" && sha256sum -c --quiet SHA256.txt) && echo "   ✓ 包内 SHA256.txt 0 不符" || { echo "✗ 包内清单有不符文件"; exit 4; }
else echo "   ⚠ 包内无 SHA256.txt（记入证据，不阻断）"; fi
if [ -z "$REL" ]; then IMPL=$(find "$OUT" -name 'wallet-bridge*.mjs' -not -path '*/test*' | head -1); else IMPL="$OUT/$REL"; fi
echo "3) 实现模块=${IMPL:-<未找到>}"
WALLET_BRIDGE_IMPL="${IMPL:-$OUT/__missing__.mjs}" "$NODE" "$HERE/bridge.test.mjs"; RC=$?
echo "4) bridge.test.mjs 退出码=$RC（期望 0）"
[ $RC -eq 0 ] && echo "✓ 候选包通过钱包桥接六项（仅桥接逻辑；不等于 G4/G7，walletBridgeApproved 由技术复核定）" || echo "✗ 候选包未通过（缺实现或真失败，见上方 ✗ 行）"
exit $RC
