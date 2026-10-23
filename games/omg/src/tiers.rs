//! The ladder: 124 rides, from a crawling baby to the God of Israel, in 15 eras.
//! Facts in the blurbs are checked; the rest is play.

pub const N_TIERS: usize = 124;
pub const GOD: u8 = 123;
pub const N_CATS: usize = 15;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Cat {
    Foot = 0, Motors = 1, Cars = 2, Premium = 3, Super = 4, Hyper = 5, Monsters = 6, Rails = 7,
    Seas = 8, Skies = 9, Space = 10, SciFi = 11, Myth = 12, Holy = 13, God = 14,
}

pub struct Tier {
    /// also the icon file name (icons/<key>.svg)
    pub key: &'static str,
    pub cat: Cat,
    /// rim / glow colour (the vehicle's signature colour)
    pub color: u32,
    pub he: &'static str,
    pub en: &'static str,
    pub label_he: &'static str,
    pub label_en: &'static str,
    pub blurb_he: &'static str,
    pub blurb_en: &'static str,
}

macro_rules! t {
    ($key:expr, $cat:ident, $color:expr, $he:expr, $en:expr, $lhe:expr, $len:expr, $bhe:expr, $ben:expr) => {
        Tier { key: $key, cat: Cat::$cat, color: $color, he: $he, en: $en, label_he: $lhe, label_en: $len, blurb_he: $bhe, blurb_en: $ben }
    };
}

