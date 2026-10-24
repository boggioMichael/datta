//! Builds the frame's draw list: fixed 16-float commands the browser executes
//! verbatim. Text goes into a UTF-8 side buffer and polygons into a float side
//! buffer, both referenced by (offset, length).

use core::fmt::Write;

use crate::game::*;
use crate::m::*;
use crate::opts::*;
use crate::tiers::*;

pub const CMD: usize = 16;
pub const OP_BG: f32 = 1.0;
pub const OP_RING: f32 = 2.0;
pub const OP_LINE: f32 = 3.0;
pub const OP_ITEM: f32 = 4.0;
pub const OP_DOT: f32 = 5.0;
pub const OP_STREAK: f32 = 6.0;
pub const OP_WAVE: f32 = 7.0;
pub const OP_TEXT: f32 = 8.0;
pub const OP_ICON: f32 = 9.0;
pub const OP_RECT: f32 = 10.0;
pub const OP_RAYS: f32 = 11.0;
pub const OP_FLASH: f32 = 12.0;
pub const OP_GLOW: f32 = 13.0;
pub const OP_COIN: f32 = 14.0;
pub const OP_FLAME: f32 = 15.0;
pub const OP_PATH: f32 = 16.0;
pub const OP_CIRCLE: f32 = 17.0;
pub const OP_CONF: f32 = 18.0;
pub const OP_SMOKE: f32 = 19.0;

pub const F_SANS: f32 = 0.0;
pub const F_SERIF: f32 = 1.0;
pub const F_LIGHT: f32 = 2.0;
pub const F_MONO: f32 = 3.0;

pub type C4 = (f32, f32, f32, f32);
pub const NONE: C4 = (0.0, 0.0, 0.0, 0.0);
#[inline] pub fn c4(c: u32, a: f32) -> C4 { let (r, g, b) = rgb(c); (r, g, b, a) }

pub fn cmd(g: &mut Game, op: f32, a: &[f32]) {
    g.draw.push(op);
    let n = a.len().min(CMD - 1);
    g.draw.extend_from_slice(&a[..n]);
    for _ in n..CMD - 1 { g.draw.push(0.0); }
}

/// Polygon / polyline from flat [x0, y0, x1, y1, …] screen coordinates.
pub fn path(g: &mut Game, pts: &[f32], fill: C4, stroke: C4, lw: f32, closed: bool, lighter: bool) {
    if pts.len() < 4 { return; }
    let off = g.paths.len() as f32;
    g.paths.extend_from_slice(pts);
    let n = (pts.len() / 2) as f32;
    cmd(g, OP_PATH, &[off, n, fill.0, fill.1, fill.2, fill.3, stroke.0, stroke.1, stroke.2, stroke.3, lw, if closed { 1.0 } else { 0.0 }, if lighter { 1.0 } else { 0.0 }]);
}
pub fn circle(g: &mut Game, x: f32, y: f32, r: f32, fill: C4, stroke: C4, lw: f32, lighter: bool) {
    cmd(g, OP_CIRCLE, &[x, y, r, fill.0, fill.1, fill.2, fill.3, stroke.0, stroke.1, stroke.2, stroke.3, lw, if lighter { 1.0 } else { 0.0 }]);
}
pub fn rect(g: &mut Game, x: f32, y: f32, w: f32, h: f32, c: C4, rad: f32, lighter: bool) {
    cmd(g, OP_RECT, &[x, y, w, h, c.0, c.1, c.2, c.3, rad, if lighter { 1.0 } else { 0.0 }]);
}

/// align: 0 centre, 1 start(left), 2 end(right); dir: 0 auto, 1 rtl, 2 ltr
#[allow(clippy::too_many_arguments)]
pub fn text(g: &mut Game, s: &str, x: f32, y: f32, size: f32, align: f32, font: f32, col: u32, alpha: f32, glow: f32, maxw: f32, dir: f32) {
    if s.is_empty() || alpha <= 0.003 { return; }
    let off = g.text.len() as f32;
    g.text.push_str(s);
    let len = s.len() as f32;
    let (r, gg, b) = rgb(col);
    cmd(g, OP_TEXT, &[x, y, size, align, font, r, gg, b, alpha, off, len, glow, maxw, dir]);
}

fn fmt_time(buf: &mut alloc::string::String, t: f32) {
    let t = t.max(0.0);
    let m = (t / 60.0) as u32;
    let s = t - m as f32 * 60.0;
    let _ = write!(buf, "{}:{:02}.{}", m, s as u32, ((s - floor(s)) * 10.0) as u32 % 10);
}

/// "12", "3.4K", "12M", "4.5B", "1.2T", then powers of ten with superscripts.
pub fn fmt_big(buf: &mut alloc::string::String, x: f64) {
    const SUP: [char; 10] = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    let x = if x.is_finite() && x > 0.0 { x } else { 0.0 };
    let one = |buf: &mut alloc::string::String, v: f64, unit: &str| {
        if v < 9.95 { let _ = write!(buf, "{:.1}{}", v, unit); } else { let _ = write!(buf, "{:.0}{}", v, unit); }
    };
    if x < 1000.0 { let _ = write!(buf, "{:.0}", x); }
    else if x < 1e6 { one(buf, x / 1e3, "K"); }
    else if x < 1e9 { one(buf, x / 1e6, "M"); }
    else if x < 1e12 { one(buf, x / 1e9, "B"); }
    else if x < 1e15 { one(buf, x / 1e12, "T"); }
    else {
        let e = log10_64(x) as i32;
        buf.push_str("10");
        let mut digits = alloc::vec::Vec::new();
        let mut k = e.max(0);
        while k > 0 { digits.push((k % 10) as usize); k /= 10; }
        for d in digits.iter().rev() { buf.push(SUP[*d]); }
    }
}

