//! The bubble of life and the stem that feeds it.
//!
//! The vessel is a living membrane: a clear fluid inside, a soft wall lit from
//! the top left that wobbles when things hit it, and a pore at the top where a
//! translucent stem pours the babies in. A seed pod at the top of the stem is
//! where they come from. When God is born the bubble strains and bursts.

use alloc::vec::Vec;

use crate::game::*;
use crate::m::*;
use crate::opts::*;
use crate::render::*;
use crate::tiers::*;
use crate::world::*;

/// The living-bubble look is on (the old neon rings are still a setting).
pub fn on(g: &Game) -> bool { g.opts.get(Opt::Theme) >= 5.5 }

fn wobble(g: &Game) -> f32 {
    let u = g.lay.u;
    let mut w = g.ring_wob * g.ring_wob * u * 8.0 * if g.drama() > 0.0 { 1.0 } else { 0.4 };
    if g.finished && g.burst_t < 0.0 {
        // the bubble strains before it bursts
        let k = smooth((g.god_t - 2.6) / 3.0);
        w += k * u * (5.0 + 4.0 * sin(g.real * 23.0));
    }
    w
}

/// A new run: the bubble blooms out of nothing with a little elastic overshoot.
pub fn birth(g: &Game) -> f32 {
    if !g.started || g.finished { return 1.0; }
    let k = clamp(g.time / 1.1, 0.0, 1.0);
    if k >= 1.0 { 1.0 } else { (1.0 - exp(-5.0 * k) * cos(9.0 * k) * (1.0 - k)).max(0.02) }
}

/// The membrane: layer 0 is the fluid behind the pile, layer 1 the wall in front of it.
pub fn membrane(g: &mut Game, to: &dyn Fn(V2) -> (f32, f32), sc: f32, white: f32, layer: f32) {
    if g.burst_t >= 0.0 { return; }
    let l = look(g);
    let (cx, cy) = to(V2::default());
    let r = g.ring_r * sc * birth(g);
    let th = (0.032 * sc).max(4.0 * g.lay.u);
    let pore = asin(CHUTE_W / g.ring_r) * 1.04;
    let pulse = g.ring_pulse.max(if g.finished { smooth((g.god_t - 2.0) / 3.0) } else { 0.0 });
    let a = 1.0 - white * 0.6;
    let w = wobble(g);
    // the wall glows in the colour of the newest ride for a moment after each big merge
    let lit = mix_rgb(l.light, rgb(g.ring_col), 0.35 * g.ring_pulse);
    cmd(g, OP_MEMBRANE, &[cx, cy, r, th, w, layer, l.fluid.0, l.fluid.1, l.fluid.2, lit.0, lit.1, lit.2, a, pore, pulse]);
}

/// Soft shadows under everything in the bubble, on the side gravity pulls to.
pub fn shadows(g: &mut Game, to: &dyn Fn(V2) -> (f32, f32), sc: f32, white: f32) {
    if g.mode == Mode::BlackHole || g.burst_t >= 0.0 { return; }
    let mut down = V2::new(0.0, 1.0).rot(-g.tilt);
    if g.tools[Tool::Flip as usize].active > 0.0 { down = -down; }
    let a = 0.22 * (1.0 - white);
    for i in 0..g.bodies.len() {
        let b = g.bodies[i];
        if !b.alive || b.tier == GOD { continue; }
        let r = b.r * sc;
        if r < 2.5 { continue; }
        let k = if b.dying > 0.0 { clamp(b.dying / 0.45, 0.0, 1.0) } else { 1.0 };
        let (x, y) = to(b.p + down * (b.r * 0.8));
        cmd(g, OP_SHADOW, &[x, y, r * 0.95, r * 0.4, a * k]);
    }
}

