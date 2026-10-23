//! Game state, physics and rules.
//!
//! World units: the inside of the ring has radius `ring_r` (≈1), centred on the
//! origin, y pointing down. The chute is a vertical channel of half-width
//! CHUTE_W that meets the ring at its top. Items are discs whose radius depends
//! on how far their tier is above the current spout tier, so the picture
//! "zooms out" as the journey climbs.

use alloc::string::String;
use alloc::vec::Vec;

use crate::m::*;
use crate::opts::*;
use crate::tiers::*;

pub const R0: f32 = 0.105;
pub const GROW: f32 = 1.26;
pub const CHUTE_W: f32 = 0.16;
pub const BASE_G: f32 = 4.2;
pub const MAX_BODIES: usize = 170;
pub const SUB_HZ: f32 = 480.0;

// sound ids (0..=36 are the tiers' OMGs)
pub const S_DROP: u32 = 40;
pub const S_POP: u32 = 41;
pub const S_SOLD: u32 = 42;
pub const S_SHAKE: u32 = 43;
pub const S_MAGNET: u32 = 44;
pub const S_BOMB: u32 = 45;
pub const S_SLOWMO: u32 = 46;
pub const S_FLIP: u32 = 47;
pub const S_UPGRADE: u32 = 48;
pub const S_WHOOSH: u32 = 49;
pub const S_SPOUT: u32 = 50;
pub const S_IAM: u32 = 51;
pub const S_JAM: u32 = 52;
pub const S_CLICK: u32 = 53;
pub const S_TIMEUP: u32 = 54;
pub const S_MUSIC0: u32 = 60; // + category

// event opcodes (5 floats each: op, a, b, c, d)
pub const EV_SOUND: f32 = 1.0;
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
    pub trail: [V2; 4],
}

#[derive(Clone, Copy, Default)]
pub struct Particle {
    pub kind: u8, // 0 dot, 1 streak, 2 wave, 3 coin, 4 flame, 5 star, 6 confetti
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
    pub best: [f32; N_MODES], pub best_tier_ta: u8, pub played: f32, pub top_tier: u8,
}

pub struct Game {
    pub rng: Rng,
    pub bodies: Vec<Body>,
    pub parts: Vec<Particle>,
    pub stars: Vec<Particle>,
    pub next_id: u32,
    pub mode: Mode,
    pub opts: Options,
    pub lay: Layout,
    pub ring_r: f32,
    pub spout: u8,
    pub base: f32,
    pub run_max: u8,
    pub run_seen: u64,
    pub unlocked: u64,
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
    // presentation state
    pub shake: f32,
    pub flash: f32,
    pub flash_col: u32,
    pub ring_pulse: f32,
    pub ring_col: u32,
    pub hue: f32,
    pub cat: u8,
    pub cat_mix: f32,
    pub prev_cat: u8,
    pub banner_tier: i32,
    pub banner_t: f32,
    pub toast: (&'static str, &'static str),
    pub toast_t: f32,
    pub voice_busy: f32,
    pub voice_tier: i32,
    pub pop_cd: f32,
    pub sold_cd: f32,
    pub drop_snd_cd: f32,
    pub lang_he: bool,
    pub caption: String,
    pub stats: Stats,
    pub run_merges: u32,
    pub run_drops: u32,
    pub events: Vec<f32>,
    pub draw: Vec<f32>,
    pub text: String,
    pub dirty_save: f32,
}

impl Game {
    pub fn new(seed: u32) -> Game {
        let mut g = Game {
            rng: Rng::new(seed as u64 ^ 0x5eed_0f_60d),
            bodies: Vec::with_capacity(MAX_BODIES + 8),
            parts: Vec::with_capacity(1600),
            stars: Vec::with_capacity(180),
            next_id: 1,
            mode: Mode::Classic,
            opts: Options::new(),
            lay: Layout::default(),
            ring_r: 1.0,
            spout: 0,
            base: 0.0,
            run_max: 0,
            run_seen: 0,
            unlocked: 1,
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
            ta_left: 90.0,
            sandbox_tier: 0,
            shake: 0.0,
            flash: 0.0,
            flash_col: 0xFFFFFF,
            ring_pulse: 0.0,
            ring_col: 0xFFFFFF,
            hue: 0.0,
            cat: 0,
            cat_mix: 1.0,
            prev_cat: 0,
            banner_tier: -1,
            banner_t: 0.0,
            toast: ("", ""),
            toast_t: 0.0,
            voice_busy: 0.0,
            voice_tier: -1,
            pop_cd: 0.0,
            sold_cd: 0.0,
            drop_snd_cd: 0.0,
            lang_he: true,
            caption: String::new(),
            stats: Stats::default(),
            run_merges: 0,
            run_drops: 0,
            events: Vec::with_capacity(256),
            draw: Vec::with_capacity(16 * 900),
            text: String::with_capacity(4096),
            dirty_save: 0.0,
        };
        g.tools[Tool::Upgrade as usize].charges = 1;
        g.make_stars();
        g
    }

