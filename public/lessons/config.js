// ============================================================
//  שיעורים פרטיים במחשבים — הגדרות הדף והאפליקציה (קובץ אחד לערוך)
//  ------------------------------------------------------------
//  מצב הדגמה: כל עוד firebase הוא null, ההרשמה וההתקדמות נשמרות
//  בדפדפן בלבד (localStorage). כדי לעבור למצב חי, הדביקו כאן את
//  ה-config של פרויקט ה-Firebase שלכם (ראו docs/LESSONS-SETUP.md).
// ============================================================
window.PREP_CONFIG = {
  appName: "שיעורים פרטיים במחשבים",
  tagline: "תכנות, Linux ומערכות, והכנה למיונים טכנולוגיים — אחד על אחד, בקצב שלך",
  // מה מלמדים (מוצג בעמוד הבית; אפשר לערוך חופשי)
  topics: [
    { emoji: "🐍", title: "Python ומבוא לתכנות", desc: "מאפס ועד פרויקט ראשון: משתנים, לולאות, פונקציות, קבצים, ספריות." },
    { emoji: "⚙️", title: "C ו-C++", desc: "זיכרון, מצביעים, מבני נתונים — השפות שמאחורי מערכות אמיתיות." },
    { emoji: "🐧", title: "Linux ושורת הפקודה", desc: "לעבוד כמו מהנדס: טרמינל, סקריפטים, תהליכים, רשת." },
    { emoji: "📱", title: "Android ומערכות משובצות", desc: "איך טלפון באמת עובד — מהקרנל ועד האפליקציה." },
    { emoji: "🧠", title: "חשיבה אלגוריתמית ומדעי המחשב לתיכון", desc: "ליווי בבגרות, הבנה במקום שינון, פתרון בעיות." },
    { emoji: "🎯", title: "הכנה למיונים טכנולוגיים", desc: "8200, ממר״ם, עתודה ותוכניות מצוינות — עם אפליקציית תרגול מלאה." },
    { emoji: "🚩", title: "קורס CTF — אתגרי סייבר", desc: "פותרים אתגרי Capture The Flag בסביבות תרגול חוקיות: Linux, רשתות, Web, Reverse Engineering וקריפטו בסיסית. הכנה טובה גם לתרגיל ה-BlackBox במיונים." },
  ],
  // למי זה מתאים
  audiences: ["תלמידי תיכון", "לפני גיוס ומיונים", "סטודנטים בתחילת התואר", "מבוגרים שרוצים ללמוד לתכנת"],
  version: "1.0.0",

  // המורה (מוצג בעמוד הבית, בפנייה ובלוח הניהול)
  mentor: {
    name: "מיכאל בוג׳יו",
    email: "boggio.michael@gmail.com",
    phone: "058-707-0909",       // מוצג בדף ובפנייה (קישור חיוג)
    whatsapp: "972587070909",    // פורמט בינלאומי בלי + ; ריק = בלי כפתור וואטסאפ
    bio: "מהנדס תוכנה עם שש שנים בפיתוח Android ו-Linux ב-C/C++ בתעשייה, בוגר יחידה טכנולוגית בצה״ל. מלמד אחד על אחד — בזום או פרונטלי לפי תיאום — ועוקב אחרי ההתקדמות של כל תלמיד ותלמידה באפליקציית התרגול.",
  },

  // מי רואה את לוח הניהול (כתובות אימייל, באותיות קטנות)
  adminEmails: ["boggio.michael@gmail.com"],

  // פניות מהאתר נשלחות גם לאימייל דרך FormSubmit (אותו שירות כמו טופס יצירת הקשר באתר DATTA)
  leadsEndpoint: "https://formsubmit.co/ajax/boggio.michael@gmail.com",

  // ---- Firebase (מצב חי) ----
  // דוגמה:
  // firebase: { apiKey: "...", authDomain: "xxx.firebaseapp.com", projectId: "xxx", storageBucket: "xxx.appspot.com", messagingSenderId: "...", appId: "..." },
  firebase: {
    apiKey: "AIzaSyCtydHf1kmzKJ8FJTCFNj5iig_q-YW7j-E",
    authDomain: "computer-lessons-45c96.firebaseapp.com",
    projectId: "computer-lessons-45c96",
    storageBucket: "computer-lessons-45c96.firebasestorage.app",
    messagingSenderId: "291112758507",
    appId: "1:291112758507:web:aa82c8ef54044cab0d62ae",
    measurementId: "G-GJFTTFVFF9",
  },
  // מזהה מסד הנתונים ב-Firestore. ריק = מסד ברירת המחדל "(default)". כאן: המסד בשם dattacomputerlessons שיצרת.
  firestoreDbId: "dattacomputerlessons",
  // מפתח VAPID של Cloud Messaging (Project settings → Cloud Messaging → Web Push certificates)
  vapidKey: "BKE_pqXgPgEdOFb220r5RQEp51_5ODovTb8a2GL7MxwgNRog1kA728YwIe2bLfCfo59tutJB9lIjdobFpzNsPVU",

  // ---- שיעורים, מנויים ותשלום ----
  // המחירים מוצגים בעמוד "מחירים". הקישורים הם דפי תשלום מהסולק (Grow / PayPlus / וכו').
  // כל עוד קישור ריק — הכפתור מפנה לטופס פנייה/תיאום.
  prices: {
    lesson: 250,     // ₪ שיעור בודד (50 דק׳)
    pack5: 1150,     // ₪ חבילת 5 שיעורים
    pack10: 2100,    // ₪ חבילת 10 שיעורים (כולל PRO לעונה)
    monthly: 149,    // ₪ אפליקציית התרגול — PRO לחודש
    season: 490,     // ₪ PRO לעונה (6 חודשים)
    mentoring: 1990, // ₪ חבילת הכנה למיונים (PRO לעונה + 4 שיעורים + סימולציית ראיון)
    ctf: 1800,       // ₪ קורס CTF: 6 מפגשים של 75 דק׳ (אחד על אחד או עד 3 משתתפים) + PRO לעונה
  },
  payLinks: {
    lesson: "",
    pack5: "",
    pack10: "",
    monthly: "",
    season: "",
    mentoring: "",
    ctf: "",
  },

  // ללא מסלול חינמי: התרגול פתוח רק למנויי PRO (או לתלמידים בחבילת שיעורים, שמקבלים PRO).
  // אם תרצו בעתיד טעימה חינמית — dailyItems > 0 פותח מספר שאלות ביום.
  free: {
    dailyItems: 0,
    simulations: false,
  },

  // המלצות (מוצגות בעמוד הבית). במצב חי אפשר לערוך גם מלוח הניהול.
  // { name: "שם", text: "הטקסט", role: "י״ב, 2026" }
  testimonials: [],
};