pub static TIERS: [Tier; N_TIERS] = [
    // ── on foot
    t!("crawl", Foot, 0xFFB3C7, "זחילה", "Crawling", "זחילה", "CRAWL",
       "הרכב הראשון של כולנו. ארבע על ארבע.", "Everyone's first ride. Four-wheel drive."),
    t!("walk", Foot, 0xFFE066, "הליכה", "Walking", "הליכה", "WALK",
       "צעד ראשון. כל המשפחה צועקת OMG.", "First steps. The whole family screams OMG."),
    t!("run", Foot, 0xFF8A50, "ריצה", "Running", "ריצה", "RUN",
       "האדם המהיר ביותר הגיע לכ־44 קמ״ש.", "The fastest human ever hit about 44 km/h."),
    t!("bicycle", Foot, 0xFF4D4D, "אופניים", "Bicycle", "אופניים", "BIKE",
       "מאז 1817 — ועדיין הדרך היעילה ביותר להזיז בן אדם.", "Since 1817 — still the most efficient way to move a human."),
    t!("escooter", Foot, 0x7CFF6B, "קורקינט חשמלי", "E-Scooter", "קורקינט", "E-SCOOTER",
       "כבש את כל המדרכות בעיר.", "Conquered every sidewalk in town."),
    t!("ebike", Foot, 0xFF9A3C, "אופניים חשמליים", "E-Bike", "חשמליים", "E-BIKE",
       "הרכב הלאומי של בני הנוער.", "The national vehicle of teenagers."),
    t!("segway", Foot, 0xD8DEE9, "סגוויי", "Segway", "סגוויי", "SEGWAY",
       "מאזן את עצמו בעזרת ג׳ירוסקופים. נחשף ב־2001.", "Balances itself with gyroscopes. Unveiled in 2001."),
    // ── small motors
    t!("vespa", Motors, 0x8FE3C4, "וספה", "Vespa", "וספה", "VESPA",
       "״צרעה״ באיטלקית. מאז 1946.", "Italian for “wasp”. Since 1946."),
    t!("supercub", Motors, 0xFF5A5A, "הונדה סופר קאב", "Honda Super Cub", "סופר קאב", "SUPER CUB",
       "יותר מ־100 מיליון יחידות — כלי הרכב הממונע הנפוץ בהיסטוריה.", "Over 100 million built — the most-produced motor vehicle ever."),
    t!("tuktuk", Motors, 0xFFD400, "טוק־טוק", "Tuk-Tuk", "טוק־טוק", "TUK-TUK",
       "שלושה גלגלים, אפס דלתות, אינסוף צפצופים.", "Three wheels, zero doors, endless honking."),
    t!("quad", Motors, 0xFF8C1A, "טרקטורון", "Quad Bike", "טרקטורון", "QUAD",
       "ארבעה גלגלים, אפס כבישים.", "Four wheels, zero roads."),
    t!("harley", Motors, 0xFF7A00, "הארלי־דייווידסון", "Harley-Davidson", "הארלי", "HARLEY",
       "מאז 1903. כרום, עור ורעש.", "Since 1903. Chrome, leather and noise."),
    t!("ducati", Motors, 0xFF2D2D, "דוקאטי", "Ducati", "דוקאטי", "DUCATI",
       "סופרבייק איטלקי. אדום, כמובן.", "An Italian superbike. Red, of course."),
    t!("ninja", Motors, 0x6BFF3A, "קוואסאקי נינג׳ה H2R", "Kawasaki Ninja H2R", "נינג׳ה", "NINJA H2R",
       "400 קמ״ש על שני גלגלים. עם מגדש־על.", "400 km/h on two wheels. Supercharged."),
    // ── everyday cars
    t!("picanto", Cars, 0xC9E03C, "קיה פיקנטו", "Kia Picanto", "פיקנטו", "PICANTO",
       "הקטנה של קיה. סוף סוף — מכונית!", "Kia's smallest. Finally, a car!"),
    t!("fiat500", Cars, 0xA8D8FF, "פיאט 500", "Fiat 500", "פיאט 500", "FIAT 500",
       "״צ׳ינקווצ׳נטו״. סמל איטלקי מאז 1957.", "The Cinquecento. An Italian icon since 1957."),
    t!("mini", Cars, 0x2FBF71, "מיני קופר", "Mini Cooper", "מיני", "MINI",
       "קטנה, בריטית — וזכתה בראלי מונטה קרלו.", "Small, British — and a Monte Carlo Rally winner."),
    t!("beetle", Cars, 0x7EC8FF, "חיפושית", "VW Beetle", "חיפושית", "BEETLE",
       "יותר מ־21 מיליון חיפושיות נבנו.", "Over 21 million were built."),
    t!("corolla", Cars, 0xC8D0DC, "טויוטה קורולה", "Toyota Corolla", "קורולה", "COROLLA",
       "המכונית הנמכרת ביותר בהיסטוריה.", "The best-selling car in history."),
    t!("wrx", Cars, 0x3D7BFF, "סובארו WRX", "Subaru WRX", "WRX", "WRX",
       "כחול, זהב ובוץ. נולדה לראלי.", "Blue, gold and mud. Born to rally."),
    t!("mx5", Cars, 0xFF3B3B, "מאזדה MX-5", "Mazda MX-5", "MX-5", "MX-5",
       "הרודסטר הדו־מושבי הנמכר ביותר בעולם.", "The world's best-selling two-seat roadster."),
    // ── premium
    t!("wrangler", Premium, 0x9DBB52, "ג׳יפ רנגלר", "Jeep Wrangler", "רנגלר", "WRANGLER",
       "הנכדה של הג׳יפ ממלחמת העולם השנייה.", "Grandchild of the WWII Jeep."),
    t!("mustang", Premium, 0xFF4040, "פורד מוסטנג", "Ford Mustang", "מוסטנג", "MUSTANG",
       "המציאה את ה״פוני קאר״ ב־1964.", "Invented the pony car in 1964."),
    t!("models", Premium, 0xE8F4FF, "טסלה מודל S", "Tesla Model S", "מודל S", "MODEL S",
       "חשמלית, שקטה ומהירה בטירוף.", "Electric, silent, absurdly quick."),
    t!("m5", Premium, 0x3D82FF, "ב.מ.וו M5", "BMW M5", "M5", "M5",
       "סדאן משפחתית עם לב של מכונית מרוץ.", "A family sedan with a race car's heart."),
    t!("gclass", Premium, 0xB0B8C8, "מרצדס G", "Mercedes G-Class", "G", "G-CLASS",
       "נבנית מאז 1979 וכמעט לא השתנתה.", "Built since 1979, and barely changed."),
    t!("rangerover", Premium, 0x4FAF7A, "ריינג׳ רובר", "Range Rover", "ריינג׳", "RANGE ROVER",
       "יוקרה שמטפסת על הרים, מאז 1970.", "Luxury that climbs mountains, since 1970."),
    t!("p911", Premium, 0xFFD12E, "פורשה 911", "Porsche 911", "911", "911",
       "המנוע מאחור — מאז 1964.", "Engine in the back since 1964."),
    t!("gtr", Premium, 0x9AA6B8, "ניסאן GT-R", "Nissan GT-R", "GT-R", "GT-R",
       "הכינוי שלה: גודזילה.", "Nickname: Godzilla."),
    // ── supercars
    t!("cobra", Super, 0x4A7BFF, "שלבי קוברה", "Shelby Cobra", "קוברה", "COBRA",
       "אגדה אמריקאית מאז 1962.", "An American legend since 1962."),
    t!("gt40", Super, 0x6FB7FF, "פורד GT40", "Ford GT40", "GT40", "GT40",
       "ניצחה בלה־מאן ארבע שנים ברציפות, 1966–1969.", "Won Le Mans four years running, 1966–69."),
    t!("countach", Super, 0xF4F6FF, "למבורגיני קונטאש", "Lamborghini Countach", "קונטאש", "COUNTACH",
       "הפוסטר שהיה תלוי בכל חדר בשנות ה־80.", "The poster on every bedroom wall in the ’80s."),
    t!("f40", Super, 0xFF2A1F, "פרארי F40", "Ferrari F40", "F40", "F40",
       "המכונית האחרונה שאנצו פרארי אישר בעצמו.", "The last car Enzo Ferrari personally approved."),
    t!("mclarenf1", Super, 0xFF8A00, "מקלארן F1", "McLaren F1", "מקלארן", "McLAREN F1",
       "הנהג יושב באמצע. 386 קמ״ש ב־1998.", "Driver in the middle. 386 km/h in 1998."),
    t!("aventador", Super, 0x9CFF2E, "למבורגיני אוונטדור", "Lamborghini Aventador", "אוונטדור", "AVENTADOR",
       "V12, דלתות מספריים, אפס צניעות.", "V12, scissor doors, zero modesty."),
    t!("laferrari", Super, 0xFF1A3C, "לה־פרארי", "LaFerrari", "לה־פרארי", "LaFERRARI",
       "״הפרארי״. רק 499 קופה נבנו.", "“The Ferrari.” Only 499 coupés."),
    // ── hypercars & royals
    t!("phantom", Hyper, 0xD9D9E6, "רולס־רויס פנטום", "Rolls-Royce Phantom", "פנטום", "PHANTOM",
       "יש ״פנטום״ מאז 1925.", "There has been a Phantom since 1925."),
    t!("veyron", Hyper, 0x4D6BFF, "בוגאטי ויירון", "Bugatti Veyron", "ויירון", "VEYRON",
       "‏1,001 כוחות סוס ו־407 קמ״ש — ב־2005.", "1,001 PS and 407 km/h — in 2005."),
    t!("chiron", Hyper, 0x2E8BFF, "בוגאטי שירון", "Bugatti Chiron", "שירון", "CHIRON",
       "גרסה שלה עברה את ה־490 קמ״ש.", "A version of it passed 490 km/h."),
    t!("zonda", Hyper, 0xC0C8D6, "פגאני זונדה", "Pagani Zonda", "זונדה", "ZONDA",
       "ארבעה אגזוזים באמצע. בעבודת יד.", "Four exhausts in the middle. Hand-built."),
    t!("huayra", Hyper, 0xE0A84F, "פגאני ווירה", "Pagani Huayra", "ווירה", "HUAYRA",
       "נקראת על שם אל הרוח של האנדים.", "Named after an Andean wind god."),
    t!("jesko", Hyper, 0xF0F4FF, "קניגזג יסקו", "Koenigsegg Jesko", "יסקו", "JESKO",
       "נקראת על שם אביו של המייסד.", "Named after the founder's father."),
    t!("nevera", Hyper, 0x2EF0E0, "רימאק נברה", "Rimac Nevera", "נברה", "NEVERA",
       "חשמלית מקרואטיה. 412 קמ״ש.", "Electric, from Croatia. 412 km/h."),
    t!("boattail", Hyper, 0x9FD8FF, "רולס־רויס בואט טייל", "Rolls-Royce Boat Tail", "בואט טייל", "BOAT TAIL",
       "דווח כמכונית החדשה היקרה בעולם — כ־28 מיליון דולר.", "Reportedly the priciest new car ever — about $28M."),
    // ── monsters & records
    t!("f1", Monsters, 0xFF3030, "מכונית פורמולה 1", "Formula 1 Car", "F1", "F1",
       "כל כך הרבה כוח צמידה, שבתיאוריה תיסע הפוך על התקרה.", "Enough downforce to drive upside down — in theory."),
    t!("monstertruck", Monsters, 0xB44DFF, "מונסטר טראק", "Monster Truck", "מונסטר", "MONSTER",
       "גלגלים גבוהים מרוב בני האדם.", "Tyres taller than most people."),
    t!("belaz", Monsters, 0xFFC000, "בלאז 75710", "BelAZ 75710", "בלאז", "BelAZ",
       "משאית הכרייה הגדולה בעולם: 450 טון מטען.", "The world's largest dump truck: 450 tonnes of payload."),
    t!("bagger", Monsters, 0xFF8A3D, "באגר 288", "Bagger 288", "באגר", "BAGGER 288",
       "‏13,500 טון. כלי הרכב היבשתי הגדול שנבנה.", "13,500 tonnes. The largest land vehicle ever built."),
    t!("thrustssc", Monsters, 0xFFB627, "ת׳ראסט SSC", "Thrust SSC", "ת׳ראסט", "THRUST SSC",
       "‏1,228 קמ״ש ב־1997 — מהיר מהקול, על הקרקע.", "1,228 km/h in 1997 — supersonic, on the ground."),
    // ── rails
    t!("steam", Rails, 0x4D8CFF, "קטר הקיטור מלארד", "Mallard Steam Locomotive", "מלארד", "MALLARD",
       "‏203 קמ״ש ב־1938 — שיא קיטור שעדיין עומד.", "203 km/h in 1938 — a steam record that still stands."),
    t!("orientexpress", Rails, 0xFFD27A, "אוריינט אקספרס", "Orient Express", "אוריינט", "ORIENT",
       "פריז–קושטא מאז 1883. ארוחת ערב בעניבה.", "Paris to Constantinople since 1883. Black tie for dinner."),
    t!("tgv", Rails, 0x8FB8FF, "TGV", "TGV", "TGV", "TGV",
       "‏574.8 קמ״ש ב־2007 — שיא הרכבות על גלגלים.", "574.8 km/h in 2007 — the record for a train on wheels."),
    t!("shinkansen", Rails, 0x3DA0FF, "שינקנסן", "Shinkansen", "שינקנסן", "SHINKANSEN",
       "רכבת הקליע של יפן, מאז 1964.", "Japan's bullet train, since 1964."),
    t!("maglev", Rails, 0x3DF5FF, "רכבת מגלב", "Maglev", "מגלב", "MAGLEV",
       "מרחפת על מגנטים. 603 קמ״ש ב־2015.", "Floats on magnets. 603 km/h in 2015."),
    t!("hyperloop", Rails, 0xB5F0FF, "היפרלופ", "Hyperloop", "היפרלופ", "HYPERLOOP",
       "קפסולה בצינור ריק מאוויר. עדיין חלום.", "A pod in a vacuum tube. Still a dream."),
    // ── seas
    t!("jetski", Seas, 0xFF5A4E, "אופנוע ים", "Jet Ski", "אופנוע ים", "JET SKI",
       "אופנוע — אבל על המים.", "A motorbike — on water."),
    t!("speedboat", Seas, 0xFF3D5A, "סירת מרוץ", "Speedboat", "סירת מרוץ", "SPEEDBOAT",
       "החרטום באוויר, הרסס בפנים של כולם.", "Nose in the air, spray in everyone's face."),
    t!("ac75", Seas, 0x3DD5FF, "AC75 של גביע אמריקה", "America's Cup AC75", "AC75", "AC75",
       "סירה שעפה מעל המים. הגביע הוותיק בספורט, מאז 1851.", "A boat that flies over the water. Sport's oldest trophy, since 1851."),
    t!("trieste", Seas, 0x7FA8C9, "הבתיסקף טריאסטה", "Bathyscaphe Trieste", "טריאסטה", "TRIESTE",
       "ירדה ב־1960 לעומק של כמעט 11 ק״מ.", "Dived almost 11 km deep in 1960."),
    t!("superyacht", Seas, 0xF4FAFF, "סופר־יאכטה", "Superyacht", "יאכטה", "SUPERYACHT",
       "מסוק על הגג וצוללת במחסן.", "A helicopter on the roof, a submarine in the garage."),
    t!("cruiseship", Seas, 0x4FC3FF, "ספינת תענוגות ענקית", "Mega Cruise Ship", "קרוז", "CRUISE",
       "הגדולה בעולם מסיעה כמעט 7,600 נוסעים.", "The biggest carries nearly 7,600 passengers."),
    t!("carrier", Seas, 0xA9B7C6, "נושאת מטוסים", "Aircraft Carrier", "נושאת", "CARRIER",
       "שדה תעופה צף. כ־13 מיליארד דולר.", "A floating airport. About $13 billion."),
    // ── skies
    t!("balloon", Skies, 0xFF5A4E, "כדור פורח", "Hot-Air Balloon", "כדור פורח", "BALLOON",
       "הטיסה הראשונה של בני אדם — פריז, 1783.", "Humanity's first flight — Paris, 1783."),
    t!("wright", Skies, 0xF2DFA8, "המטוס של האחים רייט", "Wright Flyer", "רייט", "WRIGHT",
       "‏12 שניות של טיסה, 1903. משם הכול התחיל.", "12 seconds of flight in 1903. It all started here."),
    t!("zeppelin", Skies, 0xD6DEE8, "צפלין", "Zeppelin", "צפלין", "ZEPPELIN",
       "ההינדנבורג: 245 מטר — כלי הטיס הגדול שטס אי פעם.", "The Hindenburg: 245 m — the largest aircraft ever flown."),
    t!("cessna", Skies, 0xFF7A70, "צסנה 172", "Cessna 172", "צסנה", "CESSNA",
       "המטוס שיוצר הכי הרבה פעמים בהיסטוריה.", "The most-produced aircraft in history."),
    t!("helicopter", Skies, 0xFF4D3D, "מסוק", "Helicopter", "מסוק", "HELI",
       "לא צריך מסלול. רק טק־טק־טק.", "No runway. Just chop-chop-chop."),
    t!("g650", Skies, 0xE2CFA0, "גאלפסטרים G650", "Gulfstream G650", "G650", "G650",
       "המטוס הפרטי של המיליארדרים.", "The billionaire's commute."),
    t!("b747", Skies, 0x7FB0FF, "בואינג 747", "Boeing 747", "747", "747",
       "״מלכת השמיים״, מאז 1969.", "The Queen of the Skies, since 1969."),
    t!("a380", Skies, 0x56D9FF, "איירבוס A380", "Airbus A380", "A380", "A380",
       "מטוס הנוסעים הגדול בעולם. שתי קומות.", "The world's largest airliner. Two full decks."),
    t!("an225", Skies, 0xFFD84D, "אנטונוב An-225 ״מריה״", "Antonov An-225 Mriya", "מריה", "MRIYA",
       "המטוס הכבד בהיסטוריה. נהרס ב־2022.", "The heaviest aircraft ever. Destroyed in 2022."),
    t!("concorde", Skies, 0xF2F6FF, "קונקורד", "Concorde", "קונקורד", "CONCORDE",
       "לונדון–ניו יורק בפחות משלוש וחצי שעות.", "London to New York in under 3½ hours."),
    t!("f35", Skies, 0x9FB2C8, "F-35I אדיר", "F-35I Adir", "אדיר", "ADIR",
       "מטוס החמקן של חיל האוויר. ״אדיר״.", "The Israeli Air Force's stealth jet. “Adir” means mighty."),
    t!("sr71", Skies, 0xA9A2FF, "SR-71 בלקבירד", "SR-71 Blackbird", "SR-71", "SR-71",
       "‏3,530 קמ״ש. שיא שעומד מאז 1976.", "2,193 mph. A record standing since 1976."),
    t!("b2", Skies, 0x6CFFA2, "B-2 ספיריט", "B-2 Spirit", "B-2", "B-2",
       "כ־2 מיליארד דולר ליחידה.", "About $2 billion apiece."),
    t!("x15", Skies, 0xFF9E3D, "X-15", "X-15", "X-15", "X-15",
       "מאך 6.7 ב־1967. המטוס המאויש המהיר אי פעם.", "Mach 6.7 in 1967. The fastest crewed aircraft ever."),
    // ── space
    t!("vostok", Space, 0xFFA048, "ווסטוק 1", "Vostok 1", "ווסטוק", "VOSTOK",
       "‏12 באפריל 1961: האדם הראשון בחלל.", "12 April 1961: the first human in space."),
    t!("saturnv", Space, 0xF0F2F6, "סטורן 5", "Saturn V", "סטורן 5", "SATURN V",
       "יולי 1969. בני אדם על הירח.", "July 1969. People on the Moon."),
    t!("lunarrover", Space, 0xFFD54F, "רכב הירח", "Lunar Rover", "רכב ירח", "MOON BUGGY",
       "מכונית על הירח. שלוש עדיין חונות שם.", "A car on the Moon. Three are still parked there."),
    t!("shuttle", Space, 0xFFFFFF, "מעבורת החלל", "Space Shuttle", "מעבורת", "SHUTTLE",
       "‏135 משימות, 1981–2011.", "135 missions, 1981–2011."),
    t!("soyuz", Space, 0x9BE07A, "סויוז", "Soyuz", "סויוז", "SOYUZ",
       "מטיסה בני אדם מאז 1967.", "Flying people since 1967."),
    t!("perseverance", Space, 0xFF7A4D, "פרסוורנס ואינג׳נואיטי", "Perseverance & Ingenuity", "מאדים", "MARS",
       "‏2021: הטיסה הממונעת הראשונה על כוכב לכת אחר.", "2021: the first powered flight on another planet."),
    t!("falcon9", Space, 0xE8ECF2, "פלקון 9", "Falcon 9", "פלקון 9", "FALCON 9",
       "טיל שחוזר ונוחת על הרגליים.", "A rocket that comes back and lands on its legs."),
    t!("starship", Space, 0xC9D6E4, "סטארשיפ", "Starship", "סטארשיפ", "STARSHIP",
       "הטיל הגדול והחזק ביותר שטס אי פעם.", "The largest, most powerful rocket ever flown."),
    t!("iss", Space, 0xFFD54F, "תחנת החלל הבינלאומית", "International Space Station", "ISS", "ISS",
       "החפץ היקר ביותר שבנה האדם.", "The most expensive object ever built."),
    t!("voyager", Space, 0xFFE08A, "וויאג׳ר 1", "Voyager 1", "וויאג׳ר", "VOYAGER",
       "העצם הרחוק ביותר שבנה אדם. בחלל הבין־כוכבי מאז 2012.", "The farthest human-made object. In interstellar space since 2012."),
    t!("parker", Space, 0xFFB13D, "גשושית פרקר", "Parker Solar Probe", "פרקר", "PARKER",
       "כ־692,000 קמ״ש — העצם המהיר ביותר שבנה אדם.", "About 692,000 km/h — the fastest object humans ever made."),
    // ── science fiction
    t!("hoverboard", SciFi, 0x3DE0FF, "הוברבורד", "Hoverboard", "הובר", "HOVER",
       "סקייטבורד בלי גלגלים. הובטח לנו.", "A skateboard with no wheels. We were promised."),
    t!("jetpack", SciFi, 0xFF9E3D, "ג׳טפאק", "Jetpack", "ג׳טפאק", "JETPACK",
       "תרמיל עם טורבינות. מה כבר יכול להשתבש?", "A backpack with turbines. What could go wrong?"),
    t!("flyingcar", SciFi, 0xFF52DC, "מכונית מעופפת", "Flying Car", "מעופפת", "HOVERCAR",
       "הבטיחו לנו אותה עד שנת 2000.", "We were promised these by 2000."),
    t!("mech", SciFi, 0xFF8A3D, "רובוט ענק", "Giant Mech", "רובוט", "MECH",
       "איפה מחנים את זה? בהצלחה.", "Parking it? Good luck."),
    t!("ufo", SciFi, 0x46FF8E, "צלחת מעופפת", "Flying Saucer", "עב״ם", "UFO",
       "הם כאן.", "They're here."),
    t!("starfighter", SciFi, 0x8A7BFF, "ספינת קרב חללית", "Starfighter", "ספינת קרב", "FIGHTER",
       "מה שקורה כשמטוס קרב יוצא מהאטמוספרה.", "What happens when a fighter jet leaves the atmosphere."),
    t!("warpdrive", SciFi, 0xBDF6FF, "מנוע עיוות", "Warp Drive", "עיוות", "WARP",
       "מכווצים את החלל מלפנים ומותחים מאחור (אלקוביירה, 1994).", "Squeeze space ahead, stretch it behind (Alcubierre, 1994)."),
    t!("teleporter", SciFi, 0x14E8FF, "טלפורטציה", "Teleporter", "טלפורט", "TELEPORT",
       "לא נוסעים. פשוט מגיעים.", "Don't travel. Arrive."),
    t!("wormhole", SciFi, 0xA66BFF, "חור תולעת", "Wormhole", "חור תולעת", "WORMHOLE",
       "קיצור דרך דרך המרחב־זמן.", "A shortcut through spacetime."),
    t!("timemachine", SciFi, 0xFFC93C, "מכונת זמן", "Time Machine", "מכונת זמן", "TIME",
       "מגיעים לפני שיצאת (ה״ג ולס, 1895).", "Arrive before you leave (H. G. Wells, 1895)."),
    t!("planetengine", SciFi, 0x4DA6FF, "מנוע פלנטרי", "Planet Engine", "פלנטרי", "PLANET",
       "למה לטוס בחללית, אם אפשר לקחת את כל כדור הארץ?", "Why take a ship when you can take the whole planet?"),
    // ── rides of the gods
    t!("mushika", Myth, 0xFFB84D, "מושיקה, העכבר של גנש", "Mushika, Ganesha's Mouse", "מושיקה", "MUSHIKA",
       "אל עם ראש של פיל — שרוכב על עכבר.", "An elephant-headed god — who rides a mouse."),
    t!("talaria", Myth, 0xFFE07A, "הסנדלים המכונפים של הרמס", "Hermes' Winged Sandals", "הרמס", "HERMES",
       "שליח האלים לא מחכה לאוטובוס.", "The messenger of the gods doesn't wait for the bus."),
    t!("freyja", Myth, 0xFFD27A, "מרכבת החתולים של פריה", "Freyja's Cat Chariot", "פריה", "FREYJA",
       "אלה נורדית במרכבה רתומה לשני חתולים.", "A Norse goddess in a chariot pulled by two cats."),
    t!("wukong", Myth, 0xFFD23F, "ענן הסלטות של סון ווקונג", "Sun Wukong's Cloud", "ווקונג", "WUKONG",
       "‏108,000 לי בסלטה אחת (מסע למערב).", "108,000 li in a single somersault (Journey to the West)."),
    t!("pegasus", Myth, 0xFFF4D6, "פגסוס", "Pegasus", "פגסוס", "PEGASUS",
       "הסוס המכונף של המיתולוגיה היוונית.", "The winged horse of Greek myth."),
    t!("sleipnir", Myth, 0xB9CCE6, "סלייפניר", "Sleipnir", "סלייפניר", "SLEIPNIR",
       "שמונה רגליים. הסוס של אודין.", "Eight legs. Odin's horse."),
    t!("thor", Myth, 0x7AD7FF, "מרכבת התיישים של ת׳ור", "Thor's Goat Chariot", "ת׳ור", "THOR",
       "ת׳ור אוכל את התיישים בערב, ובבוקר הם שוב מושכים.", "Thor eats his goats at night; by morning they're pulling again."),
    t!("skidbladnir", Myth, 0x9FE8FF, "סקידבלדניר", "Skíðblaðnir", "סקידבלדניר", "SKIDBLADNIR",
       "הספינה הטובה באסגארד — ומתקפלת לכיס.", "The best ship in Asgard — and it folds into a pouch."),
    t!("torifune", Myth, 0xFF6B6B, "אמה־נו־טוריפונה", "Ame-no-Torifune", "טוריפונה", "TORIFUNE",
       "״סירת־הציפור השמימית״ מהמיתולוגיה היפנית.", "The Heavenly Bird-Boat of Japanese myth."),
    t!("garuda", Myth, 0xFF8A1E, "גארודה", "Garuda", "גארודה", "GARUDA",
       "מלך הציפורים — הרכב של וישנו.", "King of birds — Vishnu's mount."),
    t!("airavata", Myth, 0xF2F2FF, "אייראוואטה", "Airavata", "אייראוואטה", "AIRAVATA",
       "הפיל הלבן של אינדרה, מלך האלים.", "Indra's white elephant."),
    t!("hippocampi", Myth, 0x3DE0D0, "מרכבת פוסידון", "Poseidon's Chariot", "פוסידון", "POSEIDON",
       "רתומה לסוסים עם זנבות של דגים.", "Pulled by horses with fish tails."),
    t!("pushpaka", Myth, 0xFFD84D, "פושפקה וימאנה", "Pushpaka Vimana", "פושפקה", "PUSHPAKA",
       "ארמון מעופף מהרמאיאנה. תמיד יש בו מקום לעוד אחד.", "A flying palace from the Ramayana. Always room for one more."),
    t!("ra", Myth, 0xFFD000, "ספינת השמש של רע", "Ra's Solar Barque", "רע", "RA",
       "חוצה את השמיים בכל יום.", "Crosses the sky every day."),
    t!("helios", Myth, 0xFFE98A, "מרכבת השמש של הליוס", "Helios' Sun Chariot", "הליוס", "HELIOS",
       "מושך את השמש על פני השמיים.", "Hauls the sun across the sky."),
    // ── holy
    t!("ark", Holy, 0xC98B4F, "תיבת נח", "Noah's Ark", "תיבת נח", "ARK",
       "״שְׁלֹשׁ מֵאוֹת אַמָּה אֹרֶךְ הַתֵּבָה״ (בראשית ו, טו)", "“The length of the ark shall be three hundred cubits” (Genesis 6:15)"),
    t!("jonah", Holy, 0x5AB4FF, "הדג הגדול של יונה", "Jonah's Great Fish", "יונה", "JONAH",
       "״וַיְמַן ה׳ דָּג גָּדוֹל לִבְלֹעַ אֶת יוֹנָה״ (יונה ב, א)", "“The LORD had prepared a great fish to swallow up Jonah” (Jonah 1:17)"),
    t!("eagles", Holy, 0xE8B04F, "על כנפי נשרים", "On Eagles' Wings", "נשרים", "EAGLES",
       "״וָאֶשָּׂא אֶתְכֶם עַל כַּנְפֵי נְשָׁרִים״ (שמות יט, ד)", "“I bare you on eagles' wings” (Exodus 19:4)"),
    t!("ladder", Holy, 0xFFE7A0, "סולם יעקב", "Jacob's Ladder", "סולם", "LADDER",
       "״סֻלָּם מֻצָּב אַרְצָה וְרֹאשׁוֹ מַגִּיעַ הַשָּׁמָיְמָה״ (בראשית כח, יב)", "“A ladder set up on the earth, and the top of it reached to heaven” (Genesis 28:12)"),
    t!("kfitzat", Holy, 0xFFF0B5, "קפיצת הדרך", "Kfitzat HaDerech", "קפיצת הדרך", "THE LEAP",
       "״שְׁלֹשָׁה קָפְצָה לָהֶם הָאָרֶץ״ (סנהדרין צה, א)", "“For three, the earth leapt” — the road that shrinks (Sanhedrin 95a)"),
    t!("pillar", Holy, 0xFFB25A, "עמוד הענן", "Pillar of Cloud and Fire", "עמוד ענן", "PILLAR",
       "״יוֹמָם בְּעַמּוּד עָנָן… וְלַיְלָה בְּעַמּוּד אֵשׁ״ (שמות יג, כא)", "“By day in a pillar of a cloud… by night in a pillar of fire” (Exodus 13:21)"),
    t!("elijah", Holy, 0xFF6A1F, "מרכבת האש של אליהו", "Elijah's Chariot of Fire", "אליהו", "ELIJAH",
       "״רֶכֶב אֵשׁ וְסוּסֵי אֵשׁ״ (מלכים ב׳ ב, יא)", "“A chariot of fire, and horses of fire” (2 Kings 2:11)"),
    t!("merkavah", Holy, 0xFFE066, "מרכבת יחזקאל", "Ezekiel's Chariot", "מרכבה", "MERKAVAH",
       "״כַּאֲשֶׁר יִהְיֶה הָאוֹפַן בְּתוֹךְ הָאוֹפָן״ (יחזקאל א, טז)", "“As it were a wheel in the middle of a wheel” (Ezekiel 1:16)"),
    t!("cherub", Holy, 0xFFD86B, "כרוב", "Cherub", "כרוב", "CHERUB",
       "״וַיִּרְכַּב עַל כְּרוּב וַיָּעֹף״ (תהלים יח, יא)", "“And he rode upon a cherub, and did fly” (Psalm 18:10)"),
    t!("donkey", Holy, 0xFFF6E0, "החמור הלבן של המשיח", "The Messiah's White Donkey", "חמור המשיח", "MESSIAH",
       "״עָנִי וְרֹכֵב עַל חֲמוֹר״ (זכריה ט, ט)", "“Lowly, and riding upon an ass” (Zechariah 9:9)"),
    t!("god", God, 0xFFFFFF, "אלוהי ישראל", "The God of Israel", "", "",
       "״אֶהְיֶה אֲשֶׁר אֶהְיֶה״ (שמות ג, יד)", "“I AM THAT I AM” (Exodus 3:14)"),
];

