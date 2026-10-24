//! Game state, physics and rules.
//!
//! World units: the inside of the ring has radius `ring_r` (1), centred on the
//! origin, y pointing down. The chute is a vertical channel of half-width CHUTE_W
//! that meets the ring at its top.
//!
//! Sizes are absolute: every tier is `grow` times wider than the one below it, so
//! Hermes' sandals really are a million times the size of the Space Shuttle. The
//! world can't fit that, so the camera zooms out: `base` is how many tiers the
//! world has zoomed out so far, and a ball's radius on the table is
//! `seed_r · grow^(tier − base)`. When the zoom moves, everything in the ring is
//! scaled around the bottom of the vessel, exactly like a camera pulling back.
//!
//! The spout only ever pours crawling babies. Two babies make a walker, two
//! walkers a runner… Once the zoom has left the babies too small to see, they
//! clump together in the funnel on the way in (otherwise reaching God would take
//! 2^154 drops), and the ball that falls is whatever that many babies make.

use alloc::string::String;
use alloc::vec::Vec;

use crate::m::*;
use crate::opts::*;
use crate::tiers::*;

pub const CHUTE_W: f32 = 0.09;
pub const BASE_G: f32 = 4.2;
pub const MAX_BODIES: usize = 340;
pub const MAX_BODIES_MEGA: usize = 520;
pub const SUB_HZ: f32 = 480.0;
/// The biggest ball on the table never gets wider than this (ring radii).
pub const MAX_BALL: f32 = 0.3;
/// Below this radius (ring radii) a ball is dust: it fades away.
pub const DUST_R: f32 = 0.0075;
/// Starting zoom of the camera, close on the first babies.
pub const INTRO_Z: f32 = 2.1;
pub const VIEW_MAX: f32 = 7.0;
pub const FOLLOW_Z: f32 = 2.2;
/// In the sandbox the chosen tier sits this many tiers above the seed size.
pub const SANDBOX_LIFT: f32 = 2.0;
/// Seconds after God appears when the simulation stops and the story begins.
pub const STORY_AT: f32 = 8.4;
/// …and when the bubble of life, strained by the light, bursts.
pub const BURST_AT: f32 = 5.6;

// sound ids: 0..=GOD are the tiers' OMGs
pub const S_DROP: u32 = 200;
pub const S_POP: u32 = 201;
pub const S_SOLD: u32 = 202;
pub const S_SHAKE: u32 = 203;
pub const S_MAGNET: u32 = 204;
pub const S_BOMB: u32 = 205;
pub const S_SLOWMO: u32 = 206;
pub const S_FLIP: u32 = 207;
pub const S_UPGRADE: u32 = 208;
pub const S_WHOOSH: u32 = 209;
pub const S_SPOUT: u32 = 210;
pub const S_IAM: u32 = 211;
pub const S_JAM: u32 = 212;
pub const S_CLICK: u32 = 213;
pub const S_TIMEUP: u32 = 214;
pub const S_ERA: u32 = 215;
pub const S_HIT: u32 = 216;
pub const S_COMBO: u32 = 217;
pub const S_BOING: u32 = 218;
pub const S_FUNNEL: u32 = 219;
pub const S_ZOOM: u32 = 220;
pub const S_BURST: u32 = 221;
pub const S_POKE: u32 = 222;
pub const S_DRONE: u32 = 223;
pub const S_CREATE: u32 = 224;
pub const S_NOTE0: u32 = 230; // + timbre (0..=4)
pub const S_MUSIC0: u32 = 240; // + era (0..=19)

// event opcodes (5 floats each: op, a, b, c, d)
pub const EV_SOUND: f32 = 1.0; // id, gain, pan, rate
pub const EV_BANNER: f32 = 2.0;
pub const EV_CATEGORY: f32 = 3.0;
pub const EV_END: f32 = 4.0;
pub const EV_SAVE: f32 = 5.0;
pub const EV_HAPTIC: f32 = 6.0;
pub const EV_GAMEOVER: f32 = 7.0;
pub const EV_UNLOCK: f32 = 8.0;
pub const EV_DUCK: f32 = 9.0;
pub const EV_TOOLS: f32 = 10.0;
pub const EV_MUSIC: f32 = 11.0;
pub const EV_NOTE: f32 = 12.0; // timbre, midi, gain, pan
pub const EV_STORY: f32 = 13.0; // 1 start the narration (b: Hebrew, c: from second), 0 stop, 2 hold at second a, 3 go on from second a

/// A set of tiers (the ladder is longer than 128).
#[derive(Clone, Copy, Default, PartialEq, Eq, Debug)]
pub struct Mask(pub [u64; 4]);
impl Mask {
    pub const ONE: Mask = Mask([1, 0, 0, 0]);
    pub fn all() -> Mask { let mut m = Mask::default(); for t in 0..N_TIERS { m.set(t as u8); } m }
    #[inline] pub fn has(&self, t: u8) -> bool { let t = t as usize; t < 256 && self.0[t >> 6] >> (t & 63) & 1 == 1 }
    #[inline] pub fn set(&mut self, t: u8) { let t = t as usize; self.0[t >> 6] |= 1u64 << (t & 63); }
    pub fn count(&self) -> u32 { self.0.iter().map(|w| w.count_ones()).sum() }
    /// Lowercase hex, most significant digit first, no leading zeros.
    pub fn hex(&self) -> String {
        let mut s = String::new();
        let mut started = false;
        for w in (0..4).rev() {
            for k in (0..16).rev() {
                let d = (self.0[w] >> (k * 4)) & 15;
                if d != 0 { started = true; }
                if started { s.push(core::char::from_digit(d as u32, 16).unwrap_or('0')); }
            }
        }
        if s.is_empty() { s.push('0'); }
        s
    }
    pub fn from_hex(v: &str) -> Option<Mask> {
        let v = v.trim();
        if v.is_empty() || v.len() > 64 { return None; }
        let mut m = Mask::default();
        for (i, c) in v.bytes().rev().enumerate() {
            let d = match c { b'0'..=b'9' => c - b'0', b'a'..=b'f' => c - b'a' + 10, b'A'..=b'F' => c - b'A' + 10, _ => return None } as u64;
            m.0[i / 16] |= d << ((i % 16) * 4);
        }
        Some(m)
    }
}

#[derive(Clone, Copy, Default)]
pub struct Body {
    pub id: u32,
    pub tier: u8,
    pub p: V2,
    pub v: V2,
    pub acc: V2,
    pub r: f32,
    pub angle: f32,
    pub spin: f32,
    pub age: f32,
    pub pop: f32,
    pub flash: f32,
    pub alive: bool,
    pub merged: bool,
    pub orphan_t: f32,
    pub rest_t: f32,
    pub dying: f32,
    pub hl: f32,
    pub squash: f32,
    pub squash_a: f32,
    /// chain-reaction depth: how many merges in a row led to this ball
    pub chain: u16,
    pub trail: [V2; 4],
}

#[derive(Clone, Copy, Default)]
pub struct Particle {
    /// 0 dot, 1 streak, 2 wave, 3 coin, 4 flame, 5 star, 6 confetti, 7 smoke, 8 droplet, 9 shock, 10 goo
    pub kind: u8,
    pub p: V2,
    pub v: V2,
    pub life: f32,
    pub max: f32,
    pub size: f32,
    pub color: u32,
    pub drag: f32,
    pub grav: f32,
    pub angle: f32,
    pub spin: f32,
}

#[derive(Clone, Copy, Default)]
pub struct Bolt { pub a: V2, pub b: V2, pub t: f32, pub max: f32, pub col: u32, pub seed: u32 }

#[derive(Clone, Copy, Default)]
pub struct Layout {
    pub w: f32, pub h: f32, pub dpr: f32,
    /// stage rectangle (portrait column the game lives in)
    pub sx: f32, pub sy: f32, pub sw: f32, pub sh: f32,
    /// design unit: 1 at a 390 px wide stage
    pub u: f32,
    pub cx: f32, pub cy: f32, pub ring_px: f32, pub scale: f32,
    pub chute_top: f32,
    pub chute_top_px: f32,
    pub hud_y: f32, pub ladder_y: f32, pub timer_y: f32, pub caption_y: f32, pub tools_y: f32,
}

#[derive(Clone, Copy, Default)]
pub struct Pointer { pub down: bool, pub x0: f32, pub y0: f32, pub x: f32, pub y: f32, pub t0: f32, pub dragging: bool }

#[derive(Clone, Copy, Default)]
pub struct ToolState { pub cd: f32, pub active: f32, pub charges: u8 }

#[derive(Clone, Default)]
pub struct Stats {
    pub runs: u32, pub merges: u32, pub omgs: u32, pub drops: u32, pub gods: u32,
    pub best: [f32; N_MODES], pub best_tier_ta: u8, pub played: f32, pub top_tier: u8, pub best_combo: u32,
}

pub struct Game {
    pub rng: Rng,
    pub bodies: Vec<Body>,
    order: Vec<u16>,
    by_tier: Vec<u16>,
    pub parts: Vec<Particle>,
    pub stars: Vec<Particle>,
    pub bolts: Vec<Bolt>,
    pub next_id: u32,
    pub mode: Mode,
    pub opts: Options,
    pub lay: Layout,
    pub ring_r: f32,
    /// tier the funnel delivers (made of 2^spout babies)
    pub spout: u8,
    /// how many tiers the world has zoomed out (smoothly follows `spout`)
    pub base: f32,
    pub run_max: u8,
    pub run_seen: Mask,
    pub unlocked: Mask,
    /// babies poured this run
    pub babies: f64,
    /// 0..1: how full the funnel's next ball is
    pub form: f32,
    pub form_tier: u8,
    // ── view camera (zoom in / zoom out)
    pub view_manual: bool,
    pub view_z: f32,
    pub view_pan: V2,
    pub intro_k: f32,
    pub follow_p: V2,
    // ── the Genesis ending
    pub story_on: bool,
    pub story_t: f32,
    /// story clock reported by the narration player (< 0: none, run our own clock)
    pub story_ext: f32,
    pub story_end_sent: bool,
    /// the narration's language (fixed when the story starts)
    pub story_he: bool,
    // ── the living world
    /// extra phase for the motes streaming inward (a rush on every new era)
    pub warp: f32,
    pub warp_v: f32,
    /// seconds since the bubble burst (< 0: whole)
    pub burst_t: f32,
    /// a finger stirring the fluid: where, how fast it moves (world units/s), how fresh
    pub stir_p: V2,
    pub stir_v: V2,
    pub stir_k: f32,
    pub poke_cd: f32,
    // ── the creation, played by the player
    /// the next moment of creation the story will wait for
    pub story_beat: usize,
    /// the story is holding its breath, waiting for the player's touch
    pub story_hold: bool,
    pub story_wait: f32,
    /// where each moment happened (stage fractions)
    pub story_pos: [(f32, f32); crate::story::N_BEATS],
    pub story_ptr_down: bool,
    pub story_ptr_x: f32, pub story_ptr_y: f32, pub story_ptr_x0: f32, pub story_ptr_y0: f32, pub story_ptr_t0: f32,
    pub story_marks: Vec<crate::story::Mark>,
    pub story_fx: Vec<crate::story::Spark>,
    pub story_shake: f32,
    pub story_notes: u32,
    pub story_touch_cd: f32,
    pub time: f32,
    pub real: f32,
    pub drop_t: f32,
    pub spout_cd: f32,
    pub tilt: f32,
    pub tilt_target: f32,
    pub device_tilt: f32,
    pub tools: [ToolState; N_TOOLS],
    pub upgrade_armed: bool,
    pub ptr: Pointer,
    pub tap_cd: f32,
    pub paused: bool,
    pub started: bool,
    pub finished: bool,
    pub over: bool,
    pub god_t: f32,
    pub god_id: u32,
    pub jam_t: f32,
    pub fill: f32,
    pub blocked: bool,
    pub ta_left: f32,
    pub sandbox_tier: u8,
    // ── presentation
    pub shake: f32,
    pub flash: f32,
    pub flash_col: u32,
    pub ring_pulse: f32,
    pub ring_col: u32,
    pub ring_wob: f32,
    pub hue: f32,
    pub cat: u8,
    pub cat_mix: f32,
    pub prev_cat: u8,
    pub banner_tier: i32,
    pub banner_t: f32,
    pub banner_new: bool,
    pub era_t: f32,
    pub era_card: u8,
    pub hitstop: f32,
    pub ts: f32,
    pub cam_k: f32,
    pub cam_v: f32,
    pub cam_f: V2,
    pub sl_t: f32,
    pub sl_p: V2,
    pub sl_col: u32,
    pub combo_n: u32,
    pub combo_t: f32,
    pub combo_show: f32,
    pub combo_shown: u32,
    pub combo_p: V2,
    pub note_cd: f32,
    pub note_i: u32,
    note_req: f32,
    note_x: f32,
    pub voice_busy: f32,
    pub voice_tier: i32,
    pub pop_cd: f32,
    pub sold_cd: f32,
    pub drop_snd_cd: f32,
    pub boing_cd: f32,
    pub lang_he: bool,
    pub caption: String,
    pub stats: Stats,
    pub run_merges: u32,
    pub run_drops: u32,
    pub events: Vec<f32>,
    pub draw: Vec<f32>,
    pub paths: Vec<f32>,
    pub text: String,
    pub dirty_save: f32,
    /// a ball must have existed this long (game seconds) before it can merge again,
    /// so every new ride visibly lands and bounces before the next pop
    pub merge_age: f32,
    /// seconds between drops at "Normal"
    pub drop_base: f32,
    /// how long rides left below the spout linger (alone / at most)
    pub orphan_alone: f32,
    pub orphan_max: f32,
    // ── random events
    pub ev_next: f32,
    pub ev_kind: u8,
    pub ev_left: f32,
    pub ev_burst: u32,
    pub ev_dir: f32,
    pub toast: (&'static str, &'static str),
    pub toast_t: f32,
    pub toast_col: u32,
}

pub const EV_NONE: u8 = 0;
pub const EV_RUSH: u8 = 1;
pub const EV_QUAKE: u8 = 2;
pub const EV_WIND: u8 = 3;
pub const EV_ZEROG: u8 = 4;
pub const EV_STORM: u8 = 5;
pub static EVENTS: [(&str, &str, u32); 6] = [
    ("", "", 0xFFFFFF),
    ("שעת עומס!", "Rush hour!", 0xFFB627),
    ("רעידת אדמה!", "Earthquake!", 0xFF5A4A),
    ("רוח צד!", "Crosswind!", 0x8FD3FF),
    ("אפס כבידה!", "Zero-G!", 0xC59CFF),
    ("סערה מגנטית!", "Magnetic storm!", 0x7CFFB2),
];


