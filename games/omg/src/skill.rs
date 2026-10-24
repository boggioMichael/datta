//! The journey (the Classic mode, "Evolution"): a game of skill.
//!
//! You aim every cell the stem gives you and decide when it falls; the stem shows
//! what comes next. The bubble has a strain line: if the pile stays above it, the
//! bubble bursts and you go back to the beginning of the era — every era is a
//! checkpoint. Every era brings a law of nature to understand (wind, thin air,
//! scrap, antimatter, divine cells…) and the abilities unlock as you evolve,
//! charged by chain reactions. A good player needs hours to reach God.

use alloc::string::String;
use alloc::vec::Vec;
use core::fmt::Write;

use crate::game::Mask;
use crate::m::*;
use crate::opts::{Tool, N_TOOLS};
use crate::tiers::{GOD, N_CATS};

// ── cell kinds
pub const K_CELL: u8 = 0;
/// Never fuses; a fusion that touches it smashes it.
pub const K_SCRAP: u8 = 1;
/// Annihilates the first small cell (or scrap) it touches; big cells push it away.
pub const K_ANTI: u8 = 2;
/// Lifts the cell it touches one tier, unless that cell is the biggest one.
pub const K_DIVINE: u8 = 3;

/// Where the cell in hand hangs, under the pore (ring radii, y down).
pub const HOLD_Y: f32 = -0.74;
/// Seconds a special cell lingers before it fades if it found nothing to do.
pub const SPECIAL_LIFE: f32 = 24.0;
/// Each retry of an era stretches the strain window by MERCY_STEP and raises the line (more room) by
/// MERCY_LINE (ring radii), for up to MERCY_MAX retries.
pub const MERCY_STEP: f32 = 0.12;
pub const MERCY_LINE: f32 = 0.012;
pub const MERCY_MAX: u32 = 6;

#[derive(Clone, Copy)]
pub struct Diff {
    pub key: &'static str,
    pub he: &'static str, pub en: &'static str,
    pub dhe: &'static str, pub den: &'static str,
    /// tiers in the bubble before the stem's cells grow (2^(gap−1) cells per new tier)
    pub gap: u8,
    /// how much wider each tier is than the one below
    pub grow: f32,
    /// the newest tier's radius when it appears (ring radii)
    pub max_ball: f32,
    /// seconds the pile may stay above the strain line
    pub strain_s: f32,
    /// the strain line (ring radii, negative is above the centre)
    pub line: f32,
    /// scales scrap and antimatter
    pub hazard: f32,
    /// scales bigger cells from the stem
    pub litter: f32,
    /// a chain this long earns an ability charge
    pub chain: u16,
    /// 1: show where the cell will land
    pub ghost: bool,
    /// seconds the stem needs for the next cell
    pub cooldown: f32,
    /// charges a new ability arrives with
    pub charges0: u8,
    pub bounce: f32,
}
pub const N_DIFF: usize = 4;
pub static DIFFS: [Diff; N_DIFF] = [
    Diff { key: "relaxed", he: "רגוע", en: "Relaxed", dhe: "קו לחץ סלחני עם הרבה מקום, רואים איפה התא ינחת, פחות גרוטאות. בערך שעתיים עד אלוהים.", den: "A forgiving strain line with lots of room, you see where each cell will land, less scrap. About two hours to God.",
        gap: 5, grow: 1.32, max_ball: 0.40, strain_s: 6.0, line: -0.32, hazard: 0.5, litter: 0.7, chain: 2, ghost: true, cooldown: 0.6, charges0: 2, bounce: 0.3 },
    Diff { key: "normal", he: "רגיל", en: "Normal", dhe: "המסע כמו שהוא. שחקן טוב יגיע לאלוהים בארבע עד חמש שעות.", den: "The journey as it is meant. A good player reaches God in four to five hours.",
        gap: 6, grow: 1.32, max_ball: 0.40, strain_s: 3.5, line: -0.12, hazard: 1.0, litter: 1.0, chain: 3, ghost: false, cooldown: 0.75, charges0: 1, bounce: 0.3 },
    Diff { key: "hard", he: "קשה", en: "Hard", dhe: "פחות מקום מתחת לקו, שתי שניות של חסד, יותר גרוטאות ותאים גדולים. רק למדויקים.", den: "Less room under the line, two seconds of grace, more scrap and bigger cells. For the precise only.",
        gap: 6, grow: 1.32, max_ball: 0.40, strain_s: 2.4, line: -0.08, hazard: 1.3, litter: 1.2, chain: 4, ghost: false, cooldown: 0.75, charges0: 1, bounce: 0.3 },
    Diff { key: "epic", he: "אפי", en: "Epic", dhe: "החוקים של רגיל, אבל כל דרגה דורשת פי שניים תאים. מרתון של ערב שלם ויותר.", den: "Normal's rules, but every tier takes twice the cells. A marathon of a whole evening and more.",
        gap: 7, grow: 1.30, max_ball: 0.40, strain_s: 3.5, line: -0.12, hazard: 1.0, litter: 1.0, chain: 3, ghost: false, cooldown: 0.75, charges0: 1, bounce: 0.3 },
];
#[inline] pub fn diff(i: u8) -> &'static Diff { &DIFFS[(i as usize).min(N_DIFF - 1)] }

