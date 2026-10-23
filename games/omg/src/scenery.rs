//! A backdrop for every era, built from a handful of polygons: hills, cities,
//! a synthwave sun, rail viaducts, sea, clouds, planets, temples, Jerusalem's walls.
//! Drawn behind the ring and cross-faded when the era changes.

use alloc::vec::Vec;

use crate::game::Game;
use crate::m::*;
use crate::render::*;

#[inline] fn h1(a: u32) -> f32 { let mut x = a.wrapping_mul(0x9E37_79B9) ^ 0x7F4A_7C15; x ^= x >> 16; x = x.wrapping_mul(0x85EB_CA6B); x ^= x >> 13; (x & 0xFFFF) as f32 / 65535.0 }

/// Filled ridge across the whole canvas: y = y0 + Σ a·sin(f·x + p).
fn ridge(g: &mut Game, y0: f32, waves: &[(f32, f32, f32)], col: u32, a: f32, drift: f32) {
    let (w, h) = (g.lay.w, g.lay.h);
    let n = 48;
    let mut pts = Vec::with_capacity(n * 2 + 8);
    pts.push(0.0); pts.push(h);
    for i in 0..=n {
        let x = w * i as f32 / n as f32;
        let mut y = y0;
        for &(f, p, am) in waves { y += am * sin(f * (x + drift) / g.lay.u * 0.01 + p); }
        pts.push(x); pts.push(y);
    }
    pts.push(w); pts.push(h);
    path(g, &pts, c4(col, a), NONE, 0.0, true, false);
}

fn skyline(g: &mut Game, base: f32, seed: u32, count: usize, hmin: f32, hmax: f32, col: u32, a: f32, windows: u32, wa: f32) {
    let w = g.lay.w; let u = g.lay.u;
    let bw = w / count as f32;
    for i in 0..count {
        let r = h1(seed + i as u32 * 31);
        let hh = (hmin + (hmax - hmin) * r * r) * u;
        let x = i as f32 * bw + (h1(seed + i as u32 * 7) - 0.5) * bw * 0.3;
        let ww = bw * (0.7 + 0.5 * h1(seed + i as u32 * 13));
        rect(g, x, base - hh, ww, hh + g.lay.h, c4(col, a), 0.0, false);
        if windows != 0 && hh > 30.0 * u {
            let rows = (hh / (9.0 * u)) as usize;
            for rr in 1..rows.min(14) {
                for cc in 0..3 {
                    if h1(seed ^ (i as u32 * 131 + rr as u32 * 17 + cc as u32)) > 0.55 {
                        let wx = x + ww * (0.18 + cc as f32 * 0.28);
                        let wy = base - hh + rr as f32 * 9.0 * u;
                        rect(g, wx, wy, 2.6 * u, 3.4 * u, c4(windows, wa), 0.0, true);
                    }
                }
            }
        }
    }
}

fn stripe_sun(g: &mut Game, x: f32, y: f32, r: f32, top: u32, bot: u32, a: f32, cut_col: u32) {
    let (tr, tg, tb) = rgb(top); let (br, bg, bb) = rgb(bot);
    // vertical gradient by stacking bands
    let bands = 10;
    for i in 0..bands {
        let y0 = y - r + 2.0 * r * i as f32 / bands as f32;
        let y1 = y - r + 2.0 * r * (i + 1) as f32 / bands as f32;
        let k = (i as f32 + 0.5) / bands as f32;
        let c = (lerp(tr, br, k), lerp(tg, bg, k), lerp(tb, bb, k), a);
        // chord of the circle between y0 and y1
        let mut pts = Vec::with_capacity(40);
        let steps = 6;
        for s in 0..=steps { let yy = y0 + (y1 - y0) * s as f32 / steps as f32; let dx = sqrt((r * r - (yy - y) * (yy - y)).max(0.0)); pts.push(x + dx); pts.push(yy); }
        for s in (0..=steps).rev() { let yy = y0 + (y1 - y0) * s as f32 / steps as f32; let dx = sqrt((r * r - (yy - y) * (yy - y)).max(0.0)); pts.push(x - dx); pts.push(yy); }
        path(g, &pts, c, NONE, 0.0, true, false);
        // retro cut-outs in the lower half
        if k > 0.55 && i % 2 == 1 { rect(g, x - r, y1 - (y1 - y0) * 0.35 * (k - 0.4) * 2.0, 2.0 * r, (y1 - y0) * 0.35 * (k - 0.4) * 2.0, c4(cut_col, a), 0.0, false); }
    }
}

