//! Persistent data as plain `key=value` lines (the browser keeps the string in localStorage).
//!
//! v3 stores the collection as a hex bit set over the 155-tier ladder (`u3=`). Older
//! saves are migrated by tier name, because v3 inserted new eras into the ladder.

use alloc::string::String;
use core::fmt::Write;

use crate::game::{Game, Mask};
use crate::opts::*;
use crate::tiers::{N_TIERS, TIERS};

/// The version-2 ladder, in its order, so old collections keep their rides.
static V2_KEYS: [&str; 124] = [
    "crawl", "walk", "run", "bicycle", "escooter", "ebike", "segway", "vespa", "supercub", "tuktuk", "quad", "harley",
    "ducati", "ninja", "picanto", "fiat500", "mini", "beetle", "corolla", "wrx", "mx5", "wrangler", "mustang", "models",
    "m5", "gclass", "rangerover", "p911", "gtr", "cobra", "gt40", "countach", "f40", "mclarenf1", "aventador", "laferrari",
    "phantom", "veyron", "chiron", "zonda", "huayra", "jesko", "nevera", "boattail", "f1", "monstertruck", "belaz", "bagger",
    "thrustssc", "steam", "orientexpress", "tgv", "shinkansen", "maglev", "hyperloop", "jetski", "speedboat", "ac75", "trieste", "superyacht",
    "cruiseship", "carrier", "balloon", "wright", "zeppelin", "cessna", "helicopter", "g650", "b747", "a380", "an225", "concorde",
    "f35", "sr71", "b2", "x15", "vostok", "saturnv", "lunarrover", "shuttle", "soyuz", "perseverance", "falcon9", "starship",
    "iss", "voyager", "parker", "hoverboard", "jetpack", "flyingcar", "mech", "ufo", "starfighter", "warpdrive", "teleporter", "wormhole",
    "timemachine", "planetengine", "mushika", "talaria", "freyja", "wukong", "pegasus", "sleipnir", "thor", "skidbladnir", "torifune", "garuda",
    "airavata", "hippocampi", "pushpaka", "ra", "helios", "ark", "jonah", "eagles", "ladder", "kfitzat", "pillar", "elijah",
    "merkavah", "cherub", "donkey", "god",
];
fn index_of(key: &str) -> Option<u8> { TIERS.iter().position(|t| t.key == key).map(|i| i as u8) }
fn from_v2(i: usize) -> Option<u8> { V2_KEYS.get(i).and_then(|k| index_of(k)) }

