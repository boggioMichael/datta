//! The living world around the bubble.
//!
//! Every era has its own place — a warm dawn, a meadow, a town at golden hour,
//! highways, cities, a desert, mountains, the open sea, the deep, the clouds,
//! orbit, a nebula, a galaxy, the realm of the gods and the heavens — painted in
//! soft layers that fade into the haze with distance. Three things make it feel
//! alive and huge:
//!
//! * the landscape pulls back with the camera: the further the pile has grown
//!   in an era, the smaller its hills and towers get (near layers faster);
//! * motes drift in the medium (dust, seeds, city lights, bubbles, stars) and
//!   stream inward whenever the camera zooms out;
//! * out of focus in the deep float the giants the pile is about to become:
//!   blurred silhouettes of the next tiers, at their true size.

use alloc::vec::Vec;

use crate::game::Game;
use crate::m::*;
use crate::render::*;
use crate::tiers::*;

pub const OP_MEMBRANE: f32 = 22.0;
pub const OP_GHOST: f32 = 23.0;
pub const OP_BOKEH: f32 = 24.0;
pub const OP_SHADOW: f32 = 25.0;
pub const OP_BLOB: f32 = 26.0;
pub const OP_VIGNETTE: f32 = 27.0;

// mote kinds
const M_STARS: u8 = 0;
const M_BOKEH: u8 = 1;
const M_DUST: u8 = 2;
const M_BUBBLES: u8 = 3;
const M_SEEDS: u8 = 4;
const M_SNOW: u8 = 5;
const M_SPARK: u8 = 6;

/// The colours of an era: sky (top, bottom), the haze far things fade into, the
/// key light, the tint of the bubble's fluid, whether it is a dark (night or
/// space) world, and what drifts in it.
pub struct Look { pub top: u32, pub bot: u32, pub haze: u32, pub light: u32, pub fluid: u32, pub dark: bool, pub motes: u8, pub mc: [u32; 2], pub density: f32 }

pub static LOOKS: [Look; N_CATS] = [
    // on foot: the first dawn, warm and soft
    Look { top: 0x2B1633, bot: 0xE9A38C, haze: 0xD98F92, light: 0xFFD9C2, fluid: 0xFFB0A8, dark: false, motes: M_DUST, mc: [0xFFE6CC, 0xFFC2B4], density: 0.5 },
    // riding animals: a spring meadow
    Look { top: 0x5FA6E0, bot: 0xF4E8BC, haze: 0xC2DBEA, light: 0xFFF4CC, fluid: 0xCDEBA6, dark: false, motes: M_SEEDS, mc: [0xFFFFFF, 0xF6F2DA], density: 0.4 },
    // small motors: a little town at golden hour
    Look { top: 0x3A4A8C, bot: 0xFFB070, haze: 0xEFA67C, light: 0xFFDAA0, fluid: 0xFFC890, dark: false, motes: M_DUST, mc: [0xFFE2AA, 0xFFC878], density: 0.45 },
    // cars: a highway at dusk
    Look { top: 0x1E1B4B, bot: 0xF2786A, haze: 0xB46E8E, light: 0xFFC6A6, fluid: 0xB6A8FF, dark: false, motes: M_BOKEH, mc: [0xFFB466, 0xFF6E6E], density: 0.22 },
    // premium: the city at night
    Look { top: 0x040A1E, bot: 0x1C3C6E, haze: 0x2C4C84, light: 0xBFE0FF, fluid: 0x70B2FF, dark: true, motes: M_BOKEH, mc: [0xFFE2A2, 0x9FD2FF], density: 0.3 },
    // supercars: a sunset coast
    Look { top: 0x2A0F3A, bot: 0xFF7C3C, haze: 0xE2643C, light: 0xFFC284, fluid: 0xFF9066, dark: false, motes: M_BOKEH, mc: [0xFFB452, 0xFF5A52], density: 0.18 },
    // hypercars: a neon night
    Look { top: 0x090420, bot: 0x3A0F5A, haze: 0x5A2A8A, light: 0xE4A6FF, fluid: 0xB474FF, dark: true, motes: M_BOKEH, mc: [0xFF4FD8, 0x22E6FF], density: 0.3 },
    // heavy duty: an industrial dusk
    Look { top: 0x2A2018, bot: 0xE2A244, haze: 0xB4884A, light: 0xFFD474, fluid: 0xFFC446, dark: false, motes: M_DUST, mc: [0xFFD488, 0xC8A878], density: 0.5 },
    // monsters & records: the desert
    Look { top: 0x5A2A12, bot: 0xFFB454, haze: 0xE49454, light: 0xFFE2A4, fluid: 0xFFB866, dark: false, motes: M_DUST, mc: [0xF2C488, 0xE2A464], density: 0.55 },
    // rails: misty mountains
    Look { top: 0x34568A, bot: 0xD8E4F0, haze: 0xA8BED8, light: 0xFFF2DC, fluid: 0xC8DCF0, dark: false, motes: M_SNOW, mc: [0xFFFFFF, 0xE8F0FF], density: 0.45 },
    // under sail: the open sea at dawn
    Look { top: 0x4A6AA0, bot: 0xF8C8B0, haze: 0xCDB9C9, light: 0xFFEAD2, fluid: 0xA2DAEA, dark: false, motes: M_DUST, mc: [0xFFFFFF, 0xFFE4D4], density: 0.3 },
    // seas: the deep
    Look { top: 0x1C8CB4, bot: 0x021A33, haze: 0x0E4C72, light: 0xA2F2FF, fluid: 0x44C4E4, dark: true, motes: M_BUBBLES, mc: [0xCCF8FF, 0xA2EAFF], density: 0.45 },
    // skies: above the clouds
    Look { top: 0x2466CC, bot: 0xCFE8FF, haze: 0xBAD8F8, light: 0xFFFFFF, fluid: 0xDAEEFF, dark: false, motes: M_DUST, mc: [0xFFFFFF, 0xE4F2FF], density: 0.25 },
    // space: in orbit
    Look { top: 0x000005, bot: 0x0A1030, haze: 0x223266, light: 0xD2E2FF, fluid: 0x8494FF, dark: true, motes: M_STARS, mc: [0xFFFFFF, 0xBFD8FF], density: 1.0 },
    // science fiction: a nebula
    Look { top: 0x0A0018, bot: 0x2A0638, haze: 0x5C1C6C, light: 0xFFA2F2, fluid: 0xD474FF, dark: true, motes: M_STARS, mc: [0xFFD2F8, 0xA2F2FF], density: 1.0 },
    // megastructures: the galaxy
    Look { top: 0x00020A, bot: 0x081838, haze: 0x1A3264, light: 0xA6EAFF, fluid: 0x64CAFF, dark: true, motes: M_STARS, mc: [0xFFFFFF, 0xA6EAFF], density: 1.0 },
    // the rides of the gods: a twilight realm
    Look { top: 0x0A0620, bot: 0x5C2C12, haze: 0x8C5C34, light: 0xFFDA94, fluid: 0xFFC464, dark: true, motes: M_SPARK, mc: [0xFFE2A2, 0xFFCA64], density: 0.5 },
    // wonders: a holy dawn in the desert
    Look { top: 0x5A3A6A, bot: 0xFFD8A2, haze: 0xEABA92, light: 0xFFF2D2, fluid: 0xFFE2B2, dark: false, motes: M_SPARK, mc: [0xFFF2C8, 0xFFDA94], density: 0.4 },
    // the heavens
    Look { top: 0x9EC2F6, bot: 0xFFF4E2, haze: 0xF2EAF2, light: 0xFFFFFF, fluid: 0xFFF2D4, dark: false, motes: M_SPARK, mc: [0xFFFFFF, 0xFFF2C4], density: 0.5 },
    // God: every other light goes out
    Look { top: 0x020104, bot: 0x0E0A06, haze: 0x2A2216, light: 0xFFF4D8, fluid: 0xFFE6B0, dark: true, motes: M_SPARK, mc: [0xFFF4D8, 0xFFE2A0], density: 0.6 },
];

