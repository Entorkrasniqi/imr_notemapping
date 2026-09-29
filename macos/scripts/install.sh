#!/bin/sh
# Builds ScriptumOS (universal Release), installs it to Applications, and
# puts a shortcut on the Desktop. Run it again after changing the code to
# update the installed app:
#
#   sh macos/scripts/install.sh
set -e
cd "$(dirname "$0")/.."

# xcode-select may point at the Command Line Tools, which can't build apps.
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

if pgrep -x ScriptumOS >/dev/null; then
  echo "ScriptumOS is running — quit it first (⌘Q), then run this again."
  exit 1
fi

echo "Building ScriptumOS…"
xcodebuild -project NoteMap.xcodeproj -scheme NoteMap -configuration Release \
  -destination 'generic/platform=macOS' -derivedDataPath build -quiet build
APP="build/Build/Products/Release/ScriptumOS.app"

DEST_DIR="/Applications"
[ -w "$DEST_DIR" ] || { DEST_DIR="$HOME/Applications"; mkdir -p "$DEST_DIR"; }
rm -rf "$DEST_DIR/ScriptumOS.app"
ditto "$APP" "$DEST_DIR/ScriptumOS.app"
# A real copy on the Desktop rather than a link: Finder badges links with
# an arrow, and shows ".app" on them, but not on an actual app.
rm -f "$HOME/Desktop/ScriptumOS"
rm -rf "$HOME/Desktop/ScriptumOS.app"
ditto "$APP" "$HOME/Desktop/ScriptumOS.app"

echo "Installed $DEST_DIR/ScriptumOS.app — double-click ScriptumOS on your Desktop to open it."
