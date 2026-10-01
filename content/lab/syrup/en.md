## What it does

Syrup gives you the pixel-level building blocks for reading a screen: rectangle segmentation and grouping over pixel predicates; horizontal-bar fill measurement that learns the bar's empty-track colour from the frame instead of assuming it; RGB→HSV and the shared "looks like UI text" predicates; single-pass frame differencing plus a centroid tracker with stable IDs, velocity and occlusion grace; OCR of small on-screen text with automatic crop upscaling (Tesseract, or the Windows OCR engine, which is trained on screen content); a sharpness metric that predicts whether OCR on a region can succeed at all; live window capture on Windows; and a dependency-free 5×7 bitmap font for drawing what a detector saw.

Every detector result carries a confidence score, a reliability grade, and a failure reason when nothing was found. That `Detection<T>` vocabulary is the library's one contract.

```rust
use syrup::geometry::{Rect, find_color_bar, measure_bar_fill};

let image = image::open("screen.png")?.to_rgba8();
let band = Rect { x: 0, y: image.height() * 9 / 10, w: image.width(), h: image.height() / 10 };
if let Some(bar) = find_color_bar(&image, band, (340.0, 30.0), 0.35, 0.30) {
    if let Some(percent) = measure_bar_fill(&image, bar, band, |p| syrup::color::is_color_pixel(p, (340.0, 30.0), 0.35, 0.30)) {
        println!("bar at {bar:?} is {percent:.1}% full");
    }
}
```

## What it deliberately does not do

No input synthesis, no window manipulation, no process inspection — the library reads pixels and reports observations, nothing else. No trained models and no model files: every primitive is deterministic and explainable, which keeps results reproducible in tests. No opinion about what an observation *means*; semantics belong to the application built on top.

## Where it sits

[[projects/maplesyrup]] is the first domain edition — the place these primitives were developed against real captures before being generalised. Syrup itself knows nothing about MapleStory or any other application; a second edition for a different program would consume it exactly the same way. [[projects/syrup-universal]] is that second edition, for every game at once.

## Limitations

The primitives are tuned for rendered UI content — flat colours, pixel fonts, hard edges — not photographs. Tesseract must be installed separately for OCR; without it, OCR reports itself unavailable rather than failing. Live capture is Windows-only; other platforms consume file-based frames.