// ── the law of each era
pub const E_NURSERY: u8 = 0;
pub const E_STRAIN: u8 = 1;
pub const E_LITTERS: u8 = 2;
pub const E_RUSH: u8 = 3;
pub const E_SPACIOUS: u8 = 4;
pub const E_SPEED: u8 = 5;
pub const E_SLAM: u8 = 6;
pub const E_SCRAP: u8 = 7;
pub const E_MONSTER: u8 = 8;
pub const E_SWAY: u8 = 9;
pub const E_WIND: u8 = 10;
pub const E_TIDES: u8 = 11;
pub const E_THIN: u8 = 12;
pub const E_ORBIT: u8 = 13;
pub const E_ANTI: u8 = 14;
pub const E_WELLS: u8 = 15;
pub const E_DIVINE: u8 = 16;
pub const E_MIRACLES: u8 = 17;
pub const E_NARROW: u8 = 18;

pub struct Law {
    pub icon: &'static str,
    pub he: &'static str, pub en: &'static str,
    pub dhe: &'static str, pub den: &'static str,
    /// the ability that unlocks in this era (−1: none)
    pub tool: i8,
}
const NO: i8 = -1;
pub static LAWS: [Law; N_CATS] = [
    Law { icon: "🍼", he: "חדר התינוקות", en: "The nursery",
        dhe: "גררו כדי לכוון, שחררו כדי להפיל. שני תאים זהים שנוגעים מתאחדים. כאן הבועה עוד לא מתפוצצת.",
        den: "Drag to aim, let go to drop. Two identical cells that touch fuse. Here the bubble can't burst yet.", tool: NO },
    Law { icon: "〰", he: "קו הלחץ", en: "The strain line",
        dhe: "מעכשיו: ערימה שנשארת מעל הקו מפוצצת את הבועה. כל עידן חדש נשמר — מתפוצצים, וחוזרים לתחילתו.",
        den: "From now on, a pile that stays above the line bursts the bubble. Every new era is saved: burst, and you're back at its start.", tool: Tool::Shake as i8 },
    Law { icon: "🥚", he: "המלטה מעורבת", en: "Mixed litters",
        dhe: "לפעמים הגבעול נותן תא גדול בדרגה. בגבעול רואים מה מגיע.",
        den: "Sometimes the stem gives a cell one tier up. The stem shows what's coming.", tool: NO },
    Law { icon: "🚦", he: "שעת עומס", en: "Rush hour",
        dhe: "מדי פעם הגבעול נפתח: התאים מגיעים מהר, ומי שמהסס — התא נופל לבד.",
        den: "Now and then the stem opens up: cells come fast, and if you hesitate they drop on their own.", tool: Tool::SlowMo as i8 },
    Law { icon: "🛋", he: "מרווח", en: "Room to breathe",
        dhe: "עידן נדיב: קו הלחץ עולה ויש יותר מקום.",
        den: "A generous era: the strain line rises and there's more room.", tool: NO },
    Law { icon: "⚡", he: "מהירות", en: "Speed",
        dhe: "הכבידה חזקה והכול קופץ יותר. מכוונים בזהירות.",
        den: "Gravity is stronger and everything bounces more. Aim with care.", tool: Tool::Magnet as i8 },
    Law { icon: "☄", he: "הטחה", en: "The slam",
        dhe: "יכולת חדשה: החליקו למטה כשאתם משחררים, והתא נוחת בעוצמה ודוחף את מה שמתחתיו.",
        den: "A new ability: flick down as you let go, and the cell slams in and shoves what's below.", tool: NO },
    Law { icon: "🧱", he: "גרוטאות", en: "Scrap",
        dhe: "לפעמים מגיעה גרוטה שלא מתאחדת עם כלום. איחוד שנוגע בה מנפץ אותה.",
        den: "Sometimes a lump of scrap arrives that fuses with nothing. A fusion that touches it smashes it.", tool: Tool::Bomb as i8 },
    Law { icon: "🦖", he: "גורים מפלצתיים", en: "Monster litters",
        dhe: "לפעמים מגיע תא גדול בשתי דרגות.",
        den: "Sometimes a cell two tiers up arrives.", tool: NO },
    Law { icon: "🚂", he: "נדנוד", en: "Sway",
        dhe: "הבועה מתנדנדת כמו קרון רכבת. תזמנו את ההפלות.",
        den: "The bubble sways like a railway car. Time your drops.", tool: NO },
    Law { icon: "🌬", he: "רוח", en: "Wind",
        dhe: "רוח צד דוחפת את הכול ומחליפה כיוון. כוונו אל תוך הרוח.",
        den: "A crosswind pushes everything and changes direction. Aim into the wind.", tool: NO },
    Law { icon: "🌊", he: "גאות ושפל", en: "Tides",
        dhe: "קו הלחץ עולה ויורד כמו הים. כשהגאות מגיעה, הערימה צריכה להיות נמוכה.",
        den: "The strain line rises and falls like the sea. When the tide comes in, keep the pile low.", tool: Tool::Flip as i8 },
    Law { icon: "🪶", he: "אוויר דליל", en: "Thin air",
        dhe: "כבידה חלשה: הכול מרחף, קופץ גבוה ושוקע לאט.",
        den: "Weak gravity: everything floats, bounces high and settles slowly.", tool: NO },
    Law { icon: "🪐", he: "מסלול", en: "Orbit",
        dhe: "כיוון הכבידה מסתובב לאט, והערימה זזה איתו.",
        den: "The direction of gravity slowly turns, and the pile moves with it.", tool: NO },
    Law { icon: "⚫", he: "אנטי־חומר", en: "Antimatter",
        dhe: "לפעמים מגיע תא אנטי־חומר: הוא מחסל את התא הקטן הראשון שהוא נוגע בו, וגם גרוטאות. תאים גדולים הודפים אותו.",
        den: "Sometimes an antimatter cell arrives: it annihilates the first small cell it touches, and scrap too. Big cells push it away.", tool: NO },
    Law { icon: "🌀", he: "בארות כבידה", en: "Gravity wells",
        dhe: "תאים זהים נמשכים זה לזה בכוח.",
        den: "Identical cells pull hard toward each other.", tool: NO },
    Law { icon: "✨", he: "תאים אלוהיים", en: "Divine cells",
        dhe: "לפעמים מגיע תא זהב: הוא מעלה בדרגה את התא שהוא נוגע בו — כל עוד זה לא הגדול שלכם.",
        den: "Sometimes a golden cell arrives: it lifts the cell it touches one tier, as long as that's not your biggest.", tool: NO },
    Law { icon: "🌩", he: "ניסים", en: "Miracles",
        dhe: "רעידות, רוחות, אפס כבידה ושעות עומס — בלי אזהרה.",
        den: "Quakes, winds, zero gravity and rushes, without warning.", tool: Tool::Upgrade as i8 },
    Law { icon: "🕊", he: "הדרך הצרה", en: "The narrow way",
        dhe: "קו הלחץ יורד. יש מקום רק למי שמדויק.",
        den: "The strain line comes down. There's room only for the precise.", tool: NO },
    Law { icon: "", he: "", en: "", dhe: "", den: "", tool: NO },
];
/// The era in which each ability (Tool order) becomes yours.
pub fn tool_era(i: usize) -> u8 {
    for (e, l) in LAWS.iter().enumerate() { if l.tool as i32 == i as i32 { return e as u8; } }
    255
}