const MONO_W: f32 = 0.6;
/// Width of `big_number`'s output, in pixels.
pub fn big_number_width(x: f64, size: f32, prefix: &str) -> f32 {
    let mut buf = alloc::string::String::new();
    if x < 1e15 { buf.push_str(prefix); fmt_big(&mut buf, x); return buf.chars().count() as f32 * size * MONO_W; }
    let e = log10_64(x).max(0.0) as i32;
    let ne = alloc::format!("{}", e).len();
    (prefix.chars().count() + 2) as f32 * size * MONO_W + ne as f32 * size * 0.62 * MONO_W
}
/// A number in monospace, "12.3M" style, or 10 with a raised exponent past a quadrillion.
/// `side` 1: starts at x and runs right; −1: ends at x. Returns the width.
pub fn big_number(g: &mut Game, x: f64, at: f32, y: f32, size: f32, side: f32, prefix: &str, col: u32, a: f32) -> f32 {
    let w = big_number_width(x, size, prefix);
    let x0 = if side > 0.0 { at } else { at - w };
    let mut buf = alloc::string::String::new();
    buf.push_str(prefix);
    if x < 1e15 {
        fmt_big(&mut buf, x);
        text(g, &buf, x0, y, size, 1.0, F_MONO, col, a, 0.0, 0.0, 2.0);
    } else {
        buf.push_str("10");
        text(g, &buf, x0, y, size, 1.0, F_MONO, col, a, 0.0, 0.0, 2.0);
        let e = log10_64(x).max(0.0) as i32;
        let es = alloc::format!("{}", e);
        let bw = buf.chars().count() as f32 * size * MONO_W;
        text(g, &es, x0 + bw, y - size * 0.42, size * 0.62, 1.0, F_MONO, col, a, 0.0, 0.0, 2.0);
    }
    w
}
/// A small magnifying glass.
pub fn magnifier(g: &mut Game, x: f32, y: f32, r: f32, col: u32, a: f32) {
    circle(g, x - r * 0.25, y - r * 0.25, r, NONE, c4(col, a), r * 0.38, false);
    path(g, &[x + r * 0.45, y + r * 0.45, x + r * 1.25, y + r * 1.25], NONE, c4(col, a), r * 0.45, false, false);
}

#[inline] fn hash(a: u32) -> f32 { let mut x = a.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B; x ^= x >> 15; x = x.wrapping_mul(0x2C1B_3C6D); x ^= x >> 12; (x & 0xFFFF) as f32 / 65535.0 }

/// The spout: a nozzle that only ever pours crawling babies, the stream of them,
/// and — once they're too small to see — the ball they clump into in the funnel.
fn funnel(g: &mut Game, to: &dyn Fn(V2) -> (f32, f32), sc: f32, white: f32) {
    let lay = g.lay;
    let u = lay.u;
    let top = V2::new(0.0, lay.chute_top);
    let (nx, ny) = to(top);
    let fp = g.funnel_p();
    let (fx, fy) = to(fp);
    let nw = (CHUTE_W * sc * 1.25).max(14.0 * u);
    // nozzle
    rect(g, nx - nw * 0.5, ny - 14.0 * u, nw, 16.0 * u, (0.85, 0.88, 0.95, 0.95 * (1.0 - white)), 5.0 * u, false);
    rect(g, nx - nw * 0.62, ny - 18.0 * u, nw * 1.24, 7.0 * u, (0.95, 0.97, 1.0, 0.95 * (1.0 - white)), 3.5 * u, false);
    rect(g, nx - nw * 0.5, ny - 3.0 * u, nw, 3.0 * u, (0.3, 0.32, 0.42, 0.8 * (1.0 - white)), 1.5 * u, false);
    // the baby on the label: this spout pours nothing else
    cmd(g, OP_ICON, &[0.0, nx, ny - 26.0 * u, 9.0 * u, 0.95 * (1.0 - white)]);
    let s = g.spout;
    if s == 0 { return; }
    // a stream of babies falls into the funnel
    let baby_px = g.radius_for(0) * sc;
    let n = 14u32;
    let rate = 0.9 + 0.25 * (s as f32).min(8.0);
    for i in 0..n {
        let ph = fmod(g.real * rate + i as f32 / n as f32, 1.0);
        let y = lerp(ny, fy, ph * ph);
        let x = nx + sin(i as f32 * 2.3 + g.real * 3.0) * nw * 0.18 * (1.0 - ph);
        let a = (1.0 - white) * smooth(ph * 6.0) * (1.0 - smooth((ph - 0.85) / 0.15));
        if baby_px >= 3.0 {
            cmd(g, OP_ICON, &[0.0, x, y, baby_px.min(12.0 * u), a]);
        } else {
            let c = rgb(tier(0).color);
            cmd(g, OP_DOT, &[x, y, 1.6 * u, c.0, c.1, c.2, a * 0.9, 1.0]);
        }
    }
    // the ball forming out of them
    let k = smooth(g.form);
    let t = g.form_tier;
    let rr = g.radius_for(t) * sc * (0.25 + 0.75 * k);
    let c = rgb(tier(t).color);
    cmd(g, OP_GLOW, &[fx, fy, rr * 2.6, c.0, c.1, c.2, (0.2 + 0.35 * k) * (1.0 - white)]);
    cmd(g, OP_ITEM, &[t as f32, fx, fy, rr, 0.0, 0.6 * k, (0.25 + 0.6 * k) * (1.0 - white), 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, g.opts.get(Opt::BallStyle)]);
    // how many babies go into each ball
    let mut buf = alloc::string::String::new();
    buf.push('×');
    fmt_big(&mut buf, libm_pow64(2.0, s as f64));
    let side = if g.lang_he { -1.0 } else { 1.0 };
    let lx = nx + side * (nw * 0.5 + 10.0 * u);
    text(g, &buf, lx, ny - 8.0 * u, 11.0 * u, if g.lang_he { 2.0 } else { 1.0 }, F_MONO, 0xFFE6F0, 0.9 * (1.0 - white), 0.0, 0.0, 2.0);
}