impl Game {
    pub fn new(seed: u32) -> Game {
        let mut g = Game {
            rng: Rng::new(seed as u64 ^ 0x5eed_0f_60d),
            bodies: Vec::with_capacity(MAX_BODIES_MEGA + 8),
            order: Vec::with_capacity(MAX_BODIES_MEGA + 8),
            by_tier: Vec::with_capacity(MAX_BODIES_MEGA + 8),
            parts: Vec::with_capacity(2400),
            stars: Vec::with_capacity(200),
            bolts: Vec::with_capacity(16),
            next_id: 1,
            mode: Mode::Classic,
            opts: Options::new(),
            lay: Layout::default(),
            ring_r: 1.0,
            spout: 0,
            base: 0.0,
            run_max: 0,
            run_seen: Mask::ONE,
            unlocked: Mask::ONE,
            babies: 0.0,
            form: 0.0,
            form_tier: 0,
            view_manual: false,
            view_z: 1.0,
            view_pan: V2::default(),
            intro_k: 0.0,
            follow_p: V2::default(),
            story_on: false,
            story_t: 0.0,
            story_ext: -1.0,
            story_end_sent: false,
            story_he: true,
            warp: 0.0,
            warp_v: 0.0,
            burst_t: -1.0,
            stir_p: V2::default(),
            stir_v: V2::default(),
            stir_k: 0.0,
            poke_cd: 0.0,
            story_beat: 0,
            story_hold: false,
            story_wait: 0.0,
            story_pos: crate::story::DEFAULT_POS,
            story_ptr_down: false,
            story_ptr_x: 0.0, story_ptr_y: 0.0, story_ptr_x0: 0.0, story_ptr_y0: 0.0, story_ptr_t0: 0.0,
            story_marks: Vec::with_capacity(64),
            story_fx: Vec::with_capacity(256),
            story_shake: 0.0,
            story_notes: 0,
            story_touch_cd: 0.0,
            time: 0.0,
            real: 0.0,
            drop_t: 0.3,
            spout_cd: 0.0,
            tilt: 0.0,
            tilt_target: 0.0,
            device_tilt: 0.0,
            tools: [ToolState::default(); N_TOOLS],
            upgrade_armed: false,
            ptr: Pointer::default(),
            tap_cd: 0.0,
            paused: false,
            started: false,
            finished: false,
            over: false,
            god_t: 0.0,
            god_id: 0,
            jam_t: 0.0,
            fill: 0.0,
            blocked: false,
            ta_left: 120.0,
            sandbox_tier: 0,
            shake: 0.0,
            flash: 0.0,
            flash_col: 0xFFFFFF,
            ring_pulse: 0.0,
            ring_col: 0xFFFFFF,
            ring_wob: 0.0,
            hue: 0.0,
            cat: 0,
            cat_mix: 1.0,
            prev_cat: 0,
            banner_tier: -1,
            banner_t: 0.0,
            banner_new: false,
            era_t: 0.0,
            era_card: 0,
            hitstop: 0.0,
            ts: 1.0,
            cam_k: 0.0,
            cam_v: 0.0,
            cam_f: V2::default(),
            sl_t: 0.0,
            sl_p: V2::default(),
            sl_col: 0xFFFFFF,
            combo_n: 0,
            combo_t: 0.0,
            combo_show: 0.0,
            combo_shown: 0,
            combo_p: V2::default(),
            note_cd: 0.0,
            note_i: 0,
            note_req: 0.0,
            note_x: 0.0,
            voice_busy: 0.0,
            voice_tier: -1,
            pop_cd: 0.0,
            sold_cd: 0.0,
            drop_snd_cd: 0.0,
            boing_cd: 0.0,
            lang_he: true,
            caption: String::new(),
            stats: Stats::default(),
            run_merges: 0,
            run_drops: 0,
            events: Vec::with_capacity(512),
            draw: Vec::with_capacity(16 * 1400),
            paths: Vec::with_capacity(8192),
            text: String::with_capacity(4096),
            dirty_save: 0.0,
            merge_age: 0.6,
            drop_base: 0.24,
            orphan_alone: 8.0,
            orphan_max: 20.0,
            ev_next: 30.0,
            ev_kind: EV_NONE,
            ev_left: 0.0,
            ev_burst: 0,
            ev_dir: 1.0,
            toast: ("", ""),
            toast_t: 0.0,
            toast_col: 0xFFFFFF,
        };
        g.tools[Tool::Upgrade as usize].charges = 1;
        g.make_stars();
        g
    }

    fn make_stars(&mut self) {
        self.stars.clear();
        for _ in 0..190 {
            let p = Particle {
                kind: 5,
                p: V2::new(self.rng.f(), self.rng.f()),
                v: V2::new(0.0, 0.0),
                life: self.rng.range(0.0, TAU),
                max: self.rng.range(0.6, 2.4),
                size: self.rng.range(0.4, 1.7),
                color: if self.rng.chance(0.15) { 0xBFD8FF } else if self.rng.chance(0.1) { 0xFFE0B0 } else { 0xFFFFFF },
                drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0,
            };
            self.stars.push(p);
        }
    }

    // ───────────────────────────────────────────── events
    #[inline]
    pub fn ev(&mut self, op: f32, a: f32, b: f32, c: f32, d: f32) {
        if self.events.len() < 5 * 300 { self.events.extend_from_slice(&[op, a, b, c, d]); }
    }
    pub fn sound(&mut self, id: u32, gain: f32, pan: f32) { self.ev(EV_SOUND, id as f32, gain, pan, 1.0); }
    pub fn sound_rate(&mut self, id: u32, gain: f32, pan: f32, rate: f32) { self.ev(EV_SOUND, id as f32, gain, pan, rate); }
    fn haptic(&mut self, ms: f32) { if self.opts.on(Opt::Haptics) { self.ev(EV_HAPTIC, ms, 0.0, 0.0, 0.0); } }
    #[inline] pub fn drama(&self) -> f32 { self.opts.get(Opt::Drama) }

    // ───────────────────────────────────────────── run control
    pub fn start(&mut self, mode: Mode) {
        self.mode = mode;
        self.bodies.clear();
        self.order.clear();
        self.parts.clear();
        self.bolts.clear();
        self.ring_r = 1.0;
        // every run starts from the very bottom of the ladder, zoomed in on the first baby
        self.spout = 0;
        self.base = 0.0;
        self.run_max = 0;
        self.run_seen = Mask::ONE;
        self.babies = 0.0;
        self.form = 0.0;
        self.form_tier = 0;
        self.view_manual = false;
        self.view_z = 1.0;
        self.view_pan = V2::default();
        self.intro_k = if mode == Mode::Sandbox { 0.0 } else { 1.0 };
        self.story_on = false;
        self.story_t = 0.0;
        self.story_ext = -1.0;
        self.story_end_sent = false;
        self.warp_v = 0.0;
        self.burst_t = -1.0;
        self.stir_k = 0.0;
        self.time = 0.0;
        self.drop_t = 0.25;
        self.spout_cd = 0.0;
        self.tilt = 0.0;
        self.tilt_target = 0.0;
        self.tools = [ToolState::default(); N_TOOLS];
        self.tools[Tool::Upgrade as usize].charges = if mode == Mode::Watch { 0 } else { 1 };
        self.tools[Tool::Upgrade as usize].cd = TOOLS[Tool::Upgrade as usize].cooldown;
        self.update_scale();
        self.upgrade_armed = false;
        self.paused = false;
        self.started = true;
        self.finished = false;
        self.over = false;
        self.god_t = 0.0;
        self.god_id = 0;
        self.jam_t = 0.0;
        self.ta_left = 120.0;
        self.banner_tier = -1;
        self.banner_t = 0.0;
        self.voice_busy = 0.0;
        self.voice_tier = -1;
        self.run_merges = 0;
        self.run_drops = 0;
        self.cat = 0;
        self.prev_cat = 0;
        self.cat_mix = 1.0;
        self.flash = 0.0;
        self.shake = 0.0;
        self.hitstop = 0.0;
        self.ts = 1.0;
        self.cam_k = 0.0; self.cam_v = 0.0;
        self.sl_t = 0.0;
        self.combo_n = 0; self.combo_t = 0.0; self.combo_show = 0.0; self.combo_shown = 0;
        self.note_i = 0;
        self.ev_next = 22.0 + self.rng.range(0.0, 10.0);
        self.ev_kind = EV_NONE; self.ev_left = 0.0; self.ev_burst = 0;
        self.toast_t = 0.0;
        self.stats.runs += 1;
        if mode == Mode::Sandbox {
            let st = self.sandbox_tier.min(GOD - 1);
            let st = if self.unlocked.has(st) { st } else { 0 };
            self.sandbox_tier = st;
            self.spout = st;
            self.base = st as f32 - SANDBOX_LIFT;
            self.cat = cat_of(st);
            self.prev_cat = self.cat;
        } else {
            // title card for the first era
            self.era_card = 0;
            self.era_t = if self.drama() > 0.0 { 2.4 } else { 0.0 };
        }
        self.ev(EV_MUSIC, self.cat as f32, 0.0, 0.0, 0.0);
        self.ev(EV_TOOLS, 0.0, 0.0, 0.0, 0.0);
        self.dirty_save = 0.5;
    }

    pub fn gap(&self) -> u8 { self.opts.get(Opt::Gap) as u8 }
    fn max_bodies(&self) -> usize { if self.mode == Mode::Mega { MAX_BODIES_MEGA } else { MAX_BODIES } }

    /// How much wider each tier is than the one below it.
    #[inline] pub fn grow(&self) -> f32 { self.opts.get(Opt::SizeGrow) }
    /// Radius of the ball the funnel drops (ring radii). The vessel option picks
    /// it; a long journey shrinks it so the biggest ball still fits.
    pub fn seed_r(&self) -> f32 {
        let mut r = self.opts.get(Opt::RingSize);
        if self.mode == Mode::Mega { r *= 0.74; }
        let span = pow(self.grow(), self.gap() as f32);
        r.min(MAX_BALL / span)
    }
    /// The camera has zoomed out by this factor since the first baby.
    pub fn zoom_factor(&self) -> f64 { libm_pow64(self.grow() as f64, self.base.max(0.0) as f64) }

    /// Ball radius for a tier: absolute size, seen through the current zoom.
    pub fn radius_for(&self, t: u8) -> f32 {
        let k = t as f32 - self.base;
        let r = self.seed_r() * pow(self.grow(), k);
        if t == GOD { return r.max(0.12); }
        clamp(r, 0.0005, 0.9)
    }
    /// Absolute width of a tier, in babies.
    pub fn babies_wide(grow: f32, t: u8) -> f64 { libm_pow64(grow as f64, t as f64) }

    fn new_body_ex(&mut self, t: u8, p: V2, v: V2, force: bool) -> Option<usize> {
        if !force && self.bodies.len() >= self.max_bodies() { return None; }
        let r = self.radius_for(t);
        let b = Body {
            id: self.next_id, tier: t, p, v, acc: V2::default(), r, angle: self.rng.range(-0.3, 0.3), spin: 0.0,
            age: 0.0, pop: 0.0, flash: 0.0, alive: true, merged: false, orphan_t: 0.0, rest_t: 0.0, dying: 0.0, hl: 0.0,
            squash: 0.0, squash_a: 0.0, chain: 0, trail: [p; 4],
        };
        self.next_id += 1;
        self.bodies.push(b);
        self.order.push((self.bodies.len() - 1) as u16);
        Some(self.bodies.len() - 1)
    }
    fn new_body(&mut self, t: u8, p: V2, v: V2) -> Option<usize> { self.new_body_ex(t, p, v, false) }

    // ───────────────────────────────────────────── geometry helpers
    #[inline] pub fn join_y(&self) -> f32 { -sqrt(self.ring_r * self.ring_r - CHUTE_W * CHUTE_W) }
    /// Camera as (zoom, pan): screen = centre + (p − pan)·scale·zoom.
    /// Automatic: close on the first babies, pulling back as the pile grows, plus a
    /// punch-zoom on every new tier. Manual: wherever the player pinched, scrolled or dragged.
    #[inline] pub fn cam(&self) -> (f32, V2) { self.cam_with(1.0 + self.cam_k) }
    fn cam_with(&self, punch: f32) -> (f32, V2) {
        if self.view_manual { return (self.view_z * (1.0 + (punch - 1.0) * 0.5), self.view_pan); }
        match self.opts.get(Opt::Camera) as u8 {
            1 => return (1.0, V2::default()),
            2 if !self.story_on => {
                // follow the biggest ball, without ever looking past the vessel
                let z = FOLLOW_Z * (1.0 + (punch - 1.0) * 0.5);
                let m = self.ring_r * (1.0 - 1.0 / FOLLOW_Z);
                return (z, V2::new(clamp(self.follow_p.x, -m, m), clamp(self.follow_p.y, -m - 0.3, m + 0.05)));
            }
            _ => {}
        }
        let zi = 1.0 + (INTRO_Z - 1.0) * smooth(self.intro_k);
        let fi = V2::new(0.0, self.ring_r * 0.42);
        let cf = fi + (self.cam_f - fi) * zi;
        let p0 = cf * (1.0 - punch) + fi * ((1.0 - zi) * punch);
        let z = zi * punch;
        (z, p0 * (-1.0 / z))
    }
    pub fn to_screen(&self, p: V2) -> (f32, f32) {
        let (z, pan) = self.cam();
        (self.lay.cx + (p.x - pan.x) * self.lay.scale * z, self.lay.cy + (p.y - pan.y) * self.lay.scale * z)
    }
    pub fn to_world(&self, x: f32, y: f32) -> V2 {
        let (z, pan) = self.cam();
        V2::new((x - self.lay.cx) / (self.lay.scale * z) + pan.x, (y - self.lay.cy) / (self.lay.scale * z) + pan.y)
    }
    /// Zoom the view by `k` around screen point (x, y) — pinch, wheel or the +/− buttons.
    pub fn view_zoom(&mut self, k: f32, x: f32, y: f32) {
        if !k.is_finite() || k <= 0.0 || self.story_on { return; }
        if !self.view_manual {
            let (z, pan) = self.cam_with(1.0);
            self.view_manual = true; self.view_z = z; self.view_pan = pan;
        }
        let s0 = self.lay.scale * self.view_z;
        let w = V2::new((x - self.lay.cx) / s0 + self.view_pan.x, (y - self.lay.cy) / s0 + self.view_pan.y);
        self.view_z = clamp(self.view_z * k, 1.0, VIEW_MAX);
        let s = self.lay.scale * self.view_z;
        self.view_pan = V2::new(w.x - (x - self.lay.cx) / s, w.y - (y - self.lay.cy) / s);
        self.clamp_view();
    }
    /// Move the zoomed-in view by a screen-space delta.
    pub fn view_pan_by(&mut self, dx: f32, dy: f32) {
        if !self.view_manual || self.story_on { return; }
        let s = self.lay.scale * self.view_z;
        self.view_pan = V2::new(self.view_pan.x - dx / s, self.view_pan.y - dy / s);
        self.clamp_view();
    }
    /// Back to the automatic camera.
    pub fn view_auto(&mut self) { self.view_manual = false; }
    fn clamp_view(&mut self) {
        let m = self.ring_r * (1.0 - 1.0 / self.view_z);
        let k = 1.0 - 1.0 / self.view_z;
        self.view_pan.x = clamp(self.view_pan.x, -m - 0.1 * k, m + 0.1 * k);
        self.view_pan.y = clamp(self.view_pan.y, -m - 0.6 * k, m + 0.1 * k);
    }

