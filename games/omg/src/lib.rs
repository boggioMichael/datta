//! OH MY GOD — a merge game from a crawling baby to the God of Israel.
//!
//! Everything that decides what happens lives here: physics, merge rules, the
//! 124-tier ladder, modes, tools, options, progression, the draw list (scenery
//! included) and the sound engine. The browser shell only paints the draw list, plays the PCM this
//! crate renders and forwards input.
#![cfg_attr(target_arch = "wasm32", no_std)]

extern crate alloc;

pub mod m;
pub mod tiers;
pub mod opts;
pub mod game;
pub mod render;
pub mod scenery;
pub mod ui;
pub mod save;
pub mod audio;

#[cfg(target_arch = "wasm32")]
mod walloc;
#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: walloc::ClassAlloc = walloc::ClassAlloc;

#[cfg(all(target_arch = "wasm32", not(test)))]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { core::arch::wasm32::unreachable() }

use alloc::string::String;
use alloc::vec::Vec;
use core::cell::UnsafeCell;

use game::Game;
use opts::{Mode, Opt, N_OPTS, N_TOOLS};

/// Single-threaded global cell (wasm has one thread per instance).
pub struct Global<T>(UnsafeCell<Option<T>>);
unsafe impl<T> Sync for Global<T> {}
impl<T> Global<T> {
    pub const fn new() -> Self { Global(UnsafeCell::new(None)) }
    #[allow(clippy::mut_from_ref)]
    pub fn get(&self) -> &mut Option<T> { unsafe { &mut *self.0.get() } }
}

static GAME: Global<Game> = Global::new();
static SCHEMA: Global<String> = Global::new();
static SAVEBUF: Global<String> = Global::new();

fn g() -> &'static mut Game {
    let s = GAME.get();
    if s.is_none() { *s = Some(Game::new(1)); }
    s.as_mut().unwrap()
}

// ───────────────────────── memory helpers for the host
#[unsafe(no_mangle)]
pub extern "C" fn omg_alloc(n: usize) -> *mut u8 {
    let mut v: Vec<u8> = Vec::with_capacity(n.max(1));
    let p = v.as_mut_ptr();
    core::mem::forget(v);
    p
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn omg_free(p: *mut u8, n: usize) {
    if p.is_null() { return; }
    unsafe { drop(Vec::from_raw_parts(p, 0, n.max(1))); }
}
fn str_from(p: *const u8, n: usize) -> &'static str {
    if p.is_null() || n == 0 { return ""; }
    let b = unsafe { core::slice::from_raw_parts(p, n) };
    core::str::from_utf8(b).unwrap_or("")
}