pub fn build(g: &mut Game) {
    g.draw.clear();
    g.text.clear();
    g.paths.clear();
    let lay = g.lay;
    if lay.w <= 0.0 { return; }
    let he = g.lang_he;
    let dir = if he { 1.0 } else { 2.0 };

    // ── camera: punch-zoom around the last big merge + shake
    let sh = if g.opts.on(Opt::ScreenShake) { g.shake } else { 0.0 };
    let amp = sh * sh * lay.sw * 0.035;
    let ox = sin(g.real * 61.0) * amp + sin(g.real * 37.0) * amp * 0.5;
    let oy = cos(g.real * 53.0) * amp + sin(g.real * 29.0) * amp * 0.5;
    let (z, pan) = g.cam();
    let sc = lay.scale * z;
    let to = |p: V2| -> (f32, f32) { (lay.cx + (p.x - pan.x) * sc + ox, lay.cy + (p.y - pan.y) * sc + oy) };

    if g.story_on {
        crate::story::draw(g);
        return;
    }

    // ── the world around the bubble: sky, the era's place, drifting motes, the giants to come
    // God's light fills the world; when the bubble bursts it floods everything
    let white = if g.finished { 0.1 * smooth((g.god_t - 0.8) / 3.0) + 0.9 * smooth((g.god_t - BURST_AT - 0.35) / 1.1) } else { 0.0 };
    crate::world::back(g, white);

    // ── God light behind everything
    let mut god_pos = None;
    for b in &g.bodies { if b.alive && b.tier == GOD { god_pos = Some((b.p, b.r)); } }
    if let Some((p, r)) = god_pos {
        let (x, y) = to(p);
        let k = if g.finished { smooth(g.god_t / 3.0) } else { 0.5 };
        cmd(g, OP_GLOW, &[x, y, r * sc * (3.0 + 5.0 * k), 1.0, 0.96, 0.82, 0.55 + 0.4 * k]);
        cmd(g, OP_RAYS, &[x, y, r * sc * 0.9, lay.h * (0.6 + 0.8 * k), 24.0, g.real * 0.12, 1.0, 0.95, 0.8, 0.22 + 0.4 * k]);
        cmd(g, OP_RAYS, &[x, y, r * sc * 0.9, lay.h * (0.4 + 0.6 * k), 11.0, -g.real * 0.07, 1.0, 1.0, 1.0, 0.18 + 0.3 * k]);
    }

    let bubble = crate::vessel::on(g);
    let jy = g.join_y();
    let thick = (0.022 * lay.scale * z).max(3.0);
    if bubble {
        // ── the bubble of life: its fluid, the stem feeding it, soft shadows inside
        crate::vessel::membrane(g, &to, sc, white, 0.0);
        if g.started && g.burst_t < 0.0 { crate::vessel::stem(g, &to, sc, white); }
        crate::vessel::shadows(g, &to, sc, white);
    } else {
        // ── the play area: a dark glass disc so the balls read over any scenery
        let ring_px = g.ring_r * sc;
        let (rcx, rcy) = to(V2::default());
        if white < 0.99 {
            circle(g, rcx, rcy, ring_px, (0.0, 0.0, 0.02, 0.42 * (1.0 - white)), NONE, 0.0, false);
        }
        // ── ring
        let gap = asin(CHUTE_W / g.ring_r);
        let pc = rgb(g.ring_col);
        let theme = g.opts.get(Opt::Theme);
        let wob = g.ring_wob * g.ring_wob * lay.u * 7.0 * if g.drama() > 0.0 { 1.0 } else { 0.4 };
        cmd(g, OP_RING, &[rcx, rcy, ring_px + thick * 0.5, thick, g.hue, 0.6 + g.ring_pulse, theme, gap, 1.0 - white * 0.6, pc.0, pc.1, pc.2, g.cat as f32, g.ring_pulse, wob]);
        // ── chute walls
        let top_y = (lay.chute_top_px - 6.0 * lay.u - lay.cy) / lay.scale;
        for sxs in [-1.0f32, 1.0] {
            let (x1, y1) = to(V2::new(sxs * CHUTE_W, top_y));
            let (x2, y2) = to(V2::new(sxs * (CHUTE_W + 0.004), jy + 0.004));
            cmd(g, OP_LINE, &[x1, y1, x2, y2, (thick * 0.55).max(2.5), 1.0, 1.0, 1.0, 0.92 * (1.0 - white * 0.7), 0.8]);
        }
        if !g.finished && g.mode != Mode::Sandbox && g.started {
            funnel(g, &to, sc, white);
        }
    }

    // ── trails
    if g.opts.on(Opt::Trails) {
        for i in 0..g.bodies.len() {
            let b = g.bodies[i];
            if !b.alive || b.v.len2() < 0.5 { continue; }
            let (x1, y1) = to(b.trail[3]);
            let (x2, y2) = to(b.p);
            let c = rgb(tier(b.tier).color);
            cmd(g, OP_STREAK, &[x1, y1, x2, y2, b.r * sc * 1.2, c.0, c.1, c.2, 0.18]);
        }
    }

    // ── speed lines from the last new tier
    if g.sl_t > 0.0 && g.drama() > 0.0 {
        let k = clamp(g.sl_t / 0.6, 0.0, 1.0);
        let (x, y) = to(g.sl_p);
        let c = rgb(g.sl_col);
        let n = 22;
        let seed = (g.sl_p.x * 1000.0) as i32 as u32 ^ ((g.sl_p.y * 1000.0) as i32 as u32).wrapping_mul(7);
        let e = ease_out(1.0 - k);
        for i in 0..n {
            let a = i as f32 / n as f32 * TAU + hash(seed + i) * 0.25;
            let r0 = lay.u * (18.0 + 70.0 * e + 16.0 * hash(seed + i * 3));
            let len = lay.u * (14.0 + 34.0 * hash(seed + i * 5 + 1)) * k;
            let (ca_, sa_) = (cos(a), sin(a));
            let cc = if i % 3 == 0 { (1.0, 1.0, 1.0) } else { c };
            cmd(g, OP_STREAK, &[x + ca_ * r0, y + sa_ * r0, x + ca_ * (r0 + len), y + sa_ * (r0 + len), lay.u * (1.0 + 2.2 * k), cc.0, cc.1, cc.2, 0.7 * k]);
        }
    }

    // ── rides that just evolved: the far half of their helix, behind them
    evo_pass(g, &to, sc, lay.u, false);

    // ── items (smaller first so big ones sit on top)
    let labels = g.opts.on(Opt::Labels);
    let style = g.opts.get(Opt::BallStyle);
    let mut order: alloc::vec::Vec<(f32, usize)> = alloc::vec::Vec::with_capacity(g.bodies.len());
    for (i, b) in g.bodies.iter().enumerate() { if b.alive { order.push((b.r, i)); } }
    order.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(core::cmp::Ordering::Equal));
    let armed = g.upgrade_armed;
    for (_, i) in order {
        let b = g.bodies[i];
        let (x, y) = to(b.p);
        // pop: overshoot then settle, like a jelly
        let popk = if b.pop > 0.0 { sin(b.pop * PI * 1.5) * 0.24 * b.pop } else { 0.0 };
        let mut rp = b.r * sc * (1.0 + popk);
        let mut alpha = 1.0;
        if b.dying > 0.0 { let k = clamp(b.dying / 0.45, 0.0, 1.0); rp *= 0.4 + 0.6 * k; alpha = k; }
        let la = if labels && rp > 21.0 { clamp((rp - 21.0) / 8.0, 0.0, 1.0) } else { 0.0 };
        let hl = if armed && b.tier + 1 < GOD { 0.5 + 0.5 * sin(g.real * 8.0 + b.id as f32) } else { 0.0 };
        let glow = 0.3 + 0.5 * (b.tier as f32 / GOD as f32);
        let tilt = 0.32 * sin(b.angle);
        // living cells breathe
        if bubble { rp *= 1.0 + 0.014 * sin(g.real * 1.7 + b.id as f32 * 1.3); }
        cmd(g, OP_ITEM, &[b.tier as f32, x, y, rp, tilt, b.flash, alpha, la, glow, b.orphan_t.min(1.0), hl, if he { 1.0 } else { 0.0 }, b.squash, b.squash_a, style]);
    }

    // ── …and the near half in front
    evo_pass(g, &to, sc, lay.u, true);

    // ── the bubble's wall, in front of what it holds
    if bubble { crate::vessel::membrane(g, &to, sc, white, 1.0); }

    // ── particles
    for i in 0..g.parts.len() {
        let q = g.parts[i];
        let (x, y) = to(q.p);
        let k = clamp(q.life / q.max.max(1e-3), 0.0, 1.0);
        let c = rgb(q.color);
        match q.kind {
            0 => cmd(g, OP_DOT, &[x, y, q.size * (0.5 + 0.5 * k), c.0, c.1, c.2, k, 1.0]),
            1 => {
                let (x0, y0) = to(q.p - q.v * 0.05);
                cmd(g, OP_STREAK, &[x0, y0, x, y, q.size * k, c.0, c.1, c.2, k]);
            }
            2 => {
                let rr = q.size * sc * (0.3 + 0.9 * ease_out(1.0 - k));
                cmd(g, OP_WAVE, &[x, y, rr, (2.5 * k + 0.5) * (1.0 + q.size) * lay.u, c.0, c.1, c.2, k * 0.45]);
            }
            3 => cmd(g, OP_COIN, &[x, y, q.size * lay.u, q.angle, k]),
            4 => cmd(g, OP_FLAME, &[x, y, q.size * (0.6 + 0.6 * k) * lay.u, c.0, c.1, c.2, k]),
            6 => cmd(g, OP_CONF, &[x, y, q.size * lay.u, q.angle, c.0, c.1, c.2, clamp(k * 2.0, 0.0, 1.0)]),
            7 => {
                let rr = q.size * sc * (0.6 + 0.8 * (1.0 - k));
                cmd(g, OP_SMOKE, &[x, y, rr, c.0, c.1, c.2, 0.5 * k]);
            }
            8 => cmd(g, OP_DOT, &[x, y, q.size * lay.u, c.0, c.1, c.2, k, 0.0]),
            9 => {
                let e = ease_out(1.0 - k);
                let rr = q.size * sc * (0.15 + 0.85 * e);
                cmd(g, OP_WAVE, &[x, y, rr, lay.u * (2.0 + 16.0 * k), c.0, c.1, c.2, k * 0.8]);
            }
            10 => {
                let rr = q.size * sc * (0.35 + 0.65 * k);
                cmd(g, crate::world::OP_BLOB, &[x, y, rr, 0.22, q.angle + g.real * 7.0, c.0, c.1, c.2, clamp(k * 1.6, 0.0, 0.9), 1.0]);
            }
            _ => {}
        }
    }

    // ── lightning
    for k in 0..g.bolts.len() {
        let bo = g.bolts[k];
        let a = clamp(bo.t / bo.max, 0.0, 1.0);
        let (x0, y0) = to(bo.a); let (x1, y1) = to(bo.b);
        let mut pts: alloc::vec::Vec<f32> = alloc::vec::Vec::with_capacity(40);
        let segs = 12;
        let (dx, dy) = (x1 - x0, y1 - y0);
        let len = sqrt(dx * dx + dy * dy).max(1.0);
        let (nx, ny) = (-dy / len, dx / len);
        let flick = (g.real * 30.0) as u32;
        for s in 0..=segs {
            let f = s as f32 / segs as f32;
            let j = if s == 0 || s == segs { 0.0 } else { (hash(bo.seed ^ (s as u32 * 97) ^ flick) - 0.5) * len * 0.16 };
            pts.push(x0 + dx * f + nx * j); pts.push(y0 + dy * f + ny * j);
        }
        let c = rgb(bo.col);
        path(g, &pts, NONE, (c.0, c.1, c.2, 0.35 * a), lay.u * 7.0, false, true);
        path(g, &pts, NONE, (1.0, 1.0, 1.0, 0.95 * a), lay.u * 2.0, false, true);
    }

    // ── near motes out of focus, the vignette, shade behind the words
    crate::world::front(g, white);

    // ── HUD
    let s = lay.u;
    let hud_y = lay.hud_y;
    if g.started {
        let tmax = g.run_max;
        let tt = tier(tmax);
        let name = if he { tt.he } else { tt.en };
        let chip_w = 262.0 * s;
        let chip_h = 38.0 * s;
        let cx = lay.sx + lay.sw * 0.5;
        rect(g, cx - chip_w * 0.5, hud_y, chip_w, chip_h, (0.06, 0.06, 0.1, 0.82), chip_h * 0.5, false);
        rect(g, cx - chip_w * 0.5, hud_y, chip_w, chip_h, (1.0, 1.0, 1.0, 0.08), chip_h * 0.5, false);
        let ic = 15.0 * s;
        let icon_x = if he { cx + chip_w * 0.5 - ic - 6.0 * s } else { cx - chip_w * 0.5 + ic + 6.0 * s };
        cmd(g, OP_ICON, &[tmax as f32, icon_x, hud_y + chip_h * 0.5, ic, 1.0]);
        let tx = if he { icon_x - ic - 8.0 * s } else { icon_x + ic + 8.0 * s };
        text(g, name, tx, hud_y + chip_h * 0.5 - 1.0 * s, 14.5 * s, 1.0, F_SANS, 0xFFFFFF, 0.95, 0.0, chip_w - ic * 2.0 - 96.0 * s, dir);
        let mut buf = alloc::string::String::new();
        let _ = write!(buf, "{}/{}", tmax as u32 + 1, N_TIERS);
        let nx = if he { cx - chip_w * 0.5 + 12.0 * s } else { cx + chip_w * 0.5 - 12.0 * s };
        text(g, &buf, nx, hud_y + chip_h * 0.5, 12.0 * s, if he { 1.0 } else { 2.0 }, F_MONO, tt.color, 0.95, 0.0, 0.0, 2.0);
        // timer / countdown
        if g.opts.on(Opt::Timer) && g.mode != Mode::Sandbox && g.mode != Mode::Watch {
            buf.clear();
            if g.mode == Mode::TimeAttack { fmt_time(&mut buf, g.ta_left); } else { fmt_time(&mut buf, g.time); }
            let col = if g.mode == Mode::TimeAttack && g.ta_left < 10.0 { 0xFF5A4A } else { 0xFFFFFF };
            let tx = if he { lay.sx + lay.sw * 0.92 } else { lay.sx + lay.sw * 0.08 };
            text(g, &buf, tx, lay.timer_y, 12.0 * s, if he { 2.0 } else { 1.0 }, F_MONO, col, 0.75, 0.0, 0.0, 2.0);
        }
        // the ladder: a turning double helix, one rung per tier, lit by era as you climb
        if g.opts.on(Opt::Ladder) {
            let ly = lay.ladder_y;
            let lw = lay.sw * 0.84;
            let lx = lay.sx + (lay.sw - lw) * 0.5;
            let n = N_TIERS;
            let step = lw / n as f32;
            let amp = 4.6 * s;
            let turns = 6.0;
            let ph = g.real * 0.9;
            let ang = |k: f32| k / n as f32 * turns * TAU + ph;
            for strand in 0..2 {
                let off = strand as f32 * PI;
                let mut pts: alloc::vec::Vec<f32> = alloc::vec::Vec::with_capacity(2 * 80);
                for j in 0..=78 {
                    let k = j as f32 / 78.0 * n as f32;
                    pts.push(lx + k * step); pts.push(ly + sin(ang(k) + off) * amp);
                }
                path(g, &pts, NONE, (1.0, 1.0, 1.0, 0.22), 1.1 * s, false, false);
            }
            let mut cur_x = 0.0;
            for k in 0..n {
                let kk = if he { n - 1 - k } else { k };
                let seen = g.run_seen.has(kk as u8) || (kk as u8) <= g.run_max;
                let c = rgb(CATS[TIERS[kk].cat as usize].accent);
                let cur = kk as u8 == g.run_max;
                let a0 = ang(k as f32 + 0.5);
                let (y1, y2) = (ly + sin(a0) * amp, ly - sin(a0) * amp);
                let depth = 0.6 + 0.4 * cos(a0);
                let al = if cur { 1.0 } else if seen { 0.9 * depth } else { 0.13 * depth };
                let x = lx + (k as f32 + 0.5) * step;
                let (top, h) = if y1 < y2 { (y1, y2 - y1) } else { (y2, y1 - y2) };
                rect(g, x - step * 0.32, top, (step * 0.64).max(0.8), h.max(1.0), (c.0, c.1, c.2, al), 0.0, false);
                if cur { cur_x = x; }
            }
            // the bead of the current tier
            let cc = rgb(tier(g.run_max).color);
            cmd(g, OP_GLOW, &[cur_x, ly, 14.0 * s, cc.0, cc.1, cc.2, 0.7]);
            circle(g, cur_x, ly, 3.2 * s, (1.0, 1.0, 1.0, 0.95), NONE, 0.0, false);
        }
        // how far the camera has pulled back since the first baby
        let zx = if he { lay.sx + lay.sw * 0.08 } else { lay.sx + lay.sw * 0.92 };
        if g.mode != Mode::Sandbox || g.base > 0.5 {
            // RTL: the glass sits at the screen edge and the number runs inward; LTR mirrored
            let (glass_x, num_at, side) = if he { (zx, zx + 10.0 * s, 1.0) } else { (zx, zx - 10.0 * s, -1.0) };
            big_number(g, g.zoom_factor(), num_at, lay.timer_y, 12.0 * s, side, "×", 0xBFD8FF, 0.85);
            magnifier(g, glass_x, lay.timer_y, 4.5 * s, 0xBFD8FF, 0.85);
        }
        // speed badge
        let sp = g.opts.get(Opt::Speed);
        if (sp - 1.0).abs() > 0.01 || g.tools[Tool::SlowMo as usize].active > 0.0 {
            buf.clear();
            let eff = if g.tools[Tool::SlowMo as usize].active > 0.0 { sp * 0.25 } else { sp };
            let _ = write!(buf, "×{}", if eff < 1.0 { if eff < 0.2 { "⅛" } else if eff < 0.4 { "¼" } else { "½" } } else if eff < 1.5 { "1" } else if eff < 3.0 { "2" } else if eff < 6.0 { "4" } else { "8" });
            let bx = if he { lay.sx + lay.sw * 0.08 } else { lay.sx + lay.sw * 0.92 };
            text(g, &buf, bx, lay.timer_y + 17.0 * s, 12.0 * s, if he { 1.0 } else { 2.0 }, F_MONO, 0xFFD54F, 0.9, 0.0, 0.0, 2.0);
        }
    }

    // ── combo counter
    if g.combo_show > 0.0 && g.combo_shown >= 2 {
        let k = clamp(g.combo_show / 1.3, 0.0, 1.0);
        let age = 1.3 - g.combo_show;
        let pop = 1.0 + 0.5 * (1.0 - ease_out(age / 0.18));
        let n = g.combo_shown;
        let (col, word_he, word_en) = if n >= 8 { (0xFFFFFF, "תגובת שרשרת אלוהית", "GODLIKE CHAIN") } else if n >= 6 { (0xFF52DC, "אולטרה שרשרת", "ULTRA CHAIN") } else if n >= 4 { (0xFFB627, "מגה שרשרת", "MEGA CHAIN") } else if n >= 3 { (0x7CFFB2, "סופר שרשרת", "SUPER CHAIN") } else { (0xFFE27A, "שרשרת", "CHAIN") };
        let mut buf = alloc::string::String::new();
        let _ = write!(buf, "×{}", n);
        // floats up from the merge that made it
        let (px, py) = to(g.combo_p);
        let rr = g.ring_r * lay.scale;
        let x = clamp(px, lay.cx - rr * 0.7, lay.cx + rr * 0.7);
        let y = py - 30.0 * s - age * 40.0 * s;
        text(g, &buf, x, y, 30.0 * s * pop, 0.0, F_SANS, col, k, 1.0, 0.0, 2.0);
        text(g, if he { word_he } else { word_en }, x, y + 22.0 * s, 11.0 * s, 0.0, F_MONO, col, k * 0.9, 0.5, rr * 0.8, dir);
    }

    // ── banner for a new tier: the name slams in
    if g.banner_t > 0.0 && g.banner_tier >= 0 && !(g.finished && g.banner_tier as u8 == GOD) && g.era_t <= 0.0 {
        let t = g.banner_tier as u8;
        let tt = tier(t);
        let life = if t == GOD { 9.0 } else { 2.4 };
        let age = life - g.banner_t;
        let a = clamp(age / 0.12, 0.0, 1.0) * clamp(g.banner_t / 0.45, 0.0, 1.0);
        let slam = if g.drama() > 0.0 { 1.0 + 0.9 * (1.0 - ease_out(age / 0.22)) } else { 1.0 };
        let by = lay.cy - g.ring_r * lay.scale * 0.46;
        let bx = lay.sx + lay.sw * 0.5;
        let name = if he { tt.he } else { tt.en };
        let fs = (24.0 + 12.0 * (t as f32 / GOD as f32)) * s * slam;
        // a soft shade so the words read over any world
        let band_t = by - fs * 1.25 - 10.0 * s; let band_b = by + fs * 0.62 + 52.0 * s;
        let mid = (band_t + band_b) * 0.5;
        cmd(g, crate::story::OP_VGRAD, &[band_t, mid, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.46 * a, 0.0, lay.w]);
        cmd(g, crate::story::OP_VGRAD, &[mid, band_b, 0.0, 0.0, 0.0, 0.46 * a, 0.0, 0.0, 0.0, 0.0, 0.0, lay.w]);
        let blurb = if he { tt.blurb_he } else { tt.blurb_en };
        text(g, name, bx, by, fs, 0.0, F_SANS, 0xFFFFFF, a, 1.0, lay.sw * 0.88, dir);
        let qf = if matches!(tt.cat, Cat::Wonders | Cat::Heavens | Cat::God) { F_SERIF } else { F_LIGHT };
        let bc = { let c = mix_rgb(rgb(tt.color), (1.0, 1.0, 1.0), 0.55); ((c.0 * 255.0) as u32) << 16 | ((c.1 * 255.0) as u32) << 8 | (c.2 * 255.0) as u32 };
        text(g, blurb, bx, by + fs * 0.62 + 16.0 * s, 13.0 * s, 0.0, qf, bc, a * 0.95, 0.4, lay.sw * 0.84, dir);
        let mut buf = alloc::string::String::new();
        if he { let _ = write!(buf, "דרגה {} מתוך {}", t as u32 + 1, N_TIERS); } else { let _ = write!(buf, "TIER {} OF {}", t as u32 + 1, N_TIERS); }
        text(g, &buf, bx, by - fs * 0.62 - 6.0 * s, 11.0 * s, 0.0, F_MONO, tt.color, a * 0.85, 0.0, 0.0, dir);
        if t > 0 && t != GOD {
            // its real size: this many babies wide
            let y = by + fs * 0.62 + 38.0 * s;
            let w = big_number_width(Game::babies_wide(g.grow(), t), 11.0 * s, "×");
            let ic = 8.0 * s;
            let x0 = bx - (w + ic * 2.0 + 4.0 * s) * 0.5;
            cmd(g, OP_ICON, &[0.0, x0 + ic, y, ic, a * 0.9]);
            big_number(g, Game::babies_wide(g.grow(), t), x0 + ic * 2.0 + 4.0 * s, y, 11.0 * s, 1.0, "×", 0xFFFFFF, a * 0.75);
        }
        if g.banner_new && age > 0.15 {
            let k = clamp((age - 0.15) / 0.12, 0.0, 1.0);
            let st = 1.0 + 0.8 * (1.0 - ease_out(k));
            let w = 64.0 * s * st; let h = 22.0 * s * st;
            let sxp = if he { bx - lay.sw * 0.34 } else { bx + lay.sw * 0.34 };
            let syp = by - fs * 0.62 - 12.0 * s;
            rect(g, sxp - w * 0.5, syp - h * 0.5, w, h, (1.0, 0.25, 0.35, a * k), 6.0 * s, false);
            text(g, if he { "חדש!" } else { "NEW!" }, sxp, syp, 13.0 * s * st, 0.0, F_SANS, 0xFFFFFF, a * k, 0.0, 0.0, dir);
        }
    }

    // ── an evolution: the new era's name over the track of every era from the first baby to God
    if g.era_t > 0.0 && g.drama() > 0.0 {
        let life = ERA_CARD;
        let age = life - g.era_t;
        let a = clamp(age / 0.25, 0.0, 1.0) * clamp(g.era_t / 0.6, 0.0, 1.0);
        let c = g.era_card as usize;
        let ci = &CATS[c];
        let slide = (1.0 - ease_out(age / 0.45)) * lay.sw * 0.6 * if he { -1.0 } else { 1.0 };
        let y = lay.cy - g.ring_r * lay.scale * 0.16;
        let x = lay.sx + lay.sw * 0.5;
        // a soft band of shade and a glow of the new world's light
        cmd(g, crate::story::OP_VGRAD, &[y - 100.0 * s, y, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.52 * a, 0.0, lay.w]);
        cmd(g, crate::story::OP_VGRAD, &[y, y + 150.0 * s, 0.0, 0.0, 0.0, 0.52 * a, 0.0, 0.0, 0.0, 0.0, 0.0, lay.w]);
        let acc_ = rgb(ci.accent);
        cmd(g, OP_GLOW, &[x, y, lay.sw * 0.7, acc_.0, acc_.1, acc_.2, 0.22 * a]);
        let mut buf = alloc::string::String::new();
        if he { let _ = write!(buf, "אבולוציה · עידן {} מתוך {}", c + 1, N_CATS - 1); } else { let _ = write!(buf, "EVOLUTION · ERA {} OF {}", c + 1, N_CATS - 1); }
        // the era's colour, lifted toward white so it reads over its own world
        let lift = |k: f32| -> u32 { let c = mix_rgb(acc_, (1.0, 1.0, 1.0), k); ((c.0 * 255.0) as u32) << 16 | ((c.1 * 255.0) as u32) << 8 | (c.2 * 255.0) as u32 };
        text(g, &buf, x - slide * 0.4, y - 40.0 * s, 12.0 * s, 0.0, F_MONO, lift(0.3), a, 0.0, 0.0, dir);
        text(g, if he { ci.he } else { ci.en }, x + slide, y, 44.0 * s, 0.0, F_SANS, 0xFFFFFF, a, 1.0, lay.sw * 0.92, dir);
        text(g, if he { ci.sub_he } else { ci.sub_en }, x - slide * 0.6, y + 40.0 * s, 15.0 * s, 0.0, F_LIGHT, lift(0.5), a * 0.95, 0.5, lay.sw * 0.9, dir);
        // the track: every era a node; the path lights up to the new one
        let ty = y + 86.0 * s;
        let n = N_CATS;
        let tw = lay.sw * 0.88;
        let step = tw / (n - 1) as f32;
        let node_x = |k: usize| -> f32 { let f = k as f32 * step; if he { x + tw * 0.5 - f } else { x - tw * 0.5 + f } };
        let prev = g.prev_cat.min(c as u8) as usize;
        let grow = smooth((age - 0.25) / 0.8);
        let reach = lerp(node_x(prev), node_x(c), grow);
        // a dark pill under the road so it reads over a busy bubble
        let pad = 16.0 * s;
        rect(g, x - tw * 0.5 - pad, ty - 13.0 * s, tw + pad * 2.0, 26.0 * s, (0.02, 0.03, 0.05, 0.42 * a), 13.0 * s, false);
        rect(g, x - tw * 0.5, ty - 1.0 * s, tw, 2.0 * s, (1.0, 1.0, 1.0, 0.22 * a), 1.0 * s, false);
        let (l0, l1) = if he { (reach, node_x(0)) } else { (node_x(0), reach) };
        rect(g, l0, ty - 2.0 * s, (l1 - l0).max(0.0), 4.0 * s, (acc_.0, acc_.1, acc_.2, 0.95 * a), 2.0 * s, true);
        if grow > 0.0 && grow < 1.0 {
            // the spark running down the road
            cmd(g, OP_GLOW, &[reach, ty, 16.0 * s, acc_.0, acc_.1, acc_.2, 0.8 * a]);
            circle(g, reach, ty, 3.4 * s, (1.0, 1.0, 1.0, a), NONE, 0.0, true);
        }
        for k in 0..n {
            let nx = node_x(k);
            let kc = rgb(CATS[k].accent);
            let reached = k < c || (k == c && grow >= 0.999) || g.era_time[k] >= 0.0 && k != c;
            if k == c { continue; }
            if k == n - 1 {
                // God: a small light at the end of the road
                cmd(g, OP_GLOW, &[nx, ty, 16.0 * s, 1.0, 0.95, 0.8, 0.6 * a]);
                circle(g, nx, ty, 3.4 * s, (1.0, 0.98, 0.9, 0.95 * a), NONE, 0.0, true);
            } else if reached {
                circle(g, nx, ty, 4.2 * s, (kc.0, kc.1, kc.2, a), (1.0, 1.0, 1.0, 0.5 * a), 1.0 * s, false);
            } else {
                circle(g, nx, ty, 3.0 * s, NONE, (1.0, 1.0, 1.0, 0.42 * a), 1.3 * s, false);
            }
        }
        // the two ends of the road
        let (e0, e1) = if he { ("תינוק", "אלוהים") } else { ("baby", "God") };
        text(g, e0, node_x(0), ty + 22.0 * s, 10.0 * s, 0.0, F_MONO, 0xFFFFFF, 0.6 * a, 0.0, 0.0, dir);
        text(g, e1, node_x(n - 1), ty + 22.0 * s, 10.0 * s, 0.0, F_MONO, 0xFFF1C8, 0.75 * a, 0.0, 0.0, dir);
        // the new era's node pops with its first ride
        let pop = clamp((age - 0.9) / 0.35, 0.0, 1.0);
        if pop > 0.0 {
            let k = 1.0 + 0.35 * sin(pop * PI) ;
            let nx = node_x(c);
            let first = TIERS.iter().position(|t| t.cat as usize == c).unwrap_or(0);
            cmd(g, OP_GLOW, &[nx, ty, 34.0 * s * k, acc_.0, acc_.1, acc_.2, 0.6 * a]);
            circle(g, nx, ty, 15.0 * s * k, NONE, (acc_.0, acc_.1, acc_.2, a), 2.0 * s, false);
            cmd(g, OP_ICON, &[first as f32, nx, ty, 12.0 * s * k, a]);
            if pop < 1.0 { cmd(g, OP_WAVE, &[nx, ty, (15.0 + 30.0 * pop) * s, (3.0 - 2.0 * pop) * s, acc_.0, acc_.1, acc_.2, (1.0 - pop) * a]); }
        }
    }

    // ── random-event toast
    if g.toast_t > 0.0 && !g.toast.0.is_empty() {
        let a = clamp(g.toast_t / 0.4, 0.0, 1.0) * clamp((2.2 - g.toast_t) / 0.15, 0.0, 1.0);
        let age = 2.2 - g.toast_t;
        let pop = 1.0 + 0.4 * (1.0 - ease_out(age / 0.2));
        let msg = if he { g.toast.0 } else { g.toast.1 };
        let y = lay.cy + g.ring_r * lay.scale * 0.55;
        text(g, msg, lay.sx + lay.sw * 0.5, y, 26.0 * s * pop, 0.0, F_SANS, g.toast_col, a, 1.0, lay.sw * 0.9, dir);
    }

    // ── hints
    if g.upgrade_armed {
        let a = 0.75 + 0.25 * sin(g.real * 6.0);
        let msg = if he { "נגעו בכדור כדי לשדרג אותו" } else { "Tap a ball to upgrade it" };
        text(g, msg, lay.sx + lay.sw * 0.5, lay.cy + g.ring_r * lay.scale + 20.0 * s, 14.0 * s, 0.0, F_SANS, 0xFFE27A, a, 0.6, lay.sw * 0.9, dir);
    } else if g.jam_t > 1.0 && !g.finished {
        let a = clamp((g.jam_t - 1.0) * 2.0, 0.0, 1.0) * (0.6 + 0.4 * sin(g.real * 10.0));
        let msg = if he { "פקק!" } else { "Traffic jam!" };
        let (x, y) = to(V2::new(0.0, jy - 0.12));
        text(g, msg, x, y, 18.0 * s, 0.0, F_SANS, 0xFF5A4A, a, 0.8, 0.0, dir);
    } else if g.mode == Mode::Sandbox && g.started && !g.finished {
        let tt = tier(g.sandbox_tier);
        let mut buf = alloc::string::String::new();
        if he { let _ = write!(buf, "נגיעה מפילה: {}", tt.he); } else { let _ = write!(buf, "Tap drops: {}", tt.en); }
        text(g, &buf, lay.sx + lay.sw * 0.5, lay.timer_y + 4.0 * s, 13.0 * s, 0.0, F_SANS, tt.color, 0.9, 0.0, lay.sw * 0.6, dir);
    }

    // ── caption (reel style)
    if g.opts.on(Opt::Caption) && g.started && !g.finished && g.mode != Mode::Sandbox {
        let cap: alloc::string::String = if g.caption.is_empty() {
            alloc::string::String::from(if he { "האם התינוק יגיע לאלוהים?" } else { "Will the Baby Reach God?" })
        } else { g.caption.clone() };
        text(g, &cap, lay.sx + lay.sw * 0.5, lay.caption_y, 24.0 * s, 0.0, F_SANS, 0xFFFFFF, 0.96, 0.0, lay.sw * 0.92, 0.0);
    }

    // ── God's words
    if g.finished {
        let a = smooth((g.god_t - 2.6) / 1.6);
        if a > 0.0 {
            let y = lay.cy + g.ring_r * lay.scale * 0.95;
            // dark ink: by now God's light fills the screen
            let (c1, c2) = (0x3A2A10u32, 0x5A4420u32);
            let gl = 0.0;
            text(g, "אֶהְיֶה אֲשֶׁר אֶהְיֶה", lay.sx + lay.sw * 0.5, y, 34.0 * s, 0.0, F_SERIF, c1, a, gl, lay.sw * 0.9, 1.0);
            if !he { text(g, "I AM THAT I AM", lay.sx + lay.sw * 0.5, y + 34.0 * s, 15.0 * s, 0.0, F_SERIF, c2, a * 0.9, 0.0, lay.sw * 0.9, 2.0); }
            else { text(g, "שמות ג, יד", lay.sx + lay.sw * 0.5, y + 30.0 * s, 12.0 * s, 0.0, F_SERIF, c2, a * 0.8, 0.0, 0.0, 1.0); }
            let b = smooth((g.god_t - 0.2) / 1.2);
            let name = if he { "אלוהי ישראל" } else { "The God of Israel" };
            text(g, name, lay.sx + lay.sw * 0.5, lay.sy + lay.sh * 0.17, 30.0 * s, 0.0, F_SANS, c1, b * (1.0 - a * 0.3), gl * 0.6, lay.sw * 0.9, dir);
        }
    }

    // ── flash
    if g.flash > 0.004 {
        let c = mix_rgb(rgb(g.flash_col), (1.0, 1.0, 1.0), 0.5);
        let k = clamp(g.flash, 0.0, 1.0);
        cmd(g, OP_FLASH, &[c.0, c.1, c.2, k * 0.75]);
    }
}