pub fn save(g: &Game) -> String {
    let mut o = String::with_capacity(2048);
    let _ = writeln!(o, "v=3");
    for (i, d) in OPTS.iter().enumerate() { let _ = writeln!(o, "o.{}={}", d.key, g.opts.v[i]); }
    let _ = writeln!(o, "u3={}", g.unlocked.hex());
    let s = &g.stats;
    let _ = writeln!(o, "s.runs={}", s.runs);
    let _ = writeln!(o, "s.merges={}", s.merges);
    let _ = writeln!(o, "s.omgs={}", s.omgs);
    let _ = writeln!(o, "s.drops={}", s.drops);
    let _ = writeln!(o, "s.gods={}", s.gods);
    let _ = writeln!(o, "s.played={}", s.played);
    let _ = writeln!(o, "s.top3={}", s.top_tier);
    let _ = writeln!(o, "s.ta3={}", s.best_tier_ta);
    let _ = writeln!(o, "s.combo={}", s.best_combo);
    for (i, m) in MODES.iter().enumerate() { if s.best[i] > 0.0 { let _ = writeln!(o, "b3.{}={}", m.key, s.best[i]); } }
    for (i, d) in crate::skill::DIFFS.iter().enumerate() { if s.best_evo[i] > 0.0 { let _ = writeln!(o, "bj.{}={}", d.key, s.best_evo[i]); } }
    let _ = writeln!(o, "lang={}", if g.lang_he { "he" } else { "en" });
    // the journey in progress, and the start of its era (where a burst sends you back)
    if let Some(r) = g.live_snap() { let _ = writeln!(o, "run.live={}", r.to_str()); }
    if g.live_snap().is_some() { if let Some(r) = &g.run_ckpt { let _ = writeln!(o, "run.ckpt={}", r.to_str()); } }
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

/// Options a version-1 save may carry over (its ladder, physics and tiers meant
/// something else, so everything else starts fresh).
const V1_KEEP: &[&str] = &["vol", "volvoice", "volsfx", "volmusic", "voicestyle", "music", "flashes", "shake", "haptics", "caption", "labels", "timer"];
/// Options whose meaning changed in version 3 (absolute sizes and the zoom, and
/// the new look: the living bubble and its cells replace the ring and stickers).
const V2_DROP: &[&str] = &["ringsize", "sizegrow", "theme", "ballstyle"];

pub fn load(g: &mut Game, data: &str) {
    let ver = data.lines().find_map(|l| l.trim().strip_prefix("v=").and_then(|v| parse_u(v))).unwrap_or(1);
    for line in data.lines() {
        let Some(eq) = line.find('=') else { continue };
        let (k, v) = (&line[..eq], &line[eq + 1..]);
        if let Some(key) = k.strip_prefix("o.") {
            if ver < 2 && !V1_KEEP.contains(&key) { continue; }
            if ver < 3 && V2_DROP.contains(&key) { continue; }
            if let Some(i) = OPTS.iter().position(|d| d.key == key) { if let Some(x) = parse_f(v) { g.opts.set(i, x); } }
        } else if let Some(key) = k.strip_prefix("bj.") {
            if let Some(i) = crate::skill::DIFFS.iter().position(|d| d.key == key) { if let Some(x) = parse_f(v) { if x > 0.0 { g.stats.best_evo[i] = x; } } }
        } else if k == "run.live" {
            g.run_live = crate::skill::Snap::parse(v);
        } else if k == "run.ckpt" {
            g.run_ckpt = crate::skill::Snap::parse(v);
        } else if let Some(key) = k.strip_prefix("b3.") {
            if let Some(i) = MODES.iter().position(|m| m.key == key) { if let Some(x) = parse_f(v) { if x > 0.0 { g.stats.best[i] = x; } } }
        } else {
            match k {
                "u3" => if let Some(mut m) = Mask::from_hex(v) {
                    // only real tiers
                    let mut clean = Mask::ONE;
                    for t in 0..N_TIERS { if m.has(t as u8) { clean.set(t as u8); } }
                    m = clean; g.unlocked = m;
                },
                "u2" => if ver == 2 { if let Some(m) = Mask::from_hex(v) {
                    for i in 0..V2_KEYS.len() { if m.has(i as u8) { if let Some(t) = from_v2(i) { g.unlocked.set(t); } } }
                } },
                "s.runs" => if let Some(u) = parse_u(v) { g.stats.runs = u as u32; },
                "s.merges" => if let Some(u) = parse_u(v) { g.stats.merges = u as u32; },
                "s.omgs" => if let Some(u) = parse_u(v) { g.stats.omgs = u as u32; },
                "s.drops" => if let Some(u) = parse_u(v) { g.stats.drops = u as u32; },
                "s.gods" => if let Some(u) = parse_u(v) { g.stats.gods = u as u32; },
                "s.played" => if let Some(x) = parse_f(v) { g.stats.played = x.max(0.0); },
                "s.top3" => if let Some(u) = parse_u(v) { g.stats.top_tier = (u as usize).min(N_TIERS - 1) as u8; },
                "s.ta3" => if let Some(u) = parse_u(v) { g.stats.best_tier_ta = (u as usize).min(N_TIERS - 1) as u8; },
                "s.top" => if ver == 2 { if let Some(t) = parse_u(v).and_then(|u| from_v2(u as usize)) { g.stats.top_tier = g.stats.top_tier.max(t); } },
                "s.ta" => if ver == 2 { if let Some(t) = parse_u(v).and_then(|u| from_v2(u as usize)) { g.stats.best_tier_ta = g.stats.best_tier_ta.max(t); } },
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
        let mut m = Mask::default(); m.set(0); m.set(70); m.set(154);
        assert_eq!(Mask::from_hex(&m.hex()), Some(m));
        assert_eq!(Mask::from_hex("ff").map(|m| m.count()), Some(8));
    }
    #[test]
    fn old_saves_keep_only_safe_options() {
        let mut g = Game::new(1);
        load(&mut g, "v=1\no.bounce=0.42\no.vol=0.3\nu=127\ns.runs=5\ns.top=30\nlang=en\n");
        assert_eq!(g.opts.get(Opt::Bounce), 0.8);
        assert_eq!(g.opts.get(Opt::VolMaster), 0.3);
        assert_eq!(g.unlocked, Mask::ONE);
        assert_eq!(g.stats.runs, 5);
        assert_eq!(g.stats.top_tier, 0);
        assert!(!g.lang_he);
    }
    #[test]
    fn v2_collections_follow_their_rides() {
        // v2: tier 14 was the Picanto, 79 the Space Shuttle, 122 the Messiah's donkey
        let mut g = Game::new(1);
        let mut m = Mask::default(); m.set(0); m.set(14); m.set(79); m.set(122);
        load(&mut g, &alloc::format!("v=2\no.ringsize=1.3\no.bounce=0.5\no.theme=0\no.ballstyle=0\nu2={}\ns.top=79\nb.classic=300\n", m.hex()));
        let has = |k: &str| g.unlocked.has(index_of(k).unwrap());
        assert!(has("crawl") && has("picanto") && has("shuttle") && has("donkey"));
        assert!(!has("vespa") && !has("burro"));
        assert_eq!(TIERS[g.stats.top_tier as usize].key, "shuttle");
        assert_eq!(g.opts.get(Opt::Bounce), 0.5);
        assert_eq!(g.opts.get(Opt::RingSize), Options::new().get(Opt::RingSize));
        assert_eq!(g.opts.get(Opt::Theme), 6.0, "returning players get the living bubble");
        assert_eq!(g.opts.get(Opt::BallStyle), 4.0);
        assert_eq!(g.stats.best[0], 0.0, "v2 records were set on a different ladder");
        // and a v3 save round-trips
        let s = save(&g);
        let mut g2 = Game::new(2);
        load(&mut g2, &s);
        assert_eq!(g2.unlocked, g.unlocked);
        assert_eq!(g2.stats.top_tier, g.stats.top_tier);
    }
}
