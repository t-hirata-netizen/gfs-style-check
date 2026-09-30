#!/bin/sh
# og/src/*.html から、共有用の画像 og/*.png（1200×630）を作る。Mac の Google Chrome を使う
# 使い方: sh tools/make-og.sh   （文言やデザインを変えたら実行して、PNG もコミットする）
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for name in default tech fund; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1200,630 --virtual-time-budget=8000 \
    --screenshot="$PWD/og/$name.png" "file://$PWD/og/src/$name.html" 2>/dev/null
  echo "og/$name.png"
done