    fn make_stars(&mut self) {
        self.stars.clear();
        for _ in 0..170 {
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
        if self.events.len() < 5 * 200 { self.events.extend_from_slice(&[op, a, b, c, d]); }
    }
    pub fn sound(&mut self, id: u32, gain: f32, pan: f32) { self.ev(EV_SOUND, id as f32, gain, pan, 0.0); }
    fn haptic(&mut self, ms: f32) { if self.opts.on(Opt::Haptics) { self.ev(EV_HAPTIC, ms, 0.0, 0.0, 0.0); } }

    // ───────────────────────────────────────────── run control
    pub fn start(&mut self, mode: Mode) {
        self.mode = mode;
        self.bodies.clear();
        self.parts.clear();
        self.ring_r = self.opts.get(Opt::RingSize);
        let st = (self.opts.get(Opt::StartTier) as i32 - 1).clamp(0, 35) as u8;
        let st = if self.unlocked & (1u64 << st) != 0 { st } else { 0 };
        let st = st.min(GOD - 1);
        self.spout = st;
        self.base = st as f32;
        self.run_max = st;
        self.run_seen = 1u64 << st;
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
        self.ta_left = 90.0;
        self.banner_tier = -1;
        self.banner_t = 0.0;
        self.toast_t = 0.0;
        self.voice_busy = 0.0;
        self.voice_tier = -1;
        self.run_merges = 0;
        self.run_drops = 0;
        self.cat = tier(st).cat as u8;
        self.prev_cat = self.cat;
        self.cat_mix = 1.0;
        self.flash = 0.0;
        self.shake = 0.0;
        self.stats.runs += 1;
        self.sandbox_tier = st;
        if mode == Mode::Sandbox {
            self.spout = st;
            self.base = st as f32;
        }
        self.ev(EV_MUSIC, self.cat as f32, 0.0, 0.0, 0.0);
        self.ev(EV_TOOLS, 0.0, 0.0, 0.0, 0.0);
        self.dirty_save = 0.5;
    }

    pub fn gap(&self) -> u8 { self.opts.get(Opt::Gap) as u8 }

    pub fn radius_for(&self, t: u8) -> f32 {
        if t == GOD { return 0.36; }
        let d = t as f32 - self.base;
        let r = R0 * pow(GROW, d);
        clamp(r, 0.028, 0.62)
    }

    fn new_body(&mut self, t: u8, p: V2, v: V2) -> Option<usize> { self.new_body_ex(t, p, v, false) }
    fn new_body_ex(&mut self, t: u8, p: V2, v: V2, force: bool) -> Option<usize> {
        if !force && self.bodies.iter().filter(|b| b.alive).count() >= MAX_BODIES { return None; }
        let r = self.radius_for(t);
        let b = Body {
            id: self.next_id, tier: t, p, v, acc: V2::default(), r, angle: self.rng.range(-0.4, 0.4), spin: 0.0,
            age: 0.0, pop: 0.0, flash: 0.0, alive: true, merged: false, orphan_t: 0.0, rest_t: 0.0, dying: 0.0, hl: 0.0,
            trail: [p; 4],
        };
        self.next_id += 1;
        self.bodies.push(b);
        Some(self.bodies.len() - 1)
    }

    // ───────────────────────────────────────────── geometry helpers
    #[inline] pub fn join_y(&self) -> f32 { -sqrt(self.ring_r * self.ring_r - CHUTE_W * CHUTE_W) }
    pub fn to_screen(&self, p: V2) -> (f32, f32) { (self.lay.cx + p.x * self.lay.scale, self.lay.cy + p.y * self.lay.scale) }
    pub fn to_world(&self, x: f32, y: f32) -> V2 { V2::new((x - self.lay.cx) / self.lay.scale, (y - self.lay.cy) / self.lay.scale) }

    pub fn resize(&mut self, w: f32, h: f32, dpr: f32) {
        let w = w.max(200.0); let h = h.max(200.0);
        // a portrait column: full height on phones, 9:16 on wide screens, never taller than 9:19.5
        let mut sw = w.min(h * 9.0 / 16.0);
        if w <= h * 9.0 / 16.0 { sw = w; }
        let sh = h.min(sw * 19.5 / 9.0);
        let sx = (w - sw) * 0.5; let sy = (h - sh) * 0.5;
        let u = sw / 390.0;
        let hud_y = sy + 60.0 * u;
        let ladder_y = sy + 112.0 * u;
        let timer_y = sy + 128.0 * u;
        let chute_top_px = sy + 140.0 * u;
        let tools_y = sy + sh - 18.0 * u - 50.0 * u;
        let caption_y = tools_y - 38.0 * u;
        let y_bot = caption_y - 34.0 * u;
        let ring_px = (0.44 * sw).min((y_bot - chute_top_px - 64.0 * u) * 0.5).max(60.0);
        let cy = y_bot - ring_px - 4.0 * u;
        self.lay = Layout { w, h, dpr, sx, sy, sw, sh, u, cx: sx + sw * 0.5, cy, ring_px, scale: ring_px, chute_top: 0.0, chute_top_px, hud_y, ladder_y, timer_y, caption_y, tools_y };
        self.update_scale();
    }
    fn update_scale(&mut self) {
        self.lay.scale = self.lay.ring_px / self.ring_r;
        self.lay.chute_top = (self.lay.chute_top_px - self.lay.cy) / self.lay.scale;
    }

    pub fn gravity(&self, p: V2, in_chute: bool) -> V2 {
        let gmul = self.opts.get(Opt::Gravity);
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
        a
    }

    // ───────────────────────────────────────────── input
    pub fn pointer(&mut self, kind: u32, x: f32, y: f32) {
        match kind {
            0 => { // down
                self.ptr = Pointer { down: true, x0: x, y0: y, x, y, t0: self.real, dragging: false };
            }
            1 => { // move
                if !self.ptr.down { return; }
                self.ptr.x = x; self.ptr.y = y;
                let dx = x - self.ptr.x0; let dy = y - self.ptr.y0;
                if !self.ptr.dragging && dx * dx + dy * dy > 14.0 * 14.0 { self.ptr.dragging = true; }
                if self.ptr.dragging && self.mode != Mode::Watch {
                    self.tilt_target = clamp(dx / (self.lay.sw * 0.45), -1.0, 1.0) * 0.62;
                }
            }
            _ => { // up / cancel
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
            3 => if down {
                let jx = self.rng.sym() * 0.3;
                let (x, y) = if self.mode == Mode::Sandbox { self.to_screen(V2::new(jx, -0.5)) } else { (self.lay.cx, self.lay.cy) };
                self.tap(x, y);
            },
            4..=9 => if down { self.tool((code - 4) as usize); },
            _ => {}
        }
    }

    fn tap(&mut self, x: f32, y: f32) {
        if !self.started || self.paused || self.finished || self.over { return; }
        let w = self.to_world(x, y);
        if self.upgrade_armed {
            if let Some(i) = self.pick(w) {
                self.upgrade_body(i);
                return;
            }
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
            _ => {
                if self.tap_cd <= 0.0 && self.spawn_from_spout(true) { self.tap_cd = 0.14; }
            }
        }
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
            0 => { // shake
                for b in self.bodies.iter_mut() {
                    if !b.alive { continue; }
                    let k = 2.4 / (1.0 + b.r * 4.0);
                    b.v += V2::new(self.rng.sym() * k, -self.rng.range(0.6, 1.4) * k);
                }
                self.shake = self.shake.max(0.5);
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
            self.wave(*p, *r * 2.5, 0xFFDD88);
            for b in self.bodies.iter_mut() {
                if !b.alive || b.dying > 0.0 { continue; }
                let d = b.p - *p; let l = d.len();
                if l < 0.7 && l > 1e-4 { b.v += d * (1.6 * (0.7 - l) / (l * (1.0 + b.r * 3.0))); }
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
    fn spawn_from_spout(&mut self, manual: bool) -> bool {
        if self.mode == Mode::Sandbox || self.finished || self.over { return false; }
        let mut t = self.spout;
        let chaos = self.mode == Mode::Chaos;
        if chaos && self.rng.chance(0.22) && t + 1 < GOD { t += 1; }
        let r = self.radius_for(t);
        // chaos portals: sometimes the car appears inside the ring
        if chaos && !manual && self.rng.chance(0.3) {
            for _ in 0..6 {
                let a = self.rng.range(-PI * 0.85, -PI * 0.15);
                let d = self.rng.range(0.25, 0.65) * self.ring_r;
                let p = V2::new(cos(a) * d, sin(a) * d);
                if self.free_at(p, r * 1.05) {
                    if self.new_body(t, p, V2::new(0.0, 0.0)).is_some() {
                        self.portal_fx(p, r);
                        self.run_drops += 1; self.stats.drops += 1;
                        return true;
                    }
                }
            }
        }
        let jitter = self.rng.sym() * 0.012;
        let p = V2::new(jitter, self.lay.chute_top + r + 0.02);
        if !self.free_at(p, r * 1.02) { return false; }
        if self.new_body(t, p, V2::new(0.0, 0.9)).is_some() {
            self.run_drops += 1; self.stats.drops += 1;
            if self.drop_snd_cd <= 0.0 { self.sound(S_DROP, 0.35, 0.0); self.drop_snd_cd = 0.07; }
            return true;
        }
        false
    }

    fn free_at(&self, p: V2, r: f32) -> bool {
        for b in &self.bodies {
            if !b.alive { continue; }
            let d = (b.p - p).len();
            if d < b.r + r { return false; }
        }
        true
    }

    // ───────────────────────────────────────────── frame
    pub fn frame(&mut self, real_dt: f32) {
        let real_dt = clamp(real_dt, 0.0, 0.1);
        self.real += real_dt;
        let mut speed = self.opts.get(Opt::Speed);
        if self.tools[Tool::SlowMo as usize].active > 0.0 { speed *= 0.25; }
        if self.finished { speed = speed.min(1.0) * if self.god_t < 2.2 { 0.35 + 0.65 * smooth(self.god_t / 2.2) } else { 1.0 }; }
        if self.paused || !self.started { speed = 0.0; }
        let dt = real_dt * speed;
        self.tap_cd -= dt;
        self.drop_snd_cd -= real_dt;
        self.pop_cd -= real_dt;
        self.sold_cd -= real_dt;
        self.voice_busy -= real_dt;
        if self.started && !self.paused { self.stats.played += real_dt; }
        // presentation decay (real time)
        self.shake = (self.shake - real_dt * 1.8).max(0.0);
        self.flash = (self.flash - real_dt * 1.6).max(0.0);
        self.ring_pulse = (self.ring_pulse - real_dt * 1.3).max(0.0);
        self.banner_t -= real_dt;
        self.toast_t -= real_dt;
        self.cat_mix = (self.cat_mix + real_dt * 0.5).min(1.0);
        self.hue += real_dt * (0.08 + 0.25 * self.ring_pulse);
        if self.dirty_save > 0.0 { self.dirty_save -= real_dt; if self.dirty_save <= 0.0 { self.ev(EV_SAVE, 0.0, 0.0, 0.0, 0.0); } }
        if dt > 0.0 { self.step(dt); }
        self.update_parts(real_dt, dt);
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
        // spout
        if !self.finished && !self.over && self.mode != Mode::Sandbox {
            self.update_fill();
            let mut interval = 0.42 / self.opts.get(Opt::DropRate);
            if self.mode == Mode::Chaos { interval *= 0.5; }
            if self.fill > 0.58 { interval *= 1.0 + (self.fill - 0.58) * 9.0; }
            self.drop_t -= dt;
            if self.drop_t <= 0.0 {
                if self.fill < 0.74 && self.spawn_from_spout(false) { self.drop_t = interval; } else { self.drop_t = 0.12; }
            }
            self.spout_cd -= dt;
            self.check_spout();
            self.check_jam(dt);
        }
        // magnet + resting bookkeeping (once per frame)
        self.magnet(dt);
        if self.finished { self.god_sequence(dt); }
        // physics substeps
        let n = clamp(ceil(dt * SUB_HZ), 1.0, 40.0) as usize;
        let h = dt / n as f32;
        for _ in 0..n { self.substep(h); }
        // per-body bookkeeping
        let gap_spout = self.spout;
        self.base += (gap_spout as f32 - self.base) * approach(dt, 0.45);
        let mut dissolve: Vec<usize> = Vec::new();
        let mut tier_count = [0u8; N_TIERS];
        for b in &self.bodies { if b.alive && b.dying <= 0.0 { tier_count[b.tier as usize] = tier_count[b.tier as usize].saturating_add(1); } }
        for i in 0..self.bodies.len() {
            let target_r = if self.finished && self.bodies[i].tier == GOD { 0.62 * self.ring_r } else { self.radius_for(self.bodies[i].tier) };
            let b = &mut self.bodies[i];
            if !b.alive { continue; }
            b.age += dt;
            b.pop = (b.pop - dt * 2.6).max(0.0);
            b.flash = (b.flash - dt * 2.2).max(0.0);
            b.hl = (b.hl - dt * 2.0).max(0.0);
            let k = if b.pop > 0.0 { approach(dt, 0.05) } else { approach(dt, 0.18) };
            b.r += (target_r - b.r) * k;
            b.angle += b.spin * dt;
            b.spin += (b.v.x / b.r.max(0.03) * 0.55 - b.spin) * approach(dt, 0.35);
            if b.v.len2() < 0.04 { b.rest_t += dt; } else { b.rest_t = (b.rest_t - dt * 2.0).max(0.0); }
            b.trail = [b.p, b.trail[0], b.trail[1], b.trail[2]];
            if b.dying > 0.0 {
                b.dying -= dt;
                if b.dying <= 0.0 { b.alive = false; dissolve.push(i); }
                continue;
            }
            if b.tier < gap_spout && self.mode != Mode::Sandbox && !self.finished {
                b.orphan_t += dt;
                let alone = tier_count[b.tier as usize] < 2;
                if (alone && b.orphan_t > 3.2) || b.orphan_t > 11.0 { b.dying = 0.45; }
            } else { b.orphan_t = 0.0; }
        }
        for i in dissolve {
            let (p, c) = (self.bodies[i].p, tier(self.bodies[i].tier).color);
            if !self.finished {
                self.coins(p, 6);
                if self.sold_cd <= 0.0 { self.sound(S_SOLD, 0.45, p.x); self.sold_cd = 0.25; }
            } else {
                self.burst(p, c, 10, 0.8);
            }
        }
        self.bodies.retain(|b| b.alive);
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
        if self.blocked && self.fill > 0.62 { self.jam_t += dt; } else { self.jam_t = (self.jam_t - dt * 2.0).max(0.0); }
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
                b.v += V2::new(self.rng.sym() * 1.2, -self.rng.range(0.4, 1.3)) * (1.0 / (1.0 + b.r * 3.0));
            }
            self.shake = self.shake.max(0.25);
        }
    }

    fn check_spout(&mut self) {
        if self.spout_cd > 0.0 || self.mode == Mode::Sandbox { return; }
        let mut maxp = 0u8;
        for b in &self.bodies { if b.alive && b.dying <= 0.0 && b.tier > maxp { maxp = b.tier; } }
        let gap = self.gap();
        if maxp >= self.spout + gap && self.spout + 1 + gap <= GOD {
            self.spout += 1;
            self.spout_cd = 0.7;
            self.sound(S_SPOUT, 0.55, 0.0);
            let p = V2::new(0.0, self.join_y());
            self.burst(p, tier(self.spout).color, 14, 0.7);
        }
    }

    fn magnet(&mut self, dt: f32) {
        let assist = self.opts.get(Opt::Magnet);
        let tool = self.tools[Tool::Magnet as usize].active > 0.0;
        let k_base = assist * 0.55 + if tool { 3.2 } else { 0.0 } + if self.mode == Mode::Watch { 0.6 } else { 0.0 };
        let jy = self.join_y();
        let n = self.bodies.len();
        for b in self.bodies.iter_mut() { b.acc = V2::default(); }
        if k_base <= 0.0 && self.spout == 0 { return; }
        for i in 0..n {
            let (ti, pi, ri, oi, resti) = { let b = &self.bodies[i]; (b.tier, b.p, b.r, b.orphan_t, b.rest_t) };
            if !self.bodies[i].alive || self.bodies[i].dying > 0.0 || pi.y < jy || ti == GOD { continue; }
            for j in (i + 1)..n {
                let bj = &self.bodies[j];
                if !bj.alive || bj.dying > 0.0 || bj.tier != ti || bj.p.y < jy { continue; }
                let d = bj.p - pi; let l = d.len();
                let reach = 0.55 + ri * 2.5 + if tool { 0.8 } else { 0.0 };
                if l > reach || l < 1e-4 { continue; }
                let orphan = oi > 0.0 || bj.orphan_t > 0.0;
                let rest = clamp((resti + bj.rest_t) * 0.25, 0.0, 1.5);
                let mut k = k_base * (1.0 + rest);
                if orphan { k += 2.5; }
                if k <= 0.0 { continue; }
                let f = d * (k * (1.0 - l / reach) / l);
                // lighter one moves more
                let mi = ri * ri; let mj = bj.r * bj.r; let s = mi + mj;
                let ai = f * (mj / s); let aj = f * (-mi / s);
                self.bodies[i].acc += ai;
                self.bodies[j].acc += aj;
            }
        }
        let _ = dt;
    }

    fn substep(&mut self, h: f32) {
        let e = self.opts.get(Opt::Bounce);
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
            b.v = b.v * (1.0 - 0.08 * h);
            let sp = b.v.len();
            if sp > 7.0 { b.v = b.v * (7.0 / sp); }
            b.p += b.v * h;
        }
        // pairs
        let mut merges: Vec<(usize, usize)> = Vec::new();
        for i in 0..n {
            if !self.bodies[i].alive { continue; }
            for j in (i + 1)..n {
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
                    && !self.bodies[i].merged && !self.bodies[j].merged && self.bodies[i].age > 0.02 && self.bodies[j].age > 0.02;
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
                    let ee = if -vn > 0.25 { e } else { 0.0 };
                    let jn = -(1.0 + ee) * vn / ws;
                    let imp = nrm * jn;
                    // a little tangential friction
                    let t = V2::new(-nrm.y, nrm.x);
                    let vt = rv.dot(t);
                    let jt = clamp(-vt / ws * 0.12, -abs(jn) * 0.5, abs(jn) * 0.5);
                    let impt = t * jt;
                    self.bodies[i].v -= (imp + impt) * wi;
                    self.bodies[j].v += (imp + impt) * wj;
                }
            }
        }
        // boundaries
        let corners = [V2::new(-CHUTE_W, jy), V2::new(CHUTE_W, jy)];
        for b in self.bodies.iter_mut() {
            if !b.alive { continue; }
            let r = b.r;
            // chute walls (centre above the join line)
            if b.p.y < jy {
                if r < CHUTE_W {
                    if b.p.x - r < -CHUTE_W { b.p.x = -CHUTE_W + r; if b.v.x < 0.0 { b.v.x = -b.v.x * e * 0.5; } }
                    if b.p.x + r > CHUTE_W { b.p.x = CHUTE_W - r; if b.v.x > 0.0 { b.v.x = -b.v.x * e * 0.5; } }
                } else if abs(b.p.x) < CHUTE_W + r {
                    b.p.y = jy + 0.001; if b.v.y < 0.0 { b.v.y = 0.0; }
                }
                let top = self.lay.chute_top;
                if b.p.y - r < top - 0.4 { b.p.y = top - 0.4 + r; if b.v.y < 0.0 { b.v.y = 0.0; } }
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
                        let ee = if vn > 0.3 { e } else { 0.0 };
                        b.v -= u * ((1.0 + ee) * vn);
                    }
                    let t = V2::new(-u.y, u.x);
                    let vt = b.v.dot(t);
                    let wall = spin * rr;
                    let fr = if spin != 0.0 { 0.25 } else { 0.035 };
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
        // merges
        for (i, j) in merges {
            if !self.bodies[i].alive || !self.bodies[j].alive { continue; }
            self.merge(i, j);
        }
    }

    fn merge(&mut self, i: usize, j: usize) {
        let (a, b) = (self.bodies[i], self.bodies[j]);
        let ma = a.r * a.r; let mb = b.r * b.r;
        let p = (a.p * ma + b.p * mb) * (1.0 / (ma + mb));
        let v = (a.v * ma + b.v * mb) * (0.6 / (ma + mb));
        self.bodies[i].alive = false;
        self.bodies[j].alive = false;
        let t = a.tier + 1;
        let start_r = a.r.max(b.r);
        if let Some(k) = self.new_body_ex(t, p, v, true) {
            let nb = &mut self.bodies[k];
            nb.r = start_r * 1.05;
            nb.pop = 1.0;
            nb.flash = 1.0;
            nb.merged = true;
            nb.angle = a.angle;
        }
        self.run_merges += 1;
        self.stats.merges += 1;
        self.merge_fx(t, p, start_r);
        self.on_new_tier(t, p);
    }

    fn merge_fx(&mut self, t: u8, p: V2, r: f32) {
        let tt = tier(t);
        let lvl = t as f32 / GOD as f32;
        let parts = self.opts.get(Opt::Particles);
        let n = ((10.0 + 60.0 * lvl * lvl) * parts) as usize;
        self.burst(p, tt.color, n, 0.7 + 1.6 * lvl);
        self.wave(p, r * (2.0 + 3.0 * lvl), tt.color);
        if t >= 10 && self.pop_cd <= 0.0 { self.wave(p, r * (3.5 + 4.0 * lvl), 0xFFFFFF); }
        if tt.cat == Cat::Myth || tt.cat == Cat::Holy { self.flames(p, (6.0 + 20.0 * lvl) as usize, tt.color); }
        if self.opts.on(Opt::ScreenShake) { self.shake = self.shake.max(0.08 + 0.9 * lvl * lvl); }
        if t >= 5 { self.add_flash(tt.color, 0.06 + 0.4 * lvl * lvl); }
        self.ring_pulse = self.ring_pulse.max(0.3 + 0.7 * lvl);
        self.ring_col = tt.color;
        // sound: tier OMG, unless a bigger one is still ringing
        let busy = self.voice_busy > 0.0 && (t as i32) < self.voice_tier;
        let low_spam = t <= 2 && self.pop_cd > 0.0;
        if !busy && !low_spam {
            self.sound(t as u32, 1.0, clamp(p.x / self.ring_r, -1.0, 1.0) * 0.4);
            self.voice_busy = voice_len(t);
            self.voice_tier = t as i32;
            self.stats.omgs += 1;
            if t > 3 { self.ev(EV_DUCK, t as f32, 0.0, 0.0, 0.0); }
            self.pop_cd = 0.18;
        } else if self.pop_cd <= 0.0 {
            self.sound(S_POP, 0.5, p.x);
            self.pop_cd = 0.06;
        }
        self.haptic(if t > 20 { 60.0 } else if t > 8 { 30.0 } else { 12.0 });
    }

    fn on_new_tier(&mut self, t: u8, p: V2) {
        let first_in_run = self.run_seen & (1u64 << t) == 0;
        self.run_seen |= 1u64 << t;
        if t > self.run_max { self.run_max = t; }
        if self.unlocked & (1u64 << t) == 0 {
            self.unlocked |= 1u64 << t;
            self.ev(EV_UNLOCK, t as f32, 0.0, 0.0, 0.0);
            self.dirty_save = 0.3;
        }
        if t > self.stats.top_tier { self.stats.top_tier = t; }
        if first_in_run && t > 0 {
            self.banner_tier = t as i32;
            self.banner_t = if t == GOD { 9.0 } else { 2.6 };
            self.ev(EV_BANNER, t as f32, 0.0, 0.0, 0.0);
            let c = tier(t).cat as u8;
            if c != self.cat {
                self.prev_cat = self.cat;
                self.cat = c;
                self.cat_mix = 0.0;
                let ci = &CATS[c as usize];
                if !ci.toast_he.is_empty() { self.toast = (ci.toast_he, ci.toast_en); self.toast_t = 2.8; }
                self.ev(EV_CATEGORY, c as f32, 0.0, 0.0, 0.0);
                self.ev(EV_MUSIC, c as f32, 0.0, 0.0, 0.0);
            }
        }
        if t == GOD && !self.finished {
            self.finished = true;
            self.god_t = 0.0;
            self.god_id = self.next_id - 1;
            self.stats.gods += 1;
            let m = self.mode as usize;
            if self.mode != Mode::Sandbox && self.mode != Mode::TimeAttack {
                if self.stats.best[m] <= 0.0 || self.time < self.stats.best[m] { self.stats.best[m] = self.time; }
            }
            self.add_flash(0xFFFFFF, 1.0);
            self.shake = 1.2;
            let _ = p;
            self.dirty_save = 0.2;
        }
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
        // everything else is drawn into the light
        let mut god_p = V2::default();
        for b in &self.bodies { if b.alive && b.tier == GOD { god_p = b.p; } }
        for b in self.bodies.iter_mut() {
            if !b.alive { continue; }
            if b.tier == GOD {
                // critically damped spring to the centre of the ring
                b.acc = (V2::default() - b.p) * 9.0 - b.v * 6.0;
                continue;
            }
            if b.dying > 0.0 { continue; }
            let d = god_p - b.p;
            b.acc = d.norm() * (3.0 + gt * 3.0);
            if gt > 1.2 + (b.id % 17) as f32 * 0.09 { b.dying = 0.6; }
        }
        if before < 0.05 && gt >= 0.05 { self.ring_pulse = 1.0; }
        if before < 3.6 && gt >= 3.6 {
            self.sound(S_IAM, 1.0, 0.0);
        }
        if before < 6.8 && gt >= 6.8 {
            self.ev(EV_END, self.time, self.run_merges as f32, self.run_drops as f32, self.mode as u32 as f32);
        }
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
    fn cap(&self) -> usize { (1500.0 * clamp(self.opts.get(Opt::Particles), 0.3, 2.0) / 1.8) as usize }
    pub fn burst(&mut self, p: V2, col: u32, n: usize, power: f32) {
        let cap = self.cap();
        for k in 0..n {
            if self.parts.len() >= cap { break; }
            let a = self.rng.range(0.0, TAU);
            let s = self.rng.range(0.3, 1.0) * power * 1.6;
            let streak = k % 3 != 0;
            let white = self.rng.chance(0.25);
            self.parts.push(Particle {
                kind: if streak { 1 } else { 0 }, p, v: V2::new(cos(a) * s, sin(a) * s),
                life: self.rng.range(0.35, 0.9) * (0.7 + power * 0.3), max: 0.0,
                size: self.rng.range(1.2, 3.2) * (0.8 + power * 0.25),
                color: if white { 0xFFFFFF } else { col }, drag: 2.2, grav: 1.2, angle: 0.0, spin: 0.0,
            });
            let l = self.parts.len() - 1; self.parts[l].max = self.parts[l].life;
        }
    }
    pub fn wave(&mut self, p: V2, r: f32, col: u32) {
        if self.parts.len() >= self.cap() { return; }
        self.parts.push(Particle { kind: 2, p, v: V2::default(), life: 0.55, max: 0.55, size: r, color: col, drag: 0.0, grav: 0.0, angle: 0.0, spin: 0.0 });
    }
    fn flames(&mut self, p: V2, n: usize, col: u32) {
        let cap = self.cap();
        for _ in 0..n {
            if self.parts.len() >= cap { break; }
            let life = self.rng.range(0.5, 1.2);
            self.parts.push(Particle { kind: 4, p: p + V2::new(self.rng.sym() * 0.1, self.rng.sym() * 0.05), v: V2::new(self.rng.sym() * 0.3, -self.rng.range(0.4, 1.3)), life, max: life, size: self.rng.range(3.0, 7.0), color: col, drag: 1.0, grav: -0.6, angle: 0.0, spin: 0.0 });
        }
    }
    fn coins(&mut self, p: V2, n: usize) {
        let cap = self.cap();
        for _ in 0..n {
            if self.parts.len() >= cap { break; }
            let life = self.rng.range(0.6, 1.0);
            self.parts.push(Particle { kind: 3, p, v: V2::new(self.rng.sym() * 0.7, -self.rng.range(0.6, 1.4)), life, max: life, size: self.rng.range(4.0, 6.5), color: 0xFFD54F, drag: 0.6, grav: 3.0, angle: self.rng.range(0.0, TAU), spin: self.rng.range(-12.0, 12.0) });
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
    if t == GOD { 11.0 } else if t >= 34 { 5.5 } else if t >= 27 { 4.0 } else if t >= 21 { 3.2 } else if t >= 16 { 2.8 } else if t >= 8 { 2.2 } else if t >= 4 { 1.4 } else { 0.7 }
}

#[cfg(test)]
mod sim {
    use super::*;
    pub fn run(mode: Mode, gap: f32, speed: f32, max_game_s: f32, seed: u32, verbose: bool) -> (bool, f32, u8, usize, u32, u32) {
        let mut g = Game::new(seed);
        g.resize(390.0, 844.0, 3.0);
        g.opts.set(Opt::Gap as usize, gap);
        g.opts.set(Opt::Speed as usize, speed);
        g.start(mode);
        let mut max_b = 0usize;
        let mut last = g.run_max;
        let mut frames = 0u32;
        let mut jams = 0u32;
        while g.time < max_game_s && !(g.finished && g.god_t > 8.0) && !g.over {
            g.frame(1.0 / 60.0);
            g.events.clear();
            frames += 1;
            let alive = g.bodies.iter().filter(|b| b.alive).count();
            if alive > max_b { max_b = alive; }
            for b in &g.bodies {
                assert!(b.p.x.is_finite() && b.p.y.is_finite() && b.v.x.is_finite() && b.r.is_finite(), "NaN body");
                if b.p.y > g.join_y() { assert!(b.p.len() < g.ring_r + 0.05, "escaped ring: {:?} r={}", b.p, b.r); }
            }
            if g.jam_t > 2.5 { jams += 1; }
            if g.run_max != last {
                last = g.run_max;
                if verbose { println!("  t={:7.1}s tier {:2} {:28} spout {:2} bodies {:3} fill {:.2}", g.time, last + 1, tier(last).en, g.spout, alive, g.fill); }
            }
            assert!(frames < 2_000_000);
        }
        (g.finished, g.time, g.run_max, max_b, frames, jams)
    }

    #[test]
    fn classic_reaches_god() {
        for seed in [1u32, 2, 3] {
            let r = run(Mode::Classic, 4.0, 8.0, 3600.0, seed, seed == 1);
            println!("classic seed {seed}: god={} time={:.0}s top={} max_bodies={} jams={}", r.0, r.1, r.2 + 1, r.3, r.5);
            assert!(r.0, "did not reach God");
        }
    }

    #[test]
    fn other_modes_progress() {
        for (m, name) in [(Mode::Watch, "watch"), (Mode::Chaos, "chaos"), (Mode::BlackHole, "blackhole")] {
            let r = run(m, 4.0, 8.0, 3600.0, 7, false);
            println!("{name}: god={} time={:.0}s top={} max_bodies={} jams={}", r.0, r.1, r.2 + 1, r.3, r.5);
            assert!(r.0, "{name} did not reach God");
        }
    }

    #[test]
    fn short_and_epic() {
        for gap in [3.0f32, 6.0] {
            let r = run(Mode::Classic, gap, 8.0, 7200.0, 11, false);
            println!("gap {gap}: god={} time={:.0}s top={} max_bodies={}", r.0, r.1, r.2 + 1, r.3);
            assert!(r.0);
        }
    }

    #[test]
    fn schema_is_json_like() {
        let s = crate::ui::schema();
        assert!(s.starts_with('{') && s.ends_with('}'));
        assert!(s.contains("\"picanto\""));
        let save = crate::save::save(&Game::new(1));
        let mut g2 = Game::new(2);
        crate::save::load(&mut g2, &save);
        assert_eq!(g2.opts.v, Game::new(1).opts.v);
    }
}
