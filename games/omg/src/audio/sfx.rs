//! Synthesised sound effects. Everything here is generated from oscillators,
//! noise and filters — no samples.

use alloc::vec;
use alloc::vec::Vec;

use super::dsp::*;
use crate::m::*;

#[inline] fn n_of(sr: f32, d: f32) -> usize { (d.max(0.0) * sr) as usize }
#[inline] fn midi(m: f32) -> f32 { 440.0 * pow(2.0, (m - 69.0) / 12.0) }

pub fn tick(sr: f32) -> Vec<f32> {
    let n = n_of(sr, 0.06);
    let mut o = Osc::default(); let mut nz = Noise::new(7);
    (0..n).map(|i| {
        let t = i as f32 / sr;
        let f = 1500.0 * exp(-t * 40.0) + 500.0;
        (o.sine(f, sr) * 0.6 + nz.white() * 0.25 * exp(-t * 300.0)) * exp(-t * 55.0)
    }).collect()
}

pub fn click(sr: f32) -> Vec<f32> {
    let n = n_of(sr, 0.05);
    let mut o = Osc::default();
    (0..n).map(|i| { let t = i as f32 / sr; o.sine(2200.0 - t * 8000.0, sr) * exp(-t * 90.0) * 0.6 }).collect()
}

pub fn pop(sr: f32) -> Vec<f32> {
    let n = n_of(sr, 0.12);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    (0..n).map(|i| {
        let t = i as f32 / sr;
        let f = 260.0 + 900.0 * (1.0 - exp(-t * 35.0));
        (o.sine(f, sr) * 0.8 + o2.sine(f * 2.01, sr) * 0.2) * exp(-t * 26.0) * (1.0 - exp(-t * 900.0))
    }).collect()
}

pub fn coins(sr: f32) -> St {
    let mut s = St::new(n_of(sr, 0.5));
    for (k, (f, at, pan)) in [(2093.0, 0.0, -0.3), (2637.0, 0.07, 0.3), (3136.0, 0.13, 0.0)].iter().enumerate() {
        let n = n_of(sr, 0.32);
        let mut o = Osc::default(); let mut o2 = Osc::default();
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; (o.sine(*f, sr) + 0.35 * o2.sine(f * 2.76, sr)) * exp(-t * 14.0) * 0.35 }).collect();
        s.add_mono(&x, n_of(sr, *at), 1.0 - k as f32 * 0.1, *pan);
    }
    s
}

pub fn whoosh(sr: f32, dur: f32, f0: f32, f1: f32, seed: u32) -> Vec<f32> {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut out = vec![0.0f32; n];
    let mut f = Bq::bp(sr, f0, 1.2);
    for i in 0..n {
        let k = i as f32 / n as f32;
        if i % 64 == 0 { f.coef(Bq::bp(sr, f0 * pow(f1 / f0, k), 1.4)); }
        let a = sin(PI * k) * sin(PI * k);
        out[i] = f.run(nz.white()) * a;
    }
    normalize(&mut out, 0.8);
    out
}

/// Engine presets: (idle Hz, peak Hz, end Hz, grit, brightness, rumble, turbo whistle, crackle pops)
/// 0 tiny 3-cyl, 1 V6 off-road, 2 electric, 3 V8 sport, 4 V12 scream, 5 big-block V8, 6 W16 + turbos, 7 V12 howl,
/// 8 tiny twin, 9 rally boxer + turbo, 10 V-twin cruiser, 11 superbike, 12 supercharged hyperbike, 13 F1 scream,
/// 14 ATV single, 15 mining diesel, 16 outboard, 17 inline-6 turbo
pub fn engine_preset(kind: u8) -> (f32, f32, f32, f32, f32, f32, f32, bool) {
    match kind {
        0 => (28.0, 85.0, 40.0, 0.35, 0.35, 0.2, 0.0, false),
        1 => (26.0, 105.0, 34.0, 0.6, 0.45, 0.6, 0.0, false),
        3 => (34.0, 170.0, 48.0, 0.5, 0.6, 0.5, 0.0, true),
        4 => (55.0, 330.0, 90.0, 0.35, 1.0, 0.25, 0.0, false),
        5 => (24.0, 135.0, 32.0, 0.75, 0.5, 1.0, 0.0, true),
        6 => (40.0, 230.0, 60.0, 0.45, 0.8, 0.6, 1.0, false),
        7 => (60.0, 360.0, 110.0, 0.3, 1.0, 0.3, 0.0, false),
        8 => (32.0, 110.0, 45.0, 0.5, 0.4, 0.15, 0.0, false),
        9 => (30.0, 160.0, 44.0, 0.6, 0.55, 0.6, 0.7, true),
        10 => (18.0, 68.0, 24.0, 0.85, 0.3, 1.0, 0.0, true),
        11 => (60.0, 360.0, 90.0, 0.4, 0.9, 0.15, 0.0, true),
        12 => (70.0, 420.0, 110.0, 0.35, 1.0, 0.15, 1.2, false),
        13 => (110.0, 540.0, 170.0, 0.3, 1.0, 0.1, 0.0, true),
        14 => (35.0, 120.0, 45.0, 0.7, 0.5, 0.3, 0.0, false),
        15 => (16.0, 48.0, 20.0, 0.9, 0.2, 1.0, 0.3, false),
        16 => (30.0, 150.0, 40.0, 0.55, 0.6, 0.4, 0.0, false),
        17 => (38.0, 210.0, 55.0, 0.45, 0.75, 0.4, 0.8, true),
        _ => (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, false),
    }
}

pub fn engine(sr: f32, kind: u8, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let (idle, peak, endf, grit, bright, rumble, turbo, crackle) = engine_preset(kind);
    let mut out = St::new(n);
    let mut nz = Noise::new(seed);
    if kind == 2 {
        // electric: a rising inverter whine and rushing air
        let mut o1 = Osc::default(); let mut o2 = Osc::default(); let mut o3 = Osc::default();
        let mut air = Bq::bp(sr, 900.0, 0.6);
        let mut x = vec![0.0f32; n];
        for i in 0..n {
            let k = i as f32 / n as f32;
            let f = 300.0 + 2600.0 * smooth(k * 1.4);
            let a = smooth(k * 6.0) * (1.0 - smooth((k - 0.75) * 4.0));
            x[i] = (o1.sine(f, sr) * 0.5 + o2.sine(f * 1.5, sr) * 0.18 + o3.sine(f * 0.5, sr) * 0.25 + air.run(nz.white()) * 0.25 * k) * a;
        }
        out.add_mono(&x, 0, 0.8, 0.0);
        return out;
    }
    let mut o1 = Osc::default(); let mut o2 = Osc::default(); let mut o3 = Osc::default(); let mut sub = Osc::default();
    let mut lpf = Bq::lp(sr, 600.0, 1.1);
    let mut x = vec![0.0f32; n];
    let mut pops = 0.0f32;
    for i in 0..n {
        let k = i as f32 / n as f32;
        let f = if k < 0.45 { idle + (peak - idle) * smooth(k / 0.45) } else if k < 0.58 { peak * (1.0 + 0.01 * sin(i as f32 * 0.003)) } else { peak + (endf - peak) * smooth((k - 0.58) / 0.42) };
        let lope = 1.0 - rumble * 0.25 * (0.5 + 0.5 * sin(o3.ph * TAU * 0.5));
        let s = o1.saw(f, sr) * 0.55 + o2.square(f * 0.5, sr, 0.32) * (0.25 + rumble * 0.25) + sub.sine(f * 0.5, sr) * rumble * 0.6;
        let _ = o3.saw(f, sr);
        let comb = nz.white() * grit * (0.4 + 0.6 * (0.5 + 0.5 * sin(o1.ph * TAU)));
        if i % 96 == 0 { lpf.coef(Bq::lp(sr, 250.0 + f * (3.0 + bright * 9.0), 1.0 + bright * 0.8)); }
        let mut v = lpf.run(s + comb * 0.35) * lope;
        if crackle && k > 0.62 && nz.white() > 0.9993 { pops = 1.0; }
        if pops > 0.0 { v += nz.white() * pops * 0.9; pops *= 0.993; if pops < 0.01 { pops = 0.0; } }
        let a = smooth(k * 12.0) * (1.0 - smooth((k - 0.85) * 6.6));
        x[i] = v * a;
    }
    saturate(&mut x, 0.35 + grit * 0.5);
    hp(&mut x, sr, 32.0);
    out.add_mono(&x, 0, 0.9, 0.0);
    if turbo > 0.0 {
        // turbos: whistle + blow-off
        let mut w = Osc::default(); let mut bo = Bq::hp(sr, 2200.0, 0.7);
        let mut y = vec![0.0f32; n];
        for i in 0..n {
            let k = i as f32 / n as f32;
            let f = 1200.0 + 3200.0 * smooth(k / 0.55);
            y[i] = w.sine(f, sr) * 0.12 * turbo * smooth(k * 5.0) * (1.0 - smooth((k - 0.55) * 20.0));
            if k > 0.58 && k < 0.75 { y[i] += bo.run(nz.white()) * 0.35 * turbo.min(1.0) * (1.0 - (k - 0.58) / 0.17); }
        }
        out.add_mono(&y, 0, 1.0, 0.2);
    }
    // stereo life: tiny Haas offset
    let d = n_of(sr, 0.011);
    let mut r = vec![0.0f32; n];
    for i in d..n { r[i] = out.r[i - d]; }
    out.r = r;
    out
}

pub fn prop(sr: f32, dur: f32) -> St {
    let n = n_of(sr, dur);
    let mut o = Osc::default(); let mut nz = Noise::new(31);
    let mut f1 = Bq::lp(sr, 900.0, 0.9);
    let x: Vec<f32> = (0..n).map(|i| {
        let k = i as f32 / n as f32;
        let f = 72.0 * (1.12 - 0.24 * k);
        let blade = 0.5 + 0.5 * sin(TAU * f * 2.0 * i as f32 / sr);
        let v = o.saw(f, sr) * 0.6 + nz.white() * 0.4 * blade;
        f1.run(v) * sin(PI * k) * (0.6 + 0.4 * blade)
    }).collect();
    let mut s = St::new(n);
    for i in 0..n { let k = i as f32 / n as f32; let p = -0.8 + 1.6 * k; let a = (p + 1.0) * PI * 0.25; s.l[i] = x[i] * cos(a) * 1.2; s.r[i] = x[i] * sin(a) * 1.2; }
    s
}