    pub fn resize(&mut self, w: f32, h: f32, dpr: f32) {
        let w = w.max(200.0); let h = h.max(200.0);
        // a portrait column: full height on phones, 9:16 on wide screens, never taller than 9:19.5
        let mut sw = w.min(h * 9.0 / 16.0);
        if w <= h * 9.0 / 16.0 { sw = w; }
        let sh = h.min(sw * 19.5 / 9.0);
        let sx = (w - sw) * 0.5; let sy = (h - sh) * 0.5;
        let u = sw / 390.0;
        let hud_y = sy + 60.0 * u;
        let ladder_y = sy + 110.0 * u;
        let timer_y = sy + 126.0 * u;
        let chute_top_px = sy + 152.0 * u;
        let tools_y = sy + sh - 18.0 * u - 50.0 * u;
        let caption_y = tools_y - 36.0 * u;
        let y_bot = caption_y - 30.0 * u;
        let ring_px = (0.478 * sw).min((y_bot - chute_top_px - 48.0 * u) * 0.5).max(60.0);
        let cy = y_bot - ring_px - 4.0 * u;
        self.lay = Layout { w, h, dpr, sx, sy, sw, sh, u, cx: sx + sw * 0.5, cy, ring_px, scale: ring_px, chute_top: 0.0, chute_top_px, hud_y, ladder_y, timer_y, caption_y, tools_y };
        self.update_scale();
    }
    fn update_scale(&mut self) {
        self.lay.scale = self.lay.ring_px / self.ring_r;
        self.lay.chute_top = (self.lay.chute_top_px - self.lay.cy) / self.lay.scale;
    }

    pub fn gravity(&self, p: V2, in_chute: bool) -> V2 {
        let mut gmul = self.opts.get(Opt::Gravity);
        if self.mode == Mode::Trampoline { gmul *= 0.85; }
        let g = BASE_G * gmul;
        let flip = self.tools[Tool::Flip as usize].active > 0.0;
        if in_chute { return V2::new(0.0, g.max(2.0)); }
        let mut a = if self.mode == Mode::BlackHole {
            let d = p.len();
            let n = if d > 1e-4 { p * (-1.0 / d) } else { V2::default() };
            let swirl = V2::new(-n.y, n.x) * 0.16;
            (n + swirl) * (g * (0.55 + 0.45 * clamp(d / self.ring_r, 0.0, 1.0)))
        } else {
            V2::new(0.0, g).rot(-self.tilt)
        };
        if flip { a = -a * 0.9; }
        if self.ev_left > 0.0 {
            match self.ev_kind {
                EV_ZEROG => { a = a * 0.18; }
                EV_WIND => { a += V2::new(self.ev_dir * g * 0.55, 0.0); }
                _ => {}
            }
        }
        a
    }

    // ───────────────────────────────────────────── input
    pub fn pointer(&mut self, kind: u32, x: f32, y: f32) {
        if self.story_on { self.ptr.down = false; self.story_pointer(kind, x, y); return; }
        match kind {
            0 => { self.ptr = Pointer { down: true, x0: x, y0: y, x, y, t0: self.real, dragging: false }; }
            1 => {
                if !self.ptr.down { return; }
                let (px, py) = (self.ptr.x, self.ptr.y);
                self.ptr.x = x; self.ptr.y = y;
                let dx = x - self.ptr.x0; let dy = y - self.ptr.y0;
                if !self.ptr.dragging && dx * dx + dy * dy > 14.0 * 14.0 { self.ptr.dragging = true; }
                if self.ptr.dragging {
                    // zoomed in: a drag looks around; otherwise it tilts gravity and stirs the fluid
                    if self.view_manual && self.view_z > 1.02 { self.view_pan_by(x - px, y - py); }
                    else if self.mode != Mode::Watch {
                        self.tilt_target = clamp(dx / (self.lay.sw * 0.45), -1.0, 1.0) * 0.62;
                        if crate::vessel::on(self) {
                            let (w0, w1) = (self.to_world(px, py), self.to_world(x, y));
                            let vel = (w1 - w0) * 60.0;
                            let vel = if vel.len() > 6.0 { vel * (6.0 / vel.len()) } else { vel };
                            self.stir_v = self.stir_v * 0.5 + vel * 0.5;
                            self.stir_p = w1;
                            self.stir_k = 1.0;
                        }
                    }
                }
            }
            _ => {
                if !self.ptr.down { return; }
                let was_drag = self.ptr.dragging;
                let dur = self.real - self.ptr.t0;
                self.ptr.down = false; self.ptr.dragging = false;
                self.tilt_target = 0.0;
                if kind == 2 && !was_drag && dur < 0.45 { self.tap(x, y); }
            }
        }
    }

    pub fn key(&mut self, code: u32, down: bool) {
        match code {
            1 | 2 => {
                if self.mode == Mode::Watch { return; }
                let dir = if code == 1 { -1.0 } else { 1.0 };
                self.tilt_target = if down { dir * 0.5 } else { 0.0 };
            }
            3 if self.story_on => if down && self.story_hold {
                let (fx, fy) = crate::story::DEFAULT_POS[self.story_beat.min(crate::story::N_BEATS - 1)];
                let (x, y) = (self.lay.sx + self.lay.sw * fx, self.lay.sy + self.lay.sh * fy);
                self.answer(x, y);
            },
            3 => if down {
                let jx = self.rng.sym() * 0.3;
                let (x, y) = if self.mode == Mode::Sandbox { self.to_screen(V2::new(jx, -0.5)) } else { (self.lay.cx, self.lay.cy) };
                self.tap(x, y);
            },
            4..=9 => if down { self.tool((code - 4) as usize); },
            10 => if down { let (x, y) = (self.lay.cx, self.lay.cy); self.view_zoom(1.5, x, y); },
            11 => if down { let (x, y) = (self.lay.cx, self.lay.cy); self.view_zoom(1.0 / 1.5, x, y); },
            12 => if down { self.view_auto(); },
            _ => {}
        }
    }

    fn tap(&mut self, x: f32, y: f32) {
        if !self.started || self.paused || self.finished || self.over { return; }
        let w = self.to_world(x, y);
        // a tap on the bubble's wall pokes it
        if crate::vessel::on(self) && self.mode != Mode::Watch && !self.upgrade_armed {
            let d = w.len();
            let inner = if self.mode == Mode::Sandbox { 0.98 } else { 0.88 };
            if d > self.ring_r * inner && d < self.ring_r * 1.16 { self.poke(w); return; }
        }
        if self.upgrade_armed {
            if let Some(i) = self.pick(w) { self.upgrade_body(i); return; }
            self.upgrade_armed = false;
            self.ev(EV_TOOLS, 0.0, 0.0, 0.0, 0.0);
            return;
        }
        match self.mode {
            Mode::Watch => {}
            Mode::Sandbox => {
                if w.len() < self.ring_r * 0.97 {
                    let t = self.sandbox_tier.min(GOD - 1);
                    let r = self.radius_for(t);
                    let p = if w.len() > self.ring_r - r { w.norm() * (self.ring_r - r) } else { w };
                    if self.new_body(t, p, V2::new(0.0, 0.2)).is_some() {
                        self.burst(p, tier(t).color, 10, 0.6);
                        self.sound(S_DROP, 0.7, p.x);
                    }
                }
            }
            _ => { if self.tap_cd <= 0.0 && self.spawn_from_spout(true) { self.tap_cd = 0.1; } }
        }
    }

    /// Poke the membrane at `w`: it wobbles, and whatever is near the spot gets pushed inward.
    fn poke(&mut self, w: V2) {
        if self.poke_cd > 0.0 { return; }
        self.poke_cd = 0.12;
        let dir = w.norm();
        let at = dir * self.ring_r;
        for b in self.bodies.iter_mut() {
            if !b.alive || b.dying > 0.0 || b.tier == GOD { continue; }
            let d = (b.p - at).len();
            let reach = 0.5 + b.r;
            if d < reach { b.v += -dir * (2.2 * (1.0 - d / reach) / (1.0 + b.r * 4.0)); }
        }
        self.ring_wob = self.ring_wob.max(0.85);
        self.wave(at, 0.18, 0xFFFFFF);
        let rate = 0.9 + 0.2 * self.rng.f();
        self.sound_rate(S_POKE, 0.7, clamp(dir.x, -1.0, 1.0) * 0.6, rate);
        self.haptic(15.0);
    }

    fn pick(&self, w: V2) -> Option<usize> {
        let mut best = None; let mut bd = f32::MAX;
        for (i, b) in self.bodies.iter().enumerate() {
            if !b.alive || b.dying > 0.0 || b.tier >= GOD - 1 { continue; }
            let d = (b.p - w).len() - b.r;
            if d < 0.05 && d < bd { bd = d; best = Some(i); }
        }
        best
    }

    pub fn tool(&mut self, i: usize) {
        if i >= N_TOOLS || !self.started || self.finished || self.over || self.paused { return; }
        if self.mode == Mode::Watch { return; }
        let t = &mut self.tools[i];
        let info = &TOOLS[i];
        if i == Tool::Upgrade as usize {
            if t.charges == 0 { return; }
            self.upgrade_armed = !self.upgrade_armed;
            self.ev(EV_TOOLS, 0.0, 0.0, 0.0, 0.0);
            self.sound(S_CLICK, 0.6, 0.0);
            return;
        }
        if t.cd > 0.0 && self.mode != Mode::Sandbox { return; }
        t.cd = if self.mode == Mode::Sandbox { 0.6 } else { info.cooldown };
        t.active = info.duration;
        match i {
            0 => {
                for b in self.bodies.iter_mut() {
                    if !b.alive { continue; }
                    let k = 2.6 / (1.0 + b.r * 4.0);
                    b.v += V2::new(self.rng.sym() * k, -self.rng.range(0.7, 1.5) * k);
                }
                self.shake = self.shake.max(0.5);
                self.ring_wob = self.ring_wob.max(0.8);
                self.sound(S_SHAKE, 0.9, 0.0);
                self.haptic(40.0);
            }
            1 => { self.sound(S_MAGNET, 0.8, 0.0); }
            2 => self.bomb(),
            3 => { self.sound(S_SLOWMO, 0.8, 0.0); }
            4 => { self.sound(S_FLIP, 0.8, 0.0); self.shake = self.shake.max(0.3); }
            _ => {}
        }
        self.ev(EV_TOOLS, 0.0, 0.0, 0.0, 0.0);
    }

    fn bomb(&mut self) {
        let mut low = 255u8;
        for b in &self.bodies { if b.alive && b.dying <= 0.0 && b.tier < low && b.p.y > self.join_y() { low = b.tier; } }
        if low == 255 { return; }
        let mut pts = Vec::new();
        for b in self.bodies.iter_mut() {
            if b.alive && b.dying <= 0.0 && b.tier == low { b.dying = 0.35; pts.push((b.p, b.r)); }
        }
        for (p, r) in pts.iter() {
            self.burst(*p, 0xFFAA33, 24, 1.4);
            self.smoke(*p, 6, 0x8A8A8A, *r * 2.0);
            self.wave(*p, *r * 2.5, 0xFFDD88);
            for b in self.bodies.iter_mut() {
                if !b.alive || b.dying > 0.0 { continue; }
                let d = b.p - *p; let l = d.len();
                if l < 0.7 && l > 1e-4 { b.v += d * (1.8 * (0.7 - l) / (l * (1.0 + b.r * 3.0))); }
            }
        }
        self.shake = self.shake.max(0.9);
        self.add_flash(0xFFC060, 0.35);
        self.sound(S_BOMB, 1.0, 0.0);
        self.haptic(80.0);
    }

    fn upgrade_body(&mut self, i: usize) {
        let t = self.bodies[i].tier;
        if t + 1 >= GOD { return; }
        self.tools[Tool::Upgrade as usize].charges -= 1;
        self.upgrade_armed = false;
        let p = self.bodies[i].p;
        self.bodies[i].tier = t + 1;
        self.bodies[i].pop = 1.0;
        self.bodies[i].flash = 1.0;
        self.burst(p, 0xFFE27A, 26, 1.1);
        self.wave(p, 0.4, 0xFFF0B0);
        self.sound(S_UPGRADE, 0.9, p.x);
        self.on_new_tier(t + 1, p);
        self.ev(EV_TOOLS, 0.0, 0.0, 0.0, 0.0);
    }

    // ───────────────────────────────────────────── spawning
    /// Where the funnel's ball forms, just under the spout.
    pub fn funnel_p(&self) -> V2 { V2::new(0.0, self.lay.chute_top + 0.16) }

    fn poured(&mut self, t: u8) {
        self.run_drops += 1; self.stats.drops += 1;
        self.babies += libm_pow64(2.0, t as f64);
    }

    fn spawn_from_spout(&mut self, manual: bool) -> bool {
        if self.mode == Mode::Sandbox || self.finished || self.over { return false; }
        let mut t = self.spout;
        let chaos = self.mode == Mode::Chaos;
        if chaos && self.rng.chance(0.22) && t + 1 < GOD { t += 1; }
        let r = self.radius_for(t);
        // chaos portals: sometimes the ride appears inside the ring
        if chaos && !manual && self.rng.chance(0.3) {
            for _ in 0..6 {
                let a = self.rng.range(-PI * 0.85, -PI * 0.15);
                let d = self.rng.range(0.25, 0.65) * self.ring_r;
                let p = V2::new(cos(a) * d, sin(a) * d);
                if self.free_at(p, r * 1.05) && self.new_body(t, p, V2::new(0.0, 0.0)).is_some() {
                    self.portal_fx(p, r);
                    self.poured(t);
                    return true;
                }
            }
        }
        if self.mode == Mode::Mega && !manual && self.rng.chance(0.6) && self.rain() { return true; }
        let room = (CHUTE_W - r).max(0.0);
        let jitter = self.rng.sym() * room * 0.6;
        let f = self.funnel_p();
        let p = V2::new(jitter, f.y);
        if !self.free_at(p, r * 1.02) { return false; }
        let vx = self.rng.sym() * 0.15;
        if self.new_body(t, p, V2::new(vx, 0.6)).is_some() {
            self.poured(t);
            if t > 0 {
                // the babies clump into this ball in the funnel
                let c = tier(t).color;
                self.sparkle(p, 5, c);
                let rate = 0.9 + 0.2 * self.rng.f();
                if self.drop_snd_cd <= 0.0 { self.sound_rate(S_FUNNEL, 0.22, 0.0, rate); self.drop_snd_cd = 0.12; }
            } else if self.drop_snd_cd <= 0.0 { self.sound(S_DROP, 0.3, 0.0); self.drop_snd_cd = 0.09; }
            return true;
        }
        false
    }

    fn free_at(&self, p: V2, r: f32) -> bool {
        for b in &self.bodies {
            if !b.alive { continue; }
            let d = b.p - p;
            let m = b.r + r;
            if d.len2() < m * m { return false; }
        }
        true
    }