fn persp_grid(g: &mut Game, horizon: f32, col: u32, a: f32, t: f32) {
    let (w, h) = (g.lay.w, g.lay.h);
    let cx = g.lay.cx;
    let c = c4(col, a);
    rect(g, 0.0, horizon, w, h - horizon, (c.0 * 0.15, c.1 * 0.15, c.2 * 0.15, a * 0.6), 0.0, false);
    for i in -12..=12 {
        let x1 = cx + i as f32 * w * 0.18;
        path(g, &[cx + i as f32 * 6.0 * g.lay.u, horizon, x1, h], NONE, c, 1.2 * g.lay.u, false, true);
    }
    let rows = 9;
    for j in 0..rows {
        let f = fmod(j as f32 / rows as f32 + t * 0.25, 1.0);
        let y = horizon + (h - horizon) * f * f;
        path(g, &[0.0, y, w, y], NONE, (c.0, c.1, c.2, c.3 * (0.3 + 0.7 * f)), 1.2 * g.lay.u, false, true);
    }
}

fn cloud(g: &mut Game, x: f32, y: f32, s: f32, col: u32, a: f32) {
    for (dx, dy, r) in [(-1.0, 0.25, 0.55), (-0.35, -0.15, 0.75), (0.4, 0.0, 0.62), (1.0, 0.3, 0.45), (0.0, 0.35, 0.6)] {
        circle(g, x + dx * s, y + dy * s, r * s, c4(col, a), NONE, 0.0, false);
    }
}

fn mountains(g: &mut Game, base: f32, seed: u32, n: usize, hmax: f32, col: u32, a: f32, snow: bool) {
    let w = g.lay.w; let u = g.lay.u;
    let mut pts = Vec::with_capacity(n * 4 + 8);
    pts.push(0.0); pts.push(g.lay.h);
    pts.push(0.0); pts.push(base);
    let step = w / n as f32;
    let mut peaks = Vec::new();
    for i in 0..n {
        let px = step * (i as f32 + 0.5) + (h1(seed + i as u32) - 0.5) * step * 0.4;
        let ph = hmax * u * (0.45 + 0.55 * h1(seed * 3 + i as u32));
        pts.push(px); pts.push(base - ph);
        pts.push(step * (i as f32 + 1.0)); pts.push(base - ph * 0.25 * h1(seed + 99 + i as u32));
        peaks.push((px, base - ph, ph));
    }
    pts.push(w); pts.push(base);
    pts.push(w); pts.push(g.lay.h);
    path(g, &pts, c4(col, a), NONE, 0.0, true, false);
    if snow {
        for (px, py, ph) in peaks { let k = ph * 0.18; path(g, &[px, py, px + k * 0.7, py + k, px - k * 0.7, py + k], c4(0xFFFFFF, a * 0.55), NONE, 0.0, true, false); }
    }
}

fn sun(g: &mut Game, x: f32, y: f32, r: f32, col: u32, a: f32) {
    let (cr, cg, cb) = rgb(col);
    cmd(g, OP_GLOW, &[x, y, r * 3.2, cr, cg, cb, 0.35 * a]);
    circle(g, x, y, r, c4(col, 0.85 * a), NONE, 0.0, false);
}
fn moon(g: &mut Game, x: f32, y: f32, r: f32, col: u32, a: f32) {
    let (cr, cg, cb) = rgb(col);
    cmd(g, OP_GLOW, &[x, y, r * 2.6, cr, cg, cb, 0.18 * a]);
    circle(g, x, y, r, c4(col, 0.8 * a), NONE, 0.0, false);
    circle(g, x + r * 0.32, y - r * 0.18, r * 0.8, c4(0x0A1022, 0.55 * a), NONE, 0.0, false);
}

