// content.js — קטגוריות לפי שלבי המיון, טעינת חבילות תוכן, בחירת שאלות, מרקדאון.
import { GENERATORS, generate } from "./gen.js";

export const CATEGORIES = [
  {
    id: "dapar", stage: 1, emoji: "🧩", color: "#c8431f",
    title: "פסיכוטכני — דפ״ר וצו ראשון", short: "פסיכוטכני",
    desc: "אנלוגיות מילוליות וצורניות, חשיבה צורנית, הוראות, סדרות וכמותי — מה שנבדק בדפ״ר בצו הראשון, ושוב במבחני כלל חמ״ן.",
    packs: ["dapar-verbal", "dapar-quant", "psychometric-he"], generators: ["shapes", "gen-series", "gen-quick"],
    sim: { items: 30, minutes: 25 },
  },
  {
    id: "learning", stage: 2, emoji: "🧠", color: "#2b5fb3",
    title: "יכולת למידה — יום המא״ה וכנס המבחנים", short: "יכולת למידה",
    desc: "למידת חומר חדש (שפה מומצאת, 'מחשבון קרב'), עיבוד מידע, קשב מתמשך וזיכרון עבודה — הסגנון של יום המא״ה ושל מבחני הכנס.",
    packs: ["learning"], generators: ["kerav", "gen-attention", "gen-memory"],
    sim: { items: 25, minutes: 20 },
  },
  {
    id: "coding", stage: 3, emoji: "💻", color: "#2e7d5b",
    title: "מבוא לתכנות", short: "תכנות",
    desc: "Python מאפס: משתנים, תנאים, לולאות, פונקציות וחשיבה אלגוריתמית — הבסיס למבחן הידע, לסדנה ולראיון המקצועי במסלולים הטכנולוגיים.",
    packs: ["coding"], generators: [],
    sim: { items: 20, minutes: 30 },
  },
  {
    id: "ctf", badge: "מסלול מתקדם", emoji: "🚩", color: "#4b2e83",
    title: "CTF — מערכת, בינארי ומיגונים", short: "CTF",
    desc: "printf והתנהגות בלתי מוגדרת, מבנה ELF והטוען הדינמי, מרחב הקרנל ומודולים, ומנגנוני ההגנה — הבנה לעומק של המערכת מהחומרה ועד הקרנל. קשה בכוונה.",
    packs: ["ctf"], generators: [],
    sim: { items: 25, minutes: 35 },
  },
  {
    id: "personality", stage: 4, emoji: "🪞", color: "#7a4fb3",
    title: "שאלון אישיות ושאלות מצב", short: "אישיות",
    desc: "להכיר את הפורמט של 'שאלון 300', לענות בעקביות ובכנות, ולהבין אילו תכונות חשובות ביחידה טכנולוגית.",
    packs: ["personality"], generators: [],
    sim: null,
  },
  {
    id: "interview", stage: 5, emoji: "🎤", color: "#b36b2b",
    title: "ראיון אישי, דינמיקה קבוצתית וסיווג", short: "ראיונות",
    desc: "לספר את הסיפור שלך ב-60 שניות (STAR), להתנהל נכון בדינמיקה של יום המא״ה, ולהגיע מוכנים לראיון האישי ולתחקיר הביטחוני.",
    packs: ["interview"], generators: [],
    sim: null,
  },
  {
    id: "english", stage: 6, emoji: "🔤", color: "#1f7a8c",
    title: "אנגלית", short: "אנגלית",
    desc: "אוצר מילים, הבנת הנקרא ודקדוק ברמה שצריך כדי לקרוא חומר טכני.",
    packs: ["english", "psychometric-en"], generators: [],
    sim: { items: 20, minutes: 15 },
  },
];
export const catById = (id) => CATEGORIES.find((c) => c.id === id);

// ---------- loading ----------
const packCache = new Map();
export async function loadPack(id) {
  if (packCache.has(id)) return packCache.get(id);
  const p = fetch(`./data/${id}.json`, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(`pack ${id} ${r.status}`); return r.json(); }).catch((e) => { console.warn(e); return { pack: id, items: [], lessons: [] }; });
  packCache.set(id, p);
  return p;
}
export async function loadCategory(catId) {
  const cat = catById(catId);
  const packs = await Promise.all(cat.packs.map(loadPack));
  const subs = [];
  const seen = new Map();
  for (const p of packs) for (const it of p.items || []) {
    if (!seen.has(it.sub)) { seen.set(it.sub, { id: it.sub, title: it.subTitle, pack: p.pack, items: [], generated: false }); subs.push(seen.get(it.sub)); }
    seen.get(it.sub).items.push(it);
  }
  for (const g of cat.generators) subs.push({ id: g, title: GENERATORS[g].title, pack: null, items: [], generated: true, desc: GENERATORS[g].desc });
  const lessons = packs.flatMap((p) => (p.lessons || []).map((l) => ({ ...l, pack: p.pack })));
  return { cat, packs, subs, lessons };
}
export async function allSubs() {
  const out = [];
  for (const c of CATEGORIES) { const { subs } = await loadCategory(c.id); for (const s of subs) out.push({ ...s, cat: c }); }
  return out;
}