pub fn jet(sr: f32, dur: f32, power: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut whine = Osc::default();
    let mut band = Bq::bp(sr, 600.0, 0.8);
    let mut low = Bq::lp(sr, 220.0, 0.7);
    let mut x = vec![0.0f32; n];
    for i in 0..n {
        let k = i as f32 / n as f32;
        if i % 128 == 0 { band.coef(Bq::bp(sr, 400.0 + 2600.0 * sin(PI * k), 0.7)); }
        let env = pow(sin(PI * k), 1.6);
        let f = 3400.0 * (1.15 - 0.45 * k);
        let hf = tanh((band.run(nz.white()) * 0.7 + whine.sine(f, sr) * 0.06) * (1.0 + power)) / (1.0 + power * 0.5);
        let lf = low.run(nz.brown()) * power * 0.9;
        x[i] = (hf + lf) * env;
    }
    normalize(&mut x, 0.85);
    let mut s = St::new(n);
    for i in 0..n { let k = i as f32 / n as f32; let p = -0.9 + 1.8 * smooth(k); let a = (p + 1.0) * PI * 0.25; s.l[i] = x[i] * cos(a) * 1.3; s.r[i] = x[i] * sin(a) * 1.3; }
    s
}

pub fn chime(sr: f32) -> St {
    let mut s = St::new(n_of(sr, 1.6));
    for (f, at) in [(1318.5f32, 0.0f32), (1046.5, 0.42)] {
        let n = n_of(sr, 1.1);
        let mut a = Osc::default(); let mut b = Osc::default(); let mut c = Osc::default();
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; (a.sine(f, sr) + 0.3 * b.sine(f * 2.0, sr) + 0.12 * c.sine(f * 3.01, sr)) * exp(-t * 3.2) * (1.0 - exp(-t * 400.0)) * 0.4 }).collect();
        s.add_mono(&x, n_of(sr, at), 1.0, 0.0);
    }
    s
}

pub fn boom(sr: f32, double: bool, seed: u32) -> St {
    let n = n_of(sr, 2.2);
    let mut x = vec![0.0f32; n];
    let mut nz = Noise::new(seed);
    let hits: &[f32] = if double { &[0.0, 0.11] } else { &[0.0] };
    for &h in hits {
        let a = n_of(sr, h);
        let w = n_of(sr, 0.09);
        for i in 0..w { if a + i < n { let k = i as f32 / w as f32; x[a + i] += (1.0 - 2.0 * k) * 0.9; } }
    }
    lp(&mut x, sr, 1800.0);
    let mut rumble = Bq::lp(sr, 120.0, 0.8);
    for i in 0..n { let t = i as f32 / sr; x[i] += rumble.run(nz.brown()) * 1.4 * exp(-t * 1.6) * (1.0 - exp(-t * 60.0)); }
    let mut sub = Osc::default();
    for i in 0..n { let t = i as f32 / sr; x[i] += sub.sine(48.0 - 18.0 * t, sr) * 0.7 * exp(-t * 3.0); }
    fade(&mut x, 0, n_of(sr, 0.35));
    normalize(&mut x, 0.95);
    let mut s = St::from_mono(&x, 0.0);
    s = reverb(&s, 1.8, 1.3, 0.2, 0.01, 0.35, 1.0, sr);
    s
}

pub fn rocket(sr: f32, dur: f32, size: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut lo = Bq::lp(sr, 260.0 + 200.0 * size, 0.7);
    let mut mid = Bq::bp(sr, 700.0, 0.6);
    let mut sub = Osc::default();
    let mut cr = Bq::hp(sr, 2500.0, 0.7);
    let mut crack = 0.0f32;
    let mut x = vec![0.0f32; n];
    for i in 0..n {
        let k = i as f32 / n as f32;
        let env = smooth(k * 4.0) * (1.0 - smooth((k - 0.7) / 0.3));
        if nz.white() > 0.996 - 0.002 * size { crack = 1.0; }
        let c = cr.run(nz.white()) * crack; crack *= 0.97;
        let hf = tanh((mid.run(nz.white()) * 0.5 + c * 0.6) * (1.5 + size));
        x[i] = (lo.run(nz.brown()) * 1.1 + hf * 0.45 + sub.sine(32.0 + 6.0 * size, sr) * 0.35 * size) * env;
    }
    normalize(&mut x, 0.9);
    let mut s = St::from_mono(&x, 0.0);
    let d = n_of(sr, 0.017);
    let mut r = vec![0.0f32; n];
    for i in d..n { r[i] = s.r[i - d] * 0.9 + s.l[i] * 0.1; }
    s.r = r;
    s
}

pub fn quindar(sr: f32, f: f32) -> Vec<f32> {
    let n = n_of(sr, 0.25);
    let mut o = Osc::default();
    let f5 = n_of(sr, 0.006);
    (0..n).map(|i| { let a = if i < f5 { i as f32 / f5 as f32 } else if i > n - f5 { (n - i) as f32 / f5 as f32 } else { 1.0 }; o.sine(f, sr) * 0.35 * a }).collect()
}

pub fn hover(sr: f32, dur: f32) -> St {
    let n = n_of(sr, dur);
    let mut a = Osc::default(); let mut b = Osc::default(); let mut nz = Noise::new(5);
    let mut nf = Bq::bp(sr, 1200.0, 2.0);
    let x: Vec<f32> = (0..n).map(|i| {
        let k = i as f32 / n as f32; let t = i as f32 / sr;
        let trem = 0.75 + 0.25 * sin(TAU * 7.0 * t);
        (a.sine(95.0 + 30.0 * k, sr) * 0.5 + b.saw(190.0 + 60.0 * k, sr) * 0.12 + nf.run(nz.white()) * 0.3) * trem * sin(PI * k)
    }).collect();
    St::from_mono(&x, 0.0)
}

pub fn theremin(sr: f32, dur: f32) -> Vec<f32> {
    let n = n_of(sr, dur);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    (0..n).map(|i| {
        let k = i as f32 / n as f32; let t = i as f32 / sr;
        let f = (620.0 + 380.0 * sin(PI * k) - 120.0 * k) * (1.0 + 0.03 * sin(TAU * 6.2 * t));
        (o.sine(f, sr) * 0.8 + o2.sine(f * 2.0, sr) * 0.12) * smooth(k * 8.0) * (1.0 - smooth((k - 0.8) * 5.0)) * 0.5
    }).collect()
}

pub fn laser(sr: f32) -> Vec<f32> {
    let n = n_of(sr, 0.35);
    let mut o = Osc::default(); let mut m = Osc::default();
    (0..n).map(|i| { let t = i as f32 / sr; let f = 2400.0 * exp(-t * 9.0) + 160.0; o.sine(f * (1.0 + 0.3 * m.sine(f * 0.5, sr)), sr) * exp(-t * 7.0) * 0.6 }).collect()
}

pub fn warp(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    let mut f = Bq::bp(sr, 300.0, 1.4);
    let mut x = vec![0.0f32; n];
    for i in 0..n {
        let k = i as f32 / n as f32;
        if i % 64 == 0 { f.coef(Bq::bp(sr, 200.0 * pow(40.0, k), 1.6)); }
        let rise = pow(k, 2.2);
        x[i] = (f.run(nz.white()) * 0.8 + o.sine(90.0 * pow(25.0, rise), sr) * 0.35 + o2.saw(45.0 * pow(25.0, rise), sr) * 0.08) * smooth(k * 3.0) * (1.0 - smooth((k - 0.93) * 14.0));
    }
    normalize(&mut x, 0.85);
    let mut s = St::from_mono(&x, 0.0);
    let b = boom(sr, false, seed + 1);
    s.add(&b, n_of(sr, dur * 0.92), 0.7);
    s
}

pub fn teleport(sr: f32, dur: f32) -> St {
    let notes = [84.0f32, 88.0, 91.0, 96.0, 100.0, 103.0, 108.0];
    let mut s = St::new(n_of(sr, dur + 0.6));
    let step = dur / 18.0;
    for k in 0..18 {
        let m = notes[k % notes.len()] - if k % 2 == 0 { 0.0 } else { 12.0 };
        let n = n_of(sr, 0.18);
        let mut o = Osc::default();
        let f = midi(m);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; o.sine(f, sr) * exp(-t * 22.0) * 0.32 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * step), 1.0, if k % 2 == 0 { -0.6 } else { 0.6 });
    }
    reverb(&s, 1.6, 0.9, 0.9, 0.0, 0.5, 1.0, sr)
}

pub fn swirl(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut o = Osc::default();
    let maxd = n_of(sr, 0.012);
    let mut buf = vec![0.0f32; maxd + 2];
    let mut w = 0usize;
    let mut s = St::new(n);
    for i in 0..n {
        let k = i as f32 / n as f32; let t = i as f32 / sr;
        let src = nz.pink() * 0.7 + o.sine(60.0 + 140.0 * sin(PI * k), sr) * 0.4;
        buf[w] = src;
        let d = 1.0 + (maxd as f32 - 2.0) * (0.5 + 0.5 * sin(TAU * (0.4 + 1.6 * k) * t));
        let rpos = (w as f32 + buf.len() as f32 - d) % buf.len() as f32;
        let delayed = interp(&buf, rpos);
        w = (w + 1) % buf.len();
        let v = (src + delayed * 0.9) * sin(PI * k);
        let pan = sin(TAU * 0.7 * t);
        let a = (pan + 1.0) * PI * 0.25;
        s.l[i] = v * cos(a); s.r[i] = v * sin(a);
    }
    s
}

