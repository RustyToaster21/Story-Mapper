#!/usr/bin/env bash
# Regenerates the Android and iOS app icons and splash screens from the
# Story Mapper favicon design. Needs ImageMagick (magick) and rsvg-convert.
# Run from mobile/: bash scripts/icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."
RES=android/app/src/main/res
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

BLUE='#3b5bdb'
BG='#f6f5f1' # --bg in public/css/app.css
GLYPH='<g fill="#fff" stroke="#fff"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="9" r="2.2"/><circle cx="8" cy="18" r="2.2"/><path d="M8 6.6 16 8.4M6.6 8.2l1 7.6M16.6 10.8 9.8 16.6" fill="none" stroke-width="1.5"/></g>'

# Legacy square and round icons (the full favicon look).
echo "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='5' fill='$BLUE'/>$GLYPH</svg>" > "$TMP/square.svg"
echo "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='$BLUE'/>$GLYPH</svg>" > "$TMP/round.svg"
# Adaptive foreground: glyph only, inside the central 66/108 safe zone.
echo "<svg xmlns='http://www.w3.org/2000/svg' viewBox='-9 -9 42 42'>$GLYPH</svg>" > "$TMP/foreground.svg"

for d in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  IFS=: read -r density icon fg <<< "$d"
  rsvg-convert -w "$icon" -h "$icon" "$TMP/square.svg" -o "$RES/mipmap-$density/ic_launcher.png"
  rsvg-convert -w "$icon" -h "$icon" "$TMP/round.svg" -o "$RES/mipmap-$density/ic_launcher_round.png"
  rsvg-convert -w "$fg" -h "$fg" "$TMP/foreground.svg" -o "$RES/mipmap-$density/ic_launcher_foreground.png"
done

cat > "$RES/values/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$BLUE</color>
</resources>
EOF

# Splash screens: app background with the icon centred, same sizes as the template's.
rsvg-convert -w 512 -h 512 "$TMP/square.svg" -o "$TMP/icon512.png"
find "$RES" -name splash.png | while read -r f; do
  size=$(magick identify -format '%wx%h' "$f")
  w=${size%x*}; h=${size#*x}
  s=$(( (w < h ? w : h) / 4 ))
  magick -size "${w}x${h}" "xc:$BG" \( "$TMP/icon512.png" -resize "${s}x${s}" \) -gravity center -composite "$f"
done

# iOS: one 1024 px app icon (full-bleed square; iOS rounds the corners itself, and
# App Store Connect rejects icons with an alpha channel) plus the launch-screen images.
IOS=ios/App/App/Assets.xcassets
if [ -d "$IOS" ]; then
  echo "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='$BLUE'/>$GLYPH</svg>" > "$TMP/ios-icon.svg"
  rsvg-convert -w 1024 -h 1024 "$TMP/ios-icon.svg" -o "$TMP/ios-icon.png"
  magick "$TMP/ios-icon.png" -background "$BLUE" -alpha remove -alpha off "PNG24:$IOS/AppIcon.appiconset/AppIcon-512@2x.png"
  for f in "$IOS"/Splash.imageset/splash-*.png; do
    size=$(magick identify -format '%wx%h' "$f")
    w=${size%x*}; h=${size#*x}
    s=$(( (w < h ? w : h) / 4 ))
    magick -size "${w}x${h}" "xc:$BG" \( "$TMP/icon512.png" -resize "${s}x${s}" \) -gravity center -composite -alpha off "$f"
  done
fi
echo "Icons and splash screens regenerated."
