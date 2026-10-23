//! The 124 OMGs. Each tier takes one of the base voice clips and pushes it
//! further: deeper, slower, bigger rooms, choirs that sing the words, and a bed
//! of effects that matches the ride. Loudness climbs the whole way up.

use alloc::vec;
use alloc::vec::Vec;

use super::dsp::*;
use super::sfx::*;
use super::Snd;
use crate::m::*;
use crate::tiers::GOD;
#[cfg(test)]
use crate::tiers::N_TIERS;

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
    // new families
    Bell, Steps(u8, f32, f32), Squeak, Whine(f32, f32), TwoStroke(f32, f32), Honk, BigHorn(u8), Whistle, Chug(u8),
    Waves(f32), Splash, Sonar(u8), Chopper(f32), Burner(f32), Stomp(u8), Crowd, Trumpet, Whale, Wind(f32), Rumble(f32), Coins,
}

#[derive(Clone, Copy)]
pub struct Layer { pub fx: Fx, pub at: f32, pub gain: f32 }

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
    fn l(mut self, fx: Fx, at: f32, gain: f32) -> Self { self.layers.push(Layer { fx, at, gain }); self }
    fn at(mut self, t: f32) -> Self { self.at = t; self }
    fn ch(mut self, chord: u8, mix: f32) -> Self { self.vchoir = chord; self.vchoir_mix = mix; self }
    fn st(mut self, n: u8) -> Self { self.stack = n; self }
    fn oc(mut self, k: f32) -> Self { self.octave = k; self }
    fn ds(mut self, k: f32) -> Self { self.dist = k; self }
    fn rd(mut self, k: f32) -> Self { self.radio = k; self }
    fn rb(mut self, k: f32) -> Self { self.robot = k; self }
    fn rg(mut self, f: f32) -> Self { self.ring = f; self }
    fn dp(mut self, k: f32) -> Self { self.doppler = k; self }
    fn stut(mut self) -> Self { self.stutter = true; self }
    fn rev_in(mut self) -> Self { self.reverse_in = true; self }
    fn lpf(mut self, f: f32) -> Self { self.lp = f; self }
}

/// MIDI chords for the vocoder choirs and pads.
pub fn chord(id: u8) -> &'static [f32] {
    match id {
        1 => &[38.0, 45.0, 50.0, 54.0, 57.0, 62.0],            // D major
        2 => &[38.0, 45.0, 50.0, 53.0, 57.0, 62.0],            // D minor
        3 => &[36.0, 43.0, 48.0, 50.0, 55.0, 60.0, 62.0],      // C open fifths + 9
        4 => &[40.0, 47.0, 52.0, 53.0, 56.0, 59.0],            // E with flat 2
        5 => &[43.0, 50.0, 55.0, 59.0, 62.0, 67.0],            // G major
        6 => &[45.0, 52.0, 57.0, 60.0, 64.0, 69.0],            // A minor
        7 => &[38.0, 45.0, 50.0, 54.0, 57.0, 62.0, 66.0, 69.0, 74.0], // D major, wide (God)
        8 => &[45.0, 57.0],                                     // robot A
        9 => &[41.0, 48.0, 53.0, 57.0, 60.0, 65.0],            // F major
        10 => &[43.0, 50.0, 55.0, 58.0, 62.0, 67.0],           // G minor
        11 => &[36.0, 43.0, 48.0, 52.0, 55.0, 60.0, 64.0, 67.0], // C major wide
        _ => &[38.0, 45.0, 50.0, 54.0, 57.0, 62.0],
    }
}

/// Loudness target: a steady climb from a whisper-ish crawl to a roaring finale.
fn lufs_for(t: u8) -> f32 {
    if t >= GOD { return -9.5; }
    -27.0 + 17.0 * pow(t as f32 / (GOD - 1) as f32, 0.9)
}

/// A recipe with the defaults for this height of the ladder.
fn base(t: u8, clip: &'static str) -> Recipe {
    let k = t as f32 / GOD as f32;
    let mut r = Recipe::new(clip, lufs_for(t));
    r.rev = 0.3 + 2.6 * k;
    r.rev_wet = 0.08 + 0.3 * k;
    if k > 0.25 { r.stack = 2; }
    if k > 0.8 { r.stack = 3; }
    r
}

