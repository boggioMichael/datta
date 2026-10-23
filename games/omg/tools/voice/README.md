# Voice clips

The 33 base clips in `public/omg/voice/` were generated once, offline, with the open
[Kokoro v1.0](https://huggingface.co/hexgrad/Kokoro-82M) speech model (Apache-2.0), run through
`onnxnp.py` — a small pure-numpy ONNX interpreter written for this, so no native runtime is needed.

```sh
# model: kokoro-multi-lang-v1_0.tar.bz2 from https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
python3 kokoro_np.py path/to/kokoro-multi-lang-v1_0 out/
for f in out/*.wav; do ffmpeg -i "$f" -ac 1 -ar 24000 -c:a libmp3lame -b:a 56k "../../../../public/omg/voice/$(basename "${f%.wav}").mp3"; done
```

Everything the game does with them — deepening, choirs, effects, loudness — happens at run time in the
Rust sound engine (`src/audio/`).
