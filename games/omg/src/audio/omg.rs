//! The 37 OMGs. Each tier takes one of the base voice clips and pushes it
//! further: deeper, slower, bigger rooms, choirs that sing the words, and a bed
//! of effects that matches the vehicle. Loudness climbs with luxury.

use alloc::vec;
use alloc::vec::Vec;

use super::dsp::*;
use super::sfx::*;
use super::Snd;
use crate::m::*;

pub static CLIPS: [&str; 33] = [
    "calm_am_puck", "calm_af_bella", "q_af_jessica", "excl_am_adam", "long_am_liam", "double_am_echo", "excl_am_fenrir", "sep_am_onyx",
    "excl_bm_lewis", "excl_bm_daniel", "sep_bm_george", "long_am_michael", "triple_am_liam", "excl_am_echo", "slow_bm_george",
    "houston_am_michael", "houston_am_adam", "houston_am_onyx", "triple_af_jessica", "slow_af_nicole",
    "excl_am_eric", "whoa_am_adam", "excl_am_michael", "long_af_jessica", "holy_am_eric",
    "gods_am_liam", "gods_af_jessica", "gods_am_fenrir", "gods_am_echo", "gods_bm_george", "gods_am_onyx",
    "slow_am_onyx", "iam_am_onyx",
];
fn clip_id(name: &str) -> usize { CLIPS.iter().position(|c| *c == name).unwrap_or(0) }

#[derive(Clone, Copy)]
pub enum Fx {
    Engine(u8), Prop, Jet(f32), Chime, Boom(bool), Rocket(f32), Quindar(f32), Hover, Theremin, Laser, Warp(f32), Teleport,
    Swirl(f32), Clock, Gong(f32), Harp(f32), Wings, Horn(f32), Hooves, Thunder(f32), Bells(u8), Sistrum, Shimmer(u8),
    Fire(f32), Shofar(f32, f32), SubDrop(f32), Heartbeat, Choir(u8, f32), Whoosh(f32),
}

#[derive(Clone, Copy)]
pub struct Layer { pub fx: Fx, pub at: f32, pub gain: f32 }
const fn ly(fx: Fx, at: f32, gain: f32) -> Layer { Layer { fx, at, gain } }

#[derive(Clone)]
pub struct Recipe {
    pub clip: &'static str,
    pub semis: f32,
    pub tempo: f32,
    pub at: f32,
    pub radio: f32,
    pub robot: f32,
    pub ring: f32,
    pub stutter: bool,
    pub reverse_in: bool,
    pub doppler: f32,
    pub vchoir: u8,
    pub vchoir_mix: f32,
    pub octave: f32,
    pub stack: u8,
    pub dist: f32,
    pub hp: f32,
    pub lp: f32,
    pub echo: f32,
    pub echo_fb: f32,
    pub rev: f32,
    pub rev_wet: f32,
    pub voice_gain: f32,
    pub layers: Vec<Layer>,
    pub lufs: f32,
    pub glue: f32,
}
impl Recipe {
    fn new(clip: &'static str, lufs: f32) -> Recipe {
        Recipe { clip, semis: 0.0, tempo: 1.0, at: 0.0, radio: 0.0, robot: 0.0, ring: 0.0, stutter: false, reverse_in: false, doppler: 0.0,
            vchoir: 0, vchoir_mix: 0.0, octave: 0.0, stack: 0, dist: 0.0, hp: 60.0, lp: 0.0, echo: 0.0, echo_fb: 0.0, rev: 0.0, rev_wet: 0.0,
            voice_gain: 1.0, layers: Vec::new(), lufs, glue: 0.0 }
    }
    fn p(mut self, semis: f32, tempo: f32) -> Self { self.semis = semis; self.tempo = tempo; self }
    fn rv(mut self, rt: f32, wet: f32) -> Self { self.rev = rt; self.rev_wet = wet; self }
    fn ec(mut self, d: f32, fb: f32) -> Self { self.echo = d; self.echo_fb = fb; self }
    fn l(mut self, fx: Fx, at: f32, gain: f32) -> Self { self.layers.push(ly(fx, at, gain)); self }
    fn at(mut self, t: f32) -> Self { self.at = t; self }
    fn ch(mut self, chord: u8, mix: f32) -> Self { self.vchoir = chord; self.vchoir_mix = mix; self }
}