    // ───────────────────────────────────────────── frame
    pub fn frame(&mut self, real_dt: f32) {
        let real_dt = clamp(real_dt, 0.0, 0.1);
        self.real += real_dt;
        // hit-stop: the world almost freezes for a beat, then eases back
        if self.hitstop > 0.0 {
            self.hitstop -= real_dt;
            self.ts = 0.06;
        } else {
            self.ts += (1.0 - self.ts) * approach(real_dt, 0.16);
        }
        let mut speed = self.opts.get(Opt::Speed);
        if self.tools[Tool::SlowMo as usize].active > 0.0 { speed *= 0.25; }
        if self.finished { speed = speed.min(1.0) * if self.god_t < 2.2 { 0.35 + 0.65 * smooth(self.god_t / 2.2) } else { 1.0 }; }
        speed *= self.ts;
        if self.paused || !self.started { speed = 0.0; }
        let dt = real_dt * speed;
        let live = !self.paused && self.started;
        self.tap_cd -= dt;
        self.drop_snd_cd -= real_dt;
        self.pop_cd -= real_dt;
        self.sold_cd -= real_dt;
        self.voice_busy -= real_dt;
        self.note_cd -= real_dt;
        self.boing_cd -= real_dt;
        if live { self.stats.played += real_dt; }
        // presentation (real time, frozen while paused)
        let pdt = if live { real_dt } else { 0.0 };
        self.shake = (self.shake - pdt * 1.8).max(0.0);
        self.flash = (self.flash - pdt * 1.6).max(0.0);
        self.ring_pulse = (self.ring_pulse - pdt * 1.3).max(0.0);
        self.ring_wob = (self.ring_wob - pdt * 1.6).max(0.0);
        self.banner_t -= pdt;
        self.era_t -= pdt;
        self.sl_t -= pdt;
        self.combo_show -= pdt;
        self.toast_t -= pdt;
        self.cat_mix = (self.cat_mix + pdt * 0.45).min(1.0);
        self.hue += pdt * (0.08 + 0.3 * self.ring_pulse);
        // the world rushes past on a new era, then settles
        self.warp += self.warp_v * pdt;
        self.warp_v *= exp(-pdt * 2.2);
        if self.burst_t >= 0.0 { self.burst_t += pdt; }
        self.poke_cd -= real_dt;
        self.stir_k = (self.stir_k - pdt * 3.0).max(0.0);
        // camera spring
        if pdt > 0.0 {
            let sub = 4;
            let h = pdt / sub as f32;
            for _ in 0..sub {
                let a = -70.0 * self.cam_k - 13.0 * self.cam_v;
                self.cam_v += a * h;
                self.cam_k += self.cam_v * h;
            }
            self.cam_k = clamp(self.cam_k, -0.05, 0.16);
        }
        let mut dead = Vec::new();
        for (k, b) in self.bolts.iter_mut().enumerate() { b.t -= pdt; if b.t <= 0.0 { dead.push(k); } }
        for k in dead.into_iter().rev() { self.bolts.swap_remove(k); }
        if self.dirty_save > 0.0 { self.dirty_save -= real_dt; if self.dirty_save <= 0.0 { self.ev(EV_SAVE, 0.0, 0.0, 0.0, 0.0); } }
        // the Genesis ending runs on the narration's clock (or real time without sound),
        // and holds its breath at each moment of creation until the player answers
        if self.story_on { self.story_clock(real_dt, live); }
        if dt > 0.0 && !self.story_on {
            // the same rules at every simulation speed: step in slices of at most 1/60 s
            let dt = dt.min(16.0 / 60.0);
            let chunks = ceil(dt * 60.0 - 1e-4).max(1.0) as usize;
            let h = dt / chunks as f32;
            for _ in 0..chunks { self.step(h); }
        }
        self.emit_note();
        self.update_parts(pdt, dt);
        crate::render::build(self);
    }

    fn step(&mut self, dt: f32) {
        if !self.finished && !self.over { self.time += dt; }
        // tools
        for (i, t) in self.tools.iter_mut().enumerate() {
            if i == Tool::Upgrade as usize {
                if t.charges < 3 {
                    t.cd -= dt;
                    if t.cd <= 0.0 { t.charges += 1; t.cd = TOOLS[i].cooldown; }
                } else { t.cd = TOOLS[i].cooldown; }
                continue;
            }
            if t.cd > 0.0 { t.cd = (t.cd - dt).max(0.0); }
            if t.active > 0.0 { t.active = (t.active - dt).max(0.0); }
        }
        self.combo_t -= dt;
        // tilt
        let mut target = self.tilt_target;
        if self.opts.on(Opt::DeviceTilt) && !self.ptr.dragging { target = self.device_tilt; }
        if (self.opts.on(Opt::AutoTilt) || self.mode == Mode::Watch) && !self.ptr.dragging {
            target += 0.2 * sin(self.time * 0.85) + 0.08 * sin(self.time * 2.3 + 1.0);
        }
        self.tilt += (target - self.tilt) * approach(dt, 0.12);
        // time attack
        if self.mode == Mode::TimeAttack && !self.finished && !self.over {
            self.ta_left -= dt;
            if self.ta_left <= 0.0 { self.ta_left = 0.0; self.end_time_attack(); }
        }
        self.update_events(dt);
        // the follow camera tracks the biggest ball
        let mut best: Option<(u8, V2)> = None;
        for b in &self.bodies { if b.alive && b.dying <= 0.0 && best.map_or(true, |(t, _)| b.tier > t) { best = Some((b.tier, b.p)); } }
        if let Some((_, p)) = best { self.follow_p += (p - self.follow_p) * approach(dt, 0.6); }
        // the camera pulls back from the first babies as the pile grows
        let intro_target = if self.run_max >= 4 || self.time > 45.0 { 0.0 } else { 1.0 - self.run_max as f32 / 4.5 };
        self.intro_k += (intro_target - self.intro_k) * approach(dt, 1.6);
        // spout
        if !self.finished && !self.over && self.mode != Mode::Sandbox {
            self.update_fill();
            let mut interval = self.drop_base / self.opts.get(Opt::DropRate);
            // the very first babies come one at a time
            interval *= 1.0 + 1.3 * (1.0 - smooth(self.run_drops as f32 / 30.0));
            if self.ev_burst > 0 { interval = interval.min(0.06); }
            if self.mode == Mode::Chaos { interval *= 0.55; }
            if self.mode == Mode::Mega { interval *= 0.5; }
            if self.fill > 0.56 { interval *= 1.0 + (self.fill - 0.56) * 9.0; }
            self.drop_t -= dt;
            if self.drop_t <= 0.0 {
                if self.fill < 0.72 && self.spawn_from_spout(false) {
                    self.drop_t = interval;
                    if self.ev_burst > 0 { self.ev_burst -= 1; }
                } else { self.drop_t = if self.ev_burst > 0 { 0.04 } else { 0.1 }; }
            }
            self.form = clamp(1.0 - self.drop_t / interval.max(1e-3), 0.0, 1.0);
            self.form_tier = self.spout;
            self.spout_cd -= dt;
            self.check_spout();
            self.check_jam(dt);
        }
        // a finger stirring the fluid drags what's near it along
        if self.stir_k > 0.0 {
            let (sp, sv, k) = (self.stir_p, self.stir_v, self.stir_k);
            for b in self.bodies.iter_mut() {
                if !b.alive || b.dying > 0.0 || b.tier == GOD { continue; }
                let l = (b.p - sp).len();
                let reach = 0.26 + b.r;
                if l > reach { continue; }
                let f = (1.0 - l / reach) * k;
                b.v += (sv - b.v) * clamp(f * 7.0 * dt / (1.0 + b.r * 5.0), 0.0, 0.5);
            }
        }
        // magnet (once per frame)
        self.magnet();
        if self.finished { self.god_sequence(dt); }
        // physics substeps
        let n = clamp(ceil(dt * SUB_HZ), 1.0, 48.0) as usize;
        let h = dt / n as f32;
        for _ in 0..n { self.substep(h); }
        // the zoom follows the funnel: everything in the vessel scales around its bottom
        let spout = self.spout;
        let target = if self.mode == Mode::Sandbox { spout as f32 - SANDBOX_LIFT } else { spout as f32 };
        let old = self.base;
        if !self.finished { self.base += (target - self.base) * approach(dt, 0.9); }
        let db = self.base - old;
        if abs(db) > 1e-7 { self.zoom_world(db); }
        // per-body bookkeeping
        let mut dissolve: Vec<usize> = Vec::new();
        let mut tier_count = [0u8; N_TIERS];
        for b in &self.bodies { if b.alive && b.dying <= 0.0 { tier_count[b.tier as usize] = tier_count[b.tier as usize].saturating_add(1); } }
        let sandbox = self.mode == Mode::Sandbox;
        for i in 0..self.bodies.len() {
            let target_r = if self.finished && self.bodies[i].tier == GOD { 0.62 * self.ring_r.min(1.0) } else { self.radius_for(self.bodies[i].tier) };
            let b = &mut self.bodies[i];
            if !b.alive { continue; }
            b.age += dt;
            b.pop = (b.pop - dt * 2.4).max(0.0);
            b.flash = (b.flash - dt * 2.2).max(0.0);
            b.hl = (b.hl - dt * 2.0).max(0.0);
            b.squash *= exp(-dt * 11.0);
            let k = if b.pop > 0.0 { approach(dt, 0.06) } else { approach(dt, 0.25) };
            b.r += (target_r - b.r) * k;
            b.angle += b.spin * dt;
            b.spin += (b.v.x / b.r.max(0.03) * 0.5 - b.spin) * approach(dt, 0.3);
            if b.v.len2() < 0.04 { b.rest_t += dt; } else { b.rest_t = (b.rest_t - dt * 2.0).max(0.0); }
            b.trail = [b.p, b.trail[0], b.trail[1], b.trail[2]];
            if b.dying > 0.0 {
                b.dying -= dt;
                if b.dying <= 0.0 { b.alive = false; dissolve.push(i); }
                continue;
            }
            if b.tier < spout && !sandbox && !self.finished {
                b.orphan_t += dt;
                let alone = tier_count[b.tier as usize] < 2;
                if (alone && b.orphan_t > self.orphan_alone) || b.orphan_t > self.orphan_max { b.dying = 0.45; }
                // zoomed out so far it's dust now
                if b.r < DUST_R { b.dying = 0.3; }
            } else { b.orphan_t = 0.0; }
        }
        for i in dissolve {
            let (p, c) = (self.bodies[i].p, tier(self.bodies[i].tier).color);
            if !self.finished {
                self.coins(p, 2);
                if self.sold_cd <= 0.0 { self.sound(S_SOLD, 0.4, p.x); self.sold_cd = 0.3; }
            } else {
                self.burst(p, c, 10, 0.8);
            }
        }
        let before = self.bodies.len();
        self.bodies.retain(|b| b.alive);
        if self.bodies.len() != before || self.order.len() != self.bodies.len() {
            self.order.clear();
            for i in 0..self.bodies.len() { self.order.push(i as u16); }
        }
    }

    /// The world zoomed by `db` tiers: scale everything in the vessel around the
    /// point things settle on, like a camera pulling back (or pushing in).
    fn zoom_world(&mut self, db: f32) {
        let f = pow(self.grow(), -db);
        let jy = self.join_y();
        let a = if self.mode == Mode::BlackHole { V2::default() } else { V2::new(0.0, self.ring_r).rot(-self.tilt) };
        let sc = |p: V2| a + (p - a) * f;
        for b in self.bodies.iter_mut() {
            if !b.alive { continue; }
            b.r *= f;
            if b.p.y < jy && abs(b.p.x) < CHUTE_W + b.r { continue; } // still in the funnel
            b.p = sc(b.p);
            b.v = b.v * f;
            for k in 0..4 { b.trail[k] = sc(b.trail[k]); }
        }
        for q in self.parts.iter_mut() {
            q.p = sc(q.p); q.v = q.v * f;
            if matches!(q.kind, 2 | 7 | 9 | 10) { q.size *= f; }
        }
        for bo in self.bolts.iter_mut() { bo.a = sc(bo.a); bo.b = sc(bo.b); }
        self.combo_p = sc(self.combo_p);
        self.sl_p = sc(self.sl_p);
        self.cam_f = sc(self.cam_f);
        if self.view_manual { self.view_pan = sc(self.view_pan); self.clamp_view(); }
    }

    fn update_events(&mut self, dt: f32) {
        if self.ev_left > 0.0 {
            self.ev_left -= dt;
            if self.ev_kind == EV_QUAKE && self.rng.chance(dt * 6.0) {
                for b in self.bodies.iter_mut() {
                    if !b.alive { continue; }
                    let k = 1.4 / (1.0 + b.r * 4.0);
                    b.v += V2::new(self.rng.sym() * k, -self.rng.range(0.3, 1.0) * k);
                }
                self.shake = self.shake.max(0.45);
                self.ring_wob = self.ring_wob.max(0.9);
            }
            if self.ev_left <= 0.0 { self.ev_kind = EV_NONE; }
        }
        let on = self.opts.on(Opt::Events) && matches!(self.mode, Mode::Classic | Mode::Watch | Mode::Mega | Mode::Chaos | Mode::Trampoline);
        if !on || self.finished || self.over { return; }
        self.ev_next -= dt;
        if self.ev_next > 0.0 { return; }
        self.ev_next = self.rng.range(24.0, 40.0);
        let kind = 1 + self.rng.below(5) as u8;
        self.ev_kind = kind;
        self.ev_dir = if self.rng.chance(0.5) { 1.0 } else { -1.0 };
        match kind {
            EV_RUSH => { self.ev_burst = 14; self.ev_left = 1.5; }
            EV_QUAKE => { self.ev_left = 2.2; }
            EV_WIND => { self.ev_left = 3.0; }
            EV_ZEROG => { self.ev_left = 3.0; }
            _ => { self.ev_left = 3.5; }
        }
        let (he, en, col) = EVENTS[kind as usize];
        self.toast = (he, en); self.toast_t = 2.2; self.toast_col = col;
        self.ring_pulse = 1.0;
        self.sound(match kind { EV_QUAKE => S_SHAKE, EV_STORM => S_MAGNET, EV_ZEROG => S_SLOWMO, EV_WIND => S_WHOOSH, _ => S_SPOUT }, 0.8, 0.0);
    }

    /// Mega mode: rides also rain in from the top of the ring.
    fn rain(&mut self) -> bool {
        let t = self.spout;
        let r = self.radius_for(t);
        for _ in 0..4 {
            let a = self.rng.range(-PI * 0.9, -PI * 0.1);
            let d = self.rng.range(0.55, 0.92) * (self.ring_r - r);
            let p = V2::new(cos(a) * d, sin(a) * d);
            let vx = self.rng.sym() * 0.5;
            if self.free_at(p, r * 1.05) && self.new_body(t, p, V2::new(vx, 0.6)).is_some() {
                self.poured(t);
                self.wave(p, r * 1.6, tier(t).color);
                return true;
            }
        }
        false
    }

    fn update_fill(&mut self) {
        let mut a = 0.0; let jy = self.join_y();
        let mut blocked = false;
        for b in &self.bodies {
            if !b.alive { continue; }
            if b.p.y > jy { a += b.r * b.r; }
            else if b.v.len2() < 0.05 && b.age > 0.6 { blocked = true; }
        }
        self.fill = a / (self.ring_r * self.ring_r);
        self.blocked = blocked;
    }

