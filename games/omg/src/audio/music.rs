//! Background loops, one per era, and the bounce melody that plays in the same key.
//! Simple, consonant, quiet — the OMGs are the show.

use alloc::vec::Vec;

use super::dsp::*;
use crate::m::*;
use crate::tiers::{cat, Cat};
#[cfg(test)]
use crate::tiers::N_CATS;

#[inline] fn midi(m: f32) -> f32 { 440.0 * pow(2.0, (m - 69.0) / 12.0) }

struct Song {
    bpm: f32,
    /// (chord notes, bass root)
    chords: &'static [(&'static [f32], f32)],
    kick: bool, hats: bool, arp: bool, toms: bool, pluck: bool, bells: bool, pad_bright: f32, bass: bool,
    /// steady eighth-note "train" hats
    chug: bool,
    /// key for the bounce melody (MIDI root) and minor pentatonic or major
    key: f32, minor: bool,
}

const C_MAJ: &[(&[f32], f32)] = &[(&[60.0, 64.0, 67.0], 48.0), (&[60.0, 65.0, 69.0], 41.0), (&[59.0, 62.0, 67.0], 43.0), (&[60.0, 64.0, 69.0], 45.0)];
const G_MAJ: &[(&[f32], f32)] = &[(&[59.0, 62.0, 67.0], 43.0), (&[60.0, 64.0, 67.0], 48.0), (&[57.0, 62.0, 66.0], 50.0), (&[59.0, 64.0, 67.0], 40.0)];
const A_MIN: &[(&[f32], f32)] = &[(&[57.0, 60.0, 64.0], 45.0), (&[57.0, 60.0, 65.0], 41.0), (&[55.0, 60.0, 64.0], 48.0), (&[55.0, 59.0, 62.0], 43.0)];
const D_MIN: &[(&[f32], f32)] = &[(&[57.0, 62.0, 65.0], 50.0), (&[58.0, 62.0, 65.0], 46.0), (&[57.0, 60.0, 65.0], 41.0), (&[55.0, 60.0, 64.0], 48.0)];
const E_MIN: &[(&[f32], f32)] = &[(&[55.0, 59.0, 64.0], 40.0), (&[55.0, 60.0, 64.0], 48.0), (&[57.0, 62.0, 66.0], 50.0), (&[54.0, 59.0, 62.0], 47.0)];
const F_MAJ: &[(&[f32], f32)] = &[(&[57.0, 60.0, 65.0], 41.0), (&[58.0, 62.0, 65.0], 46.0), (&[55.0, 60.0, 64.0], 48.0), (&[57.0, 62.0, 65.0], 50.0)];
const D_MAJ: &[(&[f32], f32)] = &[(&[62.0, 66.0, 69.0], 50.0), (&[59.0, 62.0, 66.0], 47.0), (&[59.0, 62.0, 67.0], 43.0), (&[57.0, 61.0, 64.0], 45.0)];
const SPACE: &[(&[f32], f32)] = &[(&[55.0, 59.0, 64.0, 71.0], 48.0), (&[55.0, 60.0, 64.0, 69.0], 45.0), (&[57.0, 60.0, 64.0, 69.0], 41.0), (&[55.0, 59.0, 62.0, 64.0], 43.0)];
const SCIFI: &[(&[f32], f32)] = &[(&[55.0, 59.0, 64.0], 40.0), (&[55.0, 60.0, 64.0], 48.0), (&[57.0, 62.0, 66.0], 50.0), (&[54.0, 59.0, 62.0], 47.0)];
const MYTH: &[(&[f32], f32)] = &[(&[57.0, 62.0, 65.0], 38.0), (&[58.0, 62.0, 65.0], 46.0), (&[55.0, 60.0, 64.0], 48.0), (&[57.0, 62.0, 65.0], 38.0)];
const HOLY: &[(&[f32], f32)] = &[(&[59.0, 62.0, 67.0], 43.0), (&[60.0, 64.0, 67.0], 48.0), (&[59.0, 62.0, 67.0], 43.0), (&[57.0, 62.0, 66.0], 50.0)];
const GOD: &[(&[f32], f32)] = &[(&[60.0, 64.0, 67.0, 72.0], 48.0), (&[60.0, 64.0, 67.0, 72.0], 48.0)];

fn song(era: u8) -> Song {
    let s = |bpm, chords, kick, hats, arp, toms, pluck, bells, pad_bright, bass, chug, key, minor| Song { bpm, chords, kick, hats, arp, toms, pluck, bells, pad_bright, bass, chug, key, minor };
    match cat(era) {
        Cat::Foot => s(112.0, C_MAJ, false, false, false, false, true, true, 0.6, true, false, 72.0, false),
        Cat::Rides => s(96.0, G_MAJ, false, true, false, false, true, false, 0.55, true, false, 67.0, false),
        Cat::Motors => s(100.0, G_MAJ, true, true, false, false, true, false, 0.5, true, false, 67.0, false),
        Cat::Cars => s(104.0, A_MIN, true, true, false, false, false, false, 0.5, true, false, 69.0, true),
        Cat::Premium => s(96.0, A_MIN, true, false, false, false, true, false, 0.45, true, false, 69.0, true),
        Cat::Super => s(118.0, E_MIN, true, true, true, false, false, false, 0.55, true, false, 64.0, true),
        Cat::Hyper => s(124.0, D_MIN, true, true, true, false, false, true, 0.6, true, false, 62.0, true),
        Cat::Workers => s(100.0, E_MIN, true, false, false, true, false, false, 0.4, true, true, 64.0, true),
        Cat::Monsters => s(90.0, E_MIN, true, false, false, true, false, false, 0.4, true, false, 64.0, true),
        Cat::Rails => s(108.0, F_MAJ, false, false, false, false, true, false, 0.5, true, true, 65.0, false),
        Cat::Sails => s(88.0, D_MIN, false, false, false, false, true, true, 0.45, true, false, 62.0, true),
        Cat::Seas => s(84.0, D_MAJ, false, false, false, false, false, true, 0.45, true, false, 62.0, false),
        Cat::Skies => s(92.0, D_MAJ, false, false, false, false, true, false, 0.65, true, false, 62.0, false),
        Cat::Space => s(70.0, SPACE, false, false, false, false, false, true, 0.35, false, false, 67.0, false),
        Cat::SciFi => s(112.0, SCIFI, true, true, true, false, false, false, 0.55, true, false, 64.0, true),
        Cat::Mega => s(60.0, SPACE, false, false, true, false, false, true, 0.3, false, false, 67.0, false),
        Cat::Myth => s(80.0, MYTH, false, false, false, true, false, false, 0.4, true, false, 62.0, true),
        Cat::Wonders => s(64.0, HOLY, false, false, false, false, false, true, 0.45, false, false, 67.0, false),
        Cat::Heavens => s(56.0, C_MAJ, false, false, false, false, false, true, 0.5, false, false, 72.0, false),
        Cat::God => s(50.0, GOD, false, false, false, false, false, false, 0.3, false, false, 72.0, false),
    }
}