// ---------- selection ----------
export function subStats(progress, subId) { const s = progress.subs?.[subId]; return s ? { n: s.n, ok: s.ok, acc: s.n ? s.ok / s.n : 0, t: s.t || 0 } : { n: 0, ok: 0, acc: 0, t: 0 }; }
export function masteryOf(progress, subIds) {
  // 0..1: accuracy weighted by how much was practised (saturates at ~30 items)
  let num = 0, den = 0;
  for (const id of subIds) { const s = subStats(progress, id); const w = Math.min(1, s.n / 30); num += s.acc * w; den += 1; }
  return den ? num / den : 0;
}
export function pickItems({ sub, progress, isPro, n = 10, difficulty = 0, seed = Date.now(), mode = "practice" }) {
  if (sub.generated) return generate(sub.id, n, difficulty, seed);
  let pool = sub.items.filter((it) => isPro || !it.pro);
  if (difficulty) pool = pool.filter((it) => it.difficulty === difficulty).length >= Math.min(n, 5) ? pool.filter((it) => it.difficulty === difficulty) : pool;
  // prefer unseen, then wrong, then old
  const score = (it) => { const h = progress.items?.[it.id]; if (!h) return 0 + Math.random() * 0.5; if (!h.ok) return 1 + Math.random() * 0.5; return 2 + (Date.now() - (h.last || 0)) / -8.64e7 + Math.random() * 0.3; };
  const grouped = new Map();
  for (const it of pool) { const g = it.group || it.id; if (!grouped.has(g)) grouped.set(g, []); grouped.get(g).push(it); }
  const groups = [...grouped.values()].map((items) => ({ items, s: Math.min(...items.map(score)) })).sort((a, b) => a.s - b.s);
  const out = [];
  for (const g of groups) { if (out.length >= n) break; for (const it of g.items) { if (out.length >= n) break; out.push(it); } }
  if (mode === "practice") return out.length ? out : pool.slice(0, n);
  return out;
}
export async function pickMixed({ catIds, progress, isPro, n = 20, seed = Date.now() }) {
  const subs = [];
  for (const cid of catIds) { const { subs: s } = await loadCategory(cid); for (const x of s) if (x.id !== "likert") subs.push({ ...x, cat: cid }); }
  if (!subs.length) return [];
  // weakest subs get more items
  const weights = subs.map((s) => { const st = subStats(progress, s.id); return 1 + (st.n ? (1 - st.acc) * 2 : 1.5); });
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = subs.map((s, i) => Math.max(1, Math.round((weights[i] / total) * n)));
  const out = [];
  subs.forEach((s, i) => { out.push(...pickItems({ sub: s, progress, isPro, n: counts[i], seed: seed + i, mode: "mixed" })); });
  // shuffle lightly but keep groups adjacent
  const r = Math.sin(seed) * 10000;
  return out.sort((a, b) => ((a.group || a.id).charCodeAt(0) * r) % 7 - ((b.group || b.id).charCodeAt(0) * r) % 7).slice(0, n);
}

// ---------- markdown (tiny) ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MATH = /(\d[\d.,]*(?:\s*[+\u2212\u00d7\u00f7*\/=:^]\s*[\d.,?()^\u00b2\u00b3]+)+)/g;
export const mathLtr = (escaped) => escaped.replace(MATH, '<bdi dir="ltr">$1</bdi>');
function inline(s) {
  return mathLtr(esc(s))
    .replace(/`([^`]+)`/g, '<code dir="ltr">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export function md(text) {
  if (!text) return "";
  const lines = String(text).replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0, para = [], list = null, table = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((x) => `<li>${inline(x)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushTable = () => { if (table) { const [head, ...rows] = table; out.push(`<div class="tbl"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`); table = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) { flushPara(); flushList(); flushTable(); const lang = line.slice(3).trim(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre dir="ltr" class="code ${esc(lang)}"><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    const h = /^(#{1,4})\s+(.*)/.exec(line);
    if (h) { flushPara(); flushList(); flushTable(); const lvl = Math.min(4, h[1].length + 1); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim()); if (/^\s*\|?\s*:?-{2,}/.test(line)) { i++; continue; } if (!table) table = []; table.push(cells); i++; continue; }
    else flushTable();
    const li = /^\s*([-*•]|\d+[.)])\s+(.*)/.exec(line);
    if (li) { flushPara(); const tag = /\d/.test(li[1]) ? "ol" : "ul"; if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; } list.items.push(li[2]); i++; continue; }
    if (!line.trim()) { flushPara(); flushList(); i++; continue; }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); i++; continue; }
    flushList(); para.push(line.trim()); i++;
  }
  flushPara(); flushList(); flushTable();
  return out.join("\n");
}
export { esc };