pub struct CatInfo {
    pub he: &'static str, pub en: &'static str,
    /// era card subtitle
    pub sub_he: &'static str, pub sub_en: &'static str,
    pub bg_top: u32, pub bg_bottom: u32, pub accent: u32,
}
pub static CATS: [CatInfo; N_CATS] = [
    CatInfo { he: "ברגל", en: "On Foot", sub_he: "הכול מתחיל בזחילה", sub_en: "It all starts with a crawl", bg_top: 0x120814, bg_bottom: 0x2A1230, accent: 0xFFB3C7 },
    CatInfo { he: "מנועים קטנים", en: "Small Motors", sub_he: "שומעים מנוע?", sub_en: "Is that an engine?", bg_top: 0x050F0B, bg_bottom: 0x0E2A1E, accent: 0x7CFFB2 },
    CatInfo { he: "מכוניות", en: "Cars", sub_he: "מתניעים", sub_en: "Engines on", bg_top: 0x05060B, bg_bottom: 0x0B1022, accent: 0x9FC2FF },
    CatInfo { he: "פרימיום", en: "Premium", sub_he: "עור, עץ ו־V8", sub_en: "Leather, wood and V8s", bg_top: 0x03070F, bg_bottom: 0x0C1A33, accent: 0x6FE6FF },
    CatInfo { he: "סופרקארים", en: "Supercars", sub_he: "פוסטרים על הקיר", sub_en: "Bedroom-wall posters", bg_top: 0x0F0305, bg_bottom: 0x2E0A0E, accent: 0xFF5A5A },
    CatInfo { he: "היפרקארים", en: "Hypercars", sub_he: "מיליונים על גלגלים", sub_en: "Millions on wheels", bg_top: 0x07040F, bg_bottom: 0x1F1040, accent: 0xB18CFF },
    CatInfo { he: "מפלצות ושיאים", en: "Monsters & Records", sub_he: "גדול. מהיר. מטורף.", sub_en: "Bigger. Faster. Madder.", bg_top: 0x120A02, bg_bottom: 0x3A2406, accent: 0xFFB627 },
    CatInfo { he: "רכבות", en: "Rails", sub_he: "כל הנוסעים לעלות!", sub_en: "All aboard!", bg_top: 0x0A0804, bg_bottom: 0x2A2010, accent: 0xFFD08A },
    CatInfo { he: "ים", en: "Seas", sub_he: "מפליגים", sub_en: "Setting sail", bg_top: 0x020A14, bg_bottom: 0x05304A, accent: 0x4FD8FF },
    CatInfo { he: "שמיים", en: "Skies", sub_he: "המראה!", sub_en: "Takeoff!", bg_top: 0x020818, bg_bottom: 0x0B2346, accent: 0x8FD3FF },
    CatInfo { he: "חלל", en: "Space", sub_he: "יוצאים מהאטמוספרה", sub_en: "Leaving the atmosphere", bg_top: 0x000000, bg_bottom: 0x120A2A, accent: 0xB9A2FF },
    CatInfo { he: "מדע בדיוני", en: "Science Fiction", sub_he: "מעבר לגבולות המדע", sub_en: "Beyond known physics", bg_top: 0x07000F, bg_bottom: 0x2A0533, accent: 0xFF52DC },
    CatInfo { he: "רכבי האלים", en: "Rides of the Gods", sub_he: "ארץ האלים", sub_en: "Realm of the gods", bg_top: 0x0E0603, bg_bottom: 0x3A1E05, accent: 0xFFC34D },
    CatInfo { he: "קודש", en: "Holy", sub_he: "מכאן — רק ניסים", sub_en: "From here on, only miracles", bg_top: 0x120804, bg_bottom: 0x4A2A0C, accent: 0xFFE2A8 },
    CatInfo { he: "אלוהים", en: "God", sub_he: "", sub_en: "", bg_top: 0x1A1408, bg_bottom: 0xFFF6DD, accent: 0xFFFFFF },
];