/// Bounce-melody timbre for an era (see sfx::mallet).
pub fn note_timbre(era: u8) -> u8 {
    match cat(era) {
        Cat::Foot | Cat::Rides | Cat::Rails => 0,
        Cat::Motors | Cat::Cars | Cat::Premium | Cat::Super | Cat::Monsters | Cat::SciFi | Cat::Workers => 1,
        Cat::Hyper | Cat::Seas | Cat::Skies | Cat::Sails => 2,
        Cat::Myth | Cat::Wonders | Cat::Heavens => 3,
        Cat::Space | Cat::Mega | Cat::God => 4,
    }
}

/// The i-th note of an era's bounce melody (MIDI), in the key of its music.
pub fn melody_note(era: u8, i: u32) -> f32 {
    const MAJ: [f32; 5] = [0.0, 2.0, 4.0, 7.0, 9.0];
    const MIN: [f32; 5] = [0.0, 3.0, 5.0, 7.0, 10.0];
    // four phrases, original, built to sound like a tune when played one note per bounce
    const PH: [[i8; 16]; 4] = [
        [0, 2, 4, 2, 5, 4, 2, 0, 1, 2, 4, 5, 7, 5, 4, 2],
        [4, 4, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 1, 0, 0],
        [0, 1, 2, 4, 2, 1, 0, -1, 0, 2, 4, 7, 5, 4, 2, 4],
        [7, 5, 4, 5, 4, 2, 0, 2, 4, 2, 1, 2, 0, -1, 0, 2],
    ];
    let s = song(era);
    let sc = if s.minor { &MIN } else { &MAJ };
    let phrase = ((i / 16) as usize + era as usize) % 4;
    let d = PH[phrase][(i % 16) as usize] as i32;
    let oct = d.div_euclid(5);
    let deg = d.rem_euclid(5) as usize;
    s.key + 12.0 * oct as f32 + sc[deg]
}

pub fn render(sr: f32, era: u8) -> St {
    let s = song(era);
    let beat = 60.0 / s.bpm;
    let bar = beat * 4.0;
    let total = bar * s.chords.len() as f32;
    let tail = 2.5;
    let n = ((total + tail) * sr) as usize;
    let mut out = St::new(n);
    let mut rng = Rng::new(era as u64 * 7 + 3);
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
            let steps = if s.kick { 8 } else { 2 };
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
        if s.kick && (matches!(cat(era), Cat::Super | Cat::Hyper | Cat::SciFi) || b % 2 == 0) {
            let len = (0.3 * sr) as usize; let mut o = Osc::default();
            let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; o.sine(48.0 + 90.0 * exp(-t * 30.0), sr) * exp(-t * 9.0) * 0.55 }).collect();
            out.add_mono(&x, at, 1.0, 0.0);
        }
        if s.toms && (b % 4 == 0 || b % 4 == 2 || (b % 8 == 7)) {
            let len = (0.6 * sr) as usize; let mut o = Osc::default(); let mut nz = Noise::new(b as u32 + 9);
            let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; o.sine(70.0 + 50.0 * exp(-t * 18.0), sr) * exp(-t * 5.0) * 0.6 + nz.white() * exp(-t * 60.0) * 0.1 }).collect();
            out.add_mono(&x, at, 1.0, if b % 8 == 7 { 0.3 } else { -0.1 });
        }
        if s.hats || s.chug {
            let subs = if s.chug { 4 } else { 2 };
            for h in 0..subs {
                let a2 = at + (h as f32 * beat / subs as f32 * sr) as usize;
                let len = (0.05 * sr) as usize; let mut nz = Noise::new((b * 4 + h) as u32 + 77); let mut f = Bq::hp(sr, if s.chug { 4500.0 } else { 7000.0 }, 0.7);
                let acc = if s.chug { if h == 0 { 0.13 } else if h == 2 { 0.09 } else { 0.05 } } else if h == 1 { 0.12 } else { 0.07 };
                let x: Vec<f32> = (0..len).map(|i| { let t = i as f32 / sr; f.run(nz.white()) * exp(-t * 70.0) * acc }).collect();
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn melodies_stay_in_range() {
        for era in 0..N_CATS as u8 {
            for i in 0..64 { let m = melody_note(era, i); assert!((50.0..=96.0).contains(&m), "era {era} note {m}"); }
        }
    }
}