pub fn clock(sr: f32, ticks: usize, interval: f32) -> St {
    let mut s = St::new(n_of(sr, ticks as f32 * interval + 1.4));
    for k in 0..ticks {
        let n = n_of(sr, 0.05);
        let mut nz = Noise::new(100 + k as u32);
        let mut f = Bq::bp(sr, if k % 2 == 0 { 3200.0 } else { 2400.0 }, 4.0);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; f.run(nz.white()) * exp(-t * 120.0) * 2.5 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * interval), 1.0, if k % 2 == 0 { -0.4 } else { 0.4 });
    }
    // reverse swell after the ticks
    let n = n_of(sr, 1.2);
    let mut nz = Noise::new(77);
    let mut f = Bq::hp(sr, 3000.0, 0.7);
    let mut sw: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; f.run(nz.white()) * pow(k, 3.0) * 0.8 }).collect();
    fade(&mut sw, 0, n_of(sr, 0.01));
    s.add_mono(&sw, n_of(sr, ticks as f32 * interval), 1.0, 0.0);
    s
}

pub fn gong(sr: f32, dur: f32, f0: f32) -> St {
    let n = n_of(sr, dur);
    let ratios = [1.0f32, 1.47, 2.09, 2.56, 3.11, 4.2, 5.43, 6.8];
    let decays = [0.9f32, 1.1, 1.3, 1.6, 2.0, 2.6, 3.2, 4.0];
    let mut x = vec![0.0f32; n];
    for (j, r) in ratios.iter().enumerate() {
        let mut o = Osc::default();
        let f = f0 * r;
        let amp = 0.5 / (1.0 + j as f32 * 0.6);
        for i in 0..n {
            let t = i as f32 / sr;
            let beat = 1.0 + 0.003 * sin(TAU * (0.7 + j as f32 * 0.3) * t);
            let swell = if j >= 3 { 1.0 - exp(-t * 3.0) } else { 1.0 };
            x[i] += o.sine(f * beat, sr) * amp * exp(-t * decays[j] / dur * 2.2) * swell;
        }
    }
    let mut nz = Noise::new(9);
    let mut th = Bq::lp(sr, 300.0, 0.7);
    for i in 0..n_of(sr, 0.08).min(n) { let t = i as f32 / sr; x[i] += th.run(nz.white()) * exp(-t * 60.0) * 2.0; }
    normalize(&mut x, 0.8);
    reverb(&St::from_mono(&x, 0.0), 2.5, 1.2, 0.5, 0.01, 0.3, 1.0, sr)
}

pub fn harp(sr: f32, base: f32, count: usize, span: f32) -> St {
    let scale = [0.0f32, 2.0, 4.0, 7.0, 9.0];
    let mut s = St::new(n_of(sr, span + 2.0));
    for k in 0..count {
        let m = base + 12.0 * (k / 5) as f32 + scale[k % 5];
        let f = midi(m);
        let n = n_of(sr, 1.6);
        // Karplus–Strong
        let p = ((sr / f) as usize).max(2);
        let mut buf: Vec<f32> = { let mut nz = Noise::new(200 + k as u32); (0..p).map(|_| nz.white() * 0.5).collect() };
        let mut x = vec![0.0f32; n];
        let mut idx = 0;
        for i in 0..n {
            let a = buf[idx]; let b = buf[(idx + 1) % p];
            let v = 0.5 * (a + b) * 0.996;
            buf[idx] = v; idx = (idx + 1) % p;
            x[i] = a;
        }
        lp(&mut x, sr, 5000.0);
        s.add_mono(&x, n_of(sr, k as f32 * span / count as f32), 0.5, -0.7 + 1.4 * k as f32 / count as f32);
    }
    reverb(&s, 2.0, 1.0, 0.7, 0.01, 0.35, 1.0, sr)
}

pub fn wings(sr: f32, flaps: usize, interval: f32) -> St {
    let mut s = St::new(n_of(sr, flaps as f32 * interval + 0.5));
    for k in 0..flaps {
        let n = n_of(sr, 0.32);
        let mut nz = Noise::new(300 + k as u32);
        let mut f = Bq::lp(sr, 500.0, 0.8);
        let x: Vec<f32> = (0..n).map(|i| { let kk = i as f32 / n as f32; f.run(nz.white()) * sin(PI * kk) * pow(1.0 - kk, 1.5) * 2.2 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * interval), 1.0 - 0.1 * k as f32, if k % 2 == 0 { -0.3 } else { 0.3 });
    }
    s
}

pub fn horn(sr: f32, dur: f32, note: f32) -> St {
    let n = n_of(sr, dur);
    let f0 = midi(note);
    let mut o = Osc::default(); let mut o2 = Osc::default(); let mut nz = Noise::new(41);
    let mut f1 = Bq::bp(sr, 520.0, 1.6); let mut f2 = Bq::bp(sr, 1100.0, 2.2); let mut low = Bq::lp(sr, 2200.0, 0.7);
    let mut x = vec![0.0f32; n];
    for i in 0..n {
        let k = i as f32 / n as f32; let t = i as f32 / sr;
        let f = f0 * (0.94 + 0.06 * smooth(t / 0.25)) * (1.0 + 0.006 * sin(TAU * 4.5 * t));
        let src = o.saw(f, sr) + 0.5 * o2.saw(f * 1.004, sr) + nz.white() * 0.08;
        let v = low.run(f1.run(src) * 1.4 + f2.run(src) * 0.7 + src * 0.12);
        x[i] = v * smooth(t / 0.3) * (1.0 - smooth((k - 0.82) / 0.18));
    }
    normalize(&mut x, 0.85);
    reverb(&St::from_mono(&x, 0.0), 2.4, 1.3, 0.4, 0.02, 0.4, 1.0, sr)
}

pub fn hooves(sr: f32, beats: usize, interval: f32) -> St {
    let mut s = St::new(n_of(sr, beats as f32 * interval + 0.4));
    for k in 0..beats {
        let n = n_of(sr, 0.12);
        let mut o = Osc::default(); let mut nz = Noise::new(500 + k as u32);
        let mut hf = Bq::bp(sr, 1800.0, 1.5);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; o.sine(95.0 - 300.0 * t, sr) * exp(-t * 40.0) * 0.8 + hf.run(nz.white()) * exp(-t * 90.0) * 0.6 }).collect();
        let swing = if k % 2 == 1 { interval * 0.35 } else { 0.0 };
        s.add_mono(&x, n_of(sr, (k / 2) as f32 * interval * 2.0 + swing), 0.9, if k % 2 == 0 { -0.25 } else { 0.25 });
    }
    s
}

pub fn thunder(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut crack_f = Bq::hp(sr, 900.0, 0.7);
    let mut rum = Bq::lp(sr, 180.0, 0.8);
    let mut mid = Bq::lp(sr, 700.0, 0.7);
    let mut x = vec![0.0f32; n];
    let mut modv = 0.0f32;
    for i in 0..n {
        let t = i as f32 / sr;
        let crack = crack_f.run(nz.white()) * exp(-t * 18.0) * 2.0 * (1.0 - exp(-t * 2000.0));
        if i % 2048 == 0 { modv = 0.4 + 0.6 * abs(nz.white()); }
        let r = rum.run(nz.brown()) * 2.6 * modv * exp(-t * 1.0 / dur * 2.5) * (1.0 - exp(-t * 8.0));
        let m = mid.run(nz.white()) * 0.5 * exp(-t * 3.0);
        x[i] = tanh(crack) + r + m;
    }
    normalize(&mut x, 0.95);
    reverb(&St::from_mono(&x, 0.0), 2.8, 1.4, 0.3, 0.02, 0.45, 1.0, sr)
}

pub fn bells(sr: f32, notes: &[f32], spacing: f32) -> St {
    let partial = [(1.0f32, 1.0f32, 1.6f32), (2.76, 0.5, 2.6), (5.4, 0.25, 4.0), (8.93, 0.12, 6.0), (0.5, 0.35, 1.0)];
    let mut s = St::new(n_of(sr, notes.len() as f32 * spacing + 3.0));
    for (k, m) in notes.iter().enumerate() {
        let f = midi(*m);
        let n = n_of(sr, 2.8);
        let mut x = vec![0.0f32; n];
        for (r, a, d) in partial.iter() {
            let mut o = Osc::default();
            for i in 0..n { let t = i as f32 / sr; x[i] += o.sine(f * r, sr) * a * exp(-t * d) * 0.3; }
        }
        s.add_mono(&x, n_of(sr, k as f32 * spacing), 1.0, if k % 2 == 0 { -0.4 } else { 0.4 });
    }
    reverb(&s, 2.6, 1.2, 0.6, 0.01, 0.4, 1.0, sr)
}

pub fn sistrum(sr: f32, dur: f32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(61);
    let mut f = Bq::bp(sr, 6200.0, 3.0); let mut f2 = Bq::bp(sr, 4100.0, 4.0);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let shake = pow(abs(sin(PI * 7.0 * t)), 8.0);
        (f.run(nz.white()) + f2.run(nz.white()) * 0.6) * shake * (1.0 - k) * 2.5
    }).collect();
    St::from_mono(&x, 0.2)
}

pub fn shimmer(sr: f32, dur: f32, notes: &[f32]) -> St {
    let n = n_of(sr, dur);
    let mut s = St::new(n);
    for (j, m) in notes.iter().enumerate() {
        let mut o = Osc::default();
        let f = midi(*m);
        let x: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; let t = i as f32 / sr; o.sine(f, sr) * (0.6 + 0.4 * sin(TAU * (3.0 + j as f32) * t)) * sin(PI * k) * 0.12 }).collect();
        s.add_mono(&x, 0, 1.0, -0.8 + 1.6 * j as f32 / notes.len().max(1) as f32);
    }
    reverb(&s, 3.0, 1.1, 0.9, 0.0, 0.5, 1.0, sr)
}