pub fn recipe(t: u8) -> Recipe {
    use Fx::*;
    let key = crate::tiers::tier(t).key;
    let b = |c: &'static str| base(t, c);
    match key {
        // ── on foot: tiny, cute, sped-up voices
        "crawl" => b("calm_af_bella").p(6.0, 1.12).l(Squeak, 0.0, 0.6).at(0.25).rv(0.4, 0.1),
        "walk" => b("q_af_jessica").p(5.0, 1.1).l(Steps(4, 0.24, 0.2), 0.0, 0.6).at(0.5),
        "run" => b("calm_am_puck").p(4.0, 1.12).l(Steps(8, 0.12, 0.35), 0.0, 0.7).l(Whoosh(0.5), 0.6, 0.4).at(0.3),
        "bicycle" => b("calm_af_bella").p(3.0, 1.05).l(Bell, 0.0, 0.8).at(0.5),
        "escooter" => b("q_af_jessica").p(2.0, 1.05).l(Whine(300.0, 1800.0), 0.0, 0.7).at(0.45),
        "ebike" => b("excl_am_adam").p(3.0, 1.08).l(Whine(200.0, 1400.0), 0.0, 0.6).l(Bell, 0.9, 0.5).at(0.4),
        "segway" => b("calm_am_puck").p(1.0, 1.0).l(Whine(500.0, 900.0), 0.0, 0.6).at(0.4).rv(0.6, 0.14),
        // ── small motors
        "vespa" => b("calm_af_bella").p(1.0, 1.0).l(TwoStroke(70.0, 160.0), 0.0, 0.8).at(0.5),
        "supercub" => b("excl_am_adam").p(1.0, 1.0).l(TwoStroke(55.0, 130.0), 0.0, 0.8).at(0.5),
        "tuktuk" => b("q_af_jessica").l(TwoStroke(45.0, 110.0), 0.0, 0.7).l(Honk, 0.1, 0.6).at(0.7),
        "quad" => b("double_am_echo").l(Engine(14), 0.0, 0.8).at(0.6),
        "harley" => b("excl_am_fenrir").p(-1.0, 0.98).l(Engine(10), 0.0, 0.9).at(0.75).ds(0.06),
        "ducati" => b("long_am_liam").p(-1.0, 1.0).l(Engine(11), 0.0, 0.85).at(0.7),
        "ninja" => b("excl_am_echo").p(-1.0, 1.0).l(Engine(12), 0.0, 0.9).at(0.7).ds(0.1).st(2),
        // ── everyday cars
        "picanto" => b("calm_am_puck").p(1.0, 1.04).l(Engine(0), 0.0, 0.6).at(0.2),
        "fiat500" => b("calm_af_bella").l(Engine(8), 0.0, 0.65).at(0.3),
        "mini" => b("excl_bm_lewis").l(Engine(9), 0.0, 0.75).at(0.5),
        "beetle" => b("q_af_jessica").l(Engine(8), 0.0, 0.6).l(Honk, 0.9, 0.4).at(0.4),
        "corolla" => b("excl_am_adam").l(Engine(0), 0.0, 0.55).at(0.35),
        "wrx" => b("triple_am_liam").l(Engine(9), 0.0, 0.8).l(Crowd, 0.5, 0.4).at(0.6),
        "mx5" => b("long_af_jessica").l(Engine(3), 0.0, 0.75).at(0.5),
        // ── premium
        "wrangler" => b("excl_am_fenrir").l(Engine(1), 0.0, 0.75).at(0.6),
        "mustang" => b("double_am_echo").l(Engine(5), 0.0, 0.9).at(0.7).ds(0.05),
        "models" => b("q_af_jessica").p(-1.0, 1.0).l(Engine(2), 0.0, 0.75).at(0.6),
        "m5" => b("excl_bm_daniel").l(Engine(3), 0.0, 0.85).at(0.6),
        "gclass" => b("sep_bm_george").p(-1.0, 0.98).l(Engine(5), 0.0, 0.8).at(0.8),
        "rangerover" => b("excl_bm_lewis").l(Engine(17), 0.0, 0.7).l(Chime, 0.0, 0.5).at(0.7),
        "p911" => b("long_am_liam").l(Engine(17), 0.0, 0.85).at(0.7),
        "gtr" => b("excl_am_echo").p(-2.0, 0.97).l(Engine(6), 0.0, 0.9).at(0.8).st(2),
        // ── supercars
        "cobra" => b("excl_am_fenrir").p(-2.0, 0.97).l(Engine(5), 0.0, 0.95).at(0.7).ds(0.12),
        "gt40" => b("triple_am_liam").p(-1.0, 1.02).l(Engine(3), 0.0, 0.85).l(Crowd, 0.6, 0.5).at(0.5),
        "countach" => b("long_am_michael").p(-2.0, 0.96).l(Engine(4), 0.0, 0.85).at(0.7).st(2),
        "f40" => b("sep_am_onyx").p(-2.0, 0.97).l(Engine(6), 0.0, 0.9).at(0.75).st(2),
        "mclarenf1" => b("long_am_liam").p(-2.0, 0.97).l(Engine(7), 0.0, 0.9).at(0.7).oc(0.25),
        "aventador" => b("excl_am_echo").p(-3.0, 0.95).l(Engine(4), 0.0, 0.95).at(0.75).oc(0.3).st(2),
        "laferrari" => b("double_am_echo").p(-3.0, 0.96).l(Engine(7), 0.0, 0.95).l(Engine(2), 0.0, 0.3).at(0.75).oc(0.3).st(2),
        // ── hypercars & royals
        "phantom" => b("slow_bm_george").p(-2.0, 0.95).l(Chime, 0.0, 0.6).l(Shimmer(1), 0.2, 0.5).at(0.6).rv(1.6, 0.25).oc(0.25),
        "veyron" => b("sep_am_onyx").p(-3.0, 0.95).l(Engine(6), 0.0, 0.95).at(0.8).oc(0.3).st(2),
        "chiron" => b("long_am_michael").p(-3.0, 0.95).l(Engine(6), 0.0, 1.0).l(Boom(false), 2.0, 0.5).at(0.8).oc(0.35).st(2),
        "zonda" => b("triple_am_liam").p(-2.0, 0.98).l(Engine(7), 0.0, 0.95).at(0.6).st(2).oc(0.3),
        "huayra" => b("excl_am_fenrir").p(-3.0, 0.95).l(Engine(6), 0.0, 0.9).l(Wind(2.0), 0.5, 0.5).at(0.8).oc(0.35).st(2),
        "jesko" => b("sep_am_onyx").p(-3.0, 0.94).l(Engine(4), 0.0, 1.0).l(Boom(false), 2.0, 0.6).at(0.8).oc(0.4).st(2),
        "nevera" => b("long_af_jessica").p(-2.0, 0.95).l(Engine(2), 0.0, 0.9).l(Whine(800.0, 3200.0), 0.3, 0.4).at(0.6).st(2).oc(0.3),
        "boattail" => b("slow_bm_george").p(-3.0, 0.92).l(Chime, 0.0, 0.5).l(Waves(3.0), 0.0, 0.5).l(Coins, 1.2, 0.5).rv(2.0, 0.28).at(0.7).oc(0.35).st(2),
        // ── monsters & records
        "f1" => b("triple_am_liam").p(-2.0, 1.0).l(Engine(13), 0.0, 1.0).l(Crowd, 0.9, 0.5).at(0.7).st(2).ds(0.1),
        "monstertruck" => b("excl_am_fenrir").p(-4.0, 0.95).l(Engine(5), 0.0, 1.0).l(Crowd, 0.4, 0.7).l(Boom(false), 1.6, 0.6).at(0.9).oc(0.4).st(2).ds(0.18),
        "belaz" => b("slow_bm_george").p(-4.0, 0.92).l(Engine(15), 0.0, 1.0).l(BigHorn(3), 0.4, 0.7).at(1.0).oc(0.45).st(2),
        "bagger" => b("slow_am_onyx").p(-4.0, 0.9).l(Rumble(2.6), 0.0, 0.9).l(Stomp(4), 0.3, 0.6).at(0.8).oc(0.5).st(3),
        "thrustssc" => b("excl_am_echo").p(-4.0, 0.92).l(Jet(1.5), 0.0, 0.9).l(Boom(true), 1.7, 1.0).at(0.3).dp(0.35).oc(0.4).st(2),
        // ── rails
        "steam" => b("excl_bm_daniel").p(-2.0, 0.97).l(Chug(10), 0.0, 0.8).l(Whistle, 0.9, 0.8).at(1.3).rv(1.6, 0.24),
        "orientexpress" => b("slow_bm_george").p(-2.0, 0.95).l(Chug(8), 0.0, 0.5).l(Bells(1), 0.2, 0.5).at(0.9).rv(1.8, 0.26).st(2),
        "tgv" => b("sep_bm_george").p(-2.0, 0.96).l(Chime, 0.0, 0.6).l(Whoosh(1.2), 0.9, 0.8).at(1.0).dp(0.3),
        "shinkansen" => b("long_am_michael").p(-3.0, 0.95).l(Chime, 0.0, 0.6).l(BigHorn(0), 0.4, 0.6).l(Whoosh(1.0), 1.2, 0.8).at(1.0).dp(0.4).st(2),
        "maglev" => b("excl_am_eric").p(-3.0, 0.95).l(Whine(120.0, 700.0), 0.0, 0.7).l(Hover, 0.3, 0.6).at(0.6).st(2).oc(0.3),
        "hyperloop" => b("long_af_jessica").p(-3.0, 0.92).l(Whoosh(1.4), 0.0, 0.8).l(Warp(1.6), 0.2, 0.5).at(0.4).dp(0.6).st(2),
        // ── seas
        "jetski" => b("triple_af_jessica").p(-1.0, 1.0).l(TwoStroke(80.0, 180.0), 0.0, 0.8).l(Splash, 0.6, 0.7).at(0.5),
        "speedboat" => b("excl_am_adam").p(-2.0, 0.98).l(Engine(16), 0.0, 0.9).l(Splash, 0.8, 0.8).at(0.7).st(2),
        "ac75" => b("whoa_am_adam").p(-2.0, 0.98).l(Wind(2.5), 0.0, 0.8).l(Splash, 1.0, 0.6).at(0.6).st(2),
        "trieste" => b("slow_af_nicole").p(-3.0, 0.92).l(Sonar(3), 0.0, 0.9).at(0.9).rv(3.0, 0.4).lpf(3500.0),
        "superyacht" => b("sep_bm_george").p(-3.0, 0.95).l(BigHorn(2), 0.0, 0.7).l(Waves(3.0), 0.0, 0.6).at(1.2).st(2).oc(0.3),
        "cruiseship" => b("slow_bm_george").p(-4.0, 0.92).l(BigHorn(1), 0.0, 1.0).l(Crowd, 1.2, 0.4).at(1.6).st(2).oc(0.4),
        "carrier" => b("sep_am_onyx").p(-4.0, 0.92).l(BigHorn(1), 0.0, 0.8).l(Jet(1.2), 1.0, 0.8).at(1.4).st(3).oc(0.45),
        // ── skies
        "balloon" => b("calm_af_bella").p(-1.0, 0.98).l(Burner(1.4), 0.0, 0.8).at(0.8).rv(1.4, 0.22),
        "wright" => b("excl_bm_lewis").p(-1.0, 1.0).l(Prop, 0.0, 0.7).at(0.6).rd(0.5),
        "zeppelin" => b("slow_bm_george").p(-2.0, 0.95).l(Prop, 0.0, 0.5).l(Hover, 0.0, 0.4).at(0.8).rv(2.0, 0.28).st(2),
        "cessna" => b("excl_bm_daniel").l(Prop, 0.0, 0.7).at(0.6).rd(0.6),
        "helicopter" => b("excl_am_adam").p(-1.0, 1.0).l(Chopper(2.4), 0.0, 0.9).at(0.6).rd(0.4),
        "g650" => b("excl_bm_daniel").p(-1.0, 0.97).l(Chime, 0.0, 0.7).l(Jet(0.4), 0.3, 0.45).at(0.95).rv(1.4, 0.22),
        "b747" => b("sep_bm_george").p(-1.0, 0.95).l(Chime, 0.0, 0.7).l(Jet(0.7), 0.2, 0.6).at(1.0).rv(1.2, 0.2).rd(0.35),
        "a380" => b("long_am_michael").p(-2.0, 0.95).l(Jet(1.0), 0.0, 0.75).at(0.4).rv(2.0, 0.26).st(2).oc(0.3),
        "an225" => b("slow_am_onyx").p(-3.0, 0.93).l(Jet(1.3), 0.0, 0.9).l(Rumble(1.6), 0.2, 0.6).at(0.6).st(2).oc(0.35),
        "concorde" => b("triple_am_liam").p(-1.0, 1.05).l(Jet(0.8), 0.0, 0.5).l(Boom(false), 2.2, 0.95).at(0.2).rv(1.6, 0.22).ds(0.08),
        "f35" => b("excl_am_fenrir").p(-2.0, 1.0).l(Jet(1.3), 0.0, 0.8).at(0.35).rd(0.75).ds(0.2),
        "sr71" => b("excl_am_echo").p(-4.0, 0.92).l(Jet(1.5), 0.0, 0.75).l(Boom(true), 1.9, 1.0).at(0.3).dp(0.35).oc(0.35),
        "b2" => b("slow_bm_george").p(-5.0, 0.95).l(SubDrop(2.6), 0.0, 0.7).l(Jet(0.6), 0.1, 0.35).at(0.3).rv(2.4, 0.3).oc(0.4).st(2).lpf(6000.0),
        "x15" => b("whoa_am_adam").p(-3.0, 0.95).l(Rocket(1.0), 0.0, 0.85).l(Boom(true), 1.6, 0.9).at(0.4).dp(0.4).st(2),
        // ── space ("Houston…")
        "vostok" => b("houston_am_michael").at(0.35).l(Quindar(2525.0), 0.0, 0.8).l(Rocket(0.7), 0.0, 0.55).rv(1.0, 0.15).rd(0.55),
        "saturnv" => b("houston_am_onyx").p(-2.0, 0.96).at(0.4).l(Quindar(2525.0), 0.0, 0.8).l(Rocket(1.8), 0.0, 0.95).rv(1.8, 0.24).rd(0.3).oc(0.3).st(2),
        "lunarrover" => b("houston_am_adam").p(-1.0, 0.98).l(Quindar(2525.0), 0.0, 0.8).l(Whine(200.0, 600.0), 0.2, 0.4).at(0.35).rd(0.6).rv(1.2, 0.2),
        "shuttle" => b("triple_af_jessica").p(-1.0, 1.0).at(0.5).l(Rocket(2.2), 0.0, 1.0).l(Boom(false), 2.6, 0.8).rv(1.8, 0.24).st(2).oc(0.25).ds(0.12),
        "soyuz" => b("houston_am_michael").p(-2.0, 0.97).at(0.35).l(Quindar(2525.0), 0.0, 0.8).l(Rocket(1.2), 0.0, 0.75).rd(0.45).oc(0.2),
        "perseverance" => b("long_af_jessica").p(-1.0, 0.97).l(Quindar(2525.0), 0.0, 0.6).l(Whine(150.0, 500.0), 0.2, 0.4).l(Wind(2.0), 0.0, 0.5).at(0.5).rd(0.4).rv(1.6, 0.25),
        "falcon9" => b("houston_am_adam").p(-2.0, 0.97).l(Rocket(1.4), 0.0, 0.8).l(Boom(true), 2.0, 0.8).at(0.4).rd(0.35).st(2).oc(0.25),
        "starship" => b("houston_am_onyx").p(-3.0, 0.95).l(Rocket(2.6), 0.0, 1.0).l(SubDrop(3.0), 0.3, 0.6).at(0.4).rd(0.25).st(3).oc(0.35),
        "iss" => b("slow_af_nicole").p(-1.0, 0.92).at(0.3).l(Shimmer(1), 0.0, 0.7).rv(4.2, 0.5).ec(0.38, 0.35).st(3).oc(0.2),
        "voyager" => b("slow_af_nicole").p(-3.0, 0.9).l(Quindar(1800.0), 0.0, 0.5).l(Shimmer(2), 0.0, 0.7).at(0.3).rv(5.0, 0.55).ec(0.5, 0.45).st(2),
        "parker" => b("whoa_am_adam").p(-3.0, 0.92).l(Fire(4.0), 0.0, 0.9).l(SubDrop(2.5), 0.2, 0.6).at(0.4).rv(2.6, 0.32).st(2).oc(0.4).ds(0.1),
        // ── science fiction
        "hoverboard" => b("excl_am_eric").p(0.0, 1.05).l(Hover, 0.0, 0.7).at(0.4).rb(0.3),
        "jetpack" => b("whoa_am_adam").p(1.0, 1.05).l(Rocket(0.5), 0.0, 0.7).at(0.3).dp(0.3),
        "flyingcar" => b("excl_am_eric").p(-1.0, 1.0).at(0.4).l(Hover, 0.0, 0.7).l(Whoosh(0.8), 0.9, 0.6).rv(1.4, 0.24).rb(0.6).st(2),
        "mech" => b("sep_am_onyx").p(-3.0, 0.95).l(Stomp(4), 0.0, 0.9).at(0.6).rb(0.45).ds(0.15).st(2),
        "ufo" => b("whoa_am_adam").p(4.0, 1.1).at(0.3).l(Theremin, 0.0, 0.7).l(Laser, 1.4, 0.5).rv(1.6, 0.28).rg(33.0).st(2),
        "starfighter" => b("excl_am_michael").p(-1.0, 1.0).l(Laser, 0.0, 0.7).l(Jet(1.0), 0.1, 0.6).l(Laser, 0.5, 0.6).at(0.5).rb(0.4).st(2),
        "warpdrive" => b("long_af_jessica").p(-2.0, 0.9).at(0.2).l(Warp(2.4), 0.0, 0.85).rv(2.2, 0.3).dp(0.6).st(2).oc(0.25),
        "teleporter" => b("excl_am_michael").p(-1.0, 1.0).at(0.5).l(Teleport, 0.0, 0.75).rv(1.8, 0.3).ec(0.15, 0.35).stut().st(2),
        "wormhole" => b("excl_am_echo").p(-4.0, 0.9).at(0.2).l(Swirl(3.2), 0.0, 0.7).l(SubDrop(2.5), 1.2, 0.6).rv(2.8, 0.36).rev_in().oc(0.4).st(2),
        "timemachine" => b("holy_am_eric").p(-3.0, 0.92).at(1.0).l(Clock, 0.0, 0.8).rv(2.6, 0.32).ec(0.3, 0.5).oc(0.35).st(2),
        "planetengine" => b("slow_am_onyx").p(-5.0, 0.9).l(Rocket(3.0), 0.0, 1.0).l(SubDrop(3.5), 0.2, 0.8).l(Thunder(3.0), 1.0, 0.5).at(0.5).rb(0.3).oc(0.5).st(3).ds(0.1),
        // ── rides of the gods ("Oh my GODS!")
        "mushika" => b("gods_af_jessica").p(3.0, 1.08).l(Squeak, 0.0, 0.6).l(Bells(0), 0.3, 0.5).at(0.4).rv(1.6, 0.26).ch(9, 0.4),
        "talaria" => b("gods_am_liam").p(-1.0, 1.0).l(Wings, 0.0, 0.7).l(Harp(66.0), 0.2, 0.6).at(0.5).rv(2.2, 0.3).ch(9, 0.45).st(2),
        "freyja" => b("gods_af_jessica").p(-1.0, 0.97).l(Bells(1), 0.0, 0.6).l(Harp(62.0), 0.3, 0.6).at(0.6).rv(2.4, 0.3).ch(6, 0.5).st(2),
        "wukong" => b("gods_am_liam").p(-2.0, 0.95).at(0.4).l(Gong(110.0), 0.0, 0.8).l(Whoosh(1.2), 0.3, 0.4).rv(2.6, 0.32).ch(3, 0.5).st(2),
        "pegasus" => b("gods_af_jessica").p(-2.0, 0.95).at(0.7).l(Harp(62.0), 0.0, 0.75).l(Wings, 0.9, 0.7).rv(2.6, 0.32).ch(9, 0.55).st(2),
        "sleipnir" => b("gods_am_fenrir").p(-4.0, 0.92).at(0.9).l(Horn(45.0), 0.0, 0.85).l(Hooves, 0.9, 0.7).rv(2.8, 0.34).ch(6, 0.6).oc(0.4).st(2),
        "thor" => b("gods_am_echo").p(-4.0, 0.9).at(0.75).l(Thunder(4.0), 0.0, 1.0).l(Thunder(3.0), 2.0, 0.7).rv(3.0, 0.36).ch(2, 0.6).oc(0.45).st(2).ds(0.12),
        "skidbladnir" => b("gods_am_fenrir").p(-3.0, 0.93).l(Waves(3.0), 0.0, 0.6).l(Horn(43.0), 0.2, 0.7).at(0.8).rv(2.8, 0.34).ch(6, 0.6).oc(0.4).st(2),
        "torifune" => b("gods_bm_george").p(-3.0, 0.93).l(Gong(98.0), 0.0, 0.7).l(Wings, 0.6, 0.6).at(0.6).rv(3.0, 0.36).ch(3, 0.6).oc(0.35).st(2),
        "garuda" => b("gods_bm_george").p(-3.0, 0.92).at(0.5).l(Bells(0), 0.0, 0.75).l(Wings, 1.4, 0.6).rv(3.0, 0.36).ch(10, 0.6).oc(0.35).st(3),
        "airavata" => b("gods_am_onyx").p(-3.0, 0.92).l(Trumpet, 0.0, 0.9).l(Bells(0), 0.8, 0.5).at(1.0).rv(3.0, 0.36).ch(10, 0.6).oc(0.4).st(3),
        "hippocampi" => b("gods_am_echo").p(-4.0, 0.92).l(Waves(3.5), 0.0, 0.7).l(Horn(41.0), 0.3, 0.7).l(Splash, 0.2, 0.5).at(0.8).rv(3.2, 0.38).ch(2, 0.6).oc(0.45).st(3),
        "pushpaka" => b("gods_am_liam").p(-3.0, 0.92).l(Shimmer(3), 0.0, 0.8).l(Bells(1), 0.4, 0.6).at(0.5).rv(3.2, 0.38).ch(10, 0.65).oc(0.4).st(3),
        "ra" => b("gods_am_onyx").p(-3.0, 0.9).at(0.5).l(Sistrum, 0.0, 0.7).l(Shimmer(2), 0.4, 0.7).rv(3.2, 0.38).ch(4, 0.65).oc(0.4).st(3),
        "helios" => b("slow_bm_george").p(-4.0, 0.9).at(0.4).l(Horn(43.0), 0.0, 0.6).l(Shimmer(3), 0.3, 0.8).l(Choir(5, 5.0), 0.2, 0.6).l(Hooves, 0.6, 0.5).rv(3.4, 0.4).ch(5, 0.7).oc(0.45).st(3),
        // ── holy
        "ark" => b("holy_am_eric").p(-3.0, 0.93).l(Thunder(3.5), 0.0, 0.7).l(Waves(4.0), 0.0, 0.6).l(Horn(40.0), 0.5, 0.5).at(0.8).rv(3.4, 0.4).ch(11, 0.6).oc(0.45).st(3),
        "jonah" => b("slow_af_nicole").p(-3.0, 0.9).l(Whale, 0.0, 0.9).l(Waves(3.5), 0.0, 0.4).at(0.8).rv(3.6, 0.42).ch(1, 0.6).oc(0.4).st(3),
        "eagles" => b("gods_bm_george").p(-4.0, 0.9).l(Wings, 0.0, 0.8).l(Shofar(1.8, 62.0), 0.6, 0.8).at(1.0).rv(3.6, 0.42).ch(1, 0.65).oc(0.45).st(3),
        "ladder" => b("holy_am_eric").p(-4.0, 0.9).l(Harp(55.0), 0.0, 0.8).l(Choir(11, 5.0), 0.4, 0.7).at(0.6).rv(3.8, 0.42).ch(11, 0.7).oc(0.45).st(3),
        "kfitzat" => b("slow_am_onyx").p(-4.0, 0.9).l(Warp(2.0), 0.0, 0.6).l(Bells(1), 1.6, 0.6).at(0.4).rv(3.6, 0.42).ch(1, 0.65).oc(0.5).st(3).rev_in(),
        "pillar" => b("slow_bm_george").p(-4.0, 0.9).l(Fire(5.0), 0.0, 0.85).l(Wind(4.0), 0.0, 0.6).l(Choir(11, 5.5), 0.4, 0.7).at(0.7).rv(3.8, 0.42).ch(11, 0.7).oc(0.5).st(3),
        "elijah" => { let mut r = b("slow_am_onyx").p(-4.0, 0.9).at(0.7).l(Fire(5.0), 0.0, 0.85).l(Hooves, 0.3, 0.6).l(Thunder(3.5), 0.6, 0.8).l(Choir(11, 5.5), 0.4, 0.7).rv(3.6, 0.42).ch(11, 0.75); r.octave = 0.5; r.stack = 3; r }
        "merkavah" => b("gods_am_onyx").p(-5.0, 0.88).l(Gong(73.0), 0.0, 0.8).l(Swirl(4.0), 0.2, 0.5).l(Choir(7, 6.0), 0.5, 0.75).l(Wings, 1.0, 0.5).at(0.9).rv(4.0, 0.45).ch(7, 0.75).oc(0.5).st(3),
        "cherub" => b("sep_bm_george").p(-5.0, 0.88).l(Wings, 0.0, 0.8).l(Shimmer(4), 0.3, 0.8).l(Choir(1, 6.0), 0.5, 0.75).at(1.4).rv(4.0, 0.45).ch(1, 0.78).oc(0.5).st(3),
        "donkey" => { let mut r = b("sep_bm_george").p(-5.0, 0.88).at(2.1).l(Shofar(2.3, 62.0), 0.0, 0.95).l(Bells(1), 2.0, 0.6).l(Choir(1, 6.0), 1.9, 0.7).rv(3.8, 0.42).ch(1, 0.75); r.octave = 0.5; r.stack = 3; r }
        // ── the God of Israel
        "god" => {
            let mut r = Recipe::new("slow_am_onyx", -9.5).p(-7.0, 0.8).at(3.1)
                .l(Heartbeat, 0.0, 0.7).l(SubDrop(4.0), 0.55, 1.0).l(Shofar(3.2, 59.0), 0.6, 1.0).l(Thunder(5.0), 2.9, 1.0)
                .l(Choir(7, 9.0), 2.8, 0.9).l(Shimmer(4), 3.4, 0.9)
                .rv(7.0, 0.5).ch(7, 0.95);
            r.octave = 0.6; r.stack = 4; r.glue = 0.35; r
        }
        _ => b("excl_am_adam"),
    }
}

