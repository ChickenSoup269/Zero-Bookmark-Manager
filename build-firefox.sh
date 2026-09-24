#!/usr/bin/env bash
# Đóng gói extension cho Firefox (AMO).
# Cách dùng:  bash build-firefox.sh
# Kết quả:    firefox/zero-bookmark-manager-<version>.zip  (upload trực tiếp lên https://addons.mozilla.org/developers/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
STAGE="$ROOT/firefox/build"

# Lấy version từ manifest Chrome (nguồn chuẩn) để đồng bộ với firefox/manifest.json
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT/manifest.json" | head -1)"
FIREFOX_VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT/firefox/manifest.json" | head -1)"
if [ "$VERSION" != "$FIREFOX_VERSION" ]; then
  echo "LỖI: Version lệch giữa manifest.json ($VERSION) và firefox/manifest.json ($FIREFOX_VERSION)."
  echo "Hãy cập nhật firefox/manifest.json lên $VERSION rồi chạy lại."
  exit 1
fi

echo "== Dọn và tạo thư mục stage: $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "== Copy tài nguyên dùng chung"
cp -r _locales components icons images styles "$STAGE/"
cp background.js main.js quick-save.js theme-init.js \
   index.html bookmarks.html quick-save.html "$STAGE/"

echo "== Dùng manifest Firefox"
cp "$ROOT/firefox/manifest.json" "$STAGE/manifest.json"

XPI="$ROOT/firefox/zero-bookmark-manager-$VERSION.xpi"
rm -f "$XPI"

echo "== Đóng gói $XPI"
cd "$STAGE"
if command -v zip >/dev/null 2>&1; then
  zip -qr "$XPI" .
else
  # Git Bash trên Windows thường không có zip -> dùng PowerShell
  POWERSHELL_DEST="$(cygpath -w "${XPI%.xpi}.zip")"
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$(cygpath -w "$STAGE")/*' -DestinationPath '$POWERSHELL_DEST' -Force"
  mv "${XPI%.xpi}.zip" "$XPI"
fi

echo "== Dọn stage"
rm -rf "$STAGE"

echo "Xong! File sẵn sàng upload lên AMO: $XPI"
