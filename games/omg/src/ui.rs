//! Interface strings (Hebrew first) and the schema the browser builds its menus from.

use alloc::string::String;
use core::fmt::Write;

use crate::opts::*;
use crate::tiers::*;

pub static UI: &[(&str, &str, &str)] = &[
    ("title", "OH MY GOD", "OH MY GOD"),
    ("subtitle", "מזחילה עד אלוהים", "From Crawling to God"),
    ("tagline", "בועת חיים אחת, תינוק זוחל אחד, ומסע של שעות עד אלוהים. מכוונים כל תא, מתאחדים זהים, שורדים את חוקי הטבע של כל עידן — והבועה לא סולחת.", "One bubble of life, one crawling baby, and a journey of hours to God. Aim every cell, fuse the twins, survive each era's law of nature — and the bubble doesn't forgive."),
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
    ("evolution", "האבולוציה שלך", "Your evolution"),
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
    ("how1", "במסע הגבעול נותן תא אחד בכל פעם, ובתוכו רואים את שני הבאים. גררו כדי לכוון ושחררו כדי להפיל (במחשב: עכבר, או חצים ורווח). שני תאים זהים שנוגעים מתאחדים לדרגה הבאה, וכשהתינוקות כבר קטנים מדי לראות, כל תא שווה הרבה תינוקות.", "On the journey the stem gives one cell at a time, and you can see the next two inside it. Drag to aim and let go to drop (on a computer: the mouse, or the arrows and space). Two identical cells that touch fuse into the next tier, and once the babies are too small to see, every cell is worth many babies."),
    ("how2", "בבועה יש קו לחץ: ערימה שנשארת מעליו מפוצצת את הבועה, וחוזרים לתחילת העידן — כל עידן נשמר, וכל התפוצצות מחזקת את הבועה לניסיון הבא. כל עידן מביא חוק טבע שצריך להבין ויכולת חדשה, ותגובות שרשרת טוענות את היכולות. אפשר לסגור ולהמשיך אחר כך.", "The bubble has a strain line: a pile that stays above it bursts the bubble and sends you back to the start of the era — every era is saved, and every burst makes the bubble tougher for the next try. Each era brings a law of nature to understand and a new ability, and chain reactions charge the abilities. You can close the game and continue later."),
    ("how3", "כל דרגה רחבה יותר מזו שמתחתיה, אז העולם סביב הבועה מתרחק כל הזמן, ומאחוריה כבר מרחפים הענקים שעוד יבואו. כשהתינוקות קטנים מדי לראות, הם מתגבשים בגבעול לתא אחד, וכך עד אלוהים. ואז הבועה מתפוצצת, ואלוהים מספר איך הכול התחיל, ובכל רגע של בריאה מחכה לנגיעה שלך.", "Every tier is wider than the one below, so the world around the bubble keeps pulling back, and the giants still to come already float behind it. Once the babies are too small to see, they clump in the stem into one cell, and on it goes to God. Then the bubble bursts, God tells how it all began, and every moment of creation waits for your touch."),
    ("sandbox_pick", "מה ליפול?", "What to drop?"),
    ("tools", "כלים", "Tools"),
    ("credits", "קרדיטים", "Credits"),
    ("credits_body", "משחק של סטודיו דאטא. המנוע, הפיזיקה, החוקים, המצלמה, העולם החי, סיפור הבריאה האינטראקטיבי ומנוע הסאונד כתובים ב־Rust ומקומפלים ל־WebAssembly. הקולות הבסיסיים נוצרו במודל הדיבור הפתוח Kokoro (רישיון Apache 2.0), וכל העיבוד שלהם — העמקה, מקהלות, ריוורב, אפקטים — קורה בתוך ה־Rust. את פרק א׳ של בראשית מקריא קול של Kokoro שעובד באותו מנוע; הטקסט העברי הוא נוסח המסורה, והאנגלי הוא תרגום JPS משנת 1917 (נחלת הכלל). כל 168 האיורים צוירו במיוחד למשחק. פונטים: Assistant ו־Frank Ruhl Libre (SIL OFL).", "A Datta studio game. The engine, physics, rules, camera, the living world, the interactive creation story and the sound engine are written in Rust and compiled to WebAssembly. The base voices were generated with the open Kokoro speech model (Apache 2.0), and all of their processing — deepening, choirs, reverb, effects — happens inside the Rust. Genesis 1 is read by a Kokoro voice processed by the same engine; the Hebrew is the Masoretic text and the English the 1917 JPS translation (public domain). All 168 illustrations were drawn for this game. Fonts: Assistant and Frank Ruhl Libre (SIL OFL)."),
    ("not_brands", "שמות הדגמים מוזכרים לשם ההומור; אין קשר לחברות. האיורים הם פרשנות בצבעים ובסגנון של כל דגם — בלי לוגואים וסמלים מסחריים.", "Model names appear for fun; no affiliation. The illustrations are interpretations in each model's colours and style — no logos or trademarks."),
    ("loading", "טוען…", "Loading…"),
    ("tap_to_start", "לחצו כדי להתחיל", "Tap to start"),
    ("sound_note", "מומלץ עם סאונד", "Best with sound on"),
    ("site", "חזרה לאתר", "Back to the site"),
    ("charges", "מטענים", "Charges"),
    ("zoom_in", "התקרבות", "Zoom in"),
    ("zoom_out", "התרחקות", "Zoom out"),
    ("zoom_auto", "מצלמה אוטומטית", "Auto camera"),
    ("skip", "דילוג", "Skip"),
    ("story_title", "בְּרֵאשִׁית", "In the Beginning"),
    ("story_loading", "אלוהים מתכונן לספר…", "God is about to speak…"),
    ("end_babies", "תינוקות", "Babies"),
    ("end_zoom", "זום", "Zoom"),
    ("end_story", "הייתם שם כשהעולם נברא", "You were there when the world was made"),
    ("continue", "המשך את המסע", "Continue the journey"),
    ("new_journey", "מסע חדש", "New journey"),
    ("new_journey_q", "בטוח? המסע הנוכחי יימחק", "Sure? Your journey will be lost"),
    ("difficulty", "קושי", "Difficulty"),
    ("burst_title", "הבועה התפוצצה", "The bubble burst"),
    ("burst_sub", "חוזרים לתחילת העידן", "Back to the start of the era"),
    ("retry", "שוב מתחילת העידן", "Try the era again"),
    ("attempt", "ניסיון", "Attempt"),
    ("mercy", "הבועה מתחזקת: בניסיון הבא קו הלחץ עולה קצת והיא תחזיק מעמד מעליו יותר זמן, ולכל יכולת שכבר נפתחה תהיה לפחות טעינה אחת.", "The bubble toughens: next try the strain line rises a little and the bubble holds out longer above it, and every ability you have will have at least one charge."),
    ("mercy_max", "הבועה כבר חזקה כמה שאפשר, ולכל יכולת שכבר נפתחה תהיה לפחות טעינה אחת.", "The bubble is as tough as it gets, and every ability you have will have at least one charge."),
    ("bursts", "התפוצצויות", "Bursts"),
    ("s_journey", "שיא המסע", "Journey record"),
    ("laws", "חוקי הטבע של המסע", "The journey's laws of nature"),
    ("law_era", "בעידן", "In the era of"),
    ("saved_note", "המסע נשמר אוטומטית", "The journey saves itself"),
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
    let _ = write!(o, "{{\"version\":\"3.0\",\"god\":{},\"n\":{},\"ncats\":{},\"sounds\":{{\"iam\":{},\"note0\":{},\"music0\":{},\"sfx0\":{},\"sfx1\":{}}},\"tiers\":[", GOD, N_TIERS, N_CATS, crate::game::S_IAM, crate::game::S_NOTE0, crate::game::S_MUSIC0, crate::game::S_DROP, crate::game::S_HEART);
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
    o.push_str("],\"diffs\":[");
    for (i, d) in crate::skill::DIFFS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"key\":"); js(&mut o, d.key);
        o.push_str(",\"he\":"); js(&mut o, d.he);
        o.push_str(",\"en\":"); js(&mut o, d.en);
        o.push_str(",\"dhe\":"); js(&mut o, d.dhe);
        o.push_str(",\"den\":"); js(&mut o, d.den);
        o.push('}');
    }
    o.push_str("],\"laws\":[");
    for (i, l) in crate::skill::LAWS.iter().enumerate() {
        if i > 0 { o.push(','); }
        o.push_str("{\"icon\":"); js(&mut o, l.icon);
        o.push_str(",\"he\":"); js(&mut o, l.he);
        o.push_str(",\"en\":"); js(&mut o, l.en);
        o.push_str(",\"dhe\":"); js(&mut o, l.dhe);
        o.push_str(",\"den\":"); js(&mut o, l.den);
        let _ = write!(o, ",\"tool\":{}", l.tool);
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
    o.push_str("],\"story_icons\":[");
    for (i, k) in crate::story::SPRITES.iter().enumerate() { if i > 0 { o.push(','); } js(&mut o, k); }
    o.push_str("],\"story\":");
    crate::story::schema(&mut o);
    o.push_str(",\"clips\":[");
    for (i, c) in crate::audio::omg::CLIPS.iter().enumerate() { if i > 0 { o.push(','); } js(&mut o, c); }
    o.push_str("],\"ui\":{");
    for (i, u) in UI.iter().enumerate() {
        if i > 0 { o.push(','); }
        js(&mut o, u.0); o.push_str(":["); js(&mut o, u.1); o.push(','); js(&mut o, u.2); o.push(']');
    }
    o.push_str("}}");
    o
}