/// "I AM THAT I AM" — plays after the God tier.
pub fn iam() -> Recipe {
    let mut r = Recipe::new("iam_am_onyx", -12.5).p(-5.0, 0.85).at(0.3).l(Fx::Choir(7, 7.0), 0.0, 0.5).rv(6.5, 0.5).ch(7, 0.6);
    r.octave = 0.55; r.stack = 3; r
}

fn engine_dur(k: u8) -> f32 {
    match k { 0 => 1.1, 1 => 1.3, 2 => 1.6, 3 => 1.7, 4 => 1.9, 5 => 1.8, 6 => 2.1, 7 => 2.2, 8 => 1.3, 9 => 1.8, 10 => 2.0, 11 => 1.8, 12 => 2.0, 13 => 2.0, 14 => 1.5, 15 => 2.4, 16 => 1.8, _ => 1.8 }
}

fn layer(sr: f32, fx: Fx, seed: u32) -> St {
    use Fx::*;
    match fx {
        Engine(k) => engine(sr, k, engine_dur(k), seed),
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
        Bell => bike_bell(sr),
        Steps(n, iv, heavy) => steps(sr, n as usize, iv, heavy, seed),
        Squeak => squeak(sr),
        Whine(a, b) => whine(sr, 1.8, a, b, seed),
        TwoStroke(a, b) => twostroke(sr, 1.6, a, b, seed),
        Honk => honk(sr),
        BigHorn(k) => match k {
            0 => big_horn(sr, 1.1, &[73.0, 76.0, 80.0], 2),
            1 => big_horn(sr, 2.2, &[33.0, 40.0], 1),
            2 => big_horn(sr, 1.2, &[45.0, 52.0, 57.0], 2),
            _ => big_horn(sr, 1.3, &[52.0, 56.0, 59.0], 2),
        },
        Whistle => whistle(sr, 1.5, seed),
        Chug(n) => chug(sr, n as usize, 0.22, seed),
        Waves(d) => waves(sr, d, seed),
        Splash => splash(sr, seed),
        Sonar(n) => sonar(sr, n as usize, seed),
        Chopper(d) => chopper(sr, d, seed),
        Burner(d) => burner(sr, d, seed),
        Stomp(n) => stomp(sr, n as usize, 0.42, seed),
        Crowd => crowd(sr, 2.6, seed),
        Trumpet => trumpet(sr, seed),
        Whale => whale(sr, seed),
        Wind(d) => wind(sr, d, seed),
        Rumble(d) => rumble(sr, d, seed),
        Coins => coins(sr),
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_tier_has_its_own_recipe() {
        for t in 0..N_TIERS as u8 {
            let key = crate::tiers::tier(t).key;
            let r = recipe(t);
            // the fallback uses excl_am_adam with no layers; every real tier has a bed of effects
            assert!(!r.layers.is_empty() || key == "corolla", "tier {key} fell through");
            assert!(CLIPS.contains(&r.clip), "{key}: unknown clip {}", r.clip);
        }
        let mut last = -100.0;
        for t in 0..N_TIERS as u8 { let l = recipe(t).lufs; assert!(l >= last - 0.01, "loudness must climb ({t})"); last = l; }
    }
}