/// MIDI chords for the vocoder choirs and pads.
pub fn chord(id: u8) -> &'static [f32] {
    match id {
        1 => &[38.0, 45.0, 50.0, 54.0, 57.0, 62.0],            // D major
        2 => &[38.0, 45.0, 50.0, 53.0, 57.0, 62.0],            // D minor
        3 => &[36.0, 43.0, 48.0, 50.0, 55.0, 60.0, 62.0],      // C open fifths + 9 (Wukong)
        4 => &[40.0, 47.0, 52.0, 53.0, 56.0, 59.0],            // E with flat 2 (Ra)
        5 => &[43.0, 50.0, 55.0, 59.0, 62.0, 67.0],            // G major (Helios)
        6 => &[45.0, 52.0, 57.0, 60.0, 64.0, 69.0],            // A minor (Norse)
        7 => &[38.0, 45.0, 50.0, 54.0, 57.0, 62.0, 66.0, 69.0, 74.0], // D major, wide (God)
        8 => &[45.0, 57.0],                                     // robot A
        9 => &[41.0, 48.0, 53.0, 57.0, 60.0, 65.0],            // F major (Pegasus)
        10 => &[43.0, 50.0, 55.0, 58.0, 62.0, 67.0],           // G minor (Garuda)
        11 => &[36.0, 43.0, 48.0, 52.0, 55.0, 60.0, 64.0, 67.0], // C major wide (Elijah)
        _ => &[38.0, 45.0, 50.0, 54.0, 57.0, 62.0],
    }
}

