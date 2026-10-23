//! The ladder: 37 vehicles from a Kia Picanto to the God of Israel.
//! Facts in the blurbs are checked; the rest is play.

pub const N_TIERS: usize = 37;
pub const GOD: u8 = 36;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Cat { Cars = 0, Planes = 1, Space = 2, SciFi = 3, Myth = 4, Holy = 5, God = 6 }

pub struct Tier {
    pub key: &'static str,
    /// icon file (without .svg) under icons/
    pub icon: &'static str,
    pub cat: Cat,
    /// rim / glow colour
    pub color: u32,
    /// disc base colour
    pub fill: u32,
    pub he: &'static str,
    pub en: &'static str,
    pub label_he: &'static str,
    pub label_en: &'static str,
    pub blurb_he: &'static str,
    pub blurb_en: &'static str,
}

macro_rules! t {
    ($key:expr, $icon:expr, $cat:ident, $color:expr, $fill:expr, $he:expr, $en:expr, $lhe:expr, $len:expr, $bhe:expr, $ben:expr) => {
        Tier { key: $key, icon: $icon, cat: Cat::$cat, color: $color, fill: $fill, he: $he, en: $en, label_he: $lhe, label_en: $len, blurb_he: $bhe, blurb_en: $ben }
    };
}

pub static TIERS: [Tier; N_TIERS] = [
    // ── cars
    t!("picanto", "city-car", Cars, 0xA9B4C4, 0x2A3140, "קיה פיקנטו", "Kia Picanto", "פיקנטו", "PICANTO",
       "הקטנה של קיה. מכאן מתחילים.", "Kia's smallest. Everyone starts somewhere."),
    t!("wrangler", "jeep", Cars, 0x9DBB52, 0x26321A, "ג׳יפ רנגלר", "Jeep Wrangler", "רנגלר", "WRANGLER",
       "4×4. כביש? בשביל מה.", "4×4. Roads are optional."),
    t!("model-s", "sedan-electric", Cars, 0x6FE6FF, 0x123040, "טסלה מודל S", "Tesla Model S", "מודל S", "MODEL S",
       "חשמלית, שקטה ומהירה בטירוף.", "Electric, silent, absurdly quick."),
    t!("m5", "sedan-sport", Cars, 0x3D82FF, 0x0F1E44, "ב.מ.וו M5", "BMW M5", "M5", "M5",
       "סדאן משפחתית עם לב של מכונית מרוץ.", "A family sedan with a race car's heart."),
    t!("ferrari", "supercar", Cars, 0xFF3B2F, 0x450B08, "פרארי", "Ferrari", "פרארי", "FERRARI",
       "אדום איטלקי, מנוע מאחורייך, לב בגרון.", "Italian red, the engine behind you, your heart in your throat."),
    t!("cobra", "race-car", Cars, 0xF4F6FF, 0x1A2A7A, "שלבי קוברה", "Shelby Cobra", "קוברה", "COBRA",
       "אגדה אמריקאית מאז 1962.", "An American legend since 1962."),
    t!("chiron", "hypercar", Cars, 0x8C6BFF, 0x1C1248, "בוגאטי שירון", "Bugatti Chiron", "שירון", "CHIRON",
       "1,500 כוחות סוס, ארבע טורבינות, W16.", "1,500 PS from a quad-turbo W16."),
    t!("zonda", "hypercar-wing", Cars, 0xFFB627, 0x3D2604, "פגאני זונדה", "Pagani Zonda", "זונדה", "ZONDA",
       "בעבודת יד, במספר יחידות קטן מאוד.", "Hand-built, in tiny numbers."),
    // ── planes
    t!("cessna", "airplane", Planes, 0xFF7A70, 0x3A1414, "צסנה 172", "Cessna 172", "צסנה", "CESSNA",
       "המטוס שיוצר הכי הרבה פעמים בהיסטוריה.", "The most-produced aircraft in history."),
    t!("g650", "bizjet", Planes, 0xE2CFA0, 0x332A16, "גאלפסטרים G650", "Gulfstream G650", "G650", "G650",
       "המטוס הפרטי של המיליארדרים.", "The billionaire's commute."),
    t!("b747", "jumbo-747", Planes, 0x7FB0FF, 0x112446, "בואינג 747", "Boeing 747", "747", "747",
       "מלכת השמיים.", "The Queen of the Skies."),
    t!("a380", "superjumbo-a380", Planes, 0x56D9FF, 0x0B2E3D, "איירבוס A380", "Airbus A380", "A380", "A380",
       "מטוס הנוסעים הגדול בעולם.", "The world's largest passenger airliner."),
    t!("concorde", "concorde", Planes, 0xF2F6FF, 0x283246, "קונקורד", "Concorde", "קונקורד", "CONCORDE",
       "פי שניים ממהירות הקול.", "Twice the speed of sound."),
    t!("f22", "jet-fighter", Planes, 0x9FB2C8, 0x1C2633, "F-22 ראפטור", "F-22 Raptor", "F-22", "F-22",
       "מטוס קרב חמקן.", "A stealth fighter."),
    t!("sr71", "blackbird-sr71", Planes, 0xA9A2FF, 0x0C0B16, "SR-71 בלקבירד", "SR-71 Blackbird", "SR-71", "SR-71",
       "3,530 קמ״ש. שיא שעומד מאז 1976.", "2,193 mph. A record standing since 1976."),
    t!("b2", "stealth-bomber", Planes, 0x6CFFA2, 0x0E1A14, "B-2 ספיריט", "B-2 Spirit", "B-2", "B-2",
       "כ־2 מיליארד דולר ליחידה.", "About $2 billion apiece."),
    // ── real spacecraft
    t!("soyuz", "soyuz", Space, 0xFFA048, 0x3A1C06, "סויוז", "Soyuz", "סויוז", "SOYUZ",
       "מטיסה בני אדם מאז 1967.", "Flying people since 1967."),
    t!("shuttle", "space-shuttle", Space, 0xFFFFFF, 0x1A1F2C, "מעבורת החלל", "Space Shuttle", "מעבורת", "SHUTTLE",
       "135 משימות, 1981–2011.", "135 missions, 1981–2011."),
    t!("apollo", "saturn-v", Space, 0xD8DCE6, 0x23262E, "אפולו 11", "Apollo 11", "אפולו", "APOLLO 11",
       "יולי 1969. בני אדם על הירח.", "July 1969. People on the Moon."),
    t!("starship", "starship", Space, 0xC9D6E4, 0x1B2430, "סטארשיפ", "Starship", "סטארשיפ", "STARSHIP",
       "הטיל הגדול והחזק ביותר שטס אי פעם.", "The largest, most powerful rocket ever flown."),
    t!("iss", "satellite", Space, 0xFFD54F, 0x2E2506, "תחנת החלל הבינלאומית", "International Space Station", "ISS", "ISS",
       "החפץ היקר ביותר שבנה האדם.", "The most expensive object ever built."),
    // ── science fiction
    t!("flying-car", "flying-car", SciFi, 0xFF52DC, 0x3A0A33, "מכונית מעופפת", "Flying Car", "מעופפת", "HOVERCAR",
       "הבטיחו לנו אותה עד שנת 2000.", "We were promised these by 2000."),
    t!("ufo", "ufo", SciFi, 0x46FF8E, 0x08301A, "צלחת מעופפת", "Flying Saucer", "עב״ם", "UFO",
       "הם כאן.", "They're here."),
    t!("teleport", "transportation-rings", SciFi, 0x14E8FF, 0x05303A, "טלפורטציה", "Teleporter", "טלפורט", "TELEPORT",
       "לא נוסעים. פשוט מגיעים.", "Don't travel. Arrive."),
    t!("lightspeed", "lightspeed-ship", SciFi, 0xBDF6FF, 0x0D2A44, "מהירות האור", "Light Speed", "אור", "LIGHTSPEED",
       "299,792 קילומטר בשנייה.", "299,792 kilometres per second."),
    t!("wormhole", "vortex", SciFi, 0xA66BFF, 0x1E0B40, "חור תולעת", "Wormhole", "חור תולעת", "WORMHOLE",
       "קיצור דרך דרך המרחב־זמן.", "A shortcut through spacetime."),
    t!("time-machine", "time-trap", SciFi, 0xFFC93C, 0x3A2A05, "מכונת זמן", "Time Machine", "מכונת זמן", "TIME",
       "מגיעים לפני שיצאת.", "Arrive before you leave."),
    // ── mythology
    t!("wukong", "fluffy-cloud", Myth, 0xFFD23F, 0x4A1F2E, "ענן הסלטות של סון ווקונג", "Sun Wukong's Cloud", "ווקונג", "WUKONG",
       "108,000 לי בסלטה אחת (מסע למערב).", "108,000 li in a single somersault (Journey to the West)."),
    t!("pegasus", "pegasus", Myth, 0xFFF4D6, 0x2A2440, "פגסוס", "Pegasus", "פגסוס", "PEGASUS",
       "הסוס המכונף של המיתולוגיה היוונית.", "The winged horse of Greek myth."),
    t!("sleipnir", "sleipnir", Myth, 0xB9CCE6, 0x1A2333, "סלייפניר", "Sleipnir", "סלייפניר", "SLEIPNIR",
       "שמונה רגליים. הסוס של אודין.", "Eight legs. Odin's horse."),
    t!("thor", "goat-chariot", Myth, 0x7AD7FF, 0x0C2236, "מרכבת התיישים של ת׳ור", "Thor's Goat Chariot", "ת׳ור", "THOR",
       "נגררת בידי שני תיישים. רעם כלול.", "Pulled by two goats. Thunder included."),
    t!("garuda", "eagle-emblem", Myth, 0xFF8A1E, 0x3D1A02, "גארודה", "Garuda", "גארודה", "GARUDA",
       "מלך הציפורים — הרכב של וישנו.", "King of birds — Vishnu's mount."),
    t!("ra", "sun-barque", Myth, 0xFFD000, 0x3A2A00, "ספינת השמש של רע", "Ra's Solar Barque", "רע", "RA",
       "חוצה את השמיים בכל יום.", "Crosses the sky every day."),
    t!("helios", "sun-chariot", Myth, 0xFFE98A, 0x45300A, "מרכבת השמש של הליוס", "Helios' Sun Chariot", "הליוס", "HELIOS",
       "מושך את השמש על פני השמיים.", "Hauls the sun across the sky."),
    // ── the holy finale
    t!("elijah", "fire-chariot", Holy, 0xFF6A1F, 0x4A1304, "מרכבת האש של אליהו", "Elijah's Chariot of Fire", "אליהו", "ELIJAH",
       "״רֶכֶב אֵשׁ וְסוּסֵי אֵשׁ״ (מלכים ב׳ ב, יא)", "“A chariot of fire, and horses of fire” (2 Kings 2:11)"),
    t!("donkey", "donkey", Holy, 0xFFF6E0, 0x3D3322, "החמור הלבן של המשיח", "The Messiah's White Donkey", "חמור המשיח", "MESSIAH",
       "״עָנִי וְרֹכֵב עַל חֲמוֹר״ (זכריה ט, ט)", "“Lowly, and riding upon an ass” (Zechariah 9:9)"),
    t!("god", "", God, 0xFFFFFF, 0xFFF8E6, "אלוהי ישראל", "The God of Israel", "", "",
       "״אֶהְיֶה אֲשֶׁר אֶהְיֶה״ (שמות ג, יד)", "“I AM THAT I AM” (Exodus 3:14)"),
];