/// What the stem gives next: (tier, kind).
pub fn next_cell(rng: &mut Rng, spout: u8, era: u8, d: Diff) -> (u8, u8) {
    let top = GOD - 1;
    let r = rng.f();
    let mut acc = 0.0;
    let mut p = |x: f32| { acc += x; r < acc };
    if era >= E_DIVINE && p(0.018) { return (spout.min(top), K_DIVINE); }
    if era >= E_ANTI && p(0.03 * d.hazard) { return ((spout + 1).min(top), K_ANTI); }
    if era >= E_SCRAP && p(0.06 * d.hazard) { return ((spout + 1).min(top), K_SCRAP); }
    if era >= E_MONSTER && p(0.05 * d.litter) { return ((spout + 2).min(top), K_CELL); }
    if era >= E_LITTERS && p(0.16 * d.litter) { return ((spout + 1).min(top), K_CELL); }
    (spout.min(top), K_CELL)
}

/// Where a cell of radius `r` falling from `p0` along the unit direction `d` first
/// touches something: (where its centre is then, the body it touches or None for the wall).
pub fn landing(bodies: &[crate::game::Body], ring_r: f32, p0: V2, d: V2, r: f32) -> (V2, Option<usize>) {
    let rr = (ring_r - r).max(0.0);
    let (b0, c0) = (d.dot(p0), p0.len2() - rr * rr);
    let mut best = if c0 < 0.0 { -b0 + sqrt((b0 * b0 - c0).max(0.0)) } else { 0.0 };
    let mut hit = None;
    for (i, b) in bodies.iter().enumerate() {
        if !b.alive || b.dying > 0.0 { continue; }
        let m = r + b.r;
        let w = p0 - b.p;
        let (bb, cc) = (d.dot(w), w.len2() - m * m);
        if cc < 0.0 { continue; }
        let disc = bb * bb - cc;
        if disc < 0.0 { continue; }
        let s = -bb - sqrt(disc);
        if s > 0.0 && s < best { best = s; hit = Some(i); }
    }
    (p0 + d * best, hit)
}

