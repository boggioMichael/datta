//! Persistent data as plain `key=value` lines (the browser keeps the string in localStorage).

use alloc::string::String;
use core::fmt::Write;

use crate::game::Game;
use crate::opts::*;
use crate::tiers::N_TIERS;

pub fn save(g: &Game) -> String {
    let mut o = String::with_capacity(2048);
    let _ = writeln!(o, "v=1");
    for (i, d) in OPTS.iter().enumerate() { let _ = writeln!(o, "o.{}={}", d.key, g.opts.v[i]); }
    let _ = writeln!(o, "u={}", g.unlocked);
    let s = &g.stats;
    let _ = writeln!(o, "s.runs={}", s.runs);
    let _ = writeln!(o, "s.merges={}", s.merges);
    let _ = writeln!(o, "s.omgs={}", s.omgs);
    let _ = writeln!(o, "s.drops={}", s.drops);
    let _ = writeln!(o, "s.gods={}", s.gods);
    let _ = writeln!(o, "s.played={}", s.played);
    let _ = writeln!(o, "s.top={}", s.top_tier);
    let _ = writeln!(o, "s.ta={}", s.best_tier_ta);
    for (i, m) in MODES.iter().enumerate() { if s.best[i] > 0.0 { let _ = writeln!(o, "b.{}={}", m.key, s.best[i]); } }
    let _ = writeln!(o, "lang={}", if g.lang_he { "he" } else { "en" });
    o
}

fn parse_f(v: &str) -> Option<f32> {
    // minimal float parser: [-]digits[.digits][e[-]digits]
    let b = v.trim().as_bytes();
    if b.is_empty() { return None; }
    let mut i = 0; let mut neg = false;
    if b[0] == b'-' { neg = true; i = 1; }
    let mut x: f64 = 0.0; let mut any = false;
    while i < b.len() && b[i].is_ascii_digit() { x = x * 10.0 + (b[i] - b'0') as f64; i += 1; any = true; }
    if i < b.len() && b[i] == b'.' {
        i += 1; let mut f = 0.1;
        while i < b.len() && b[i].is_ascii_digit() { x += (b[i] - b'0') as f64 * f; f *= 0.1; i += 1; any = true; }
    }
    if i < b.len() && (b[i] == b'e' || b[i] == b'E') {
        i += 1; let mut en = false; if i < b.len() && b[i] == b'-' { en = true; i += 1; } else if i < b.len() && b[i] == b'+' { i += 1; }
        let mut e: i32 = 0; while i < b.len() && b[i].is_ascii_digit() { e = e * 10 + (b[i] - b'0') as i32; i += 1; }
        let mut p = 1.0f64; for _ in 0..e.min(40) { p *= 10.0; }
        if en { x /= p } else { x *= p }
    }
    if !any || i != b.len() { return None; }
    Some(if neg { -x as f32 } else { x as f32 })
}
fn parse_u(v: &str) -> Option<u64> {
    let mut x: u64 = 0; let v = v.trim(); if v.is_empty() { return None; }
    for c in v.bytes() { if !c.is_ascii_digit() { return None; } x = x.checked_mul(10)?.checked_add((c - b'0') as u64)?; }
    Some(x)
}

pub fn load(g: &mut Game, data: &str) {
    for line in data.lines() {
        let Some(eq) = line.find('=') else { continue };
        let (k, v) = (&line[..eq], &line[eq + 1..]);
        if let Some(key) = k.strip_prefix("o.") {
            if let Some(i) = OPTS.iter().position(|d| d.key == key) { if let Some(x) = parse_f(v) { g.opts.set(i, x); } }
        } else if let Some(key) = k.strip_prefix("b.") {
            if let Some(i) = MODES.iter().position(|m| m.key == key) { if let Some(x) = parse_f(v) { if x > 0.0 { g.stats.best[i] = x; } } }
        } else {
            match k {
                "u" => if let Some(u) = parse_u(v) { g.unlocked = (u | 1) & ((1u64 << N_TIERS) - 1); },
                "s.runs" => if let Some(u) = parse_u(v) { g.stats.runs = u as u32; },
                "s.merges" => if let Some(u) = parse_u(v) { g.stats.merges = u as u32; },
                "s.omgs" => if let Some(u) = parse_u(v) { g.stats.omgs = u as u32; },
                "s.drops" => if let Some(u) = parse_u(v) { g.stats.drops = u as u32; },
                "s.gods" => if let Some(u) = parse_u(v) { g.stats.gods = u as u32; },
                "s.played" => if let Some(x) = parse_f(v) { g.stats.played = x.max(0.0); },
                "s.top" => if let Some(u) = parse_u(v) { g.stats.top_tier = (u as u8).min(36); },
                "s.ta" => if let Some(u) = parse_u(v) { g.stats.best_tier_ta = (u as u8).min(36); },
                "lang" => g.lang_he = v.trim() != "en",
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn floats() {
        assert_eq!(parse_f("1"), Some(1.0));
        assert_eq!(parse_f("-0.5"), Some(-0.5));
        assert_eq!(parse_f("2.5e1"), Some(25.0));
        assert_eq!(parse_f("x"), None);
        assert_eq!(parse_u("123"), Some(123));
    }
}