pub fn fire(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut roar = Bq::bp(sr, 380.0, 0.6);
    let mut cr = Bq::hp(sr, 3000.0, 0.7);
    let mut crackle = 0.0f32;
    let x: Vec<f32> = (0..n).map(|i| {
        let k = i as f32 / n as f32;
        if nz.white() > 0.997 { crackle = 1.0; }
        let c = cr.run(nz.white()) * crackle; crackle *= 0.9;
        (roar.run(nz.brown()) * 2.2 + c * 0.6) * smooth(k * 5.0) * (1.0 - smooth((k - 0.75) * 4.0))
    }).collect();
    let mut s = St::from_mono(&x, 0.0);
    let d = n_of(sr, 0.013);
    let mut r = vec![0.0f32; n];
    for i in d..n { r[i] = s.r[i - d]; }
    s.r = r;
    s
}

/// A ram's-horn blast (tekiah). `note` is the fundamental (MIDI).
pub fn shofar(sr: f32, dur: f32, note: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let f0 = midi(note);
    let mut o = Osc::default(); let mut o2 = Osc::default(); let mut nz = Noise::new(seed);
    let mut f1 = Bq::bp(sr, 760.0, 1.3); let mut f2 = Bq::bp(sr, 1500.0, 1.8); let mut f3 = Bq::bp(sr, 2900.0, 2.5);
    let mut low = Bq::lp(sr, 4200.0, 0.7);
    let mut jit = 0.0f32;
    let mut x = vec![0.0f32; n];
    for i in 0..n {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        if i % 256 == 0 { jit = jit * 0.7 + nz.white() * 0.3; }
        // starts a little flat, settles, then breaks upward to the fifth at the end
        let up = smooth((k - 0.8) / 0.06);
        let f = f0 * (0.9 + 0.1 * smooth(t / 0.12)) * (1.0 + 0.5 * up) * (1.0 + 0.008 * sin(TAU * 5.3 * t) + 0.006 * jit);
        let src = o.square(f, sr, 0.36) * 0.6 + o2.saw(f, sr) * 0.5 + nz.white() * 0.07;
        let v = f1.run(src) * 1.2 + f2.run(src) * 0.9 + f3.run(src) * 0.45 + src * 0.08;
        x[i] = low.run(v) * smooth(t / 0.07) * (1.0 - smooth((k - 0.93) / 0.07));
    }
    saturate(&mut x, 0.3);
    normalize(&mut x, 0.9);
    reverb(&St::from_mono(&x, 0.0), 2.2, 1.4, 0.5, 0.02, 0.38, 1.0, sr)
}

pub fn subdrop(sr: f32, dur: f32) -> Vec<f32> {
    let n = n_of(sr, dur);
    let mut o = Osc::default();
    (0..n).map(|i| { let t = i as f32 / sr; let k = i as f32 / n as f32; o.sine(92.0 * pow(0.3, k), sr) * (1.0 - exp(-t * 80.0)) * pow(1.0 - k, 1.4) * 0.9 }).collect()
}

pub fn heartbeat(sr: f32) -> Vec<f32> {
    let mut x = vec![0.0f32; n_of(sr, 0.9)];
    for (at, g) in [(0.0f32, 1.0f32), (0.22, 0.7)] {
        let a = n_of(sr, at);
        let mut o = Osc::default();
        for i in 0..n_of(sr, 0.18) { let t = i as f32 / sr; if a + i < x.len() { x[a + i] += o.sine(62.0 - 40.0 * t, sr) * exp(-t * 22.0) * g; } }
    }
    x
}

/// Formant-synth choir singing vowels. notes in MIDI; vowels morph through `vowels`.
pub fn choir(sr: f32, notes: &[f32], dur: f32, vowels: &[u8], per: usize, attack: f32, seed: u32) -> St {
    const V: [[f32; 3]; 5] = [[730.0, 1090.0, 2440.0], [570.0, 840.0, 2410.0], [300.0, 870.0, 2240.0], [660.0, 1700.0, 2400.0], [640.0, 1000.0, 2500.0]];
    let n = n_of(sr, dur);
    let mut s = St::new(n);
    let mut rng = Rng::new(seed as u64);
    for (j, m) in notes.iter().enumerate() {
        let f0 = midi(*m);
        let fem = f0 > 230.0;
        for v in 0..per {
            let det = pow(2.0, rng.range(-11.0, 11.0) / 1200.0);
            let vr = rng.range(4.6, 5.8); let vd = rng.range(0.004, 0.009); let ph = rng.range(0.0, TAU);
            let mut o = Osc::default(); o.ph = rng.f();
            let mut nz = Noise::new(seed * 31 + (j * 7 + v) as u32);
            let mut src = vec![0.0f32; n];
            for i in 0..n {
                let t = i as f32 / sr;
                let f = f0 * det * (1.0 + vd * sin(TAU * vr * t + ph) * smooth(t / 0.6));
                src[i] = o.saw(f, sr) * 0.6 + nz.white() * 0.05;
            }
            let mut y = vec![0.0f32; n];
            let segs = vowels.len().max(1);
            for (q, vw) in vowels.iter().enumerate() {
                let fm = V[(*vw as usize).min(4)];
                let sc = if fem { 1.17 } else { 1.0 };
                let mut a = Bq::bp(sr, fm[0] * sc, 6.0); let mut b = Bq::bp(sr, fm[1] * sc, 8.0); let mut c = Bq::bp(sr, fm[2] * sc, 12.0);
                let centre = (q as f32 + 0.5) / segs as f32;
                for i in 0..n {
                    let k = i as f32 / n as f32;
                    let mut w = clamp(1.0 - abs(k - centre) * segs as f32, 0.0, 1.0);
                    if segs == 1 || (q == 0 && k < centre) || (q == segs - 1 && k > centre) { w = 1.0; }
                    if w <= 0.0 { a.run(src[i]); b.run(src[i]); c.run(src[i]); continue; }
                    y[i] += (a.run(src[i]) * 1.0 + b.run(src[i]) * 0.55 + c.run(src[i]) * 0.25) * w;
                }
            }
            let env = env_adsr(n, sr, attack * rng.range(0.8, 1.2), 0.3, 0.85, 0.9);
            for i in 0..n { y[i] *= env[i]; }
            s.add_mono(&y, 0, 1.0, rng.range(-0.85, 0.85));
        }
    }
    filt_st(&mut s, Bq::hp(sr, 80.0, 0.7));
    let p = s.peak(); if p > 0.0 { s.gain(0.8 / p); }
    s
}

/// Sawtooth chord used as a vocoder carrier.
pub fn chord_carrier(sr: f32, len: usize, notes: &[f32], seed: u32) -> Vec<f32> {
    let mut x = vec![0.0f32; len];
    let mut rng = Rng::new(seed as u64);
    for m in notes {
        for _ in 0..2 {
            let f0 = midi(*m) * pow(2.0, rng.range(-8.0, 8.0) / 1200.0);
            let mut o = Osc::default(); o.ph = rng.f();
            let vr = rng.range(4.5, 5.6); let ph = rng.range(0.0, TAU);
            for i in 0..len { let t = i as f32 / sr; x[i] += o.saw(f0 * (1.0 + 0.005 * sin(TAU * vr * t + ph)), sr); }
        }
    }
    let mut nz = Noise::new(seed);
    for v in x.iter_mut() { *v += nz.white() * 0.15; }
    normalize(&mut x, 0.9);
    x
}

pub fn honk(sr: f32) -> St {
    let mut s = St::new(n_of(sr, 0.7));
    for at in [0.0f32, 0.26] {
        let n = n_of(sr, 0.2);
        let mut a = Osc::default(); let mut b = Osc::default();
        let mut x: Vec<f32> = (0..n).map(|_| a.square(415.0, sr, 0.5) * 0.3 + b.square(523.0, sr, 0.5) * 0.3).collect();
        lp(&mut x, sr, 2500.0); fade(&mut x, n_of(sr, 0.005), n_of(sr, 0.02));
        s.add_mono(&x, n_of(sr, at), 0.9, 0.0);
    }
    s
}

pub fn buzzer(sr: f32) -> Vec<f32> {
    let n = n_of(sr, 0.9);
    let mut a = Osc::default(); let mut b = Osc::default();
    let mut x: Vec<f32> = (0..n).map(|_| a.saw(110.0, sr) * 0.4 + b.square(165.0, sr, 0.5) * 0.25).collect();
    lp(&mut x, sr, 1800.0); fade(&mut x, n_of(sr, 0.01), n_of(sr, 0.1));
    x
}

pub fn rumble(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut lo = Bq::lp(sr, 160.0, 0.8);
    let mut cl = Bq::bp(sr, 1400.0, 2.0);
    let mut clat = 0.0f32;
    let x: Vec<f32> = (0..n).map(|i| {
        let k = i as f32 / n as f32;
        if nz.white() > 0.998 { clat = 1.0; }
        let c = cl.run(nz.white()) * clat; clat *= 0.96;
        (lo.run(nz.brown()) * 2.0 + c * 0.7) * sin(PI * k)
    }).collect();
    St::from_mono(&x, 0.0)
}

pub fn magnet(sr: f32) -> St {
    let n = n_of(sr, 0.9);
    let mut a = Osc::default(); let mut b = Osc::default();
    let x: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; let t = i as f32 / sr; let f = 110.0 + 160.0 * k; (a.sine(f, sr) * 0.5 + b.saw(f * 2.0, sr) * 0.1) * (0.6 + 0.4 * sin(TAU * 18.0 * t)) * sin(PI * k) }).collect();
    St::from_mono(&x, 0.0)
}

pub fn explosion(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 1.6);
    let mut nz = Noise::new(seed);
    let mut lo = Bq::lp(sr, 900.0, 0.7);
    let mut o = Osc::default();
    let mut x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; lo.run(nz.white()) * 1.6 * exp(-t * 4.0) * (1.0 - exp(-t * 3000.0)) + o.sine(60.0 - 30.0 * t, sr) * exp(-t * 5.0) }).collect();
    saturate(&mut x, 0.6);
    normalize(&mut x, 0.95);
    reverb(&St::from_mono(&x, 0.0), 1.6, 1.1, 0.3, 0.0, 0.3, 1.0, sr)
}