pub fn draw(g: &mut Game, era: u8, alpha: f32) {
    if alpha <= 0.01 { return; }
    let lay = g.lay;
    let (w, h, u) = (lay.w, lay.h, lay.u);
    let t = g.real;
    let ground = lay.sy + lay.sh * 0.82;
    let top = lay.sy;
    let a = alpha;
    match era {
        // on foot: pastel hills and soap bubbles
        0 => {
            ridge(g, ground - 30.0 * u, &[(1.1, 0.0, 14.0 * u), (2.3, 1.0, 6.0 * u)], 0x6A3C78, 0.55 * a, t * 4.0);
            ridge(g, ground + 10.0 * u, &[(1.6, 2.0, 12.0 * u), (3.1, 0.5, 5.0 * u)], 0x8E4C8A, 0.6 * a, -t * 6.0);
            for i in 0..14u32 {
                let x = fmod(h1(i * 7) * w + sin(t * 0.6 + i as f32) * 20.0 * u, w);
                let y = h - fmod(t * (14.0 + 10.0 * h1(i * 3)) * u + h1(i * 5) * h, h);
                let r = (5.0 + 9.0 * h1(i * 11)) * u;
                circle(g, x, y, r, c4(0xFFFFFF, 0.05 * a), c4(0xFFD9F0, 0.35 * a), 1.3 * u, false);
            }
        }
        // small motors: a city at dusk
        1 => {
            skyline(g, ground - 20.0 * u, 11, 9, 40.0, 120.0, 0x0D2B22, 0.75 * a, 0xFFE9A8, 0.5 * a);
            skyline(g, ground + 10.0 * u, 23, 12, 20.0, 70.0, 0x123D30, 0.85 * a, 0, 0.0);
            for i in 0..8 { let x = w * (i as f32 + 0.5) / 8.0; circle(g, x, ground + 4.0 * u, 3.0 * u, c4(0xFFD27A, 0.7 * a), NONE, 0.0, true); }
        }
        // cars: synthwave sun, mountains, rolling grid
        2 => {
            stripe_sun(g, lay.cx, ground - 40.0 * u, 70.0 * u, 0xFFE15A, 0xFF4FA3, 0.55 * a, 0x0B1022);
            mountains(g, ground, 5, 6, 70.0, 0x1A1440, 0.85 * a, false);
            persp_grid(g, ground, 0xFF4FD8, 0.45 * a, t);
        }
        // premium: night skyline with lit windows and a moon
        3 => {
            moon(g, lay.sx + lay.sw * 0.13, top + 196.0 * u, 16.0 * u, 0xEAF4FF, a);
            skyline(g, ground + 6.0 * u, 41, 10, 60.0, 170.0, 0x0A1730, 0.85 * a, 0xBFE6FF, 0.55 * a);
            ridge(g, ground + 30.0 * u, &[(0.5, 0.0, 2.0 * u)], 0x07101F, 0.9 * a, 0.0);
        }
        // supercars: red sunset, palms
        4 => {
            stripe_sun(g, lay.cx, ground - 30.0 * u, 92.0 * u, 0xFFB347, 0xFF2E4D, 0.5 * a, 0x2E0A0E);
            ridge(g, ground, &[(0.8, 0.3, 6.0 * u)], 0x1A0507, 0.9 * a, 0.0);
            for (i, px) in [0.08f32, 0.9, 0.97].iter().enumerate() {
                let x = w * px; let bx = x; let by = ground + 6.0 * u; let tx = x + 14.0 * u; let ty = ground - 120.0 * u - i as f32 * 14.0 * u;
                path(g, &[bx - 3.0 * u, by, tx - 2.0 * u, ty, tx + 2.0 * u, ty, bx + 3.0 * u, by], c4(0x1A0507, 0.95 * a), NONE, 0.0, true, false);
                for k in 0..6 {
                    let ang = -PI * 0.5 + (k as f32 - 2.5) * 0.55 + sin(t * 0.8 + k as f32) * 0.05;
                    let (dx, dy) = (cos(ang) * 46.0 * u, sin(ang) * 46.0 * u + 18.0 * u);
                    path(g, &[tx, ty, tx + dx * 0.5, ty + dy * 0.2 - 10.0 * u, tx + dx, ty + dy, tx + dx * 0.5, ty + dy * 0.2 - 4.0 * u], c4(0x1A0507, 0.95 * a), NONE, 0.0, true, false);
                }
            }
        }
        // hypercars: towers and sweeping searchlights
        5 => {
            for k in 0..3 {
                let x = w * (0.2 + 0.3 * k as f32);
                let ang = -PI * 0.5 + sin(t * 0.5 + k as f32 * 2.0) * 0.55;
                let (dx, dy) = (cos(ang), sin(ang));
                let l = h * 0.9; let sp = 0.06;
                path(g, &[x, ground, x + (dx - dy * sp) * l, ground + (dy + dx * sp) * l, x + (dx + dy * sp) * l, ground + (dy - dx * sp) * l], c4(0xC9B8FF, 0.09 * a), NONE, 0.0, true, true);
            }
            skyline(g, ground + 10.0 * u, 77, 8, 90.0, 250.0, 0x150B2E, 0.9 * a, 0xD9C8FF, 0.45 * a);
        }
        // monsters & records: desert, big sun, dust
        6 => {
            sun(g, lay.sx + lay.sw * 0.86, top + 200.0 * u, 24.0 * u, 0xFFC44D, a);
            ridge(g, ground - 10.0 * u, &[(0.7, 0.0, 16.0 * u), (1.9, 1.2, 6.0 * u)], 0x5A3510, 0.75 * a, t * 3.0);
            ridge(g, ground + 22.0 * u, &[(1.2, 2.2, 10.0 * u)], 0x3A2208, 0.9 * a, -t * 5.0);
            for i in 0..10u32 {
                let x = fmod(h1(i) * w + t * 40.0 * u * (0.5 + h1(i * 9)), w);
                let y = ground + (h1(i * 4) * 30.0 - 10.0) * u;
                circle(g, x, y, (6.0 + 10.0 * h1(i * 2)) * u, c4(0xC08A50, 0.12 * a), NONE, 0.0, false);
            }
        }
        // rails: snowy mountains and a stone viaduct
        7 => {
            mountains(g, ground - 30.0 * u, 17, 5, 120.0, 0x2A2440, 0.8 * a, true);
            let vy = ground - 6.0 * u;
            rect(g, 0.0, vy - 10.0 * u, w, 10.0 * u, c4(0x3A2A18, 0.9 * a), 0.0, false);
            let span = 46.0 * u;
            let n = (w / span) as i32 + 2;
            for i in 0..n {
                let x = i as f32 * span;
                rect(g, x, vy, 9.0 * u, h - vy, c4(0x3A2A18, 0.9 * a), 0.0, false);
            }
            path(g, &[0.0, vy - 12.0 * u, w, vy - 12.0 * u], NONE, c4(0xFFD08A, 0.5 * a), 1.5 * u, false, false);
        }
        // seas: moving waves and a moon path
        8 => {
            moon(g, lay.sx + lay.sw * 0.87, top + 196.0 * u, 16.0 * u, 0xEAF8FF, a);
            for k in 0..3 {
                let y0 = ground - 20.0 * u + k as f32 * 22.0 * u;
                let col = [0x0B4A6E, 0x08385A, 0x062A44][k];
                ridge(g, y0, &[(2.0 + k as f32 * 0.6, t * (1.4 + k as f32 * 0.4), 5.0 * u), (4.3, -t * 2.1, 2.5 * u)], col, 0.85 * a, 0.0);
            }
            for i in 0..12 { let y = ground - 10.0 * u + i as f32 * 5.0 * u; let x = lay.sx + lay.sw * 0.8 + sin(t * 2.0 + i as f32) * 6.0 * u; rect(g, x - 14.0 * u, y, 28.0 * u, 1.6 * u, c4(0xEAF8FF, 0.25 * a), 0.0, true); }
        }
        // skies: drifting clouds and birds
        9 => {
            sun(g, lay.sx + lay.sw * 0.13, top + 200.0 * u, 20.0 * u, 0xFFF3C4, a);
            for i in 0..7u32 {
                let x = fmod(h1(i * 13) * (w + 200.0 * u) + t * (8.0 + 10.0 * h1(i)) * u, w + 200.0 * u) - 100.0 * u;
                let y = top + (40.0 + h1(i * 5) * 160.0) * u + if i % 2 == 0 { lay.sh * 0.62 } else { 0.0 };
                cloud(g, x, y, (18.0 + 18.0 * h1(i * 3)) * u, 0xDCE9FF, 0.08 * a);
            }
            for i in 0..5u32 {
                let x = fmod(h1(i * 29) * w + t * 22.0 * u, w); let y = top + (90.0 + 40.0 * h1(i)) * u;
                let fl = sin(t * 6.0 + i as f32) * 3.0 * u;
                path(g, &[x - 7.0 * u, y - fl, x, y, x + 7.0 * u, y - fl], NONE, c4(0xDCE9FF, 0.4 * a), 1.4 * u, false, false);
            }
        }
        // space: a ringed planet and the curve of the Earth
        10 => {
            let px = lay.sx + lay.sw * 0.86; let py = top + 200.0 * u;
            circle(g, px, py, 22.0 * u, c4(0xC9A2FF, 0.35 * a), NONE, 0.0, false);
            let mut ring = Vec::new();
            for i in 0..=40 { let an = TAU * i as f32 / 40.0; ring.push(px + cos(an) * 40.0 * u); ring.push(py + sin(an) * 9.0 * u - cos(an) * 5.0 * u); }
            path(g, &ring, NONE, c4(0xE7D6FF, 0.35 * a), 3.0 * u, true, false);
            let er = w * 1.6;
            circle(g, lay.cx, ground + er - 30.0 * u, er, c4(0x0B2A5A, 0.8 * a), c4(0x6FB7FF, 0.5 * a), 3.0 * u, false);
        }
        // science fiction: neon grid floor and nebulae
        11 => {
            cmd(g, OP_GLOW, &[lay.sx + lay.sw * 0.2, top + 120.0 * u, 160.0 * u, 1.0, 0.3, 0.85, 0.16 * a]);
            cmd(g, OP_GLOW, &[lay.sx + lay.sw * 0.85, top + 60.0 * u, 120.0 * u, 0.2, 0.9, 1.0, 0.14 * a]);
            circle(g, lay.sx + lay.sw * 0.12, top + 200.0 * u, 12.0 * u, c4(0x7CFFD4, 0.4 * a), NONE, 0.0, false);
            persp_grid(g, ground + 4.0 * u, 0x14E8FF, 0.4 * a, t * 1.5);
        }
        // the gods: a temple and aurora curtains
        12 => {
            for k in 0..3 {
                let mut pts = Vec::new();
                let base_y = top + (70.0 + 26.0 * k as f32) * u;
                for i in 0..=30 { let x = w * i as f32 / 30.0; pts.push(x); pts.push(base_y + sin(i as f32 * 0.5 + t * 0.7 + k as f32) * 16.0 * u); }
                for i in (0..=30).rev() { let x = w * i as f32 / 30.0; pts.push(x); pts.push(base_y + 60.0 * u + sin(i as f32 * 0.5 + t * 0.7 + k as f32) * 16.0 * u); }
                let col = [0x7CFFB2, 0xFFC34D, 0xC59CFF][k];
                path(g, &pts, c4(col, 0.07 * a), NONE, 0.0, true, true);
            }
            let tw = 220.0 * u; let tx = lay.cx - tw * 0.5; let ty = ground - 70.0 * u;
            let col = 0x2A1606;
            path(g, &[tx - 10.0 * u, ty, lay.cx, ty - 40.0 * u, tx + tw + 10.0 * u, ty], c4(col, 0.9 * a), NONE, 0.0, true, false);
            rect(g, tx - 10.0 * u, ty, tw + 20.0 * u, 8.0 * u, c4(col, 0.9 * a), 0.0, false);
            for i in 0..7 { rect(g, tx + i as f32 * tw / 6.5, ty + 8.0 * u, 12.0 * u, 80.0 * u, c4(col, 0.9 * a), 0.0, false); }
            rect(g, 0.0, ty + 86.0 * u, w, h, c4(0x1E1004, 0.95 * a), 0.0, false);
        }
        // holy: golden rays over the hills and the walls of an old city
        13 => {
            cmd(g, OP_RAYS, &[lay.cx, top - 40.0 * u, 10.0 * u, h * 0.9, 14.0, t * 0.03, 1.0, 0.86, 0.55, 0.12 * a]);
            ridge(g, ground - 26.0 * u, &[(0.6, 0.4, 14.0 * u), (1.7, 2.0, 5.0 * u)], 0x5A3A16, 0.6 * a, 0.0);
            let wy = ground + 4.0 * u;
            let col = 0x3A240C;
            rect(g, 0.0, wy, w, h - wy, c4(col, 0.95 * a), 0.0, false);
            let n = (w / (14.0 * u)) as i32 + 1;
            for i in 0..n { if i % 2 == 0 { rect(g, i as f32 * 14.0 * u, wy - 7.0 * u, 8.0 * u, 8.0 * u, c4(col, 0.95 * a), 0.0, false); } }
            for (k, fx) in [0.18f32, 0.42, 0.7, 0.9].iter().enumerate() {
                let x = w * fx; let tw_ = (22.0 + 6.0 * k as f32) * u; let th = (40.0 + 14.0 * (k % 2) as f32) * u;
                rect(g, x - tw_ * 0.5, wy - th, tw_, th + 2.0 * u, c4(col, 0.95 * a), 0.0, false);
                if k == 1 {
                    // a dome on the tallest tower
                    let mut d = Vec::with_capacity(40);
                    let r = tw_ * 0.62;
                    for i in 0..=16 { let an = PI + PI * i as f32 / 16.0; d.push(x + cos(an) * r); d.push(wy - th + sin(an) * r * 0.95); }
                    path(g, &d, c4(0xC9973A, 0.9 * a), NONE, 0.0, true, false);
                }
            }
        }
        _ => {}
    }
}
