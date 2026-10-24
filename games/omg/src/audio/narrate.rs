//! Offline: mixes the Genesis narration's soundtrack. Each recorded phrase gets
//! the God voice (deeper, an octave underneath, a large hall), placed where the
//! timeline (tools/story/plan.py) says; under it runs a bed of music and sound
//! for each day of creation. Run with
//! `OMG_PLAN=plan_en.txt OMG_OUT=genesis_en.wav cargo test --release narrate -- --ignored`.

use alloc::vec::Vec;
use std::io::{Read, Write};

use super::dsp::*;
use super::sfx;
use crate::m::*;

const SR: f32 = 48000.0;

#[inline] fn n_of(d: f32) -> usize { (d.max(0.0) * SR) as usize }
#[inline] fn midi(m: f32) -> f32 { 440.0 * pow(2.0, (m - 69.0) / 12.0) }

fn read_wav(path: &str) -> (Vec<f32>, f32) {
    let mut b = Vec::new();
    std::fs::File::open(path).unwrap_or_else(|e| panic!("{path}: {e}")).read_to_end(&mut b).unwrap();
    let sr = u32::from_le_bytes([b[24], b[25], b[26], b[27]]) as f32;
    let ch = u16::from_le_bytes([b[22], b[23]]) as usize;
    let mut i = 12;
    while i + 8 < b.len() {
        let id = &b[i..i + 4]; let sz = u32::from_le_bytes([b[i + 4], b[i + 5], b[i + 6], b[i + 7]]) as usize;
        if id == b"data" {
            let d = &b[i + 8..(i + 8 + sz).min(b.len())];
            return (d.chunks_exact(2 * ch).map(|f| i16::from_le_bytes([f[0], f[1]]) as f32 / 32768.0).collect(), sr);
        }
        i += 8 + sz;
    }
    panic!("no data in {path}");
}
fn write_wav(path: &str, s: &St, sr: u32) {
    let n = s.len();
    let mut f = std::fs::File::create(path).unwrap();
    let data_len = (n * 4) as u32;
    let mut h = Vec::new();
    h.extend_from_slice(b"RIFF"); h.extend_from_slice(&(36 + data_len).to_le_bytes()); h.extend_from_slice(b"WAVEfmt ");
    h.extend_from_slice(&16u32.to_le_bytes()); h.extend_from_slice(&1u16.to_le_bytes()); h.extend_from_slice(&2u16.to_le_bytes());
    h.extend_from_slice(&sr.to_le_bytes()); h.extend_from_slice(&(sr * 4).to_le_bytes()); h.extend_from_slice(&4u16.to_le_bytes()); h.extend_from_slice(&16u16.to_le_bytes());
    h.extend_from_slice(b"data"); h.extend_from_slice(&data_len.to_le_bytes());
    f.write_all(&h).unwrap();
    let mut d = Vec::with_capacity(n * 4);
    for i in 0..n { for v in [s.l[i], s.r[i]] { d.extend_from_slice(&((v.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes()); } }
    f.write_all(&d).unwrap();
}

/// The God voice: a little deeper, an octave underneath, gently compressed.
fn god_voice(x: &[f32], semis: f32) -> Vec<f32> {
    let mut v = pitch_shift(x, semis, 1.0, SR);
    hp(&mut v, SR, 55.0);
    let mut oct = pitch_shift(x, semis - 12.0, 1.0, SR);
    lp(&mut oct, SR, 1400.0);
    normalize(&mut oct, 0.9);
    normalize(&mut v, 0.9);
    let n = v.len().min(oct.len());
    let mut out: Vec<f32> = (0..n).map(|i| v[i] + oct[i] * 0.2).collect();
    // warmth: a soft low-mid lift and a little air off the top
    filt(&mut out, Bq::peak(SR, 180.0, 0.8, 2.5));
    filt(&mut out, Bq::shelf(SR, 7000.0, -3.0, true));
    saturate(&mut out, 0.15);
    normalize(&mut out, 0.9);
    out
}

/// A soft sustained chord: detuned saws through a slow low-pass.
fn pad(notes: &[f32], dur: f32, bright: f32, seed: u32) -> St {
    let n = n_of(dur);
    let mut s = St::new(n);
    let mut rng = Rng::new(seed as u64 + 3);
    for (k, m) in notes.iter().enumerate() {
        for d in 0..3 {
            let f = midi(*m) * pow(2.0, (d as f32 - 1.0) * 7.0 / 1200.0);
            let mut o = Osc::default(); o.ph = rng.f();
            let mut l = Bq::lp(SR, 500.0 + 1500.0 * bright, 0.7);
            let fade = n_of(2.5).min(n / 3);
            let x: Vec<f32> = (0..n).map(|i| {
                let e = smooth(i as f32 / fade as f32) * smooth((n - i) as f32 / fade as f32);
                l.run(o.saw(f, SR)) * e * 0.06
            }).collect();
            s.add_mono(&x, 0, 1.0, if (k + d) % 2 == 0 { -0.55 } else { 0.55 });
        }
    }
    s
}

/// Birdsong: little chirps and trills scattered over `dur` seconds.
fn birds(dur: f32, seed: u32) -> St {
    let n = n_of(dur);
    let mut s = St::new(n + n_of(1.0));
    let mut rng = Rng::new(seed as u64);
    let mut t = 0.2f32;
    while t < dur {
        let calls = 2 + rng.below(4) as usize;
        let f0 = rng.range(2600.0, 4800.0);
        let pan = rng.range(-0.8, 0.8);
        for c in 0..calls {
            let len = rng.range(0.05, 0.13);
            let m = n_of(len);
            let (a, b) = (f0 * rng.range(0.85, 1.1), f0 * rng.range(1.05, 1.4));
            let mut o = Osc::default();
            let x: Vec<f32> = (0..m).map(|i| { let k = i as f32 / m as f32; let f = a + (b - a) * (1.0 - (1.0 - k) * (1.0 - k)); o.sine(f * (1.0 + 0.02 * sin(TAU * 60.0 * k)), SR) * sin(PI * k) * 0.25 }).collect();
            s.add_mono(&x, n_of(t + c as f32 * (len + 0.04)), 1.0, pan);
        }
        t += rng.range(0.35, 1.3);
    }
    reverb(&s, 1.2, 1.1, 0.7, 0.01, 0.3, 1.0, SR)
}

/// A rising hush into a moment (the light, "very good").
fn swell(rise: f32) -> St {
    let n = n_of(rise);
    let mut nz = Noise::new(77); let mut f = Bq::bp(SR, 2000.0, 0.8);
    let x: Vec<f32> = (0..n).map(|i| { let k = i as f32 / n as f32; if i % 64 == 0 { f.coef(Bq::bp(SR, 600.0 + 5000.0 * k * k, 0.8)); } f.run(nz.white()) * pow(k, 2.5) * 0.9 }).collect();
    St::from_mono(&x, 0.0)
}

fn level(s: &mut St, lufs: f32) { let l = loudness(s, SR); if l > -69.0 { s.gain(db(lufs - l)); } }

/// A phrase: where it starts, its recording, and an extra pitch shift (semitones) for a phrase read by another voice.
struct Plan { len: f32, cues: Vec<(String, f32)>, phrases: Vec<(f32, String, f32)> }
fn parse(path: &str) -> Plan {
    let txt = std::fs::read_to_string(path).unwrap();
    let mut p = Plan { len: 0.0, cues: Vec::new(), phrases: Vec::new() };
    for line in txt.lines() {
        let mut it = line.splitn(3, ' ');
        match (it.next(), it.next(), it.next()) {
            (Some("cue"), Some(k), Some(v)) => { let v: f32 = v.trim().parse().unwrap(); if k == "len" { p.len = v; } p.cues.push((k.into(), v)); }
            (Some("phrase"), Some(t), Some(rest)) => {
                let mut r = rest.split_whitespace();
                let f = r.next().unwrap_or("");
                let ds: f32 = r.next().and_then(|v| v.parse().ok()).unwrap_or(0.0);
                p.phrases.push((t.parse().unwrap(), f.into(), ds));
            }
            _ => {}
        }
    }
    p
}
use alloc::string::String;

pub fn render(plan_path: &str, out_path: &str, semis: f32) {
    let p = parse(plan_path);
    let cue = |k: &str| p.cues.iter().find(|c| c.0 == k).map(|c| c.1).unwrap_or_else(|| panic!("no cue {k}"));
    let total = n_of(p.len + 1.0);
    // ── the voice
    let mut voice = St::new(total);
    for (t0, file, ds) in &p.phrases {
        let (x, sr) = read_wav(file);
        let x = resample(&x, sr, SR);
        let v = god_voice(&x, semis + ds);
        let mut st = St::from_mono(&v, 0.0);
        level(&mut st, -19.0);
        voice.add(&st, n_of(*t0), 1.0);
    }
    let mut voice = reverb(&voice, 3.0, 1.5, 0.45, 0.035, 0.24, 1.0, SR);
    voice.ensure(total);
    // ── the bed: one chord per day, crossfading
    let mut bed = St::new(total);
    let days: Vec<f32> = (0..8).map(|d| cue(&format!("day{d}"))).collect();
    let chords: [&[f32]; 8] = [
        &[38.0, 45.0, 50.0],               // darkness: a low open fifth
        &[50.0, 57.0, 62.0, 66.0, 69.0],   // light: D major
        &[43.0, 55.0, 59.0, 62.0, 67.0],   // firmament: G
        &[40.0, 52.0, 55.0, 59.0, 64.0],   // land and plants: E minor
        &[45.0, 57.0, 61.0, 64.0, 69.0],   // sun, moon, stars: A
        &[47.0, 54.0, 59.0, 62.0, 66.0],   // fish and birds: B minor
        &[43.0, 50.0, 55.0, 59.0, 62.0],   // animals and people: G
        &[38.0, 50.0, 54.0, 57.0, 62.0],   // rest: D
    ];
    for d in 0..8 {
        let start = if d == 0 { 0.0 } else if d == 1 { cue("light") - 0.3 } else { days[d] - 2.0 };
        let end = if d == 0 { cue("light") + 1.0 } else if d < 7 { days[d + 1] + 1.0 } else { p.len + 0.5 };
        let mut s = pad(chords[d], end - start, if d == 0 { 0.15 } else { 0.35 + 0.05 * d as f32 }, d as u32);
        level(&mut s, if d == 0 { -31.0 } else { -30.0 });
        bed.add(&s, n_of(start), 1.0);
    }
    // darkness over the deep, and the wind of God over the waters
    let mut w = sfx::wind(SR, cue("light") - 1.0, 5); level(&mut w, -33.0); bed.add(&w, n_of(0.8), 1.0);
    let mut w2 = sfx::wind(SR, 7.0, 9); level(&mut w2, -27.0); bed.add(&w2, n_of(cue("spirit") - 1.0), 1.0);
    let mut deep = St::from_mono(&sfx::subdrop(SR, 4.0), 0.0); level(&mut deep, -30.0); bed.add(&deep, n_of(0.5), 1.0);
    // "and there was light"
    let lt = cue("light");
    let mut sw = swell(2.2); level(&mut sw, -25.0); bed.add(&sw, n_of(lt - 2.2), 1.0);
    // (the impact itself is the game's: it plays when the player touches the darkness)
    let mut ch = sfx::choir(SR, &[62.0, 66.0, 69.0, 74.0, 78.0], 6.0, &[1, 0, 4], 2, 0.4, 11); level(&mut ch, -24.0); bed.add(&ch, n_of(lt - 0.1), 1.0);
    let mut sh = sfx::shimmer(SR, 5.0, &[86.0, 90.0, 93.0, 98.0]); level(&mut sh, -27.0); bed.add(&sh, n_of(lt), 1.0);
    // each evening and morning: a soft bell
    for k in 1..=6 {
        let t = cue(&format!("day_end{k}"));
        let mut b = sfx::gong(SR, 5.0, 98.0); level(&mut b, -28.0); bed.add(&b, n_of(t - 0.2), 1.0);
    }
    // the waters (days two to five)
    let wv0 = cue("firmament"); let wv1 = cue("beasts");
    let mut wv = sfx::waves(SR, wv1 - wv0, 21); level(&mut wv, -33.0); bed.add(&wv, n_of(wv0), 1.0);
    // dry land rising, plants growing
    let mut r = sfx::rumble(SR, 3.0, 4); level(&mut r, -27.0); bed.add(&r, n_of(cue("land")), 1.0);
    for k in 0..5 {
        let mut h = sfx::harp(SR, 52.0 + 2.0 * k as f32, 8, 0.7); level(&mut h, -29.0);
        bed.add(&h, n_of(cue("plants") + k as f32 * 2.6), 1.0);
    }
    // the sun, the moon, the stars
    let mut sun = sfx::choir(SR, &[57.0, 61.0, 64.0, 69.0], 5.0, &[0, 1], 2, 0.8, 13); level(&mut sun, -27.0); bed.add(&sun, n_of(cue("sun")), 1.0);
    let mut st = sfx::bells(SR, &[93.0, 97.0, 100.0, 105.0, 100.0, 97.0, 105.0], 0.42); level(&mut st, -29.0); bed.add(&st, n_of(cue("stars")), 1.0);
    let mut sh2 = sfx::shimmer(SR, 4.0, &[93.0, 97.0, 100.0]); level(&mut sh2, -31.0); bed.add(&sh2, n_of(cue("moon")), 1.0);
    // fish, the great sea creatures, birds
    let mut wh = sfx::whale(SR, 8); level(&mut wh, -28.0); bed.add(&wh, n_of(cue("whale") + 0.5), 1.0);
    let mut bd = birds(cue("beasts") - cue("birds") + 4.0, 31); level(&mut bd, -31.0); bed.add(&bd, n_of(cue("birds")), 1.0);
    // the animals walk in; then people
    let mut hv = sfx::hooves(SR, 10, 0.22); level(&mut hv, -32.0); bed.add(&hv, n_of(cue("beasts") + 1.0), 1.0);
    let mut pp = sfx::choir(SR, &[55.0, 59.0, 62.0, 67.0, 71.0], 6.0, &[1, 4], 2, 1.0, 17); level(&mut pp, -27.0); bed.add(&pp, n_of(cue("people")), 1.0);
    // "and, behold, it was very good"
    let gt = cue("good");
    let mut sw2 = swell(1.6); level(&mut sw2, -28.0); bed.add(&sw2, n_of(gt - 1.6), 1.0);
    let mut gc = sfx::choir(SR, &[50.0, 57.0, 62.0, 66.0, 69.0, 74.0, 78.0], 7.0, &[1, 0, 4], 2, 0.5, 19); level(&mut gc, -23.0); bed.add(&gc, n_of(gt), 1.0);
    let mut gs = sfx::shimmer(SR, 6.0, &[86.0, 90.0, 93.0, 98.0, 102.0]); level(&mut gs, -27.0); bed.add(&gs, n_of(gt + 0.3), 1.0);
    // the seventh day: rest and blessing
    let mut b7 = sfx::bells(SR, &[74.0, 78.0, 81.0, 86.0], 0.7); level(&mut b7, -29.0); bed.add(&b7, n_of(cue("candles")), 1.0);
    let mut fin = sfx::choir(SR, &[50.0, 57.0, 62.0, 66.0, 69.0, 74.0], 9.0, &[1, 4], 2, 1.5, 23); level(&mut fin, -25.0); bed.add(&fin, n_of(cue("blessed") + 1.0), 1.0);
    // ── mix
    bed.ensure(total);
    let mut out = St::new(total);
    out.add(&voice, 0, 1.0);
    out.add(&bed, 0, 1.0);
    out.l.truncate(total); out.r.truncate(total);
    // fade the very end
    let fade = n_of(3.0);
    for i in 0..fade { let k = 1.0 - i as f32 / fade as f32; let j = total - fade + i; out.l[j] *= k; out.r[j] *= k; }
    master(&mut out, -16.0, db(-1.0), 0.2, SR);
    println!("{out_path}: {:.1}s loudness {:.1} LUFS peak {:.2}", out.len() as f32 / SR, loudness(&out, SR), out.peak());
    write_wav(out_path, &out, SR as u32);
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore]
    fn narrate() {
        let plan = std::env::var("OMG_PLAN").expect("OMG_PLAN");
        let out = std::env::var("OMG_OUT").expect("OMG_OUT");
        let semis: f32 = std::env::var("OMG_SEMIS").ok().and_then(|v| v.parse().ok()).unwrap_or(-2.0);
        super::render(&plan, &out, semis);
    }
}