pub fn tape_down(sr: f32) -> St {
    let n = n_of(sr, 0.9);
    let mut a = Osc::default(); let mut b = Osc::default();
    let x: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; let f = 440.0 * pow(0.25, k); (a.saw(f, sr) * 0.3 + b.sine(f * 0.5, sr) * 0.5) * (1.0 - k) * smooth(k * 20.0) }).collect();
    let mut x = x; lp(&mut x, sr, 1800.0);
    St::from_mono(&x, 0.0)
}

pub fn arp_up(sr: f32, notes: &[f32], step: f32) -> St {
    let mut s = St::new(n_of(sr, notes.len() as f32 * step + 0.8));
    for (k, m) in notes.iter().enumerate() {
        let n = n_of(sr, 0.4);
        let mut o = Osc::default(); let mut o2 = Osc::default();
        let f = midi(*m);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; (o.sine(f, sr) + 0.25 * o2.sine(f * 3.0, sr)) * exp(-t * 9.0) * 0.4 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * step), 1.0, -0.5 + k as f32 / notes.len() as f32);
    }
    reverb(&s, 1.4, 0.8, 0.8, 0.0, 0.35, 1.0, sr)
}


// ───────────────────────── new for the 124-tier ladder

/// Bicycle bell: "ring-ring".
pub fn bike_bell(sr: f32) -> St {
    let mut s = St::new(n_of(sr, 1.4));
    for (k, at) in [0.0f32, 0.16].iter().enumerate() {
        let n = n_of(sr, 1.1);
        let f0 = 2850.0;
        let parts = [(1.0f32, 1.0f32, 5.0f32), (1.51, 0.6, 7.0), (2.13, 0.35, 9.0), (2.93, 0.2, 12.0), (0.5, 0.2, 4.0)];
        let mut x = vec![0.0f32; n];
        for (r, a, d) in parts.iter() {
            let mut o = Osc::default();
            for i in 0..n { let t = i as f32 / sr; x[i] += o.sine(f0 * r * (1.0 + 0.004 * sin(TAU * 13.0 * t)), sr) * a * exp(-t * d) * 0.25; }
        }
        let mut nz = Noise::new(900 + k as u32); let mut hf = Bq::hp(sr, 4000.0, 0.7);
        for i in 0..n_of(sr, 0.01) { x[i] += hf.run(nz.white()) * 0.4 * (1.0 - i as f32 / n_of(sr, 0.01) as f32); }
        s.add_mono(&x, n_of(sr, *at), 1.0, if k == 0 { -0.2 } else { 0.2 });
    }
    s
}

/// Footsteps (soft for a crawl, heavy for a stomp).
pub fn steps(sr: f32, count: usize, interval: f32, heavy: f32, seed: u32) -> St {
    let mut s = St::new(n_of(sr, count as f32 * interval + 0.4));
    for k in 0..count {
        let n = n_of(sr, 0.14);
        let mut o = Osc::default(); let mut nz = Noise::new(seed + k as u32 * 3);
        let mut f = Bq::bp(sr, 900.0 + 600.0 * (1.0 - heavy), 1.2);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; o.sine((80.0 + 60.0 * (1.0 - heavy)) - 200.0 * t, sr) * exp(-t * 30.0) * (0.3 + 0.7 * heavy) + f.run(nz.white()) * exp(-t * 70.0) * 0.6 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * interval), 1.0 - 0.04 * k as f32, if k % 2 == 0 { -0.3 } else { 0.3 });
    }
    s
}

/// A squeaky rubber toy.
pub fn squeak(sr: f32) -> St {
    let mut s = St::new(n_of(sr, 0.8));
    for (at, f0, f1) in [(0.0f32, 1700.0f32, 2300.0f32), (0.3, 2200.0, 1500.0)] {
        let n = n_of(sr, 0.22);
        let mut o = Osc::default(); let mut o2 = Osc::default();
        let x: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; let t = i as f32 / sr; let f = (f0 + (f1 - f0) * k) * (1.0 + 0.04 * sin(TAU * 38.0 * t)); (o.sine(f, sr) * 0.6 + o2.square(f, sr, 0.3) * 0.12) * sin(PI * k) }).collect();
        s.add_mono(&x, n_of(sr, at), 0.8, 0.0);
    }
    s
}

/// Electric motor whine (e-scooters, e-bikes, maglevs).
pub fn whine(sr: f32, dur: f32, f0: f32, f1: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut a = Osc::default(); let mut b = Osc::default(); let mut c = Osc::default(); let mut nz = Noise::new(seed);
    let mut tyre = Bq::bp(sr, 300.0, 0.8);
    let x: Vec<f32> = (0..n).map(|i| {
        let k = i as f32 / n as f32;
        let f = f0 + (f1 - f0) * smooth(k * 1.3);
        let env = smooth(k * 6.0) * (1.0 - smooth((k - 0.78) * 4.5));
        (a.sine(f, sr) * 0.5 + b.sine(f * 2.0, sr) * 0.15 + c.sine(f * 3.01, sr) * 0.08 + tyre.run(nz.white()) * 0.35 * k) * env
    }).collect();
    St::from_mono(&x, 0.0)
}

/// Two-stroke buzz (mopeds, scooters, tuk-tuks, jet skis).
pub fn twostroke(sr: f32, dur: f32, f_lo: f32, f_hi: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut o = Osc::default(); let mut nz = Noise::new(seed);
    let mut bp = Bq::bp(sr, 1400.0, 0.9); let mut lo = Bq::lp(sr, 3500.0, 0.7);
    let mut x = vec![0.0f32; n];
    let mut jit = 0.0f32;
    for i in 0..n {
        let k = i as f32 / n as f32;
        if i % 200 == 0 { jit = nz.white() * 0.03; }
        let f = (f_lo + (f_hi - f_lo) * smooth(k / 0.6)) * (1.0 + jit);
        let src = o.square(f, sr, 0.18) + nz.white() * 0.2;
        x[i] = lo.run(bp.run(src) * 1.6 + src * 0.15) * smooth(k * 8.0) * (1.0 - smooth((k - 0.8) * 5.0));
    }
    saturate(&mut x, 0.5);
    normalize(&mut x, 0.8);
    let mut s = St::from_mono(&x, 0.0);
    let d = n_of(sr, 0.009); let mut r = vec![0.0f32; n]; for i in d..n { r[i] = s.r[i - d]; } s.r = r;
    s
}

/// Multi-tone horn: a train's chime horn or (low notes) a ship's foghorn.
pub fn big_horn(sr: f32, dur: f32, notes: &[f32], blasts: usize) -> St {
    let mut s = St::new(n_of(sr, dur * blasts as f32 + 2.0));
    for bl in 0..blasts {
        let n = n_of(sr, dur * if bl + 1 == blasts { 1.0 } else { 0.55 });
        let mut x = vec![0.0f32; n];
        for (j, m) in notes.iter().enumerate() {
            let f0 = midi(*m);
            let mut o = Osc::default(); let mut o2 = Osc::default();
            let mut f1 = Bq::bp(sr, (f0 * 3.0).min(1800.0), 1.2);
            for i in 0..n {
                let t = i as f32 / sr; let k = i as f32 / n as f32;
                let f = f0 * (0.97 + 0.03 * smooth(t / 0.15)) * (1.0 + 0.002 * sin(TAU * (3.0 + j as f32) * t));
                let src = o.saw(f, sr) * 0.6 + o2.square(f * 1.003, sr, 0.5) * 0.4;
                x[i] += (f1.run(src) * 1.2 + src * 0.25) * smooth(t / 0.06) * (1.0 - smooth((k - 0.88) / 0.12)) / notes.len() as f32;
            }
        }
        lp(&mut x, sr, 3200.0);
        s.add_mono(&x, n_of(sr, bl as f32 * dur * 0.75), 1.0, 0.0);
    }
    let p = s.peak(); if p > 0.0 { s.gain(0.85 / p); }
    reverb(&s, 2.6, 1.6, 0.35, 0.03, 0.4, 1.0, sr)
}

/// Steam whistle.
pub fn whistle(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut a = Osc::default(); let mut b = Osc::default();
    let mut bp = Bq::bp(sr, 1150.0, 6.0); let mut hiss = Bq::hp(sr, 3000.0, 0.7);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let f = 1150.0 * (0.92 + 0.08 * smooth(t / 0.2));
        let tone = a.sine(f, sr) * 0.5 + b.sine(f * 1.26, sr) * 0.3 + bp.run(nz.white()) * 1.4;
        (tone + hiss.run(nz.white()) * 0.15) * smooth(t / 0.05) * (1.0 - smooth((k - 0.85) / 0.15))
    }).collect();
    reverb(&St::from_mono(&x, 0.1), 1.8, 1.2, 0.6, 0.02, 0.35, 1.0, sr)
}

/// Steam locomotive chuffs, speeding up.
pub fn chug(sr: f32, count: usize, interval: f32, seed: u32) -> St {
    let mut s = St::new(n_of(sr, count as f32 * interval + 0.5));
    let mut at = 0.0f32; let mut iv = interval;
    for k in 0..count {
        let n = n_of(sr, 0.22);
        let mut nz = Noise::new(seed + k as u32);
        let mut f = Bq::bp(sr, 500.0 + 200.0 * (k % 2) as f32, 0.8);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; f.run(nz.white()) * exp(-t * 18.0) * (1.0 - exp(-t * 400.0)) * 1.6 }).collect();
        s.add_mono(&x, n_of(sr, at), 1.0, if k % 2 == 0 { -0.25 } else { 0.25 });
        at += iv; iv *= 0.93;
    }
    s
}

/// Sea swell.
pub fn waves(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed); let mut nz2 = Noise::new(seed + 1);
    let mut lo = Bq::lp(sr, 900.0, 0.6); let mut lo2 = Bq::lp(sr, 1400.0, 0.6);
    let mut s = St::new(n);
    for i in 0..n {
        let k = i as f32 / n as f32; let t = i as f32 / sr;
        let sw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(TAU * 0.45 * t - 1.2), 2.0);
        let env = smooth(k * 4.0) * (1.0 - smooth((k - 0.75) * 4.0));
        s.l[i] = lo.run(nz.white()) * sw * env * 1.2;
        s.r[i] = lo2.run(nz2.white()) * sw * env * 1.2;
    }
    s
}

