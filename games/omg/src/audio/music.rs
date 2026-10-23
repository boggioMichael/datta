//! Background loops, one per stage. Simple, consonant, quiet — the OMGs are the show.

use alloc::vec::Vec;

use super::dsp::*;
use crate::m::*;

#[inline] fn midi(m: f32) -> f32 { 440.0 * pow(2.0, (m - 69.0) / 12.0) }

struct Song { bpm: f32, chords: &'static [(&'static [f32], f32)], kick: bool, hats: bool, arp: bool, toms: bool, pluck: bool, bells: bool, pad_bright: f32, bass: bool }

fn song(cat: u8) -> Song {
    match cat {
        0 => Song { bpm: 104.0, chords: &[(&[57.0, 60.0, 64.0], 45.0), (&[57.0, 60.0, 65.0], 41.0), (&[55.0, 60.0, 64.0], 48.0), (&[55.0, 59.0, 62.0], 43.0)], kick: true, hats: true, arp: false, toms: false, pluck: false, bells: false, pad_bright: 0.5, bass: true },
        1 => Song { bpm: 92.0, chords: &[(&[62.0, 66.0, 69.0], 50.0), (&[59.0, 62.0, 66.0], 47.0), (&[59.0, 62.0, 67.0], 43.0), (&[57.0, 61.0, 64.0], 45.0)], kick: false, hats: false, arp: false, toms: false, pluck: true, bells: false, pad_bright: 0.65, bass: true },
        2 => Song { bpm: 70.0, chords: &[(&[55.0, 59.0, 64.0, 71.0], 48.0), (&[55.0, 60.0, 64.0, 69.0], 45.0), (&[57.0, 60.0, 64.0, 69.0], 41.0), (&[55.0, 59.0, 62.0, 64.0], 43.0)], kick: false, hats: false, arp: false, toms: false, pluck: false, bells: true, pad_bright: 0.35, bass: false },
        3 => Song { bpm: 112.0, chords: &[(&[55.0, 59.0, 64.0], 40.0), (&[55.0, 60.0, 64.0], 48.0), (&[57.0, 62.0, 66.0], 50.0), (&[54.0, 59.0, 62.0], 47.0)], kick: true, hats: true, arp: true, toms: false, pluck: false, bells: false, pad_bright: 0.55, bass: true },
        4 => Song { bpm: 80.0, chords: &[(&[57.0, 62.0, 65.0], 38.0), (&[58.0, 62.0, 65.0], 46.0), (&[55.0, 60.0, 64.0], 48.0), (&[57.0, 62.0, 65.0], 38.0)], kick: false, hats: false, arp: false, toms: true, pluck: false, bells: false, pad_bright: 0.4, bass: true },
        5 => Song { bpm: 64.0, chords: &[(&[59.0, 62.0, 67.0], 43.0), (&[60.0, 64.0, 67.0], 48.0), (&[59.0, 62.0, 67.0], 43.0), (&[57.0, 62.0, 66.0], 50.0)], kick: false, hats: false, arp: false, toms: false, pluck: false, bells: true, pad_bright: 0.45, bass: false },
        _ => Song { bpm: 50.0, chords: &[(&[60.0, 64.0, 67.0, 72.0], 48.0), (&[60.0, 64.0, 67.0, 72.0], 48.0)], kick: false, hats: false, arp: false, toms: false, pluck: false, bells: false, pad_bright: 0.3, bass: false },
    }
}