pub type Rgb = (f32, f32, f32);
/// The look of the moment, cross-faded between the previous era and this one.
#[derive(Clone, Copy)]
pub struct L { pub top: Rgb, pub bot: Rgb, pub haze: Rgb, pub light: Rgb, pub fluid: Rgb, pub dark: f32 }
pub fn look(g: &Game) -> L {
    let t = smooth(g.cat_mix);
    let a = &LOOKS[g.prev_cat as usize]; let b = &LOOKS[g.cat as usize];
    let m = |x: u32, y: u32| mix_rgb(rgb(x), rgb(y), t);
    L { top: m(a.top, b.top), bot: m(a.bot, b.bot), haze: m(a.haze, b.haze), light: m(a.light, b.light), fluid: m(a.fluid, b.fluid), dark: lerp(a.dark as u8 as f32, b.dark as u8 as f32, t) }
}

#[inline] fn h1(a: u32) -> f32 { let mut x = a.wrapping_mul(0x9E37_79B9) ^ 0x7F4A_7C15; x ^= x >> 16; x = x.wrapping_mul(0x85EB_CA6B); x ^= x >> 13; (x & 0xFFFF) as f32 / 65535.0 }
#[inline] fn hi(i: i32, k: u32) -> f32 { h1((i as u32).wrapping_mul(2_654_435_761) ^ k.wrapping_mul(0x27D4_EB2F)) }
#[inline] fn c(col: u32, a: f32) -> C4 { c4(col, a) }
#[inline] fn cm(col: Rgb, a: f32) -> C4 { (col.0, col.1, col.2, a) }
/// A colour pushed into the haze by `d` (0 near, 1 lost in the haze).
#[inline] fn fog(col: u32, haze: Rgb, d: f32) -> Rgb { mix_rgb(rgb(col), haze, d) }

/// Screen geometry for one frame of scenery.
#[derive(Clone, Copy)]
struct View { w: f32, h: f32, u: f32, sx: f32, sy: f32, sw: f32, sh: f32, cx: f32, cy: f32, rp: f32, hz: f32, t: f32 }
impl View {
    /// pattern x → screen x for a layer scaled by `s` around the anchor
    #[inline] fn x(&self, x: f32, s: f32) -> f32 { self.cx + (x - self.cx) * s }
    #[inline] fn y(&self, y: f32, s: f32) -> f32 { self.hz + (y - self.hz) * s }
    /// the pattern range visible on screen for scale `s`
    #[inline] fn span(&self, s: f32) -> (f32, f32) { (self.cx - self.cx / s, self.cx + (self.w - self.cx) / s) }
}
/// How much a layer has shrunk: `k` tiers into the era, `speed` per tier (near layers faster).
#[inline] fn zs(k: f32, speed: f32) -> f32 { pow(2.0, -k * speed) }

// ───────────────────────────────────────────── layers