/// A splash of water.
pub fn splash(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 0.9);
    let mut nz = Noise::new(seed);
    let mut hf = Bq::bp(sr, 2500.0, 0.6); let mut lf = Bq::lp(sr, 500.0, 0.7);
    let mut drop = 0.0f32;
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr;
        if nz.white() > 0.996 { drop = 1.0; }
        let d = drop * sin(TAU * (1200.0 + 1800.0 * drop) * t); drop *= 0.995;
        hf.run(nz.white()) * exp(-t * 5.0) * 1.3 + lf.run(nz.white()) * exp(-t * 12.0) * 1.5 + d * 0.15 * exp(-t * 2.0)
    }).collect();
    St::from_mono(&x, 0.0)
}

/// Submarine sonar ping with bubbles.
pub fn sonar(sr: f32, pings: usize, seed: u32) -> St {
    let mut s = St::new(n_of(sr, pings as f32 * 0.9 + 2.0));
    for k in 0..pings {
        let n = n_of(sr, 1.2);
        let mut o = Osc::default();
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; o.sine(1450.0 - 40.0 * t, sr) * exp(-t * 3.0) * (1.0 - exp(-t * 300.0)) * 0.5 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * 0.9), 1.0 - 0.25 * k as f32, 0.0);
    }
    let n = s.len();
    let mut nz = Noise::new(seed);
    let mut bub = vec![0.0f32; n];
    let mut ph = 0.0f32; let mut f = 0.0f32; let mut a = 0.0f32;
    for i in 0..n { if nz.white() > 0.9993 { f = 300.0 + 500.0 * abs(nz.white()); a = 0.4; } ph += f / sr; f *= 1.0002; bub[i] = sin(TAU * ph) * a; a *= 0.9985; }
    s.add_mono(&bub, 0, 0.6, 0.3);
    reverb(&s, 3.5, 1.6, 0.3, 0.05, 0.6, 1.0, sr)
}

/// Helicopter: chopped noise and blade slap.
pub fn chopper(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut lo = Bq::lp(sr, 700.0, 0.8); let mut tail = Osc::default();
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let rate = 17.0 + 3.0 * k;
        let slap = pow(0.5 + 0.5 * sin(TAU * rate * t), 6.0);
        (lo.run(nz.white()) * (0.25 + 1.6 * slap) + tail.saw(95.0, sr) * 0.05) * sin(PI * k)
    }).collect();
    let mut s = St::from_mono(&x, 0.0);
    for i in 0..n { let k = i as f32 / n as f32; let a = (-0.7 + 1.4 * k + 1.0) * PI * 0.25; let v = s.l[i]; s.l[i] = v * cos(a) * 1.3; s.r[i] = v * sin(a) * 1.3; }
    s
}

/// Hot-air balloon burner.
pub fn burner(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut bp = Bq::bp(sr, 420.0, 0.7); let mut lo = Bq::lp(sr, 2400.0, 0.7);
    let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; let k = i as f32 / n as f32; lo.run(bp.run(nz.white()) * 2.0 + nz.white() * 0.2) * smooth(t / 0.04) * (1.0 - smooth((k - 0.7) / 0.3)) }).collect();
    St::from_mono(&x, 0.0)
}

/// Giant-robot stomps with servo whirs.
pub fn stomp(sr: f32, count: usize, interval: f32, seed: u32) -> St {
    let mut s = St::new(n_of(sr, count as f32 * interval + 1.0));
    for k in 0..count {
        let n = n_of(sr, 0.6);
        let mut o = Osc::default(); let mut nz = Noise::new(seed + k as u32); let mut cl = Bq::bp(sr, 2400.0, 3.0);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; o.sine(55.0 - 25.0 * t, sr) * exp(-t * 7.0) * 1.2 + cl.run(nz.white()) * exp(-t * 25.0) * 0.8 }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * interval), 1.0, if k % 2 == 0 { -0.3 } else { 0.3 });
        let m = n_of(sr, interval * 0.5);
        let mut w = Osc::default();
        let y: Vec<f32> = (0..m).map(|i| { let kk = i as f32 / m as f32; w.saw(400.0 + 900.0 * kk, sr) * sin(PI * kk) * 0.06 }).collect();
        s.add_mono(&y, n_of(sr, k as f32 * interval + interval * 0.3), 1.0, 0.0);
    }
    s
}

/// A stadium crowd cheering.
pub fn crowd(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut s = St::new(n);
    let mut rng = Rng::new(seed as u64);
    for v in 0..14 {
        let mut nz = Noise::new(seed + v);
        let fc = rng.range(500.0, 2600.0);
        let mut f = Bq::bp(sr, fc, 3.0);
        let rate = rng.range(2.0, 7.0); let ph = rng.range(0.0, TAU);
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; let k = i as f32 / n as f32; f.run(nz.white()) * (0.6 + 0.4 * sin(TAU * rate * t + ph)) * smooth(k * 3.0) * (1.0 - smooth((k - 0.7) / 0.3)) }).collect();
        s.add_mono(&x, 0, 0.5, rng.range(-0.9, 0.9));
    }
    reverb(&s, 1.6, 1.4, 0.5, 0.01, 0.3, 1.0, sr)
}

/// Elephant trumpet (Airavata).
pub fn trumpet(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 1.6);
    let mut o = Osc::default(); let mut nz = Noise::new(seed);
    let mut f1 = Bq::bp(sr, 900.0, 2.0); let mut f2 = Bq::bp(sr, 2400.0, 3.0);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let f = (420.0 + 260.0 * sin(PI * clamp(k * 1.6, 0.0, 1.0))) * (1.0 + 0.025 * sin(TAU * 9.0 * t));
        let src = o.saw(f, sr) + nz.white() * 0.25;
        (f1.run(src) * 1.4 + f2.run(src) * 0.8) * smooth(t / 0.05) * (1.0 - smooth((k - 0.7) / 0.3))
    }).collect();
    let mut x = x; saturate(&mut x, 0.4); normalize(&mut x, 0.85);
    reverb(&St::from_mono(&x, 0.0), 2.4, 1.4, 0.5, 0.02, 0.4, 1.0, sr)
}

/// Whale song (Jonah's great fish).
pub fn whale(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 3.2);
    let mut o = Osc::default(); let mut o2 = Osc::default(); let mut nz = Noise::new(seed);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let f = 180.0 + 220.0 * sin(PI * k) * (0.6 + 0.4 * sin(TAU * 0.9 * t)) - 60.0 * k;
        (o.sine(f, sr) * 0.6 + o2.sine(f * 2.02, sr) * 0.2 + nz.pink() * 0.02) * sin(PI * k)
    }).collect();
    reverb(&St::from_mono(&x, 0.0), 5.0, 1.8, 0.3, 0.06, 0.65, 1.0, sr)
}

/// Rushing wind.
pub fn wind(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut nz = Noise::new(seed);
    let mut f = Bq::bp(sr, 600.0, 1.2);
    let mut s = St::new(n);
    for i in 0..n {
        let k = i as f32 / n as f32; let t = i as f32 / sr;
        if i % 64 == 0 { f.coef(Bq::bp(sr, 400.0 + 900.0 * (0.5 + 0.5 * sin(TAU * 0.6 * t)), 1.6)); }
        let v = f.run(nz.white()) * sin(PI * k) * 1.4;
        let a = (sin(TAU * 0.3 * t) + 1.0) * PI * 0.25;
        s.l[i] = v * cos(a); s.r[i] = v * sin(a);
    }
    s
}

/// Deep cinematic impact for a brand-new tier.
pub fn impact(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 1.4);
    let mut o = Osc::default(); let mut nz = Noise::new(seed);
    let mut cr = Bq::hp(sr, 1800.0, 0.7); let mut body = Bq::lp(sr, 400.0, 0.8);
    let mut x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr;
        o.sine(38.0 + 110.0 * exp(-t * 14.0), sr) * exp(-t * 3.5) * 1.1 + cr.run(nz.white()) * exp(-t * 40.0) * 0.7 + body.run(nz.white()) * exp(-t * 9.0) * 0.6
    }).collect();
    saturate(&mut x, 0.5);
    normalize(&mut x, 0.95);
    reverb(&St::from_mono(&x, 0.0), 1.8, 1.4, 0.3, 0.0, 0.3, 1.0, sr)
}

/// Era stinger: a reverse-cymbal swell into a boom and a brass stab.
pub fn era_stinger(sr: f32, seed: u32) -> St {
    let rise = 0.7f32;
    let mut s = St::new(n_of(sr, rise + 3.2));
    let n = n_of(sr, rise);
    let mut nz = Noise::new(seed); let mut hf = Bq::hp(sr, 3500.0, 0.7);
    let x: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; hf.run(nz.white()) * pow(k, 3.0) * 1.2 }).collect();
    s.add_mono(&x, 0, 1.0, 0.0);
    let b = boom(sr, false, seed + 3);
    s.add(&b, n, 0.9);
    let m = n_of(sr, 1.6);
    let mut y = vec![0.0f32; m];
    for note in [50.0f32, 57.0, 62.0, 66.0, 69.0] {
        let f = midi(note);
        let mut o = Osc::default(); let mut o2 = Osc::default();
        let mut lpf = Bq::lp(sr, 2400.0, 0.9);
        for i in 0..m { let t = i as f32 / sr; y[i] += lpf.run(o.saw(f, sr) + o2.saw(f * 1.006, sr)) * (1.0 - exp(-t * 60.0)) * exp(-t * 2.2) * 0.14; }
    }
    fade(&mut y, 0, n_of(sr, 0.25));
    s.add_mono(&y, n, 1.0, 0.0);
    // it evolved: a run of bells climbing out of the chord
    let m2 = n_of(sr, 3.0);
    let mut z = vec![0.0f32; m2];
    for (k, note) in [62.0f32, 66.0, 69.0, 74.0, 78.0, 81.0, 86.0, 90.0].iter().enumerate() {
        let f = midi(*note);
        let at = n_of(sr, 0.12 + 0.075 * k as f32);
        let mut o = Osc::default(); let mut o2 = Osc::default();
        for (i, v) in z.iter_mut().enumerate().skip(at) {
            let t = (i - at) as f32 / sr;
            *v += (o.sine(f, sr) + 0.35 * o2.sine(f * 2.76, sr) * exp(-t * 6.0)) * (1.0 - exp(-t * 900.0)) * exp(-t * 2.6) * 0.075;
        }
    }
    fade(&mut z, 0, n_of(sr, 0.3));
    s.add_mono(&z, n, 1.0, 0.0);
    reverb(&s, 2.4, 1.5, 0.5, 0.01, 0.35, 1.0, sr)
}

