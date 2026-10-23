# OH MY GOD — the engine

A merge game from a Kia Picanto to the God of Israel. This crate is the whole game: physics, rules,
the 37-tier ladder (`src/tiers.rs`), modes, tools and settings (`src/opts.rs`), progression and saves,
the per-frame draw list (`src/render.rs`) and the sound engine (`src/audio/`). It has no dependencies
and builds to a single `omg.wasm` (≈300 KB) used by `public/omg/`.

```sh
rustup target add wasm32-unknown-unknown   # once
./build.sh                                 # → public/omg/omg.wasm
cargo test --release                       # headless runs: every mode must reach God without jamming
```

The browser shell (`public/omg/host.js`) only paints the draw list, forwards input, builds the menus
from the schema the engine exports, and plays the PCM that a second instance of the engine renders in
`public/omg/audio-worker.js`.

- `src/game.rs` — bodies, the ring-and-chute physics (480 Hz sub-steps), merges, spout upgrades, tools, the ending
- `src/render.rs` — 16-float draw commands + a UTF-8 text buffer
- `src/audio/dsp.rs` — filters, oscillators, WSOLA time-stretch, pitch-shift, FDN reverb, FFT vocoder, limiter, loudness
- `src/audio/sfx.rs` — synthesised engines, jets, booms, rockets, thunder, gong, harp, shofar, choirs…
- `src/audio/omg.rs` — the 37 recipes: which clip, how deep, which choir, which effects, how loud
- `src/audio/music.rs` — one loop per stage
- `tools/voice/` — how the base voice clips were made