fn ridge_y(x: f32, y0: f32, waves: &[(f32, f32, f32)], u: f32) -> f32 {
    let mut y = y0;
    for &(f, p, am) in waves { y += am * sin(f * x / u * 0.01 + p); }
    y
}
/// A filled ridge across the screen (hills, dunes, the near ground).
fn ridge(g: &mut Game, v: &View, y0: f32, waves: &[(f32, f32, f32)], col: C4, s: f32) {
    if col.3 <= 0.004 { return; }
    let n = 56;
    let mut pts = Vec::with_capacity(n * 2 + 8);
    pts.push(-2.0); pts.push(v.h + 2.0);
    for i in 0..=n {
        let xs = v.w * i as f32 / n as f32;
        let x = v.cx + (xs - v.cx) / s;
        pts.push(xs); pts.push(v.y(ridge_y(x, y0, waves, v.u), s));
    }
    pts.push(v.w + 2.0); pts.push(v.h + 2.0);
    path(g, &pts, col, NONE, 0.0, true, false);
}
/// Mountains: peaks every `step`, optional snow.
fn peaks(g: &mut Game, v: &View, base: f32, step: f32, hmax: f32, seed: u32, col: C4, s: f32, snow: f32) {
    if col.3 <= 0.004 { return; }
    let (x0, x1) = v.span(s);
    let i0 = floor(x0 / step) as i32 - 1; let i1 = ceil(x1 / step) as i32 + 1;
    let mut pts = Vec::with_capacity(((i1 - i0) as usize + 2) * 4 + 8);
    pts.push(-2.0); pts.push(v.h + 2.0);
    let mut tops = Vec::new();
    for i in i0..=i1 {
        let px = (i as f32 + 0.3 + 0.4 * hi(i, seed)) * step;
        let ph = hmax * (0.45 + 0.55 * hi(i, seed + 1));
        let vx = (i as f32 + 1.0) * step;
        let vh = ph * 0.22 * hi(i, seed + 2);
        pts.push(v.x(px, s)); pts.push(v.y(base - ph, s));
        pts.push(v.x(vx, s)); pts.push(v.y(base - vh, s));
        tops.push((px, ph));
    }
    pts.push(v.w + 2.0); pts.push(v.h + 2.0);
    path(g, &pts, col, NONE, 0.0, true, false);
    if snow > 0.01 {
        for (px, ph) in tops {
            let k = ph * 0.2;
            let (tx, ty) = (v.x(px, s), v.y(base - ph, s));
            let ks = k * s;
            path(g, &[tx, ty, tx + ks * 0.75, ty + ks, tx + ks * 0.2, ty + ks * 0.82, tx - ks * 0.25, ty + ks * 1.05, tx - ks * 0.7, ty + ks], c(0xFFFFFF, col.3 * snow), NONE, 0.0, true, false);
        }
    }
}
/// A row of buildings from `base` down. `win`: lit window colour and alpha.
fn skyline(g: &mut Game, v: &View, base: f32, bw: f32, hmin: f32, hmax: f32, seed: u32, col: C4, s: f32, win: (u32, f32)) {
    if col.3 <= 0.004 { return; }
    let (x0, x1) = v.span(s);
    let i0 = floor(x0 / bw) as i32 - 1; let i1 = ceil(x1 / bw) as i32 + 1;
    for i in i0..=i1 {
        let r = hi(i, seed);
        let hh = hmin + (hmax - hmin) * r * r;
        let ww = bw * (0.62 + 0.36 * hi(i, seed + 1));
        let x = i as f32 * bw + (bw - ww) * hi(i, seed + 2);
        let (xa, ya) = (v.x(x, s), v.y(base - hh, s));
        let xb = v.x(x + ww, s);
        rect(g, xa, ya, xb - xa, v.h - ya + 2.0, col, 0.0, false);
        // a little crown on some towers
        if hi(i, seed + 3) > 0.7 && hh > hmin * 1.5 {
            let cw = (xb - xa) * 0.3;
            rect(g, xa + (xb - xa - cw) * 0.5, ya - 10.0 * v.u * s, cw, 10.0 * v.u * s + 1.0, col, 0.0, false);
        }
        if win.1 > 0.0 && (xb - xa) > 6.0 {
            let rows = ((hh * s) / (9.0 * v.u * s.max(0.5))) as i32;
            let cols = (((xb - xa) / (7.0 * v.u * s.max(0.5))) as i32).clamp(1, 5);
            for rr in 1..rows.min(16) {
                for cc in 0..cols {
                    if hi(i * 131 + rr * 17 + cc, seed + 9) > 0.62 {
                        let wx = xa + (xb - xa) * (0.14 + 0.72 * cc as f32 / cols.max(1) as f32);
                        let wy = ya + rr as f32 * 9.0 * v.u * s.max(0.5);
                        if wy > v.y(base, s) - 3.0 { break; }
                        rect(g, wx, wy, 2.4 * v.u * s.max(0.5), 3.2 * v.u * s.max(0.5), c(win.0, win.1 * col.3), 0.0, true);
                    }
                }
            }
        }
    }
}
/// Little houses with pitched roofs.
fn houses(g: &mut Game, v: &View, base: f32, bw: f32, seed: u32, col: C4, s: f32, win: (u32, f32)) {
    if col.3 <= 0.004 { return; }
    let (x0, x1) = v.span(s);
    let i0 = floor(x0 / bw) as i32 - 1; let i1 = ceil(x1 / bw) as i32 + 1;
    for i in i0..=i1 {
        let hh = bw * (0.45 + 0.5 * hi(i, seed));
        let ww = bw * (0.7 + 0.25 * hi(i, seed + 1));
        let x = i as f32 * bw + (bw - ww) * 0.5;
        let roof = ww * (0.35 + 0.2 * hi(i, seed + 2));
        let (xa, xb) = (v.x(x, s), v.x(x + ww, s));
        let (yw, yr) = (v.y(base - hh, s), v.y(base - hh - roof, s));
        rect(g, xa, yw, xb - xa, v.h - yw + 2.0, col, 0.0, false);
        let ov = (xb - xa) * 0.08;
        path(g, &[xa - ov, yw + 1.0, (xa + xb) * 0.5, yr, xb + ov, yw + 1.0], col, NONE, 0.0, true, false);
        if win.1 > 0.0 && hi(i, seed + 5) > 0.35 {
            let s2 = (xb - xa) * 0.18;
            rect(g, xa + (xb - xa) * 0.3, yw + (v.y(base, s) - yw) * 0.3, s2, s2 * 1.2, c(win.0, win.1 * col.3), 0.0, true);
        }
    }
}
/// Round-topped trees along a ridge.
fn trees(g: &mut Game, v: &View, y0: f32, waves: &[(f32, f32, f32)], step: f32, size: f32, seed: u32, col: C4, s: f32) {
    if col.3 <= 0.004 { return; }
    let (x0, x1) = v.span(s);
    let i0 = floor(x0 / step) as i32 - 1; let i1 = ceil(x1 / step) as i32 + 1;
    for i in i0..=i1 {
        if hi(i, seed) < 0.3 { continue; }
        let x = (i as f32 + hi(i, seed + 1)) * step;
        let y = ridge_y(x, y0, waves, v.u);
        let r = size * (0.6 + 0.6 * hi(i, seed + 2));
        let (sx, sy) = (v.x(x, s), v.y(y, s));
        let rs = r * s;
        rect(g, sx - rs * 0.12, sy - rs * 0.9, rs * 0.24, rs * 1.0, col, 0.0, false);
        circle(g, sx, sy - rs * 1.25, rs, col, NONE, 0.0, false);
        circle(g, sx - rs * 0.55, sy - rs * 0.9, rs * 0.66, col, NONE, 0.0, false);
        circle(g, sx + rs * 0.55, sy - rs * 0.95, rs * 0.7, col, NONE, 0.0, false);
    }
}
/// Pointed pines along a ridge.
fn pines(g: &mut Game, v: &View, y0: f32, waves: &[(f32, f32, f32)], step: f32, size: f32, seed: u32, col: C4, s: f32) {
    if col.3 <= 0.004 { return; }
    let (x0, x1) = v.span(s);
    let i0 = floor(x0 / step) as i32 - 1; let i1 = ceil(x1 / step) as i32 + 1;
    for i in i0..=i1 {
        let x = (i as f32 + hi(i, seed)) * step;
        let y = ridge_y(x, y0, waves, v.u) + 4.0 * v.u;
        let hgt = size * (0.6 + 0.7 * hi(i, seed + 1));
        let (sx, sy) = (v.x(x, s), v.y(y, s));
        let hs = hgt * s; let ws = hs * 0.32;
        path(g, &[sx - ws, sy, sx, sy - hs, sx + ws, sy], col, NONE, 0.0, true, false);
    }
}
/// A bank of cloud tops along `base`, solid below it.
fn cloudbank(g: &mut Game, v: &View, base: f32, size: f32, seed: u32, col: C4, s: f32, drift: f32) {
    if col.3 <= 0.004 { return; }
    let step = size * 1.05;
    let (x0, x1) = v.span(s);
    let i0 = floor((x0 - drift) / step) as i32 - 1; let i1 = ceil((x1 - drift) / step) as i32 + 1;
    for i in i0..=i1 {
        let x = i as f32 * step + drift;
        let r = size * (0.55 + 0.55 * hi(i, seed));
        let y = base - size * 0.25 * hi(i, seed + 1);
        circle(g, v.x(x, s), v.y(y, s), r * s, col, NONE, 0.0, false);
    }
    let yb = v.y(base, s);
    rect(g, 0.0, yb, v.w, v.h - yb + 2.0, col, 0.0, false);
}
fn sun(g: &mut Game, x: f32, y: f32, r: f32, col: u32, a: f32, glow: f32) {
    let (cr, cg, cb) = rgb(col);
    cmd(g, OP_GLOW, &[x, y, r * 6.0, cr, cg, cb, 0.32 * a * glow]);
    cmd(g, OP_GLOW, &[x, y, r * 2.2, 1.0, 1.0, 1.0, 0.25 * a * glow]);
    circle(g, x, y, r, c(col, 0.95 * a), NONE, 0.0, false);
    circle(g, x - r * 0.1, y - r * 0.1, r * 0.72, (1.0, 1.0, 0.96, 0.45 * a), NONE, 0.0, false);
}
fn moon(g: &mut Game, x: f32, y: f32, r: f32, a: f32, sky: Rgb) {
    cmd(g, OP_GLOW, &[x, y, r * 3.4, 0.8, 0.88, 1.0, 0.2 * a]);
    circle(g, x, y, r, (0.95, 0.96, 1.0, 0.92 * a), NONE, 0.0, false);
    circle(g, x + r * 0.38, y - r * 0.2, r * 0.84, (sky.0, sky.1, sky.2, 0.9 * a), NONE, 0.0, false);
}
fn palm(g: &mut Game, x: f32, base: f32, hgt: f32, lean: f32, col: C4, t: f32, u: f32) {
    let tx = x + lean; let ty = base - hgt;
    path(g, &[x - 3.0 * u, base, tx - 2.0 * u, ty, tx + 2.0 * u, ty, x + 3.0 * u, base], col, NONE, 0.0, true, false);
    for k in 0..7 {
        let ang = -PI * 0.5 + (k as f32 - 3.0) * 0.5 + sin(t * 0.8 + k as f32) * 0.05;
        let l = hgt * 0.42;
        let (dx, dy) = (cos(ang) * l, sin(ang) * l + l * 0.45);
        path(g, &[tx, ty, tx + dx * 0.5, ty + dy * 0.15 - l * 0.22, tx + dx, ty + dy, tx + dx * 0.5, ty + dy * 0.15 - l * 0.08], col, NONE, 0.0, true, false);
    }
}
/// Car lights flowing along a road: white coming, red going.
fn traffic(g: &mut Game, v: &View, y: f32, a: f32, s: f32) {
    let yy = v.y(y, s);
    rect(g, 0.0, yy - 5.0 * v.u * s, v.w, 10.0 * v.u * s, (0.05, 0.04, 0.08, 0.8 * a), 0.0, false);
    for i in 0..26u32 {
        let dir = if i % 2 == 0 { 1.0 } else { -1.0 };
        let sp = (60.0 + 50.0 * h1(i * 7)) * v.u;
        let span = v.w + 80.0 * v.u;
        let x = fmod(h1(i * 13) * span + v.t * sp, span) - 40.0 * v.u;
        let x = if dir > 0.0 { x } else { v.w - x };
        let ly = yy + if dir > 0.0 { -2.2 } else { 2.2 } * v.u * s;
        let (r, gg, b) = if dir > 0.0 { (1.0, 0.95, 0.8) } else { (1.0, 0.25, 0.2) };
        let len = 16.0 * v.u * s;
        cmd(g, OP_STREAK, &[x - dir * len, ly, x, ly, 2.2 * v.u * s, r, gg, b, 0.75 * a]);
    }
}
fn crane(g: &mut Game, x: f32, base: f32, hgt: f32, jib: f32, col: C4, u: f32) {
    rect(g, x - 2.2 * u, base - hgt, 4.4 * u, hgt, col, 0.0, false);
    rect(g, x - jib * 0.28, base - hgt, jib, 3.2 * u, col, 0.0, false);
    path(g, &[x, base - hgt - 14.0 * u, x - jib * 0.28, base - hgt + 1.0, x + jib * 0.72, base - hgt + 1.0], NONE, col, 1.0 * u, true, false);
    path(g, &[x + jib * 0.55, base - hgt + 3.0 * u, x + jib * 0.55, base - hgt + 36.0 * u], NONE, col, 0.8 * u, false, false);
    rect(g, x - jib * 0.28, base - hgt + 3.0 * u, 8.0 * u, 6.0 * u, col, 0.0, false);
}

// ───────────────────────────────────────────── the eras