/// Combo blip (the browser pitches it up as the combo grows).
pub fn blip(sr: f32) -> St {
    let n = n_of(sr, 0.35);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; (o.sine(1046.5, sr) + 0.4 * o2.sine(3139.5, sr)) * exp(-t * 12.0) * (1.0 - exp(-t * 2000.0)) * 0.5 }).collect();
    reverb(&St::from_mono(&x, 0.0), 0.9, 0.7, 0.9, 0.0, 0.25, 1.0, sr)
}

/// Spring boing.
pub fn boing(sr: f32) -> St {
    let n = n_of(sr, 0.5);
    let mut o = Osc::default();
    let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; let f = 180.0 * (1.0 + 0.6 * exp(-t * 6.0) * sin(TAU * 14.0 * t)); o.sine(f, sr) * exp(-t * 6.0) * 0.6 }).collect();
    St::from_mono(&x, 0.0)
}

/// Note samples for the bounce melody, all at MIDI 72 (the browser repitches).
/// timbre: 0 toy xylophone, 1 synth pluck, 2 glass bell, 3 harp, 4 celesta
pub fn mallet(sr: f32, timbre: u8) -> St {
    let f = midi(72.0);
    let n = n_of(sr, if timbre == 2 || timbre == 4 { 2.0 } else { 1.2 });
    let mut x = vec![0.0f32; n];
    match timbre {
        0 => { let mut a = Osc::default(); let mut b = Osc::default(); for i in 0..n { let t = i as f32 / sr; x[i] = (a.sine(f, sr) * exp(-t * 7.0) + b.sine(f * 3.93, sr) * 0.35 * exp(-t * 22.0)) * (1.0 - exp(-t * 1500.0)) * 0.6; } }
        1 => { let mut a = Osc::default(); let mut b = Osc::default(); let mut l = Bq::lp(sr, 3000.0, 1.5); for i in 0..n { let t = i as f32 / sr; if i % 64 == 0 { l.coef(Bq::lp(sr, 300.0 + 4000.0 * exp(-t * 9.0), 1.5)); } x[i] = l.run(a.saw(f, sr) + b.saw(f * 1.005, sr) * 0.7) * exp(-t * 5.0) * 0.4; } }
        2 => { let mut c = Osc::default(); let mut m = Osc::default(); for i in 0..n { let t = i as f32 / sr; let mi = 3.0 * exp(-t * 4.0); let mm = m.sine(f * 3.5, sr) * mi; c.ph += mm * 0.0015; x[i] = c.sine(f, sr) * exp(-t * 2.6) * 0.5; } }
        3 => {
            let p = ((sr / f) as usize).max(2);
            let mut buf: Vec<f32> = { let mut nz = Noise::new(77); (0..p).map(|_| nz.white() * 0.6).collect() };
            let mut idx = 0;
            for i in 0..n { let a = buf[idx]; let b = buf[(idx + 1) % p]; let v = 0.5 * (a + b) * 0.997; buf[idx] = v; idx = (idx + 1) % p; x[i] = a; }
            lp(&mut x, sr, 6000.0);
        }
        _ => { let mut a = Osc::default(); let mut b = Osc::default(); let mut c = Osc::default(); for i in 0..n { let t = i as f32 / sr; x[i] = (a.sine(f * 2.0, sr) + b.sine(f * 4.0, sr) * 0.3 * exp(-t * 6.0) + c.sine(f * 6.0, sr) * 0.1 * exp(-t * 12.0)) * exp(-t * 3.2) * (1.0 - exp(-t * 800.0)) * 0.45; } }
    }
    normalize(&mut x, 0.8);
    reverb(&St::from_mono(&x, 0.0), 1.2, 0.9, 0.7, 0.0, 0.22, 1.0, sr)
}

// ───────────────────────── new for the 155-tier ladder (v3)

/// Donkey: "hee-haw" twice.
pub fn bray(sr: f32, seed: u32) -> St {
    let mut s = St::new(n_of(sr, 2.3));
    let mut nz = Noise::new(seed);
    for k in 0..2 {
        for (part, (f0, f1, dur)) in [(820.0f32, 620.0f32, 0.32f32), (310.0, 210.0, 0.42)].iter().enumerate() {
            let n = n_of(sr, *dur);
            let mut o = Osc::default(); let mut o2 = Osc::default();
            let mut fa = Bq::bp(sr, 1100.0, 1.6); let mut fb = Bq::bp(sr, 2600.0, 2.4);
            let x: Vec<f32> = (0..n).map(|i| {
                let t = i as f32 / sr; let q = i as f32 / n as f32;
                let f = (f0 + (f1 - f0) * q) * (1.0 + 0.03 * sin(TAU * 31.0 * t));
                let src = o.saw(f, sr) * 0.7 + o2.square(f * 0.5, sr, 0.3) * 0.25 + nz.white() * if part == 0 { 0.25 } else { 0.08 };
                (fa.run(src) * 1.3 + fb.run(src) * 0.7) * sin(PI * q).sqrt_approx()
            }).collect();
            s.add_mono(&x, n_of(sr, k as f32 * 0.85 + part as f32 * 0.36), 0.9, -0.1 + 0.2 * k as f32);
        }
    }
    let mut s = s; saturate_st(&mut s, 0.3);
    reverb(&s, 1.0, 0.9, 0.6, 0.0, 0.18, 1.0, sr)
}

/// Horse whinny: a trilled cry that falls away.
pub fn neigh(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut o = Osc::default(); let mut nz = Noise::new(seed);
    let mut fa = Bq::bp(sr, 1500.0, 1.8); let mut fb = Bq::bp(sr, 3200.0, 3.0);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let f = (1250.0 - 750.0 * k * k) * (1.0 + 0.06 * sin(TAU * 24.0 * t));
        let am = 0.6 + 0.4 * sin(TAU * 24.0 * t);
        let src = o.saw(f, sr) + nz.white() * 0.3;
        (fa.run(src) + fb.run(src) * 0.6) * am * smooth(t / 0.03) * (1.0 - smooth((k - 0.55) / 0.45))
    }).collect();
    let mut x = x; normalize(&mut x, 0.8);
    reverb(&St::from_mono(&x, 0.1), 1.2, 1.0, 0.6, 0.0, 0.2, 1.0, sr)
}

/// Husky howl.
pub fn howl(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 2.0);
    let mut o = Osc::default(); let mut o2 = Osc::default(); let mut nz = Noise::new(seed);
    let mut br = Bq::bp(sr, 900.0, 1.0);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let f = (420.0 + 330.0 * sin(PI * clamp(k * 1.25, 0.0, 1.0)) - 80.0 * k) * (1.0 + 0.012 * sin(TAU * 5.5 * t));
        (o.sine(f, sr) * 0.7 + o2.sine(f * 2.0, sr) * 0.12 + br.run(nz.white()) * 0.12) * smooth(t / 0.15) * (1.0 - smooth((k - 0.7) / 0.3))
    }).collect();
    reverb(&St::from_mono(&x, 0.0), 2.8, 1.6, 0.4, 0.03, 0.45, 1.0, sr)
}

/// Fire-engine wail.
pub fn siren(sr: f32, dur: f32) -> St {
    let n = n_of(sr, dur);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    let mut lpf = Bq::lp(sr, 3500.0, 0.7);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        let f = 700.0 + 650.0 * (0.5 - 0.5 * cos(TAU * t / 1.6));
        lpf.run(o.square(f, sr, 0.5) * 0.35 + o2.sine(f * 2.0, sr) * 0.25) * smooth(k * 10.0) * (1.0 - smooth((k - 0.85) / 0.15))
    }).collect();
    let mut st = St::from_mono(&x, 0.0);
    // a slight doppler-ish stereo drift
    let d = n_of(sr, 0.004); let mut r = vec![0.0f32; n]; for i in d..n { r[i] = st.r[i - d]; } st.r = r;
    reverb(&st, 1.4, 1.4, 0.5, 0.0, 0.25, 1.0, sr)
}

/// Reversing alarm: beep… beep… beep.
pub fn beeper(sr: f32, count: usize) -> St {
    let mut s = St::new(n_of(sr, count as f32 * 0.9 + 0.3));
    for k in 0..count {
        let n = n_of(sr, 0.42);
        let mut o = Osc::default();
        let x: Vec<f32> = (0..n).map(|i| { let t = i as f32 / sr; o.square(1030.0, sr, 0.5) * 0.25 * smooth(t / 0.005) * (1.0 - smooth((t - 0.4) / 0.02)) }).collect();
        s.add_mono(&x, n_of(sr, k as f32 * 0.9), 1.0, 0.25);
    }
    let mut s = s; filt_st(&mut s, Bq::lp(sr, 4000.0, 0.7));
    s
}

