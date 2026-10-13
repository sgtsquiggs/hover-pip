#!/bin/sh
# Generates the e2e fixture videos (gitignored). Requires ffmpeg.
set -eu
cd "$(dirname "$0")"
mkdir -p media
encode() {
  ffmpeg -loglevel error -y -f lavfi -i testsrc=size=640x360:rate=30 -f lavfi -i sine=frequency=440 \
    -t "$1" -c:v libvpx-vp9 -b:v 200k -deadline realtime -cpu-used 8 -c:a libopus "media/$2"
}
[ -f media/long.webm ] || encode 60 long.webm
[ -f media/short.webm ] || encode 10 short.webm
