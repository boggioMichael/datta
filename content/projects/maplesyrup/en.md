## What it does

MapleSyrup watches a MapleStory window the way a person does: through the pixels on the screen. It finds the HUD, reads the numbers the game prints, tracks what moves, notices dialogs and panels, infers whether a fight is happening, and keeps all of that stable from frame to frame. The output is a `GameState` — a plain, serializable structure that an overlay or an AI can consume.

It is non-invasive by design. No game-memory reads, no code injection, no input automation. That boundary is what makes a companion safe to run next to any game, and it is enforced in the architecture, not promised in a README.

## How it works

<Diagram src="/diagrams/maplesyrup-pipeline.svg" caption="Capture → perception → WorldState → GameState → consumer. Every detector returns a Detection<T>: value, confidence, reliability grade, failure reason." alt="Vertical pipeline from the game window through capture, a perception pipeline of six detector families with temporal state, into WorldState and GameState JSON, and finally overlay widgets or an AI consumer." wide/>

The one contract everything shares is `Detection<T>`. A detector never returns a bare "not found": it says *why* not ("no OCR engine", "no text", "text too blurred to read" are different situations), and it never returns a value without saying how sure it is. Downstream code can tell "HP is 50%" from "found a red bar, might be HP" from "nothing found, and here is why".

## Reading numbers, not estimating them

Values the game prints as text are read as text. A bar's fill is only ever a corroborating estimate and is never presented as the value. When recognition fails, the engine reports `unknown` or `INVALID` with the raw text attached, rather than substituting a number derived from bar width.

Recognition quality depends on the capture. Native pixel-font text has single-pixel glyph edges; rescaling a screenshot or compressing a video averages them into ramps, and no recogniser can recover the digits. The engine measures this per region and marks an unreliable read instead of presenting it as fact.

## What was measured — and what was wrong

In August 2026 the project ran a hundred frames through the pipeline and wrote down what it found. The honest result: the "real-time at 60 FPS" claim in the early docs was wrong. Median throughput was 11.6 FPS, and the reason was Tesseract OCR on HUD regions — 300–500 ms on the frames where it ran, against 5–13 ms for everything else. That finding became `EVIDENCE.md`, where every technical sentence in the repository is tagged **measured**, **verified**, **designed** or **planned**.

By the end of September the picture had changed. A workflow on a GitHub Windows runner processes the first three minutes of a real recording — 2,700 frames — and publishes the annotated frames, the timings and the logs. Mean perception time: 43.2 ms per frame (median 35.6, p95 44.7). OCR ran on 3.7% of frames and took 0.14–0.73 s on those. All 128 tests passed on the same runner. Because the recording is a compressed screen capture, the HUD text is flagged unreliable rather than read — which is the correct answer.

## The debugger

`vision_debug` is the tool for seeing what the engine believes it is looking at. It opens a terminal dashboard and a graphical preview rendered from the same per-frame result, so the two can never disagree. Every region read as text is marked with corner brackets, labelled with its field, and captioned with the raw recognised text and the parsed value. `--explain` prints the region, the raw text, the parse, the confidence and the capture legibility for every field.

## What it deliberately does not do

- It does not read process memory, hook the renderer, touch network traffic or send input.
- It does not use trained models for the primitives: every detector is deterministic and explainable, which keeps results reproducible in tests.
- It does not claim a frame rate it has not measured.

## Where it goes next

The generic parts — geometry, colour, motion, OCR, quality, capture — were extracted into [[lab/syrup]], a standalone Rust crate that knows nothing about MapleStory. The next project, [[projects/syrup-universal]], turns the question around: instead of a companion for one game, a companion that learns whatever game its player is playing. MapleSyrup becomes that project's first plugin.

<Repo url="https://github.com/boggioMichael/ms" note="Rust · MIT · CI on Windows · 128 tests"/>