pub fn recipe(t: u8) -> Recipe {
    use Fx::*;
    match t {
        // ── cars: from a shrug to a scream
        0 => Recipe::new("calm_am_puck", -26.0).p(2.0, 1.08).l(Engine(0), 0.0, 0.55).at(0.15),
        1 => Recipe::new("calm_af_bella", -25.0).p(0.0, 1.0).l(Engine(1), 0.0, 0.7).at(0.25),
        2 => Recipe::new("q_af_jessica", -24.0).l(Engine(2), 0.0, 0.6).at(0.35).rv(0.6, 0.12),
        3 => Recipe::new("excl_am_adam", -23.0).p(-1.0, 1.0).l(Engine(3), 0.0, 0.75).at(0.45).rv(0.7, 0.14),
        4 => { let mut r = Recipe::new("long_am_liam", -22.0).p(-1.0, 0.98).l(Engine(4), 0.0, 0.8).at(0.6).rv(0.9, 0.16); r.dist = 0.05; r }
        5 => { let mut r = Recipe::new("double_am_echo", -21.0).p(-2.0, 1.0).l(Engine(5), 0.0, 0.85).at(0.55).rv(1.0, 0.18); r.stack = 2; r }
        6 => { let mut r = Recipe::new("excl_am_fenrir", -20.0).p(-3.0, 0.95).l(Engine(6), 0.0, 0.9).at(0.7).rv(1.2, 0.2); r.dist = 0.18; r.octave = 0.25; r }
        7 => { let mut r = Recipe::new("sep_am_onyx", -19.0).p(-3.0, 0.95).l(Engine(7), 0.0, 0.9).at(0.75).rv(1.5, 0.24).ec(0.24, 0.3); r.stack = 2; r.octave = 0.3; r }
        // ── planes
        8 => { let mut r = Recipe::new("excl_bm_lewis", -18.5).at(0.5).l(Prop, 0.0, 0.7).rv(0.8, 0.12); r.radio = 0.65; r }
        9 => Recipe::new("excl_bm_daniel", -18.0).p(-1.0, 0.97).at(0.95).l(Chime, 0.0, 0.7).l(Jet(0.4), 0.3, 0.45).rv(1.4, 0.22),
        10 => { let mut r = Recipe::new("sep_bm_george", -17.5).p(-1.0, 0.95).at(1.0).l(Chime, 0.0, 0.7).l(Jet(0.7), 0.2, 0.6).rv(1.2, 0.2); r.radio = 0.35; r }
        11 => { let mut r = Recipe::new("long_am_michael", -17.0).p(-2.0, 0.95).at(0.4).l(Jet(1.0), 0.0, 0.75).rv(2.0, 0.26); r.stack = 2; r.octave = 0.3; r }
        12 => { let mut r = Recipe::new("triple_am_liam", -16.5).p(-1.0, 1.05).at(0.2).l(Jet(0.8), 0.0, 0.5).l(Boom(false), 2.2, 0.95).rv(1.6, 0.22); r.dist = 0.08; r }
        13 => { let mut r = Recipe::new("excl_am_fenrir", -16.0).p(-2.0, 1.0).at(0.35).l(Jet(1.3), 0.0, 0.8).rv(1.2, 0.2); r.radio = 0.75; r.dist = 0.2; r }
        14 => { let mut r = Recipe::new("excl_am_echo", -15.5).p(-4.0, 0.92).at(0.3).l(Jet(1.5), 0.0, 0.75).l(Boom(true), 1.9, 1.0).rv(1.8, 0.24); r.doppler = 0.35; r.octave = 0.35; r }
        15 => { let mut r = Recipe::new("slow_bm_george", -15.0).p(-5.0, 0.95).at(0.3).l(SubDrop(2.6), 0.0, 0.7).l(Jet(0.6), 0.1, 0.35).rv(2.4, 0.3); r.octave = 0.4; r.stack = 2; r.lp = 6000.0; r }
        // ── real spacecraft ("Houston…")
        16 => { let mut r = Recipe::new("houston_am_michael", -14.5).at(0.35).l(Quindar(2525.0), 0.0, 0.8).l(Rocket(0.7), 0.0, 0.55).rv(1.0, 0.15); r.radio = 0.55; r }
        17 => { let mut r = Recipe::new("houston_am_adam", -14.2).p(-1.0, 0.98).at(0.35).l(Quindar(2525.0), 0.0, 0.8).l(Rocket(1.0), 0.0, 0.7).rv(1.4, 0.2); r.radio = 0.45; r.octave = 0.2; r }
        18 => { let mut r = Recipe::new("houston_am_onyx", -13.9).p(-2.0, 0.96).at(0.4).l(Quindar(2525.0), 0.0, 0.8).l(Rocket(1.5), 0.0, 0.85).rv(1.8, 0.24); r.radio = 0.3; r.octave = 0.3; r.stack = 2; r }
        19 => { let mut r = Recipe::new("triple_af_jessica", -13.6).p(-1.0, 1.0).at(0.5).l(Rocket(2.2), 0.0, 1.0).l(Boom(false), 2.6, 0.8).rv(1.8, 0.24); r.stack = 2; r.octave = 0.25; r.dist = 0.12; r }
        20 => { let mut r = Recipe::new("slow_af_nicole", -13.3).p(-1.0, 0.92).at(0.3).l(Shimmer(1), 0.0, 0.7).rv(4.2, 0.5).ec(0.38, 0.35); r.stack = 3; r.octave = 0.2; r }
        // ── science fiction
        21 => { let mut r = Recipe::new("excl_am_eric", -13.0).p(-1.0, 1.0).at(0.4).l(Hover, 0.0, 0.7).l(Whoosh(0.8), 0.9, 0.6).rv(1.4, 0.24); r.robot = 0.6; r.stack = 2; r }
        22 => { let mut r = Recipe::new("whoa_am_adam", -12.8).p(4.0, 1.1).at(0.3).l(Theremin, 0.0, 0.7).l(Laser, 1.4, 0.5).rv(1.6, 0.28); r.ring = 33.0; r.stack = 2; r }
        23 => { let mut r = Recipe::new("excl_am_michael", -12.6).p(-1.0, 1.0).at(0.5).l(Teleport, 0.0, 0.75).rv(1.8, 0.3).ec(0.15, 0.35); r.stutter = true; r.stack = 2; r }
        24 => { let mut r = Recipe::new("long_af_jessica", -12.4).p(-2.0, 0.9).at(0.2).l(Warp(2.4), 0.0, 0.85).rv(2.2, 0.3); r.doppler = 0.6; r.stack = 2; r.octave = 0.25; r }
        25 => { let mut r = Recipe::new("excl_am_echo", -12.2).p(-4.0, 0.9).at(0.2).l(Swirl(3.2), 0.0, 0.7).l(SubDrop(2.5), 1.2, 0.6).rv(2.8, 0.36); r.reverse_in = true; r.octave = 0.4; r.stack = 2; r }
        26 => { let mut r = Recipe::new("holy_am_eric", -12.0).p(-3.0, 0.92).at(1.0).l(Clock, 0.0, 0.8).rv(2.6, 0.32).ec(0.3, 0.5); r.octave = 0.35; r.stack = 2; r }
        // ── mythology ("Oh my GODS!")
        27 => { let mut r = Recipe::new("gods_am_liam", -11.8).p(-2.0, 0.95).at(0.4).l(Gong(110.0), 0.0, 0.8).l(Whoosh(1.2), 0.3, 0.4).rv(2.6, 0.32).ch(3, 0.5); r.stack = 2; r }
        28 => { let mut r = Recipe::new("gods_af_jessica", -11.6).p(-2.0, 0.95).at(0.7).l(Harp(62.0), 0.0, 0.75).l(Wings, 0.9, 0.7).rv(2.6, 0.32).ch(9, 0.55); r.stack = 2; r }
        29 => { let mut r = Recipe::new("gods_am_fenrir", -11.4).p(-4.0, 0.92).at(0.9).l(Horn(45.0), 0.0, 0.85).l(Hooves, 0.9, 0.7).rv(2.8, 0.34).ch(6, 0.6); r.octave = 0.4; r.stack = 2; r }
        30 => { let mut r = Recipe::new("gods_am_echo", -11.2).p(-4.0, 0.9).at(0.75).l(Thunder(4.0), 0.0, 1.0).l(Thunder(3.0), 2.0, 0.7).rv(3.0, 0.36).ch(2, 0.6); r.octave = 0.45; r.stack = 2; r.dist = 0.12; r }
        31 => { let mut r = Recipe::new("gods_bm_george", -11.0).p(-3.0, 0.92).at(0.5).l(Bells(0), 0.0, 0.75).l(Wings, 1.4, 0.6).rv(3.0, 0.36).ch(10, 0.6); r.octave = 0.35; r.stack = 3; r }
        32 => { let mut r = Recipe::new("gods_am_onyx", -10.8).p(-3.0, 0.9).at(0.5).l(Sistrum, 0.0, 0.7).l(Shimmer(2), 0.4, 0.7).rv(3.2, 0.38).ch(4, 0.65); r.octave = 0.4; r.stack = 3; r }
        33 => { let mut r = Recipe::new("slow_bm_george", -10.6).p(-4.0, 0.9).at(0.4).l(Horn(43.0), 0.0, 0.6).l(Shimmer(3), 0.3, 0.8).l(Choir(5, 5.0), 0.2, 0.6).rv(3.4, 0.4).ch(5, 0.7); r.octave = 0.45; r.stack = 3; r }
        // ── holy
        34 => { let mut r = Recipe::new("slow_am_onyx", -10.4).p(-4.0, 0.9).at(0.7).l(Fire(5.0), 0.0, 0.85).l(Hooves, 0.3, 0.6).l(Thunder(3.5), 0.6, 0.8).l(Choir(11, 5.5), 0.4, 0.7).rv(3.6, 0.42).ch(11, 0.75); r.octave = 0.5; r.stack = 3; r }
        35 => { let mut r = Recipe::new("sep_bm_george", -10.2).p(-5.0, 0.88).at(2.1).l(Shofar(2.3, 62.0), 0.0, 0.95).l(Bells(1), 2.0, 0.6).l(Choir(1, 6.0), 1.9, 0.7).rv(3.8, 0.42).ch(1, 0.75); r.octave = 0.5; r.stack = 3; r }
        // ── the God of Israel
        36 => {
            let mut r = Recipe::new("slow_am_onyx", -9.5).p(-7.0, 0.8).at(3.1)
                .l(Heartbeat, 0.0, 0.7).l(SubDrop(4.0), 0.55, 1.0).l(Shofar(3.2, 59.0), 0.6, 1.0).l(Thunder(5.0), 2.9, 1.0)
                .l(Choir(7, 9.0), 2.8, 0.9).l(Shimmer(4), 3.4, 0.9)
                .rv(7.0, 0.5).ch(7, 0.95);
            r.octave = 0.6; r.stack = 4; r.glue = 0.35; r
        }
        _ => Recipe::new("excl_am_adam", -20.0),
    }
}