    fn check_jam(&mut self, dt: f32) {
        if self.blocked && self.fill > 0.6 { self.jam_t += dt; } else { self.jam_t = (self.jam_t - dt * 2.0).max(0.0); }
        if self.jam_t > 1.6 && self.jam_t - dt <= 1.6 { self.sound(S_JAM, 0.7, 0.0); }
        if self.opts.on(Opt::HardMode) && self.mode != Mode::Watch && self.jam_t > 3.5 {
            self.over = true;
            self.ev(EV_GAMEOVER, 0.0, self.run_max as f32, self.time, 0.0);
            self.add_flash(0xFF3030, 0.5);
            self.sound(S_TIMEUP, 1.0, 0.0);
            return;
        }
        // soft rescue: stir the pot when things stay jammed
        let auto = self.mode == Mode::Watch || !self.opts.on(Opt::HardMode);
        if auto && self.jam_t > 2.6 {
            self.jam_t = 0.0;
            for b in self.bodies.iter_mut() {
                if !b.alive { continue; }
                b.v += V2::new(self.rng.sym() * 1.3, -self.rng.range(0.5, 1.4)) * (1.0 / (1.0 + b.r * 3.0));
            }
            self.shake = self.shake.max(0.25);
            self.ring_wob = self.ring_wob.max(0.6);
        }
    }

    fn check_spout(&mut self) {
        if self.spout_cd > 0.0 || self.mode == Mode::Sandbox { return; }
        let mut maxp = 0u8;
        for b in &self.bodies { if b.alive && b.dying <= 0.0 && b.tier > maxp { maxp = b.tier; } }
        // the very first babies get one extra tier of room before they start clumping
        let gap = self.gap() + if self.spout == 0 { 1 } else { 0 };
        if maxp >= self.spout + gap && self.spout + 1 + self.gap() <= GOD {
            self.spout += 1;
            self.spout_cd = 0.6;
            // the funnel now clumps twice as many babies, and the camera pulls back
            self.sound(S_ZOOM, 0.32, 0.0);
            let p = self.funnel_p();
            self.burst(p, tier(self.spout).color, 8, 0.4);
        }
    }

    fn magnet(&mut self) {
        let assist = self.opts.get(Opt::Magnet);
        let tool = self.tools[Tool::Magnet as usize].active > 0.0 || (self.ev_kind == EV_STORM && self.ev_left > 0.0);
        let assist = if self.mode == Mode::Mega { assist * 0.5 } else { assist };
        let k_base = assist * 0.55 + if tool { 3.2 } else { 0.0 } + if self.mode == Mode::Watch { 0.6 } else { 0.0 };
        let jy = self.join_y();
        for b in self.bodies.iter_mut() { b.acc = V2::default(); }
        if k_base <= 0.0 && self.spout == 0 { return; }
        // group by tier so only twins are compared
        let n = self.bodies.len();
        self.by_tier.clear();
        for i in 0..n { self.by_tier.push(i as u16); }
        let bodies = &self.bodies;
        self.by_tier.sort_unstable_by_key(|&i| bodies[i as usize].tier);
        let mut s = 0;
        while s < n {
            let t = self.bodies[self.by_tier[s] as usize].tier;
            let mut e = s + 1;
            while e < n && self.bodies[self.by_tier[e] as usize].tier == t { e += 1; }
            if t != GOD && e - s >= 2 {
                for a in s..e {
                    let i = self.by_tier[a] as usize;
                    let (pi, ri, oi, resti, ok_i) = { let b = &self.bodies[i]; (b.p, b.r, b.orphan_t, b.rest_t, b.alive && b.dying <= 0.0 && b.p.y >= jy) };
                    if !ok_i { continue; }
                    for c in (a + 1)..e {
                        let j = self.by_tier[c] as usize;
                        let bj = &self.bodies[j];
                        if !bj.alive || bj.dying > 0.0 || bj.p.y < jy { continue; }
                        let d = bj.p - pi; let l = d.len();
                        let reach = 0.5 + ri * 3.0 + if tool { 0.8 } else { 0.0 };
                        if l > reach || l < 1e-4 { continue; }
                        let orphan = oi > 0.0 || bj.orphan_t > 0.0;
                        let rest = clamp((resti + bj.rest_t) * 0.25, 0.0, 1.5);
                        let mut k = k_base * (1.0 + rest);
                        if orphan { k += 2.5; }
                        if k <= 0.0 { continue; }
                        let f = d * (k * (1.0 - l / reach) / l);
                        let mi = ri * ri; let mj = bj.r * bj.r; let ss = mi + mj;
                        let ai = f * (mj / ss); let aj = f * (-mi / ss);
                        self.bodies[i].acc += ai;
                        self.bodies[j].acc += aj;
                    }
                }
            }
            s = e;
        }
    }

    fn substep(&mut self, h: f32) {
        let tramp = self.mode == Mode::Trampoline;
        let e = if tramp { 0.96 } else { self.opts.get(Opt::Bounce) };
        let jy = self.join_y();
        let spin = self.opts.get(Opt::RingSpin) * 1.6;
        let rr = self.ring_r;
        let n = self.bodies.len();
        // integrate
        for i in 0..n {
            let (p, alive, dying) = { let b = &self.bodies[i]; (b.p, b.alive, b.dying) };
            if !alive { continue; }
            let in_chute = p.y < jy && abs(p.x) < CHUTE_W;
            let is_god = self.finished && self.bodies[i].tier == GOD;
            let g = if is_god { V2::default() } else { self.gravity(p, in_chute) };
            let b = &mut self.bodies[i];
            b.merged = false;
            let mut a = g + b.acc;
            if dying > 0.0 { a = a * 0.3; }
            b.v += a * h;
            b.v = b.v * (1.0 - 0.025 * h);
            let sp2 = b.v.len2();
            if sp2 > 81.0 { b.v = b.v * (9.0 / sqrt(sp2)); }
            b.p += b.v * h;
        }
        // broad phase: sweep along x (insertion sort keeps the nearly-sorted order cheap)
        if self.order.len() != n { self.order.clear(); for i in 0..n { self.order.push(i as u16); } }
        for a in 1..n {
            let mut j = a;
            while j > 0 {
                let (x0, x1) = { let b0 = &self.bodies[self.order[j - 1] as usize]; let b1 = &self.bodies[self.order[j] as usize]; (b0.p.x - b0.r, b1.p.x - b1.r) };
                if x0 <= x1 { break; }
                self.order.swap(j - 1, j);
                j -= 1;
            }
        }
        let mut merges: Vec<(usize, usize)> = Vec::new();
        let mut hit_v = 0.0f32; let mut hit_x = 0.0f32;
        // Mega keeps every ball around a little longer, so the ring stays packed
        let age_min = self.merge_age * if self.mode == Mode::Mega { 1.85 } else { 1.0 };
        for a in 0..n {
            let i = self.order[a] as usize;
            if !self.bodies[i].alive { continue; }
            let right = self.bodies[i].p.x + self.bodies[i].r;
            for c in (a + 1)..n {
                let j = self.order[c] as usize;
                if self.bodies[j].p.x - self.bodies[j].r > right { break; }
                if !self.bodies[j].alive { continue; }
                let (pi, pj, ri, rj) = (self.bodies[i].p, self.bodies[j].p, self.bodies[i].r, self.bodies[j].r);
                let d = pj - pi;
                let min = ri + rj;
                let l2 = d.len2();
                if l2 >= min * min { continue; }
                let l = sqrt(l2).max(1e-6);
                let nrm = d * (1.0 / l);
                let (ti, tj) = (self.bodies[i].tier, self.bodies[j].tier);
                let can_merge = ti == tj && ti != GOD && !self.finished && self.bodies[i].dying <= 0.0 && self.bodies[j].dying <= 0.0
                    && !self.bodies[i].merged && !self.bodies[j].merged && self.bodies[i].age > age_min && self.bodies[j].age > age_min;
                if can_merge {
                    self.bodies[i].merged = true; self.bodies[j].merged = true;
                    merges.push((i, j));
                    continue;
                }
                let wi = 1.0 / (ri * ri); let wj = 1.0 / (rj * rj); let ws = wi + wj;
                let pen = min - l;
                let corr = nrm * (pen * 0.8);
                self.bodies[i].p -= corr * (wi / ws);
                self.bodies[j].p += corr * (wj / ws);
                let rv = self.bodies[j].v - self.bodies[i].v;
                let vn = rv.dot(nrm);
                if vn < 0.0 {
                    // bouncy unless it's a resting contact
                    let ee = if -vn > 0.09 { e } else { 0.0 };
                    let jn = -(1.0 + ee) * vn / ws;
                    let imp = nrm * jn;
                    let t = V2::new(-nrm.y, nrm.x);
                    let vt = rv.dot(t);
                    let jt = clamp(-vt / ws * 0.1, -abs(jn) * 0.4, abs(jn) * 0.4);
                    let impt = t * jt;
                    self.bodies[i].v -= (imp + impt) * wi;
                    self.bodies[j].v += (imp + impt) * wj;
                    if -vn > 0.5 {
                        let s = clamp(-vn * 0.045, 0.0, 0.22);
                        let ang = atan2(nrm.y, nrm.x);
                        for &k in &[i, j] { let b = &mut self.bodies[k]; if s > b.squash { b.squash = s; b.squash_a = ang; } }
                        if -vn > hit_v { hit_v = -vn; hit_x = (pi.x + pj.x) * 0.5; }
                    }
                }
            }
        }
        // boundaries
        let corners = [V2::new(-CHUTE_W, jy), V2::new(CHUTE_W, jy)];
        let chute_top = self.lay.chute_top;
        for b in self.bodies.iter_mut() {
            if !b.alive { continue; }
            let r = b.r;
            if b.p.y < jy {
                if r < CHUTE_W {
                    if b.p.x - r < -CHUTE_W { b.p.x = -CHUTE_W + r; if b.v.x < 0.0 { b.v.x = -b.v.x * e * 0.5; } }
                    if b.p.x + r > CHUTE_W { b.p.x = CHUTE_W - r; if b.v.x > 0.0 { b.v.x = -b.v.x * e * 0.5; } }
                } else if abs(b.p.x) < CHUTE_W + r {
                    b.p.y = jy + 0.001; if b.v.y < 0.0 { b.v.y = 0.0; }
                }
                if b.p.y - r < chute_top - 0.4 { b.p.y = chute_top - 0.4 + r; if b.v.y < 0.0 { b.v.y = 0.0; } }
            }
            // ring arc (the gap above is open)
            let d = b.p.len();
            if d > 1e-5 {
                let u = b.p * (1.0 / d);
                let in_gap = u.y < 0.0 && abs(u.x * rr) < CHUTE_W;
                let lim = rr - r;
                if !in_gap && d > lim {
                    b.p = u * lim;
                    let vn = b.v.dot(u);
                    if vn > 0.0 {
                        let ee = if vn > 0.12 { e } else { 0.0 };
                        b.v -= u * ((1.0 + ee) * vn);
                        if tramp && vn > 0.25 {
                            // the trampoline wall kicks back
                            let out = -b.v.dot(u);
                            if out < 1.7 { b.v -= u * (1.7 - out); }
                        }
                        if vn > 0.45 {
                            let s = clamp(vn * 0.06, 0.0, 0.3);
                            if s > b.squash { b.squash = s; b.squash_a = atan2(u.y, u.x); }
                            if vn > hit_v { hit_v = vn; hit_x = b.p.x; }
                        }
                    }
                    let t = V2::new(-u.y, u.x);
                    let vt = b.v.dot(t);
                    let wall = spin * rr;
                    let fr = if spin != 0.0 { 0.25 } else { 0.03 };
                    b.v += t * ((wall - vt) * fr);
                }
            }
            for c in corners.iter() {
                let dd = b.p - *c; let l = dd.len();
                if l < r && l > 1e-6 {
                    let nrm = dd * (1.0 / l);
                    b.p = *c + nrm * r;
                    let vn = b.v.dot(nrm);
                    if vn < 0.0 { b.v -= nrm * ((1.0 + e * 0.6) * vn); }
                }
            }
        }
        if hit_v > self.note_req { self.note_req = hit_v; self.note_x = hit_x; }
        // merges
        for (i, j) in merges {
            if !self.bodies[i].alive || !self.bodies[j].alive { continue; }
            self.merge(i, j);
        }
    }

    /// One note of the era's tune per hard bounce (rate-limited).
    fn emit_note(&mut self) {
        let v = self.note_req;
        self.note_req = 0.0;
        if v < 1.0 || self.note_cd > 0.0 || !self.started || self.paused { return; }
        if self.opts.on(Opt::Notes) {
            let era = self.cat;
            let midi = crate::audio::music::melody_note(era, self.note_i);
            self.note_i = self.note_i.wrapping_add(1);
            let gain = clamp(0.25 + (v - 1.0) * 0.25, 0.25, 0.9);
            let pan = clamp(self.note_x / self.ring_r, -1.0, 1.0) * 0.6;
            self.ev(EV_NOTE, crate::audio::music::note_timbre(era) as f32, midi, gain, pan);
            self.note_cd = 0.085;
        } else if v > 2.2 && self.boing_cd <= 0.0 {
            self.sound(S_BOING, 0.25, 0.0);
            self.boing_cd = 0.25;
        }
    }

    fn merge(&mut self, i: usize, j: usize) {
        let (a, b) = (self.bodies[i], self.bodies[j]);
        let ma = a.r * a.r; let mb = b.r * b.r;
        let p = (a.p * ma + b.p * mb) * (1.0 / (ma + mb));
        let mut v = (a.v * ma + b.v * mb) * (0.5 / (ma + mb));
        self.bodies[i].alive = false;
        self.bodies[j].alive = false;
        let t = a.tier + 1;
        let lvl = t as f32 / GOD as f32;
        let start_r = a.r.max(b.r);
        // the new ride jumps out of the merge
        if t != GOD { v += V2::new(self.rng.sym() * 0.4, -(0.9 + 0.9 * lvl)); }
        // a chain reaction continues when a freshly merged ball merges again
        // a cascade: a ball made by a merge lands on a twin that was already
        // waiting, right after its cooldown — each step of that climbs the chain
        let window = self.merge_age * if self.mode == Mode::Mega { 1.85 } else { 1.0 } + 0.35;
        let fresh = |x: &Body| x.chain > 0 && x.age < window;
        let chain = match (fresh(&a), fresh(&b)) {
            (true, false) => a.chain + 1,
            (false, true) => b.chain + 1,
            (true, true) => a.chain.max(b.chain),
            _ => 1,
        };
        if let Some(k) = self.new_body_ex(t, p, v, true) {
            let nb = &mut self.bodies[k];
            nb.r = start_r * 1.02;
            nb.pop = 1.0;
            nb.flash = 1.0;
            nb.merged = true;
            nb.angle = a.angle;
            nb.chain = chain;
        }
        // shove the neighbours away
        let reach = (a.r + b.r) * 3.2;
        let push = 1.1 + 1.2 * lvl;
        for q in self.bodies.iter_mut() {
            if !q.alive || q.merged || q.dying > 0.0 { continue; }
            let d = q.p - p; let l = d.len();
            if l < reach && l > 1e-4 {
                q.v += d * (push * (1.0 - l / reach) / (l * (1.0 + q.r * 4.0)));
            }
        }
        self.run_merges += 1;
        self.stats.merges += 1;
        // chain-reaction combos
        if self.opts.on(Opt::Combo) && chain >= 2 {
            let n = chain as u32;
            self.combo_n = n;
            if n > self.stats.best_combo { self.stats.best_combo = n; }
            if n >= self.combo_shown || self.combo_show <= 0.0 {
                self.combo_show = 1.3;
                self.combo_shown = n;
                self.combo_p = p;
            }
            let rate = 1.0 + 0.09 * (n.min(16) as f32);
            self.sound_rate(S_COMBO, 0.55, clamp(p.x / self.ring_r, -1.0, 1.0) * 0.3, rate);
            if n >= 3 {
                let m = n.min(8) as f32;
                self.ring_pulse = self.ring_pulse.max(0.6 + 0.05 * m);
                self.add_flash(0xFFE27A, 0.05 * m);
                self.shake = self.shake.max(0.08 * m);
                self.wave(p, (a.r + b.r) * (1.2 + 0.15 * m), 0xFFE27A);
            }
        }
        self.merge_fx(t, p, start_r);
        self.on_new_tier(t, p);
    }

