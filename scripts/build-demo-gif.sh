#!/usr/bin/env bash
set -euo pipefail

FRAMES_DIR="tests/e2e/demo-results/frames"
OUTPUT="docs/demo.gif"

if [ ! -d "$FRAMES_DIR" ]; then
  echo "No frames found at $FRAMES_DIR — run 'bun run demo' first."
  exit 1
fi

FRAME_COUNT=$(ls "$FRAMES_DIR"/frame-*.png 2>/dev/null | wc -l | tr -d ' ')
if [ "$FRAME_COUNT" -eq 0 ]; then
  echo "No frame-*.png files in $FRAMES_DIR — run 'bun run demo' first."
  exit 1
fi

# Captions are baked into the PNGs by tests/e2e/demo.ts (in-browser overlay);
# this script only assembles the frames.
echo "Building GIF from $FRAME_COUNT frames..."

ffmpeg -y -framerate 0.67 -i "$FRAMES_DIR/frame-%02d.png" \
  -vf "fps=15,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 \
  "$OUTPUT" 2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