fn era(g: &mut Game, e: u8, a: f32, l: &L) {
    if a <= 0.01 { return; }
    let lay = g.lay;
    let v = View { w: lay.w, h: lay.h, u: lay.u, sx: lay.sx, sy: lay.sy, sw: lay.sw, sh: lay.sh, cx: lay.cx, cy: lay.cy, rp: lay.ring_px, hz: lay.cy + lay.ring_px * 0.42, t: g.real };
    // tiers the camera has pulled back since this era began
    let first = TIERS.iter().position(|x| x.cat as u8 == e).unwrap_or(0) as f32;
    let k = (g.base - (first - g.gap() as f32)).max(0.0);
    let u = v.u;
    let hz = v.hz;
    let hz_ = l.haze;
    match e {
        // on foot: the first dawn
        0 => {
            cmd(g, OP_GLOW, &[v.cx, v.sy + v.sh * 0.16, v.sw * 1.0, 1.0, 0.86, 0.72, 0.3 * a]);
            ridge(g, &v, hz - 34.0 * u, &[(0.9, 0.0, 24.0 * u), (2.1, 1.3, 9.0 * u)], cm(fog(0xB46A86, hz_, 0.45), a), zs(k, 0.05));
            ridge(g, &v, hz + 6.0 * u, &[(1.4, 2.0, 16.0 * u), (3.0, 0.4, 6.0 * u)], cm(fog(0x93506E, hz_, 0.22), a), zs(k, 0.08));
            ridge(g, &v, hz + 60.0 * u, &[(1.1, 0.7, 12.0 * u), (2.6, 2.2, 5.0 * u)], cm(fog(0x6A2E4C, hz_, 0.05), a), zs(k, 0.13));
        }
        // riding animals: a spring meadow
        1 => {
            sun(g, v.sx + v.sw * 0.8, v.sy + v.sh * 0.15, 24.0 * u, 0xFFF6D6, a, 1.0);
            peaks(g, &v, hz - 18.0 * u, 92.0 * u, 96.0 * u, 3, cm(fog(0x6E8EBE, hz_, 0.55), a), zs(k, 0.04), 0.7);
            let w1 = [(0.8, 0.5, 14.0 * u), (2.0, 1.1, 6.0 * u)];
            ridge(g, &v, hz - 4.0 * u, &w1, cm(fog(0x7DB070, hz_, 0.38), a), zs(k, 0.07));
            trees(g, &v, hz - 4.0 * u, &w1, 34.0 * u, 11.0 * u, 7, cm(fog(0x3F7A44, hz_, 0.3), a), zs(k, 0.07));
            let w2 = [(1.3, 2.2, 10.0 * u), (3.1, 0.3, 4.0 * u)];
            ridge(g, &v, hz + 54.0 * u, &w2, cm(fog(0x5CA448, hz_, 0.06), a), zs(k, 0.12));
            // flowers in the near grass
            let s = zs(k, 0.12);
            for i in 0..34u32 {
                let x = v.cx + (h1(i * 7) - 0.5) * v.w / s;
                let y = ridge_y(x, hz + 64.0 * u, &w2, u) + 26.0 * u * h1(i * 3);
                let cc = [0xFFE066u32, 0xFF7AA8, 0xFFFFFF, 0xC59CFF][(i % 4) as usize];
                circle(g, v.x(x, s), v.y(y, s), 2.2 * u * s, c(cc, 0.9 * a), NONE, 0.0, false);
            }
        }
        // small motors: a little town at golden hour
        2 => {
            sun(g, v.cx + v.sw * 0.22, hz - 46.0 * u, 34.0 * u, 0xFFD27A, a, 1.4);
            cmd(g, OP_RAYS, &[v.cx + v.sw * 0.22, hz - 46.0 * u, 30.0 * u, v.h * 0.8, 16.0, v.t * 0.02, 1.0, 0.85, 0.6, 0.08 * a]);
            ridge(g, &v, hz - 20.0 * u, &[(0.7, 0.2, 14.0 * u), (1.9, 1.0, 6.0 * u)], cm(fog(0xB0708A, hz_, 0.5), a), zs(k, 0.05));
            houses(g, &v, hz + 10.0 * u, 30.0 * u, 11, cm(fog(0x6A4058, hz_, 0.3), a), zs(k, 0.08), (0xFFD890, 0.8));
            houses(g, &v, hz + 46.0 * u, 44.0 * u, 23, cm(fog(0x40243A, hz_, 0.06), a), zs(k, 0.12), (0xFFC870, 0.9));
            // street lamps
            let s = zs(k, 0.12);
            for i in 0..9u32 {
                let x = v.w * (i as f32 + 0.5) / 9.0;
                cmd(g, OP_BOKEH, &[x, v.y(hz + 40.0 * u, s), 7.0 * u, 1.0, 0.82, 0.5, 0.55 * a]);
            }
        }
        // cars: a highway at dusk
        3 => {
            sun(g, v.cx - v.sw * 0.12, hz - 8.0 * u, 44.0 * u, 0xFF9C6A, a, 1.2);
            peaks(g, &v, hz - 6.0 * u, 120.0 * u, 70.0 * u, 5, cm(fog(0x5A3A6A, hz_, 0.45), a), zs(k, 0.04), 0.0);
            skyline(g, &v, hz + 14.0 * u, 22.0 * u, 26.0 * u, 110.0 * u, 41, cm(fog(0x2A1E44, hz_, 0.25), a), zs(k, 0.08), (0xFFD08A, 0.55));
            traffic(g, &v, hz + 34.0 * u, a, zs(k, 0.1));
            ridge(g, &v, hz + 58.0 * u, &[(0.6, 0.0, 3.0 * u)], cm(fog(0x150E26, hz_, 0.05), a), zs(k, 0.13));
        }
        // premium: the city at night
        4 => {
            moon(g, v.sx + v.sw * 0.16, v.sy + v.sh * 0.17, 15.0 * u, a, l.top);
            cmd(g, OP_GLOW, &[v.cx, hz, v.sw * 0.9, 0.35, 0.55, 0.9, 0.22 * a]);
            skyline(g, &v, hz - 10.0 * u, 26.0 * u, 60.0 * u, 190.0 * u, 61, cm(fog(0x1C2C54, hz_, 0.35), a), zs(k, 0.05), (0x9FC8FF, 0.35));
            skyline(g, &v, hz + 26.0 * u, 34.0 * u, 40.0 * u, 150.0 * u, 73, cm(fog(0x08122A, hz_, 0.08), a), zs(k, 0.1), (0xFFE6B0, 0.6));
        }
        // supercars: a sunset coast
        5 => {
            let sy_ = hz - 4.0 * u;
            sun(g, v.cx + v.sw * 0.06, sy_, 62.0 * u, 0xFF8A42, a, 1.5);
            // the sea under the sun, with the sun's path
            let sea = fog(0x3A1030, hz_, 0.25);
            rect(g, 0.0, hz, v.w, v.h - hz, cm(sea, a), 0.0, false);
            for i in 0..14 {
                let y = hz + (4.0 + i as f32 * i as f32 * 1.6) * u;
                let ww = (110.0 - i as f32 * 5.0) * u * (1.0 + 0.1 * sin(v.t * 1.3 + i as f32));
                rect(g, v.cx + v.sw * 0.06 - ww * 0.5, y, ww, (1.2 + i as f32 * 0.2) * u, c(0xFFB070, 0.35 * a), 0.0, true);
            }
            // a headland and palms
            let s = zs(k, 0.1);
            let pc = cm(fog(0x180610, hz_, 0.05), a);
            palm(g, v.x(v.sx + v.sw * 0.07, s), v.y(hz + 70.0 * u, s), 150.0 * u * s, 18.0 * u * s, pc, v.t, u * s);
            palm(g, v.x(v.sx + v.sw * 0.93, s), v.y(hz + 74.0 * u, s), 130.0 * u * s, -14.0 * u * s, pc, v.t + 1.0, u * s);
            ridge(g, &v, hz + 70.0 * u, &[(0.5, 0.0, 4.0 * u)], pc, s);
        }
        // hypercars: a neon night
        6 => {
            for kk in 0..3 {
                let x = v.w * (0.2 + 0.3 * kk as f32);
                let ang = -PI * 0.5 + sin(v.t * 0.5 + kk as f32 * 2.0) * 0.55;
                let (dx, dy) = (cos(ang), sin(ang));
                let ln = v.h * 0.9; let sp = 0.06;
                path(g, &[x, hz, x + (dx - dy * sp) * ln, hz + (dy + dx * sp) * ln, x + (dx + dy * sp) * ln, hz + (dy - dx * sp) * ln], (0.8, 0.7, 1.0, 0.07 * a), NONE, 0.0, true, true);
            }
            skyline(g, &v, hz - 4.0 * u, 24.0 * u, 70.0 * u, 230.0 * u, 77, cm(fog(0x1A0C36, hz_, 0.3), a), zs(k, 0.05), (0xD9C8FF, 0.4));
            // neon edges on the towers
            for i in 0..6u32 {
                let x = v.w * h1(i * 5);
                let y = hz - (60.0 + 120.0 * h1(i * 11)) * u;
                let cc = if i % 2 == 0 { (1.0, 0.3, 0.85) } else { (0.15, 0.9, 1.0) };
                cmd(g, OP_LINE, &[x - 10.0 * u, y, x + 10.0 * u, y, 2.0 * u, cc.0, cc.1, cc.2, 0.8 * a, 1.0]);
            }
            skyline(g, &v, hz + 34.0 * u, 36.0 * u, 30.0 * u, 120.0 * u, 89, cm(fog(0x0A0418, hz_, 0.05), a), zs(k, 0.1), (0xFF8AE8, 0.5));
        }
        // heavy duty: an industrial dusk
        7 => {
            sun(g, v.sx + v.sw * 0.25, v.sy + v.sh * 0.2, 22.0 * u, 0xFFD27A, a * 0.8, 0.8);
            let s = zs(k, 0.07);
            skyline(g, &v, hz + 4.0 * u, 40.0 * u, 30.0 * u, 70.0 * u, 101, cm(fog(0x4A3A28, hz_, 0.35), a), s, (0xFFD27A, 0.3));
            // chimneys and their smoke
            for i in 0..4u32 {
                let x = v.cx + (h1(i * 3) - 0.5) * v.w * 0.9 / s;
                let (sx_, top) = (v.x(x, s), v.y(hz - (70.0 + 40.0 * h1(i)) * u, s));
                rect(g, sx_ - 4.0 * u * s, top, 8.0 * u * s, v.h - top, cm(fog(0x3A2C1E, hz_, 0.3), a), 0.0, false);
                for p in 0..5 {
                    let f = fmod(v.t * 0.12 + p as f32 * 0.2 + h1(i * 7), 1.0);
                    cmd(g, OP_SMOKE, &[sx_ + f * 30.0 * u, top - f * 90.0 * u, (8.0 + 30.0 * f) * u * s, 0.75, 0.68, 0.6, 0.25 * a * (1.0 - f)]);
                }
            }
            let cc = cm(fog(0x2A2016, hz_, 0.15), a);
            let s2 = zs(k, 0.1);
            crane(g, v.x(v.sx + v.sw * 0.12, s2), v.y(hz + 30.0 * u, s2), 170.0 * u * s2, 120.0 * u * s2, cc, u * s2);
            crane(g, v.x(v.sx + v.sw * 0.86, s2), v.y(hz + 30.0 * u, s2), 140.0 * u * s2, -90.0 * u * s2, cc, u * s2);
            ridge(g, &v, hz + 56.0 * u, &[(0.5, 0.0, 3.0 * u)], cm(fog(0x1E160E, hz_, 0.05), a), zs(k, 0.13));
        }
        // monsters & records: the desert
        8 => {
            sun(g, v.sx + v.sw * 0.82, v.sy + v.sh * 0.17, 26.0 * u, 0xFFE6A0, a, 1.3);
            // mesas
            let s = zs(k, 0.05);
            let mc = cm(fog(0xB0603A, hz_, 0.45), a);
            for i in 0..5u32 {
                let x = v.cx + (h1(i * 9) - 0.5) * v.w * 1.2 / s;
                let wv = (40.0 + 60.0 * h1(i * 4)) * u; let hv = (24.0 + 40.0 * h1(i * 6)) * u;
                let b = hz - 6.0 * u;
                path(g, &[v.x(x - wv, s), v.y(b, s), v.x(x - wv * 0.7, s), v.y(b - hv, s), v.x(x + wv * 0.7, s), v.y(b - hv, s), v.x(x + wv, s), v.y(b, s)], mc, NONE, 0.0, true, false);
            }
            ridge(g, &v, hz - 2.0 * u, &[(0.5, 0.0, 10.0 * u), (1.3, 1.0, 5.0 * u)], cm(fog(0xD8904E, hz_, 0.35), a), zs(k, 0.07));
            ridge(g, &v, hz + 26.0 * u, &[(0.8, 2.0, 12.0 * u), (1.9, 0.4, 4.0 * u)], cm(fog(0xC27A3C, hz_, 0.15), a), zs(k, 0.1));
            ridge(g, &v, hz + 64.0 * u, &[(1.1, 1.0, 10.0 * u)], cm(fog(0x9A5A28, hz_, 0.03), a), zs(k, 0.13));
        }
        // rails: misty mountains
        9 => {
            sun(g, v.sx + v.sw * 0.2, v.sy + v.sh * 0.17, 18.0 * u, 0xFFF8E6, a, 0.8);
            peaks(g, &v, hz - 30.0 * u, 110.0 * u, 150.0 * u, 17, cm(fog(0x6E86B4, hz_, 0.55), a), zs(k, 0.03), 0.9);
            rect(g, 0.0, hz - 60.0 * u, v.w, 60.0 * u, cm(hz_, 0.25 * a), 0.0, false);
            peaks(g, &v, hz - 4.0 * u, 70.0 * u, 100.0 * u, 29, cm(fog(0x4A628E, hz_, 0.35), a), zs(k, 0.06), 0.8);
            let w1 = [(1.0, 0.4, 8.0 * u), (2.4, 1.2, 4.0 * u)];
            pines(g, &v, hz + 26.0 * u, &w1, 9.0 * u, 26.0 * u, 31, cm(fog(0x24425A, hz_, 0.2), a), zs(k, 0.1));
            ridge(g, &v, hz + 26.0 * u, &w1, cm(fog(0x24425A, hz_, 0.2), a), zs(k, 0.1));
            // a stone viaduct
            let s = zs(k, 0.11);
            let vy = v.y(hz + 50.0 * u, s);
            let cc = cm(fog(0x3A2E26, hz_, 0.08), a);
            rect(g, 0.0, vy - 9.0 * u * s, v.w, 9.0 * u * s, cc, 0.0, false);
            let span = 46.0 * u * s;
            let n = (v.w / span) as i32 + 2;
            let off = fmod(v.x(0.0, s), span);
            for i in -1..n { rect(g, off + i as f32 * span, vy, 9.0 * u * s, v.h - vy, cc, 0.0, false); }
        }
        // under sail: the open sea at dawn
        10 => {
            sun(g, v.cx - v.sw * 0.18, hz - 10.0 * u, 26.0 * u, 0xFFE2C8, a, 1.2);
            let s = zs(k, 0.06);
            // a far island
            path(g, &[v.x(v.cx + 60.0 * u, s), v.y(hz, s), v.x(v.cx + 110.0 * u, s), v.y(hz - 22.0 * u, s), v.x(v.cx + 150.0 * u, s), v.y(hz - 14.0 * u, s), v.x(v.cx + 200.0 * u, s), v.y(hz, s)], cm(fog(0x5A6A8A, hz_, 0.5), a), NONE, 0.0, true, false);
            rect(g, 0.0, hz, v.w, v.h - hz, cm(fog(0x4A78A8, hz_, 0.3), a), 0.0, false);
            for kk in 0..5 {
                let y0 = hz + (6.0 + kk as f32 * kk as f32 * 7.0) * u;
                let cc = fog([0x5C8CB8u32, 0x4A7CAE, 0x3C6CA0, 0x2E5C90, 0x224C80][kk], hz_, 0.2 - kk as f32 * 0.04);
                ridge(g, &v, y0, &[(2.0 + kk as f32 * 0.5, v.t * (0.8 + kk as f32 * 0.3), (1.5 + kk as f32) * u), (4.1, -v.t * 1.4, 1.0 * u)], cm(cc, a), 1.0);
            }
            // gulls
            for i in 0..5u32 {
                let x = fmod(h1(i * 29) * v.w + v.t * (14.0 + 8.0 * h1(i)) * u, v.w);
                let y = v.sy + (70.0 + 60.0 * h1(i * 3)) * u;
                let fl = sin(v.t * 5.0 + i as f32) * 3.0 * u;
                path(g, &[x - 7.0 * u, y - fl, x, y, x + 7.0 * u, y - fl], NONE, c(0x3A4A6A, 0.6 * a), 1.4 * u, false, false);
            }
        }
        // seas: the deep
        11 => {
            // light falling from the surface
            cmd(g, OP_RAYS, &[v.cx + sin(v.t * 0.1) * 40.0 * u, v.sy - 80.0 * u, 20.0 * u, v.h * 1.1, 13.0, v.t * 0.015, 0.7, 0.95, 1.0, 0.14 * a]);
            // the shimmering surface
            for i in 0..3 {
                let y0 = v.sy + (8.0 + i as f32 * 6.0) * u;
                let n = 40;
                let mut pts = Vec::with_capacity(n * 2 + 4);
                for j in 0..=n { let x = v.w * j as f32 / n as f32; pts.push(x); pts.push(y0 + sin(x / u * 0.04 + v.t * (1.3 + 0.4 * i as f32) + i as f32) * 3.0 * u); }
                path(g, &pts, NONE, c(0xCFF6FF, (0.28 - 0.07 * i as f32) * a), 2.0 * u, false, true);
            }
            // fish far away, out of focus
            for i in 0..6u32 {
                let span = v.w + 200.0 * u;
                let left = i % 2 == 1;
                let mut x = fmod(h1(i * 13) * span + v.t * (10.0 + 10.0 * h1(i * 3)) * u, span) - 100.0 * u;
                if left { x = v.w - x; }
                let y = v.sy + v.sh * (0.15 + 0.7 * h1(i * 7)) + sin(v.t * 0.8 + i as f32) * 6.0 * u;
                let idx = 1000.0 + if i == 5 { 4.0 } else if i % 2 == 0 { 2.0 } else { 3.0 };
                let size = if i == 5 { 180.0 } else { 40.0 + 30.0 * h1(i * 5) } * u;
                let cc = fog(0x0A3A5A, hz_, 0.3);
                cmd(g, OP_GHOST, &[idx, x, y, size, 0.0, if left { 1.0 } else { 0.0 }, 0.35 * a, if i == 5 { 2.0 } else { 1.0 }, cc.0, cc.1, cc.2]);
            }
            // kelp and rocks on the floor
            let s = zs(k, 0.1);
            let floor_y = v.sy + v.sh + 10.0 * u;
            for i in 0..14u32 {
                let x = v.w * (i as f32 + h1(i * 3)) / 14.0;
                let hgt = (60.0 + 110.0 * h1(i * 5)) * u * s;
                let mut pts = Vec::with_capacity(40);
                let n = 10;
                for j in 0..=n { let f = j as f32 / n as f32; pts.push(x + sin(v.t * 1.1 + f * 3.0 + i as f32) * 8.0 * u * f); pts.push(floor_y - hgt * f); }
                path(g, &pts, NONE, cm(fog(0x0C3A2A, hz_, 0.25), 0.85 * a), 5.0 * u * s.max(0.6), false, false);
            }
            ridge(g, &v, floor_y - 20.0 * u, &[(1.4, 0.0, 12.0 * u), (3.3, 1.0, 6.0 * u)], cm(fog(0x061C26, hz_, 0.2), a), 1.0);
        }
        // skies: above the clouds
        12 => {
            sun(g, v.sx + v.sw * 0.78, v.sy + v.sh * 0.14, 22.0 * u, 0xFFFFF2, a, 1.6);
            cmd(g, OP_RAYS, &[v.sx + v.sw * 0.78, v.sy + v.sh * 0.14, 24.0 * u, v.h * 0.7, 12.0, v.t * 0.03, 1.0, 1.0, 0.9, 0.1 * a]);
            // wisps high up
            for i in 0..4u32 {
                let x = fmod(h1(i * 13) * (v.w + 300.0 * u) + v.t * 6.0 * u, v.w + 300.0 * u) - 150.0 * u;
                let y = v.sy + (50.0 + 90.0 * h1(i * 5)) * u;
                rect(g, x, y, (120.0 + 80.0 * h1(i)) * u, 3.0 * u, c(0xFFFFFF, 0.35 * a), 2.0 * u, false);
            }
            cloudbank(g, &v, hz - 10.0 * u, 34.0 * u, 3, cm(fog(0xEAF2FF, hz_, 0.35), a), zs(k, 0.05), v.t * 4.0 * u);
            cloudbank(g, &v, hz + 30.0 * u, 46.0 * u, 7, cm(fog(0xF6FAFF, hz_, 0.12), a), zs(k, 0.09), -v.t * 6.0 * u);
            cloudbank(g, &v, hz + 76.0 * u, 60.0 * u, 13, c(0xFFFFFF, a), zs(k, 0.13), v.t * 9.0 * u);
        }
        // space: in orbit over the Earth
        13 => {
            let s = zs(k, 0.06);
            let er = v.w.max(v.sh) * 1.5 * s;
            let ex = v.cx; let ey = v.sy + v.sh + er - 110.0 * u * sqrt(s);
            cmd(g, OP_GLOW, &[ex, ey - er, v.w * 0.9, 0.4, 0.7, 1.0, 0.35 * a]);
            circle(g, ex, ey, er, (0.06, 0.2, 0.45, a), (0.45, 0.75, 1.0, 0.8 * a), 3.0 * u, false);
            circle(g, ex, ey, er * 0.985, (0.04, 0.14, 0.32, a), NONE, 0.0, false);
            // cloud swirls on the planet
            for i in 0..9u32 {
                let ang = -PI * 0.5 + (h1(i * 3) - 0.5) * 0.5;
                let d = er * (0.93 - 0.05 * h1(i * 7));
                cmd(g, OP_SMOKE, &[ex + cos(ang) * d, ey + sin(ang) * d, (30.0 + 40.0 * h1(i)) * u * s, 0.9, 0.95, 1.0, 0.18 * a]);
            }
            // the Sun's glare and the Moon
            sun(g, v.sx + v.sw * 0.12, v.sy + v.sh * 0.13, 12.0 * u, 0xFFFFFF, a, 2.0);
            for (f, r) in [(0.25f32, 6.0f32), (0.45, 3.5), (0.6, 9.0)] {
                let x = lerp(v.sx + v.sw * 0.12, v.cx + v.sw * 0.3, f); let y = lerp(v.sy + v.sh * 0.13, v.cy, f);
                circle(g, x, y, r * u, (0.6, 0.8, 1.0, 0.12 * a), NONE, 0.0, true);
            }
            moon(g, v.sx + v.sw * 0.86, v.sy + v.sh * 0.2, 9.0 * u, a * 0.9, l.top);
        }
        // science fiction: a nebula
        14 => {
            for i in 0..7u32 {
                let x = v.w * h1(i * 7); let y = v.sy + v.sh * h1(i * 11);
                let cc = [(1.0, 0.3, 0.8), (0.4, 0.3, 1.0), (0.2, 0.85, 1.0), (1.0, 0.5, 0.4)][(i % 4) as usize];
                cmd(g, OP_GLOW, &[x + sin(v.t * 0.05 + i as f32) * 20.0 * u, y, (140.0 + 120.0 * h1(i * 3)) * u, cc.0, cc.1, cc.2, 0.13 * a]);
            }
            for i in 0..6u32 {
                cmd(g, OP_SMOKE, &[v.w * h1(i * 17 + 1), v.sy + v.sh * h1(i * 19 + 2), (60.0 + 60.0 * h1(i)) * u, 0.02, 0.0, 0.06, 0.35 * a]);
            }
            // a ringed planet
            let (px, py, pr) = (v.sx + v.sw * 0.82, v.sy + v.sh * 0.2, 24.0 * u);
            circle(g, px, py, pr, (0.7, 0.45, 0.95, 0.85 * a), NONE, 0.0, false);
            circle(g, px + pr * 0.25, py + pr * 0.2, pr * 0.85, (0.35, 0.15, 0.55, 0.5 * a), NONE, 0.0, false);
            let mut ring = Vec::new();
            for i in 0..=40 { let an = TAU * i as f32 / 40.0; ring.push(px + cos(an) * pr * 1.9); ring.push(py + sin(an) * pr * 0.42 - cos(an) * pr * 0.2); }
            path(g, &ring, NONE, (0.95, 0.85, 1.0, 0.55 * a), 2.5 * u, true, false);
        }
        // megastructures: the galaxy
        15 => {
            let (gx, gy) = (v.cx + v.sw * 0.08, v.cy - v.rp * 0.2);
            let gr = v.sw * 0.75;
            cmd(g, OP_GLOW, &[gx, gy, gr * 0.5, 1.0, 0.92, 0.75, 0.5 * a]);
            cmd(g, OP_GLOW, &[gx, gy, gr * 1.1, 0.5, 0.65, 1.0, 0.2 * a]);
            let rot = v.t * 0.01;
            for i in 0..240u32 {
                let arm = (i % 2) as f32 * PI;
                let f = h1(i * 7);
                let rr = gr * f;
                let ang = arm + f * 4.2 + rot + (h1(i * 13) - 0.5) * 0.5;
                let x = gx + cos(ang) * rr; let y = gy + sin(ang) * rr * 0.42;
                let cc = if h1(i * 5) > 0.7 { (1.0, 0.85, 0.7) } else { (0.75, 0.85, 1.0) };
                cmd(g, OP_DOT, &[x, y, (0.8 + 1.4 * h1(i * 3)) * u, cc.0, cc.1, cc.2, (0.35 + 0.4 * (1.0 - f)) * a, 1.0]);
            }
        }
        // the rides of the gods: a twilight realm with floating islands
        16 => {
            for kk in 0..3 {
                let mut pts = Vec::new();
                let base_y = v.sy + (70.0 + 26.0 * kk as f32) * u;
                for i in 0..=30 { let x = v.w * i as f32 / 30.0; pts.push(x); pts.push(base_y + sin(i as f32 * 0.5 + v.t * 0.7 + kk as f32) * 16.0 * u); }
                for i in (0..=30).rev() { let x = v.w * i as f32 / 30.0; pts.push(x); pts.push(base_y + 70.0 * u + sin(i as f32 * 0.5 + v.t * 0.7 + kk as f32) * 16.0 * u); }
                let cc = [0x7CFFB2u32, 0xFFC34D, 0xC59CFF][kk];
                path(g, &pts, c(cc, 0.08 * a), NONE, 0.0, true, true);
            }
            let s = zs(k, 0.06);
            for i in 0..4u32 {
                let x = v.cx + (h1(i * 5) - 0.5) * v.w * 1.1 / s;
                let y = hz - (40.0 + 140.0 * h1(i * 7)) * u + sin(v.t * 0.4 + i as f32) * 6.0 * u;
                let wv = (40.0 + 40.0 * h1(i * 3)) * u;
                let (xs, ys, ws) = (v.x(x, s), v.y(y, s), wv * s);
                let cc = cm(fog(0x2A1A10, hz_, 0.3 + 0.1 * i as f32), a);
                path(g, &[xs - ws, ys, xs + ws, ys, xs + ws * 0.3, ys + ws * 0.9, xs - ws * 0.1, ys + ws * 1.3, xs - ws * 0.5, ys + ws * 0.7], cc, NONE, 0.0, true, false);
                // a little temple on top
                rect(g, xs - ws * 0.4, ys - ws * 0.3, ws * 0.8, ws * 0.3, cc, 0.0, false);
                path(g, &[xs - ws * 0.5, ys - ws * 0.3, xs, ys - ws * 0.55, xs + ws * 0.5, ys - ws * 0.3], cc, NONE, 0.0, true, false);
            }
            ridge(g, &v, hz + 60.0 * u, &[(0.6, 0.0, 14.0 * u), (1.5, 1.2, 6.0 * u)], cm(fog(0x1E1006, hz_, 0.05), a), zs(k, 0.12));
        }
        // wonders: a holy dawn in the desert
        17 => {
            let (sx_, sy_) = (v.cx, hz - 30.0 * u);
            cmd(g, OP_RAYS, &[sx_, sy_, 20.0 * u, v.h, 18.0, v.t * 0.02, 1.0, 0.9, 0.6, 0.16 * a]);
            sun(g, sx_, sy_, 30.0 * u, 0xFFF0C8, a, 1.6);
            let s = zs(k, 0.05);
            // the mountain of God, a pillar of cloud over it
            let mx = v.x(v.cx - v.sw * 0.28, s);
            path(g, &[mx - 120.0 * u * s, v.y(hz, s), mx - 10.0 * u * s, v.y(hz - 110.0 * u, s), mx + 20.0 * u * s, v.y(hz - 100.0 * u, s), mx + 140.0 * u * s, v.y(hz, s)], cm(fog(0x6A4A3A, hz_, 0.45), a), NONE, 0.0, true, false);
            for p in 0..6 {
                let f = p as f32 / 6.0;
                cmd(g, OP_SMOKE, &[mx + sin(v.t * 0.3 + p as f32) * 6.0 * u, v.y(hz - 110.0 * u, s) - f * 170.0 * u, (26.0 + 14.0 * f) * u, 1.0, 0.97, 0.92, 0.3 * a]);
            }
            ridge(g, &v, hz + 10.0 * u, &[(0.6, 0.3, 10.0 * u), (1.4, 1.0, 5.0 * u)], cm(fog(0xD8A060, hz_, 0.3), a), zs(k, 0.08));
            ridge(g, &v, hz + 56.0 * u, &[(0.9, 2.0, 12.0 * u)], cm(fog(0xA87038, hz_, 0.06), a), zs(k, 0.12));
        }
        // the heavens
        18 => {
            cmd(g, OP_RAYS, &[v.cx, v.sy - 60.0 * u, 20.0 * u, v.h * 1.1, 22.0, v.t * 0.015, 1.0, 0.95, 0.8, 0.2 * a]);
            cmd(g, OP_GLOW, &[v.cx, v.sy, v.sw * 1.2, 1.0, 0.97, 0.88, 0.4 * a]);
            // a ladder of light going up
            let lx = v.sx + v.sw * 0.85;
            for i in 0..12 {
                let f = i as f32 / 12.0;
                let y = v.sy + v.sh * (0.95 - f * 0.9);
                rect(g, lx - 16.0 * u * (1.0 - f * 0.6), y, 32.0 * u * (1.0 - f * 0.6), 2.0 * u, c(0xFFF4D0, 0.3 * a * (1.0 - f)), 0.0, true);
            }
            cloudbank(g, &v, hz - 20.0 * u, 40.0 * u, 5, cm(fog(0xFFF4E6, hz_, 0.3), a), zs(k, 0.05), v.t * 3.0 * u);
            cloudbank(g, &v, hz + 34.0 * u, 54.0 * u, 9, c(0xFFFCF4, a), zs(k, 0.1), -v.t * 5.0 * u);
        }
        // God: the void, and one light
        _ => {
            cmd(g, OP_GLOW, &[v.cx, v.cy, v.sw * 1.3, 1.0, 0.9, 0.7, 0.22 * a]);
            cmd(g, OP_RAYS, &[v.cx, v.cy, 20.0 * u, v.h, 28.0, v.t * 0.03, 1.0, 0.92, 0.75, 0.12 * a]);
        }
    }
}