/// The stem, its seed pod, the babies flowing down it and the ball forming at its mouth.
pub fn stem(g: &mut Game, to: &dyn Fn(V2) -> (f32, f32), sc: f32, white: f32) {
    let lay = g.lay;
    let u = lay.u;
    let a = 1.0 - white;
    if a <= 0.01 { return; }
    let l = look(g);
    let jy = g.join_y();
    let top_y = (lay.chute_top_px - lay.cy) / lay.scale - 0.01;
    let (xl0, yt) = to(V2::new(-CHUTE_W, top_y));
    let (xr0, _) = to(V2::new(CHUTE_W, top_y));
    let (xl1, yb) = to(V2::new(-CHUTE_W, jy + 0.02));
    let (xr1, _) = to(V2::new(CHUTE_W, jy + 0.02));
    let wall = (0.02 * sc).max(2.6 * u);
    let n = 28;
    let mut left: Vec<f32> = Vec::with_capacity(n * 2 + 2);
    let mut right: Vec<f32> = Vec::with_capacity(n * 2 + 2);
    let beat = 0.8 + 0.25 * (g.spout as f32).min(8.0);
    for i in 0..=n {
        let f = i as f32 / n as f32;
        let y = lerp(yt, yb, f);
        let sway = sin(g.real * 1.3 + f * 5.0) * 0.7 * u * (1.0 - f);
        // peristalsis: bulges travelling down the stem
        let ph = fmod(g.real * beat - f * 1.4 + 10.0, 1.0);
        let d = (ph - 0.5) * 6.0;
        let bulge = exp(-d * d) * 2.4 * u;
        left.push(lerp(xl0, xl1, f) - bulge + sway); left.push(y);
        right.push(lerp(xr0, xr1, f) + bulge + sway); right.push(y);
    }
    // the fluid inside
    let mut body = left.clone();
    for i in (0..=n).rev() { body.push(right[i * 2]); body.push(right[i * 2 + 1]); }
    path(g, &body, (l.fluid.0, l.fluid.1, l.fluid.2, 0.2 * a), NONE, 0.0, true, false);
    // the walls: a dark outer edge, the lit membrane, a wet line on the left
    let edge = mix_rgb(l.fluid, (0.0, 0.0, 0.0), 0.6);
    let lit = mix_rgb(l.light, (1.0, 1.0, 1.0), 0.3);
    for (side, pts) in [(-1.0f32, &left), (1.0, &right)] {
        let mut outer = pts.clone();
        for k in 0..=n { outer[k * 2] += side * wall * 0.45; }
        path(g, &outer, NONE, (edge.0, edge.1, edge.2, 0.45 * a), wall * 0.35, false, false);
        let mid = mix_rgb(l.fluid, l.light, if side < 0.0 { 0.75 } else { 0.4 });
        path(g, pts, NONE, (mid.0, mid.1, mid.2, 0.85 * a), wall, false, false);
    }
    let mut hl = left.clone();
    for k in 0..=n { hl[k * 2] += wall * 0.3; }
    path(g, &hl, NONE, (lit.0, lit.1, lit.2, 0.45 * a), wall * 0.25, false, true);

    // the seed pod the babies come from (the sandbox has none: you drop by hand)
    let (px, py) = ((xl0 + xr0) * 0.5, yt - 10.0 * u);
    let pr = 15.0 * u;
    if g.mode == Mode::Sandbox { return; }
    let pulse = 0.5 + 0.5 * smooth(g.form);
    let leaf = mix_rgb(l.fluid, (0.1, 0.25, 0.1), 0.45);
    for (k, ang) in [(-1.0f32, 2.2f32), (1.0, 0.94), (0.0, 1.57)] {
        let _ = k;
        let (dx, dy) = (cos(ang), sin(ang));
        let tip = (px + dx * pr * 1.25, py + dy * pr * 1.25);
        let side = (-dy * pr * 0.42, dx * pr * 0.42);
        path(g, &[px + side.0, py + side.1, tip.0, tip.1, px - side.0, py - side.1], (leaf.0, leaf.1, leaf.2, 0.9 * a), NONE, 0.0, true, false);
    }
    cmd(g, OP_GLOW, &[px, py, pr * (2.6 + 0.8 * pulse), l.light.0, l.light.1, l.light.2, (0.25 + 0.25 * pulse) * a]);
    let pod = mix_rgb(l.fluid, l.light, 0.55);
    circle(g, px, py, pr, (pod.0, pod.1, pod.2, 0.95 * a), (edge.0, edge.1, edge.2, 0.6 * a), 1.4 * u, false);
    circle(g, px - pr * 0.1, py - pr * 0.12, pr * 0.78, (1.0, 1.0, 1.0, 0.35 * a), NONE, 0.0, false);
    cmd(g, OP_ICON, &[0.0, px, py + 1.0 * u, 9.5 * u, 0.95 * a]);
    circle(g, px - pr * 0.42, py - pr * 0.45, pr * 0.14, (1.0, 1.0, 1.0, 0.85 * a), NONE, 0.0, false);

    let s = g.spout;
    if s > 0 {
        // the babies flowing down the stem
        let baby_px = g.radius_for(0) * sc;
        let fp = g.funnel_p();
        let (fx, fy) = to(fp);
        let nw = (xr0 - xl0).max(14.0 * u);
        let cnt = 14u32;
        let rate = 0.9 + 0.25 * (s as f32).min(8.0);
        for i in 0..cnt {
            let ph = fmod(g.real * rate + i as f32 / cnt as f32, 1.0);
            let y = lerp(py + pr, fy, ph * ph);
            let x = px + sin(i as f32 * 2.3 + g.real * 3.0) * nw * 0.18 * (1.0 - ph);
            let al = a * smooth(ph * 6.0) * (1.0 - smooth((ph - 0.85) / 0.15));
            if baby_px >= 3.0 {
                cmd(g, OP_ICON, &[0.0, x, y, baby_px.min(12.0 * u), al]);
            } else {
                let c = rgb(tier(0).color);
                cmd(g, OP_DOT, &[x, y, 1.7 * u, c.0, c.1, c.2, al * 0.9, 1.0]);
            }
        }
        // the ball forming out of them
        let k = smooth(g.form);
        let t = g.form_tier;
        let rr = g.radius_for(t) * sc * (0.25 + 0.75 * k);
        let c = rgb(tier(t).color);
        cmd(g, OP_GLOW, &[fx, fy, rr * 2.6, c.0, c.1, c.2, (0.2 + 0.35 * k) * a]);
        cmd(g, OP_ITEM, &[t as f32, fx, fy, rr, 0.0, 0.6 * k, (0.25 + 0.6 * k) * a, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, g.opts.get(Opt::BallStyle)]);
        // how many babies go into each ball
        let mut buf = alloc::string::String::new();
        buf.push('×');
        fmt_big(&mut buf, libm_pow64(2.0, s as f64));
        let side = if g.lang_he { -1.0 } else { 1.0 };
        let lx = px + side * (pr + 10.0 * u);
        text(g, &buf, lx, py, 11.0 * u, if g.lang_he { 2.0 } else { 1.0 }, F_MONO, 0xFFF2E6, 0.9 * a, 0.0, 0.0, 2.0);
    }
}
