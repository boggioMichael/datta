//! Everything the player can change: modes, tools and settings.
//! The browser builds its menus from this table (exported as JSON).

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Mode { Classic = 0, Watch = 1, Chaos = 2, Mega = 3, Trampoline = 4, BlackHole = 5, TimeAttack = 6, Sandbox = 7 }
pub const N_MODES: usize = 8;
impl Mode {
    pub fn from(i: u32) -> Mode {
        match i { 1 => Mode::Watch, 2 => Mode::Chaos, 3 => Mode::Mega, 4 => Mode::Trampoline, 5 => Mode::BlackHole, 6 => Mode::TimeAttack, 7 => Mode::Sandbox, _ => Mode::Classic }
    }
}
pub struct ModeInfo { pub key: &'static str, pub icon: &'static str, pub he: &'static str, pub en: &'static str, pub dhe: &'static str, pub den: &'static str }
pub static MODES: [ModeInfo; N_MODES] = [
    ModeInfo { key: "classic", icon: "🏁", he: "קלאסי", en: "Classic",
        dhe: "תמיד מתחילים מזחילה. נגיעה מפילה עוד אחד, גרירה מטה את הכבידה. כמה זמן ייקח לך להגיע לאלוהים?",
        den: "Every run starts with a crawl. Tap to drop one more, drag to tilt gravity. How fast can you reach God?" },
    ModeInfo { key: "watch", icon: "🍿", he: "צפייה", en: "Watch",
        dhe: "סימולציה אוטומטית כמו ברילז. לשבת, להקליט ולשמוע את ה־OMG מתעצם.",
        den: "A hands-off simulation, like the reel. Sit back, record, and let the OMGs escalate." },
    ModeInfo { key: "chaos", icon: "🌪️", he: "כאוס", en: "Chaos",
        dhe: "פי שניים טפטוף, פורטלים בתוך הטבעת ופריטים מדרגות שונות.",
        den: "Double the drip, portals inside the ring and mixed tiers." },
    ModeInfo { key: "mega", icon: "🌌", he: "מגה", en: "Mega",
        dhe: "טבעת ענקית, מאות כדורים, מבול מהפיה. מורכבות מטורפת.",
        den: "A gigantic ring, hundreds of balls, a flood from the spout. Insane complexity." },
    ModeInfo { key: "trampoline", icon: "🏀", he: "טרמפולינה", en: "Trampoline",
        dhe: "הכול קופץ כמעט בלי לאבד אנרגיה. הדופן בועטת חזרה.",
        den: "Everything bounces with almost no energy loss. The wall kicks back." },
    ModeInfo { key: "blackhole", icon: "🕳️", he: "חור שחור", en: "Black Hole",
        dhe: "הכבידה מושכת למרכז הטבעת. הכול מתנגש באמצע.",
        den: "Gravity pulls to the centre of the ring. Everything collides in the middle." },
    ModeInfo { key: "timeattack", icon: "⏱️", he: "נגד השעון", en: "Time Attack",
        dhe: "‏120 שניות. כמה גבוה אפשר להגיע?",
        den: "120 seconds. How high can you climb?" },
    ModeInfo { key: "sandbox", icon: "🧪", he: "ארגז חול", en: "Sandbox",
        dhe: "בוחרים כל דרגה שכבר פתחת ומפילים בנגיעה בכל מקום בטבעת.",
        den: "Pick any tier you've unlocked and tap anywhere in the ring to drop it." },
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Tool { Shake = 0, Magnet = 1, Bomb = 2, SlowMo = 3, Flip = 4, Upgrade = 5 }
pub const N_TOOLS: usize = 6;
pub struct ToolInfo { pub key: &'static str, pub icon: &'static str, pub he: &'static str, pub en: &'static str, pub dhe: &'static str, pub den: &'static str, pub cooldown: f32, pub duration: f32 }
pub static TOOLS: [ToolInfo; N_TOOLS] = [
    ToolInfo { key: "shake", icon: "🫨", he: "ניעור", en: "Shake", dhe: "מקפיץ את כל הטבעת", den: "Kicks everything in the ring", cooldown: 4.0, duration: 0.0 },
    ToolInfo { key: "magnet", icon: "🧲", he: "מגנט", en: "Magnet", dhe: "זהים נמשכים זה לזה ל־4 שניות", den: "Twins pull together for 4 s", cooldown: 12.0, duration: 4.0 },
    ToolInfo { key: "bomb", icon: "💣", he: "פצצה", en: "Bomb", dhe: "מפוצץ את הדרגה הנמוכה בטבעת", den: "Blows up the lowest tier in the ring", cooldown: 18.0, duration: 0.0 },
    ToolInfo { key: "slowmo", icon: "🐢", he: "הילוך איטי", en: "Slow-mo", dhe: "רבע מהירות ל־3 שניות", den: "Quarter speed for 3 s", cooldown: 10.0, duration: 3.0 },
    ToolInfo { key: "flip", icon: "🙃", he: "היפוך", en: "Flip", dhe: "הכבידה מתהפכת לשנייה", den: "Gravity flips for a second", cooldown: 8.0, duration: 1.1 },
    ToolInfo { key: "upgrade", icon: "⏫", he: "שדרוג", en: "Upgrade", dhe: "נוגעים בפריט והוא עולה דרגה (מטען כל 45 שניות)", den: "Tap an item to lift it one tier (one charge per 45 s)", cooldown: 45.0, duration: 0.0 },
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Opt {
    Speed = 0, DropRate, Gap, HardMode, Combo, Events,
    Gravity, Bounce, Magnet, RingSize, SizeGrow, RingSpin, AutoTilt, DeviceTilt,
    VolMaster, VolVoice, VolSfx, VolMusic, VoiceStyle, Music, Notes, VolNotes,
    Drama, Theme, Scenery, Stars, BallStyle, Particles, ScreenShake, Flashes, Labels, Trails, Ladder, Timer, Caption, Haptics,
}
pub const N_OPTS: usize = 36;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Kind { Choice, Range, Toggle }
pub struct OptDef {
    pub key: &'static str, pub group: u8, pub kind: Kind,
    pub he: &'static str, pub en: &'static str,
    pub hhe: &'static str, pub hen: &'static str,
    /// (he, en, value)
    pub choices: &'static [(&'static str, &'static str, f32)],
    pub min: f32, pub max: f32, pub step: f32, pub default: f32,
}
pub static GROUPS: [(&str, &str); 4] = [("משחק", "Game"), ("פיזיקה", "Physics"), ("סאונד", "Sound"), ("תצוגה", "Display")];

const OFFON: &[(&str, &str, f32)] = &[("כבוי", "Off", 0.0), ("פועל", "On", 1.0)];
const fn ch(key: &'static str, group: u8, he: &'static str, en: &'static str, hhe: &'static str, hen: &'static str, choices: &'static [(&'static str, &'static str, f32)], default: f32) -> OptDef {
    OptDef { key, group, kind: Kind::Choice, he, en, hhe, hen, choices, min: 0.0, max: 0.0, step: 0.0, default }
}
const fn rg(key: &'static str, group: u8, he: &'static str, en: &'static str, hhe: &'static str, hen: &'static str, min: f32, max: f32, step: f32, default: f32) -> OptDef {
    OptDef { key, group, kind: Kind::Range, he, en, hhe, hen, choices: &[], min, max, step, default }
}
const fn tg(key: &'static str, group: u8, he: &'static str, en: &'static str, hhe: &'static str, hen: &'static str, default: f32) -> OptDef {
    OptDef { key, group, kind: Kind::Toggle, he, en, hhe, hen, choices: OFFON, min: 0.0, max: 1.0, step: 1.0, default }
}

pub static OPTS: [OptDef; N_OPTS] = [
    // ── game
    ch("speed", 0, "מהירות סימולציה", "Simulation speed", "לא משנה את שעון השיא — הוא סופר זמן משחק", "Doesn't affect records — the clock counts game time",
       &[("×0.5", "×0.5", 0.5), ("×1", "×1", 1.0), ("×2", "×2", 2.0), ("×4", "×4", 4.0), ("×8", "×8", 8.0)], 1.0),
    ch("droprate", 0, "קצב טפטוף", "Drip rate", "כמה מהר הפיה מפילה", "How fast the spout drops",
       &[("איטי", "Slow", 0.6), ("רגיל", "Normal", 1.0), ("מהיר", "Fast", 1.6), ("מטורף", "Insane", 2.6), ("מבול", "Flood", 4.0)], 1.0),
    ch("gap", 0, "אורך המסע", "Journey length", "כמה דרגות מעל הפיה בונים לפני שהפיה משתדרגת. ארוך = יותר כדורים ויותר זמן", "How many tiers above the spout you build before the spout upgrades. Longer = more balls, more time",
       &[("קצר", "Short", 2.0), ("רגיל", "Normal", 3.0), ("ארוך", "Long", 4.0), ("אפי", "Epic", 5.0)], 3.0),
    tg("hard", 0, "מצב קשה", "Hard mode", "אם הטבעת מתמלאת עד הפיה — המשחק נגמר", "If the ring fills up to the spout, the game is over", 0.0),
    tg("combo", 0, "קומבו", "Combos", "מיזוגים ברצף בונים מונה קומבו", "Back-to-back merges build a combo counter", 1.0),
    tg("events", 0, "אירועים אקראיים", "Random events", "שעת עומס, רעידת אדמה, רוח צד, אפס כבידה וסערה מגנטית", "Rush hour, earthquakes, crosswinds, zero-g and magnetic storms", 1.0),
    // ── physics
    ch("gravity", 1, "כוח משיכה", "Gravity", "", "",
       &[("ירח", "Moon", 0.45), ("נמוך", "Low", 0.7), ("כדור הארץ", "Earth", 1.0), ("כבד", "Heavy", 1.45), ("צדק", "Jupiter", 2.1)], 1.0),
    rg("bounce", 1, "קפיציות", "Bounciness", "כמה אנרגיה נשארת בכל קפיצה", "How much energy each bounce keeps", 0.0, 0.97, 0.01, 0.8),
    ch("magnet", 1, "עזרת מגנט", "Magnet assist", "זהים נמשכים זה לזה בעדינות כדי שהטבעת לא תיתקע", "Twins drift together gently so the ring never jams",
       &[("כבוי", "Off", 0.0), ("עדין", "Gentle", 1.0), ("חזק", "Strong", 2.2)], 1.0),
    ch("ringsize", 1, "גודל המיכל", "Container size", "כמה הטבעת גדולה ביחס לכדורים", "How big the ring is compared to the balls",
       &[("קלאסי", "Classic", 0.72), ("גדול", "Big", 1.0), ("ענק", "Huge", 1.3), ("עצום", "Colossal", 1.65)], 1.0),
    ch("sizegrow", 1, "גדילה בכל מיזוג", "Growth per merge", "כמה הכדור החדש גדול מהשניים שהתמזגו", "How much bigger the new ball is than the two that merged",
       &[("עדינה", "Subtle", 1.1), ("רגילה", "Normal", 1.16), ("דרמטית", "Dramatic", 1.24)], 1.16),
    ch("ringspin", 1, "סיבוב הטבעת", "Ring spin", "הדופן מסובבת את מה שנוגע בה", "The wall drags whatever touches it",
       &[("כבוי", "Off", 0.0), ("לאט", "Slow", 0.35), ("מהר", "Fast", 1.0), ("הפוך", "Reverse", -0.6)], 0.0),
    tg("autotilt", 1, "הטיה אוטומטית", "Auto-tilt", "הכבידה מתנדנדת לבד כדי לערבב", "Gravity sways by itself to stir things up", 0.0),
    tg("devicetilt", 1, "הטיית הטלפון", "Phone tilt", "הטיית הטלפון מטה את הכבידה", "Tilting the phone tilts gravity", 0.0),
    // ── sound
    rg("vol", 2, "עוצמה ראשית", "Master volume", "", "", 0.0, 1.0, 0.05, 0.85),
    rg("volvoice", 2, "קול ה־OMG", "OMG voice", "", "", 0.0, 1.0, 0.05, 1.0),
    rg("volsfx", 2, "אפקטים", "Effects", "", "", 0.0, 1.0, 0.05, 0.8),
    rg("volmusic", 2, "מוזיקה", "Music", "", "", 0.0, 1.0, 0.05, 0.45),
    ch("voicestyle", 2, "סגנון קול", "Voice style", "פילטר על כל צעקות ה־OMG", "A filter over every OMG",
       &[("רגיל", "Normal", 0.0), ("רובוט", "Robot", 1.0), ("מקהלה", "Choir", 2.0), ("צ׳יפמאנק", "Chipmunk", 3.0), ("ענק", "Giant", 4.0), ("אצטדיון", "Stadium", 5.0)], 0.0),
    tg("music", 2, "מוזיקת רקע", "Background music", "לופ שמשתנה בכל עידן", "A loop that changes with every era", 1.0),
    tg("notes", 2, "מנגינת קפיצות", "Bounce melody", "כל קפיצה חזקה מנגנת את התו הבא במנגינה", "Every hard bounce plays the next note of a tune", 1.0),
    rg("volnotes", 2, "עוצמת הקפיצות", "Bounce volume", "", "", 0.0, 1.0, 0.05, 0.5),
    // ── display
    ch("drama", 3, "דרמה", "Drama", "הילוך איטי, זום ומסכי עידן בכל דרגה חדשה", "Slow-motion, camera zoom and era title cards on every new tier",
       &[("כבוי", "Off", 0.0), ("רגיל", "Normal", 1.0), ("מקסימום", "Maximum", 2.0)], 1.0),
    ch("theme", 3, "צבע הטבעת", "Ring colours", "", "",
       &[("קשת", "Rainbow", 0.0), ("לפי העידן", "By era", 1.0), ("זהב", "Gold", 2.0), ("קרח", "Ice", 3.0), ("לבן", "White", 4.0), ("אש", "Fire", 5.0)], 0.0),
    tg("scenery", 3, "נוף לכל עידן", "Era scenery", "עיר, ים, שמיים, חלל ומקדשים מאחורי הטבעת", "City, sea, sky, space and temples behind the ring", 1.0),
    tg("stars", 3, "כוכבים", "Stars", "", "", 1.0),
    ch("ballstyle", 3, "סגנון הכדורים", "Ball style", "", "",
       &[("מדבקה", "Sticker", 0.0), ("זכוכית", "Glass", 1.0), ("ניאון", "Neon", 2.0), ("שטוח", "Flat", 3.0)], 0.0),
    ch("particles", 3, "חלקיקים", "Particles", "", "",
       &[("מעט", "Low", 0.4), ("רגיל", "Normal", 1.0), ("הרבה", "Lots", 1.8)], 1.0),
    tg("shake", 3, "רעידת מסך", "Screen shake", "", "", 1.0),
    ch("flashes", 3, "הבזקים", "Flashes", "למי שרגיש לאור מהבהב — אפשר לכבות", "Turn off if flashing light bothers you",
       &[("כבוי", "Off", 0.0), ("עדין", "Soft", 0.5), ("מלא", "Full", 1.0)], 0.5),
    tg("labels", 3, "שמות על הכדורים", "Names on balls", "", "", 1.0),
    tg("trails", 3, "שובלים", "Motion trails", "", "", 0.0),
    tg("ladder", 3, "סולם הדרגות", "Tier ladder", "", "", 1.0),
    tg("timer", 3, "שעון", "Timer", "", "", 1.0),
    tg("caption", 3, "כיתוב בתחתית", "Bottom caption", "הכיתוב בסגנון רילז — אפשר לערוך אותו", "The reel-style caption — editable", 1.0),
    tg("haptics", 3, "רטט", "Haptics", "בטלפונים שתומכים ברטט", "On phones that support it", 1.0),
];

#[derive(Clone)]
pub struct Options { pub v: [f32; N_OPTS] }
impl Options {
    pub fn new() -> Options {
        let mut v = [0.0; N_OPTS];
        for (i, d) in OPTS.iter().enumerate() { v[i] = d.default; }
        Options { v }
    }
    #[inline] pub fn get(&self, o: Opt) -> f32 { self.v[o as usize] }
    #[inline] pub fn on(&self, o: Opt) -> bool { self.v[o as usize] > 0.5 }
    pub fn set(&mut self, i: usize, x: f32) {
        if i >= N_OPTS || !x.is_finite() { return; }
        let d = &OPTS[i];
        let x = match d.kind {
            Kind::Range => crate::m::clamp(x, d.min, d.max),
            Kind::Toggle => if x > 0.5 { 1.0 } else { 0.0 },
            Kind::Choice => {
                // snap to the nearest declared value
                let mut best = d.choices[0].2; let mut bd = f32::MAX;
                for c in d.choices { let dd = crate::m::abs(c.2 - x); if dd < bd { bd = dd; best = c.2; } }
                best
            }
        };
        self.v[i] = x;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn table_matches_enum() {
        assert_eq!(OPTS[Opt::Haptics as usize].key, "haptics");
        assert_eq!(OPTS[Opt::Bounce as usize].key, "bounce");
        assert_eq!(OPTS[Opt::Drama as usize].key, "drama");
        assert_eq!(OPTS[Opt::VolNotes as usize].key, "volnotes");
        assert_eq!(OPTS[Opt::SizeGrow as usize].key, "sizegrow");
        assert_eq!(OPTS[Opt::Events as usize].key, "events");
    }
}