// ───────────────────────────────────────────── what drifts in the medium

fn motes(g: &mut Game, e: u8, a: f32) {
    let lk = &LOOKS[e as usize];
    if a <= 0.01 { return; }
    let lay = g.lay; let u = lay.u;
    let zl = (g.base.max(0.0) * log2f(g.grow())) * 0.25 + g.warp;
    let dmax = sqrt(lay.w * lay.w + lay.h * lay.h) * 0.62;
    let n = ((g.stars.len() as f32) * lk.density) as usize;
    let t = g.real;
    for i in 0..n.min(g.stars.len()) {
        let s = g.stars[i];
        let f = fmod(zl + s.p.y, 1.0);
        let d = dmax * pow(2.0, -4.0 * f);
        let ang = s.p.x * TAU;
        let mut x = lay.cx + cos(ang) * d;
        let mut y = lay.cy + sin(ang) * d * 1.15;
        let fade = smooth(f * 10.0) * (1.0 - smooth((f - 0.78) / 0.22));
        let near = 1.0 - f;
        let hsh = h1(i as u32 * 7 + 3);
        let col = rgb(lk.mc[(i % 2) as usize]);
        match lk.motes {
            M_STARS => {
                if x < -4.0 || y < -4.0 || x > lay.w + 4.0 || y > lay.h + 4.0 { continue; }
                let tw = 0.55 + 0.45 * sin(s.life);
                let (r, gg, b) = rgb(s.color);
                cmd(g, OP_DOT, &[x, y, s.size * (0.45 + 0.75 * near), r, gg, b, tw * fade * a, 0.0]);
            }
            M_BOKEH => {
                let rr = (3.0 + 11.0 * hsh) * u * (0.4 + 0.9 * near);
                x += sin(t * 0.2 + i as f32) * 6.0 * u;
                cmd(g, OP_BOKEH, &[x, y, rr, col.0, col.1, col.2, (0.12 + 0.2 * h1(i as u32 * 5)) * fade * a]);
            }
            M_DUST | M_SEEDS | M_SPARK => {
                // drifting up through the light
                let rise = fmod(t * (5.0 + 9.0 * hsh) * u + hsh * lay.h, lay.h);
                y -= rise * 0.35;
                x += sin(t * (0.3 + hsh) + i as f32) * 10.0 * u;
                let tw = if lk.motes == M_SPARK { 0.4 + 0.6 * sin(s.life * 2.0).max(0.0) } else { 1.0 };
                let sz = if lk.motes == M_SEEDS { 2.2 } else { 1.6 } * u * (0.5 + 0.9 * near) * (0.6 + 0.8 * hsh);
                cmd(g, OP_DOT, &[x, y, sz, col.0, col.1, col.2, (0.25 + 0.35 * hsh) * tw * fade * a, 1.0]);
            }
            M_BUBBLES => {
                let rise = fmod(t * (16.0 + 26.0 * hsh) * u + hsh * lay.h, lay.h + 40.0 * u);
                y = fmod(y - rise + lay.h * 2.0, lay.h + 40.0 * u) - 20.0 * u;
                x += sin(t * 2.0 + i as f32) * 3.0 * u;
                let rr = (1.5 + 4.5 * hsh) * u * (0.5 + 0.8 * near);
                circle(g, x, y, rr, (col.0, col.1, col.2, 0.06 * fade * a), (col.0, col.1, col.2, 0.5 * fade * a), 1.0 * u, false);
                circle(g, x - rr * 0.35, y - rr * 0.35, rr * 0.25, (1.0, 1.0, 1.0, 0.6 * fade * a), NONE, 0.0, false);
            }
            M_SNOW => {
                let fall = fmod(t * (8.0 + 10.0 * hsh) * u + hsh * lay.h, lay.h);
                y = fmod(y + fall, lay.h);
                x += sin(t * 0.7 + i as f32) * 8.0 * u;
                cmd(g, OP_DOT, &[x, y, (1.2 + 1.8 * hsh) * u * (0.5 + 0.7 * near), col.0, col.1, col.2, 0.7 * fade * a, 0.0]);
            }
            _ => {}
        }
    }
}