/// The furthest the cell in hand can go to either side.
pub fn aim_limit(ring_r: f32, r: f32) -> f32 {
    let m = (ring_r - r) * 0.985;
    sqrt((m * m - HOLD_Y * HOLD_Y * ring_r * ring_r).max(0.0))
}

/// A frozen moment of a journey: the start of an era (to come back to after a
/// burst) or wherever the player left off (to continue later).
#[derive(Clone, Default, PartialEq, Debug)]
pub struct Snap {
    pub diff: u8,
    pub time: f32,
    pub spout: u8,
    pub run_max: u8,
    pub seen: Mask,
    pub cat: u8,
    pub era_time: Vec<f32>,
    pub merges: u32,
    pub drops: u32,
    pub babies: f64,
    pub bursts: u32,
    pub era_tries: u32,
    pub charges: [u8; N_TOOLS],
    /// the cell in hand and the next two: (tier, kind)
    pub queue: [(u8, u8); 3],
    /// tier, kind, x, y
    pub bodies: Vec<(u8, u8, f32, f32)>,
}

impl Snap {
    pub fn to_str(&self) -> String {
        let mut o = String::with_capacity(64 + self.bodies.len() * 22);
        let _ = write!(o, "1,{},{:.2},{},{},{},{},{},{},{:.0},{},{}", self.diff, self.time, self.spout, self.run_max, self.seen.hex(), self.cat, self.merges, self.drops, self.babies, self.bursts, self.era_tries);
        o.push('|');
        for (i, t) in self.era_time.iter().enumerate() { if i > 0 { o.push(','); } let _ = write!(o, "{:.1}", t); }
        o.push('|');
        for (i, c) in self.charges.iter().enumerate() { if i > 0 { o.push(','); } let _ = write!(o, "{}", c); }
        o.push('|');
        for (i, (t, k)) in self.queue.iter().enumerate() { if i > 0 { o.push(','); } let _ = write!(o, "{}:{}", t, k); }
        o.push('|');
        for (i, (t, k, x, y)) in self.bodies.iter().enumerate() { if i > 0 { o.push(';'); } let _ = write!(o, "{}:{}:{:.4}:{:.4}", t, k, x, y); }
        o
    }
    pub fn parse(s: &str) -> Option<Snap> {
        let mut parts = s.trim().split('|');
        let head: Vec<&str> = parts.next()?.split(',').collect();
        if head.len() < 12 || head[0] != "1" { return None; }
        let u = |v: &str| v.trim().parse::<u32>().ok();
        let f = |v: &str| v.trim().parse::<f32>().ok().filter(|x| x.is_finite());
        let mut sn = Snap {
            diff: (u(head[1])? as usize).min(N_DIFF - 1) as u8,
            time: f(head[2])?.max(0.0),
            spout: (u(head[3])? as u8).min(GOD - 1),
            run_max: (u(head[4])? as u8).min(GOD - 1),
            seen: Mask::from_hex(head[5])?,
            cat: (u(head[6])? as usize).min(N_CATS - 1) as u8,
            merges: u(head[7])?,
            drops: u(head[8])?,
            babies: head[9].trim().parse::<f64>().ok().filter(|x| x.is_finite())?,
            bursts: u(head[10])?,
            era_tries: u(head[11])?,
            ..Default::default()
        };
        sn.era_time = parts.next()?.split(',').filter_map(|v| f(v)).collect();
        if sn.era_time.len() != N_CATS { return None; }
        let ch: Vec<u8> = parts.next()?.split(',').filter_map(|v| u(v).map(|x| x.min(9) as u8)).collect();
        if ch.len() != N_TOOLS { return None; }
        sn.charges.copy_from_slice(&ch);
        let q: Vec<(u8, u8)> = parts.next()?.split(',').filter_map(|v| { let mut it = v.split(':'); Some(((u(it.next()?)? as u8).min(GOD - 1), (u(it.next()?)? as u8).min(K_DIVINE))) }).collect();
        if q.len() != 3 { return None; }
        sn.queue = [q[0], q[1], q[2]];
        if let Some(b) = parts.next() {
            for item in b.split(';') {
                if item.is_empty() { continue; }
                let v: Vec<&str> = item.split(':').collect();
                if v.len() != 4 { return None; }
                let t = (u(v[0])? as u8).min(GOD - 1);
                let k = (u(v[1])? as u8).min(K_DIVINE);
                let (x, y) = (f(v[2])?, f(v[3])?);
                if x * x + y * y > 1.2 { continue; }
                sn.bodies.push((t, k, x, y));
                if sn.bodies.len() >= 400 { break; }
            }
        }
        Some(sn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn snapshot_round_trip() {
        let mut s = Snap { diff: 1, time: 1234.5, spout: 17, run_max: 23, cat: 3, merges: 400, drops: 900, babies: 1.5e9, bursts: 2, era_tries: 3, ..Default::default() };
        s.seen = Mask::ONE; s.seen.set(23);
        s.era_time = (0..N_CATS).map(|i| if i < 4 { i as f32 * 100.0 } else { -1.0 }).collect();
        s.charges = [1, 0, 2, 0, 0, 0];
        s.queue = [(17, 0), (18, 1), (17, 0)];
        s.bodies = alloc::vec![(17, 0, 0.1, 0.5), (23, 0, -0.3, 0.6), (18, 1, 0.4, 0.2)];
        let txt = s.to_str();
        let back = Snap::parse(&txt).expect("parses");
        assert_eq!(back.spout, 17); assert_eq!(back.run_max, 23); assert_eq!(back.queue, s.queue);
        assert_eq!(back.bodies.len(), 3); assert_eq!(back.charges, s.charges); assert_eq!(back.era_time.len(), N_CATS);
        assert!(Snap::parse("garbage").is_none());
        assert!(Snap::parse("1,1,2|x").is_none());
    }
    #[test]
    fn laws_cover_every_era_and_tool() {
        for i in 0..N_TOOLS { assert!(tool_era(i) < 19, "tool {i} never unlocks"); }
        assert_eq!(LAWS.len(), N_CATS);
    }
}
