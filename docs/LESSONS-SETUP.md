# שיעורים פרטיים במחשבים — הפעלה, מצב חי ותשלומים

האפליקציה יושבת ב-`public/lessons/` ונפרסת כמו שאר האתר (push ל-`main` → GitHub Pages) לכתובת
`https://boggiomichael.github.io/datta/lessons/` (הכתובת הישנה `/8200/` מפנה לשם). אין build — אלה קבצים סטטיים: `index.html`, `app.js`, `app.css`, `store.js`, `content.js`, `quiz.js`, `gen.js`, `config.js`, `sw.js`, `data/*.json`.

## מצב הדגמה ← מצב חי

כל עוד `firebase: null` ב-`public/lessons/config.js`, ההרשמה וההתקדמות נשמרות ב-localStorage של הדפדפן (כל תלמיד רואה רק את עצמו, ואתה רואה רק את מה שנרשם בדפדפן שלך). כדי שתלמידים אמיתיים יירשמו ואתה תראה את כולם בלוח הניהול, מפעילים Firebase (חינם במסלול Spark):

1. **פרויקט.** [console.firebase.google.com](https://console.firebase.google.com) → Add project (למשל `prep-8200`). אפשר לכבות Analytics.
2. **אפליקציית ווב.** Project settings → General → "Add app" → Web (`</>`) → שם כלשהו → Register. מעתיקים את האובייקט `firebaseConfig` ומדביקים ב-`config.js` במקום `null`:
   ```js
   firebase: { apiKey: "...", authDomain: "prep-8200.firebaseapp.com", projectId: "prep-8200", storageBucket: "prep-8200.appspot.com", messagingSenderId: "...", appId: "..." },
   ```
3. **Authentication.** Build → Authentication → Get started → Sign-in method: **Email/Password** (הפעלה). אופציונלי: **Google**. ב-Settings → Authorized domains להוסיף `boggiomichael.github.io` (ואת הדומיין שלך בעתיד).
4. **Firestore.** Build → Firestore Database → Create database → production mode → אזור `europe-west` כלשהו. אחר כך בלשונית **Rules** להדביק את התוכן של `public/lessons/firestore.rules` → Publish. (שם מוגדר מי אדמין — האימייל שלך; זה גם מה ש-`adminEmails` ב-`config.js` אומר.)
5. **אינדקסים.** בפעם הראשונה שלוח הניהול נטען, אם יש שגיאת `index` בקונסול — ללחוץ על הקישור שבשגיאה והוא יוצר את האינדקס (users לפי lastActive, attempts לפי createdAt).
6. **התראות (push).** Project settings → Cloud Messaging → Web Push certificates → Generate key pair → להעתיק ל-`vapidKey` ב-`config.js`.
7. push ל-`main`. אחרי הפריסה: להירשם עם האימייל שלך → "לוח ניהול" מופיע למעלה.

### לשלוח "בוחן פתע" לכולם (בלי קוד)
Firebase Console → Engage → Messaging → New campaign → Notification: כותרת "⚡ בוחן פתע!", טקסט "5 שאלות, 2 דקות"; Target: האפליקציה; Scheduling: אפשר "Recurring" (למשל כל יום ב-19:30); Additional options → Custom data: `url` = `#/surprise`. התלמידים שאישרו התראות יקבלו אותה גם כשהאפליקציה סגורה. באייפון זה עובד רק אחרי "הוסף למסך הבית" (iOS 16.4+); באנדרואיד ישירות מהדפדפן.

## שיעורים, חבילות ו-PRO — איך זה עובד עכשיו
- בעמוד "מחירים" יש שיעור ניסיון (טופס), שיעור בודד, חבילות 5/10 (כוללות PRO לעונה), חבילת הכנה למיונים, ו-PRO לאפליקציה. המחירים ב-`prices` ב-`config.js`.
- התלמיד לוחץ על מסלול. אם ב-`config.js` יש `payLinks.monthly` / `payLinks.season` — נפתח דף התשלום של הסולק. אם אין — נפתח טופס פנייה אליך.
- אחרי תשלום, אתה מפעיל את המנוי בלוח הניהול: תלמיד/ה → "ניהול" → מסלול PRO + תאריך סיום → שמירה. (אוטומציה דרך webhook של הסולק אפשרית בהמשך עם Cloud Functions.)
- במצב הדגמה יש כפתור "(הדגמה)" שמפעיל PRO מקומית — כדי לראות איך זה נראה.

### דף תשלום
כל סולק ישראלי נותן "דף תשלום"/"לינק לתשלום" קבוע (Grow/משולם, PayPlus, Cardcom, Tranzila, Sumit…). יוצרים מוצר לכל מפתח ב-`payLinks` (שיעור בודד, חבילת 5, חבילת 10, חודשי, עונה, הכנה למיונים) ומדביקים את הקישורים. ההשוואה בין הסולקים והעמלות נמצאת בתוכנית העסקית. בקבלה: עוסק פטור מוציא **קבלה** (לא חשבונית מס); רוב הסולקים מנפיקים אוטומטית.

## דברים שכדאי לעדכן ב-config.js
- `mentor.whatsapp` — מספר בפורמט בינלאומי בלי `+` (למשל `9725XXXXXXXX`); מרגע שיש מספר מופיע כפתור וואטסאפ בעמוד הבית, בפנייה ובלוח הניהול.
- `prices` — המחירים שמוצגים.
- `free.dailyItems` — 0 = אין תרגול בלי מנוי (המצב הנוכחי). מספר גדול מ-0 היה פותח "טעימה" יומית.
- `testimonials` — המלצות (או מלוח הניהול → "המלצות" במצב חי). רק המלצות אמיתיות ובאישור.
- `leadsEndpoint` — פניות מהטופס נשלחות גם לאימייל (FormSubmit). בפעם הראשונה FormSubmit שולח מייל אימות — לאשר אותו.

## תוכן
- `public/lessons/data/*.json` — חבילות השאלות. מבנה: `{pack, category, title, lessons[], items[]}`; כל פריט: `id, sub, subTitle, type (mcq/likert/open), difficulty 1-3, q, options[4], answer (אינדקס), explanation, timeSec, tags, pro`. פריטים עם `pro: true` מוצגים רק למנויים.
- לבדוק קובץ אחרי עריכה: `python3 -I tools/validate-8200-pack.py public/lessons/data/coding.json`.
- המחוללים (צורות, סדרות, חישוב, קשב, זיכרון) ב-`gen.js` — אינסופיים, לא צריך תוכן.

## אחרי כל שינוי בקבצי האפליקציה
להעלות את המספר ב-`const VERSION = "lessons-vN"` בתחילת `public/lessons/sw.js` — אחרת דפדפנים של תלמידים ימשיכו להציג את הגרסה הקודמת מהמטמון עוד רענון-שניים.

## בדיקה מקומית
```sh
cd public && python3 -m http.server 4400
# → http://127.0.0.1:4400/lessons/
```
(או `npm run dev` ואז `http://localhost:4321/datta/lessons/`.)

## פרטיות וקטינים (תזכורת)
בהרשמה יש אישור הורה/18+ ותקנון; מדיניות הפרטיות בעמוד "תקנון". ב-Firebase הנתונים יושבים באירופה. לבקשת מחיקה — מוחקים את המשתמש ב-Authentication ואת המסמכים `users/{uid}`, `progress/{uid}`, `attempts/{uid}`.