/// Out of focus in the deep: the next tiers, at their true size, looming behind the bubble.
fn giants(g: &mut Game, l: &L, a: f32) {
    if g.finished || a <= 0.01 { return; }
    let lay = g.lay;
    let (z, _) = g.cam();
    let sc = lay.scale * z;
    let base_k = g.base + g.gap() as f32;
    let col = if l.dark > 0.5 { mix_rgb(l.haze, (1.0, 1.0, 1.0), 0.45) } else { mix_rgb(l.haze, (0.0, 0.0, 0.0), 0.42) };
    let top = (g.run_max as u32 + 3).min(GOD as u32 - 1) as u8;
    let rp = lay.ring_px;
    // biggest first, so the nearer giant sits on top
    let mut t = top;
    while t > g.run_max {
        let kf = t as f32 - base_k;
        let vis = smooth((kf - 0.2) / 0.8) * (1.0 - smooth((kf - 2.6) / 1.2));
        if vis > 0.01 {
            let r = g.radius_for(t) * sc;
            let size = r * 2.7;
            let h0 = h1(t as u32 * 31 + 7);
            let h2 = h1(t as u32 * 17 + 3);
            let drift = g.real * 0.05 + h0 * 6.0;
            let x = lay.cx + (h0 - 0.5) * rp * 0.9 + sin(drift) * rp * 0.12;
            let y = lay.cy - rp * (0.05 + 0.35 * h2) + cos(drift * 0.8) * rp * 0.08;
            let blur = if kf < 1.5 { 1.0 } else { 2.0 };
            let alpha = a * vis * (0.3 + 0.14 * (1.0 - clamp(kf - 1.0, 0.0, 1.0))) * (1.0 - 0.2 * l.dark);
            cmd(g, OP_GHOST, &[t as f32, x, y, size, sin(g.real * 0.1 + h0 * 6.0) * 0.1, if h1(t as u32 * 3) > 0.5 { 1.0 } else { 0.0 }, alpha, blur, col.0, col.1, col.2]);
        }
        t -= 1;
    }
    // God draws near: a light grows in the deep over the last tiers
    let near_god = smooth((g.run_max as f32 - (GOD as f32 - 9.0)) / 8.0);
    if near_god > 0.0 {
        cmd(g, OP_GLOW, &[lay.cx, lay.cy - lay.ring_px * 0.3, lay.sw * (0.8 + 0.8 * near_god), 1.0, 0.96, 0.84, 0.35 * near_god * a]);
    }
}

