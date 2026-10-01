## Abstract

[[projects/maplesyrup]] reads a running game through captured pixels and produces structured state. Its early documentation described it as real-time at 60 FPS with under 20 ms of latency. In August 2026 the pipeline was measured on a hundred frames of a real screenshot; the median throughput was 11.6 FPS. This note records what was measured, why the claim was wrong, how the repository's documentation was restructured in response, and what a later measurement on 2,700 frames of real gameplay showed.

## Question

What does the pipeline actually cost per frame, which stage dominates, and is the "real-time" claim supported?

## Method

- A `measure_evidence` binary runs the full perception pipeline on a fixed 1366×767 frame a hundred times and records per-frame latency, with min, max, mean, median and p90/p95/p99 preserved in CSV and JSON.
- Detector outputs for a reference frame are serialized to JSON and kept with the measurements.
- A later workflow runs the pipeline over the first three minutes of a real gameplay recording on a GitHub-hosted Windows runner, saving every annotated frame and a `timings.csv`.

## Results — August 2026 (100 frames, static fixture)

| Claim in the documentation | Measured | Evidence class |
| --- | --- | --- |
| "Real-time at 60 FPS" | 11.6 FPS median | designed, but broken |
| "< 20 ms latency" | 86–136 ms typical, up to ~500 ms | designed, but broken |
| "Production-ready" | requires asynchronous OCR | designed, but broken |

The cause was a single stage. Frames with no OCR took 76–86 ms, with geometry-only detection accounting for 5–13 ms of that. Frames where Tesseract OCR ran on HUD regions took 300–500 ms, of which OCR was 300–500 ms and everything else 10–40 ms. A sevenfold variation between frames, attributable to one subprocess, is as clear as a profile gets.

## Results — September 2026 (2,700 frames, real recording)

After restructuring — running OCR on a cadence (every sixty frames by default) and serving cached text in between while the cheap bar geometry stays per-frame, measuring the legibility of each region before trusting a read, and adding the operating system's OCR engine as an alternative to Tesseract — the workflow processed 2,700 frames of a real recording with a mean perception time of 43.2 ms per frame (median 35.6 ms, p95 44.7 ms). OCR ran on 101 frames (3.7%), taking 0.14–0.73 s on those. All 128 tests passed on the same runner. Because the recording is a compressed screen capture, the HUD text was flagged unreliable rather than read.

## What changed in the repository

Every technical sentence in the project is now tagged with one of five classes — **measured**, **verified**, **designed**, **planned**, or **designed but broken** — and `EVIDENCE.md` is the authoritative list. A sentence that is not tagged does not get to make a claim. The debugger was built so that a person can see what the engine believes, region by region, and ask `--explain` where a value came from.

## Counterarguments

- *A static fixture is not gameplay.* True; that is why the second measurement uses a recording. A recording is still not a live window — compression destroys pixel-font edges — which the engine now measures per region and reports.
- *43 ms is not 16 ms.* Also true. The honest statement is "about 23 frames per second on this hardware with this recording", not "real-time". Whether that is enough depends on the consumer; an advisor that speaks in sentences needs far less than a reflex overlay.

## Open questions

- Where is the floor for OCR on native-resolution captures once the region-change gate is in place?
- How does per-frame cost scale with resolution and UI scale, and can the proportional-search regions stay stable across both?
- Which parts of the budget move to Syrup Universal unchanged, and which were MapleStory-specific optimisations?