/// "I AM THAT I AM" — plays after the God tier.
pub fn iam() -> Recipe {
    let mut r = Recipe::new("iam_am_onyx", -12.5).p(-5.0, 0.85).at(0.3).l(Fx::Choir(7, 7.0), 0.0, 0.5).rv(6.5, 0.5).ch(7, 0.6);
    r.octave = 0.55; r.stack = 3; r
}

fn layer(sr: f32, fx: Fx, seed: u32) -> St {
    use Fx::*;
    match fx {
        Engine(k) => engine(sr, k, match k { 0 => 1.1, 1 => 1.3, 2 => 1.6, 3 => 1.7, 4 => 1.9, 5 => 1.8, 6 => 2.1, _ => 2.2 }, seed),
        Prop => prop(sr, 2.2),
        Jet(p) => jet(sr, 2.0 + p * 0.6, p, seed),
        Chime => chime(sr),
        Boom(d) => boom(sr, d, seed),
        Rocket(sz) => rocket(sr, 2.2 + sz * 0.8, sz, seed),
        Quindar(f) => St::from_mono(&quindar(sr, f), 0.0),
        Hover => hover(sr, 2.4),
        Theremin => St::from_mono(&theremin(sr, 2.4), 0.2),
        Laser => St::from_mono(&laser(sr), -0.3),
        Warp(d) => warp(sr, d, seed),
        Teleport => teleport(sr, 1.0),
        Swirl(d) => swirl(sr, d, seed),
        Clock => clock(sr, 7, 0.14),
        Gong(f) => gong(sr, 4.5, f),
        Harp(b) => harp(sr, b, 12, 0.75),
        Wings => wings(sr, 4, 0.22),
        Horn(n) => horn(sr, 2.2, n),
        Hooves => hooves(sr, 16, 0.12),
        Thunder(d) => thunder(sr, d, seed),
        Bells(k) => if k == 0 { bells(sr, &[74.0, 79.0, 81.0, 86.0], 0.35) } else { bells(sr, &[79.0, 83.0, 86.0, 91.0, 86.0], 0.28) },
        Sistrum => sistrum(sr, 2.0),
        Shimmer(k) => shimmer(sr, 4.0, match k { 1 => &[84.0, 88.0, 91.0, 95.0], 2 => &[88.0, 89.0, 92.0, 95.0], 3 => &[91.0, 95.0, 98.0, 103.0], _ => &[86.0, 90.0, 93.0, 98.0, 102.0] }),
        Fire(d) => fire(sr, d, seed),
        Shofar(d, n) => shofar(sr, d, n, seed),
        SubDrop(d) => St::from_mono(&subdrop(sr, d), 0.0),
        Heartbeat => St::from_mono(&heartbeat(sr), 0.0),
        Choir(c, d) => { let notes: Vec<f32> = chord(c).iter().map(|m| m + 12.0).collect(); let vow: &[u8] = &[1, 0, 4]; reverb(&choir(sr, &notes, d, vow, 2, 0.6, seed), 3.5, 1.3, 0.6, 0.03, 0.45, 1.0, sr) }
        Whoosh(d) => St::from_mono(&whoosh(sr, d, 300.0, 4000.0, seed), 0.0),
    }
}