pub fn render(sr: f32, cat: u8) -> St {
    let s = song(cat);
    let beat = 60.0 / s.bpm;
    let bar = beat * 4.0;
    let total = bar * s.chords.len() as f32;
    let tail = 2.5;
    let n = ((total + tail) * sr) as usize;
    let mut out = St::new(n);
    let mut rng = Rng::new(cat as u64 * 7 + 3);
    // pad
    for (ci, (notes, root)) in s.chords.iter().enumerate() {
        let t0 = ci as f32 * bar;
        let len = ((bar + 1.2) * sr) as usize;
        for (k, m) in notes.iter().enumerate() {
            for d in 0..2 {
                let f = midi(*m) * pow(2.0, (if d == 0 { -6.0 } else { 6.0 }) / 1200.0);
                let mut o = Osc::default(); o.ph = rng.f();
                let mut lpf = Bq::lp(sr, 700.0 + 1600.0 * s.pad_bright, 0.8);
                let env = env_adsr(len, sr, 0.6, 0.4, 0.75, 1.1);
                let x: Vec<f32> = (0..len).map(|i| lpf.run(o.saw(f, sr)) * env[i] * 0.09).collect();
                out.add_mono(&x, (t0 * sr) as usize, 1.0, if (k + d) % 2 == 0 { -0.5 } else { 0.5 });
            }
        }
        if s.bass {
            let f = midi(*root);
            let steps = if cat == 0 || cat == 3 { 8 } else { 2 };
            for st in 0..steps {
                let at = t0 + st as f32 * bar / steps as f32;
                let len = ((bar / steps as f32) * 0.9 * sr) as usize;
                let mut o = Osc::default(); let mut o2 = Osc::default();
                let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; (o.sine(f, sr) * 0.6 + o2.saw(f, sr) * 0.08) * (1.0 - exp(-t * 200.0)) * exp(-t * 2.5) * 0.5 }).collect();
                out.add_mono(&x, (at * sr) as usize, 1.0, 0.0);
            }
        }
        if s.arp {
            let pat = [0usize, 1, 2, 1, 2, 0, 1, 2];
            for st in 0..16 {
                let m = notes[pat[st % 8] % notes.len()] + if st >= 8 { 12.0 } else { 0.0 };
                let at = t0 + st as f32 * bar / 16.0;
                let len = (0.16 * sr) as usize;
                let mut o = Osc::default(); let mut lpf = Bq::lp(sr, 2400.0, 1.4);
                let f = midi(m);
                let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; lpf.run(o.saw(f, sr)) * exp(-t * 18.0) * 0.12 }).collect();
                out.add_mono(&x, (at * sr) as usize, 1.0, if st % 2 == 0 { -0.35 } else { 0.35 });
            }
        }
        if s.pluck {
            for st in 0..4 {
                let m = notes[(st + ci) % notes.len()] + 12.0;
                let at = t0 + st as f32 * beat;
                let len = (0.9 * sr) as usize;
                let mut o = Osc::default(); let mut o2 = Osc::default();
                let f = midi(m);
                let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; (o.sine(f, sr) + 0.3 * o2.sine(f * 2.0, sr)) * exp(-t * 5.0) * 0.1 }).collect();
                out.add_mono(&x, (at * sr) as usize, 1.0, if st % 2 == 0 { -0.4 } else { 0.4 });
            }
        }
        if s.bells && ci % 2 == 0 {
            let m = notes[notes.len() - 1] + 12.0;
            let len = (2.5 * sr) as usize;
            let mut o = Osc::default(); let mut o2 = Osc::default();
            let f = midi(m);
            let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; (o.sine(f, sr) + 0.4 * o2.sine(f * 2.76, sr)) * exp(-t * 1.8) * 0.07 }).collect();
            out.add_mono(&x, ((t0 + beat * 0.5) * sr) as usize, 1.0, 0.3);
        }
    }
    // drums
    let beats = (total / beat) as usize;
    for b in 0..beats {
        let at = (b as f32 * beat * sr) as usize;
        if s.kick && (cat == 3 || b % 2 == 0) {
            let len = (0.3 * sr) as usize; let mut o = Osc::default();
            let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; o.sine(48.0 + 90.0 * exp(-t * 30.0), sr) * exp(-t * 9.0) * 0.55 }).collect();
            out.add_mono(&x, at, 1.0, 0.0);
        }
        if s.toms && (b % 4 == 0 || b % 4 == 2 || (b % 8 == 7)) {
            let len = (0.6 * sr) as usize; let mut o = Osc::default(); let mut nz = Noise::new(b as u32 + 9);
            let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; o.sine(70.0 + 50.0 * exp(-t * 18.0), sr) * exp(-t * 5.0) * 0.6 + nz.white() * exp(-t * 60.0) * 0.1 }).collect();
            out.add_mono(&x, at, 1.0, if b % 8 == 7 { 0.3 } else { -0.1 });
        }
        if s.hats {
            for h in 0..2 {
                let a2 = at + (h as f32 * beat * 0.5 * sr) as usize;
                let len = (0.05 * sr) as usize; let mut nz = Noise::new((b * 2 + h) as u32 + 77); let mut f = Bq::hp(sr, 7000.0, 0.7);
                let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; f.run(nz.white()) * exp(-t * 70.0) * if h == 1 { 0.12 } else { 0.07 } }).collect();
                out.add_mono(&x, a2, 1.0, 0.25);
            }
        }
    }
    let out = reverb(&out, 1.8, 1.0, 0.5, 0.01, 0.25, 1.0, sr);
    // fold the tail back onto the head so the loop is seamless
    let ln = (total * sr) as usize;
    let mut lp_ = St::new(ln);
    for i in 0..out.len() { let j = i % ln; lp_.l[j] += out.l[i]; lp_.r[j] += out.r[i]; }
    let l = loudness(&lp_, sr);
    if l > -69.0 { lp_.gain(db(-24.0 - l)); }
    limiter(&mut lp_, db(-3.0), sr);
    lp_
}
