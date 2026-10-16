// ============================================================
//  מוכנים ל-8200 — הגדרות האפליקציה (קובץ אחד לערוך)
//  ------------------------------------------------------------
//  מצב הדגמה: כל עוד firebase הוא null, ההרשמה וההתקדמות נשמרות
//  בדפדפן בלבד (localStorage). כדי לעבור למצב חי, הדביקו כאן את
//  ה-config של פרויקט ה-Firebase שלכם (ראו docs/8200-SETUP.md).
// ============================================================
window.PREP_CONFIG = {
  appName: "מוכנים ל‑8200",
  tagline: "האימון היומי שלך לקראת מיוני 8200",
  version: "1.0.0",

  // המלווה (מוצג בעמוד הבית, בפנייה ובלוח הניהול)
  mentor: {
    name: "מיכאל בוג׳יו",
    email: "boggio.michael@gmail.com",
    // מספר וואטסאפ בפורמט בינלאומי בלי + (למשל 9725XXXXXXXX). ריק = לא מוצג כפתור וואטסאפ.
    whatsapp: "",
    bio: "מהנדס תוכנה (Android, Linux, C/C++), בוגר יחידה טכנולוגית בצה״ל. מלווה תלמידים לקראת המיונים — בודק את ההתקדמות של כל אחד ואחת ומכוון איפה להשקיע.",
  },

  // מי רואה את לוח הניהול (כתובות אימייל, באותיות קטנות)
  adminEmails: ["boggio.michael@gmail.com"],

  // פניות מהאתר נשלחות גם לאימייל דרך FormSubmit (אותו שירות כמו טופס יצירת הקשר באתר DATTA)
  leadsEndpoint: "https://formsubmit.co/ajax/boggio.michael@gmail.com",

  // ---- Firebase (מצב חי) ----
  // דוגמה:
  // firebase: { apiKey: "...", authDomain: "xxx.firebaseapp.com", projectId: "xxx", storageBucket: "xxx.appspot.com", messagingSenderId: "...", appId: "..." },
  firebase: null,
  // מפתח VAPID של Cloud Messaging (Project settings → Cloud Messaging → Web Push certificates)
  vapidKey: "",

  // ---- מנויים ותשלום ----
  // המחירים מוצגים בעמוד המנויים. הקישורים הם דפי תשלום מהסולק (Grow / PayPlus / וכו').
  // כל עוד קישור ריק — הכפתור מציג הודעה "בקרוב" ומפנה לפנייה אישית.
  prices: {
    monthly: 149,    // ₪ לחודש
    season: 490,     // ₪ עד המיונים (6 חודשים)
    mentoring: 1990, // ₪ חבילת ליווי אישי (PRO לעונה + 4 מפגשים)
  },
  payLinks: {
    monthly: "",
    season: "",
    mentoring: "",
  },

  // מגבלות למשתמשי חינם
  free: {
    dailyItems: 20,     // שאלות ביום
    simulations: false, // סימולציה מלאה
  },

  // המלצות (מוצגות בעמוד הבית). במצב חי אפשר לערוך גם מלוח הניהול.
  // { name: "שם", text: "הטקסט", role: "י״ב, 2026" }
  testimonials: [],
};