fn stutter(x: &[f32], sr: f32) -> Vec<f32> {
    // "O-o-oh m-my god": repeat the first syllable twice and chop a later slice
    let seg = ((0.11 * sr) as usize).min(x.len() / 3);
    let mut out = Vec::with_capacity(x.len() + seg * 4);
    for k in 0..2 {
        let mut s = x[..seg].to_vec();
        fade(&mut s, (0.004 * sr) as usize, (0.02 * sr) as usize);
        out.extend_from_slice(&s);
        out.extend(core::iter::repeat(0.0).take((0.03 * sr) as usize + k * 40));
    }
    let mid = x.len() / 2;
    out.extend_from_slice(&x[..mid]);
    let s2 = ((0.07 * sr) as usize).min(x.len() - mid);
    let mut sl = x[mid..mid + s2].to_vec();
    fade(&mut sl, (0.003 * sr) as usize, (0.01 * sr) as usize);
    out.extend_from_slice(&sl);
    out.extend_from_slice(&x[mid..]);
    out
}

fn doppler(x: &[f32], amt: f32) -> Vec<f32> {
    let n = x.len() as f32;
    varispeed_curve(x, |i| { let k = clamp(i / n, 0.0, 1.0); 1.0 + amt * 0.5 * (1.0 - 2.0 * smooth(k)) }, x.len() * 3)
}