/// Every ride that just evolved gets a double helix of light that winds up around it and follows it.
fn evo_pass(g: &mut Game, to: &dyn Fn(V2) -> (f32, f32), sc: f32, u: f32, front: bool) {
    for k in 0..g.evo.len() {
        let (id, left, seed) = g.evo[k];
        let Some(b) = g.bodies.iter().find(|b| b.alive && b.id == id).copied() else { continue };
        let (x, y) = to(b.p);
        evo_helix(g, x, y, b.r * sc, rgb(tier(b.tier).color), left, seed, u, front);
    }
}

#[allow(clippy::too_many_arguments)]
fn evo_helix(g: &mut Game, x: f32, y: f32, rr: f32, col: (f32, f32, f32), left: f32, seed: f32, u: f32, front: bool) {
    const N: usize = 36;
    let e = 1.0 - left / crate::game::EVO_T;
    let fade = clamp(left / 0.5, 0.0, 1.0);
    let rad = rr * 1.18;
    let h = rr * 4.2;
    let warm = (1.0, 0.97, 0.88);
    let tint = mix_rgb(col, (1.0, 1.0, 1.0), 0.2);
    let turn = seed + e * 6.5;
    if front {
        cmd(g, OP_GLOW, &[x, y, rr * 2.3, col.0, col.1, col.2, 0.3 * sin(clamp(e * 1.6, 0.0, 1.0) * PI) * fade]);
    }
    // the beads of both strands: x, y, depth (+1 nearest), how far it has wound up
    let mut pts = [[(0.0f32, 0.0f32, 0.0f32, 0.0f32); N]; 2];
    for i in 0..N {
        let f = i as f32 / (N - 1) as f32;
        let vis = clamp((e * 2.4 - f) * 5.0, 0.0, 1.0) * fade;
        let yy = y + h * (0.5 - f);
        let ph = turn + f * 13.8;
        let (ca, sa) = (cos(ph), sin(ph));
        pts[0][i] = (x + ca * rad, yy + sa * rad * 0.2, sa, vis);
        pts[1][i] = (x - ca * rad, yy - sa * rad * 0.2, -sa, vis);
    }
    // the rungs, behind the ride so it hides their middle
    if !front {
        for i in (1..N).step_by(2) {
            let (x0, y0, _, v) = pts[0][i];
            let (x1, y1, _, _) = pts[1][i];
            if v <= 0.01 { continue; }
            cmd(g, OP_LINE, &[x0, y0, x1, y1, u * 1.3, 1.0, 1.0, 1.0, 0.42 * v, 0.6]);
        }
    }
    for sd in 0..2 {
        let c = if sd == 0 { warm } else { tint };
        // the backbone
        for i in 0..N - 1 {
            let (x0, y0, d0, v0) = pts[sd][i];
            let (x1, y1, d1, v1) = pts[sd][i + 1];
            let v = v0.min(v1);
            let d = (d0 + d1) * 0.5;
            if v <= 0.01 || (d >= 0.0) != front { continue; }
            let near = d * 0.5 + 0.5;
            cmd(g, OP_LINE, &[x0, y0, x1, y1, u * (1.3 + 1.5 * near), c.0, c.1, c.2, v * (0.5 + 0.5 * near), 0.8]);
        }
        // the beads
        for i in (0..N).step_by(2) {
            let (bx, by, d, v) = pts[sd][i];
            if v <= 0.01 || (d >= 0.0) != front { continue; }
            let near = d * 0.5 + 0.5;
            let r = u * (1.5 + 1.9 * near);
            circle(g, bx, by, r, (c.0, c.1, c.2, v), (col.0 * 0.5, col.1 * 0.5, col.2 * 0.5, 0.55 * v), u * 0.7, false);
        }
    }
}
