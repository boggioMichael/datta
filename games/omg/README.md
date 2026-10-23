# OH MY GOD — the engine

A merge game from a crawling baby to the God of Israel. This crate is the whole game: physics, rules,
the 124-tier ladder in 14 eras (`src/tiers.rs`), modes, tools and settings (`src/opts.rs`), progression
and saves, the per-frame draw list (`src/render.rs`), the era backdrops (`src/scenery.rs`) and the sound
engine (`src/audio/`). It has no dependencies and builds to a single `omg.wasm` used by `public/omg/`.

```sh
rustup target add wasm32-unknown-unknown   # once
./build.sh                                 # → public/omg/omg.wasm
python3 tools/bundle_icons.py              # → public/omg/icons/all.json (one request for all 123 pictures)
cargo test --release                       # headless runs: every mode must reach God without jamming
```

The browser shell (`public/omg/host.js`) only paints the draw list, forwards input, builds the menus
from the schema the engine exports, and plays the PCM that a second instance of the engine renders in
`public/omg/audio-worker.js`.

- `src/game.rs` — bodies, the bouncy ring-and-chute physics (480 Hz sub-steps, sweep-and-prune), merges and chain
  reactions, spout upgrades, random events, tools, hit-stop and camera, the ending
- `src/render.rs` — 16-float draw commands + a UTF-8 text buffer + a polygon buffer
- `src/scenery.rs` — a backdrop for every era, built from polygons
- `src/audio/dsp.rs` — filters, oscillators, WSOLA time-stretch, pitch-shift, FDN reverb, FFT vocoder, limiter, loudness
- `src/audio/sfx.rs` — synthesised engines, bells, two-strokes, horns, whistles, rotors, jets, booms, rockets, thunder,
  gong, harp, shofar, choirs, the bounce-melody mallets…
- `src/audio/omg.rs` — the 124 recipes: which clip, how deep, which choir, which effects, how loud
- `src/audio/music.rs` — one loop per era, and the melody the bounces play in the same key
- `tools/voice/` — how the base voice clips were made

Every run starts at the bottom of the ladder. Ball size depends on the tier: one merge makes a ball about
16% bigger, and the spout's own ball grows from a tiny crawl to a big chariot over the journey.