// ───────────────────────── game API
#[unsafe(no_mangle)]
pub extern "C" fn omg_init(seed: u32) { *GAME.get() = Some(Game::new(seed)); }
#[unsafe(no_mangle)]
pub extern "C" fn omg_resize(w: f32, h: f32, dpr: f32) { g().resize(w, h, dpr); }
#[unsafe(no_mangle)]
pub extern "C" fn omg_frame(dt: f32) { g().frame(dt); }
/// 0 sx, 1 sy, 2 sw, 3 sh, 4 unit, 5 ring cx, 6 ring cy, 7 ring px, 8 chute top px, 9 caption y, 10 tools y, 11 hud y
#[unsafe(no_mangle)]
pub extern "C" fn omg_layout(i: u32) -> f32 {
    let l = g().lay;
    match i { 0 => l.sx, 1 => l.sy, 2 => l.sw, 3 => l.sh, 4 => l.u, 5 => l.cx, 6 => l.cy, 7 => l.ring_px, 8 => l.chute_top_px, 9 => l.caption_y, 10 => l.tools_y, 11 => l.hud_y, _ => 0.0 }
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_draw_ptr() -> *const f32 { g().draw.as_ptr() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_draw_len() -> usize { g().draw.len() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_paths_ptr() -> *const f32 { g().paths.as_ptr() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_paths_len() -> usize { g().paths.len() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_text_ptr() -> *const u8 { g().text.as_ptr() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_text_len() -> usize { g().text.len() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_events_ptr() -> *const f32 { g().events.as_ptr() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_events_len() -> usize { g().events.len() }
#[unsafe(no_mangle)]
pub extern "C" fn omg_events_clear() { g().events.clear(); }

#[unsafe(no_mangle)]
pub extern "C" fn omg_schema_ptr() -> *const u8 {
    let s = SCHEMA.get();
    if s.is_none() { *s = Some(ui::schema()); }
    s.as_ref().unwrap().as_ptr()
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_schema_len() -> usize {
    let _ = omg_schema_ptr();
    SCHEMA.get().as_ref().unwrap().len()
}

#[unsafe(no_mangle)]
pub extern "C" fn omg_start(mode: u32) { g().start(Mode::from(mode)); }
#[unsafe(no_mangle)]
pub extern "C" fn omg_pause(on: u32) { g().paused = on != 0; }
#[unsafe(no_mangle)]
pub extern "C" fn omg_pointer(kind: u32, x: f32, y: f32) { g().pointer(kind, x, y); }
#[unsafe(no_mangle)]
pub extern "C" fn omg_tool(i: u32) { g().tool(i as usize); }
/// field: 0 cooldown fraction left, 1 active seconds, 2 charges, 3 armed
#[unsafe(no_mangle)]
pub extern "C" fn omg_tool_state(i: u32, field: u32) -> f32 {
    let gm = g();
    let i = i as usize; if i >= N_TOOLS { return 0.0; }
    let t = gm.tools[i];
    match field {
        0 => if i == opts::Tool::Upgrade as usize { if t.charges > 0 { 0.0 } else { m::clamp(t.cd / opts::TOOLS[i].cooldown, 0.0, 1.0) } } else { m::clamp(t.cd / opts::TOOLS[i].cooldown, 0.0, 1.0) },
        1 => t.active,
        2 => t.charges as f32,
        3 => if gm.upgrade_armed && i == opts::Tool::Upgrade as usize { 1.0 } else { 0.0 },
        _ => 0.0,
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_set_opt(i: u32, v: f32) {
    let gm = g();
    gm.opts.set(i as usize, v);
    if i as usize == Opt::RingSize as usize && !gm.started { gm.ring_r = gm.opts.get(Opt::RingSize); }
    gm.dirty_save = 0.4;
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_get_opt(i: u32) -> f32 { if (i as usize) < N_OPTS { g().opts.v[i as usize] } else { 0.0 } }
#[unsafe(no_mangle)]
pub extern "C" fn omg_set_lang(he: u32) { let gm = g(); gm.lang_he = he != 0; gm.dirty_save = 0.3; }
#[unsafe(no_mangle)]
pub extern "C" fn omg_get_lang() -> u32 { g().lang_he as u32 }
/// Keyboard: code 1 left, 2 right, 3 drop, 4..9 tools; down = 1 pressed / 0 released.
#[unsafe(no_mangle)]
pub extern "C" fn omg_key(code: u32, down: u32) { g().key(code, down != 0); }
#[unsafe(no_mangle)]
pub extern "C" fn omg_set_caption(p: *const u8, n: usize) {
    let s = str_from(p, n);
    let gm = g(); gm.caption.clear();
    for (i, c) in s.chars().enumerate() { if i >= 80 { break; } if c != '\n' && c != '\r' { gm.caption.push(c); } }
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_set_sandbox_tier(t: u32) {
    let gm = g(); let t = (t as u8).min(tiers::GOD - 1);
    if gm.unlocked & game::bit(t) != 0 {
        gm.sandbox_tier = t;
        if gm.mode == opts::Mode::Sandbox { gm.spout = t; gm.base = t as f32; gm.cat = tiers::cat_of(t); }
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_device_tilt(rad: f32) { if rad.is_finite() { g().device_tilt = m::clamp(rad, -0.65, 0.65); } }
#[unsafe(no_mangle)]
pub extern "C" fn omg_unlocked(t: u32) -> u32 { if (t as usize) < tiers::N_TIERS && g().unlocked & game::bit(t as u8) != 0 { 1 } else { 0 } }
#[unsafe(no_mangle)]
pub extern "C" fn omg_reset_progress() {
    let gm = g();
    gm.unlocked = 1; gm.stats = game::Stats::default(); gm.dirty_save = 0.1;
}
/// 0 started, 1 paused, 2 finished, 3 over, 4 mode, 5 run_max, 6 time, 7 spout, 8 merges(run), 9 drops(run), 10 ta_left, 11 god_t, 12 voice busy, 13 bodies, 14 era
#[unsafe(no_mangle)]
pub extern "C" fn omg_info(f: u32) -> f32 {
    let gm = g();
    match f {
        0 => gm.started as u32 as f32, 1 => gm.paused as u32 as f32, 2 => gm.finished as u32 as f32, 3 => gm.over as u32 as f32,
        4 => gm.mode as u32 as f32, 5 => gm.run_max as f32, 6 => gm.time, 7 => gm.spout as f32,
        8 => gm.run_merges as f32, 9 => gm.run_drops as f32, 10 => gm.ta_left, 11 => gm.god_t, 12 => gm.voice_playing() as u32 as f32,
        13 => gm.bodies.len() as f32, 14 => gm.cat as f32,
        _ => 0.0,
    }
}
/// 0 runs, 1 merges, 2 omgs, 3 drops, 4 gods, 5 played, 6 top tier, 7 time-attack best tier, 8 best combo, 10+m best time for mode m
#[unsafe(no_mangle)]
pub extern "C" fn omg_stat(f: u32) -> f32 {
    let s = &g().stats;
    match f {
        0 => s.runs as f32, 1 => s.merges as f32, 2 => s.omgs as f32, 3 => s.drops as f32, 4 => s.gods as f32,
        5 => s.played, 6 => s.top_tier as f32, 7 => s.best_tier_ta as f32, 8 => s.best_combo as f32,
        10..=17 => s.best[(f - 10) as usize],
        _ => 0.0,
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_save_ptr() -> *const u8 {
    let s = save::save(g());
    let b = SAVEBUF.get(); *b = Some(s);
    b.as_ref().unwrap().as_ptr()
}
#[unsafe(no_mangle)]
pub extern "C" fn omg_save_len() -> usize { SAVEBUF.get().as_ref().map(|s| s.len()).unwrap_or(0) }
#[unsafe(no_mangle)]
pub extern "C" fn omg_load(p: *const u8, n: usize) { let s = str_from(p, n); save::load(g(), s); }
