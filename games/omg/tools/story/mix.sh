#!/bin/bash
# Plans the timeline, mixes both soundtracks with the engine's own mixer and encodes them for the site.
# Needs the phrase recordings in $OMG_NARR_WORK/{en,he} (gen_en.py, gen_he.py) and ffmpeg.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${OMG_NARR_WORK:-$HERE/work}"
export OMG_NARR_WORK="$WORK"
python3 "$HERE/plan.py"                     # → src/story_data.rs and $WORK/plan_{en,he}.txt
cd "$HERE/../.."
for lang in en he; do
  semis=-1.5; [ "$lang" = he ] && semis="${HE_SEMIS:--1.5}"
  OMG_PLAN="$WORK/plan_$lang.txt" OMG_OUT="$WORK/genesis_$lang.wav" OMG_SEMIS=$semis \
    cargo test --release narrate -- --ignored --nocapture | grep genesis
  ffmpeg -loglevel error -y -i "$WORK/genesis_$lang.wav" -ac 2 -ar 32000 -c:a libmp3lame -b:a 72k "../../public/omg/story/genesis_$lang.mp3"
done
ls -la ../../public/omg/story/