    fn merge_fx(&mut self, t: u8, p: V2, r: f32) {
        let tt = tier(t);
        let lvl = t as f32 / GOD as f32;
        let parts = self.opts.get(Opt::Particles);
        let n = ((8.0 + 46.0 * lvl) * parts) as usize;
        self.burst(p, tt.color, n, 0.6 + 1.4 * lvl);
        self.wave(p, r * (1.5 + 1.0 * lvl), tt.color);
        // two cells fuse: droplets of membrane splash out and settle
        if crate::vessel::on(self) { self.goo(p, r, (3.0 + 4.0 * parts) as usize, tt.color); }
        match tt.cat {
            Cat::Foot => self.confetti(p, (6.0 * parts) as usize, true),
            Cat::Rides => self.smoke(p, (3.0 * parts) as usize + 1, 0xC8A878, r * 1.3),
            Cat::Motors | Cat::Cars | Cat::Monsters | Cat::Workers => self.smoke(p, (3.0 * parts) as usize + 1, 0x9A9AA6, r * 1.4),
            Cat::Premium | Cat::Super | Cat::Hyper => { self.coins(p, (1.0 + 2.0 * parts) as usize); }
            Cat::Rails => self.smoke(p, (4.0 * parts) as usize + 1, 0xF2F2F2, r * 1.6),
            Cat::Seas | Cat::Sails => self.droplets(p, (10.0 * parts) as usize, 0x7FD8FF),
            Cat::Skies => self.smoke(p, (4.0 * parts) as usize + 1, 0xFFFFFF, r * 1.8),
            Cat::Space | Cat::SciFi | Cat::Mega => self.sparkle(p, (8.0 * parts) as usize, tt.color),
            Cat::Myth | Cat::Wonders | Cat::Heavens | Cat::God => { self.flames(p, (6.0 + 18.0 * lvl) as usize, tt.color); self.sparkle(p, (6.0 * parts) as usize, 0xFFF2C8); }
        }
        if !self.run_seen.has(t) { self.wave(p, r * (2.4 + 1.6 * lvl), 0xFFFFFF); }
        if self.opts.on(Opt::ScreenShake) { self.shake = self.shake.max(0.06 + 0.7 * lvl * lvl); }
        if t >= 6 && !self.run_seen.has(t) { self.add_flash(tt.color, 0.08 + 0.3 * lvl * lvl); }
        self.ring_pulse = self.ring_pulse.max(0.25 + 0.6 * lvl);
        self.ring_wob = self.ring_wob.max(0.15 + 0.5 * lvl);
        self.ring_col = tt.color;
        if matches!(tt.cat, Cat::Myth | Cat::Wonders | Cat::Heavens) && self.drama() > 0.0 && self.bolts.len() < 6 {
            // lightning from the ring to the merge
            let a = self.rng.range(0.0, TAU);
            let from = V2::new(cos(a), sin(a)) * self.ring_r;
            self.bolts.push(Bolt { a: from, b: p, t: 0.35, max: 0.35, col: tt.color, seed: self.rng.next_u32() });
        }
        // sound: the tier's OMG, unless a bigger one is still ringing
        let busy = self.voice_busy > 0.0 && (t as i32) < self.voice_tier;
        let low_spam = t <= 6 && self.pop_cd > 0.0;
        if !busy && !low_spam {
            self.sound(t as u32, 1.0, clamp(p.x / self.ring_r, -1.0, 1.0) * 0.4);
            self.voice_busy = voice_len(t);
            self.voice_tier = t as i32;
            self.stats.omgs += 1;
            if t > 8 { self.ev(EV_DUCK, t as f32, 0.0, 0.0, 0.0); }
            self.pop_cd = 0.16;
        } else if self.pop_cd <= 0.0 {
            let rate = 0.8 + 0.6 * self.rng.f();
            self.sound_rate(S_POP, 0.45, p.x, rate);
            self.pop_cd = 0.05;
        }
        self.haptic(if t > 80 { 60.0 } else if t > 30 { 30.0 } else { 12.0 });
    }

    fn on_new_tier(&mut self, t: u8, p: V2) {
        let first_in_run = !self.run_seen.has(t);
        self.run_seen.set(t);
        if t > self.run_max { self.run_max = t; }
        let first_ever = !self.unlocked.has(t);
        if first_ever {
            self.unlocked.set(t);
            self.ev(EV_UNLOCK, t as f32, 0.0, 0.0, 0.0);
            self.dirty_save = 0.3;
        }
        if t > self.stats.top_tier { self.stats.top_tier = t; }
        if first_in_run && t > 0 {
            let lvl = t as f32 / GOD as f32;
            let dr = self.drama();
            self.banner_tier = t as i32;
            self.banner_t = if t == GOD { 9.0 } else { 2.4 };
            self.banner_new = first_ever;
            self.ev(EV_BANNER, t as f32, 0.0, 0.0, 0.0);
            let c = cat_of(t);
            let new_era = c != self.cat;
            if dr > 0.0 {
                // slow-motion beat + camera punch + speed lines
                let sp = self.opts.get(Opt::Speed).max(1.0);
                let mut hs = (0.12 + 0.2 * lvl) * if dr > 1.5 { 1.5 } else { 1.0 };
                if new_era { hs = 0.5 * if dr > 1.5 { 1.4 } else { 1.0 }; }
                if t == GOD { hs = 0.9; }
                self.hitstop = self.hitstop.max(hs / sqrt(sp));
                let kick = (0.9 + 0.9 * lvl) * if dr > 1.5 { 1.35 } else { 1.0 } * if new_era { 1.4 } else { 1.0 } / sqrt(sp);
                if self.cam_k < 0.02 { self.cam_f = p; }
                self.cam_v = self.cam_v.max(kick);
                self.sl_t = 0.6; self.sl_p = p; self.sl_col = tier(t).color;
                self.sound(S_HIT, 0.55 + 0.4 * lvl, clamp(p.x / self.ring_r, -1.0, 1.0) * 0.3);
            }
            if new_era {
                self.prev_cat = self.cat;
                self.cat = c;
                self.cat_mix = 0.0;
                self.era_card = c;
                self.era_t = if dr > 0.0 && t != GOD { 2.6 } else { 0.0 };
                self.add_flash(CATS[c as usize].accent, 0.45);
                self.ring_pulse = 1.0;
                // the camera rushes back into the new world
                if dr > 0.0 && t != GOD { self.warp_v = self.warp_v.max(0.55 * if dr > 1.5 { 1.4 } else { 1.0 }); self.ring_wob = self.ring_wob.max(1.0); }
                if t != GOD { self.sound(S_ERA, 0.9, 0.0); }
                self.ev(EV_CATEGORY, c as f32, 0.0, 0.0, 0.0);
                self.ev(EV_MUSIC, c as f32, 0.0, 0.0, 0.0);
                self.shockwave(p, tier(t).color);
            }
        }
        if t == GOD && !self.finished {
            self.finished = true;
            self.god_t = 0.0;
            self.god_id = self.next_id - 1;
            self.stats.gods += 1;
            let m = self.mode as usize;
            if self.mode != Mode::Sandbox && self.mode != Mode::TimeAttack && (self.stats.best[m] <= 0.0 || self.time < self.stats.best[m]) {
                self.stats.best[m] = self.time;
            }
            self.add_flash(0xFFFFFF, 1.0);
            self.shake = 1.2;
            self.dirty_save = 0.2;
        }
    }

    /// Testing: carry the run to tier `t` (fresh balls of the tiers just below it).
    pub fn debug_jump(&mut self, t: u8) {
        if !self.started || self.finished { return; }
        self.bodies.clear(); self.order.clear();
        let gap = self.gap();
        self.spout = t.saturating_sub(gap);
        self.base = self.spout as f32;
        for k in self.spout..=t { self.run_seen.set(k); self.unlocked.set(k); }
        self.run_max = t;
        self.cat = cat_of(t); self.prev_cat = self.cat; self.cat_mix = 1.0;
        self.intro_k = 0.0;
        self.time += 3.0 * t as f32;
        for (i, k) in (self.spout..=t).rev().enumerate() {
            let r = self.radius_for(k);
            let x = if i % 2 == 0 { -0.3 } else { 0.3 } * (1.0 - r);
            let _ = self.new_body_ex(k, V2::new(x * (i as f32 * 0.3 + 0.2).min(1.0), 0.9 - r - i as f32 * 0.05), V2::default(), true);
        }
        self.ev(EV_MUSIC, self.cat as f32, 0.0, 0.0, 0.0);
    }
    /// Testing: two of the last tier meet and God is born.
    pub fn debug_god(&mut self) {
        if !self.started || self.finished { return; }
        self.debug_jump(GOD - 1);
        let r = self.radius_for(GOD - 1);
        let a = self.new_body_ex(GOD - 1, V2::new(-r * 1.02, 0.95 - r * 2.2), V2::default(), true);
        let b = self.new_body_ex(GOD - 1, V2::new(r * 1.02, 0.95 - r * 2.2), V2::default(), true);
        if let (Some(i), Some(j)) = (a, b) { self.bodies[i].age = 5.0; self.bodies[j].age = 5.0; self.merge(i, j); }
    }
    /// Testing: skip straight to the Genesis story.
    pub fn debug_story(&mut self, at: f32) {
        self.finished = true;
        self.god_t = STORY_AT + 1.0;
        self.burst_t = 1.0;
        self.begin_story(at);
    }

    /// The simulation stops and God begins to tell (at story second `at`; moments
    /// before it count as already created where the story would have put them).
    pub fn begin_story(&mut self, at: f32) {
        self.story_on = true;
        self.story_t = at.max(0.0);
        self.story_ext = -1.0;
        self.story_end_sent = false;
        self.story_he = self.lang_he;
        self.story_hold = false;
        self.story_wait = 0.0;
        self.story_pos = crate::story::DEFAULT_POS;
        let bt = crate::story::beat_times(crate::story::track(self.story_he));
        self.story_beat = bt.iter().position(|&b| b - crate::story::LEAD > self.story_t).unwrap_or(crate::story::N_BEATS);
        self.story_ptr_down = false;
        self.story_marks.clear();
        self.story_fx.clear();
        self.story_shake = 0.0;
        self.story_notes = 0;
        self.bodies.clear(); self.order.clear(); self.parts.clear(); self.bolts.clear();
        self.ev(EV_STORY, 1.0, if self.lang_he { 1.0 } else { 0.0 }, self.story_t, 0.0);
        self.ev(EV_MUSIC, -1.0, 0.0, 0.0, 0.0);
    }

    fn story_clock(&mut self, real_dt: f32, live: bool) {
        use crate::story::*;
        let tr = track(self.story_he);
        let bt = beat_times(tr);
        if self.story_hold {
            if live { self.story_wait += real_dt; }
            let k = self.story_beat.min(N_BEATS - 1);
            if KINDS[k] == G_HOLD && self.story_ptr_down && self.real - self.story_ptr_t0 >= HOLD_S {
                let (x, y) = (self.story_ptr_x, self.story_ptr_y);
                self.answer(x, y);
            } else if self.story_wait > if self.mode == Mode::Watch { 2.5 } else { TIMEOUT } {
                // creation goes on by itself
                let (fx, fy) = DEFAULT_POS[k];
                let (x, y) = (self.lay.sx + self.lay.sw * fx, self.lay.sy + self.lay.sh * fy);
                self.answer(x, y);
            }
        } else {
            let t_new = if self.story_ext >= 0.0 { self.story_ext } else if live { self.story_t + real_dt } else { self.story_t };
            if self.story_beat < N_BEATS && t_new >= bt[self.story_beat] - LEAD {
                self.story_t = bt[self.story_beat] - LEAD;
                self.story_hold = true;
                self.story_wait = 0.0;
                self.ev(EV_STORY, 2.0, self.story_t, 0.0, 0.0);
            } else {
                self.story_t = t_new;
            }
        }
        if self.story_t >= len(self.story_he) && !self.story_end_sent { self.end_story(); }
        // sparks of creation
        let dt = if live { real_dt } else { 0.0 };
        for p in self.story_fx.iter_mut() {
            p.life -= dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= 1.0 - clamp(1.8 * dt, 0.0, 0.9); p.vy = p.vy * (1.0 - clamp(1.8 * dt, 0.0, 0.9)) + 20.0 * dt;
        }
        self.story_fx.retain(|p| p.life > 0.0);
        self.story_shake = (self.story_shake - dt * 1.6).max(0.0);
        self.story_touch_cd -= real_dt;
    }

    /// The player answered the moment of creation the story was waiting for (screen point).
    pub fn answer(&mut self, x: f32, y: f32) {
        use crate::story::*;
        if !self.story_hold || self.story_beat >= N_BEATS { return; }
        let k = self.story_beat;
        let lay = self.lay;
        let fx = clamp((x - lay.sx) / lay.sw.max(1.0), 0.04, 0.96);
        let fy = clamp((y - lay.sy) / lay.sh.max(1.0), 0.04, 0.96);
        self.story_pos[k] = (fx, fy);
        self.story_hold = false;
        self.story_beat += 1;
        self.story_ptr_down = false;
        self.ev(EV_STORY, 3.0, self.story_t, 0.0, 0.0);
        // a burst of light where it happened
        let col = [0xFFF4D8u32, 0xBFE4FF, 0xC8E6A0, 0xFFE27A, 0x9FE8FF, 0xF2C488, 0xFFD9C2, 0xFFE2A2][k];
        let u = lay.u;
        self.story_fx.push(Spark { x, y, vx: 0.0, vy: 0.0, life: 0.9, max: 0.9, size: lay.sw * 0.9, col: 0xFFFFFF, ring: true });
        self.story_fx.push(Spark { x, y, vx: 0.0, vy: 0.0, life: 1.2, max: 1.2, size: lay.sw * 0.6, col, ring: true });
        for _ in 0..46 {
            let a = self.rng.range(0.0, TAU); let sp = self.rng.range(60.0, 420.0) * u;
            let life = self.rng.range(0.6, 1.5);
            let c = if self.rng.chance(0.4) { 0xFFFFFF } else { col };
            self.story_fx.push(Spark { x, y, vx: cos(a) * sp, vy: sin(a) * sp, life, max: life, size: self.rng.range(2.0, 5.0) * u, col: c, ring: false });
        }
        self.story_shake = 0.6;
        let pan = clamp((fx - 0.5) * 1.6, -0.8, 0.8);
        self.sound(S_CREATE, 0.5, pan);
        self.haptic(40.0);
    }

