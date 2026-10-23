//! Interface strings (Hebrew first) and the schema the browser builds its menus from.

use alloc::string::String;
use core::fmt::Write;

use crate::opts::*;
use crate::tiers::*;

pub static UI: &[(&str, &str, &str)] = &[
    ("title", "OH MY GOD", "OH MY GOD"),
    ("subtitle", "מזחילה עד אלוהים", "From Crawling to God"),
    ("tagline", "שני כלי רכב זהים מתמזגים למשהו גדול ויוקרתי יותר — 124 דרגות, 14 עידנים, וה־OMG רק מתחזק.", "Two identical rides merge into something bigger and fancier — 124 tiers, 14 eras, and the OMG only gets louder."),
    ("play", "שחק", "Play"),
    ("resume", "המשך", "Resume"),
    ("restart", "מהתחלה", "Restart"),
    ("menu", "תפריט", "Menu"),
    ("modes", "מצבי משחק", "Modes"),
    ("settings", "הגדרות", "Settings"),
    ("garage", "האוסף", "Collection"),
    ("stats", "סטטיסטיקה", "Stats"),
    ("about", "על המשחק", "About"),
    ("close", "סגור", "Close"),
    ("back", "חזרה", "Back"),
    ("pause", "השהה", "Pause"),
    ("sound", "סאונד", "Sound"),
    ("lang", "English", "עברית"),
    ("record", "הקלט רילז", "Record a reel"),
    ("recording", "מקליט… לחצו לעצירה", "Recording… tap to stop"),
    ("record_ready", "הסרטון מוכן", "Your video is ready"),
    ("record_save", "שמור סרטון", "Save video"),
    ("record_unsupported", "הדפדפן הזה לא תומך בהקלטה", "This browser can't record"),
    ("fullscreen", "מסך מלא", "Full screen"),
    ("caption_label", "הכיתוב בתחתית", "Bottom caption"),
    ("caption_ph", "האם התינוק יגיע לאלוהים?", "Will the Baby Reach God?"),
    ("locked", "עוד לא נפתח", "Not unlocked yet"),
    ("unlocked", "נפתחו", "Unlocked"),
    ("play_sound", "השמע", "Play"),
    ("tier", "דרגה", "Tier"),
    ("best", "שיא", "Best"),
    ("s_runs", "משחקים", "Runs"),
    ("s_merges", "מיזוגים", "Merges"),
    ("s_omgs", "OMG-ים", "OMGs"),
    ("s_drops", "כדורים שנפלו", "Balls dropped"),
    ("s_combo", "הקומבו הכי ארוך", "Longest combo"),
    ("s_gods", "פעמים שהגעת לאלוהים", "Times you reached God"),
    ("s_played", "זמן משחק", "Time played"),
    ("s_top", "הדרגה הכי גבוהה", "Highest tier"),
    ("s_ta", "שיא נגד השעון", "Time Attack best"),
    ("reset", "איפוס התקדמות", "Reset progress"),
    ("reset_q", "למחוק את כל ההתקדמות, השיאים והאוסף?", "Erase all progress, records and the collection?"),
    ("end_title", "הגעת לאלוהים", "You reached God"),
    ("end_time", "זמן", "Time"),
    ("end_merges", "מיזוגים", "Merges"),
    ("end_drops", "נפלו", "Dropped"),
    ("end_combo", "קומבו", "Combo"),
    ("era", "עידן", "Era"),
    ("tiers_word", "דרגות", "tiers"),
    ("end_record", "שיא חדש!", "New record!"),
    ("again", "עוד סיבוב", "Again"),
    ("keep_watching", "להישאר באור", "Stay in the light"),
    ("over_jam", "פקק! הטבעת התמלאה", "Jammed! The ring is full"),
    ("over_time", "נגמר הזמן", "Time's up"),
    ("over_reached", "הגעת עד", "You reached"),
    ("how", "איך משחקים", "How to play"),
    ("how1", "כל סיבוב מתחיל מזחילה. שני כדורים זהים שנוגעים — מתמזגים לדרגה הבאה, וכדור גדול יותר קופץ החוצה.", "Every run starts with a crawl. Two identical balls that touch merge into the next tier — and a bigger ball bounces out."),
    ("how2", "נגיעה במסך מפילה עוד אחת. גרירה לצדדים מטה את כוח המשיכה.", "Tap to drop one more. Drag sideways to tilt gravity."),
    ("how3", "כשבונים מספיק גבוה, הפיה משתדרגת — מאופניים למכוניות, רכבות, ספינות, מטוסים, חלליות, מדע בדיוני ורכבי האלים — עד אלוהים.", "Build high enough and the spout upgrades — bikes, cars, trains, ships, planes, spacecraft, sci-fi and the rides of the gods — all the way to God."),
    ("sandbox_pick", "מה ליפול?", "What to drop?"),
    ("tools", "כלים", "Tools"),
    ("credits", "קרדיטים", "Credits"),
    ("credits_body", "משחק של סטודיו דאטא. המנוע, הפיזיקה, החוקים, הנופים ומנוע הסאונד כתובים ב־Rust ומקומפלים ל־WebAssembly. הקולות הבסיסיים נוצרו במודל הדיבור הפתוח Kokoro (רישיון Apache 2.0), וכל העיבוד שלהם — העמקה, מקהלות, ריוורב, אפקטים — קורה בזמן אמת בתוך ה־Rust. כל 123 האיורים צוירו במיוחד למשחק. פונטים: Assistant ו־Frank Ruhl Libre (SIL OFL).", "A Datta studio game. The engine, physics, rules, scenery and sound engine are written in Rust and compiled to WebAssembly. The base voices were generated with the open Kokoro speech model (Apache 2.0), and all of their processing — deepening, choirs, reverb, effects — happens live inside the Rust. All 123 illustrations were drawn for this game. Fonts: Assistant and Frank Ruhl Libre (SIL OFL)."),
    ("not_brands", "שמות הדגמים מוזכרים לשם ההומור; אין קשר לחברות. האיורים הם פרשנות בצבעים ובסגנון של כל דגם — בלי לוגואים וסמלים מסחריים.", "Model names appear for fun; no affiliation. The illustrations are interpretations in each model's colours and style — no logos or trademarks."),
    ("loading", "טוען…", "Loading…"),
    ("tap_to_start", "לחצו כדי להתחיל", "Tap to start"),
    ("sound_note", "מומלץ עם סאונד", "Best with sound on"),
    ("site", "חזרה לאתר", "Back to the site"),
    ("charges", "מטענים", "Charges"),
];

