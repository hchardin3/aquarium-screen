#!/usr/bin/env bash
# Start the aquarium wallpaper at GNOME login. Run `npm run build` first.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/aquarium-screen.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Aquarium Screen
Exec=$repo/node_modules/.bin/electron $repo
X-GNOME-Autostart-enabled=true
NoDisplay=true
DESKTOP
echo "Installed ~/.config/autostart/aquarium-screen.desktop"