/// Everything behind the bubble: sky, the era's place, the motes and the giants.
pub fn back(g: &mut Game, white: f32) {
    let l = look(g);
    let lay = g.lay;
    let fade = 1.0 - white;
    // sky
    let glow = mix_rgb(l.light, l.bot, 0.3);
    cmd(g, OP_BG, &[l.top.0, l.top.1, l.top.2, l.bot.0, l.bot.1, l.bot.2, white, 0.0, glow.0, glow.1, glow.2, g.cat as f32, g.ring_pulse * 0.5]);
    if fade <= 0.01 { return; }
    let t = smooth(g.cat_mix);
    if g.opts.on(crate::opts::Opt::Scenery) {
        let (pc, cc) = (g.prev_cat, g.cat);
        if t < 1.0 && pc != cc { era(g, pc, (1.0 - t) * fade, &l); }
        era(g, cc, if pc != cc { t } else { 1.0 } * fade, &l);
    }
    if g.opts.on(crate::opts::Opt::Stars) {
        let (pc, cc) = (g.prev_cat, g.cat);
        if t < 1.0 && pc != cc { motes(g, pc, (1.0 - t) * fade); }
        motes(g, cc, if pc != cc { t } else { 1.0 } * fade);
    }
    giants(g, &l, fade);
    // a soft haze around the bubble, so it reads over any scene
    let hz = mix_rgb(l.haze, l.light, 0.3);
    cmd(g, OP_GLOW, &[lay.cx, lay.cy, lay.ring_px * 1.5, hz.0, hz.1, hz.2, 0.1 * fade]);
}