    /// Touches during the story: answer the moment it waits for, or create freely.
    pub fn story_pointer(&mut self, kind: u32, x: f32, y: f32) {
        use crate::story::*;
        let u = self.lay.u;
        match kind {
            0 => {
                self.story_ptr_down = true;
                self.story_ptr_x = x; self.story_ptr_y = y; self.story_ptr_x0 = x; self.story_ptr_y0 = y;
                self.story_ptr_t0 = self.real;
                if self.story_hold {
                    if KINDS[self.story_beat.min(N_BEATS - 1)] == G_TAP { self.answer(x, y); }
                } else {
                    self.create_at(x, y);
                }
            }
            1 => {
                if !self.story_ptr_down { return; }
                self.story_ptr_x = x; self.story_ptr_y = y;
                if self.story_hold && KINDS[self.story_beat.min(N_BEATS - 1)] == G_SWIPE && self.story_ptr_y0 - y > 40.0 * u {
                    let (x0, y0) = (self.story_ptr_x0, self.story_ptr_y0);
                    self.answer(x0, y0);
                }
            }
            _ => {
                if !self.story_ptr_down { return; }
                self.story_ptr_down = false;
                // a plain tap answers a swipe too: nobody should get stuck
                if self.story_hold && KINDS[self.story_beat.min(N_BEATS - 1)] == G_SWIPE && kind == 2 {
                    let (x0, y0) = (self.story_ptr_x0, self.story_ptr_y0);
                    self.answer(x0, y0);
                }
            }
        }
    }

    /// Free creation: a touch makes a tree, a star, a fish, a bird or a beast, by the day.
    fn create_at(&mut self, x: f32, y: f32) {
        use crate::story::*;
        if self.story_touch_cd > 0.0 { return; }
        let lay = self.lay;
        let fx = clamp((x - lay.sx) / lay.sw.max(1.0), 0.02, 0.98);
        let fy = clamp((y - lay.sy) / lay.sh.max(1.0), 0.02, 0.98);
        let Some(kind) = touch_kind(self.story_he, self.story_t, fy, self.story_notes) else { return; };
        self.story_touch_cd = 0.12;
        let seed = self.rng.next_u32();
        if self.story_marks.len() >= 60 { self.story_marks.remove(0); }
        self.story_marks.push(Mark { kind, x: fx, y: fy, t: self.story_t, seed });
        let u = lay.u;
        for _ in 0..12 {
            let a = self.rng.range(0.0, TAU); let sp = self.rng.range(30.0, 160.0) * u;
            let life = self.rng.range(0.4, 0.9);
            self.story_fx.push(Spark { x, y, vx: cos(a) * sp, vy: sin(a) * sp, life, max: life, size: self.rng.range(1.5, 3.5) * u, col: 0xFFF4D8, ring: false });
        }
        self.story_fx.push(Spark { x, y, vx: 0.0, vy: 0.0, life: 0.6, max: 0.6, size: 60.0 * u, col: 0xFFF4D8, ring: true });
        // each touch plays the next note of a rising tune in D
        const SCALE: [f32; 12] = [62.0, 64.0, 66.0, 69.0, 71.0, 74.0, 76.0, 78.0, 81.0, 83.0, 86.0, 88.0];
        let n = self.story_notes as usize;
        let midi = SCALE[(n % 12).min(11)] - if (n / 12) % 2 == 1 { 12.0 } else { 0.0 };
        let timbre = if kind == K_STAR || kind == K_LIGHT { 4.0 } else { 2.0 };
        self.ev(EV_NOTE, timbre, midi, 0.55, clamp((fx - 0.5) * 1.6, -0.8, 0.8));
        self.story_notes += 1;
        self.haptic(10.0);
    }

    /// The story is over (or skipped): show the ending screen.
    pub fn end_story(&mut self) {
        if self.story_end_sent { return; }
        self.story_end_sent = true;
        self.story_hold = false;
        self.story_t = self.story_t.max(crate::story::len(self.story_he));
        self.ev(EV_STORY, 0.0, 0.0, 0.0, 0.0);
        self.ev(EV_END, self.time, self.run_merges as f32, self.run_drops as f32, self.mode as u32 as f32);
    }

    fn end_time_attack(&mut self) {
        self.over = true;
        if self.run_max > self.stats.best_tier_ta { self.stats.best_tier_ta = self.run_max; }
        self.ev(EV_GAMEOVER, 1.0, self.run_max as f32, self.time, 0.0);
        self.sound(S_TIMEUP, 1.0, 0.0);
        self.dirty_save = 0.2;
    }

    fn god_sequence(&mut self, dt: f32) {
        let before = self.god_t;
        self.god_t += dt;
        let gt = self.god_t;
        let mut god_p = V2::default();
        for b in &self.bodies { if b.alive && b.tier == GOD { god_p = b.p; } }
        for b in self.bodies.iter_mut() {
            if !b.alive { continue; }
            if b.tier == GOD {
                b.acc = (V2::default() - b.p) * 9.0 - b.v * 6.0;
                continue;
            }
            if b.dying > 0.0 { continue; }
            let d = god_p - b.p;
            b.acc = d.norm() * (3.0 + gt * 3.0);
            if gt > 1.2 + (b.id % 17) as f32 * 0.09 { b.dying = 0.6; }
        }
        if before < 0.05 && gt >= 0.05 { self.ring_pulse = 1.0; }
        if before < 3.6 && gt >= 3.6 { self.sound(S_IAM, 1.0, 0.0); }
        // the bubble strains around the light, then bursts
        if gt > 2.6 && self.burst_t < 0.0 { self.ring_pulse = self.ring_pulse.max(smooth((gt - 2.6) / 2.4)); }
        if before < BURST_AT && gt >= BURST_AT && self.burst_t < 0.0 && crate::vessel::on(self) {
            self.burst_t = 0.0;
            let n = 64;
            for k in 0..n {
                let a = k as f32 / n as f32 * TAU + self.rng.sym() * 0.05;
                let d = V2::new(cos(a), sin(a));
                let life = self.rng.range(0.9, 1.8);
                let col = if k % 3 == 0 { 0xFFFFFF } else { 0xFFF0C8 };
                self.parts.push(Particle { kind: 10, p: d * self.ring_r, v: d * self.rng.range(1.2, 3.4), life, max: life, size: self.rng.range(0.012, 0.04), color: col, drag: 1.1, grav: 0.4, angle: self.rng.range(0.0, TAU), spin: 0.0 });
            }
            for k in 0..40 {
                let a = k as f32 / 40.0 * TAU;
                let d = V2::new(cos(a), sin(a));
                self.parts.push(Particle { kind: 1, p: d * self.ring_r, v: d * self.rng.range(3.0, 6.0), life: 0.5, max: 0.5, size: 2.5, color: 0xFFFFFF, drag: 1.5, grav: 0.0, angle: 0.0, spin: 0.0 });
            }
            self.parts.push(Particle { kind: 9, p: V2::default(), v: V2::default(), life: 1.0, max: 1.0, size: self.ring_r * 2.6, color: 0xFFF4D8, drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0 });
            self.add_flash(0xFFFFFF, 1.0);
            self.shake = self.shake.max(1.3);
            self.hitstop = self.hitstop.max(0.25);
            self.sound(S_BURST, 1.0, 0.0);
            self.haptic(120.0);
        }
        // the simulation stops, the light fills everything, and God tells the story
        if before < STORY_AT && gt >= STORY_AT && !self.story_on { self.begin_story(0.0); }
        if gt < 4.0 && self.rng.chance(0.6) {
            let a = self.rng.range(0.0, TAU);
            let rr = self.ring_r * self.rng.range(0.8, 1.6);
            let p = V2::new(cos(a) * rr, sin(a) * rr);
            self.parts.push(Particle { kind: 1, p, v: (god_p - p) * 1.6, life: 0.6, max: 0.6, size: 2.0, color: 0xFFF2C8, drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0 });
        }
    }

    // ───────────────────────────────────────────── particles
    pub fn add_flash(&mut self, col: u32, a: f32) {
        let k = self.opts.get(Opt::Flashes);
        if k <= 0.0 { return; }
        if a * k > self.flash { self.flash = a * k; self.flash_col = col; }
    }
    fn cap(&self) -> usize { (2200.0 * clamp(self.opts.get(Opt::Particles), 0.3, 2.0) / 1.8) as usize }
    fn push_part(&mut self, q: Particle) { if self.parts.len() < self.cap() { self.parts.push(q); } }
    pub fn burst(&mut self, p: V2, col: u32, n: usize, power: f32) {
        // mostly soft glowing spores; a few sharp streaks for the punch
        let soft = crate::vessel::on(self);
        for k in 0..n {
            let a = self.rng.range(0.0, TAU);
            let s = self.rng.range(0.3, 1.0) * power * 1.6;
            let streak = if soft { k % 4 == 0 } else { k % 3 != 0 };
            let white = self.rng.chance(0.25);
            let life = self.rng.range(0.35, 0.9) * (0.7 + power * 0.3);
            let size = self.rng.range(1.2, 3.2) * (0.8 + power * 0.25);
            self.push_part(Particle {
                kind: if streak { 1 } else { 0 }, p, v: V2::new(cos(a) * s, sin(a) * s), life, max: life,
                size, color: if white { 0xFFFFFF } else { col }, drag: 2.2, grav: 1.2, angle: 0.0, spin: 0.0,
            });
        }
    }
    pub fn wave(&mut self, p: V2, r: f32, col: u32) {
        self.push_part(Particle { kind: 2, p, v: V2::default(), life: 0.55, max: 0.55, size: r, color: col, drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0 });
    }
    fn shockwave(&mut self, p: V2, col: u32) {
        self.push_part(Particle { kind: 9, p, v: V2::default(), life: 0.75, max: 0.75, size: self.ring_r * 1.5, color: col, drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0 });
        self.push_part(Particle { kind: 9, p, v: V2::default(), life: 0.6, max: 0.6, size: self.ring_r * 1.0, color: 0xFFFFFF, drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0 });
    }
    fn flames(&mut self, p: V2, n: usize, col: u32) {
        for _ in 0..n {
            let life = self.rng.range(0.5, 1.2);
            let q = Particle { kind: 4, p: p + V2::new(self.rng.sym() * 0.1, self.rng.sym() * 0.05), v: V2::new(self.rng.sym() * 0.3, -self.rng.range(0.4, 1.3)), life, max: life, size: self.rng.range(3.0, 7.0), color: col, drag: 1.0, grav: -0.6, angle: 0.0, spin: 0.0 };
            self.push_part(q);
        }
    }
    fn coins(&mut self, p: V2, n: usize) {
        for _ in 0..n {
            let life = self.rng.range(0.6, 1.0);
            let q = Particle { kind: 3, p, v: V2::new(self.rng.sym() * 0.8, -self.rng.range(0.7, 1.6)), life, max: life, size: self.rng.range(3.5, 6.0), color: 0xFFD54F, drag: 0.6, grav: 3.2, angle: self.rng.range(0.0, TAU), spin: self.rng.range(-12.0, 12.0) };
            self.push_part(q);
        }
    }
    fn confetti(&mut self, p: V2, n: usize, pastel: bool) {
        const PAL: [u32; 6] = [0xFF7AA8, 0xFFD45A, 0x7AE0FF, 0x9DFF8A, 0xC59CFF, 0xFFFFFF];
        for _ in 0..n {
            let life = self.rng.range(0.8, 1.4);
            let c = PAL[self.rng.below(6) as usize];
            let q = Particle { kind: 6, p, v: V2::new(self.rng.sym() * 1.1, -self.rng.range(0.8, 1.8)), life, max: life, size: self.rng.range(3.0, 5.5), color: if pastel { c } else { 0xFFD54F }, drag: 1.4, grav: 2.0, angle: self.rng.range(0.0, TAU), spin: self.rng.range(-14.0, 14.0) };
            self.push_part(q);
        }
    }
    fn smoke(&mut self, p: V2, n: usize, col: u32, r: f32) {
        for _ in 0..n {
            let life = self.rng.range(0.7, 1.3);
            let a = self.rng.range(0.0, TAU);
            let q = Particle { kind: 7, p: p + V2::new(cos(a), sin(a)) * (r * 0.4), v: V2::new(cos(a) * 0.25, sin(a) * 0.25 - 0.15), life, max: life, size: r * self.rng.range(0.6, 1.1), color: col, drag: 1.5, grav: -0.15, angle: 0.0, spin: 0.0 };
            self.push_part(q);
        }
    }
    fn droplets(&mut self, p: V2, n: usize, col: u32) {
        for _ in 0..n {
            let life = self.rng.range(0.5, 0.9);
            let q = Particle { kind: 8, p, v: V2::new(self.rng.sym() * 1.2, -self.rng.range(0.8, 2.0)), life, max: life, size: self.rng.range(2.0, 3.6), color: col, drag: 0.4, grav: 4.0, angle: 0.0, spin: 0.0 };
            self.push_part(q);
        }
    }
    fn sparkle(&mut self, p: V2, n: usize, col: u32) {
        for _ in 0..n {
            let life = self.rng.range(0.5, 1.1);
            let a = self.rng.range(0.0, TAU); let s = self.rng.range(0.4, 1.4);
            let q = Particle { kind: 0, p, v: V2::new(cos(a) * s, sin(a) * s), life, max: life, size: self.rng.range(1.5, 3.0), color: col, drag: 1.8, grav: 0.0, angle: 0.0, spin: 0.0 };
            self.push_part(q);
        }
    }
    /// Droplets of membrane thrown out by a fusion.
    fn goo(&mut self, p: V2, r: f32, n: usize, col: u32) {
        for _ in 0..n {
            let a = self.rng.range(0.0, TAU);
            let s = self.rng.range(0.4, 1.3) * (0.5 + r * 2.0);
            let life = self.rng.range(0.45, 0.9);
            let q = Particle { kind: 10, p: p + V2::new(cos(a), sin(a)) * (r * 0.8), v: V2::new(cos(a) * s, sin(a) * s - 0.3), life, max: life, size: r * self.rng.range(0.1, 0.22), color: col, drag: 2.4, grav: 1.6, angle: self.rng.range(0.0, TAU), spin: 0.0 };
            self.push_part(q);
        }
    }
    fn portal_fx(&mut self, p: V2, r: f32) {
        self.wave(p, r * 2.2, 0xFF52DC);
        self.wave(p, r * 1.4, 0x14E8FF);
        self.burst(p, 0x14E8FF, 12, 0.6);
    }

    fn update_parts(&mut self, real_dt: f32, dt: f32) {
        let pdt = if self.paused { 0.0 } else { real_dt.min(dt.max(real_dt * 0.25)) };
        for q in self.parts.iter_mut() {
            q.life -= pdt;
            q.v = q.v * (1.0 - clamp(q.drag * pdt, 0.0, 0.9));
            q.v.y += q.grav * pdt;
            q.p += q.v * pdt;
            q.angle += q.spin * pdt;
        }
        self.parts.retain(|q| q.life > 0.0);
        for s in self.stars.iter_mut() { s.life += real_dt * s.max; }
    }

    pub fn voice_playing(&self) -> bool { self.voice_busy > 0.0 }
}

