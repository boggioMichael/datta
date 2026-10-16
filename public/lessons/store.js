// store.js — שכבת הנתונים. שני מימושים עם אותו ממשק:
//   LocalStore    — מצב הדגמה (localStorage, הדפדפן הזה בלבד)
//   FirebaseStore — מצב חי (Firebase Auth + Firestore + Messaging)
// הממשק:
//   store.mode ('local'|'firebase'), store.init()
//   store.auth: onChange(cb), signUp({email,password,...profile}), signIn(email,password), signOut(), resetPassword(email), signInGoogle()
//   store.users: get(uid), update(uid, patch), list()
//   store.progress: get(uid), save(uid, data)
//   store.attempts: add(uid, attempt), list(uid, limit)
//   store.leads: add(lead), list(), update(id, patch)
//   store.public: getTestimonials(), setTestimonials(items)
//   store.push: enable(uid) → token|null

const CONFIG = window.PREP_CONFIG || {};
const ADMINS = (CONFIG.adminEmails || []).map((e) => e.toLowerCase());
export const isAdminEmail = (email) => !!email && ADMINS.includes(String(email).toLowerCase());
export const dateKey = (ts) => { const d = ts ? new Date(ts) : new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const today = () => dateKey();

export function emptyProgress() {
  return { xp: 0, streak: 0, bestStreak: 0, lastDay: "", days: {}, dailyGoal: 15, subs: {}, items: {}, traits: {}, settings: { notifications: false, surprise: true, theme: "auto" }, onboarding: null, updatedAt: Date.now() };
}

// ---------- hashing (demo passwords) ----------
async function sha256(text) {
  try {
    if (crypto?.subtle) { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  } catch { /* fall through */ }
  let h = 5381; for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return "weak-" + (h >>> 0).toString(16);
}

// ============================================================
//  LocalStore
// ============================================================
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const K = { users: "prep8200:users", session: "prep8200:session", leads: "prep8200:leads", testimonials: "prep8200:testimonials", progress: (u) => `prep8200:progress:${u}`, attempts: (u) => `prep8200:attempts:${u}` };

function makeLocalStore() {
  const listeners = new Set();
  let current = null;
  const users = () => LS.get(K.users, {});
  const saveUsers = (u) => LS.set(K.users, u);
  const publicUser = (u) => { if (!u) return null; const { passHash, ...rest } = u; return rest; };
  const emit = () => listeners.forEach((cb) => cb(current));
  const findByEmail = (email) => Object.values(users()).find((u) => u.email.toLowerCase() === email.toLowerCase());

  return {
    mode: "local",
    async init() {
      const sid = LS.get(K.session, null);
      current = sid ? publicUser(users()[sid]) : null;
      if (current) { const all = users(); all[current.uid].lastActive = Date.now(); saveUsers(all); }
      emit();
      return current;
    },
    auth: {
      onChange(cb) { listeners.add(cb); cb(current); return () => listeners.delete(cb); },
      current: () => current,
      async signUp({ email, password, ...profile }) {
        email = String(email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("כתובת האימייל לא תקינה");
        if (!password || password.length < 6) throw new Error("הסיסמה צריכה להכיל לפחות 6 תווים");
        if (findByEmail(email)) throw new Error("כבר קיים חשבון עם האימייל הזה — נסו להתחבר");
        const uid = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const u = { uid, email, passHash: await sha256(password), createdAt: Date.now(), lastActive: Date.now(), plan: "free", planUntil: null, role: isAdminEmail(email) ? "admin" : "student", ...profile };
        const all = users(); all[uid] = u; saveUsers(all);
        LS.set(K.session, uid); current = publicUser(u); emit();
        return current;
      },
      async signIn(email, password) {
        const u = findByEmail(String(email || "").trim());
        if (!u) throw new Error("לא נמצא חשבון עם האימייל הזה");
        if (u.passHash !== (await sha256(password))) throw new Error("הסיסמה שגויה");
        const all = users(); all[u.uid].lastActive = Date.now(); saveUsers(all);
        LS.set(K.session, u.uid); current = publicUser(all[u.uid]); emit();
        return current;
      },
      async signInGoogle() { throw new Error("כניסה עם Google זמינה רק במצב חי (Firebase)"); },
      async signOut() { LS.del(K.session); current = null; emit(); },
      async resetPassword(email) { const u = findByEmail(email); if (!u) throw new Error("לא נמצא חשבון עם האימייל הזה"); throw new Error("במצב הדגמה אין שליחת אימייל. במצב חי Firebase שולח קישור לאיפוס."); },
    },
    users: {
      async get(uid) { return publicUser(users()[uid]); },
      async update(uid, patch) { const all = users(); if (!all[uid]) return null; all[uid] = { ...all[uid], ...patch }; saveUsers(all); if (current?.uid === uid) { current = publicUser(all[uid]); emit(); } return publicUser(all[uid]); },
      async list() { return Object.values(users()).map(publicUser).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0)); },
      async remove(uid) { const all = users(); delete all[uid]; saveUsers(all); LS.del(K.progress(uid)); LS.del(K.attempts(uid)); },
    },
    progress: {
      async get(uid) { return LS.get(K.progress(uid), null) || emptyProgress(); },
      async save(uid, data) { data.updatedAt = Date.now(); LS.set(K.progress(uid), data); return data; },
    },
    attempts: {
      async add(uid, attempt) { const list = LS.get(K.attempts(uid), []); attempt.id = attempt.id || "a" + Date.now().toString(36); list.unshift(attempt); LS.set(K.attempts(uid), list.slice(0, 300)); return attempt; },
      async list(uid, limit = 50) { return LS.get(K.attempts(uid), []).slice(0, limit); },
    },
    leads: {
      async add(lead) { const list = LS.get(K.leads, []); lead.id = "l" + Date.now().toString(36); lead.createdAt = Date.now(); lead.status = "new"; list.unshift(lead); LS.set(K.leads, list); return lead; },
      async list() { return LS.get(K.leads, []); },
      async update(id, patch) { const list = LS.get(K.leads, []); const i = list.findIndex((l) => l.id === id); if (i >= 0) { list[i] = { ...list[i], ...patch }; LS.set(K.leads, list); } },
    },
    public: {
      async getTestimonials() { return LS.get(K.testimonials, null) || CONFIG.testimonials || []; },
      async setTestimonials(items) { LS.set(K.testimonials, items); },
    },
    push: { async enable() { return null; } },
  };
}

// ============================================================
//  FirebaseStore
// ============================================================
async function makeFirebaseStore(cfg) {
  const V = "10.14.1";
  const base = `https://www.gstatic.com/firebasejs/${V}`;
  const [{ initializeApp }, A, F] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
  const app = initializeApp(cfg.firebase);
  const auth = A.getAuth(app);
  auth.languageCode = "he";
  const db = cfg.firestoreDbId ? F.getFirestore(app, cfg.firestoreDbId) : F.getFirestore(app);
  const listeners = new Set();
  let current = null; // merged auth user + users/{uid} doc
  const emit = () => listeners.forEach((cb) => cb(current));
  const userRef = (uid) => F.doc(db, "users", uid);
  const toPlain = (snap) => (snap.exists() ? { uid: snap.id, ...snap.data() } : null);
  const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v);
  const norm = (u) => (u ? { ...u, createdAt: ms(u.createdAt), lastActive: ms(u.lastActive), planUntil: ms(u.planUntil) } : u);

  async function loadCurrent(fbUser) {
    if (!fbUser) { current = null; emit(); return; }
    const snap = await F.getDoc(userRef(fbUser.uid));
    let doc = toPlain(snap);
    if (!doc) { doc = { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || "", plan: "free", role: isAdminEmail(fbUser.email) ? "admin" : "student", createdAt: Date.now(), lastActive: Date.now() }; await F.setDoc(userRef(fbUser.uid), doc, { merge: true }); }
    else { await F.setDoc(userRef(fbUser.uid), { lastActive: Date.now() }, { merge: true }); }
    current = norm({ ...doc, email: fbUser.email || doc.email, role: isAdminEmail(fbUser.email) ? "admin" : doc.role || "student" });
    emit();
  }

  const ready = new Promise((resolve) => { const un = A.onAuthStateChanged(auth, async (u) => { await loadCurrent(u); resolve(); }); void un; });

  function heError(e) {
    const code = e?.code || "";
    const map = { "auth/email-already-in-use": "כבר קיים חשבון עם האימייל הזה — נסו להתחבר", "auth/invalid-email": "כתובת האימייל לא תקינה", "auth/weak-password": "הסיסמה חלשה מדי (לפחות 6 תווים)", "auth/user-not-found": "לא נמצא חשבון עם האימייל הזה", "auth/wrong-password": "הסיסמה שגויה", "auth/invalid-credential": "האימייל או הסיסמה שגויים", "auth/too-many-requests": "יותר מדי ניסיונות — נסו שוב בעוד כמה דקות", "auth/popup-closed-by-user": "החלון נסגר לפני סיום הכניסה", "permission-denied": "אין הרשאה לפעולה הזו" };
    return new Error(map[code] || e?.message || "משהו השתבש");
  }

  return {
    mode: "firebase",
    async init() { await ready; return current; },
    auth: {
      onChange(cb) { listeners.add(cb); cb(current); return () => listeners.delete(cb); },
      current: () => current,
      async signUp({ email, password, ...profile }) {
        try {
          const cred = await A.createUserWithEmailAndPassword(auth, String(email).trim(), password);
          if (profile.name) await A.updateProfile(cred.user, { displayName: profile.name });
          const doc = { uid: cred.user.uid, email: cred.user.email, plan: "free", planUntil: null, role: isAdminEmail(cred.user.email) ? "admin" : "student", createdAt: Date.now(), lastActive: Date.now(), ...profile };
          await F.setDoc(userRef(cred.user.uid), doc, { merge: true });
          await loadCurrent(cred.user);
          return current;
        } catch (e) { throw heError(e); }
      },
      async signIn(email, password) { try { const cred = await A.signInWithEmailAndPassword(auth, String(email).trim(), password); await loadCurrent(cred.user); return current; } catch (e) { throw heError(e); } },
      async signInGoogle() { try { const provider = new A.GoogleAuthProvider(); const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone; if (standalone) { await A.signInWithRedirect(auth, provider); return current; } const cred = await A.signInWithPopup(auth, provider); await loadCurrent(cred.user); return current; } catch (e) { throw heError(e); } },
      async signOut() { await A.signOut(auth); current = null; emit(); },
      async resetPassword(email) { try { await A.sendPasswordResetEmail(auth, String(email).trim()); } catch (e) { throw heError(e); } },
    },
    users: {
      async get(uid) { return norm(toPlain(await F.getDoc(userRef(uid)))); },
      async update(uid, patch) { await F.setDoc(userRef(uid), patch, { merge: true }); if (current?.uid === uid) { current = norm({ ...current, ...patch }); emit(); } return this.get(uid); },
      async list() { const qs = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy("lastActive", "desc"), F.limit(500))); return qs.docs.map((d) => norm({ uid: d.id, ...d.data() })); },
      async remove(uid) { await F.deleteDoc(userRef(uid)); },
    },
    progress: {
      async get(uid) { const s = await F.getDoc(F.doc(db, "progress", uid)); return s.exists() ? { ...emptyProgress(), ...s.data() } : emptyProgress(); },
      async save(uid, data) { data.updatedAt = Date.now(); await F.setDoc(F.doc(db, "progress", uid), data); return data; },
    },
    attempts: {
      async add(uid, attempt) { attempt.createdAt = Date.now(); const ref = await F.addDoc(F.collection(db, "attempts", uid, "list"), attempt); attempt.id = ref.id; return attempt; },
      async list(uid, limit = 50) { const qs = await F.getDocs(F.query(F.collection(db, "attempts", uid, "list"), F.orderBy("createdAt", "desc"), F.limit(limit))); return qs.docs.map((d) => ({ id: d.id, ...d.data() })); },
    },
    leads: {
      async add(lead) { lead.createdAt = Date.now(); lead.status = "new"; const ref = await F.addDoc(F.collection(db, "leads"), lead); lead.id = ref.id; return lead; },
      async list() { const qs = await F.getDocs(F.query(F.collection(db, "leads"), F.orderBy("createdAt", "desc"), F.limit(500))); return qs.docs.map((d) => ({ id: d.id, ...d.data() })); },
      async update(id, patch) { await F.setDoc(F.doc(db, "leads", id), patch, { merge: true }); },
    },
    public: {
      async getTestimonials() { try { const s = await F.getDoc(F.doc(db, "public", "testimonials")); return s.exists() ? s.data().items || [] : CONFIG.testimonials || []; } catch { return CONFIG.testimonials || []; } },
      async setTestimonials(items) { await F.setDoc(F.doc(db, "public", "testimonials"), { items }); },
    },
    push: {
      async enable(uid) {
        if (!cfg.vapidKey || !("serviceWorker" in navigator)) return null;
        try {
          const M = await import(`${base}/firebase-messaging.js`);
          if (!(await M.isSupported())) return null;
          const messaging = M.getMessaging(app);
          const reg = await navigator.serviceWorker.ready;
          const token = await M.getToken(messaging, { vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
          if (token && uid) await F.setDoc(userRef(uid), { fcmTokens: F.arrayUnion(token), pushEnabledAt: Date.now() }, { merge: true });
          M.onMessage(messaging, (payload) => { window.dispatchEvent(new CustomEvent("prep:push", { detail: payload })); });
          return token;
        } catch (e) { console.warn("push", e); return null; }
      },
    },
  };
}

export async function createStore() {
  if (CONFIG.firebase && CONFIG.firebase.apiKey) {
    try { return await makeFirebaseStore(CONFIG); } catch (e) { console.error("Firebase init failed", e); return { mode: "error", error: e, async init() { return null; }, auth: { onChange(cb) { cb(null); return () => {}; }, current: () => null } }; }
  }
  return makeLocalStore();
}