/// In front of everything in the world: near motes out of focus, and the vignette.
pub fn front(g: &mut Game, white: f32) {
    let l = look(g);
    let lay = g.lay; let u = lay.u;
    let fade = 1.0 - white;
    if fade > 0.01 && g.opts.on(crate::opts::Opt::Stars) {
        for i in 0..5u32 {
            let sp = (4.0 + 6.0 * h1(i * 3)) * u;
            let span = lay.w + 300.0 * u;
            let x = fmod(h1(i * 7) * span + g.real * sp, span) - 150.0 * u;
            let y = lay.sy + lay.sh * (0.1 + 0.8 * h1(i * 11)) + sin(g.real * 0.3 + i as f32) * 20.0 * u;
            let r = (50.0 + 70.0 * h1(i * 13)) * u;
            cmd(g, OP_BOKEH, &[x, y, r, l.light.0, l.light.1, l.light.2, 0.05 * fade]);
        }
    }
    // darker corners, and a gentle shade behind the words at the top and the bottom
    // (stronger over bright skies, so the white readouts stay readable)
    let dk = mix_rgb(l.top, (0.0, 0.0, 0.0), 0.6);
    cmd(g, OP_VIGNETTE, &[lay.cx, lay.cy, lay.ring_px * 1.05, sqrt(lay.w * lay.w + lay.h * lay.h) * 0.62, dk.0, dk.1, dk.2, 0.5 * fade]);
    let lum = |c: Rgb| 0.3 * c.0 + 0.59 * c.1 + 0.11 * c.2;
    let top_a = 0.28 + 0.4 * lum(l.top);
    let bot_a = 0.3 + 0.35 * lum(l.bot);
    cmd(g, crate::story::OP_VGRAD, &[lay.sy, lay.sy + 160.0 * u, 0.0, 0.0, 0.0, top_a * fade, 0.0, 0.0, 0.0, 0.0, 0.0, lay.w]);
    if lay.sy > 0.5 { rect(g, 0.0, 0.0, lay.w, lay.sy, (0.0, 0.0, 0.0, top_a * fade), 0.0, false); }
    cmd(g, crate::story::OP_VGRAD, &[lay.sy + lay.sh - 170.0 * u, lay.sy + lay.sh, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, bot_a * fade, 0.0, lay.w]);
}