pub fn apply_style(r: &mut Recipe, style: u8) {
    match style {
        1 => { r.robot = r.robot.max(0.85); }
        2 => { if r.vchoir == 0 { r.vchoir = 1; } r.vchoir_mix = r.vchoir_mix.max(0.7); }
        3 => { r.semis += 7.0; r.tempo *= 1.15; r.octave = 0.0; }
        4 => { r.semis -= 7.0; r.tempo *= 0.9; }
        5 => { if r.echo == 0.0 { r.echo = 0.32; r.echo_fb = 0.45; } r.rev = r.rev.max(3.0); r.rev_wet = r.rev_wet.max(0.45); }
        _ => {}
    }
}

pub fn render(snd: &mut Snd, r: &Recipe, seed: u32) -> St {
    let sr = snd.sr;
    let cid = clip_id(r.clip);
    let raw: Vec<f32> = snd.clips.get(cid).cloned().unwrap_or_default();
    let mut v: Vec<f32> = if raw.is_empty() { vec![0.0; (0.5 * sr) as usize] } else { raw };
    if r.stutter { v = stutter(&v, sr); }
    if r.reverse_in {
        let mut rv = reverse(&v);
        // make it swell: fade the reversed copy in
        let n = rv.len(); for (i, s) in rv.iter_mut().enumerate() { let k = i as f32 / n as f32; *s *= k * k; }
        let mut rvst = St::from_mono(&rv, 0.0);
        rvst = reverb(&rvst, 2.0, 1.2, 0.6, 0.0, 0.6, 0.6, sr);
        let mut pre = rvst.mono(); pre.truncate(n);
        normalize(&mut pre, 0.6);
        let mut joined = pre; joined.extend_from_slice(&v); v = joined;
    }
    let mut x = pitch_shift(&v, r.semis, r.tempo, sr);
    if r.doppler > 0.0 { x = doppler(&x, r.doppler); }
    if r.radio > 0.0 { radio(&mut x, r.radio, sr, seed); }
    if r.ring > 0.0 { ringmod(&mut x, r.ring, 0.7, sr); }
    if r.robot > 0.0 {
        let car = chord_carrier(sr, x.len(), chord(8), seed);
        let rb = vocode(&x, &car, sr);
        for i in 0..x.len() { x[i] = x[i] * (1.0 - r.robot) + rb[i] * r.robot; }
    }
    if r.dist > 0.0 { saturate(&mut x, r.dist); }
    if r.hp > 0.0 { hp(&mut x, sr, r.hp); }
    if r.lp > 0.0 { lp(&mut x, sr, r.lp); }
    normalize(&mut x, 0.9);
    let mut voice = if r.stack > 1 {
        let mut c = chorus(&x, r.stack as usize, 3.0 + r.stack as f32, 0.5, 0.75, sr);
        c.add_mono(&x, 0, 0.8, 0.0);
        c
    } else { St::from_mono(&x, 0.0) };
    if r.octave > 0.0 {
        let mut o = pitch_shift(&x, -12.0, 1.0, sr);
        lp(&mut o, sr, 2500.0);
        normalize(&mut o, 0.9);
        voice.add_mono(&o, 0, r.octave, 0.0);
    }
    if r.vchoir > 0 && r.vchoir_mix > 0.0 {
        let notes = chord(r.vchoir);
        let len = x.len() + (0.6 * sr) as usize;
        let mut xl = x.clone(); xl.resize(len, 0.0);
        let cl = chord_carrier(sr, len, notes, seed + 11);
        let cr = chord_carrier(sr, len, notes, seed + 23);
        let vl = vocode(&xl, &cl, sr);
        let vr = vocode(&xl, &cr, sr);
        let cs = St { l: vl, r: vr };
        voice.add(&cs, 0, r.vchoir_mix * 0.8);
    }
    if r.voice_gain != 1.0 { voice.gain(r.voice_gain); }
    if r.echo > 0.0 { voice = echo(&voice, r.echo, r.echo_fb, 4, sr, 3500.0); }
    if r.rev > 0.0 { voice = reverb(&voice, r.rev, 1.0 + r.rev * 0.08, 0.55, 0.02, r.rev_wet * 1.6, 1.0, sr); }
    // assemble: balance by loudness, then let the voice push the effects down
    let vl = loudness(&voice, sr);
    if vl > -69.0 { voice.gain(db(-16.0 - vl)); }
    let at = (r.at * sr) as usize;
    let mut bed = St::new(at + voice.len());
    for (k, l) in r.layers.iter().enumerate() {
        let mut s = layer(sr, l.fx, seed + 101 + k as u32 * 17);
        let ll = loudness(&s, sr);
        if ll > -69.0 { s.gain(db(-16.0 - 7.0 - ll) * l.gain); }
        bed.add(&s, (l.at * sr) as usize, 1.0);
    }
    // side-chain: duck the bed under the words
    let mono = voice.mono();
    let mut env = vec![0.0f32; mono.len()];
    let (att, rel) = (exp(-1.0 / (0.01 * sr)), exp(-1.0 / (0.25 * sr)));
    let mut e = 0.0f32;
    let mut mx = 1e-6f32;
    for i in 0..mono.len() { let a = abs(mono[i]); e = if a > e { a + (e - a) * att } else { a + (e - a) * rel }; env[i] = e; if e > mx { mx = e; } }
    for i in 0..mono.len() {
        let j = at + i; if j >= bed.len() { break; }
        let d = 1.0 - 0.62 * clamp(env[i] / mx * 1.6, 0.0, 1.0);
        bed.l[j] *= d; bed.r[j] *= d;
    }
    let mut out = bed;
    out.add(&voice, at, 1.0);
    out.trim_tail(0.0005, sr);
    master(&mut out, r.lufs, db(-0.8), r.glue + 0.15, sr);
    out
}
