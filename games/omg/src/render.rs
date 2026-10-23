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

#[inline] fn hash(a: u32) -> f32 { let mut x = a.wrapping_mul(0x9E37_79B9) ^ 0x85EB_CA6B; x ^= x >> 15; x = x.wrapping_mul(0x2C1B_3C6D); x ^= x >> 12; (x & 0xFFFF) as f32 / 65535.0 }

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

    // ── background gradient
    let ca = &CATS[g.prev_cat as usize];
    let cb = &CATS[g.cat as usize];
    let t = smooth(g.cat_mix);
    let top = mix_rgb(rgb(ca.bg_top), rgb(cb.bg_top), t);
    let bot = mix_rgb(rgb(ca.bg_bottom), rgb(cb.bg_bottom), t);
    let acc = mix_rgb(rgb(ca.accent), rgb(cb.accent), t);
    let white = if g.finished { smooth((g.god_t - 0.8) / 4.0) * 0.85 } else { 0.0 };
    cmd(g, OP_BG, &[top.0, top.1, top.2, bot.0, bot.1, bot.2, white, 0.0, acc.0, acc.1, acc.2, g.cat as f32, g.ring_pulse]);

    // ── stars
    if g.opts.on(Opt::Stars) {
        let space = |c: u8| match c { 10 | 11 => 1.0, 9 => 0.35, 8 | 12 | 13 => 0.5, 14 => 0.2, 0 => 0.3, _ => 0.45 };
        let k = lerp(space(g.prev_cat), space(g.cat), t);
        let n = g.stars.len();
        for i in 0..n {
            let s = g.stars[i];
            let tw = 0.55 + 0.45 * sin(s.life);
            let a = tw * k * (1.0 - white);
            if a < 0.02 { continue; }
            let x = s.p.x * lay.w;
            let y = s.p.y * lay.h;
            let (r, gg, b) = rgb(s.color);
            cmd(g, OP_DOT, &[x, y, s.size, r, gg, b, a, 0.0]);
        }
    }

    // ── era scenery (cross-fades between eras)
    if g.opts.on(Opt::Scenery) && white < 0.95 {
        let fade = 1.0 - white;
        if t < 1.0 { crate::scenery::draw(g, g.prev_cat, (1.0 - t) * fade); }
        crate::scenery::draw(g, g.cat, t * fade);
    }

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

    // ── the play area: a dark glass disc so the balls read over any scenery
    let ring_px = g.ring_r * sc;
    let (rcx, rcy) = to(V2::default());
    if white < 0.99 {
        circle(g, rcx, rcy, ring_px, (0.0, 0.0, 0.02, 0.42 * (1.0 - white)), NONE, 0.0, false);
    }

    // ── ring
    let thick = (0.022 * lay.scale * z).max(3.0);
    let gap = asin(CHUTE_W / g.ring_r);
    let pc = rgb(g.ring_col);
    let theme = g.opts.get(Opt::Theme);
    let wob = g.ring_wob * g.ring_wob * lay.u * 7.0 * if g.drama() > 0.0 { 1.0 } else { 0.4 };
    cmd(g, OP_RING, &[rcx, rcy, ring_px + thick * 0.5, thick, g.hue, 0.6 + g.ring_pulse, theme, gap, 1.0 - white * 0.6, pc.0, pc.1, pc.2, g.cat as f32, g.ring_pulse, wob]);

    // ── chute walls
    let jy = g.join_y();
    let top_y = (lay.chute_top_px - 6.0 * lay.u - lay.cy) / lay.scale;
    for sxs in [-1.0f32, 1.0] {
        let (x1, y1) = to(V2::new(sxs * CHUTE_W, top_y));
        let (x2, y2) = to(V2::new(sxs * (CHUTE_W + 0.004), jy + 0.004));
        cmd(g, OP_LINE, &[x1, y1, x2, y2, (thick * 0.55).max(2.5), 1.0, 1.0, 1.0, 0.92 * (1.0 - white * 0.7), 0.8]);
    }
    if !g.finished && g.mode != Mode::Sandbox && g.started {
        let (mx, my) = to(V2::new(0.0, g.lay.chute_top));
        let tc = rgb(tier(g.spout).color);
        cmd(g, OP_GLOW, &[mx, my, CHUTE_W * sc * 1.6, tc.0, tc.1, tc.2, 0.25 + 0.15 * sin(g.real * 4.0)]);
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
        cmd(g, OP_ITEM, &[b.tier as f32, x, y, rp, tilt, b.flash, alpha, la, glow, b.orphan_t.min(1.0), hl, if he { 1.0 } else { 0.0 }, b.squash, b.squash_a, style]);
    }

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
        // ladder: one tick per tier, coloured by era
        if g.opts.on(Opt::Ladder) {
            let ly = lay.ladder_y;
            let lw = lay.sw * 0.84;
            let lx = lay.sx + (lay.sw - lw) * 0.5;
            let step = lw / N_TIERS as f32;
            for k in 0..N_TIERS {
                let kk = if he { N_TIERS - 1 - k } else { k };
                let seen = g.run_seen & bit(kk as u8) != 0 || (kk as u8) <= g.run_max;
                let c = rgb(CATS[TIERS[kk].cat as usize].accent);
                let cur = kk as u8 == g.run_max;
                let a = if cur { 1.0 } else if seen { 0.75 } else { 0.14 };
                let hgt = if cur { 9.0 * s } else { 4.0 * s };
                let gap_px = if step > 3.0 { 0.6 } else { 0.0 };
                rect(g, lx + k as f32 * step + gap_px * 0.5, ly - hgt * 0.5, (step - gap_px).max(0.6), hgt, (c.0, c.1, c.2, a), 1.0, cur);
            }
        }
        // speed badge
        let sp = g.opts.get(Opt::Speed);
        if (sp - 1.0).abs() > 0.01 || g.tools[Tool::SlowMo as usize].active > 0.0 {
            buf.clear();
            let eff = if g.tools[Tool::SlowMo as usize].active > 0.0 { sp * 0.25 } else { sp };
            let _ = write!(buf, "×{}", if eff < 1.0 { if eff < 0.2 { "⅛" } else if eff < 0.4 { "¼" } else { "½" } } else if eff < 1.5 { "1" } else if eff < 3.0 { "2" } else if eff < 6.0 { "4" } else { "8" });
            let bx = if he { lay.sx + lay.sw * 0.08 } else { lay.sx + lay.sw * 0.92 };
            text(g, &buf, bx, lay.timer_y, 12.0 * s, if he { 1.0 } else { 2.0 }, F_MONO, 0xFFD54F, 0.9, 0.0, 0.0, 2.0);
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
    if g.banner_t > 0.0 && g.banner_tier >= 0 && !(g.finished && g.banner_tier as u8 == GOD) && g.era_t <= 0.4 {
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
        text(g, name, bx, by, fs, 0.0, F_SANS, 0xFFFFFF, a, 1.0, lay.sw * 0.88, dir);
        let blurb = if he { tt.blurb_he } else { tt.blurb_en };
        let qf = if tt.cat == Cat::Holy || tt.cat == Cat::God { F_SERIF } else { F_LIGHT };
        text(g, blurb, bx, by + fs * 0.62 + 16.0 * s, 13.0 * s, 0.0, qf, tt.color, a * 0.95, 0.4, lay.sw * 0.84, dir);
        let mut buf = alloc::string::String::new();
        if he { let _ = write!(buf, "דרגה {} מתוך {}", t as u32 + 1, N_TIERS); } else { let _ = write!(buf, "TIER {} OF {}", t as u32 + 1, N_TIERS); }
        text(g, &buf, bx, by - fs * 0.62 - 6.0 * s, 11.0 * s, 0.0, F_MONO, tt.color, a * 0.85, 0.0, 0.0, dir);
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

    // ── era title card
    if g.era_t > 0.0 && g.drama() > 0.0 {
        let life = 2.6;
        let age = life - g.era_t;
        let a = clamp(age / 0.2, 0.0, 1.0) * clamp(g.era_t / 0.5, 0.0, 1.0);
        let c = g.era_card as usize;
        let ci = &CATS[c];
        let slide = (1.0 - ease_out(age / 0.45)) * lay.sw * 0.6 * if he { -1.0 } else { 1.0 };
        let y = lay.cy - g.ring_r * lay.scale * 0.1;
        rect(g, 0.0, y - 70.0 * s, lay.w, 140.0 * s, (0.0, 0.0, 0.0, 0.55 * a), 0.0, false);
        let acc_ = rgb(ci.accent);
        rect(g, 0.0, y - 70.0 * s, lay.w, 3.0 * s, (acc_.0, acc_.1, acc_.2, 0.9 * a), 0.0, true);
        rect(g, 0.0, y + 67.0 * s, lay.w, 3.0 * s, (acc_.0, acc_.1, acc_.2, 0.9 * a), 0.0, true);
        let mut buf = alloc::string::String::new();
        if he { let _ = write!(buf, "עידן {} מתוך {}", c + 1, N_CATS - 1); } else { let _ = write!(buf, "ERA {} OF {}", c + 1, N_CATS - 1); }
        let x = lay.sx + lay.sw * 0.5;
        text(g, &buf, x - slide * 0.4, y - 38.0 * s, 12.0 * s, 0.0, F_MONO, ci.accent, a, 0.0, 0.0, dir);
        text(g, if he { ci.he } else { ci.en }, x + slide, y + 2.0 * s, 44.0 * s, 0.0, F_SANS, 0xFFFFFF, a, 1.0, lay.sw * 0.92, dir);
        text(g, if he { ci.sub_he } else { ci.sub_en }, x - slide * 0.6, y + 42.0 * s, 15.0 * s, 0.0, F_LIGHT, ci.accent, a * 0.95, 0.3, lay.sw * 0.9, dir);
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
    if g.opts.on(Opt::Caption) && !g.finished && g.mode != Mode::Sandbox {
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
            text(g, "אֶהְיֶה אֲשֶׁר אֶהְיֶה", lay.sx + lay.sw * 0.5, y, 34.0 * s, 0.0, F_SERIF, 0x3A2A10, a, 0.0, lay.sw * 0.9, 1.0);
            if !he { text(g, "I AM THAT I AM", lay.sx + lay.sw * 0.5, y + 34.0 * s, 15.0 * s, 0.0, F_SERIF, 0x5A4420, a * 0.9, 0.0, lay.sw * 0.9, 2.0); }
            else { text(g, "שמות ג, יד", lay.sx + lay.sw * 0.5, y + 30.0 * s, 12.0 * s, 0.0, F_SERIF, 0x5A4420, a * 0.8, 0.0, 0.0, 1.0); }
            let b = smooth((g.god_t - 0.2) / 1.2);
            let name = if he { "אלוהי ישראל" } else { "The God of Israel" };
            text(g, name, lay.sx + lay.sw * 0.5, lay.sy + lay.sh * 0.17, 30.0 * s, 0.0, F_SANS, 0x3A2A10, b * (1.0 - a * 0.3), 0.0, lay.sw * 0.9, dir);
        }
    }

    // ── flash
    if g.flash > 0.004 {
        let c = mix_rgb(rgb(g.flash_col), (1.0, 1.0, 1.0), 0.5);
        let k = clamp(g.flash, 0.0, 1.0);
        cmd(g, OP_FLASH, &[c.0, c.1, c.2, k * 0.75]);
    }
}