/// Rough length of each tier's sound (seconds) — used to keep small OMGs from
/// talking over big ones.
pub fn voice_len(t: u8) -> f32 {
    if t == GOD { return 11.0; }
    match tier(t).cat {
        Cat::Foot => 0.6, Cat::Rides => 0.8, Cat::Motors => 0.9, Cat::Cars => 1.1, Cat::Premium => 1.3, Cat::Super => 1.5, Cat::Hyper => 1.8,
        Cat::Workers => 1.9, Cat::Monsters => 2.0, Cat::Rails => 2.1, Cat::Sails => 2.1, Cat::Seas => 2.2, Cat::Skies => 2.3, Cat::Space => 2.7,
        Cat::SciFi => 2.9, Cat::Mega => 3.2, Cat::Myth => 3.5, Cat::Wonders => 4.2, Cat::Heavens => 4.8, Cat::God => 11.0,
    }
}

#[cfg(test)]
mod sim {
    use super::*;
    #[allow(dead_code)]
    pub struct R { pub god: bool, pub time: f32, pub top: u8, pub max_b: usize, pub frames: u32, pub jams: u32, pub avg_b: f32 }
    pub fn run(mode: Mode, gap: f32, speed: f32, max_game_s: f32, seed: u32, verbose: bool) -> R {
        let mut g = Game::new(seed);
        g.resize(390.0, 844.0, 3.0);
        g.opts.set(Opt::Gap as usize, gap);
        g.opts.set(Opt::Speed as usize, speed);
        g.opts.set(Opt::Drama as usize, 0.0);
        g.start(mode);
        let mut max_b = 0usize; let mut sum_b = 0usize;
        let mut last = g.run_max;
        let mut frames = 0u32;
        let mut jams = 0u32;
        while g.time < max_game_s && !(g.finished && g.god_t > 8.0) && !g.over {
            g.frame(1.0 / 60.0);
            g.events.clear();
            frames += 1;
            let alive = g.bodies.iter().filter(|b| b.alive).count();
            sum_b += alive;
            if alive > max_b { max_b = alive; }
            for b in &g.bodies {
                assert!(b.p.x.is_finite() && b.p.y.is_finite() && b.v.x.is_finite() && b.r.is_finite(), "NaN body");
                if b.p.y > g.join_y() { assert!(b.p.len() < g.ring_r + 0.05, "escaped ring: {:?} r={}", b.p, b.r); }
            }
            if g.jam_t > 2.5 { jams += 1; }
            if g.run_max != last {
                last = g.run_max;
                if verbose && (last % 8 == 0 || last > GOD - 3) { println!("  t={:7.1}s tier {:3} {:30} spout {:3} bodies {:3} fill {:.2}", g.time, last + 1, tier(last).en, g.spout, alive, g.fill); }
            }
            assert!(frames < 4_000_000);
        }
        R { god: g.finished, time: g.time, top: g.run_max, max_b, frames, jams, avg_b: sum_b as f32 / frames.max(1) as f32 }
    }

    #[test]
    #[ignore]
    fn tune() {
        let env = |k: &str, d: f32| std::env::var(k).ok().and_then(|v| v.parse().ok()).unwrap_or(d);
        let mode = Mode::from(env("OMG_MODE", 0.0) as u32);
        let mut g = Game::new(env("OMG_SEED", 1.0) as u32);
        g.resize(390.0, 844.0, 3.0);
        g.opts.set(Opt::Gap as usize, env("OMG_GAP", 4.0));
        g.opts.set(Opt::DropRate as usize, env("OMG_DR", 1.0));
        g.opts.set(Opt::Magnet as usize, env("OMG_MAG", 1.0));
        g.opts.set(Opt::Bounce as usize, env("OMG_E", 0.8));
        g.opts.set(Opt::Speed as usize, 8.0);
        g.opts.set(Opt::Drama as usize, 0.0);
        g.merge_age = env("OMG_AGE", g.merge_age);
        g.drop_base = env("OMG_DB", g.drop_base);
        g.orphan_alone = env("OMG_OA", g.orphan_alone);
        g.orphan_max = env("OMG_OM", g.orphan_max);
        g.start(mode);
        let (mut sum, mut frames, mut maxb) = (0usize, 0usize, 0usize);
        let mut marks = Vec::new();
        while g.time < 3600.0 && !(g.finished && g.god_t > 1.0) && !g.over {
            g.frame(1.0 / 60.0); g.events.clear(); frames += 1;
            let n = g.bodies.len(); sum += n; maxb = maxb.max(n);
            if marks.len() < 6 && g.run_max as usize >= (marks.len() + 1) * 20 { marks.push((g.run_max, g.time, n, g.fill)); }
        }
        println!("age {} db {} | mode {:?} gap {} dr {} mag {} e {}: god={} t={:.0}s avg_bodies={:.1} max={} drops={} | {:?}", g.merge_age, g.drop_base, mode as u8, g.gap(), g.opts.get(Opt::DropRate), g.opts.get(Opt::Magnet), g.opts.get(Opt::Bounce), g.finished, g.time, sum as f32 / frames as f32, maxb, g.run_drops, marks.iter().map(|m| (m.0, m.1 as i32, m.2, (m.3 * 100.0) as i32)).collect::<Vec<_>>());
    }

    #[test]
    fn classic_reaches_god() {
        for seed in [1u32, 2] {
            let r = run(Mode::Classic, 3.0, 8.0, 7200.0, seed, seed == 1);
            println!("classic seed {seed}: god={} time={:.0}s top={} max_bodies={} avg_bodies={:.0} jams={}", r.god, r.time, r.top + 1, r.max_b, r.avg_b, r.jams);
            assert!(r.god, "did not reach God");
        }
    }

    #[test]
    fn other_modes_progress() {
        for (m, name) in [(Mode::Watch, "watch"), (Mode::Chaos, "chaos"), (Mode::Mega, "mega"), (Mode::Trampoline, "trampoline"), (Mode::BlackHole, "blackhole")] {
            let r = run(m, 3.0, 8.0, 7200.0, 7, false);
            println!("{name}: god={} time={:.0}s top={} max_bodies={} avg_bodies={:.0} jams={}", r.god, r.time, r.top + 1, r.max_b, r.avg_b, r.jams);
            assert!(r.god, "{name} did not reach God");
        }
    }

    #[test]
    fn short_and_epic() {
        for gap in [2.0f32, 5.0] {
            let r = run(Mode::Classic, gap, 8.0, 14400.0, 11, false);
            println!("gap {gap}: god={} time={:.0}s top={} max_bodies={} avg_bodies={:.0}", r.god, r.time, r.top + 1, r.max_b, r.avg_b);
            assert!(r.god);
        }
    }

    #[test]
    fn runs_start_at_the_bottom() {
        let mut g = Game::new(3);
        g.resize(390.0, 844.0, 2.0);
        g.unlocked = Mask::all();
        g.start(Mode::Classic);
        assert_eq!(g.spout, 0);
        for _ in 0..240 { g.frame(1.0 / 60.0); g.events.clear(); }
        // four seconds in: nothing but crawling babies, poured one at a time, no zoom yet
        assert!(!g.bodies.is_empty());
        assert_eq!(g.spout, 0);
        assert!(g.bodies.iter().all(|b| b.tier <= 2));
        assert_eq!(g.babies, g.run_drops as f64);
        assert!(g.run_drops <= 12, "pours slowly at the start ({} drops)", g.run_drops);
        assert!(g.intro_k > 0.5, "the camera starts close on the babies");
    }

    #[test]
    fn sizes_are_absolute() {
        let mut g = Game::new(3);
        g.resize(390.0, 844.0, 2.0);
        let idx = |k: &str| TIERS.iter().position(|t| t.key == k).unwrap() as u8;
        let (shuttle, sandals) = (idx("shuttle"), idx("talaria"));
        for base in [0.0f32, 40.0, 90.0, 140.0] {
            g.base = base;
            for t in 0..GOD { assert!(g.radius_for(t + 1) >= g.radius_for(t), "base {base} tier {t}"); }
        }
        // the zoom never changes how two tiers compare
        g.base = 98.0;
        let k1 = g.radius_for(shuttle + 1) / g.radius_for(shuttle);
        g.base = 97.0;
        let k2 = g.radius_for(shuttle + 1) / g.radius_for(shuttle);
        assert!((k1 - k2).abs() < 1e-4 && (k1 - g.grow()).abs() < 1e-3);
        // Hermes' sandals are far, far wider than the Space Shuttle
        let ratio = Game::babies_wide(g.grow(), sandals) / Game::babies_wide(g.grow(), shuttle);
        println!("sandals / shuttle = {ratio:.3e}, God is {:.3e} babies wide", Game::babies_wide(g.grow(), GOD));
        assert!(ratio > 1e5);
    }

    #[test]
    fn zooming_out_scales_the_picture() {
        let mut g = Game::new(4);
        g.resize(390.0, 844.0, 2.0);
        g.start(Mode::Classic);
        let a = g.new_body_ex(3, V2::new(-0.3, 0.5), V2::default(), true).unwrap();
        let b = g.new_body_ex(3, V2::new(0.2, 0.7), V2::default(), true).unwrap();
        let (pa, pb, ra) = (g.bodies[a].p, g.bodies[b].p, g.bodies[a].r);
        g.zoom_world(1.0);
        let f = 1.0 / g.grow();
        let d0 = (pb - pa).len(); let d1 = (g.bodies[b].p - g.bodies[a].p).len();
        assert!((d1 - d0 * f).abs() < 1e-5, "distances shrink with the zoom");
        assert!((g.bodies[a].r - ra * f).abs() < 1e-6, "so do the balls");
        // the bottom of the vessel stays where it is
        let bottom = V2::new(0.0, g.ring_r);
        assert!(((g.bodies[a].p - bottom).len() - (pa - bottom).len() * f).abs() < 1e-5);
    }

    #[test]
    fn creation_waits_for_the_player() {
        use crate::story::*;
        let mut g = Game::new(5);
        g.resize(390.0, 844.0, 2.0);
        g.start(Mode::Classic);
        g.debug_story(0.0);
        let bt = beat_times(track(g.story_he));
        // runs on its own clock (no narration) up to the first moment, then holds
        for _ in 0..(60 * 40) { g.frame(1.0 / 60.0); if g.story_hold { break; } }
        assert!(g.story_hold && g.story_beat == B_LIGHT);
        assert!((g.story_t - (bt[B_LIGHT] - LEAD)).abs() < 1e-3);
        let t_held = g.story_t;
        for _ in 0..60 { g.frame(1.0 / 60.0); }
        assert_eq!(g.story_t, t_held, "time stands still while it waits");
        // a touch lights it, where the finger was
        g.pointer(0, 100.0, 200.0); g.pointer(2, 100.0, 200.0);
        assert!(!g.story_hold && g.story_beat == B_SKY);
        assert!((g.story_pos[B_LIGHT].0 - 100.0 / g.lay.sw).abs() < 0.01);
        // the sky waits for a swipe up; a short one is not enough, a long one is
        for _ in 0..(60 * 60) { g.frame(1.0 / 60.0); if g.story_hold { break; } }
        assert!(g.story_hold && g.story_beat == B_SKY);
        g.pointer(0, 200.0, 600.0); g.pointer(1, 200.0, 590.0);
        assert!(g.story_hold);
        g.pointer(1, 200.0, 520.0);
        assert!(!g.story_hold && g.story_beat == B_LAND);
        g.pointer(2, 200.0, 520.0);
        // nobody answers the land: it rises by itself after the timeout
        for _ in 0..(60 * 60) { g.frame(1.0 / 60.0); if g.story_hold { break; } }
        assert!(g.story_hold && g.story_beat == B_LAND);
        for _ in 0..(60 * (TIMEOUT as usize + 1)) { g.frame(1.0 / 60.0); }
        assert!(g.story_beat > B_LAND);
        // free creation on the third day: touching the land plants a tree
        let c_plants = { let tr = track(g.story_he); tr.verses[10].t0 + 1.0 };
        while g.story_t < c_plants && !g.story_end_sent { g.frame(1.0 / 60.0); if g.story_hold { let (x, y) = (195.0, 300.0); g.pointer(0, x, y); g.pointer(2, x, y); } }
        let before = g.story_marks.len();
        let y_land = g.lay.sy + g.lay.sh * (HORIZON + 0.1);
        g.pointer(0, 150.0, y_land); g.pointer(2, 150.0, y_land);
        assert_eq!(g.story_marks.len(), before + 1);
        assert!(matches!(g.story_marks.last().unwrap().kind, K_TREE | K_FLOWER));
        // the breath of life needs a long press
        let mut guard = 0;
        while g.story_beat < B_PEOPLE && guard < 60 * 600 {
            g.frame(1.0 / 60.0); guard += 1;
            if g.story_hold { let (x, y) = (195.0, 500.0); g.pointer(0, x, y); g.pointer(2, x, y); }
        }
        for _ in 0..(60 * 60) { g.frame(1.0 / 60.0); if g.story_hold { break; } }
        assert!(g.story_hold && g.story_beat == B_PEOPLE);
        g.pointer(0, 195.0, 560.0);
        for _ in 0..30 { g.frame(1.0 / 60.0); }
        assert!(g.story_hold, "half a second is not enough");
        for _ in 0..50 { g.frame(1.0 / 60.0); }
        assert!(!g.story_hold && g.story_beat == B_CANDLES);
        g.pointer(2, 195.0, 560.0);
        // and the story ends after the last moment
        let mut guard = 0;
        while !g.story_end_sent && guard < 60 * 600 { g.frame(1.0 / 60.0); guard += 1; if g.story_hold { g.pointer(0, 200.0, 500.0); g.pointer(2, 200.0, 500.0); } }
        assert!(g.story_end_sent);
    }

    #[test]
    fn balls_really_bounce() {
        // one ball dropped from high up in an empty ring must bounce several times
        let mut g = Game::new(5);
        g.resize(390.0, 844.0, 2.0);
        g.opts.set(Opt::Drama as usize, 0.0);
        g.unlocked = Mask::all();
        g.sandbox_tier = 20;
        g.start(Mode::Sandbox);
        g.new_body_ex(20, V2::new(0.0, -0.6), V2::default(), true);
        let (mut bounces, mut was_down, mut peaks) = (0, true, Vec::new());
        let mut top = f32::MAX;
        for _ in 0..600 {
            g.frame(1.0 / 60.0);
            g.events.clear();
            let b = g.bodies[0];
            if b.v.y < 0.0 && was_down { bounces += 1; was_down = false; top = b.p.y; }
            if b.v.y < 0.0 { top = top.min(b.p.y); }
            if b.v.y > 0.0 && !was_down { was_down = true; peaks.push(top); }
        }
        println!("bounces {bounces}, peaks {:?}", peaks.iter().take(6).collect::<Vec<_>>());
        assert!(bounces >= 4, "only {bounces} bounces");
    }

    #[test]
    fn schema_is_json_like() {
        let s = crate::ui::schema();
        assert!(s.starts_with('{') && s.ends_with('}'));
        assert!(s.contains("\"crawl\""));
        let save = crate::save::save(&Game::new(1));
        let mut g2 = Game::new(2);
        crate::save::load(&mut g2, &save);
        assert_eq!(g2.opts.v, Game::new(1).opts.v);
    }
}