pub struct CatInfo { pub he: &'static str, pub en: &'static str, pub toast_he: &'static str, pub toast_en: &'static str, pub bg_top: u32, pub bg_bottom: u32, pub accent: u32 }
pub static CATS: [CatInfo; 7] = [
    CatInfo { he: "מכוניות", en: "Cars", toast_he: "מתניעים", toast_en: "Engines on", bg_top: 0x05060B, bg_bottom: 0x0B0F1E, accent: 0x7C8BFF },
    CatInfo { he: "מטוסים", en: "Planes", toast_he: "המראה!", toast_en: "Takeoff!", bg_top: 0x020818, bg_bottom: 0x0B2346, accent: 0x6FB7FF },
    CatInfo { he: "חלל", en: "Space", toast_he: "יוצאים מהאטמוספרה", toast_en: "Leaving the atmosphere", bg_top: 0x000000, bg_bottom: 0x120A2A, accent: 0xB18CFF },
    CatInfo { he: "מדע בדיוני", en: "Science fiction", toast_he: "מעבר לגבולות המדע", toast_en: "Beyond known physics", bg_top: 0x07000F, bg_bottom: 0x2A0533, accent: 0xFF52DC },
    CatInfo { he: "מיתולוגיה", en: "Mythology", toast_he: "ארץ האלים", toast_en: "Realm of the gods", bg_top: 0x0E0603, bg_bottom: 0x3A1E05, accent: 0xFFC34D },
    CatInfo { he: "קודש", en: "Holy", toast_he: "אליהו הנביא בדרך…", toast_en: "Elijah is on his way…", bg_top: 0x120804, bg_bottom: 0x4A2A0C, accent: 0xFFE2A8 },
    CatInfo { he: "אלוהים", en: "God", toast_he: "", toast_en: "", bg_top: 0x1A1408, bg_bottom: 0xFFF6DD, accent: 0xFFFFFF },
];

#[inline] pub fn tier(i: u8) -> &'static Tier { &TIERS[(i as usize).min(N_TIERS - 1)] }
