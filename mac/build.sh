#!/bin/zsh
# Builds "FlitzWeb Studio.app" (the Studio in its own Mac window) into mac/build/. No Xcode project:
# swiftc + a hand-made bundle. `./build.sh install` also copies it to /Applications and opens it.
set -euo pipefail
cd "${0:A:h}"

NAME="FlitzWeb Studio"
APP="build/$NAME.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# App icon: AppIcon.png (1024 px, already in the macOS rounded-square shape with its own margin).
# It is drawn from icon.svg by ./make-icon.sh.
ICONSET=build/Studio.iconset
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z $size $size AppIcon.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) AppIcon.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Studio.icns"
rm -rf "$ICONSET"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>nl.flitzweb.studio.mac</string>
  <key>CFBundleName</key><string>FlitzWeb Studio</string>
  <key>CFBundleDisplayName</key><string>FlitzWeb Studio</string>
  <key>CFBundleExecutable</key><string>Studio</string>
  <key>CFBundleIconFile</key><string>Studio</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleDevelopmentRegion</key><string>nl</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.business</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

swiftc -O -target "$(uname -m)-apple-macos13.0" -o "$APP/Contents/MacOS/Studio" Sources/*.swift
codesign --force --sign - "$APP" >/dev/null
echo "Built $APP"

if [[ "${1:-}" == "install" ]]; then
  osascript -e 'tell application id "nl.flitzweb.studio.mac" to quit' 2>/dev/null || true
  for _ in {1..50}; do pgrep -xq Studio || break; sleep 0.1; done     # opening it before it has quit fails
  rm -rf "/Applications/$NAME.app"
  cp -R "$APP" /Applications/
  touch "/Applications/$NAME.app"     # so Finder and the Dock pick up a new icon
  open "/Applications/$NAME.app"
  echo "Installed /Applications/$NAME.app"
fi
