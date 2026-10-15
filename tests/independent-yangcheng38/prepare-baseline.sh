#!/usr/bin/env bash
set -euo pipefail
qa_dir=$(cd -- "$(dirname -- "$0")" && pwd)
qa_source=${1:-https://github.com/yyyhhw/tangzhe-zhuan-playtest.git}
if [ -e "$qa_dir/main" ]; then
  test "$(git -C "$qa_dir/main" rev-parse HEAD)" = f628b2eb6416e660083e5d4a0f7f422145abaaa8
  test -z "$(git -C "$qa_dir/main" status --porcelain)"
  echo 'Pinned main already present and clean'; exit 0
fi
git clone --no-checkout -- "$qa_source" "$qa_dir/main"
git -C "$qa_dir/main" checkout --detach f628b2eb6416e660083e5d4a0f7f422145abaaa8
