#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p assets/fonts

# Arizona Flare (Heading)
FLARE_BASE="https://www.auk.com/cdn/shop/t/4/assets"
declare -a FLARE_FILES=(
  "ABCArizonaFlare-Light-Trial.otf?v=82068762838762130351777457813"
  "ABCArizonaFlare-Regular-Trial.otf?v=125881272479546011331777457811"
  "ABCArizonaFlare-Medium-Trial.otf?v=87015972772448655081777457813"
  "ABCArizonaFlare-Bold-Trial.otf?v=26476795982161834421777457813"
  "ABCArizonaFlare-RegularItalic-Trial.otf?v=77998115737233399641777457811"
)
for f in "${FLARE_FILES[@]}"; do
  fn=$(echo "$f" | sed 's/?.*//')
  curl -sL "$FLARE_BASE/$f" -A "Mozilla/5.0" -o "assets/fonts/$fn"
done

# Arizona Sans (Body)
declare -a SANS_FILES=(
  "ABCArizonaSans-Light-Trial.otf?v=47517301982804092581777457811"
  "ABCArizonaSans-Regular-Trial.otf?v=22723046318687368801777457811"
  "ABCArizonaSans-Medium-Trial.otf?v=180137995039352857781777457811"
  "ABCArizonaSans-Bold-Trial.otf?v=125789070606590774191777457811"
)
for f in "${SANS_FILES[@]}"; do
  fn=$(echo "$f" | sed 's/?.*//')
  curl -sL "$FLARE_BASE/$f" -A "Mozilla/5.0" -o "assets/fonts/$fn"
done

ls -la assets/fonts/ | tail -15