#[inline] pub fn tier(i: u8) -> &'static Tier { &TIERS[(i as usize).min(N_TIERS - 1)] }
#[inline] pub fn cat_of(i: u8) -> u8 { tier(i).cat as u8 }

/// Disc colour behind the picture: a deep shade of the rim colour.
pub fn fill_of(i: u8) -> u32 {
    let c = tier(i).color;
    let (r, g, b) = ((c >> 16) & 255, (c >> 8) & 255, c & 255);
    let k = |v: u32, base: u32| (v * 22 + base * 78) / 100;
    (k(r, 0x10) << 16) | (k(g, 0x12) << 8) | k(b, 0x1E)
}

/// First tier of an era.
pub fn era_first(c: u8) -> u8 {
    let mut i = 0u8;
    while (i as usize) < N_TIERS && (TIERS[i as usize].cat as u8) < c { i += 1; }
    i
}

/// Position of a tier inside its era, 0..1.
pub fn era_pos(t: u8) -> f32 {
    let c = cat_of(t);
    let a = era_first(c);
    let b = if (c as usize) + 1 < N_CATS { era_first(c + 1) } else { N_TIERS as u8 };
    if b <= a + 1 { return 1.0; }
    (t - a) as f32 / (b - a - 1) as f32
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ladder_is_sane() {
        assert_eq!(TIERS[GOD as usize].key, "god");
        let mut last = 0u8;
        for (i, t) in TIERS.iter().enumerate() {
            assert!(t.cat as u8 >= last, "era order broken at {}", t.key);
            last = t.cat as u8;
            for (j, u) in TIERS.iter().enumerate() { if i != j { assert_ne!(t.key, u.key); } }
        }
        assert_eq!(era_first(0), 0);
        assert_eq!(TIERS[era_first(Cat::Cars as u8) as usize].key, "picanto");
        assert_eq!(TIERS[era_first(Cat::Holy as u8) as usize].key, "ark");
    }
}