/// Creaking wooden hull.
pub fn creak(sr: f32, dur: f32, seed: u32) -> St {
    let n = n_of(sr, dur);
    let mut s = St::new(n);
    let mut rng = Rng::new(seed as u64);
    let mut at = 0.0f32;
    while at < dur - 0.5 {
        let len = rng.range(0.25, 0.6);
        let m = n_of(sr, len);
        let mut bp = Bq::bp(sr, rng.range(500.0, 1100.0), 3.0);
        let mut x = vec![0.0f32; m];
        // stick-slip: a train of clicks whose rate glides
        let (r0, r1) = (rng.range(25.0, 60.0), rng.range(40.0, 110.0));
        let mut ph = 0.0f32;
        for i in 0..m {
            let k = i as f32 / m as f32;
            ph += (r0 + (r1 - r0) * k) / sr;
            let click = if ph >= 1.0 { ph -= 1.0; 1.0 } else { 0.0 };
            x[i] = bp.run(click) * sin(PI * k);
        }
        normalize(&mut x, 0.5);
        s.add_mono(&x, n_of(sr, at), 1.0, rng.range(-0.6, 0.6));
        at += len + rng.range(0.1, 0.5);
    }
    reverb(&s, 1.2, 1.1, 0.5, 0.01, 0.25, 1.0, sr)
}

/// The funnel clumps babies into a ball: a soft rising shimmer.
pub fn funnel(sr: f32) -> St {
    let n = n_of(sr, 0.45);
    let mut s = St::new(n);
    for (j, m) in [84.0f32, 88.0, 91.0, 96.0].iter().enumerate() {
        let f = midi(*m);
        let at = n_of(sr, j as f32 * 0.04);
        let len = n - at;
        let mut o = Osc::default();
        let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; o.sine(f, sr) * exp(-t * 14.0) * (1.0 - exp(-t * 900.0)) * 0.22 }).collect();
        s.add_mono(&x, at, 1.0, -0.3 + 0.2 * j as f32);
    }
    reverb(&s, 0.8, 0.7, 0.9, 0.0, 0.3, 1.0, sr)
}

/// The camera pulls back: a falling whoosh over a soft low swell.
pub fn zoom_out(sr: f32, seed: u32) -> St {
    let n = n_of(sr, 1.3);
    let mut nz = Noise::new(seed); let mut o = Osc::default();
    let mut bp = Bq::bp(sr, 2000.0, 1.2);
    let mut x = vec![0.0f32; n];
    for i in 0..n {
        let t = i as f32 / sr; let k = i as f32 / n as f32;
        if i % 64 == 0 { bp.coef(Bq::bp(sr, 2400.0 * pow(0.12, k) + 160.0, 1.4)); }
        x[i] = bp.run(nz.white()) * sin(PI * k) * 0.8 + o.sine(70.0 - 25.0 * k, sr) * sin(PI * k) * 0.35 * smooth(t / 0.2);
    }
    normalize(&mut x, 0.8);
    reverb(&St::from_mono(&x, 0.0), 1.6, 1.4, 0.4, 0.0, 0.3, 1.0, sr)
}

trait SqrtApprox { fn sqrt_approx(self) -> f32; }
impl SqrtApprox for f32 { #[inline] fn sqrt_approx(self) -> f32 { crate::m::sqrt(self.max(0.0)) } }

// ───────────────────────── the living bubble and the creation (v3)

/// The bubble of life bursts as God is born: a wet pop, a rush of air, a low
/// boom and a spray of shimmering light.
pub fn burst(sr: f32, seed: u32) -> St {
    let mut s = St::new(n_of(sr, 4.2));
    // the pop: a membrane snapping, a fast upward chirp over a noise crack
    let n = n_of(sr, 0.25);
    let mut o = Osc::default(); let mut nz = Noise::new(seed);
    let mut hpf = Bq::hp(sr, 900.0, 0.7);
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr;
        let f = 180.0 + 2400.0 * (1.0 - exp(-t * 28.0));
        (o.sine(f, sr) * 0.7 * exp(-t * 18.0) + hpf.run(nz.white()) * exp(-t * 45.0) * 0.9) * (1.0 - exp(-t * 3000.0))
    }).collect();
    s.add_mono(&x, 0, 1.0, 0.0);
    // the rush of air outward
    let w = whoosh(sr, 1.6, 300.0, 5200.0, seed + 1);
    s.add_mono(&w, n_of(sr, 0.02), 0.55, -0.2);
    let w2 = whoosh(sr, 1.4, 260.0, 4400.0, seed + 2);
    s.add_mono(&w2, n_of(sr, 0.05), 0.5, 0.2);
    // the boom underneath
    let b = boom(sr, false, seed + 3);
    s.add(&b, 0, 0.8);
    // light spraying out
    let sh = bells(sr, &[96.0, 100.0, 103.0, 108.0, 105.0, 101.0], 0.07);
    s.add(&sh, n_of(sr, 0.08), 0.35);
    reverb(&s, 3.2, 1.6, 0.7, 0.01, 0.4, 1.0, sr)
}

/// A finger pokes the bubble's wall: a soft, wobbling "blub".
pub fn poke(sr: f32) -> St {
    let n = n_of(sr, 0.5);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    let x: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr;
        let f = 150.0 * (1.0 + 0.35 * exp(-t * 7.0) * sin(TAU * 11.0 * t)) + 90.0 * exp(-t * 30.0);
        (o.sine(f, sr) * 0.7 + o2.sine(f * 2.03, sr) * 0.18 * exp(-t * 14.0)) * exp(-t * 7.5) * (1.0 - exp(-t * 600.0))
    }).collect();
    reverb(&St::from_mono(&x, 0.0), 0.7, 0.8, 0.6, 0.0, 0.2, 1.0, sr)
}

/// The world holds its breath while it waits for the player to create: a low
/// choir and a soft pulse in D, long enough for any wait.
pub fn drone(sr: f32, seed: u32) -> St {
    let dur = 16.0;
    let n = n_of(sr, dur);
    let mut s = choir(sr, &[38.0, 45.0, 50.0, 57.0], dur, &[2, 4, 2], 2, 1.6, seed);
    s.gain(0.6);
    let mut o = Osc::default(); let mut o2 = Osc::default();
    let low: Vec<f32> = (0..n).map(|i| {
        let t = i as f32 / sr;
        let breath = 0.75 + 0.25 * sin(TAU * 0.42 * t - PI * 0.5);
        (o.sine(midi(26.0), sr) * 0.5 + o2.sine(midi(38.0), sr) * 0.22) * breath * smooth(t / 1.2)
    }).collect();
    s.add_mono(&low, 0, 0.8, 0.0);
    let sh = shimmer(sr, dur, &[81.0, 86.0, 90.0]);
    s.add(&sh, 0, 0.6);
    let mut env = vec![0.0f32; n];
    for i in 0..n { let t = i as f32 / sr; env[i] = smooth(t / 1.0) * (1.0 - smooth((t - (dur - 1.5)) / 1.5)); }
    for i in 0..n { s.l[i] *= env[i]; s.r[i] *= env[i]; }
    reverb(&s, 3.5, 1.6, 0.5, 0.02, 0.35, 1.0, sr)
}

/// The moment of creation answering a touch: a swell of light into a choir chord.
pub fn creation(sr: f32, seed: u32) -> St {
    let mut s = St::new(n_of(sr, 4.0));
    let im = impact(sr, seed);
    s.add(&im, 0, 0.55);
    let ch = choir(sr, &[50.0, 57.0, 62.0, 66.0, 69.0, 74.0], 3.2, &[0, 4], 2, 0.05, seed + 1);
    s.add(&ch, 0, 0.7);
    let b = bells(sr, &[86.0, 90.0, 93.0, 98.0], 0.09);
    s.add(&b, n_of(sr, 0.02), 0.4);
    reverb(&s, 3.0, 1.5, 0.6, 0.01, 0.35, 1.0, sr)
}

/// The bubble strains around the light of God: a rising cluster, a rushing
/// sweep and a quickening tremble, cut off by the burst.
pub fn strain(sr: f32, seed: u32) -> St {
    let dur = 2.6;
    let n = n_of(sr, dur);
    let mut o1 = Osc::default(); let mut o2 = Osc::default(); let mut o3 = Osc::default();
    let mut nz = Noise::new(seed);
    let mut bp = Bq::bp(sr, 300.0, 2.0);
    let mut x = vec![0.0f32; n];
    let mut trem_ph = 0.0f32;
    for i in 0..n {
        let k = i as f32 / n as f32;
        if i % 64 == 0 { bp.coef(Bq::bp(sr, 300.0 + 4200.0 * k * k, 2.2)); }
        let f = 55.0 * pow(5.0, k * k);
        trem_ph += (6.0 + 22.0 * k * k) / sr;
        let trem = 0.65 + 0.35 * sin(TAU * trem_ph);
        let tone = o1.sine(f, sr) + 0.5 * o2.sine(f * 1.498, sr) + 0.3 * o3.sine(f * 2.013, sr);
        x[i] = (tone * 0.45 + bp.run(nz.white()) * 0.8) * pow(k, 1.6) * trem;
    }
    // no tail: the burst cuts it
    fade(&mut x, n_of(sr, 0.05), n_of(sr, 0.02));
    normalize(&mut x, 0.85);
    let mut s = St::from_mono(&x, 0.0);
    let d = n_of(sr, 0.011); let mut r = vec![0.0f32; n]; for i in d..n { r[i] = s.l[i - d]; } s.r = r;
    s
}

/// A heartbeat under the strain: lub-dub, two soft low thumps.
pub fn heart(sr: f32) -> St {
    let n = n_of(sr, 0.62);
    let mut x = vec![0.0f32; n];
    for (at, amp, f0) in [(0.0f32, 1.0f32, 62.0f32), (0.19, 0.7, 54.0)] {
        let a = n_of(sr, at);
        let mut o = Osc::default(); let mut o2 = Osc::default();
        for (i, v) in x.iter_mut().enumerate().skip(a) {
            let t = (i - a) as f32 / sr;
            let f = f0 * (1.0 + 0.6 * exp(-t * 40.0));
            *v += (o.sine(f, sr) + 0.25 * o2.sine(f * 2.0, sr)) * amp * (1.0 - exp(-t * 400.0)) * exp(-t * 18.0);
        }
    }
    fade(&mut x, 0, n_of(sr, 0.05));
    normalize(&mut x, 0.9);
    St::from_mono(&x, 0.0)
}
