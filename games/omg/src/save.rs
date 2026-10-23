//! Persistent data as plain `key=value` lines (the browser keeps the string in localStorage).

use alloc::string::String;
use core::fmt::Write;

use crate::game::Game;
use crate::opts::*;
use crate::tiers::N_TIERS;

#[cfg(test)]
mod v1 {
    use super::*;
    #[test]
    fn old_saves_keep_only_safe_options() {
        let mut g = Game::new(1);
        load(&mut g, "v=1\no.bounce=0.42\no.vol=0.3\nu=127\ns.runs=5\ns.top=30\nlang=en\n");
        assert_eq!(g.opts.get(Opt::Bounce), 0.8);
        assert_eq!(g.opts.get(Opt::VolMaster), 0.3);
        assert_eq!(g.unlocked, 1);
        assert_eq!(g.stats.runs, 5);
        assert_eq!(g.stats.top_tier, 0);
        assert!(!g.lang_he);
        let s = save(&g);
        let mut g2 = Game::new(2);
        g2.unlocked = 0;
        load(&mut g2, &s);
        assert_eq!(g2.stats.runs, 5);
        g.unlocked = (1u128 << 123) | 1;
        let s = save(&g);
        load(&mut g2, &s);
        assert_eq!(g2.unlocked, (1u128 << 123) | 1);
    }
}

pub fn save(g: &Game) -> String {
    let mut o = String::with_capacity(2048);
    let _ = writeln!(o, "v=2");
    for (i, d) in OPTS.iter().enumerate() { let _ = writeln!(o, "o.{}={}", d.key, g.opts.v[i]); }
    let _ = writeln!(o, "u2={:x}", g.unlocked);
    let s = &g.stats;
    let _ = writeln!(o, "s.runs={}", s.runs);
    let _ = writeln!(o, "s.merges={}", s.merges);
    let _ = writeln!(o, "s.omgs={}", s.omgs);
    let _ = writeln!(o, "s.drops={}", s.drops);
    let _ = writeln!(o, "s.gods={}", s.gods);
    let _ = writeln!(o, "s.played={}", s.played);
    let _ = writeln!(o, "s.top={}", s.top_tier);
    let _ = writeln!(o, "s.ta={}", s.best_tier_ta);
    let _ = writeln!(o, "s.combo={}", s.best_combo);
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
fn parse_hex(v: &str) -> Option<u128> {
    let v = v.trim(); if v.is_empty() || v.len() > 32 { return None; }
    let mut x: u128 = 0;
    for c in v.bytes() {
        let d = match c { b'0'..=b'9' => c - b'0', b'a'..=b'f' => c - b'a' + 10, b'A'..=b'F' => c - b'A' + 10, _ => return None };
        x = (x << 4) | d as u128;
    }
    Some(x)
}
fn parse_u(v: &str) -> Option<u64> {
    let mut x: u64 = 0; let v = v.trim(); if v.is_empty() { return None; }
    for c in v.bytes() { if !c.is_ascii_digit() { return None; } x = x.checked_mul(10)?.checked_add((c - b'0') as u64)?; }
    Some(x)
}

/// Options a version-1 save may carry over (its ladder, physics and tiers meant
/// something else, so everything else starts fresh).
const V1_KEEP: &[&str] = &["vol", "volvoice", "volsfx", "volmusic", "voicestyle", "music", "flashes", "shake", "haptics", "caption", "labels", "timer"];

pub fn load(g: &mut Game, data: &str) {
    let v1 = !data.lines().any(|l| l.trim() == "v=2");
    for line in data.lines() {
        let Some(eq) = line.find('=') else { continue };
        let (k, v) = (&line[..eq], &line[eq + 1..]);
        if let Some(key) = k.strip_prefix("o.") {
            if v1 && !V1_KEEP.contains(&key) { continue; }
            if let Some(i) = OPTS.iter().position(|d| d.key == key) { if let Some(x) = parse_f(v) { g.opts.set(i, x); } }
        } else if let Some(key) = k.strip_prefix("b.") {
            if v1 { continue; }
            if let Some(i) = MODES.iter().position(|m| m.key == key) { if let Some(x) = parse_f(v) { if x > 0.0 { g.stats.best[i] = x; } } }
        } else {
            match k {
                "u2" => if let Some(u) = parse_hex(v) { g.unlocked = (u | 1) & ((1u128 << N_TIERS) - 1); },
                "s.runs" => if let Some(u) = parse_u(v) { g.stats.runs = u as u32; },
                "s.merges" => if let Some(u) = parse_u(v) { g.stats.merges = u as u32; },
                "s.omgs" => if let Some(u) = parse_u(v) { g.stats.omgs = u as u32; },
                "s.drops" => if let Some(u) = parse_u(v) { g.stats.drops = u as u32; },
                "s.gods" => if let Some(u) = parse_u(v) { g.stats.gods = u as u32; },
                "s.played" => if let Some(x) = parse_f(v) { g.stats.played = x.max(0.0); },
                "s.top" => if !v1 { if let Some(u) = parse_u(v) { g.stats.top_tier = (u as usize).min(N_TIERS - 1) as u8; } },
                "s.ta" => if !v1 { if let Some(u) = parse_u(v) { g.stats.best_tier_ta = (u as usize).min(N_TIERS - 1) as u8; } },
                "s.combo" => if let Some(u) = parse_u(v) { g.stats.best_combo = u as u32; },
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
        assert_eq!(parse_hex("ff"), Some(255));
        assert_eq!(parse_hex(&alloc::format!("{:x}", 1u128 << 122)), Some(1u128 << 122));
        assert_eq!(parse_hex("4000000000000000000000000000000"), Some(1u128 << 122));
    }
}
