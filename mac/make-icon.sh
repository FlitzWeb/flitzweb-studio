#!/bin/zsh
# Draws AppIcon.png (1024 px) from icon.svg. Needs resvg (`brew install resvg`).
# Run it after changing icon.svg, then `./build.sh install`.
set -euo pipefail
cd "${0:A:h}"
resvg --width 1024 --height 1024 icon.svg AppIcon.png
echo "Made AppIcon.png"