fn js(out: &mut String, s: &str) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => { let _ = write!(out, "\\u{:04x}", c as u32); }
            c => out.push(c),
        }
    }
    out.push('"');
}
fn hex(out: &mut String, c: u32) { let _ = write!(out, "\"#{:06x}\"", c & 0xFFFFFF); }
fn num(out: &mut String, x: f32) {
    if x < 1e9 && x > -1e9 && x == (x as i64) as f32 { let _ = write!(out, "{}", x as i64); } else { let _ = write!(out, "{}", x); }
}

pub fn schema() -> String {
    let mut o = String::with_capacity(32 * 1024);
    let _ = write!(o, "{{\"version\":\"2.0\",\"god\":{},\"n\":{},\"sounds\":{{\"iam\":{},\"note0\":{},\"music0\":{},\"sfx0\":{}}},\"tiers\":[", GOD, N_TIERS, crate::game::S_IAM, crate::game::S_NOTE0, crate::game::S_MUSIC0, crate::game::S_DROP);
    for (i, t) in TIERS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"key\":"); js(&mut o, t.key);
        o.push_str(",\"icon\":"); js(&mut o, if t.cat == Cat::God { "" } else { t.key });
        let _ = write!(o, ",\"cat\":{}", t.cat as u8);
        o.push_str(",\"color\":"); hex(&mut o, t.color);
        o.push_str(",\"fill\":"); hex(&mut o, fill_of(i as u8));
        o.push_str(",\"he\":"); js(&mut o, t.he);
        o.push_str(",\"en\":"); js(&mut o, t.en);
        o.push_str(",\"lhe\":"); js(&mut o, t.label_he);
        o.push_str(",\"len\":"); js(&mut o, t.label_en);
        o.push_str(",\"bhe\":"); js(&mut o, t.blurb_he);
        o.push_str(",\"ben\":"); js(&mut o, t.blurb_en);
        o.push('}');
    }
    o.push_str("],\"cats\":[");
    for (i, c) in CATS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"he\":"); js(&mut o, c.he);
        o.push_str(",\"en\":"); js(&mut o, c.en);
        o.push_str(",\"accent\":"); hex(&mut o, c.accent);
        o.push_str(",\"she\":"); js(&mut o, c.sub_he);
        o.push_str(",\"sen\":"); js(&mut o, c.sub_en);
        let _ = write!(o, ",\"first\":{}", era_first(i as u8));
        o.push('}');
    }
    o.push_str("],\"modes\":[");
    for (i, m) in MODES.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"key\":"); js(&mut o, m.key);
        o.push_str(",\"icon\":"); js(&mut o, m.icon);
        o.push_str(",\"he\":"); js(&mut o, m.he);
        o.push_str(",\"en\":"); js(&mut o, m.en);
        o.push_str(",\"dhe\":"); js(&mut o, m.dhe);
        o.push_str(",\"den\":"); js(&mut o, m.den);
        o.push('}');
    }
    o.push_str("],\"tools\":[");
    for (i, t) in TOOLS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"key\":"); js(&mut o, t.key);
        o.push_str(",\"icon\":"); js(&mut o, t.icon);
        o.push_str(",\"he\":"); js(&mut o, t.he);
        o.push_str(",\"en\":"); js(&mut o, t.en);
        o.push_str(",\"dhe\":"); js(&mut o, t.dhe);
        o.push_str(",\"den\":"); js(&mut o, t.den);
        o.push_str(",\"cd\":"); num(&mut o, t.cooldown);
        o.push('}');
    }
    o.push_str("],\"groups\":[");
    for (i, g) in GROUPS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push('['); js(&mut o, g.0); o.push(','); js(&mut o, g.1); o.push(']');
    }
    o.push_str("],\"opts\":[");
    for (i, d) in OPTS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"key\":"); js(&mut o, d.key);
        let _ = write!(o, ",\"group\":{}", d.group);
        o.push_str(",\"kind\":"); js(&mut o, match d.kind { Kind::Choice => "choice", Kind::Range => "range", Kind::Toggle => "toggle" });
        o.push_str(",\"he\":"); js(&mut o, d.he);
        o.push_str(",\"en\":"); js(&mut o, d.en);
        o.push_str(",\"hhe\":"); js(&mut o, d.hhe);
        o.push_str(",\"hen\":"); js(&mut o, d.hen);
        o.push_str(",\"choices\":[");
        for (k, c) in d.choices.iter().enumerate() {
            if k > 0 { o.push(','); }
            o.push('['); js(&mut o, c.0); o.push(','); js(&mut o, c.1); o.push(','); num(&mut o, c.2); o.push(']');
        }
        o.push_str("],\"min\":"); num(&mut o, d.min);
        o.push_str(",\"max\":"); num(&mut o, d.max);
        o.push_str(",\"step\":"); num(&mut o, d.step);
        o.push_str(",\"def\":"); num(&mut o, d.default);
        o.push('}');
    }
    o.push_str("],\"clips\":[");
    for (i, c) in crate::audio::omg::CLIPS.iter().enumerate() { if i > 0 { o.push(','); } js(&mut o, c); }
    o.push_str("],\"ui\":{");
    for (i, u) in UI.iter().enumerate() {
        if i > 0 { o.push(','); }
        js(&mut o, u.0); o.push_str(":["); js(&mut o, u.1); o.push(','); js(&mut o, u.2); o.push(']');
    }
    o.push_str("}}");
    o
}
