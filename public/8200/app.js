// app.js — הניתוב, המסכים והלוגיקה של "מוכנים ל-8200".
import { createStore, isAdminEmail, today, emptyProgress } from "./store.js";
import { CATEGORIES, catById, loadCategory, loadPack, allSubs, pickItems, pickMixed, subStats, masteryOf, md, esc } from "./content.js";
import { Quiz, summaryHtml } from "./quiz.js";
import { GENERATORS } from "./gen.js";

const CONFIG = window.PREP_CONFIG || {};
const S = { store: null, user: null, progress: emptyProgress(), quiz: null, deferredInstall: null, surpriseTimer: null };
const $ = (sel, root = document) => root.querySelector(sel);
const view = () => $("#view");
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString("he-IL", { day: "numeric", month: "short" }) : "—");
const fmtDateTime = (ts) => (ts ? new Date(ts).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const daysAgo = (ts) => (ts ? Math.floor((Date.now() - ts) / 864e5) : 9999);
const GRADES = { "11": "י״א", "12": "י״ב", "post": "אחרי י״ב / לפני גיוס", "other": "אחר" };

// ---------- helpers ----------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function toast(msg, kind = "") { const t = document.createElement("div"); t.className = `toast ${kind}`; t.textContent = msg; $("#toasts").appendChild(t); setTimeout(() => t.classList.add("show"), 10); setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500); }
function modal(html, { onClose } = {}) {
  const m = document.createElement("div"); m.className = "modal-wrap"; m.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="btn-icon modal-x" aria-label="סגירה">✕</button>${html}</div>`;
  const close = () => { m.remove(); onClose?.(); };
  m.querySelector(".modal-x").onclick = close; m.addEventListener("click", (e) => { if (e.target === m) close(); });
  document.body.appendChild(m); return { el: m, close };
}
const isPro = () => { const u = S.user; if (!u) return false; if (u.role === "admin" || isAdminEmail(u.email)) return true; return u.plan === "pro" && (!u.planUntil || u.planUntil > Date.now()); };
const isAdmin = () => !!S.user && (S.user.role === "admin" || isAdminEmail(S.user.email));
const todayCount = () => S.progress.days?.[today()] || 0;
const freeLeft = () => Math.max(0, (CONFIG.free?.dailyItems || 20) - todayCount());
function requireUser() { if (!S.user) { go("#/login"); return false; } return true; }
function firstName() { return (S.user?.name || "").trim().split(/\s+/)[0] || "היי"; }
function setView(html, cls = "") { const v = view(); v.className = `view ${cls}`; v.innerHTML = html; window.scrollTo({ top: 0 }); return v; }
function nav(active) {
  const tabs = [["#/home", "🏠", "בית"], ["#/train", "🎯", "תרגול"], ["#/progress", "📈", "התקדמות"], ["#/more", "☰", "עוד"]];
  $("#tabbar").innerHTML = S.user ? tabs.map(([h, i, t]) => `<a href="${h}" class="${active === h ? "active" : ""}"><span class="ti">${i}</span><span>${t}</span></a>`).join("") : "";
  $("#tabbar").hidden = !S.user;
  const tb = $("#topnav");
  if (S.user) tb.innerHTML = `${isAdmin() ? `<a href="#/admin" class="top-link">לוח ניהול</a>` : ""}<a href="#/home" class="top-link ${isPro() ? "pro" : ""}">${isPro() ? "PRO" : "חינם"}</a>`;
  else tb.innerHTML = `<a href="#/login" class="top-link">כניסה</a><a href="#/register" class="btn small primary">הרשמה חינם</a>`;
}

// ---------- progress bookkeeping ----------
async function recordResult(result, { cat, sub } = {}) {
  const p = S.progress; const d = today();
  for (const a of result.answers) {
    if (a.type === "likert") {
      (p.likert ||= {})[a.id] = { raw: a.raw, score: a.score, trait: a.trait, tags: a.tags || [], at: Date.now() };
      if ((a.tags || []).includes("sd")) { const sd = (p.sd ||= { sum: 0, n: 0 }); sd.sum += a.raw; sd.n++; continue; }
      const t = (p.traits[a.trait] ||= { sum: 0, n: 0 }); t.sum += a.score; t.n++; continue;
    }
    const s = (p.subs[a.sub] ||= { n: 0, ok: 0, t: 0 }); s.n++; if (a.ok) s.ok++; s.t += a.t || 0;
    if (!a.generated) { const h = (p.items[a.id] ||= { n: 0, ok: 0, last: 0 }); h.n++; h.ok = !!a.ok; h.last = Date.now(); }
    p.xp += a.ok ? 10 : 2;
  }
  p.days[d] = (p.days[d] || 0) + result.answers.length;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (p.lastDay !== d) { p.streak = p.lastDay === y ? (p.streak || 0) + 1 : 1; p.lastDay = d; p.bestStreak = Math.max(p.bestStreak || 0, p.streak); }
  await S.store.progress.save(S.user.uid, p);
  const attempt = { mode: result.mode, title: result.title, cat: cat || null, sub: sub || null, score: result.score, scoredTotal: result.scoredTotal, total: result.total, durSec: result.durSec, startedAt: result.startedAt, timeout: result.timeout, aborted: result.aborted };
  if (result.answers.length) await S.store.attempts.add(S.user.uid, attempt);
  await S.store.users.update(S.user.uid, { lastActive: Date.now(), stats: { xp: p.xp, streak: p.streak, items: Object.values(p.subs).reduce((x, s) => x + s.n, 0), ok: Object.values(p.subs).reduce((x, s) => x + s.ok, 0) } }).catch(() => {});
}

// ============================================================
//  Views
// ============================================================
function landing() {
  nav();
  const m = CONFIG.mentor || {};
  const steps = [["1", "נרשמים בחינם", "דקה אחת, בלי כרטיס אשראי. מספרים לנו מתי המיונים ואיזה מסלול מעניין."], ["2", "מתאמנים כל יום", "15 שאלות ביום לפי החולשות שלך, בוחני פתע בטלפון, הסברים לכל שאלה."], ["3", "מישהו עוקב", "המלווה רואה את ההתקדמות שלך ומכוון איפה להשקיע — ובליווי אישי גם עוברים יחד על ראיונות."]];
  setView(`
    <section class="hero">
      <p class="eyebrow">הכנה למיוני 8200 · בעברית · מהטלפון</p>
      <h1>${esc(CONFIG.appName || "מוכנים ל-8200")}</h1>
      <p class="lead">${esc(CONFIG.tagline || "")}. תרגול לפי שלבי המיון, בוחני פתע, מעקב התקדמות — ומלווה אמיתי שרואה איפה את/ה עומד/ת.</p>
      <div class="cta-row"><a class="btn primary big" href="#/register">מתחילים בחינם</a><a class="btn big" href="#/login">כבר רשומים? כניסה</a></div>
      <p class="muted small">מתאים לתלמידי י״א–י״ב לפני המיונים. אפשר להתקין כאפליקציה על הטלפון.</p>
    </section>
    <section class="section">
      <h2>המסלול, שלב אחרי שלב</h2>
      <div class="cat-grid">${CATEGORIES.map((c) => `<a class="cat-card" href="#/register" style="--c:${c.color}"><span class="cat-emoji">${c.emoji}</span><span class="cat-stage">שלב ${c.stage}</span><strong>${esc(c.title)}</strong><span class="muted small">${esc(c.desc)}</span></a>`).join("")}</div>
    </section>
    <section class="section">
      <h2>איך זה עובד</h2>
      <div class="steps">${steps.map(([n, t, d]) => `<div class="step"><span class="step-n">${n}</span><strong>${t}</strong><p class="muted">${d}</p></div>`).join("")}</div>
    </section>
    <section class="section features">
      <div class="feat"><span>⚡</span><strong>בוחני פתע</strong><p class="muted">התראה בטלפון, 5 שאלות, 2 דקות. ככה נבנית מהירות.</p></div>
      <div class="feat"><span>📈</span><strong>מעקב התקדמות</strong><p class="muted">רמת שליטה בכל נושא, רצף ימים, זמן ממוצע לשאלה, ומה לחזור עליו.</p></div>
      <div class="feat"><span>🧑‍🏫</span><strong>מלווה אמיתי</strong><p class="muted">לא רק אפליקציה: אדם שרואה את הנתונים שלך ומכוון.</p></div>
      <div class="feat"><span>🧩</span><strong>מחולל שאלות</strong><p class="muted">צורות, סדרות וחישוב מהיר — שאלות חדשות בכל פעם, בלי לשנן.</p></div>
    </section>
    <section class="section mentor" id="mentor">
      <div class="mentor-card"><div class="avatar">${esc((m.name || "מ")[0])}</div><div><p class="eyebrow">המלווה</p><h3>${esc(m.name || "")}</h3><p>${esc(m.bio || "")}</p><div class="cta-row"><a class="btn" href="#/contact">לדבר איתי</a>${m.whatsapp ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(m.whatsapp)}?text=${encodeURIComponent("היי, הגעתי מהאתר של ההכנה ל-8200")}">וואטסאפ</a>` : ""}</div></div></div>
    </section>
    <section class="section" id="testimonials"></section>
    <section class="section pricing-teaser">
      <h2>כמה זה עולה?</h2>
      <p>מתחילים בחינם (עד ${CONFIG.free?.dailyItems || 20} שאלות ביום). PRO פותח את כל המאגר, סימולציות ותרגול חוזר של טעויות החל מ-₪${CONFIG.prices?.monthly} לחודש. ליווי אישי — לפי בקשה.</p>
      <a class="btn" href="#/pricing">לכל האפשרויות</a>
    </section>
    <section class="section lead" id="lead"><h2>רוצים לדבר לפני שמתחילים?</h2><p class="muted">השאירו פרטים ואחזור אליכם (גם להורים).</p>${leadFormHtml()}</section>
    ${footerHtml()}
  `, "landing");
  wireLeadForm();
  S.store.public.getTestimonials().then((items) => { const el = $("#testimonials"); if (!el) return; if (!items?.length) { el.hidden = true; return; } el.innerHTML = `<h2>מה אומרים</h2><div class="testi">${items.map((t) => `<blockquote><p>${esc(t.text)}</p><footer>${esc(t.name)}${t.role ? ` · ${esc(t.role)}` : ""}</footer></blockquote>`).join("")}</div>`; });
}
function footerHtml() { return `<footer class="foot"><a href="#/terms">תקנון ופרטיות</a> · <a href="#/contact">יצירת קשר</a> · <a href="../he/">DATTA · דאטא</a><br><span class="muted small">© ${new Date().getFullYear()} ${esc(CONFIG.mentor?.name || "")}. האתר אינו קשור לצה״ל או ליחידה 8200; כל התכנים מקוריים ונועדו לתרגול.</span></footer>`; }

function leadFormHtml(prefill = {}) {
  return `<form class="form lead-form" id="leadForm">
    <div class="row2"><label>שם <input name="name" required value="${esc(prefill.name || "")}"></label><label>טלפון <input name="phone" type="tel" inputmode="tel" required value="${esc(prefill.phone || "")}"></label></div>
    <div class="row2"><label>אימייל <input name="email" type="email" value="${esc(prefill.email || "")}"></label><label>כיתה <select name="grade"><option value="">בחרו</option>${Object.entries(GRADES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}<option value="parent">אני הורה</option></select></label></div>
    <label>מה מעניין אותך? <textarea name="msg" rows="3" placeholder="למשל: המיונים בעוד 4 חודשים, רוצה להבין מאיפה להתחיל…"></textarea></label>
    <label class="check"><input type="checkbox" name="consent" required> אני מאשר/ת שיצרו איתי קשר. פרטים נוספים ב<a href="#/terms">מדיניות הפרטיות</a>.</label>
    <button class="btn primary" type="submit">שלחו ואחזור אליכם</button>
    <p class="form-msg" aria-live="polite"></p>
  </form>`;
}
function wireLeadForm() {
  const f = $("#leadForm"); if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f).entries());
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    const lead = { name: fd.name, phone: fd.phone, email: fd.email || "", grade: fd.grade || "", msg: fd.msg || "", source: "site", page: location.hash, uid: S.user?.uid || null };
    try { await S.store.leads.add(lead); } catch (err) { console.warn(err); }
    if (CONFIG.leadsEndpoint) { try { await fetch(CONFIG.leadsEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ _subject: `פנייה חדשה מהאתר 8200: ${fd.name}`, ...lead }) }); } catch (err) { console.warn("lead email", err); } }
    f.querySelector(".form-msg").textContent = "תודה! הפנייה נשמרה ואחזור אליכם בהקדם.";
    f.reset(); btn.disabled = false;
    toast("הפנייה נשלחה 🙌", "ok");
  };
}

// ---------- auth ----------
function authView(kind) {
  nav();
  const isReg = kind === "register";
  setView(`<section class="auth"><h1>${isReg ? "הרשמה חינם" : kind === "reset" ? "איפוס סיסמה" : "כניסה"}</h1>
    ${S.store.mode === "local" ? `<p class="demo-note">מצב הדגמה: החשבון נשמר בדפדפן הזה בלבד.</p>` : ""}
    <form class="form" id="authForm">
      ${isReg ? `<label>שם מלא <input name="name" required autocomplete="name"></label>` : ""}
      <label>אימייל <input name="email" type="email" required autocomplete="email" dir="ltr"></label>
      ${kind !== "reset" ? `<label>סיסמה <input name="password" type="password" required minlength="6" autocomplete="${isReg ? "new-password" : "current-password"}" dir="ltr"></label>` : ""}
      ${isReg ? `
        <div class="row2"><label>טלפון <input name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr"></label>
        <label>כיתה <select name="grade" required><option value="">בחרו</option>${Object.entries(GRADES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
        <label>מתי בערך המיונים? <input name="targetDate" type="month"></label>
        <label>מי הפנה אותך? (לא חובה) <input name="referrer" placeholder="שם של חבר/ה, מורה…"></label>
        <label class="check"><input type="checkbox" name="consent" required> אני מעל גיל 18, או שהורה/אפוטרופוס אישר את ההרשמה שלי.</label>
        <label class="check"><input type="checkbox" name="terms" required> קראתי ואני מסכים/ה ל<a href="#/terms">תקנון ולמדיניות הפרטיות</a>.</label>` : ""}
      <button class="btn primary" type="submit">${isReg ? "יוצרים חשבון" : kind === "reset" ? "שלחו קישור לאיפוס" : "כניסה"}</button>
      ${S.store.mode === "firebase" && kind !== "reset" ? `<button class="btn" type="button" id="googleBtn">המשך עם Google</button>` : ""}
      <p class="form-msg err" aria-live="polite"></p>
    </form>
    <p class="muted">${isReg ? `כבר יש חשבון? <a href="#/login">כניסה</a>` : `אין חשבון? <a href="#/register">הרשמה חינם</a> · <a href="#/reset">שכחתי סיסמה</a>`}</p>
  </section>`, "auth-view");
  const f = $("#authForm");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f).entries());
    const msg = f.querySelector(".form-msg"); msg.textContent = "";
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      if (isReg) { await S.store.auth.signUp({ email: fd.email, password: fd.password, name: fd.name.trim(), phone: fd.phone || "", grade: fd.grade || "", targetDate: fd.targetDate || "", referrer: fd.referrer || "", parentConsent: true, termsAt: Date.now() }); toast(`ברוך/ה הבא/ה, ${fd.name.trim().split(" ")[0]}! 🎉`, "ok"); go("#/onboarding"); }
      else if (kind === "reset") { await S.store.auth.resetPassword(fd.email); msg.classList.remove("err"); msg.textContent = "שלחנו קישור לאיפוס לאימייל."; }
      else { await S.store.auth.signIn(fd.email, fd.password); go("#/home"); }
    } catch (err) { msg.classList.add("err"); msg.textContent = err.message || "משהו השתבש"; }
    btn.disabled = false;
  };
  $("#googleBtn")?.addEventListener("click", async () => { try { await S.store.auth.signInGoogle(); go("#/home"); } catch (err) { f.querySelector(".form-msg").textContent = err.message; } });
}

function onboarding() {
  if (!requireUser()) return;
  nav();
  const p = S.progress;
  setView(`<section class="auth"><h1>שלוש שאלות קצרות</h1><p class="muted">כדי שהאימון היומי יתאים לך.</p>
    <form class="form" id="obForm">
      <fieldset><legend>אילו מסלולים מעניינים אותך? (אפשר כמה)</legend>
        ${[["coding", "תכנות / סייבר"], ["intel", "מודיעין / מחקר"], ["lang", "שפות"], ["unknown", "עוד לא יודע/ת"]].map(([k, v]) => `<label class="chip"><input type="checkbox" name="tracks" value="${k}"> ${v}</label>`).join("")}
      </fieldset>
      <fieldset><legend>יעד יומי</legend>${[10, 15, 25].map((n) => `<label class="chip"><input type="radio" name="goal" value="${n}" ${n === 15 ? "checked" : ""}> ${n} שאלות</label>`).join("")}</fieldset>
      <fieldset><legend>איך את/ה מרגיש/ה עם…</legend>
        ${[["dapar", "פסיכוטכני (צורות, סדרות)"], ["coding", "תכנות"], ["english", "אנגלית"]].map(([k, v]) => `<label class="range-l">${v}<div class="range"><input type="range" name="conf_${k}" min="1" max="5" value="3"></div></label>`).join("")}
      </fieldset>
      <button class="btn primary" type="submit">יאללה, מתחילים</button>
    </form></section>`);
  $("#obForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    p.onboarding = { tracks: fd.getAll("tracks"), conf: { dapar: +fd.get("conf_dapar"), coding: +fd.get("conf_coding"), english: +fd.get("conf_english") }, at: Date.now() };
    p.dailyGoal = +fd.get("goal") || 15;
    await S.store.progress.save(S.user.uid, p);
    await S.store.users.update(S.user.uid, { tracks: p.onboarding.tracks, dailyGoal: p.dailyGoal });
    go("#/home");
    setTimeout(() => offerNotifications(), 800);
  };
}

// ---------- home ----------
async function home() {
  if (!requireUser()) return;
  nav("#/home");
  const p = S.progress; const goal = p.dailyGoal || 15; const done = todayCount();
  const pct = Math.min(100, Math.round((done / goal) * 100));
  const u = S.user;
  const target = u.targetDate ? new Date(u.targetDate + "-01") : null;
  const weeksLeft = target ? Math.max(0, Math.round((target - Date.now()) / 6048e5)) : null;
  const subsAll = await allSubs();
  const catMastery = CATEGORIES.map((c) => ({ c, m: masteryOf(p, subsAll.filter((s) => s.cat.id === c.id).map((s) => s.id)) }));
  const next = catMastery.slice().sort((a, b) => a.m - b.m)[0]?.c;
  setView(`
    <section class="home-head"><div><p class="eyebrow">${weeksLeft != null ? `${weeksLeft} שבועות למיונים` : "מתאמנים בקצב שלך"}</p><h1>היי ${esc(firstName())} 👋</h1></div>
      <div class="chips"><span class="chip-stat" title="רצף ימים">🔥 ${p.streak || 0}</span><span class="chip-stat" title="נקודות">⭐ ${p.xp || 0}</span></div></section>
    <section class="daily-card" style="--p:${pct}">
      <div class="ring"><span>${done}/${goal}</span></div>
      <div><h2>${done >= goal ? "היעד היומי הושלם! 🏆" : "האימון של היום"}</h2><p class="muted">${done >= goal ? "אפשר להמשיך — כל שאלה נוספת נספרת." : `${goal - done} שאלות ליעד. מעורב מכל הנושאים, עם דגש על מה שפחות חזק.`}</p>
      <div class="cta-row"><a class="btn primary" href="#/daily">${done ? "ממשיכים" : "מתחילים"} (${Math.min(goal - done || goal, 15) || 15} שאלות)</a><a class="btn" href="#/surprise">⚡ בוחן פתע</a></div></div>
    </section>
    ${!isPro() ? `<p class="muted small center">נשארו היום ${freeLeft()} שאלות במסלול החינמי · <a href="#/pricing">PRO ללא הגבלה</a></p>` : ""}
    <section class="section"><div class="sec-head"><h2>מסלול ההכנה</h2><a href="#/train" class="muted small">כל הנושאים</a></div>
      <div class="cat-list">${catMastery.map(({ c, m }) => `<a class="cat-row" href="#/cat/${c.id}" style="--c:${c.color}"><span class="cat-emoji">${c.emoji}</span><span class="cat-main"><strong>${esc(c.title)}</strong><span class="bar"><i style="width:${Math.round(m * 100)}%"></i></span></span><span class="cat-pct">${Math.round(m * 100)}%</span></a>`).join("")}</div>
      ${next ? `<p class="muted small">המלצה להיום: <a href="#/cat/${next.id}">${esc(next.short)}</a> — הנושא הכי פחות מתורגל.</p>` : ""}
    </section>
    <section class="section mentor-msg"><div class="mentor-card small"><div class="avatar">${esc((CONFIG.mentor?.name || "מ")[0])}</div><div><p class="eyebrow">${esc(CONFIG.mentor?.name || "המלווה")}</p>
      <p>${u.mentorMessage ? esc(u.mentorMessage) : "אני רואה את ההתקדמות שלך כאן ואשמח לכוון. יש שאלה? רוצה שנעבור יחד על ראיון?"}</p><a class="btn small" href="#/contact">לכתוב למלווה</a></div></div></section>
    ${!isPro() ? `<section class="section upgrade"><h3>PRO — כל המאגר, סימולציות ותרגול חוזר של טעויות</h3><p class="muted">מ-₪${CONFIG.prices?.monthly} לחודש, או ₪${CONFIG.prices?.season} עד המיונים.</p><a class="btn primary" href="#/pricing">לפרטים</a></section>` : ""}
    ${S.deferredInstall ? `<section class="section install"><p>📲 אפשר להתקין את האפליקציה על הטלפון ולקבל בוחני פתע.</p><button class="btn" id="installBtn">התקנה</button></section>` : ""}
  `);
  $("#installBtn")?.addEventListener("click", async () => { S.deferredInstall.prompt(); const r = await S.deferredInstall.userChoice; if (r.outcome === "accepted") S.deferredInstall = null; });
}

async function train() {
  if (!requireUser()) return;
  nav("#/train");
  const subsAll = await allSubs();
  const p = S.progress;
  setView(`<section><h1>תרגול לפי נושא</h1><p class="muted">בחרו נושא. בכל נושא יש שאלות עם הסברים, ובחלק מהם גם מחולל אינסופי.</p>
    ${CATEGORIES.map((c) => `<div class="train-cat" style="--c:${c.color}"><h2><a href="#/cat/${c.id}">${c.emoji} ${esc(c.title)}</a></h2><div class="sub-list">${subsAll.filter((s) => s.cat.id === c.id).map((s) => { const st = subStats(p, s.id); return `<a class="sub-row" href="#/practice/${c.id}/${s.id}"><span><strong>${esc(s.title)}</strong><span class="muted small"> · ${s.generated ? "מחולל" : `${s.items.filter((i) => isPro() || !i.pro).length} שאלות`}${st.n ? ` · ${Math.round(st.acc * 100)}% מ-${st.n}` : ""}</span></span><span class="bar"><i style="width:${Math.round(st.acc * Math.min(1, st.n / 30) * 100)}%"></i></span></a>`; }).join("")}</div></div>`).join("")}
    <div class="section"><h2>סימולציות</h2><p class="muted">מבחן מלא עם שעון, הסברים בסוף. ${isPro() ? "" : "זמין ב-PRO."}</p><div class="cta-row"><a class="btn ${isPro() ? "primary" : ""}" href="#/sim/all">סימולציה מלאה מעורבת</a>${CATEGORIES.filter((c) => c.sim).map((c) => `<a class="btn" href="#/sim/${c.id}">${c.emoji} ${esc(c.short)}</a>`).join("")}</div></div>
  </section>`);
}

async function category(id) {
  if (!requireUser()) return;
  const c = catById(id); if (!c) return go("#/train");
  nav("#/train");
  const { subs, lessons } = await loadCategory(id);
  const p = S.progress;
  const m = masteryOf(p, subs.map((s) => s.id));
  setView(`<section class="cat-page" style="--c:${c.color}">
    <a class="back" href="#/train">‹ כל הנושאים</a>
    <div class="cat-head"><span class="cat-emoji big">${c.emoji}</span><div><p class="eyebrow">שלב ${c.stage}</p><h1>${esc(c.title)}</h1><p class="muted">${esc(c.desc)}</p></div></div>
    <div class="cat-stat"><span class="bar"><i style="width:${Math.round(m * 100)}%"></i></span><b>${Math.round(m * 100)}% שליטה</b></div>
    ${lessons.length ? `<h2>שיעורים קצרים</h2><div class="lessons">${lessons.map((l) => `<a class="lesson-row" href="#/lesson/${c.id}/${l.id}"><span>📖</span><span><strong>${esc(l.title)}</strong><span class="muted small"> · ${l.minutes} דק׳</span></span></a>`).join("")}</div>` : ""}
    <h2>תרגול</h2>
    <div class="sub-list">${subs.map((s) => { const st = subStats(p, s.id); const n = s.generated ? "∞" : s.items.filter((i) => isPro() || !i.pro).length; return `<div class="sub-card"><div><strong>${esc(s.title)}</strong><div class="muted small">${s.generated ? esc(s.desc || "מחולל שאלות") : `${n} שאלות${!isPro() && s.items.some((i) => i.pro) ? ` (+${s.items.filter((i) => i.pro).length} ב-PRO)` : ""}`}${st.n ? ` · דיוק ${Math.round(st.acc * 100)}% (${st.n})` : ""}</div></div>
      <div class="sub-actions">${s.id === "likert" ? `<a class="btn small primary" href="#/practice/${c.id}/${s.id}?n=30">שאלון (30)</a><a class="btn small" href="#/profile">הפרופיל שלי</a>` : `<a class="btn small primary" href="#/practice/${c.id}/${s.id}?n=10">10 שאלות</a><a class="btn small" href="#/practice/${c.id}/${s.id}?n=20">20</a>${s.generated || s.items.some((i) => i.difficulty === 3) ? `<a class="btn small" href="#/practice/${c.id}/${s.id}?n=10&d=3" title="קשה">קשה</a>` : ""}`}</div></div>`; }).join("")}</div>
    ${c.sim ? `<div class="section"><h2>סימולציה — ${esc(c.short)}</h2><p class="muted">${c.sim.items} שאלות · ${c.sim.minutes} דקות · הסברים בסוף.</p><a class="btn ${isPro() ? "primary" : ""}" href="#/sim/${c.id}">${isPro() ? "להתחיל סימולציה" : "סימולציה (PRO)"}</a></div>` : ""}
  </section>`);
}

async function lesson(catId, lessonId) {
  if (!requireUser()) return;
  const c = catById(catId); const { lessons } = await loadCategory(catId);
  const l = lessons.find((x) => x.id === lessonId); if (!l) return go(`#/cat/${catId}`);
  nav("#/train");
  const i = lessons.indexOf(l); const nxt = lessons[i + 1];
  setView(`<article class="lesson"><a class="back" href="#/cat/${catId}">‹ ${esc(c.title)}</a><p class="eyebrow">שיעור · ${l.minutes} דק׳</p><h1>${esc(l.title)}</h1><div class="prose">${md(l.md)}</div>
    <div class="cta-row">${nxt ? `<a class="btn" href="#/lesson/${catId}/${nxt.id}">השיעור הבא ›</a>` : ""}<a class="btn primary" href="#/cat/${catId}">לתרגול</a></div></article>`);
  const p = S.progress; (p.lessonsRead ||= {})[lessonId] = Date.now(); S.store.progress.save(S.user.uid, p);
}

// ---------- practice / quiz ----------
async function practice(catId, subId, params) {
  if (!requireUser()) return;
  const c = catById(catId); if (!c) return go("#/train");
  const { subs } = await loadCategory(catId);
  const sub = subs.find((s) => s.id === subId); if (!sub) return go(`#/cat/${catId}`);
  let n = Math.min(60, parseInt(params.get("n") || "10", 10) || 10);
  const d = parseInt(params.get("d") || "0", 10) || 0;
  if (!isPro() && sub.id !== "likert") { if (freeLeft() <= 0) return upgradePrompt("נגמרו השאלות החינמיות להיום", "מחר יתאפסו 20 שאלות חדשות — או ש-PRO פותח הכול עכשיו."); n = Math.min(n, freeLeft()); }
  const items = pickItems({ sub, progress: S.progress, isPro: isPro(), n, difficulty: d });
  if (!items.length) { toast("אין כרגע שאלות בנושא הזה"); return go(`#/cat/${catId}`); }
  runQuiz({ items, title: `${sub.title} · ${c.short}`, mode: sub.id === "likert" ? "personality" : "practice", immediate: sub.id !== "likert", cat: catId, sub: subId, back: `#/cat/${catId}`, again: `#/practice/${catId}/${subId}?n=${n}${d ? `&d=${d}` : ""}` });
}
async function daily() {
  if (!requireUser()) return;
  const goal = S.progress.dailyGoal || 15; let n = Math.max(5, Math.min(15, goal - todayCount() || goal));
  if (!isPro()) { if (freeLeft() <= 0) return upgradePrompt("נגמרו השאלות החינמיות להיום", "מחר יתאפסו 20 שאלות חדשות — או ש-PRO פותח הכול עכשיו."); n = Math.min(n, freeLeft()); }
  const tracks = S.progress.onboarding?.tracks || [];
  const cats = ["dapar", "learning", "english"]; if (tracks.includes("coding") || !tracks.length) cats.push("coding");
  nav("#/home"); setView(`<p class="loading">מרכיבים את האימון של היום…</p>`);
  const items = await pickMixed({ catIds: cats, progress: S.progress, isPro: isPro(), n });
  runQuiz({ items, title: "האימון היומי", mode: "daily", immediate: true, back: "#/home", again: "#/daily" });
}
async function surprise() {
  if (!requireUser()) return;
  if (!isPro() && freeLeft() <= 0) return upgradePrompt("נגמרו השאלות החינמיות להיום", "בוחני פתע ללא הגבלה — ב-PRO.");
  nav("#/home"); setView(`<p class="loading">⚡ בוחן פתע בדרך…</p>`);
  const items = await pickMixed({ catIds: ["dapar", "learning"], progress: S.progress, isPro: isPro(), n: 5, seed: Date.now() });
  runQuiz({ items: items.slice(0, 5), title: "⚡ בוחן פתע", mode: "surprise", immediate: false, timeLimitSec: 150, back: "#/home", again: "#/surprise" });
}
async function sim(catId) {
  if (!requireUser()) return;
  if (!isPro() && !CONFIG.free?.simulations) return upgradePrompt("סימולציות מלאות זמינות ב-PRO", "סימולציה = מבחן מלא עם שעון, בדיוק כמו ביום האמיתי. הסברים לכל שאלה בסוף.");
  nav("#/train"); setView(`<p class="loading">מכינים סימולציה…</p>`);
  let items, title, minutes;
  if (catId === "all") { items = await pickMixed({ catIds: ["dapar", "learning", "english"], progress: S.progress, isPro: true, n: 40 }); title = "סימולציה מלאה"; minutes = 35; }
  else { const c = catById(catId); if (!c?.sim) return go("#/train"); items = await pickMixed({ catIds: [catId], progress: S.progress, isPro: true, n: c.sim.items }); title = `סימולציה · ${c.short}`; minutes = c.sim.minutes; }
  const start = modal(`<h2>${esc(title)}</h2><p>${items.length} שאלות · ${minutes} דקות · בלי הסברים באמצע. מוכנים?</p><div class="cta-row"><button class="btn primary" id="simGo">התחלה</button><a class="btn" href="#/train">לא עכשיו</a></div>`);
  $("#simGo").onclick = () => { start.close(); runQuiz({ items, title, mode: "sim", immediate: false, timeLimitSec: minutes * 60, cat: catId === "all" ? null : catId, back: "#/train", again: `#/sim/${catId}` }); };
}
function runQuiz({ items, title, mode, immediate, timeLimitSec, cat, sub, back, again }) {
  nav();
  const v = setView("", "quiz-view");
  S.quiz?.destroy();
  S.quiz = new Quiz({ el: v, items, title, mode, immediate, timeLimitSec, onFinish: async (result) => {
    S.quiz = null;
    await recordResult(result, { cat, sub });
    const goal = S.progress.dailyGoal || 15; const done = todayCount();
    nav();
    setView(`${summaryHtml(result, { isPro: isPro() })}
      ${done >= goal && done - result.answers.length < goal ? `<p class="celebrate">🏆 היעד היומי הושלם! רצף: ${S.progress.streak} ימים</p>` : ""}
      <div class="cta-row">${mode === "personality" ? `<a class="btn primary" href="#/profile">לפרופיל האישיות</a>` : `<a class="btn primary" href="${again}">עוד סבב</a>`}<a class="btn" href="${back}">חזרה</a>${result.answers.some((a) => a.type !== "likert" && !a.ok) && mode !== "sim" ? `<button class="btn" id="retryWrong">תרגול הטעויות</button>` : ""}</div>`);
    $("#retryWrong")?.addEventListener("click", () => { const wrongIds = new Set(result.answers.filter((a) => !a.ok).map((a) => a.id)); const wi = result.items.filter((it) => wrongIds.has(it.id)); runQuiz({ items: wi, title: "תרגול הטעויות", mode: "practice", immediate: true, cat, sub, back, again }); });
  } });
  S.quiz.mount();
}
function upgradePrompt(title, text) {
  nav();
  setView(`<section class="auth"><h1>${esc(title)}</h1><p>${esc(text)}</p><div class="cta-row"><a class="btn primary" href="#/pricing">לראות את PRO</a><a class="btn" href="#/home">חזרה</a></div></section>`);
}

// ---------- progress ----------
async function progressView() {
  if (!requireUser()) return;
  nav("#/progress");
  const p = S.progress; const subsAll = await allSubs();
  const attempts = await S.store.attempts.list(S.user.uid, 15);
  const days = []; for (let i = 27; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push([d, p.days[d] || 0]); }
  const weak = subsAll.map((s) => ({ s, st: subStats(p, s.id) })).filter((x) => x.st.n >= 5).sort((a, b) => a.st.acc - b.st.acc).slice(0, 3);
  const totalN = Object.values(p.subs).reduce((x, s) => x + s.n, 0); const totalOk = Object.values(p.subs).reduce((x, s) => x + s.ok, 0);
  setView(`<section><h1>ההתקדמות שלי</h1>
    <div class="kpis"><div class="kpi"><b>${totalN}</b><span>שאלות</span></div><div class="kpi"><b>${totalN ? Math.round((totalOk / totalN) * 100) : 0}%</b><span>דיוק</span></div><div class="kpi"><b>${p.streak || 0}</b><span>רצף ימים</span></div><div class="kpi"><b>${p.xp || 0}</b><span>נקודות</span></div></div>
    <h2>28 הימים האחרונים</h2><div class="cal">${days.map(([d, n]) => `<span class="day ${n ? (n >= (p.dailyGoal || 15) ? "full" : "some") : ""}" title="${d}: ${n}"></span>`).join("")}</div>
    <h2>שליטה לפי שלב</h2><div class="cat-list">${CATEGORIES.map((c) => { const m = masteryOf(p, subsAll.filter((s) => s.cat.id === c.id).map((s) => s.id)); return `<a class="cat-row" href="#/cat/${c.id}" style="--c:${c.color}"><span class="cat-emoji">${c.emoji}</span><span class="cat-main"><strong>${esc(c.short)}</strong><span class="bar"><i style="width:${Math.round(m * 100)}%"></i></span></span><span class="cat-pct">${Math.round(m * 100)}%</span></a>`; }).join("")}</div>
    ${weak.length ? `<h2>כדאי לחזק</h2><div class="sub-list">${weak.map(({ s, st }) => `<a class="sub-row" href="#/practice/${s.cat.id}/${s.id}"><span><strong>${esc(s.title)}</strong><span class="muted small"> · ${Math.round(st.acc * 100)}% מ-${st.n}</span></span><span class="btn small">תרגול</span></a>`).join("")}</div>` : ""}
    <h2>לפי נושא</h2><div class="tbl"><table><thead><tr><th>נושא</th><th>שאלות</th><th>דיוק</th><th>זמן ממוצע</th></tr></thead><tbody>${subsAll.map((s) => { const st = subStats(p, s.id); if (!st.n) return ""; return `<tr><td>${esc(s.title)}</td><td>${st.n}</td><td>${Math.round(st.acc * 100)}%</td><td>${Math.round(st.t / st.n)} שנ׳</td></tr>`; }).join("") || `<tr><td colspan="4" class="muted">עוד לא תרגלת. <a href="#/daily">מתחילים?</a></td></tr>`}</tbody></table></div>
    ${attempts.length ? `<h2>תרגולים אחרונים</h2><div class="attempts">${attempts.map((a) => `<div class="att"><span>${esc(a.title)}</span><span class="muted small">${fmtDateTime(a.startedAt)}</span><b>${a.scoredTotal ? `${a.score}/${a.scoredTotal}` : "✓"}</b></div>`).join("")}</div>` : ""}
  </section>`);
}

const TRAITS = { conscientiousness: ["אחריות ומסירות", "להביא דברים לסיום, גם כשהם משעממים. ביחידה טכנולוגית זה אולי הדבר שמסתכלים עליו הכי הרבה."], teamwork: ["עבודת צוות", "לשתף, להקשיב, לעזור — ולדעת לבקש עזרה. הרבה מהעבודה היא בצוותים קטנים."], stress: ["התמודדות עם לחץ", "להישאר מתפקד/ת ושקול/ה כשיש דדליין או טעות. לא 'לא להילחץ' — אלא מה עושים עם זה."], integrity: ["יושרה", "לדווח על טעויות, לא לעגל פינות, לעמוד בנהלים. בסביבה מסווגת זה קריטי."], initiative: ["יוזמה", "לראות מה חסר ולהציע, לא לחכות שיגידו. במינון הנכון — בלי לדרוס אחרים."], learning: ["יכולת למידה", "סקרנות, ללמוד דברים חדשים מהר ולהודות במה שעוד לא יודעים."], leadership: ["הובלה והשפעה", "לקחת פיקוד כשצריך, ולדעת גם ללכת אחרי מישהו אחר. שני הצדדים נבדקים."] };
async function profile() {
  if (!requireUser()) return;
  nav("#/progress");
  const t = S.progress.traits || {}; const n = Object.values(t).reduce((x, v) => x + v.n, 0);
  if (n < 14) { setView(`<section class="auth"><h1>פרופיל האישיות שלי</h1><p>כדי לראות פרופיל, צריך לענות על לפחות 14 היגדים (ענית על ${n}).</p><a class="btn primary" href="#/practice/personality/likert?n=30">לשאלון</a></section>`); return; }
  setView(`<section><a class="back" href="#/cat/personality">‹ אישיות</a><h1>פרופיל האישיות שלי</h1><p class="muted">מבוסס על ${n} היגדים. זה לא ציון — זו מראה. המטרה: לענות בעקביות ולהכיר את עצמך לפני הראיון.</p>
    <div class="traits">${Object.entries(TRAITS).map(([k, [name, desc]]) => { const v = t[k]; const pct = v?.n ? Math.round((v.sum / v.n / 4) * 100) : null; return `<div class="trait"><div class="trait-h"><strong>${name}</strong><b>${pct == null ? "—" : pct + "%"}</b></div><span class="bar"><i style="width:${pct || 0}%"></i></span><p class="muted small">${desc}</p></div>`; }).join("")}</div>
    ${(() => { const L = Object.values(S.progress.likert || {}); if (L.length < 10) return ""; const extreme = L.filter((x) => x.raw === 0 || x.raw === 4).length / L.length; const mid = L.filter((x) => x.raw === 2).length / L.length; const pairs = {}; for (const [id, x] of Object.entries(S.progress.likert || {})) for (const tg of x.tags || []) if (/^pair-/.test(tg)) (pairs[tg] ||= []).push(x.score); const diffs = Object.values(pairs).filter((v) => v.length >= 2).map((v) => Math.abs(v[0] - v[1])); const cons = diffs.length ? 1 - Math.min(1, diffs.reduce((a, b) => a + b, 0) / diffs.length / 4) : null; const sd = S.progress.sd?.n ? S.progress.sd.sum / S.progress.sd.n / 4 : null; return `<div class="section"><h3>איך נראה דפוס התשובות</h3><ul class="prose">
      <li><b>תשובות קיצוניות:</b> ${Math.round(extreme * 100)}% מההיגדים ${extreme > 0.6 ? "— גבוה. בשאלון אמיתי זה נראה פחות אמין; נסו לדייק." : "— סביר."}</li>
      <li><b>תשובות ניטרליות:</b> ${Math.round(mid * 100)}% ${mid > 0.4 ? "— הרבה. 'ניטרלי' על הכול לא מספר כלום על עצמך." : "— סביר."}</li>
      ${cons != null ? `<li><b>עקביות</b> (היגדים דומים שנוסחו אחרת): ${Math.round(cons * 100)}% ${cons < 0.6 ? "— כדאי לבדוק: ענית אחרת על אותו דבר." : "— טוב."}</li>` : ""}
      ${sd != null ? `<li><b>'אף פעם לא טעיתי':</b> ${sd > 0.7 ? "ענית בהסכמה על היגדים שאף אחד לא באמת עומד בהם — שימו לב, זה מה ששאלונים מזהים כניסיון להרשים." : "ענית בכנות על ההיגדים שבודקים ניסיון להרשים. מצוין."}</li>` : ""}</ul></div>`; })()}
    <div class="section"><h3>איך להשתמש בזה</h3><ul class="prose"><li>תכונה נמוכה אצלך? חשבו על דוגמה אמיתית שבה כן התנהגתם ככה — זה מה שתספרו בראיון.</li><li>תכונה גבוהה מאוד בכל דבר? בדקו אם עניתם 'מסכים מאוד' על הכול. בשאלון אמיתי זה נראה לא אמין.</li><li>חזרו על השאלון אחרי שבוע ובדקו עקביות.</li></ul><a class="btn" href="#/practice/personality/likert?n=30">עוד סבב בשאלון</a></div></section>`);
}

// ---------- pricing / contact / settings / terms / more ----------
function pricing() {
  nav();
  const pr = CONFIG.prices || {}; const pl = CONFIG.payLinks || {};
  const btn = (key, label, cls = "") => pl[key] ? `<a class="btn ${cls}" target="_blank" rel="noopener" href="${esc(pl[key])}">${label}</a>` : (S.store.mode === "local" && S.user && key !== "mentoring" ? `<button class="btn ${cls}" data-demo-pro="${key}">${label} (הדגמה)</button>` : `<a class="btn ${cls}" href="#/contact?plan=${key}">${label}</a>`);
  setView(`<section class="pricing"><h1>מסלולים</h1><p class="muted">מתחילים בחינם. משדרגים כשמרגישים שזה עובד.</p>
    <div class="plans">
      <div class="plan"><h3>חינם</h3><div class="price">₪0</div><ul><li>עד ${CONFIG.free?.dailyItems || 20} שאלות ביום</li><li>כל הנושאים, חלק מהמאגר</li><li>מחוללי צורות, סדרות וחישוב</li><li>מעקב התקדמות בסיסי</li></ul>${S.user ? `<a class="btn" href="#/home">ממשיכים בחינם</a>` : `<a class="btn" href="#/register">הרשמה</a>`}</div>
      <div class="plan hi"><span class="tag">הכי פופולרי</span><h3>PRO</h3><div class="price">₪${pr.monthly}<small>/חודש</small></div><p class="muted small">או ₪${pr.season} לעונה (6 חודשים) — חוסך ${Math.round((1 - pr.season / (pr.monthly * 6)) * 100)}%</p><ul><li>ללא הגבלת שאלות</li><li>כל המאגר (מאות שאלות + מחוללים)</li><li>סימולציות מלאות עם שעון</li><li>תרגול חוזר אוטומטי של טעויות</li><li>פרופיל אישיות מלא</li><li>המלווה עוקב אחרי ההתקדמות</li></ul><div class="cta-col">${btn("monthly", "חודשי", "primary")}${btn("season", "עונה — ₪" + pr.season)}</div></div>
      <div class="plan"><h3>ליווי אישי</h3><div class="price">₪${pr.mentoring}</div><ul><li>כל מה שב-PRO לעונה</li><li>4 מפגשים אישיים (וידאו/פרונטלי)</li><li>סימולציית ראיון אישי + משוב</li><li>תוכנית אישית לפי תאריך המיונים</li><li>וואטסאפ פתוח לשאלות</li></ul>${btn("mentoring", "לתאם שיחה")}</div>
    </div>
    <p class="muted small">המחירים כוללים הכול (עוסק פטור — ללא מע״מ). ביטול תוך 14 יום מההצטרפות לפי חוק הגנת הצרכן. <a href="#/terms">לתקנון</a>.</p>
    ${!S.user ? `<p><a class="btn primary" href="#/register">מתחילים בחינם</a></p>` : ""}
  </section>`);
  document.querySelectorAll("[data-demo-pro]").forEach((b) => { b.onclick = async () => { const until = Date.now() + (b.dataset.demoPro === "season" ? 183 : 31) * 864e5; await S.store.users.update(S.user.uid, { plan: "pro", planUntil: until, planSource: "demo" }); toast("PRO הופעל (הדגמה) ✨", "ok"); go("#/home"); }; });
}
function contact(params) {
  nav();
  const plan = params?.get("plan");
  setView(`<section class="auth contact"><h1>לדבר עם ${esc(CONFIG.mentor?.name || "המלווה")}</h1><p class="muted">${plan ? `מעניין אותך מסלול <b>${plan === "mentoring" ? "ליווי אישי" : "PRO"}</b> — השאירו פרטים ואחזור עם כל הפרטים והתשלום.` : "שאלות, ליווי אישי, או סתם להתייעץ מאיפה להתחיל — גם הורים מוזמנים."}</p>
    ${CONFIG.mentor?.whatsapp ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(CONFIG.mentor.whatsapp)}?text=${encodeURIComponent("היי, הגעתי מהאפליקציה של ההכנה ל-8200")}">💬 וואטסאפ</a>` : ""}
    ${CONFIG.mentor?.email ? `<a class="btn" href="mailto:${esc(CONFIG.mentor.email)}?subject=${encodeURIComponent("הכנה ל-8200")}">✉️ אימייל</a>` : ""}
    ${leadFormHtml({ name: S.user?.name, phone: S.user?.phone, email: S.user?.email })}
  </section>`);
  if (plan) { const ta = $("#leadForm textarea"); if (ta) ta.value = `מעניין אותי המסלול: ${plan === "mentoring" ? "ליווי אישי" : plan === "season" ? "PRO לעונה" : "PRO חודשי"}`; }
  wireLeadForm();
}
async function settings() {
  if (!requireUser()) return;
  nav("#/more");
  const p = S.progress; const st = p.settings || {};
  setView(`<section class="auth"><h1>הגדרות</h1>
    <form class="form" id="setForm">
      <label>שם <input name="name" value="${esc(S.user.name || "")}"></label>
      <div class="row2"><label>טלפון <input name="phone" dir="ltr" value="${esc(S.user.phone || "")}"></label><label>כיתה <select name="grade">${Object.entries(GRADES).map(([k, v]) => `<option value="${k}" ${S.user.grade === k ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <label>מתי המיונים? <input name="targetDate" type="month" value="${esc(S.user.targetDate || "")}"></label>
      <label>יעד יומי <select name="dailyGoal">${[10, 15, 25, 40].map((n) => `<option value="${n}" ${(p.dailyGoal || 15) === n ? "selected" : ""}>${n} שאלות</option>`).join("")}</select></label>
      <label class="check"><input type="checkbox" name="surprise" ${st.surprise !== false ? "checked" : ""}> בוחני פתע כשהאפליקציה פתוחה</label>
      <label>מראה <select name="theme">${[["auto", "אוטומטי"], ["light", "בהיר"], ["dark", "כהה"]].map(([k, v]) => `<option value="${k}" ${(st.theme || "auto") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <button class="btn primary" type="submit">שמירה</button>
    </form>
    <div class="section"><h3>התראות בטלפון</h3><p class="muted small">${S.store.mode === "firebase" ? "בוחני פתע ותזכורות גם כשהאפליקציה סגורה." : "במצב הדגמה ההתראות עובדות רק כשהאפליקציה פתוחה."} באייפון: קודם 'הוסף למסך הבית' (שיתוף ← הוסף למסך הבית) ואז לאשר כאן.</p>
      <button class="btn" id="notifBtn">${Notification?.permission === "granted" ? "ההתראות פעילות ✓" : "הפעלת התראות"}</button></div>
    <div class="section"><h3>החשבון</h3><p class="muted small">${esc(S.user.email)} · ${isPro() ? `PRO${S.user.planUntil ? ` עד ${fmtDate(S.user.planUntil)}` : ""}` : "חינם"} · ${S.store.mode === "firebase" ? "מצב חי" : "מצב הדגמה"}</p><div class="cta-row"><button class="btn" id="logoutBtn">יציאה</button>${S.store.mode === "local" ? `<button class="btn danger" id="deleteBtn">מחיקת החשבון</button>` : ""}</div></div>
  </section>`);
  $("#setForm").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); p.dailyGoal = +fd.dailyGoal; p.settings = { ...st, surprise: !!fd.surprise, theme: fd.theme }; applyTheme(); await S.store.progress.save(S.user.uid, p); await S.store.users.update(S.user.uid, { name: fd.name.trim(), phone: fd.phone, grade: fd.grade, targetDate: fd.targetDate, dailyGoal: p.dailyGoal }); toast("נשמר ✓", "ok"); scheduleSurprise(); };
  $("#notifBtn").onclick = () => enableNotifications();
  $("#logoutBtn").onclick = async () => { await S.store.auth.signOut(); go("#/"); };
  $("#deleteBtn")?.addEventListener("click", async () => { if (confirm("למחוק את החשבון וכל ההתקדמות?")) { await S.store.users.remove(S.user.uid); await S.store.auth.signOut(); go("#/"); } });
}
function more() {
  if (!requireUser()) return;
  nav("#/more");
  setView(`<section><h1>עוד</h1><div class="menu">
    <a href="#/profile">🪞 פרופיל האישיות שלי</a><a href="#/pricing">💎 מסלולים ו-PRO</a><a href="#/contact">💬 לדבר עם המלווה</a><a href="#/settings">⚙️ הגדרות והתראות</a><a href="#/terms">📄 תקנון ופרטיות</a>${isAdmin() ? `<a href="#/admin">🛠 לוח ניהול</a>` : ""}<a href="../he/">🏛 DATTA · דאטא</a>
  </div>${footerHtml()}</section>`);
}
function terms() {
  nav();
  setView(`<article class="lesson"><h1>תקנון ומדיניות פרטיות</h1><div class="prose">${md(`
## מי אנחנו
"${CONFIG.appName || "מוכנים ל-8200"}" הוא שירות הכנה פרטי לתרגול לקראת מיונים טכנולוגיים בצה״ל, שמפעיל ${CONFIG.mentor?.name || ""} (עוסק פטור, ישראל). השירות **אינו קשור** לצה״ל, ליחידה 8200 או לכל גוף רשמי, ואינו מתיימר לשחזר מבחנים אמיתיים. כל התכנים מקוריים ונועדו לתרגול בלבד.

## הרשמה וקטינים
השירות מיועד לבני 16 ומעלה. משתמש/ת מתחת לגיל 18 נרשם/ת באישור הורה או אפוטרופוס, והתשלום (אם יש) מתבצע על ידם. בהרשמה נשמרים: שם, אימייל, טלפון (לא חובה), כיתה ותאריך משוער של המיונים.

## מה נשמר ולמה
כדי שהאימון יעבוד, אנחנו שומרים את התשובות שלך, הזמנים, הציונים וההתקדמות. המלווה רואה את הנתונים האלה כדי לכוון אותך. הנתונים לא נמכרים ולא מועברים לצד שלישי, למעט ספקי תשתית (אחסון בענן, סליקה) הנדרשים להפעלת השירות. אפשר לבקש בכל עת לקבל עותק של הנתונים או למחוק את החשבון — דרך ההגדרות או בפנייה למלווה.

## מנויים, תשלום וביטול
מחירי המסלולים מוצגים בעמוד "מסלולים" וכוללים הכול (ללא מע״מ — עוסק פטור). על כל תשלום מונפקת קבלה. ניתן לבטל עסקה תוך 14 יום מיום ההצטרפות (ובלבד שהביטול נעשה לפחות יומיים לפני תום התקופה), בהתאם לחוק הגנת הצרכן; בביטול מאוחר יותר של מנוי תקופתי, יוחזר החלק היחסי. בקשת ביטול — בהודעה למלווה (אימייל/וואטסאפ).

## שימוש הוגן
החשבון אישי ואינו ניתן להעברה. אין להעתיק או להפיץ את השאלות, השיעורים וההסברים.

## אחריות
אנחנו עושים כל מאמץ שהתכנים יהיו מדויקים ומועילים, אבל לא מתחייבים לתוצאה במיונים — ההצלחה תלויה בך. השירות ניתן כמות שהוא (AS IS).

## יצירת קשר
${CONFIG.mentor?.email || ""}

_עודכן: אוקטובר 2026._`)}</div></article>`);
}

// ============================================================
//  Admin
// ============================================================
async function admin(sub, id) {
  if (!requireUser()) return;
  if (!isAdmin()) { toast("אין הרשאה"); return go("#/home"); }
  nav();
  if (sub === "student" && id) return adminStudent(id);
  if (sub === "leads") return adminLeads();
  if (sub === "testimonials") return adminTestimonials();
  const users = (await S.store.users.list()).filter((u) => !isAdminEmail(u.email));
  const leads = await S.store.leads.list();
  const active7 = users.filter((u) => daysAgo(u.lastActive) <= 7).length;
  const pro = users.filter((u) => u.plan === "pro" && (!u.planUntil || u.planUntil > Date.now())).length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  setView(`<section class="admin"><div class="sec-head"><h1>לוח ניהול</h1><span class="muted small">${S.store.mode === "firebase" ? "🟢 מצב חי" : "🟡 מצב הדגמה"}</span></div>
    <div class="kpis"><div class="kpi"><b>${users.length}</b><span>תלמידים</span></div><div class="kpi"><b>${active7}</b><span>פעילים 7 ימים</span></div><div class="kpi"><b>${pro}</b><span>PRO</span></div><a class="kpi" href="#/admin/leads"><b>${newLeads}</b><span>פניות חדשות</span></a></div>
    <div class="cta-row"><a class="btn" href="#/admin/leads">פניות (${leads.length})</a><a class="btn" href="#/admin/testimonials">המלצות</a><button class="btn" id="csvBtn">ייצוא CSV</button>${S.store.mode === "local" ? `<button class="btn" id="seedBtn">${users.some((u) => u.demo) ? "מחיקת נתוני הדגמה" : "יצירת תלמידי הדגמה"}</button>` : ""}</div>
    <input class="search" id="q" placeholder="חיפוש לפי שם / אימייל / טלפון">
    <div class="tbl"><table id="stuTable"><thead><tr><th>תלמיד/ה</th><th>כיתה</th><th>מיונים</th><th>מסלול</th><th>שאלות</th><th>דיוק</th><th>רצף</th><th>פעיל/ה</th></tr></thead><tbody>
      ${users.map((u) => `<tr data-uid="${u.uid}" data-s="${esc((u.name || "") + " " + u.email + " " + (u.phone || ""))}"><td><a href="#/admin/student/${u.uid}">${esc(u.name || "—")}</a>${u.demo ? ' <span class="pill">דמו</span>' : ""}<br><span class="muted small" dir="ltr">${esc(u.email)}</span></td><td>${GRADES[u.grade] || u.grade || "—"}</td><td>${esc(u.targetDate || "—")}</td><td>${u.plan === "pro" && (!u.planUntil || u.planUntil > Date.now()) ? `<span class="pill pro">PRO</span>` : "חינם"}</td><td>${u.stats?.items ?? 0}</td><td>${u.stats?.items ? Math.round((u.stats.ok / u.stats.items) * 100) + "%" : "—"}</td><td>${u.stats?.streak ?? 0}</td><td>${u.lastActive ? (daysAgo(u.lastActive) === 0 ? "היום" : `לפני ${daysAgo(u.lastActive)} ימים`) : "—"}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">עדיין אין תלמידים. כשמישהו נרשם הוא יופיע כאן.</td></tr>`}
    </tbody></table></div></section>`);
  $("#q").oninput = (e) => { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll("#stuTable tbody tr").forEach((tr) => { tr.hidden = q && !(tr.dataset.s || "").toLowerCase().includes(q); }); };
  $("#csvBtn").onclick = () => { const rows = [["name", "email", "phone", "grade", "targetDate", "plan", "planUntil", "items", "accuracy", "streak", "lastActive", "createdAt", "referrer"], ...users.map((u) => [u.name, u.email, u.phone, u.grade, u.targetDate, u.plan, u.planUntil ? new Date(u.planUntil).toISOString().slice(0, 10) : "", u.stats?.items ?? 0, u.stats?.items ? Math.round((u.stats.ok / u.stats.items) * 100) : "", u.stats?.streak ?? 0, u.lastActive ? new Date(u.lastActive).toISOString() : "", u.createdAt ? new Date(u.createdAt).toISOString() : "", u.referrer])]; const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `students-${today()}.csv`; a.click(); };
  $("#seedBtn")?.addEventListener("click", async () => { if (users.some((u) => u.demo)) { for (const u of users.filter((x) => x.demo)) await S.store.users.remove(u.uid); } else await seedDemo(); admin(); });
}
async function seedDemo() {
  const names = [["נועה כהן (דמו)", "12", "2027-02"], ["איתי לוי (דמו)", "12", "2027-01"], ["מאיה פרץ (דמו)", "11", "2027-09"], ["יונתן אברהם (דמו)", "12", "2026-12"], ["שירה מזרחי (דמו)", "11", "2027-06"]];
  const subsAll = await allSubs();
  for (let i = 0; i < names.length; i++) {
    const [name, grade, targetDate] = names[i];
    const uid = `demo${i}`; const email = `demo${i + 1}@example.com`;
    const p = emptyProgress(); let items = 0, ok = 0;
    for (const s of subsAll) { if (Math.random() < 0.4) continue; const n = Math.floor(Math.random() * 40) + 5; const acc = 0.4 + Math.random() * 0.55; const k = Math.round(n * acc); p.subs[s.id] = { n, ok: k, t: n * (20 + Math.random() * 30) }; items += n; ok += k; }
    for (let d = 0; d < 28; d++) if (Math.random() < 0.5) p.days[new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)] = Math.floor(Math.random() * 25) + 5;
    p.streak = Math.floor(Math.random() * 9); p.xp = ok * 10 + (items - ok) * 2;
    for (const t of Object.keys(TRAITS)) p.traits[t] = { sum: Math.round(2 + Math.random() * 2) * 8, n: 8 };
    const all = JSON.parse(localStorage.getItem("prep8200:users") || "{}");
    all[uid] = { uid, email, passHash: "x", name, phone: "05x-0000000", grade, targetDate, plan: i % 3 === 0 ? "pro" : "free", planUntil: i % 3 === 0 ? Date.now() + 90 * 864e5 : null, role: "student", createdAt: Date.now() - (30 + i * 9) * 864e5, lastActive: Date.now() - i * 2 * 864e5, demo: true, referrer: i % 2 ? "חבר" : "", stats: { xp: p.xp, streak: p.streak, items, ok } };
    localStorage.setItem("prep8200:users", JSON.stringify(all));
    await S.store.progress.save(uid, p);
    await S.store.attempts.add(uid, { mode: "daily", title: "האימון היומי", score: 11, scoredTotal: 15, total: 15, durSec: 540, startedAt: Date.now() - 864e5 });
  }
  toast("נוצרו 5 תלמידי הדגמה", "ok");
}
async function adminStudent(uid) {
  const u = await S.store.users.get(uid); if (!u) return go("#/admin");
  const p = await S.store.progress.get(uid); const subsAll = await allSubs(); const attempts = await S.store.attempts.list(uid, 20);
  const t = p.traits || {};
  setView(`<section class="admin"><a class="back" href="#/admin">‹ לוח ניהול</a>
    <div class="sec-head"><h1>${esc(u.name || "—")}</h1>${u.plan === "pro" && (!u.planUntil || u.planUntil > Date.now()) ? `<span class="pill pro">PRO${u.planUntil ? ` עד ${fmtDate(u.planUntil)}` : ""}</span>` : `<span class="pill">חינם</span>`}</div>
    <p class="muted small" dir="auto">${esc(u.email)} · ${esc(u.phone || "ללא טלפון")} · ${GRADES[u.grade] || "—"} · מיונים: ${esc(u.targetDate || "—")} · נרשם/ה ${fmtDate(u.createdAt)} · פעיל/ה ${fmtDateTime(u.lastActive)}${u.referrer ? ` · הפניה: ${esc(u.referrer)}` : ""}${u.tracks?.length ? ` · מסלולים: ${u.tracks.join(", ")}` : ""}</p>
    <div class="cta-row">${u.phone ? `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${esc(String(u.phone).replace(/\D/g, "").replace(/^0/, "972"))}">וואטסאפ</a>` : ""}<a class="btn small" href="mailto:${esc(u.email)}">אימייל</a></div>
    <div class="kpis"><div class="kpi"><b>${u.stats?.items ?? 0}</b><span>שאלות</span></div><div class="kpi"><b>${u.stats?.items ? Math.round((u.stats.ok / u.stats.items) * 100) : 0}%</b><span>דיוק</span></div><div class="kpi"><b>${p.streak || 0}</b><span>רצף</span></div><div class="kpi"><b>${Object.keys(p.days || {}).length}</b><span>ימי אימון</span></div></div>
    <h2>שליטה לפי שלב</h2><div class="cat-list">${CATEGORIES.map((c) => { const m = masteryOf(p, subsAll.filter((s) => s.cat.id === c.id).map((s) => s.id)); return `<div class="cat-row" style="--c:${c.color}"><span class="cat-emoji">${c.emoji}</span><span class="cat-main"><strong>${esc(c.short)}</strong><span class="bar"><i style="width:${Math.round(m * 100)}%"></i></span></span><span class="cat-pct">${Math.round(m * 100)}%</span></div>`; }).join("")}</div>
    <h2>לפי נושא</h2><div class="tbl"><table><thead><tr><th>נושא</th><th>שאלות</th><th>דיוק</th><th>זמן ממוצע</th></tr></thead><tbody>${subsAll.map((s) => { const st = subStats(p, s.id); if (!st.n) return ""; return `<tr><td>${esc(s.title)}</td><td>${st.n}</td><td class="${st.acc < 0.6 ? "low" : ""}">${Math.round(st.acc * 100)}%</td><td>${Math.round(st.t / st.n)} שנ׳</td></tr>`; }).join("") || `<tr><td colspan="4" class="muted">עוד לא תרגל/ה</td></tr>`}</tbody></table></div>
    ${Object.keys(t).length ? `<h2>פרופיל אישיות</h2><div class="traits compact">${Object.entries(TRAITS).map(([k, [name]]) => { const v = t[k]; const pct = v?.n ? Math.round((v.sum / v.n / 4) * 100) : 0; return `<div class="trait"><div class="trait-h"><span>${name}</span><b>${pct}%</b></div><span class="bar"><i style="width:${pct}%"></i></span></div>`; }).join("")}</div>` : ""}
    ${attempts.length ? `<h2>תרגולים אחרונים</h2><div class="attempts">${attempts.map((a) => `<div class="att"><span>${esc(a.title)}</span><span class="muted small">${fmtDateTime(a.startedAt)}</span><b>${a.scoredTotal ? `${a.score}/${a.scoredTotal}` : "✓"}</b></div>`).join("")}</div>` : ""}
    <h2>ניהול</h2>
    <form class="form" id="mgForm">
      <div class="row2"><label>מסלול <select name="plan"><option value="free" ${u.plan !== "pro" ? "selected" : ""}>חינם</option><option value="pro" ${u.plan === "pro" ? "selected" : ""}>PRO</option></select></label><label>PRO עד <input type="date" name="planUntil" value="${u.planUntil ? new Date(u.planUntil).toISOString().slice(0, 10) : ""}"></label></div>
      <label>הודעה אישית לתלמיד/ה (מוצגת במסך הבית) <textarea name="mentorMessage" rows="3">${esc(u.mentorMessage || "")}</textarea></label>
      <label>הערות פנימיות (רק אתה רואה) <textarea name="adminNotes" rows="3">${esc(u.adminNotes || "")}</textarea></label>
      <button class="btn primary" type="submit">שמירה</button>
    </form></section>`);
  $("#mgForm").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); await S.store.users.update(uid, { plan: fd.plan, planUntil: fd.planUntil ? new Date(fd.planUntil).getTime() : null, mentorMessage: fd.mentorMessage, adminNotes: fd.adminNotes, planSource: fd.plan === "pro" ? "admin" : null }); toast("נשמר ✓", "ok"); };
}
async function adminLeads() {
  const leads = await S.store.leads.list();
  const STATUS = { new: "חדש", contacted: "יצרתי קשר", registered: "נרשם/ה", paid: "שילם/ה", no: "לא רלוונטי" };
  setView(`<section class="admin"><a class="back" href="#/admin">‹ לוח ניהול</a><h1>פניות (${leads.length})</h1>
    ${leads.length ? `<div class="leads">${leads.map((l) => `<div class="lead-card ${l.status}"><div class="lead-h"><strong>${esc(l.name)}</strong><select data-id="${l.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${l.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></div><p class="muted small">${fmtDateTime(l.createdAt)} · ${GRADES[l.grade] || (l.grade === "parent" ? "הורה" : "—")} · <span dir="ltr">${esc(l.phone || "")}</span> ${l.email ? `· <span dir="ltr">${esc(l.email)}</span>` : ""} ${l.source ? `· ${esc(l.source)}` : ""}</p>${l.msg ? `<p>${esc(l.msg)}</p>` : ""}<div class="cta-row">${l.phone ? `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${esc(String(l.phone).replace(/\D/g, "").replace(/^0/, "972"))}">וואטסאפ</a><a class="btn small" href="tel:${esc(l.phone)}">חיוג</a>` : ""}${l.email ? `<a class="btn small" href="mailto:${esc(l.email)}">אימייל</a>` : ""}</div></div>`).join("")}</div>` : `<p class="muted">עדיין אין פניות. הטופס בעמוד הבית ובעמוד "יצירת קשר" שולח לכאן (וגם לאימייל שלך).</p>`}</section>`);
  document.querySelectorAll(".lead-card select").forEach((s) => { s.onchange = async () => { await S.store.leads.update(s.dataset.id, { status: s.value }); s.closest(".lead-card").className = `lead-card ${s.value}`; toast("עודכן"); }; });
}
async function adminTestimonials() {
  const items = await S.store.public.getTestimonials();
  setView(`<section class="admin"><a class="back" href="#/admin">‹ לוח ניהול</a><h1>המלצות</h1><p class="muted small">מוצגות בעמוד הבית. רק המלצות אמיתיות, באישור הכותב/ת.</p>
    <div class="testi">${items.map((t, i) => `<blockquote><p>${esc(t.text)}</p><footer>${esc(t.name)}${t.role ? ` · ${esc(t.role)}` : ""} <button class="btn small danger" data-del="${i}">מחיקה</button></footer></blockquote>`).join("") || `<p class="muted">אין עדיין המלצות.</p>`}</div>
    <form class="form" id="tForm"><h3>הוספת המלצה</h3><div class="row2"><label>שם <input name="name" required></label><label>תפקיד/כיתה <input name="role" placeholder="י״ב, 2026"></label></div><label>הטקסט <textarea name="text" rows="3" required></textarea></label><button class="btn primary">הוספה</button></form></section>`);
  $("#tForm").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); await S.store.public.setTestimonials([...items, { name: fd.name, role: fd.role, text: fd.text, at: Date.now() }]); adminTestimonials(); };
  document.querySelectorAll("[data-del]").forEach((b) => { b.onclick = async () => { items.splice(+b.dataset.del, 1); await S.store.public.setTestimonials(items); adminTestimonials(); }; });
}

// ============================================================
//  Notifications / surprise quizzes / theme / PWA
// ============================================================
async function enableNotifications() {
  if (!("Notification" in window)) return toast("הדפדפן הזה לא תומך בהתראות");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return toast("ההתראות לא אושרו");
  S.progress.settings = { ...(S.progress.settings || {}), notifications: true };
  await S.store.progress.save(S.user.uid, S.progress);
  const token = await S.store.push.enable(S.user.uid);
  toast(token ? "התראות הופעלו — גם כשהאפליקציה סגורה ✓" : "התראות הופעלו (כשהאפליקציה פתוחה) ✓", "ok");
  const reg = await navigator.serviceWorker?.getRegistration();
  reg?.showNotification?.("מוכנים ל-8200", { body: "מעולה! מכאן יגיעו בוחני הפתע ⚡", icon: "./icons/icon-192.png", tag: "welcome" });
  if (location.hash.startsWith("#/settings")) settings();
}
function offerNotifications() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  const m = modal(`<h2>⚡ בוחני פתע?</h2><p>נשלח לך מדי פעם התראה עם 5 שאלות ל-2 דקות. ככה נבנית מהירות וזה הכי קרוב ליום האמיתי.</p><div class="cta-row"><button class="btn primary" id="nOk">כן, הפעילו</button><button class="btn" id="nNo">אולי אחר כך</button></div>`);
  $("#nOk").onclick = () => { m.close(); enableNotifications(); }; $("#nNo").onclick = () => m.close();
}
function scheduleSurprise() {
  clearTimeout(S.surpriseTimer);
  if (!S.user || S.progress.settings?.surprise === false) return;
  const delay = (15 + Math.random() * 30) * 60 * 1000;
  S.surpriseTimer = setTimeout(() => {
    if (!S.user || S.quiz) return scheduleSurprise();
    if (Notification?.permission === "granted" && document.hidden) { navigator.serviceWorker?.getRegistration().then((reg) => reg?.showNotification?.("⚡ בוחן פתע!", { body: "5 שאלות, 2 דקות. יאללה?", icon: "./icons/icon-192.png", tag: "surprise", data: { url: "#/surprise" } })); }
    const bar = document.createElement("div"); bar.className = "surprise-bar"; bar.innerHTML = `<span>⚡ בוחן פתע! 5 שאלות ב-2 דקות</span><a class="btn small primary" href="#/surprise">יאללה</a><button class="btn-icon" aria-label="סגירה">✕</button>`;
    bar.querySelector("button").onclick = () => bar.remove(); bar.querySelector("a").onclick = () => bar.remove();
    document.body.appendChild(bar); setTimeout(() => bar.remove(), 60000);
    scheduleSurprise();
  }, delay);
}
function applyTheme() { const t = S.progress.settings?.theme || "auto"; if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }

// ============================================================
//  Router
// ============================================================
async function route() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?"); const params = new URLSearchParams(qs || "");
  const seg = path.split("/").filter(Boolean);
  if (S.quiz && !["practice", "daily", "surprise", "sim"].includes(seg[0])) { S.quiz.destroy(); S.quiz = null; }
  document.body.classList.toggle("in-quiz", false);
  const r = seg[0] || "";
  try {
    switch (r) {
      case "": return S.user ? home() : landing();
      case "login": case "register": case "reset": return S.user && r !== "reset" ? go("#/home") : authView(r);
      case "onboarding": return onboarding();
      case "home": return home();
      case "train": return train();
      case "cat": return category(seg[1]);
      case "lesson": return lesson(seg[1], seg[2]);
      case "practice": return practice(seg[1], seg[2], params);
      case "daily": return daily();
      case "surprise": return surprise();
      case "sim": return sim(seg[1] || "all");
      case "progress": return progressView();
      case "profile": return profile();
      case "pricing": return pricing();
      case "contact": return contact(params);
      case "settings": return settings();
      case "more": return more();
      case "terms": return terms();
      case "admin": return admin(seg[1], seg[2]);
      default: return go("#/");
    }
  } catch (e) { console.error(e); setView(`<section class="auth"><h1>משהו השתבש</h1><p class="muted">${esc(e.message || e)}</p><a class="btn" href="#/">לעמוד הבית</a></section>`); }
}

async function boot() {
  $("#appName").textContent = CONFIG.appName || "מוכנים ל-8200";
  S.store = await createStore();
  if (S.store.mode === "local") $("#demoBanner").hidden = false;
  S.store.auth.onChange(async (u) => {
    const changed = (u?.uid || null) !== (S.user?.uid || null);
    S.user = u;
    if (u) { S.progress = await S.store.progress.get(u.uid); applyTheme(); scheduleSurprise(); } else { S.progress = emptyProgress(); clearTimeout(S.surpriseTimer); }
    if (changed) route();
  });
  await S.store.init();
  window.addEventListener("hashchange", route);
  if (!S.user && !location.hash) location.hash = "#/";
  route();
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("sw", e)); navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.url) go(e.data.url); }); }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); S.deferredInstall = e; });
  window.addEventListener("prep:push", (e) => { const n = e.detail?.notification; if (n) toast(`${n.title || ""} ${n.body || ""}`); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.user) S.store.users.update(S.user.uid, { lastActive: Date.now() }).catch(() => {}); });
}
boot();
